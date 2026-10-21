// RefinAI — historical physical-sample replay and instrument dashboard.

const replayState = { samples: [], position: 0, history: [], playing: true, charts: {}, metadata: null };
let cameraStream = null;
const qualityState = { medium: "air", reference: null };
const reviewStorageKey = "refinai.sample-review.v1";
let reviewRecords = [];
let reviewStorageAvailable = true;
const pilotTwinState = {
  minutes: 0,
  feedTankLevel: 68,
  receiverLevel: 52,
  waterFeedLevel: 61,
  waterProductLevel: 43,
  readings: null,
  history: [],
  chart: null,
};
const pilotTwinParameters = Object.freeze({
  feedTankCapacityM3: 45,
  feedTankMakeupM3PerHour: 65,
  receiverTankCapacityM3: 30,
  lowInventoryFlowLimitPercent: 20,
  pumpStaticHeadBar: 2,
  pumpDynamicHeadBar: 7,
  cleanFilterDropBar: 0.12,
  filterResistanceBarPerFlowSquared: 0.00012,
  restrictedFilterExtraDropBar: 1.1,
  lineResistanceBarPerFlowSquared: 0.00045,
  pumpEfficiency: 0.72,
});

const hardwareCatalog = [
  { id: "air-particles", name: "Air PM2.5 / PM10", medium: "Air", type: "sensor", signal: "Optical particle counter → 4–20 mA → gateway", state: "Online", status: "healthy" },
  { id: "air-co2", name: "Air CO2", medium: "Air", type: "sensor", signal: "NDIR transmitter → Modbus RTU → gateway", state: "Online", status: "healthy" },
  { id: "air-voc", name: "Air VOC", medium: "Air", type: "sensor", signal: "PID analyzer → 4–20 mA → gateway", state: "Online", status: "healthy" },
  { id: "water-ph", name: "Water pH", medium: "Water", type: "sensor", signal: "pH probe + transmitter → isolated analog output", state: "Online", status: "healthy" },
  { id: "water-turbidity", name: "Water Turbidity", medium: "Water", type: "sensor", signal: "Turbidity probe → 4–20 mA → gateway", state: "Online", status: "healthy" },
  { id: "water-conductivity", name: "Water Conductivity", medium: "Water", type: "sensor", signal: "Conductivity cell → transmitter → gateway", state: "Online", status: "healthy" },
  { id: "water-do", name: "Water Dissolved Oxygen", medium: "Water", type: "sensor", signal: "Optical DO sensor → Modbus → gateway", state: "Online", status: "healthy" },
  { id: "oil-viscosity", name: "Oil Viscosity", medium: "Oil", type: "sensor", signal: "Inline viscometer → Modbus TCP → gateway", state: "Online", status: "healthy" },
  { id: "oil-water", name: "Oil Water Content", medium: "Oil", type: "sensor", signal: "Water-in-oil analyzer → 4–20 mA → gateway", state: "Online", status: "healthy" },
  { id: "oil-particle", name: "Oil Particle Count", medium: "Oil", type: "sensor", signal: "Particle counter → signal conditioner → I/O", state: "Online", status: "healthy" },
  { id: "oil-dielectric", name: "Oil Dielectric", medium: "Oil", type: "sensor", signal: "Dielectric sensor → analog output → gateway", state: "Online", status: "healthy" },
  { id: "gas-species", name: "Gas Species Analyzer", medium: "Gas", type: "sensor", signal: "Gas chromatograph / analyzer → gateway", state: "Standby", status: "warning" },
  { id: "gas-h2s", name: "H2S Detector", medium: "Gas", type: "sensor", signal: "Electrochemical cell → controller → alarm bus", state: "Online", status: "healthy" },
  { id: "gas-methane", name: "Methane Detector", medium: "Gas", type: "sensor", signal: "Catalytic / IR detector → controller → alarm bus", state: "Online", status: "healthy" },
  { id: "gas-imaging", name: "Optical Gas Imaging", medium: "Gas", type: "camera", signal: "Thermal imaging camera → edge analytics → historian", state: "Online", status: "healthy" },
  { id: "process-pressure", name: "Process Pressure", medium: "Process", type: "sensor", signal: "Pressure transmitter → 4–20 mA → I/O", state: "Online", status: "healthy" },
  { id: "process-flow", name: "Process Flow", medium: "Process", type: "sensor", signal: "Flowmeter → pulse + analog → I/O", state: "Online", status: "healthy" },
  { id: "machine-vibration", name: "Machine Vibration", medium: "Process", type: "sensor", signal: "Accelerometer / monitor → Modbus → gateway", state: "Online", status: "healthy" },
  { id: "corrosion-thickness", name: "Corrosion / Thickness", medium: "Process", type: "sensor", signal: "UT / corrosion probe → remote logger → gateway", state: "Standby", status: "warning" },
  { id: "battery-bank", name: "Battery / UPS", medium: "Power", type: "power", signal: "24 V DC rail → power bus → field devices", state: "Energized", status: "healthy" },
  { id: "panel-switch", name: "Main switch / breaker", medium: "Power", type: "switch", signal: "Breaker + distribution rail → device power", state: "Closed", status: "healthy" },
  { id: "register-box", name: "Register / data logger", medium: "Logic", type: "logic", signal: "Registers raw values and timestamped batches", state: "Active", status: "healthy" },
  { id: "gateway-unit", name: "Read-only gateway", medium: "Logic", type: "gateway", signal: "OPC UA / Modbus TCP → historian / dashboard", state: "Online", status: "healthy" },
  { id: "dashboard-view", name: "Dashboard twin", medium: "Display", type: "display", signal: "Historian data → visualization and health logic", state: "Live", status: "healthy" },
];

const hardwareLabState = {
  selectedAsset: "feed-tank",
  powerOn: true,
  busActive: true,
  gatewayOnline: true,
  activeAlarms: new Map(),
  eventHistory: [],
  protocolPolls: 0,
  lastValues: null,
  telemetryStale: false,
};

const skidTagMap = [
  { tag: "LT-101", asset: "feed-tank", label: "Feed tank level", field: "feedLevel", unit: "%", type: "Float32", register: 40001, nodeId: "ns=2;s=Skid.TK101.Level", signal: "4–20 mA → remote I/O → read-only gateway", destination: "Feed tank level / vessel fill" },
  { tag: "PT-101", asset: "transfer-pump", label: "Pump suction pressure", field: "suctionPressure", unit: "bar", type: "Float32", register: 40002, nodeId: "ns=2;s=Skid.P101.SuctionPressure", signal: "4–20 mA / HART → remote I/O → read-only gateway", destination: "Pump suction pressure card" },
  { tag: "PT-102", asset: "transfer-pump", label: "Pump discharge pressure", field: "dischargePressure", unit: "bar", type: "Float32", register: 40003, nodeId: "ns=2;s=Skid.P101.DischargePressure", signal: "4–20 mA / HART → remote I/O → read-only gateway", destination: "Discharge pressure card" },
  { tag: "FT-101", asset: "transfer-pump", label: "Transfer flow", field: "flow", unit: "m³/h", type: "Float32", register: 40004, nodeId: "ns=2;s=Skid.P101.Flow", signal: "Pulse / 4–20 mA → remote I/O → read-only gateway", destination: "Flow card and trend" },
  { tag: "DPIT-101", asset: "filter", label: "Filter differential pressure", field: "filterDifferential", unit: "bar", type: "Float32", register: 40005, nodeId: "ns=2;s=Skid.F101.DifferentialPressure", signal: "4–20 mA / HART → remote I/O → read-only gateway", destination: "Filter differential-pressure card" },
  { tag: "TT-101", asset: "heat-exchanger", label: "Exchanger inlet temperature", field: "inletTemperature", unit: "°C", type: "Float32", register: 40006, nodeId: "ns=2;s=Skid.E101.InletTemperature", signal: "RTD → temperature transmitter → remote I/O", destination: "Exchanger inlet temperature" },
  { tag: "TT-102", asset: "heat-exchanger", label: "Exchanger outlet temperature", field: "outletTemperature", unit: "°C", type: "Float32", register: 40007, nodeId: "ns=2;s=Skid.E101.OutletTemperature", signal: "RTD → temperature transmitter → remote I/O", destination: "Outlet temperature card and 3D twin" },
  { tag: "VIB-101", asset: "transfer-pump", label: "Pump bearing vibration", field: "vibration", unit: "mm/s", type: "Float32", register: 40008, nodeId: "ns=2;s=Skid.P101.BearingVibration", signal: "Accelerometer → vibration monitor → gateway", destination: "Pump condition card and trend" },
  { tag: "EM-101", asset: "transfer-pump", label: "Motor electrical power", field: "motorPower", unit: "kW", type: "Float32", register: 40009, nodeId: "ns=2;s=Skid.P101.MotorPower", signal: "Power meter → Modbus / remote I/O → gateway", destination: "Motor power card" },
  { tag: "LT-102", asset: "receiver-tank", label: "Receiver tank level", field: "receiverLevel", unit: "%", type: "Float32", register: 40010, nodeId: "ns=2;s=Skid.TK102.Level", signal: "4–20 mA → remote I/O → read-only gateway", destination: "Receiver tank level / vessel fill" },
];

const skidAssets = new Set([...skidTagMap.map(tag => tag.asset), "instrumentation", "gateway"]);
const hierarchyAssets = {
  site: skidAssets,
  "transfer-skid": skidAssets,
  "feed-tank": new Set(["feed-tank"]),
  "transfer-pump": new Set(["transfer-pump"]),
  filter: new Set(["filter"]),
  "heat-exchanger": new Set(["heat-exchanger"]),
  "receiver-tank": new Set(["receiver-tank"]),
  instrumentation: new Set(skidTagMap.map(tag => tag.asset)),
  gateway: new Set(skidTagMap.map(tag => tag.asset)),
};

const demoAlarmRules = [
  { id: "communications-lost", label: "Telemetry path unavailable", severity: "high", test: (values, stale) => stale, detail: "Power, field bus, or read-only gateway is unavailable; last-good values are retained." },
  { id: "low-transfer-flow", label: "Low simulated transfer flow", severity: "warning", test: values => values.flow < 25, detail: "Flow is below the illustrative 25 m³/h demonstration threshold." },
  { id: "filter-restriction", label: "Filter differential pressure high", severity: "warning", test: values => values.filterDifferential > 0.9, detail: "Differential pressure is above the illustrative 0.90 bar threshold." },
  { id: "pump-vibration", label: "Pump vibration elevated", severity: "warning", test: values => values.vibration > 3.2, detail: "Vibration is above the illustrative 3.20 mm/s threshold." },
  { id: "feed-inventory", label: "Feed tank inventory low", severity: "warning", test: values => values.feedLevel < 20, detail: "Feed tank level is below the illustrative 20% threshold." },
  { id: "receiver-inventory", label: "Receiver inventory near limit", severity: "warning", test: values => values.receiverLevel < 10 || values.receiverLevel > 90, detail: "Receiver level is outside the illustrative 10–90% band." },
  { id: "exchanger-fouling", label: "Exchanger fouling scenario active", severity: "warning", test: values => values.exchangerFouled, detail: "The simulated fouling fault toggle is active; this is not a diagnosis." },
];

