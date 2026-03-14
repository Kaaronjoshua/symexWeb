import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const canvas = document.getElementById("bg");
const panels = document.querySelectorAll(".vision-panel");

// =========================
// Scene / Camera / Renderer
// =========================
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x020507, 12, 52);
const bgStartColor = new THREE.Color(0x020507);   // original dark
const bgExplodeColor = new THREE.Color(0x0b2d5e); // turquoise

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.set(0, 15.5, 0.001);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// =========================
// Lights
// =========================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.92);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.15);
dirLight.position.set(6, 12, 7);
scene.add(dirLight);

const cyanLight = new THREE.PointLight(0x48ffd9, 1.2, 40);
cyanLight.position.set(0, 5, 3);
scene.add(cyanLight);

const goldLight = new THREE.PointLight(0xffcc66, 0.9, 28);
goldLight.position.set(0, 2, 0);
scene.add(goldLight);

const platingKeyLight = new THREE.DirectionalLight(0xffd27a, 0.7);
platingKeyLight.position.set(3, 8, 4);
scene.add(platingKeyLight);

// =========================
// Root groups
// =========================
const boardGroup = new THREE.Group();
scene.add(boardGroup);

// exploded PCB layers
const pcbLayers = {
  topComponents: new THREE.Group(),
  topCopper: new THREE.Group(),
  dielectric: new THREE.Group(),
  bottomCopper: new THREE.Group(),
  baseBoard: new THREE.Group(),
};

boardGroup.add(pcbLayers.baseBoard);
boardGroup.add(pcbLayers.bottomCopper);
boardGroup.add(pcbLayers.dielectric);
boardGroup.add(pcbLayers.topCopper);
boardGroup.add(pcbLayers.topComponents);

// plated macro view
const platedViewGroup = new THREE.Group();
boardGroup.add(platedViewGroup);
platedViewGroup.visible = true;

// blueprint board reveal
const blueprintGroup = new THREE.Group();
boardGroup.add(blueprintGroup);
blueprintGroup.visible = true;

const blueprintObjects = [];

const machine = {
  core: {},
  input: {},
  output: {},
  control: {},
  support: {},
};

const modules = {};
const machineTraces = {
  inputToCore: [],
  controlToCore: [],
  supportToCore: [],
  coreToOutput: [],
};

const signalGroups = {
  input: [],
  control: [],
  support: [],
  output: [],
};

const allTraceObjects = [];
const allSignals = [];
const decorativeMats = [];
const emissiveMaterials = [];
const explodedLayerSheets = [];
const explodedLayerOutlines = [];
// =========================
// Helpers
// =========================
function smoothStage(value, start, end) {
  return THREE.MathUtils.smoothstep(value, start, end);
}

function createStdMaterial(color, metalness = 0.7, roughness = 0.35, emissive = null) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    emissive: emissive ?? 0x000000,
    emissiveIntensity: emissive ? 0.2 : 0,
    transparent: true,
    opacity: 1,
  });

  if (emissive) emissiveMaterials.push(mat);
  return mat;
}

function createChip(w, h, d, color = 0x181818, y = 0.0) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    createStdMaterial(color, 0.78, 0.38)
  );
  mesh.position.y = y;
  pcbLayers.topComponents.add(mesh);
  return mesh;
}

function createGlowPlane(w, h, color = 0xffc857, opacity = 0.14) {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.rotation.x = -Math.PI / 2;
  decorativeMats.push(mat);
  pcbLayers.topCopper.add(mesh);
  return mesh;
}

function createFlatLine(w, h, x, z, color = 0x2ce1af, opacity = 0.08, rot = 0) {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = rot;
  mesh.position.set(x, -0.304, z);
  decorativeMats.push(mat);
  pcbLayers.topCopper.add(mesh);
  return mesh;
}

function addVia(x, z, r = 0.05) {
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, 0.015, 18),
    createStdMaterial(0xc9a658, 1.0, 0.22)
  );
  ring.position.set(x, -0.295, z);
  pcbLayers.topCopper.add(ring);

  const hole = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.45, r * 0.45, 0.016, 14),
    new THREE.MeshBasicMaterial({ color: 0x18372e, transparent: true, opacity: 1 })
  );
  hole.position.set(x, -0.292, z);
  pcbLayers.topCopper.add(hole);
}

function addSMD(x, z, w = 0.22, h = 0.07, d = 0.16, color = 0x5e6872, rot = 0) {
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    createStdMaterial(color, 0.55, 0.42)
  );
  body.position.set(x, -0.11, z);
  body.rotation.y = rot;
  pcbLayers.topComponents.add(body);

  const endCap1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, h * 0.85, d * 0.92),
    createStdMaterial(0xd7c088, 1.0, 0.2)
  );
  endCap1.position.set(x - w / 2 + 0.02, -0.11, z);
  endCap1.rotation.y = rot;
  pcbLayers.topComponents.add(endCap1);

  const endCap2 = endCap1.clone();
  endCap2.position.set(x + w / 2 - 0.02, -0.11, z);
  pcbLayers.topComponents.add(endCap2);
}

function addCapacitor(x, z) {
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.35, 18),
    createStdMaterial(0x20262b, 0.6, 0.35)
  );
  body.position.set(x, -0.06, z);
  pcbLayers.topComponents.add(body);

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.03, 18),
    createStdMaterial(0xbcc6cc, 0.95, 0.15)
  );
  top.position.set(x, 0.12, z);
  pcbLayers.topComponents.add(top);
}

function addResistor(x, z, rotY = 0) {
  const resistor = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.12, 0.18),
    createStdMaterial(0xb8a16a, 0.45, 0.5)
  );
  resistor.position.set(x, -0.12, z);
  resistor.rotation.y = rotY;
  pcbLayers.topComponents.add(resistor);
}

function addConnectorStrip(x, z, count = 8, horizontal = true) {
  const group = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(
      horizontal ? count * 0.18 : 0.18,
      0.16,
      horizontal ? 0.22 : count * 0.18
    ),
    createStdMaterial(0x171717, 0.6, 0.5)
  );
  base.position.set(x, -0.10, z);
  group.add(base);

  for (let i = 0; i < count; i++) {
    const pin = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.08, 0.08),
      createStdMaterial(0xd7b968, 1.0, 0.2)
    );
    const offset = (i - (count - 1) / 2) * 0.18;
    pin.position.set(
      horizontal ? x + offset : x,
      -0.02,
      horizontal ? z : z + offset
    );
    group.add(pin);
  }

  pcbLayers.topComponents.add(group);
  return group;
}

function createTrace(points, groupName = null, color = 0xd9b45b, radius = 0.035) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, 64, radius, 10, false);
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.14,
    metalness: 0.92,
    roughness: 0.28,
    transparent: true,
    opacity: 1,
  });

  const mesh = new THREE.Mesh(geometry, material);
  pcbLayers.topCopper.add(mesh);

  const obj = { mesh, curve, groupName };
  allTraceObjects.push(obj);

  if (groupName && machineTraces[groupName]) {
    machineTraces[groupName].push(obj);
  }

  return obj;
}

