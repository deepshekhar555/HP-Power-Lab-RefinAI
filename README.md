# HP-Power-Lab-RefinAI

RefinAI is a student prototype for reviewing unusual power-output deviations and planning a data-gated industrial pilot. It combines a measured-data UCI power-plant replay, a held-out output model, and an illustrative plant interface. It is not an HPCL deployment.

**Important boundary:** process telemetry is historical UCI replay or generated demonstration data, not a live plant feed. The opt-in Camera Monitor reports local image brightness, saturation, and contrast changes against a same-setup reference for Air/Water/Oil modes; these are optical proxies, not quality measurements. Gas composition and invisible contaminants require dedicated instruments. No PLC/SCADA integration or plant-quality sensor is connected. NASA C-MAPSS contains simulated aircraft-engine degradation data; UCI CCPP contains combined-cycle power-plant measurements. Neither dataset is HPCL refinery data. Savings figures and operator prompts are illustrative assumptions, not verified outcomes or control recommendations.

## Run on Windows

From the project folder, install dependencies and reproduce the processed data, metrics, and charts:

```powershell
python -m pip install -r ml/requirements.txt
python ml/eda_real_data.py
python ml/train_real_models.py
```

Run the JavaScript process-model regression tests with Node.js:

```powershell
node --test tests/process-model.test.js
```

