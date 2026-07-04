import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  YEARS,
  popData,
  colorForRate,
  parseCSVLine,
  loadCSV,
  buildGradientBar,
  showInfoPopup,
} from "./common.js";

// ─── Constants ───────────────────────────────────────────────────
const SCALE = 2.5; // world units per degree
const CENTER_LNG = 135;
const CENTER_LAT = 34.5;
const HEIGHT_SCALE = 0.135; // units per ∛population

// ─── Build gradient legend ──────────────────────────────────────
buildGradientBar();

// ─── Project lat/lng → x/z ──────────────────────────────────────
function project(lng, lat) {
  return {
    x: (CENTER_LNG - lng) * SCALE,
    z: (CENTER_LAT - lat) * SCALE, // north → +z
  };
}

function heightForPop(pop) {
  // Cube-root scale: height ∝ ∛pop
  return Math.cbrt(Math.max(pop, 0)) * HEIGHT_SCALE;
}

// ─── Scene setup ─────────────────────────────────────────────────
const container = document.getElementById("canvas-container");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(
  40,
  container.clientWidth / container.clientHeight,
  0.5,
  1000,
);
camera.position.set(0, 80, -3.7);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 3, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 5;
controls.maxDistance = 200;
controls.maxPolarAngle = Math.PI / 2.1;
controls.update();

// ─── Lights ──────────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0x404060, 0.7);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x362d59, 0.6);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(40, 80, 30);
scene.add(dirLight);
const dirLight2 = new THREE.DirectionalLight(0x8888ff, 0.3);
dirLight2.position.set(-30, 20, -40);
scene.add(dirLight2);

// ─── Ground plane ────────────────────────────────────────────────
const gridHelper = new THREE.GridHelper(100, 20, 0x444466, 0x333355);
gridHelper.position.y = -0.05;
scene.add(gridHelper);

// ─── Compass arrow pointing north ────────────────────────────────
function createCompass() {
  const group = new THREE.Group();

  // Outer ring
  const ringGeo = new THREE.TorusGeometry(1.8, 0.08, 8, 32);
  const ringMat = new THREE.MeshLambertMaterial({
    color: 0x5566aa,
    emissive: 0x223366,
    emissiveIntensity: 0.15,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  // Inner disc (subtle)
  const discGeo = new THREE.CircleGeometry(1.7, 32);
  const discMat = new THREE.MeshLambertMaterial({
    color: 0x1a1a2e,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
  });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.01;
  group.add(disc);

  // North arrow (half red, half gray)
  // Shaft — north half (red)
  const shaftN = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.04, 1.2),
    new THREE.MeshLambertMaterial({ color: 0xff3333 }),
  );
  shaftN.position.set(0, 0.04, 0.8);
  group.add(shaftN);

  // Shaft — south half (gray)
  const shaftS = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.04, 1.2),
    new THREE.MeshLambertMaterial({ color: 0x667788 }),
  );
  shaftS.position.set(0, 0.04, -0.8);
  group.add(shaftS);

  // Arrow head (north tip, cone pointing +z)
  const headGeo = new THREE.ConeGeometry(0.35, 0.5, 8);
  const headMat = new THREE.MeshLambertMaterial({
    color: 0xff3333,
    emissive: 0x882222,
    emissiveIntensity: 0.2,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.rotation.x = Math.PI / 2;
  head.position.set(0, 0.04, 1.6);
  group.add(head);

  // Arrow tail (south end, small triangle)
  const tailGeo = new THREE.ConeGeometry(0.2, 0.3, 8);
  const tailMat = new THREE.MeshLambertMaterial({
    color: 0x667788,
  });
  const tail = new THREE.Mesh(tailGeo, tailMat);
  tail.rotation.x = -Math.PI / 2;
  tail.position.set(0, 0.04, -1.5);
  group.add(tail);

  // Center dot
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshLambertMaterial({ color: 0x8899cc }),
  );
  dot.position.y = 0.04;
  group.add(dot);

  // "N" label as a sprite
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = "#ff6666";
  ctx.font = "bold 42px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", 32, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const spriteMat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(1.4, 1.4, 1);
  sprite.position.set(0, 1.4, 2.2);
  group.add(sprite);

  return group;
}

const compass = createCompass();
compass.position.set(24, 0, 13);
scene.add(compass);

