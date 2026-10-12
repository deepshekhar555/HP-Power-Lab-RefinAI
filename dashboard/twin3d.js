// RefinAI — instrumented combined-cycle plant model with UCI CCPP sample replay.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const canvas = document.getElementById("threeCanvas");
const initialBounds = canvas.getBoundingClientRect();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb9c4c5);
scene.fog = new THREE.Fog(0xb9c4c5, 85, 150);

const camera = new THREE.PerspectiveCamera(42, (initialBounds.width || 900) / (initialBounds.height || 420), 0.1, 250);
camera.position.set(36, 30, 46);
camera.zoom = 1.0;
camera.updateProjectionMatrix();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(initialBounds.width || 900, initialBounds.height || 420, false);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 23;
controls.maxDistance = 90;
controls.target.set(0, 6, 0);
controls.target.set(0, 5, 0);

scene.add(new THREE.HemisphereLight(0xe7eef0, 0x535b5a, 2.2));
scene.add(new THREE.AmbientLight(0xd7dedf, 0.55));
const sun = new THREE.DirectionalLight(0xfff4df, 3.0);
sun.position.set(-24, 42, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -55;
sun.shadow.camera.right = 55;
sun.shadow.camera.top = 55;
sun.shadow.camera.bottom = -55;
scene.add(sun);

function makeGrainTexture(baseColor, seed) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 256;
  textureCanvas.height = 256;
  const context = textureCanvas.getContext("2d");
  context.fillStyle = baseColor;
  context.fillRect(0, 0, 256, 256);
  let state = seed;
  for (let point = 0; point < 2400; point++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const x = state % 256;
    state = (state * 1664525 + 1013904223) >>> 0;
    const y = state % 256;
    const shade = state % 2 ? "rgba(20,27,28,.10)" : "rgba(245,242,230,.09)";
    context.fillStyle = shade;
    context.fillRect(x, y, 1 + (state % 3), 1);
  }
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

const materials = {
  concrete: new THREE.MeshStandardMaterial({ color: 0xffffff, map: makeGrainTexture("#747a76", 23), roughness: 0.94 }),
  slab: new THREE.MeshStandardMaterial({ color: 0xffffff, map: makeGrainTexture("#858a87", 41), roughness: 0.92 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x7d898d, map: makeGrainTexture("#92999a", 67), metalness: 0.74, roughness: 0.48 }),
  steelDark: new THREE.MeshStandardMaterial({ color: 0x515d62, metalness: 0.68, roughness: 0.58 }),
  casing: new THREE.MeshStandardMaterial({ color: 0x777b78, metalness: 0.35, roughness: 0.65 }),
  panel: new THREE.MeshStandardMaterial({ color: 0x9a9e99, metalness: 0.28, roughness: 0.62 }),
  insulation: new THREE.MeshStandardMaterial({ color: 0x817d74, metalness: 0.12, roughness: 0.86 }),
  hotPipe: new THREE.MeshStandardMaterial({ color: 0x765f51, emissive: 0x7b4c2c, emissiveIntensity: 0.35, metalness: 0.42, roughness: 0.58 }),
  waterPipe: new THREE.MeshStandardMaterial({ color: 0x596d70, emissive: 0x2c5d63, emissiveIntensity: 0.18, metalness: 0.56, roughness: 0.48 }),
  rail: new THREE.MeshStandardMaterial({ color: 0xa28c61, metalness: 0.48, roughness: 0.54 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x8da3a4, metalness: 0.18, roughness: 0.3 }),
};

const animatedParts = [];

function addBox(parent, position, dimensions, material, castShadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), material);
  mesh.position.set(...position);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, position, radiusTop, radiusBottom, height, material, segments = 24) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addBetween(parent, start, end, radius, material, segments = 16) {
  const startVector = new THREE.Vector3(...start);
  const endVector = new THREE.Vector3(...end);
  const direction = endVector.clone().sub(startVector);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), segments), material);
  mesh.position.copy(startVector).add(endVector).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addHorizontalVessel(parent, center, length, radius, material) {
  const vessel = addCylinder(parent, center, radius, radius, length, material, 32);
  vessel.rotation.z = Math.PI / 2;
  for (const end of [-0.48, 0.48]) {
    const flange = addCylinder(parent, [center[0] + length * end, center[1], center[2]], radius * 1.12, radius * 1.12, 0.16, materials.steelDark, 32);
    flange.rotation.z = Math.PI / 2;
  }
  return vessel;
}

