const canvas = document.getElementById("skid3d-canvas");
const status = document.getElementById("skid3d-status");

try {
  const THREE = await import("three");
  const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");

  const bounds = canvas.getBoundingClientRect();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x10191b);
  scene.fog = new THREE.Fog(0x10191b, 19, 35);

  const camera = new THREE.PerspectiveCamera(34, (bounds.width || 800) / (bounds.height || 320), 0.1, 80);
  camera.position.set(5.2, 4.5, 9.6);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setSize(bounds.width || 1, bounds.height || 1, false);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 6;
  controls.maxDistance = 18;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.target.set(0, 1.05, 0);

  scene.add(new THREE.HemisphereLight(0xcfe5ec, 0x283032, 2.1));
  const keyLight = new THREE.DirectionalLight(0xffe7c5, 2.4);
  keyLight.position.set(-4, 10, 8);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0x79cbd0, 1.15);
  fillLight.position.set(7, 5, -6);
  scene.add(fillLight);

  const materials = {
    frame: new THREE.MeshStandardMaterial({ color: 0x546166, metalness: 0.68, roughness: 0.48 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x87999b, metalness: 0.62, roughness: 0.4 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: 0x38464a, metalness: 0.55, roughness: 0.5 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x9cb9b7, metalness: 0.2, roughness: 0.26, transparent: true, opacity: 0.32, depthWrite: false }),
    liquid: new THREE.MeshStandardMaterial({ color: 0x287f98, metalness: 0.08, roughness: 0.28, transparent: true, opacity: 0.82 }),
    pump: new THREE.MeshStandardMaterial({ color: 0x54897b, metalness: 0.48, roughness: 0.4 }),
    filter: new THREE.MeshStandardMaterial({ color: 0x729293, metalness: 0.48, roughness: 0.42 }),
    exchanger: new THREE.MeshStandardMaterial({ color: 0x8c8169, metalness: 0.46, roughness: 0.45 }),
    processPipe: new THREE.MeshStandardMaterial({ color: 0x407d84, metalness: 0.68, roughness: 0.36, emissive: 0x12393c, emissiveIntensity: 0.4 }),
    utilityPipe: new THREE.MeshStandardMaterial({ color: 0x9a6944, metalness: 0.5, roughness: 0.42, emissive: 0x4c2410, emissiveIntensity: 0.23 }),
  };

  const addMesh = (geometry, material, position, parent = scene) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const addPipe = (start, end, radius, material) => {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    const vector = b.clone().sub(a);
    const pipe = addMesh(new THREE.CylinderGeometry(radius, radius, vector.length(), 14), material, [0, 0, 0]);
    pipe.position.copy(a).add(b).multiplyScalar(0.5);
    pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize());
    return pipe;
  };

  const addLabel = (text, position) => {
    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 384;
    labelCanvas.height = 80;
    const context = labelCanvas.getContext("2d");
    context.fillStyle = "rgba(19,29,31,.88)";
    context.fillRect(0, 0, labelCanvas.width, labelCanvas.height);
    context.strokeStyle = "#799194";
    context.lineWidth = 3;
    context.strokeRect(2, 2, labelCanvas.width - 4, labelCanvas.height - 4);
    context.fillStyle = "#e2ece7";
    context.font = "600 30px Segoe UI, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, labelCanvas.width / 2, labelCanvas.height / 2);
    const texture = new THREE.CanvasTexture(labelCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.position.set(...position);
    sprite.scale.set(2.2, 0.47, 1);
    scene.add(sprite);
  };

  const platform = addMesh(new THREE.BoxGeometry(13.5, 0.3, 4.1), materials.frame, [0.1, 0.13, 0]);
  platform.material = materials.frame;
  addMesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x172123, roughness: 0.95 }), [0, -0.05, 0]).rotation.x = -Math.PI / 2;

  function createTank(x, label) {
    const shellHeight = 2.7;
    const shellY = 0.38 + shellHeight / 2;
    addMesh(new THREE.CylinderGeometry(0.7, 0.7, shellHeight, 32, 1, true), materials.glass, [x, shellY, 0]);
    addMesh(new THREE.CylinderGeometry(0.73, 0.73, 0.1, 32), materials.steel, [x, 0.4, 0]);
    addMesh(new THREE.CylinderGeometry(0.73, 0.73, 0.1, 32), materials.steel, [x, 3.1, 0]);
    addMesh(new THREE.TorusGeometry(0.7, 0.035, 8, 32), materials.steel, [x, 0.52, 0]);
    const liquid = addMesh(new THREE.CylinderGeometry(0.61, 0.61, 1, 32), materials.liquid, [x, 0.5, 0]);
    liquid.userData.shellHeight = shellHeight - 0.2;
    liquid.userData.baseY = 0.48;
    addPipe([x, 0.76, 0], [x, 0.4, 0], 0.12, materials.processPipe);
    addLabel(label, [x, 3.65, 0]);
    return liquid;
  }

  const feedLiquid = createTank(-5.2, "TK-101 · FEED");
  const receiverLiquid = createTank(5.9, "TK-102 · RECEIVER");

  const pumpMotor = addMesh(new THREE.BoxGeometry(1.15, 0.78, 0.78), materials.darkSteel, [-2.95, 0.95, 0]);
  for (let fin = 0; fin < 5; fin++) {
    addMesh(new THREE.BoxGeometry(0.06, 0.87, 0.88), materials.steel, [-3.38 + fin * 0.2, 0.97, 0]);
  }
  const rotor = new THREE.Group();
  rotor.position.set(-2.15, 0.98, 0);
  scene.add(rotor);
  addMesh(new THREE.SphereGeometry(0.48, 24, 16), materials.pump, [0, 0, 0], rotor);
  addMesh(new THREE.CylinderGeometry(0.23, 0.23, 0.72, 20), materials.steel, [0.22, 0, 0], rotor).rotation.z = Math.PI / 2;
  addMesh(new THREE.CylinderGeometry(0.13, 0.13, 0.54, 18), materials.darkSteel, [0.63, 0, 0], rotor).rotation.z = Math.PI / 2;
  addLabel("P-101 · PUMP", [-2.65, 2.05, 0]);

  const filterShell = addMesh(new THREE.CylinderGeometry(0.4, 0.4, 1.55, 24), materials.filter, [0.15, 1.2, 0]);
  addMesh(new THREE.CylinderGeometry(0.48, 0.48, 0.12, 24), materials.steel, [0.15, 2.02, 0]);
  addMesh(new THREE.CylinderGeometry(0.48, 0.48, 0.12, 24), materials.steel, [0.15, 0.38, 0]);
  addLabel("F-101 · FILTER", [0.15, 2.55, 0]);

  const exchangerShell = addMesh(new THREE.CylinderGeometry(0.48, 0.48, 1.9, 28), materials.exchanger, [3.0, 1.15, 0]);
  exchangerShell.rotation.z = Math.PI / 2;
  for (const offset of [-0.27, 0, 0.27]) {
    addPipe([2.1, 0.9 + offset, 0], [3.9, 0.9 + offset, 0], 0.045, materials.steel);
  }
  addLabel("E-101 · EXCHANGER", [3.0, 2.18, 0]);

  addPipe([-5.2, 0.78, 0], [-3.65, 0.78, 0], 0.11, materials.processPipe);
  addPipe([-2.08, 0.78, 0], [-0.25, 0.78, 0], 0.11, materials.processPipe);
  addPipe([0.55, 0.78, 0], [2.02, 0.78, 0], 0.11, materials.processPipe);
  addPipe([3.98, 0.78, 0], [5.9, 0.78, 0], 0.11, materials.processPipe);
  addPipe([2.35, 1.7, 0], [2.35, 2.25, 0], 0.075, materials.utilityPipe);
  addPipe([3.65, 1.7, 0], [3.65, 2.25, 0], 0.075, materials.utilityPipe);
  addLabel("HOT UTILITY", [3.0, 2.65, 0]);

  const particles = [];
  for (let index = 0; index < 9; index++) {
    const particle = addMesh(new THREE.SphereGeometry(0.09, 12, 10), new THREE.MeshStandardMaterial({
      color: 0xa8f4e7,
      emissive: 0x205c55,
      emissiveIntensity: 0.7,
      roughness: 0.25,
    }), [-5.2, 0.81, 0]);
    particles.push(particle);
  }

  const telemetryLamp = addMesh(new THREE.SphereGeometry(0.14, 16, 12), new THREE.MeshBasicMaterial({ color: 0x65d595 }), [6.35, 3.55, 0]);
  addLabel("SIMULATED SKID · NOT TO SCALE", [0, 3.78, -1.15]);

  let liveValues = { flow: 0, pumpSpeedPercent: 0, feedLevel: 68, receiverLevel: 52 };
  let telemetryStale = false;
  window.addEventListener("refinai:pilot-twin-update", event => {
    liveValues = event.detail.values;
    telemetryStale = event.detail.telemetryStale;
    const fill = (mesh, percent) => {
      const height = mesh.userData.shellHeight * THREE.MathUtils.clamp(percent / 100, 0, 1);
      mesh.scale.y = Math.max(height, 0.001);
      mesh.position.y = mesh.userData.baseY + height / 2;
    };
    fill(feedLiquid, liveValues.feedLevel);
    fill(receiverLiquid, liveValues.receiverLevel);
    filterShell.material.color.setHex(liveValues.filterRestricted ? 0xc18648 : 0x729293);
    exchangerShell.material.color.setHex(liveValues.exchangerFouled ? 0xb35d46 : 0x8c8169);
    telemetryLamp.material.color.setHex(telemetryStale ? 0xe5b564 : 0x65d595);
    status.textContent = telemetryStale ? "PROCESS RUNNING · DISPLAY TELEMETRY STALE" : "SIMULATED PROCESS · LIVE";
    status.style.color = telemetryStale ? "#e5b564" : "#a8d8c1";
  });

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    renderer.setSize(rect.width, rect.height, false);
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas.parentElement);
  window.addEventListener("resize", resize);

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    const rate = Math.max(0, Math.min(1.5, liveValues.flow / 50));
    rotor.rotation.x = elapsed * (liveValues.pumpSpeedPercent / 100) * 8;
    pumpMotor.rotation.z = Math.sin(elapsed * 2) * 0.008 * (liveValues.pumpSpeedPercent / 100);
    particles.forEach((particle, index) => {
      const distance = (elapsed * rate * 1.3 + index * 1.2) % 10.2;
      particle.position.x = -5.2 + distance;
      particle.visible = liveValues.flow > 0.4;
    });
    controls.update();
    renderer.render(scene, camera);
  }
  status.textContent = "SIMULATED PROCESS · LIVE";
  animate();
} catch (error) {
  status.textContent = "3D view unavailable; schematic remains available";
  status.style.color = "#e5b564";
  console.error("Unable to initialize the simulated transfer-skid 3D view.", error);
}
