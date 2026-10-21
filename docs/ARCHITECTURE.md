# RefinAI | Architecture and Evidence Boundary

## What Runs Today

```text
dashboard/data.js (generated demo readings and scenario assumptions)
                                                 |
                                                 v
dashboard/app.js ----> simulated unit cards, alerts, charts, and savings scenario
                                                 |
                                                 v
dashboard/twin3d.js --> Three.js refinery scene; colors reflect demo statuses

Browser Camera Monitor --> opt-in local getUserMedia preview and reference-based image metrics

Process Modules --> 25 public-benchmark views + scope-dependent hardware candidates
Simulated pilot twin --> transfer pump -> filter -> heat exchanger -> receiver
                     --> 2D topology + interactive Three.js skid view
                     --> simulated transmitters -> remote I/O -> read-only OPC UA path
Hardware Lab --> equipment hierarchy + synthetic health/alarm rules + tag map
             --> local mock Modbus/OPC UA reads over the skid snapshot
             --> interactive Three.js electronics assembly + conductor state

NASA C-MAPSS files --> EDA --> engine-held-out model selection --> official FD001 test labels
UCI CCPP workbook  --> EDA --> fixed held-out split --> power-output regression metrics
```

The browser application has no SCADA, historian, PLC, or live process-quality sensor connection. Its Camera Monitor can request a webcam available to the browser and compare image brightness, saturation, and contrast against a same-medium reference. This is an optical proxy only, sensitive to lighting and setup; it does not measure PM, pH, turbidity, viscosity, gas species, concentration, or safety limits. Video frames are not sent to the server. The dashboard simulation and Python benchmark models are separate; benchmark predictions do not drive the 3D refinery scene.

The Process Modules workspace contains 25 plots based on the included held-out UCI CCPP replay and NASA C-MAPSS benchmark figures, plus 20 sensor/gateway readiness modules. Readiness modules specify candidate measurement hardware and protocols but contain no live values until a real, approved data source is configured.

The workspace also contains a separate **simulated transfer-skid twin**: feed tank, transfer pump, filter, heat exchanger, and receiver. The 2D process topology and interactive Three.js view consume the same synthetic simulator state; simulated flow markers, vessel fill, pump speed, filter restriction, exchanger fouling, and gateway-quality indicator update from it. The model is not to scale. Adjustable demand, pump speed, valve opening, utility temperature, and downstream draw drive a simplified mass balance, pump pressure/head and line-loss calculations, filter pressure drop, heat-exchanger effectiveness, and tank levels. Filter restriction and exchanger fouling are injectable demo scenarios. Simulated pressure, flow, temperature, differential-pressure, vibration, motor-power, and level tags are routed through a demonstrative transmitter/remote-I/O/read-only-gateway path. Disabling the simulated gateway, field bus, or power rail freezes dashboard telemetry as stale while the internal process model and 3D process indicators continue. A trend chart is chronological only for this generated simulation.

The Hardware Lab renders 24 scope-dependent candidate hardware/infrastructure entries and adds an interactive asset hierarchy, equipment-health matrix, and traceable mapping for the ten simulated skid tags. Its alarm console evaluates explicitly illustrative flow, filter differential-pressure, vibration, inventory, exchanger-fault, and communication rules; acknowledgement is local display state, not alarm-system acknowledgement. The Modbus TCP and OPC UA controls only format reads from the current in-page synthetic snapshot with example holding-register addresses and NodeIds. No protocol client, socket, PLC, gateway, write path, or real endpoint is used. Values become stale if the simulated power, bus, or gateway is disabled.

The Hardware Lab renders an interactive **industrial-style 3D electronics assembly** in `dashboard/hardware-assembly-3d.js`: generic DIN-rail power/distribution modules, controller and interface PCBs with visible soldered components, analog/RTD/vibration interfaces, RS-485, field terminal strips, cable glands, routed conductors, ten simulated field-tag endpoints, a read-only gateway representation, and the browser dashboard. The field-strip readouts render values from the same synthetic snapshot used by the Hardware Lab; orbit/zoom controls, conductor filters, animated data markers, component selection, and status indications are interactive. The local simulator power/bus/gateway state controls readout quality color, status lights, and wire emphasis. The browser simulation remains the source of all values; no physical controller, instrument, gateway, or network connection is present. This representative visualization does not identify purchased products or specify build-ready terminal pinouts, component ratings, protection, grounding, isolation coordination, or hazardous-area approvals. It is not a wiring instruction or safe-to-build design.