function addRoute(parent, points, radius, material) {
  for (let index = 0; index < points.length - 1; index++) {
    addBetween(parent, points[index], points[index + 1], radius, material, 12);
    if (index < points.length - 2) {
      const elbow = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), material);
      elbow.position.set(...points[index + 1]);
      parent.add(elbow);
    }
  }
}

function addHandwheel(position, radius = 0.48) {
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.055, 8, 28), materials.rail);
  wheel.position.set(...position);
  scene.add(wheel);
  for (let spoke = 0; spoke < 4; spoke++) {
    const angle = (spoke / 4) * Math.PI;
    addBetween(scene,
      [position[0] - Math.cos(angle) * radius, position[1] - Math.sin(angle) * radius, position[2]],
      [position[0] + Math.cos(angle) * radius, position[1] + Math.sin(angle) * radius, position[2]],
      0.035, materials.rail, 8);
  }
  addCylinder(scene, [position[0], position[1], position[2] - 0.12], 0.1, 0.1, 0.34, materials.steelDark, 12);
}

function addLabel(text, position, scale = [4.2, 0.9, 1]) {
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 512;
  labelCanvas.height = 112;
  const context = labelCanvas.getContext("2d");
  context.fillStyle = "rgba(39,47,49,.9)";
  context.fillRect(0, 0, labelCanvas.width, labelCanvas.height);
  context.strokeStyle = "#b6ad98";
  context.lineWidth = 3;
  context.strokeRect(3, 3, labelCanvas.width - 6, labelCanvas.height - 6);
  context.fillStyle = "#f0eee8";
  context.font = "600 32px Segoe UI, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, labelCanvas.width / 2, labelCanvas.height / 2);
  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.position.set(...position);
  sprite.scale.set(...scale);
  scene.add(sprite);
  return sprite;
}

function buildSite() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 90), materials.concrete);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.15;
  ground.receiveShadow = true;
  scene.add(ground);

  addBox(scene, [0, 0.12, 0], [58, 0.24, 36], materials.slab, false);
  addBox(scene, [0, 0.27, 0], [54, 0.08, 32], materials.concrete, false);
  for (const x of [-25, -17, -9, -1, 7, 15, 23]) {
    addBox(scene, [x, 0.33, 0], [0.08, 0.012, 30], materials.rail, false);
  }
  addBox(scene, [0, 0.34, 15.2], [52, 0.025, 0.12], materials.rail, false);
  addBox(scene, [0, 0.34, -15.2], [52, 0.025, 0.12], materials.rail, false);

  buildAirInlet();
  buildGasTurbine();
  buildGenerator();
  buildHrsg();
  buildSteamTrain();
  buildCoolingLoop();
  buildElectricalYard();
  buildWeatherMast();
  buildPipeRack();
  buildControlRoom();
  buildUtilitySkids();
  buildFeedwaterTank();
  buildServiceAccess();
  buildInstrumentGauges();
}

function buildAirInlet() {
  addBox(scene, [-22, 2.7, -3], [5, 5.2, 5.2], materials.panel);
  for (let level = 0; level < 9; level++) {
    addBox(scene, [-22, 0.7 + level * 0.5, -0.34], [4.2, 0.08, 0.08], materials.steelDark);
  }
  addBox(scene, [-19.1, 3.3, -3], [1.2, 3.5, 3.7], materials.steel);
  addRoute(scene, [[-19, 3.5, -3], [-16.8, 3.5, -3], [-15.5, 2.1, -3]], 0.42, materials.steelDark);
  addLabel("AIR INLET FILTER", [-22, 6.3, -3]);
}