const moduleCatalog = [
  { id: "at-output", label: "AT vs Output", group: "benchmark", kind: "scatter", x: "AT", y: "PE", title: "Ambient temperature vs net output", xLabel: "Ambient temperature (C)", yLabel: "Net output (MW)" },
  { id: "vacuum-output", label: "Vacuum vs Output", group: "benchmark", kind: "scatter", x: "V", y: "PE", title: "Exhaust vacuum vs net output", xLabel: "Exhaust vacuum (cm Hg)", yLabel: "Net output (MW)" },
  { id: "pressure-output", label: "Pressure vs Output", group: "benchmark", kind: "scatter", x: "AP", y: "PE", title: "Ambient pressure vs net output", xLabel: "Ambient pressure (mbar)", yLabel: "Net output (MW)" },
  { id: "humidity-output", label: "Humidity vs Output", group: "benchmark", kind: "scatter", x: "RH", y: "PE", title: "Relative humidity vs net output", xLabel: "Relative humidity (%)", yLabel: "Net output (MW)" },
  { id: "actual-model", label: "Actual vs Model", group: "benchmark", kind: "scatter", x: "PE_pred", y: "PE", title: "Measured output vs model estimate", xLabel: "Model estimate (MW)", yLabel: "Measured output (MW)" },
  { id: "output-hist", label: "Output Distribution", group: "benchmark", kind: "histogram", field: "PE", title: "Held-out measured output distribution", xLabel: "Net output (MW)" },
  { id: "residual-hist", label: "Residual Distribution", group: "benchmark", kind: "histogram", field: "residual_MW", title: "Model residual distribution", xLabel: "Measured minus estimated (MW)" },
  { id: "residual-at", label: "Residual vs AT", group: "benchmark", kind: "scatter", x: "AT", y: "residual_MW", title: "Output residual vs ambient temperature", xLabel: "Ambient temperature (C)", yLabel: "Residual (MW)" },
  { id: "residual-vacuum", label: "Residual vs Vacuum", group: "benchmark", kind: "scatter", x: "V", y: "residual_MW", title: "Output residual vs exhaust vacuum", xLabel: "Exhaust vacuum (cm Hg)", yLabel: "Residual (MW)" },
  { id: "residual-pressure", label: "Residual vs Pressure", group: "benchmark", kind: "scatter", x: "AP", y: "residual_MW", title: "Output residual vs ambient pressure", xLabel: "Ambient pressure (mbar)", yLabel: "Residual (MW)" },
  { id: "residual-humidity", label: "Residual vs Humidity", group: "benchmark", kind: "scatter", x: "RH", y: "residual_MW", title: "Output residual vs relative humidity", xLabel: "Relative humidity (%)", yLabel: "Residual (MW)" },
  { id: "at-hist", label: "AT Distribution", group: "benchmark", kind: "histogram", field: "AT", title: "Ambient temperature distribution", xLabel: "Ambient temperature (C)" },
  { id: "vacuum-hist", label: "Vacuum Distribution", group: "benchmark", kind: "histogram", field: "V", title: "Exhaust vacuum distribution", xLabel: "Exhaust vacuum (cm Hg)" },
  { id: "pressure-hist", label: "Pressure Distribution", group: "benchmark", kind: "histogram", field: "AP", title: "Ambient pressure distribution", xLabel: "Ambient pressure (mbar)" },
  { id: "humidity-hist", label: "Humidity Distribution", group: "benchmark", kind: "histogram", field: "RH", title: "Relative humidity distribution", xLabel: "Relative humidity (%)" },
  { id: "output-at-bands", label: "Output by AT Band", group: "benchmark", kind: "bands", field: "AT", target: "PE", title: "Mean output by temperature band", xLabel: "Temperature band", yLabel: "Mean output (MW)" },
  { id: "output-vacuum-bands", label: "Output by Vacuum Band", group: "benchmark", kind: "bands", field: "V", target: "PE", title: "Mean output by vacuum band", xLabel: "Vacuum band", yLabel: "Mean output (MW)" },
  { id: "output-humidity-bands", label: "Output by Humidity Band", group: "benchmark", kind: "bands", field: "RH", target: "PE", title: "Mean output by humidity band", xLabel: "Humidity band", yLabel: "Mean output (MW)" },
  { id: "output-pressure-bands", label: "Output by Pressure Band", group: "benchmark", kind: "bands", field: "AP", target: "PE", title: "Mean output by pressure band", xLabel: "Pressure band", yLabel: "Mean output (MW)" },
  { id: "residual-at-bands", label: "Error by AT Band", group: "benchmark", kind: "bands", field: "AT", target: "residual_MW", title: "Mean residual by temperature band", xLabel: "Temperature band", yLabel: "Mean residual (MW)" },
  { id: "residual-vacuum-bands", label: "Error by Vacuum Band", group: "benchmark", kind: "bands", field: "V", target: "residual_MW", title: "Mean residual by vacuum band", xLabel: "Vacuum band", yLabel: "Mean residual (MW)" },
  { id: "residual-humidity-bands", label: "Error by Humidity Band", group: "benchmark", kind: "bands", field: "RH", target: "residual_MW", title: "Mean residual by humidity band", xLabel: "Humidity band", yLabel: "Mean residual (MW)" },
  { id: "at-vacuum", label: "AT vs Vacuum", group: "benchmark", kind: "scatter", x: "AT", y: "V", title: "Ambient temperature vs exhaust vacuum", xLabel: "Ambient temperature (C)", yLabel: "Exhaust vacuum (cm Hg)" },
  { id: "at-humidity", label: "AT vs Humidity", group: "benchmark", kind: "scatter", x: "AT", y: "RH", title: "Ambient temperature vs relative humidity", xLabel: "Ambient temperature (C)", yLabel: "Relative humidity (%)" },
  { id: "nasa-rul", label: "NASA Engine Lifetime", group: "benchmark", kind: "image", title: "NASA C-MAPSS FD001 engine lifetime distribution", image: "cmapss_rul_dist.png" },
  { id: "air-particles", label: "Air PM2.5 / PM10", group: "hardware", sensor: "Optical particle counter", measurement: "PM2.5 and PM10 mass concentration", protocol: "USB/serial, Modbus RTU, or an approved gateway", medium: "Air" },
  { id: "air-co2", label: "Air CO2", group: "hardware", sensor: "NDIR CO2 sensor", measurement: "Carbon dioxide concentration (ppm)", protocol: "UART/I2C sensor module or gateway", medium: "Air" },
  { id: "air-voc", label: "Air VOC", group: "hardware", sensor: "PID or calibrated TVOC sensor", measurement: "Target-specific VOC reading; sensor cross-sensitivity applies", protocol: "Modbus RTU/TCP or approved gateway", medium: "Air" },
  { id: "water-ph", label: "Water pH", group: "hardware", sensor: "Industrial pH probe and transmitter", measurement: "pH with temperature compensation and calibration status", protocol: "4-20 mA via isolated input or Modbus", medium: "Water" },
  { id: "water-turbidity", label: "Water Turbidity", group: "hardware", sensor: "Turbidity probe", measurement: "Turbidity in the instrument's calibrated range", protocol: "4-20 mA or Modbus", medium: "Water" },
  { id: "water-conductivity", label: "Water Conductivity", group: "hardware", sensor: "Conductivity/TDS transmitter", measurement: "Electrical conductivity and derived TDS", protocol: "4-20 mA or Modbus", medium: "Water" },
  { id: "water-do", label: "Water Dissolved Oxygen", group: "hardware", sensor: "Optical or electrochemical DO probe", measurement: "Dissolved oxygen with calibration metadata", protocol: "Modbus or 4-20 mA", medium: "Water" },
  { id: "oil-viscosity", label: "Oil Viscosity", group: "hardware", sensor: "Inline viscometer", measurement: "Dynamic or kinematic viscosity at stated temperature", protocol: "Modbus TCP/RTU or 4-20 mA", medium: "Oil" },
  { id: "oil-water", label: "Oil Water Content", group: "hardware", sensor: "Water-in-oil analyzer", measurement: "Water fraction using oil-specific calibration", protocol: "Modbus or 4-20 mA", medium: "Oil" },
  { id: "oil-particles", label: "Oil Particle Count", group: "hardware", sensor: "Online oil particle counter", measurement: "Particle counts by calibrated size channel", protocol: "Modbus TCP/RTU", medium: "Oil" },
  { id: "oil-dielectric", label: "Oil Dielectric", group: "hardware", sensor: "Oil dielectric/condition sensor", measurement: "Relative dielectric change for the configured oil", protocol: "Vendor API, Modbus, or 4-20 mA", medium: "Oil" },
  { id: "gas-specific", label: "Gas Species Analyzer", group: "hardware", sensor: "Gas-specific electrochemical or NDIR analyzer", measurement: "Only configured gas species and range", protocol: "Modbus or approved safety gateway", medium: "Gas" },
  { id: "gas-h2s", label: "H2S Detector", group: "hardware", sensor: "Certified H2S detector", measurement: "Hydrogen sulfide concentration in ppm", protocol: "Approved safety-system interface", medium: "Gas" },
  { id: "gas-methane", label: "Methane Detector", group: "hardware", sensor: "Catalytic or infrared methane detector", measurement: "Methane concentration or LEL, per device", protocol: "Approved safety-system interface", medium: "Gas" },
  { id: "gas-ogi", label: "Optical Gas Imaging", group: "hardware", sensor: "Specialized optical gas imaging camera", measurement: "Visualizes only gases within the camera's spectral response; not composition without analysis", protocol: "Vendor SDK/stream and approved OT network", medium: "Gas" },
  { id: "process-pressure", label: "Process Pressure", group: "hardware", sensor: "Pressure transmitter", measurement: "Pressure with engineering unit and range metadata", protocol: "4-20 mA via isolated input, HART gateway, or Modbus", medium: "Process" },
  { id: "process-flow", label: "Process Flow", group: "hardware", sensor: "Flowmeter", measurement: "Flow with fluid, range, and engineering-unit metadata", protocol: "Modbus, HART gateway, or historian", medium: "Process" },
  { id: "machine-vibration", label: "Machine Vibration", group: "hardware", sensor: "Accelerometer/vibration monitor", measurement: "Vibration waveform or configured RMS/velocity metric", protocol: "Condition-monitoring gateway or OPC UA", medium: "Rotating equipment" },
  { id: "corrosion-thickness", label: "Corrosion / Thickness", group: "hardware", sensor: "Ultrasonic thickness or corrosion monitor", measurement: "Thickness/rate with location and inspection metadata", protocol: "Inspection system export or approved gateway", medium: "Integrity" },
  { id: "gateway-readonly", label: "Read-only Gateway", group: "hardware", sensor: "Approved plant gateway / historian", measurement: "Mapped tags, timestamps, units, quality flags, and source identity", protocol: "OPC UA, Modbus TCP, historian export, or approved MQTT bridge", medium: "Integration" },
];

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".tabpanel").forEach(panel => panel.classList.remove("active"));
    button.classList.add("active");
    document.getElementById(`panel-${button.dataset.tab}`).classList.add("active");
    document.querySelector(".topbar").dataset.activeTab = button.dataset.tab;
    if (button.dataset.tab === "hardware-lab") {
      window.dispatchEvent(new CustomEvent("refinai:hardware-view-active"));
      requestAnimationFrame(() => document.querySelector(".multistream-viewport").scrollIntoView({ behavior: "smooth", block: "start" }));
    }
    requestAnimationFrame(() => Object.values(replayState.charts).forEach(chart => chart.resize()));
  });
});

function formatNumber(value, digits = 2) {
  return Number(value).toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatRupees(value) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function formatValueInr(value) {
  const amount = Math.abs(value);
  const unitValue = amount >= 10000000
    ? `${formatNumber(amount / 10000000, 2)} crore`
    : `${formatNumber(amount / 100000, 1)} lakh`;
  return `${value < 0 ? "-" : ""}₹${unitValue}`;
}

async function refreshCameraDevices() {
  const selector = document.getElementById("camera-device");
  if (!navigator.mediaDevices?.enumerateDevices || !selector) return;

  try {
    const selectedDevice = selector.value;
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === "videoinput");
    selector.replaceChildren(new Option("Default camera", ""));
    devices.forEach((device, index) => {
      selector.add(new Option(device.label || `Camera ${index + 1}`, device.deviceId));
    });
    if (devices.some(device => device.deviceId === selectedDevice)) selector.value = selectedDevice;
  } catch (error) {
    console.error("Unable to refresh camera devices:", error);
    document.getElementById("camera-status").textContent = cameraStream
      ? "Camera connected; device list could not be refreshed"
      : "Camera list unavailable; the default camera can still be used";
  }
}

function stopCamera() {
  if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
  cameraStream = null;
  document.getElementById("camera-video").srcObject = null;
  document.getElementById("camera-empty").hidden = false;
  document.getElementById("camera-status").textContent = "Camera disconnected";
  document.getElementById("camera-source").textContent = "Not connected";
  document.getElementById("camera-resolution").textContent = "--";
  document.getElementById("camera-fps").textContent = "--";
  document.getElementById("quality-brightness").textContent = "--";
  document.getElementById("quality-saturation").textContent = "--";
  document.getElementById("quality-contrast").textContent = "--";
  qualityState.reference = null;
  document.getElementById("camera-start").disabled = false;
  document.getElementById("quality-reference").disabled = true;
  document.getElementById("quality-analyze").disabled = true;
  document.getElementById("camera-stop").disabled = true;
  document.getElementById("camera-snapshot").disabled = true;
  document.getElementById("quality-outcome").textContent = "Camera disconnected. Reconnect and capture a new reference.";
}

async function startCamera() {
  const status = document.getElementById("camera-status");
  const selector = document.getElementById("camera-device");
  if (!navigator.mediaDevices?.getUserMedia) {
    status.textContent = "Camera API unavailable in this browser";
    return;
  }

  if (cameraStream) stopCamera();
  status.textContent = "Waiting for camera permission";
  document.getElementById("camera-start").disabled = true;
  try {
    const deviceId = selector.value;
    const videoConstraints = {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    };
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
    const video = document.getElementById("camera-video");
    video.srcObject = cameraStream;
    await video.play();

    const track = cameraStream.getVideoTracks()[0];
    const settings = track.getSettings();
    document.getElementById("camera-empty").hidden = true;
    document.getElementById("camera-source").textContent = track.label || "Connected camera";
    document.getElementById("camera-resolution").textContent = `${settings.width || video.videoWidth} × ${settings.height || video.videoHeight}`;
    document.getElementById("camera-fps").textContent = settings.frameRate ? `${formatNumber(settings.frameRate, 0)} fps` : "Not reported by device";
    document.getElementById("camera-status").textContent = "Camera connected";
    document.getElementById("camera-start").disabled = true;
    updateQualityModeControls();
    document.getElementById("camera-stop").disabled = false;
    document.getElementById("camera-snapshot").disabled = false;
    track.addEventListener("ended", stopCamera, { once: true });
    await refreshCameraDevices();
  } catch (error) {
    if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
    document.getElementById("camera-video").srcObject = null;
    document.getElementById("camera-start").disabled = false;
    document.getElementById("quality-reference").disabled = true;
    document.getElementById("quality-analyze").disabled = true;
    status.textContent = error.name === "NotAllowedError"
      ? "Camera permission denied"
      : error.name === "NotFoundError"
        ? "No camera device found"
        : `Camera error: ${error.message}`;
  }
}

