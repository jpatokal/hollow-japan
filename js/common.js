// ─── Shared constants ────────────────────────────────────────────
export const YEARS = Array.from({ length: 71 }, (_, i) => 1980 + i);

// ─── Change mode: "5year" or "since1980" ─────────────────────────
let _changeMode = "5year";
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
      const fadeStart = 1 / 9; // 0.111… — where −10% change maps to
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
  const resp = await fetch("built_pop_wide_en_jp_extended.csv");
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

  let change = "";
  if (yr > 1980) {
    const prevYr = yr - 5 >= 1980 ? yr - 5 : 1980;
    const prevPop = entry[prevYr];
    if (prevPop && prevPop > 0 && pop > 0) {
      const pct = (((pop - prevPop) / prevPop) * 100).toFixed(1);
      const sign = pct >= 0 ? "+" : "";
      change = `<br>Change since ${prevYr}: ${sign}${pct}%`;
    }
  }

  let since1980 = "";
  if (yr > 1980) {
    const pop80 = entry[1980];
    if (pop80 && pop80 > 0 && pop > 0) {
      const pct = (((pop - pop80) / pop80) * 100).toFixed(1);
      const sign = pct >= 0 ? "+" : "";
      since1980 = `<br>Change since 1980: ${sign}${pct}%`;
    }
  }

  const label =
    yr % 5 === 0 ? (yr > 2020 ? "(projected)" : "(census)") : "(est.)";

  el.innerHTML = `
        <div class="name">${entry._name_en}</div>
        <div class="jp">${entry._name_jp}</div>
        <div>Population ${yr}: <b>${pop.toLocaleString()}</b> ${label}${change}${since1980}</div>
        ${extraHtml}
    `;
  el.style.display = "block";
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