The Hardware Lab also includes an interactive **four-stream treatment/conditioning yard** in `dashboard/multistream-3d.js`. It depicts air intake/blower/particle and carbon filters/stack; raw-water storage/pumping/media filtration/conditioning/product storage; gas separation/compression/scrubbing/cooling/header; and the oil transfer-skid feed/pump/coalescer/filter/exchanger/receiver. Animated markers follow each synthetic throughput; tank fills follow the oil balances and a separate illustrative water inventory balance. Air, water, and gas load sliders change their stream rates. Air-filter, water-treatment, gas-scrubber, and oil-filter bypasses change selected synthetic outlet indications and highlight a 3D bypass. The calculations are extracted into the browser-global/CommonJS-compatible `dashboard/process-model.js`, so the browser and Node regression tests use the same functions. `node --test tests/process-model.test.js` checks flow/load boundaries, tank conservation and clipping, independent water/oil inventories, bypass response directions, and finite outputs. The air-cleaning PM values use illustrative inlet-times-removal factors (PM2.5: 0.07 normal/0.78 bypass; PM10: 0.06/0.74); CO2 is intentionally unchanged by filtration. Water flow is 46 m³/h times pump-load fraction, with feed/product tank balances advanced in one-minute synthetic steps; bypass changes illustrative pH and turbidity factors. Gas flow is 24 Nm³/h times compressor-load fraction and header pressure is `4.8 + 1.65 × load fraction` bar; scrubber bypass changes only the H2S factor (0.045 normal/0.96 bypass). Oil flow and temperature reuse the existing skid model; filter restriction/bypass changes illustrative particle counts, while estimated viscosity uses `38 × exp(-0.018 × (outlet °C − 40))` cSt and oil water content remains a synthetic constant. Conductivity, dissolved oxygen, methane, and the other fixed/empirical readings are not validated process chemistry or mass balances. When the simulated telemetry path is unavailable, cards hold last-good readings while the local process animation continues. These generic trains are not a complete refinery, design basis, operating procedure, emissions model, safety function, or HPCL asset representation; air is cleaned rather than refined, and the user interface is not connected to plant instruments.

The simplified relationships and constants are exposed in the UI and `dashboard/app.js`: `Q = demand × speed × valve_opening × suction_availability × filter_factor`, with suction availability decreasing linearly below 20% feed inventory; pump head is `2 + 7 × speed²` bar; clean filter drop is `.12 + .00012 × Q²` bar, with 1.1 bar added for the restriction scenario; line loss is `.00045 × Q²` bar; and discharge pressure is suction pressure plus pump head less filter and line drops. Exchanger effectiveness is `1 - exp(-UA / (Q / 30))`, with outlet temperature computed from inlet and hot-utility temperatures. The mass balances assume a 45 m³ feed tank replenished at 65 m³/h and a 30 m³ receiver; one real second advances one simulated minute, and levels clip at 0–100%. Pump efficiency is assumed to be 72%. These deliberately simple formulas are not calibrated to a real pump curve, fluid, vessel, or heat exchanger and are not a hydraulic/thermal design model.

All values, parameters, faults, alarm thresholds, register addresses, NodeIds, and drawn board connections in this twin are illustrative and unvalidated. It has no physical sensor/device connection, no networking, no PLC write path, and no safety function. It is a learning/debugging model to make signal and process relationships understandable, not a digital twin calibrated to an HPCL asset. The Hardware Lab's 24 catalog entries span measurement devices and infrastructure candidates across different use cases; they are not all needed for this project. Instrument selection, hazardous-area certification, installation, connectivity, and safety-system boundaries must be determined by site engineers and OT/IT/security specialists.

Calibration would require approved asset-specific inputs: a current P&ID; fluid density, viscosity, and thermal properties; pump curve and motor/drive limits; pipe sizes, lengths, fittings, and elevations; filter clean/loaded pressure-drop data; exchanger area/UA and utility conditions; vessel working volumes; and measured inlet, outlet, and downstream flow histories. Until those are provided and reviewed, the simulator remains a transparent teaching model and its parameter object is not a design-data record.

