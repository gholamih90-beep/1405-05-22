/*
  filestore.js
  ------------------------------------------------------------
  Durable, portable, automatic persistence layer.

  WHY THIS EXISTS:
  IndexedDB lives inside the browser's profile. Clearing "cookies and
  site data" wipes it, and the data never travels if the project folder
  is copied to another machine. This module mirrors the ENTIRE dataset
  to a real file on disk (e.g. "hg-erp-data.json", which the person can
  keep right next to the project folder) using the File System Access
  API (supported in Chrome/Edge, confirmed to work even on file:// URLs
  used to open this app locally).

  ARCHITECTURE:
  - IndexedDB (db.js) remains the fast, query-friendly working store --
    nothing about how the rest of the app reads/writes data changes.
  - This module is a thin, additive sync layer: after every mutation,
    db.js asks it to schedule a debounced full-state write to the
    connected file. On boot, if a file is connected, its content is
    loaded IN to IndexedDB (the file is the durable source of truth;
    IndexedDB is just the fast runtime mirror of it).
  - If the browser doesn't support this API, or no file is connected
    yet, everything falls back to plain IndexedDB exactly as before --
    nothing breaks, the person just doesn't get the durability benefit
    until they connect a file once.

  PORTABILITY:
  Because the actual persisted bytes live in a real file (not the
  browser profile), copying the project folder + that data file to a
  USB stick or another PC brings the real data with it. On the new
  machine, one click ("اتصال به فایل داده") is needed to (re)grant
  permission -- browsers require this per origin+file for security --
  but the data itself was never at risk.
  ------------------------------------------------------------
*/

const HGFileStore = (function () {
  let fileHandle = null;
  let writeTimer = null;
  let lastError = null;
  const DEBOUNCE_MS = 500;
  const listeners = [];

  function supported() {
    return typeof window !== "undefined" && typeof window.showSaveFilePicker === "function";
  }

  function emit(status, detail) {
    listeners.forEach(fn => { try { fn(status, detail); } catch (e) { /* ignore listener errors */ } });
  }
  function onStatusChange(fn) { listeners.push(fn); }

  // ---- Where we remember *which* file was picked, across reloads ----
  // A FileSystemFileHandle can be stored via structured clone in
  // IndexedDB. This is a tiny, separate database used only to hold that
  // one pointer -- if it's ever lost (e.g. cache cleared), the real data
  // file on disk is completely unaffected; the person just needs to
  // reconnect once via a file picker.
  const HANDLE_DB_NAME = "hg_filestore_handle";
  function openHandleDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(HANDLE_DB_NAME, 1);
      req.onupgradeneeded = (e) => { e.target.result.createObjectStore("handles"); };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function saveHandleRef(handle) {
    const db = await openHandleDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("handles", "readwrite");
      tx.objectStore("handles").put(handle, "main");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async function loadHandleRef() {
    const db = await openHandleDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("handles", "readonly");
      const req = tx.objectStore("handles").get("main");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }
  async function clearHandleRef() {
    const db = await openHandleDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("handles", "readwrite");
      tx.objectStore("handles").delete("main");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ---- Connection lifecycle ----
  async function tryAutoReconnect() {
    if (!supported()) { emit("unsupported"); return false; }
    try {
      const handle = await loadHandleRef();
      if (!handle) { emit("disconnected"); return false; }
      const perm = await handle.queryPermission({ mode: "readwrite" });
      fileHandle = handle;
      if (perm === "granted") { emit("connected", handle.name); return true; }
      emit("needs-permission", handle.name);
      return false;
    } catch (e) {
      emit("disconnected");
      return false;
    }
  }

  async function requestPermissionNow() {
    if (!fileHandle) return false;
    try {
      const perm = await fileHandle.requestPermission({ mode: "readwrite" });
      if (perm === "granted") { emit("connected", fileHandle.name); return true; }
      emit("needs-permission", fileHandle.name);
      return false;
    } catch (e) {
      emit("needs-permission", fileHandle.name);
      return false;
    }
  }

  async function connectNew(suggestedName) {
    if (!supported()) throw new Error("این مرورگر از ذخیره‌سازی فایل واقعی پشتیبانی نمی‌کند (Chrome/Edge لازم است).");
    const handle = await window.showSaveFilePicker({
      suggestedName: suggestedName || "hg-erp-data.json",
      types: [{ description: "HG ERP Data", accept: { "application/json": [".json"] } }]
    });
    fileHandle = handle;
    await saveHandleRef(handle);
    emit("connected", handle.name);
    return handle;
  }

  async function connectExisting() {
    if (!supported()) throw new Error("این مرورگر از ذخیره‌سازی فایل واقعی پشتیبانی نمی‌کند (Chrome/Edge لازم است).");
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: "HG ERP Data", accept: { "application/json": [".json"] } }]
    });
    fileHandle = handle;
    await saveHandleRef(handle);
    emit("connected", handle.name);
    return handle;
  }

  async function disconnect() {
    fileHandle = null;
    await clearHandleRef();
    emit("disconnected");
  }

  // ---- Read / write the whole dataset ----
  async function readAll() {
    if (!fileHandle) return null;
    const file = await fileHandle.getFile();
    const text = await file.text();
    if (!text || !text.trim()) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      lastError = "فایل داده معتبر نیست (JSON قابل‌خواندن نبود).";
      emit("save-error", lastError);
      return null;
    }
  }

  async function writeAllNow(dataObj) {
    if (!fileHandle) return false;
    try {
      emit("saving");
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(dataObj, null, 2));
      await writable.close();
      emit("saved", fileHandle.name);
      return true;
    } catch (e) {
      lastError = e && e.message ? e.message : String(e);
      emit("save-error", lastError);
      return false;
    }
  }

  // Debounced: many rapid mutations (e.g. a split creating several
  // receipts back to back) collapse into a single file write.
  function scheduleSync(getDataFn) {
    if (!fileHandle) return;
    clearTimeout(writeTimer);
    writeTimer = setTimeout(async () => {
      try {
        const data = await getDataFn();
        await writeAllNow(data);
      } catch (e) {
        lastError = e && e.message ? e.message : String(e);
        emit("save-error", lastError);
      }
    }, DEBOUNCE_MS);
  }

  function isConnected() { return !!fileHandle; }
  function connectedName() { return fileHandle ? fileHandle.name : null; }
  function getLastError() { return lastError; }

  return {
    supported, tryAutoReconnect, requestPermissionNow,
    connectNew, connectExisting, disconnect,
    readAll, writeAllNow, scheduleSync,
    isConnected, connectedName, getLastError,
    onStatusChange
  };
})();
