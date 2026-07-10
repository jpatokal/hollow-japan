import {
  YEARS,
  popData,
  colorForRate,
  parseCSVLine,
  loadCSV,
  getChangeMode,
  setChangeMode,
  rebuildGradientBar,
  showInfoPopup,
  getLang,
  setLang,
} from "./common.js";

// ---------- Load GeoJSON ----------
let geoLayer = null;
let allFeatures = []; // {geojson, muniCode}
let geoLoaded = false;
let currentCode = null; // hovered municipality
let selectedCode = null; // set by ?id=XXXX, persists across hovers

async function loadAllGeoJSON(map) {
  const codes = [];
  for (let i = 1; i <= 47; i++) codes.push(i);
  const promises = codes.map((pref) => {
    const p = ("0" + pref).slice(-2);
    return fetch(`simplify-japan-geojson/GeoJson/${p}.json`)
      .then((r) => r.json())
      .catch(() => null);
  });
  const results = await Promise.all(promises);
  for (const geo of results) {
    if (!geo || !geo.features) continue;
    for (const feat of geo.features) {
      const codeStr = feat.properties.N03_007;
      if (!codeStr) continue;
      const muniCode = parseInt(codeStr);
      allFeatures.push({ fe: feat, code: muniCode, codeStr });
    }
  }
  const combined = {
    type: "FeatureCollection",
    features: allFeatures.map((f) => f.fe),
  };
  geoLayer = L.geoJSON(combined, {
    style: () => featureStyle(null),
    onEachFeature: (feat, layer) => {
      const codeStr = feat.properties.N03_007;
      const muniCode = parseInt(codeStr);
      layer.muniCode = muniCode;
      layer.on("mouseover", function () {
        showInfoPopup(popData[muniCode], 1980 + sliderIdx);
        currentCode = muniCode;
        applyHighlight();
      });
      layer.on("mouseout", function () {
        document.getElementById("info").style.display = "none";
        currentCode = null;
        applyHighlight();
      });
      layer.on("click", function (e) {
        showInfoPopup(popData[muniCode], 1980 + sliderIdx);
        currentCode = muniCode;
        applyHighlight();
        if (window.innerWidth >= 768) {
          map.fitBounds(layer.getBounds(), { padding: [50, 50] });
        }
        L.DomEvent.stopPropagation(e);
      });
    },
  }).addTo(map);
  // Dismiss popup on any map click (clicks pass through the popup via pointer-events:none)
  map.on("click", function () {
    document.getElementById("info").style.display = "none";
    currentCode = null;
    applyHighlight();
  });
  geoLoaded = true;
}

let sliderIdx = 0; // year offset from 1980, range 0–70

function calcColor(muniCode, yr) {
  if (yr <= 1980) return "#ffffff";
  const entry = popData[muniCode];
  if (!entry) return "#eeeeee";

  if (getChangeMode() === "since1980") {
    const pop80 = entry[1980];
    const popCur = entry[yr];
    if (pop80 == null || pop80 === 0 || popCur == null) return "#eeeeee";
    const rate = (popCur - pop80) / pop80;
    const clamped = Math.max(-0.9, Math.min(0.9, rate));
    const normalized = clamped >= 0 ? clamped / 0.9 : clamped / 0.9;
    return colorForRate(normalized, true);
  }

  const prevYr = yr - 5 >= 1980 ? yr - 5 : 1980;
  const popPrev = entry[prevYr];
  const popCur = entry[yr];
  if (popPrev == null || popPrev === 0 || popCur == null) return "#eeeeee";
  const rate = (popCur - popPrev) / popPrev;
  const clamped = Math.max(-0.1, Math.min(0.1, rate));
  return colorForRate(clamped / 0.1);
}

function featureStyle(muniCode) {
  const yr = 1980 + sliderIdx;
  return {
    fillColor: calcColor(muniCode, yr),
    color: "#666",
    weight: 0.5,
    fillOpacity: 0.85,
  };
}

function applyHighlight() {
  if (!geoLayer) return;
  const highlightCode = currentCode || selectedCode;
  geoLayer.eachLayer(function (layer) {
    if (layer.highlighted) {
      layer.setStyle({ weight: 0.5, color: "#666" });
      layer.highlighted = false;
    }
  });
  if (highlightCode) {
    geoLayer.eachLayer(function (layer) {
      if (layer.muniCode === highlightCode) {
        layer.setStyle({ weight: 3, color: "#1976d2" });
        layer.highlighted = true;
      }
    });
  }
}

function updateMap() {
  if (!geoLayer) return;
  const yr = 1980 + sliderIdx;
  document.getElementById("yearLabel").textContent = yr;

  geoLayer.eachLayer(function (layer) {
    layer.setStyle({
      fillColor: calcColor(layer.muniCode, yr),
      color: "#666",
      weight: 0.5,
      fillOpacity: 0.85,
    });
    layer.highlighted = false;
  });
  applyHighlight();
}