function addSignalDot(traceObj, signalGroupName = "input", speed = 0.08, offset = 0) {
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 14, 14),
    new THREE.MeshBasicMaterial({
      color: 0x7affea,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    })
  );

  const aura = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 14, 14),
    new THREE.MeshBasicMaterial({
      color: 0x7affea,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    })
  );

  pcbLayers.topCopper.add(dot);
  pcbLayers.topCopper.add(aura);

  const signal = {
    dot,
    aura,
    curve: traceObj.curve,
    speed,
    offset,
    groupName: signalGroupName,
  };

  allSignals.push(signal);

  if (signalGroups[signalGroupName]) {
    signalGroups[signalGroupName].push(signal);
  }

  return signal;
}

// =========================
// Blueprint Helpers
// =========================
function makeBlueprintMat({
  color = 0x7fe9ff,
  opacity = 0.45,
  emissive = 0x2fdfff,
  emissiveIntensity = 0.35,
} = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.15,
    roughness: 0.35,
    transparent: true,
    opacity,
    emissive,
    emissiveIntensity,
    side: THREE.DoubleSide,
  });

  emissiveMaterials.push(mat);
  return mat;
}

function addBlueprintLineBox(w, h, d, x, y, z, rotY = 0) {
  const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
  const mat = new THREE.LineBasicMaterial({
    color: 0x8befff,
    transparent: true,
    opacity: 0.0,
  });

  const line = new THREE.LineSegments(geo, mat);
  line.position.set(x, y, z);
  line.rotation.y = rotY;
  blueprintGroup.add(line);
  blueprintObjects.push(line);
  return line;
}

function addBlueprintPlane(w, h, x, y, z, rotX = -Math.PI / 2) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    makeBlueprintMat({
      color: 0x62dfff,
      opacity: 0.0,
      emissive: 0x35dfff,
      emissiveIntensity: 0.25,
    })
  );
  mesh.position.set(x, y, z);
  mesh.rotation.x = rotX;
  blueprintGroup.add(mesh);
  blueprintObjects.push(mesh);
  return mesh;
}

function addBlueprintTrace(points) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, 48, 0.018, 8, false);
  const material = new THREE.MeshStandardMaterial({
    color: 0x7be7ff,
    emissive: 0x39dfff,
    emissiveIntensity: 0.25,
    metalness: 0.15,
    roughness: 0.4,
    transparent: true,
    opacity: 0.0,
  });

  const mesh = new THREE.Mesh(geometry, material);
  blueprintGroup.add(mesh);
  blueprintObjects.push(mesh);
  return mesh;
}

// =========================
// Plated Macro View Helpers
// =========================
const platedBaseMat = new THREE.MeshStandardMaterial({
  color: 0x050505,
  metalness: 0.35,
  roughness: 0.55,
  transparent: true,
  opacity: 0,
});

const platedBase = new THREE.Mesh(
  new THREE.PlaneGeometry(11.8, 11.8),
  platedBaseMat
);
platedBase.rotation.x = -Math.PI / 2;
platedBase.position.set(0, -0.285, 0);
platedViewGroup.add(platedBase);

const trenchMat = new THREE.MeshStandardMaterial({
  color: 0x111111,
  metalness: 0.15,
  roughness: 0.85,
  transparent: true,
  opacity: 0,
});

const trench = new THREE.Mesh(
  new THREE.BoxGeometry(0.55, 0.03, 10.2),
  trenchMat
);
trench.position.set(0.15, -0.265, 0.2);
platedViewGroup.add(trench);

function createGoldPadTile(x, z, w = 0.55, h = 0.9) {
  const group = new THREE.Group();

  const padMat = new THREE.MeshStandardMaterial({
    color: 0xd9b45b,
    metalness: 1.0,
    roughness: 0.18,
    emissive: 0x6a4b12,
    emissiveIntensity: 0.08,
    transparent: true,
    opacity: 0,
  });

  const lineMat = new THREE.MeshStandardMaterial({
    color: 0xf3cf72,
    metalness: 1.0,
    roughness: 0.12,
    emissive: 0xa06d18,
    emissiveIntensity: 0.06,
    transparent: true,
    opacity: 0,
  });

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.015, h),
    padMat
  );
  base.position.set(x, -0.276, z);
  group.add(base);

  const lines = 7;
  for (let i = 0; i < lines; i++) {
    const yy = z - h / 2 + (i + 0.5) * (h / lines);
    const micro = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.72, 0.008, 0.028),
      lineMat
    );
    micro.position.set(x, -0.266, yy);
    group.add(micro);
  }

  platedViewGroup.add(group);
  return group;
}

function addGoldBar(x, z, w, h) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xe0bb63,
    metalness: 1.0,
    roughness: 0.16,
    emissive: 0x7f5814,
    emissiveIntensity: 0.05,
    transparent: true,
    opacity: 0,
  });

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.014, h),
    mat
  );
  mesh.position.set(x, -0.274, z);
  platedViewGroup.add(mesh);
  return mesh;
}

const platedTiles = [];
for (let row = 0; row < 2; row++) {
  for (let col = -7; col <= 7; col++) {
    if (col === 0) continue;

    const x = col * 0.72 + (col > 0 ? 0.35 : -0.15);
    const z = row === 0 ? -1.7 : 1.7;

    platedTiles.push(createGoldPadTile(x, z, 0.58, 2.4));
  }
}

const platedBars = [
  addGoldBar(-4.8, 0, 0.45, 5.6),
  addGoldBar(4.8, 0, 0.45, 5.6),
  addGoldBar(0.0, -3.2, 10.2, 0.35),
  addGoldBar(0.0, 3.2, 10.2, 0.35),
];

// =========================
// Exploded layer sheets
// =========================
function createExplodedLayerSheets() {
  const topCopperSheet = new THREE.Mesh(
    new THREE.BoxGeometry(13.7, 0.03, 13.7),
    new THREE.MeshStandardMaterial({
      color: 0x76efff,
      emissive: 0x33dfff,
      emissiveIntensity: 0.18,
      metalness: 0.2,
      roughness: 0.35,
      transparent: true,
      opacity: 0.0,
    })
  );

  topCopperSheet.position.set(0, -0.305, 0);
  pcbLayers.topCopper.add(topCopperSheet);
  explodedLayerSheets.push(topCopperSheet);

  const dielectricSheet = new THREE.Mesh(
    new THREE.BoxGeometry(13.6, 0.12, 13.6),
    new THREE.MeshStandardMaterial({
      color: 0x123b5f,
      emissive: 0x1a9fff,
      emissiveIntensity: 0.08,
      metalness: 0.05,
      roughness: 0.6,
      transparent: true,
      opacity: 0.0,
    })
  );
  dielectricSheet.position.set(0, -0.43, 0);
  pcbLayers.dielectric.add(dielectricSheet);
  explodedLayerSheets.push(dielectricSheet);

  const bottomCopperSheet = new THREE.Mesh(
    new THREE.BoxGeometry(13.7, 0.03, 13.7),
    new THREE.MeshStandardMaterial({
      color: 0x63ddff,
      emissive: 0x2ad7ff,
      emissiveIntensity: 0.14,
      metalness: 0.15,
      roughness: 0.4,
      transparent: true,
      opacity: 0.0,
    })
  );
  bottomCopperSheet.position.set(0, -0.55, 0);
  pcbLayers.bottomCopper.add(bottomCopperSheet);
  explodedLayerSheets.push(bottomCopperSheet);
}
function addGoldLayerOutlines() {

  explodedLayerSheets.forEach((sheet) => {

    const edges = new THREE.EdgesGeometry(sheet.geometry,34);

    const goldMat = new THREE.LineBasicMaterial({
      color: 0xffd46b,
      transparent: true,
      opacity: 0,
    });

    const outline = new THREE.LineSegments(edges, goldMat);

    outline.position.copy(sheet.position);
    outline.rotation.copy(sheet.rotation);

    sheet.parent.add(outline);

    sheet.userData.outline = outline;
  });

}



