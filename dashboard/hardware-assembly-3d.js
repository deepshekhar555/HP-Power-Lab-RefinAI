const canvas = document.getElementById("hardware-assembly-canvas");
const status = document.getElementById("bench-live-state");
const detail = {
  kicker: document.getElementById("bench-detail-kicker"),
  title: document.getElementById("bench-detail-title"),
  copy: document.getElementById("bench-detail-copy"),
};

const tagDetails = {
  "LT-101": ["Feed tank level transmitter", "feed-tank", "4–20 mA loop enters the marshalling terminal strip, then an isolated analog-input channel."],
  "PT-101": ["Pump suction-pressure transmitter", "transfer-pump", "4–20 mA loop enters the marshalling terminal strip, then an isolated analog-input channel."],
  "PT-102": ["Pump discharge-pressure transmitter", "transfer-pump", "4–20 mA loop enters the marshalling terminal strip, then an isolated analog-input channel."],
  "FT-101": ["Transfer flow transmitter", "transfer-pump", "Flow pulse/analog signal is represented at the marshalling terminals and conditioned input."],
  "DPIT-101": ["Filter differential-pressure transmitter", "filter", "4–20 mA loop enters the marshalling terminal strip, then an isolated analog-input channel."],
  "TT-101": ["Exchanger inlet RTD transmitter", "heat-exchanger", "RTD field pair terminates on its dedicated temperature front-end; it is not a direct MCU pin connection."],
  "TT-102": ["Exchanger outlet RTD transmitter", "heat-exchanger", "RTD field pair terminates on its dedicated temperature front-end; it is not a direct MCU pin connection."],
  "VIB-101": ["Pump bearing vibration monitor", "transfer-pump", "A dedicated vibration front-end conditions this measurement before the controller data link."],
  "EM-101": ["Pump motor power meter", "transfer-pump", "Meter data is represented over an isolated serial/field interface; the model does not connect to motor wiring."],
  "LT-102": ["Receiver tank level transmitter", "receiver-tank", "4–20 mA loop enters the marshalling terminal strip, then an isolated analog-input channel."],
};
const tagReadouts = {
  "LT-101": ["feedLevel", "%", 1],
  "PT-101": ["suctionPressure", "bar", 2],
  "PT-102": ["dischargePressure", "bar", 2],
  "FT-101": ["flow", "m³/h", 1],
  "DPIT-101": ["filterDifferential", "bar", 2],
  "TT-101": ["inletTemperature", "°C", 1],
  "TT-102": ["outletTemperature", "°C", 1],
  "VIB-101": ["vibration", "mm/s", 2],
  "EM-101": ["motorPower", "kW", 1],
  "LT-102": ["receiverLevel", "%", 1],
};

const assemblyState = {
  selectedAsset: "site",
  selectedComponent: "controller",
  telemetryStale: false,
  power: true,
  bus: true,
  gateway: true,
  animation: true,
  wireFilter: "all",
};