const qualityModeDetails = {
  air: {
    label: "AIR · VISIBLE HAZE PROXY",
    description: "A standard camera can compare scene contrast only under fixed lighting. It cannot measure PM2.5, CO2, VOCs, or invisible contaminants.",
    hardware: "PM2.5/PM10 particle counter, NDIR CO2 sensor, and target-specific VOC/gas sensors.",
  },
  water: {
    label: "WATER · COLOR / CLARITY PROXY",
    description: "Compare a water sample in the same clear cell with fixed backlighting. RGB image changes are not turbidity, pH, dissolved oxygen, or contamination measurements.",
    hardware: "Calibrated turbidity, pH, conductivity/TDS, and dissolved-oxygen probes.",
  },
  oil: {
    label: "OIL · COLOR / OPACITY PROXY",
    description: "Compare the same oil sample cell, thickness, and lighting. Color cannot determine viscosity, water content, wear metals, or oil grade.",
    hardware: "Viscometer, water-in-oil sensor, particle counter, and oil-specific lab analysis.",
  },
  gas: {
    label: "GAS · CAMERA CANNOT MEASURE COMPOSITION",
    description: "An RGB webcam cannot detect invisible gas, identify gas species, or measure concentration. Do not use an image proxy for leak or safety decisions.",
    hardware: "Gas-specific electrochemical/NDIR detector; gas chromatography for composition. Optical gas imaging needs a specialized IR camera.",
  },
};

function updateQualityModeControls() {
  const gasMode = qualityState.medium === "gas";
  document.getElementById("quality-reference").disabled = !cameraStream || gasMode;
  document.getElementById("quality-analyze").disabled = !cameraStream || gasMode;
}