// =========================
// Board Base
// =========================
function createBoardBase() {
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(14, 0.25, 14),
    createStdMaterial(0x0b5d46, 0.28, 0.78)
  );
  board.position.y = -0.45;
  pcbLayers.baseBoard.add(board);

  const boardTop = new THREE.Mesh(
    new THREE.PlaneGeometry(13.8, 13.8),
    createStdMaterial(0x0e6b52, 0.15, 0.9)
  );
  boardTop.rotation.x = -Math.PI / 2;
  boardTop.position.y = -0.31;
  pcbLayers.baseBoard.add(boardTop);

  for (let i = -6; i <= 6; i++) {
    createFlatLine(0.012, 13.2, i, 0, 0x7df5d2, 0.05);
  }
  for (let i = -6; i <= 6; i++) {
    createFlatLine(13.2, 0.012, 0, i, 0x7df5d2, 0.05);
  }

  createFlatLine(10.8, 0.03, 0, 4.8, 0x28c89d, 0.09);
  createFlatLine(10.8, 0.03, 0, -4.8, 0x28c89d, 0.09);
  createFlatLine(0.03, 10.8, 4.8, 0, 0x28c89d, 0.09);
  createFlatLine(0.03, 10.8, -4.8, 0, 0x28c89d, 0.09);

  createFlatLine(6.4, 0.025, 0, 0, 0x2ce1af, 0.10, Math.PI / 4);
  createFlatLine(6.4, 0.025, 0, 0, 0x2ce1af, 0.10, -Math.PI / 4);

  createFlatLine(5.0, 0.04, 0, 5.2, 0x1e8b6c, 0.28);
  createFlatLine(4.5, 0.04, -4.2, 0.8, 0x1e8b6c, 0.28, Math.PI / 2);
  createFlatLine(3.5, 0.04, 4.4, -2.4, 0x1e8b6c, 0.28, Math.PI / 2);
  createFlatLine(5.2, 0.04, -1.8, -5.0, 0x1e8b6c, 0.28, Math.PI / 8);
  createFlatLine(2.6, 0.04, 4.8, 4.5, 0x1e8b6c, 0.28, -Math.PI / 4);

  addConnectorStrip(-4.8, -5.5, 10, true);
  addConnectorStrip(4.6, 5.4, 8, true);
  addConnectorStrip(-5.45, 2.8, 7, false);
  addConnectorStrip(5.45, -2.8, 7, false);

  for (let x = -5.5; x <= 5.5; x += 1.1) {
    addVia(x, -5.8, 0.045);
    addVia(x, 5.8, 0.045);
  }
  for (let z = -4.8; z <= 4.8; z += 1.2) {
    addVia(-5.9, z, 0.045);
    addVia(5.9, z, 0.045);
  }

  [
    [-2.8, 3.6], [-1.9, 3.0], [2.4, 3.4], [3.6, 3.9],
    [-3.4, -3.8], [-2.5, -4.1], [2.8, -3.5], [3.9, -4.0],
    [-4.7, 0.0], [4.7, 0.0], [0, -5.0], [0.6, -5.1], [-0.7, 5.0]
  ].forEach(([x, z]) => addVia(x, z, 0.05));

  [
    [-5.2, -5.0], [-4.8, -5.0], [-4.4, -5.0], [-4.0, -5.0],
    [4.0, -4.8], [4.4, -4.8], [4.8, -4.8], [5.2, -4.8],
    [-5.4, 4.6], [-5.0, 4.6], [-4.6, 4.6], [-4.2, 4.6],
    [4.1, 4.9], [4.5, 4.9], [4.9, 4.9], [5.3, 4.9],
    [-2.0, 5.3], [-1.5, 5.3], [-1.0, 5.3], [-0.5, 5.3],
    [0.7, 5.2], [1.2, 5.2], [1.7, 5.2], [2.2, 5.2],
    [-5.6, 0.6], [-5.6, 1.0], [-5.6, 1.4], [-5.6, 1.8],
    [5.6, -0.4], [5.6, 0.0], [5.6, 0.4], [5.6, 0.8]
  ].forEach(([x, z], i) => {
    addSMD(
      x,
      z,
      i % 3 === 0 ? 0.28 : 0.20,
      0.07,
      i % 2 === 0 ? 0.14 : 0.18,
      i % 4 === 0 ? 0x6d757f : 0x4f5962,
      i % 5 === 0 ? Math.PI / 2 : 0
    );
  });

  addCapacitor(-1.8, -3.4);
  addCapacitor(2.2, 3.5);
  addCapacitor(4.3, -0.4);
  addCapacitor(-4.4, 1.2);

  addResistor(-2.4, -1.1, Math.PI / 6);
  addResistor(2.7, 1.6, -Math.PI / 8);
  addResistor(1.9, -3.2, Math.PI / 2);
  addResistor(-3.9, 3.0, Math.PI / 4);
}

// =========================
// Machine Modules
// =========================
const glow = createGlowPlane(4.2, 4.2, 0xffc857, 0.10);
glow.position.y = -0.295;

