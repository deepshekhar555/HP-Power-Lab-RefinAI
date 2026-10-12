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

NASA C-MAPSS files --> EDA --> engine-held-out model selection --> official FD001 test labels
UCI CCPP workbook  --> EDA --> fixed held-out split --> power-output regression metrics
```

The browser application has no SCADA, historian, API, or live sensor connection. The dashboard simulation and Python benchmark models are separate; benchmark predictions do not drive the 3D refinery scene.

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
- **UCI Combined Cycle Power Plant:** 9,568 observations; ambient temperature, exhaust vacuum, ambient pressure, and humidity predict net power output. Current test MAE is 2.220 MW and R-squared is 0.968 on one fixed 20% split.
- **Isolation Forest:** fitted to training sensor readings and applied to official test endpoints. It flags outliers but has no labeled anomaly ground truth; no detection accuracy is claimed.

The C-MAPSS and CCPP experiments are adjacent-method benchmarks, not refinery-equipment models. CCPP model residuals are not measured energy waste. Results are saved to `ml/models/metrics.json`.

## Dashboard Scenario Assumptions

The demo generates synthetic temperatures, pressures, flows, vibration, and energy values every two seconds. The 13% comparison target, Rs 8.5/kWh tariff, and 0.71 kg CO2/kWh factor are illustrative inputs. Dashboard energy, cost, and emissions deltas are arithmetic scenario outputs only, not savings claims.

## Proposed Data Contract for a Pilot

`timestamp, asset_id, operating_regime, temperature, pressure, flow, vibration, fuel_or_steam_rate, energy_intensity, maintenance_event`

Field names, units, sampling rate, asset boundaries, and maintenance labels must be agreed with plant engineers before model development. Missingness, calibration changes, shutdowns, and operating regimes must be handled explicitly.