## Proposed HPCL Pilot

```text
Approved historian export (read-only, one unit)
    -> data quality, time alignment, and operating-regime review
    -> unit-specific baseline and predictive models
    -> shadow-mode alerts with explanations and uncertainty
    -> operator feedback and measured pilot evaluation
```

Any plant integration must be approved by HPCL OT/IT and site engineering. The prototype has no write path to control systems. Recommendations remain human-reviewed; safety interlocks and approved operating envelopes take precedence.

## Public Benchmark Experiments

- **NASA C-MAPSS FD001:** simulated aircraft-engine run-to-failure benchmark. The training table has 20,631 rows and 100 engines. Model selection uses an 80/20 engine-disjoint split; final scores use the supplied 100-engine test set and RUL labels capped at 125 cycles. Current Gradient Boosting test MAE is 12.16 cycles, compared with 38.01 cycles for a median-label baseline.
- **UCI Combined Cycle Power Plant:** 9,568 observations; ambient temperature, exhaust vacuum, ambient pressure, and humidity predict net power output. Current test MAE is 2.262 MW and R-squared is 0.96667 on one fixed 20% split.
- **CCPP uncertainty and support:** the training portion is divided into model-fit and calibration partitions; an absolute-residual split-conformal interval is assessed on the untouched test partition. Replay also marks inputs outside model-fit 1st–99th percentile ranges. Test coverage is a benchmark diagnostic, not a refinery guarantee; percentile support is not an alarm or regime detector.
- **CCPP permutation importance:** each held-out input is independently permuted 15 times; the reported change in test MAE gives a model-specific predictive-reliance diagnostic. It is not causal, correlated inputs may share or mask importance, and independent shuffling can create implausible combinations.
- **CCPP multivariate screening:** PCA is fit only on the model-fit subset; Hotelling T-squared summarizes scores in the retained subspace and Q measures reconstruction residuals. Three components explain 97.45% of fit variance; 99th-percentile calibration references and largest feature contributions are displayed per record. Test reference-flag rates are 1.20% (T-squared) and 1.04% (Q). No fault labels exist, so flagged test records are unverified statistical outliers, not detected faults.
- **Review feedback:** accept/defer/reject and optional notes are stored in browser `localStorage` and can be exported as JSON. This demo ledger does not leave the browser or feed model training.
- **Isolation Forest:** fitted to training sensor readings and applied to official test endpoints. It flags outliers but has no labeled anomaly ground truth; no detection accuracy is claimed.

The C-MAPSS and CCPP experiments are adjacent-method benchmarks, not refinery-equipment models. CCPP model residuals are not measured energy waste. Results are saved to `ml/models/metrics.json`.

Research informing the monitoring, maintenance, and uncertainty workflow includes Qin (2012), [Survey on data-driven industrial process monitoring and diagnosis](https://doi.org/10.1016/j.arcontrol.2012.09.004); Jardine, Lin, and Banjevic (2006), [A review on machinery diagnostics and prognostics implementing condition-based maintenance](https://doi.org/10.1016/j.ymssp.2005.09.012); Jackson and Mudholkar (1979), [Control procedures for residuals associated with principal component analysis](https://doi.org/10.1080/00401706.1979.10489779); and Angelopoulos and Bates, [A Gentle Introduction to Conformal Prediction and Distribution-Free Uncertainty Quantification](https://arxiv.org/abs/2107.07511). These references motivate the methods, not refinery performance claims.

## Dashboard Scenario Assumptions

The demo generates synthetic temperatures, pressures, flows, vibration, and energy values every two seconds. The 13% comparison target, Rs 8.5/kWh tariff, and 0.71 kg CO2/kWh factor are illustrative inputs. Dashboard energy, cost, and emissions deltas are arithmetic scenario outputs only, not savings claims.

## Proposed Data Contract for a Pilot

`timestamp, asset_id, operating_regime, temperature, pressure, flow, vibration, fuel_or_steam_rate, energy_intensity, maintenance_event`

Field names, units, sampling rate, asset boundaries, and maintenance labels must be agreed with plant engineers before model development. Missingness, calibration changes, shutdowns, and operating regimes must be handled explicitly.