function createMachineModules() {
  machine.core.main = createChip(2.6, 0.7, 2.6, 0x111111, 0.15);
  machine.core.top = createChip(1.8, 0.08, 1.8, 0x1f1f1f, 0.54);

  const pinGeometry = new THREE.BoxGeometry(0.08, 0.08, 0.32);
  const pinMaterial = createStdMaterial(0xd4b15c, 1.0, 0.2);

  for (let i = -10; i <= 10; i++) {
    if (i === 0) continue;

    const pinTop = new THREE.Mesh(pinGeometry, pinMaterial);
    pinTop.position.set(i * 0.11, -0.02, -1.5);
    pcbLayers.topComponents.add(pinTop);

    const pinBottom = new THREE.Mesh(pinGeometry, pinMaterial);
    pinBottom.position.set(i * 0.11, -0.02, 1.5);
    pcbLayers.topComponents.add(pinBottom);

    const pinLeft = new THREE.Mesh(pinGeometry, pinMaterial);
    pinLeft.rotation.y = Math.PI / 2;
    pinLeft.position.set(-1.5, -0.02, i * 0.11);
    pcbLayers.topComponents.add(pinLeft);

    const pinRight = new THREE.Mesh(pinGeometry, pinMaterial);
    pinRight.rotation.y = Math.PI / 2;
    pinRight.position.set(1.5, -0.02, i * 0.11);
    pcbLayers.topComponents.add(pinRight);
  }

  machine.input.chip1 = createChip(1.2, 0.35, 1.2, 0x181818, 0.00);
  machine.input.chip2 = createChip(1.2, 0.35, 1.2, 0x181818, 0.00);

  machine.output.chip1 = createChip(1.2, 0.35, 1.2, 0x181818, 0.00);
  machine.output.chip2 = createChip(1.2, 0.35, 1.2, 0x181818, 0.00);

  machine.control.chip1 = createChip(0.95, 0.28, 0.95, 0x1a1a1a, 0.00);
  machine.control.chip2 = createChip(0.95, 0.28, 0.95, 0x1a1a1a, 0.00);
  machine.control.chip3 = createChip(0.95, 0.28, 0.95, 0x1a1a1a, 0.00);

  machine.support.chip1 = createChip(0.95, 0.28, 0.95, 0x1a1a1a, 0.00);
  machine.support.chip2 = createChip(0.95, 0.28, 0.95, 0x1a1a1a, 0.00);
  machine.support.chip3 = createChip(0.95, 0.28, 0.95, 0x1a1a1a, 0.00);

  modules.coreMain = machine.core.main;
  modules.coreTop = machine.core.top;
  modules.input1 = machine.input.chip1;
  modules.input2 = machine.input.chip2;
  modules.output1 = machine.output.chip1;
  modules.output2 = machine.output.chip2;
  modules.control1 = machine.control.chip1;
  modules.control2 = machine.control.chip2;
  modules.control3 = machine.control.chip3;
  modules.support1 = machine.support.chip1;
  modules.support2 = machine.support.chip2;
  modules.support3 = machine.support.chip3;

  [
    machine.input.chip1, machine.input.chip2,
    machine.output.chip1, machine.output.chip2,
    machine.control.chip1, machine.control.chip2, machine.control.chip3,
    machine.support.chip1, machine.support.chip2, machine.support.chip3
  ].forEach((mesh) => {
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.05, 0.55),
      createStdMaterial(0x232323, 0.3, 0.5)
    );
    cap.position.y = 0.18;
    mesh.add(cap);
  });
}

// =========================
// Positions
// =========================
const startPositions = {
  coreMain: new THREE.Vector3(0.0, 0.15, 0.0),
  coreTop: new THREE.Vector3(0.0, 0.54, 0.0),

  input1: new THREE.Vector3(-3.2, 0.00, -2.6),
  input2: new THREE.Vector3(-3.6, 0.00, 2.4),

  output1: new THREE.Vector3(3.1, 0.00, -2.2),
  output2: new THREE.Vector3(3.3, 0.00, 2.8),

  control1: new THREE.Vector3(-1.8, 0.00, -4.8),
  control2: new THREE.Vector3(0.0, 0.00, -4.2),
  control3: new THREE.Vector3(1.8, 0.00, -4.8),

  support1: new THREE.Vector3(-1.8, 0.00, 4.2),
  support2: new THREE.Vector3(0.0, 0.00, 4.8),
  support3: new THREE.Vector3(1.8, 0.00, 4.2),
};

const orbitPositions = {
  coreMain: new THREE.Vector3(0.0, 0.15, 0.0),
  coreTop: new THREE.Vector3(0.0, 0.56, 0.0),

  input1: new THREE.Vector3(-3.9, 0.03, -1.6),
  input2: new THREE.Vector3(-3.9, 0.03, 1.6),

  output1: new THREE.Vector3(3.9, 0.03, -1.6),
  output2: new THREE.Vector3(3.9, 0.03, 1.6),

  control1: new THREE.Vector3(-1.8, 0.03, -3.8),
  control2: new THREE.Vector3(0.0, 0.03, -4.2),
  control3: new THREE.Vector3(1.8, 0.03, -3.8),

  support1: new THREE.Vector3(-1.8, 0.03, 3.8),
  support2: new THREE.Vector3(0.0, 0.03, 4.2),
  support3: new THREE.Vector3(1.8, 0.03, 3.8),
};

const machinePositions = {
  coreMain: new THREE.Vector3(0.0, 0.15, 0.0),
  coreTop: new THREE.Vector3(0.0, 0.60, 0.0),

  input1: new THREE.Vector3(-4.2, 0.05, -0.8),
  input2: new THREE.Vector3(-4.2, 0.05, 0.9),

  output1: new THREE.Vector3(4.2, 0.05, -0.8),
  output2: new THREE.Vector3(4.2, 0.05, 0.9),

  control1: new THREE.Vector3(-1.8, 0.03, -4.0),
  control2: new THREE.Vector3(0.0, 0.03, -4.6),
  control3: new THREE.Vector3(1.8, 0.03, -4.0),

  support1: new THREE.Vector3(-1.8, 0.03, 4.0),
  support2: new THREE.Vector3(0.0, 0.03, 4.6),
  support3: new THREE.Vector3(1.8, 0.03, 4.0),
};

const startRotY = {
  coreMain: 0,
  coreTop: 0,
  input1: 0.08,
  input2: -0.05,
  output1: -0.06,
  output2: 0.07,
  control1: -0.15,
  control2: 0.10,
  control3: 0.14,
  support1: 0.14,
  support2: -0.08,
  support3: -0.12,
};

function assignModuleStates() {
  Object.entries(modules).forEach(([key, mesh]) => {
    mesh.userData.startPos = startPositions[key].clone();
    mesh.userData.orbitPos = orbitPositions[key].clone();
    mesh.userData.machinePos = machinePositions[key].clone();
    mesh.userData.startRotY = startRotY[key] ?? 0;
    mesh.userData.machineRotY = 0;

    mesh.position.copy(startPositions[key]);
    mesh.rotation.y = mesh.userData.startRotY;

    if (mesh.material) {
      mesh.material.transparent = true;
      mesh.material.opacity = 1;
    }
  });
}

