/*
  jalali.js
  ------------------------------------------------------------
  Fully offline Jalali (Persian/Shamsi) calendar support.
  - Pure JS conversion (no library, no CDN).
  - A minimal popup date-picker that attaches to a text input and
    writes back a zero-padded "YYYY/MM/DD" Jalali string -- the same
    format already used throughout the imported production data, so
    sorting/comparison by plain string stays valid.
  - Inputs using this picker are set to readonly: the user always
    picks a day from the calendar, never types a date by hand.
  ------------------------------------------------------------
*/

const HGJalali = (function () {
  const MONTH_NAMES = [
    "فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور",
    "مهر","آبان","آذر","دی","بهمن","اسفند"
  ];

  // ---- Gregorian <-> Jalali conversion (standard public-domain algorithm) ----
  function div(a, b) { return Math.trunc(a / b); }
  function jalCal(jy) {
    // Returns leap-year info using the 33-year cycle algorithm.
    const breaks = [-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];
    let bl = breaks.length, gy = jy + 621, leapJ = -14, jp = breaks[0];
    let jm, jump = 0;
    if (jy < jp || jy >= breaks[bl - 1]) throw new Error("Jalali year out of range");
    for (let i = 1; i < bl; i += 1) {
      jm = breaks[i];
      jump = jm - jp;
      if (jy < jm) break;
      leapJ += div(jump, 33) * 8 + div(jump % 33, 4);
      jp = jm;
    }
    let n = jy - jp;
    leapJ += div(n, 33) * 8 + div((n % 33) + 3, 4);
    if ((jump % 33) === 4 && (jump - n) === 4) leapJ += 1;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    const march = 20 + leapJ - leapG;
    if ((jump - n) < 6) n = n - jump + div(jump + 4, 33) * 33;
    let leap = ((n + 1) % 33 - 1) % 4;
    if (leap === -1) leap = 4;
    return { leap, march };
  }
  function isLeapJalaliYear(jy) {
    return jalCal(jy).leap === 0;
  }
  function g2d(gy, gm, gd) {
    let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
      + div(153 * ((gm + 9) % 12) + 2, 5) + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
  }
  function d2g(jdn) {
    let j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div((j % 1461), 4) * 5 + 308;
    const gd = div(i % 153, 5) + 1;
    const gm = (div(i, 153) % 12) + 1;
    const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return [gy, gm, gd];
  }
  function toJalali(gy, gm, gd) {
    const jdn = g2d(gy, gm, gd);
    const info = jalCal(jalOfJdn(jdn));
    const jy = jalOfJdn(jdn);
    const jdn1f = g2d(jy + 621, 3, info.march);
    let k = jdn - jdn1f;
    let jm, jd;
    if (k >= 0) {
      if (k <= 185) { jm = 1 + div(k, 31); jd = (k % 31) + 1; return [jy, jm, jd]; }
      k -= 186;
    } else {
      // shouldn't normally happen given jalOfJdn, kept for safety
      k += 186;
    }
    jm = 7 + div(k, 30);
    jd = (k % 30) + 1;
    return [jy, jm, jd];
  }
  function jalOfJdn(jdn) {
    // Approximate Jalali year for a given Julian day number, then refine.
    const gy = d2g(jdn)[0];
    let jy = gy - 621;
    // refine by checking the actual boundary
    while (g2d(jy + 621, 3, jalCal(jy).march) > jdn) jy -= 1;
    while (g2d(jy + 1 + 621, 3, jalCal(jy + 1).march) <= jdn) jy += 1;
    return jy;
  }
  function toGregorian(jy, jm, jd) {
    const info = jalCal(jy);
    const jdn = g2d(jy + 621, 3, info.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
    return d2g(jdn);
  }
  function daysInJalaliMonth(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return isLeapJalaliYear(jy) ? 30 : 29;
  }
  function pad2(n) { return String(n).padStart(2, "0"); }
  function formatJalali(jy, jm, jd) {
    const s = `${jy}/${pad2(jm)}/${pad2(jd)}`;
    return s.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  }
  function todayJalali() {
    const now = new Date();
    const [jy, jm, jd] = toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
    return { jy, jm, jd, str: formatJalali(jy, jm, jd) };
  }
  function todayString() { return todayJalali().str; }
  function parseJalaliString(s) {
    if (!s) return null;
    const m = String(s).trim().match(/^(\d{3,4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (!m) return null;
    return { jy: Number(m[1]), jm: Number(m[2]), jd: Number(m[3]) };
  }

  // ---------------- Popup picker ----------------
  let activePopup = null;
  function closePopup() {
    if (activePopup) { activePopup.remove(); activePopup = null; }
    document.removeEventListener("mousedown", onOutsideClick, true);
    document.removeEventListener("keydown", onKeydown, true);
  }
  function onOutsideClick(e) {
    if (activePopup && !activePopup.contains(e.target) && e.target !== activePopup._inputEl) closePopup();
  }
  function onKeydown(e) { if (e.key === "Escape") { e.stopPropagation(); closePopup(); } }

  function buildPopup(inputEl) {
    closePopup();
    const existing = parseJalaliString(inputEl.value) || todayJalali();
    let viewY = existing.jy, viewM = existing.jm;

    const pop = document.createElement("div");
    pop.className = "jalali-popup";
    pop._inputEl = inputEl;

    function render() {
      const days = daysInJalaliMonth(viewY, viewM);
      let grid = "";
      for (let d = 1; d <= days; d++) {
        const isSel = existing.jy === viewY && existing.jm === viewM && existing.jd === d;
        grid += `<button type="button" class="jalali-day${isSel ? " sel" : ""}" data-d="${d}">${d}</button>`;
      }
      pop.innerHTML = `
        <div class="jalali-head">
          <button type="button" class="jalali-nav" data-nav="next">‹</button>
          <span class="jalali-title">${MONTH_NAMES[viewM - 1]} ${viewY}</span>
          <button type="button" class="jalali-nav" data-nav="prev">›</button>
        </div>
        <div class="jalali-grid">${grid}</div>
        <div class="jalali-foot">
          <button type="button" class="jalali-today">امروز</button>
          <button type="button" class="jalali-clear">پاک کردن</button>
        </div>
      `;
      pop.querySelector('[data-nav="prev"]').onclick = () => { viewM--; if (viewM < 1) { viewM = 12; viewY--; } render(); };
      pop.querySelector('[data-nav="next"]').onclick = () => { viewM++; if (viewM > 12) { viewM = 1; viewY++; } render(); };
      pop.querySelectorAll(".jalali-day").forEach(btn => {
        btn.onclick = () => {
          inputEl.value = formatJalali(viewY, viewM, Number(btn.dataset.d));
          inputEl.dispatchEvent(new Event("change", { bubbles: true }));
          closePopup();
        };
      });
      pop.querySelector(".jalali-today").onclick = () => {
        const t = todayJalali();
        inputEl.value = t.str;
        inputEl.dispatchEvent(new Event("change", { bubbles: true }));
        closePopup();
      };
      pop.querySelector(".jalali-clear").onclick = () => {
        inputEl.value = "";
        inputEl.dispatchEvent(new Event("change", { bubbles: true }));
        closePopup();
      };
    }
    render();

    document.body.appendChild(pop);
    const r = inputEl.getBoundingClientRect();
    pop.style.position = "absolute";
    pop.style.top = (window.scrollY + r.bottom + 4) + "px";
    pop.style.left = (window.scrollX + r.left) + "px";
    activePopup = pop;
    setTimeout(() => {
      document.addEventListener("mousedown", onOutsideClick, true);
      document.addEventListener("keydown", onKeydown, true);
    }, 0);
  }

  function attach(inputEl, opts) {
    if (!inputEl) return;
    inputEl.setAttribute("readonly", "readonly");
    inputEl.classList.add("jalali-input");
    if (!inputEl.value && opts && opts.defaultToday) inputEl.value = todayString();
    inputEl.addEventListener("click", () => buildPopup(inputEl));
    inputEl.addEventListener("focus", () => buildPopup(inputEl));
  }

  return { toJalali, toGregorian, todayJalali, todayString, formatJalali, parseJalaliString, attach, MONTH_NAMES };
})();