function setQualityMode(medium) {
  qualityState.medium = medium;
  qualityState.reference = null;
  const details = qualityModeDetails[medium];
  document.querySelectorAll(".quality-mode").forEach(button => {
    const active = button.dataset.medium === medium;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.getElementById("quality-mode-kicker").textContent = details.label;
  document.getElementById("quality-mode-description").textContent = details.description;
  document.getElementById("quality-sensor-requirement").textContent = details.hardware;
  document.getElementById("quality-brightness").textContent = "--";
  document.getElementById("quality-saturation").textContent = "--";
  document.getElementById("quality-contrast").textContent = "--";
  document.getElementById("quality-outcome").textContent = medium === "gas"
    ? "Unavailable from a standard RGB camera. Use the listed gas-specific instrument."
    : cameraStream
      ? "Reference cleared. Keep framing and lighting fixed, then capture a new reference."
      : "Connect a camera, then capture a reference under fixed lighting.";
  updateQualityModeControls();
}

function measureQualityFrame(source = document.getElementById("camera-video")) {
  const sourceWidth = source.videoWidth || source.width;
  const sourceHeight = source.videoHeight || source.height;
  if ((!cameraStream && source === document.getElementById("camera-video")) || !sourceWidth || !sourceHeight || qualityState.medium === "gas") return null;

  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 60;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const cropWidth = sourceWidth * 0.82;
  const cropHeight = sourceHeight * 0.5;
  context.drawImage(source, (sourceWidth - cropWidth) / 2, (sourceHeight - cropHeight) / 2, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let brightness = 0;
  let saturation = 0;
  const luminance = [];
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index] / 255;
    const green = pixels[index + 1] / 255;
    const blue = pixels[index + 2] / 255;
    const light = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    brightness += light;
    saturation += maximum === 0 ? 0 : (maximum - minimum) / maximum;
    luminance.push(light);
  }

  const count = luminance.length;
  const mean = brightness / count;
  const variance = luminance.reduce((total, value) => total + (value - mean) ** 2, 0) / count;
  return {
    brightness: mean * 100,
    saturation: saturation / count * 100,
    contrast: Math.sqrt(variance) * 100,
  };
}

function showQualityMetrics(metrics) {
  document.getElementById("quality-brightness").textContent = `${formatNumber(metrics.brightness, 1)}%`;
  document.getElementById("quality-saturation").textContent = `${formatNumber(metrics.saturation, 1)}%`;
  document.getElementById("quality-contrast").textContent = `${formatNumber(metrics.contrast, 1)}%`;
}

function captureQualityReference(source) {
  const metrics = measureQualityFrame(source);
  if (!metrics) return;
  qualityState.reference = { medium: qualityState.medium, metrics };
  showQualityMetrics(metrics);
  document.getElementById("quality-outcome").textContent = `Reference saved for ${qualityState.medium}. Keep camera distance, sample cell, and lighting unchanged for comparison.`;
}

function analyzeQualityFrame(source) {
  const metrics = measureQualityFrame(source);
  if (!metrics) return;
  showQualityMetrics(metrics);
  if (!qualityState.reference || qualityState.reference.medium !== qualityState.medium) {
    document.getElementById("quality-outcome").textContent = "Image metrics captured. Set a same-medium reference before comparing; these are not calibrated quality measurements.";
    return;
  }

  const reference = qualityState.reference.metrics;
  const delta = key => {
    const value = metrics[key] - reference[key];
    return `${value >= 0 ? "+" : ""}${formatNumber(value, 1)} pp`;
  };
  document.getElementById("quality-outcome").textContent = `Change from visual reference — brightness ${delta("brightness")}, saturation ${delta("saturation")}, contrast ${delta("contrast")}. This is an optical comparison only, not a quality verdict.`;
}

function saveCameraFrame() {
  const video = document.getElementById("camera-video");
  if (!cameraStream || !video.videoWidth || !video.videoHeight) return;

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(blob => {
    if (!blob) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `refinai-camera-${new Date().toISOString().replaceAll(":", "-")}.jpg`;
    link.click();
    URL.revokeObjectURL(link.href);
    document.getElementById("camera-status").textContent = "Frame saved to this device";
  }, "image/jpeg", 0.92);
}

function buildInstruments() {
  document.getElementById("instruments").innerHTML = INSTRUMENTS.map(instrument => `
    <article class="instrument ${instrument.kind}" data-field="${instrument.field}">
      <div class="instrument-head"><span class="tag-id">${instrument.tag}</span><span class="source-mark">${instrument.kind === "measured" ? "MEASURED" : "MODEL"}</span></div>
      <h3>${instrument.name}</h3>
      <div class="instrument-reading"><strong id="reading-${instrument.field}">--</strong><span>${instrument.unit}</span></div>
      <p>${instrument.location}</p>
    </article>`).join("");
}

const chartOptions = {
  responsive: true,
  animation: false,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  plugins: { legend: { labels: { color: "#d5dde1", boxWidth: 12, font: { size: 11 } } } },
  scales: {
    x: { ticks: { color: "#a8b2b7", maxTicksLimit: 9 }, grid: { color: "#27343a" } },
    y: { ticks: { color: "#a8b2b7" }, grid: { color: "#27343a" } },
  },
};

function buildCharts() {
  replayState.charts.output = new Chart(document.getElementById("outputChart"), {
    type: "line",
    data: { labels: [], datasets: [
      { label: "Measured net output (MW)", data: [], borderColor: "#d4a66a", pointRadius: 0, borderWidth: 2, tension: 0.18 },
      { label: "Model estimate (MW)", data: [], borderColor: "#8eabb2", pointRadius: 0, borderWidth: 2, borderDash: [5, 4], tension: 0.18 },
    ] },
    options: { ...chartOptions, scales: { ...chartOptions.scales, y: { ...chartOptions.scales.y, title: { display: true, text: "MW", color: "#a8b2b7" } } } },
  });

  replayState.charts.residual = new Chart(document.getElementById("residualChart"), {
    type: "bar",
    data: { labels: [], datasets: [{ label: "Measured - estimated (MW)", data: [], backgroundColor: "rgba(195,150,96,.72)", borderRadius: 2 }] },
    options: { ...chartOptions, scales: { ...chartOptions.scales, y: { ...chartOptions.scales.y, title: { display: true, text: "MW", color: "#a8b2b7" } } } },
  });

  replayState.charts.relationship = new Chart(document.getElementById("relationshipChart"), {
    type: "scatter",
    data: { datasets: [
      { label: "Measured output", data: [], backgroundColor: "#d4a66a", pointRadius: 3 },
      { label: "Model estimate", data: [], backgroundColor: "#8eabb2", pointRadius: 3 },
    ] },
    options: { ...chartOptions, scales: {
      x: { ...chartOptions.scales.x, title: { display: true, text: "Ambient temperature (C)", color: "#a8b2b7" } },
      y: { ...chartOptions.scales.y, title: { display: true, text: "Net output (MW)", color: "#a8b2b7" } },
    } },
  });

  replayState.charts.value = new Chart(document.getElementById("valueChart"), {
    type: "line",
    data: { labels: [], datasets: [{
      label: "Net annual value (₹ lakh)",
      data: [],
      borderColor: "#93d29d",
      backgroundColor: "rgba(147,210,157,.12)",
      pointBackgroundColor: "#93d29d",
      pointRadius: 3,
      borderWidth: 2,
      tension: 0.25,
      fill: true,
    }] },
    options: {
      ...chartOptions,
      plugins: { ...chartOptions.plugins, legend: { display: false } },
      scales: {
        ...chartOptions.scales,
        x: { ...chartOptions.scales.x, title: { display: true, text: "Assumed generation recovery", color: "#a8b2b7" } },
        y: {
          ...chartOptions.scales.y,
          title: { display: true, text: "Net annual value (₹ lakh)", color: "#a8b2b7" },
          ticks: { ...chartOptions.scales.y.ticks, callback: value => `₹${value}L` },
        },
      },
    },
  });
}

function updateCharts(sample) {
  replayState.history.push(sample);
  if (replayState.history.length > REPLAY_CONFIG.history_size) replayState.history.shift();
  const labels = replayState.history.map(reading => String(reading.sample_id));
  const chartSamples = replayState.history;

  replayState.charts.output.data.labels = labels;
  replayState.charts.output.data.datasets[0].data = chartSamples.map(reading => reading.PE);
  replayState.charts.output.data.datasets[1].data = chartSamples.map(reading => reading.PE_pred);
  replayState.charts.output.update("none");

  replayState.charts.residual.data.labels = labels;
  replayState.charts.residual.data.datasets[0].data = chartSamples.map(reading => reading.residual_MW);
  replayState.charts.residual.update("none");

  replayState.charts.relationship.data.datasets[0].data = chartSamples.map(reading => ({ x: reading.AT, y: reading.PE }));
  replayState.charts.relationship.data.datasets[1].data = chartSamples.map(reading => ({ x: reading.AT, y: reading.PE_pred }));
  replayState.charts.relationship.update("none");
}

let activeModuleId = null;

function renderModule(module) {
  activeModuleId = module.id;
  document.querySelectorAll(".module-tab").forEach(button => {
    const active = button.dataset.module === module.id;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  document.getElementById("module-category").textContent = module.group === "benchmark" ? "PUBLIC BENCHMARK VIEW" : `${module.medium.toUpperCase()} · HARDWARE READINESS`;
  document.getElementById("module-title").textContent = module.title || module.label;
  document.getElementById("module-description").textContent = module.group === "benchmark"
    ? "Visual analysis of held-out public benchmark data. The UCI records are shuffled and have no timestamps; these plots are not refinery telemetry."
    : `${module.measurement}. This input is not connected, so no live value is displayed.`;

  const chartWrap = document.getElementById("module-chart-wrap");
  const canvas = document.getElementById("module-chart");
  const image = document.getElementById("module-image");
  const pipeline = document.getElementById("module-pipeline");
  const empty = document.getElementById("module-empty");
  const status = document.getElementById("module-status");
  const sourceTitle = document.getElementById("module-source-title");
  const sourceDetail = document.getElementById("module-source-detail");
  const sourceMeta = document.getElementById("module-source-meta");

  if (replayState.charts.module) {
    replayState.charts.module.destroy();
    delete replayState.charts.module;
  }
  image.hidden = true;
  canvas.hidden = false;
  sourceMeta.replaceChildren();
  empty.hidden = true;

  if (module.group === "hardware") {
    chartWrap.hidden = true;
    pipeline.hidden = false;
    status.textContent = "CANDIDATE · NOT CONNECTED";
    sourceTitle.textContent = "Scope-dependent candidate";
    sourceDetail.textContent = `${module.sensor} may suit a specific measurement objective. It is not a universal project requirement, and no value is generated by this catalog view.`;
    document.getElementById("pipeline-sensor").textContent = module.sensor;
    [`Candidate measurement: ${module.measurement}`, `Possible interface (verify device model): ${module.protocol}`, "Status: no configured device or data source", "Selection depends on asset, hazard study, operating envelope, and approved pilot scope."].forEach(text => {
      const item = document.createElement("p");
      item.className = "info module-meta-item";
      item.textContent = text;
      sourceMeta.append(item);
    });
    return;
  }

  pipeline.hidden = true;
  chartWrap.hidden = false;
  status.textContent = module.kind === "image" ? "PUBLIC BENCHMARK IMAGE" : "UCI HELD-OUT REPLAY";
  sourceTitle.textContent = module.kind === "image" ? "NASA C-MAPSS FD001" : "UCI CCPP held-out split";
  sourceDetail.textContent = module.kind === "image"
    ? "Public simulated engine benchmark visualization; not refinery asset telemetry."
    : `${replayState.samples.length.toLocaleString("en-IN")} held-out measured records. Replay order is shuffled, not chronological.`;
  ["Source rows have no timestamps", "No HPCL plant connection"].forEach(text => {
    const item = document.createElement("p");
    item.className = "info module-meta-item";
    item.textContent = text;
    sourceMeta.append(item);
  });

  if (module.kind === "image") {
    canvas.hidden = true;
    image.src = `../ml/analytics/${module.image}`;
    image.alt = module.title;
    image.hidden = false;
    return;
  }

  const samples = replayState.samples;
  if (samples.length === 0) {
    empty.textContent = "Benchmark replay data is loading or unavailable.";
    empty.hidden = false;
    return;
  }

  let type = "scatter";
  let labels = [];
  let data = [];
  let xLabel = module.xLabel || module.field || "Value";
  let yLabel = module.yLabel || "Value";

  if (module.kind === "scatter") {
    data = samples.map(sample => ({ x: sample[module.x], y: sample[module.y] }));
  } else if (module.kind === "histogram") {
    type = "bar";
    const values = samples.map(sample => sample[module.field]).filter(Number.isFinite);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const binCount = 14;
    const binWidth = (maximum - minimum) / binCount || 1;
    const bins = Array(binCount).fill(0);
    values.forEach(value => bins[Math.min(binCount - 1, Math.floor((value - minimum) / binWidth))] += 1);
    labels = bins.map((_, index) => `${formatNumber(minimum + index * binWidth, 1)}–${formatNumber(minimum + (index + 1) * binWidth, 1)}`);
    data = bins;
    xLabel = module.xLabel;
    yLabel = "Record count";
  } else if (module.kind === "bands") {
    type = "bar";
    const values = samples.map(sample => sample[module.field]).filter(Number.isFinite);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const bandCount = 6;
    const bandWidth = (maximum - minimum) / bandCount || 1;
    const bands = Array.from({ length: bandCount }, () => ({ total: 0, count: 0 }));
    samples.forEach(sample => {
      const value = sample[module.field];
      const target = sample[module.target];
      if (!Number.isFinite(value) || !Number.isFinite(target)) return;
      const index = Math.min(bandCount - 1, Math.floor((value - minimum) / bandWidth));
      bands[index].total += target;
      bands[index].count += 1;
    });
    labels = bands.map((_, index) => `${formatNumber(minimum + index * bandWidth, 1)}–${formatNumber(minimum + (index + 1) * bandWidth, 1)}`);
    data = bands.map(band => band.count ? band.total / band.count : null);
    xLabel = module.xLabel;
    yLabel = module.yLabel;
  }

  replayState.charts.module = new Chart(canvas, {
    type,
    data: { labels, datasets: [{
      label: module.title,
      data,
      borderColor: "#d4a66a",
      backgroundColor: type === "scatter" ? "rgba(212,166,106,.58)" : "rgba(147,210,157,.62)",
      pointRadius: type === "scatter" ? 2 : 0,
      borderWidth: 2,
      tension: 0.12,
    }] },
    options: {
      ...chartOptions,
      plugins: { ...chartOptions.plugins, legend: { display: false } },
      scales: {
        x: { ...chartOptions.scales.x, type: type === "scatter" ? "linear" : "category", title: { display: true, text: xLabel, color: "#a8b2b7" } },
        y: { ...chartOptions.scales.y, title: { display: true, text: yLabel, color: "#a8b2b7" } },
      },
    },
  });
}

function simulatePilotTwinStep(advance = true) {
  const feedDemand = Number(document.getElementById("sim-feed").value);
  const pumpSpeedPercent = Number(document.getElementById("sim-speed").value);
  const valvePercent = Number(document.getElementById("sim-valve").value);
  const utilityTemperature = Number(document.getElementById("sim-utility").value);
  const downstreamDraw = Number(document.getElementById("sim-draw").value);
  const filterRestricted = document.getElementById("sim-filter-restriction").checked;
  const exchangerFouled = document.getElementById("sim-hx-fouling").checked;
  const airFilterBypassed = document.getElementById("media-air-bypass").checked;
  const waterTreatmentBypassed = document.getElementById("media-water-bypass").checked;
  const gasScrubberBypassed = document.getElementById("media-gas-bypass").checked;
  const oilFilterBypassed = document.getElementById("media-oil-bypass").checked;
  const airLoad = Number(document.getElementById("media-air-load").value) / 100;
  const waterLoad = Number(document.getElementById("media-water-load").value) / 100;
  const gasLoad = Number(document.getElementById("media-gas-load").value) / 100;
  const gatewayOnline = isHardwareTelemetryAvailable();

  const speed = pumpSpeedPercent / 100;
  const valveOpening = valvePercent / 100;
  const waterFlow = 46 * waterLoad;
  const suctionPressure = 0.05 + pilotTwinState.feedTankLevel * 0.018;
  const suctionAvailability = Math.max(0, Math.min(1,
    pilotTwinState.feedTankLevel / pilotTwinParameters.lowInventoryFlowLimitPercent));
  const filterFlowFactor = filterRestricted ? 0.68 : 1;
  const flow = feedDemand * speed * valveOpening * suctionAvailability * filterFlowFactor;
  const pumpHead = pilotTwinParameters.pumpStaticHeadBar + pilotTwinParameters.pumpDynamicHeadBar * speed ** 2;
  const filterDifferential = pilotTwinParameters.cleanFilterDropBar
    + pilotTwinParameters.filterResistanceBarPerFlowSquared * flow ** 2
    + (filterRestricted ? pilotTwinParameters.restrictedFilterExtraDropBar : 0);
  const lineLoss = pilotTwinParameters.lineResistanceBarPerFlowSquared * flow ** 2;
  const dischargePressure = Math.max(0, suctionPressure + pumpHead - filterDifferential - lineLoss);
  const inletTemperature = 35 + Math.sin(pilotTwinState.minutes / 11) * 0.35;
  const effectiveUa = exchangerFouled ? 0.26 : 0.82;
  const heatEffectiveness = 1 - Math.exp(-effectiveUa / Math.max(flow / 30, 0.2));
  const outletTemperature = inletTemperature + heatEffectiveness * (utilityTemperature - inletTemperature);
  const lowLevelVibration = pilotTwinState.feedTankLevel < 25
    ? (25 - pilotTwinState.feedTankLevel) * 0.07
    : 0;
  const vibration = 1.55
    + (100 - pumpSpeedPercent) * 0.035
    + (filterRestricted ? 0.35 : 0)
    + lowLevelVibration
    + Math.sin(pilotTwinState.minutes * 0.73) * 0.08;
  const motorPower = flow * pumpHead / (36 * pilotTwinParameters.pumpEfficiency);

  if (advance) {
    const minutesPerTick = 1;
    pilotTwinState.feedTankLevel = window.RefinAIProcessModel.advanceTankLevel(
      pilotTwinState.feedTankLevel,
      pilotTwinParameters.feedTankMakeupM3PerHour,
      flow,
      pilotTwinParameters.feedTankCapacityM3,
      minutesPerTick,
    );
    pilotTwinState.receiverLevel = window.RefinAIProcessModel.advanceTankLevel(
      pilotTwinState.receiverLevel,
      flow,
      downstreamDraw,
      pilotTwinParameters.receiverTankCapacityM3,
      minutesPerTick,
    );
    pilotTwinState.waterFeedLevel = window.RefinAIProcessModel.advanceTankLevel(
      pilotTwinState.waterFeedLevel,
      52,
      waterFlow,
      42,
      minutesPerTick,
    );
    pilotTwinState.waterProductLevel = window.RefinAIProcessModel.advanceTankLevel(
      pilotTwinState.waterProductLevel,
      waterFlow,
      35,
      36,
      minutesPerTick,
    );
    pilotTwinState.minutes += minutesPerTick;
  }

  const phase = pilotTwinState.minutes;
  const withDisplayNoise = (value, amplitude, offset) =>
    value + Math.sin(phase * 0.91 + offset) * amplitude;
  const media = window.RefinAIProcessModel.calculateMediaReadings({
    phase,
    airLoadPercent: Number(document.getElementById("media-air-load").value),
    waterLoadPercent: Number(document.getElementById("media-water-load").value),
    gasLoadPercent: Number(document.getElementById("media-gas-load").value),
    airFilterBypassed,
    waterTreatmentBypassed,
    gasScrubberBypassed,
    oilFilterBypassed,
    waterFeedLevel: pilotTwinState.waterFeedLevel,
    waterProductLevel: pilotTwinState.waterProductLevel,
    oilFlow: flow,
    oilFeedLevel: pilotTwinState.feedTankLevel,
    oilReceiverLevel: pilotTwinState.receiverLevel,
    oilOutletTemperature: outletTemperature,
    oilFilterRestricted: filterRestricted,
  });
  const values = {
    feedLevel: Math.max(0, Math.min(100, withDisplayNoise(pilotTwinState.feedTankLevel, 0.12, 0))),
    receiverLevel: Math.max(0, Math.min(100, withDisplayNoise(pilotTwinState.receiverLevel, 0.12, 1))),
    suctionPressure: withDisplayNoise(suctionPressure, 0.015, 2),
    flow: withDisplayNoise(flow, 0.12, 3),
    dischargePressure: withDisplayNoise(dischargePressure, 0.025, 4),
    filterDifferential: withDisplayNoise(filterDifferential, 0.012, 5),
    inletTemperature: withDisplayNoise(inletTemperature, 0.08, 6),
    outletTemperature: withDisplayNoise(outletTemperature, 0.12, 7),
    vibration: withDisplayNoise(vibration, 0.025, 8),
    motorPower: withDisplayNoise(motorPower, 0.08, 9),
    pumpSpeedPercent,
    valvePercent,
    gatewayOnline,
    filterRestricted,
    exchangerFouled,
    media,
  };
  document.getElementById("media-air-load-value").value = `${Math.round(airLoad * 100)}%`;
  document.getElementById("media-water-load-value").value = `${Math.round(waterLoad * 100)}%`;
  document.getElementById("media-gas-load-value").value = `${Math.round(gasLoad * 100)}%`;

  updateRefineryFlowPanel(media, !gatewayOnline);

  if (gatewayOnline || !pilotTwinState.readings) {
    pilotTwinState.readings = values;
  }
  renderPilotTwin(pilotTwinState.readings, !gatewayOnline);
  window.dispatchEvent(new CustomEvent("refinai:pilot-twin-update", {
    detail: { values, telemetryStale: !gatewayOnline, simulatedMinute: pilotTwinState.minutes },
  }));
  window.refinaiMultistreamSnapshot = {
    media,
    readings: gatewayOnline ? media : pilotTwinState.readings.media,
    telemetryStale: !gatewayOnline,
    simulatedMinute: pilotTwinState.minutes,
    scenarios: { airFilterBypassed, waterTreatmentBypassed, gasScrubberBypassed, oilFilterBypassed },
  };
  window.dispatchEvent(new CustomEvent("refinai:multistream-update", {
    detail: window.refinaiMultistreamSnapshot,
  }));
  return values;
}

function updateRefineryFlowPanel(media, stale) {
  const statusByMedium = {
    air: media.air.bypassed ? "Bypass" : "Normal",
    water: media.water.bypassed ? "Bypass" : "Normal",
    gas: media.gas.bypassed ? "Bypass" : "Normal",
    oil: media.oil.bypassed ? "Bypass" : "Normal",
  };
  const setStageReadout = (medium, flow, meterId, flowTextId, flowMetricId, statusId, extraStateClass = "") => {
    const stage = document.querySelector(`[data-refinery-stage="${medium}"]`);
    const meter = document.getElementById(meterId);
    const flowText = document.getElementById(flowTextId);
    const flowMetric = document.getElementById(flowMetricId);
    const status = document.getElementById(statusId);
    const percent = Math.min(100, Math.max(6, flow * 100 / (medium === "air" ? 1800 : medium === "water" ? 46 : medium === "gas" ? 24 : 80)));
    stage?.classList.toggle(`${medium}-active`, !stale);
    if (meter) meter.style.width = `${percent}%`;
    if (flowText) flowText.textContent = `${formatNumber(flow, 0)} ${medium === "air" || medium === "gas" ? "Nm³/h" : "m³/h"}`;
    if (flowMetric) flowMetric.textContent = `${formatNumber(flow, 0)} ${medium === "air" || medium === "gas" ? "Nm³/h" : "m³/h"}`;
    if (status) {
      const label = stale ? "Stale" : statusByMedium[medium];
      status.textContent = label;
      status.classList.toggle("warning", statusByMedium[medium] === "Bypass" || stale);
    }
    const card = document.querySelector(`.refinery-card[data-medium="${medium}"]`);
    if (card) card.classList.toggle("warning", statusByMedium[medium] === "Bypass" || stale);
  };

  setStageReadout("air", media.air.flow, "refinery-air-meter", "refinery-air-flow", "refinery-air-flow-metric", "refinery-air-status");
  setStageReadout("water", media.water.flow, "refinery-water-meter", "refinery-water-flow", "refinery-water-flow-metric", "refinery-water-status");
  setStageReadout("gas", media.gas.flow, "refinery-gas-meter", "refinery-gas-flow", "refinery-gas-flow-metric", "refinery-gas-status");
  setStageReadout("oil", media.oil.flow, "refinery-oil-meter", "refinery-oil-flow", "refinery-oil-flow-metric", "refinery-oil-status");

  const airStatus = document.getElementById("refinery-flow-status");
  airStatus.textContent = stale ? "Telemetry stale · demo view" : "Simulated process online";

  document.getElementById("refinery-air-pm25").textContent = `${formatNumber(media.air.pm25, 1)} µg/m³`;
  document.getElementById("refinery-air-pm10").textContent = `${formatNumber(media.air.pm10, 1)} µg/m³`;
  document.getElementById("refinery-air-composition").textContent = `${formatNumber(media.air.co2, 0)} / ${formatNumber(media.air.voc, 2)}`;
  document.getElementById("refinery-water-ph").textContent = `${formatNumber(media.water.ph, 2)}`;
  document.getElementById("refinery-water-turbidity").textContent = `${formatNumber(media.water.turbidity, 1)} NTU`;
  document.getElementById("refinery-water-chemistry").textContent = `${formatNumber(media.water.conductivity, 0)} / ${formatNumber(media.water.dissolvedOxygen, 2)}`;
  document.getElementById("refinery-gas-pressure").textContent = `${formatNumber(media.gas.pressure, 2)} bar`;
  document.getElementById("refinery-gas-h2s").textContent = `${formatNumber(media.gas.h2s, 1)} ppm`;
  document.getElementById("refinery-gas-methane").textContent = `${formatNumber(media.gas.methane, 1)} %`;
  document.getElementById("refinery-oil-temperature").textContent = `${formatNumber(media.oil.temperature, 1)} °C`;
  document.getElementById("refinery-oil-viscosity").textContent = `${formatNumber(media.oil.estimatedViscosity, 1)} cSt`;
  document.getElementById("refinery-oil-chemistry").textContent = `${formatNumber(media.oil.waterContent, 2)} / ${formatNumber(media.oil.particles, 0)}`;
}

function renderPilotTwin(values, stale) {
  const status = document.getElementById("twin-sim-status");
  const scenario = [
    values.filterRestricted ? "FILTER RESTRICTION" : "",
    values.exchangerFouled ? "HX FOULING" : "",
  ].filter(Boolean).join(" + ");
  status.textContent = stale
    ? "SIM RUNNING · TELEMETRY STALE"
    : scenario ? `SIM RUNNING · ${scenario}` : "SIM RUNNING · BASELINE";
  status.classList.toggle("stale-chip", stale);
  document.querySelector(".sim-twin").classList.toggle("telemetry-stale", stale);
  document.querySelector(".sim-connection-path").classList.toggle("offline", stale);
  document.getElementById("sim-clock").textContent =
    `Simulated time ${String(Math.floor(pilotTwinState.minutes / 60)).padStart(2, "0")}:${String(pilotTwinState.minutes % 60).padStart(2, "0")}`;

  const feedValue = Number(document.getElementById("sim-feed").value);
  const speedValue = Number(document.getElementById("sim-speed").value);
  const valveValue = Number(document.getElementById("sim-valve").value);
  const utilityValue = Number(document.getElementById("sim-utility").value);
  const drawValue = Number(document.getElementById("sim-draw").value);
  document.getElementById("sim-feed-value").textContent = `${feedValue} m³/h`;
  document.getElementById("sim-speed-value").textContent = `${speedValue}%`;
  document.getElementById("sim-valve-value").textContent = `${valveValue}%`;
  document.getElementById("sim-utility-value").textContent = `${utilityValue} °C`;
  document.getElementById("sim-draw-value").textContent = `${drawValue} m³/h`;

  const number = (value, digits = 1) => formatNumber(value, digits);
  document.getElementById("sim-feed-level").style.height = `${Math.max(0, Math.min(100, values.feedLevel))}%`;
  document.getElementById("sim-receiver-level").style.height = `${Math.max(0, Math.min(100, values.receiverLevel))}%`;
  document.getElementById("sim-level-value").textContent = `${number(values.feedLevel)} %`;
  document.getElementById("sim-receiver-value").textContent = `${number(values.receiverLevel)} %`;
  document.getElementById("sim-pump-state").textContent = `${values.pumpSpeedPercent}% speed · ${number(values.suctionPressure, 2)} bar suction`;
  document.getElementById("sim-filter-state").textContent = `ΔP ${number(values.filterDifferential, 2)} bar`;
  document.getElementById("sim-hx-state").textContent = `Outlet ${number(values.outletTemperature, 1)} °C`;
  document.getElementById("sim-flow-value").textContent = `${number(values.flow, 1)} m³/h`;
  document.getElementById("sim-pressure-value").textContent = `${number(values.dischargePressure, 2)} bar`;
  document.getElementById("sim-dp-value").textContent = `${number(values.filterDifferential, 2)} bar`;
  document.getElementById("sim-temp-value").textContent = `${number(values.outletTemperature, 1)} °C`;
  document.getElementById("sim-vibration-value").textContent = `${number(values.vibration, 2)} mm/s`;
  document.getElementById("sim-power-value").textContent = `${number(values.motorPower, 1)} kW`;
  document.getElementById("sim-pump-node").classList.toggle("scenario-active", values.vibration > 3.2);
  document.getElementById("sim-filter-node").classList.toggle("scenario-active", values.filterRestricted);
  document.getElementById("sim-hx-node").classList.toggle("scenario-active", values.exchangerFouled);
  document.getElementById("sim-pump-node").classList.toggle("scenario-watch", values.vibration > 3.2);
  document.getElementById("sim-flow-value").classList.toggle("sim-value-watch", values.flow < 30);
  document.getElementById("sim-temp-value").classList.toggle("sim-value-watch", values.exchangerFouled);

  const quality = stale ? "STALE · GATEWAY OFFLINE" : "SIMULATED · GOOD";
  const sensors = [
    ["LT-101", "Feed tank · level transmitter", `${number(values.feedLevel)} %`, "4–20 mA → remote I/O"],
    ["PT-101", "Pump suction · pressure transmitter", `${number(values.suctionPressure, 2)} bar`, "4–20 mA / HART → remote I/O"],
    ["PT-102", "Pump discharge · pressure transmitter", `${number(values.dischargePressure, 2)} bar`, "4–20 mA / HART → remote I/O"],
    ["FT-101", "Pump discharge · flowmeter", `${number(values.flow)} m³/h`, "Pulse / 4–20 mA → remote I/O"],
    ["DPIT-101", "Filter · differential pressure transmitter", `${number(values.filterDifferential, 2)} bar`, "4–20 mA / HART → remote I/O"],
    ["TT-101", "Exchanger inlet · temperature transmitter", `${number(values.inletTemperature)} °C`, "RTD → transmitter → remote I/O"],
    ["TT-102", "Exchanger outlet · temperature transmitter", `${number(values.outletTemperature)} °C`, "RTD → transmitter → remote I/O"],
    ["VIB-101", "Pump bearing · vibration monitor", `${number(values.vibration, 2)} mm/s`, "Vibration monitor → condition gateway"],
    ["EM-101", "Pump motor · power meter", `${number(values.motorPower)} kW`, "Power meter → Modbus / remote I/O"],
    ["LT-102", "Receiver · level transmitter", `${number(values.receiverLevel)} %`, "4–20 mA → remote I/O"],
  ];
  const tableBody = document.getElementById("sim-sensor-rows");
  tableBody.replaceChildren();
  sensors.forEach(([tag, location, value, path]) => {
    const row = document.createElement("tr");
    [tag, location, value, path, quality].forEach(text => {
      const cell = document.createElement("td");
      cell.textContent = text;
      row.append(cell);
    });
    tableBody.append(row);
  });

  if (pilotTwinState.chart) {
    pilotTwinState.chart.data.labels = pilotTwinState.history.map(point => point.time);
    pilotTwinState.chart.data.datasets[0].data = pilotTwinState.history.map(point => point.flow);
    pilotTwinState.chart.data.datasets[1].data = pilotTwinState.history.map(point => point.vibration);
    pilotTwinState.chart.update("none");
  }
  updateHardwareLab(values, stale);
}

function isHardwareTelemetryAvailable() {
  return document.getElementById("sim-gateway").checked
    && hardwareLabState.gatewayOnline
    && hardwareLabState.powerOn
    && hardwareLabState.busActive;
}

function addHardwareEvent(message, severity = "info") {
  const time = new Date().toLocaleTimeString([], { hour12: false });
  hardwareLabState.eventHistory.unshift({ time, message, severity });
  hardwareLabState.eventHistory = hardwareLabState.eventHistory.slice(0, 20);
  renderHardwareEventHistory();
}

function renderHardwareEventHistory() {
  const history = document.getElementById("alarm-history");
  history.replaceChildren();
  if (hardwareLabState.eventHistory.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No topology or alarm events yet.";
    history.append(item);
    return;
  }
  hardwareLabState.eventHistory.forEach(event => {
    const item = document.createElement("li");
    item.className = event.severity;
    const time = document.createElement("time");
    time.textContent = event.time;
    const message = document.createElement("span");
    message.textContent = event.message;
    item.append(time, message);
    history.append(item);
  });
}

function evaluateHardwareAlarms(values, stale) {
  demoAlarmRules.forEach(rule => {
    if (stale && rule.id !== "communications-lost") return;
    const active = rule.test(values, stale);
    const existing = hardwareLabState.activeAlarms.get(rule.id);
    if (active && !existing) {
      hardwareLabState.activeAlarms.set(rule.id, {
        id: rule.id,
        label: rule.label,
        severity: rule.severity,
        detail: rule.detail,
        acknowledged: false,
        raisedAt: new Date().toLocaleTimeString([], { hour12: false }),
      });
      addHardwareEvent(`${rule.label} · active`, rule.severity);
    } else if (!active && existing) {
      hardwareLabState.activeAlarms.delete(rule.id);
      addHardwareEvent(`${rule.label} · returned to normal`, "info");
    }
  });
  renderHardwareAlarms();
}

function renderHardwareAlarms() {
  const alarmList = document.getElementById("alarm-list");
  const active = [...hardwareLabState.activeAlarms.values()];
  document.getElementById("alarm-count").textContent = active.length
    ? `${active.length} active demo alarm${active.length === 1 ? "" : "s"}`
    : "No active demo alarms";
  alarmList.replaceChildren();
  if (active.length === 0) {
    const empty = document.createElement("li");
    empty.className = "alarm-empty";
    empty.textContent = "No active demonstration alarms.";
    alarmList.append(empty);
    return;
  }
  active.sort((left, right) => (left.severity === "high" ? -1 : 1) - (right.severity === "high" ? -1 : 1));
  active.forEach(alarm => {
    const item = document.createElement("li");
    item.className = `alarm-item ${alarm.severity}`;
    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = alarm.label;
    const detail = document.createElement("p");
    detail.textContent = `${alarm.detail} Raised ${alarm.raisedAt}. ${alarm.acknowledged ? "Acknowledged for this demo." : "Unacknowledged."}`;
    content.append(title, detail);
    const acknowledge = document.createElement("button");
    acknowledge.type = "button";
    acknowledge.dataset.ackAlarm = alarm.id;
    acknowledge.disabled = alarm.acknowledged;
    acknowledge.textContent = alarm.acknowledged ? "Acknowledged" : "Acknowledge";
    item.append(content, acknowledge);
    alarmList.append(item);
  });
}

function selectedAssetContains(asset) {
  return hierarchyAssets[hardwareLabState.selectedAsset]?.has(asset) || false;
}

function renderHealthMatrix(values, stale) {
  const healthRows = document.getElementById("health-rows");
  const communicationState = stale ? "Unknown" : "Available";
  const rows = [
    { asset: "feed-tank", equipment: "TK-101 · Feed tank", indication: `${formatNumber(values.feedLevel, 1)}% level`, status: values.feedLevel < 8 ? "Critical" : values.feedLevel < 20 ? "Watch" : "Healthy", basis: "Synthetic inventory balance; watch <20%" },
    { asset: "transfer-pump", equipment: "P-101 · Transfer pump", indication: `${formatNumber(values.vibration, 2)} mm/s · ${formatNumber(values.motorPower, 1)} kW`, status: values.vibration > 4 ? "Critical" : values.vibration > 3.2 ? "Watch" : "Healthy", basis: "Synthetic vibration / motor load; watch >3.2 mm/s" },
    { asset: "filter", equipment: "F-101 · Filter", indication: `${formatNumber(values.filterDifferential, 2)} bar ΔP`, status: values.filterDifferential > 1.3 ? "Critical" : values.filterDifferential > 0.9 ? "Watch" : "Healthy", basis: "Synthetic differential pressure; watch >0.90 bar" },
    { asset: "heat-exchanger", equipment: "E-101 · Heat exchanger", indication: `${formatNumber(values.inletTemperature, 1)} → ${formatNumber(values.outletTemperature, 1)} °C`, status: values.exchangerFouled ? "Watch" : "Healthy", basis: values.exchangerFouled ? "Fouling scenario toggle active" : "Synthetic inlet/outlet temperature response" },
    { asset: "receiver-tank", equipment: "TK-102 · Receiver tank", indication: `${formatNumber(values.receiverLevel, 1)}% level`, status: values.receiverLevel < 5 || values.receiverLevel > 95 ? "Critical" : values.receiverLevel < 10 || values.receiverLevel > 90 ? "Watch" : "Healthy", basis: "Synthetic inventory balance; illustrative 10–90% band" },
    { asset: "instrumentation", equipment: "I/O · Field instrumentation", indication: hardwareLabState.powerOn && hardwareLabState.busActive ? "Power and bus available" : "Power or bus unavailable", status: !hardwareLabState.powerOn || !hardwareLabState.busActive ? "Offline" : "Healthy", basis: "Topology switch state; process continues independently" },
    { asset: "gateway", equipment: "GW-01 · Read-only gateway", indication: communicationState, status: stale ? "Offline" : "Healthy", basis: "Mock read-only path; no network connection" },
  ];
  healthRows.replaceChildren();
  rows.forEach(rowData => {
    const row = document.createElement("tr");
    row.dataset.asset = rowData.asset;
    row.classList.toggle("selected-asset-row", selectedAssetContains(rowData.asset));
    const equipment = document.createElement("th");
    equipment.scope = "row";
    equipment.textContent = rowData.equipment;
    const indication = document.createElement("td");
    indication.textContent = stale ? `Last good · ${rowData.indication}` : rowData.indication;
    const stateCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `health-state ${rowData.status.toLowerCase()}`;
    badge.textContent = stale && rowData.asset !== "gateway" ? "Unknown" : rowData.status;
    stateCell.append(badge);
    const basis = document.createElement("td");
    basis.textContent = rowData.basis;
    row.append(equipment, indication, stateCell, basis);
    healthRows.append(row);
  });
  const overall = document.getElementById("health-overall");
  overall.textContent = stale
    ? "Telemetry unavailable"
    : rows.some(row => row.status === "Critical")
      ? "Demo condition · critical"
      : rows.some(row => row.status === "Watch" || row.status === "Offline")
        ? "Demo condition · watch"
        : "Demo condition · healthy";
  overall.classList.toggle("health-chip-alert", stale || rows.some(row => row.status !== "Healthy"));
}

function renderTagMap(values, stale) {
  const body = document.getElementById("tag-map-rows");
  body.replaceChildren();
  const tags = skidTagMap.filter(tag => selectedAssetContains(tag.asset));
  tags.forEach(tag => {
    const row = document.createElement("tr");
    row.dataset.asset = tag.asset;
    const value = values ? `${formatNumber(values[tag.field], tag.unit === "bar" || tag.unit === "mm/s" ? 2 : 1)} ${tag.unit}` : "Waiting";
    const fields = [
      tag.tag,
      tag.label,
      value,
      tag.signal,
      `MB ${tag.register} · ${tag.nodeId}`,
      tag.destination,
      stale ? "STALE · last good" : "SIMULATED · good",
    ];
    fields.forEach((text, index) => {
      const cell = document.createElement(index === 0 ? "th" : "td");
      if (index === 0) cell.scope = "row";
      cell.textContent = text;
      row.append(cell);
    });
    body.append(row);
  });
  document.getElementById("tag-map-status").textContent = stale ? "Stale · last-good snapshot" : "Simulated source";
}

function renderHardwareCatalog() {
  const grid = document.getElementById("hardware-grid");
  document.getElementById("hardware-catalog-count").textContent =
    `${hardwareCatalog.length} candidate entries · scope-dependent`;
  grid.replaceChildren();
  hardwareCatalog.forEach(component => {
    const card = document.createElement("article");
    card.className = "hardware-card";
    card.dataset.hardwareId = component.id;
    const head = document.createElement("div");
    head.className = "hardware-card-head";
    const title = document.createElement("h3");
    title.textContent = component.name;
    const state = document.createElement("span");
    state.className = "hardware-card-state";
    head.append(title, state);
    const metadata = document.createElement("p");
    metadata.textContent = `${component.medium} · ${component.type}`;
    const path = document.createElement("small");
    path.textContent = component.signal;
    card.append(head, metadata, path);
    grid.append(card);
  });
  renderHardwareCatalogStates();
}

function renderHardwareCatalogStates() {
  hardwareCatalog.forEach(component => {
    const card = document.querySelector(`[data-hardware-id="${component.id}"]`);
    if (!card) return;
    let label = component.state;
    let state = component.status;
    if (!hardwareLabState.powerOn) {
      label = "No field power";
      state = "offline";
    } else if (!hardwareLabState.busActive && component.type !== "power" && component.type !== "switch") {
      label = "Bus inactive";
      state = "offline";
    } else if (!isHardwareTelemetryAvailable() && !["power", "switch"].includes(component.type)) {
      label = "Stale at dashboard";
      state = "stale";
    }
    const badge = card.querySelector(".hardware-card-state");
    badge.className = `hardware-card-state ${state}`;
    badge.textContent = label;
  });
}

function updateHardwareLab(values, stale) {
  if (!values) return;
  hardwareLabState.lastValues = values;
  hardwareLabState.telemetryStale = stale;
  const overall = !hardwareLabState.powerOn
    ? "Power rail off"
    : !hardwareLabState.busActive
      ? "Field bus inactive"
      : !hardwareLabState.gatewayOnline
        ? "Gateway offline"
        : stale ? "Telemetry stale" : "Gateway online";
  document.getElementById("hardware-status").textContent = overall;
  document.getElementById("hardware-status").classList.toggle("health-chip-alert", stale);
  document.querySelectorAll(".hw-node").forEach(node => {
    const nodeId = node.dataset.node;
    const online = !stale && (nodeId !== "switch" || hardwareLabState.powerOn);
    node.classList.toggle("node-offline", !online);
  });
  document.querySelector(".hardware-schematic").classList.toggle("topology-offline", stale);
  document.getElementById("hardware-grid").classList.toggle("topology-offline", stale);
  renderHardwareCatalogStates();
  renderHealthMatrix(values, stale);
  renderTagMap(values, stale);
  evaluateHardwareAlarms(values, stale);
  window.refinaiHardwareSnapshot = {
    values,
    telemetryStale: stale,
    power: hardwareLabState.powerOn,
    bus: hardwareLabState.busActive,
    gateway: hardwareLabState.gatewayOnline,
  };
  window.dispatchEvent(new CustomEvent("refinai:hardware-lab-update", {
    detail: window.refinaiHardwareSnapshot,
  }));
}

function pollMockProtocol() {
  hardwareLabState.protocolPolls += 1;
  document.getElementById("protocol-poll-count").textContent = `Polls: ${hardwareLabState.protocolPolls}`;
  const status = document.getElementById("protocol-status");
  const body = document.getElementById("protocol-rows");
  body.replaceChildren();
  if (!hardwareLabState.lastValues || hardwareLabState.telemetryStale) {
    status.textContent = "Read failed · path unavailable";
    status.classList.add("health-chip-alert");
    const row = document.createElement("tr");
    const message = document.createElement("td");
    message.colSpan = 5;
    message.textContent = "No fresh mock snapshot: restore power, field bus, and read-only gateway before polling.";
    row.append(message);
    body.append(row);
    addHardwareEvent("Mock protocol poll failed because telemetry is unavailable.", "warning");
    return;
  }
  const protocol = document.getElementById("protocol-select").value;
  status.textContent = `Read-only snapshot returned · ${protocol === "modbus" ? "Modbus example" : "OPC UA example"}`;
  status.classList.remove("health-chip-alert");
  skidTagMap.forEach(tag => {
    const row = document.createElement("tr");
    const address = protocol === "modbus" ? `Holding register ${tag.register}` : tag.nodeId;
    const values = [
      address,
      tag.type,
      formatNumber(hardwareLabState.lastValues[tag.field], tag.unit === "bar" || tag.unit === "mm/s" ? 2 : 1),
      tag.unit,
      "GOOD · SYNTHETIC",
    ];
    values.forEach(text => {
      const cell = document.createElement("td");
      cell.textContent = text;
      row.append(cell);
    });
    body.append(row);
  });
  addHardwareEvent(`Mock ${protocol === "modbus" ? "Modbus TCP" : "OPC UA"} read completed · ${skidTagMap.length} synthetic tags.`, "info");
}

function setupHardwareLab() {
  renderHardwareCatalog();
  renderHardwareEventHistory();
  renderHardwareAlarms();
  document.querySelectorAll(".asset-tree-node").forEach(button => {
    button.addEventListener("click", () => {
      hardwareLabState.selectedAsset = button.dataset.asset;
      document.querySelectorAll(".asset-tree-node").forEach(node => {
        const selected = node === button;
        node.classList.toggle("active", selected);
        node.setAttribute("aria-pressed", String(selected));
      });
      if (hardwareLabState.lastValues) {
        renderHealthMatrix(hardwareLabState.lastValues, hardwareLabState.telemetryStale);
        renderTagMap(hardwareLabState.lastValues, hardwareLabState.telemetryStale);
      }
    });
  });
  document.getElementById("alarm-list").addEventListener("click", event => {
    const button = event.target.closest("[data-ack-alarm]");
    if (!button) return;
    const alarm = hardwareLabState.activeAlarms.get(button.dataset.ackAlarm);
    if (!alarm || alarm.acknowledged) return;
    alarm.acknowledged = true;
    addHardwareEvent(`${alarm.label} · acknowledged in demo console`, "info");
    renderHardwareAlarms();
  });
  document.getElementById("protocol-poll").addEventListener("click", pollMockProtocol);
  document.getElementById("hardware-power").addEventListener("change", event => {
    hardwareLabState.powerOn = event.currentTarget.checked;
    addHardwareEvent(`Simulated field power rail ${hardwareLabState.powerOn ? "energized" : "de-energized"}.`, hardwareLabState.powerOn ? "info" : "warning");
    simulatePilotTwinStep(false);
  });
  document.getElementById("hardware-bus").addEventListener("change", event => {
    hardwareLabState.busActive = event.currentTarget.checked;
    addHardwareEvent(`Simulated field bus ${hardwareLabState.busActive ? "enabled" : "disabled"}.`, hardwareLabState.busActive ? "info" : "warning");
    simulatePilotTwinStep(false);
  });
  document.getElementById("hardware-gateway").addEventListener("change", event => {
    hardwareLabState.gatewayOnline = event.currentTarget.checked;
    document.getElementById("sim-gateway").checked = hardwareLabState.gatewayOnline;
    addHardwareEvent(`Simulated read-only gateway ${hardwareLabState.gatewayOnline ? "connected" : "disconnected"}.`, hardwareLabState.gatewayOnline ? "info" : "warning");
    simulatePilotTwinStep(false);
  });
  document.getElementById("hardware-reset").addEventListener("click", () => {
    hardwareLabState.powerOn = true;
    hardwareLabState.busActive = true;
    hardwareLabState.gatewayOnline = true;
    document.getElementById("hardware-power").checked = true;
    document.getElementById("hardware-bus").checked = true;
    document.getElementById("hardware-gateway").checked = true;
    document.getElementById("sim-gateway").checked = true;
    hardwareLabState.activeAlarms.clear();
    addHardwareEvent("Hardware topology reset to simulated baseline.", "info");
    simulatePilotTwinStep(false);
  });
}

function setupPilotTwin() {
  const canvas = document.getElementById("sim-trend-chart");
  pilotTwinState.chart = new Chart(canvas, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        { label: "Flow (m³/h)", data: [], borderColor: "#80c8d0", backgroundColor: "rgba(128,200,208,.12)", pointRadius: 0, borderWidth: 2, tension: 0.18, yAxisID: "y" },
        { label: "Vibration (mm/s)", data: [], borderColor: "#e5b564", backgroundColor: "rgba(229,181,100,.12)", pointRadius: 0, borderWidth: 2, tension: 0.18, yAxisID: "y1" },
      ],
    },
    options: {
      ...chartOptions,
      plugins: { ...chartOptions.plugins, legend: { display: true, labels: { color: "#a8b2b7" } } },
      scales: {
        x: { ...chartOptions.scales.x, title: { display: true, text: "Simulated time (min)", color: "#a8b2b7" } },
        y: { ...chartOptions.scales.y, title: { display: true, text: "Flow (m³/h)", color: "#80c8d0" } },
        y1: { ...chartOptions.scales.y, position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "Vibration (mm/s)", color: "#e5b564" } },
      },
    },
  });

  const update = () => {
    const values = simulatePilotTwinStep(true);
    pilotTwinState.history.push({
      time: String(pilotTwinState.minutes),
      flow: values.flow,
      vibration: values.vibration,
    });
    if (pilotTwinState.history.length > 36) pilotTwinState.history.shift();
    if (isHardwareTelemetryAvailable()) {
      renderPilotTwin(values, false);
    }
  };

  ["sim-feed", "sim-speed", "sim-valve", "sim-utility", "sim-draw"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => {
      const values = simulatePilotTwinStep(false);
      if (isHardwareTelemetryAvailable()) renderPilotTwin(values, false);
    });
  });
  ["sim-filter-restriction", "sim-hx-fouling"].forEach(id => {
    document.getElementById(id).addEventListener("change", () => {
      const values = simulatePilotTwinStep(false);
      if (isHardwareTelemetryAvailable()) renderPilotTwin(values, false);
    });
  });
  ["media-air-bypass", "media-water-bypass", "media-gas-bypass", "media-oil-bypass"].forEach(id => {
    document.getElementById(id).addEventListener("change", () => simulatePilotTwinStep(false));
  });
  document.getElementById("media-reset").addEventListener("click", () => {
    ["media-air-bypass", "media-water-bypass", "media-gas-bypass", "media-oil-bypass"].forEach(id => {
      document.getElementById(id).checked = false;
    });
    simulatePilotTwinStep(false);
  });
  ["media-air-load", "media-water-load", "media-gas-load"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => simulatePilotTwinStep(false));
  });
  document.getElementById("sim-gateway").addEventListener("change", () => {
    hardwareLabState.gatewayOnline = document.getElementById("sim-gateway").checked;
    document.getElementById("hardware-gateway").checked = hardwareLabState.gatewayOnline;
    if (isHardwareTelemetryAvailable()) {
      const values = simulatePilotTwinStep(false);
      renderPilotTwin(values, false);
    } else {
      renderPilotTwin(pilotTwinState.readings, true);
    }
  });
  document.getElementById("sim-reset").addEventListener("click", () => {
    pilotTwinState.minutes = 0;
    pilotTwinState.feedTankLevel = 68;
    pilotTwinState.receiverLevel = 52;
    pilotTwinState.waterFeedLevel = 61;
    pilotTwinState.waterProductLevel = 43;
    pilotTwinState.history = [];
    pilotTwinState.chart.data.labels = [];
    pilotTwinState.chart.data.datasets.forEach(dataset => { dataset.data = []; });
    pilotTwinState.chart.update("none");
    document.getElementById("sim-feed").value = "55";
    document.getElementById("sim-speed").value = "90";
    document.getElementById("sim-valve").value = "90";
    document.getElementById("sim-utility").value = "150";
    document.getElementById("sim-draw").value = "45";
    document.getElementById("sim-filter-restriction").checked = false;
    document.getElementById("sim-hx-fouling").checked = false;
    ["media-air-bypass", "media-water-bypass", "media-gas-bypass", "media-oil-bypass"].forEach(id => {
      document.getElementById(id).checked = false;
    });
    document.getElementById("media-air-load").value = "72";
    document.getElementById("media-water-load").value = "68";
    document.getElementById("media-gas-load").value = "64";
    document.getElementById("sim-gateway").checked = true;
    hardwareLabState.gatewayOnline = true;
    document.getElementById("hardware-gateway").checked = true;
    pilotTwinState.readings = null;
    simulatePilotTwinStep(false);
  });

  simulatePilotTwinStep(false);
  window.setInterval(update, 1000);
}

