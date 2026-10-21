const test = require("node:test");
const assert = require("node:assert/strict");
const { advanceTankLevel, calculateMediaReadings } = require("../dashboard/process-model.js");

function sample(overrides = {}) {
  return calculateMediaReadings({
    phase: 0,
    airLoadPercent: 72,
    waterLoadPercent: 68,
    gasLoadPercent: 64,
    airFilterBypassed: false,
    waterTreatmentBypassed: false,
    gasScrubberBypassed: false,
    oilFilterBypassed: false,
    waterFeedLevel: 61,
    waterProductLevel: 43,
    oilFlow: 44,
    oilFeedLevel: 68,
    oilReceiverLevel: 52,
    oilOutletTemperature: 90,
    oilFilterRestricted: false,
    ...overrides,
  });
}

test("tank balance applies the hourly flow difference and clips at vessel limits", () => {
  assert.equal(advanceTankLevel(50, 20, 10, 100, 60), 60);
  assert.equal(advanceTankLevel(99, 100, 0, 10, 1), 100);
  assert.equal(advanceTankLevel(1, 0, 100, 10, 1), 0);
});

test("tank balance rejects invalid capacities and non-finite inputs", () => {
  assert.throws(() => advanceTankLevel(50, 20, 10, 0), RangeError);
  assert.throws(() => advanceTankLevel(Number.NaN, 20, 10, 100), TypeError);
  assert.throws(() => advanceTankLevel(50, 20, 10, 100, -1), RangeError);
});

test("water tank inventory remains independent of the oil tank inventory", () => {
  const result = sample({ waterFeedLevel: 20, waterProductLevel: 80, oilFeedLevel: 95, oilReceiverLevel: 5 });
  assert.equal(result.water.feedLevel, 20);
  assert.equal(result.water.productLevel, 80);
  assert.equal(result.oil.feedLevel, 95);
  assert.equal(result.oil.receiverLevel, 5);
});

test("stream throughput follows its independent load setting", () => {
  const idle = sample({ airLoadPercent: 0, waterLoadPercent: 0, gasLoadPercent: 0 });
  const full = sample({ airLoadPercent: 100, waterLoadPercent: 100, gasLoadPercent: 100 });
  assert.deepEqual(
    [idle.air.flow, idle.water.flow, idle.gas.flow],
    [0, 0, 0],
  );
  assert.deepEqual(
    [full.air.flow, full.water.flow, full.gas.flow],
    [1800, 46, 24],
  );
});

test("load inputs are bounded to their supported range", () => {
  const result = sample({ airLoadPercent: -25, waterLoadPercent: 125, gasLoadPercent: 125 });
  assert.deepEqual([result.air.flow, result.water.flow, result.gas.flow], [0, 46, 24]);
});

test("treatment bypasses raise their associated illustrative outlet indicators", () => {
  const normal = sample();
  const bypassed = sample({
    airFilterBypassed: true,
    waterTreatmentBypassed: true,
    gasScrubberBypassed: true,
  });
  assert.ok(bypassed.air.pm25 > normal.air.pm25);
  assert.ok(bypassed.air.pm10 > normal.air.pm10);
  assert.ok(bypassed.water.turbidity > normal.water.turbidity);
  assert.equal(normal.water.ph, 7.2);
  assert.equal(bypassed.water.ph, 6.35);
  assert.ok(bypassed.gas.h2s > normal.gas.h2s);
  assert.equal(bypassed.air.co2, normal.air.co2);
  assert.equal(bypassed.gas.methane, normal.gas.methane);
});

test("oil bypass affects particles but does not claim to remove water", () => {
  const normal = sample();
  const bypassed = sample({ oilFilterBypassed: true });
  assert.equal(normal.oil.particles, 70);
  assert.equal(bypassed.oil.particles, 820);
  assert.equal(bypassed.oil.waterContent, normal.oil.waterContent);
});

test("all generated stream readings remain finite for a simulation step", () => {
  const result = sample({ phase: 125 });
  const readings = Object.values(result).flatMap(stream => Object.values(stream))
    .filter(value => typeof value === "number");
  assert.ok(readings.length > 0);
  assert.ok(readings.every(Number.isFinite));
});