// =========================
// Traces & Signals
// =========================
function createTracesAndSignals() {
  const t1 = createTrace([
    new THREE.Vector3(-5.7, -0.25, -0.8),
    new THREE.Vector3(-4.8, -0.25, -0.8),
    new THREE.Vector3(-4.2, -0.25, -0.8),
    new THREE.Vector3(-2.0, -0.25, -0.3),
    new THREE.Vector3(0.0, -0.25, 0.0),
  ], "inputToCore");

  const t2 = createTrace([
    new THREE.Vector3(-5.7, -0.25, 0.9),
    new THREE.Vector3(-4.8, -0.25, 0.9),
    new THREE.Vector3(-4.2, -0.25, 0.9),
    new THREE.Vector3(-2.0, -0.25, 0.4),
    new THREE.Vector3(0.0, -0.25, 0.0),
  ], "inputToCore");

  const t3 = createTrace([
    new THREE.Vector3(-1.8, -0.25, -4.0),
    new THREE.Vector3(-1.4, -0.25, -2.5),
    new THREE.Vector3(-0.8, -0.25, -1.2),
    new THREE.Vector3(0.0, -0.25, 0.0),
  ], "controlToCore");

  const t4 = createTrace([
    new THREE.Vector3(0.0, -0.25, -4.6),
    new THREE.Vector3(0.0, -0.25, -2.7),
    new THREE.Vector3(0.0, -0.25, -1.0),
    new THREE.Vector3(0.0, -0.25, 0.0),
  ], "controlToCore");

  const t5 = createTrace([
    new THREE.Vector3(1.8, -0.25, -4.0),
    new THREE.Vector3(1.4, -0.25, -2.5),
    new THREE.Vector3(0.8, -0.25, -1.2),
    new THREE.Vector3(0.0, -0.25, 0.0),
  ], "controlToCore");

  const t6 = createTrace([
    new THREE.Vector3(-1.8, -0.25, 4.0),
    new THREE.Vector3(-1.2, -0.25, 2.4),
    new THREE.Vector3(-0.7, -0.25, 1.2),
    new THREE.Vector3(0.0, -0.25, 0.0),
  ], "supportToCore");

  const t7 = createTrace([
    new THREE.Vector3(0.0, -0.25, 4.6),
    new THREE.Vector3(0.0, -0.25, 2.7),
    new THREE.Vector3(0.0, -0.25, 1.0),
    new THREE.Vector3(0.0, -0.25, 0.0),
  ], "supportToCore");

  const t8 = createTrace([
    new THREE.Vector3(1.8, -0.25, 4.0),
    new THREE.Vector3(1.2, -0.25, 2.4),
    new THREE.Vector3(0.7, -0.25, 1.2),
    new THREE.Vector3(0.0, -0.25, 0.0),
  ], "supportToCore");

  const t9 = createTrace([
    new THREE.Vector3(0.0, -0.25, 0.0),
    new THREE.Vector3(2.0, -0.25, -0.3),
    new THREE.Vector3(4.2, -0.25, -0.8),
    new THREE.Vector3(4.8, -0.25, -0.8),
    new THREE.Vector3(5.7, -0.25, -0.8),
  ], "coreToOutput");

  const t10 = createTrace([
    new THREE.Vector3(0.0, -0.25, 0.0),
    new THREE.Vector3(2.0, -0.25, 0.4),
    new THREE.Vector3(4.2, -0.25, 0.9),
    new THREE.Vector3(4.8, -0.25, 0.9),
    new THREE.Vector3(5.7, -0.25, 0.9),
  ], "coreToOutput");

  createTrace([
    new THREE.Vector3(-0.8, -0.25, 1.8),
    new THREE.Vector3(-0.8, -0.25, 3.6),
    new THREE.Vector3(-2.3, -0.25, 4.8),
    new THREE.Vector3(-4.8, -0.25, 4.8),
  ], null, 0xd9b45b, 0.028);

  createTrace([
    new THREE.Vector3(1.1, -0.25, 1.8),
    new THREE.Vector3(1.1, -0.25, 4.0),
    new THREE.Vector3(3.6, -0.25, 4.0),
    new THREE.Vector3(5.1, -0.25, 3.1),
  ], null, 0xd9b45b, 0.028);

  createTrace([
    new THREE.Vector3(-1.8, -0.25, -0.8),
    new THREE.Vector3(-4.0, -0.25, -0.8),
    new THREE.Vector3(-4.8, -0.25, -2.6),
    new THREE.Vector3(-5.0, -0.25, -4.7),
  ], null, 0xd9b45b, 0.028);

  [t1, t2].forEach((t, i) => {
    addSignalDot(t, "input", 0.07 + i * 0.01, i * 0.25);
    addSignalDot(t, "input", 0.05 + i * 0.01, i * 0.17 + 0.4);
  });

  [t3, t4, t5].forEach((t, i) => {
    addSignalDot(t, "control", 0.05 + i * 0.006, i * 0.20);
  });

  [t6, t7, t8].forEach((t, i) => {
    addSignalDot(t, "support", 0.05 + i * 0.005, i * 0.22 + 0.1);
  });

  [t9, t10].forEach((t, i) => {
    addSignalDot(t, "output", 0.08 + i * 0.01, i * 0.22 + 0.2);
    addSignalDot(t, "output", 0.055 + i * 0.01, i * 0.18 + 0.5);
  });
}

// =========================
// Blueprint Board
// =========================
function createBlueprintBoard() {
  addBlueprintLineBox(15.5, 0.18, 15.5, 0, -0.38, 0);
  addBlueprintLineBox(12.5, 0.05, 12.5, 0, -0.20, 0);

  addBlueprintLineBox(3.4, 0.18, 3.4, 0, 0.02, 0);
  addBlueprintLineBox(2.9, 0.05, 2.9, 0, 0.18, 0);

  addBlueprintLineBox(2.2, 0.08, 1.6, -5.0, -0.08, -1.3, 0.04);
  addBlueprintLineBox(2.2, 0.08, 1.6, -5.0, -0.08, 1.3, -0.04);
  addBlueprintLineBox(2.2, 0.08, 1.6, 5.0, -0.08, -1.3, -0.04);
  addBlueprintLineBox(2.2, 0.08, 1.6, 5.0, -0.08, 1.3, 0.04);

  addBlueprintLineBox(1.5, 0.06, 1.5, -2.0, -0.10, -5.0);
  addBlueprintLineBox(1.5, 0.06, 1.5, 0.0, -0.10, -5.4);
  addBlueprintLineBox(1.5, 0.06, 1.5, 2.0, -0.10, -5.0);

  addBlueprintLineBox(1.5, 0.06, 1.5, -2.0, -0.10, 5.0);
  addBlueprintLineBox(1.5, 0.06, 1.5, 0.0, -0.10, 5.4);
  addBlueprintLineBox(1.5, 0.06, 1.5, 2.0, -0.10, 5.0);

  addBlueprintPlane(15.0, 15.0, 0, -0.30, 0);
  addBlueprintPlane(11.8, 11.8, 0, -0.26, 0);
  addBlueprintPlane(4.2, 4.2, 0, -0.18, 0);

  addBlueprintTrace([
    new THREE.Vector3(-6.4, -0.22, -1.3),
    new THREE.Vector3(-4.8, -0.22, -1.3),
    new THREE.Vector3(-2.5, -0.22, -0.8),
    new THREE.Vector3(0.0, -0.22, 0.0),
  ]);

  addBlueprintTrace([
    new THREE.Vector3(-6.4, -0.22, 1.3),
    new THREE.Vector3(-4.8, -0.22, 1.3),
    new THREE.Vector3(-2.5, -0.22, 0.8),
    new THREE.Vector3(0.0, -0.22, 0.0),
  ]);

  addBlueprintTrace([
    new THREE.Vector3(0.0, -0.22, 0.0),
    new THREE.Vector3(2.5, -0.22, -0.8),
    new THREE.Vector3(4.8, -0.22, -1.3),
    new THREE.Vector3(6.4, -0.22, -1.3),
  ]);

  addBlueprintTrace([
    new THREE.Vector3(0.0, -0.22, 0.0),
    new THREE.Vector3(2.5, -0.22, 0.8),
    new THREE.Vector3(4.8, -0.22, 1.3),
    new THREE.Vector3(6.4, -0.22, 1.3),
  ]);

  addBlueprintTrace([
    new THREE.Vector3(-2.0, -0.22, -5.0),
    new THREE.Vector3(-1.4, -0.22, -2.8),
    new THREE.Vector3(-0.8, -0.22, -1.2),
    new THREE.Vector3(0.0, -0.22, 0.0),
  ]);

  addBlueprintTrace([
    new THREE.Vector3(0.0, -0.22, -5.4),
    new THREE.Vector3(0.0, -0.22, -2.8),
    new THREE.Vector3(0.0, -0.22, -1.2),
    new THREE.Vector3(0.0, -0.22, 0.0),
  ]);

  addBlueprintTrace([
    new THREE.Vector3(2.0, -0.22, -5.0),
    new THREE.Vector3(1.4, -0.22, -2.8),
    new THREE.Vector3(0.8, -0.22, -1.2),
    new THREE.Vector3(0.0, -0.22, 0.0),
  ]);

  addBlueprintTrace([
    new THREE.Vector3(-2.0, -0.22, 5.0),
    new THREE.Vector3(-1.2, -0.22, 2.8),
    new THREE.Vector3(-0.7, -0.22, 1.2),
    new THREE.Vector3(0.0, -0.22, 0.0),
  ]);

  addBlueprintTrace([
    new THREE.Vector3(0.0, -0.22, 5.4),
    new THREE.Vector3(0.0, -0.22, 2.8),
    new THREE.Vector3(0.0, -0.22, 1.2),
    new THREE.Vector3(0.0, -0.22, 0.0),
  ]);

  addBlueprintTrace([
    new THREE.Vector3(2.0, -0.22, 5.0),
    new THREE.Vector3(1.2, -0.22, 2.8),
    new THREE.Vector3(0.7, -0.22, 1.2),
    new THREE.Vector3(0.0, -0.22, 0.0),
  ]);
}

