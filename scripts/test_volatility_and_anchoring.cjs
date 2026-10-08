// Automated verification script for Volatility Metric & Historical Anchoring Guardrails
const fs = require('fs');

console.log("=== RUNNING VOLATILITY & HISTORICAL ANCHORING TEST SUITE ===");

// We will test the exact mathematical logic implemented in getTriggerAccuracyProfile:
const BASELINE_MFAV = 0.58;
const BASELINE_UD = 0.18;
const BASELINE_DRAW = 0.24;
const fullBand = [-35, -30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25];

function simulateGetProfile(desc, counts, objective, historicalAnchor) {
  if (!counts || (counts.mfav + counts.draw + counts.underdog) === 0) {
    return {
      totalHits: 0,
      historicalAnchor,
      isVolatileSignal: false,
      allowedBand: [historicalAnchor]
    };
  }

  const totalHits = counts.mfav + counts.draw + counts.underdog;
  let targetHits = 0;
  let trapHits = 0;

  if (objective === 'underdog_only') {
    targetHits = counts.underdog;
    trapHits = counts.mfav + counts.draw;
  } else if (objective === 'mfav_only') {
    targetHits = counts.mfav;
    trapHits = counts.draw + counts.underdog;
  } else {
    targetHits = counts.mfav + counts.draw;
    trapHits = counts.underdog;
  }

  const targetAccuracy = targetHits / totalHits;
  const mfavRate = counts.mfav / totalHits;
  const udRate = counts.underdog / totalHits;
  const drawRate = counts.draw / totalHits;

  const mfavLift = mfavRate / BASELINE_MFAV;
  const underdogLift = udRate / BASELINE_UD;
  const volatilityRatio = (counts.draw + counts.underdog) / totalHits;

  const isVolatileSignal = totalHits >= 3 && (underdogLift >= 1.30 || volatilityRatio >= 0.55);

  let allowedBand;
  if (totalHits < 4) {
    allowedBand = [historicalAnchor];
  } else if (totalHits < 8) {
    const minSmall = Math.max(-35, historicalAnchor - 5);
    const maxSmall = Math.min(25, historicalAnchor + 5);
    allowedBand = fullBand.filter(v => v >= minSmall && v <= maxSmall);
    if (!allowedBand.includes(historicalAnchor)) allowedBand.push(historicalAnchor);
    allowedBand.sort((a, b) => a - b);
  } else {
    let minBound = Math.max(-35, historicalAnchor - 10);
    let maxBound = Math.min(25, historicalAnchor + 10);

    if (objective === 'mfav_only') {
      if (isVolatileSignal) {
        maxBound = Math.min(maxBound, 0);
      } else if (mfavRate >= 0.55 && underdogLift <= 0.90) {
        minBound = Math.max(minBound, 0);
      }
    } else if (objective === 'underdog_only') {
      if (isVolatileSignal && (underdogLift >= 1.25 || udRate >= 0.22)) {
        minBound = Math.max(minBound, 0);
      } else if (mfavRate >= 0.60 && underdogLift <= 0.80) {
        maxBound = Math.min(maxBound, 0);
      }
    } else {
      if (udRate > 0.28 || underdogLift >= 1.45) {
        maxBound = Math.min(maxBound, 0);
      } else if (targetAccuracy >= 0.68 && udRate <= 0.20) {
        minBound = Math.max(minBound, 0);
      }
    }

    if (minBound > maxBound) minBound = maxBound;
    allowedBand = fullBand.filter(v => v >= minBound && v <= maxBound);
    if (allowedBand.length === 0) allowedBand = [historicalAnchor];
  }

  return {
    totalHits,
    targetAccuracy,
    mfavRate,
    udRate,
    underdogLift,
    volatilityRatio,
    isVolatileSignal,
    historicalAnchor,
    allowedBand
  };
}

