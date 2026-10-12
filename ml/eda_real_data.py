"""
RefinAI — Exploratory Data Analysis on REAL datasets.

1. NASA C-MAPSS (engine degradation / predictive maintenance)
   - train_FD001.txt: 100 engines, 26 columns (id, cycle, 3 settings, 21 sensors)
   - RUL_FD001.txt: true remaining useful life for test engines

2. UCI Combined Cycle Power Plant (energy efficiency)
   - 9568 data points, 4 features -> 1 target (net energy output)

Outputs: ml/analytics/ with summary stats, correlation, charts as PNG, a report .txt
"""
import os, sys
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "data", "raw")
OUT = os.path.join(HERE, "analytics")
os.makedirs(OUT, exist_ok=True)

# ─── Matplotlib setup (non-interactive) ───
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
plt.rcParams.update({"figure.figsize": (12, 5), "figure.dpi": 130,
                      "axes.grid": True, "grid.alpha": 0.3})

report = []
def log(s):
    print(s)
    report.append(s)


# ════════════════════════════════════════════════════════════
# PART 1 — NASA C-MAPSS (Predictive Maintenance)
# ════════════════════════════════════════════════════════════
CMAPSS_COLS = (
    ["engine_id", "cycle"] +
    [f"setting_{i}" for i in range(1, 4)] +
    [f"sensor_{i}" for i in range(1, 22)]
)

def load_cmapss():
    path = os.path.join(RAW, "train_FD001.txt")
    if not os.path.exists(path):
        sys.exit("train_FD001.txt not found in data/raw/")
    df = pd.read_csv(path, sep=r"\s+", header=None, names=CMAPSS_COLS)
    # Compute RUL (remaining useful life) for each engine
    max_cycles = df.groupby("engine_id")["cycle"].max().rename("max_cycle")
    df = df.merge(max_cycles, on="engine_id")
    df["RUL"] = df["max_cycle"] - df["cycle"]
    df.drop(columns=["max_cycle"], inplace=True)
    return df

def eda_cmapss(df):
    log("\n== NASA C-MAPSS FD001 -- Predictive Maintenance ==")
    log(f"Rows: {len(df):,}   Engines: {df.engine_id.nunique()}")
    log(f"Cycles per engine: min={df.groupby('engine_id')['cycle'].max().min()}, "
        f"max={df.groupby('engine_id')['cycle'].max().max()}, "
        f"mean={df.groupby('engine_id')['cycle'].max().mean():.0f}")
    log(f"\nColumn stats:\n{df.describe().round(2).to_string()}")

    # Sensor correlations with RUL
    sensors = [c for c in df.columns if c.startswith("sensor_")]
    corrs = df[sensors + ["RUL"]].corr()["RUL"].drop("RUL").sort_values()
    log(f"\nTop sensor correlations with RUL:\n{corrs.head(5).to_string()}")
    log(f"\n{corrs.tail(5).to_string()}")

    # Chart 1: degradation curves (5 engines)
    fig, axes = plt.subplots(1, 3, figsize=(16, 5))
    for eid in range(1, 6):
        sub = df[df.engine_id == eid]
        axes[0].plot(sub.cycle, sub.sensor_2, alpha=0.7, label=f"Eng {eid}")
        axes[1].plot(sub.cycle, sub.sensor_11, alpha=0.7)
        axes[2].plot(sub.cycle, sub.sensor_15, alpha=0.7)
    for ax, s in zip(axes, ["sensor_2 (LPC outlet temp)",
                             "sensor_11 (Physical fan speed)",
                             "sensor_15 (Bypass ratio)"]):
        ax.set_xlabel("Cycle"); ax.set_ylabel(s); ax.set_title(s)
    axes[0].legend(fontsize=8)
    fig.suptitle("NASA C-MAPSS: Sensor Degradation Curves (5 engines)", fontsize=13)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "cmapss_degradation.png"))
    plt.close(fig)
    log("  -> saved cmapss_degradation.png")

    # Chart 2: RUL distribution
    rul_at_start = df.groupby("engine_id")["RUL"].max()
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.hist(rul_at_start, bins=25, color="#2f7cf6", edgecolor="white")
    ax.set_xlabel("Total Cycles (RUL at start)"); ax.set_ylabel("Count")
    ax.set_title("Distribution of Engine Lifetimes (FD001)")
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "cmapss_rul_dist.png"))
    plt.close(fig)
    log("  -> saved cmapss_rul_dist.png")

    # Chart 3: sensor correlation heatmap
    fig, ax = plt.subplots(figsize=(12, 8))
    cax = ax.imshow(df[sensors].corr().values, cmap="RdBu_r", vmin=-1, vmax=1)
    ax.set_xticks(range(len(sensors))); ax.set_xticklabels(sensors, rotation=90, fontsize=7)
    ax.set_yticks(range(len(sensors))); ax.set_yticklabels(sensors, fontsize=7)
    fig.colorbar(cax, ax=ax, shrink=0.7)
    ax.set_title("Sensor Correlation Matrix (C-MAPSS FD001)")
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "cmapss_corr_heatmap.png"))
    plt.close(fig)
    log("  -> saved cmapss_corr_heatmap.png")

    return df


