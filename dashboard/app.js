// RefinAI — historical physical-sample replay and instrument dashboard.

const replayState = { samples: [], position: 0, history: [], playing: true, charts: {} };

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".tabpanel").forEach(panel => panel.classList.remove("active"));
    button.classList.add("active");
    document.getElementById(`panel-${button.dataset.tab}`).classList.add("active");
    requestAnimationFrame(() => Object.values(replayState.charts).forEach(chart => chart.resize()));
  });
});

function formatNumber(value, digits = 2) {
  return Number(value).toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
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

function computeDecisionState(sample) {
  const residual = Math.abs(sample.residual_MW || 0);
  const temperatureStress = sample.AT > 30 ? 18 : sample.AT > 25 ? 9 : 0;
  const vacuumStress = sample.V > 70 ? 14 : sample.V > 60 ? 8 : 0;
  const humidityStress = sample.RH > 75 ? 12 : sample.RH > 65 ? 6 : 0;
  const riskIndex = Math.min(100, 22 + residual * 11 + temperatureStress + vacuumStress + humidityStress);
  const efficiency = Math.max(78, Math.min(98, 100 - residual * 5.5));
  const outputShift = Math.max(-18, Math.min(18, (sample.AT - 24) * 0.7 + (sample.V - 62) * 0.12));
  const forecastOutput = Math.max(380, sample.PE + outputShift);
  const energyImpact = Math.max(0.3, Math.abs(sample.residual_MW) * 18.5);
  const annualValue = Math.max(11000, Math.round(energyImpact * 900));

  const assets = [
    { name: "Gas turbine", score: Math.max(70, 100 - residual * 6 - (sample.AT > 26 ? 8 : 0)), band: residual > 3 ? "warn" : "ok" },
    { name: "HRSG", score: Math.max(73, 100 - residual * 4.5 - (sample.V > 65 ? 10 : 0)), band: residual > 2.5 ? "warn" : "ok" },
    { name: "Steam turbine", score: Math.max(71, 100 - residual * 5.5 - (sample.AP < 1000 ? 9 : 0)), band: residual > 3 ? "warn" : "ok" },
    { name: "Cooling tower", score: Math.max(72, 100 - (sample.RH > 70 ? 15 : 0) - (sample.V > 65 ? 8 : 0)), band: sample.RH > 70 ? "warn" : "ok" },
    { name: "Generator", score: Math.max(76, 100 - residual * 5.2), band: residual > 2.8 ? "warn" : "ok" },
  ];

  const actions = [
    riskIndex > 55 ? { text: "Increase condenser cleaning cycle to reduce vacuum drift.", level: "warn" } : { text: "Condenser performance is stable; continue routine inspection.", level: "ok" },
    sample.RH > 70 ? { text: "Review moisture loading on intake and cooling water balance.", level: "warn" } : { text: "Humidity remains within normal operating envelope.", level: "ok" },
    residual > 3 ? { text: "Trigger predictive maintenance review for turbine output deviation.", level: "crit" } : { text: "Process efficiency remains within benchmark tolerance.", level: "ok" },
  ];

  return { riskIndex, efficiency, forecastOutput, energyImpact, annualValue, assets, actions };
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
      { level: decision.riskIndex > 55 ? "warn" : "ok", text: `Residual deviation ${formatNumber(Math.abs(sample.residual_MW), 2)} MW against benchmark` },
      { level: decision.energyImpact > 14 ? "warn" : "ok", text: `Projected energy impact ${formatNumber(decision.energyImpact, 1)} MWh` },
      { level: decision.actions.some(action => action.level === "crit") ? "crit" : "ok", text: decision.actions.find(action => action.level === "crit")?.text || "All monitored systems within expected operating envelope" },
    ];
    eventStream.innerHTML = eventEntries.map(item => `
      <li class="event-item ${item.level === "crit" ? "crit" : item.level === "warn" ? "warn" : "ok"}">
        <span class="event-dot"></span>
        <span>${item.text}</span>
      </li>
    `).join("");
  }

  const availability = Math.max(88, Math.min(99.8, 100 - decision.riskIndex * 0.09));
  const efficiency = Math.max(78, Math.min(99, decision.efficiency));
  const stability = Math.max(75, 100 - Math.abs(sample.residual_MW) * 9.5);

  const availabilityEl = document.getElementById("status-availability");
  const availabilityNote = document.getElementById("status-availability-note");
  const efficiencyEl = document.getElementById("status-efficiency");
  const efficiencyNote = document.getElementById("status-efficiency-note");
  const riskEl = document.getElementById("status-risk");
  const riskNote = document.getElementById("status-risk-note");
  const stabilityEl = document.getElementById("status-stability");
  const stabilityNote = document.getElementById("status-stability-note");

  if (availabilityEl) {
    availabilityEl.textContent = `${formatNumber(availability, 1)}%`;
    availabilityNote.textContent = availability > 96 ? "High-ready" : "Watch window";
  }
  if (efficiencyEl) {
    efficiencyEl.textContent = `${formatNumber(efficiency, 1)}%`;
    efficiencyNote.textContent = `${formatNumber(sample.PE, 1)} MW output`;
  }
  if (riskEl) {
    riskEl.textContent = `${Math.round(decision.riskIndex)}/100`;
    riskNote.textContent = decision.riskIndex > 55 ? "Elevated monitoring" : "Stable health";
  }
  if (stabilityEl) {
    stabilityEl.textContent = `${formatNumber(stability, 1)}%`;
    stabilityNote.textContent = `${formatNumber(Math.abs(sample.residual_MW), 2)} MW residual`;
  }

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
  const roiEnergy = document.getElementById("roi-energy");
  const roiMaint = document.getElementById("roi-maint");
  const roiUplift = document.getElementById("roi-uplift");
  const roiTotal = document.getElementById("roi-total");

  const scenarioOutput = () => {
    const tempDelta = Number(tempSlider.value);
    const vacuumDelta = Number(vacuumSlider.value);
    const maintPriority = Number(maintSlider.value) / 100;
    const output = sample.PE + tempDelta * -0.42 + vacuumDelta * 0.19 + maintPriority * 4.5;
    const risk = Math.min(100, Math.max(20, decision.riskIndex + tempDelta * 1.4 - vacuumDelta * 0.6 + maintPriority * 20));
    const energy = Math.max(0.5, Math.abs(sample.residual_MW) * 16 + Math.abs(tempDelta) * 0.9 + Math.abs(vacuumDelta) * 1.2);
    return { output, risk, energy };
  };

  const updateDisplays = () => {
    const values = scenarioOutput();
    tempValue.textContent = `${Number(tempSlider.value) >= 0 ? "+" : ""}${tempSlider.value}°C`;
    vacuumValue.textContent = `${Number(vacuumSlider.value) >= 0 ? "+" : ""}${vacuumSlider.value} cm Hg`;
    maintValue.textContent = `${maintSlider.value} / 100`;
    outputEl.textContent = `${formatNumber(values.output, 2)} MW`;
    scenarioRiskEl.textContent = `${Math.round(values.risk)}/100`;
    energyEl.textContent = `${formatNumber(values.energy, 2)} MWh`;
    roiEnergy.textContent = `${formatNumber(decision.energyImpact * 1.15, 1)} MWh`;
    roiMaint.textContent = `$${Math.round(decision.annualValue * 0.18).toLocaleString("en-IN")}`;
    roiUplift.textContent = `${formatNumber(Math.abs(sample.PE - values.output) * 0.7, 1)} MW`;
    roiTotal.textContent = `$${Math.round(decision.annualValue * 0.86).toLocaleString("en-IN")}`;
  };

  [tempSlider, vacuumSlider, maintSlider].forEach(input => input.oninput = updateDisplays);
  updateDisplays();
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

buildInstruments();
buildCharts();
loadReplay();