function buildGasTurbine() {
  addBox(scene, [-12, 0.85, -3], [11, 1.1, 6.2], materials.steelDark);
  addBox(scene, [-12, 1.85, -3], [10.5, 1.55, 5.7], materials.insulation);
  addBox(scene, [-12, 3.2, -3], [9.6, 1.75, 5.1], materials.casing);
  addHorizontalVessel(scene, [-13.2, 2.2, -3], 5.8, 1.45, materials.casing);
  addHorizontalVessel(scene, [-9.2, 2.15, -3], 3.0, 1.85, materials.steel);
  addCylinder(scene, [-10.9, 2.2, -3], 0.48, 0.48, 0.42, materials.rail, 16).rotation.z = Math.PI / 2;
  for (let fin = 0; fin < 11; fin++) {
    const x = -15.7 + fin * 0.5;
    addBox(scene, [x, 2.25, -3], [0.08, 2.45, 2.65], materials.steelDark);
  }
  addBox(scene, [-11.4, 4.25, -3], [3.8, 1.3, 3.0], materials.insulation);
  for (const x of [-14.7, -9.5]) {
    addBox(scene, [x, 1.45, -3], [0.32, 1.4, 4.8], materials.steel);
  }
  addRoute(scene, [[-7.8, 2.8, -3], [-5.7, 2.8, -3], [-4.2, 5.3, -3], [-2.3, 5.3, -3]], 0.72, materials.hotPipe);
  addLabel("GAS TURBINE", [-12, 7.2, -3]);
}

function buildGenerator() {
  addBox(scene, [-12, 0.72, 4.5], [8.4, 0.85, 3.3], materials.steelDark);
  addBox(scene, [-12, 2.3, 4.5], [7.8, 2.2, 2.8], materials.insulation);
  addHorizontalVessel(scene, [-12.2, 2.25, 4.5], 5.5, 1.34, materials.steel);
  addHorizontalVessel(scene, [-8.5, 2.25, 4.5], 2.4, 1.08, materials.casing);
  for (let fin = 0; fin < 12; fin++) {
    addBox(scene, [-14.4 + fin * 0.4, 2.25, 4.5], [0.055, 2.1, 2.2], materials.steelDark);
  }
  addBetween(scene, [-9.5, 2.25, 4.5], [-7.1, 2.25, 4.5], 0.25, materials.rail);
  for (const x of [-14.7, -10, -8.1]) addBox(scene, [x, 1.3, 4.5], [0.28, 1.3, 2.6], materials.steel);
  addLabel("GENERATOR", [-11.5, 4.6, 4.5]);
}

function buildHrsg() {
  const left = -2.3;
  const back = -3.4;
  for (const x of [left - 1.9, left + 6.8]) {
    for (const z of [back - 3.3, back + 3.3]) {
      addBetween(scene, [x, 0.5, z], [x, 12.2, z], 0.16, materials.steelDark);
    }
  }
  for (let level = 0; level <= 6; level++) {
    const y = 0.7 + level * 1.85;
    addBetween(scene, [left - 1.9, y, back - 3.3], [left + 6.8, y, back - 3.3], 0.12, materials.steel);
    addBetween(scene, [left - 1.9, y, back + 3.3], [left + 6.8, y, back + 3.3], 0.12, materials.steel);
  }
  for (let bank = 0; bank < 4; bank++) {
    for (let row = 0; row < 8; row++) {
      const x = -0.8 + bank * 1.75;
      const y = 2.1 + row * 0.95;
      addBetween(scene, [x, y, -6.5], [x, y, -0.25], 0.11, materials.steel);
    }
  }
  addBox(scene, [left + 1.8, 6.3, back], [8.4, 10.7, 6.1], materials.insulation);
  addBox(scene, [left + 6.65, 6.1, back], [0.32, 10.6, 6.3], materials.insulation);
  addBox(scene, [left + 1.15, 11.8, back], [2.1, 0.28, 6.2], materials.insulation);
  addBox(scene, [left + 4.1, 11.8, back], [2.1, 0.28, 6.2], materials.insulation);
  addBox(scene, [-3.2, 6, back], [0.7, 10.8, 5.5], materials.steelDark);
  addBox(scene, [-2.35, 6, back], [0.18, 9.4, 6.2], materials.rail);
  addRoute(scene, [[-2, 10.8, -3.4], [0, 12.4, -3.4], [3.3, 12.4, -3.4]], 0.35, materials.hotPipe);
  addHandwheel([5.5, 8.8, 0.15], 0.42);
  addCylinder(scene, [4.9, 14.6, -3.4], 0.92, 1.2, 13, materials.steelDark, 32);
  addCylinder(scene, [4.9, 21.2, -3.4], 1.28, 0.92, 0.4, materials.steel, 32);
  addLabel("HEAT RECOVERY STEAM GENERATOR", [1.8, 13.5, -3.4], [7, 1, 1]);
  for (let stair = 0; stair < 8; stair++) {
    const y = 1 + stair * 0.45;
    const x = 6.2 + stair * 0.35;
    addBox(scene, [x, y, 0.8], [1.2, 0.12, 1.8], materials.steelDark);
  }
  addBetween(scene, [6.2, 0.8, 1.7], [9.1, 4.2, 1.7], 0.07, materials.rail);
}