function setupModuleWorkspace() {
  const tabs = document.getElementById("module-tabs");
  document.getElementById("module-count").textContent = `${moduleCatalog.length} modules`;
  moduleCatalog.forEach(module => {
    const button = document.createElement("button");
    button.className = "module-tab";
    button.dataset.module = module.id;
    button.dataset.group = module.group;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", "false");
    button.textContent = module.label;
    button.addEventListener("click", () => {
      if (!document.getElementById("panel-modules").classList.contains("active")) {
        document.querySelector('.tab[data-tab="modules"]').click();
      }
      renderModule(module);
    });
    tabs.append(button);
  });

  document.querySelectorAll(".module-filter").forEach(button => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;
      document.querySelectorAll(".module-filter").forEach(filterButton => {
        const active = filterButton === button;
        filterButton.classList.toggle("active", active);
        filterButton.setAttribute("aria-pressed", String(active));
      });
      document.querySelectorAll(".module-tab").forEach(moduleButton => {
        moduleButton.hidden = filter !== "all" && moduleButton.dataset.group !== filter;
      });
      const current = moduleCatalog.find(module => module.id === activeModuleId);
      if (filter !== "all" && current?.group !== filter) {
        renderModule(moduleCatalog.find(module => module.group === filter));
      }
    });
  });
}