// ─── Municipality meshes ─────────────────────────────────────────
let allMeshes = []; // { mesh, code, entry }
let built = false;

function buildFromGeoJSON(geojsonFeatures) {
  // First pass: find max pop for each municipality for scaling
  const maxPopPerCode = {};
  for (const feat of geojsonFeatures) {
    const codeStr = feat.properties.N03_007;
    if (!codeStr) continue;
    const code = parseInt(codeStr);
    const entry = popData[code];
    if (!entry) continue;
    let maxPop = 0;
    for (const yr of YEARS) {
      const p = entry[yr];
      if (p && p > maxPop) maxPop = p;
    }
    if (maxPop > 0) maxPopPerCode[code] = maxPop;
  }

  const meshGroup = new THREE.Group();

  for (const feat of geojsonFeatures) {
    const codeStr = feat.properties.N03_007;
    if (!codeStr) continue;
    const code = parseInt(codeStr);
    const entry = popData[code];
    if (!entry) continue;

    const maxPop = maxPopPerCode[code] || 1;
    const maxHeight = heightForPop(maxPop);

    const geometries = buildGeometries(feat.geometry, maxHeight);
    if (geometries.length === 0) continue;

    // Material will be updated per-year; start with white
    const material = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      flatShading: false,
    });
    const meshes = [];
    for (const geo of geometries) {
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      meshGroup.add(mesh);
      meshes.push(mesh);
    }

    allMeshes.push({
      meshes,
      code,
      entry,
      maxHeight,
      material,
      name_en: entry._name_en,
      name_jp: entry._name_jp,
    });
  }

  scene.add(meshGroup);
  built = true;
  return meshGroup;
}

function buildGeometries(geometry, depth) {
  const result = [];
  const type = geometry.type;
  const coords = geometry.coordinates;

  if (type === "Polygon") {
    const g = buildExtrudeFromRings(coords, depth);
    if (g) result.push(g);
  } else if (type === "MultiPolygon") {
    for (const polyCoords of coords) {
      const g = buildExtrudeFromRings(polyCoords, depth);
      if (g) result.push(g);
    }
  }
  return result;
}

function buildExtrudeFromRings(rings, depth) {
  // rings[0] = outer ring, rings[1..] = holes
  if (!rings || rings.length === 0) return null;
  const outer = rings[0];
  if (outer.length < 3) return null;

  const shape = new THREE.Shape();
  for (let i = 0; i < outer.length; i++) {
    const p = project(outer[i][0], outer[i][1]);
    if (i === 0) shape.moveTo(p.x, p.z);
    else shape.lineTo(p.x, p.z);
  }

  // holes
  for (let h = 1; h < rings.length; h++) {
    const hole = rings[h];
    if (hole.length < 3) continue;
    const path = new THREE.Path();
    for (let i = 0; i < hole.length; i++) {
      const p = project(hole[i][0], hole[i][1]);
      if (i === 0) path.moveTo(p.x, p.z);
      else path.lineTo(p.x, p.z);
    }
    shape.holes.push(path);
  }

  try {
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(depth, 0.01),
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.04,
      bevelSegments: 2,
    });
    // ExtrudeGeometry extrudes along +Z; rotate so Z becomes Y
    geo.rotateX(-Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  } catch {
    return null;
  }
}

// ─── Update colors & heights for a given year ────────────────────
let currentYearIdx = 0;

function updateScene(yearIdx) {
  currentYearIdx = yearIdx;
  const yr = YEARS[yearIdx];
  document.getElementById("yearLabel").textContent = yr;

  for (const item of allMeshes) {
    const pop = item.entry[yr];
    const targetHeight = heightForPop(pop || 0);

    // Scale y to achieve target height
    const scaleY = item.maxHeight > 0.01 ? targetHeight / item.maxHeight : 0.01;

    // Color based on 5-year change
    let colorHex = 0x888899;
    if (yr > 1980) {
      const prevYr = yr - 5 >= 1980 ? yr - 5 : 1980;
      const prevPop = item.entry[prevYr];
      if (prevPop && prevPop > 0 && pop > 0) {
        const rate = (pop - prevPop) / prevPop;
        const clamped = Math.max(-0.1, Math.min(0.1, rate));
        const cssColor = colorForRate(clamped / 0.1);
        colorHex = new THREE.Color(cssColor).getHex();
      }
    }

    for (const mesh of item.meshes) {
      mesh.scale.y = scaleY;
      mesh.material.color.setHex(colorHex);
    }
  }

  // Update hovered info if visible
  if (hoveredCode !== null) {
    const found = allMeshes.find((item) => item.code === hoveredCode);
    if (found) showInfoPopupFor(found);
  }
}

