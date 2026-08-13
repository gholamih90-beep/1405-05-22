const HGLogic = (function () {
  const RECEIPT_TYPES = ["اصلی", "مانده", "اظهاری"];
  const RECEIPT_STATUS = ["فعال", "تقسیم شده", "بسته", "ابطال شده"];
  const OPERATION_STATUSES = ["در انتظار ورود", "در حال عملیات", "تکمیل شده", "لغو شده"];

  function round3(n) { return Math.round((Number(n) + Number.EPSILON) * 1000) / 1000; }
  function activeAllocations(allocations) {
    return (allocations || []).filter(a => a.status !== "ابطال شده" && a.effective_status !== "ابطال شده");
  }
  function allocatedTotal(receiptNo, allocations) {
    return round3(activeAllocations(allocations).filter(a => a.receipt_no === receiptNo)
      .reduce((s, a) => s + Number(a.weight || 0), 0));
  }
  function allocatableRemaining(receipt, allocations) {
    if (!receipt || receipt.status === "ابطال شده" || receipt.status === "تقسیم شده") return 0;
    return Math.max(0, round3(Number(receipt.initial_weight || 0) - allocatedTotal(receipt.receipt_no, allocations)));
  }
  function currentInventory(receipt, allocations) {
    if (!receipt || receipt.status === "ابطال شده" || receipt.type === "اظهاری" || receipt.status === "تقسیم شده") return 0;
    return allocatableRemaining(receipt, allocations);
  }
  function deriveStatus(receipt, available) {
    if (!receipt) return "فعال";
    if (receipt.status === "ابطال شده") return "ابطال شده";
    if (receipt.status === "تقسیم شده") return "تقسیم شده";
    return Number(available || 0) <= 0 ? "بسته" : "فعال";
  }
  function enrichReceipts(receipts, allocations) {
    const parentNos = new Set((receipts || []).filter(r => r.parent_id).map(r => r.parent_id));
    return receipts.map(r => {
      const isSplitParent = parentNos.has(r.receipt_no);
      const available = isSplitParent ? 0 : allocatableRemaining(r, allocations);
      const inv = isSplitParent ? 0 : currentInventory(r, allocations);
      return { ...r, _has_children: isSplitParent, _inventory: inv, _allocatable: available,
        _direct_allocation_total: allocatedTotal(r.receipt_no, allocations),
        _available_for_split: (r.type === "اظهاری" ? 0 : available),
        _status_calc: isSplitParent ? "تقسیم شده" : deriveStatus(r, available) };
    });
  }
  function buildTree(receipts, rootNo) {
    const byParent = {};
    receipts.forEach(r => { const k = r.parent_id || "__ROOT__"; (byParent[k] ||= []).push(r); });
    const root = receipts.find(r => r.receipt_no === rootNo);
    if (!root) return null;
    function attach(node) {
      const children = (byParent[node.receipt_no] || []).sort((a,b)=>String(a.receipt_no).localeCompare(String(b.receipt_no)));
      return { ...node, children: children.map(attach) };
    }
    return attach(root);
  }
  function findRoots(receipts) { return receipts.filter(r => !r.parent_id); }

  function validateSplit(parent, rows, existingReceiptNos, tolerance) {
    const errors = [];
    if (!parent) return {valid:false, errors:["قبض والد یافت نشد."], total:0, available:0, diff:0};
    if (parent.type === "اظهاری") errors.push("قبض اظهاری قابل تقسیم نیست.");
    if (parent.status === "تقسیم شده") errors.push("این قبض قبلاً تقسیم شده است.");
    if (parent.status === "ابطال شده") errors.push("قبض ابطال شده قابل تقسیم نیست.");
    const available = Number(parent._available_for_split ?? parent._allocatable ?? parent._inventory) || 0;
    if (available <= tolerance) errors.push("این قبض موجودی قابل تقسیم ندارد.");
    if (!Array.isArray(rows) || rows.length !== 2) errors.push("هر تفکیک باید دقیقاً دو ردیف داشته باشد: یک اظهاری و یک مانده.");
    const seen = new Set(); let declarationCount=0, mandehCount=0, total=0;
    (rows || []).forEach((row,i)=>{
      const n=String(row.receipt_no||"").trim(); const type=row.type; const w=Number(row.weight);
      if(!n) errors.push(`ردیف ${i+1}: شماره قبض الزامی است.`);
      if(n && (existingReceiptNos.has(n)||seen.has(n))) errors.push(`ردیف ${i+1}: شماره قبض «${n}» تکراری است.`);
      seen.add(n);
      if(type === "اظهاری") declarationCount++; else if(type === "مانده") mandehCount++; else errors.push(`ردیف ${i+1}: نوع باید اظهاری یا مانده باشد.`);
      if(!(w>0)) errors.push(`ردیف ${i+1}: وزن باید مثبت باشد.`);
      total += Number(w||0);
    });
    if(declarationCount!==1) errors.push("هر تفکیک باید دقیقاً یک قبض اظهاری داشته باشد.");
    if(mandehCount!==1) errors.push("هر تفکیک باید دقیقاً یک قبض مانده داشته باشد.");
    const diff=round3(total-available);
    if(Math.abs(diff)>Number(tolerance)) errors.push(`مجموع دو فرزند باید دقیقاً برابر موجودی فعلی ${available.toLocaleString("fa-IR")} تن باشد.`);
    const decl=(rows||[]).find(r=>r.type==="اظهاری");
    if(decl && Number(decl.weight) >= available - Number(tolerance)) errors.push("اگر قرار است کل موجودی استفاده شود، قبض مانده نباید ایجاد شود؛ از «تخصیص مستقیم» استفاده کنید.");
    return {valid:errors.length===0,errors,total,diff,available};
  }
  function canSplit(parent, allocations, children, tolerance=0.01) {
    const reasons=[];
    if(!parent) reasons.push("قبض یافت نشد.");
    else {
      if(parent.type==="اظهاری") reasons.push("قبض اظهاری قابل تقسیم نیست.");
      if(parent.status==="ابطال شده") reasons.push("قبض ابطال شده قابل تقسیم نیست.");
      if(parent.status==="تقسیم شده" || (children||[]).length) reasons.push("این قبض قبلاً تقسیم شده است.");
      const available=Number(parent._available_for_split ?? parent._allocatable ?? parent._inventory)||0;
      if(available<=tolerance) reasons.push("موجودی قابل تقسیم ندارد.");
    }
    return {allowed:!reasons.length,reasons};
  }
  function splitGroup(receipt, allReceipts) {
    if(!receipt) return [];
    if(!receipt.parent_id) return [];
    const siblings=(allReceipts||[]).filter(r=>r.parent_id===receipt.parent_id);
    return siblings.length===2 ? siblings : [];
  }
  function validateDeleteReceipt(receipt, allReceipts, allocations) {
    const errors=[]; let group=[];
    if(!receipt) return {valid:false,errors:["قبض یافت نشد."],group:[]};
    const children=(allReceipts||[]).filter(r=>r.parent_id===receipt.receipt_no);
    if(children.length) errors.push("قبض والد دارای فرزند است و تا حذف کل شجره قابل حذف نیست.");
    if(receipt.parent_id) {
      group=splitGroup(receipt,allReceipts);
      if(group.length!==2) errors.push("ساختار Split ناقص است؛ حذف برای حفظ تراز شجره متوقف شد.");
    } else group=[receipt];
    for(const r of group){
      const deps=(allocations||[]).filter(a=>a.receipt_no===r.receipt_no);
      const child=(allReceipts||[]).filter(x=>x.parent_id===r.receipt_no);
      if(deps.length) errors.push(`قبض ${r.receipt_no} دارای تخصیص فعال است و کل Split قابل حذف نیست.`);
      if(child.length) errors.push(`قبض ${r.receipt_no} دارای فرزند است و کل Split قابل حذف نیست.`);
    }
    return {valid:!errors.length,errors,group};
  }
  function validateAllocation(receipt, requestedWeight, allocations, tolerance=0.01, originalAllocationId=null) {
    const errors=[]; const w=Number(requestedWeight); const active=activeAllocations(allocations).filter(a=>String(a.id)!==String(originalAllocationId));
    if(!(w>0)) errors.push("وزن تخصیص باید مثبت باشد.");
    const avail=allocatableRemaining(receipt,active);
    if(receipt?.status==="ابطال شده") errors.push("قبض ابطال شده قابل تخصیص نیست.");
    if(receipt?.status==="تقسیم شده") errors.push("قبض تقسیم‌شده قابل تخصیص مستقیم نیست؛ موجودی به فرزندان منتقل شده است.");
    if((receipt?.type==="مانده" || receipt?.type==="اظهاری") && Math.abs(w-avail)>tolerance) errors.push(`قبض ${receipt.type} فقط در صورت تخصیص کامل موجودی، آن هم یک‌بار و به یک اظهار، قابل تخصیص است. موجودی فعلی: ${avail.toLocaleString("fa-IR")} تن.`);
    if(w>avail+tolerance) errors.push(`وزن تخصیص از موجودی قابل تخصیص (${avail.toLocaleString("fa-IR")}) بیشتر است.`);
    return {valid:!errors.length,errors,available:avail};
  }
  function validateEditReceipt(original, changes, allocations, children, allReceipts, tolerance=0.01) {
    const errors=[]; if(!original) return {valid:false,errors:["قبض یافت نشد."]};
    if(changes.type!==undefined&&changes.type!==original.type) errors.push("نوع قبض قابل تغییر نیست.");
    if(changes.receipt_no!==undefined&&changes.receipt_no!==original.receipt_no) errors.push("شماره قبض قابل تغییر نیست.");
    if(changes.parent_id!==undefined&&(changes.parent_id||null)!==(original.parent_id||null)) errors.push("والد قابل تغییر نیست.");
    if(changes.root_id!==undefined&&changes.root_id!==original.root_id) errors.push("ریشه قابل تغییر نیست.");

    const alloc=allocatedTotal(original.receipt_no,allocations);
    const hasChildren=!!(children&&children.length);
    const isSplitChild=!!original.parent_id;
    const hasAllocation=alloc>tolerance;
    if(hasChildren||isSplitChild||hasAllocation){
      const reasons=[];
      if(hasChildren) reasons.push("تقسیم شده است");
      if(isSplitChild) reasons.push("حاصل یک تقسیم است");
      if(hasAllocation) reasons.push("دارای تخصیص فعال است");
      errors.push(`قبض ${original.receipt_no} قابل ویرایش نیست، چون ${reasons.join(" و ")}.`);
      return {valid:false,errors};
    }

    const nw=Number(changes.initial_weight);
    if(!(nw>0)) errors.push("وزن اولیه باید مثبت باشد.");
    return {valid:!errors.length,errors};
  }
  function canEditReceipt(receipt, allocations, children, tolerance=0.01){
    const reasons=[];
    if(!receipt){ reasons.push("قبض یافت نشد."); return {allowed:false,reasons}; }
    const alloc=allocatedTotal(receipt.receipt_no,allocations);
    if(children&&children.length) reasons.push("این قبض تقسیم شده است");
    if(receipt.parent_id) reasons.push("این قبض حاصل یک تقسیم است");
    if(alloc>tolerance) reasons.push("این قبض دارای تخصیص فعال است");
    return {allowed:reasons.length===0,reasons};
  }
  function validateDeleteDeclaration(decl, allocations){const deps=(allocations||[]).filter(a=>a.declaration_no===decl?.declaration_no);return {valid:!!decl&&!deps.length,errors:!decl?["اظهار یافت نشد."]:deps.length?[`این اظهار ${deps.length} تخصیص فعال دارد و قابل حذف نیست.`]:[],dependencies:deps};}
  function validateDeleteVessel(vessel, operations, declarations){const deps=(operations||[]).filter(o=>o.vessel_name===vessel?.vessel_name);const ds=(declarations||[]).filter(d=>d.vessel_name===vessel?.vessel_name);return {valid:!!vessel&&!deps.length&&!ds.length,errors:!vessel?["شناور یافت نشد."]:deps.length||ds.length?["این شناور در عملیات/اظهار استفاده شده و قابل حذف نیست."]:[],dependencies:[...deps,...ds]};}
  function validateDeleteVesselOperation(op,declarations){const deps=(declarations||[]).filter(d=>d.operation_id===op?.id);return {valid:!!op&&!deps.length,errors:!op?["عملیات یافت نشد."]:deps.length?["این عملیات به اظهارها متصل است و قابل حذف نیست."]:[],dependencies:deps};}
  function validateDeleteAllocation(alloc){return {valid:!!alloc,errors:alloc?[ ]:["تخصیص یافت نشد."]};}
  function validateNewReceipt(data, existingReceiptNos, parent) {
    const errors=[]; if(!data.receipt_no?.trim()) errors.push("شماره قبض الزامی است."); else if(existingReceiptNos.has(data.receipt_no.trim())) errors.push("شماره قبض تکراری است.");
    if(data.type !== "اصلی") errors.push("قبض جدید فقط می‌تواند از نوع «اصلی» باشد؛ قبض‌های اظهاری و مانده فقط از طریق «تقسیم قبض» ایجاد می‌شوند."); if(!(Number(data.initial_weight)>0)) errors.push("وزن اولیه باید مثبت باشد.");
    if(data.parent_id) errors.push("قبض فرزند فقط از طریق عملیات «تقسیم قبض» ایجاد می‌شود؛ ثبت دستی قبض فرزند مجاز نیست.");
    return {valid:!errors.length,errors};
  }
  function hasCircularParent(receiptNo,parentId,byNo){let c=parentId,g=new Set();while(c){if(c===receiptNo||g.has(c))return true;g.add(c);c=byNo[c]?.parent_id||null;}return false;}
  return {RECEIPT_TYPES,RECEIPT_STATUS,OPERATION_STATUSES,round3,allocatedTotal,allocatableRemaining,currentInventory,deriveStatus,enrichReceipts,buildTree,findRoots,splitGroup,validateSplit,canSplit,validateDeleteReceipt,validateAllocation,validateNewReceipt,validateEditReceipt,canEditReceipt,validateDeleteDeclaration,validateDeleteVessel,validateDeleteVesselOperation,validateDeleteAllocation,hasCircularParent};
})();
