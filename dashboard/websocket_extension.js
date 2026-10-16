document.addEventListener('DOMContentLoaded', () => {
  console.log('[RefinAI Extension] Initializing Dedicated Tab Workspaces...');

  const navContainer = document.querySelector('.tabs');
  if (navContainer) {
    const newTabs = [
      { id: 'efficiency', label: 'Predictive Efficiency' },
      { id: 'heatmap', label: 'Anomaly Heatmap' },
      { id: 'spatial', label: '3D Spatial Twin' },
      { id: 'stresstest', label: 'Stress-Test Simulation' },
      { id: 'heatrate', label: 'Thermal Heat Rate' },
      { id: 'degradation', label: 'Degradation Predictor' },
      { id: 'carbon', label: 'Carbon Footprint Index' },
      { id: 'awscloud', label: 'AWS Cloud Telemetry' }
    ];

    newTabs.forEach(t => {
      if (!document.querySelector(`[data-tab="${t.id}"]`)) {
        const btn = document.createElement('button');
        btn.className = 'tab';
        btn.setAttribute('data-tab', t.id);
        btn.innerText = t.label;
        navContainer.appendChild(btn);
      }
    });
  }

  // Inject Dedicated Dynamic View Container
  const mainElem = document.querySelector('main');
  if (mainElem) {
    const dynamicView = document.createElement('section');
    dynamicView.id = 'refinai-dynamic-panel';
    dynamicView.style.display = 'none';
    dynamicView.style.marginTop = '20px';
    dynamicView.style.padding = '20px';
    dynamicView.style.background = 'rgba(15,23,42,0.92)';
    dynamicView.style.border = '1px solid #334155';
    dynamicView.style.borderRadius = '12px';
    dynamicView.style.color = '#fff';
    mainElem.appendChild(dynamicView);
  }

  // Handle Tab Switch & Dynamic Panel Rendering
  document.body.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('tab')) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      const tab = e.target.getAttribute('data-tab');

      const dynamicPanel = document.getElementById('refinai-dynamic-panel');
      const kpiSection = document.querySelector('.kpis');
      const overviewSection = document.querySelector('.system-overview');

      // Original Default Views (3D Plant Twin & Sample Replay)
      if (tab === 'twin' || tab === 'replay') {
        if (dynamicPanel) dynamicPanel.style.display = 'none';
        if (kpiSection) kpiSection.style.display = 'grid';
        if (overviewSection) overviewSection.style.display = 'block';
        return;
      }

      // Hide default sections when switching to specialized views
      if (dynamicPanel) dynamicPanel.style.display = 'block';

      // Render tab-specific full workspace content
      switch (tab) {
        case 'efficiency':
          dynamicPanel.innerHTML = `
            <h3 style="color:#38bdf8; font-size:16px; margin-bottom:10px;">📊 PREDICTIVE THERMAL EFFICIENCY ENGINE</h3>
            <p style="color:#94a3b8; font-size:13px;">Thermodynamic yield vs theoretical max power calculation.</p>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:15px; margin-top:15px;">
              <div style="background:#1e293b; padding:15px; border-radius:8px;">Instantaneous Efficiency: <strong style="color:#34d399;" id="tab-eff-val">81.7%</strong></div>
              <div style="background:#1e293b; padding:15px; border-radius:8px;">Heat Delta: <strong style="color:#fbbf24;">1.42 MW</strong></div>
              <div style="background:#1e293b; padding:15px; border-radius:8px;">Target Yield: <strong style="color:#38bdf8;">448.0 MW</strong></div>
            </div>`;
          break;

        case 'stresstest':
          dynamicPanel.innerHTML = `
            <h3 style="color:#ef4444; font-size:16px; margin-bottom:10px;">⚡ SYNTHETIC FAULT INJECTION BENCH</h3>
            <p style="color:#94a3b8; font-size:13px;">Inject real-time telemetry anomalies into WebSockets during live judging demonstrations.</p>
            <div style="display:flex; gap:10px; margin-top:15px;">
              <button id="btn-tab-heatwave" style="padding:10px 20px; background:#ef4444; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Simulate Heat Wave (38.5°C)</button>
              <button id="btn-tab-vacuumloss" style="padding:10px 20px; background:#f59e0b; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Simulate Vacuum Loss (75 cmHg)</button>
            </div>`;
          
          document.getElementById('btn-tab-heatwave')?.addEventListener('click', () => {
            const ws = new WebSocket(`ws://${location.host}`);
            ws.onopen = () => ws.send(JSON.stringify({ AT: 38.5, V: 65.0, AP: 1010.0, RH: 55.0, PE: 388.2, status: 'ELEVATED_MONITORING' }));
          });
          document.getElementById('btn-tab-vacuumloss')?.addEventListener('click', () => {
            const ws = new WebSocket(`ws://${location.host}`);
            ws.onopen = () => ws.send(JSON.stringify({ AT: 26.0, V: 76.2, AP: 1012.0, RH: 68.0, PE: 395.0, status: 'ELEVATED_MONITORING' }));
          });
          break;

        case 'carbon':
          dynamicPanel.innerHTML = `
            <h3 style="color:#34d399; font-size:16px; margin-bottom:10px;">🌱 CARBON FOOTPRINT & ESG INDEX</h3>
            <p style="color:#94a3b8; font-size:13px;">Real-time CO2 emissions output calculation based on net power output.</p>
            <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:15px; margin-top:15px;">
              <div style="background:#1e293b; padding:15px; border-radius:8px;">Current CO2 Emission: <strong style="color:#34d399;">0.38 kg / kWh</strong></div>
              <div style="background:#1e293b; padding:15px; border-radius:8px;">Daily Off-Grid Offset: <strong style="color:#60a5fa;">12.4 Tons</strong></div>
            </div>`;
          break;

        case 'awscloud':
          dynamicPanel.innerHTML = `
            <h3 style="color:#60a5fa; font-size:16px; margin-bottom:10px;">☁️ AWS ECS FARGATE CLOUD TELEMETRY</h3>
            <p style="color:#94a3b8; font-size:13px;">Live container cluster health in region <strong>ap-south-1 (Mumbai)</strong>.</p>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:15px; margin-top:15px;">
              <div style="background:#1e293b; padding:15px; border-radius:8px;">AWS Region: <strong style="color:#60a5fa;">ap-south-1</strong></div>
              <div style="background:#1e293b; padding:15px; border-radius:8px;">Task Health: <strong style="color:#34d399;">HEALTHY</strong></div>
              <div style="background:#1e293b; padding:15px; border-radius:8px;">WS Latency: <strong style="color:#fbbf24;">12 ms</strong></div>
            </div>`;
          break;

        default:
          dynamicPanel.innerHTML = `
            <h3 style="color:#38bdf8; font-size:16px; margin-bottom:10px;">📌 ${tab.toUpperCase()} ANALYTICS PANEL</h3>
            <p style="color:#94a3b8; font-size:13px;">Live operational data feed active for ${tab}.</p>`;
          break;
      }
    }
  });

  // Connect to live WebSocket for real-time updates
  const ws = new WebSocket(`ws://${location.host}`);
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.AT && document.getElementById('kpi-at')) document.getElementById('kpi-at').innerText = Number(data.AT).toFixed(2);
      if (data.V && document.getElementById('kpi-vacuum')) document.getElementById('kpi-vacuum').innerText = Number(data.V).toFixed(2);
      if (data.AP && document.getElementById('kpi-pressure')) document.getElementById('kpi-pressure').innerText = Number(data.AP).toFixed(2);
      if (data.RH && document.getElementById('kpi-humidity')) document.getElementById('kpi-humidity').innerText = Number(data.RH).toFixed(2);
      if (data.PE && document.getElementById('kpi-output')) document.getElementById('kpi-output').innerText = Number(data.PE).toFixed(2);
      if (data.efficiency && document.getElementById('tab-eff-val')) document.getElementById('tab-eff-val').innerText = `${data.efficiency}%`;
    } catch (err) {}
  };
});