function buildSteamTrain() {
  addBox(scene, [12, 0.65, 0.2], [13.5, 0.8, 5.3], materials.steelDark);
  addBox(scene, [12, 2.2, 0.2], [12.8, 2.4, 4.7], materials.insulation);
  addHorizontalVessel(scene, [8.4, 2.25, 0.2], 3.6, 1.2, materials.steel);
  addHorizontalVessel(scene, [11.5, 2.25, 0.2], 2.8, 1.65, materials.casing);
  addHorizontalVessel(scene, [14.2, 2.25, 0.2], 2.3, 1.05, materials.steel);
  for (const x of [7.3, 9.8, 12.8, 15.4]) addBox(scene, [x, 1.3, 0.2], [0.28, 1.3, 4.2], materials.steel);
  addBetween(scene, [15.4, 2.25, 0.2], [17.5, 2.25, 0.2], 0.22, materials.rail);
  addRoute(scene, [[4.2, 12.1, -2.7], [7.4, 12.1, -2.7], [8, 5, -1.1], [9, 3.5, -0.7]], 0.32, materials.steel);
  addLabel("STEAM TURBINE", [11.5, 5.2, 0.2]);
  addHorizontalVessel(scene, [11.2, 1.15, 4.4], 6.4, 1.4, materials.steelDark);
  addBox(scene, [11.2, 1.75, 4.4], [6.2, 1.6, 2.4], materials.casing);
  for (let tube = 0; tube < 16; tube++) {
    const x = 8.5 + (tube % 8) * 0.78;
    const y = 0.8 + Math.floor(tube / 8) * 0.45;
    addBetween(scene, [x, y, 3.3], [x, y, 5.5], 0.045, materials.steel);
  }
  addRoute(scene, [[11, 1.2, 0.8], [11, 1.2, 2.6], [11, 1.2, 3.2]], 0.28, materials.waterPipe);
  addLabel("SURFACE CONDENSER", [11.1, 3.5, 5.4]);
}