Serve the dashboard from the project folder so the Three.js module and benchmark images load correctly:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000/dashboard/` in Chrome or Edge. Three.js and Chart.js load from public CDNs, so the browser needs internet access. The Camera Monitor requires camera permission from the browser; process telemetry remains historical replay/demo data and is not a plant connection.

To jump directly to a specific historical physical sample, append a sample index to the query string, for example:

```text
http://localhost:8000/dashboard/?physical-replay=3
```

This opens the digital twin at a specific UCI measured record so the plant scene and instrument values reflect a chosen physical sample instead of starting at the first row.

## Flagship Demo Flow

1. Select a held-out UCI Combined Cycle Power Plant record and inspect its measured environmental inputs and net output.
2. Compare measured output with the Gradient Boosting estimate.
3. Compare that record's residual with the held-out set MAE (2.262 MW) as context only; MAE is not a fault threshold or measured waste.
4. Demonstrate the proposed pilot gate: use approved, time-aligned HPCL historian data in read-only shadow mode, then evaluate with plant engineers before making operational claims.

This is a benchmark-backed method demonstration. It does not establish a refinery fault, HPCL savings, or the official challenge fit. Confirm the official track and problem statement against the event materials before submission.

For the interactive equipment model, open **Process Modules → Transfer pump, filter & heat-exchanger skid**. Adjust the operating sliders, toggle filter restriction or exchanger fouling, observe flow/pressure/temperature and tank balance respond, and switch the simulated gateway offline to see telemetry go stale. The 3D skid view follows the same synthetic model; drag to rotate and scroll to zoom. Open **Model equations and assumed design basis** to inspect its illustrative constants. All readings and faults in this lab are synthetic, and the 3D equipment is not to scale.

Open **Hardware Lab** for the interactive Three.js electronics assembly: a generic controller PCB with visible soldered joints, DIN-rail-style power and interface modules, field terminals, cable glands, routed conductors, an RS-485 interface, and ten simulated field tags. The field-strip readouts display the same synthetic tag values used by the dashboard. Orbit and zoom the view, filter conductors by power/signal/data, pause the animated data markers, reset the camera, or select components to inspect their purpose and associated asset. Readouts, status lights, and wire emphasis follow the synthetic skid and Hardware Lab's power/bus/gateway toggles. The model is a generic visual representation—not a specific product, verified wiring/construction plan, or live hardware connection—and must not be used to build or connect plant circuits.

The Hardware Lab now also has a four-stream 3D process yard for **air cleaning, water treatment, gas conditioning, and oil conditioning**. Follow the equipment trains and animated flow markers, adjust the air blower, water feed-pump, or gas compressor load, and inject per-stream bypass scenarios to see the corresponding synthetic outlet readings change. The oil train reuses the transfer-skid flow, temperature, and tank-balance model. Instrument cards retain the last good values and indicate stale telemetry when the simulated power, bus, or gateway path is unavailable. The model equations and limits are expandable in the UI; tank balances and stream calculations are covered by `node --test tests/process-model.test.js`. These are separate teaching examples—not a complete crude refinery, an HPCL process design, or validated mass/quality balances. Air is cleaned, not refined; none of the displays read physical sensors.

The same **Hardware Lab** also provides the scope-dependent hardware catalog, equipment hierarchy, health matrix, threshold-based demo alarm console with acknowledgement and event history, and tag-to-dashboard traceability. The protocol panel can poll the current synthetic skid snapshot using mock Modbus-register or OPC UA NodeId examples. Polls are local reads only; they do not open a connection, access a PLC, or write values. Demo alarm limits and protocol addresses are illustrative, not engineering settings.

## Included

- `dashboard/`: responsive dashboard, stylized combined-cycle plant scene, interactive 3D simulated transfer skid, historical/demo telemetry, benchmark views, and opt-in local webcam monitor.
- Process Modules: 25 visual analyses of included UCI/NASA benchmark data plus 20 scope-dependent hardware-candidate views (not a universal bill of materials). The Hardware Lab also displays the interactive electronics assembly, the four-stream 3D treatment/conditioning yard, 24 candidate hardware/infrastructure entries, and a simulated read-only signal path. The air, water, and gas trains have synthetic throughput and bypass scenarios; the oil train shares the transfer-pump/filter/heat-exchanger model and tank balance. Process equations, instrument tags, telemetry-path staleness, alarm/health views, mock protocol reads, and synthetic trends are illustrative. No physical hardware is connected.
- `ml/eda_real_data.py`: analyzes NASA C-MAPSS FD001 and UCI CCPP files, then saves plots and processed CSVs.
- `ml/train_real_models.py`: selects a C-MAPSS RUL model using engine-held-out validation, evaluates it on NASA's official FD001 test labels, and evaluates CCPP power-output regression and held-out permutation importance.
- `ml/models/metrics.json`: latest benchmark metrics.
- `docs/PRIZE_READY_PITCH.md`: concise, judge-friendly pitch narrative for a high-value industrial AI prototype.
- `docs/ROUND2_PROBLEM_ID.md`: two-slide problem-identification draft.
- `docs/ROUND3_DETAILED.md`: seven content-slide outline, sources, and optional pitch script.
- `docs/ARCHITECTURE.md`: implemented prototype boundary and proposed HPCL pilot architecture.
- `docs/RESEARCH_TO_FEATURE_MAP.md`: selected paper objectives mapped to implemented benchmark methods and data-dependent exclusions.
- `docs/INNOVATION_CATALOG.md`: exploratory idea catalogue; it does not replace choosing the official challenge track.

`ml/generate_data.py` and `ml/train_models.py` are the original synthetic-data experiment. They are separate from the reproducible public-benchmark pipeline above; their synthetic scores are not used in `metrics.json` or the dashboard's benchmark table.

## Current Benchmark Results

- NASA C-MAPSS FD001: Gradient Boosting MAE 12.16 cycles on 100 official test engines; RUL labels capped at 125 cycles. Median-training-label baseline MAE: 38.01 cycles.
- UCI CCPP: Gradient Boosting MAE 2.262 MW and R-squared 0.96667 on a fixed 20% held-out split (1,914 rows), with a 90% split-conformal interval calibrated on 1,531 reserved records (empirical test coverage 91.27%).
- UCI CCPP PCA monitoring: three retained components explain 97.45% of fit-data variance; test reference-flag rates are 1.20% for Hotelling T-squared and 1.04% for Q residuals. These are unlabeled statistical outlier rates, not detection accuracy.
- UCI CCPP held-out permutation importance: independently shuffles each input 15 times and reports the corresponding test-MAE increase. This is predictive reliance, not causal effect; correlated inputs and unrealistic shuffled combinations limit interpretation.
- Isolation Forest: flagged 6 of 100 NASA test-engine endpoints. The dataset has no anomaly labels, so this is not an accuracy or recall score.

These results demonstrate methods on adjacent public benchmarks only. They do not establish refinery RUL accuracy, energy savings, emissions reductions, or HPCL operational impact. A refinery pilot requires approved historical, unit-specific data and review by plant engineers.

## Research Grounding and Limits

The proposed industrial pilot follows established themes in public-benchmark validation, process monitoring, and human-in-the-loop decision support rather than claiming live plant control. In the current prototype, split-conformal intervals, input-support checks, and browser-local review feedback are implemented; regime-aware plant baselines remain a future pilot requirement, not a feature of the shuffled CCPP replay. The implementation keeps the domain boundary explicit:

- NASA C-MAPSS is a public aircraft-engine degradation benchmark used for benchmark methodology, not refinery maintenance evidence.
- UCI Combined Cycle Power Plant is a public power-plant dataset used to demonstrate output estimation and residual review, not live refinery optimization.
- Any real pilot must use approved, time-aligned historian data, operating-regime labels, maintenance context, and engineering signoff before making a decision or savings claim.
- The CCPP replay now includes a split-conformal prediction interval, a model-input support check against fit-data percentiles, and browser-local sample-review feedback. These are benchmark demonstrations only; the review log does not retrain the model or constitute an operator approval record.
- The CCPP replay also includes PCA Hotelling T-squared and Q-residual reference screens with leading statistical input contributions. Unlabeled, shuffled records cannot validate fault-detection accuracy or temporal persistence.

Research references informing these choices:

- S. J. Qin, “Survey on data-driven industrial process monitoring and diagnosis,” *Annual Reviews in Control*, 36(2), 220–234 (2012). [DOI: 10.1016/j.arcontrol.2012.09.004](https://doi.org/10.1016/j.arcontrol.2012.09.004).
- A. K. S. Jardine, D. Lin, and D. Banjevic, “A review on machinery diagnostics and prognostics implementing condition-based maintenance,” *Mechanical Systems and Signal Processing*, 20(7), 1483–1510 (2006). [DOI: 10.1016/j.ymssp.2005.09.012](https://doi.org/10.1016/j.ymssp.2005.09.012).
- J. E. Jackson and G. S. Mudholkar, “Control procedures for residuals associated with principal component analysis,” *Technometrics*, 21(3), 341–349 (1979). [DOI: 10.1080/00401706.1979.10489779](https://doi.org/10.1080/00401706.1979.10489779).
- A. N. Angelopoulos and S. Bates, “A Gentle Introduction to Conformal Prediction and Distribution-Free Uncertainty Quantification,” [arXiv:2107.07511](https://arxiv.org/abs/2107.07511).

This is a transparent benchmark demo rather than a deployed HPCL monitoring system.

## Competition Drafts

The Unstop page specifies two Round 2 slides and seven Round 3 content slides, excluding title and references/source slides. Confirm the exact business-track name and track video before submission; the public event page does not provide that detailed brief.
