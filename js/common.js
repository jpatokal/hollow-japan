// ─── Shared constants ────────────────────────────────────────────
export const YEARS = Array.from({ length: 71 }, (_, i) => 1980 + i);

// ─── Language ──────────────────────────────────────────────────────
let _lang = "en";
export function getLang() {
  return _lang;
}
export function setLang(lang) {
  _lang = lang;
  updateLabels();
}

const TRANSLATIONS = {
  jp: {
    mainTitle: "日本空洞化",
    mode5yr: "直近5年",
    modeSince1980: "1980年以降",
    langToggle: "English",
    popLabel: "%d年の人口",
    census: "(国勢調査)",
    projected: "(推計)",
    est: "(推計)",
    changeSince: "%d年からの変化",
    changeSince1980: "1980年からの変化",
    hintRotate: "<b>回転</b> 1本指 / 左ドラッグ",
    hintMove: "<b>移動</b> 2本指 / シフト",
    hintZoom: "<b>ズーム</b> ピンチ / スクロール",
  },
  en: {
    mainTitle: "Hollow Japan",
    mode5yr: "Last 5 years",
    modeSince1980: "Since 1980",
    langToggle: "日本語",
    popLabel: "Population in %d",
    census: "(census)",
    projected: "(projected)",
    est: "(est.)",
    changeSince: "Change since %d",
    changeSince1980: "Change since 1980",
    hintRotate: "<b>rotate</b> one finger / left mouse",
    hintMove: "<b>move</b> two fingers / shift",
    hintZoom: "<b>zoom</b> pinch / scroll",
  },
};

export function updateLabels() {
  const t = TRANSLATIONS[_lang];
  if (!t) return;
  const mainTitle = document.getElementById("mainTitle");
  if (mainTitle) mainTitle.textContent = t.mainTitle;
  const mode5yr = document.getElementById("mode5yr");
  const modeSince1980 = document.getElementById("modeSince1980");
  if (mode5yr) mode5yr.textContent = t.mode5yr;
  if (modeSince1980) modeSince1980.textContent = t.modeSince1980;
  const langToggle = document.getElementById("langToggle");
  if (langToggle) langToggle.textContent = t.langToggle;
  const hintRotate = document.getElementById("hintRotate");
  const hintMove = document.getElementById("hintMove");
  const hintZoom = document.getElementById("hintZoom");
  if (hintRotate) hintRotate.innerHTML = t.hintRotate;
  if (hintMove) hintMove.innerHTML = t.hintMove;
  if (hintZoom) hintZoom.innerHTML = t.hintZoom;
}

// ─── Change mode: "5year" or "since1980" ─────────────────────────
let _changeMode = "since1980";
export function getChangeMode() {
  return _changeMode;
}
export function setChangeMode(mode) {
  _changeMode = mode;
}
// Re-export as a live getter for convenience
export const changeMode = {
  get value() {
    return _changeMode;
  },
};

// ─── Shared population data (populated by loadCSV) ──────────────
export let popData = {}; // code → { 1980, 1981, …, 2050, _name_en, _name_jp }

// ─── Color logic ─────────────────────────────────────────────────
export function colorForRate(rate, fadeToBlack = false) {
  // rate in [-1, 1]  –  negative=red, positive=green, 0=white
  // fadeToBlack: negative rates beyond -10% (−0.111) fade from red to black
  const abs = Math.abs(rate);
  if (rate > 0) {
    if (fadeToBlack) {
      // Linear: white (rate=0) → max green rgb(0,180,0) (rate=1) — same as 5‑year
      const r = Math.round(255 - abs * 255);
      const g = Math.round(255 - abs * 75);
      const b = Math.round(255 - abs * 255);
      return `rgb(${r},${g},${b})`;
    }
    // green: (255,255,255) → (0,180,0)
    const r = Math.round(255 - abs * 255);
    const g = Math.round(255 - abs * 75);
    const b = Math.round(255 - abs * 255);
    return `rgb(${r},${g},${b})`;
  } else if (rate < 0) {
    if (fadeToBlack) {
      const fadeStart = 2 / 9; // 0.222… — where −20% change maps to
      if (abs <= fadeStart) {
        // White → Red (same as 5‑year mode)
        const t = abs / fadeStart;
        const r = Math.round(255 - t * 55);
        const g = Math.round(255 - t * 255);
        const b = Math.round(255 - t * 255);
        return `rgb(${r},${g},${b})`;
      } else {
        // Red → Black
        const t = (abs - fadeStart) / (1 - fadeStart);
        const r = Math.round(200 - t * 200);
        const g = 0;
        const b = 0;
        return `rgb(${r},${g},${b})`;
      }
    }
    // red: (255,255,255) → (200,0,0)
    const r = Math.round(255 - abs * 55);
    const g = Math.round(255 - abs * 255);
    const b = Math.round(255 - abs * 255);
    return `rgb(${r},${g},${b})`;
  }
  return "#ffffff";
}

// ─── CSV parsing (handles quoted fields) ─────────────────────────
export function parseCSVLine(line) {
  const result = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") {
        result.push(cur);
        cur = "";
      } else cur += ch;
    }
  }
  result.push(cur);
  return result;
}