function buildCoolingLoop() {
  const towerProfile = [
    new THREE.Vector2(3.35, 0), new THREE.Vector2(3.15, 1.1), new THREE.Vector2(2.8, 3.2),
    new THREE.Vector2(2.45, 5.4), new THREE.Vector2(2.35, 7), new THREE.Vector2(2.55, 8.4),
    new THREE.Vector2(3.0, 10.2), new THREE.Vector2(3.25, 11.1), new THREE.Vector2(3.35, 11.3),
  ];
  const tower = new THREE.Mesh(new THREE.LatheGeometry(towerProfile, 40), materials.concrete);
  tower.position.set(21, 0.4, -8);
  tower.castShadow = true;
  tower.receiveShadow = true;
  scene.add(tower);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(3.32, 0.12, 8, 40), materials.steelDark);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(21, 11.7, -8);
  scene.add(rim);
  addCylinder(scene, [21, 0.7, -8], 3.45, 3.45, 0.45, materials.steelDark, 40);
  for (let column = 0; column < 12; column++) {
    const angle = (column / 12) * Math.PI * 2;
    addBetween(scene, [21 + 3.3 * Math.cos(angle), 0.5, -8 + 3.3 * Math.sin(angle)], [21 + 3.05 * Math.cos(angle), 3.6, -8 + 3.05 * Math.sin(angle)], 0.075, materials.steel);
  }
  addRoute(scene, [[14, 1.8, 4.4], [17, 1.8, 4.4], [17, 1.2, -7], [18, 1.2, -8]], 0.35, materials.waterPipe);
  addRoute(scene, [[24, 1.2, -8], [27, 1.2, -8], [27, 1.3, 4], [15, 1.3, 4]], 0.29, materials.waterPipe);
  addHandwheel([17.2, 2, 4.1], 0.38);
  addCoolingFan([21, 12.4, -8], 1.4, "y");
  addLabel("COOLING TOWER", [21, 13, -8]);
}

function buildElectricalYard() {
  addBox(scene, [20.5, 1, 5.7], [6, 1.7, 4.4], materials.steelDark);
  addBox(scene, [20.5, 2.25, 5.7], [4.2, 2.2, 2.8], materials.insulation);
  for (let fin = 0; fin < 9; fin++) {
    addBox(scene, [18.8 + fin * 0.43, 2.25, 7.2], [0.11, 2.1, 0.55], materials.steel);
  }
  for (let bushing = 0; bushing < 3; bushing++) {
    const x = 19.1 + bushing * 1.4;
    addCylinder(scene, [x, 4.2, 5.7], 0.24, 0.32, 1.8, materials.glass, 16);
    addCylinder(scene, [x, 5.15, 5.7], 0.45, 0.45, 0.11, materials.steelDark, 16);
  }
  for (const x of [17, 24]) {
    addBetween(scene, [x, 0.4, 9], [x, 8.8, 9], 0.13, materials.steelDark);
    addBetween(scene, [x - 2.1, 7.1, 9], [x + 2.1, 7.1, 9], 0.12, materials.steel);
    for (const offset of [-1.6, 0, 1.6]) addBetween(scene, [x + offset, 7.1, 9], [x + offset, 8.6, 9], 0.045, materials.rail);
  }
  addBetween(scene, [17, 8.1, 9], [24, 8.1, 9], 0.035, materials.steelDark);
  addLabel("STEP-UP TRANSFORMER", [20.5, 6, 5.7]);
}

function buildWeatherMast() {
  addBetween(scene, [-25, 0.5, 8], [-25, 9.2, 8], 0.095, materials.steelDark);
  addBetween(scene, [-26.6, 8.5, 8], [-23.4, 8.5, 8], 0.055, materials.steel);
  for (const side of [-1, 1]) {
    addBetween(scene, [-25, 7.7, 8], [-25 + side * 1.7, 7.7, 8], 0.04, materials.steel);
    addBox(scene, [-25 + side * 1.7, 7.4, 8], [0.45, 0.5, 0.45], materials.panel);
  }
  addBetween(scene, [-25, 9.2, 8], [-25, 10.3, 8], 0.035, materials.steel);
  addLabel("MET MAST", [-25, 11.2, 8], [3.3, 0.72, 1]);
}

