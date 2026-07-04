import {
  YEARS,
  popData,
  colorForRate,
  parseCSVLine,
  loadCSV,
  buildGradientBar,
  showInfoPopup,
} from "./common.js";

// ---------- Build gradient legend ----------
(function () {
  buildGradientBar();
  const bar = document.getElementById("gradientBar");
  const lbl = document.createElement("div");
  lbl.style.cssText =
    "display:flex;justify-content:space-between;font-size:11px;color:#555;margin-top:2px";
  lbl.innerHTML = "<span>&minus;10%</span><span>0%</span><span>+10%</span>";
  bar.parentNode.appendChild(lbl);
})();

// ---------- Load GeoJSON ----------
let geoLayer = null;
let allFeatures = []; // {geojson, muniCode}
let geoLoaded = false;
let currentCode = null; // hovered/previously selected

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
      });
      layer.on("mouseout", function () {
        document.getElementById("info").style.display = "none";
        currentCode = null;
      });
    },
  }).addTo(map);
  geoLoaded = true;
}

let sliderIdx = 0; // year offset from 1980, range 0–70

function calcColor(muniCode, yr) {
  if (yr <= 1980) return "#ffffff";
  const entry = popData[muniCode];
  if (!entry) return "#eeeeee";
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
  });
}

// ---------- Init map ----------
async function init() {
  const map = L.map("map").setView([37.5, 137.5], 6);
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
  updateMap();

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

  document.getElementById("prevBtn").addEventListener("click", function () {
    if (isPlaying) togglePlay();
    if (sliderIdx > 0) {
      sliderIdx--;
      slider.value = sliderIdx;
      updateMap();
    }
  });
  document.getElementById("nextBtn").addEventListener("click", function () {
    if (isPlaying) togglePlay();
    if (sliderIdx < 70) {
      sliderIdx++;
      slider.value = sliderIdx;
      updateMap();
    }
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
      playBtn.textContent = "▶ Play";
    } else {
      if (sliderIdx >= 70) {
        sliderIdx = 0;
        slider.value = 0;
      }
      isPlaying = true;
      playBtn.textContent = "⏸ Pause";
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
  // Start autoplay immediately
  togglePlay();
}

init();
