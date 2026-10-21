const canvas = document.getElementById("multistream-canvas");
const status = document.getElementById("multistream-status");
const detail = document.getElementById("multistream-detail");

const streams = [
  {
    id: "air",
    title: "AIR CLEANING",
    color: 0x6aa9c5,
    z: 4.35,
    stages: [
      ["Intake", "Open intake hood draws the illustrative ambient-air stream."],
      ["Blower", "Blower moves the simulated air flow through the treatment train."],
      ["Particle filter", "Filter stage changes simulated PM readings; bypass raises outlet particles."],
      ["Carbon bed", "Adsorption-bed representation reduces the illustrative VOC indication."],
      ["Stack", "Outlet sampling point reports PM, CO2 and VOC estimates."],
    ],
  },
  {
    id: "water",
    title: "WATER TREATMENT",
    color: 0x359cc0,
    z: 1.45,
    stages: [
      ["Raw-water tank", "Feed inventory for the illustrative water-treatment line."],
      ["Transfer pump", "Moves simulated feed through the treatment equipment."],
      ["Media filter", "Filter condition affects the simulated outlet turbidity."],
      ["Treatment vessel", "Generic conditioning vessel; no chemistry or dose recipe is modeled."],
      ["Treated tank", "Outlet sample point reports simulated pH, turbidity and conductivity."],
    ],
  },
  {
    id: "gas",
    title: "GAS CONDITIONING",
    color: 0xd2ad62,
    z: -1.45,
    stages: [
      ["Feed separator", "Knockout-vessel representation separates a conceptual liquid carryover."],
      ["Compressor", "Illustrative compression stage; pressure values are synthetic."],
      ["Scrubber", "Generic scrubber stage changes the simulated H2S indication when bypassed."],
      ["Gas cooler", "Heat-exchanger representation ahead of the product header."],
      ["Gas header", "Outlet sampling point reports synthetic pressure, H2S and methane."],
    ],
  },
  {
    id: "oil",
    title: "OIL CONDITIONING",
    color: 0xb87945,
    z: -4.35,
    stages: [
      ["Feed tank", "Feed inventory follows the transfer-skid feed-tank balance."],
      ["Transfer pump", "Pump speed and valve opening determine simulated oil flow."],
      ["Coalescer", "Generic separation stage is shown; water-content readings are synthetic and are not calculated by a separation model."],
      ["Oil filter", "Filter restriction and bypass alter illustrative particle-count readings."],
      ["Heat exchanger", "Outlet temperature follows the transfer-skid heat-effectiveness model."],
      ["Receiver", "Outlet inventory follows the transfer-skid receiver balance."],
    ],
  },
];