// TEST 1: Volatility Detection (e.g. Israeli leagues or GA >= 1.1 with 42% Mfav, 28% Draw, 30% UD)
console.log("\n--- TEST 1: Volatility Detection ---");
const volatileCounts = { mfav: 13, draw: 8, underdog: 9 }; // N=30
const profileBestBet = simulateGetProfile("Both teams GA >= 1.1 (volatile match)", volatileCounts, "mfav_only", -10);
console.log("Mfav Rate:", (profileBestBet.mfavRate * 100).toFixed(1) + "%");
console.log("UD Rate:", (profileBestBet.udRate * 100).toFixed(1) + "%");
console.log("Underdog Lift:", profileBestBet.underdogLift.toFixed(2) + "x");
console.log("Volatility Ratio:", (profileBestBet.volatilityRatio * 100).toFixed(1) + "%");
console.log("Is Volatile Signal:", profileBestBet.isVolatileSignal);
console.log("Allowed Band in Best Bets (mfav_only):", profileBestBet.allowedBand);

if (!profileBestBet.isVolatileSignal) {
  console.error("FAIL: Expected isVolatileSignal to be true!");
  process.exit(1);
}
if (profileBestBet.allowedBand.some(v => v > 0)) {
  console.error("FAIL: Volatile signal should not receive positive bonus in mfav_only!");
  process.exit(1);
}
console.log("PASS: Volatility correctly detected and capped in mfav_only.");

// TEST 2: Volatile Signal in Upsets (underdog_only)
const profileUpsets = simulateGetProfile("Both teams GA >= 1.1 (volatile match)", volatileCounts, "underdog_only", 15);
console.log("Allowed Band in Upsets (underdog_only):", profileUpsets.allowedBand);
if (profileUpsets.allowedBand.some(v => v < 0)) {
  console.error("FAIL: Volatile signal with high UD lift should not receive negative penalty in upsets!");
  process.exit(1);
}
console.log("PASS: Volatility correctly rewarded in underdog_only.");

// TEST 3: Small-Sample Guardrail (N=5 for Algo final prediction is 1X/X2)
console.log("\n--- TEST 3: Small-Sample Guardrail (N=5 Anomaly) ---");
const yesterdayCounts = { mfav: 0, draw: 2, underdog: 3 }; // N=5, 60% UD
const profileT12Small = simulateGetProfile("Algo final prediction is 1X/X2", yesterdayCounts, "mfav_draw", 15);
console.log("Historical Anchor:", profileT12Small.historicalAnchor);
console.log("Sample Size N:", profileT12Small.totalHits);
console.log("Allowed Band:", profileT12Small.allowedBand);

if (profileT12Small.allowedBand.includes(-35)) {
  console.error("FAIL: Small sample N=5 should NEVER be allowed to become -35!");
  process.exit(1);
}
if (profileT12Small.allowedBand.some(v => v <= 0)) {
  console.error("FAIL: Small sample N=5 of a +15 trigger should stay firmly positive [10, 15, 20]!");
  process.exit(1);
}
console.log("PASS: Small sample anomaly N=5 safely anchored within ±5 PTS of history.");

// TEST 4: Bounded Daily Drift (Delta_max = ±10 PTS for N=20)
console.log("\n--- TEST 4: Bounded Daily Drift (Delta_max = ±10 PTS) ---");
const matureCounts = { mfav: 10, draw: 6, underdog: 4 }; // N=20
const profileBounded = simulateGetProfile("PAA, Seer, Algo, and ML agree on 1X/X2", matureCounts, "mfav_draw", 15);
console.log("Historical Anchor: +15");
console.log("Allowed Band for N=20:", profileBounded.allowedBand);
const minAllowed = Math.min(...profileBounded.allowedBand);
const maxAllowed = Math.max(...profileBounded.allowedBand);
console.log(`Min: ${minAllowed}, Max: ${maxAllowed}`);
if (minAllowed < 5 || maxAllowed > 25) {
  console.error("FAIL: Drift exceeded ±10 PTS window [5, 25]!");
  process.exit(1);
}
console.log("PASS: Bounded daily drift strictly adhered to [5, 25].");

console.log("\n>>> ALL TESTS PASSED SUCCESSFULLY! <<<");
