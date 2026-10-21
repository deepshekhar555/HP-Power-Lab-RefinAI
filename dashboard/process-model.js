(function initializeRefinAIProcessModel(root, createModel) {
  const model = createModel();
  root.RefinAIProcessModel = model;
  if (typeof module !== "undefined" && module.exports) module.exports = model;
}(globalThis, function createRefinAIProcessModel() {
  function requireFinite(name, value) {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${name} must be a finite number.`);
    }
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function advanceTankLevel(levelPercent, inflowM3PerHour, outflowM3PerHour, capacityM3, minutes = 1) {
    requireFinite("levelPercent", levelPercent);
    requireFinite("inflowM3PerHour", inflowM3PerHour);
    requireFinite("outflowM3PerHour", outflowM3PerHour);
    requireFinite("capacityM3", capacityM3);
    requireFinite("minutes", minutes);
    if (capacityM3 <= 0) throw new RangeError("capacityM3 must be greater than zero.");
    if (minutes < 0) throw new RangeError("minutes must not be negative.");
    return clamp(
      levelPercent + (inflowM3PerHour - outflowM3PerHour) * minutes / (capacityM3 * 60) * 100,
      0,
      100,
    );
  }

  function calculateMediaReadings({
    phase,
    airLoadPercent,
    waterLoadPercent,
    gasLoadPercent,
    airFilterBypassed,
    waterTreatmentBypassed,
    gasScrubberBypassed,
    oilFilterBypassed,
    waterFeedLevel,
    waterProductLevel,
    oilFlow,
    oilFeedLevel,
    oilReceiverLevel,
    oilOutletTemperature,
    oilFilterRestricted,
  }) {
    requireFinite("phase", phase);
    requireFinite("airLoadPercent", airLoadPercent);
    requireFinite("waterLoadPercent", waterLoadPercent);
    requireFinite("gasLoadPercent", gasLoadPercent);
    requireFinite("waterFeedLevel", waterFeedLevel);
    requireFinite("waterProductLevel", waterProductLevel);
    requireFinite("oilFlow", oilFlow);
    requireFinite("oilFeedLevel", oilFeedLevel);
    requireFinite("oilReceiverLevel", oilReceiverLevel);
    requireFinite("oilOutletTemperature", oilOutletTemperature);

    const airLoad = clamp(airLoadPercent, 0, 100) / 100;
    const waterLoad = clamp(waterLoadPercent, 0, 100) / 100;
    const gasLoad = clamp(gasLoadPercent, 0, 100) / 100;

    return {
      air: {
        flow: 1800 * airLoad,
        pm25: 38 * (airFilterBypassed ? 0.78 : 0.07) + Math.sin(phase * 0.13) * 0.12,
        pm10: 76 * (airFilterBypassed ? 0.74 : 0.06) + Math.sin(phase * 0.11) * 0.2,
        co2: 430 + Math.sin(phase * 0.07) * 2,
        voc: 0.18 * 0.22 + Math.sin(phase * 0.17) * 0.004,
        differentialPressure: 0.55 + airLoad * (airFilterBypassed ? 0.5 : 1.25),
        bypassed: Boolean(airFilterBypassed),
      },
      water: {
        flow: 46 * waterLoad,
        feedLevel: clamp(waterFeedLevel, 0, 100),
        productLevel: clamp(waterProductLevel, 0, 100),
        ph: (waterTreatmentBypassed ? 6.35 : 7.2) + Math.sin(phase * 0.09) * 0.08,
        turbidity: 31 * (waterTreatmentBypassed ? 0.92 : 0.045) + Math.sin(phase * 0.15) * 0.06,
        conductivity: 415 + Math.sin(phase * 0.06) * 4,
        dissolvedOxygen: 6.6 + Math.sin(phase * 0.12) * 0.15,
        bypassed: Boolean(waterTreatmentBypassed),
      },
      gas: {
        flow: 24 * gasLoad,
        pressure: 4.8 + gasLoad * 1.65,
        h2s: 42 * (gasScrubberBypassed ? 0.96 : 0.045) + Math.sin(phase * 0.1) * 0.15,
        methane: 86 + Math.sin(phase * 0.08) * 0.35,
        bypassed: Boolean(gasScrubberBypassed),
      },
      oil: {
        flow: oilFlow,
        feedLevel: clamp(oilFeedLevel, 0, 100),
        receiverLevel: clamp(oilReceiverLevel, 0, 100),
        temperature: oilOutletTemperature,
        estimatedViscosity: 38 * Math.exp(-0.018 * (oilOutletTemperature - 40)),
        waterContent: 0.08,
        particles: oilFilterBypassed ? 820 : oilFilterRestricted ? 320 : 70,
        bypassed: Boolean(oilFilterBypassed),
      },
    };
  }

  return Object.freeze({ advanceTankLevel, calculateMediaReadings });
}));