function computeDecisionState(sample) {
  const residual = Math.abs(sample.residual_MW || 0);
  const temperatureStress = sample.AT > 30 ? 18 : sample.AT > 25 ? 9 : 0;
  const vacuumStress = sample.V > 70 ? 14 : sample.V > 60 ? 8 : 0;
  const humidityStress = sample.RH > 75 ? 12 : sample.RH > 65 ? 6 : 0;
  const riskIndex = Math.min(100, 22 + residual * 11 + temperatureStress + vacuumStress + humidityStress);
  const assets = [
    { name: "Gas turbine", score: Math.max(70, 100 - residual * 6 - (sample.AT > 26 ? 8 : 0)), band: residual > 3 ? "warn" : "ok" },
    { name: "HRSG", score: Math.max(73, 100 - residual * 4.5 - (sample.V > 65 ? 10 : 0)), band: residual > 2.5 ? "warn" : "ok" },
    { name: "Steam turbine", score: Math.max(71, 100 - residual * 5.5 - (sample.AP < 1000 ? 9 : 0)), band: residual > 3 ? "warn" : "ok" },
    { name: "Cooling tower", score: Math.max(72, 100 - (sample.RH > 70 ? 15 : 0) - (sample.V > 65 ? 8 : 0)), band: sample.RH > 70 ? "warn" : "ok" },
    { name: "Generator", score: Math.max(76, 100 - residual * 5.2), band: residual > 2.8 ? "warn" : "ok" },
  ];

  const outsideBenchmarkMae = residual > REPLAY_CONFIG.benchmark_mae_mw;
  const actions = [
    outsideBenchmarkMae
      ? { text: `This single-sample residual (${formatNumber(residual, 2)} MW) exceeds the held-out set MAE. This comparison is context only; verify timestamped, unit-specific data before operational interpretation.`, level: "warn" }
      : { text: `This single-sample residual (${formatNumber(residual, 2)} MW) is below the held-out set MAE. That does not establish normal operation or rule out an issue.`, level: "ok" },
    { text: "This shuffled benchmark has no timestamps or maintenance labels; it cannot diagnose an asset fault or prove a cleaning need.", level: "ok" },
    { text: "Pilot gate: validate the workflow against approved, time-aligned refinery historian data with operator review.", level: "ok" },
  ];

  return { riskIndex, assets, actions };
}