function buildPipeRack() {
  for (const x of [-18, -10, -2, 6, 14]) {
    for (const z of [8, 12]) addBetween(scene, [x, 0.55, z], [x, 5.5, z], 0.15, materials.steelDark);
    addBetween(scene, [x, 5.5, 8], [x, 5.5, 12], 0.13, materials.steel);
  }
  for (const y of [3.1, 5.2]) {
    addBetween(scene, [-18, y, 8], [14, y, 8], 0.12, materials.steel);
    addBetween(scene, [-18, y, 12], [14, y, 12], 0.12, materials.steel);
  }
  for (const z of [8.7, 9.8, 10.9, 11.7]) {
    addBetween(scene, [-18, 4.1, z], [14, 4.1, z], z === 11.7 ? 0.17 : 0.11, z === 11.7 ? materials.hotPipe : materials.waterPipe);
  }
  for (const x of [-15, -7, 1, 9]) {
    addBetween(scene, [x, 3.7, 8], [x, 5.2, 8], 0.055, materials.rail);
    addBetween(scene, [x, 3.7, 12], [x, 5.2, 12], 0.055, materials.rail);
  }
  addLabel("PIPE RACK / UTILITY HEADER", [-2, 6.8, 10], [6, 0.82, 1]);
}

function addStatusLight(position, color = 0x5fe39b) {
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 14, 12),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, metalness: 0.2, roughness: 0.4 })
  );
  light.position.set(...position);
  light.userData = { pulse: Math.random() * Math.PI * 2, baseColor: color };
  scene.add(light);
  animatedParts.push({ kind: "light", mesh: light });
  return light;
}

function addCoolingFan(position, radius = 1.8, axis = "y") {
  const group = new THREE.Group();
  group.position.set(...position);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.2, 20), materials.steelDark);
  hub.rotation.x = Math.PI / 2;
  group.add(hub);
  const bladeGroup = new THREE.Group();
  for (let blade = 0; blade < 5; blade++) {
    const bladeMesh = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 0.7, 0.08, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x9ca7a8, metalness: 0.8, roughness: 0.35 })
    );
    bladeMesh.position.x = radius * 0.4;
    bladeMesh.rotation.z = (blade / 5) * Math.PI * 2;
    bladeGroup.add(bladeMesh);
  }
  group.add(bladeGroup);
  scene.add(group);
  animatedParts.push({ kind: "fan", group, bladeGroup, axis, speed: 1.7 + Math.random() * 0.8, phase: Math.random() * Math.PI * 2 });
  return group;
}

function buildControlRoom() {
  addBox(scene, [-20.5, 2.4, 13.4], [7.4, 4.5, 4.2], materials.casing);
  for (let windowIndex = 0; windowIndex < 4; windowIndex++) {
    addBox(scene, [-23.1 + windowIndex * 1.75, 3, 11.26], [1.2, 1.3, 0.08], materials.glass);
  }
  addBox(scene, [-20.5, 4.75, 13.4], [7.8, 0.22, 4.6], materials.steelDark);
  addLabel("CONTROL ROOM", [-20.5, 5.8, 13.3]);
}

function buildUtilitySkids() {
  addBox(scene, [-0.5, 1.2, 7.2], [3.6, 1.4, 2.2], materials.steelDark);
  addBox(scene, [2.7, 1.45, 7.2], [1.6, 1.8, 1.8], materials.panel);
  for (let i = 0; i < 6; i++) {
    const x = -2.1 + i * 0.95;
    addCylinder(scene, [x, 2.0, 7.2], 0.18, 0.18, 0.8, materials.steel, 18);
    addStatusLight([x, 2.7, 7.2], i % 2 === 0 ? 0x52d981 : 0xf1c759);
  }
  addRoute(scene, [[-0.5, 2.1, 7.2], [3.5, 2.1, 7.2], [7.8, 2.1, 6.8]], 0.12, materials.waterPipe);
  addBox(scene, [16.8, 1.0, 9.6], [3.0, 1.1, 2.7], materials.steelDark);
  addCylinder(scene, [16.8, 1.9, 9.6], 0.32, 0.32, 1.0, materials.steelDark, 20);
  addStatusLight([16.8, 2.8, 9.6], 0x49b8ff);
}