# ════════════════════════════════════════════════════════════
# PART 2 — UCI Combined Cycle Power Plant (Energy Efficiency)
# ════════════════════════════════════════════════════════════
def load_ccpp():
    path = os.path.join(RAW, "CCPP", "Folds5x2_pp.xlsx")
    if not os.path.exists(path):
        sys.exit("Folds5x2_pp.xlsx not found")
    df = pd.read_excel(path, sheet_name="Sheet1")
    df.columns = ["AT", "V", "AP", "RH", "PE"]
    return df

def eda_ccpp(df):
    log("\n== UCI Combined-Cycle Power Plant -- Energy Efficiency ==")
    log(f"Rows: {len(df):,}   Columns: {list(df.columns)}")
    log("AT = Ambient Temp, V = Exhaust Vacuum, AP = Ambient Pressure, "
        "RH = Relative Humidity, PE = Net Energy Output (MW)")
    log(f"\n{df.describe().round(2).to_string()}")

    corrs = df.corr()["PE"].drop("PE").sort_values()
    log(f"\nCorrelations with PE (energy output):\n{corrs.to_string()}")

    # Chart 4: pairwise scatter vs PE
    fig, axes = plt.subplots(1, 4, figsize=(18, 4))
    for ax, col, color in zip(axes, ["AT", "V", "AP", "RH"],
                               ["#ef4444", "#f59e0b", "#22c55e", "#2f7cf6"]):
        ax.scatter(df[col], df["PE"], s=2, alpha=0.3, color=color)
        ax.set_xlabel(col); ax.set_ylabel("PE (MW)")
        ax.set_title(f"PE vs {col} (r={df[col].corr(df['PE']):.2f})")
    fig.suptitle("UCI CCPP: Feature vs Energy Output", fontsize=13)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "ccpp_scatter.png"))
    plt.close(fig)
    log("  -> saved ccpp_scatter.png")

    # Chart 5: energy output distribution
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.hist(df["PE"], bins=50, color="#22c55e", edgecolor="white")
    ax.set_xlabel("Net Energy Output (MW)"); ax.set_ylabel("Count")
    ax.set_title("Distribution of Power Plant Energy Output")
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "ccpp_pe_dist.png"))
    plt.close(fig)
    log("  -> saved ccpp_pe_dist.png")

    return df


# ════════════════════════════════════════════════════════════
if __name__ == "__main__":
    df_cm = load_cmapss()
    eda_cmapss(df_cm)

    df_cc = load_ccpp()
    eda_ccpp(df_cc)

    # Save CSV versions for the training script
    df_cm.to_csv(os.path.join(HERE, "data", "cmapss_fd001_train.csv"), index=False)
    df_cc.to_csv(os.path.join(HERE, "data", "ccpp_clean.csv"), index=False)
    log("\nSaved processed CSVs: cmapss_fd001_train.csv, ccpp_clean.csv")

    with open(os.path.join(OUT, "eda_report.txt"), "w") as f:
        f.write("\n".join(report))
    log(f"\nFull report -> {os.path.join(OUT, 'eda_report.txt')}")