function renderSampleEvidence(sample) {
  const interval = document.getElementById("sample-interval");
  const intervalNote = document.getElementById("sample-interval-note");
  const intervalMetadata = replayState.metadata?.prediction_interval;
  if (Number.isFinite(sample.prediction_lower_MW) && Number.isFinite(sample.prediction_upper_MW)) {
    interval.textContent = `${formatNumber(sample.prediction_lower_MW, 2)}–${formatNumber(sample.prediction_upper_MW, 2)} MW`;
    const coverage = Number.isFinite(intervalMetadata?.test_coverage)
      ? `; held-out test coverage ${formatNumber(intervalMetadata.test_coverage * 100, 1)}%`
      : "";
    intervalNote.textContent = `${formatNumber((intervalMetadata?.nominal_coverage || 0.9) * 100, 0)}% split-conformal benchmark interval${coverage}`;
  } else {
    interval.textContent = "Unavailable";
    intervalNote.textContent = "Regenerate replay data with ml/train_real_models.py";
  }

  const fields = ["AT", "V", "AP", "RH"];
  const missing = fields.filter(field => !Number.isFinite(sample[field]));
  document.getElementById("sample-quality").textContent = missing.length ? `${missing.length} missing` : "Complete";
  document.getElementById("sample-quality-note").textContent = missing.length
    ? `Missing or invalid: ${missing.join(", ")}`
    : "All four model inputs are finite";

  const references = replayState.metadata?.input_reference_ranges;
  const support = document.getElementById("sample-support");
  const supportNote = document.getElementById("sample-support-note");
  if (!references || missing.length) {
    support.textContent = missing.length ? "Not assessed" : "Unavailable";
    supportNote.textContent = missing.length
      ? "Resolve missing model inputs before comparing support"
      : "No training reference ranges in replay metadata";
    return;
  }
  const outside = fields.filter(field => {
    const range = references[field];
    return !range || sample[field] < range.lower || sample[field] > range.upper;
  });
  support.textContent = outside.length ? `${outside.length} outside reference` : "Within reference";
  supportNote.textContent = outside.length
    ? `Outside 1st–99th percentile: ${outside.join(", ")}`
    : "All inputs within model-fit 1st–99th percentile ranges";

  const monitor = replayState.metadata?.process_monitoring;
  const t2Status = document.getElementById("sample-t2-status");
  const t2Note = document.getElementById("sample-t2-note");
  const qStatus = document.getElementById("sample-q-status");
  const qNote = document.getElementById("sample-q-note");
  if (!monitor || !Number.isFinite(sample.t2_score) || !Number.isFinite(sample.q_residual_score)) {
    t2Status.textContent = "Unavailable";
    t2Note.textContent = "Regenerate benchmark replay with PCA statistics";
    qStatus.textContent = "Unavailable";
    qNote.textContent = "Regenerate benchmark replay with PCA statistics";
    return;
  }

  const t2Flag = sample.t2_reference_flag === true;
  const qFlag = sample.q_reference_flag === true;
  t2Status.textContent = `${t2Flag ? "Above" : "Below"} reference · ${formatNumber(sample.t2_score, 2)}`;
  t2Note.textContent = `99th percentile ${formatNumber(monitor.t2_reference_threshold, 2)}; test flag rate ${formatNumber(monitor.test_t2_flag_rate * 100, 1)}%; largest contribution: ${sample.t2_top_feature}`;
  qStatus.textContent = `${qFlag ? "Above" : "Below"} reference · ${formatNumber(sample.q_residual_score, 2)}`;
  qNote.textContent = `99th percentile ${formatNumber(monitor.q_reference_threshold, 2)}; test flag rate ${formatNumber(monitor.test_q_flag_rate * 100, 1)}%; largest residual contribution: ${sample.q_top_feature}`;
}

function loadReviewRecords() {
  try {
    const saved = window.localStorage.getItem(reviewStorageKey);
    if (!saved) return;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.some(record =>
      !record || !Number.isFinite(record.sample_id) ||
      !["accept", "defer", "reject"].includes(record.decision) ||
      typeof record.note !== "string" || typeof record.reviewed_at !== "string"
    )) {
      throw new Error("Saved review log has an unexpected format");
    }
    reviewRecords = parsed;
  } catch (error) {
    reviewStorageAvailable = false;
    document.getElementById("review-status").textContent = `Browser review storage unavailable: ${error.message}`;
  }
}

function renderOperatorReview(sample) {
  const record = reviewRecords.find(item => item.sample_id === sample.sample_id);
  document.getElementById("review-sample-id").textContent = sample.sample_id.toLocaleString("en-IN");
  document.getElementById("review-decision").value = record?.decision || "";
  document.getElementById("review-note").value = record?.note || "";
  document.getElementById("review-count").textContent = `${reviewRecords.length} saved`;
  if (reviewStorageAvailable) {
    document.getElementById("review-status").textContent = record
      ? `Saved ${record.decision} review for source row ${sample.sample_id}.`
      : `No review saved for source row ${sample.sample_id}.`;
  }
}

function pauseReplayForReview() {
  if (!replayState.playing) return;
  replayState.playing = false;
  const playButton = document.getElementById("play-toggle");
  playButton.textContent = "Play";
  playButton.setAttribute("aria-pressed", "false");
  document.getElementById("replay-state").textContent = "REPLAY PAUSED";
}

function saveOperatorReview() {
  const sample = replayState.samples[replayState.position];
  const decision = document.getElementById("review-decision").value;
  const status = document.getElementById("review-status");
  if (!sample) {
    status.textContent = "Cannot save a review because no benchmark sample is selected.";
    return;
  }
  if (!decision) {
    status.textContent = "Select an outcome before saving the review.";
    return;
  }
  const record = {
    sample_id: sample.sample_id,
    decision,
    note: document.getElementById("review-note").value.trim(),
    reviewed_at: new Date().toISOString(),
  };
  const existingIndex = reviewRecords.findIndex(item => item.sample_id === record.sample_id);
  if (existingIndex === -1) reviewRecords.push(record);
  else reviewRecords[existingIndex] = record;
  try {
    window.localStorage.setItem(reviewStorageKey, JSON.stringify(reviewRecords));
    reviewStorageAvailable = true;
    status.textContent = `Saved ${decision} review for source row ${sample.sample_id} in this browser.`;
  } catch (error) {
    reviewStorageAvailable = false;
    status.textContent = `Review retained for this page only; browser storage failed: ${error.message}`;
  }
  document.getElementById("review-count").textContent = `${reviewRecords.length} saved`;
}