function buildFeedwaterTank() {
  addCylinder(scene, [8.5, 3.55, -8.5], 1.8, 1.8, 6.7, materials.steelDark, 34);
  addCylinder(scene, [8.5, 6.3, -8.5], 2.0, 2.0, 0.28, materials.steel, 34);
  addBox(scene, [8.5, 0.8, -8.5], [4.2, 0.7, 4.2], materials.casing);
  addRoute(scene, [[8.5, 6.8, -8.5], [8.5, 10, -8.5], [4.5, 10.2, -8.5]], 0.2, materials.waterPipe);
  addRoute(scene, [[8.5, 0.8, -8.5], [8.5, 2.2, -8.5], [4.0, 2.2, -8.5]], 0.18, materials.waterPipe);
  addLabel("FEEDWATER TANK", [8.5, 10.3, -8.5], [4.8, 0.75, 1]);
}

function buildServiceAccess() {
  for (let rung = 0; rung < 12; rung++) {
    const y = 0.95 + rung * 0.42;
    addBetween(scene, [-15.9, y, 3.3], [-14.2, y, 3.3], 0.028, materials.steelDark);
    addBetween(scene, [14.8, y, 0.9], [16.6, y, 0.9], 0.028, materials.steelDark);
  }
  addBox(scene, [-14.8, 2.1, 2.2], [0.65, 2.5, 1.9], materials.casing);
  addBox(scene, [15.6, 2.1, 2.7], [0.75, 2.5, 2.1], materials.casing);
  addBox(scene, [5.4, 1.2, -7.6], [4.4, 0.14, 1.4], materials.steelDark);
  addBox(scene, [5.4, 1.2, 1.8], [4.4, 0.14, 1.4], materials.steelDark);
  addRoute(scene, [[-11.8, 2.8, -3], [-10.8, 2.8, -3], [-10.8, 2.8, 4.8]], 0.09, materials.rail);
  addRoute(scene, [[13.0, 2.8, 0.2], [15.2, 2.8, 0.2], [15.2, 2.8, 5.5]], 0.09, materials.rail);
  addStatusLight([-4.2, 5.2, -1.6], 0x7ee49a);
  addStatusLight([18.0, 5.1, 5.9], 0xfdad4d);
  addStatusLight([-19.5, 3.8, 13.0], 0x5fe39b);
}

const instrumentFaces = {};

function createTextPlate(text, position) {
  const plateCanvas = document.createElement("canvas");
  plateCanvas.width = 512;
  plateCanvas.height = 96;
  const context = plateCanvas.getContext("2d");
  const texture = new THREE.CanvasTexture(plateCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.position.set(...position);
  sprite.scale.set(4.2, 0.78, 1);
  function update(value) {
    context.clearRect(0, 0, plateCanvas.width, plateCanvas.height);
    context.fillStyle = "#333b3c";
    context.fillRect(2, 2, plateCanvas.width - 4, plateCanvas.height - 4);
    context.strokeStyle = "#c3b99d";
    context.lineWidth = 5;
    context.strokeRect(4, 4, plateCanvas.width - 8, plateCanvas.height - 8);
    context.fillStyle = "#f1eee5";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "bold 30px Segoe UI, sans-serif";
    context.fillText(text, plateCanvas.width / 2, 31);
    context.font = "600 32px Segoe UI, sans-serif";
    context.fillText(value, plateCanvas.width / 2, 68);
    texture.needsUpdate = true;
  }
  scene.add(sprite);
  return update;
}

function createGauge(instrument, position, range) {
  const group = new THREE.Group();
  group.position.set(...position);
  group.scale.setScalar(1.22);
  const caseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.19, 36), materials.steelDark);
  caseMesh.rotation.x = Math.PI / 2;
  group.add(caseMesh);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.56, 36), new THREE.MeshStandardMaterial({ color: 0xd8d3c4, roughness: 0.84 }));
  face.position.z = 0.105;
  group.add(face);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.61, 0.055, 8, 36), materials.steel);
  bezel.position.z = 0.13;
  group.add(bezel);

  for (let tick = 0; tick <= 10; tick++) {
    const angle = -1.18 + (tick / 10) * 2.36;
    const inner = tick % 5 === 0 ? 0.4 : 0.45;
    const start = new THREE.Vector3(Math.cos(angle) * inner, Math.sin(angle) * inner, 0.125);
    const end = new THREE.Vector3(Math.cos(angle) * 0.51, Math.sin(angle) * 0.51, 0.125);
    const mark = new THREE.Line(new THREE.BufferGeometry().setFromPoints([start, end]), new THREE.LineBasicMaterial({ color: 0x343a39 }));
    group.add(mark);
  }

  const needlePivot = new THREE.Group();
  needlePivot.position.set(0, 0, 0.16);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.025, 0.018), new THREE.MeshStandardMaterial({ color: 0x884a36, metalness: 0.25, roughness: 0.5 }));
  needle.position.x = 0.18;
  needlePivot.add(needle);
  group.add(needlePivot);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), materials.steelDark);
  hub.position.z = 0.18;
  group.add(hub);

  const valueUpdate = createTextPlate(instrument.tag, [position[0], position[1] + 0.96, position[2]]);
  const normalized = value => THREE.MathUtils.clamp((value - range[0]) / (range[1] - range[0]), 0, 1);
  instrumentFaces[instrument.field] = { needlePivot, valueUpdate, instrument, normalized };
  scene.add(group);
}

