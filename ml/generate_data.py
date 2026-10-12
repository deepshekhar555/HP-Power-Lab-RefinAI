"""
Generate a synthetic refinery sensor dataset for RefinAI.

Simulates a Crude Distillation Unit (CDU) over time with columns:
  timestamp, temperature_c, pressure_bar, flow_m3h, vibration_mms,
  fuel_rate_kgh, energy_kwh, fouling_index, failure_label

Normal operation sits inside stable bands. Periodically an anomaly window is
injected (rising fouling -> higher energy, higher vibration, eventual failure).

Output: ml/data/refinery_sensors.csv
"""
import os
import numpy as np
import pandas as pd

RNG = np.random.default_rng(42)
N = 5000  # 5-minute readings over ~17 days

here = os.path.dirname(os.path.abspath(__file__))
out_dir = os.path.join(here, "data")
os.makedirs(out_dir, exist_ok=True)


def make_dataset(n=N):
    t = np.arange(n)
    ts = pd.date_range("2026-01-01", periods=n, freq="5min")

    # Baseline process signals (normal operation)
    temperature = 350 + 5 * np.sin(t / 120) + RNG.normal(0, 1.2, n)
    pressure = 2.1 + 0.08 * np.sin(t / 90) + RNG.normal(0, 0.03, n)
    flow = 120 + 4 * np.sin(t / 150) + RNG.normal(0, 1.5, n)
    vibration = 2.0 + RNG.normal(0, 0.15, n)
    fuel_rate = 900 + 20 * np.sin(t / 200) + RNG.normal(0, 8, n)

    fouling = np.zeros(n)
    failure = np.zeros(n, dtype=int)

    # Inject 3 anomaly/fouling windows
    for start in [900, 2400, 3900]:
        length = 220
        idx = slice(start, start + length)
        ramp = np.linspace(0, 1, length)
        fouling[idx] = ramp
        vibration[idx] += 3.5 * ramp + RNG.normal(0, 0.2, length)
        fuel_rate[idx] += 220 * ramp + RNG.normal(0, 6, length)
        temperature[idx] += 18 * ramp
        failure[start + length - 40:start + length] = 1  # imminent failure tail

    # Energy correlates with fuel rate + fouling penalty
    energy = 0.85 * fuel_rate + 120 * fouling + RNG.normal(0, 15, n)

    df = pd.DataFrame({
        "timestamp": ts,
        "temperature_c": np.round(temperature, 2),
        "pressure_bar": np.round(pressure, 3),
        "flow_m3h": np.round(flow, 2),
        "vibration_mms": np.round(np.clip(vibration, 0.5, None), 3),
        "fuel_rate_kgh": np.round(fuel_rate, 2),
        "energy_kwh": np.round(energy, 2),
        "fouling_index": np.round(fouling, 3),
        "failure_label": failure,
    })
    return df


if __name__ == "__main__":
    df = make_dataset()
    path = os.path.join(out_dir, "refinery_sensors.csv")
    df.to_csv(path, index=False)
    print(f"Wrote {len(df)} rows -> {path}")
    print(df.head())
    print("Anomaly (fouling>0.3) rows:", int((df.fouling_index > 0.3).sum()))
    print("Failure rows:", int(df.failure_label.sum()))