// ---------- Init map ----------
async function init() {
  const zoomLevel = window.innerWidth < 768 ? 5 : 6;
  const map = L.map("map", { zoomControl: false }).setView(
    [36, 137.5],
    zoomLevel,
  );
  L.control.zoom({ position: "topright" }).addTo(map);
  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      maxZoom: 10,
      minZoom: 5,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    },
  ).addTo(map);

  await Promise.all([loadCSV(), loadAllGeoJSON(map)]);

  // ─── ?id=XXXX — zoom to a specific municipality ────────────
  const params = new URLSearchParams(window.location.search);
  const targetId = parseInt(params.get("id"));
  const hasPreselectedId = targetId && !isNaN(targetId) && popData[targetId];
  if (hasPreselectedId) {
    selectedCode = targetId;
    sliderIdx = 70; // year 2050
    document.getElementById("yearSlider").value = 70;
    setChangeMode("since1980");
    // Find the Leaflet layer and zoom in
    geoLayer.eachLayer(function (layer) {
      if (layer.muniCode === targetId) {
        map.fitBounds(layer.getBounds(), { padding: [50, 50] });
      }
    });
  }

  // ─── Refresh map colours and legend when mode changes ──────
  function refreshMap() {
    rebuildGradientBar();
    const pctLabels = document.getElementById("pctLabels");
    if (getChangeMode() === "since1980") {
      pctLabels.innerHTML = "<span>−90%</span><span>0%</span><span>+90%</span>";
    } else {
      pctLabels.innerHTML = "<span>−10%</span><span>0%</span><span>+10%</span>";
    }
    updateMap();
    const popupCode = currentCode || selectedCode;
    if (popupCode) {
      const entry = popData[popupCode];
      if (entry) showInfoPopup(entry, 1980 + sliderIdx);
    }
  }

  // Build initial gradient / labels
  rebuildGradientBar();
  document.getElementById("pctLabels").innerHTML =
    getChangeMode() === "since1980"
      ? "<span>−90%</span><span>0%</span><span>+90%</span>"
      : "<span>−10%</span><span>0%</span><span>+10%</span>";
  if (hasPreselectedId) {
    updateMap();
    showInfoPopup(popData[selectedCode], 2050);
  }

  // Mode toggle click handlers
  document.getElementById("mode5yr").addEventListener("click", function () {
    if (getChangeMode() === "5year") return;
    setChangeMode("5year");
    rebuildGradientBar();
    document.getElementById("pctLabels").innerHTML =
      "<span>−10%</span><span>0%</span><span>+10%</span>";
    updateMap();
  });
  document
    .getElementById("modeSince1980")
    .addEventListener("click", function () {
      if (getChangeMode() === "since1980") return;
      setChangeMode("since1980");
      rebuildGradientBar();
      document.getElementById("pctLabels").innerHTML =
        "<span>−90%</span><span>0%</span><span>+90%</span>";
      updateMap();
    });

  // ─── Play / Pause ─────────────────────────────────
  let isPlaying = false;
  let playTimer = null;
  const playBtn = document.getElementById("playBtn");

  function togglePlay() {
    if (isPlaying) {
      clearInterval(playTimer);
      playTimer = null;
      isPlaying = false;
      playBtn.textContent = "▶";
    } else {
      if (sliderIdx >= 70) {
        sliderIdx = 0;
        slider.value = 0;
      }
      isPlaying = true;
      playBtn.textContent = "⏸";
      playTimer = setInterval(() => {
        sliderIdx++;
        slider.value = sliderIdx;
        updateMap();
        if (currentCode) {
          const entry = popData[currentCode];
          if (entry) showInfoPopup(entry, 1980 + sliderIdx);
        }
        if (sliderIdx >= 70) {
          togglePlay();
        }
      }, 500);
    }
  }

  playBtn.addEventListener("click", togglePlay);

  const slider = document.getElementById("yearSlider");
  slider.addEventListener("input", function () {
    if (isPlaying) togglePlay();
    sliderIdx = parseInt(this.value);
    updateMap();
    if (currentCode) {
      const entry = popData[currentCode];
      if (entry) showInfoPopup(entry, 1980 + sliderIdx);
    }
  });

  // ─── Language toggle ──────────────────────────────────────────
  document.getElementById("langToggle").addEventListener("click", function (e) {
    e.preventDefault();
    const newLang = getLang() === "en" ? "jp" : "en";
    setLang(newLang);
    // Refresh info popup if currently showing
    if (currentCode) {
      const entry = popData[currentCode];
      if (entry) showInfoPopup(entry, 1980 + sliderIdx);
    }
  });

  // Start autoplay immediately (unless a preselected ID zooms to 2050)
  if (!hasPreselectedId) {
    togglePlay();
  }
}

init();
