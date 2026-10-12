// Historical measured observations from UCI's Combined Cycle Power Plant dataset.
// The data has no timestamps and is shuffled; this replay is not a live plant feed.
const REPLAY_CONFIG = {
  tick_ms: 1800,
  history_size: 48,
  data_file: "ccpp_replay.json",
  benchmark_mae_mw: 2.22,
};

const INSTRUMENTS = [
  { tag: "AT-101", name: "Ambient temperature", field: "AT", unit: "C", digits: 2, location: "Gas turbine air inlet", kind: "measured" },
  { tag: "V-201", name: "Exhaust vacuum", field: "V", unit: "cm Hg", digits: 2, location: "Steam turbine condenser", kind: "measured" },
  { tag: "AP-101", name: "Ambient pressure", field: "AP", unit: "mbar", digits: 2, location: "Weather mast", kind: "measured" },
  { tag: "RH-101", name: "Relative humidity", field: "RH", unit: "%", digits: 2, location: "Weather mast", kind: "measured" },
  { tag: "PE-401", name: "Net electrical output", field: "PE", unit: "MW", digits: 2, location: "Generator bus", kind: "measured" },
  { tag: "AI-401", name: "Model output estimate", field: "PE_pred", unit: "MW", digits: 2, location: "Benchmark model", kind: "model" },
  { tag: "DE-401", name: "Output residual", field: "residual_MW", unit: "MW", digits: 2, location: "Measured minus estimated", kind: "residual" },
];
