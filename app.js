/* HG ERP V2.2 bundled runtime
   render.js is intentionally bundled before app.js to eliminate local-file
   script loading/order problems. */

/*
  render.js
  ------------------------------------------------------------
  Pure view functions: (data) -> HTML string.
  app.js is responsible for fetching data, calling these, and
  wiring up event listeners after injecting the HTML.
  ------------------------------------------------------------
*/

const HGRender = (function () {

  function esc(s) {
    if (s === null || s === undefined) return "";
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  function fmt(n) {
    const s = Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 3 });
    return toPersianDigits(s);
  }
  function toPersianDigits(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
  }

  function isDemo(id) { return typeof id === "string" && id.startsWith("DEMO"); }
  function demoBadge(id) { return isDemo(id) ? '<span class="badge-demo">DEMO</span>' : ""; }

  function statusPill(status) {
    const map = {
      "فعال": "status-active",
      "تقسیم شده": "status-split",
      "بسته": "status-closed",
      "ابطال شده": "status-cancelled"
    };
    return `<span class="status-pill ${map[status] || ""}">${esc(status)}</span>`;
  }

  // ---------------- Dashboard ----------------
  function dashboard(kpi) {
    return `
      <h1 class="page-title">داشبورد</h1>
      <div class="page-sub">نمای کلی عملیات انبار گمرکی صادرات کلینکر</div>

      <div class="quick-actions"><a href="#/receipts" class="quick-action">▣ <span>مدیریت قبض‌ها</span></a><a href="#/vessels" class="quick-action">⚓ <span>ثبت شناور / عملیات</span></a><a href="#/reports" class="quick-action">▥ <span>گزارش‌ها</span></a><a href="#/tree" class="quick-action">⌘ <span>شجره قبض</span></a></div><div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-label">موجودی کل (تن)</div><div class="kpi-value">${fmt(kpi.totalInventory)}</div></div>
        <div class="kpi-card turq"><div class="kpi-label">کل وزن ورودی (تن)</div><div class="kpi-value">${fmt(kpi.totalIncoming)}</div></div>
        <div class="kpi-card turq"><div class="kpi-label">کل وزن تخصیص‌یافته (تن)</div><div class="kpi-value">${fmt(kpi.totalAllocated)}</div></div>
        <div class="kpi-card"><div class="kpi-label">تعداد قبض فعال</div><div class="kpi-value">${fmt(kpi.activeReceipts)}</div></div>
        <div class="kpi-card"><div class="kpi-label">تعداد قبض بسته</div><div class="kpi-value">${fmt(kpi.closedReceipts)}</div></div>
        <div class="kpi-card"><div class="kpi-label">تعداد اظهار</div><div class="kpi-value">${fmt(kpi.declarationCount)}</div></div>
        <div class="kpi-card danger"><div class="kpi-label">تعداد شناورها</div><div class="kpi-value">${fmt(kpi.vesselCount)}</div></div>
      </div>

      <div class="panel">
        <h2>آخرین عملیات</h2>
        <table>
          <thead><tr><th>تاریخ</th><th>نوع</th><th>شرح</th></tr></thead>
          <tbody>
            ${kpi.lastOps.map(o => `
              <tr>
                <td>${esc((o.date || "").slice(0,10))}</td>
                <td>${esc(o.type)}</td>
                <td>${esc(o.description)}</td>
              </tr>`).join("") || `<tr><td colspan="3">عملیاتی ثبت نشده است.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  // ---------------- Receipts list ----------------
  function receiptsPage(receipts, projects, filterState) {
    const rows = receipts.map((r,i) => `
      <tr>
        <td class="rownum">${toPersianDigits(i+1)}</td>
        <td>${demoBadge(r.receipt_no)}${esc(r.receipt_no)}</td>
        <td>${esc(r.type)}</td>
        <td>${r.parent_id ? `<a class="link" data-goto-receipt="${esc(r.parent_id)}">${esc(r.parent_id)}</a>` : "—"}</td>
        <td><a class="link" data-goto-tree="${esc(r.root_id)}">${esc(r.root_id)}</a></td>
        <td>${fmt(r.initial_weight)}</td>
        <td>${fmt(r._inventory)}</td>
        <td>${esc(r.project)}</td>
        <td>${statusPill(r._status_calc)}</td>
        <td>${esc(r.date)}</td>
        <td>
          <button class="btn small outline" data-action="view-receipt" data-id="${esc(r.receipt_no)}">مشاهده</button>
          <button class="btn small outline" data-action="open-edit-receipt" data-id="${esc(r.receipt_no)}">ویرایش</button>
          <button class="btn small gold" data-action="open-split" data-id="${esc(r.receipt_no)}">تقسیم قبض</button>
          <button class="btn small outline" data-action="open-allocate" data-id="${esc(r.receipt_no)}">تخصیص</button>
          <button class="btn small outline" data-action="goto-tree" data-id="${esc(r.root_id)}">شجره</button>
          <button class="btn small danger" data-action="delete-receipt" data-id="${esc(r.receipt_no)}">حذف</button>
        </td>
      </tr>
    `).join("");

    return `
      <h1 class="page-title">قبض‌های انبار</h1>
      <div class="page-sub">مدیریت قبض‌های ورودی، تقسیم و پیگیری موجودی</div>

      <div class="toolbar">
        <input type="text" id="fltSearch" placeholder="جستجوی شماره قبض..." value="${esc(filterState.search || "")}">
        <select id="fltStatus">
          <option value="">همه وضعیت‌ها</option>
          ${HGLogic.RECEIPT_STATUS.map(s => `<option value="${s}" ${filterState.status===s?"selected":""}>${s}</option>`).join("")}
        </select>
        <select id="fltProject">
          <option value="">همه پروژه‌ها</option>
          ${projects.map(p => `<option value="${esc(p.name)}" ${filterState.project===p.name?"selected":""}>${esc(p.name)}</option>`).join("")}
        </select>
        <button class="btn gold" data-action="open-new-receipt">+ قبض جدید</button>
      </div>

      <div class="panel">
        <table>
          <thead>
            <tr>
              <th class="rownum">ردیف</th><th>شماره قبض</th><th>نوع</th><th>والد</th><th>ریشه</th>
              <th>وزن اولیه</th><th>موجودی</th><th>پروژه</th><th>وضعیت</th><th>تاریخ</th><th>عملیات</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="11">قبضی یافت نشد.</td></tr>`}</tbody>
        </table>
        <div class="small-note" style="margin-top:8px">تعداد سطر: ${fmt(receipts.length)}</div>
      </div>
    `;
  }

  function receiptDetail(receipt, children, allocations) {
    const allocRows = allocations.map(a => `
      <tr><td><a class="link" data-goto-declaration="${esc(a.declaration_no)}">${esc(a.koutaj_no || a.declaration_no)}</a></td><td>${fmt(a.weight)}</td><td>${esc(a.date)}</td></tr>
    `).join("");
    return `
      <h1 class="page-title">جزئیات قبض ${demoBadge(receipt.receipt_no)}${esc(receipt.receipt_no)}</h1>
      <div class="page-sub"><a class="link" href="#/receipts">&rarr; بازگشت به فهرست قبض‌ها</a></div>
      <div class="toolbar">
        <button class="btn gold" data-action="open-split" data-id="${esc(receipt.receipt_no)}">تقسیم قبض</button>
        <button class="btn outline" data-action="open-allocate" data-id="${esc(receipt.receipt_no)}">تخصیص جدید</button>
        <button class="btn outline" data-action="open-edit-receipt" data-id="${esc(receipt.receipt_no)}">ویرایش</button>
        <button class="btn danger" data-action="delete-receipt" data-id="${esc(receipt.receipt_no)}">حذف قبض</button>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-label">نوع</div><div class="kpi-value">${esc(receipt.type)}</div></div>
        <div class="kpi-card"><div class="kpi-label">وزن اولیه</div><div class="kpi-value">${fmt(receipt.initial_weight)}</div></div>
        <div class="kpi-card turq"><div class="kpi-label">موجودی فعلی</div><div class="kpi-value">${fmt(receipt._inventory)}</div></div>
        <div class="kpi-card"><div class="kpi-label">وضعیت</div><div class="kpi-value">${statusPill(receipt._status_calc)}</div></div>
      </div>

      <div class="panel">
        <h2>مشخصات</h2>
        <table>
          <tr><th>والد</th><td>${receipt.parent_id ? `<a class="link" data-goto-receipt="${esc(receipt.parent_id)}">${esc(receipt.parent_id)}</a>` : "—"}</td>
              <th>ریشه</th><td><a class="link" data-goto-tree="${esc(receipt.root_id)}">${esc(receipt.root_id)}</a></td></tr>
          <tr><th>پروژه</th><td>${esc(receipt.project)}</td><th>انبار</th><td>${esc(receipt.warehouse||"—")}</td></tr>
          <tr><th>تاریخ</th><td>${esc(receipt.date)}</td><th>یادداشت</th><td>${esc(receipt.notes||"—")}</td></tr>
        </table>
      </div>

      <div class="panel">
        <h2>قبض‌های فرزند (${children.length})</h2>
        ${children.length ? `
        <table>
          <thead><tr><th>شماره</th><th>نوع</th><th>وزن اولیه</th><th>موجودی</th><th>وضعیت</th></tr></thead>
          <tbody>
            ${children.map(c => `
              <tr>
                <td><a class="link" data-goto-receipt="${esc(c.receipt_no)}">${esc(c.receipt_no)}</a></td>
                <td>${esc(c.type)}</td><td>${fmt(c.initial_weight)}</td><td>${fmt(c._inventory)}</td>
                <td>${statusPill(c._status_calc)}</td>
              </tr>`).join("")}
          </tbody>
        </table>` : `<div class="small-note">این قبض هنوز تقسیم نشده است.</div>`}
      </div>

      <div class="panel">
        <h2>تخصیص‌های این قبض به اظهارها</h2>
        <table>
          <thead><tr><th>شماره اظهار</th><th>وزن تخصیص</th><th>تاریخ</th></tr></thead>
          <tbody>${allocRows || `<tr><td colspan="3">تخصیصی ثبت نشده است.</td></tr>`}</tbody>
        </table>
      </div>
    `;
  }

  // ---------------- Split modal ----------------
  function splitModal(parent, tolerance) {
    const available = Number(parent._available_for_split != null ? parent._available_for_split : parent._inventory) || 0;
    return `
      <div class="modal-overlay" id="splitOverlay">
        <div class="modal-box">
          <h2>تفکیک قبض ${esc(parent.receipt_no)}</h2>
          <div class="split-summary">
            <div>وزن اولیه قبض: <b>${fmt(parent.initial_weight)}</b></div>
            <div>موجودی قابل تفکیک فعلی: <b>${fmt(available)}</b> تن</div>
          </div>
          <p class="small-note">در هر تفکیک دقیقاً یک قبض اظهاری و یک قبض مانده ایجاد می‌شود. وزن قبض مانده خودکار محاسبه می‌شود. اگر کل موجودی قرار است استفاده شود، از «تخصیص مستقیم» استفاده کنید.</p>
          <div id="splitErrors"></div>
          <div id="splitAvailability" class="small-note"></div>
          <div id="splitRows">${splitRowHtml(0)}${splitRowHtml(1)}</div>
          <div class="split-summary">
            <div>مجموع دو فرزند: <b id="splitTotal">0</b></div>
            <div>اختلاف با موجودی: <b id="splitDiff">0</b></div>
          </div>
          <div class="modal-actions">
            <button class="btn gold" id="saveSplitBtn" data-action="save-split" data-id="${esc(parent.receipt_no)}" disabled>ذخیره تفکیک</button>
            <button class="btn outline" data-action="close-modal">انصراف</button>
          </div>
        </div>
      </div>`;
  }

  function splitRowHtml(idx) {
    const isDecl = idx === 0;
    return `
      <div class="split-row" data-row="${idx}">
        <input type="text" placeholder="شماره قبض ${isDecl ? 'اظهاری' : 'مانده'}" data-field="receipt_no">
        <input type="text" value="${isDecl ? 'اظهاری' : 'مانده'}" data-field="type" readonly>
        <input type="number" step="0.001" placeholder="وزن (تن)" data-field="weight" ${isDecl ? '' : 'readonly'}>
        <span class="small-note">${isDecl ? 'وزن را وارد کنید' : 'خودکار'}</span>
      </div>`;
  }

  // ---------------- Allocation modal ----------------
  function allocateModal(receipt, declarations) {
    return `
      <div class="modal-overlay" id="allocOverlay">
        <div class="modal-box">
          <h2>تخصیص قبض ${esc(receipt.receipt_no)} به اظهار</h2>
          <div class="split-summary">
            <div>موجودی قابل تخصیص فعلی: <b>${fmt(receipt._allocatable != null ? receipt._allocatable : receipt._inventory)}</b></div>
          </div>
          <div id="allocErrors"></div>
          <div class="form-grid">
            <div>
              <label>اظهار مقصد</label>
              <select id="allocDeclaration">
                <option value="">— انتخاب اظهار موجود —</option>
                ${declarations.map(d => `<option value="${esc(d.declaration_no)}">${esc(d.koutaj_no || d.declaration_no)} (${esc(d.project)})</option>`).join("")}
                <option value="__NEW__">+ ایجاد اظهار جدید</option>
              </select>
            </div>
            <div id="newDeclarationWrap" style="display:none;">
              <label>شماره اظهار جدید</label>
              <input type="text" id="newDeclarationNo" placeholder="مثلا D-1010">
            </div>
            <div>
              <label>وزن تخصیص (تن)</label>
              <input type="number" step="0.001" id="allocWeight">
            </div>
            <div>
              <label>تاریخ</label>
              <input type="text" id="allocDate" class="jalali-input" value="${HGJalali.todayString()}">
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn gold" data-action="save-allocation" data-id="${esc(receipt.receipt_no)}">ذخیره تخصیص</button>
            <button class="btn outline" data-action="close-modal">انصراف</button>
          </div>
        </div>
      </div>
    `;
  }

  function newAllocationModal(receipts, declarations) {
    return `
      <div class="modal-overlay"><div class="modal-box">
        <h2>ثبت تخصیص جدید</h2><div id="newAllocErrors"></div>
        <div class="form-grid">
          <div><label>شماره اظهار</label><select id="naDecl"><option value="">— انتخاب —</option>
            ${declarations.map(d=>`<option value="${esc(d.declaration_no)}">${esc(d.koutaj_no||d.declaration_no)}</option>`).join("")}
          </select></div>
          <div><label>قبض</label><select id="naReceipt"><option value="">— انتخاب —</option>
            ${receipts.filter(r=>Number(r._allocatable != null ? r._allocatable : r._inventory)>0 && r._status_calc!=="تقسیم شده" && r._status_calc!=="ابطال شده").map(r=>`<option value="${esc(r.receipt_no)}">${esc(r.receipt_no)} — قابل تخصیص ${fmt(r._allocatable != null ? r._allocatable : r._inventory)}</option>`).join("")}
          </select></div>
          <div><label>وزن تخصیص (تن)</label><input id="naWeight" type="number" step="0.001"></div>
          <div><label>تاریخ</label><input id="naDate" type="text" class="jalali-input" value="${HGJalali.todayString()}"></div>
          <div class="field-full"><div id="naAvail" class="small-note"></div></div>
        </div>
        <div class="modal-actions"><button class="btn gold" data-action="save-new-allocation">ثبت تخصیص</button><button class="btn outline" data-action="close-modal">انصراف</button></div>
      </div></div>`;
  }

  // ---------------- New receipt modal ----------------
  function newReceiptModal(receipts, projects) {
    return `
      <div class="modal-overlay" id="newReceiptOverlay">
        <div class="modal-box">
          <h2>ثبت قبض جدید</h2>
          <div id="newReceiptErrors"></div>
          <div class="form-grid">
            <div><label>شماره قبض</label><input type="text" id="nrNo"></div>
            <div><label>نوع</label>
              <select id="nrType"><option value="اصلی">اصلی</option></select>
            </div>
            <div><label>قبض والد (اختیاری)</label>
              <select id="nrParent">
                <option value="">— بدون والد (ریشه جدید) —</option>
                ${receipts.map(r => `<option value="${esc(r.receipt_no)}">${esc(r.receipt_no)}</option>`).join("")}
              </select>
            </div>
            <div><label>کالا</label><input type="text" id="nrItem" value="کلینکر سیمان"></div>
            <div><label>وزن اولیه (تن)</label><input type="number" step="0.001" id="nrWeight"></div>
            <div><label>پروژه</label>
              <input list="projList" id="nrProject">
              <datalist id="projList">${projects.map(p => `<option value="${esc(p.name)}">`).join("")}</datalist>
            </div>
            <div><label>انبار</label><input type="text" id="nrWarehouse"></div>
            <div><label>تاریخ</label><input type="text" id="nrDate" class="jalali-input" value="${HGJalali.todayString()}"></div>
            <div class="field-full"><label>یادداشت</label><textarea id="nrNotes" rows="2"></textarea></div>
          </div>
          <div class="modal-actions">
            <button class="btn gold" data-action="save-new-receipt">ذخیره</button>
            <button class="btn outline" data-action="close-modal">انصراف</button>
          </div>
        </div>
      </div>
    `;
  }

  function editReceiptModal(receipt) {
    return `
      <div class="modal-overlay" id="editReceiptOverlay">
        <div class="modal-box">
          <h2>ویرایش قبض ${esc(receipt.receipt_no)}</h2>
          <p class="small-note">شماره قبض، نوع و والد پس از ایجاد قابل تغییر نیستند.</p>
          <div id="editReceiptErrors"></div>
          <div class="form-grid">
            <div><label>شماره قبض</label><input type="text" value="${esc(receipt.receipt_no)}" disabled></div>
            <div><label>نوع</label><input type="text" value="${esc(receipt.type)}" disabled></div>
            <div><label>کالا</label><input type="text" id="erItem" value="${esc(receipt.item || "")}"></div>
            <div><label>وزن اولیه (تن)</label><input type="number" step="0.001" id="erWeight" value="${receipt.initial_weight}"></div>
            <div><label>پروژه</label><input type="text" id="erProject" value="${esc(receipt.project || "")}"></div>
            <div><label>انبار</label><input type="text" id="erWarehouse" value="${esc(receipt.warehouse || "")}"></div>
            <div><label>تاریخ</label><input type="text" id="erDate" class="jalali-input" value="${esc(receipt.date || "")}"></div>
            <div class="field-full"><label>یادداشت</label><textarea id="erNotes" rows="2">${esc(receipt.notes || "")}</textarea></div>
          </div>
          <div class="modal-actions">
            <button class="btn gold" data-action="save-edit-receipt" data-id="${esc(receipt.receipt_no)}">ذخیره تغییرات</button>
            <button class="btn outline" data-action="close-modal">انصراف</button>
          </div>
        </div>
      </div>
    `;
  }

  // ---------------- Declarations ----------------
  function declarationsPage(declarations, totalsByDecl) {
    const rows = declarations.map((d,i) => `
      <tr>
        <td class="rownum">${toPersianDigits(i+1)}</td>
        <td>${demoBadge(d.koutaj_no || d.declaration_no)}${esc(d.koutaj_no || d.declaration_no)}</td>
        <td>${esc(d.date)}</td>
        <td>${esc(d.project)}</td>
        <td>${esc(d.status)}</td>
        <td>${fmt(totalsByDecl[d.declaration_no] || 0)}</td>
        <td>${esc(d.notes||"")}</td>
        <td>
          <button class="btn small outline" data-action="view-declaration" data-id="${esc(d.declaration_no)}">مشاهده تخصیص‌ها</button>
          <button class="btn small outline" data-action="open-edit-declaration" data-id="${esc(d.declaration_no)}">ویرایش</button>
          <button class="btn small danger" data-action="delete-declaration" data-id="${esc(d.declaration_no)}">حذف</button>
        </td>
      </tr>
    `).join("");

    return `
      <h1 class="page-title">اظهارهای گمرکی</h1>
      <div class="page-sub">هر اظهار می‌تواند از چند قبض تغذیه شود</div>
      <div class="toolbar">
        <button class="btn gold" data-action="open-new-declaration">+ اظهار جدید</button>
      </div>
      <div class="panel">
        <table>
          <thead><tr><th class="rownum">ردیف</th><th>شماره اظهار</th><th>تاریخ</th><th>پروژه</th><th>وضعیت</th><th>مجموع دریافتی (تن)</th><th>یادداشت</th><th>عملیات</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="8">اظهاری ثبت نشده است.</td></tr>`}</tbody>
        </table>
        <div class="small-note" style="margin-top:8px">تعداد سطر: ${fmt(declarations.length)}</div>
      </div>
    `;
  }

  function newDeclarationModal(projects, vessels, operations) {
    return `
      <div class="modal-overlay"><div class="modal-box">
        <h2>ثبت اظهار جدید</h2><div id="newDeclErrors"></div>
        <div class="form-grid">
          <div><label>شماره اظهار</label><input type="text" id="ndNo"></div>
          <div><label>تاریخ</label><input type="text" id="ndDate" class="jalali-input" value="${HGJalali.todayString()}"></div>
          <div><label>نام شناور</label>
            <select id="ndVessel">
              <option value="">— انتخاب شناور —</option>
              ${(vessels||[]).map(v=>`<option value="${esc(v.vessel_name)}">${esc(v.vessel_name)}</option>`).join("")}
            </select>
          </div>
          <div><label>عملیات</label>
            <select id="ndOperation">
              <option value="">— انتخاب عملیات —</option>
              ${(operations||[]).filter(o=>o.type==="بارگیری صادرات" || o.type==="عملیات شناور").map(o=>`<option value="${esc(o.id)}" data-vessel="${esc(o.vessel_name)}">${esc(o.id)} — ${esc(o.vessel_name||"")} (${esc(o.entry_date||o.date||"")})</option>`).join("")}
            </select>
          </div>
          <div><label>پروژه</label><input list="projList2" id="ndProject"><datalist id="projList2">${projects.map(p=>`<option value="${esc(p.name)}">`).join("")}</datalist></div>
          <div><label>وضعیت</label><select id="ndStatus"><option>ثبت شده</option><option>در حال عملیات</option><option>تکمیل شده</option></select></div>
          <div class="field-full"><label>یادداشت</label><textarea id="ndNotes" rows="2"></textarea></div>
        </div>
        <div class="modal-actions"><button class="btn gold" data-action="save-new-declaration">ذخیره</button><button class="btn outline" data-action="close-modal">انصراف</button></div>
      </div></div>`;
  }

  function declarationDetail(decl, allocations) {
    const rows = allocations.map(a => `
      <tr>
        <td><a class="link" data-goto-receipt="${esc(a.receipt_no)}">${esc(a.receipt_no)}</a></td>
        <td>${fmt(a.weight)}</td>
        <td>${esc(a.date || "—")}</td>
        <td>${esc(a.status || "")}</td>
      </tr>
    `).join("");
    const total = allocations.reduce((s, a) => s + Number(a.weight || 0), 0);
    return `
      <h1 class="page-title">اظهار ${demoBadge(decl.koutaj_no || decl.declaration_no)}${esc(decl.koutaj_no || decl.declaration_no)}</h1>
      <div class="page-sub"><a class="link" href="#/declarations">&rarr; بازگشت به فهرست اظهارها</a></div>
      <div class="panel">
        <table>
          <tr><th>شماره کوتاژ</th><td>${esc(decl.koutaj_no || decl.declaration_no)}</td><th>تاریخ</th><td>${esc(decl.date)}</td></tr>
          <tr><th>شناور</th><td>${esc(decl.vessel_name || decl.vessel || "—")}</td><th>عملیات مرتبط</th><td>${esc(decl.operation_id || "—")}</td></tr>
          <tr><th>پروژه</th><td>${esc(decl.project || "—")}</td><th>وضعیت</th><td>${esc(decl.status)}</td></tr>
          <tr><th>مجموع دریافتی</th><td>${fmt(total)}</td><th>یادداشت</th><td>${esc(decl.notes || "—")}</td></tr>
        </table>
      </div>
      <div class="panel">
        <h2>قبض‌های منبع (تخصیص‌ها)</h2>
        <table>
          <thead><tr><th>شماره قبض</th><th>وزن تخصیص</th><th>تاریخ</th><th>وضعیت</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="4">تخصیصی ثبت نشده است.</td></tr>`}</tbody>
        </table>
      </div>
    `;
  }

  function allocationsPage(allocations) {
    const rows = allocations.map((a,i) => `
      <tr>
        <td class="rownum">${toPersianDigits(i+1)}</td>
        <td><a class="link" data-goto-receipt="${esc(a.receipt_no)}">${esc(a.receipt_no)}</a></td>
        <td><a class="link" data-goto-declaration="${esc(a.declaration_no)}">${esc(a.koutaj_no || a.declaration_no)}</a></td>
        <td>${fmt(a.weight)}</td>
        <td>${esc(a.date || "—")}</td>
        <td>${esc(a.status || "")}</td>
        <td><button class="btn small outline" data-action="open-edit-allocation" data-id="${esc(a.id)}">ویرایش</button>
          <button class="btn small danger" data-action="delete-allocation" data-id="${esc(a.id)}">حذف</button></td>
      </tr>
    `).join("");
    return `
      <h1 class="page-title">دفتر تخصیص‌ها</h1>
      <div class="page-sub">رابطه چند به چند بین قبض‌ها و اظهارها</div>
      <div class="toolbar"><button class="btn gold" data-action="open-new-allocation">+ ثبت تخصیص جدید</button></div>
      <div class="panel">
        <table>
          <thead><tr><th class="rownum">ردیف</th><th>قبض</th><th>اظهار</th><th>وزن</th><th>تاریخ</th><th>وضعیت</th><th>عملیات</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="7">تخصیصی ثبت نشده است.</td></tr>`}</tbody>
        </table>
        <div class="small-note" style="margin-top:8px">تعداد سطر: ${fmt(allocations.length)}</div>
      </div>
    `;
  }

  // ---------------- Vessels ----------------
  function vesselsPage(rowsData, masterVessels) {
    const rows = rowsData.map((v,i) => `
      <tr>
        <td class="rownum">${toPersianDigits(i+1)}</td>
        <td>${esc(v.vessel_name)}</td>
        <td>${esc(v.entry_date || v.date || "")}</td>
        <td>${esc(v.exit_date || "—")}</td>
        <td>${esc(v.declarations || "—")}</td>
        <td>${fmt(v.computed_weight || 0)}</td>
        <td>${esc(v.status || "")}</td>
        <td>
          <button class="btn small outline" data-action="open-edit-operation" data-id="${esc(v.id)}">ویرایش</button>
          <button class="btn small danger" data-action="delete-operation" data-id="${esc(v.id)}">حذف</button>
        </td>
      </tr>
    `).join("");
    const masterRows = (masterVessels||[]).map((v,i) => `
      <tr>
        <td class="rownum">${toPersianDigits(i+1)}</td>
        <td>${esc(v.vessel_name)}</td>
        <td>${esc(v.notes||"—")}</td>
        <td>
          <button class="btn small outline" data-action="open-edit-vessel-master" data-id="${esc(v.id)}">ویرایش</button>
          <button class="btn small danger" data-action="delete-vessel-master" data-id="${esc(v.id)}">حذف</button>
        </td>
      </tr>`).join("");
    return `
      <h1 class="page-title">شناورها و عملیات</h1>
      <div class="page-sub">شناور یک Master Data مستقل است؛ عملیات شناور، ورود/خروج و وضعیت آن را ثبت می‌کند.</div>

      <div class="toolbar">
        <button class="btn gold" data-action="open-new-vessel-master">+ ثبت شناور جدید</button>
        <button class="btn outline" data-action="open-new-vessel">+ ثبت عملیات شناور</button>
      </div>

      <div class="panel">
        <h2>فهرست شناورها</h2>
        <table>
          <thead><tr><th class="rownum">ردیف</th><th>نام شناور</th><th>یادداشت</th><th>عملیات</th></tr></thead>
          <tbody>${masterRows || `<tr><td colspan="4">شناوری ثبت نشده است.</td></tr>`}</tbody>
        </table>
        <div class="small-note" style="margin-top:8px">تعداد سطر: ${fmt((masterVessels||[]).length)}</div>
      </div>

      <div class="panel">
        <h2>عملیات شناورها</h2>
        <table>
          <thead><tr><th class="rownum">ردیف</th><th>نام شناور</th><th>تاریخ ورود</th><th>تاریخ خروج</th><th>شماره اظهارها</th><th>وزن تخصیص‌یافته (تن)</th><th>وضعیت</th><th>عملیات</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="8">عملیاتی ثبت نشده است.</td></tr>`}</tbody>
        </table>
        <div class="small-note" style="margin-top:8px">تعداد سطر: ${fmt(rowsData.length)}</div>
      </div>
    `;
  }

  // ---------------- Inventory ----------------
  function inventoryPage(receipts) {
    const leaf = receipts.filter(r => r._status_calc !== "تقسیم شده");
    const rows = leaf.map((r,i) => `
      <tr>
        <td class="rownum">${toPersianDigits(i+1)}</td>
        <td>${demoBadge(r.receipt_no)}${esc(r.receipt_no)}</td>
        <td>${esc(r.type)}</td>
        <td>${esc(r.project)}</td>
        <td>${esc(r.warehouse||"—")}</td>
        <td>${fmt(r.initial_weight)}</td>
        <td>${fmt(r._inventory)}</td>
        <td>${statusPill(r._status_calc)}</td>
      </tr>
    `).join("");
    const total = leaf.reduce((s,r)=>s+r._inventory,0);
    return `
      <h1 class="page-title">موجودی زنده</h1>
      <div class="page-sub">فقط قبض‌های برگ (تقسیم نشده) موجودی قابل تخصیص دارند — جمع کل: <b>${fmt(total)}</b> تن</div>
      <div class="panel">
        <table>
          <thead><tr><th class="rownum">ردیف</th><th>شماره قبض</th><th>نوع</th><th>پروژه</th><th>انبار</th><th>وزن اولیه</th><th>موجودی</th><th>وضعیت</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="8">داده‌ای موجود نیست.</td></tr>`}</tbody>
        </table>
        <div class="small-note" style="margin-top:8px">تعداد سطر: ${fmt(leaf.length)}</div>
      </div>
    `;
  }

  // ---------------- Tree ----------------
  function treeRenderNode(node) {
    const cls = "node" + (!node.parent_id ? " root" : "") + (node.type === "اظهاری" ? " declaration-node" : "") + (node.type === "مانده" ? " remaining-node" : "");
    let html = `<li>
      <div class="${cls}">
        <span class="rn">${esc(node.receipt_no)}</span>
        <span>${esc(node.type)}</span>
        <span>وزن: ${fmt(node.initial_weight)}</span>
        <span>موجودی: ${fmt(node._inventory)}</span>
        ${statusPill(node._status_calc)}
        <a class="link" data-goto-receipt="${esc(node.receipt_no)}">مشاهده</a>
      </div>`;
    if (node.children && node.children.length) {
      html += `<ul>${node.children.map(treeRenderNode).join("")}</ul>`;
    }
    html += `</li>`;
    return html;
  }

  function treePage(roots, selectedTree) {
    const countNodes = (n) => 1 + ((n.children||[]).reduce((s,c)=>s+countNodes(c),0));
    const totalNodes = selectedTree ? countNodes(selectedTree) : 0;
    return `
      <div class="report-head">
        <div><h1 class="page-title">شجره گرافیکی قبض</h1>
        <div class="page-sub">ساختار واقعی والد ← اظهاری / مانده، با عمق چندمرحله‌ای</div></div>
        <div class="tree-meta"><span>${fmt(totalNodes)} رکورد در شجره</span><button class="btn gold small" onclick="exportReportAsPngZip()">📷 ذخیره گزارش</button></div>
      </div>
      <div class="toolbar">
        <label class="field-label">انتخاب قبض ریشه</label>
        <select id="treeRootSelect">
          ${roots.map(r => `<option value="${esc(r.receipt_no)}" ${selectedTree && selectedTree.receipt_no===r.receipt_no?"selected":""}>قبض ${esc(r.receipt_no)} — ${esc(r.project||"بدون پروژه")}</option>`).join("")}
        </select>
        ${selectedTree ? `<button class="btn outline" data-action="view-receipt" data-id="${esc(selectedTree.receipt_no)}">مشاهده جزئیات ریشه</button>` : ""}
      </div>
      <div class="panel tree">
        ${selectedTree ? `<div class="tree-legend">
          <span><i class="legend-root"></i>ریشه</span><span><i class="legend-decl"></i>اظهاری</span><span><i class="legend-rem"></i>مانده</span>
        </div><ul>${treeRenderNode(selectedTree)}</ul>` : `<div class="empty-state">قبض ریشه‌ای برای نمایش وجود ندارد.</div>`}
      </div>
    `;
  }

  // ---------------- PDF Page 1 — Management Dashboard (digital-share style) ----------------
  // Pure visual layer for sharing via Telegram/WhatsApp/Email — not a printable
  // table report. Cards + hand-built inline SVG charts, no external chart
  // library or icon font (fully offline). Numbers come straight from the
  // same real, live-computed data used elsewhere in the app.
  function svgDonut(segments, size, strokeW, centerLabel, centerSub) {
    size = size || 168; strokeW = strokeW || 22;
    const r = (size - strokeW) / 2, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * r;
    const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0) || 1;
    let offset = 0;
    const rings = segments.map(seg => {
      const frac = Math.max(0, seg.value) / total;
      const dash = frac * circ;
      const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="${strokeW}"
        stroke-dasharray="${dash} ${circ - dash}" stroke-dashoffset="${-offset}" stroke-linecap="butt" transform="rotate(-90 ${cx} ${cy})"/>`;
      offset += dash;
      return el;
    }).join("");
    const center = centerLabel ? `
      <text x="${cx}" y="${cy - (centerSub ? 4 : -6)}" text-anchor="middle" font-size="${size*0.135}" font-weight="800" fill="#101b2d">${esc(toPersianDigits(centerLabel))}</text>
      ${centerSub ? `<text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="${size*0.075}" fill="#6c7484">${esc(toPersianDigits(centerSub))}</text>` : ""}
    ` : "";
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#eef1f8" stroke-width="${strokeW}"/>
      ${rings}${center}
    </svg>`;
  }
  function svgHBars(items, width, barH) {
    width = width || 460; barH = barH || 26;
    const max = Math.max(1, ...items.map(i => i.value));
    const gap = 14, labelW = 118, chartW = width - labelW - 56;
    const h = items.length * (barH + gap) + gap;
    const bars = items.map((it, i) => {
      const y = gap + i * (barH + gap);
      const w = Math.max(4, (it.value / max) * chartW);
      return `
        <text x="${width - labelW}" y="${y + barH * 0.68}" text-anchor="start" font-size="12" fill="#3a4257" font-weight="600">${esc(it.label)}</text>
        <rect x="${width - labelW - chartW}" y="${y}" width="${chartW}" height="${barH}" rx="7" fill="#eef1f8"/>
        <rect x="${width - labelW - w}" y="${y}" width="${w}" height="${barH}" rx="7" fill="${it.color || '#1F3864'}"/>
        <text x="${width - labelW - chartW - 8}" y="${y + barH * 0.68}" text-anchor="end" font-size="12" fill="#101b2d" font-weight="700">${fmt(it.value)}</text>
      `;
    }).join("");
    return `<svg viewBox="0 0 ${width} ${h}" width="100%" height="${h}">${bars}</svg>`;
  }
  function pdfIcon(name) {
    const P = {
      inbound: '<path d="M12 3v12m0 0 5-5m-5 5-5-5M4 19h16"/>',
      outbound: '<path d="M12 21V9m0 0 5 5m-5-5-5 5M4 5h16"/>',
      stock: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/>',
      main: '<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>',
      decl: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 11h6M9 15h6"/>',
      rem: '<path d="M4 6h16M4 12h10M4 18h6"/>',
      vessel: '<path d="M3 18l2-8h14l2 8"/><path d="M12 10V4m0 0-3 3m3-3 3 3"/><path d="M2 21c2 1 4 1 6 0s4-1 6 0 4 1 6 0"/>',
      ops: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
      file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>'
    };
    return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${P[name] || P.file}</svg>`;
  }
  function pdfCard(icon, label, value, unit, accent) {
    return `<div class="pdfk-card" style="--pk-accent:${accent}">
      <div class="pdfk-icon">${pdfIcon(icon)}</div>
      <div class="pdfk-label">${esc(label)}</div>
      <div class="pdfk-value">${fmt(value)}${unit ? `<small> ${esc(unit)}</small>` : ""}</div>
    </div>`;
  }

  function pdfDashboardPage(d) {
    const flowTotal = Math.max(1, d.totalAllocated + d.totalInventory);
    const exportedPct = (d.totalAllocated / flowTotal * 100);
    const inventoryPct = (d.totalInventory / flowTotal * 100);
    const typeTotal = Math.max(1, d.mainCount + d.declCount + d.remCount);
    const mainPct = (d.mainCount / typeTotal * 100);
    const declPct = (d.declCount / typeTotal * 100);
    const remPct = (d.remCount / typeTotal * 100);

    const typeDonut = svgDonut([
      { value: d.mainCount, color: "#1F3864" },
      { value: d.declCount, color: "#27AE60" },
      { value: d.remCount, color: "#E0A340" }
    ]);
    const flowDonut = svgDonut([
      { value: d.totalAllocated, color: "#1F3864" },
      { value: d.totalInventory, color: "#c7cdd6" }
    ], 168, 22, toPersianDigits(exportedPct.toFixed(1)) + "%", "صادر شده");

    return `
      <div class="pdf-page pdf-page1">
        <div class="pdfk-grid">
          ${pdfCard("vessel", "بار ورودی", d.totalIncoming, "تن", "var(--rpt-blue)")}
          ${pdfCard("outbound", "بار صادر شده", d.totalAllocated, "تن", "var(--rpt-green)")}
          ${pdfCard("stock", "موجودی فعلی", d.totalInventory, "تن", "var(--rpt-orange)")}
          ${pdfCard("ops", "عملیات", d.opsCount, "عملیات", "#1F3864")}
          ${pdfCard("main", "قبض اصلی", d.mainCount, "قبض", "var(--rpt-blue)")}
          ${pdfCard("decl", "قبض اظهاری", d.declCount, "قبض", "var(--rpt-green)")}
          ${pdfCard("rem", "قبض مانده", d.remCount, "قبض", "var(--rpt-orange)")}
          ${pdfCard("vessel", "شناورها", d.vesselCount, "شناور", "#4C4FA1")}
        </div>

        <div class="pdf-chart-grid pdf-chart-grid-2">
          <div class="pdf-chart-card pdf-chart-card-lg">
            <div class="pdf-chart-title">بار صادر شده در برابر موجودی</div>
            <div class="pdf-chart-body">
              ${flowDonut}
              <div class="pdf-legend">
                <span><i style="background:#1F3864"></i>صادر شده: ${toPersianDigits(exportedPct.toFixed(1))}٪</span>
                <span><i style="background:#c7cdd6"></i>موجودی: ${toPersianDigits(inventoryPct.toFixed(1))}٪</span>
              </div>
            </div>
          </div>
          <div class="pdf-chart-card pdf-chart-card-lg">
            <div class="pdf-chart-title">توزیع انواع قبض</div>
            <div class="pdf-chart-body">
              ${typeDonut}
              <div class="pdf-legend">
                <span><i style="background:#1F3864"></i>اصلی: ${toPersianDigits(mainPct.toFixed(1))}٪</span>
                <span><i style="background:#27AE60"></i>اظهاری: ${toPersianDigits(declPct.toFixed(1))}٪</span>
                <span><i style="background:#E0A340"></i>مانده: ${toPersianDigits(remPct.toFixed(1))}٪</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function pdfVesselRanking(items) {
    if (!items.length) return `<div class="pdfk-empty">داده‌ای برای نمایش وجود ندارد.</div>`;
    const max = Math.max(1, ...items.map(i => i.value));
    const rows = items.map((it, i) => `
      <div class="pdfr-rank-row">
        <div class="pdfr-rank-no">${toPersianDigits(i + 1)}</div>
        <div class="pdfr-rank-main">
          <div class="pdfr-rank-top">
            <span class="pdfr-rank-label">${esc(it.label)}</span>
            <span class="pdfr-rank-value">${fmt(it.value)} <small>تن</small></span>
          </div>
          <div class="pdfr-rank-track"><div class="pdfr-rank-fill" style="width:${(it.value / max * 100).toFixed(1)}%"></div></div>
        </div>
      </div>
    `).join("");
    return `<div class="pdfr-rank-list">${rows}</div>`;
  }

  function pdfCompanyMark(size) {
    size = size || 46;
    return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-label="شرکت">
      <circle cx="50" cy="50" r="46" fill="#eef1f8" stroke="#c7cfe0" stroke-width="2"/>
      <text x="50" y="63" text-anchor="middle" font-family="Segoe UI,Tahoma,Arial,sans-serif" font-weight="800" font-size="34" fill="#3a4257">MD</text>
    </svg>`;
  }
  function pdfReportHeader(title) {
    const now = HGJalali.todayJalali();
    const time = new Date();
    const hh = toPersianDigits(String(time.getHours()).padStart(2, "0"));
    const mm = toPersianDigits(String(time.getMinutes()).padStart(2, "0"));
    return `
      <div class="pdfr-header">
        <div class="pdfr-side">
          <img class="pdfr-logo-img" src="./assets/logo-hg.png" alt="HG ERP">
          <div class="pdfr-side-text">
            <b>HG ERP</b>
            <small>سامانه مدیریت انبار و تشریفات گمرکی</small>
            <small class="pdfr-dev">Developed &amp; Designed by Hamed Gholami</small>
          </div>
        </div>
        <div class="pdfr-center">
          <div class="pdfr-title" dir="rtl" lang="fa">${esc(title)}</div>
          <div class="pdfr-sub">شرکت سیمان مند دشتی | منطقه ویژه اقتصادی پارسیان</div>
        </div>
        <div class="pdfr-side pdfr-side-right">
          <div class="pdfr-side-text pdfr-side-text-right">
            <b>شرکت سیمان مند دشتی</b>
            <small>Mand Dashti Cement Co.</small>
          </div>
          <img class="pdfr-logo-img" src="./assets/logo-company.png" alt="شرکت سیمان مند دشتی">
        </div>
      </div>
      <div class="pdfr-meta">
        <span>تاریخ و ساعت تولید گزارش: <b>${toPersianDigits(now.str)} — ${hh}:${mm}</b></span>
      </div>
    `;
  }
  function pdfReportFooter(pageNum, totalPages) {
    const now = toPersianDigits(HGJalali.todayString());
    return `<div class="pdfr-footer" dir="rtl">
      <span>HG ERP | Executive Report | Version 1.0</span>
      <span>صفحه ${toPersianDigits(pageNum)} از ${toPersianDigits(totalPages)}</span>
      <span>تاریخ تولید: ${now}</span>
    </div>`;
  }

  function pdfReport3Pages(p1, p2html, rootTrees) {
    const treeChunks = [];
    for (let i = 0; i < rootTrees.length; i += 2) treeChunks.push(rootTrees.slice(i, i + 2));
    if (!treeChunks.length) treeChunks.push([]);
    const totalPages = 2 + treeChunks.length;

    const treePages = treeChunks.map((pair, idx) => `
      <section class="pdfr-page" dir="rtl" lang="fa">
        ${pdfReportHeader("شجره قبض‌ها")}
        <div class="pdfr-body">${pdfGenealogyPage(pair)}</div>
        ${pdfReportFooter(2 + idx + 1, totalPages)}
      </section>
    `).join("");

    return `
      <div class="pdfr-toolbar no-print">
        <button class="btn gold" onclick="exportReportAsPngZip()">📷 ذخیره گزارش</button>
        <button class="btn gold" onclick="exportReportAsImages()">🖼️ خروجی تصاویر گزارش</button>
        <button class="btn gold" onclick="exportReportAsPdf()">🧾 خروجی PDF گزارش</button>
        <span class="small-note">این دکمه‌ها از هر صفحه .pdfr-page خروجی می‌گیرند و همه صفحات در یک فایل ZIP یا PDF قرار می‌گیرند.</span>
      </div>

      <section class="pdfr-page" dir="rtl" lang="fa">
        ${pdfReportHeader("گزارش مدیریتی")}
        <div class="pdfr-body">${pdfDashboardPage(p1)}</div>
        ${pdfReportFooter(1, totalPages)}
      </section>

      <section class="pdfr-page" dir="rtl" lang="fa">
        ${pdfReportHeader("گزارش عملیات")}
        <div class="pdfr-body">${p2html}</div>
        ${pdfReportFooter(2, totalPages)}
      </section>

      ${treePages}
    `;
  }

  function pdfOperationsReportPage(rows, vesselBars) {
    const trs = rows.map((r, i) => `
      <tr>
        <td class="rownum">${toPersianDigits(i+1)}</td>
        <td><b>${esc(r.vessel_name || "—")}</b></td>
        <td>${esc(r.entry_date || "—")}</td>
        <td>${esc(r.exit_date || "—")}</td>
        <td>${esc(r.declarations_text || "—")}</td>
        <td>${esc(r.allocated_receipts_text || "—")}</td>
        <td class="num">${fmt(r.computed_weight || 0)}</td>
        <td>${statusPill(r.status || "—")}</td>
      </tr>
    `).join("");
    const total = rows.reduce((s, r) => s + Number(r.computed_weight || 0), 0);
    return `
      <div class="pdfr-page-title" dir="rtl" lang="fa">گزارش کامل عملیات شناورها</div>
      <table class="pdfr-table pdfr-table-centered">
        <thead><tr>
          <th class="rownum">ردیف</th><th>نام شناور</th><th>تاریخ ورود</th><th>تاریخ خروج</th>
          <th>شماره اظهار</th><th>قبض‌های تخصیص‌یافته</th><th>وزن بارگیری (تن)</th><th>وضعیت</th>
        </tr></thead>
        <tbody>
          ${trs || `<tr><td colspan="8">عملیاتی ثبت نشده است.</td></tr>`}
          ${rows.length ? `<tr class="pdfr-totals"><td colspan="6">جمع کل وزن بارگیری</td><td class="num">${fmt(total)}</td><td></td></tr>` : ""}
        </tbody>
      </table>
      ${vesselBars && vesselBars.length ? `
      <div class="pdfr-vessel-panel">
        <div class="pdf-chart-title">وزن به تفکیک شناور</div>
        ${pdfVesselRanking(vesselBars)}
      </div>` : ""}
    `;
  }

  function pdfGenealogyTreeNode(node) {
    const cls = "pdfr-tnode" + (node.type === "اظهاری" ? " decl" : "") + (node.type === "مانده" ? " rem" : "");
    let html = `<li><div class="${cls}">
      <div class="pdfr-tnode-no">${esc(node.receipt_no)}</div>
      <div class="pdfr-tnode-type">قبض ${esc(node.type)}</div>
      <div class="pdfr-tnode-meta">${fmt(node.initial_weight)} تن</div>
      ${statusPill(node._status_calc)}
    </div>`;
    if (node.children && node.children.length) html += `<ul>${node.children.map(pdfGenealogyTreeNode).join("")}</ul>`;
    html += `</li>`;
    return html;
  }
  function pdfGenealogyPage(rootPair) {
    const left = rootPair[0];
    const right = rootPair[1];
    const halfHtml = (root) => root
      ? `<ul class="pdfr-orgchart">${pdfGenealogyTreeNode(root)}</ul>`
      : `<div class="pdfk-empty"></div>`;
    return `
      <div class="pdfr-page-title" dir="rtl" lang="fa">شجره گرافیکی گردش قبض‌ها</div>
      <div class="pdfr-tree-legend">
        <span><i style="background:var(--rpt-blue)"></i>قبض اصلی</span>
        <span><i style="background:var(--rpt-green)"></i>قبض اظهاری</span>
        <span><i style="background:var(--rpt-orange)"></i>قبض مانده</span>
      </div>
      <div class="pdfr-tree-split">
        <div class="pdfr-tree-half">${halfHtml(left)}</div>
        <div class="pdfr-tree-divider"></div>
        <div class="pdfr-tree-half">${halfHtml(right)}</div>
      </div>
    `;
  }

  // ---------------- Reports ----------------
  function reportsPage(data) {
    const projectRows = Object.entries(data.byProject).map(([p,v],i) =>
      `<tr><td class="rownum">${toPersianDigits(i+1)}</td><td><b>${esc(p || "بدون پروژه")}</b></td><td class="num">${fmt(v)}</td></tr>`).join("");
    const opRows = (data.vesselOperationsReport||[]).map((v,i) => `
      <tr>
        <td class="rownum">${toPersianDigits(i+1)}</td>
        <td><b>${esc(v.vessel_name||"—")}</b></td>
        <td>${esc(v.entry_date||"—")}</td><td>${esc(v.exit_date||"—")}</td>
        <td>${esc(v.allocated_receipts_text||"—")}</td><td>${esc(v.declarations_text||"—")}</td><td class="num">${fmt(v.computed_weight||0)}</td>
        <td>${statusPill(v.status||"—")}</td>
      </tr>`).join("");

    return `
      <div class="report-head">
        <div><h1 class="page-title">مرکز گزارش‌ها</h1>
        <div class="page-sub">گزارش‌های عملیاتی مبتنی بر داده واقعی پایگاه داده محلی</div></div>
        <div class="report-head-actions">
          <a class="btn gold" href="#/pdf-report">تولید گزارش مدیریتی</a>
        </div>
      </div>

      <div class="kpi-grid report-kpis">
        <div class="kpi-card"><div class="kpi-label">کل وزن ورودی</div><div class="kpi-value">${fmt(data.totalIncoming)} <small>تن</small></div></div>
        <div class="kpi-card turq"><div class="kpi-label">کل تخصیص معتبر</div><div class="kpi-value">${fmt(data.totalAllocated)} <small>تن</small></div></div>
        <div class="kpi-card danger"><div class="kpi-label">موجودی فعلی</div><div class="kpi-value">${fmt(data.totalInventory)} <small>تن</small></div></div>
        <div class="kpi-card"><div class="kpi-label">قبض / اظهار</div><div class="kpi-value">${fmt(data.receiptCount)} / ${fmt(data.declarationCount)}</div></div>
      </div>

      <div class="report-grid">
        <section class="panel">
          <div class="section-head"><h2>موجودی به تفکیک پروژه</h2><span class="section-tag">Live</span></div>
          <table><thead><tr><th class="rownum">ردیف</th><th>پروژه</th><th>موجودی (تن)</th></tr></thead>
          <tbody>${projectRows || '<tr><td colspan="3">داده‌ای موجود نیست.</td></tr>'}</tbody></table>
        </section>

        <section class="panel">
          <div class="section-head"><h2>وضعیت ریشه‌های قبض</h2><span class="section-tag">Tree</span></div>
          <table><thead><tr><th class="rownum">ردیف</th><th>ریشه</th><th>وزن</th><th>فرزند مستقیم</th><th>موجودی زیرشاخه</th></tr></thead>
          <tbody>${data.rootsReport.map((r,i)=>`
            <tr><td class="rownum">${toPersianDigits(i+1)}</td><td><a class="link" data-goto-tree="${esc(r.root)}">${esc(r.root)}</a></td>
            <td>${fmt(r.weight)}</td><td>${fmt(r.directChildren)}</td><td>${fmt(r.remaining)}</td></tr>`).join("") || '<tr><td colspan="5">—</td></tr>'}</tbody></table>
        </section>
      </div>

      <section class="panel">
        <div class="section-head"><h2>گزارش عملیات شناورها</h2><span class="section-tag">A4 Ready</span></div>
        <div class="small-note report-note">وزن این جدول از داده‌های معتبر اظهار/تخصیص محاسبه می‌شود و عدد دستی نیست.</div>
        <div class="table-scroll"><table>
          <thead><tr><th class="rownum">ردیف</th><th>شناور</th><th>ورود</th><th>خروج</th><th>قبض‌های تخصیص‌یافته</th><th>شماره اظهار</th><th>وزن بارگیری (تن)</th><th>وضعیت</th></tr></thead>
          <tbody>${opRows || '<tr><td colspan="8">عملیاتی ثبت نشده است.</td></tr>'}</tbody>
        </table></div>
      </section>

      <section class="panel">
        <div class="section-head"><h2>رویدادهای اخیر</h2><span class="section-tag">Recent</span></div>
        <table><thead><tr><th class="rownum">ردیف</th><th>تاریخ</th><th>نوع</th><th>شرح</th></tr></thead>
        <tbody>${data.operations.map((o,i)=>`
          <tr><td class="rownum">${toPersianDigits(i+1)}</td><td>${esc((o.date||"").slice(0,10))}</td><td>${esc(o.type||"—")}</td><td>${esc(o.description||"—")}</td></tr>`).join("") || '<tr><td colspan="4">—</td></tr>'}</tbody></table>
      </section>
    `;
  }

  // ---------------- Backup ----------------
  function backupPage(fs) {
    fs = fs || {};
    const connBox = !fs.supported
      ? `<p class="small-note">مرورگر فعلی از ذخیره‌سازی خودکار در فایل واقعی پشتیبانی نمی‌کند (به Chrome یا Edge نیاز است). از بخش پایین برای پشتیبان‌گیری دستی استفاده کنید.</p>`
      : fs.connected
        ? `<p class="small-note">✓ متصل به فایل: <b>${esc(fs.fileName || "")}</b> — هر تغییری خودکار و بی‌درنگ در همین فایل ذخیره می‌شود.</p>
           <div class="toolbar">
             <button class="btn outline" data-action="fs-connect-existing">اتصال به فایل دیگر</button>
             <button class="btn danger" data-action="fs-disconnect">قطع اتصال</button>
           </div>`
        : `<p class="small-note">هنوز به هیچ فایلی متصل نیستید — یعنی با پاک شدن کش مرورگر، تمام اطلاعات از بین می‌رود. برای جلوگیری از این اتفاق و امکان انتقال پروژه به سیستم دیگر، یک بار فایل داده را متصل کنید.</p>
           <div class="toolbar">
             <button class="btn gold" data-action="fs-connect-new">ایجاد فایل داده جدید</button>
             <button class="btn outline" data-action="fs-connect-existing">اتصال به فایل داده موجود</button>
           </div>`;
    return `
      <h1 class="page-title">پشتیبان‌گیری و بازیابی</h1>
      <div class="page-sub">داده‌ها به‌صورت محلی در مرورگر (IndexedDB) نگهداری می‌شوند. برای انتقال یا نسخه پشتیبان از فایل JSON استفاده کنید.</div>

      <div class="panel">
        <h2>ذخیره‌سازی خودکار و پرتابل (توصیه‌شده)</h2>
        ${connBox}
      </div>

      <div class="panel">
        <h2>خروجی گرفتن از پایگاه داده</h2>
        <p class="small-note">یک فایل JSON شامل تمام قبض‌ها، اظهارها، تخصیص‌ها، شناورها و تنظیمات دانلود می‌شود.</p>
        <button class="btn gold" data-action="export-db">دانلود فایل پشتیبان (Export)</button>
      </div>

      <div class="panel">
        <h2>بازیابی از فایل پشتیبان</h2>
        <p class="small-note">توجه: این عملیات تمام داده‌های فعلی را با محتوای فایل جایگزین می‌کند.</p>
        <input type="file" id="importFile" accept="application/json">
        <button class="btn outline" data-action="import-db">بازیابی (Import)</button>
      </div>

      <div class="panel">
        <h2>پاک‌سازی کامل</h2>
        <p class="small-note">تمام داده‌های فعلی حذف و داده‌های واقعی فایل Excel مبنا دوباره بارگذاری می‌شود.</p>
        <button class="btn danger" data-action="reset-demo">بازنشانی داده‌های Excel</button>
      </div>
    `;
  }

  // ---------------- Settings ----------------
  function settingsPage(tolerance) {
    return `
      <h1 class="page-title">تنظیمات</h1>
      <div class="panel">
        <h2>حد مجاز اختلاف تقسیم قبض (تن)</h2>
        <p class="small-note">حداکثر اختلاف مجاز بین مجموع وزن فرزندان و وزن قبض والد در عملیات تقسیم.</p>
        <div class="form-grid" style="max-width:300px;">
          <div><label>مقدار مجاز</label><input type="number" step="0.001" id="toleranceInput" value="${fmt(tolerance)}"></div>
        </div>
        <div class="modal-actions"><button class="btn gold" data-action="save-tolerance">ذخیره تنظیمات</button></div>
      </div>
    `;
  }

  function newVesselMasterModal() {
    return `
      <div class="modal-overlay"><div class="modal-box">
        <h2>ثبت شناور جدید</h2><div id="newVesselMasterErrors"></div>
        <div class="form-grid">
          <div><label>نام شناور</label><input id="vmName" type="text" placeholder="مثلاً M/V MEHDI12"></div>
          <div class="field-full"><label>یادداشت</label><textarea id="vmNotes" rows="2"></textarea></div>
        </div>
        <div class="modal-actions">
          <button class="btn gold" data-action="save-new-vessel-master">ثبت شناور</button>
          <button class="btn outline" data-action="close-modal">انصراف</button>
        </div>
      </div></div>`;
  }

  function editVesselMasterModal(vessel) {
    return `
      <div class="modal-overlay"><div class="modal-box">
        <h2>ویرایش شناور</h2><div id="editVesselMasterErrors"></div>
        <div class="form-grid">
          <div><label>نام شناور</label><input id="evmName" type="text" value="${esc(vessel.vessel_name||"")}"></div>
          <div class="field-full"><label>یادداشت</label><textarea id="evmNotes" rows="2">${esc(vessel.notes||"")}</textarea></div>
        </div>
        <div class="small-note">اگر شناور قبلاً در عملیات یا اظهار استفاده شده باشد، تغییر نام آن برای حفظ ارتباطات مجاز نیست؛ در آن حالت فقط یادداشت قابل ویرایش است.</div>
        <div class="modal-actions">
          <button class="btn gold" data-action="save-edit-vessel-master" data-id="${esc(vessel.id)}">ذخیره</button>
          <button class="btn outline" data-action="close-modal">انصراف</button>
        </div>
      </div></div>`;
  }

  function newVesselModal(vessels) {
      return `
        <div class="modal-overlay" id="newVesselOverlay"><div class="modal-box">
          <h2>ثبت عملیات شناور</h2><div id="newVesselErrors"></div>
          <div class="form-grid">
            <div><label>شناور</label><select id="nvName"><option value="">— انتخاب شناور —</option>
              ${(vessels||[]).map(v=>`<option value="${esc(v.vessel_name)}">${esc(v.vessel_name)}</option>`).join("")}
            </select></div>
            <div><label>تاریخ ورود</label><input type="text" id="nvEntryDate" class="jalali-input" value="${HGJalali.todayString()}"></div>
            <div><label>تاریخ خروج</label><input type="text" id="nvExitDate" class="jalali-input"></div>
            <div><label>وضعیت</label><select id="nvStatus">
              ${HGLogic.OPERATION_STATUSES.map(x=>`<option>${x}</option>`).join("")}
            </select></div>
          </div>
          <div class="modal-actions"><button class="btn gold" data-action="save-new-vessel">ذخیره عملیات</button>
            <button class="btn outline" data-action="close-modal">انصراف</button></div>
        </div></div>`;
    }



  window.toPersianDigits = function(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
  };
  return {
    esc, fmt, dashboard, receiptsPage, receiptDetail,
    splitModal, splitRowHtml, allocateModal, newAllocationModal, newReceiptModal, editReceiptModal,
    declarationsPage, newDeclarationModal, declarationDetail,
    allocationsPage, vesselsPage, newVesselModal, newVesselMasterModal, editVesselMasterModal,
    inventoryPage, treePage, reportsPage, pdfDashboardPage,
    pdfReport3Pages, pdfOperationsReportPage, pdfGenealogyPage,
    backupPage, settingsPage,
    toPersianDigits,
    statusPill
  };
})();


/* ---------------- application ---------------- */
/*
  app.js
  ------------------------------------------------------------
  Router + event wiring + data orchestration.
  Talks to HGDB (storage) and HGLogic (business rules) and calls
  HGRender (pure HTML templates) to paint the screen.
  ------------------------------------------------------------
*/

(function () {
  const contentEl = document.getElementById("content");
  const modalRoot = document.getElementById("modalRoot");
  const toastRoot = document.getElementById("toastRoot");
  const dbStatusEl = document.getElementById("dbStatus");
  const filestoreStatusEl = document.getElementById("filestoreStatus");

  function renderFileStatus(status, detail) {
    if (!filestoreStatusEl) return;
    const map = {
      unsupported: { text: "ذخیره‌سازی فایل واقعی: پشتیبانی نمی‌شود", cls: "fs-warn" },
      disconnected: { text: "⚠ داده فقط در مرورگر ذخیره می‌شود — اتصال به فایل توصیه می‌شود", cls: "fs-warn", clickable: true },
      "needs-permission": { text: "⚠ نیاز به تأیید مجدد دسترسی به فایل داده", cls: "fs-warn", clickable: true },
      connected: { text: `✓ متصل به فایل: ${detail || ""}`, cls: "fs-ok" },
      saving: { text: "در حال ذخیره در فایل...", cls: "fs-saving" },
      saved: { text: `✓ ذخیره شد در: ${detail || ""}`, cls: "fs-ok" },
      "save-error": { text: `خطا در ذخیره فایل: ${detail || ""}`, cls: "fs-err" }
    };
    const m = map[status] || { text: "", cls: "" };
    filestoreStatusEl.textContent = m.text;
    filestoreStatusEl.className = "filestore-status " + m.cls;
    filestoreStatusEl.style.cursor = m.clickable ? "pointer" : "default";
    filestoreStatusEl.onclick = m.clickable ? handleFileStatusClick : null;
  }

  async function handleFileStatusClick() {
    if (!HGFileStore.supported()) return;
    if (HGFileStore.isConnected()) {
      const ok = await HGFileStore.requestPermissionNow();
      if (ok) toast("اتصال به فایل داده برقرار شد.", "ok");
      return;
    }
    openFileConnectModal();
  }

  function openFileConnectModal() {
    openModal(`
      <div class="modal-overlay"><div class="modal-box">
        <h2>ذخیره‌سازی دائمی و پرتابل</h2>
        <p class="small-note">
          برای اینکه اطلاعات با پاک شدن کش مرورگر از بین نرود و پروژه روی سیستم دیگر هم قابل انتقال باشد،
          داده‌ها را به یک فایل واقعی روی هارد متصل کنید. بعد از اتصال، هر تغییری خودکار و بی‌درنگ در همان فایل ذخیره می‌شود.
        </p>
        <div class="modal-actions" style="flex-direction:column;align-items:stretch;gap:10px;">
          <button class="btn gold" data-action="fs-connect-new">ایجاد فایل داده جدید (اولین بار)</button>
          <button class="btn outline" data-action="fs-connect-existing">اتصال به فایل داده موجود (سیستم دیگر / اتصال مجدد)</button>
          <button class="btn outline" data-action="close-modal">بعداً</button>
        </div>
      </div></div>
    `);
  }

  async function fsConnectNew() {
    try {
      await HGFileStore.connectNew("hg-erp-data.json");
      const snapshot = await HGDB.exportAll();
      await HGFileStore.writeAllNow(snapshot);
      closeModal();
      toast("فایل داده ایجاد شد. از این پس همه چیز خودکار در همین فایل ذخیره می‌شود.", "ok");
      router();
    } catch (e) {
      toast("اتصال لغو شد یا با خطا مواجه شد: " + e.message, "err");
    }
  }

  async function fsConnectExisting() {
    try {
      await HGFileStore.connectExisting();
      const fileData = await HGFileStore.readAll();
      if (fileData && Object.keys(fileData).length) {
        await HGDB.importAll(fileData);
        toast("داده از فایل بارگذاری شد.", "ok");
      } else {
        const snapshot = await HGDB.exportAll();
        await HGFileStore.writeAllNow(snapshot);
        toast("فایل داده متصل شد.", "ok");
      }
      closeModal();
      router();
    } catch (e) {
      toast("اتصال لغو شد یا با خطا مواجه شد: " + e.message, "err");
    }
  }


  let receiptFilter = { search: "", status: "", project: "" };
  let splitRowCount = 0;
  let currentTolerance = 0.01;

  // ---------------- Toast ----------------
  function toast(msg, type) {
    const el = document.createElement("div");
    el.className = "toast" + (type ? " " + type : "");
    el.textContent = msg;
    toastRoot.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  // ---------------- Modal Manager ----------------
  // ONE shared entry point used by every modal in the app (split, allocate,
  // new/edit receipt, declaration, vessel, operation, delete confirmations).
  // No per-button patches: overlay/centering/scroll come from CSS
  // (.modal-overlay/.modal-box); this manager only owns behavior that must
  // be consistent everywhere -- ESC to close, click-outside to close, body
  // scroll lock, and focusing the first field -- and guarantees exactly one
  // set of listeners exists at a time (attached on open, removed on close).
  let modalEscHandler = null;
  let modalOverlayClickHandler = null;

  function openModal(html) {
    modalRoot.innerHTML = html;
    document.body.classList.add("modal-open");

    modalEscHandler = (e) => { if (e.key === "Escape") closeModal(); };
    document.addEventListener("keydown", modalEscHandler);

    const overlay = modalRoot.querySelector(".modal-overlay");
    if (overlay) {
      modalOverlayClickHandler = (e) => { if (e.target === overlay) closeModal(); };
      overlay.addEventListener("mousedown", modalOverlayClickHandler);
    }

    const firstField = modalRoot.querySelector("input:not([type=hidden]):not([readonly]), select, textarea");
    if (firstField) setTimeout(() => firstField.focus(), 0);
  }

  function closeModal() {
    if (modalEscHandler) { document.removeEventListener("keydown", modalEscHandler); modalEscHandler = null; }
    const overlay = modalRoot.querySelector(".modal-overlay");
    if (overlay && modalOverlayClickHandler) overlay.removeEventListener("mousedown", modalOverlayClickHandler);
    modalOverlayClickHandler = null;
    modalRoot.innerHTML = "";
    document.body.classList.remove("modal-open");
  }

  // ---------------- Data loading helpers ----------------
  async function loadEnrichedReceipts() {
    const [receipts, allocations] = await Promise.all([
      HGDB.getAll("receipts"), HGDB.getAll("allocations")
    ]);
    window.toPersianDigits = function(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
  };
  return { receipts: await HGLogic.enrichReceipts(receipts, allocations), allocations };
  }

  async function loadTolerance() {
    const s = await HGDB.get("settings", "split_tolerance");
    currentTolerance = s ? Number(s.value) : 0.01;
    return currentTolerance;
  }

  // ---------------- Router ----------------
  const routes = {
    "dashboard": renderDashboard,
    "receipts": renderReceipts,
    "declarations": renderDeclarations,
    "allocations": renderAllocations,
    "vessels": renderVessels,
    "inventory": renderInventory,
    "tree": renderTree,
    "reports": renderReports,
    "pdf-dashboard": renderPdfDashboard,
    "pdf-report": renderPdfReport,
    "backup": renderBackup,
    "settings": renderSettings
  };

  function parseHash() {
    const raw = (location.hash || "#/dashboard").slice(2); // strip "#/"
    const parts = raw.split("/").filter(Boolean);
    window.toPersianDigits = function(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
  };
  return { page: parts[0] || "dashboard", param: parts[1] ? decodeURIComponent(parts[1]) : null };
  }

  async function router() {
    const { page, param } = parseHash();
    document.querySelectorAll(".sidenav a").forEach(a => {
      a.classList.toggle("active", a.dataset.nav === page);
    });

    if (page === "receipts" && param) {
      return renderReceiptDetail(param);
    }
    if (page === "declarations" && param) {
      return renderDeclarationDetail(param);
    }
    if (page === "tree" && param) {
      return renderTree(param);
    }

    const fn = routes[page] || renderDashboard;
    await fn();
  }

  window.addEventListener("hashchange", router);

  // ---------------- Page renderers ----------------
  async function renderDashboard() {
    const { receipts, allocations } = await loadEnrichedReceipts();
    const declarations = await HGDB.getAll("declarations");
    const vessels = await HGDB.getAll("vessels");
    const operations = await HGDB.getAll("operations");

    const roots = HGLogic.findRoots(receipts);
    const totalIncoming = roots.reduce((s, r) => s + Number(r.initial_weight || 0), 0);
    const totalInventory = receipts.reduce((s, r) => s + r._inventory, 0);
    const totalAllocated = allocations
      .filter(a => a.status !== "ابطال شده" && a.effective_status !== "ابطال شده")
      .reduce((s, a) => s + Number(a.weight || 0), 0);
    const activeReceipts = receipts.filter(r => r._status_calc === "فعال").length;
    const closedReceipts = receipts.filter(r => r._status_calc === "بسته").length;

    const lastOps = operations
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8);

    contentEl.innerHTML = HGRender.dashboard({
      totalInventory, totalIncoming, totalAllocated,
      activeReceipts, closedReceipts,
      declarationCount: declarations.length,
      vesselCount: vessels.length,
      lastOps
    });
  }

  async function renderReceipts() {
    const { receipts } = await loadEnrichedReceipts();
    const projects = await HGDB.getAll("projects");

    let filtered = receipts;
    if (receiptFilter.search) {
      const q = receiptFilter.search.trim().toLowerCase();
      filtered = filtered.filter(r => r.receipt_no.toLowerCase().includes(q));
    }
    if (receiptFilter.status) {
      filtered = filtered.filter(r => r._status_calc === receiptFilter.status);
    }
    if (receiptFilter.project) {
      filtered = filtered.filter(r => r.project === receiptFilter.project);
    }
    filtered.sort((a, b) => a.receipt_no.localeCompare(b.receipt_no));

    contentEl.innerHTML = HGRender.receiptsPage(filtered, projects, receiptFilter);

    document.getElementById("fltSearch").addEventListener("input", (e) => {
      receiptFilter.search = e.target.value; renderReceipts();
    });
    document.getElementById("fltStatus").addEventListener("change", (e) => {
      receiptFilter.status = e.target.value; renderReceipts();
    });
    document.getElementById("fltProject").addEventListener("change", (e) => {
      receiptFilter.project = e.target.value; renderReceipts();
    });
  }

  async function renderReceiptDetail(receiptNo) {
    const { receipts, allocations } = await loadEnrichedReceipts();
    const receipt = receipts.find(r => r.receipt_no === receiptNo);
    if (!receipt) { contentEl.innerHTML = `<div class="panel">قبض یافت نشد.</div>`; return; }
    const children = receipts.filter(r => r.parent_id === receiptNo);
    const allocs = allocations.filter(a => a.receipt_no === receiptNo);
    contentEl.innerHTML = HGRender.receiptDetail(receipt, children, allocs);
  }

  async function renderDeclarations() {
    const declarations = await HGDB.getAll("declarations");
    const allocations = await HGDB.getAll("allocations");
    const totalsByDecl = {};
    allocations.filter(a => a.status !== "ابطال شده" && a.effective_status !== "ابطال شده").forEach(a => {
      totalsByDecl[a.declaration_no] = (totalsByDecl[a.declaration_no] || 0) + Number(a.weight || 0);
    });
    declarations.sort((a, b) => a.declaration_no.localeCompare(b.declaration_no));
    contentEl.innerHTML = HGRender.declarationsPage(declarations, totalsByDecl);
  }

  async function renderDeclarationDetail(declNo) {
    const decl = await HGDB.get("declarations", declNo);
    if (!decl) { contentEl.innerHTML = `<div class="panel">اظهار یافت نشد.</div>`; return; }
    const allocs = await HGDB.byIndex("allocations", "declaration_no", declNo);
    contentEl.innerHTML = HGRender.declarationDetail(decl, allocs);
  }

  async function renderAllocations() {
    const allocations = await HGDB.getAll("allocations");
    allocations.sort((a, b) => new Date(b.date) - new Date(a.date));
    contentEl.innerHTML = HGRender.allocationsPage(allocations);
  }

  async function renderVessels() {
    const declarations = await HGDB.getAll("declarations");
    const allocations = await HGDB.getAll("allocations");
    const operations = await HGDB.getAll("operations");
    const masterVessels = await HGDB.getAll("vessels");
    const rows = operations
      .filter(o => o.type === "بارگیری صادرات" || o.type === "عملیات شناور")
      .map(o => {
        const ds = declarations.filter(d => d.operation_id === o.id);
        const weight = ds.reduce((sum, d) =>
          sum + allocations
            .filter(a => a.declaration_no === d.declaration_no && a.status !== "ابطال شده" && a.effective_status !== "ابطال شده")
            .reduce((s, a) => s + Number(a.weight || 0), 0), 0);
        window.toPersianDigits = function(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
  };
  return {
          ...o,
          entry_date: o.entry_date || o.date || "",
          exit_date: o.exit_date || "",
          declarations: ds.map(d => d.koutaj_no || d.declaration_no).join("، "),
          computed_weight: HGLogic.round3(weight)
        };
      });
    contentEl.innerHTML = HGRender.vesselsPage(rows, masterVessels);
  }


  async function renderInventory() {
    const { receipts } = await loadEnrichedReceipts();
    receipts.sort((a, b) => a.receipt_no.localeCompare(b.receipt_no));
    contentEl.innerHTML = HGRender.inventoryPage(receipts);
  }

  async function renderTree(preselectRoot) {
    const { receipts } = await loadEnrichedReceipts();
    const roots = HGLogic.findRoots(receipts)
      .map(r => ({ ...r, _treeInventory: HGLogic.buildTree(receipts, r.receipt_no) }))
      .sort((a, b) => {
        function sumInv(node) { return (node._inventory || 0) + (node.children || []).reduce((s, c) => s + sumInv(c), 0); }
        return sumInv(b._treeInventory) - sumInv(a._treeInventory) || a.receipt_no.localeCompare(b.receipt_no);
      });
    const rootNo = preselectRoot || (roots[0] && roots[0].receipt_no);
    const tree = rootNo ? HGLogic.buildTree(receipts, rootNo) : null;
    contentEl.innerHTML = HGRender.treePage(roots, tree);

    const sel = document.getElementById("treeRootSelect");
    if (sel) sel.addEventListener("change", (e) => {
      location.hash = "#/tree/" + encodeURIComponent(e.target.value);
    });
  }

    async function renderReports() {
    const { receipts, allocations } = await loadEnrichedReceipts();
    const declarations = await HGDB.getAll("declarations");
    const vessels = await HGDB.getAll("vessels");
    const operations = (await HGDB.getAll("operations"))
      .slice().sort((x, y) => String(y.date || "").localeCompare(String(x.date || "")));

    const roots = HGLogic.findRoots(receipts);
    const totalIncoming = roots.reduce((sum, r) => sum + Number(r.initial_weight || 0), 0);
    const effective = allocations.filter(a => a.status !== "ابطال شده" && a.effective_status !== "ابطال شده");
    const totalAllocated = effective.reduce((sum, a) => sum + Number(a.weight || 0), 0);
    const totalInventory = receipts.reduce((sum, r) => sum + r._inventory, 0);

    const byProject = {};
    receipts.forEach(r => { byProject[r.project] = (byProject[r.project] || 0) + r._inventory; });

    const rootsReport = roots.map(root => {
      const directChildren = receipts.filter(c => c.parent_id === root.receipt_no).length;
      const subtree = receipts.filter(c => c.root_id === root.receipt_no);
      const remaining = subtree.reduce((sum, c) => sum + c._inventory, 0);
      window.toPersianDigits = function(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
  };
  return { root: root.receipt_no, weight: root.initial_weight, directChildren, remaining };
    });

    const vesselReport = vessels.map(v => {
      const opsForVessel = operations.filter(o => o.vessel_name === v.vessel_name);
      const opIds = new Set(opsForVessel.map(o => o.id));
      const ds = declarations.filter(d => opIds.has(d.operation_id) || d.vessel_name === v.vessel_name);
      const weight = ds.reduce((sum, d) => sum + effective.filter(a => a.declaration_no === d.declaration_no)
        .reduce((s2, a) => s2 + Number(a.weight || 0), 0), 0);
      window.toPersianDigits = function(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
  };
  return { ...v, operation_count: opsForVessel.length, allocated_weight: HGLogic.round3(weight) };
    });
    const vesselOperationsReport = operations
      .filter(o => o.type === "بارگیری صادرات" || o.type === "عملیات شناور")
      .map(o => {
        const ds = declarations.filter(d => d.operation_id === o.id);
        const declNos = ds.map(d => d.koutaj_no || d.declaration_no);
        const relatedAllocations = ds.flatMap(d =>
          effective.filter(a => a.declaration_no === d.declaration_no));
        const weight = relatedAllocations.reduce((s2, a) => s2 + Number(a.weight || 0), 0);
        // Real relationship chain: Operation -> Declaration -> Allocation -> Receipt.
        // Distinct receipt numbers only (a receipt may appear in more than one allocation).
        const receiptNos = Array.from(new Set(relatedAllocations.map(a => a.receipt_no))).sort();
        window.toPersianDigits = function(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
  };
  return {
          ...o,
          entry_date: o.entry_date || o.date || "",
          exit_date: o.exit_date || "",
          declarations_text: declNos.join("، "),
          allocated_receipts_text: receiptNos.join("، "),
          computed_weight: HGLogic.round3(weight)
        };
      });

    contentEl.innerHTML = HGRender.reportsPage({
      totalIncoming, totalAllocated, totalInventory,
      receiptCount: receipts.length, declarationCount: declarations.length,
      byProject, operations: operations.slice(0, 15), rootsReport,
      vessels: vesselReport, vesselOperationsReport
    });
  }

  async function renderBackup() {
    contentEl.innerHTML = HGRender.backupPage({
      supported: HGFileStore.supported(),
      connected: HGFileStore.isConnected(),
      fileName: HGFileStore.connectedName()
    });
  }

  async function renderPdfDashboard() {
    const { receipts, allocations } = await loadEnrichedReceipts();
    const declarations = await HGDB.getAll("declarations");
    const vessels = await HGDB.getAll("vessels");
    const operations = await HGDB.getAll("operations");

    const roots = HGLogic.findRoots(receipts);
    const totalIncoming = roots.reduce((s, r) => s + Number(r.initial_weight || 0), 0);
    const effective = allocations.filter(a => a.status !== "ابطال شده" && a.effective_status !== "ابطال شده");
    const totalAllocated = effective.reduce((s, a) => s + Number(a.weight || 0), 0);
    const totalInventory = receipts.reduce((s, r) => s + r._inventory, 0);

    const mainCount = receipts.filter(r => r.type === "اصلی").length;
    const declCount = receipts.filter(r => r.type === "اظهاری").length;
    const remCount = receipts.filter(r => r.type === "مانده").length;

    const realOps = operations.filter(o => o.type === "بارگیری صادرات" || o.type === "عملیات شناور");

    const vesselBars = vessels.map(v => {
      const opsForVessel = realOps.filter(o => o.vessel_name === v.vessel_name);
      const opIds = new Set(opsForVessel.map(o => o.id));
      const ds = declarations.filter(d => opIds.has(d.operation_id) || d.vessel_name === v.vessel_name);
      const weight = ds.reduce((s, d) => s + effective.filter(a => a.declaration_no === d.declaration_no)
        .reduce((s2, a) => s2 + Number(a.weight || 0), 0), 0);
      window.toPersianDigits = function(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
  };
  return { label: v.vessel_name, value: HGLogic.round3(weight) };
    }).filter(v => v.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);

    const statusColors = { "تکمیل شده": "#27AE60", "در حال عملیات": "#1F3864", "برنامه‌ریزی شده": "#E0A340", "لغو شده": "#C0392B" };
    const statusCounts = Object.entries(
      realOps.reduce((acc, o) => { const k = o.status || "نامشخص"; acc[k] = (acc[k] || 0) + 1; return acc; }, {})
    ).map(([label, value]) => ({ label, value, color: statusColors[label] || "#8da8dc" }));

    contentEl.innerHTML = HGRender.pdfDashboardPage({
      totalIncoming, totalAllocated, totalInventory,
      mainCount, declCount, remCount,
      vesselCount: vessels.length, opsCount: realOps.length, declarationCount: declarations.length,
      vesselBars, statusCounts
    });
  }

  async function renderPdfReport() {
    const { receipts, allocations } = await loadEnrichedReceipts();
    const declarations = await HGDB.getAll("declarations");
    const vessels = await HGDB.getAll("vessels");
    const operations = await HGDB.getAll("operations");
    const items = await HGDB.getAll("items");

    const roots = HGLogic.findRoots(receipts);
    const totalIncoming = roots.reduce((s, r) => s + Number(r.initial_weight || 0), 0);
    const effective = allocations.filter(a => a.status !== "ابطال شده" && a.effective_status !== "ابطال شده");
    const totalAllocated = effective.reduce((s, a) => s + Number(a.weight || 0), 0);
    const totalInventory = receipts.reduce((s, r) => s + r._inventory, 0);

    const mainCount = receipts.filter(r => r.type === "اصلی").length;
    const declCount = receipts.filter(r => r.type === "اظهاری").length;
    const remCount = receipts.filter(r => r.type === "مانده").length;

    const realOps = operations.filter(o => o.type === "بارگیری صادرات" || o.type === "عملیات شناور");

    const vesselBars = vessels.map(v => {
      const opsForVessel = realOps.filter(o => o.vessel_name === v.vessel_name);
      const opIds = new Set(opsForVessel.map(o => o.id));
      const ds = declarations.filter(d => opIds.has(d.operation_id) || d.vessel_name === v.vessel_name);
      const weight = ds.reduce((s, d) => s + effective.filter(a => a.declaration_no === d.declaration_no)
        .reduce((s2, a) => s2 + Number(a.weight || 0), 0), 0);
      window.toPersianDigits = function(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
  };
  return { label: v.vessel_name, value: HGLogic.round3(weight) };
    }).filter(v => v.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);

    const statusColors = { "تکمیل شده": "#27AE60", "در حال عملیات": "#1F3864", "برنامه‌ریزی شده": "#E0A340", "لغو شده": "#C0392B" };
    const statusCounts = Object.entries(
      realOps.reduce((acc, o) => { const k = o.status || "نامشخص"; acc[k] = (acc[k] || 0) + 1; return acc; }, {})
    ).map(([label, value]) => ({ label, value, color: statusColors[label] || "#8da8dc" }));

    const page1 = {
      totalIncoming, totalAllocated, totalInventory,
      mainCount, declCount, remCount,
      vesselCount: vessels.length, opsCount: realOps.length, declarationCount: declarations.length,
      allocationCount: allocations.length, receiptCount: receipts.length, itemCount: items.length,
      vesselBars, statusCounts
    };

    const opRows = realOps.map(o => {
      const ds = declarations.filter(d => d.operation_id === o.id);
      const declNos = ds.map(d => d.koutaj_no || d.declaration_no);
      const relatedAllocations = ds.flatMap(d => effective.filter(a => a.declaration_no === d.declaration_no));
      const weight = relatedAllocations.reduce((s2, a) => s2 + Number(a.weight || 0), 0);
      const receiptNos = Array.from(new Set(relatedAllocations.map(a => a.receipt_no))).sort();
      window.toPersianDigits = function(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
  };
  return {
        ...o,
        entry_date: o.entry_date || o.date || "",
        exit_date: o.exit_date || "",
        declarations_text: declNos.join("، "),
        allocated_receipts_text: receiptNos.join("، "),
        computed_weight: HGLogic.round3(weight)
      };
    });

    const allRoots = HGLogic.findRoots(receipts)
      .sort((a, b) => {
        const treeA = HGLogic.buildTree(receipts, a.receipt_no);
        const treeB = HGLogic.buildTree(receipts, b.receipt_no);
        function sumInv(node) { return (node._inventory || 0) + (node.children || []).reduce((s, c) => s + sumInv(c), 0); }
        return sumInv(treeB) - sumInv(treeA) || a.receipt_no.localeCompare(b.receipt_no);
      });
    const rootTrees = allRoots.map(r => HGLogic.buildTree(receipts, r.receipt_no)).filter(Boolean);

    contentEl.innerHTML = HGRender.pdfReport3Pages(
      page1,
      HGRender.pdfOperationsReportPage(opRows, page1.vesselBars),
      rootTrees
    );
  }

  async function renderSettings() {
    await loadTolerance();
    contentEl.innerHTML = HGRender.settingsPage(currentTolerance);
  }

  // ---------------- Split modal logic ----------------
  async function openSplitModal(receiptNo) {
    const { receipts, allocations } = await loadEnrichedReceipts();
    const parent = receipts.find(r => r.receipt_no === receiptNo);
    if (!parent) return toast("قبض یافت نشد.", "err");
    await loadTolerance();
    const children = receipts.filter(r => r.parent_id === receiptNo);
    const gate = HGLogic.canSplit(parent, allocations, children, currentTolerance);
    if (!gate.allowed) return toast(`قبض ${receiptNo} قابل تفکیک نیست: ${gate.reasons.join(" و ")}`, "err");
    openModal(HGRender.splitModal(parent, currentTolerance));
    document.getElementById("splitAvailability").innerHTML = "قبض آماده تفکیک است.";
    const wrap=document.getElementById("splitRows");
    const declWeight=wrap.querySelector('[data-row="0"] [data-field="weight"]');
    const remWeight=wrap.querySelector('[data-row="1"] [data-field="weight"]');
    const recalc=()=>{
      const w=Number(declWeight.value)||0;
      const rem=HGLogic.round3((Number(parent._available_for_split)||0)-w);
      remWeight.value=rem>0?rem:"";
      document.getElementById("splitTotal").textContent=HGRender.fmt(w+Math.max(0,rem));
      document.getElementById("splitDiff").textContent=HGRender.fmt((w+Math.max(0,rem))-(Number(parent._available_for_split)||0));
      const valid=gate.allowed && w>0 && w < Number(parent._available_for_split||0)-currentTolerance && rem>0;
      document.getElementById("saveSplitBtn").disabled=!valid;
    };
    declWeight.addEventListener("input",recalc);
    recalc();
  }

  function collectSplitRows() {
    return Array.from(document.querySelectorAll("#splitRows > [data-row]")).map(rowEl => ({
      receipt_no: rowEl.querySelector('[data-field="receipt_no"]').value.trim(),
      type: rowEl.querySelector('[data-field="type"]').value,
      weight: rowEl.querySelector('[data-field="weight"]').value
    }));
  }

  async function saveSplit(receiptNo) {
    const { receipts } = await loadEnrichedReceipts();
    const parent = receipts.find(r => r.receipt_no === receiptNo);
    const rows = collectSplitRows();
    const existingNos = new Set(receipts.map(r => r.receipt_no));
    await loadTolerance();
    const children = receipts.filter(r => r.parent_id === receiptNo);
    const allocations = await HGDB.getAll("allocations");
    const gate = HGLogic.canSplit(parent, allocations, children, currentTolerance);
    const result = HGLogic.validateSplit(parent, rows, existingNos, currentTolerance);
    if (!gate.allowed) result.errors.push(...gate.reasons);
    result.valid = result.errors.length === 0;
    if (!result.valid) { document.getElementById("splitErrors").innerHTML=`<div class="error-list">${result.errors.map(HGRender.esc).join("<br>")}</div>`; return; }
    const splitId="SPLIT-"+Date.now()+"-"+Math.random().toString(36).slice(2,8);
    try {
      await HGDB.transaction(["receipts","operations"],"readwrite",stores=>{
        rows.forEach(row=>stores.receipts.put({
          receipt_no:row.receipt_no,type:row.type,parent_id:parent.receipt_no,root_id:parent.root_id,split_id:splitId,
          item:parent.item,initial_weight:Number(row.weight),project:parent.project,warehouse:parent.warehouse,
          date:new Date().toISOString().slice(0,10),notes:"ایجاد شده از تفکیک قبض "+parent.receipt_no,status:"فعال"
        }));
        const p={...parent,status:"تقسیم شده"}; delete p._inventory; delete p._allocatable; delete p._available_for_split;
        stores.receipts.put(p);
        stores.operations.put({date:new Date().toISOString(),type:"تقسیم قبض",description:`قبض ${parent.receipt_no} به دو قبض ${rows[0].receipt_no} و ${rows[1].receipt_no} تفکیک شد.`});
      });
      closeModal(); toast("تفکیک قبض با موفقیت ثبت شد.","ok"); router();
    } catch(e){ toast(e.message||"خطا در ثبت تفکیک","err"); }
  }

  // ---------------- Allocation modal logic ----------------
  async function openAllocateModal(receiptNo) {
    const { receipts, allocations } = await loadEnrichedReceipts();
    const receipt = receipts.find(r => r.receipt_no === receiptNo);
    if (!receipt) return toast("قبض یافت نشد.", "err");
    if (receipt._status_calc === "تقسیم شده") return toast(`قبض ${receiptNo} تفکیک شده و موجودی آن به فرزندان منتقل شده؛ قابل تخصیص مستقیم نیست.`, "err");
    if (receipt._status_calc === "ابطال شده") return toast(`قبض ${receiptNo} ابطال شده و قابل تخصیص نیست.`, "err");
    if (receipt._status_calc === "بسته") return toast(`قبض ${receiptNo} قبلاً تخصیص داده شده است.`, "err");
    const declarations = await HGDB.getAll("declarations");

    openModal(HGRender.allocateModal(receipt, declarations));
    HGJalali.attach(document.getElementById("allocDate"));
    const allocWeightEl=document.getElementById("allocWeight");
    const available=Number(receipt._allocatable ?? receipt._inventory ?? 0);
    if(receipt.type === "مانده" || receipt.type === "اظهاری") {
      allocWeightEl.value=available;
      allocWeightEl.readOnly=true;
      allocWeightEl.title="برای این نوع قبض، تخصیص باید معادل کل موجودی فعلی باشد.";
    }

    document.getElementById("allocDeclaration").addEventListener("change", (e) => {
      document.getElementById("newDeclarationWrap").style.display =
        e.target.value === "__NEW__" ? "block" : "none";
    });
  }

  async function saveAllocation(receiptNo) {
    const { receipts, allocations } = await loadEnrichedReceipts();
    const receipt = receipts.find(r => r.receipt_no === receiptNo);
    const declSel = document.getElementById("allocDeclaration").value;
    const weight = document.getElementById("allocWeight").value;
    const date = document.getElementById("allocDate").value;
    const errBox = document.getElementById("allocErrors");

    let declarationNo = declSel;
    if (declSel === "__NEW__") {
      declarationNo = document.getElementById("newDeclarationNo").value.trim();
      if (!declarationNo) {
        errBox.innerHTML = `<div class="error-list">شماره اظهار جدید را وارد کنید.</div>`;
        return;
      }
      const existingDecl = await HGDB.get("declarations", declarationNo);
      if (existingDecl) {
        errBox.innerHTML = `<div class="error-list">این شماره اظهار قبلاً وجود دارد.</div>`;
        return;
      }
    } else if (!declSel) {
      errBox.innerHTML = `<div class="error-list">یک اظهار انتخاب یا ایجاد کنید.</div>`;
      return;
    } else {
      const existingDecl = await HGDB.get("declarations", declarationNo);
      if (existingDecl && existingDecl.status === "تکمیل شده") {
        errBox.innerHTML = `<div class="error-list">این اظهار قبلاً تکمیل شده و امکان تخصیص جدید ندارد.</div>`;
        return;
      }
    }

    const validation = HGLogic.validateAllocation(receipt, weight, allocations, currentTolerance);
    if (!validation.valid) {
      errBox.innerHTML = `<div class="error-list">${validation.errors.map(HGRender.esc).join("<br>")}</div>`;
      return;
    }

    if (declSel === "__NEW__") {
      await HGDB.put("declarations", {
        declaration_no: declarationNo, date, project: receipt.project,
        status: "ثبت شده", notes: "ایجاد شده هنگام تخصیص از قبض " + receipt.receipt_no
      });
    }

    await HGDB.put("allocations", {
      receipt_no: receipt.receipt_no, declaration_no: declarationNo,
      weight: Number(weight), date
    });

    await HGDB.put("operations", {
      date: new Date().toISOString(), type: "تخصیص",
      description: `${weight} تن از قبض ${receipt.receipt_no} به اظهار ${declarationNo} تخصیص یافت.`
    });

    closeModal();
    toast("تخصیص با موفقیت ذخیره شد.", "ok");
    router();
  }

  // ---------------- New receipt modal ----------------
  async function openNewReceiptModal() {
    const receipts = await HGDB.getAll("receipts");
    const projects = await HGDB.getAll("projects");
    openModal(HGRender.newReceiptModal(receipts, projects));
    HGJalali.attach(document.getElementById("nrDate"));
  }

  async function saveNewReceipt() {
    const receipts = await HGDB.getAll("receipts");
    const existingNos = new Set(receipts.map(r => r.receipt_no));
    const byNo = {}; receipts.forEach(r => byNo[r.receipt_no] = r);

    const data = {
      receipt_no: document.getElementById("nrNo").value.trim(),
      type: document.getElementById("nrType").value,
      parent_id: document.getElementById("nrParent").value || null,
      item: document.getElementById("nrItem").value.trim(),
      initial_weight: document.getElementById("nrWeight").value,
      project: document.getElementById("nrProject").value.trim(),
      warehouse: document.getElementById("nrWarehouse").value.trim(),
      date: document.getElementById("nrDate").value,
      notes: document.getElementById("nrNotes").value.trim()
    };

    const errBox = document.getElementById("newReceiptErrors");
    const validation = HGLogic.validateNewReceipt(data, existingNos, data.parent_id ? byNo[data.parent_id] : null);
    if (validation.valid && data.parent_id && HGLogic.hasCircularParent(data.receipt_no, data.parent_id, byNo)) {
      validation.errors.push("رابطه والد باعث ایجاد چرخه می‌شود.");
      validation.valid = false;
    }
    if (!validation.valid) {
      errBox.innerHTML = `<div class="error-list">${validation.errors.map(HGRender.esc).join("<br>")}</div>`;
      return;
    }

    if (data.parent_id) {
      const parent = byNo[data.parent_id];
      const siblings = receipts.filter(r => r.parent_id === data.parent_id);
      if (siblings.some(r => r.type === "مانده") && data.type === "مانده") {
        validation.errors.push("برای هر والد فقط یک قبض مانده مجاز است.");
      }
      // Direct allocations do not by themselves block a split. The split balance
      // is checked against CURRENT available inventory by validateSplit().
      if (validation.errors.length) {
        errBox.innerHTML = `<div class="error-list">${validation.errors.map(HGRender.esc).join("<br>")}</div>`; return;
      }
    }
    const root_id = data.parent_id ? byNo[data.parent_id].root_id : data.receipt_no;

    await HGDB.put("receipts", {
      receipt_no: data.receipt_no, type: data.type, parent_id: data.parent_id,
      root_id, item: document.getElementById("nrItem").value.trim(), initial_weight: Number(data.initial_weight), project: data.project,
      warehouse: data.warehouse, date: data.date, notes: data.notes, status: "فعال"
    });

    await HGDB.put("operations", {
      date: new Date().toISOString(), type: "ثبت قبض",
      description: `قبض جدید ${data.receipt_no} ثبت شد.`
    });

    closeModal();
    toast("قبض جدید ثبت شد.", "ok");
    router();
  }

  // ---------------- New declaration modal ----------------
  async function openNewDeclarationModal() {
    const projects = await HGDB.getAll("projects");
    const vessels = await HGDB.getAll("vessels");
    const operations = await HGDB.getAll("operations");
    openModal(HGRender.newDeclarationModal(projects, vessels, operations));
    HGJalali.attach(document.getElementById("ndDate"));

    const vesselSel = document.getElementById("ndVessel");
    const opSel = document.getElementById("ndOperation");
    const allOpOptions = Array.from(opSel.options);
    vesselSel.addEventListener("change", () => {
      const chosen = vesselSel.value;
      opSel.innerHTML = "";
      allOpOptions.forEach(opt => {
        if (!chosen || opt.value === "" || opt.dataset.vessel === chosen) {
          opSel.appendChild(opt.cloneNode(true));
        }
      });
    });
  }

  async function saveNewDeclaration() {
    const koutaj_no = document.getElementById("ndNo").value.trim();
    const date = document.getElementById("ndDate").value;
    const project = document.getElementById("ndProject").value.trim();
    const vessel_name = document.getElementById("ndVessel").value.trim();
    const operation_id = document.getElementById("ndOperation").value.trim();
    const status = document.getElementById("ndStatus").value;
    const notes = document.getElementById("ndNotes").value.trim();
    const declaration_no = "DEC-" + Date.now();
    const errBox = document.getElementById("newDeclErrors");

    if (!koutaj_no) {
      errBox.innerHTML = `<div class="error-list">شماره اظهار الزامی است.</div>`; return;
    }
    if (!vessel_name || !operation_id) {
      errBox.innerHTML = `<div class="error-list">انتخاب شناور و عملیات الزامی است.</div>`; return;
    }
    const allDecl = await HGDB.getAll("declarations");
    const selectedOperation = await HGDB.get("operations", operation_id);
    if (!selectedOperation || (selectedOperation.type !== "بارگیری صادرات" && selectedOperation.type !== "عملیات شناور")) {
      errBox.innerHTML = `<div class="error-list">عملیات انتخاب‌شده معتبر نیست.</div>`; return;
    }
    if (allDecl.some(d => String(d.koutaj_no || "") === koutaj_no)) {
      errBox.innerHTML = `<div class="error-list">این شماره اظهار قبلاً ثبت شده است.</div>`; return;
    }

    await HGDB.put("declarations", { declaration_no, koutaj_no, date, vessel_name, operation_id, project, status, notes });
    await HGDB.put("operations", {
      date: new Date().toISOString(), type: "ثبت اظهار",
      description: `اظهار جدید ${koutaj_no} ثبت شد.`
    });

    closeModal();
    toast("اظهار جدید ثبت شد.", "ok");
    router();
  }

  // ---------------- Vessel master data ----------------
  async function openNewVesselMasterModal() {
    openModal(HGRender.newVesselMasterModal());
  }

  async function saveNewVesselMaster() {
    const vessel_name = document.getElementById("vmName").value.trim();
    const notes = document.getElementById("vmNotes").value.trim();
    const errBox = document.getElementById("newVesselMasterErrors");
    if (!vessel_name) {
      errBox.innerHTML = `<div class="error-list">نام شناور الزامی است.</div>`;
      return;
    }
    const vessels = await HGDB.getAll("vessels");
    if (vessels.some(v => String(v.vessel_name||"").trim().toLowerCase() === vessel_name.toLowerCase())) {
      errBox.innerHTML = `<div class="error-list">این شناور قبلاً در Master Data ثبت شده است.</div>`;
      return;
    }
    await HGDB.put("vessels", {
      id: "VES-" + Date.now(),
      vessel_name,
      notes,
      loaded_weight: null,
      created_at: new Date().toISOString()
    });
    closeModal();
    toast("شناور جدید ثبت شد.", "ok");
    router();
  }

  async function openEditVesselMasterModal(id) {
    const vessel = await HGDB.get("vessels", id);
    if (!vessel) return toast("شناور یافت نشد.", "err");
    openModal(HGRender.editVesselMasterModal(vessel));
  }

  async function saveEditVesselMaster(id) {
    const original = await HGDB.get("vessels", id);
    if (!original) return toast("شناور یافت نشد.", "err");
    const vessel_name = document.getElementById("evmName").value.trim();
    const notes = document.getElementById("evmNotes").value.trim();
    const errBox = document.getElementById("editVesselMasterErrors");
    if (!vessel_name) {
      errBox.innerHTML = `<div class="error-list">نام شناور الزامی است.</div>`;
      return;
    }
    const vessels = await HGDB.getAll("vessels");
    if (vessels.some(v => String(v.id)!==String(id) && String(v.vessel_name||"").trim().toLowerCase()===vessel_name.toLowerCase())) {
      errBox.innerHTML = `<div class="error-list">این نام شناور قبلاً ثبت شده است.</div>`;
      return;
    }
    const operations = await HGDB.getAll("operations");
    const declarations = await HGDB.getAll("declarations");
    const used = operations.some(o=>o.vessel_name===original.vessel_name) || declarations.some(d=>d.vessel_name===original.vessel_name);
    if (used && vessel_name !== original.vessel_name) {
      errBox.innerHTML = `<div class="error-list">این شناور قبلاً در عملیات یا اظهار استفاده شده است؛ برای حفظ روابط، نام آن قابل تغییر نیست.</div>`;
      return;
    }
    await HGDB.put("vessels", {...original, vessel_name, notes});
    closeModal();
    toast("اطلاعات شناور ویرایش شد.", "ok");
    router();
  }

  async function deleteVesselMaster(id) {
    const vessel = await HGDB.get("vessels", id);
    if (!vessel) return toast("شناور یافت نشد.", "err");
    const operations = await HGDB.getAll("operations");
    const declarations = await HGDB.getAll("declarations");
    const v = HGLogic.validateDeleteVessel(vessel, operations, declarations);
    if (!v.valid) return toast(v.errors.join(" "), "err");
    if (!confirm(`شناور «${vessel.vessel_name}» حذف شود؟`)) return;
    await HGDB.remove("vessels", id);
    toast("شناور حذف شد.", "ok");
    router();
  }

  // ---------------- New vessel operation modal ----------------
  async function openNewVesselModal() {
    const vessels = await HGDB.getAll("vessels");
    openModal(HGRender.newVesselModal(vessels));
    HGJalali.attach(document.getElementById("nvEntryDate"));
    HGJalali.attach(document.getElementById("nvExitDate"));
  }

  async function saveNewVessel() {
    const vessel_name = document.getElementById("nvName").value.trim();
    const entry_date = document.getElementById("nvEntryDate").value.trim();
    const exit_date = document.getElementById("nvExitDate").value.trim() || null;
    const status = document.getElementById("nvStatus").value;
    const notes = "";
    const errBox = document.getElementById("newVesselErrors");

    if (!vessel_name || !entry_date) {
      errBox.innerHTML = `<div class="error-list">شناور و تاریخ ورود الزامی هستند.</div>`; return;
    }
    if (status === "تکمیل شده" && !exit_date) {
      errBox.innerHTML = `<div class="error-list">برای وضعیت «تکمیل شده» تاریخ خروج الزامی است.</div>`; return;
    }
    const vessels = await HGDB.getAll("vessels");
    if (!vessels.some(v => v.vessel_name === vessel_name)) {
      errBox.innerHTML = `<div class="error-list">شناور انتخاب‌شده یافت نشد.</div>`; return;
    }

    const operation_id = "OP-" + Date.now();
    await HGDB.put("operations", {
      id: operation_id,
      project: "صادرات کلینکر سیمان",
      item: "کلینکر سیمان",
      vessel_name,
      type: "بارگیری صادرات",
      entry_date,
      exit_date,
      date: entry_date,
      status,
      notes,
      description: `بارگیری صادرات — ${vessel_name}`,
      source_row: null
    });
    closeModal(); toast("عملیات شناور ثبت شد.", "ok"); router();
  }


  async function openNewAllocationModal() {
    const { receipts } = await loadEnrichedReceipts();
    const declarations = await HGDB.getAll("declarations");
    openModal(HGRender.newAllocationModal(receipts, declarations));
    HGJalali.attach(document.getElementById("naDate"));
    const sync = async () => {
      const no = document.getElementById("naReceipt").value;
      const r = receipts.find(x=>x.receipt_no===no);
      const avail=r ? Number(r._allocatable ?? r._inventory ?? 0) : 0;
      document.getElementById("naAvail").textContent = r ? `موجودی قابل تخصیص: ${HGRender.fmt(avail)} تن` : "";
      const w=document.getElementById("naWeight");
      if(r && r.type==="مانده"){ w.value=avail; w.readOnly=true; }
      else { w.readOnly=false; }
    };
    document.getElementById("naReceipt").addEventListener("change", sync);
    sync();
  }

  async function saveNewAllocation() {
    const receiptNo = document.getElementById("naReceipt").value;
    const declNo = document.getElementById("naDecl").value;
    const weight = document.getElementById("naWeight").value;
    const date = document.getElementById("naDate").value.trim();
    const errBox = document.getElementById("newAllocErrors");
    const { receipts, allocations } = await loadEnrichedReceipts();
    const receipt = receipts.find(r=>r.receipt_no===receiptNo);
    const decl = await HGDB.get("declarations", declNo);
    if (!receipt || !decl) { errBox.innerHTML=`<div class="error-list">قبض و اظهار را انتخاب کنید.</div>`; return; }
    const v=HGLogic.validateAllocation(receipt,weight,allocations,currentTolerance);
    if(decl.status === "ابطال شده") v.errors.push("اظهار ابطال شده مقصد تخصیص نیست.");
    if(decl.status === "تکمیل شده") v.errors.push("این اظهار قبلاً تکمیل شده و امکان تخصیص جدید ندارد.");
    v.valid = v.errors.length === 0;
    if(!v.valid){errBox.innerHTML=`<div class="error-list">${v.errors.map(HGRender.esc).join("<br>")}</div>`;return;}
    await HGDB.put("allocations",{id:"ASN-"+Date.now(),receipt_no:receiptNo,declaration_no:declNo,koutaj_no:decl.koutaj_no||"",weight:Number(weight),status:"تکمیل شده",effective_status:decl.status,date,notes:""});
    await HGDB.put("operations",{id:"EV-"+Date.now(),date:new Date().toISOString(),type:"تخصیص",description:`${weight} تن از قبض ${receiptNo} به اظهار ${decl.koutaj_no||declNo} تخصیص یافت.`});
    closeModal();toast("تخصیص ثبت شد.","ok");router();
  }

  async function deleteReceipt(receiptNo) {
    const r=await HGDB.get("receipts",receiptNo);
    const allReceipts=await HGDB.getAll("receipts");
    const allocations=await HGDB.getAll("allocations");
    const v=HGLogic.validateDeleteReceipt(r,allReceipts,allocations);
    if(!v.valid){toast(v.errors.join(" "),"err");return;}
    const group=v.group||[r];
    const label=group.length===2 ? `تفکیک ${group.map(x=>x.receipt_no).join(" و ")}` : `قبض ${receiptNo}`;
    if(!confirm(`${label} حذف شود؟ موجودی/تراز والد پس از حذف مجدداً محاسبه می‌شود.`)) return;
    try {
      await HGDB.transaction(["receipts","operations"],"readwrite",stores=>{
        group.forEach(x=>stores.receipts.delete(x.receipt_no));
        if(group.length===2){
          const parent=allReceipts.find(x=>x.receipt_no===group[0].parent_id);
          if(parent){ const restored={...parent,status:"فعال"}; delete restored._inventory; delete restored._allocatable; delete restored._available_for_split; stores.receipts.put(restored); }
        }
        stores.operations.put({id:"DEL-"+Date.now(),date:new Date().toISOString(),type:"حذف قبض",description:`${label} حذف شد.`});
      });
      toast("حذف با موفقیت انجام شد و موجودی والد اصلاح شد.","ok"); router();
    } catch(e){ toast(e.message||"خطا در حذف قبض","err"); }
  }

  // ---------------- Edit receipt ----------------
  async function openEditReceiptModal(receiptNo) {
    const receipt = await HGDB.get("receipts", receiptNo);
    if (!receipt) return toast("قبض یافت نشد.", "err");
    const allocations = await HGDB.getAll("allocations");
    const children = await HGDB.byIndex("receipts", "parent_id", receiptNo);
    const gate = HGLogic.canEditReceipt(receipt, allocations, children);
    if (!gate.allowed) return toast(`قبض ${receiptNo} قابل ویرایش نیست، چون ${gate.reasons.join(" و ")}.`, "err");
    openModal(HGRender.editReceiptModal(receipt));
    HGJalali.attach(document.getElementById("erDate"));
  }

  async function saveEditReceipt(receiptNo) {
    await loadTolerance();
    const original=await HGDB.get("receipts",receiptNo); if(!original)return toast("قبض یافت نشد.","err");
    const allReceipts=await HGDB.getAll("receipts"); const allocations=await HGDB.getAll("allocations"); const children=allReceipts.filter(r=>r.parent_id===receiptNo);
    const changes={initial_weight:document.getElementById("erWeight").value}; const errBox=document.getElementById("editReceiptErrors");
    const v=HGLogic.validateEditReceipt(original,changes,allocations,children,allReceipts,currentTolerance);
    if(!v.valid){errBox.innerHTML=`<div class="error-list">${v.errors.map(HGRender.esc).join("<br>")}</div>`;return;}
    const updated={...original,item:document.getElementById("erItem").value.trim(),initial_weight:Number(changes.initial_weight),project:document.getElementById("erProject").value.trim(),warehouse:document.getElementById("erWarehouse").value.trim(),date:document.getElementById("erDate").value.trim(),notes:document.getElementById("erNotes").value.trim()};
    const group=original.parent_id?HGLogic.splitGroup(original,allReceipts):[];
    try {
      await HGDB.transaction(["receipts","operations"],"readwrite",stores=>{
        stores.receipts.put(updated);
        if(group.length===2){
          const sibling=group.find(x=>x.receipt_no!==original.receipt_no);
          const parentRow=allReceipts.find(x=>x.receipt_no===original.parent_id);
          const parentDirect=HGLogic.allocatedTotal(parentRow.receipt_no,allocations);
          const siblingWeight=HGLogic.round3(Number(parentRow.initial_weight)-parentDirect-Number(updated.initial_weight));
          stores.receipts.put({...sibling,initial_weight:siblingWeight});
        }
        stores.operations.put({date:new Date().toISOString(),type:"ویرایش قبض",description:`قبض ${receiptNo} ویرایش شد و تراز Split مجدداً محاسبه شد.`});
      });
      closeModal();toast("قبض ویرایش شد و موجودی/تراز شجره مجدداً محاسبه شد.","ok");router();
    }catch(e){toast(e.message||"خطا در ویرایش قبض","err");}
  }

  // ---------------- Delete declaration / allocation ----------------
  async function deleteDeclaration(declNo) {
    const decl = await HGDB.get("declarations", declNo);
    const allocations = await HGDB.getAll("allocations");
    const v = HGLogic.validateDeleteDeclaration(decl, allocations);
    if (!v.valid) { toast(v.errors.join(" "), "err"); return; }
    if (!confirm(`اظهار ${decl.koutaj_no || declNo} بدون وابستگی است. حذف شود؟`)) return;
    await HGDB.remove("declarations", declNo);
    await HGDB.put("operations", {
      date: new Date().toISOString(), type: "حذف اظهار",
      description: `اظهار ${decl.koutaj_no || declNo} حذف شد.`
    });
    toast("اظهار حذف شد.", "ok");
    if (location.hash === "#/declarations") { router(); } else { location.hash = "#/declarations"; }
  }

  async function deleteAllocation(allocId) {
    const allocations = await HGDB.getAll("allocations");
    const alloc = allocations.find(a => String(a.id) === String(allocId));
    const v = HGLogic.validateDeleteAllocation(alloc);
    if (!v.valid) { toast(v.errors.join(" "), "err"); return; }
    if (!confirm("این تخصیص حذف شود؟ موجودی قبض مبدأ آزاد خواهد شد.")) return;
    await HGDB.remove("allocations", alloc.id);
    await HGDB.put("operations", {
      date: new Date().toISOString(), type: "حذف تخصیص",
      description: `تخصیص ${alloc.weight} تن از قبض ${alloc.receipt_no} به اظهار ${alloc.declaration_no} حذف شد.`
    });
    toast("تخصیص حذف شد.", "ok");
    router();
  }

  // ---------------- Edit declaration ----------------
  async function openEditDeclarationModal(declNo) {
    const decl = await HGDB.get("declarations", declNo);
    if (!decl) return toast("اظهار یافت نشد.", "err");
    if (decl.status === "تکمیل شده") return toast(`این اظهار قبلاً تکمیل شده و قابل ویرایش نیست.`, "err");
    const vessels = await HGDB.getAll("vessels");
    const operations = await HGDB.getAll("operations");
    openModal(`
      <div class="modal-overlay"><div class="modal-box">
        <h2>ویرایش اظهار ${HGRender.esc(decl.koutaj_no || declNo)}</h2>
        <div id="editDeclErrors"></div>
        <div class="form-grid">
          <div><label>شماره اظهار</label><input id="edKoutaj" value="${HGRender.esc(decl.koutaj_no || "")}"></div>
          <div><label>تاریخ</label><input id="edDate" class="jalali-input" value="${HGRender.esc(decl.date || "")}"></div>
          <div><label>شناور</label><select id="edVessel"><option value="">— انتخاب —</option>
            ${vessels.map(v=>`<option value="${HGRender.esc(v.vessel_name)}" ${v.vessel_name===decl.vessel_name?"selected":""}>${HGRender.esc(v.vessel_name)}</option>`).join("")}
          </select></div>
          <div><label>عملیات</label><select id="edOperation"><option value="">— انتخاب —</option>
            ${operations.filter(o=>o.type==="بارگیری صادرات" || o.type==="عملیات شناور").map(o=>`<option value="${HGRender.esc(o.id)}" ${o.id===decl.operation_id?"selected":""}>${HGRender.esc(o.id)} — ${HGRender.esc(o.vessel_name||"")}</option>`).join("")}
          </select></div>
          <div><label>پروژه</label><input id="edProject" value="${HGRender.esc(decl.project || "")}"></div>
          <div><label>وضعیت</label><select id="edStatus">
            ${["ثبت شده","در حال عملیات","تکمیل شده","ابطال شده"].map(x=>`<option ${x===decl.status?"selected":""}>${x}</option>`).join("")}
          </select></div>
          <div class="field-full"><label>یادداشت</label><textarea id="edNotes" rows="2">${HGRender.esc(decl.notes||"")}</textarea></div>
        </div>
        <div class="modal-actions"><button class="btn gold" data-action="save-edit-declaration" data-id="${HGRender.esc(declNo)}">ذخیره تغییرات</button>
          <button class="btn outline" data-action="close-modal">انصراف</button></div>
      </div></div>`);
    HGJalali.attach(document.getElementById("edDate"));
  }

  async function saveEditDeclaration(declNo) {
    const original = await HGDB.get("declarations", declNo);
    if (!original) return toast("اظهار یافت نشد.", "err");
    if (original.status === "تکمیل شده") return toast("این اظهار قبلاً تکمیل شده و قابل ویرایش نیست.", "err");
    const koutaj = document.getElementById("edKoutaj").value.trim();
    const all = await HGDB.getAll("declarations");
    const errBox = document.getElementById("editDeclErrors");
    if (!koutaj) { errBox.innerHTML = `<div class="error-list">شماره اظهار الزامی است.</div>`; return; }
    if (all.some(d => d.declaration_no !== declNo && String(d.koutaj_no||"") === koutaj)) {
      errBox.innerHTML = `<div class="error-list">این شماره اظهار قبلاً ثبت شده است.</div>`; return;
    }
    const updated = {...original,
      koutaj_no:koutaj,
      date:document.getElementById("edDate").value.trim(),
      vessel_name:document.getElementById("edVessel").value.trim(),
      operation_id:document.getElementById("edOperation").value.trim(),
      project:document.getElementById("edProject").value.trim(),
      status:document.getElementById("edStatus").value,
      notes:document.getElementById("edNotes").value.trim()
    };
    if (updated.status === "ابطال شده" && (await HGDB.getAll("allocations")).some(a=>a.declaration_no===declNo && a.status!=="ابطال شده")) {
      errBox.innerHTML = `<div class="error-list">اظهاری که تخصیص فعال دارد قابل ابطال مستقیم نیست؛ ابتدا تخصیص‌های آن را تعیین تکلیف کنید.</div>`; return;
    }
    await HGDB.put("declarations",updated);
    closeModal(); toast("اظهار ویرایش شد.","ok"); router();
  }

  // ---------------- Edit allocation ----------------
  async function openEditAllocationModal(allocId) {
    const allocations=await HGDB.getAll("allocations");
    const alloc=allocations.find(a=>String(a.id)===String(allocId));
    if(!alloc) return toast("تخصیص یافت نشد.","err");
    const receipts=await HGDB.getAll("receipts");
    const declarations=await HGDB.getAll("declarations");
    openModal(`
      <div class="modal-overlay"><div class="modal-box">
        <h2>ویرایش تخصیص</h2><div id="editAllocErrors"></div>
        <div class="form-grid">
          <div><label>قبض</label><select id="eaReceipt">${receipts.map(r=>`<option value="${HGRender.esc(r.receipt_no)}" ${r.receipt_no===alloc.receipt_no?"selected":""}>${HGRender.esc(r.receipt_no)}</option>`).join("")}</select></div>
          <div><label>اظهار</label><select id="eaDecl">${declarations.map(d=>`<option value="${HGRender.esc(d.declaration_no)}" ${d.declaration_no===alloc.declaration_no?"selected":""}>${HGRender.esc(d.koutaj_no||d.declaration_no)}</option>`).join("")}</select></div>
          <div><label>وزن تخصیص (تن)</label><input id="eaWeight" type="number" step="0.001" value="${Number(alloc.weight||0)}"></div>
          <div><label>تاریخ</label><input id="eaDate" class="jalali-input" value="${HGRender.esc(alloc.date||"")}"></div>
          <div><label>وضعیت</label><select id="eaStatus"><option ${alloc.status!=="ابطال شده"?"selected":""}>تکمیل شده</option><option ${alloc.status==="ابطال شده"?"selected":""}>ابطال شده</option></select></div>
        </div>
        <div class="modal-actions"><button class="btn gold" data-action="save-edit-allocation" data-id="${HGRender.esc(allocId)}">ذخیره</button>
        <button class="btn outline" data-action="close-modal">انصراف</button></div>
      </div></div>`);
    HGJalali.attach(document.getElementById("eaDate"));
  }

  async function saveEditAllocation(allocId) {
    const allocations=await HGDB.getAll("allocations");
    const original=allocations.find(a=>String(a.id)===String(allocId));
    if(!original) return toast("تخصیص یافت نشد.","err");
    await loadTolerance();
    const receiptNo=document.getElementById("eaReceipt").value;
    const declNo=document.getElementById("eaDecl").value;
    const weight=Number(document.getElementById("eaWeight").value);
    const receipt=(await HGDB.getAll("receipts")).find(r=>r.receipt_no===receiptNo);
    const others=allocations.filter(a=>String(a.id)!==String(allocId) && a.status!=="ابطال شده" && a.effective_status!=="ابطال شده");
    const status=document.getElementById("eaStatus").value;
    if(status!=="ابطال شده"){
      const v=HGLogic.validateAllocation(receipt,weight,others,currentTolerance,allocId);
      if(!v.valid){document.getElementById("editAllocErrors").innerHTML=`<div class="error-list">${v.errors.map(HGRender.esc).join("<br>")}</div>`;return;}
    }
    await HGDB.put("allocations",{...original,receipt_no:receiptNo,declaration_no:declNo,weight,date:document.getElementById("eaDate").value.trim(),status});
    closeModal();toast("تخصیص ویرایش شد.","ok");router();
  }

  // ---------------- Edit/Delete vessel operation ----------------
  async function openEditOperationModal(opId) {
    const op=await HGDB.get("operations",opId);
    if(!op || (op.type!=="بارگیری صادرات" && op.type!=="عملیات شناور")) return toast("عملیات شناور یافت نشد.","err");
    openModal(`
      <div class="modal-overlay"><div class="modal-box">
        <h2>ویرایش عملیات شناور</h2><div id="editOpErrors"></div>
        <div class="form-grid">
          <div><label>شناور</label><input value="${HGRender.esc(op.vessel_name||"")}" disabled></div>
          <div><label>تاریخ ورود</label><input id="eoEntry" class="jalali-input" value="${HGRender.esc(op.entry_date||op.date||"")}"></div>
          <div><label>تاریخ خروج</label><input id="eoExit" class="jalali-input" value="${HGRender.esc(op.exit_date||"")}"></div>
          <div><label>وضعیت</label><select id="eoStatus">${HGLogic.OPERATION_STATUSES.map(x=>`<option ${x===op.status?"selected":""}>${x}</option>`).join("")}</select></div>
          <div class="field-full"><label>یادداشت</label><textarea id="eoNotes" rows="2">${HGRender.esc(op.notes||"")}</textarea></div>
        </div>
        <div class="modal-actions"><button class="btn gold" data-action="save-edit-operation" data-id="${HGRender.esc(opId)}">ذخیره</button>
        <button class="btn outline" data-action="close-modal">انصراف</button></div>
      </div></div>`);
    HGJalali.attach(document.getElementById("eoEntry"));
    HGJalali.attach(document.getElementById("eoExit"));
  }

  async function saveEditOperation(opId) {
    const op=await HGDB.get("operations",opId);
    if(!op) return toast("عملیات شناور یافت نشد.","err");
    const entry=document.getElementById("eoEntry").value.trim();
    const exit=document.getElementById("eoExit").value.trim()||null;
    const status=document.getElementById("eoStatus").value;
    if(!entry) return document.getElementById("editOpErrors").innerHTML=`<div class="error-list">تاریخ ورود الزامی است.</div>`;
    if(status==="تکمیل شده" && !exit) return document.getElementById("editOpErrors").innerHTML=`<div class="error-list">برای وضعیت «تکمیل شده» تاریخ خروج الزامی است.</div>`;
    await HGDB.put("operations",{...op,entry_date:entry,exit_date:exit,date:entry,status,notes:document.getElementById("eoNotes").value.trim()});
    closeModal();toast("عملیات شناور ویرایش شد.","ok");router();
  }

  async function deleteOperation(opId) {
    const op=await HGDB.get("operations",opId);
    if(!op) return toast("عملیات شناور یافت نشد.","err");
    const decls=await HGDB.getAll("declarations");
    if(decls.some(d=>d.operation_id===opId)) return toast("این عملیات به اظهارها متصل است و قابل حذف نیست.","err");
    if(!confirm(`عملیات شناور ${op.vessel_name||opId} حذف شود؟`)) return;
    await HGDB.remove("operations",opId);
    toast("عملیات شناور حذف شد.","ok");router();
  }

  // ---------------- Backup actions ----------------
  async function exportDb() {
    const data = await HGDB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hg-erp-backup-${toPersianDigits(new Date().toISOString().slice(0,10))}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("فایل پشتیبان دانلود شد.", "ok");
  }

  async function importDb() {
    const fileInput = document.getElementById("importFile");
    if (!fileInput.files.length) return toast("ابتدا یک فایل انتخاب کنید.", "err");
    const file = fileInput.files[0];
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      await HGDB.importAll(payload);
      toast("بازیابی با موفقیت انجام شد.", "ok");
      router();
    } catch (e) {
      toast("خطا در خواندن فایل پشتیبان.", "err");
    }
  }

  async function resetDemo() {
    if (!confirm("تمام داده‌های فعلی حذف و داده‌های واقعی Excel دوباره بارگذاری می‌شود. ادامه می‌دهید؟")) return;
    await HGDB.wipeAll();
    await HGDB.seedIfEmpty();
    toast("بازنشانی انجام شد.", "ok");
    router();
  }

  async function saveTolerance() {
    const val = Number(document.getElementById("toleranceInput").value);
    await HGDB.put("settings", { key: "split_tolerance", value: val });
    toast("تنظیمات ذخیره شد.", "ok");
  }

  // ---------------- Global click delegation ----------------
  document.addEventListener("click", async (e) => {
    const goReceipt = e.target.closest("[data-goto-receipt]");
    if (goReceipt) { location.hash = "#/receipts/" + encodeURIComponent(goReceipt.dataset.gotoReceipt); return; }

    const goDecl = e.target.closest("[data-goto-declaration]");
    if (goDecl) { location.hash = "#/declarations/" + encodeURIComponent(goDecl.dataset.gotoDeclaration); return; }

    const goTree = e.target.closest("[data-goto-tree]");
    if (goTree) { location.hash = "#/tree/" + encodeURIComponent(goTree.dataset.gotoTree); return; }

    const actionEl = e.target.closest("[data-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    const id = actionEl.dataset.id;

    try {
      switch (action) {
        case "view-receipt": location.hash = "#/receipts/" + encodeURIComponent(id); break;
        case "goto-tree": location.hash = "#/tree/" + encodeURIComponent(id); break;
        case "view-declaration": location.hash = "#/declarations/" + encodeURIComponent(id); break;
        case "open-split": await openSplitModal(id); break;
        case "save-split": await saveSplit(id); break;
        case "open-allocate": await openAllocateModal(id); break;
        case "save-allocation": await saveAllocation(id); break;
        case "open-new-allocation": await openNewAllocationModal(); break;
        case "save-new-allocation": await saveNewAllocation(); break;
        case "delete-receipt": await deleteReceipt(id); break;
        case "open-edit-receipt": await openEditReceiptModal(id); break;
        case "save-edit-receipt": await saveEditReceipt(id); break;
        case "delete-declaration": await deleteDeclaration(id); break;
        case "open-edit-declaration": await openEditDeclarationModal(id); break;
        case "save-edit-declaration": await saveEditDeclaration(id); break;
        case "delete-allocation": await deleteAllocation(id); break;
        case "open-edit-allocation": await openEditAllocationModal(id); break;
        case "save-edit-allocation": await saveEditAllocation(id); break;
        case "open-edit-operation": await openEditOperationModal(id); break;
        case "save-edit-operation": await saveEditOperation(id); break;
        case "delete-operation": await deleteOperation(id); break;
        case "open-new-receipt": await openNewReceiptModal(); break;
        case "save-new-receipt": await saveNewReceipt(); break;
        case "open-new-declaration": await openNewDeclarationModal(); break;
        case "save-new-declaration": await saveNewDeclaration(); break;
        case "open-new-vessel": await openNewVesselModal(); break;
        case "save-new-vessel": await saveNewVessel(); break;
        case "open-new-vessel-master": await openNewVesselMasterModal(); break;
        case "save-new-vessel-master": await saveNewVesselMaster(); break;
        case "open-edit-vessel-master": await openEditVesselMasterModal(id); break;
        case "save-edit-vessel-master": await saveEditVesselMaster(id); break;
        case "delete-vessel-master": await deleteVesselMaster(id); break;
        case "export-db": await exportDb(); break;
        case "import-db": await importDb(); break;
        case "reset-demo": await resetDemo(); break;
        case "save-tolerance": await saveTolerance(); break;
        case "close-modal": closeModal(); break;
        case "fs-connect-new": await fsConnectNew(); break;
        case "fs-connect-existing": await fsConnectExisting(); break;
        case "fs-disconnect": await HGFileStore.disconnect(); toast("اتصال به فایل قطع شد؛ داده فقط در مرورگر ذخیره می‌شود.", "err"); router(); break;
      }
    } catch (err) {
      console.error(err);
      toast("خطای غیرمنتظره رخ داد: " + err.message, "err");
    }
  });

  // ---------------- Boot ----------------
  // A boot attempt is racing against a 10s watchdog timer: if IndexedDB
  // never calls back (e.g. an "onblocked" upgrade with no other handler,
  // or any other silent hang), the timeout wins and shows a diagnostic
  // panel with a retry button instead of leaving the status bar stuck
  // on "در حال اتصال به پایگاه داده..." forever.
  function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(
          `عملیات «${label}» بیش از ${ms / 1000} ثانیه طول کشید و متوقف شد (timeout). ` +
          `این معمولاً یعنی یک تب یا پنجره دیگر از همین برنامه هنوز باز است، یا مرورگر ` +
          `دسترسی به IndexedDB را مسدود کرده است.`
        ));
      }, ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  function showBootDiagnostics(err) {
    console.error("HG-ERP boot failure:", err);
    dbStatusEl.textContent = "خطا در راه‌اندازی — جزئیات پایین صفحه";
    contentEl.innerHTML = `
      <div class="panel">
        <h2 style="color:#b3261e;">راه‌اندازی برنامه ناموفق بود</h2>
        <div class="error-list">${HGRender.esc(err && err.message ? err.message : String(err))}</div>
        <table>
          <tr><th>نام پایگاه داده</th><td>hg_export_erp</td></tr>
          <tr><th>نسخه پایگاه داده مورد انتظار</th><td>3</td></tr>
          <tr><th>زمان خطا</th><td>${new Date().toLocaleString("fa-IR")}</td></tr>
        </table>
        <p class="small-note">
          جزئیات کامل خطا در کنسول توسعه‌دهنده مرورگر (F12 → Console) نیز ثبت شده است.
          اگر این صفحه در چند تب مرورگر به‌طور همزمان باز است، همه‌ی آن‌ها را ببندید و دوباره تلاش کنید.
        </p>
        <button class="btn gold" id="retryBootBtn">تلاش مجدد</button>
      </div>
    `;
    const btn = document.getElementById("retryBootBtn");
    if (btn) btn.addEventListener("click", () => { boot(); });
  }

  async function boot() {
    dbStatusEl.textContent = "در حال اتصال به پایگاه داده...";
    HGFileStore.onStatusChange(renderFileStatus);
    try {
      await withTimeout(HGDB.open(), 10000, "اتصال به پایگاه داده (indexedDB.open)");

      let loadedFromFile = false;
      if (HGFileStore.supported()) {
        const reconnected = await HGFileStore.tryAutoReconnect();
        if (reconnected) {
          const fileData = await HGFileStore.readAll();
          if (fileData && Object.keys(fileData).length) {
            await HGDB.importAll(fileData);
            loadedFromFile = true;
          }
        }
      } else {
        renderFileStatus("unsupported");
      }

      const seeded = loadedFromFile ? false : await withTimeout(HGDB.seedIfEmpty(), 10000, "بارگذاری داده‌های اولیه (seedIfEmpty)");
      dbStatusEl.textContent = "پایگاه داده محلی متصل است (IndexedDB)";
      if (!location.hash) location.hash = "#/dashboard";
      await router();
      if (seeded) toast("داده‌های واقعی Excel بارگذاری شد.", "ok");
      if (loadedFromFile) toast("داده از فایل متصل بارگذاری شد.", "ok");
    } catch (e) {
      showBootDiagnostics(e);
    }
  }


  /* ---- PNG Export Engine (html2canvas + JSZip) ---- */
  function reportFileName(ext) {
    const now = HGJalali.todayJalali();
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const dateStr = now.str.replace(/\//g, ".");
    return `HG-ERP-Report-${dateStr}-${hh}:${mm}.${ext}`;
  }
  async function captureReportPages() {
    if (typeof html2canvas === 'undefined') {
      toast('کتابخانه‌ی html2canvas در حال بارگذاری است. لطفاً اتصال اینترنت را بررسی کنید.', 'err');
      return null;
    }

    const targets = Array.from(document.querySelectorAll('.pdfr-page'));
    if (!targets.length) {
      toast('گزارشی برای ذخیره‌سازی یافت نشد.', 'err');
      return null;
    }

    const stage = document.createElement('div');
    stage.id = 'hgCaptureStage';
    stage.setAttribute('dir', 'rtl');
    stage.setAttribute('lang', 'fa');
    stage.style.position = 'absolute';
    stage.style.left = '-9999px';
    stage.style.top = '0';
    stage.style.width = '1200px';
    stage.style.height = 'auto';
    stage.style.overflow = 'visible';
    stage.style.fontFamily = '"Vazirmatn", "Segoe UI", "Tahoma", Arial, sans-serif';
    document.body.appendChild(stage);

    const canvases = [];

    try {
      for (let i = 0; i < targets.length; i++) {
        const page = targets[i];
        stage.innerHTML = '';

        const clone = page.cloneNode(true);
        clone.querySelectorAll('.no-print').forEach(el => el.remove());
        clone.setAttribute('dir', 'rtl');
        clone.setAttribute('lang', 'fa');
        clone.style.cssText = (
          'width:1200px!important;' +
          'min-height:848px!important;' +
          'max-width:1200px!important;' +
          'margin:0!important;' +
          'padding:22px 34px 16px!important;' +
          'box-shadow:none!important;' +
          'border:1px solid #e5e7eb!important;' +
          'background:#ffffff!important;' +
          'overflow:visible!important;' +
          'position:absolute!important;' +
          'top:0!important;' +
          'left:0!important;' +
          'box-sizing:border-box!important;' +
          'direction:rtl!important;' +
          'font-family:"Vazirmatn","Segoe UI","Tahoma",sans-serif!important;'
        );

        clone.querySelectorAll('.pdfr-tree-half').forEach(el => {
          el.style.overflow = 'visible';
          el.style.minWidth = '0';
        });
        clone.querySelectorAll('.pdfr-orgchart li').forEach(el => {
          el.style.padding = '18px 4px 0';
        });
        clone.querySelectorAll('.pdfr-tnode').forEach(el => {
          el.style.padding = '5px 8px';
          el.style.minWidth = '72px';
        });

        stage.appendChild(clone);
        void clone.offsetHeight;

        // ── FIX: auto-scale wide genealogy trees so deep splits (e.g. 698) don't overflow ──
        clone.querySelectorAll('.pdfr-tree-half').forEach(half => {
          const chart = half.querySelector('.pdfr-orgchart');
          if (!chart) return;
          const naturalW = chart.scrollWidth;
          const availableW = half.getBoundingClientRect().width;
          if (naturalW > availableW && naturalW > 0 && availableW > 0) {
            const scale = Math.max(0.12, availableW / naturalW);
            chart.style.transform = `scale(${scale})`;
            chart.style.transformOrigin = 'top center';
          }
        });
        // ── END FIX ──

        if (document.fonts) {
          await document.fonts.load('12px "Vazirmatn", "Segoe UI", Tahoma, Arial, sans-serif');
          await document.fonts.load('bold 12px "Vazirmatn", "Segoe UI", Tahoma, Arial, sans-serif');
          await document.fonts.load('800 28px "Vazirmatn", "Segoe UI", Tahoma, Arial, sans-serif');
          await document.fonts.ready;
        }

        const imgs = Array.from(stage.querySelectorAll('img'));
        await Promise.all(imgs.map(img => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
            setTimeout(resolve, 3000);
          });
        }));

        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => setTimeout(r, 2500));

        const rect = clone.getBoundingClientRect();
        const captureW = Math.max(1200, Math.ceil(rect.width));
        const captureH = Math.max(848, Math.ceil(rect.height));

        const pixelCount = captureW * captureH;
        let scale = 4;
        if (pixelCount * 16 > 120000000) scale = 3;
        if (pixelCount * 9 > 120000000) scale = 2;

        const canvas = await html2canvas(clone, {
          scale: scale,
          backgroundColor: '#ffffff',
          useCORS: true,
          allowTaint: true,
          logging: false,
          width: captureW,
          height: captureH,
          windowWidth: captureW,
          windowHeight: captureH,
          x: 0,
          y: 0,
          scrollX: 0,
          scrollY: 0
        });

        canvases.push(canvas);
      }

      return canvases;
    } finally {
      if (stage.parentNode) stage.remove();
    }
  }

  async function exportReportPagesAsZip(format = 'png') {
    if (typeof JSZip === 'undefined') {
      toast('کتابخانه‌ی JSZip در حال بارگذاری است. لطفاً اتصال اینترنت را بررسی کنید.', 'err');
      return;
    }

    const btn = document.activeElement;
    if (btn && btn.tagName === 'BUTTON') {
      btn.disabled = true;
      btn.dataset.originalText = btn.innerHTML;
      btn.innerHTML = '⏳ در حال تولید تصاویر...';
    }

    try {
      const canvases = await captureReportPages();
      if (!canvases) return;

      const zip = new JSZip();
      const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
      const extension = format === 'jpg' ? 'jpg' : 'png';

      for (let i = 0; i < canvases.length; i++) {
        const blob = await new Promise(resolve => canvases[i].toBlob(resolve, mimeType, format === 'jpg' ? 0.95 : undefined));
        zip.file(`HG-ERP-Report-Page-${toPersianDigits(i + 1)}.${extension}`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = reportFileName('zip');
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast(`گزارش به‌صورت تصاویر ${extension.toUpperCase()} ذخیره شد.`, 'ok');
    } catch (err) {
      console.error(err);
      toast('خطا در ذخیره‌سازی گزارش: ' + (err.message || err), 'err');
    } finally {
      if (btn && btn.tagName === 'BUTTON') {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.originalText || '📷 ذخیره گزارش';
      }
    }
  }

  async function exportReportAsPdf() {
    const jsPDFCtor = window.jspdf?.jsPDF || window.jsPDF;
    if (typeof jsPDFCtor === 'undefined') {
      toast('کتابخانه‌ی jsPDF در دسترس نیست. لطفاً اتصال اینترنت را بررسی کنید.', 'err');
      return;
    }

    const btn = document.activeElement;
    if (btn && btn.tagName === 'BUTTON') {
      btn.disabled = true;
      btn.dataset.originalText = btn.innerHTML;
      btn.innerHTML = '⏳ در حال تولید PDF...';
    }

    try {
      const canvases = await captureReportPages();
      if (!canvases) return;

      const doc = new jsPDFCtor({ orientation: 'landscape', unit: 'px', format: [canvases[0].width, canvases[0].height] });

      for (let i = 0; i < canvases.length; i++) {
        const canvas = canvases[i];
        const imgData = canvas.toDataURL('image/png');
        if (i > 0) {
          doc.addPage([canvas.width, canvas.height], 'landscape');
        }
        doc.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      }

      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = reportFileName('pdf');
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast('گزارش PDF با موفقیت ذخیره شد.', 'ok');
    } catch (err) {
      console.error(err);
      toast('خطا در تولید PDF: ' + (err.message || err), 'err');
    } finally {
      if (btn && btn.tagName === 'BUTTON') {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.originalText || '🧾 خروجی PDF گزارش';
      }
    }
  }

  window.exportReportAsPngZip = async function() {
    await exportReportPagesAsZip('png');
  };

  window.exportReportAsImages = async function() {
    const useJpg = window.confirm('آیا می‌خواهید تصاویر گزارش به صورت JPG ذخیره شوند؟ در غیر این صورت PNG ذخیره خواهد شد.');
    await exportReportPagesAsZip(useJpg ? 'jpg' : 'png');
  };

  window.exportReportAsPdf = async function() {
    await exportReportAsPdf();
  };

  boot();
})();

/* PHASE 4 MODAL CONTROLLER */
(function(){
  function showModal(id){
    const el=document.getElementById(id);
    if(!el){ console.error("Modal not found:",id); return false; }
    el.classList.add("open","show");
    el.style.display="flex";
    el.setAttribute("aria-hidden","false");
    document.body.classList.add("modal-open");
    return true;
  }
  function hideModal(id){
    const el=document.getElementById(id);
    if(!el)return;
    el.classList.remove("open","show");
    el.style.display="none";
    el.setAttribute("aria-hidden","true");
    if(!document.querySelector(".modal.open,.modal.show")) document.body.classList.remove("modal-open");
  }
  window.__showModal=showModal;
  window.__hideModal=hideModal;
  
  document.addEventListener("click",function(e){
    const open=e.target.closest("[data-modal-open]");
    if(open){e.preventDefault();e.stopPropagation();showModal(open.dataset.modalOpen);return;}
    const close=e.target.closest("[data-modal-close]");
    if(close){e.preventDefault();e.stopPropagation();hideModal(close.dataset.modalClose || close.closest(".modal")?.id);return;}
    const closeBtn=e.target.closest(".modal .close,.modal [data-close]");
    if(closeBtn){e.preventDefault();hideModal(closeBtn.closest(".modal")?.id);}
  });
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape") document.querySelectorAll(".modal.open,.modal.show").forEach(m=>hideModal(m.id));
  });
})();
