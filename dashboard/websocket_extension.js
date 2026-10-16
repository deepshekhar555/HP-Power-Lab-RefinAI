document.addEventListener('DOMContentLoaded', () => {
  console.log('[RefinAI Extension] Initializing ROS 2 WebSocket & Tab Handler...');

  // Setup Tab Switching Logic across all 4 header buttons
  const tabs = document.querySelectorAll('.tabs .tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabName = tab.getAttribute('data-tab');
      console.log(`[RefinAI Extension] Switched view to tab: ${tabName}`);
    });
  });

  // Connect to live WebSocket relay
  const ws = new WebSocket(`ws://${location.host}`);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      // Update original KPI card values seamlessly
      if (data.AT) {
        const el = document.getElementById('kpi-at');
        if (el) el.innerText = Number(data.AT).toFixed(2);
      }
      if (data.V) {
        const el = document.getElementById('kpi-vacuum');
        if (el) el.innerText = Number(data.V).toFixed(2);
      }
      if (data.AP) {
        const el = document.getElementById('kpi-pressure');
        if (el) el.innerText = Number(data.AP).toFixed(2);
      }
      if (data.RH) {
        const el = document.getElementById('kpi-humidity');
        if (el) el.innerText = Number(data.RH).toFixed(2);
      }
      if (data.PE) {
        const el = document.getElementById('kpi-output');
        if (el) el.innerText = Number(data.PE).toFixed(2);
      }

      // Compute and display AI model estimate
      if (data.AT && data.V) {
        const est = 480.0 - (1.8 * data.AT) - (0.3 * data.V);
        const estEl = document.getElementById('kpi-estimate');
        if (estEl) estEl.innerText = est.toFixed(2);
      }

      // Update Control Room Overview cards
      const effEl = document.getElementById('status-efficiency');
      if (effEl && data.efficiency) effEl.innerText = `${data.efficiency}%`;

      const riskEl = document.getElementById('status-risk');
      if (riskEl && data.riskIndex) riskEl.innerText = `${data.riskIndex}/100`;

      const feedState = document.getElementById('replay-state');
      if (feedState) feedState.innerText = 'LIVE ROS 2 TELEMETRY STREAM';

    } catch (err) {
      console.warn('[RefinAI Extension] Raw stream passthrough:', event.data);
    }
  };
});