try {
  const THREE = await import("three");
  const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x12191b);
  scene.fog = new THREE.Fog(0x12191b, 23, 42);

  const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 90);
  camera.position.set(11, 10, 14);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.minDistance = 8;
  controls.maxDistance = 27;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(0, 1.15, 0);
  const initialCamera = camera.position.clone();
  const initialTarget = controls.target.clone();

  scene.add(new THREE.HemisphereLight(0xcbd8df, 0x303235, 2.0));
  const keyLight = new THREE.DirectionalLight(0xffe8c8, 3.2);
  keyLight.position.set(-5, 12, 8);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x76aabd, 2.2);
  rimLight.position.set(9, 7, -8);
  scene.add(rimLight);
  const frontFill = new THREE.PointLight(0xbed3d7, 36, 24);
  frontFill.position.set(0, 6, 8);
  scene.add(frontFill);

  const material = (color, metalness = 0, roughness = 0.55, options = {}) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, ...options });
  const materials = {
    enclosure: material(0x40494b, 0.78, 0.36),
    enclosureDark: material(0x202729, 0.72, 0.42),
    enclosureEdge: material(0x718084, 0.78, 0.3),
    pcb: material(0x176348, 0.12, 0.62),
    pcbDark: material(0x124c3b, 0.1, 0.55),
    solder: material(0xa9b5b4, 0.86, 0.22),
    copper: material(0xb97840, 0.72, 0.31),
    chip: material(0x15191b, 0.18, 0.32),
    ceramic: material(0xd7d6c8, 0.05, 0.5),
    terminal: material(0x26383b, 0.25, 0.42),
    terminalInsert: material(0xcca45f, 0.72, 0.28),
    wireRed: material(0xc84d49, 0.1, 0.42),
    wireBlack: material(0x262d30, 0.08, 0.5),
    wireYellow: material(0xd4b643, 0.08, 0.43),
    wireBlue: material(0x4286b5, 0.1, 0.42),
    wireGreen: material(0x4f9b70, 0.1, 0.42),
    wirePurple: material(0x966bb4, 0.08, 0.43),
    wireWhite: material(0xd5d6cb, 0.04, 0.48),
    statusGreen: new THREE.MeshStandardMaterial({ color: 0x6be29a, emissive: 0x168747, emissiveIntensity: 2.2, roughness: 0.25 }),
    statusAmber: new THREE.MeshStandardMaterial({ color: 0xe8b85d, emissive: 0x886021, emissiveIntensity: 1.5, roughness: 0.25 }),
    statusOff: material(0x533e3a, 0.05, 0.5),
  };

  const roots = new Map();
  const wireMeshes = [];
  const pulseObjects = [];
  const ledObjects = [];
  const telemetryReadouts = new Map();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const clickTargets = [];
  const canvasTextureResources = [];

  function addBox(parent, dimensions, position, mat, options = {}) {
    const geometry = new THREE.BoxGeometry(...dimensions);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(...position);
    mesh.castShadow = options.castShadow !== false;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addCylinder(parent, radiusTop, radiusBottom, length, position, mat, axis = "y", segments = 20) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, length, segments), mat);
    mesh.position.set(...position);
    if (axis === "x") mesh.rotation.z = Math.PI / 2;
    if (axis === "z") mesh.rotation.x = Math.PI / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addTextLabel(parent, text, position, width = 1.6, height = 0.34) {
    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 512;
    labelCanvas.height = 112;
    const context = labelCanvas.getContext("2d");
    context.fillStyle = "#e6e5db";
    context.fillRect(0, 0, labelCanvas.width, labelCanvas.height);
    context.strokeStyle = "#5c6461";
    context.lineWidth = 6;
    context.strokeRect(3, 3, labelCanvas.width - 6, labelCanvas.height - 6);
    context.fillStyle = "#252d2d";
    context.font = "700 38px Segoe UI, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, labelCanvas.width / 2, labelCanvas.height / 2, labelCanvas.width - 24);
    const texture = new THREE.CanvasTexture(labelCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    canvasTextureResources.push(texture);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false }),
    );
    label.position.set(...position);
    label.userData.labelCanvas = labelCanvas;
    label.userData.labelContext = context;
    label.userData.labelTexture = texture;
    parent.add(label);
    return label;
  }

  function updateTextLabel(label, text, textColor) {
    const { labelCanvas, labelContext, labelTexture } = label.userData;
    labelContext.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
    labelContext.fillStyle = "#e6e5db";
    labelContext.fillRect(0, 0, labelCanvas.width, labelCanvas.height);
    labelContext.strokeStyle = "#5c6461";
    labelContext.lineWidth = 6;
    labelContext.strokeRect(3, 3, labelCanvas.width - 6, labelCanvas.height - 6);
    labelContext.fillStyle = textColor;
    labelContext.font = "700 38px Segoe UI, sans-serif";
    labelContext.textAlign = "center";
    labelContext.textBaseline = "middle";
    labelContext.fillText(text, labelCanvas.width / 2, labelCanvas.height / 2, labelCanvas.width - 24);
    labelTexture.needsUpdate = true;
  }

  function addSurfaceMarkings(parent, x, z, width, depth) {
    const lines = new THREE.Group();
    const edge = material(0x42966b, 0.08, 0.48);
    const points = [
      [[x - width / 2 + 0.11, 0.018, z - depth / 2 + 0.11], [x + width / 2 - 0.11, 0.018, z - depth / 2 + 0.11]],
      [[x + width / 2 - 0.11, 0.018, z - depth / 2 + 0.11], [x + width / 2 - 0.11, 0.018, z + depth / 2 - 0.11]],
      [[x + width / 2 - 0.11, 0.018, z + depth / 2 - 0.11], [x - width / 2 + 0.11, 0.018, z + depth / 2 - 0.11]],
      [[x - width / 2 + 0.11, 0.018, z + depth / 2 - 0.11], [x - width / 2 + 0.11, 0.018, z - depth / 2 + 0.11]],
    ];
    points.forEach(([start, end]) => {
      const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...start), new THREE.Vector3(...end)]);
      lines.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: edge.color })));
    });
    parent.add(lines);
  }

  function makeSelectable(id, asset, title, copy, parent = scene) {
    const root = new THREE.Group();
    root.userData = { id, asset, title, copy };
    parent.add(root);
    roots.set(id, root);
    clickTargets.push(root);
    return root;
  }

  function addPanelScrew(parent, position, size = 0.095) {
    const screw = addCylinder(parent, size, size, 0.025, position, materials.solder, "y", 16);
    const slot = addBox(parent, [size * 1.1, 0.008, 0.018], [position[0], position[1] + 0.016, position[2]], materials.chip, { castShadow: false });
    slot.rotation.y = Math.PI / 5;
    return screw;
  }

  function makePcb(parent, center, size, title, asset, id, copy) {
    const root = makeSelectable(id, asset, title, copy, parent);
    const [width, depth] = size;
    addBox(root, [width, 0.12, depth], center, materials.pcb);
    addBox(root, [width - 0.12, 0.012, depth - 0.12], [center[0], center[1] + 0.067, center[2]], materials.pcbDark, { castShadow: false });
    for (const dx of [-width / 2 + 0.13, width / 2 - 0.13]) {
      for (const dz of [-depth / 2 + 0.13, depth / 2 - 0.13]) {
        addCylinder(root, 0.067, 0.067, 0.012, [center[0] + dx, center[1] + 0.076, center[2] + dz], materials.copper, "y", 20);
        addCylinder(root, 0.034, 0.034, 0.013, [center[0] + dx, center[1] + 0.085, center[2] + dz], materials.enclosureDark, "y", 16);
      }
    }
    for (let index = 0; index < Math.floor(width / 0.17); index += 1) {
      const x = center[0] - width / 2 + 0.16 + index * 0.17;
      [-depth / 2 + 0.065, depth / 2 - 0.065].forEach(z => {
        addCylinder(root, 0.043, 0.043, 0.015, [x, center[1] + 0.085, center[2] + z], materials.solder, "y", 14);
        addCylinder(root, 0.015, 0.015, 0.018, [x, center[1] + 0.096, center[2] + z], materials.copper, "y", 10);
      });
    }
    addTextLabel(root, title, [center[0], center[1] + 0.13, center[2] - depth / 2 - 0.2], Math.min(width, 2.4), 0.29);
    return { root, center, width, depth };
  }

  function addIc(parent, x, y, z, size = [0.7, 0.14, 0.52], pins = 6) {
    addBox(parent, size, [x, y, z], materials.chip);
    for (let index = 0; index < pins; index += 1) {
      const offset = (index - (pins - 1) / 2) * 0.075;
      for (const side of [-1, 1]) {
        addBox(parent, [0.1, 0.025, 0.035], [x + offset, y - 0.055, z + side * (size[2] / 2 + 0.015)], materials.solder);
      }
    }
  }

  function addSolderedHeader(parent, x, y, z, count, spacing, direction = "x", color = materials.solder) {
    for (let index = 0; index < count; index += 1) {
      const position = direction === "x"
        ? [x + index * spacing, y, z]
        : [x, y, z + index * spacing];
      addCylinder(parent, 0.025, 0.025, 0.17, [position[0], position[1] + 0.075, position[2]], color, "y", 8);
      addCylinder(parent, 0.05, 0.05, 0.016, [position[0], position[1] + 0.012, position[2]], materials.copper, "y", 12);
      addCylinder(parent, 0.035, 0.035, 0.013, [position[0], position[1] + 0.023, position[2]], materials.solder, "y", 12);
    }
  }

  function addTerminalBlock(parent, x, y, z, count, pitch = 0.23, label = "X1", asset = "instrumentation") {
    const width = count * pitch + 0.14;
    const root = makeSelectable(`terminal-${label}`, asset, `${label} · field marshalling terminals`, "Field conductors enter the terminal strip with ferrules and screw clamps, then leave on separate conditioned signal paths. The tags and measurements are simulated.", parent);
    addBox(root, [width, 0.38, 0.62], [x, y, z], materials.terminal);
    addBox(root, [width + 0.04, 0.07, 0.66], [x, y + 0.225, z], materials.terminalInsert);
    for (let index = 0; index < count; index += 1) {
      const px = x - width / 2 + pitch / 2 + 0.07 + index * pitch;
      addBox(root, [0.16, 0.18, 0.2], [px, y + 0.36, z - 0.08], materials.enclosureDark);
      addCylinder(root, 0.062, 0.062, 0.034, [px, y + 0.47, z - 0.08], materials.solder, "y", 12);
      addBox(root, [0.09, 0.016, 0.016], [px, y + 0.49, z - 0.08], materials.chip);
      const ferruleColor = index % 2 === 0 ? materials.wireWhite : materials.wireBlue;
      addCylinder(root, 0.025, 0.043, 0.22, [px, y + 0.04, z + 0.27], ferruleColor, "z", 10);
      addCylinder(root, 0.028, 0.045, 0.08, [px, y + 0.04, z + 0.4], materials.copper, "z", 10);
      addTextLabel(root, `CH ${String(index + 1).padStart(2, "0")}`, [px, y + 0.52, z + 0.15], 0.25, 0.11);
    }
    addTextLabel(root, label, [x, y + 0.54, z - 0.37], Math.min(width, 1.5), 0.22);
    return root;
  }

  function addDinRail(parent, xCenter, y, z, length) {
    const rail = makeSelectable("din-rail", "instrumentation", "35 mm DIN rail", "Mounting rail carrying the low-voltage power supply, protection/distribution blocks and marshalling terminals. The drawing is illustrative, not a mounting or protection specification.", parent);
    addBox(rail, [length, 0.08, 0.12], [xCenter, y, z], materials.solder);
    addBox(rail, [length, 0.035, 0.18], [xCenter, y - 0.09, z], materials.enclosureEdge);
    for (let x = xCenter - length / 2 + 0.2; x < xCenter + length / 2; x += 0.42) {
      addBox(rail, [0.22, 0.014, 0.055], [x, y + 0.047, z], materials.enclosureDark);
    }
    return rail;
  }

  function addIndustrialModule(id, title, asset, copy, position, dimensions, label) {
    const root = makeSelectable(id, asset, title, copy);
    const [x, y, z] = position;
    const [w, h, d] = dimensions;
    addBox(root, [w, h, d], [x, y, z], materials.enclosure);
    addBox(root, [w + 0.04, h * 0.16, d + 0.025], [x, y + h * 0.43, z], materials.enclosureEdge);
    addBox(root, [w * 0.72, h * 0.38, d * 0.06], [x, y + h * 0.02, z + d / 2 + 0.018], materials.enclosureDark);
    for (let slot = 0; slot < 5; slot += 1) {
      addBox(root, [w * 0.56, 0.018, 0.014], [x, y - h * 0.14 + slot * h * 0.055, z + d / 2 + 0.055], materials.enclosureEdge);
    }
    for (let screw = -1; screw <= 1; screw += 2) {
      addPanelScrew(root, [x + screw * (w / 2 - 0.11), y - h * 0.34, z + d / 2 + 0.07], 0.04);
    }
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), materials.statusGreen);
    led.position.set(x + w * 0.32, y + h * 0.03, z + d / 2 + 0.07);
    root.add(led);
    ledObjects.push({ mesh: led, role: id === "power-supply" ? "power" : "signal" });
    addTextLabel(root, label, [x, y + h / 2 + 0.15, z], Math.min(w + 0.2, 1.9), 0.23);
    return root;
  }

  function addCableCurve(parent, id, points, mat, radius, kind, asset, title, copy, animate = true) {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    const geometry = new THREE.TubeGeometry(curve, Math.max(24, points.length * 12), radius, 8, false);
    const wire = new THREE.Mesh(geometry, mat);
    wire.castShadow = true;
    wire.userData.wireKind = kind;
    wire.userData.wireId = id;
    wire.userData.curve = curve;
    wire.userData.asset = asset;
    parent.add(wire);
    wireMeshes.push(wire);

    if (animate && kind !== "power") {
      const pulse = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 2.5, 10, 8),
        new THREE.MeshBasicMaterial({ color: mat.color, toneMapped: false }),
      );
      pulse.userData = { curve, phase: Math.random(), wireKind: kind };
      parent.add(pulse);
      pulseObjects.push(pulse);
    }
    return wire;
  }

  function createCableBundle(parent, start, end, color, kind, id, asset, label) {
    const [sx, sy, sz] = start;
    const [ex, ey, ez] = end;
    const routeZ = Math.max(sz, ez) + 0.65 + (wireMeshes.length % 3) * 0.12;
    addCableCurve(parent, id, [
      [sx, sy, sz],
      [sx, sy + 0.28, sz],
      [sx, sy + 0.4, routeZ],
      [ex, ey + 0.32, routeZ],
      [ex, ey, ez],
    ], color, 0.032, kind, asset, label, "Hard-wired conductor shown as a routed cable in the interactive 3D assembly.");
    for (const [x, y, z] of [start, end]) {
      addCylinder(parent, 0.055, 0.055, 0.12, [x, y, z], materials.enclosureDark, "y", 16);
      addCylinder(parent, 0.025, 0.025, 0.08, [x, y + 0.025, z], materials.copper, "y", 12);
    }
  }

  const workSurface = new THREE.Mesh(
    new THREE.BoxGeometry(20, 0.34, 12),
    material(0x333b3d, 0.58, 0.5),
  );
  workSurface.position.set(0, -0.22, 0);
  workSurface.receiveShadow = true;
  workSurface.castShadow = true;
  scene.add(workSurface);

  const backplate = new THREE.Mesh(
    new THREE.BoxGeometry(17.8, 5.9, 0.18),
    material(0x515b5d, 0.68, 0.42),
  );
  backplate.position.set(0, 3.0, -3.0);
  backplate.receiveShadow = true;
  backplate.castShadow = true;
  scene.add(backplate);
  addBox(scene, [17.8, 0.075, 0.28], [0, 0.58, -2.82], materials.enclosureDark);

  addIndustrialModule(
    "power-supply", "24 VDC field supply", "instrumentation",
    "DIN-rail low-voltage power-supply enclosure represented as a generic component. Mains input, current rating, protective coordination, certifications and wiring are intentionally not specified.",
    [-6.3, 2.0, -1.45], [2.6, 1.65, 1.05], "24 VDC · PSU-01",
  );
  addIndustrialModule(
    "distribution", "UPS / isolator / fused distribution", "instrumentation",
    "Represents a protected low-voltage distribution chain. The power toggle changes this illustrative state only; it is not a breaker trip curve or electrical design.",
    [-3.55, 1.86, -1.45], [1.8, 1.35, 0.92], "UPS · QF · DC RAIL",
  );
  addDinRail(scene, -4.7, 1.05, -1.44, 6.4);

  const controller = makePcb(
    scene, [0.05, 1.55, -0.85], [3.65, 2.45], "MCU-01 · CONTROLLER PCB", "gateway", "controller",
    "Generic microcontroller carrier with soldered component footprints, a controller module, plated through-hole headers and solder joints. The browser performs the simulation; no firmware runs on a physical microcontroller.",
  );
  addIc(controller.root, 0.05, 1.82, -0.86, [0.82, 0.16, 0.7], 8);
  addTextLabel(controller.root, "ESP32-CLASS MCU", [0.05, 1.8, -0.86], 1.05, 0.23);
  addSolderedHeader(controller.root, -1.48, 1.63, -1.8, 10, 0.17);
  addSolderedHeader(controller.root, -1.48, 1.63, 0.1, 10, 0.17);
  addSolderedHeader(controller.root, -1.65, 1.63, -1.56, 8, 0.17, "z");
  addSolderedHeader(controller.root, 1.55, 1.63, -1.56, 8, 0.17, "z");
  addBox(controller.root, [0.44, 0.28, 0.22], [0.05, 1.75, -2.02], materials.solder);
  addBox(controller.root, [0.32, 0.16, 0.12], [0.05, 1.76, -2.18], materials.enclosureDark);
  for (let component = 0; component < 8; component += 1) {
    const x = -1.12 + (component % 4) * 0.72;
    const z = -0.45 + Math.floor(component / 4) * 0.78;
    addBox(controller.root, [0.22, 0.13, 0.18], [x, 1.72, z], materials.chip);
    addCylinder(controller.root, 0.08, 0.08, 0.16, [x + 0.2, 1.76, z + 0.18], materials.ceramic, "y", 14);
    addCylinder(controller.root, 0.025, 0.025, 0.16, [x - 0.2, 1.76, z + 0.18], materials.copper, "y", 12);
  }
  addSurfaceMarkings(controller.root, 0.05, -0.85, 3.65, 2.45);

  const analog = makePcb(
    scene, [-2.65, 1.27, 1.18], [2.65, 1.48], "AI-01 · ISOLATED ANALOG INPUT", "instrumentation", "analog-input",
    "Isolated industrial analog-input interface board. The field-loop conductors terminate at screw terminals and are conditioned before a logic-level data link. Signal ranges and channel wiring are not defined here.",
  );
  addIc(analog.root, -2.65, 1.52, 1.18, [0.6, 0.14, 0.46], 6);
  addTerminalBlock(analog.root, -3.25, 1.37, 1.18, 4, 0.34, "AI", "instrumentation");
  addSolderedHeader(analog.root, -3.55, 1.35, 1.75, 6, 0.18);

  const rtd = addIndustrialModule(
    "rtd-input", "RTD temperature front-end", "heat-exchanger",
    "Dedicated RTD measurement interface for TT-101/TT-102. Field sensor leads land at terminals; conditioning occurs on the interface before controller communications. This is not a verified PT100 connection schematic.",
    [-0.2, 1.42, 1.26], [2.05, 0.82, 1.12], "RTD · TT-101 / TT-102",
  );
  addTerminalBlock(rtd, -0.2, 1.05, 1.26, 4, 0.32, "RTD", "heat-exchanger");
  addIc(rtd, -0.2, 1.58, 1.24, [0.42, 0.14, 0.34], 5);

  const vibration = makePcb(
    scene, [2.25, 1.29, 1.25], [1.8, 1.25], "VIB-01 · CONDITION INPUT", "transfer-pump", "vibration-input",
    "Condition-monitor interface for the simulated pump vibration tag. Real measurement chains require suitable sensor selection, mounting, signal bandwidth and calibration.",
  );
  addCylinder(vibration.root, 0.34, 0.34, 0.18, [2.25, 1.48, 1.25], materials.enclosureEdge, "y", 28);
  addCylinder(vibration.root, 0.23, 0.23, 0.19, [2.25, 1.59, 1.25], material(0x2c4650, 0.45, 0.32), "y", 28);
  addCylinder(vibration.root, 0.07, 0.07, 0.2, [2.25, 1.7, 1.25], materials.terminalInsert, "y", 16);
  addSolderedHeader(vibration.root, 1.62, 1.37, 1.7, 5, 0.18);

  const rs485 = makePcb(
    scene, [4.55, 1.26, 1.18], [2.0, 1.45], "COM-01 · ISOLATED RS-485", "gateway", "rs485-interface",
    "Isolated RS-485 interface represented between controller communications and the read-only edge gateway. Bus polarity, termination and device-specific pinouts are not specified.",
  );
  addIc(rs485.root, 4.5, 1.5, 1.18, [0.58, 0.14, 0.4], 6);
  addTerminalBlock(rs485.root, 4.55, 1.12, 1.18, 4, 0.32, "A · B", "gateway");
  addSolderedHeader(rs485.root, 3.82, 1.35, 1.68, 6, 0.17);

  const gateway = addIndustrialModule(
    "gateway", "Read-only edge gateway", "gateway",
    "Generic gateway enclosure representing a read-only data route. In this browser prototype, Modbus and OPC UA panels display local synthetic values only; nothing is transmitted over Ethernet.",
    [6.1, 2.03, -1.45], [2.45, 1.68, 1.05], "GW-01 · READ ONLY",
  );
  addBox(gateway, [0.52, 0.28, 0.14], [6.1, 1.81, -0.88], materials.enclosureDark);
  for (let pin = 0; pin < 8; pin += 1) {
    addBox(gateway, [0.034, 0.17, 0.02], [5.88 + pin * 0.063, 1.82, -0.79], materials.terminalInsert);
  }

  const fieldBox = makeSelectable(
    "field-marshalling", "instrumentation", "Field cable glands & marshalling strip",
    "Ten simulated transmitter pairs enter through cable glands and terminate at labeled screw terminal channels. Real field-device interfaces, area classification and protective requirements vary by asset and require approved engineering drawings.",
  );
  addBox(fieldBox, [11.8, 0.22, 2.5], [0, 0.42, 3.0], materials.enclosureDark);
  addBox(fieldBox, [11.7, 0.08, 2.4], [0, 0.57, 3.0], materials.enclosureEdge);
  const sensorTags = ["LT-101", "PT-101", "PT-102", "FT-101", "DPIT-101", "TT-101", "TT-102", "VIB-101", "EM-101", "LT-102"];
  const sensorAssets = ["feed-tank", "transfer-pump", "transfer-pump", "transfer-pump", "filter", "heat-exchanger", "heat-exchanger", "transfer-pump", "transfer-pump", "receiver-tank"];
  const fieldPositions = [];
  sensorTags.forEach((tag, index) => {
    const x = -5.1 + index * 1.13;
    const root = makeSelectable(
      `tag-${tag}`, sensorAssets[index], `${tag} · ${tagDetails[tag][0]}`, tagDetails[tag][2], fieldBox,
    );
    fieldPositions.push([x, 0.88, 2.68]);
    addCylinder(root, 0.12, 0.15, 0.42, [x, 0.84, 2.3], materials.enclosureEdge, "z", 18);
    addCylinder(root, 0.052, 0.052, 0.2, [x, 0.84, 2.0], materials.terminalInsert, "z", 14);
    addBox(root, [0.82, 0.36, 0.62], [x, 0.86, 2.95], materials.terminal);
    addBox(root, [0.78, 0.06, 0.6], [x, 1.075, 2.95], materials.terminalInsert);
    addCylinder(root, 0.075, 0.075, 0.04, [x, 1.13, 2.82], materials.solder, "y", 14);
    addBox(root, [0.11, 0.02, 0.018], [x, 1.153, 2.82], materials.chip);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), materials.statusGreen);
    lamp.position.set(x + 0.26, 1.12, 3.17);
    root.add(lamp);
    ledObjects.push({ mesh: lamp, role: "signal" });
    addTextLabel(root, tag, [x, 1.31, 3.0], 0.8, 0.2);
    telemetryReadouts.set(tag, addTextLabel(root, "NO DATA", [x, 0.62, 3.3], 0.96, 0.18));
  });
  addTextLabel(fieldBox, "XTB-01 · SIMULATED FIELD LOOP MARSHALLING", [0, 1.55, 3.0], 4.4, 0.28);

  const controllerPin = [-0.95, 1.74, 0.4];
  const analogPin = [-1.55, 1.43, 1.68];
  const rtdPin = [0.35, 1.85, 1.78];
  const vibPin = [1.5, 1.45, 1.75];
  const rsPin = [3.85, 1.46, 1.78];
  createCableBundle(scene, [-6.3, 2.05, -0.9], [-3.55, 2.0, -0.95], materials.wireRed, "power", "psu-to-fused-rail", "instrumentation", "DC supply to distribution");
  createCableBundle(scene, [-3.55, 1.95, -0.95], [-0.95, 1.78, -0.65], materials.wireRed, "power", "logic-power", "gateway", "Fused low-voltage logic supply");
  createCableBundle(scene, [-3.55, 1.8, -0.95], [-2.3, 1.47, 0.65], materials.wireRed, "power", "analog-power", "instrumentation", "Interface module supply");
  createCableBundle(scene, [-3.55, 1.75, -0.9], [0.25, 1.65, 0.73], materials.wireBlack, "power", "common-return", "instrumentation", "Low-voltage common return");

  fieldPositions.forEach((position, index) => {
    const tag = sensorTags[index];
    const end = tag === "TT-101" || tag === "TT-102"
      ? [rtdPin[0] + (tag === "TT-101" ? -0.24 : 0.24), rtdPin[1], rtdPin[2]]
      : tag === "VIB-101"
        ? vibPin
        : tag === "EM-101"
          ? [rsPin[0] + 0.28, rsPin[1], rsPin[2]]
          : analogPin;
    const start = [position[0], 0.88, 2.0];
    const midZ = tag === "TT-101" || tag === "TT-102" ? 2.1 : 1.95 + (index % 3) * 0.13;
    const color = tag.startsWith("TT") ? materials.wirePurple
      : tag === "VIB-101" ? materials.wireYellow
        : tag === "EM-101" ? materials.wireBlue
          : index % 2 === 0 ? materials.wireWhite : materials.wireYellow;
    addCableCurve(scene, `field-${tag}`, [
      start,
      [start[0], 1.34, midZ],
      [end[0], end[1] + 0.2, midZ],
      end,
    ], color, 0.026, tag === "EM-101" ? "data" : "signal", sensorAssets[index], `${tag} field lead`, tagDetails[tag][2], false);
  });
  createCableBundle(scene, analogPin, controllerPin, materials.wireYellow, "signal", "adc-controller", "instrumentation", "Conditioned analog data");
  createCableBundle(scene, rtdPin, [-0.15, 1.77, 0.42], materials.wirePurple, "signal", "rtd-controller", "heat-exchanger", "Temperature front-end data");
  createCableBundle(scene, vibPin, [0.45, 1.78, 0.4], materials.wireYellow, "signal", "vibration-controller", "transfer-pump", "Condition monitor data");
  createCableBundle(scene, rsPin, controllerPin, materials.wireBlue, "data", "controller-rs485", "gateway", "Differential serial link");
  createCableBundle(scene, [rsPin[0] + 0.15, rsPin[1], rsPin[2]], [5.0, 1.75, -0.85], materials.wireBlue, "data", "rs485-gateway", "gateway", "Read-only gateway data interface");
  addCableCurve(scene, "gateway-ethernet", [
    [6.88, 1.8, -1.4], [7.6, 1.8, -1.4], [7.6, 1.8, -2.2], [8.2, 1.8, -2.2],
  ], materials.wireGreen, 0.045, "data", "gateway", "Illustrative Ethernet link", "The model displays the browser's local synthetic snapshot; this cable animation does not represent real traffic.", true);

  const instrumentAssets = [
    { id: "asset-feed-tank", asset: "feed-tank", title: "TK-101 · Feed tank", position: [-8.0, 3.0, -2.78], color: 0xc9a15b },
    { id: "asset-pump", asset: "transfer-pump", title: "P-101 · Transfer pump", position: [-5.5, 3.0, -2.78], color: 0x7db8c8 },
    { id: "asset-filter", asset: "filter", title: "F-101 · Filter", position: [-3.0, 3.0, -2.78], color: 0xd49b4c },
    { id: "asset-hx", asset: "heat-exchanger", title: "E-101 · Heat exchanger", position: [-0.5, 3.0, -2.78], color: 0xc39ad5 },
    { id: "asset-receiver", asset: "receiver-tank", title: "TK-102 · Receiver tank", position: [2.0, 3.0, -2.78], color: 0x6dbd9a },
  ];
  instrumentAssets.forEach(item => {
    const root = makeSelectable(item.id, item.asset, item.title, `Associated process asset. Its displayed sensor readings come from the browser-generated transfer-skid simulation.`, scene);
    const mat = material(item.color, 0.4, 0.4);
    addCylinder(root, 0.12, 0.12, 0.04, item.position, mat, "z", 16);
    addCylinder(root, 0.055, 0.055, 0.05, [item.position[0], item.position[1], item.position[2] + 0.04], materials.statusGreen, "z", 16);
    addTextLabel(root, item.title, [item.position[0], item.position[1] + 0.42, item.position[2] + 0.05], 1.55, 0.23);
  });

  const dashboardRoot = makeSelectable(
    "dashboard-node", "gateway", "RefinAI dashboard", "This browser renders the synthetic process state. The illustrated network path is not connected to a physical network or gateway.",
  );
  addBox(dashboardRoot, [1.3, 0.88, 0.1], [8.25, 2.55, -1.9], materials.enclosureDark);
  addBox(dashboardRoot, [1.12, 0.65, 0.03], [8.25, 2.58, -1.83], material(0x1a3435, 0.08, 0.2, { emissive: 0x0d2927, emissiveIntensity: 0.3 }));
  addTextLabel(dashboardRoot, "REFINAI · LOCAL", [8.25, 3.03, -1.82], 1.1, 0.18);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    material(0x151b1d, 0.1, 0.9),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.42;
  floor.receiveShadow = true;
  scene.add(floor);

  function selectComponent(component) {
    const metadata = component.userData;
    if (!metadata?.title) return;
    assemblyState.selectedComponent = metadata.id;
    detail.kicker.textContent = "PHYSICAL ASSEMBLY · SIMULATED";
    detail.title.textContent = metadata.title;
    detail.copy.textContent = metadata.copy;
    window.dispatchEvent(new CustomEvent("refinai:hardware-component-select", {
      detail: { asset: metadata.asset },
    }));
  }

  function setWireFilter(filter) {
    assemblyState.wireFilter = filter;
    wireMeshes.forEach(wire => {
      wire.visible = filter === "all" || wire.userData.wireKind === filter;
    });
    pulseObjects.forEach(pulse => {
      pulse.visible = assemblyState.animation && (filter === "all" || pulse.userData.wireKind === filter);
    });
  }

  function updateAssemblyState(state) {
    assemblyState.telemetryStale = Boolean(state.telemetryStale);
    assemblyState.power = state.power !== false;
    assemblyState.bus = state.bus !== false;
    assemblyState.gateway = state.gateway !== false;
    const pathAvailable = !assemblyState.telemetryStale && assemblyState.power && assemblyState.bus && assemblyState.gateway;
    status.textContent = !assemblyState.power ? "POWER OFF · SIGNALS STALE"
      : !assemblyState.bus ? "FIELD BUS OFF · VALUES STALE"
        : !assemblyState.gateway ? "GATEWAY OFFLINE · VALUES STALE"
          : assemblyState.telemetryStale ? "TELEMETRY STALE"
            : "SIMULATED SENSOR VALUES · LIVE";
    status.classList.toggle("health-chip-alert", !pathAvailable);
    ledObjects.forEach(item => {
      item.mesh.material = item.role === "power"
        ? assemblyState.power ? materials.statusGreen : materials.statusOff
        : pathAvailable ? materials.statusGreen : materials.statusAmber;
    });
    wireMeshes.forEach(wire => {
      const kind = wire.userData.wireKind;
      wire.material.opacity = kind === "power" ? (assemblyState.power ? 1 : 0.14)
        : kind === "signal" ? (assemblyState.power && assemblyState.bus ? 1 : 0.14)
          : (pathAvailable ? 1 : 0.14);
      wire.material.transparent = wire.material.opacity < 1;
    });
    telemetryReadouts.forEach((label, tag) => {
      const [field, unit, precision] = tagReadouts[tag];
      const value = state.values?.[field];
      const text = Number.isFinite(value) ? `${value.toFixed(precision)} ${unit}` : "NO DATA";
      updateTextLabel(label, text, pathAvailable ? "#252d2d" : "#815f2d");
    });
  }

  canvas.addEventListener("pointerdown", event => {
    const bounds = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(clickTargets, true).find(intersection => {
      let current = intersection.object;
      while (current && !current.userData?.title) current = current.parent;
      return Boolean(current);
    });
    if (hit) {
      let current = hit.object;
      while (current && !current.userData?.title) current = current.parent;
      selectComponent(current);
    }
  });

  document.querySelectorAll(".bench-filter").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".bench-filter").forEach(filterButton => {
        const active = filterButton === button;
        filterButton.classList.toggle("active", active);
        filterButton.setAttribute("aria-pressed", String(active));
      });
      setWireFilter(button.dataset.wireFilter);
    });
  });
  document.getElementById("bench-animate").addEventListener("click", event => {
    assemblyState.animation = !assemblyState.animation;
    event.currentTarget.setAttribute("aria-pressed", String(assemblyState.animation));
    event.currentTarget.textContent = assemblyState.animation ? "Pause data pulses" : "Resume data pulses";
    setWireFilter(assemblyState.wireFilter);
  });
  document.getElementById("bench-reset-view").addEventListener("click", () => {
    camera.position.copy(initialCamera);
    controls.target.copy(initialTarget);
    controls.update();
  });
  window.addEventListener("refinai:hardware-lab-update", event => updateAssemblyState(event.detail));
  window.addEventListener("refinai:hardware-component-select", event => {
    const asset = event.detail?.asset;
    if (asset) document.querySelector(`#asset-tree [data-asset="${asset}"]`)?.click();
  });
  window.addEventListener("refinai:hardware-view-active", () => resize());
  if (window.refinaiHardwareSnapshot) updateAssemblyState(window.refinaiHardwareSnapshot);

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1) return;
    renderer.setSize(bounds.width, bounds.height, false);
    camera.aspect = bounds.width / bounds.height;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas.parentElement);
  window.addEventListener("resize", resize);
  requestAnimationFrame(resize);

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    pulseObjects.forEach(pulse => {
      pulse.position.copy(pulse.userData.curve.getPoint((elapsed * 0.13 + pulse.userData.phase) % 1));
    });
    controls.update();
    renderer.render(scene, camera);
  }

  selectComponent(roots.get("controller"));
  animate();
} catch (error) {
  status.textContent = "3D hardware model unavailable";
  status.classList.add("health-chip-alert");
  detail.kicker.textContent = "3D RENDERER ERROR";
  detail.title.textContent = "Unable to display the hardware model";
  detail.copy.textContent = error instanceof Error ? error.message : String(error);
  console.error("Unable to initialize the interactive 3D hardware assembly.", error);
}
