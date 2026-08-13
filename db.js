/*
  db.js
  ------------------------------------------------------------
  IndexedDB layer for HG Export ERP (offline prototype).
  No external libraries, no CDN, no server. Works fully offline
  in any modern browser (Chrome/Firefox/Edge) on Windows 7+.

  IndexedDB is built into the browser itself, so there is nothing
  to install beyond the browser. The database file lives inside
  the browser's profile folder. Export/Import (see backup.js logic
  in app.js) is provided so the user can move data between machines
  or take manual snapshots, since IndexedDB itself is not a single
  portable file.
  ------------------------------------------------------------
*/

const HGDB = (function () {
  const DB_NAME = "hg_export_erp";
  const DB_VERSION = 4;

  const STORES = {
    receipts: "receipt_no",
    declarations: "declaration_no",
    allocations: "id",
    vessels: "id",
    projects: "id",
    operations: "id",
    settings: "key",
    items: "id",
    warehouses: "id",
    customs: "id",
    events: "id",
    nature_determinations: "id"
  };

  let _db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (_db) return resolve(_db);
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onblocked = (e) => {
        reject(new Error(
          `اتصال به پایگاه داده مسدود شد (onblocked). یک نسخه قدیمی‌تر از این صفحه در تب یا پنجره ` +
          `دیگری باز است و مانع ارتقاء نسخه پایگاه داده می‌شود. پایگاه داده: ${DB_NAME}, نسخه هدف: ${DB_VERSION}. ` +
          `همه‌ی تب‌های دیگر این برنامه را ببندید و دوباره تلاش کنید.`
        ));
      };

      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains("receipts")) {
          const s = db.createObjectStore("receipts", { keyPath: "receipt_no" });
          s.createIndex("parent_id", "parent_id");
          s.createIndex("root_id", "root_id");
          s.createIndex("status", "status");
          s.createIndex("project", "project");
        }
        if (!db.objectStoreNames.contains("declarations")) {
          const s = db.createObjectStore("declarations", { keyPath: "declaration_no" });
          s.createIndex("status", "status");
          s.createIndex("project", "project");
        }
        if (!db.objectStoreNames.contains("allocations")) {
          const s = db.createObjectStore("allocations", { keyPath: "id", autoIncrement: true });
          s.createIndex("receipt_no", "receipt_no");
          s.createIndex("declaration_no", "declaration_no");
        }
        if (!db.objectStoreNames.contains("vessels")) {
          const s = db.createObjectStore("vessels", { keyPath: "id", autoIncrement: true });
          s.createIndex("status", "status");
        }
        if (!db.objectStoreNames.contains("projects")) {
          db.createObjectStore("projects", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("operations")) {
          const s = db.createObjectStore("operations", { keyPath: "id", autoIncrement: true });
          s.createIndex("date", "date");
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("items")) {
          db.createObjectStore("items", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("warehouses")) {
          db.createObjectStore("warehouses", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("customs")) {
          db.createObjectStore("customs", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("events")) {
          db.createObjectStore("events", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("nature_determinations")) {
          db.createObjectStore("nature_determinations", { keyPath: "id" });
        }

        // v3/v4 migrations: preserve Split pairing and add a direct split_id index.
        // split_id is an internal integrity key; it does not alter business data.
        if (db.objectStoreNames.contains("receipts")) {
          const store = e.target.transaction.objectStore("receipts");
          if (!store.indexNames.contains("split_id")) {
            store.createIndex("split_id", "split_id");
          }
        }
        if (e.oldVersion < 3 && db.objectStoreNames.contains("receipts")) {
          const store = e.target.transaction.objectStore("receipts");
          const req = store.openCursor();
          req.onsuccess = () => {
            const cur = req.result;
            if (!cur) return;
            const row = cur.value;
            if (row.parent_id && !row.split_id) {
              row.split_id = `SPLIT-${row.parent_id}`;
              cur.update(row);
            }
            cur.continue();
          };
        }
      };

      req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror = (e) => {
        const err = e.target.error;
        const wrapped = new Error(
          `خطا در باز کردن پایگاه داده (operation: indexedDB.open, db: ${DB_NAME}, version: ${DB_VERSION}): ` +
          (err ? err.message : "خطای نامشخص")
        );
        wrapped.original = err;
        reject(wrapped);
      };
    });
  }

  function tx(storeNames, mode = "readonly") {
    return open().then(db => db.transaction(storeNames, mode));
  }

  // Wraps a raw IndexedDB error with the operation name and store involved,
  // so a failure is never just a bare, unlabeled DOMException in the console.
  function wrapErr(operation, storeName, rawErr) {
    const e = new Error(
      `خطا در عملیات پایگاه داده (operation: ${operation}, store: ${storeName}, db: ${DB_NAME} v${DB_VERSION}): ` +
      (rawErr ? rawErr.message : "خطای نامشخص")
    );
    e.original = rawErr;
    return e;
  }

  function getAll(storeName) {
    return open().then(db => new Promise((resolve, reject) => {
      const store = db.transaction(storeName, "readonly").objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(wrapErr("getAll", storeName, req.error));
    }));
  }

  function get(storeName, key) {
    return open().then(db => new Promise((resolve, reject) => {
      const store = db.transaction(storeName, "readonly").objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(wrapErr("get", storeName, req.error));
    }));
  }

  function triggerSync() {
    if (typeof HGFileStore !== "undefined" && HGFileStore.isConnected()) {
      HGFileStore.scheduleSync(exportAll);
    }
  }

  function put(storeName, value) {
    return open().then(db => new Promise((resolve, reject) => {
      const store = db.transaction(storeName, "readwrite").objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => { triggerSync(); resolve(req.result); };
      req.onerror = () => reject(wrapErr("put", storeName, req.error));
    }));
  }

  function remove(storeName, key) {
    return open().then(db => new Promise((resolve, reject) => {
      const store = db.transaction(storeName, "readwrite").objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => { triggerSync(); resolve(); };
      req.onerror = () => reject(wrapErr("delete", storeName, req.error));
    }));
  }

  function clearStore(storeName) {
    return open().then(db => new Promise((resolve, reject) => {
      const store = db.transaction(storeName, "readwrite").objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => { triggerSync(); resolve(); };
      req.onerror = () => reject(wrapErr("clear", storeName, req.error));
    }));
  }

  function byIndex(storeName, indexName, value) {
    return open().then(db => new Promise((resolve, reject) => {
      const store = db.transaction(storeName, "readonly").objectStore(storeName);
      const idx = store.index(indexName);
      const req = idx.getAll(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(wrapErr(`byIndex(${indexName})`, storeName, req.error));
    }));
  }

  function transaction(storeNames, mode, worker) {
    return open().then(db => new Promise((resolve, reject) => {
      let settled = false;
      const t = db.transaction(storeNames, mode);
      const stores = {};
      storeNames.forEach(name => { stores[name] = t.objectStore(name); });
      let result;
      try { result = worker(stores, t); }
      catch (err) { try { t.abort(); } catch (_) {} reject(err); return; }
      t.oncomplete = () => { settled = true; if (mode === "readwrite") triggerSync(); resolve(result); };
      t.onerror = () => { if (!settled) reject(wrapErr("transaction", storeNames.join(","), t.error)); };
      t.onabort = () => { if (!settled) reject(t.error || new Error("تراکنش پایگاه داده لغو شد.")); };
    }));
  }

  async function exportAll() {
    const out = {};
    for (const name of Object.keys(STORES)) {
      out[name] = await getAll(name);
    }
    out._meta = { exported_at: new Date().toISOString(), db_name: DB_NAME, version: DB_VERSION };
    return out;
  }

  async function importAll(payload) {
    for (const name of Object.keys(STORES)) {
      if (!payload[name]) continue;
      await clearStore(name);
      const db = await open();
      await new Promise((resolve, reject) => {
        const store = db.transaction(name, "readwrite").objectStore(name);
        payload[name].forEach(row => store.put(row));
        store.transaction.oncomplete = resolve;
        store.transaction.onerror = () => reject(store.transaction.error);
      });
    }
  }

  async function wipeAll() {
    for (const name of Object.keys(STORES)) {
      await clearStore(name);
    }
  }

  // ---------------- Production seed from FINAL Excel ----------------
  async function seedIfEmpty() {
    const source = (typeof HG_PRODUCTION_DATA !== "undefined") ? HG_PRODUCTION_DATA : null;
    if (!source) throw new Error("فایل داده تولیدی یافت نشد.");

    const imported = await get("settings", "production_imported");
    if (imported && imported.value === source.meta.source_file) return false;

    const existingReceipts = await getAll("receipts");
    const hasDemo = existingReceipts.some(r => String(r.receipt_no || "").startsWith("DEMO-"));
    if (existingReceipts.length > 0 && !hasDemo) return false;

    // Replace only the old demo/empty local database on first production seed.
    await wipeAll();

    for (const r of source.receipts) await put("receipts", r);
    for (const d of source.declarations) await put("declarations", d);
    for (const a of source.allocations) await put("allocations", a);
    for (const v of source.vessels) await put("vessels", v);
    for (const p of source.projects) await put("projects", p);
    for (const o of source.operations) await put("operations", o);
    for (const i of source.items) await put("items", i);
    for (const w of source.warehouses) await put("warehouses", w);
    for (const c of source.customs) await put("customs", c);
    for (const e of source.events) await put("events", e);
    for (const n of source.nature_determinations) await put("nature_determinations", n);

    await put("settings", { key: "split_tolerance", value: 0.01 });
    await put("settings", { key: "production_imported", value: source.meta.source_file });
    await put("settings", { key: "production_import_date", value: source.meta.imported_at });
    await put("settings", { key: "production_source_counts", value: JSON.stringify(source.meta.counts) });
    await put("settings", { key: "production_source_totals", value: JSON.stringify(source.meta.totals) });

    return true;
  }

  return {
    open, getAll, get, put, remove, clearStore, byIndex, transaction,
    exportAll, importAll, wipeAll, seedIfEmpty,
    STORES
  };
})();