// ─── Load CSV data ──────────────────────────────────────────────
export async function loadCSV() {
  const resp = await fetch("data/built_pop_wide_en_jp_extended.csv");
  const text = await resp.text();
  const lines = text.trim().split("\n");
  const headers = parseCSVLine(lines[0]);
  const yearCols = {};
  for (let i = 0; i < headers.length; i++) {
    const m = headers[i].match(/totalpop(\d{4})/);
    if (m) yearCols[parseInt(m[1])] = i;
  }
  for (let r = 1; r < lines.length; r++) {
    const vals = parseCSVLine(lines[r]);
    const code = parseInt(vals[0]);
    const entry = {};
    for (const yr of YEARS) {
      entry[yr] = parseFloat(vals[yearCols[yr]]);
    }
    entry._name_en = vals[1];
    entry._name_jp = vals[2];
    popData[code] = entry;
  }
}

// ─── Show info popup (shared by 2D and 3D) ──────────────────────
export function showInfoPopup(entry, yr, extraHtml = "") {
  const el = document.getElementById("info");
  const pop = entry[yr];
  if (pop == null) return;

  const t = TRANSLATIONS[_lang];

  let change = "";
  if (yr > 1980) {
    const prevYr = yr - 5 >= 1980 ? yr - 5 : 1980;
    const prevPop = entry[prevYr];
    if (prevPop && prevPop > 0 && pop > 0) {
      const pct = (((pop - prevPop) / prevPop) * 100).toFixed(1);
      const sign = pct >= 0 ? "+" : "";
      change = `<br>${t.changeSince.replace("%d", prevYr)}: ${sign}${pct}%`;
    }
  }

  let since1980 = "";
  if (yr > 1980) {
    const pop80 = entry[1980];
    if (pop80 && pop80 > 0 && pop > 0) {
      const pct = (((pop - pop80) / pop80) * 100).toFixed(1);
      const sign = pct >= 0 ? "+" : "";
      since1980 = `<br>${t.changeSince1980}: ${sign}${pct}%`;
    }
  }

  const label = yr % 5 === 0 ? (yr > 2020 ? t.projected : t.census) : t.est;

  const nameLabel = _lang === "jp" ? entry._name_jp : entry._name_en;
  const nameSub = _lang === "jp" ? "" : entry._name_jp;

  const popLabel = `${t.popLabel.replace("%d", yr)}:`;

  // ─── Build bar chart ──────────────────────────────────────
  const pop80 = entry[1980];
  const mode = getChangeMode();
  let maxPop = 0;
  for (const y of YEARS) {
    const p = entry[y];
    if (p && p > maxPop) maxPop = p;
  }
  let bars = "";
  for (const y of YEARS) {
    const p = entry[y];
    if (p == null) continue;
    const h = maxPop > 0 ? (p / maxPop) * 100 : 0;
    let color = "#ffffff";
    if (y > 1980 && pop80 && pop80 > 0 && p > 0) {
      if (mode === "since1980") {
        const rate = (p - pop80) / pop80;
        const clamped = Math.max(-0.9, Math.min(0.9, rate));
        const normalized = clamped >= 0 ? clamped / 0.9 : clamped / 0.9;
        color = colorForRate(normalized, true);
      } else {
        const prevYr = y - 5 >= 1980 ? y - 5 : 1980;
        const prevPop = entry[prevYr];
        if (prevPop && prevPop > 0) {
          const rate = (p - prevPop) / prevPop;
          const clamped = Math.max(-0.1, Math.min(0.1, rate));
          color = colorForRate(clamped / 0.1);
        }
      }
    }
    if (y === yr) color = "#1976d2";
    bars += `<span style="flex:1;min-width:1px;height:${h}px;background:${color}"></span>`;
  }

  el.innerHTML = `
        <div class="name">${nameLabel}</div>
        ${nameSub ? `<div class="jp">${nameSub}</div>` : ""}
        <div class="pop-chart"><div class="chart-bars"><div class="chart-bars-inner">${bars}</div></div><div class="chart-labels"><span class="chart-label">1980</span><span class="chart-label">2050</span></div></div>
        <div>${popLabel} <b>${pop.toLocaleString()}</b> ${label}${change}${since1980}</div>
        ${extraHtml}
    `;
  el.style.display = "block";
  if (window.innerWidth < 768) {
    document.querySelector(".legend")?.classList.add("legend-compact");
  }
}

export function hidePopup() {
  const el = document.getElementById("info");
  if (el) {
    el.style.display = "none";
    document.querySelector(".legend")?.classList.remove("legend-compact");
  }
}

// ─── Rebuild gradient legend bar ─────────────────────────────────
export function rebuildGradientBar() {
  const bar = document.getElementById("gradientBar");
  bar.innerHTML = "";
  const steps = 20;
  const fadeToBlack = getChangeMode() === "since1980";
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1); // 0 → 1
    const rate = (t - 0.5) * 2; // -1 → 1
    const span = document.createElement("span");
    span.style.backgroundColor = colorForRate(rate, fadeToBlack);
    bar.appendChild(span);
  }
  // Update toggle button active states
  document
    .getElementById("mode5yr")
    ?.classList.toggle("active", getChangeMode() === "5year");
  document
    .getElementById("modeSince1980")
    ?.classList.toggle("active", getChangeMode() === "since1980");
}