try {
  const THREE = await import("three");
  const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x151c1e);
  scene.fog = new THREE.Fog(0x151c1e, 38, 72);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(19, 19, 24);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.minDistance = 17;
  controls.maxDistance = 58;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.target.set(0, 1.05, 0);
  const initialCamera = camera.position.clone();
  const initialTarget = controls.target.clone();
  const initialCameraOffset = initialCamera.clone().sub(initialTarget);
  let viewInteracted = false;
  controls.addEventListener("start", () => { viewInteracted = true; });

  scene.add(new THREE.HemisphereLight(0xd5e3e7, 0x45494a, 2.5));
  const key = new THREE.DirectionalLight(0xffe7c7, 4);
  key.position.set(-7, 16, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x78b8ca, 2.5);
  rim.position.set(12, 10, -12);
  scene.add(rim);

  const makeMaterial = (color, metalness = 0.35, roughness = 0.48, options = {}) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, ...options });
  const materials = {
    steel: makeMaterial(0x657175, 0.72, 0.38),
    brightSteel: makeMaterial(0xa4b0af, 0.78, 0.29),
    darkSteel: makeMaterial(0x303a3d, 0.64, 0.43),
    concrete: makeMaterial(0x343d3e, 0.22, 0.79),
    glass: makeMaterial(0x8eb5bb, 0.22, 0.23, { transparent: true, opacity: 0.28, depthWrite: false }),
    statusGood: makeMaterial(0x51cf8c, 0.05, 0.28, { emissive: 0x126338, emissiveIntensity: 1.5 }),
    statusWarn: makeMaterial(0xe8b553, 0.05, 0.3, { emissive: 0x69481b, emissiveIntensity: 1.2 }),
    statusOff: makeMaterial(0x65433f, 0.05, 0.45),
    air: makeMaterial(0x6aa9c5, 0.48, 0.34, { emissive: 0x183947, emissiveIntensity: 0.25 }),
    water: makeMaterial(0x359cc0, 0.48, 0.34, { emissive: 0x103746, emissiveIntensity: 0.26 }),
    gas: makeMaterial(0xd2ad62, 0.5, 0.35, { emissive: 0x493719, emissiveIntensity: 0.24 }),
    oil: makeMaterial(0xb87945, 0.52, 0.36, { emissive: 0x48230f, emissiveIntensity: 0.25 }),
    bypass: makeMaterial(0xe8b553, 0.18, 0.35, { emissive: 0x795016, emissiveIntensity: 0.65 }),
  };

  const root = new THREE.Group();
  scene.add(root);
  const selectable = [];
  const equipmentStates = new Map();
  const bypassPipes = new Map();
  const flowParticles = [];
  const tankFills = new Map();
  const rotatingParts = [];
  const labelTextures = [];

  function addMesh(parent, geometry, material, position) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addPipe(parent, start, end, radius, material) {
    const first = new THREE.Vector3(...start);
    const second = new THREE.Vector3(...end);
    const direction = second.clone().sub(first);
    const mesh = addMesh(
      parent,
      new THREE.CylinderGeometry(radius, radius, direction.length(), 12),
      material,
      [0, 0, 0],
    );
    mesh.position.copy(first).add(second).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return mesh;
  }

  function addLabel(text, position, scale = [1.72, 0.3, 1]) {
    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 512;
    labelCanvas.height = 92;
    const context = labelCanvas.getContext("2d");
    context.fillStyle = "rgba(15,23,25,.94)";
    context.fillRect(0, 0, labelCanvas.width, labelCanvas.height);
    context.strokeStyle = "#718285";
    context.lineWidth = 4;
    context.strokeRect(2, 2, labelCanvas.width - 4, labelCanvas.height - 4);
    context.fillStyle = "#e6ece8";
    context.font = "700 30px Segoe UI, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, labelCanvas.width / 2, labelCanvas.height / 2, labelCanvas.width - 20);
    const texture = new THREE.CanvasTexture(labelCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    labelTextures.push(texture);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      toneMapped: false,
    }));
    sprite.position.set(...position);
    sprite.scale.set(...scale);
    root.add(sprite);
    return sprite;
  }

  function makeEquipment(stream, stageIndex, position, kind) {
    const [x, y, z] = position;
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.userData = {
      stream: stream.id,
      title: stream.stages[stageIndex][0],
      description: stream.stages[stageIndex][1],
    };
    root.add(group);
    selectable.push(group);
    const vesselMat = materials.steel;

    if (kind === "intake") {
      addMesh(group, new THREE.BoxGeometry(0.95, 1.05, 0.9), materials.darkSteel, [0, 0.7, 0]);
      addMesh(group, new THREE.BoxGeometry(1.18, 0.09, 1.08), materials.brightSteel, [0, 1.25, 0]);
      addMesh(group, new THREE.BoxGeometry(0.7, 0.07, 0.7), materials[stream.id], [0, 1.34, 0]);
    } else if (kind === "pump" || kind === "compressor" || kind === "blower") {
      addMesh(group, new THREE.BoxGeometry(0.95, 0.7, 0.76), materials.darkSteel, [-0.16, 0.52, 0]);
      for (let fin = 0; fin < 5; fin += 1) {
        addMesh(group, new THREE.BoxGeometry(0.07, 0.8, 0.84), materials.steel, [-0.52 + fin * 0.17, 0.54, 0]);
      }
      addMesh(group, new THREE.CylinderGeometry(0.36, 0.36, 0.56, 24), materials[stream.id], [0.57, 0.52, 0]).rotation.z = Math.PI / 2;
      const rotor = new THREE.Group();
      rotor.position.set(0.85, 0.52, 0);
      group.add(rotor);
      addMesh(rotor, new THREE.CylinderGeometry(0.12, 0.12, 0.65, 18), materials.brightSteel, [0, 0, 0]).rotation.z = Math.PI / 2;
      for (let blade = 0; blade < 4; blade += 1) {
        const fin = addMesh(rotor, new THREE.BoxGeometry(0.06, 0.42, 0.08), materials.brightSteel, [0, 0, 0]);
        fin.rotation.x = blade * Math.PI / 4;
      }
      addMesh(group, new THREE.BoxGeometry(1.4, 0.12, 1.08), materials.darkSteel, [0.12, 0.08, 0]);
      rotatingParts.push({ rotor, stream: stream.id });
    } else if (kind === "filter" || kind === "carbon" || kind === "treatment" || kind === "scrubber" || kind === "separator" || kind === "column") {
      const height = kind === "scrubber" || kind === "column" ? 2.05 : 1.65;
      const radius = kind === "separator" ? 0.68 : 0.48;
      addMesh(group, new THREE.CylinderGeometry(radius, radius, height, 24), kind === "separator" ? materials.glass : vesselMat, [0, height / 2 + 0.2, 0]);
      addMesh(group, new THREE.CylinderGeometry(radius + 0.08, radius + 0.08, 0.1, 24), materials.brightSteel, [0, 0.25, 0]);
      addMesh(group, new THREE.CylinderGeometry(radius + 0.08, radius + 0.08, 0.1, 24), materials.brightSteel, [0, height + 0.15, 0]);
      addMesh(group, new THREE.CylinderGeometry(radius * 1.06, radius * 1.06, 0.12, 24), materials[stream.id], [0, height * 0.56, 0]);
      addMesh(group, new THREE.CylinderGeometry(0.14, 0.14, 0.24, 16), materials.darkSteel, [0, height + 0.3, 0]);
      for (const legX of [-0.31, 0.31]) {
        addMesh(group, new THREE.BoxGeometry(0.1, 0.35, 0.1), materials.darkSteel, [legX, 0.11, 0.25]);
      }
    } else if (kind === "tank") {
      addMesh(group, new THREE.CylinderGeometry(0.7, 0.7, 1.9, 28, 1, true), materials.glass, [0, 1.2, 0]);
      addMesh(group, new THREE.CylinderGeometry(0.7, 0.7, 0.1, 28), materials.brightSteel, [0, 0.25, 0]);
      addMesh(group, new THREE.CylinderGeometry(0.7, 0.7, 0.1, 28), materials.brightSteel, [0, 2.15, 0]);
      const liquid = addMesh(group, new THREE.CylinderGeometry(0.57, 0.57, 1, 24), materials[stream.id], [0, 0.85, 0]);
      tankFills.set(`${stream.id}-${stageIndex}`, liquid);
      for (const legX of [-0.43, 0.43]) {
        addMesh(group, new THREE.BoxGeometry(0.12, 0.35, 0.12), materials.darkSteel, [legX, 0.1, 0.28]);
      }
    } else if (kind === "exchanger" || kind === "cooler") {
      const body = addMesh(group, new THREE.CylinderGeometry(0.48, 0.48, 1.55, 28), vesselMat, [0, 0.84, 0]);
      body.rotation.z = Math.PI / 2;
      for (const flangeX of [-0.83, 0.83]) {
        const flange = addMesh(group, new THREE.CylinderGeometry(0.57, 0.57, 0.12, 24), materials.brightSteel, [flangeX, 0.84, 0]);
        flange.rotation.z = Math.PI / 2;
      }
      for (const pipeZ of [-0.28, 0.28]) {
        addPipe(group, [-0.42, 1.25, pipeZ], [0.42, 1.25, pipeZ], 0.045, materials[stream.id]);
      }
      addMesh(group, new THREE.BoxGeometry(1.8, 0.12, 1.18), materials.darkSteel, [0, 0.08, 0]);
    } else if (kind === "stack") {
      addMesh(group, new THREE.CylinderGeometry(0.3, 0.42, 2.15, 20), vesselMat, [0, 1.28, 0]);
      addMesh(group, new THREE.CylinderGeometry(0.48, 0.48, 0.12, 20), materials.brightSteel, [0, 2.4, 0]);
      addMesh(group, new THREE.CylinderGeometry(0.13, 0.13, 0.45, 16), materials[stream.id], [0, 2.65, 0]);
    } else if (kind === "header") {
      const body = addMesh(group, new THREE.CylinderGeometry(0.39, 0.39, 1.55, 24), vesselMat, [0, 0.78, 0]);
      body.rotation.z = Math.PI / 2;
      addMesh(group, new THREE.CylinderGeometry(0.47, 0.47, 0.1, 20), materials.brightSteel, [-0.82, 0.78, 0]).rotation.z = Math.PI / 2;
      addMesh(group, new THREE.CylinderGeometry(0.47, 0.47, 0.1, 20), materials.brightSteel, [0.82, 0.78, 0]).rotation.z = Math.PI / 2;
    }

    const lamp = addMesh(group, new THREE.SphereGeometry(0.085, 12, 10), materials.statusGood, [0.55, 1.85, 0.34]);
    equipmentStates.set(`${stream.id}-${stageIndex}`, { lamp, stream: stream.id });
    addLabel(stream.stages[stageIndex][0], [x, 3.35, z], [1.58, 0.28, 1]);
    return group;
  }

  const foundation = addMesh(root, new THREE.BoxGeometry(19.2, 0.28, 11.8), materials.concrete, [0, -0.16, 0]);
  foundation.receiveShadow = true;
  for (let row = 0; row < 4; row += 1) {
    const stream = streams[row];
    const pipeMaterial = materials[stream.id];
    addMesh(root, new THREE.BoxGeometry(18.7, 0.07, 0.045), pipeMaterial, [0, 0.52, stream.z]);
    addLabel(stream.title, [-8.45, 3.7, stream.z + 0.5], [2.05, 0.34, 1]);

    const equipmentKinds = stream.id === "air"
      ? ["intake", "blower", "filter", "carbon", "stack"]
      : stream.id === "water"
        ? ["tank", "pump", "filter", "treatment", "tank"]
        : stream.id === "gas"
          ? ["separator", "compressor", "scrubber", "cooler", "header"]
          : ["tank", "pump", "treatment", "filter", "exchanger", "tank"];
    const positions = equipmentKinds.length === 6
      ? [-7.1, -4.25, -1.4, 1.4, 4.25, 7.1]
      : [-7.1, -3.55, 0, 3.55, 7.1];

    equipmentKinds.forEach((kind, index) => {
      makeEquipment(stream, index, [positions[index], 0, stream.z], kind);
      if (index < equipmentKinds.length - 1) {
        addMesh(root, new THREE.BoxGeometry(0.12, 0.42, 0.12), materials.darkSteel, [positions[index] + 1.77, 0.2, stream.z]);
      }
    });

    const bypassPosition = stream.id === "air" ? 2 : stream.id === "water" ? 3 : stream.id === "oil" ? 3 : 2;
    const bypassX = stream.id === "water" ? (positions[2] + positions[3]) / 2 : positions[bypassPosition];
    const bypassHalfWidth = stream.id === "water" ? 2 : 1.12;
    const bypass = new THREE.Group();
    bypass.visible = false;
    addPipe(bypass, [bypassX - bypassHalfWidth, 0.61, stream.z], [bypassX - bypassHalfWidth, 1.32, stream.z], 0.055, materials.bypass);
    addPipe(bypass, [bypassX - bypassHalfWidth, 1.32, stream.z], [bypassX + bypassHalfWidth, 1.32, stream.z], 0.055, materials.bypass);
    addPipe(bypass, [bypassX + bypassHalfWidth, 1.32, stream.z], [bypassX + bypassHalfWidth, 0.61, stream.z], 0.055, materials.bypass);
    root.add(bypass);
    bypassPipes.set(stream.id, bypass);

    for (let particle = 0; particle < 6; particle += 1) {
      const marker = addMesh(
        root,
        new THREE.SphereGeometry(0.1, 12, 10),
        new THREE.MeshStandardMaterial({
          color: stream.color,
          emissive: stream.color,
          emissiveIntensity: 0.55,
          roughness: 0.24,
        }),
        [-8.65, 0.68, stream.z],
      );
      flowParticles.push({ mesh: marker, stream: stream.id, offset: particle / 6 });
    }
  }

  const floor = addMesh(root, new THREE.PlaneGeometry(200, 200), makeMaterial(0x151c1e, 0.05, 0.92), [0, -0.34, 0]);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;

  const format = (value, places = 1) => Number.isFinite(value) ? value.toFixed(places) : "--";
  const setReading = (id, value, places, suffix = "") => {
    document.getElementById(id).textContent = `${format(value, places)}${suffix}`;
  };

  function updateReadings(snapshot) {
    const processData = snapshot.media;
    const data = snapshot.readings || processData;
    if (!data || !processData) return;

    setReading("media-air-flow", data.air.flow, 0, " Nm³/h");
    setReading("media-air-pm25", data.air.pm25, 1, " µg/m³");
    setReading("media-air-pm10", data.air.pm10, 1, " µg/m³");
    setReading("media-air-co2", data.air.co2, 0, " ppm");
    setReading("media-air-voc", data.air.voc, 3, " ppm");
    setReading("media-air-dp", data.air.differentialPressure, 2, " kPa");

    setReading("media-water-flow", data.water.flow, 1, " m³/h");
    setReading("media-water-ph", data.water.ph, 2);
    setReading("media-water-turbidity", data.water.turbidity, 2, " NTU");
    setReading("media-water-conductivity", data.water.conductivity, 0, " µS/cm");
    setReading("media-water-do", data.water.dissolvedOxygen, 1, " mg/L");

    setReading("media-gas-flow", data.gas.flow, 1, " Nm³/h");
    setReading("media-gas-pressure", data.gas.pressure, 2, " bar");
    setReading("media-gas-h2s", data.gas.h2s, 2, " ppm");
    setReading("media-gas-methane", data.gas.methane, 1, " %");

    setReading("media-oil-flow", data.oil.flow, 1, " m³/h");
    setReading("media-oil-temperature", data.oil.temperature, 1, " °C");
    setReading("media-oil-viscosity", data.oil.estimatedViscosity, 1, " cSt");
    setReading("media-oil-water", data.oil.waterContent, 2, " %");
    setReading("media-oil-particles", data.oil.particles, 0, " /mL");

    const updateTankFill = (key, level) => {
      const tank = tankFills.get(key);
      if (!tank) return;
      const height = 1.5 * THREE.MathUtils.clamp(level / 100, 0, 1);
      tank.scale.y = Math.max(height, 0.001);
      tank.position.y = 0.3 + height / 2;
    };
    updateTankFill("water-0", processData.water.feedLevel);
    updateTankFill("water-4", processData.water.productLevel);
    updateTankFill("oil-0", processData.oil.feedLevel);
    updateTankFill("oil-5", processData.oil.receiverLevel);

    for (const stream of streams) {
      const bypassed = processData[stream.id].bypassed;
      bypassPipes.get(stream.id).visible = Boolean(bypassed);
      const card = document.querySelector(`.multistream-reading[data-stream="${stream.id}"]`);
      card.dataset.bypassed = String(bypassed);
      card.dataset.stale = String(snapshot.telemetryStale);
      equipmentStates.forEach(({ lamp, stream: lampStream }) => {
        if (lampStream === stream.id) lamp.material = bypassed ? materials.statusWarn : materials.statusGood;
      });
    }

    const bypassCount = Object.values(snapshot.scenarios || {}).filter(Boolean).length;
    status.textContent = snapshot.telemetryStale
      ? `PROCESS RUNNING · TELEMETRY STALE${bypassCount ? ` · ${bypassCount} BYPASS` : ""}`
      : `SIMULATED PROCESS · ${bypassCount ? `${bypassCount} BYPASS ACTIVE` : "ALL TRAINS NORMAL"}`;
    status.classList.toggle("health-chip-alert", snapshot.telemetryStale || bypassCount > 0);
  }

  canvas.addEventListener("pointerdown", event => {
    const bounds = canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(selectable, true)[0];
    if (!hit) return;
    let selected = hit.object;
    while (selected && !selected.userData.title) selected = selected.parent;
    if (selected) detail.textContent = `${selected.userData.stream.toUpperCase()} · ${selected.userData.title}: ${selected.userData.description}`;
  });

  function resetCamera() {
    const bounds = canvas.getBoundingClientRect();
    const aspect = bounds.width / Math.max(bounds.height, 1);
    const tanHalfHorizontalFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect;
    const distance = THREE.MathUtils.clamp(21 / (2 * tanHalfHorizontalFov * 0.85), 17, 58);
    camera.position.copy(initialTarget).add(initialCameraOffset.clone().normalize().multiplyScalar(distance));
    controls.target.copy(initialTarget);
    controls.update();
    viewInteracted = false;
  }
  document.getElementById("media-reset-view").addEventListener("click", resetCamera);

  window.addEventListener("refinai:multistream-update", event => updateReadings(event.detail));
  window.addEventListener("refinai:hardware-view-active", () => resize());
  if (window.refinaiMultistreamSnapshot) updateReadings(window.refinaiMultistreamSnapshot);

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1) return;
    renderer.setSize(bounds.width, bounds.height, false);
    camera.aspect = bounds.width / bounds.height;
    camera.updateProjectionMatrix();
    if (!viewInteracted) resetCamera();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas.parentElement);
  window.addEventListener("resize", resize);
  requestAnimationFrame(resize);

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    rotatingParts.forEach(({ rotor, stream }) => {
      const flow = window.refinaiMultistreamSnapshot?.media?.[stream]?.flow ?? 0;
      rotor.rotation.x = elapsed * (flow > 0.2 ? 5 : 0);
    });
    flowParticles.forEach(({ mesh, stream, offset }) => {
      const streamState = window.refinaiMultistreamSnapshot?.media?.[stream];
      const flow = streamState?.flow ?? 0;
      const normalized = Math.min(1, Math.max(0.08, flow / (stream === "air" ? 1800 : stream === "gas" ? 24 : stream === "water" ? 46 : 55)));
      const distance = (elapsed * normalized * 0.22 + offset) % 1;
      mesh.position.x = -8.55 + distance * 17.1;
      mesh.visible = flow > 0.2;
    });
    controls.update();
    renderer.render(scene, camera);
  }

  status.textContent = "SIMULATED PROCESS · LIVE";
  animate();
} catch (error) {
  status.textContent = "3D process yard unavailable";
  status.classList.add("health-chip-alert");
  detail.textContent = error instanceof Error ? error.message : String(error);
  console.error("Unable to initialize the four-stream 3D process yard.", error);
}