function buildInstrumentGauges() {
  createGauge(INSTRUMENTS.find(item => item.field === "AT"), [-22.5, 4.1, 1.3], [0, 40]);
  createGauge(INSTRUMENTS.find(item => item.field === "V"), [11, 4.2, 7], [25, 82]);
  createGauge(INSTRUMENTS.find(item => item.field === "AP"), [-25, 4.5, 8.8], [990, 1040]);
  createGauge(INSTRUMENTS.find(item => item.field === "RH"), [-22, 4.5, 8.8], [20, 100]);
  createGauge(INSTRUMENTS.find(item => item.field === "PE"), [16.3, 4.2, 6.3], [420, 500]);
  createGauge(INSTRUMENTS.find(item => item.field === "PE_pred"), [19.3, 4.2, 6.3], [420, 500]);
  createGauge(INSTRUMENTS.find(item => item.field === "residual_MW"), [22.3, 4.2, 6.3], [-8, 8]);
}

buildSite();

window.updatePlantTwin = sample => {
  if (!sample) return;
  Object.values(instrumentFaces).forEach(gauge => {
    const value = Number(sample[gauge.instrument.field]);
    if (!Number.isFinite(value)) return;
    const position = gauge.normalized(value);
    gauge.needlePivot.rotation.z = -1.18 + position * 2.36;
    const display = `${value.toFixed(gauge.instrument.digits)} ${gauge.instrument.unit}`;
    gauge.valueUpdate(display);
  });
};

function resizeScene() {
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  camera.aspect = bounds.width / bounds.height;
  camera.zoom = THREE.MathUtils.clamp(camera.aspect / 1.9, 0.82, 1.08);
  camera.updateProjectionMatrix();
  renderer.setSize(bounds.width, bounds.height, false);
}

const resizeObserver = new ResizeObserver(resizeScene);
resizeObserver.observe(canvas.parentElement);
window.addEventListener("resize", resizeScene);
if (window.plantSample) window.updatePlantTwin(window.plantSample);

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();

  for (const part of animatedParts) {
    if (part.kind === "fan") {
      part.bladeGroup.rotation.y = elapsed * part.speed + part.phase;
      part.group.rotation.z = 0.08 * Math.sin(elapsed * 1.6 + part.phase);
    }
    if (part.kind === "light") {
      const material = part.mesh.material;
      const glow = 0.9 + Math.sin(elapsed * 3.5 + part.mesh.userData.pulse) * 0.55;
      material.emissiveIntensity = glow;
      material.color.setHex(part.mesh.userData.baseColor);
    }
  }

  materials.hotPipe.emissiveIntensity = 0.25 + Math.sin(elapsed * 2.2) * 0.18;
  materials.waterPipe.emissiveIntensity = 0.14 + Math.cos(elapsed * 1.4) * 0.08;

  controls.update();
  renderer.render(scene, camera);
}

const clock = new THREE.Clock();
animate();