// =========================
// Particles
// =========================
function createParticles() {
  const count = 500;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 30;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    size: 0.03,
    color: 0x72f7d4,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);
  return { points, material };
}

// =========================
// Build scene
// =========================
createBoardBase();
createMachineModules();
assignModuleStates();
createTracesAndSignals();
createBlueprintBoard();
createExplodedLayerSheets();
addGoldLayerOutlines();
const particles = createParticles();

// =========================
// Interaction
// =========================
let mouseX = 0;
let mouseY = 0;
let scrollProgress = 0;

window.addEventListener("mousemove", (event) => {
  mouseX = (event.clientX / window.innerWidth) * 2 - 1;
  mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener("scroll", () => {
  const maxScroll = document.body.scrollHeight - window.innerHeight;
  scrollProgress = maxScroll > 0 ? window.scrollY / maxScroll : 0;

  const panelCount = panels.length || 1;

  panels.forEach((panel, index) => {
    const start = index / panelCount;
    const end = (index + 1) / panelCount;

    if (scrollProgress >= start - 0.06 && scrollProgress < end - 0.02) {
      panel.classList.add("active");
    } else {
      panel.classList.remove("active");
    }
  });
});

window.dispatchEvent(new Event("scroll"));

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// =========================
// Updates
// =========================
function updateModuleFormation(orchestrationEase, formationEase, elapsed) {
  Object.entries(modules).forEach(([key, mesh]) => {
    if (scrollProgress < 0.70) {
      mesh.position.lerpVectors(
        mesh.userData.startPos,
        mesh.userData.orbitPos,
        orchestrationEase
      );
    } else {
      mesh.position.lerpVectors(
        mesh.userData.orbitPos,
        mesh.userData.machinePos,
        formationEase
      );
    }

    mesh.rotation.y = THREE.MathUtils.lerp(
      mesh.userData.startRotY,
      mesh.userData.machineRotY,
      formationEase
    );
  });

  const formationScale = 1 + formationEase * 0.18;
  machine.core.main.scale.setScalar(formationScale);
  machine.core.top.scale.setScalar(1 + formationEase * 0.12);

  const ioScaleX = 1 + formationEase * 0.08;
  machine.input.chip1.scale.x = ioScaleX;
  machine.input.chip2.scale.x = ioScaleX;
  machine.output.chip1.scale.x = ioScaleX;
  machine.output.chip2.scale.x = ioScaleX;

  const calmPulse = 1 + Math.sin(elapsed * 1.6) * 0.01 * (1 - formationEase);
  machine.core.main.scale.multiplyScalar(calmPulse);
}

function updateTraceIntensity(activationEase, connectivityEase, operationEase, elapsed) {
  const inputAmp = 0.14 + activationEase * 0.10 + operationEase * 0.30;
  const controlAmp = 0.10 + connectivityEase * 0.16 + operationEase * 0.18;
  const supportAmp = 0.10 + connectivityEase * 0.12 + operationEase * 0.14;
  const outputAmp = 0.12 + connectivityEase * 0.16 + operationEase * 0.32;
  const auxAmp = 0.08 + connectivityEase * 0.10;

  allTraceObjects.forEach((traceObj, i) => {
    let base = auxAmp;

    if (traceObj.groupName === "inputToCore") base = inputAmp;
    if (traceObj.groupName === "controlToCore") base = controlAmp;
    if (traceObj.groupName === "supportToCore") base = supportAmp;
    if (traceObj.groupName === "coreToOutput") base = outputAmp;

    traceObj.mesh.material.emissiveIntensity =
      base + Math.sin(elapsed * 2.6 + i * 0.7) * 0.08;
  });
}

function updateSignals(activationEase, operationEase, elapsed, platingEase, explodeEase) {
  const visibleBase = THREE.MathUtils.lerp(0.05, 0.9, activationEase);
  const machineFlowBoost = operationEase * 0.05;
  const fade = Math.max(0, 1 - platingEase * 1.2) * (1 - explodeEase * 0.45);

  allSignals.forEach((item, index) => {
    let speedBoost = 0;

    if (item.groupName === "input") speedBoost = machineFlowBoost * 1.2;
    if (item.groupName === "control") speedBoost = machineFlowBoost * 0.7;
    if (item.groupName === "support") speedBoost = machineFlowBoost * 0.6;
    if (item.groupName === "output") speedBoost = machineFlowBoost * 1.0;

    const t = (elapsed * (item.speed + speedBoost) + item.offset) % 1;
    const pos = item.curve.getPointAt(t);

    item.dot.position.copy(pos);
    item.aura.position.copy(pos);

    const pulse = 0.78 + Math.sin(elapsed * 6 + index) * 0.18;
    item.dot.scale.setScalar(pulse);
    item.aura.scale.setScalar(1.15 + Math.sin(elapsed * 5 + index) * 0.22);

    let groupPhase = 0;
    if (item.groupName === "input") groupPhase = 0.0;
    if (item.groupName === "control") groupPhase = 0.7;
    if (item.groupName === "support") groupPhase = 1.4;
    if (item.groupName === "output") groupPhase = 2.1;

    item.dot.material.opacity =
      Math.max(0, (visibleBase + Math.sin(elapsed * 4 + index + groupPhase) * 0.08) * fade);

    item.aura.material.opacity =
      Math.max(0, (visibleBase * 0.18 + Math.sin(elapsed * 4 + index + groupPhase) * 0.03) * fade);
  });
}

function updateMachineOperation(operationEase, formationEase, elapsed, explodeEase) {
  const corePulse = 1 + Math.sin(elapsed * 4.5) * 0.04 * operationEase;
  const finalCoreBase = 1 + formationEase * 0.18;

  machine.core.main.scale.setScalar(finalCoreBase * corePulse * (1 + explodeEase * 0.06));
  machine.core.top.scale.setScalar(
    (1 + formationEase * 0.12) *
    (1 + Math.sin(elapsed * 4.0) * 0.02 * operationEase)
  );

  glow.material.opacity =
    (THREE.MathUtils.lerp(0.06, 0.22, operationEase) + Math.sin(elapsed * 3.0) * 0.03) *
    (1 - explodeEase * 0.35);

  goldLight.intensity =
    THREE.MathUtils.lerp(0.75, 1.45, operationEase) + Math.sin(elapsed * 2.4) * 0.08;

  cyanLight.intensity =
    THREE.MathUtils.lerp(1.0, 2.0, operationEase) + Math.sin(elapsed * 2.2 + 0.4) * 0.08;
}

function updateCameraAndBoard(
  introTiltProgress,
  machineCamEase,
  operationEase,
  platingEase,
  macroZoomEase,
  blueprintEase,
  sideViewEase,
  explodeEase
) {
  const cursorInfluence = 1 - operationEase * 0.45;

  const travelCam = new THREE.Vector3(
    THREE.MathUtils.lerp(0, 3.8, introTiltProgress),
    THREE.MathUtils.lerp(15.5, 3.2, introTiltProgress),
    THREE.MathUtils.lerp(0.001, 7.2, introTiltProgress)
  );

  const machineCam = new THREE.Vector3(3.8, 3.0, 7.0);

  const camTarget = new THREE.Vector3().lerpVectors(
    travelCam,
    machineCam,
    machineCamEase
  );

  camTarget.x += mouseX * (0.35 + introTiltProgress * 1.30) * cursorInfluence;
  camTarget.y += mouseY * (0.15 + introTiltProgress * 0.95) * cursorInfluence;
  camTarget.z += (-mouseY) * (0.05 + introTiltProgress * 0.45) * cursorInfluence;

  camera.position.x += (camTarget.x - camera.position.x) * 0.045;
  camera.position.y += (camTarget.y - camera.position.y) * 0.045;
  camera.position.z += (camTarget.z - camera.position.z) * 0.045;

  const boardRotX =
    THREE.MathUtils.lerp(0, -0.24, introTiltProgress) +
    mouseY * (0.02 + introTiltProgress * 0.06) * cursorInfluence;

  const boardRotY =
    THREE.MathUtils.lerp(0, 0.45, introTiltProgress) +
    mouseX * (0.03 + introTiltProgress * 0.08) * cursorInfluence;

  const boardPosX =
    THREE.MathUtils.lerp(0, -1.3, introTiltProgress) +
    mouseX * 0.18 * cursorInfluence;

  const boardPosZ =
    THREE.MathUtils.lerp(0, 0.9, introTiltProgress) +
    mouseY * 0.12 * cursorInfluence;

  boardGroup.rotation.x += (boardRotX - boardGroup.rotation.x) * 0.05;
  boardGroup.rotation.y += (boardRotY - boardGroup.rotation.y) * 0.05;
  boardGroup.position.x += (boardPosX - boardGroup.position.x) * 0.05;
  boardGroup.position.z += (boardPosZ - boardGroup.position.z) * 0.05;

  // plated / blueprint flattening
  boardGroup.rotation.x = THREE.MathUtils.lerp(boardGroup.rotation.x, -0.02, platingEase);
  boardGroup.rotation.y = THREE.MathUtils.lerp(boardGroup.rotation.y, 0.0, platingEase);
  boardGroup.rotation.z = THREE.MathUtils.lerp(boardGroup.rotation.z, -0.04, platingEase);

  boardGroup.rotation.x = THREE.MathUtils.lerp(boardGroup.rotation.x, -0.10, blueprintEase);
  boardGroup.rotation.y = THREE.MathUtils.lerp(boardGroup.rotation.y, 0.0, blueprintEase);
  boardGroup.rotation.z = THREE.MathUtils.lerp(boardGroup.rotation.z, 0.0, blueprintEase);
  boardGroup.position.x = THREE.MathUtils.lerp(boardGroup.position.x, 0.0, blueprintEase * 0.7);
  boardGroup.position.z = THREE.MathUtils.lerp(boardGroup.position.z, 0.0, blueprintEase * 0.7);

  const lookX = THREE.MathUtils.lerp(0, 0.8, machineCamEase);
  const lookZ = THREE.MathUtils.lerp(0, -0.6, machineCamEase);
  camera.lookAt(lookX, 0, lookZ);

  // ---- LATE CAMERA STORY ----
  if (platingEase > 0) {
    const platedCam = new THREE.Vector3(
      0.4 + mouseX * 0.28,
      9.2 + mouseY * 0.20,
      2.8
    );

    const macroCam = new THREE.Vector3(
      0.55 + mouseX * 0.12,
      4.8 + mouseY * 0.08,
      1.15
    );

    const blueprintCam = new THREE.Vector3(
      0.0 + mouseX * 0.12,
      12.6 + mouseY * 0.12,
      11.8
    );

    // much farther side view
    const sideCam = new THREE.Vector3(20.0 + mouseX * 0.08, 2.4 + mouseY * 0.05, 1.0);

    const platedToMacroCam = new THREE.Vector3().lerpVectors(
      platedCam,
      macroCam,
      macroZoomEase
    );

    const macroToBoardCam = new THREE.Vector3().lerpVectors(
      platedToMacroCam,
      blueprintCam,
      blueprintEase
    );

    const finalCam = new THREE.Vector3().lerpVectors(
      macroToBoardCam,
      sideCam,
      sideViewEase
    );

    camera.position.lerp(finalCam, 0.09);

    const lookTargetY = THREE.MathUtils.lerp(0.0, 0.28, sideViewEase);
    camera.lookAt(0, lookTargetY, 0);
  }

  // rotate the board into a proper profile angle
  if (sideViewEase > 0) {
    boardGroup.rotation.x = THREE.MathUtils.lerp(boardGroup.rotation.x, -0.01, 0.10);
    boardGroup.rotation.y = THREE.MathUtils.lerp(boardGroup.rotation.y, Math.PI / 2, 0.10);
    boardGroup.rotation.z = THREE.MathUtils.lerp(boardGroup.rotation.z, 0.0, 0.10);

    boardGroup.position.x = THREE.MathUtils.lerp(boardGroup.position.x, 0.0, 0.10);
    boardGroup.position.z = THREE.MathUtils.lerp(boardGroup.position.z, 0.0, 0.10);
  }

  // strong exploded-view zoom-out
  if (explodeEase > 0) {
    const explodeCam = new THREE.Vector3(24.0 + mouseX * 0.05, 3.0 + mouseY * 0.04, 0.0);

    camera.position.lerp(explodeCam, 0.10);
    camera.lookAt(0, 0.38, 0);
  }

  // widen FOV during side / exploded stage so it feels like a real pull-back
  const targetFov = THREE.MathUtils.lerp(
    45,
    58,
    Math.max(sideViewEase, explodeEase)
  );
  camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.08);
  camera.updateProjectionMatrix();
}
function updatePlatedReveal(platingEase, elapsed, blueprintEase, sideViewEase) {
  const machineFade = 1 - platingEase;

  Object.values(modules).forEach((mesh) => {
    if (mesh.material) {
      mesh.material.transparent = true;
      mesh.material.opacity = Math.max(0, machineFade);
    }
  });

  allTraceObjects.forEach((traceObj) => {
    traceObj.mesh.material.transparent = true;
    traceObj.mesh.material.opacity = Math.max(0, 1 - platingEase * 1.15);
  });

  glow.material.opacity *= Math.max(0, 1 - platingEase);

  const sideFade = 1 - sideViewEase * 0.85;

  platedBase.material.opacity = platingEase * (1 - blueprintEase * 0.9) * sideFade;
  trench.material.opacity = platingEase * (1 - blueprintEase * 0.9) * sideFade;

  platedTiles.forEach((tile, i) => {
    tile.children.forEach((child, j) => {
      if (child.material) {
        child.material.opacity = Math.min(
          1,
          platingEase * (1 - blueprintEase * 0.95) * 1.15 * sideFade
        );
        if ("emissiveIntensity" in child.material) {
          child.material.emissiveIntensity =
            0.04 + platingEase * 0.12 + Math.sin(elapsed * 2.8 + i * 0.2 + j) * 0.015;
        }
      }
    });
  });

  platedBars.forEach((bar, i) => {
    bar.material.opacity = platingEase * (1 - blueprintEase * 0.95) * sideFade;
    bar.material.emissiveIntensity =
      0.04 + platingEase * 0.08 + Math.sin(elapsed * 2.2 + i) * 0.01;
  });

  platingKeyLight.intensity = 0.25 + platingEase * 0.9 * sideFade;
}

function updateBlueprintReveal(blueprintEase, elapsed, sideViewEase) {
  const fade = 1 - sideViewEase * 0.65;

  blueprintObjects.forEach((obj, i) => {
    if (obj.material) {
      if ("opacity" in obj.material) {
        const targetOpacity =
          obj.type === "LineSegments" ? blueprintEase * 0.95 * fade : blueprintEase * 0.22 * fade;

        obj.material.opacity = THREE.MathUtils.lerp(
          obj.material.opacity,
          targetOpacity,
          0.08
        );
      }

      if ("emissiveIntensity" in obj.material) {
        obj.material.emissiveIntensity =
          0.12 + blueprintEase * 0.35 * fade + Math.sin(elapsed * 2.2 + i * 0.25) * 0.03;
      }
    }
  });
}

function updateLayerExplosion(explodeEase, elapsed) {
  pcbLayers.topComponents.position.y = THREE.MathUtils.lerp(
    pcbLayers.topComponents.position.y,
    3.2 * explodeEase,
    0.06
  );

  pcbLayers.topCopper.position.y = THREE.MathUtils.lerp(
    pcbLayers.topCopper.position.y,
    2.8 * explodeEase,
    0.06
  );

  pcbLayers.dielectric.position.y = THREE.MathUtils.lerp(
    pcbLayers.dielectric.position.y,
    1.8 * explodeEase,
    0.06
  );

  pcbLayers.bottomCopper.position.y = THREE.MathUtils.lerp(
    pcbLayers.bottomCopper.position.y,
    -1.5 * explodeEase,
    0.06
  );

  pcbLayers.baseBoard.position.y = THREE.MathUtils.lerp(
    pcbLayers.baseBoard.position.y,
    -2.45 * explodeEase,
    0.06
  );

  explodedLayerSheets.forEach((sheet, i) => {
    sheet.material.opacity = THREE.MathUtils.lerp(
      sheet.material.opacity,
      0.18 + explodeEase * 0.32,
      0.08
    );
    sheet.material.emissiveIntensity =
      0.08 + explodeEase * 0.24 + Math.sin(elapsed * 2 + i) * 0.015;
  });

  const boardFade = 1 - explodeEase * 0.35;
  decorativeMats.forEach((mat) => {
    mat.opacity = mat.opacity * 0.92 + (0.04 * boardFade) * 0.08;
  
  });
  explodedLayerSheets.forEach((sheet, i) => {

  if (sheet.userData.outline) {

    const outline = sheet.userData.outline;

    outline.material.opacity = THREE.MathUtils.lerp(
      outline.material.opacity,
      explodeEase * 1.6,
      0.08
    );
    const glowPulse = 1.85 + Math.sin(elapsed * 3 + i) * 0.25;

    outline.material.color.setRGB(
      1.0 * glowPulse,
      0.82 * glowPulse,
      0.90 * glowPulse
    );

  }

});
}
// =========================
// Animate
// =========================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();

  const introTiltProgress = smoothStage(scrollProgress, 0.03, 0.28);
  const activationEase = smoothStage(scrollProgress, 0.15, 0.30);
  const connectivityEase = smoothStage(scrollProgress, 0.30, 0.50);
  const orchestrationEase = smoothStage(scrollProgress, 0.50, 0.70);
  const formationEase = smoothStage(scrollProgress, 0.70, 0.90);
  const operationEase = smoothStage(scrollProgress, 0.90, 1.00);
  const machineCamEase = smoothStage(scrollProgress, 0.72, 0.95);

  const platingEase = smoothStage(scrollProgress, 0.82, 0.92);
  const macroZoomEase = smoothStage(scrollProgress, 0.92, 1.00);
  const blueprintEase = smoothStage(scrollProgress, 0.88, 1.00);

  const sideViewEase = smoothStage(scrollProgress, 0.88, 0.96);
  const explodeEase = smoothStage(scrollProgress, 0.95, 1.00);
  const dismissEase = smoothStage(scrollProgress, 0.95, 0.98);
  const logoEase = smoothStage(scrollProgress, 0.98, 1.00);
  const bgColor = bgStartColor.clone().lerp(bgExplodeColor, explodeEase);

  scene.background = bgColor;
  scene.fog.color.copy(bgColor);
  

  updateCameraAndBoard(
    introTiltProgress,
    machineCamEase,
    operationEase,
    platingEase,
    macroZoomEase,
    blueprintEase,
    sideViewEase,
    explodeEase
  );

  updateModuleFormation(orchestrationEase, formationEase, elapsed);
  updateTraceIntensity(activationEase, connectivityEase, operationEase, elapsed);
  updateSignals(activationEase, operationEase, elapsed, platingEase, explodeEase);
  updateMachineOperation(operationEase, formationEase, elapsed, explodeEase);
  updatePlatedReveal(platingEase, elapsed, blueprintEase, sideViewEase);
  updateBlueprintReveal(blueprintEase, elapsed, sideViewEase);
  updateLayerExplosion(explodeEase, elapsed);
  // updateLayerDismiss(dismissEase, elapsed);
  // updateSymexReveal(logoEase, elapsed);


  particles.points.rotation.y = elapsed * 0.02;
  particles.material.opacity =
    THREE.MathUtils.lerp(0.15, 0.85, activationEase) *
    (1 - platingEase * 0.8) *
    (1 - sideViewEase * 0.35);

  renderer.render(scene, camera);
}

animate();