function exportReviewRecords() {
  const status = document.getElementById("review-status");
  if (!reviewRecords.length) {
    status.textContent = "There are no saved reviews to export.";
    return;
  }
  const exportData = {
    source: "RefinAI browser-local benchmark sample reviews",
    exported_at: new Date().toISOString(),
    note: "Demonstration feedback only; not operational approval or a plant record.",
    records: reviewRecords,
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "refinai-sample-reviews.json";
  link.click();
  URL.revokeObjectURL(url);
  status.textContent = `Exported ${reviewRecords.length} browser-local sample reviews.`;
}

function renderDecisionPanel(sample) {
  const decision = computeDecisionState(sample);
  const healthRoot = document.getElementById("asset-health");
  healthRoot.innerHTML = decision.assets.map(asset => {
    const badge = asset.score >= 88 ? "ok" : asset.score >= 75 ? "warn" : "crit";
    const label = badge === "ok" ? "Stable" : badge === "warn" ? "Watch" : "Action";
    return `
      <div class="unit">
        <div class="u-name"><span>${asset.name}</span><span class="badge ${badge}">${label}</span></div>
        <div class="metrics">
          <div class="metric"><span>Health score</span><b>${Math.round(asset.score)}/100</b></div>
          <div class="bar ${badge === "warn" ? "warn" : badge === "crit" ? "crit" : ""}"><i style="width:${Math.round(asset.score)}%"></i></div>
        </div>
      </div>`;
  }).join("");

  const eventStream = document.getElementById("event-stream");
  if (eventStream) {
    const eventEntries = [
      { level: "ok", text: `Ambient conditions ${formatNumber(sample.AT, 1)}°C / ${formatNumber(sample.RH, 1)}% humidity` },
      { level: Math.abs(sample.residual_MW) > REPLAY_CONFIG.benchmark_mae_mw ? "warn" : "ok", text: `Absolute residual ${formatNumber(Math.abs(sample.residual_MW), 2)} MW; held-out set MAE ${formatNumber(REPLAY_CONFIG.benchmark_mae_mw, 2)} MW (context only)` },
      { level: "ok", text: "No timestamps or maintenance labels are available; this replay cannot confirm an operating condition." },
    ];
    eventStream.innerHTML = eventEntries.map(item => `
      <li class="event-item ${item.level === "crit" ? "crit" : item.level === "warn" ? "warn" : "ok"}">
        <span class="event-dot"></span>
        <span>${item.text}</span>
      </li>
    `).join("");
  }

  document.getElementById("status-samples").textContent = replayState.samples.length.toLocaleString("en-IN");
  document.getElementById("status-samples-note").textContent = "UCI CCPP held-out 20% test split";
  document.getElementById("status-residual").textContent = `${sample.residual_MW >= 0 ? "+" : ""}${formatNumber(sample.residual_MW, 2)} MW`;
  document.getElementById("status-residual-note").textContent = "Single record; measured minus estimate";
  document.getElementById("status-mae").textContent = `${formatNumber(REPLAY_CONFIG.benchmark_mae_mw, 2)} MW`;
  document.getElementById("status-mae-note").textContent = "Held-out mean absolute error; not a fault limit";
  document.getElementById("status-r2").textContent = Number(REPLAY_CONFIG.benchmark_r2).toFixed(3);
  document.getElementById("status-r2-note").textContent = "Held-out R²; public benchmark only";

  const actionList = document.getElementById("action-list");
  actionList.innerHTML = decision.actions.map(action => `
    <li class="${action.level === "crit" ? "crit" : action.level === "warn" ? "warn" : ""}">
      <span>${action.text}</span>
      <span class="t">${action.level === "crit" ? "High" : action.level === "warn" ? "Medium" : "Routine"}</span>
    </li>
  `).join("");

  const tempSlider = document.getElementById("scenario-temp");
  const vacuumSlider = document.getElementById("scenario-vacuum");
  const maintSlider = document.getElementById("scenario-maint");
  const tempValue = document.getElementById("scenario-temp-value");
  const vacuumValue = document.getElementById("scenario-vacuum-value");
  const maintValue = document.getElementById("scenario-maint-value");
  const outputEl = document.getElementById("scenario-output");
  const scenarioRiskEl = document.getElementById("scenario-risk");
  const energyEl = document.getElementById("scenario-energy");

  const scenarioOutput = () => {
    const tempDelta = Number(tempSlider.value);
    const vacuumDelta = Number(vacuumSlider.value);
    const maintPriority = Number(maintSlider.value) / 100;
    const output = sample.PE + tempDelta * -0.42 + vacuumDelta * 0.19;
    const risk = Math.min(100, Math.max(20, decision.riskIndex + tempDelta * 1.4 + vacuumDelta * 0.6 - maintPriority * 20));
    const outputDelta = output - sample.PE;
    return { output, risk, outputDelta };
  };

  const updateDisplays = () => {
    const values = scenarioOutput();
    tempValue.textContent = `${Number(tempSlider.value) >= 0 ? "+" : ""}${tempSlider.value}°C`;
    vacuumValue.textContent = `${Number(vacuumSlider.value) >= 0 ? "+" : ""}${vacuumSlider.value} cm Hg`;
    maintValue.textContent = `${maintSlider.value} / 100`;
    outputEl.textContent = `${formatNumber(values.output, 2)} MW`;
    scenarioRiskEl.textContent = `${Math.round(values.risk)}/100`;
    energyEl.textContent = `${values.outputDelta >= 0 ? "+" : ""}${formatNumber(values.outputDelta, 2)} MW`;
  };

  [tempSlider, vacuumSlider, maintSlider].forEach(input => input.oninput = updateDisplays);
  updateDisplays();
  updateValueCase(sample);
}

function updateValueCase(sample) {
  const recoverySlider = document.getElementById("recovery-slider");
  const hoursSlider = document.getElementById("hours-slider");
  const tariffSlider = document.getElementById("tariff-slider");
  const omSlider = document.getElementById("om-slider");
  const costSlider = document.getElementById("cost-slider");
  if (!sample || !replayState.charts.value || !recoverySlider || !hoursSlider || !tariffSlider || !omSlider || !costSlider) return;

  const render = () => {
    const recoveryPct = Number(recoverySlider.value);
    const operatingHours = Number(hoursSlider.value);
    const tariff = Number(tariffSlider.value);
    const annualOmLakh = Number(omSlider.value);
    const pilotCostLakh = Number(costSlider.value);
    const annualMWh = sample.PE * (recoveryPct / 100) * operatingHours;
    const grossValue = annualMWh * 1000 * tariff;
    const annualNetValue = grossValue - annualOmLakh * 100000;
    const firstYearValue = annualNetValue - pilotCostLakh * 100000;
    const paybackMonths = annualNetValue > 0 ? pilotCostLakh * 100000 / annualNetValue * 12 : Infinity;

    document.getElementById("recovery-value").textContent = `${formatNumber(recoveryPct, 1)}%`;
    document.getElementById("hours-value").textContent = `${operatingHours.toLocaleString("en-IN")} h`;
    document.getElementById("tariff-value").textContent = `₹${formatNumber(tariff, 2)} / kWh`;
    document.getElementById("om-value").textContent = `₹${annualOmLakh} lakh`;
    document.getElementById("cost-value").textContent = `₹${pilotCostLakh} lakh`;
    document.getElementById("value-energy").textContent = `${formatNumber(annualMWh, 0)} MWh/year`;
    document.getElementById("value-gross").textContent = `${formatValueInr(grossValue)} / year`;
    document.getElementById("value-net").textContent = `${formatValueInr(annualNetValue)} / year`;
    document.getElementById("value-first-year").textContent = formatValueInr(firstYearValue);
    document.getElementById("value-payback").textContent = Number.isFinite(paybackMonths)
      ? `${formatNumber(paybackMonths, 1)} months`
      : "No payback at these assumptions";

    const recoveryScenarios = [0.1, 0.3, 0.5, 0.7, 0.9, 1.1, 1.3, 1.5];
    replayState.charts.value.data.labels = recoveryScenarios.map(value => `${value.toFixed(1)}%`);
    replayState.charts.value.data.datasets[0].data = recoveryScenarios.map(value => (
      (sample.PE * value / 100 * operatingHours * 1000 * tariff) / 100000 - annualOmLakh
    ));
    replayState.charts.value.update("none");
  };

  [recoverySlider, hoursSlider, tariffSlider, omSlider, costSlider].forEach(input => input.oninput = render);
  render();
}

function renderSample(position, addToHistory = true) {
  if (replayState.samples.length === 0) return;
  replayState.position = (position + replayState.samples.length) % replayState.samples.length;
  const sample = replayState.samples[replayState.position];
  const values = { ...sample, residual_MW: sample.residual_MW };

  INSTRUMENTS.forEach(instrument => {
    const element = document.getElementById(`reading-${instrument.field}`);
    element.textContent = formatNumber(values[instrument.field], instrument.digits);
  });

  document.getElementById("kpi-at").textContent = formatNumber(sample.AT);
  document.getElementById("kpi-vacuum").textContent = formatNumber(sample.V);
  document.getElementById("kpi-pressure").textContent = formatNumber(sample.AP);
  document.getElementById("kpi-humidity").textContent = formatNumber(sample.RH);
  document.getElementById("kpi-output").textContent = formatNumber(sample.PE);
  document.getElementById("kpi-estimate").textContent = formatNumber(sample.PE_pred);
  document.getElementById("sample-id").textContent = `Source row ${sample.sample_id.toLocaleString("en-IN")}`;
  document.getElementById("sample-position").textContent = `${replayState.position + 1} / ${replayState.samples.length}`;
  document.getElementById("sample-position-replay").textContent = `${replayState.position + 1} / ${replayState.samples.length.toLocaleString("en-IN")}`;
  document.getElementById("sample-seek").value = replayState.position;

  const residualBadge = document.getElementById("residual-badge");
  const inRange = Math.abs(sample.residual_MW) <= REPLAY_CONFIG.benchmark_mae_mw;
  residualBadge.textContent = inRange ? "Within benchmark MAE" : "Outside benchmark MAE";
  residualBadge.className = `residual-badge ${inRange ? "in-range" : "out-range"}`;
  document.getElementById("sample-row").innerHTML = `
    <td>${sample.sample_id}</td><td>${formatNumber(sample.AT)}</td><td>${formatNumber(sample.V)}</td>
    <td>${formatNumber(sample.AP)}</td><td>${formatNumber(sample.RH)}</td>
    <td>${formatNumber(sample.PE)}</td><td>${formatNumber(sample.PE_pred)}</td><td>${formatNumber(sample.residual_MW)}</td>`;

  renderDecisionPanel(sample);
  renderSampleEvidence(sample);
  renderOperatorReview(sample);
  window.plantSample = sample;
  if (window.updatePlantTwin) window.updatePlantTwin(sample);
  if (addToHistory) updateCharts(sample);
}

async function loadReplay() {
  const status = document.getElementById("source-status");
  try {
    const response = await fetch(REPLAY_CONFIG.data_file);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.samples) || payload.samples.length === 0) throw new Error("Replay file has no samples");
    replayState.samples = payload.samples;
    replayState.metadata = payload;
    const params = new URLSearchParams(window.location.search);
    const requestedSample = Number.parseInt(params.get("physical-replay") || "", 10);
    const startIndex = Number.isFinite(requestedSample) && requestedSample >= 0 && requestedSample < payload.samples.length
      ? requestedSample
      : 0;

    status.textContent = `${payload.source} · ${payload.sample_count.toLocaleString("en-IN")} held-out measured records · ${payload.sample_order}`;
    document.getElementById("replay-state").textContent = "HISTORICAL SAMPLE REPLAY";
    document.getElementById("sample-seek").max = String(payload.samples.length - 1);
    if (Number.isFinite(requestedSample) && requestedSample >= 0) {
      replayState.playing = false;
      document.getElementById("play-toggle").textContent = "Play";
      document.getElementById("play-toggle").setAttribute("aria-pressed", "false");
      document.getElementById("replay-state").textContent = "REPLAY PAUSED";
      status.textContent = `${status.textContent} · physical replay target: sample ${startIndex}`;
    }
    renderSample(startIndex);
    if (activeModuleId) {
      const activeModule = moduleCatalog.find(module => module.id === activeModuleId);
      if (activeModule) renderModule(activeModule);
    }
    window.setInterval(() => {
      if (replayState.playing) renderSample(replayState.position + 1);
    }, REPLAY_CONFIG.tick_ms);
  } catch (error) {
    status.textContent = `Historical replay unavailable: ${error.message}. Run python ml/train_real_models.py, then serve the project over HTTP.`;
    document.getElementById("replay-state").textContent = "DATA FILE UNAVAILABLE";
  }
}

document.getElementById("play-toggle").addEventListener("click", event => {
  replayState.playing = !replayState.playing;
  event.currentTarget.textContent = replayState.playing ? "Pause" : "Play";
  event.currentTarget.setAttribute("aria-pressed", String(replayState.playing));
  document.getElementById("replay-state").textContent = replayState.playing ? "SAMPLE REPLAY" : "REPLAY PAUSED";
});
document.getElementById("sample-back").addEventListener("click", () => renderSample(replayState.position - 1));
document.getElementById("sample-next").addEventListener("click", () => renderSample(replayState.position + 1));
document.getElementById("sample-seek").addEventListener("input", event => {
  replayState.playing = false;
  document.getElementById("play-toggle").textContent = "Play";
  document.getElementById("play-toggle").setAttribute("aria-pressed", "false");
  document.getElementById("replay-state").textContent = "REPLAY PAUSED";
  renderSample(Number(event.currentTarget.value));
});
document.getElementById("review-decision").addEventListener("focus", pauseReplayForReview);
document.getElementById("review-note").addEventListener("focus", pauseReplayForReview);
document.getElementById("save-review").addEventListener("click", saveOperatorReview);
document.getElementById("export-reviews").addEventListener("click", exportReviewRecords);
document.getElementById("camera-start").addEventListener("click", startCamera);
document.getElementById("quality-reference").addEventListener("click", () => captureQualityReference());
document.getElementById("quality-analyze").addEventListener("click", () => analyzeQualityFrame());
document.getElementById("camera-stop").addEventListener("click", stopCamera);
document.getElementById("camera-snapshot").addEventListener("click", saveCameraFrame);
document.querySelectorAll(".quality-mode").forEach(button => {
  button.addEventListener("click", () => setQualityMode(button.dataset.medium));
});
document.getElementById("camera-device").addEventListener("change", () => {
  if (cameraStream) startCamera();
});
refreshCameraDevices();
window.addEventListener("beforeunload", () => {
  stopCamera();
});

setQualityMode(qualityState.medium);
loadReviewRecords();
buildInstruments();
buildCharts();
setupHardwareLab();
setupPilotTwin();
setupModuleWorkspace();
loadReplay();