// ─── Hover / Raycasting ──────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hoveredCode = null;

function getIntersectedMeshes() {
  const meshes = [];
  for (const item of allMeshes) {
    for (const m of item.meshes) meshes.push(m);
  }
  return meshes;
}

function onPointerMove(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const allM = getIntersectedMeshes();
  const intersects = raycaster.intersectObjects(allM, false);

  if (intersects.length > 0) {
    const hit = intersects[0].object;
    // Find which municipality this mesh belongs to
    for (const item of allMeshes) {
      if (item.meshes.includes(hit)) {
        hoveredCode = item.code;
        showInfoPopupFor(item);
        renderer.domElement.style.cursor = "pointer";
        return;
      }
    }
  }
  hoveredCode = null;
  document.getElementById("info").style.display = "none";
  renderer.domElement.style.cursor = "default";
}

function showInfoPopupFor(item) {
  const pop = item.entry[YEARS[currentYearIdx]];
  const cbrtPop = pop > 0 ? Math.cbrt(pop).toFixed(1) : "—";
  showInfoPopup(
    item.entry,
    YEARS[currentYearIdx],
    `<div class="height-label">∛pop = ${cbrtPop}</div>`,
  );
}

renderer.domElement.addEventListener("pointermove", onPointerMove);

// ─── Load data, build scene, animate ────────────────────────────
async function init() {
  document.getElementById("loading").style.display = "block";

  await loadCSV();

  // Load all 47 GeoJSON files with progress
  const loadCountEl = document.getElementById("loadCount");
  const progressFill = document.getElementById("progressFill");
  let loadedCount = 0;
  const allFeatures = [];
  const loadPromises = [];
  for (let i = 1; i <= 47; i++) {
    const p = ("0" + i).slice(-2);
    const promise = fetch(`simplify-japan-geojson/GeoJson/${p}.json`)
      .then((r) => r.json())
      .then((geo) => {
        if (geo && geo.features) {
          for (const feat of geo.features) {
            allFeatures.push(feat);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        loadedCount++;
        loadCountEl.textContent = loadedCount;
        progressFill.style.width = (loadedCount / 47) * 100 + "%";
      });
    loadPromises.push(promise);
  }
  await Promise.all(loadPromises);

  // Build 3D geometry
  buildFromGeoJSON(allFeatures);
  updateScene(0);

  document.getElementById("loading").style.display = "none";

  // ─── Slider events ───────────────────────────────────────────
  const slider = document.getElementById("yearSlider");
  slider.addEventListener("input", function () {
    updateScene(parseInt(this.value));
  });
  document.getElementById("prevBtn").addEventListener("click", function () {
    const v = parseInt(slider.value);
    if (v > 0) {
      slider.value = v - 1;
      updateScene(v - 1);
    }
  });
  document.getElementById("nextBtn").addEventListener("click", function () {
    const v = parseInt(slider.value);
    if (v < 70) {
      slider.value = v + 1;
      updateScene(v + 1);
    }
  });

  // ─── Play / Pause ────────────────────────────────────────────
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
      const v = parseInt(slider.value);
      if (v >= 70) {
        slider.value = 0;
        updateScene(0);
      }
      isPlaying = true;
      playBtn.textContent = "⏸ Pause";
      playTimer = setInterval(() => {
        const cur = parseInt(slider.value);
        if (cur >= 70) {
          togglePlay();
          return;
        }
        slider.value = cur + 1;
        updateScene(cur + 1);
      }, 500);
    }
  }

  playBtn.addEventListener("click", togglePlay);
  togglePlay();

  // ─── Resize ──────────────────────────────────────────────────
  window.addEventListener("resize", () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  // ─── Animation loop ──────────────────────────────────────────
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    const cam = camera.position;
    const dist = controls.target.distanceTo(cam);
    document.getElementById("camInfo").textContent =
      "x " +
      cam.x.toFixed(1) +
      "  y " +
      cam.y.toFixed(1) +
      "  z " +
      cam.z.toFixed(1) +
      "  d " +
      dist.toFixed(1);
    renderer.render(scene, camera);
  }
  animate();
}

init();
