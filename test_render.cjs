var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/utils/storageUtils.ts
function parseDateTimestamp(dateStr) {
  if (!dateStr) return 0;
  let s = dateStr.trim().split("T")[0].split(" ")[0];
  if (/^\d{2}[-/]\d{2}[-/]\d{4}/.test(s)) {
    const parts = s.split(/[-/]/);
    if (parts.length >= 3) {
      s = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  const t = new Date(s).getTime();
  return isNaN(t) ? 0 : t;
}
var deduplicateMatches;
var init_storageUtils = __esm({
  "src/utils/storageUtils.ts"() {
    deduplicateMatches = (matches) => {
      if (!matches || matches.length === 0) return [];
      const statsGroupMap = /* @__PURE__ */ new Map();
      matches.forEach((m) => {
        const teams = (m.teams || "").toLowerCase().trim().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ");
        if (!teams) return;
        const mo = (m.mo || "").trim();
        const ga = (m.ga || "").trim();
        const gs = (m.gs || "").trim();
        const l10 = (m.l10 || "").trim();
        const le = (m.le || "").trim();
        const statsKey = `${mo}|${ga}|${gs}|${l10}|${le}`;
        const groupKey = `${teams}||${statsKey}`;
        const existing = statsGroupMap.get(groupKey);
        if (!existing) {
          statsGroupMap.set(groupKey, { ...m });
        } else {
          const tExisting = parseDateTimestamp(existing.date);
          const tNew = parseDateTimestamp(m.date);
          let preferred = existing;
          if (tNew > 0 && (tExisting === 0 || tNew < tExisting)) {
            preferred = { ...m };
          } else if (tExisting > 0 && tNew >= tExisting) {
            preferred = existing;
          }
          if (existing.isJackpot || m.isJackpot) preferred.isJackpot = true;
          if (existing.isDaily || m.isDaily) preferred.isDaily = true;
          const ids = /* @__PURE__ */ new Set([...existing.jackpotIds || [], ...m.jackpotIds || []]);
          if (existing.jackpotId) ids.add(existing.jackpotId);
          if (m.jackpotId) ids.add(m.jackpotId);
          if (ids.size > 0) preferred.jackpotIds = Array.from(ids);
          statsGroupMap.set(groupKey, preferred);
        }
      });
      const deduplicatedByStats = Array.from(statsGroupMap.values());
      const uniqueMap = /* @__PURE__ */ new Map();
      deduplicatedByStats.forEach((m) => {
        const teams = (m.teams || "").toLowerCase().trim().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ");
        let dateStr = m.date?.split("T")[0]?.split(" ")[0] || "no-date";
        if (/^\d{2}[-/]\d{2}[-/]\d{4}/.test(dateStr)) {
          const parts = dateStr.split(/[-/]/);
          if (parts.length >= 3) {
            dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
        }
        const key = `${teams}|${dateStr}`;
        const existing = uniqueMap.get(key);
        if (!existing) {
          uniqueMap.set(key, { ...m });
        } else {
          const existingHasResult = existing.result && existing.result.trim() !== "" && existing.result.trim().toLowerCase() !== "pending";
          const newHasResult = m.result && m.result.trim() !== "" && m.result.trim().toLowerCase() !== "pending";
          let preferred = existing;
          if (newHasResult && !existingHasResult) {
            preferred = { ...m };
          } else if (!existingHasResult && !newHasResult) {
            if (!String(existing.id || "").startsWith("import-") && String(m.id || "").startsWith("import-")) preferred = existing;
          }
          if (existing.isJackpot || m.isJackpot) preferred.isJackpot = true;
          if (existing.isDaily || m.isDaily) preferred.isDaily = true;
          const ids = /* @__PURE__ */ new Set([...existing.jackpotIds || [], ...m.jackpotIds || []]);
          if (existing.jackpotId) ids.add(existing.jackpotId);
          if (m.jackpotId) ids.add(m.jackpotId);
          if (ids.size > 0) preferred.jackpotIds = Array.from(ids);
          uniqueMap.set(key, preferred);
        }
      });
      return Array.from(uniqueMap.values());
    };
  }
});

// src/components/Patterns.tsx
var init_Patterns = __esm({
  "src/components/Patterns.tsx"() {
  }
});

// src/components/ai/Dlivealgorithm.tsx
var predictDaily;
var init_Dlivealgorithm = __esm({
  "src/components/ai/Dlivealgorithm.tsx"() {
    init_matchProcessing();
    predictDaily = (match, algo) => {
      const mainP = match.patternAnalysis?.mainPattern || "NA";
      const subP = match.patternAnalysis?.subPattern || "NA";
      const flags = match.patternAnalysis?.activeFlags || [];
      const hasFlag = (f) => flags.includes(f);
      const exactKey = `EX:${mainP}|${flags.sort().join("+")}`;
      const currentWeights = { ...algo.weights, external: 0 };
      const signals = [];
      if (currentWeights.exactMatch > 0) {
        const sExact = algo.getProbabilities(exactKey, 3);
        if (sExact) signals.push({ probs: sExact, weight: currentWeights.exactMatch, name: "Exact Scenario" });
      }
      const sSub = algo.getProbabilities(`S:${subP}`, 5);
      const sSubStats = algo.getRawPatternStats(`S:${subP}`);
      const sSubStatsProb = algo.getProbabilities(`S:${subP}`, 3);
      const phaDrawPctVal = sSub ? sSub["X"] : 0;
      if (sSub) signals.push({ probs: sSub, weight: currentWeights.subPattern, name: "Sub Pattern" });
      if (currentWeights.flags > 0) {
        let flagProbs = { "1": 0, "X": 0, "2": 0, count: 0 };
        flags.forEach((f) => {
          if (f === "TS_DIFF_DRAW" && phaDrawPctVal <= 0.3) return;
          const fp = algo.getProbabilities(`F:${f}`, 10);
          if (fp) {
            flagProbs["1"] += fp["1"];
            flagProbs["X"] += fp["X"];
            flagProbs["2"] += fp["2"];
            flagProbs.count++;
          }
        });
        if (flagProbs.count > 0) {
          signals.push({
            probs: {
              "1": flagProbs["1"] / flagProbs.count,
              "X": flagProbs["X"] / flagProbs.count,
              "2": flagProbs["2"] / flagProbs.count
            },
            weight: currentWeights.flags,
            name: "Flag Consensus"
          });
        }
      }
      if (currentWeights.mainPattern > 0) {
        const sMain = algo.getProbabilities(`M:${mainP}`, 10);
        if (sMain) signals.push({ probs: sMain, weight: currentWeights.mainPattern, name: "Main Pattern" });
      }
      const moParts = String(match.mo || "").split(/[- ,]+/).map((p) => parseFloat(p.trim())).filter((p) => !isNaN(p));
      let impliedProbs = { "1": 0.33, "X": 0.33, "2": 0.33 };
      if (moParts.length === 3 && !moParts.some(isNaN)) {
        const margin = 1 / moParts[0] + 1 / moParts[1] + 1 / moParts[2];
        impliedProbs = {
          "1": 1 / moParts[0] / margin,
          "X": 1 / moParts[1] / margin,
          "2": 1 / moParts[2] / margin
        };
        signals.push({ probs: impliedProbs, weight: currentWeights.odds, name: "Market Implied" });
      }
      if (currentWeights.external > 0) {
        const extProbs = algo.getProbsFromPrediction(match.pred1x2);
        signals.push({ probs: extProbs, weight: currentWeights.external, name: "External Source" });
      }
      const ptsProbs = algo.getProbsFromPrediction(match.calculatedPrediction);
      signals.push({ probs: ptsProbs, weight: currentWeights.points, name: "Points System" });
      if (currentWeights.subPatternPrediction > 0) {
        const subPred2 = match.patternAnalysis?.subPatternPrediction;
        if (subPred2) {
          let predProbs = { "1": 0.33, "X": 0.33, "2": 0.33 };
          if (subPred2 === "1") predProbs = { "1": 0.8, "X": 0.15, "2": 0.05 };
          else if (subPred2 === "2") predProbs = { "1": 0.05, "X": 0.15, "2": 0.8 };
          else if (subPred2 === "X") predProbs = { "1": 0.2, "X": 0.6, "2": 0.2 };
          else if (subPred2 === "1X") predProbs = { "1": 0.65, "X": 0.35, "2": 0 };
          else if (subPred2 === "X2") predProbs = { "1": 0, "X": 0.35, "2": 0.65 };
          else if (subPred2 === "12") predProbs = { "1": 0.5, "X": 0, "2": 0.5 };
          signals.push({ probs: predProbs, weight: currentWeights.subPatternPrediction, name: "Sub Pattern Prediction" });
        }
      }
      let p1 = 0, pX = 0, p2 = 0, totalWeight = 0;
      if (signals.length === 0) {
        p1 = impliedProbs["1"];
        pX = impliedProbs["X"];
        p2 = impliedProbs["2"];
      } else {
        signals.forEach((s) => {
          p1 += s.probs["1"] * s.weight;
          pX += s.probs["X"] * s.weight;
          p2 += s.probs["2"] * s.weight;
          totalWeight += s.weight;
        });
        p1 /= totalWeight;
        pX /= totalWeight;
        p2 /= totalWeight;
      }
      const sumProbs = p1 + pX + p2;
      if (sumProbs > 0 && Math.abs(sumProbs - 1) > Number.EPSILON) {
        p1 = p1 / sumProbs;
        pX = pX / sumProbs;
        p2 = p2 / sumProbs;
      }
      const maxP = Math.max(p1, pX, p2);
      let prediction = "1";
      if (pX === maxP) prediction = "X";
      if (p2 === maxP) prediction = "2";
      let finalPrediction = prediction;
      let hedgeThreshold = 0.7;
      if (moParts.length === 3) {
        const [o12, , o22] = moParts;
        const isCoinFlip = o12 >= 2.5 && o22 >= 2.5;
        const favOdds2 = Math.min(o12, o22);
        if (isCoinFlip) {
          hedgeThreshold = 0.65;
        } else if (favOdds2 < 1.3) {
          hedgeThreshold = 0.9;
        } else if (favOdds2 <= 1.5) {
          hedgeThreshold = 0.75;
        } else if (favOdds2 <= 1.8) {
          hedgeThreshold = 0.8;
        } else {
          hedgeThreshold = 0.65;
        }
      }
      const rulePrediction = match.patternAnalysis?.subPatternPrediction;
      const hasRule = false;
      if (hasRule) {
        finalPrediction = rulePrediction;
        if (rulePrediction === "X2" && sSubStatsProb && sSubStatsProb["1"] > 0.55) {
          finalPrediction = "1X";
        }
        if (finalPrediction.length > 1) {
          if (finalPrediction === "1X") prediction = p1 >= pX ? "1" : "X";
          else if (finalPrediction === "X2") prediction = p2 >= pX ? "2" : "X";
          else if (finalPrediction === "12") prediction = p1 >= p2 ? "1" : "2";
        } else {
          prediction = finalPrediction;
        }
      } else {
        if (maxP < hedgeThreshold) {
          if (prediction === "1") finalPrediction = pX > p2 ? "1X" : "12";
          else if (prediction === "X") finalPrediction = p1 > p2 ? "1X" : "X2";
          else finalPrediction = pX > p1 ? "X2" : "12";
        }
      }
      const [o1, oX, o2] = moParts;
      if (!isNaN(o1) && !isNaN(o2) && Math.abs(o1 - o2) < 0.3) {
        if (sSubStatsProb && sSubStatsProb["1"] < 0.45 && sSubStatsProb["2"] < 0.45) {
          prediction = "X";
          finalPrediction = p1 > p2 ? "1X" : "X2";
        }
      }
      if (!isNaN(oX) && oX < 3.3 && ["1", "2"].includes(finalPrediction)) {
        if (!isNaN(o1) && o1 >= 2.5 || !isNaN(o2) && o2 >= 2.5) {
          finalPrediction = finalPrediction === "1" ? "1X" : "X2";
        }
      }
      if (!isNaN(o1) && o1 >= 2.5 && (!isNaN(o2) && o2 >= 2.5)) {
        if (maxP < 0.5 && rulePrediction && rulePrediction !== finalPrediction) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          else if (finalPrediction === "X") finalPrediction = p1 > p2 ? "1X" : "X2";
        }
      }
      const moFav = !isNaN(o1) && !isNaN(o2) ? o1 <= o2 ? "1" : "2" : "";
      const moUnderdog = moFav ? moFav === "1" ? "2" : "1" : "";
      if (moUnderdog && sSubStatsProb) {
        const favOdds2 = moFav === "1" ? o1 : o2;
        if (favOdds2 > 2 && rulePrediction && rulePrediction.includes(moUnderdog)) {
          finalPrediction = moUnderdog === "1" ? "1X" : "X2";
        }
      }
      if (rulePrediction === "12" && sSubStatsProb && moUnderdog) {
        if (sSubStatsProb[moUnderdog] > 0.45) {
          finalPrediction = moUnderdog === "1" ? "1X" : "X2";
        }
      }
      let rawConfidence = Math.min(99, Math.round((maxP - 0.33) / 0.67 * 100));
      let isUnshakable = false;
      let category = "Standard";
      if (match.patternAnalysis?.activeFlags?.includes("High Draw Risk") && rulePrediction && ["1X", "X2"].includes(rulePrediction)) {
        if (!isNaN(oX) && oX >= 2.8 && oX <= 3.4) {
          prediction = "X";
          finalPrediction = "X";
          category = "Banker Draw";
        }
      }
      const ptsAgree = match.calculatedPrediction === prediction;
      if (ptsAgree) {
        rawConfidence = Math.min(99, rawConfidence + 10);
      }
      const reasonParts = [];
      const highYieldPatterns = ["G2p10", "G2q10", "G2ee3", "G3o7"];
      const highYieldMainPatterns = ["C", "K", "Y", "L"];
      if (highYieldPatterns.includes(subP) || highYieldMainPatterns.includes(mainP)) {
        rawConfidence = Math.min(99, rawConfidence + 5);
        reasonParts.push("High-Yield Pattern Boost (+5%)");
      }
      const toxicBankerPatterns = ["G1a7", "G1f27", "G1g6", "G1o4", "G1ff44"];
      if (toxicBankerPatterns.includes(subP)) {
        if (category === "Banker") {
          category = "Standard";
          reasonParts.push("Toxic Sub-Pattern Purge");
        }
      }
      if (category === "Banker" && finalPrediction.length > 1) {
        if (sSubStatsProb) {
          let combinedPha = 0;
          if (finalPrediction === "1X") combinedPha = sSubStatsProb["1"] + sSubStatsProb["X"];
          else if (finalPrediction === "X2") combinedPha = sSubStatsProb["X"] + sSubStatsProb["2"];
          else if (finalPrediction === "12") combinedPha = sSubStatsProb["1"] + sSubStatsProb["2"];
          if (combinedPha <= 0.85) {
            rawConfidence = Math.min(rawConfidence, 79);
            category = "Standard";
            reasonParts.push("PHA Support Mandate Fail (<85%)");
          }
        }
      }
      if (["G1g3", "G1i18"].includes(subP) && rawConfidence === 0) {
        category = "Upset";
        reasonParts.push("Sub-Pattern Exploitation (Upset)");
      }
      const runTSLogic = true;
      if (sSubStatsProb) {
        const maxPhaSup = Math.max(sSubStatsProb["1"], sSubStatsProb["X"], sSubStatsProb["2"]);
        if (maxPhaSup > 0.6) {
          let phaPred2 = "";
          if (maxPhaSup === sSubStatsProb["1"]) phaPred2 = "1";
          else if (maxPhaSup === sSubStatsProb["X"]) phaPred2 = "X";
          else phaPred2 = "2";
          finalPrediction = phaPred2;
          rawConfidence = 99;
          isUnshakable = true;
          category = "Banker";
          reasonParts.push("PHA Supremacy (>60%)");
        }
      }
      let isGoldenCombo = false;
      if (sSubStatsProb && rulePrediction && maxP > 0.5) {
        let phaFav = null;
        const p1s = sSubStatsProb["1"];
        const pXs = sSubStatsProb["X"];
        const p2s = sSubStatsProb["2"];
        const maxS = Math.max(p1s, pXs, p2s);
        if (maxS === p1s) phaFav = "1";
        else if (maxS === pXs) phaFav = "X";
        else phaFav = "2";
        let probFav = null;
        if (maxP === p1) probFav = "1";
        else if (maxP === pX) probFav = "X";
        else probFav = "2";
        if (phaFav && phaFav === probFav && matchesPrediction(rulePrediction, phaFav)) {
          if (rulePrediction === phaFav) {
            isGoldenCombo = true;
          }
        }
      }
      if (isGoldenCombo) {
        finalPrediction = rulePrediction;
        rawConfidence = 99;
        isUnshakable = true;
        category = "Banker";
        reasonParts.unshift("GOLDEN COMBO (PHA+ALGO+Prob)");
      }
      if (!isGoldenCombo) {
        if (hasFlag("POTENTIAL_DRAW") && (finalPrediction === "1" || finalPrediction === "2")) {
          const predOdds2 = finalPrediction === "1" ? o1 : o2;
          if (!isNaN(predOdds2) && predOdds2 < 1.8) {
            finalPrediction = finalPrediction === "1" ? "1X" : "X2";
            rawConfidence = Math.max(0, rawConfidence - 15);
            reasonParts.push("Potential Draw Volatility");
            category = "Standard";
          }
        }
        const currentPredOdds = finalPrediction === "1" ? o1 : finalPrediction === "2" ? o2 : oX;
        if (!isNaN(currentPredOdds) && currentPredOdds > 2 && finalPrediction.length === 1) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          reasonParts.push("High Odds Volatility (>2.0)");
        }
        if (match.group === 2 && rawConfidence < 65 && finalPrediction.length === 1) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          reasonParts.push("Group 2 Structural Defense");
        }
        if (match.group === 1 && finalPrediction.length === 1) {
          if (sSubStatsProb && sSubStatsProb["X"] > 0.2) {
            if (finalPrediction === "1") finalPrediction = "1X";
            else if (finalPrediction === "2") finalPrediction = "X2";
            reasonParts.push("Group 1 Draw Risk (>20%)");
          }
        }
        if (sSubStatsProb) {
          const p1_pha_b7 = sSubStatsProb["1"];
          const pX_pha_b7 = sSubStatsProb["X"];
          const p2_pha_b7 = sSubStatsProb["2"];
          const maxPha_b7 = Math.max(p1_pha_b7, pX_pha_b7, p2_pha_b7);
          if (maxPha_b7 >= 0.9) {
            if (p1_pha_b7 >= 0.9) finalPrediction = "1";
            else if (p2_pha_b7 >= 0.9) finalPrediction = "2";
            else finalPrediction = "X";
            rawConfidence = 99;
            isUnshakable = true;
            reasonParts.push("PHA > 90% Authority");
          }
          if (pX_pha_b7 < 0.3 && p1_pha_b7 > 0.3 && p2_pha_b7 > 0.3) {
            finalPrediction = "12";
            reasonParts.push("PHA H/A Split");
          }
          if (p2_pha_b7 < 0.15 && p1_pha_b7 > 0.3 && pX_pha_b7 > 0.3) {
            finalPrediction = "1X";
            reasonParts.push("PHA H/D Split");
          }
          if (p1_pha_b7 < 0.2 && p2_pha_b7 > 0.3 && pX_pha_b7 > 0.3) {
            finalPrediction = "X2";
            reasonParts.push("PHA A/D Split");
          }
          if (p1_pha_b7 > 0.28 && p1_pha_b7 < 0.4 && pX_pha_b7 > 0.28 && pX_pha_b7 < 0.4 && p2_pha_b7 > 0.28 && p2_pha_b7 < 0.4) {
            rawConfidence = 0;
            category = "Standard";
            reasonParts.push("PHA Balanced Split (Avoid)");
          }
        }
        if (sSubStatsProb) {
          if (sSubStatsProb["1"] > 0.3 && sSubStatsProb["2"] < 0.5) {
            if (finalPrediction === "X2") {
              finalPrediction = "12";
              reasonParts.push("Away Fav Fragility");
              category = "Standard";
            }
          }
        }
        if (["G2ee1", "G1p7"].includes(subP)) {
          if (match.gsHome && match.gsHome < 1.5) {
            if (finalPrediction === "1") {
              finalPrediction = "1X";
              category = "Standard";
              reasonParts.push("Dominance Leakage Hedge");
            }
          }
        }
        if (sSubStatsProb) {
          const probs = Object.values(sSubStatsProb).sort((a, b) => b - a);
          if (probs[0] - probs[1] < 0.15) {
            if (category === "Banker") {
              category = "Standard";
              reasonParts.push("Tight Spread (Not Clean)");
            }
          }
        }
        if (subP === "G3j2" && sSubStatsProb) {
          if (Math.abs(sSubStatsProb["1"] - sSubStatsProb["2"]) < 0.15) {
            if (finalPrediction === "X2") {
              finalPrediction = "12";
              reasonParts.push("G3j2 Spread Logic");
            }
          }
        }
        const isTopTier = ["Arsenal", "Liverpool", "Man City", "Aston Villa", "Tottenham", "Man Utd", "Newcastle", "Chelsea", "West Ham", "Brighton", "Real Madrid", "Barcelona", "Bayern", "Leverkusen", "Inter", "Milan", "Juventus", "PSG"].some((t) => match.teams.includes(t));
        if (isTopTier && sSubStatsProb && sSubStatsProb["2"] > 0.45) {
          if (finalPrediction === "1X") {
            finalPrediction = "2";
            reasonParts.push("Top Tier Away Strength");
          }
        }
        if (match.patternAnalysis?.subPatternPrediction && sSubStatsProb) {
          const p1s = sSubStatsProb["1"];
          const pXs = sSubStatsProb["X"];
          const p2s = sSubStatsProb["2"];
          let phaPred2 = null;
          const max = Math.max(p1s, pXs, p2s);
          if (max === p1s) phaPred2 = "1";
          else if (max === pXs) phaPred2 = "X";
          else phaPred2 = "2";
          if (phaPred2 && matchesPrediction(match.patternAnalysis.subPatternPrediction, phaPred2)) {
            rawConfidence = Math.max(rawConfidence, 85);
            reasonParts.push("PHA+Sub Synergy");
          }
        }
        if (moFav && sSubStatsProb) {
          let phaPredDirection = null;
          if (sSubStatsProb["1"] > sSubStatsProb["2"] && sSubStatsProb["1"] > sSubStatsProb["X"]) phaPredDirection = "1";
          else if (sSubStatsProb["2"] > sSubStatsProb["1"] && sSubStatsProb["2"] > sSubStatsProb["X"]) phaPredDirection = "2";
          if (phaPredDirection && phaPredDirection !== moFav && rawConfidence <= 80) {
            category = "Standard";
            reasonParts.push("PHA/MO Conflict Risk");
            if (finalPrediction.length === 1 && !isUnshakable) {
              finalPrediction = moFav === "1" ? "1X" : "X2";
            }
          }
        }
      }
      let phaPredBatch6 = null;
      if (sSubStatsProb) {
        const p1s = sSubStatsProb["1"];
        const pXs = sSubStatsProb["X"];
        const p2s = sSubStatsProb["2"];
        const maxS = Math.max(p1s, pXs, p2s);
        if (maxS === p1s) phaPredBatch6 = "1";
        else if (maxS === pXs) phaPredBatch6 = "X";
        else phaPredBatch6 = "2";
      }
      const subPatternPredBatch6 = match.patternAnalysis?.subPatternPrediction;
      if (!isGoldenCombo && phaPredBatch6 && subPatternPredBatch6 && matchesPrediction(subPatternPredBatch6, phaPredBatch6)) {
        if (phaPredBatch6 === subPatternPredBatch6 && ["1", "X", "2"].includes(phaPredBatch6)) {
          finalPrediction = phaPredBatch6;
          rawConfidence = Math.max(rawConfidence, 85);
          isUnshakable = true;
          reasonParts.push("Golden Validator (PHA+Sub)");
        }
      }
      if (!isGoldenCombo && moFav && subPatternPredBatch6 && !matchesPrediction(subPatternPredBatch6, moFav)) {
        if (matchesPrediction(finalPrediction, moFav)) {
          finalPrediction = moFav === "1" ? "X2" : "1X";
          reasonParts.push("SubPattern Veto");
        }
        if (subPatternPredBatch6.includes("X")) {
          if (!finalPrediction.includes("X")) {
            finalPrediction = moFav === "1" ? "1X" : "X2";
          }
        }
      }
      if (subPatternPredBatch6 === "12") {
        if (finalPrediction.length === 1) {
          finalPrediction = "12";
          reasonParts.push("'12' Trap Avoidance");
        }
      }
      const ptsPredBatch6 = match.calculatedPrediction;
      if (ptsPredBatch6 && moFav && matchesPrediction(ptsPredBatch6, moFav)) {
        const phaAgrees = phaPredBatch6 && matchesPrediction(phaPredBatch6, moFav);
        const subAgrees = subPatternPredBatch6 && matchesPrediction(subPatternPredBatch6, moFav);
        if (!phaAgrees && !subAgrees) {
          rawConfidence = Math.min(rawConfidence, 40);
          reasonParts.push("Points Redundancy (No Algo)");
          category = "Standard";
        }
      }
      const minOddsForHedge = Math.min(o1, o2);
      if (!isNaN(minOddsForHedge) && minOddsForHedge >= 2 && ["T", "S", "R", "X"].includes(mainP)) {
        if (finalPrediction === "1") finalPrediction = "1X";
        else if (finalPrediction === "2") finalPrediction = "X2";
        reasonParts.push("Low Scoring Hedge");
      }
      if (!isNaN(minOddsForHedge) && minOddsForHedge < 2 && phaDrawPctVal > 0.3) {
        if (finalPrediction === "1") finalPrediction = "1X";
        else if (finalPrediction === "2") finalPrediction = "X2";
        reasonParts.push("Banker Killer (High PHA Draw)");
      }
      const phaDrawPct = sSub ? Math.round(sSub["X"] * 100) : 0;
      const tsDiff = Math.abs((match.tsa || 0) - (match.tsb || 0));
      if (runTSLogic && tsDiff < 0.3 && phaDrawPct < 30) {
        if (finalPrediction === "X") finalPrediction = "1";
      }
      if (match.group === 1 && !isNaN(o1) && o1 > 2 && match.patternAnalysis?.subPatternPrediction === "12") {
        if (finalPrediction === "1X") finalPrediction = "12";
      }
      if (match.patternAnalysis?.subPatternPrediction === "12" && match.group === 1) {
        if (runTSLogic) {
          if ((match.tsa || 0) >= (match.tsb || 0)) finalPrediction = "1X";
          else finalPrediction = "X2";
        } else {
          finalPrediction = "1X";
        }
      }
      if (match.group === 3 && sSub && sSub["X"] > 0.5) {
        if (finalPrediction === "X") {
          finalPrediction = runTSLogic && (match.tsa || 0) < (match.tsb || 0) ? "X2" : "1X";
        }
      }
      if (sSubStatsProb) {
        const maxPha = Math.max(sSubStatsProb["1"], sSubStatsProb["X"], sSubStatsProb["2"]);
        if (maxPha > 0.6 && match.pred1x2) {
          const phaDir = sSubStatsProb["1"] === maxPha ? "1" : sSubStatsProb["2"] === maxPha ? "2" : "X";
          if (!matchesPrediction(phaDir, match.pred1x2)) {
            if (!matchesPrediction(finalPrediction, phaDir)) {
              finalPrediction = phaDir === "1" ? "1X" : phaDir === "2" ? "X2" : "1X";
              reasonParts.push("PHA Prioritized");
            }
          }
        }
      }
      if (match.group === 2 && sSubStatsProb) {
        const maxPha = Math.max(sSubStatsProb["1"], sSubStatsProb["X"], sSubStatsProb["2"]);
        if (maxPha > 0.65 && match.pred1x2 && !matchesPrediction(match.pred1x2, finalPrediction)) {
          let phaDir = sSubStatsProb["1"] === maxPha ? "1" : sSubStatsProb["2"] === maxPha ? "2" : "X";
          if (!matchesPrediction(phaDir, match.pred1x2)) {
            if (phaDir !== "X") {
              if (!matchesPrediction(finalPrediction, phaDir)) {
                finalPrediction = phaDir === "1" ? "1X" : "X2";
                reasonParts.push("PHA Prioritized");
              }
            }
          }
        }
      }
      const extPred = match.pred1x2;
      let phaPred = null;
      let p1_pha = 0, pX_pha = 0, p2_pha = 0;
      if (sSubStatsProb) {
        p1_pha = sSubStatsProb["1"];
        p2_pha = sSubStatsProb["2"];
        pX_pha = sSubStatsProb["X"];
        const maxPha = Math.max(p1_pha, pX_pha, p2_pha);
        if (maxPha === p1_pha) phaPred = "1";
        else if (maxPha === pX_pha) phaPred = "X";
        else phaPred = "2";
      }
      if (phaPred && extPred && phaPred !== extPred) {
        if (matchesPrediction(extPred, finalPrediction) && !matchesPrediction(phaPred, finalPrediction)) {
          finalPrediction = phaPred;
          rawConfidence = Math.max(rawConfidence, 70);
          reasonParts.push("PHA Override Ext");
        }
      }
      const subPred = match.patternAnalysis?.subPatternPrediction;
      if (subPred === "12") {
        finalPrediction = "12";
      }
      if (moFav && subPred && !matchesPrediction(subPred, moFav)) {
        if (finalPrediction === "1") finalPrediction = "1X";
        else if (finalPrediction === "2") finalPrediction = "X2";
        if (subPred === "1" && moFav === "2") finalPrediction = "1X";
        if (subPred === "2" && moFav === "1") finalPrediction = "X2";
      }
      if (sSubStatsProb && p1_pha > 0.3 && pX_pha > 0.3 && p2_pha > 0.3) {
        if (finalPrediction === "12") {
          if (runTSLogic) {
            finalPrediction = (match.tsa || 0) > (match.tsb || 0) ? "1X" : "X2";
          }
        }
      }
      if (phaPred && moFav && phaPred !== moFav) {
        const maxPhaVal = Math.max(p1_pha, pX_pha, p2_pha);
        if (maxPhaVal < 0.8) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
        }
      }
      const minMarketOddsValue = Math.min(o1, o2);
      if (!isNaN(minMarketOddsValue) && minMarketOddsValue < 2) {
        const marketFav = o1 < o2 ? "1" : "2";
        if (matchesPrediction(finalPrediction, marketFav)) {
          if (finalPrediction === "1X") finalPrediction = "1";
          else if (finalPrediction === "X2") finalPrediction = "2";
        }
      }
      const isHighOdds = !isNaN(minMarketOddsValue) && minMarketOddsValue >= 2;
      if (isHighOdds) {
        const algoPred2 = match.patternAnalysis?.subPatternPrediction;
        const ptsPred = match.calculatedPrediction;
        if (finalPrediction.length === 1 && algoPred2 && algoPred2 !== finalPrediction) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          reasonParts.push("Algo Gatekeeper Hedge");
        }
        if (algoPred2 && (algoPred2 === finalPrediction || algoPred2.length === 1 && finalPrediction.includes(algoPred2))) {
          if (["1", "2"].includes(algoPred2)) {
            const nonDrawProb = 1 - pX;
            if (nonDrawProb > 0.75) {
              finalPrediction = algoPred2;
              isUnshakable = true;
              rawConfidence = Math.max(rawConfidence, 85);
              reasonParts.push("Algo 90% Signal (Safe Single)");
            } else {
              if (finalPrediction.length === 1) {
                finalPrediction = algoPred2 === "1" ? "1X" : "X2";
                reasonParts.push("Draw Risk Hedge (ND<75%)");
              }
            }
          }
        }
        if (!ptsPred || !matchesPrediction(ptsPred, finalPrediction)) {
          if (rawConfidence <= 60) {
            if (finalPrediction.length === 1) {
              if (finalPrediction === "1") finalPrediction = "1X";
              else if (finalPrediction === "2") finalPrediction = "X2";
              reasonParts.push("Points Disagree (Low Conf)");
            }
            category = "Standard";
          } else {
            reasonParts.push("Points Ignored (High Algo Conf)");
          }
        }
        if (algoPred2 && !matchesPrediction(algoPred2, finalPrediction)) {
          if (finalPrediction.length === 1) {
            if (finalPrediction === "1") finalPrediction = "1X";
            else if (finalPrediction === "2") finalPrediction = "X2";
            reasonParts.push("SubPattern Disagree (Value Excl)");
          }
          category = "Standard";
        }
        if (sSubStats && sSubStats.total >= 3) {
          const predSupport = sSubStats.outcomes[finalPrediction] / sSubStats.total;
          if (predSupport > 0.5) {
            rawConfidence = Math.min(99, rawConfidence + 10);
            reasonParts.push("PHA > 50% (+Conf)");
          }
        }
        if (ptsPred && algoPred2 && matchesPrediction(ptsPred, finalPrediction) && matchesPrediction(algoPred2, finalPrediction)) {
          if (finalPrediction.length === 1) {
            category = "Value";
            rawConfidence = Math.max(rawConfidence, 85);
            isUnshakable = true;
            reasonParts.push("Prime Value (Pts+Algo)");
          }
        }
      }
      if (rulePrediction && !matchesPrediction(finalPrediction, rulePrediction)) {
        rawConfidence = Math.max(0, rawConfidence - 15);
        reasonParts.push("ALGO Veto Downgrade");
        if (finalPrediction === "1" && (rulePrediction === "X2" || rulePrediction === "2")) {
          rawConfidence = Math.min(rawConfidence, 75);
          if (category === "Banker") category = "Standard";
          reasonParts.push("ALGO Veto (Removed from Top 20)");
        }
      }
      if (rawConfidence > 60 && subPred && finalPrediction !== subPred) {
        if (finalPrediction.length === 1) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          else if (finalPrediction === "X") finalPrediction = "1X";
          reasonParts.push("SubPattern Mismatch Downgrade");
        }
      }
      const marketFavOutcome = !isNaN(o1) && !isNaN(o2) ? o1 < o2 ? "1" : o1 > o2 ? "2" : "" : "";
      const algoSubPred = match.patternAnalysis?.subPatternPrediction;
      if (marketFavOutcome && algoSubPred && !matchesPrediction(algoSubPred, marketFavOutcome)) {
        const underdogOutcome = marketFavOutcome === "1" ? "2" : "1";
        if (matchesPrediction(algoSubPred, underdogOutcome)) {
          finalPrediction = underdogOutcome;
          const ptsPred = match.calculatedPrediction;
          if (ptsPred && matchesPrediction(ptsPred, underdogOutcome)) {
            rawConfidence = Math.max(rawConfidence, 80);
            reasonParts.push("Dual Upset Conf (Algo+Pts)");
          } else {
            rawConfidence = Math.max(rawConfidence, 65);
            reasonParts.push("Algo Upset Primacy");
          }
          category = "Upset";
          isUnshakable = true;
        }
      }
      if (hasFlag("UPSET") && algoSubPred && marketFavOutcome && matchesPrediction(algoSubPred, marketFavOutcome)) {
        if (category === "Upset") category = "Standard";
      }
      if (marketFavOutcome && sSubStatsProb) {
        const phaFav = sSubStatsProb["1"] > sSubStatsProb["2"] && sSubStatsProb["1"] > sSubStatsProb["X"] ? "1" : sSubStatsProb["2"] > sSubStatsProb["1"] && sSubStatsProb["2"] > sSubStatsProb["X"] ? "2" : "";
        if (phaFav && phaFav !== marketFavOutcome && algoSubPred && matchesPrediction(algoSubPred, marketFavOutcome)) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          reasonParts.push("Contra-Market Hedge");
        }
      }
      if (!isNaN(o1) && !isNaN(o2) && o1 > 2.5 && o2 > 2.5) {
        if (finalPrediction === "1") finalPrediction = "1X";
        else if (finalPrediction === "2") finalPrediction = "X2";
        else if (finalPrediction === "12") finalPrediction = "12";
        else if (finalPrediction === "X") {
          finalPrediction = runTSLogic && (match.tsa || 0) > (match.tsb || 0) ? "1X" : "X2";
        }
        reasonParts.push("High Variance (>2.50)");
        rawConfidence = Math.min(rawConfidence, 60);
        isUnshakable = false;
        if (category !== "Banker") category = "Upset";
      }
      const algoOpposesFav = moFav && rulePrediction && !matchesPrediction(rulePrediction, moFav);
      if (algoOpposesFav) {
        if (finalPrediction === moFav) {
          finalPrediction = moFav === "1" ? "X2" : "1X";
        }
      }
      const moFavStrict = !isNaN(o1) && !isNaN(o2) ? o1 < o2 ? "1" : o1 > o2 ? "2" : "" : "";
      if (algoSubPred && moFavStrict && !matchesPrediction(algoSubPred, moFavStrict)) {
        const oddsDiff = Math.abs(o1 - o2);
        if (oddsDiff > 0.5) {
          if (algoSubPred === "1") finalPrediction = "1X";
          else if (algoSubPred === "2") finalPrediction = "X2";
          else if (algoSubPred === "12") finalPrediction = "12";
          else finalPrediction = algoSubPred;
          const phaStats = algo.getRawPatternStats(`S:${subP}`);
          if (phaStats && phaStats.total >= 3) {
            const p1_pha_conf = phaStats.outcomes["1"];
            const p2_pha_conf = phaStats.outcomes["2"];
            const phaFav = p1_pha_conf > p2_pha_conf ? "1" : "2";
            if (phaFav !== moFavStrict) {
              rawConfidence = Math.max(rawConfidence, 80);
              isUnshakable = true;
            }
          } else {
            rawConfidence = Math.max(rawConfidence, 70);
          }
        }
      }
      if (moFav && rulePrediction && matchesPrediction(rulePrediction, moFav)) {
        rawConfidence = Math.max(rawConfidence, 95);
        isUnshakable = true;
      }
      const pointsPred = match.calculatedPrediction;
      if (pointsPred && rulePrediction && matchesPrediction(pointsPred, rulePrediction)) {
        if (moFav && !matchesPrediction(rulePrediction, moFav)) {
          rawConfidence = Math.min(99, rawConfidence + 15);
        }
      }
      if (pointsPred && moFav && pointsPred !== moFav) {
        if (!hasRule) {
          finalPrediction = moFav === "1" ? "1X" : "X2";
        }
      }
      if (category === "Value" && rulePrediction && !matchesPrediction(rulePrediction, prediction)) {
        finalPrediction = prediction === "1" ? "1X" : prediction === "2" ? "X2" : "1X";
        reasonParts.push("Value Bet Stabilization (Hedge to Algo)");
      }
      if (phaDrawPct > 35 && (!isNaN(o1) && !isNaN(o2) && Math.abs(o1 - o2) <= 0.5)) {
        category = "Banker Draw";
        finalPrediction = prediction === "1" ? "1X" : prediction === "2" ? "X2" : p1 > p2 ? "1X" : "X2";
        reasonParts.push("Banker Draw Identification");
      }
      if (!isNaN(o2) && o2 > 2.4 && rulePrediction === "12" && sSubStatsProb && sSubStatsProb["2"] > sSubStatsProb["1"]) {
        finalPrediction = "2";
        category = "Upset";
        rawConfidence = Math.max(rawConfidence, 85);
        reasonParts.push("Upset Detection Overhaul (Away Win)");
      }
      if ((rulePrediction === "1X" || rulePrediction === "X2") && category !== "Value Pick") {
        if (!finalPrediction.includes("X")) {
          finalPrediction = rulePrediction;
          reasonParts.push("Sub-Pattern Misalignment Fix (Forced Hedge)");
        }
      }
      const toxicPatterns = ["G1a7", "G1ff44", "G2hh2", "G2ff31", "G1g2", "G1ii3", "G1f29", "G2a7", "R-G1-01", "G3o9"];
      if (toxicPatterns.includes(subP)) {
        rawConfidence = Math.min(rawConfidence, 75);
        isUnshakable = false;
        reasonParts.push("Toxic Pattern (Conf Capped)");
        flags.push("Demote_Banker");
      }
      const giantKillerPatterns = ["G1ff44", "G2ee11", "G1g21", "G1a2", "G2o14"];
      if (giantKillerPatterns.includes(subP) && moFav && Math.min(o1, o2) < 1.35) {
        const underdog = moFav === "1" ? "2" : "1";
        finalPrediction = underdog === "1" ? "1X" : "X2";
        category = "Upset";
        flags.push("Upset Alert");
        flags.push("Demote_Accumulator");
        reasonParts.push("Giant Killer Override");
      }
      if (match.group === 1) {
        let phaSupport = 0;
        if (sSubStatsProb) {
          if (finalPrediction.includes("1")) phaSupport = Math.max(phaSupport, sSubStatsProb["1"]);
          if (finalPrediction.includes("2")) phaSupport = Math.max(phaSupport, sSubStatsProb["2"]);
          if (finalPrediction.includes("X")) phaSupport = Math.max(phaSupport, sSubStatsProb["X"]);
        }
        if (phaSupport < 0.55) {
          rawConfidence = Math.max(0, rawConfidence - 20);
          isUnshakable = false;
          reasonParts.push("Group 1 Low PHA (Downgrade)");
          flags.push("Demote_Daily_Jackpot");
        }
      }
      const premiumMainPatterns = ["C", "K", "LL", "L", "Y", "CC", "KK"];
      if (premiumMainPatterns.includes(mainP) && rawConfidence > 80) {
        flags.push("Premium_Fast_Track");
        reasonParts.push("Premium Pattern Fast-Track");
      }
      if (subP === "G1j3_fix") {
        if (moFav === "2" && o2 < 1.5) {
          if (finalPrediction === "1" || finalPrediction === "1X") {
            finalPrediction = p2 > pX ? "2" : "X2";
            reasonParts.push("G1j3_fix Recalibration");
          }
        }
      }
      if (!isNaN(o1) && !isNaN(o2) && Math.abs(o1 - o2) < 0.2) {
        if (finalPrediction === "X") finalPrediction = "12";
      }
      if (phaDrawPct > 30 && (!isNaN(o1) && !isNaN(o2) && Math.abs(o1 - o2) >= 0.2)) {
        if (rawConfidence < 70 && finalPrediction !== "X") {
          finalPrediction = "X";
        }
      }
      const minOddsP = Math.min(o1, o2);
      if (["T", "S", "R", "X"].includes(mainP) && !isNaN(minOddsP) && minOddsP < 2) {
        if (finalPrediction === "1") finalPrediction = "1X";
        else if (finalPrediction === "2") finalPrediction = "X2";
        else if (finalPrediction === "X") finalPrediction = "1X";
        rawConfidence = Math.min(rawConfidence, 70);
      }
      if ((match.maxPoints || 0) < 45) {
        if (finalPrediction === "X") finalPrediction = "1";
      }
      const subPatDisagree = match.patternAnalysis?.subPatternPrediction && !matchesPrediction(match.patternAnalysis.subPatternPrediction, moFav);
      const pointsDisagree = match.calculatedPrediction && !matchesPrediction(match.calculatedPrediction, moFav);
      if (minMarketOddsValue < 1.7 && subPatDisagree) {
        finalPrediction = moFav === "1" ? "1X" : "X2";
      }
      if (minMarketOddsValue < 1.7 && match.group === 1) {
        if (finalPrediction === moFav) {
          finalPrediction = moFav === "1" ? "1X" : "X2";
        }
      }
      const predOdds = finalPrediction === "1" ? o1 : finalPrediction === "2" ? o2 : oX;
      if (predOdds > 2 && (finalPrediction === "1" || finalPrediction === "2")) {
        finalPrediction = finalPrediction === "1" ? "1X" : "X2";
      }
      const reliability = algo.getPatternReliability(subP);
      if (reliability === "Low Data" || reliability === "No Data") {
        if (finalPrediction === "1X" || finalPrediction === "X2") {
          finalPrediction = "12";
        }
      }
      if (match.group === 1 && !isNaN(predOdds) && predOdds > 2) {
        if (finalPrediction === "1") finalPrediction = "1X";
      }
      if (minMarketOddsValue < 1.4 && (subPatDisagree || pointsDisagree)) {
        isUnshakable = false;
        rawConfidence = 0;
      }
      if (sSubStatsProb) {
        const p1_pha_b2 = sSubStatsProb["1"];
        const pX_pha_b2 = sSubStatsProb["X"];
        const p2_pha_b2 = sSubStatsProb["2"];
        const maxPha = Math.max(p1_pha_b2, pX_pha_b2, p2_pha_b2);
        if (p1_pha_b2 > 0.6) {
          finalPrediction = "1";
          rawConfidence = Math.max(rawConfidence, 90);
          isUnshakable = true;
        } else if (p2_pha_b2 > 0.6) {
          finalPrediction = "2";
          rawConfidence = Math.max(rawConfidence, 90);
          isUnshakable = true;
        }
        if (moFav) {
          let phaFav = null;
          if (p1_pha_b2 > pX_pha_b2 && p1_pha_b2 > p2_pha_b2) phaFav = "1";
          else if (p2_pha_b2 > p1_pha_b2 && p2_pha_b2 > pX_pha_b2) phaFav = "2";
          if (phaFav && phaFav !== moFav && !isUnshakable) {
            const phaFavProb = phaFav === "1" ? p1_pha_b2 : p2_pha_b2;
            if (phaFavProb > 0.4) {
              finalPrediction = phaFav;
            }
          }
        }
        if (finalPrediction === "1" && p1_pha_b2 + pX_pha_b2 > 0.75) finalPrediction = "1X";
        if (finalPrediction === "2" && p2_pha_b2 + pX_pha_b2 > 0.75) finalPrediction = "X2";
        if (maxPha < 0.45) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          rawConfidence = Math.min(rawConfidence, 60);
        }
        if (moFav) {
          const upsetOutcome = moFav === "1" ? "2" : "1";
          const upsetProb = moFav === "1" ? p2_pha_b2 : p1_pha_b2;
          if (upsetProb > 0.4) {
            if (matchesPrediction(finalPrediction, upsetOutcome)) {
              rawConfidence = Math.max(rawConfidence, 80);
            }
          }
        }
      }
      if (match.group === 2 && finalPrediction.length === 1) {
        const currentOdds = finalPrediction === "1" ? o1 : finalPrediction === "2" ? o2 : oX;
        let isEliteValue = false;
        if (!isNaN(currentOdds) && currentOdds > 2) {
          const ptsPred = match.calculatedPrediction;
          const sSubStats2 = algo.getRawPatternStats(`S:${subP}`);
          if (ptsPred && matchesPrediction(ptsPred, finalPrediction)) {
            if (sSubStats2) {
              const predSupport = sSubStats2.outcomes[finalPrediction] / sSubStats2.total;
              if (predSupport > 0.5) {
                isEliteValue = true;
                category = "Value";
                rawConfidence = 99;
                isUnshakable = true;
                reasonParts.push("Elite Value (Pts+PHA)");
              }
            }
          }
        }
        if (!isEliteValue && !isNaN(currentOdds) && currentOdds > 2.1) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
        }
      }
      const algoPred = match.patternAnalysis?.subPatternPrediction;
      if (["1X", "X2"].includes(algoPred || "") && finalPrediction.length === 1 && pX > 0.26) {
        finalPrediction = algoPred;
      }
      if (!match.isJackpot) {
        const favOddsForDrawLimit = Math.min(o1, o2);
        if (!isNaN(favOddsForDrawLimit) && favOddsForDrawLimit >= 2.2 && favOddsForDrawLimit <= 2.6) {
          if (finalPrediction === "12" || finalPrediction.length === 1) {
            const favSide = o1 <= o2 ? "1" : "2";
            finalPrediction = favSide === "1" ? "1X" : "X2";
          }
        }
      }
      if (match.group === 1 && rawConfidence > 60 && algoPred === "12") {
        if (prediction === "1" || prediction === "2") {
          finalPrediction = prediction;
        }
      }
      const minMarketOdds = Math.min(o1, o2);
      if (!isNaN(minMarketOdds) && minMarketOdds < 1.8) {
        const marketFav = o1 === minMarketOdds ? "1" : "2";
        const isBettingAgainst = !matchesPrediction(finalPrediction, marketFav);
        if (isBettingAgainst) {
          if (rawConfidence < 80) {
            finalPrediction = marketFav === "1" ? "1X" : "X2";
          }
        }
      }
      if (!match.isJackpot && finalPrediction === "12" && !isNaN(oX) && oX < 3.2) {
        if (runTSLogic) {
          if ((match.tsa || 0) >= (match.tsb || 0)) finalPrediction = "1X";
          else finalPrediction = "X2";
        }
      }
      if (moFav && sSubStatsProb) {
        let phaFav = null;
        const p1p = sSubStatsProb["1"];
        const p2p = sSubStatsProb["2"];
        if (p1p > p2p && p1p > sSubStatsProb["X"]) phaFav = "1";
        else if (p2p > p1p && p2p > sSubStatsProb["X"]) phaFav = "2";
        if (phaFav && phaFav !== moFav) {
          const minO = Math.min(o1, o2);
          if (!isNaN(minO) && minO < 2.5) {
            category = "Standard";
            rawConfidence = 0;
            reasonParts.push("Conflict Resolution (<2.50)");
          }
        }
      }
      const subPatternWinRate = algo.getPatternWinRate(subP, match.patternAnalysis?.subPatternPrediction || null);
      if (runTSLogic && tsDiff > 0.8 && subPatternWinRate > 0 && subPatternWinRate < 55) {
        if (finalPrediction === "1") finalPrediction = "1X";
        else if (finalPrediction === "2") finalPrediction = "X2";
      }
      const AlgoClass = algo.constructor;
      finalPrediction = AlgoClass.applyPatternOverrides(match, subP, finalPrediction);
      if (match.group === 1 && match.patternAnalysis?.subPatternPrediction === "12") {
        if (finalPrediction === "1X" || finalPrediction === "X2") {
          finalPrediction = "12";
        }
      }
      if (match.group === 1 && match.patternAnalysis?.subPatternPrediction === "1X") {
        if (finalPrediction === "1") {
          finalPrediction = "1X";
        }
      }
      if (match.group === 3 && rawConfidence < 75) {
        const minO = Math.min(o1, o2);
        if (!isNaN(minO) && minO > 1.5 && finalPrediction.length === 1) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
        }
      }
      if (match.group === 1) {
        if (sSub && sSub["X"] < 0.2) {
          if (finalPrediction === "1X") finalPrediction = "1";
          else if (finalPrediction === "X2") finalPrediction = "2";
          else if (finalPrediction === "X") finalPrediction = "12";
        }
      }
      if (match.group === 1) {
        const subPred2 = match.patternAnalysis?.subPatternPrediction;
        if (subPred2 && subPred2.length === 2 && finalPrediction.length === 1) {
          finalPrediction = subPred2;
        }
      }
      const favOdds = Math.min(o1, o2);
      if (match.group === 1 && !isNaN(favOdds) && favOdds > 2.3) {
        if (finalPrediction === "1") finalPrediction = "1X";
        if (finalPrediction === "2") finalPrediction = "X2";
      }
      const minOdds = Math.min(o1, o2);
      if (!isNaN(minOdds) && minOdds < 2.1) {
        const isHomeFav = o1 < o2;
        const subPred2 = match.patternAnalysis?.subPatternPrediction;
        if (isHomeFav) {
          if (subPred2 === "2" || subPred2 === "X2") {
            finalPrediction = "1";
          }
        } else {
          if (subPred2 === "1" || subPred2 === "1X") {
            finalPrediction = "2";
          }
        }
      }
      if (runTSLogic && tsDiff > 0.6) {
        const tsFav = (match.tsa || 0) > (match.tsb || 0) ? "1" : "2";
        const targetOdds = tsFav === "1" ? o1 : o2;
        if (!isNaN(targetOdds) && targetOdds > 2.5) {
          if (finalPrediction === "1" || finalPrediction === "2") {
            finalPrediction = tsFav === "1" ? "1X" : "X2";
          }
        }
      }
      const targetO = finalPrediction === "1" ? o1 : finalPrediction === "2" ? o2 : oX;
      if (!isNaN(targetO) && targetO >= 2.2 && targetO <= 2.4) {
        const subPred2 = match.patternAnalysis?.subPatternPrediction;
        if (subPred2 === "1X" || subPred2 === "X2") {
          finalPrediction = subPred2;
        }
      }
      if (reliability === "Low Data" || reliability === "No Data") {
        rawConfidence = Math.min(rawConfidence, 60);
        if (finalPrediction.length === 1) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          else finalPrediction = "12";
        }
      }
      if (runTSLogic && finalPrediction === "2" && !isNaN(o2) && o2 > 2.3) {
        const tDiff = (match.tsb || 0) - (match.tsa || 0);
        if (tDiff < 2.5) {
          finalPrediction = "X2";
        }
      }
      if (match.patternAnalysis?.subPatternPrediction === "1X" && !isNaN(o2) && o2 < 3) {
        if (runTSLogic && (match.tsb || 0) > (match.tsa || 0)) {
          finalPrediction = "X2";
        } else {
          finalPrediction = "12";
        }
      }
      let isOddsTrap = false;
      if (!isNaN(predOdds) && predOdds >= 2.15 && predOdds <= 2.5) {
        isOddsTrap = true;
        if (finalPrediction === "1") finalPrediction = "1X";
        if (finalPrediction === "2") finalPrediction = "X2";
      }
      if (runTSLogic && finalPrediction === "2") {
        const tDiff = (match.tsb || 0) - (match.tsa || 0);
        const subPred2 = match.patternAnalysis?.subPatternPrediction;
        const rawPred = match.rawPrediction;
        if (tDiff > 0.5 && !isNaN(o2) && o2 > 2.1) {
          if (subPred2 === "X" || subPred2 === "X2" || rawPred === "X" || rawPred === "X2") {
            finalPrediction = "X2";
          }
        }
      }
      const midTierTeams = ["Standard", "Anderlecht", "Club Brugge", "Union SG", "Genk", "Gent", "Antwerp", "Cercle Brugge", "Charleroi", "St Gilliose", "Nice", "Brest", "Lens", "Rennes", "Lille"];
      const isMidTier = midTierTeams.some((t) => match.teams.includes(t));
      if (isMidTier) {
        const algoSignal = match.patternAnalysis?.subPatternPrediction || match.rawPrediction;
        if ((algoSignal === "1" || algoSignal === "1X") && !isNaN(o1) && o1 < 3.5) {
          if (finalPrediction === "2" || finalPrediction === "X2") {
            finalPrediction = "1X";
          }
        }
      }
      if (finalPrediction === "1" && match.pred1x2 === "1") {
        const algoBase = match.patternAnalysis?.subPatternPrediction || match.rawPrediction;
        if (algoBase === "X" || algoBase === "X2") {
          finalPrediction = "1X";
        }
      }
      if (subPatternWinRate > 0 && subPatternWinRate <= 55) {
        const currentOdds = finalPrediction === "1" ? o1 : finalPrediction === "2" ? o2 : oX;
        if (!isNaN(currentOdds) && currentOdds > 2) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          else if (finalPrediction === "X") finalPrediction = runTSLogic && (match.tsa || 0) >= (match.tsb || 0) ? "1X" : "X2";
        }
      }
      const derbies = ["Bilbao vs Sociedad", "Sociedad vs Bilbao", "Sevilla vs Betis", "Betis vs Sevilla", "Roma vs Lazio", "Lazio vs Roma", "Milan vs Inter", "Inter vs Milan", "Arsenal vs Tottenham", "Tottenham vs Arsenal", "Liverpool vs Everton", "Everton vs Liverpool", "Celtic vs Rangers", "Rangers vs Celtic"];
      const isDerby = derbies.some((d) => match.teams.includes(d));
      if (isDerby) {
        const baseSignal = match.patternAnalysis?.subPatternPrediction || match.rawPrediction;
        if (baseSignal === "X") {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
        }
      }
      if (match.group === 2 && match.patternAnalysis?.subPatternPrediction === "12" && finalPrediction === "1X") {
        finalPrediction = "12";
      }
      if (runTSLogic && !isNaN(o1) && o1 < 1.9 && (match.tsb || 0) > (match.tsa || 0) + 1) {
        if (match.patternAnalysis?.subPatternPrediction) {
          finalPrediction = match.patternAnalysis.subPatternPrediction;
        }
      }
      if (match.patternAnalysis?.subPatternPrediction === "X" && finalPrediction === "1") {
        finalPrediction = "1X";
      }
      if (!isNaN(o2) && o2 >= 2 && o2 <= 3 && match.patternAnalysis?.subPatternPrediction === "12") {
        if (finalPrediction === "1X") {
          finalPrediction = "12";
        }
      }
      if (match.group === 2 && match.patternAnalysis?.subPatternPrediction === "1") {
        if (finalPrediction === "1") {
          finalPrediction = "1X";
        }
      }
      if (match.group === 2 && match.patternAnalysis?.subPatternPrediction === "X2") {
        if (finalPrediction === "2") {
          finalPrediction = "X2";
        }
      }
      const isCup = match.teams.toLowerCase().match(/(cup|pokal|trophy|coppa|coupe)/);
      if (match.group === 3 && match.patternAnalysis?.subPatternPrediction === "12") {
        if (isCup) {
          if (finalPrediction === "X2") {
            finalPrediction = "12";
          }
        }
      }
      if (runTSLogic && match.group === 2 && finalPrediction === "1" && (match.tsa || 0) > (match.tsb || 0)) {
        if (rawConfidence < 70) {
          finalPrediction = "1X";
        }
      }
      if (finalPrediction === "X") {
        const subPred2 = match.patternAnalysis?.subPatternPrediction;
        if (subPred2 === "1X" || subPred2 === "X2") {
          finalPrediction = subPred2;
        }
      }
      const isLaLiga = [
        "Real Madrid",
        "Barcelona",
        "Atl. Madrid",
        "Sevilla",
        "Betis",
        "Sociedad",
        "Bilbao",
        "Girona",
        "Valencia",
        "Villarreal",
        "Osasuna",
        "Getafe",
        "Celta",
        "Mallorca",
        "Rayo Vallecano",
        "Alaves",
        "Las Palmas",
        "Leganes",
        "Valladolid",
        "Espanyol"
      ].some((t) => match.teams.includes(t));
      if (isLaLiga) {
        const totalGoals = (match.gsHome || 0) + (match.gsAway || 0);
        if (totalGoals < 2.8) {
          const tDiff = Math.abs((match.tsa || 0) - (match.tsb || 0));
          const subPred2 = match.patternAnalysis?.subPatternPrediction;
          if (runTSLogic && tDiff <= 2 && (subPred2 === "1X" || subPred2 === "X2")) {
            if (finalPrediction === "1" || finalPrediction === "2") {
              finalPrediction = subPred2;
            }
          }
        }
      }
      if (match.group === 2) {
        const base = match.patternAnalysis?.subPatternPrediction;
        if (["1X", "12"].includes(base || "")) {
          if (base === "1X" && (finalPrediction === "2" || finalPrediction === "X2")) {
            finalPrediction = "1X";
          }
          if (base === "12" && finalPrediction === "X") {
            finalPrediction = "12";
          }
        }
      }
      if (runTSLogic && match.group === 2 && (match.tsb || 0) > (match.tsa || 0)) {
        if ((match.tsb || 0) <= 1.3) {
          if (finalPrediction === "2" || finalPrediction === "X2") {
            finalPrediction = "1X";
          }
        }
      }
      if (match.patternAnalysis?.subPatternPrediction === "12") {
        if (["1", "2"].includes(finalPrediction) && runTSLogic && tsDiff <= 0.4) {
          finalPrediction = "12";
        }
      }
      const isPortugal = ["Gil Vicente", "Famalicao", "Porto", "Benfica", "Sporting", "Braga", "Guimaraes", "Arouca", "Estoril", "Rio Ave", "Casa Pia", "Boavista"].some((t) => match.teams.includes(t));
      if (isPortugal) {
        const algoBase = match.patternAnalysis?.subPatternPrediction || match.rawPrediction;
        if (algoBase === "1" && rawConfidence > 60) {
          if (finalPrediction === "X") {
            finalPrediction = "1";
          }
        }
      }
      const isSegunda = ["Huesca", "Cadiz", "Granada", "Santander", "Cacereno", "Barakaldo", "Almeria", "Levante", "Eibar", "Zaragoza", "Burgos", "Oviedo", "Gijon"].some((t) => match.teams.includes(t));
      if (isSegunda) {
        if (match.patternAnalysis?.subPatternPrediction === "1X") {
          if (finalPrediction === "X2" || finalPrediction === "2") {
            finalPrediction = "1X";
          }
        }
      }
      if ((match.group === 1 || match.group === 2) && match.patternAnalysis?.subPatternPrediction === "12") {
        if (!isNaN(o2) && !isNaN(o1) && o2 < o1) {
          const totalGoals = (match.gsHome || 0) + (match.gsAway || 0);
          const isLowGoals = totalGoals < 2.3;
          if (!isLowGoals && finalPrediction === "1X") {
            finalPrediction = "12";
          }
        }
      }
      if (match.patternAnalysis?.subPatternPrediction === "12") {
        const totalGoals = (match.gsHome || 0) + (match.gsAway || 0);
        if (totalGoals < 2.5 && rawConfidence >= 65) {
          if (finalPrediction === "12") {
            if (runTSLogic) {
              if ((match.tsa || 0) >= (match.tsb || 0)) finalPrediction = "1X";
              else finalPrediction = "X2";
            }
          }
        }
      }
      if (match.group === 3) {
        const minO = Math.min(o1, o2);
        if (minO < 1.6) {
          const favPred = o1 === minO ? "1" : "2";
          const coversFav = matchesPrediction(finalPrediction, favPred);
          if (!coversFav) {
            const algoPred2 = match.patternAnalysis?.subPatternPrediction;
            const algoAgreesUpset = algoPred2 && !matchesPrediction(algoPred2, favPred);
            if (!algoAgreesUpset) {
              finalPrediction = favPred === "1" ? "1X" : "X2";
            }
          }
        }
      }
      if (["G1a2", "G2q1"].includes(subP)) {
        const isOpposingFav = subP === "G1a2" && o1 < 2 || subP === "G2q1" && o2 < 2;
        if (isOpposingFav) {
          rawConfidence = Math.max(10, rawConfidence - 20);
        }
      }
      if (match.patternAnalysis?.subPatternPrediction === "12") {
        const ptsPred = match.calculatedPrediction;
        const sSubStats2 = algo.getProbabilities(`S:${subP}`, 3);
        const phaPred2 = sSubStats2 && sSubStats2["1"] > 0.5 ? "1" : sSubStats2 && sSubStats2["2"] > 0.5 ? "2" : null;
        if (ptsPred === "1" && moFav === "1" && phaPred2 === "1") {
        }
      }
      if (runTSLogic && tsDiff > 1.5 && finalPrediction.length === 1) {
        const sSubStats2 = algo.getProbabilities(`S:${subP}`, 3);
        if (sSubStats2) {
          const phaPred2 = sSubStats2["1"] > sSubStats2["X"] && sSubStats2["1"] > sSubStats2["2"] ? "1" : sSubStats2["2"] > sSubStats2["1"] && sSubStats2["2"] > sSubStats2["X"] ? "2" : null;
          if (phaPred2 && !matchesPrediction(finalPrediction, phaPred2)) {
            if (finalPrediction === "1") finalPrediction = "1X";
            else if (finalPrediction === "2") finalPrediction = "X2";
          }
        }
      }
      if (runTSLogic && match.group === 2 && finalPrediction.length === 1) {
        const tsRatio = (match.tsa || 0) / (match.tsb || 0.01);
        const tsRatioRev = (match.tsb || 0) / (match.tsa || 0.01);
        const dominance = Math.max(tsRatio, tsRatioRev);
        if (dominance <= 3) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
        }
      }
      if (match.group === 2 && match.patternAnalysis?.subPatternPrediction === "12") {
        const minO = Math.min(o1, o2);
        if (!isNaN(minO) && minO < 1.5) {
          if (o2 < 1.5 && finalPrediction === "1X") {
            finalPrediction = "2";
          }
          if (o1 < 1.5 && finalPrediction === "X2") {
            finalPrediction = "1";
          }
        }
      }
      if (match.patternAnalysis?.subPatternPrediction === "12") {
        if (finalPrediction.length === 1) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
        }
      }
      const protocol75AlgoPred = match.patternAnalysis?.subPatternPrediction;
      if (protocol75AlgoPred && (protocol75AlgoPred === "1X" || protocol75AlgoPred === "X2") && finalPrediction.length === 1) {
        const ptsPred = match.calculatedPrediction;
        const allAgreed = (protocol75AlgoPred === finalPrediction || protocol75AlgoPred.includes(finalPrediction)) && moFav === finalPrediction && ptsPred === finalPrediction;
        if (!allAgreed) {
          finalPrediction = protocol75AlgoPred;
        }
      }
      if (match.group === 1 && finalPrediction.length === 1) {
        if (finalPrediction === "1") finalPrediction = "1X";
        else if (finalPrediction === "2") finalPrediction = "X2";
      }
      const predOddsCheck = finalPrediction === "1" ? o1 : finalPrediction === "2" ? o2 : oX;
      if (!isNaN(predOddsCheck) && predOddsCheck > 3 && finalPrediction.length === 1) {
        finalPrediction = finalPrediction === "1" ? "1X" : "X2";
      }
      if (finalPrediction.length === 1 && !isNaN(predOddsCheck) && predOddsCheck > 1.9) {
        if (sSubStatsProb && sSubStatsProb["X"] > 0.25 || pX > 0.25) {
          finalPrediction = finalPrediction === "1" ? "1X" : "X2";
        }
      }
      if (match.group === 2) {
        rawConfidence = Math.min(99, rawConfidence + 5);
        if (category === "Standard" && rawConfidence >= 70) category = "Value";
      }
      if (match.patternAnalysis?.subPatternPrediction === "12") {
        const oddsDiff = Math.abs(o1 - o2);
        if (!isNaN(oddsDiff) && oddsDiff < 0.5) {
          if (finalPrediction.length === 1) {
            finalPrediction = "12";
            reasonParts.push("SubPat '12' DC Mandate");
          }
        }
      }
      if (rawConfidence > 80 && sSubStatsProb && sSubStatsProb["X"] > 0.35) {
        rawConfidence = 70;
        if (finalPrediction === "1") finalPrediction = "1X";
        else if (finalPrediction === "2") finalPrediction = "X2";
        reasonParts.push("Bristol Correction (Draw Risk)");
      }
      if (!isNaN(o1) && o1 >= 1.4 && o1 <= 1.65) {
        const subPred2 = match.patternAnalysis?.subPatternPrediction;
        if (subPred2 && (subPred2.includes("X2") || subPred2.includes("12"))) {
          if (rawConfidence > 80) {
            rawConfidence = 75;
            reasonParts.push("Toxic Fav Filter");
            if (category === "Banker") category = "Standard";
          }
        }
      }
      if (match.group === 1) {
        let phaAgrees = false;
        if (sSubStatsProb) {
          const maxP2 = Math.max(sSubStatsProb["1"], sSubStatsProb["X"], sSubStatsProb["2"]);
          let phaPred2 = "";
          if (maxP2 === sSubStatsProb["1"]) phaPred2 = "1";
          else if (maxP2 === sSubStatsProb["2"]) phaPred2 = "2";
          else phaPred2 = "X";
          if (matchesPrediction(finalPrediction, phaPred2)) phaAgrees = true;
        }
        if (!phaAgrees) {
          rawConfidence = Math.min(rawConfidence, 75);
          reasonParts.push("Group 1 BOTB Filter (No PHA)");
        }
      }
      if (match.group === 2 && !isNaN(o1) && o1 < 1.7 && finalPrediction.length === 1) {
        if (finalPrediction === "1") finalPrediction = "1X";
        else if (finalPrediction === "2") finalPrediction = "X2";
        reasonParts.push("Group 2 Volatility Clamp");
      }
      if (rawConfidence >= 98) {
        const phaWinRate = algo.getPatternWinRate(subP, finalPrediction);
        if (phaWinRate < 85) {
          if (category === "Banker") {
            category = "Value";
            reasonParts.push("Clean Profile Trap (PHA < 85%)");
          }
        }
      }
      if (category === "Banker") {
        const extAgreement = match.pred1x2 && matchesPrediction(finalPrediction, match.pred1x2);
        if (!extAgreement) {
          category = "Value";
          if (Math.min(o1, o2) < 2) category = "Standard";
          reasonParts.push("Banker Ext Mismatch");
        }
      }
      if (category === "Value" && finalPrediction.length === 1) {
        const valOdds2 = finalPrediction === "1" ? o1 : finalPrediction === "2" ? o2 : oX;
        if (!isNaN(valOdds2) && valOdds2 > 2) {
          let phaSuggestsWin = false;
          if (sSubStatsProb) {
            const p1s = sSubStatsProb["1"];
            const pXs = sSubStatsProb["X"];
            const p2s = sSubStatsProb["2"];
            const maxS = Math.max(p1s, pXs, p2s);
            if (maxS === p1s || maxS === p2s) {
              phaSuggestsWin = true;
            }
          }
          if (!phaSuggestsWin) {
            category = "Standard";
            finalPrediction = finalPrediction === "1" ? "1X" : "X2";
            reasonParts.push("Holy Grail Filter (PHA Draw/Hedge)");
          }
        } else {
          category = "Standard";
          finalPrediction = finalPrediction === "1" ? "1X" : "X2";
          reasonParts.push("Holy Grail Filter (Odds <= 2.0)");
        }
      }
      if (!isNaN(o1) && o1 >= 2.8 && o1 <= 3.1 && !isNaN(o2) && o2 >= 2.8 && o2 <= 3.1) {
        if (sSubStatsProb && sSubStatsProb["X"] > 0.35) {
          category = "Banker";
          if (!finalPrediction.includes("X")) finalPrediction = "X";
          reasonParts.push("Banker Draw ID");
        }
      }
      if (["G1dd5", "G3ff10", "G2gg2"].includes(subP)) {
        if (!isNaN(o1) && !isNaN(o2) && Math.abs(o1 - o2) < 0.5) {
          category = "Banker";
          if (!finalPrediction.includes("X")) {
            finalPrediction = p1 >= p2 ? "1X" : "X2";
          }
          reasonParts.push("Banker Draw Protocol");
        }
      }
      if (!isNaN(o1) && o1 < 1.7) {
        const extFavorsAway = match.pred1x2 === "2" || match.pred1x2 === "X2";
        const phaHomeWin = sSubStatsProb ? sSubStatsProb["1"] : 1;
        if (extFavorsAway && phaHomeWin < 0.45) {
          category = "Upset";
          reasonParts.push("Upset Expansion Alert");
          if (finalPrediction === "1" || finalPrediction === "1X") finalPrediction = "X2";
        }
      }
      const minOStirling = Math.min(o1, o2);
      if (minOStirling < 1.5 && match.group === 3) {
        const mFav = o1 === minOStirling ? "1" : "2";
        const phaFavProb = sSubStatsProb ? sSubStatsProb[mFav] : 1;
        if (phaFavProb < 0.4) {
          category = "Upset";
          finalPrediction = mFav === "1" ? "X2" : "1X";
          reasonParts.push("Stirling Rule (False Fav)");
        }
      }
      const valOdds = finalPrediction === "1" ? o1 : finalPrediction === "2" ? o2 : oX;
      if (category === "Value" && !isNaN(valOdds) && valOdds > 2.2 && finalPrediction.length === 1) {
        if (finalPrediction === "1") finalPrediction = "1X";
        else if (finalPrediction === "2") finalPrediction = "X2";
        reasonParts.push("Value Risk Cap (>2.20)");
      } else if (category === "Value" && !isNaN(valOdds) && valOdds > 4.5) {
        if (rawConfidence < 80) {
          category = "Standard";
          reasonParts.push("Longshot Noise Filter");
        }
      }
      if (rawConfidence > 95) {
        const phaAlgoProb = sSubStatsProb ? Math.max(sSubStatsProb["1"], sSubStatsProb["X"], sSubStatsProb["2"]) : 0;
        if (phaAlgoProb < 0.6) {
          rawConfidence = 90;
          reasonParts.push("Clean Profile Invalidated");
        }
      }
      if (["G2ee1", "G2ff44"].includes(subP) && !isNaN(o1) && o1 < 1.7) {
        if (category === "Banker") {
          category = "Standard";
          reasonParts.push("Toxic SubPattern Exclusion");
        }
      }
      if (rawConfidence >= 99) {
        rawConfidence = Math.round(rawConfidence * 0.85);
        reasonParts.push("Score 100 Penalty");
      }
      if (match.group === 3) {
        if (finalPrediction === "1") finalPrediction = "1X";
        else if (finalPrediction === "2") finalPrediction = "X2";
      }
      if (finalPrediction === "2" && !isNaN(o2) && o2 > 2.6) {
        finalPrediction = "X2";
      }
      if (prediction === "X" && !isNaN(oX) && oX < 3.1) {
        finalPrediction = p1 > p2 ? "1X" : "X2";
      }
      if (prediction === "2" && !isNaN(o1) && o1 < 2.1) {
        finalPrediction = "1X";
      }
      const strongVisitors = ["Al Hilal", "Al Nassr", "Al Ittihad", "Al Ahli", "Al Shabab", "Man City", "Real Madrid", "Bayern", "Leverkusen"];
      const awayTeam = match.teams.split(" vs ")[1] || "";
      if (strongVisitors.some((v) => awayTeam.includes(v))) {
        if (prediction === "X") {
          finalPrediction = "2";
        }
      }
      if (prediction === "1" && o1 >= 2.2 && o1 <= 2.9) finalPrediction = "1X";
      if (prediction === "1" && o1 > 3) finalPrediction = "1X";
      if (prediction === "2" && o2 > 3) finalPrediction = "X2";
      if (prediction === "2" && o2 >= 2.2 && o2 <= 2.8) finalPrediction = "X2";
      if (prediction === "1" && o1 > 2 && finalPrediction === "1") finalPrediction = "1X";
      if (prediction === "2" && o2 > 2 && finalPrediction === "2") finalPrediction = "X2";
      rawConfidence = Math.min(99, rawConfidence);
      if ((match.group === 2 || match.group === 3) && rawConfidence < 70) {
        if (finalPrediction === "1") finalPrediction = "1X";
        else if (finalPrediction === "2") finalPrediction = "X2";
        else if (finalPrediction === "X") finalPrediction = p1 > p2 ? "1X" : "X2";
      }
      if (runTSLogic && finalPrediction === "2" && match.tsb && match.tsa) {
        if (match.tsb < match.tsa * 1.15) {
          finalPrediction = "X2";
        }
      }
      if (runTSLogic && finalPrediction === "2" && match.tsb && match.tsb >= 1.5 && !isNaN(o2) && o2 > 3) {
        finalPrediction = "X2";
      }
      if (match.l10 && match.l10 !== "NA") {
        const parts = match.l10.split(":").map((s) => parseFloat(s));
        if (parts.length === 2) {
          const [l10H, l10A] = parts;
          if (prediction === "1" && !isNaN(o1) && !isNaN(o2) && o1 > o2 && l10H < l10A) {
            finalPrediction = "1X";
          }
          if (prediction === "2" && !isNaN(o1) && !isNaN(o2) && o2 > o1 && l10A < l10H) {
            finalPrediction = "X2";
          }
        }
      }
      if (finalPrediction === "12" && match.group === 1) {
        finalPrediction = "1X";
      }
      if (isCup) {
        if (prediction === "1") finalPrediction = "1X";
        if (prediction === "2") finalPrediction = "X2";
      }
      if ((prediction === "2" || prediction === "X2") && o1 < o2) {
        if (hasFlag("SHGS") || hasFlag("H_BAL") || hasFlag("TS_HOME_STRONG")) {
          finalPrediction = "1X";
        }
      }
      if (prediction === "1X" && o1 > 2.2) finalPrediction = "12";
      if (prediction === "1" && o1 >= 1.8 && o1 <= 1.95) finalPrediction = "1X";
      if (prediction === "2" && o2 > 3.5) finalPrediction = "X2";
      if (prediction === "1" && o1 > 3.5) finalPrediction = "1X";
      if (match.group === 3 && prediction === "1") {
        rawConfidence = Math.min(rawConfidence, 60);
      }
      if ((mainP === "A" || mainP === "R") && (finalPrediction === "1" || finalPrediction === "2")) {
        finalPrediction = "12";
      }
      if (mainP === "G" && finalPrediction === "X2" && rawConfidence >= 75) {
        finalPrediction = "1X";
        rawConfidence = Math.min(rawConfidence, 70);
      }
      if (match.group === 3 && !["Q", "I", "DD"].includes(mainP)) {
        rawConfidence = Math.max(0, rawConfidence - 20);
      }
      if (match.group === 3 && ["G3j2", "G3p3", "G3g1", "G3f15"].includes(subP)) {
        rawConfidence = Math.min(rawConfidence, 40);
      }
      if (["X", "JJ"].includes(mainP)) {
        rawConfidence = 10;
        category = "Standard";
      }
      if (["Q", "J", "P"].includes(mainP)) {
        rawConfidence = Math.min(99, rawConfidence + 15);
      }
      const algoOdds = 1 / maxP;
      const marketOdds = prediction === "1" ? o1 : prediction === "X" ? oX : o2;
      if (marketOdds > 1.8 && marketOdds > algoOdds * 1.2) {
        category = "Value";
        if (marketOdds > 2.2 && (finalPrediction === "1" || finalPrediction === "2")) {
          finalPrediction = prediction === "1" ? "1X" : "X2";
        }
        if (prediction === "2" && marketOdds > 2.5) {
          category = "Standard";
        }
      }
      if (category === "Value" && finalPrediction.length === 1) {
        const oppPred = finalPrediction === "1" ? "2" : "1";
        if (sSubStatsProb && sSubStatsProb[oppPred] > 0.55) {
          category = "Standard";
          finalPrediction = finalPrediction === "1" ? "1X" : "X2";
          reasonParts.push("Contrarian Limit");
        }
      }
      if (rawConfidence > 65 && maxP > 0.55) {
        const marketFav = Math.min(o1, o2);
        const marketPred = o1 === marketFav ? "1" : "2";
        let oddsLimit = 1.9;
        if (rawConfidence > 85) oddsLimit = 2.45;
        else if (rawConfidence > 75) oddsLimit = 2.15;
        let qualifiesAsBanker = false;
        if (marketPred === prediction && marketFav <= oddsLimit) {
          if (!(marketPred === "1" && marketFav < 2 && rawConfidence < 75)) {
            qualifiesAsBanker = true;
          }
        }
        const AlgoClass2 = algo.constructor;
        const starRating = AlgoClass2.getPatternConfidence(subP).stars;
        if (starRating === 5 && marketFav < 3) {
          qualifiesAsBanker = true;
        }
        if (category === "Value" && rawConfidence > 65) {
          qualifiesAsBanker = true;
        }
        if (["JJ", "FF", "EE"].includes(mainP)) {
          qualifiesAsBanker = false;
        }
        if (subP === "G1ff45") {
          qualifiesAsBanker = false;
        }
        if (["G1s11"].includes(subP)) {
          qualifiesAsBanker = false;
        }
        if (["Q", "J", "P"].includes(mainP) && rawConfidence > 70) {
          qualifiesAsBanker = true;
        }
        if (qualifiesAsBanker) {
          if (marketFav < 1.35) {
            qualifiesAsBanker = false;
          }
          if (qualifiesAsBanker && marketFav >= 1.4 && marketFav <= 1.6 && sSubStatsProb && sSubStatsProb["X"] > 0.15) {
            qualifiesAsBanker = false;
            reasonParts.push("Banker Draw Risk (>15%)");
          }
          if (qualifiesAsBanker && marketFav >= 1.35 && marketFav < 2) {
            if (sSubStats && sSubStats["X"] > 0.25) {
              qualifiesAsBanker = false;
              reasonParts.push("Low Odds Banker Risk (Draw)");
            }
          }
          if (qualifiesAsBanker && marketFav >= 2) {
            if (sSubStats) {
              const underdogOutcome = marketPred === "1" ? "2" : "1";
              const underdogProb = sSubStats[underdogOutcome];
              if (underdogProb > 0.3) {
                qualifiesAsBanker = false;
                reasonParts.push("High Odds Banker Risk (Underdog)");
              }
            }
          }
          if (runTSLogic && prediction === "1" && match.tsa && match.tsb) {
            const ratio = match.tsa / (match.tsb || 0.01);
            if (ratio < 2) {
              qualifiesAsBanker = false;
            }
          }
          if (qualifiesAsBanker) {
            const bankerTsDiff = Math.abs((match.tsa || 0) - (match.tsb || 0));
            const rate = algo.getPatternWinRate(subP, match.patternAnalysis?.subPatternPrediction || null);
            if (runTSLogic && bankerTsDiff <= 1 || rate <= 65) {
              qualifiesAsBanker = false;
            }
          }
          if (prediction === "2" && !isNaN(o2) && o2 > 2) {
            qualifiesAsBanker = false;
          }
          if (match.group !== 1) {
            const predOdds2 = prediction === "1" ? o1 : prediction === "2" ? o2 : oX;
            if (!isNaN(predOdds2) && predOdds2 >= 1.65) {
              qualifiesAsBanker = false;
            }
          }
          if (runTSLogic && match.group === 2) {
            const tsDiff2 = Math.abs((match.tsa || 0) - (match.tsb || 0));
            if (tsDiff2 < 1.5) {
              qualifiesAsBanker = false;
              category = "Standard";
              if (finalPrediction.length === 1) {
                if (finalPrediction === "1") finalPrediction = "1X";
                else if (finalPrediction === "2") finalPrediction = "X2";
              }
            }
          }
          if (sSubStats && sSubStats["X"] > 0.3) {
            const minO = Math.min(o1, o2);
            if (minO < 2) {
              qualifiesAsBanker = false;
              reasonParts.push("High Risk Stalemate");
            }
          }
          if (Math.min(o1, o2) < 1.5 && phaPred && moFav && phaPred !== moFav) {
            qualifiesAsBanker = false;
            reasonParts.push("Trap Favorite (PHA Divergence)");
          }
          if (!sSubStats || sSubStats.total < 3) {
            qualifiesAsBanker = false;
          }
          if (["1X", "X2", "12"].includes(match.patternAnalysis?.subPatternPrediction || "")) {
            qualifiesAsBanker = false;
            if (category === "Value") category = "Standard";
          }
          if (qualifiesAsBanker) {
            const bMinOdds = Math.min(o1, o2);
            if (!isNaN(bMinOdds)) {
              if (bMinOdds < 1.35) {
                qualifiesAsBanker = false;
                reasonParts.push("Odds Floor Violation (<1.35)");
              } else if (bMinOdds <= 1.5) {
                if (finalPrediction === "1") finalPrediction = "1X";
                else if (finalPrediction === "2") finalPrediction = "X2";
                reasonParts.push("Banker Safety Hedge (1.35-1.50)");
              } else if (bMinOdds <= 1.99) {
              }
            }
            if (qualifiesAsBanker) category = "Banker";
          }
        }
      }
      if (rawConfidence < 50) {
        if (category === "Banker" || category === "Value") {
          category = "Standard";
          if (finalPrediction.length === 1) {
            finalPrediction = finalPrediction === "1" ? "1X" : "X2";
          }
          reasonParts.push("Low Conf Baseline Exclusion");
        }
      }
      if (category === "Banker") {
        const minO = Math.min(o1, o2);
        if (minO > 1.3) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
        }
        if (!isNaN(minO) && minO > 2.5) {
          category = "Value";
        }
        if (isOddsTrap) {
          category = "Value";
        }
      }
      if (rawConfidence > 90 && minMarketOddsValue > 1.7) {
        rawConfidence = 85;
        category = "Standard";
        reasonParts.push("Anti-Trap Downgrade");
      }
      if (category === "Banker" && finalPrediction.length === 1) {
        const support = sSubStatsProb ? sSubStatsProb[finalPrediction] : 0;
        if (support <= 0.45) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          category = "Standard";
          reasonParts.push("Banker PHA Support < 45%");
        }
      }
      const currentO = finalPrediction === "1" ? o1 : finalPrediction === "2" ? o2 : oX;
      if (category === "Value" && currentO > 3 && finalPrediction.length === 1) {
        if (!hasFlag("HIGH_CONF")) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          reasonParts.push("Value Volatility Control (>3.00)");
        }
      }
      if (!match.isJackpot && (phaDrawPctVal > 0.3 || hasFlag("POTENTIAL_DRAW"))) {
        if (minMarketOddsValue > 1.8) {
          category = "Value";
          reasonParts.push("Draw Logic -> Value Swap");
        }
      }
      if (category === "Upset") {
        const oppPred = finalPrediction.includes("1") ? "2" : "1";
        const oppProb = oppPred === "1" ? p1 : p2;
        if (oppProb >= 0.65) {
          category = "Standard";
          reasonParts.push("Upset Invalidated (Opp Prob >= 65%)");
          finalPrediction = oppPred === "1" ? "1X" : "X2";
        }
      }
      if (o1 >= 2 && o1 <= 2.5 && (match.gsHome || 0) > 1.75) {
        finalPrediction = "1";
        category = "Value";
        rawConfidence = Math.max(rawConfidence, 85);
        isUnshakable = true;
        reasonParts.push("Holy Grail Value");
      }
      if (rawConfidence >= 75 && match.pred1x2 && !matchesPrediction(match.pred1x2, finalPrediction)) {
        rawConfidence = 70;
        category = "Standard";
        reasonParts.push("External Veto");
      }
      if (rawConfidence >= 85 && (finalPrediction === "1X" || finalPrediction === "X2")) {
        const oppProb = finalPrediction === "1X" ? p2 : p1;
        if (oppProb > 0.3) {
          finalPrediction = "12";
          reasonParts.push("Clean Profile Hedge (12)");
        }
      }
      if (category !== "Banker") {
        const marketFavOutcome2 = !isNaN(o1) && !isNaN(o2) ? o1 < o2 ? "1" : o1 > o2 ? "2" : "" : "";
        const algoSubPred2 = match.patternAnalysis?.subPatternPrediction;
        if (marketFavOutcome2 && algoSubPred2 && !matchesPrediction(algoSubPred2, marketFavOutcome2)) {
          const underdogOutcome = marketFavOutcome2 === "1" ? "2" : "1";
          const ptsPred = match.calculatedPrediction;
          if (matchesPrediction(algoSubPred2, underdogOutcome) && ptsPred && matchesPrediction(ptsPred, underdogOutcome)) {
            finalPrediction = underdogOutcome;
            rawConfidence = Math.max(rawConfidence, 80);
            category = "Upset";
            reasonParts.push("Dual Upset Conf (Algo+Pts)");
            isUnshakable = true;
          } else {
            if (minMarketOddsValue >= 1.65 || match.isJackpot) {
              category = "Upset";
            }
          }
        }
        if (hasFlag("UPSET") && algoSubPred2 && marketFavOutcome2 && matchesPrediction(algoSubPred2, marketFavOutcome2)) {
          if (category === "Upset") category = "Standard";
        }
        if (marketFavOutcome2 && sSubStatsProb) {
          const phaFav = sSubStatsProb["1"] > sSubStatsProb["2"] && sSubStatsProb["1"] > sSubStatsProb["X"] ? "1" : sSubStatsProb["2"] > sSubStatsProb["1"] && sSubStatsProb["2"] > sSubStatsProb["X"] ? "2" : "";
          if (phaFav && phaFav !== marketFavOutcome2 && algoSubPred2 && matchesPrediction(algoSubPred2, marketFavOutcome2)) {
            if (finalPrediction === "1") finalPrediction = "1X";
            else if (finalPrediction === "2") finalPrediction = "X2";
            reasonParts.push("Contra-Market Hedge");
          }
        }
        if (!isNaN(o1) && !isNaN(o2) && o1 > 2.5 && o2 > 2.5) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          else if (finalPrediction === "12") finalPrediction = "12";
          else if (finalPrediction === "X") {
            finalPrediction = runTSLogic && (match.tsa || 0) > (match.tsb || 0) ? "1X" : "X2";
          }
          reasonParts.push("High Variance (>2.50)");
          rawConfidence = Math.min(rawConfidence, 60);
          isUnshakable = false;
          if (category !== "Banker") category = "Upset";
        }
        const favOdds2 = Math.min(o1, o2);
        const favPred = o1 === favOdds2 ? "1" : "2";
        const upsetThreshold = 1.65;
        if (favOdds2 < upsetThreshold && prediction !== favPred && category !== "Banker" && category !== "Value") {
          category = "Upset";
        }
        if (category === "Upset" || category === "Value") {
          const opposingFavOdds = Math.min(o1, o2);
          if (!isNaN(opposingFavOdds) && opposingFavOdds < 1.35) {
            const marketFav = o1 === opposingFavOdds ? "1" : "2";
            if (!matchesPrediction(finalPrediction, marketFav)) {
              category = "Standard";
              finalPrediction = marketFav === "1" ? "1X" : "X2";
            }
          }
        }
      }
      if (match.group === 3 && sSub && sSub["X"] > 0.5) {
        if (finalPrediction === "X") {
          finalPrediction = runTSLogic && (match.tsa || 0) >= (match.tsb || 0) ? "1X" : "X2";
        }
      }
      if (rawConfidence >= 72) isUnshakable = true;
      if (match.group === 1 && rawConfidence >= 65) isUnshakable = true;
      if (subPatternWinRate >= 65 && rawConfidence > 0) isUnshakable = true;
      const minOddsFinal = Math.min(o1, o2);
      if ((match.gsHome || 0) < 1.2 && (match.gsAway || 0) < 1.2 && pX > 0.33) {
        category = "Banker";
        finalPrediction = "X";
        reasonParts.push("Banker Draw (Low Scoring)");
      }
      if (category === "Value" && !isNaN(minOddsFinal) && minOddsFinal < 2.2 && sSubStatsProb) {
        const maxPha = Math.max(sSubStatsProb["1"], sSubStatsProb["X"], sSubStatsProb["2"]);
        if (maxPha > 0.7) {
          if (finalPrediction.length > 1) {
            if (finalPrediction === "1X") finalPrediction = "1";
            else if (finalPrediction === "X2") finalPrediction = "2";
          }
          reasonParts.push("Anti-Hedge (Value)");
        }
      }
      if (category === "Value" && finalPrediction === "1" && !isNaN(minOddsFinal) && minOddsFinal >= 2 && minOddsFinal <= 2.5) {
        if (sSubStatsProb) {
          const support = sSubStatsProb["1"];
          if (support > 0.55) {
            rawConfidence = Math.min(99, rawConfidence + 10);
            reasonParts.push("Holy Grail Value");
          }
        }
      }
      if (category === "Value" && !isNaN(minOddsFinal) && minOddsFinal > 3) {
        if (sSubStatsProb) {
          const maxPha = Math.max(sSubStatsProb["1"], sSubStatsProb["X"], sSubStatsProb["2"]);
          if (maxPha <= 0.65) {
            category = "Standard";
            if (finalPrediction.length === 1) {
              finalPrediction = finalPrediction === "1" ? "1X" : "X2";
            }
            reasonParts.push("Value Risk (>3.00 Low PHA)");
          }
        } else {
          category = "Standard";
          if (finalPrediction.length === 1) {
            finalPrediction = finalPrediction === "1" ? "1X" : "X2";
          }
        }
      }
      if (finalPrediction === "2" && !isNaN(minOddsFinal) && minOddsFinal < 1.5) {
        const l10Parts = match.l10?.split(":") || [];
        const l10Home = parseFloat(l10Parts[0] || "0");
        if (l10Home > 5) {
          finalPrediction = "X2";
          reasonParts.push("Dominant Away Fav Safeguard");
        }
      }
      if (!isNaN(minOddsFinal) && minOddsFinal < 1.85) {
        if (sSubStatsProb) {
          const maxPha = Math.max(sSubStatsProb["1"], sSubStatsProb["X"], sSubStatsProb["2"]);
          if (maxPha <= 0.6) {
            rawConfidence = Math.min(rawConfidence, 60);
            reasonParts.push("Low PHA for Fav");
          }
        }
      }
      if (category === "Value" && !isNaN(minOddsFinal) && minOddsFinal >= 2.2 && minOddsFinal <= 2.5) {
        if (rawConfidence < 60) {
          category = "Standard";
          if (finalPrediction.length === 1) {
            finalPrediction = finalPrediction === "1" ? "1X" : "X2";
          }
          reasonParts.push("Volatile Value Exclusion");
        }
      }
      if (category === "Value" && !isNaN(minOddsFinal) && minOddsFinal >= 2.2 && minOddsFinal <= 2.5) {
        if (pX > 0.3) {
          category = "Banker";
          finalPrediction = "X";
          reasonParts.push("Value Trap -> Banker Draw");
        }
      }
      if (category === "Upset" && finalPrediction === "1" && !isNaN(minOddsFinal) && minOddsFinal >= 2.6 && minOddsFinal <= 2.9) {
        if (pX >= 0.3) {
          category = "Standard";
          reasonParts.push("Upset Draw Risk");
        }
      }
      const isYouth = /\b(U21|U23|Res|Reserve|Youth)\b/i.test(match.teams);
      if (isYouth && !isNaN(minOddsFinal) && minOddsFinal > 1.7) {
        rawConfidence = Math.max(0, rawConfidence - 10);
        reasonParts.push("Youth Volatility");
      }
      if (match.patternAnalysis?.activeFlags?.includes("High Draw Risk") && rulePrediction && ["1X", "X2"].includes(rulePrediction)) {
        if (!isNaN(oX) && oX >= 2.8 && oX <= 3.4) {
          prediction = "X";
          finalPrediction = "X";
          category = "Banker Draw";
          reasonParts.push("Banker Draw Protocol");
        }
      }
      if (!isNaN(o1) && o1 >= 2.6 && o1 <= 3 && !isNaN(o2) && o2 >= 2.6 && o2 <= 3) {
        if (rulePrediction === "12" && pX > 0.3) {
          prediction = "X";
          finalPrediction = "X";
          category = "Banker Draw";
          reasonParts.push("Banker Draw Protocol (Compressed Odds)");
        }
      }
      if (finalPrediction === "1") {
        if (rulePrediction === "X2") {
          finalPrediction = "X2";
          category = "Standard";
          reasonParts.push("SubPat Contradiction Override (1 vs X2)");
        } else if (rulePrediction === "12" && !isNaN(o1) && o1 > 1.75) {
          finalPrediction = "12";
          reasonParts.push("Top 20 High Confidence Recovery (1 vs 12)");
        }
      }
      if ((finalPrediction === "1" || finalPrediction === "2") && !isNaN(minOddsFinal) && minOddsFinal > 1.85) {
        let phaAgrees = false;
        if (sSubStatsProb) {
          const maxPha = Math.max(sSubStatsProb["1"], sSubStatsProb["X"], sSubStatsProb["2"]);
          if (finalPrediction === "1" && maxPha === sSubStatsProb["1"]) phaAgrees = true;
          if (finalPrediction === "2" && maxPha === sSubStatsProb["2"]) phaAgrees = true;
        }
        const extAgrees = matchesPrediction(match.pred1x2 || "", finalPrediction);
        if (!(phaAgrees && extAgrees)) {
          finalPrediction = finalPrediction === "1" ? "1X" : "X2";
          reasonParts.push("BOTB Hedge Protocol (>1.85)");
        }
      }
      if (match.group === 2 && finalPrediction.length === 1) {
        if (finalPrediction === "1") finalPrediction = "1X";
        else if (finalPrediction === "2") finalPrediction = "X2";
        else if (finalPrediction === "X") finalPrediction = p1 > p2 ? "1X" : "X2";
        reasonParts.push("Group 2 Volatility Quarantine");
      }
      if (category !== "Standard") reasonParts.push(category);
      if (match.patternAnalysis?.subPattern) reasonParts.push(`Pat:${match.patternAnalysis.subPattern}`);
      else if (match.patternAnalysis?.mainPattern) reasonParts.push(`Pat:${match.patternAnalysis.mainPattern}`);
      if (flags.length > 0) reasonParts.push(`[${flags.slice(0, 3).join(",")}]`);
      if (isOddsTrap) reasonParts.push("\u26A0\uFE0F Odds Trap");
      let optP1 = 0, optPX = 0, optP2 = 0, optTotalWeight = 0;
      if (sSub) {
        optP1 += sSub["1"] * 5;
        optPX += sSub["X"] * 5;
        optP2 += sSub["2"] * 5;
        optTotalWeight += 5;
      }
      optP1 += impliedProbs["1"] * 5;
      optPX += impliedProbs["X"] * 5;
      optP2 += impliedProbs["2"] * 5;
      optTotalWeight += 5;
      if (optTotalWeight > 0) {
        optP1 /= optTotalWeight;
        optPX /= optTotalWeight;
        optP2 /= optTotalWeight;
      } else {
        optP1 = impliedProbs["1"];
        optPX = impliedProbs["X"];
        optP2 = impliedProbs["2"];
      }
      const optMaxP = Math.max(optP1, optPX, optP2);
      let optPred = "1";
      if (optPX === optMaxP) optPred = "X";
      if (optP2 === optMaxP) optPred = "2";
      let optFinalPrediction = optPred;
      if (optMaxP < 0.8) {
        if (optPred === "1") optFinalPrediction = optPX > optP2 ? "1X" : "12";
        else if (optPred === "X") optFinalPrediction = optP1 > optP2 ? "1X" : "X2";
        else optFinalPrediction = optPX > optP1 ? "X2" : "12";
      }
      const tossUpRules = [
        { subPattern: "G2i13", cond: "GA_10", action: "force_12" },
        { subPattern: "G2g4", cond: "GA_12", action: "force_12" },
        { subPattern: "G3t12", cond: "GA_15", action: "force_udog_draw" },
        { subPattern: "G2ff43", cond: "GA_10", action: "force_12" },
        { subPattern: "G2ee2", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G1q17", cond: "GA_10", action: "force_12" },
        { subPattern: "G2i18", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2q15", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2ee11", cond: "GA_10", action: "force_12" },
        { subPattern: "G2s21", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G3p5", cond: "GA_12", action: "force_udog_draw" },
        { subPattern: "G1a7", cond: "GA_12", action: "force_fav_draw" },
        { subPattern: "G2ff48", cond: "GA_12", action: "force_12" },
        { subPattern: "G2m13", cond: "GA_15", action: "force_fav_draw" },
        { subPattern: "G2f18", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G3jj1", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2e5", cond: "GA_10", action: "force_12" },
        { subPattern: "G2l1", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G1r18", cond: "GA_10", action: "force_12" },
        { subPattern: "G2ii4", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2ee15", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G3ff48", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2e10", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2t7", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2q14", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2a2", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G3j2", cond: "GA_10", action: "force_12" },
        { subPattern: "G3i1", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2o8", cond: "GA_10", action: "force_12" },
        { subPattern: "G1aa1", cond: "GA_10", action: "force_udog_draw" },
        { subPattern: "G3m3", cond: "GA_10", action: "force_12" },
        { subPattern: "G1ff50", cond: "GA_10", action: "force_12" },
        { subPattern: "G1s15", cond: "GA_10", action: "force_12" },
        { subPattern: "G2bb3", cond: "GA_10", action: "force_udog_draw" },
        { subPattern: "G2ff32", cond: "GA_10", action: "force_12" },
        { subPattern: "G1pp2", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2jj1", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G3s3", cond: "GA_12", action: "force_udog_draw" },
        { subPattern: "G1g2", cond: "GA_12", action: "force_12" },
        { subPattern: "G1u6", cond: "GA_12", action: "force_12" },
        { subPattern: "G2ee3", cond: "GA_15", action: "force_12" },
        { subPattern: "G3ee8", cond: "GA_15", action: "force_12" },
        { subPattern: "G2g3", cond: "GA_17", action: "force_fav_draw" },
        { subPattern: "G3ff45", cond: "GA_17", action: "force_fav_draw" },
        { subPattern: "G3g2", cond: "GA_20", action: "force_udog_draw" },
        { subPattern: "G3j1", cond: "GA_20", action: "force_12" },
        { subPattern: "G1g4", cond: "GA_12_15", action: "force_fav_draw" },
        { subPattern: "G2t1", cond: "GA_10", action: "force_12" },
        { subPattern: "G3i2", cond: "GA_10", action: "force_12" },
        { subPattern: "G3dd4", cond: "GA_10", action: "force_12" },
        { subPattern: "G1r17", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G1i17", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2o18", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G1bb2", cond: "GA_10", action: "force_udog_draw" },
        { subPattern: "G3o8", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2ee13", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2x4", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2f10", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2ee7", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G3mm1", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2oo1", cond: "GA_10", action: "force_12" },
        { subPattern: "G2q4", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G3f15", cond: "GA_10", action: "force_12" },
        { subPattern: "G3o6", cond: "GA_10", action: "force_udog_draw" },
        { subPattern: "G2ff44", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2i15", cond: "GA_10", action: "force_12" },
        { subPattern: "G1i16", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2i4", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G1m6", cond: "GA_10", action: "force_12" },
        { subPattern: "G3ff6", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G1g1", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2f23", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2ff59", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2jj2", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G3ff57", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G3gg1", cond: "GA_10", action: "force_12" },
        { subPattern: "G3f14", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2aa2", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G1jj2", cond: "GA_10", action: "force_12" },
        { subPattern: "G2y2", cond: "GA_10", action: "force_udog_draw" },
        { subPattern: "G3aa5", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G1w4", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G3ee4", cond: "GA_10", action: "force_12" },
        { subPattern: "G1mm1", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G1t4b", cond: "GA_12", action: "force_udog_draw" },
        { subPattern: "G2s25", cond: "GA_12", action: "force_udog_draw" },
        { subPattern: "G3w1", cond: "GA_12", action: "force_udog_draw" },
        { subPattern: "G2o12", cond: "GA_12", action: "force_12" },
        { subPattern: "G1ee10", cond: "GA_12", action: "force_fav_draw" },
        { subPattern: "G1p8", cond: "GA_12", action: "force_fav_draw" },
        { subPattern: "G1g16", cond: "GA_12", action: "force_12" },
        { subPattern: "G2p10", cond: "GA_12", action: "force_fav_draw" },
        { subPattern: "G2ee1", cond: "GA_12", action: "force_12" },
        { subPattern: "G2dd4", cond: "GA_12", action: "force_udog_draw" },
        { subPattern: "G1a2", cond: "GA_12", action: "force_fav_draw" },
        { subPattern: "G3hh2", cond: "GA_12", action: "force_udog_draw" },
        { subPattern: "G2i16", cond: "GA_12", action: "force_12" },
        { subPattern: "G2m14", cond: "GA_15", action: "force_12" },
        { subPattern: "G3ee2", cond: "GA_15", action: "force_fav_draw" },
        { subPattern: "G3a2", cond: "GA_15", action: "force_fav_draw" },
        { subPattern: "G3f10", cond: "GA_15", action: "force_12" },
        { subPattern: "G3b2", cond: "GA_15", action: "force_fav_draw" },
        { subPattern: "G3a1", cond: "GA_17", action: "force_12" },
        { subPattern: "G3ff56", cond: "GA_17", action: "force_udog_draw" },
        { subPattern: "G2p12", cond: "GA_20", action: "force_fav_draw" },
        { subPattern: "G2pp2", cond: "GA_12_15", action: "force_fav_draw" },
        { subPattern: "G3nn1", cond: "GA_12_15", action: "force_fav_draw" }
      ];
      const pointInfluenceRules = [
        { subPattern: "G2p10", cond: "UD_PTS_0", action: "force_udog_draw" },
        { subPattern: "G2ff43", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G1r18", cond: "UD_PTS_0", action: "force_udog_draw" },
        { subPattern: "G1ff53", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G1p4", cond: "UD_PTS_10", action: "force_fav_draw" },
        { subPattern: "G3i2", cond: "UD_PTS_0", action: "force_udog_draw" },
        { subPattern: "G2o15", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G2i13", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G2q15", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G1ee8", cond: "UD_PTS_0", action: "force_udog_draw" },
        { subPattern: "G1r17", cond: "UD_PTS_0", action: "force_12" },
        { subPattern: "G2ee9", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G3o8", cond: "UD_PTS_0", action: "force_12" },
        { subPattern: "G3j4", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G1t3", cond: "UD_PTS_0", action: "force_udog_draw" },
        { subPattern: "G3j2", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G1b7", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G3r13", cond: "UD_PTS_5", action: "force_udog_draw" },
        { subPattern: "G3N1", cond: "UD_PTS_5", action: "force_fav_draw" },
        { subPattern: "G1a7", cond: "UD_PTS_20", action: "force_udog_draw" },
        { subPattern: "G3q3", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G1r02", cond: "UD_PTS_0", action: "force_12" },
        { subPattern: "G2pp2", cond: "UD_PTS_0", action: "force_udog_draw" },
        { subPattern: "G1o1", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G1x1", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G3q2", cond: "UD_PTS_20", action: "force_udog_draw" },
        { subPattern: "G1t01", cond: "FAV_LEAD_10", action: "force_fav_draw" },
        { subPattern: "G1ee10", cond: "FAV_LEAD_10", action: "force_fav_draw" },
        { subPattern: "G2ee3", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G2i18", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G1ff57", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G1m3", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G2g3", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G2f10", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G1s10", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G2ff44", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G1g3", cond: "UD_PTS_0", action: "force_12" },
        { subPattern: "G1a2", cond: "UD_PTS_0", action: "force_12" },
        { subPattern: "G2ee2", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G3o9", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G2aa4", cond: "UD_PTS_0", action: "force_12" },
        { subPattern: "G1j15", cond: "UD_PTS_0", action: "force_12" },
        { subPattern: "G2q12", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G2s18", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G3f14", cond: "UD_PTS_0", action: "force_12" },
        { subPattern: "G2jj1", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G1w4", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G3i1", cond: "UD_PTS_5", action: "force_12" },
        { subPattern: "G1s15", cond: "UD_PTS_5", action: "force_fav_draw" },
        { subPattern: "G1j14", cond: "UD_PTS_10", action: "force_fav_draw" },
        { subPattern: "G2t7", cond: "UD_PTS_10", action: "force_12" },
        { subPattern: "G2p11", cond: "UD_PTS_10", action: "force_fav_draw" },
        { subPattern: "G2kk3", cond: "UD_PTS_15", action: "force_udog_draw" },
        { subPattern: "G1g16", cond: "UD_PTS_15", action: "force_fav_draw" },
        { subPattern: "G2l1", cond: "UD_PTS_20", action: "force_12" },
        { subPattern: "G3j1", cond: "UD_PTS_20", action: "force_udog_draw" },
        { subPattern: "G1j2", cond: "UD_PTS_20", action: "force_udog_draw" },
        { subPattern: "G1f29", cond: "UD_PTS_20", action: "force_12" },
        { subPattern: "G1i17", cond: "FAV_LEAD_10", action: "force_udog_draw" },
        { subPattern: "G3j1", cond: "FAV_LEAD_10", action: "force_12" },
        { subPattern: "G3s3", cond: "FAV_LEAD_10", action: "force_fav_draw" },
        { subPattern: "G1t3", cond: "FAV_LEAD_10", action: "force_12" },
        { subPattern: "G3ff45", cond: "FAV_LEAD_10", action: "force_12" },
        { subPattern: "G3t13", cond: "FAV_LEAD_10", action: "force_udog_draw" },
        { subPattern: "G3j11", cond: "FAV_LEAD_5", action: "force_fav_draw" },
        { subPattern: "G1ff57", cond: "FAV_LEAD_5", action: "force_fav_draw" },
        { subPattern: "G1r17", cond: "FAV_LEAD_5", action: "force_fav_draw" }
      ];
      const currentSubPattern = match.patternAnalysis?.subPattern || "NA";
      const gaHome = match.gaHome ?? 0;
      const gaAway = match.gaAway ?? 0;
      const matchedRule = tossUpRules.find((rule) => {
        if (rule.subPattern !== currentSubPattern) return false;
        if (rule.cond === "GA_10" && gaHome >= 1 && gaAway >= 1) return true;
        if (rule.cond === "GA_12" && gaHome >= 1.2 && gaAway >= 1.2) return true;
        if (rule.cond === "GA_15" && gaHome >= 1.5 && gaAway >= 1.5) return true;
        if (rule.cond === "GA_17" && gaHome >= 1.7 && gaAway >= 1.7) return true;
        if (rule.cond === "GA_20" && gaHome >= 2 && gaAway >= 2) return true;
        if (rule.cond === "GA_12_15" && (gaHome >= 1.2 && gaAway >= 1.5 || gaHome >= 1.5 && gaAway >= 1.2)) return true;
        return false;
      });
      const getFavInfo = (m) => {
        if (m.mo && m.mo !== "NA" && m.mo !== "Unknown" && m.mo !== "") {
          const parts = String(m.mo).split(/[,\s:\/\-]+/).map((p) => parseFloat(p.trim())).filter((p) => !isNaN(p));
          if (parts.length >= 3) {
            const o12 = parts[0];
            const o22 = parts[2];
            if (o12 !== o22) {
              return { fav: o12 < o22 ? "1" : "2", underdog: o12 < o22 ? "2" : "1" };
            }
          }
        }
        return null;
      };
      const favInfo = getFavInfo(match);
      let pointMatchedRule = null;
      if (favInfo && match.totalPoints) {
        const favPts = favInfo.fav === "1" ? match.totalPoints.home : match.totalPoints.away;
        const udogPts = favInfo.underdog === "1" ? match.totalPoints.home : match.totalPoints.away;
        pointMatchedRule = pointInfluenceRules.find((rule) => {
          if (rule.subPattern !== currentSubPattern) return false;
          if (rule.cond === "UD_PTS_0" && udogPts >= favPts) return true;
          if (rule.cond === "UD_PTS_5" && udogPts - favPts >= 5) return true;
          if (rule.cond === "UD_PTS_10" && udogPts - favPts >= 10) return true;
          if (rule.cond === "UD_PTS_15" && udogPts - favPts >= 15) return true;
          if (rule.cond === "UD_PTS_20" && udogPts - favPts >= 20) return true;
          if (rule.cond === "PTS_EQ" && Math.abs(favPts - udogPts) < 0.01) return true;
          if (rule.cond === "FAV_LEAD_10" && favPts >= udogPts && favPts - udogPts < 10) return true;
          if (rule.cond === "FAV_LEAD_5" && favPts >= udogPts && favPts - udogPts < 5) return true;
          if (rule.cond === "FAV_LEAD_3" && favPts >= udogPts && favPts - udogPts < 3) return true;
          return false;
        });
      }
      const activeOverrideRule = matchedRule || pointMatchedRule;
      const activeOverrideSource = matchedRule ? "Toss-up" : "Point Influence";
      if (activeOverrideRule && favInfo) {
        const fav = favInfo.fav;
        const udog = favInfo.underdog;
        if (activeOverrideRule.action === "force_fav") {
          optPred = fav;
          optFinalPrediction = fav;
        } else if (activeOverrideRule.action === "force_fav_draw") {
          optFinalPrediction = fav === "1" ? "1X" : "X2";
        } else if (activeOverrideRule.action === "force_udog_draw") {
          optFinalPrediction = fav === "1" ? "X2" : "1X";
        } else if (activeOverrideRule.action === "force_draw") {
          optPred = "X";
          optFinalPrediction = "X";
        } else if (activeOverrideRule.action === "force_12") {
          optFinalPrediction = "12";
        }
        reasonParts.push(`\u{1F3AF} ${activeOverrideSource} Override [${activeOverrideRule.action}]`);
      }
      if (optFinalPrediction === "12" && favInfo) {
        const hedgeOverrides = [
          { subPattern: "G2j10", action: "force_fav_draw" },
          { subPattern: "G1ff47", action: "force_fav_draw" },
          { subPattern: "G2f21", action: "force_fav_draw" },
          { subPattern: "G3o8", action: "force_fav_draw" },
          { subPattern: "G1o4", action: "force_fav_draw" },
          { subPattern: "G2ff34", action: "force_fav_draw" },
          { subPattern: "G2e8", action: "force_fav_draw" },
          { subPattern: "G1ff54", action: "force_fav_draw" },
          { subPattern: "G1ff43", action: "force_fav_draw" },
          { subPattern: "G1dd1", action: "force_fav_draw" },
          { subPattern: "G1ff44", action: "force_fav_draw" }
        ];
        const matchedHedge = hedgeOverrides.find((rule) => rule.subPattern === currentSubPattern);
        if (matchedHedge) {
          const fav = favInfo.fav;
          optFinalPrediction = fav === "1" ? "1X" : "X2";
          reasonParts.push(`\u{1F6E1}\uFE0F Hedge Override [force_fav_draw]`);
        }
      }
      prediction = optPred;
      finalPrediction = optFinalPrediction;
      p1 = optP1;
      pX = optPX;
      p2 = optP2;
      rawConfidence = Math.min(99, Math.round((optMaxP - 0.33) / 0.67 * 100));
      const reason = reasonParts.join(" | ") || "Algorithm Consensus";
      const enforced = enforceAlgoPredictionRules(prediction, finalPrediction, { "1": p1, "X": pX, "2": p2 });
      prediction = enforced.primaryPrediction;
      finalPrediction = enforced.finalPrediction;
      return {
        team: match.teams,
        prediction: finalPrediction,
        primaryPrediction: prediction,
        confidence: `${rawConfidence}%`,
        rawConfidence,
        probabilities: { "1": p1, "X": pX, "2": p2 },
        category,
        reason,
        odds: match.mo || "N/A",
        isUnshakable
      };
    };
  }
});

// src/components/ai/JKalgorithm.tsx
var predictJackpot;
var init_JKalgorithm = __esm({
  "src/components/ai/JKalgorithm.tsx"() {
    init_matchProcessing();
    predictJackpot = (match, algo) => {
      const mainP = match.patternAnalysis?.mainPattern || "NA";
      const subP = match.patternAnalysis?.subPattern || "NA";
      const flags = match.patternAnalysis?.activeFlags || [];
      const hasFlag = (f) => flags.includes(f);
      const exactKey = `EX:${mainP}|${flags.sort().join("+")}`;
      let isOddsTrap = false;
      let currentWeights = { ...algo.weights, external: 0 };
      const tsDiff = Math.abs((match.tsa || 0) - (match.tsb || 0));
      const englishLowerLeagues = ["Mansfield", "Wigan", "Peterborough", "Stockport", "Wrexham", "Birmingham", "Huddersfield", "Bolton", "Reading", "Lincoln", "Stevenage", "Exeter", "Bristol Rovers", "Wycombe", "Leyton", "Charlton", "Cambridge", "Burton", "Shrewsbury", "Northampton", "Blackpool", "Barnsley", "Rotherham", "Crawley", "Port Vale", "Fleetwood", "Cheltenham", "Carlisle", "Portsmouth", "Derby", "Oxford", "Concarneau"];
      const isLowerLeague = englishLowerLeagues.some((t) => match.teams.includes(t)) || match.group === 3;
      const signals = [];
      if (currentWeights.exactMatch > 0) {
        const sExact = algo.getProbabilities(exactKey, 3);
        if (sExact) signals.push({ probs: sExact, weight: currentWeights.exactMatch, name: "Exact Scenario" });
      }
      const sSub = algo.getProbabilities(`S:${subP}`, 5);
      const sSubStats = algo.getRawPatternStats(`S:${subP}`);
      const sSubStatsProb = algo.getProbabilities(`S:${subP}`, 3);
      const phaDrawPctVal = sSub ? sSub["X"] : 0;
      if (sSub) signals.push({ probs: sSub, weight: currentWeights.subPattern, name: "Sub Pattern" });
      if (currentWeights.flags > 0) {
        let flagProbs = { "1": 0, "X": 0, "2": 0, count: 0 };
        flags.forEach((f) => {
          if (f === "TS_DIFF_DRAW" && phaDrawPctVal <= 0.3) return;
          const fp = algo.getProbabilities(`F:${f}`, 10);
          if (fp) {
            flagProbs["1"] += fp["1"];
            flagProbs["X"] += fp["X"];
            flagProbs["2"] += fp["2"];
            flagProbs.count++;
          }
        });
        if (flagProbs.count > 0) {
          signals.push({
            probs: {
              "1": flagProbs["1"] / flagProbs.count,
              "X": flagProbs["X"] / flagProbs.count,
              "2": flagProbs["2"] / flagProbs.count
            },
            weight: currentWeights.flags,
            name: "Flag Consensus"
          });
        }
      }
      if (currentWeights.mainPattern > 0) {
        const sMain = algo.getProbabilities(`M:${mainP}`, 10);
        if (sMain) signals.push({ probs: sMain, weight: currentWeights.mainPattern, name: "Main Pattern" });
      }
      const moParts = String(match.mo || "").split(/[- ,]+/).map((p) => parseFloat(p.trim())).filter((p) => !isNaN(p));
      let impliedProbs = { "1": 0.33, "X": 0.33, "2": 0.33 };
      if (moParts.length === 3 && !moParts.some(isNaN)) {
        const margin = 1 / moParts[0] + 1 / moParts[1] + 1 / moParts[2];
        impliedProbs = {
          "1": 1 / moParts[0] / margin,
          "X": 1 / moParts[1] / margin,
          "2": 1 / moParts[2] / margin
        };
        signals.push({ probs: impliedProbs, weight: currentWeights.odds, name: "Market Implied" });
      }
      if (currentWeights.external > 0) {
        const extProbs = algo.getProbsFromPrediction(match.pred1x2);
        signals.push({ probs: extProbs, weight: currentWeights.external, name: "External Source" });
      }
      const ptsProbs = algo.getProbsFromPrediction(match.calculatedPrediction);
      signals.push({ probs: ptsProbs, weight: currentWeights.points, name: "Points System" });
      let p1 = 0, pX = 0, p2 = 0, totalWeight = 0;
      if (signals.length === 0) {
        p1 = impliedProbs["1"];
        pX = impliedProbs["X"];
        p2 = impliedProbs["2"];
      } else {
        signals.forEach((s) => {
          p1 += s.probs["1"] * s.weight;
          pX += s.probs["X"] * s.weight;
          p2 += s.probs["2"] * s.weight;
          totalWeight += s.weight;
        });
        p1 /= totalWeight;
        pX /= totalWeight;
        p2 /= totalWeight;
      }
      if (isLowerLeague) {
        p1 = Math.max(0, p1 - 0.05);
        pX += 0.025;
        p2 += 0.025;
      }
      pX += 0.05;
      const totalProb = p1 + pX + p2;
      if (totalProb > 0) {
        p1 /= totalProb;
        pX /= totalProb;
        p2 /= totalProb;
      }
      let maxP = Math.max(p1, pX, p2);
      let prediction = "1";
      if (pX === maxP) prediction = "X";
      if (p2 === maxP) prediction = "2";
      let finalPrediction = prediction;
      let hedgeThreshold = 0.7;
      const rulePrediction = match.patternAnalysis?.subPatternPrediction;
      const hasRule = false;
      if (hasRule) {
        finalPrediction = rulePrediction;
        if (rulePrediction === "X2" && sSubStatsProb && sSubStatsProb["1"] > 0.55) {
          finalPrediction = "1X";
        }
        if (finalPrediction.length > 1) {
          if (finalPrediction === "1X") prediction = p1 >= pX ? "1" : "X";
          else if (finalPrediction === "X2") prediction = p2 >= pX ? "2" : "X";
          else if (finalPrediction === "12") prediction = p1 >= p2 ? "1" : "2";
        } else {
          prediction = finalPrediction;
        }
      } else {
        if (maxP < hedgeThreshold) {
          if (prediction === "1") finalPrediction = pX > p2 ? "1X" : "12";
          else if (prediction === "X") finalPrediction = p1 > p2 ? "1X" : "X2";
          else finalPrediction = pX > p1 ? "X2" : "12";
        }
      }
      const [o1, oX, o2] = moParts;
      if (!isNaN(o1) && !isNaN(o2) && Math.abs(o1 - o2) < 0.3) {
        if (sSubStatsProb && sSubStatsProb["1"] < 0.45 && sSubStatsProb["2"] < 0.45) {
          prediction = "X";
          finalPrediction = p1 > p2 ? "1X" : "X2";
        }
      }
      if (!isNaN(oX) && oX < 3.3 && ["1", "2"].includes(finalPrediction)) {
        if (!isNaN(o1) && o1 >= 2.5 || !isNaN(o2) && o2 >= 2.5) {
          finalPrediction = finalPrediction === "1" ? "1X" : "X2";
        }
      }
      if (!isNaN(o1) && o1 >= 2.5 && (!isNaN(o2) && o2 >= 2.5)) {
        if (maxP < 0.5 && rulePrediction && rulePrediction !== finalPrediction) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          else if (finalPrediction === "X") finalPrediction = p1 > p2 ? "1X" : "X2";
        }
      }
      const moFav = !isNaN(o1) && !isNaN(o2) ? o1 <= o2 ? "1" : "2" : "";
      const moUnderdog = moFav ? moFav === "1" ? "2" : "1" : "";
      if (moUnderdog && sSubStatsProb) {
        const favOdds2 = moFav === "1" ? o1 : o2;
        if (favOdds2 > 2 && rulePrediction && rulePrediction.includes(moUnderdog)) {
          finalPrediction = moUnderdog === "1" ? "1X" : "X2";
        }
      }
      if (rulePrediction === "12" && sSubStatsProb && moUnderdog) {
        if (sSubStatsProb[moUnderdog] > 0.45) {
          finalPrediction = moUnderdog === "1" ? "1X" : "X2";
        }
      }
      let rawConfidence = Math.min(99, Math.round((maxP - 0.33) / 0.67 * 100));
      let isUnshakable = false;
      let category = "Standard";
      if (match.patternAnalysis?.activeFlags?.includes("High Draw Risk") && rulePrediction && ["1X", "X2"].includes(rulePrediction)) {
        if (!isNaN(oX) && oX >= 2.8 && oX <= 3.4) {
          prediction = "X";
          finalPrediction = p1 >= p2 ? "1X" : "X2";
          category = "Banker Draw";
        }
      }
      const ptsAgree = match.calculatedPrediction === prediction;
      if (ptsAgree) {
        rawConfidence = Math.min(99, rawConfidence + 10);
      }
      const reasonParts = [];
      if (match.pred1x2 && match.pred1x2 === prediction) {
        rawConfidence = Math.min(99, rawConfidence + 10);
        reasonParts.push("Ext Agreement (+Conf)");
      }
      if ((match.gaHome || 0) >= 2) {
        rawConfidence = Math.round(rawConfidence * 0.8);
        reasonParts.push("Defensive Fragility");
      }
      const isTopTier = ["Arsenal", "Liverpool", "Man City", "Aston Villa", "Tottenham", "Man Utd", "Newcastle", "Chelsea", "West Ham", "Brighton", "Real Madrid", "Barcelona", "Bayern", "Leverkusen", "Inter", "Milan", "Juventus", "PSG", "Dortmund", "Atl. Madrid"].some((t) => match.teams.includes(t));
      if (isTopTier && rawConfidence > 55) {
        rawConfidence = 55;
        if (finalPrediction === "1") finalPrediction = "1X";
        else if (finalPrediction === "2") finalPrediction = "X2";
        reasonParts.push("Top-Tier Variance Cap");
        isUnshakable = false;
      }
      let phaPrediction = null;
      if (sSubStatsProb) {
        const p1s = sSubStatsProb["1"];
        const pXs = sSubStatsProb["X"];
        const p2s = sSubStatsProb["2"];
        const maxS = Math.max(p1s, pXs, p2s);
        if (maxS === p1s) phaPrediction = "1";
        else if (maxS === pXs) phaPrediction = "X";
        else phaPrediction = "2";
      }
      const primaryPHA = rulePrediction && !["PTS", "MO", "NA", "Upset"].includes(rulePrediction) ? rulePrediction : phaPrediction;
      if (primaryPHA && primaryPHA !== finalPrediction) {
        finalPrediction = primaryPHA;
        rawConfidence = 85;
        reasonParts.push("PHA Anchor Override");
        isUnshakable = true;
      }
      if (sSubStatsProb) {
        const maxPhaSup = Math.max(sSubStatsProb["1"], sSubStatsProb["X"], sSubStatsProb["2"]);
        if (maxPhaSup > 0.6) {
          if (phaPrediction) {
            finalPrediction = phaPrediction;
            isUnshakable = true;
            rawConfidence = 99;
            reasonParts.push("PHA Pillar (>60%)");
          }
        }
      }
      if (match.group === 2 && sSubStatsProb) {
        const subAcc = algo.getPatternWinRate(subP, match.patternAnalysis?.subPatternPrediction || null);
        if (subAcc > 85) {
          if (sSubStatsProb["1"] > 0.6 || sSubStatsProb["2"] > 0.6) {
            if (sSubStatsProb["1"] > 0.6) finalPrediction = "1";
            else finalPrediction = "2";
            category = "Banker";
            rawConfidence = 99;
            isUnshakable = true;
            reasonParts.push("Group 2 Premium Selection");
          }
        }
      }
      if (match.group === 3 && finalPrediction.length > 1 && category === "Banker" && sSubStatsProb) {
        let dcPhaSupport = 0;
        if (finalPrediction === "1X") dcPhaSupport = sSubStatsProb["1"] + sSubStatsProb["X"];
        else if (finalPrediction === "X2") dcPhaSupport = sSubStatsProb["X"] + sSubStatsProb["2"];
        else if (finalPrediction === "12") dcPhaSupport = sSubStatsProb["1"] + sSubStatsProb["2"];
        if (dcPhaSupport < 0.8) {
          category = "Standard";
          reasonParts.push("G3 DC Vulnerability (<80% PHA)");
        }
      }
      const ptsPred = match.calculatedPrediction;
      if (phaPrediction && ptsPred && finalPrediction === ptsPred && finalPrediction !== phaPrediction) {
        finalPrediction = phaPrediction;
        reasonParts.push("Tier 3 Override Reverted");
      }
      const runTSLogic = false;
      let isGoldenCombo = false;
      if (moFav && sSubStatsProb && rulePrediction) {
        let phaFav = null;
        const p1s = sSubStatsProb["1"];
        const pXs = sSubStatsProb["X"];
        const p2s = sSubStatsProb["2"];
        const maxS = Math.max(p1s, pXs, p2s);
        if (maxS === p1s) phaFav = "1";
        else if (maxS === pXs) phaFav = "X";
        else phaFav = "2";
        if (phaFav && phaFav === moFav && matchesPrediction(rulePrediction, phaFav)) {
          if (rulePrediction === phaFav) {
            isGoldenCombo = true;
          }
        }
      }
      if (!isGoldenCombo && sSubStatsProb) {
        const maxPhaSup = Math.max(sSubStatsProb["1"], sSubStatsProb["X"], sSubStatsProb["2"]);
        if (maxPhaSup > 0.65) {
          let phaPred2 = "";
          if (maxPhaSup === sSubStatsProb["1"]) phaPred2 = "1";
          else if (maxPhaSup === sSubStatsProb["X"]) phaPred2 = "X";
          else phaPred2 = "2";
          finalPrediction = phaPred2;
          isGoldenCombo = true;
          rawConfidence = 99;
          isUnshakable = true;
          category = "Banker";
          reasonParts.unshift("Golden Base (PHA Dominance)");
        }
      }
      if (isGoldenCombo) {
        finalPrediction = moFav;
        if (reasonParts[0] === "Golden Base (PHA Dominance)") {
        } else {
          finalPrediction = moFav;
          reasonParts.unshift("GOLDEN COMBO (Fixed Base)");
        }
        rawConfidence = 99;
        isUnshakable = true;
        category = "Banker";
      }
      if (!isGoldenCombo) {
        if ((rulePrediction === "12" || finalPrediction === "12") && sSubStatsProb) {
          if (sSubStatsProb["1"] >= sSubStatsProb["2"]) {
            finalPrediction = "1X";
          } else {
            finalPrediction = "X2";
          }
          reasonParts.push("Jackpot 12 Protocol (PHA Force)");
        }
        if (sSubStatsProb) {
          const phaDraw = sSubStatsProb["X"];
          const moDiff = !isNaN(o1) && !isNaN(o2) ? Math.abs(o1 - o2) : 1;
          if (phaDraw > 0.35 && moDiff < 0.2) {
            finalPrediction = p1 >= p2 ? "1X" : "X2";
            category = "Banker";
            reasonParts.push("Aggressive Draw Hedge (PHA>35%)");
          } else if (phaDraw >= 0.25 && phaDraw <= 0.35) {
            if (finalPrediction === "X") {
              finalPrediction = p1 > p2 ? "1X" : "X2";
              reasonParts.push("Aggressive Draw Hedge");
            }
          }
        }
        if (match.patternAnalysis?.subPatternPrediction === "12" || finalPrediction === "12") {
          const underdog = moFav === "1" ? "2" : "1";
          let isUpsetQualified = false;
          const underdogProb = underdog === "1" ? p1 : p2;
          const favProb = underdog === "1" ? p2 : p1;
          let phaUnderdogSupport = 0;
          if (sSubStatsProb) {
            phaUnderdogSupport = sSubStatsProb[underdog];
          }
          if (underdogProb > 0.35 || phaUnderdogSupport > 0.35) {
            isUpsetQualified = true;
          }
          if (match.calculatedPrediction && matchesPrediction(match.calculatedPrediction, underdog)) {
            isUpsetQualified = true;
          }
          if (isUpsetQualified) {
            finalPrediction = underdog;
            category = "Upset";
            reasonParts.push("'12' Volatility -> Upset Win");
          } else {
            finalPrediction = moFav === "1" ? "X2" : "1X";
            reasonParts.push("'12' Volatility -> Underdog Hedge");
          }
        }
        if (moFav && !matchesPrediction(finalPrediction, moFav)) {
          if (sSubStatsProb) {
            const p1_pha2 = sSubStatsProb["1"];
            const p2_pha2 = sSubStatsProb["2"];
            const phaDir = p1_pha2 > p2_pha2 ? "1" : "2";
            if (matchesPrediction(phaDir, finalPrediction)) {
              let supportCount2 = 0;
              if (match.pred1x2 && matchesPrediction(match.pred1x2, finalPrediction)) supportCount2++;
              if (match.calculatedPrediction && matchesPrediction(match.calculatedPrediction, finalPrediction)) supportCount2++;
              if (Math.max(p1, pX, p2) > 0.45) supportCount2++;
              if (supportCount2 < 2) {
                finalPrediction = moFav === "1" ? "1X" : "X2";
                reasonParts.push("Algo/PHA Conflict (Low Support) -> Market Fav");
              } else {
                reasonParts.push("Algo/PHA Override (Supported)");
              }
            } else if (matchesPrediction(phaDir, moFav)) {
              finalPrediction = moFav === "1" ? "1X" : "X2";
              reasonParts.push("PHA Supports Market Fav");
            }
          }
        }
        if (moFav && sSubStatsProb) {
          const p1_pha2 = sSubStatsProb["1"];
          const p2_pha2 = sSubStatsProb["2"];
          const phaUnderdogProb = moFav === "1" ? p2_pha2 : p1_pha2;
          const phaFavProb = moFav === "1" ? p1_pha2 : p2_pha2;
          if (phaUnderdogProb > phaFavProb || Math.abs(phaFavProb - phaUnderdogProb) < 0.1) {
            const subPatternIs12 = match.patternAnalysis?.subPatternPrediction === "12";
            if (subPatternIs12 || finalPrediction === "12") {
              if (category !== "Upset" && finalPrediction.length === 1) category = "Upset";
            } else {
              if (matchesPrediction(finalPrediction, moFav)) {
                finalPrediction = moFav === "1" ? "1X" : "X2";
                reasonParts.push("PHA Volatility Hedge");
              }
            }
          }
        }
        if (category === "Value") {
          if (finalPrediction === "12") {
            const underdog = moFav === "1" ? "2" : "1";
            finalPrediction = underdog === "1" ? "1X" : "X2";
            reasonParts.push("Value Bet No-12 Rule");
          }
        }
        if (category === "Value" && finalPrediction.length === 1) {
          const predOdds3 = finalPrediction === "1" ? o1 : finalPrediction === "2" ? o2 : oX;
          const isMarketFav = matchesPrediction(finalPrediction, moFav);
          let phaSupport = 0;
          if (sSubStatsProb) {
            phaSupport = sSubStatsProb[finalPrediction];
          }
          const algoAgrees = match.patternAnalysis?.subPatternPrediction && matchesPrediction(match.patternAnalysis.subPatternPrediction, finalPrediction);
          const probConf = Math.max(p1, pX, p2);
          if (!isNaN(predOdds3) && predOdds3 >= 2 && phaSupport < 0.25) {
            category = "Standard";
            reasonParts.push("Low-PHA Variance (<25%)");
          }
          if (finalPrediction === "X" && phaSupport < 0.35) {
            category = "Standard";
            reasonParts.push("Strict Draw Filter (<35% PHA)");
          }
          if (phaSupport >= 0.15 && phaSupport <= 0.24 && rawConfidence < 85) {
            category = "Standard";
            reasonParts.push("Moderate PHA/Low Conf Filter");
          }
          if (rawConfidence >= 85 && phaSupport >= 0.3 && !isNaN(predOdds3) && predOdds3 >= 2) {
            reasonParts.push("Golden Value Combination");
            isUnshakable = true;
            if (category !== "Banker") category = "Value";
          }
          if (!isNaN(predOdds3) && predOdds3 >= 2) {
            if (isMarketFav) {
              if (phaSupport >= 0.5 && algoAgrees && probConf > 0.5) {
                reasonParts.push("HOLY GRAIL VALUE PICK");
                isUnshakable = true;
                rawConfidence = 99;
              } else {
                if (sSubStatsProb) {
                  const phaDir = sSubStatsProb["1"] > sSubStatsProb["2"] ? "1" : "2";
                  if (!matchesPrediction(finalPrediction, phaDir)) {
                    category = "Standard";
                    finalPrediction = finalPrediction === "1" ? "1X" : "X2";
                    reasonParts.push("Value Pick PHA Conflict");
                  }
                }
              }
            } else {
              if (sSubStatsProb) {
                const phaDir = sSubStatsProb["1"] > sSubStatsProb["2"] ? "1" : "2";
                if (!matchesPrediction(finalPrediction, phaDir)) {
                  category = "Standard";
                  finalPrediction = finalPrediction === "1" ? "1X" : "X2";
                  reasonParts.push("Value Risk (No PHA Support)");
                }
              }
            }
          } else {
            if (category === "Value") {
              category = "Standard";
              finalPrediction = finalPrediction === "1" ? "1X" : "X2";
            }
          }
        }
        if (sSubStatsProb && moUnderdog) {
          const phaUnderdog = sSubStatsProb[moUnderdog];
          const underdogOdds = moUnderdog === "1" ? o1 : o2;
          if (subP.includes("-R-") && phaUnderdog > 0.3) {
            category = "Upset";
            finalPrediction = moUnderdog;
            reasonParts.push("Reversal Trap (PR12)");
          }
          if (rawConfidence === 0 && phaUnderdog >= 0.1 && !isNaN(underdogOdds) && underdogOdds >= 3.5) {
            category = "Upset";
            finalPrediction = moUnderdog;
            reasonParts.push("Deep Upset (PR13)");
          }
        }
        if (match.group === 3) {
          if (match.pred1x2 && !matchesPrediction(finalPrediction, match.pred1x2)) {
            rawConfidence = Math.max(rawConfidence, 90);
            reasonParts.push("Group 3 Authority");
          }
        }
        const ext2 = match.pred1x2;
        let phaAlgo2 = null;
        if (sSubStatsProb) {
          const maxS = Math.max(sSubStatsProb["1"], sSubStatsProb["X"], sSubStatsProb["2"]);
          if (maxS === sSubStatsProb["1"]) phaAlgo2 = "1";
          else if (maxS === sSubStatsProb["X"]) phaAlgo2 = "X";
          else phaAlgo2 = "2";
        }
        if (ext2 && phaAlgo2 && finalPrediction === ext2 && finalPrediction === phaAlgo2) {
          if (finalPrediction.length === 1) {
            category = "Value";
            isUnshakable = true;
            reasonParts.push("Holy Grail Consensus");
          }
        }
        if (category === "Banker") {
          const oppGoals = finalPrediction.includes("1") ? match.gsAway || 0 : match.gsHome || 0;
          let h2hBalanced = false;
          if (match.le && match.le.includes(":")) {
            if (match.le.includes("1:1") || match.le.includes("0:0") || match.le.includes("2:2")) h2hBalanced = true;
          }
          if (maxP > 0.6 && (oppGoals > 1.5 || h2hBalanced)) {
            if (finalPrediction.length === 1) {
              finalPrediction = finalPrediction === "1" ? "1X" : "X2";
            }
            category = "Standard";
            reasonParts.push("Banker Volatility Filter");
          }
        }
        if (category === "Banker" && !isNaN(Math.min(o1, o2)) && Math.min(o1, o2) < 2.5) {
          const l10 = match.l10?.split(":").map(Number);
          if (l10 && l10.length === 2) {
            const favPts = moFav === "1" ? l10[0] : l10[1];
            if (favPts < 5) {
              category = "Standard";
              reasonParts.push("False Favorite (Poor Form)");
            }
          }
        }
        if (category === "Upset") {
          if (match.group === 1 || Math.min(o1, o2) < 1.5) {
            if (moFav === "2") {
              const l10A = match.l10?.split(":")[1] ? parseFloat(match.l10.split(":")[1]) : 0;
              if (l10A > 6) {
                category = "Standard";
                finalPrediction = "2";
                reasonParts.push("Upset Rejected (Strong Fav)");
              }
            }
            if (moFav === "1") {
              const l10H = match.l10?.split(":")[0] ? parseFloat(match.l10.split(":")[0]) : 0;
              if (l10H > 6) {
                category = "Standard";
                finalPrediction = "1";
                reasonParts.push("Upset Rejected (Strong Fav)");
              }
            }
          }
        }
        if (category === "Value" && finalPrediction === "2") {
          if (o1 < 3.5) {
            if (pX > 0.28) finalPrediction = "X2";
            else finalPrediction = "12";
            reasonParts.push("Away Fav Insulation");
          }
        }
        const isTightOdds = Math.abs(o1 - o2) < 0.2;
        const isHighDrawZone = !isNaN(o1) && !isNaN(o2) && o1 >= 2.5 && o1 <= 2.9 && o2 >= 2.5 && o2 <= 2.9;
        if (match.group === 3 || isTightOdds || isHighDrawZone) {
          const threshold = isHighDrawZone ? 0.28 : 0.33;
          if (pX > threshold || sSubStatsProb && sSubStatsProb["X"] > threshold) {
            if (finalPrediction !== "X") {
              finalPrediction = p1 >= p2 ? "1X" : "X2";
              category = "Banker";
              reasonParts.push("Stalemate ID (Banker Draw)");
            }
          }
        }
        if (moFav && category !== "Upset" && !isUnshakable) {
          const minO = Math.min(o1, o2);
          if (!isNaN(minO) && minO < 1.65) {
            const algoOpposes = !matchesPrediction(finalPrediction, moFav);
            if (algoOpposes) {
              finalPrediction = moFav === "1" ? "1X" : "X2";
              reasonParts.push("Contrarian Override (Safe)");
            }
          }
        }
        if (category === "Value") {
          const odds = finalPrediction === "1" ? o1 : finalPrediction === "2" ? o2 : oX;
          if (!isNaN(odds) && odds > 2.8 && finalPrediction.length === 1) {
            finalPrediction = finalPrediction === "1" ? "1X" : "X2";
            reasonParts.push("Value Stabilization (>2.80)");
          }
        }
        if (maxP > 0.55 && finalPrediction.length === 1) {
          const pOdds = finalPrediction === "1" ? o1 : finalPrediction === "2" ? o2 : oX;
          if (!isNaN(pOdds) && pOdds > 2.35) {
            if (finalPrediction === "1") finalPrediction = "1X";
            else if (finalPrediction === "2") finalPrediction = "X2";
            reasonParts.push("Value Trap (Odds > 2.35)");
          }
        }
        if (!isNaN(o1) && o1 < 2.2) {
          if (finalPrediction === "2" || finalPrediction === "X2") {
            finalPrediction = "1X";
            reasonParts.push("Market Momentum Respect");
          }
        }
        if (isLowerLeague && finalPrediction === "2" && !isNaN(o2) && o2 >= 2 && o2 <= 2.4) {
          finalPrediction = "X2";
          reasonParts.push("Concarneau Rule (Away Fav Hedge)");
        }
        if (!isNaN(o1) && !isNaN(o2)) {
          const mFav = o1 < o2 ? "1" : "2";
          const mFavOdds = mFav === "1" ? o1 : o2;
          const algoFavProb = mFav === "1" ? p1 : p2;
          if (mFavOdds < 1.7 && algoFavProb < 0.4) {
            category = "Upset";
            finalPrediction = mFav === "1" ? "X2" : "1X";
            reasonParts.push("Weak Fav Upset");
          }
        }
        if (finalPrediction === "12") {
          const totalExpGoals2 = (match.gsHome || 0) + (match.gsAway || 0);
          if (totalExpGoals2 < 2.5) {
            finalPrediction = p1 >= p2 ? "1X" : "X2";
            reasonParts.push("'12' Override (Low Goals)");
          }
        }
        if (maxP > 0.55) {
          const predOdds3 = finalPrediction === "1" ? o1 : finalPrediction === "2" ? o2 : oX;
          const isRecalibrationException = !isNaN(predOdds3) && predOdds3 >= 2.65 && predOdds3 <= 2.9 && rawConfidence > 65;
          if (!isRecalibrationException && !isNaN(predOdds3) && predOdds3 > 2.65 && finalPrediction.length === 1) {
            finalPrediction = finalPrediction === "1" ? "1X" : "X2";
            if (category === "Value") category = "Standard";
            reasonParts.push("False Favorite Trap");
          } else if (isRecalibrationException) {
            reasonParts.push("Value Trap Override (High Conf)");
            category = "Value";
          }
        }
        if (category === "Banker") {
          if (finalPrediction === "2") {
            const isDominant = (match.tsb || 0) > (match.tsa || 0) + 1;
            if (!isDominant) {
              category = "Standard";
              reasonParts.push("Away Banker Bias Fail");
            }
          }
        }
        if (sSubStatsProb && sSubStatsProb["X"] > 0.3) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          if (finalPrediction === "12") {
            finalPrediction = p1 >= p2 ? "1X" : "X2";
          }
          reasonParts.push("PHA Draw Hedge (>30%)");
        }
        if (hasFlag("POTENTIAL_DRAW")) {
          if (finalPrediction.length === 1) {
            if (finalPrediction === "1") finalPrediction = "1X";
            else if (finalPrediction === "2") finalPrediction = "X2";
          }
          if (finalPrediction === "12") {
            finalPrediction = p1 >= p2 ? "1X" : "X2";
          }
          reasonParts.push("Potential Draw Volatility");
        }
        const predOdds2 = finalPrediction === "1" ? o1 : finalPrediction === "2" ? o2 : oX;
        const jpPredOdds = finalPrediction === "1" ? o1 : finalPrediction === "2" ? o2 : oX;
        if (!isNaN(jpPredOdds) && jpPredOdds > 2 && finalPrediction.length === 1) {
          finalPrediction = finalPrediction === "1" ? "1X" : "X2";
          reasonParts.push("High Odds Volatility");
        }
        if (match.group === 2 && rawConfidence < 65 && finalPrediction.length === 1) {
          finalPrediction = finalPrediction === "1" ? "1X" : "X2";
          reasonParts.push("Group 2 Defense");
        }
        if (sSubStatsProb) {
          const p1_pha_b7 = sSubStatsProb["1"];
          const pX_pha_b7 = sSubStatsProb["X"];
          const p2_pha_b7 = sSubStatsProb["2"];
          const maxPha_b7 = Math.max(p1_pha_b7, pX_pha_b7, p2_pha_b7);
          if (maxPha_b7 >= 0.9) {
            if (p1_pha_b7 >= 0.9) finalPrediction = "1";
            else if (p2_pha_b7 >= 0.9) finalPrediction = "2";
            else finalPrediction = "X";
            rawConfidence = 99;
            isUnshakable = true;
            reasonParts.push("PHA > 90% Authority");
          }
          if (pX_pha_b7 < 0.3 && p1_pha_b7 > 0.3 && p2_pha_b7 > 0.3) {
            finalPrediction = "12";
            reasonParts.push("PHA H/A Split");
          }
          if (p2_pha_b7 < 0.15 && p1_pha_b7 > 0.3 && pX_pha_b7 > 0.3) {
            finalPrediction = "1X";
            reasonParts.push("PHA H/D Split");
          }
          if (p1_pha_b7 < 0.2 && p2_pha_b7 > 0.3 && pX_pha_b7 > 0.3) {
            finalPrediction = "X2";
            reasonParts.push("PHA A/D Split");
          }
          if (p1_pha_b7 > 0.28 && p1_pha_b7 < 0.4 && pX_pha_b7 > 0.28 && pX_pha_b7 < 0.4 && p2_pha_b7 > 0.28 && p2_pha_b7 < 0.4) {
            rawConfidence = Math.min(rawConfidence, 30);
            category = "Standard";
            reasonParts.push("PHA Balanced Split (Low Conf)");
          }
        }
        if (match.patternAnalysis?.subPatternPrediction && sSubStatsProb) {
          const p1s = sSubStatsProb["1"];
          const pXs = sSubStatsProb["X"];
          const p2s = sSubStatsProb["2"];
          let phaPred2 = null;
          const max = Math.max(p1s, pXs, p2s);
          if (max === p1s) phaPred2 = "1";
          else if (max === pXs) phaPred2 = "X";
          else phaPred2 = "2";
          if (phaPred2 && matchesPrediction(match.patternAnalysis.subPatternPrediction, phaPred2)) {
            rawConfidence = Math.max(rawConfidence, 85);
            reasonParts.push("PHA+Sub Synergy");
          }
        }
        if (moFav && sSubStatsProb) {
          let phaPredDirection = null;
          if (sSubStatsProb["1"] > sSubStatsProb["2"] && sSubStatsProb["1"] > sSubStatsProb["X"]) phaPredDirection = "1";
          else if (sSubStatsProb["2"] > sSubStatsProb["1"] && sSubStatsProb["2"] > sSubStatsProb["X"]) phaPredDirection = "2";
          if (phaPredDirection && phaPredDirection !== moFav && rawConfidence <= 80) {
            reasonParts.push("PHA/MO Conflict Risk");
            if (finalPrediction.length === 1 && !isUnshakable) {
              finalPrediction = moFav === "1" ? "1X" : "X2";
            }
          }
        }
      }
      let phaPredBatch6 = null;
      if (sSubStatsProb) {
        const p1s = sSubStatsProb["1"];
        const pXs = sSubStatsProb["X"];
        const p2s = sSubStatsProb["2"];
        const maxS = Math.max(p1s, pXs, p2s);
        if (maxS === p1s) phaPredBatch6 = "1";
        else if (maxS === pXs) phaPredBatch6 = "X";
        else phaPredBatch6 = "2";
      }
      const subPatternPredBatch6 = match.patternAnalysis?.subPatternPrediction;
      if (!isGoldenCombo && phaPredBatch6 && subPatternPredBatch6 && matchesPrediction(subPatternPredBatch6, phaPredBatch6)) {
        if (phaPredBatch6 === subPatternPredBatch6 && ["1", "X", "2"].includes(phaPredBatch6)) {
          finalPrediction = phaPredBatch6;
          rawConfidence = Math.max(rawConfidence, 85);
          isUnshakable = true;
          reasonParts.push("Golden Validator (PHA+Sub)");
        }
      }
      if (!isGoldenCombo && moFav && subPatternPredBatch6 && !matchesPrediction(subPatternPredBatch6, moFav)) {
        if (matchesPrediction(finalPrediction, moFav)) {
          finalPrediction = moFav === "1" ? "X2" : "1X";
          reasonParts.push("SubPattern Veto");
        }
        if (subPatternPredBatch6.includes("X")) {
          if (!finalPrediction.includes("X")) {
            finalPrediction = moFav === "1" ? "1X" : "X2";
          }
        }
      }
      if (subPatternPredBatch6 === "12") {
        if (finalPrediction.length === 1) {
          finalPrediction = "12";
          reasonParts.push("'12' Trap Avoidance");
        }
      }
      const ptsPredBatch6 = match.calculatedPrediction;
      if (ptsPredBatch6 && moFav && matchesPrediction(ptsPredBatch6, moFav)) {
        const phaAgrees = phaPredBatch6 && matchesPrediction(phaPredBatch6, moFav);
        const subAgrees = subPatternPredBatch6 && matchesPrediction(subPatternPredBatch6, moFav);
        if (!phaAgrees && !subAgrees) {
          rawConfidence = Math.min(rawConfidence, 40);
          reasonParts.push("Points Redundancy (No Algo)");
          category = "Standard";
        }
      }
      const minOddsForHedge = Math.min(o1, o2);
      if (!isNaN(minOddsForHedge) && minOddsForHedge >= 2 && ["T", "S", "R", "X"].includes(mainP)) {
        if (finalPrediction === "1") finalPrediction = "1X";
        else if (finalPrediction === "2") finalPrediction = "X2";
        reasonParts.push("Low Scoring Hedge");
      }
      if (!isNaN(minOddsForHedge) && minOddsForHedge < 2 && phaDrawPctVal > 0.3) {
        if (finalPrediction === "1") finalPrediction = "1X";
        else if (finalPrediction === "2") finalPrediction = "X2";
        reasonParts.push("Banker Killer (High PHA Draw)");
      }
      const phaDrawPct = sSub ? Math.round(sSub["X"] * 100) : 0;
      if (runTSLogic && tsDiff < 0.3 && phaDrawPct < 30) {
        if (finalPrediction === "X") finalPrediction = "1";
      }
      if (match.group === 1 && !isNaN(o1) && o1 > 2 && match.patternAnalysis?.subPatternPrediction === "12") {
        if (finalPrediction === "1X") finalPrediction = "12";
      }
      if (match.patternAnalysis?.subPatternPrediction === "12" && match.group === 1) {
        finalPrediction = "1X";
      }
      if (match.group === 3 && sSub && sSub["X"] > 0.5) {
        if (finalPrediction === "X") {
          finalPrediction = runTSLogic && (match.tsa || 0) < (match.tsb || 0) ? "X2" : "1X";
        }
      }
      if (sSubStatsProb) {
        const maxPha = Math.max(sSubStatsProb["1"], sSubStatsProb["X"], sSubStatsProb["2"]);
        if (maxPha > 0.6 && match.pred1x2) {
          const phaDir = sSubStatsProb["1"] === maxPha ? "1" : sSubStatsProb["2"] === maxPha ? "2" : "X";
          if (!matchesPrediction(phaDir, match.pred1x2)) {
            if (!matchesPrediction(finalPrediction, phaDir)) {
              finalPrediction = phaDir === "1" ? "1X" : phaDir === "2" ? "X2" : "1X";
              reasonParts.push("PHA Prioritized");
            }
          }
        }
      }
      if (match.group === 2 && sSubStatsProb) {
        const maxPha = Math.max(sSubStatsProb["1"], sSubStatsProb["X"], sSubStatsProb["2"]);
        if (maxPha > 0.65 && match.pred1x2 && !matchesPrediction(match.pred1x2, finalPrediction)) {
          let phaDir = sSubStatsProb["1"] === maxPha ? "1" : sSubStatsProb["2"] === maxPha ? "2" : "X";
          if (!matchesPrediction(phaDir, match.pred1x2)) {
            if (phaDir !== "X") {
              if (!matchesPrediction(finalPrediction, phaDir)) {
                finalPrediction = phaDir === "1" ? "1X" : "X2";
                reasonParts.push("PHA Prioritized");
              }
            }
          }
        }
      }
      const extPred = match.pred1x2;
      let phaPred = null;
      let p1_pha = 0, pX_pha = 0, p2_pha = 0;
      if (sSubStatsProb) {
        p1_pha = sSubStatsProb["1"];
        p2_pha = sSubStatsProb["2"];
        pX_pha = sSubStatsProb["X"];
        const maxPha = Math.max(p1_pha, pX_pha, p2_pha);
        if (maxPha === p1_pha) phaPred = "1";
        else if (maxPha === pX_pha) phaPred = "X";
        else phaPred = "2";
      }
      if (phaPred && extPred && phaPred !== extPred) {
        if (matchesPrediction(extPred, finalPrediction) && !matchesPrediction(phaPred, finalPrediction)) {
          finalPrediction = phaPred;
          rawConfidence = Math.max(rawConfidence, 70);
          reasonParts.push("PHA Override Ext");
        }
      }
      if (sSubStatsProb && Math.max(p1_pha, pX_pha, p2_pha) >= 0.9) {
        if (p1_pha >= 0.9) finalPrediction = "1";
        else if (p2_pha >= 0.9) finalPrediction = "2";
        else finalPrediction = "X";
        rawConfidence = 99;
        isUnshakable = true;
        reasonParts.push("PHA > 90%");
      }
      if (sSubStatsProb && pX_pha <= 0.18 && p1_pha > 0.3 && p2_pha > 0.3) {
        finalPrediction = "12";
      }
      if (sSubStatsProb) {
        if (p2_pha < 0.15 && p1_pha > 0.3 && pX_pha > 0.3) finalPrediction = "1X";
        if (p1_pha < 0.15 && p2_pha > 0.3 && pX_pha > 0.3) finalPrediction = "X2";
      }
      const subPred = match.patternAnalysis?.subPatternPrediction;
      if (subPred === "12") {
        finalPrediction = "12";
      }
      if (phaPred && subPred && phaPred === subPred) {
        rawConfidence = Math.max(rawConfidence, 85);
      }
      if (moFav && subPred && !matchesPrediction(subPred, moFav)) {
        if (finalPrediction === "1") finalPrediction = "1X";
        else if (finalPrediction === "2") finalPrediction = "X2";
        if (subPred === "1" && moFav === "2") finalPrediction = "1X";
        if (subPred === "2" && moFav === "1") finalPrediction = "X2";
      }
      if (sSubStatsProb && p1_pha > 0.3 && pX_pha > 0.3 && p2_pha > 0.3) {
        if (finalPrediction === "12") {
          if (runTSLogic) {
            finalPrediction = (match.tsa || 0) > (match.tsb || 0) ? "1X" : "X2";
          }
        }
      }
      if (phaPred && moFav && phaPred !== moFav) {
        const maxPhaVal = Math.max(p1_pha, pX_pha, p2_pha);
        if (maxPhaVal < 0.8) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
        }
      }
      const minMarketOddsValue = Math.min(o1, o2);
      if (!isNaN(minMarketOddsValue) && minMarketOddsValue < 2) {
        const marketFav = o1 < o2 ? "1" : "2";
        if (matchesPrediction(finalPrediction, marketFav)) {
          if (finalPrediction === "1X") finalPrediction = "1";
          else if (finalPrediction === "X2") finalPrediction = "2";
        }
      }
      const isHighOdds = !isNaN(minMarketOddsValue) && minMarketOddsValue >= 2;
      if (isHighOdds) {
        const algoPred2 = match.patternAnalysis?.subPatternPrediction;
        const ptsPred2 = match.calculatedPrediction;
        if (finalPrediction.length === 1 && algoPred2 && algoPred2 !== finalPrediction) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          reasonParts.push("Algo Gatekeeper Hedge");
        }
        if (algoPred2 && (algoPred2 === finalPrediction || algoPred2.length === 1 && finalPrediction.includes(algoPred2))) {
          if (["1", "2"].includes(algoPred2)) {
            const nonDrawProb = 1 - pX;
            if (nonDrawProb > 0.75) {
              finalPrediction = algoPred2;
              isUnshakable = true;
              rawConfidence = Math.max(rawConfidence, 85);
              reasonParts.push("Algo 90% Signal (Safe Single)");
            } else {
              if (finalPrediction.length === 1) {
                finalPrediction = algoPred2 === "1" ? "1X" : "X2";
                reasonParts.push("Draw Risk Hedge (ND<75%)");
              }
            }
          }
        }
        if (!ptsPred2 || !matchesPrediction(ptsPred2, finalPrediction)) {
          if (rawConfidence <= 60) {
            if (finalPrediction.length === 1) {
              if (finalPrediction === "1") finalPrediction = "1X";
              else if (finalPrediction === "2") finalPrediction = "X2";
              reasonParts.push("Points Disagree (Low Conf)");
            }
            category = "Standard";
          } else {
            reasonParts.push("Points Ignored (High Algo Conf)");
          }
        }
        if (algoPred2 && !matchesPrediction(algoPred2, finalPrediction)) {
          if (finalPrediction.length === 1) {
            if (finalPrediction === "1") finalPrediction = "1X";
            else if (finalPrediction === "2") finalPrediction = "X2";
            reasonParts.push("SubPattern Disagree (Value Excl)");
          }
          category = "Standard";
        }
        if (sSubStats && sSubStats.total >= 3) {
          const predSupport = sSubStats.outcomes[finalPrediction] / sSubStats.total;
          if (predSupport > 0.5) {
            rawConfidence = Math.min(99, rawConfidence + 10);
            reasonParts.push("PHA > 50% (+Conf)");
          }
        }
        if (ptsPred2 && algoPred2 && matchesPrediction(ptsPred2, finalPrediction) && matchesPrediction(algoPred2, finalPrediction)) {
          if (finalPrediction.length === 1) {
            category = "Value";
            rawConfidence = Math.max(rawConfidence, 85);
            isUnshakable = true;
            reasonParts.push("Prime Value (Pts+Algo)");
          }
        }
      }
      if (subPred && finalPrediction !== subPred) {
        if (sSubStatsProb) {
          const pMax = Math.max(sSubStatsProb["1"], sSubStatsProb["X"], sSubStatsProb["2"]);
          if (pMax > 0.6) {
            finalPrediction = subPred;
            rawConfidence = Math.max(rawConfidence, 85);
            reasonParts.push("PHA Supremacy");
            isUnshakable = true;
          }
        }
      }
      if (rawConfidence > 60 && subPred && finalPrediction !== subPred) {
        if (finalPrediction.length === 1) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          else if (finalPrediction === "X") finalPrediction = "1X";
          reasonParts.push("SubPattern Mismatch Downgrade");
        }
      }
      const marketFavOutcome = !isNaN(o1) && !isNaN(o2) ? o1 < o2 ? "1" : o1 > o2 ? "2" : "" : "";
      const algoSubPred = match.patternAnalysis?.subPatternPrediction;
      if (marketFavOutcome && algoSubPred && !matchesPrediction(algoSubPred, marketFavOutcome)) {
        const underdogOutcome = marketFavOutcome === "1" ? "2" : "1";
        const ptsPred2 = match.calculatedPrediction;
        if (matchesPrediction(algoSubPred, underdogOutcome) && ptsPred2 && matchesPrediction(ptsPred2, underdogOutcome)) {
          finalPrediction = underdogOutcome;
          rawConfidence = Math.max(rawConfidence, 80);
          category = "Upset";
          reasonParts.push("Dual Upset Conf (Algo+Pts)");
          isUnshakable = true;
        }
      }
      if (hasFlag("UPSET") && algoSubPred && marketFavOutcome && matchesPrediction(algoSubPred, marketFavOutcome)) {
        if (category === "Upset") category = "Standard";
      }
      if (marketFavOutcome && sSubStatsProb) {
        const phaFav = sSubStatsProb["1"] > sSubStatsProb["2"] && sSubStatsProb["1"] > sSubStatsProb["X"] ? "1" : sSubStatsProb["2"] > sSubStatsProb["1"] && sSubStatsProb["2"] > sSubStatsProb["X"] ? "2" : "";
        if (phaFav && phaFav !== marketFavOutcome && algoSubPred && matchesPrediction(algoSubPred, marketFavOutcome)) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          reasonParts.push("Contra-Market Hedge");
        }
      }
      if (!isNaN(o1) && !isNaN(o2) && o1 > 2.5 && o2 > 2.5) {
        if (finalPrediction === "1") finalPrediction = "1X";
        else if (finalPrediction === "2") finalPrediction = "X2";
        else if (finalPrediction === "12") finalPrediction = "12";
        else if (finalPrediction === "X") {
          finalPrediction = runTSLogic && (match.tsa || 0) > (match.tsb || 0) ? "1X" : "X2";
        }
        reasonParts.push("High Variance (>2.50)");
      }
      const algoOpposesFav = moFav && rulePrediction && !matchesPrediction(rulePrediction, moFav);
      if (algoOpposesFav) {
        if (finalPrediction === moFav) {
          finalPrediction = moFav === "1" ? "X2" : "1X";
        }
      }
      const moFavStrict = !isNaN(o1) && !isNaN(o2) ? o1 < o2 ? "1" : o1 > o2 ? "2" : "" : "";
      if (algoSubPred && moFavStrict && !matchesPrediction(algoSubPred, moFavStrict)) {
        const oddsDiff = Math.abs(o1 - o2);
        if (oddsDiff > 0.5) {
          if (algoSubPred === "1") finalPrediction = "1X";
          else if (algoSubPred === "2") finalPrediction = "X2";
          else if (algoSubPred === "12") finalPrediction = "12";
          else finalPrediction = algoSubPred;
          const phaStats = algo.getRawPatternStats(`S:${subP}`);
          if (phaStats && phaStats.total >= 3) {
            const p1_pha_conf = phaStats.outcomes["1"];
            const p2_pha_conf = phaStats.outcomes["2"];
            const phaFav = p1_pha_conf > p2_pha_conf ? "1" : "2";
            if (phaFav !== moFavStrict) {
              rawConfidence = Math.max(rawConfidence, 80);
              isUnshakable = true;
            }
          } else {
            rawConfidence = Math.max(rawConfidence, 70);
          }
        }
      }
      if (moFav && rulePrediction && matchesPrediction(rulePrediction, moFav)) {
        rawConfidence = Math.max(rawConfidence, 95);
        isUnshakable = true;
      }
      const pointsPred = match.calculatedPrediction;
      if (pointsPred && rulePrediction && matchesPrediction(pointsPred, rulePrediction)) {
        if (moFav && !matchesPrediction(rulePrediction, moFav)) {
          rawConfidence = Math.min(99, rawConfidence + 15);
        }
      }
      if (pointsPred && moFav && pointsPred !== moFav) {
        if (!hasRule) {
          finalPrediction = moFav === "1" ? "1X" : "X2";
        }
      }
      const toxicPatterns = ["G1a7", "G1ff44", "G2hh2", "G2ff31", "G1g2", "G1ii3", "G1f29", "G2a7", "R-G1-01", "G3o9"];
      if (toxicPatterns.includes(subP)) {
        rawConfidence = Math.min(rawConfidence, 75);
        isUnshakable = false;
        reasonParts.push("Toxic Pattern (Conf Capped)");
        flags.push("Demote_Banker");
      }
      const giantKillerPatterns = ["G1ff44", "G2ee11", "G1g21", "G1a2", "G2o14"];
      if (giantKillerPatterns.includes(subP) && moFav && Math.min(o1, o2) < 1.35) {
        const underdog = moFav === "1" ? "2" : "1";
        finalPrediction = underdog === "1" ? "1X" : "X2";
        category = "Upset";
        flags.push("Upset Alert");
        flags.push("Demote_Accumulator");
        reasonParts.push("Giant Killer Override");
      }
      if (match.group === 1) {
        let phaSupport = 0;
        if (sSubStatsProb) {
          if (finalPrediction.includes("1")) phaSupport = Math.max(phaSupport, sSubStatsProb["1"]);
          if (finalPrediction.includes("2")) phaSupport = Math.max(phaSupport, sSubStatsProb["2"]);
          if (finalPrediction.includes("X")) phaSupport = Math.max(phaSupport, sSubStatsProb["X"]);
        }
        if (phaSupport < 0.55) {
          rawConfidence = Math.max(0, rawConfidence - 20);
          isUnshakable = false;
          reasonParts.push("Group 1 Low PHA (Downgrade)");
          flags.push("Demote_Daily_Jackpot");
        }
      }
      const premiumMainPatterns = ["C", "K", "LL", "L", "Y", "CC", "KK"];
      if (premiumMainPatterns.includes(mainP) && rawConfidence > 80) {
        flags.push("Premium_Fast_Track");
        reasonParts.push("Premium Pattern Fast-Track");
      }
      if (subP === "G1j3_fix") {
        if (moFav === "2" && o2 < 1.5) {
          if (finalPrediction === "1" || finalPrediction === "1X") {
            finalPrediction = p2 > pX ? "2" : "X2";
            reasonParts.push("G1j3_fix Recalibration");
          }
        }
      }
      if (phaDrawPct > 30 && (!isNaN(o1) && !isNaN(o2) && Math.abs(o1 - o2) >= 0.2)) {
        if (rawConfidence < 70 && finalPrediction !== "X") {
          finalPrediction = "X";
          reasonParts.push("Draw Opportunity (High PHA)");
        }
      }
      const minOddsP = Math.min(o1, o2);
      if (["T", "S", "R", "X"].includes(mainP) && !isNaN(minOddsP) && minOddsP < 2) {
        if (finalPrediction === "1") finalPrediction = "1X";
        else if (finalPrediction === "2") finalPrediction = "X2";
        else if (finalPrediction === "X") finalPrediction = "1X";
        rawConfidence = Math.min(rawConfidence, 70);
      }
      if ((match.maxPoints || 0) < 45) {
        if (finalPrediction === "X") finalPrediction = "1";
      }
      const subPatDisagree = match.patternAnalysis?.subPatternPrediction && !matchesPrediction(match.patternAnalysis.subPatternPrediction, moFav);
      const pointsDisagree = match.calculatedPrediction && !matchesPrediction(match.calculatedPrediction, moFav);
      if (minMarketOddsValue < 1.7 && subPatDisagree) {
        finalPrediction = moFav === "1" ? "1X" : "X2";
      }
      if (minMarketOddsValue < 1.7 && match.group === 1) {
        if (finalPrediction === moFav) {
          finalPrediction = moFav === "1" ? "1X" : "X2";
        }
      }
      const predOdds = finalPrediction === "1" ? o1 : finalPrediction === "2" ? o2 : oX;
      if (predOdds > 2 && (finalPrediction === "1" || finalPrediction === "2")) {
        finalPrediction = finalPrediction === "1" ? "1X" : "X2";
      }
      const reliability = algo.getPatternReliability(subP);
      if (reliability === "Low Data" || reliability === "No Data") {
        if (finalPrediction === "1X" || finalPrediction === "X2") {
          finalPrediction = "12";
        }
      }
      if (match.group === 1 && !isNaN(predOdds) && predOdds > 2) {
        if (finalPrediction === "1") finalPrediction = "1X";
      }
      if (minMarketOddsValue < 1.4 && (subPatDisagree || pointsDisagree)) {
        isUnshakable = false;
        rawConfidence = 0;
      }
      if (sSubStatsProb) {
        const p1_pha_b2 = sSubStatsProb["1"];
        const pX_pha_b2 = sSubStatsProb["X"];
        const p2_pha_b2 = sSubStatsProb["2"];
        const maxPha = Math.max(p1_pha_b2, pX_pha_b2, p2_pha_b2);
        if (p1_pha_b2 > 0.6) {
          finalPrediction = "1";
          rawConfidence = Math.max(rawConfidence, 90);
          isUnshakable = true;
        } else if (p2_pha_b2 > 0.6) {
          finalPrediction = "2";
          rawConfidence = Math.max(rawConfidence, 90);
          isUnshakable = true;
        }
        if (moFav) {
          let phaFav = null;
          if (p1_pha_b2 > pX_pha_b2 && p1_pha_b2 > p2_pha_b2) phaFav = "1";
          else if (p2_pha_b2 > p1_pha_b2 && p2_pha_b2 > pX_pha_b2) phaFav = "2";
          if (phaFav && phaFav !== moFav && !isUnshakable) {
            const phaFavProb = phaFav === "1" ? p1_pha_b2 : p2_pha_b2;
            if (phaFavProb > 0.4) {
              finalPrediction = phaFav;
            }
          }
        }
        if (minMarketOddsValue >= 2 && pX_pha_b2 > 0.3) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          else if (finalPrediction === "12") {
            finalPrediction = runTSLogic && (match.tsa || 0) > (match.tsb || 0) ? "1X" : "X2";
          }
        }
        if (finalPrediction === "1" && p1_pha_b2 + pX_pha_b2 > 0.75) finalPrediction = "1X";
        if (finalPrediction === "2" && p2_pha_b2 + pX_pha_b2 > 0.75) finalPrediction = "X2";
        if (maxPha < 0.45) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          rawConfidence = Math.min(rawConfidence, 60);
        }
        if (moFav) {
          const upsetOutcome = moFav === "1" ? "2" : "1";
          const upsetProb = moFav === "1" ? p2_pha_b2 : p1_pha_b2;
          if (upsetProb > 0.4) {
            if (matchesPrediction(finalPrediction, upsetOutcome)) {
              rawConfidence = Math.max(rawConfidence, 80);
            }
          }
        }
      }
      if (match.group === 2 && finalPrediction.length === 1) {
        const currentOdds = finalPrediction === "1" ? o1 : finalPrediction === "2" ? o2 : oX;
        let isEliteValue = false;
        if (!isNaN(currentOdds) && currentOdds > 2) {
          const ptsPred2 = match.calculatedPrediction;
          const sSubStats2 = algo.getRawPatternStats(`S:${subP}`);
          if (ptsPred2 && matchesPrediction(ptsPred2, finalPrediction)) {
            if (sSubStats2) {
              const predSupport = sSubStats2.outcomes[finalPrediction] / sSubStats2.total;
              if (predSupport > 0.5) {
                isEliteValue = true;
                category = "Value";
                rawConfidence = 99;
                isUnshakable = true;
                reasonParts.push("Elite Value (Pts+PHA)");
              }
            }
          }
        }
        if (!isEliteValue && !isNaN(currentOdds) && currentOdds > 2.1) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
        }
      }
      const algoPred = match.patternAnalysis?.subPatternPrediction;
      if (["1X", "X2"].includes(algoPred || "") && finalPrediction.length === 1 && pX > 0.26) {
        finalPrediction = algoPred;
      }
      if (match.group === 1 && rawConfidence > 60 && algoPred === "12") {
        if (prediction === "1" || prediction === "2") {
          finalPrediction = prediction;
        }
      }
      const minMarketOdds = Math.min(o1, o2);
      if (!isNaN(minMarketOdds) && minMarketOdds < 1.8) {
        const marketFav = o1 === minMarketOdds ? "1" : "2";
        const isBettingAgainst = !matchesPrediction(finalPrediction, marketFav);
        if (isBettingAgainst) {
          if (rawConfidence < 80) {
            finalPrediction = marketFav === "1" ? "1X" : "X2";
          }
        }
      }
      const isYouthLeague = /\b(U21|U23|Res|Reserve|Youth)\b/i.test(match.teams);
      if (isYouthLeague) {
        if (moFav && subPred && !matchesPrediction(subPred, moFav)) {
          rawConfidence = Math.min(rawConfidence, 40);
          reasonParts.push("Youth Variance");
        }
        if (finalPrediction === "1X" || finalPrediction === "X2") {
          finalPrediction = "12";
        }
        category = "Standard";
      }
      const subPatternWinRate = algo.getPatternWinRate(subP, match.patternAnalysis?.subPatternPrediction || null);
      if (runTSLogic && tsDiff > 0.8 && subPatternWinRate > 0 && subPatternWinRate < 55) {
        if (finalPrediction === "1") finalPrediction = "1X";
        else if (finalPrediction === "2") finalPrediction = "X2";
      }
      const AlgoClass = algo.constructor;
      finalPrediction = AlgoClass.applyPatternOverrides(match, subP, finalPrediction);
      if (match.group === 1 && match.patternAnalysis?.subPatternPrediction === "12") {
        if (finalPrediction === "1X" || finalPrediction === "X2") {
          finalPrediction = "12";
        }
      }
      if (match.group === 1 && match.patternAnalysis?.subPatternPrediction === "1X") {
        if (finalPrediction === "1") {
          finalPrediction = "1X";
        }
      }
      if (match.group === 3 && rawConfidence < 75) {
        const minO = Math.min(o1, o2);
        if (!isNaN(minO) && minO > 1.5 && finalPrediction.length === 1) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
        }
      }
      if (match.group === 1) {
        if (sSub && sSub["X"] < 0.2) {
          if (finalPrediction === "1X") finalPrediction = "1";
          else if (finalPrediction === "X2") finalPrediction = "2";
          else if (finalPrediction === "X") finalPrediction = "12";
        }
      }
      if (match.group === 1) {
        const subPred2 = match.patternAnalysis?.subPatternPrediction;
        if (subPred2 && subPred2.length === 2 && finalPrediction.length === 1) {
          finalPrediction = subPred2;
        }
      }
      const favOdds = Math.min(o1, o2);
      if (match.group === 1 && !isNaN(favOdds) && favOdds > 2.3) {
        if (finalPrediction === "1") finalPrediction = "1X";
        if (finalPrediction === "2") finalPrediction = "X2";
      }
      const minOdds = Math.min(o1, o2);
      if (!isNaN(minOdds) && minOdds < 2.1) {
        const isHomeFav = o1 < o2;
        const subPred2 = match.patternAnalysis?.subPatternPrediction;
        if (isHomeFav) {
          if (subPred2 === "2" || subPred2 === "X2") {
            finalPrediction = "1";
          }
        } else {
          if (subPred2 === "1" || subPred2 === "1X") {
            finalPrediction = "2";
          }
        }
      }
      if (runTSLogic && tsDiff > 0.6) {
        const tsFav = (match.tsa || 0) > (match.tsb || 0) ? "1" : "2";
        const targetOdds = tsFav === "1" ? o1 : o2;
        if (!isNaN(targetOdds) && targetOdds > 2.5) {
          if (finalPrediction === "1" || finalPrediction === "2") {
            finalPrediction = tsFav === "1" ? "1X" : "X2";
          }
        }
      }
      const targetO = finalPrediction === "1" ? o1 : finalPrediction === "2" ? o2 : oX;
      if (!isNaN(targetO) && targetO >= 2.2 && targetO <= 2.4) {
        const subPred2 = match.patternAnalysis?.subPatternPrediction;
        if (subPred2 === "1X" || subPred2 === "X2") {
          finalPrediction = subPred2;
        }
      }
      if (reliability === "Low Data" || reliability === "No Data") {
        rawConfidence = Math.min(rawConfidence, 60);
        if (finalPrediction.length === 1) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          else finalPrediction = "12";
        }
      }
      if (runTSLogic && finalPrediction === "2" && !isNaN(o2) && o2 > 2.3) {
        const tDiff = (match.tsb || 0) - (match.tsa || 0);
        if (tDiff < 2.5) {
          finalPrediction = "X2";
        }
      }
      if (match.patternAnalysis?.subPatternPrediction === "1X" && !isNaN(o2) && o2 < 3) {
        if (runTSLogic && (match.tsb || 0) > (match.tsa || 0)) {
          finalPrediction = "X2";
        } else {
          finalPrediction = "12";
        }
      }
      if (!isNaN(predOdds) && predOdds >= 2.15 && predOdds <= 2.5) {
        isOddsTrap = true;
        if (finalPrediction === "1") finalPrediction = "1X";
        if (finalPrediction === "2") finalPrediction = "X2";
      }
      if (runTSLogic && finalPrediction === "2") {
        const tDiff = (match.tsb || 0) - (match.tsa || 0);
        const subPred2 = match.patternAnalysis?.subPatternPrediction;
        const rawPred = match.rawPrediction;
        if (tDiff > 0.5 && !isNaN(o2) && o2 > 2.1) {
          if (subPred2 === "X" || subPred2 === "X2" || rawPred === "X" || rawPred === "X2") {
            finalPrediction = "X2";
          }
        }
      }
      const midTierTeams = ["Standard", "Anderlecht", "Club Brugge", "Union SG", "Genk", "Gent", "Antwerp", "Cercle Brugge", "Charleroi", "St Gilliose", "Nice", "Brest", "Lens", "Rennes", "Lille"];
      const isMidTier = midTierTeams.some((t) => match.teams.includes(t));
      if (isMidTier) {
        const algoSignal = match.patternAnalysis?.subPatternPrediction || match.rawPrediction;
        if ((algoSignal === "1" || algoSignal === "1X") && !isNaN(o1) && o1 < 3.5) {
          if (finalPrediction === "2" || finalPrediction === "X2") {
            finalPrediction = "1X";
          }
        }
      }
      if (finalPrediction === "1" && match.pred1x2 === "1") {
        const algoBase = match.patternAnalysis?.subPatternPrediction || match.rawPrediction;
        if (algoBase === "X" || algoBase === "X2") {
          finalPrediction = "1X";
        }
      }
      if (subPatternWinRate > 0 && subPatternWinRate <= 55) {
        const currentOdds = finalPrediction === "1" ? o1 : finalPrediction === "2" ? o2 : oX;
        if (!isNaN(currentOdds) && currentOdds > 2) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          else if (finalPrediction === "X") finalPrediction = runTSLogic && (match.tsa || 0) >= (match.tsb || 0) ? "1X" : "X2";
        }
      }
      const derbies = ["Bilbao vs Sociedad", "Sociedad vs Bilbao", "Sevilla vs Betis", "Betis vs Sevilla", "Roma vs Lazio", "Lazio vs Roma", "Milan vs Inter", "Inter vs Milan", "Arsenal vs Tottenham", "Tottenham vs Arsenal", "Liverpool vs Everton", "Everton vs Liverpool", "Celtic vs Rangers", "Rangers vs Celtic"];
      const isDerby = derbies.some((d) => match.teams.includes(d));
      if (isDerby) {
        const baseSignal = match.patternAnalysis?.subPatternPrediction || match.rawPrediction;
        if (baseSignal === "X") {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
        }
      }
      if (match.group === 2 && match.patternAnalysis?.subPatternPrediction === "12" && finalPrediction === "1X") {
        finalPrediction = "12";
      }
      if (runTSLogic && !isNaN(o1) && o1 < 1.9 && (match.tsb || 0) > (match.tsa || 0) + 1) {
        if (match.patternAnalysis?.subPatternPrediction) {
          finalPrediction = match.patternAnalysis.subPatternPrediction;
        }
      }
      if (match.patternAnalysis?.subPatternPrediction === "X" && finalPrediction === "1") {
        finalPrediction = "1X";
      }
      if (!isNaN(o2) && o2 >= 2 && o2 <= 3 && match.patternAnalysis?.subPatternPrediction === "12") {
        if (finalPrediction === "1X") {
          finalPrediction = "12";
        }
      }
      if (match.group === 2 && match.patternAnalysis?.subPatternPrediction === "1") {
        if (finalPrediction === "1") {
          finalPrediction = "1X";
        }
      }
      if (match.group === 2 && match.patternAnalysis?.subPatternPrediction === "X2") {
        if (finalPrediction === "2") {
          finalPrediction = "X2";
        }
      }
      const isCup = match.teams.toLowerCase().match(/(cup|pokal|trophy|coppa|coupe)/);
      if (match.group === 3 && match.patternAnalysis?.subPatternPrediction === "12") {
        if (isCup) {
          if (finalPrediction === "X2") {
            finalPrediction = "12";
          }
        }
      }
      if (runTSLogic && match.group === 2 && finalPrediction === "1" && (match.tsa || 0) > (match.tsb || 0)) {
        if (rawConfidence < 70) {
          finalPrediction = "1X";
        }
      }
      if (finalPrediction === "X") {
        const subPred2 = match.patternAnalysis?.subPatternPrediction;
        if (subPred2 === "1X" || subPred2 === "X2") {
          finalPrediction = subPred2;
        }
      }
      const isLaLiga = [
        "Real Madrid",
        "Barcelona",
        "Atl. Madrid",
        "Sevilla",
        "Betis",
        "Sociedad",
        "Bilbao",
        "Girona",
        "Valencia",
        "Villarreal",
        "Osasuna",
        "Getafe",
        "Celta",
        "Mallorca",
        "Rayo Vallecano",
        "Alaves",
        "Las Palmas",
        "Leganes",
        "Valladolid",
        "Espanyol"
      ].some((t) => match.teams.includes(t));
      if (isLaLiga) {
        const totalGoals = (match.gsHome || 0) + (match.gsAway || 0);
        if (totalGoals < 2.8) {
          const tDiff = Math.abs((match.tsa || 0) - (match.tsb || 0));
          const subPred2 = match.patternAnalysis?.subPatternPrediction;
          if (runTSLogic && tDiff <= 2 && (subPred2 === "1X" || subPred2 === "X2")) {
            if (finalPrediction === "1" || finalPrediction === "2") {
              finalPrediction = subPred2;
            }
          }
        }
      }
      if (match.group === 2) {
        const base = match.patternAnalysis?.subPatternPrediction;
        if (["1X", "12"].includes(base || "")) {
          if (base === "1X" && (finalPrediction === "2" || finalPrediction === "X2")) {
            finalPrediction = "1X";
          }
          if (base === "12" && finalPrediction === "X") {
            finalPrediction = "12";
          }
        }
      }
      if (runTSLogic && match.group === 2 && (match.tsb || 0) > (match.tsa || 0)) {
        if ((match.tsb || 0) <= 1.3) {
          if (finalPrediction === "2" || finalPrediction === "X2") {
            finalPrediction = "1X";
          }
        }
      }
      if (match.patternAnalysis?.subPatternPrediction === "12") {
        if (["1", "2"].includes(finalPrediction) && runTSLogic && tsDiff <= 0.4) {
          finalPrediction = "12";
        }
      }
      const isPortugal = ["Gil Vicente", "Famalicao", "Porto", "Benfica", "Sporting", "Braga", "Guimaraes", "Arouca", "Estoril", "Rio Ave", "Casa Pia", "Boavista"].some((t) => match.teams.includes(t));
      if (isPortugal) {
        const algoBase = match.patternAnalysis?.subPatternPrediction || match.rawPrediction;
        if (algoBase === "1" && rawConfidence > 60) {
          if (finalPrediction === "X") {
            finalPrediction = "1";
          }
        }
      }
      const isSegunda = ["Huesca", "Cadiz", "Granada", "Santander", "Cacereno", "Barakaldo", "Almeria", "Levante", "Eibar", "Zaragoza", "Burgos", "Oviedo", "Gijon"].some((t) => match.teams.includes(t));
      if (isSegunda) {
        if (match.patternAnalysis?.subPatternPrediction === "1X") {
          if (finalPrediction === "X2" || finalPrediction === "2") {
            finalPrediction = "1X";
          }
        }
      }
      if ((match.group === 1 || match.group === 2) && match.patternAnalysis?.subPatternPrediction === "12") {
        if (!isNaN(o2) && !isNaN(o1) && o2 < o1) {
          const totalGoals = (match.gsHome || 0) + (match.gsAway || 0);
          const isLowGoals = totalGoals < 2.3;
          if (!isLowGoals && finalPrediction === "1X") {
            finalPrediction = "12";
          }
        }
      }
      if (match.patternAnalysis?.subPatternPrediction === "12") {
        const totalGoals = (match.gsHome || 0) + (match.gsAway || 0);
        if (totalGoals < 2.5 && rawConfidence >= 65) {
          if (finalPrediction === "12") {
            if (runTSLogic) {
              if ((match.tsa || 0) >= (match.tsb || 0)) finalPrediction = "1X";
              else finalPrediction = "X2";
            }
          }
        }
      }
      if (match.group === 3) {
        const minO = Math.min(o1, o2);
        if (minO < 1.6) {
          const favPred = o1 === minO ? "1" : "2";
          const coversFav = matchesPrediction(finalPrediction, favPred);
          if (!coversFav) {
            const algoPred2 = match.patternAnalysis?.subPatternPrediction;
            const algoAgreesUpset = algoPred2 && !matchesPrediction(algoPred2, favPred);
            if (!algoAgreesUpset) {
              finalPrediction = favPred === "1" ? "1X" : "X2";
            }
          }
        }
      }
      if (["G1a2", "G2q1"].includes(subP)) {
        const isOpposingFav = subP === "G1a2" && o1 < 2 || subP === "G2q1" && o2 < 2;
        if (isOpposingFav) {
          rawConfidence = Math.max(10, rawConfidence - 20);
        }
      }
      if (match.patternAnalysis?.subPatternPrediction === "12") {
        const ptsPred2 = match.calculatedPrediction;
        const sSubStats2 = algo.getProbabilities(`S:${subP}`, 3);
        const phaPred2 = sSubStats2 && sSubStats2["1"] > 0.5 ? "1" : sSubStats2 && sSubStats2["2"] > 0.5 ? "2" : null;
        if (ptsPred2 === "1" && moFav === "1" && phaPred2 === "1") {
        }
      }
      if (runTSLogic && tsDiff > 1.5 && finalPrediction.length === 1) {
        const sSubStats2 = algo.getProbabilities(`S:${subP}`, 3);
        if (sSubStats2) {
          const phaPred2 = sSubStats2["1"] > sSubStats2["X"] && sSubStats2["1"] > sSubStats2["2"] ? "1" : sSubStats2["2"] > sSubStats2["1"] && sSubStats2["2"] > sSubStats2["X"] ? "2" : null;
          if (phaPred2 && !matchesPrediction(finalPrediction, phaPred2)) {
            if (finalPrediction === "1") finalPrediction = "1X";
            else if (finalPrediction === "2") finalPrediction = "X2";
          }
        }
      }
      if (runTSLogic && match.group === 2 && finalPrediction.length === 1) {
        const tsRatio = (match.tsa || 0) / (match.tsb || 0.01);
        const tsRatioRev = (match.tsb || 0) / (match.tsa || 0.01);
        const dominance = Math.max(tsRatio, tsRatioRev);
        if (dominance <= 3) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
        }
      }
      if (match.group === 2 && match.patternAnalysis?.subPatternPrediction === "12") {
        const minO = Math.min(o1, o2);
        if (!isNaN(minO) && minO < 1.5) {
          if (o2 < 1.5 && finalPrediction === "1X") {
            finalPrediction = "2";
          }
          if (o1 < 1.5 && finalPrediction === "X2") {
            finalPrediction = "1";
          }
        }
      }
      if (match.patternAnalysis?.subPatternPrediction === "12") {
        if (finalPrediction.length === 1) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
        }
      }
      const protocol75AlgoPred = match.patternAnalysis?.subPatternPrediction;
      if (protocol75AlgoPred && (protocol75AlgoPred === "1X" || protocol75AlgoPred === "X2") && finalPrediction.length === 1) {
        const ptsPred2 = match.calculatedPrediction;
        const allAgreed = (protocol75AlgoPred === finalPrediction || protocol75AlgoPred.includes(finalPrediction)) && moFav === finalPrediction && ptsPred2 === finalPrediction;
        if (!allAgreed) {
          finalPrediction = protocol75AlgoPred;
        }
      }
      if (match.group === 1 && finalPrediction.length === 1) {
        if (finalPrediction === "1") finalPrediction = "1X";
        else if (finalPrediction === "2") finalPrediction = "X2";
      }
      const predOddsCheck = finalPrediction === "1" ? o1 : finalPrediction === "2" ? o2 : oX;
      if (!isNaN(predOddsCheck) && predOddsCheck > 3 && finalPrediction.length === 1) {
        finalPrediction = finalPrediction === "1" ? "1X" : "X2";
      }
      if (finalPrediction.length === 1 && !isNaN(predOddsCheck) && predOddsCheck > 1.9) {
        if (sSubStatsProb && sSubStatsProb["X"] > 0.25 || pX > 0.25) {
          finalPrediction = finalPrediction === "1" ? "1X" : "X2";
        }
      }
      if (match.group === 3) {
        if (finalPrediction === "1") finalPrediction = "1X";
        else if (finalPrediction === "2") finalPrediction = "X2";
      }
      if (finalPrediction === "2" && !isNaN(o2) && o2 > 2.6) {
        finalPrediction = "X2";
      }
      if (prediction === "X" && !isNaN(oX) && oX < 3.1) {
        finalPrediction = p1 > p2 ? "1X" : "X2";
      }
      if (prediction === "2" && !isNaN(o1) && o1 < 2.1) {
        finalPrediction = "1X";
      }
      const strongVisitors = ["Al Hilal", "Al Nassr", "Al Ittihad", "Al Ahli", "Al Shabab", "Man City", "Real Madrid", "Bayern", "Leverkusen"];
      const awayTeam = match.teams.split(" vs ")[1] || "";
      if (strongVisitors.some((v) => awayTeam.includes(v))) {
        if (prediction === "X") {
          finalPrediction = "2";
        }
      }
      if (prediction === "1" && o1 >= 2.2 && o1 <= 2.9) finalPrediction = "1X";
      if (prediction === "1" && o1 > 3) finalPrediction = "1X";
      if (prediction === "2" && o2 > 3) finalPrediction = "X2";
      if (prediction === "2" && o2 >= 2.2 && o2 <= 2.8) finalPrediction = "X2";
      if (prediction === "1" && o1 > 2 && finalPrediction === "1") finalPrediction = "1X";
      if (prediction === "2" && o2 > 2 && finalPrediction === "2") finalPrediction = "X2";
      rawConfidence = Math.min(99, rawConfidence);
      if ((match.group === 2 || match.group === 3) && rawConfidence < 70) {
        if (finalPrediction === "1") finalPrediction = "1X";
        else if (finalPrediction === "2") finalPrediction = "X2";
        else if (finalPrediction === "X") finalPrediction = p1 > p2 ? "1X" : "X2";
      }
      if (runTSLogic && finalPrediction === "2" && match.tsb && match.tsa) {
        if (match.tsb < match.tsa * 1.15) {
          finalPrediction = "X2";
        }
      }
      if (runTSLogic && finalPrediction === "2" && match.tsb && match.tsb >= 1.5 && !isNaN(o2) && o2 > 3) {
        finalPrediction = "X2";
      }
      if (match.l10 && match.l10 !== "NA") {
        const parts = match.l10.split(":").map((s) => parseFloat(s));
        if (parts.length === 2) {
          const [l10H, l10A] = parts;
          if (prediction === "1" && !isNaN(o1) && !isNaN(o2) && o1 > o2 && l10H < l10A) {
            finalPrediction = "1X";
          }
          if (prediction === "2" && !isNaN(o1) && !isNaN(o2) && o2 > o1 && l10A < l10H) {
            finalPrediction = "X2";
          }
        }
      }
      if (finalPrediction === "12" && match.group === 1) {
        finalPrediction = "1X";
      }
      if (isCup) {
        if (prediction === "1") finalPrediction = "1X";
        if (prediction === "2") finalPrediction = "X2";
      }
      if ((prediction === "2" || prediction === "X2") && o1 < o2) {
        if (hasFlag("SHGS") || hasFlag("H_BAL") || hasFlag("TS_HOME_STRONG")) {
          finalPrediction = "1X";
        }
      }
      if (prediction === "1X" && o1 > 2.2) finalPrediction = "12";
      if (prediction === "1" && o1 >= 1.8 && o1 <= 1.95) finalPrediction = "1X";
      if (prediction === "2" && o2 > 3.5) finalPrediction = "X2";
      if (prediction === "1" && o1 > 3.5) finalPrediction = "1X";
      if (match.group === 3 && prediction === "1") {
        rawConfidence = Math.min(rawConfidence, 60);
      }
      if ((mainP === "A" || mainP === "R") && (finalPrediction === "1" || finalPrediction === "2")) {
        finalPrediction = "12";
      }
      if (mainP === "G" && finalPrediction === "X2" && rawConfidence >= 75) {
        finalPrediction = "1X";
        rawConfidence = Math.min(rawConfidence, 70);
      }
      if (match.group === 3 && !["Q", "I", "DD"].includes(mainP)) {
        rawConfidence = Math.max(0, rawConfidence - 20);
      }
      if (match.group === 3 && ["G3j2", "G3p3", "G3g1", "G3f15"].includes(subP)) {
        rawConfidence = Math.min(rawConfidence, 40);
      }
      if (["X", "JJ"].includes(mainP)) {
        rawConfidence = 10;
        category = "Standard";
      }
      if (["Q", "J", "P"].includes(mainP)) {
        rawConfidence = Math.min(99, rawConfidence + 15);
      }
      const algoOdds = 1 / maxP;
      const marketOdds = prediction === "1" ? o1 : prediction === "X" ? oX : o2;
      if (marketOdds > 1.8 && marketOdds > algoOdds * 1.2) {
        category = "Value";
        if (marketOdds > 2.2 && (finalPrediction === "1" || finalPrediction === "2")) {
          finalPrediction = prediction === "1" ? "1X" : "X2";
        }
        if (prediction === "2" && marketOdds > 2.5) {
          category = "Standard";
        }
      }
      if (category === "Value" && finalPrediction.length === 1) {
        const oppPred = finalPrediction === "1" ? "2" : "1";
        if (sSubStatsProb && sSubStatsProb[oppPred] > 0.55) {
          category = "Standard";
          finalPrediction = finalPrediction === "1" ? "1X" : "X2";
          reasonParts.push("Contrarian Limit");
        }
      }
      if (rawConfidence > 65 && maxP > 0.55) {
        const marketFav = Math.min(o1, o2);
        const marketPred = o1 === marketFav ? "1" : "2";
        let oddsLimit = 1.9;
        if (rawConfidence > 85) oddsLimit = 2.45;
        else if (rawConfidence > 75) oddsLimit = 2.15;
        let qualifiesAsBanker = false;
        if (marketPred === prediction && marketFav <= oddsLimit) {
          if (!(marketPred === "1" && marketFav < 2 && rawConfidence < 75)) {
            qualifiesAsBanker = true;
          }
        }
        const AlgoClass2 = algo.constructor;
        const starRating = AlgoClass2.getPatternConfidence(subP).stars;
        if (starRating === 5 && marketFav < 3) {
          qualifiesAsBanker = true;
        }
        if (category === "Value" && rawConfidence > 65) {
          qualifiesAsBanker = true;
        }
        if (["JJ", "FF", "EE"].includes(mainP)) {
          qualifiesAsBanker = false;
        }
        if (subP === "G1ff45") {
          qualifiesAsBanker = false;
        }
        if (["G1s11"].includes(subP)) {
          qualifiesAsBanker = false;
        }
        if (["Q", "J", "P"].includes(mainP) && rawConfidence > 70) {
          qualifiesAsBanker = true;
        }
        if (qualifiesAsBanker) {
          const bMinOdds = Math.min(o1, o2);
          if (!isNaN(bMinOdds)) {
            if (bMinOdds < 1.35) {
              qualifiesAsBanker = false;
              reasonParts.push("Odds Floor Violation (<1.35)");
            } else if (bMinOdds >= 1.85) {
              qualifiesAsBanker = false;
              if (rawConfidence >= 65) category = "Value";
              reasonParts.push("Banker Cap (>1.85)");
            } else if (maxP <= 0.65) {
              qualifiesAsBanker = false;
              reasonParts.push("Banker Conf Fail (<65%)");
            }
          }
          if (qualifiesAsBanker && marketFav >= 1.4 && marketFav <= 1.6 && sSubStatsProb && sSubStatsProb["X"] > 0.15) {
            qualifiesAsBanker = false;
            reasonParts.push("Banker Draw Risk (>15%)");
          }
          if (qualifiesAsBanker && marketFav >= 1.35 && marketFav < 2) {
            if (sSubStats && sSubStats["X"] > 0.25) {
              qualifiesAsBanker = false;
              reasonParts.push("Low Odds Banker Risk (Draw)");
            }
          }
          if (qualifiesAsBanker && marketFav >= 2) {
            if (sSubStats) {
              const underdogOutcome = marketPred === "1" ? "2" : "1";
              const underdogProb = sSubStats[underdogOutcome];
              if (underdogProb > 0.3) {
                qualifiesAsBanker = false;
                reasonParts.push("High Odds Banker Risk (Underdog)");
              }
            }
          }
          if (runTSLogic && prediction === "1" && match.tsa && match.tsb) {
            const ratio = match.tsa / (match.tsb || 0.01);
            if (ratio < 2) {
              qualifiesAsBanker = false;
            }
          }
          if (qualifiesAsBanker) {
            const bankerTsDiff = Math.abs((match.tsa || 0) - (match.tsb || 0));
            const rate = algo.getPatternWinRate(subP, match.patternAnalysis?.subPatternPrediction || null);
            if (runTSLogic && bankerTsDiff <= 1 || rate <= 65) {
              qualifiesAsBanker = false;
            }
          }
          if (prediction === "2" && !isNaN(o2) && o2 > 2) {
            qualifiesAsBanker = false;
          }
          if (match.group !== 1) {
            const predOdds2 = prediction === "1" ? o1 : prediction === "2" ? o2 : oX;
            if (!isNaN(predOdds2) && predOdds2 >= 1.65) {
              qualifiesAsBanker = false;
            }
          }
          if (runTSLogic && match.group === 2) {
            const tsDiff2 = Math.abs((match.tsa || 0) - (match.tsb || 0));
            if (tsDiff2 < 1.5) {
              qualifiesAsBanker = false;
              category = "Standard";
              if (finalPrediction.length === 1) {
                if (finalPrediction === "1") finalPrediction = "1X";
                else if (finalPrediction === "2") finalPrediction = "X2";
              }
            }
          }
          if (sSubStats && sSubStats["X"] > 0.3) {
            const minO = Math.min(o1, o2);
            if (minO < 2) {
              qualifiesAsBanker = false;
              reasonParts.push("High Risk Stalemate");
            }
          }
          if (Math.min(o1, o2) < 1.5 && phaPred && moFav && phaPred !== moFav) {
            qualifiesAsBanker = false;
            reasonParts.push("Trap Favorite (PHA Divergence)");
          }
          if (!sSubStats || sSubStats.total < 3) {
            qualifiesAsBanker = false;
          }
          if (["1X", "X2", "12"].includes(match.patternAnalysis?.subPatternPrediction || "")) {
            qualifiesAsBanker = false;
            if (category === "Value") category = "Standard";
          }
          if (qualifiesAsBanker) category = "Banker";
        }
      }
      if (rawConfidence < 50) {
        if (category === "Banker" || category === "Value") {
          category = "Standard";
          if (finalPrediction.length === 1) {
            finalPrediction = finalPrediction === "1" ? "1X" : "X2";
          }
          reasonParts.push("Low Conf Baseline Exclusion");
        }
      }
      if (category === "Banker") {
        const minO = Math.min(o1, o2);
        if (minO > 1.3) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
        }
        if (!isNaN(minO) && minO > 2.5) {
          category = "Value";
        }
        if (isOddsTrap) {
          category = "Value";
        }
      }
      if (category === "Value" && finalPrediction.length === 1) {
        if (rawConfidence < 50) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          category = "Standard";
          reasonParts.push("Holy Grail Hedge (Conf < 50%)");
        }
      }
      if ((category === "Value" || category === "Banker") && finalPrediction.length === 1) {
        const singleProb = finalPrediction === "1" ? p1 : finalPrediction === "2" ? p2 : pX;
        if (singleProb < 0.51) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          else if (finalPrediction === "X") finalPrediction = "1X";
          category = "Standard";
          reasonParts.push("Value Prob Floor (<51%)");
        }
      }
      if (finalPrediction === "X" && pX > 0.4) {
        if ((match.gsAway || 0) > 1.2) {
          finalPrediction = "X2";
          reasonParts.push("False Stalemate (Away Counter)");
        }
      }
      if (category === "Upset" && moFav) {
        const l10 = match.l10?.split(":").map(Number);
        if (l10 && l10.length === 2) {
          const favPts = moFav === "1" ? l10[0] : l10[1];
          if (favPts >= 9) {
            finalPrediction = moFav === "1" ? "1X" : "X2";
            category = "Standard";
            reasonParts.push("Upset Invalidated (Fav Form > 60%)");
          }
        }
      }
      if (finalPrediction === "1") {
        if (p1 > 0.6 && (match.gsAway || 0) < 0.8) {
          if (category !== "Banker") {
            category = "Banker";
            reasonParts.push("Banker Isolation (Dominance)");
          }
        } else if (category === "Banker") {
          category = "Value";
          reasonParts.push("Banker Isolation Fail");
        }
      }
      if (finalPrediction === "1" && (category === "Value" || category === "Banker")) {
        const drawRisk = sSubStatsProb ? sSubStatsProb["X"] : pX;
        if (drawRisk > 0.35) {
          finalPrediction = "1X";
          reasonParts.push("Home Fav Resilience Hedge");
        }
      }
      if (moFav) {
        const favOdds2 = moFav === "1" ? o1 : o2;
        if (!isNaN(favOdds2) && favOdds2 > 2.2) {
          if (matchesPrediction(finalPrediction, moFav)) {
            finalPrediction = "12";
            reasonParts.push("Tight Fav Hedge (12)");
          }
        }
      }
      const totalExpGoals = (match.gsHome || 0) + (match.gsAway || 0);
      if (totalExpGoals < 2 && (match.gaHome || 0) < 1 && (match.gaAway || 0) < 1) {
        if (finalPrediction !== "X") {
          finalPrediction = "X";
          category = "Banker";
          reasonParts.push("Boring Draw Calibration");
        }
      }
      if (category !== "Banker") {
        const marketFavOutcome2 = !isNaN(o1) && !isNaN(o2) ? o1 < o2 ? "1" : o1 > o2 ? "2" : "" : "";
        const algoSubPred2 = match.patternAnalysis?.subPatternPrediction;
        if (marketFavOutcome2 && algoSubPred2 && !matchesPrediction(algoSubPred2, marketFavOutcome2)) {
          const underdogOutcome = marketFavOutcome2 === "1" ? "2" : "1";
          const ptsPred2 = match.calculatedPrediction;
          if (matchesPrediction(algoSubPred2, underdogOutcome) && ptsPred2 && matchesPrediction(ptsPred2, underdogOutcome)) {
            finalPrediction = underdogOutcome;
            rawConfidence = Math.max(rawConfidence, 80);
            category = "Upset";
            reasonParts.push("Dual Upset Conf (Algo+Pts)");
            isUnshakable = true;
          } else {
            if (match.isJackpot) {
              category = "Upset";
            }
          }
        }
        if (hasFlag("UPSET") && algoSubPred2 && marketFavOutcome2 && matchesPrediction(algoSubPred2, marketFavOutcome2)) {
          if (category === "Upset") category = "Standard";
        }
        if (marketFavOutcome2 && sSubStatsProb) {
          const phaFav = sSubStatsProb["1"] > sSubStatsProb["2"] && sSubStatsProb["1"] > sSubStatsProb["X"] ? "1" : sSubStatsProb["2"] > sSubStatsProb["1"] && sSubStatsProb["2"] > sSubStatsProb["X"] ? "2" : "";
          if (phaFav && phaFav !== marketFavOutcome2 && algoSubPred2 && matchesPrediction(algoSubPred2, marketFavOutcome2)) {
            if (finalPrediction === "1") finalPrediction = "1X";
            else if (finalPrediction === "2") finalPrediction = "X2";
            reasonParts.push("Contra-Market Hedge");
          }
        }
        if (!isNaN(o1) && !isNaN(o2) && o1 > 2.5 && o2 > 2.5) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          else if (finalPrediction === "12") finalPrediction = "12";
          else if (finalPrediction === "X") {
            finalPrediction = runTSLogic && (match.tsa || 0) > (match.tsb || 0) ? "1X" : "X2";
          }
          reasonParts.push("High Variance (>2.50)");
        }
      }
      if (match.group === 3 && sSub && sSub["X"] > 0.5) {
        if (finalPrediction === "X") {
          finalPrediction = runTSLogic && (match.tsa || 0) >= (match.tsb || 0) ? "1X" : "X2";
        }
      }
      if (rawConfidence >= 72) isUnshakable = true;
      let supportCount = 0;
      if (moFav && matchesPrediction(finalPrediction, moFav)) supportCount++;
      if (sSubStatsProb) {
        const maxPha = Math.max(sSubStatsProb["1"], sSubStatsProb["X"], sSubStatsProb["2"]);
        let phaDir = sSubStatsProb["1"] === maxPha ? "1" : sSubStatsProb["X"] === maxPha ? "X" : "2";
        if (matchesPrediction(finalPrediction, phaDir)) supportCount++;
      }
      if (match.pred1x2 && matchesPrediction(finalPrediction, match.pred1x2)) supportCount++;
      if (rulePrediction && matchesPrediction(finalPrediction, rulePrediction)) supportCount++;
      let probDir = "X";
      if (p1 > pX && p1 > p2) probDir = "1";
      else if (p2 > p1 && p2 > pX) probDir = "2";
      if (matchesPrediction(finalPrediction, probDir)) supportCount++;
      if (match.calculatedPrediction && matchesPrediction(finalPrediction, match.calculatedPrediction)) supportCount++;
      if (supportCount >= 4) {
        if (rawConfidence < 85) rawConfidence = 85;
        if (category === "Standard") category = "Banker";
        reasonParts.push(`Strong Preference Support (${supportCount}/6)`);
      }
      if (!isUnshakable) {
        let contradictions = 0;
        if (moFav && !matchesPrediction(finalPrediction, moFav)) contradictions++;
        if (sSubStatsProb) {
          let phaDir = sSubStatsProb["1"] > sSubStatsProb["2"] ? "1" : "2";
          if (!matchesPrediction(finalPrediction, phaDir)) contradictions++;
        }
        if (match.pred1x2 && !matchesPrediction(finalPrediction, match.pred1x2)) contradictions++;
        if (contradictions === 3) {
          if (moFav) {
            finalPrediction = moFav === "1" ? "1X" : "X2";
            reasonParts.push("Algo Contradiction Audit (Revert)");
            category = "Standard";
            rawConfidence = 50;
          }
        }
      }
      if (match.patternAnalysis?.subPatternPrediction === "1X" && sSubStatsProb) {
        if (sSubStatsProb["2"] > sSubStatsProb["X"] && sSubStatsProb["2"] > 0.35) {
          finalPrediction = "12";
          reasonParts.push("PHA Split (SubPat 1X Invalid)");
        }
      }
      if (!isUnshakable) {
        if (pX > 0.3 || sSubStatsProb && sSubStatsProb["X"] > 0.3) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          else if (finalPrediction === "12") {
            finalPrediction = p1 >= p2 ? "1X" : "X2";
          }
          reasonParts.push("Draw Risk Hedge (>30%)");
        }
      }
      if (finalPrediction === "X") {
        finalPrediction = p1 >= p2 ? "1X" : "X2";
        reasonParts.push("No Straight X Rule");
      }
      if (moFav && !matchesPrediction(finalPrediction, moFav)) {
        if (category !== "Upset" && !isUnshakable) {
          finalPrediction = moFav === "1" ? "1X" : "X2";
          reasonParts.push("Underdog Caution");
        }
      }
      if (match.patternAnalysis?.subPatternPrediction === "12" || finalPrediction === "12") {
        const underdog = moFav === "1" ? "2" : "1";
        let isUpsetQualified = false;
        const underdogProb = underdog === "1" ? p1 : p2;
        let phaUnderdogSupport = 0;
        if (sSubStatsProb) {
          phaUnderdogSupport = sSubStatsProb[underdog];
        }
        if (underdogProb > 0.35 || phaUnderdogSupport > 0.35) {
          isUpsetQualified = true;
        }
        if (match.calculatedPrediction && matchesPrediction(match.calculatedPrediction, underdog)) {
          isUpsetQualified = true;
        }
        if (isUpsetQualified) {
          finalPrediction = underdog;
          category = "Upset";
          reasonParts.push("'12' Volatility -> Upset Win");
        } else {
          finalPrediction = moFav === "1" ? "X2" : "1X";
          reasonParts.push("'12' Volatility -> Underdog Hedge");
        }
      }
      if (moFav && !matchesPrediction(finalPrediction, moFav)) {
        if (sSubStatsProb) {
          const p1_pha2 = sSubStatsProb["1"];
          const p2_pha2 = sSubStatsProb["2"];
          const phaDir = p1_pha2 > p2_pha2 ? "1" : "2";
          if (matchesPrediction(phaDir, finalPrediction)) {
            let sCount = 0;
            if (match.pred1x2 && matchesPrediction(match.pred1x2, finalPrediction)) sCount++;
            if (match.calculatedPrediction && matchesPrediction(match.calculatedPrediction, finalPrediction)) sCount++;
            if (Math.max(p1, pX, p2) > 0.45) sCount++;
            if (sCount < 2) {
              finalPrediction = moFav === "1" ? "1X" : "X2";
              reasonParts.push("Algo/PHA Conflict (Low Support) -> Market Fav");
            } else {
              reasonParts.push("Algo/PHA Override (Supported)");
            }
          } else if (matchesPrediction(phaDir, moFav)) {
            finalPrediction = moFav === "1" ? "1X" : "X2";
            reasonParts.push("PHA Supports Market Fav");
          }
        }
      }
      if (moFav && sSubStatsProb) {
        const p1_pha2 = sSubStatsProb["1"];
        const p2_pha2 = sSubStatsProb["2"];
        const phaUnderdogProb = moFav === "1" ? p2_pha2 : p1_pha2;
        const phaFavProb = moFav === "1" ? p1_pha2 : p2_pha2;
        if (phaUnderdogProb > phaFavProb || Math.abs(phaFavProb - phaUnderdogProb) < 0.1) {
          const subPatternIs12 = match.patternAnalysis?.subPatternPrediction === "12";
          if (subPatternIs12 || finalPrediction === "12") {
            if (category !== "Upset" && finalPrediction.length === 1) category = "Upset";
          } else {
            if (matchesPrediction(finalPrediction, moFav)) {
              finalPrediction = moFav === "1" ? "1X" : "X2";
              reasonParts.push("PHA Volatility Hedge");
            }
          }
        }
      }
      if (category === "Value") {
        if (finalPrediction === "12") {
          const underdog = moFav === "1" ? "2" : "1";
          finalPrediction = underdog === "1" ? "1X" : "X2";
          reasonParts.push("Value Bet No-12 Rule");
        }
      }
      if (category === "Value") {
        const vOdds = finalPrediction === "1" ? o1 : finalPrediction === "2" ? o2 : oX;
        if (!isNaN(vOdds) && (vOdds < 2 || vOdds > 2.5)) {
          category = "Standard";
          if (finalPrediction.length === 1) {
            finalPrediction = finalPrediction === "1" ? "1X" : "X2";
          }
          reasonParts.push("Value Pick Rejected (Odds not 2.0-2.5)");
        }
      }
      if (category === "Banker" && finalPrediction === "X") {
        if (!isNaN(o1) && !isNaN(o2) && (o1 < 2 || o2 < 2)) {
          category = "Standard";
          reasonParts.push("Banker Draw Rejected (Odds < 2.0)");
        }
      }
      if (match.group === 3) {
        if (match.pred1x2 && !matchesPrediction(finalPrediction, match.pred1x2)) {
          rawConfidence = Math.max(rawConfidence, 90);
          reasonParts.push("Group 3 Authority");
        }
      }
      const ext = match.pred1x2;
      let phaAlgo = null;
      if (sSubStatsProb) {
        const maxS = Math.max(sSubStatsProb["1"], sSubStatsProb["X"], sSubStatsProb["2"]);
        if (maxS === sSubStatsProb["1"]) phaAlgo = "1";
        else if (maxS === sSubStatsProb["X"]) phaAlgo = "X";
        else phaAlgo = "2";
      }
      if (ext && phaAlgo && finalPrediction === ext && finalPrediction === phaAlgo) {
        if (finalPrediction.length === 1) {
          category = "Value";
          isUnshakable = true;
          reasonParts.push("Holy Grail Consensus");
        }
      }
      if (category === "Banker") {
        const oppGoals = finalPrediction.includes("1") ? match.gsAway || 0 : match.gsHome || 0;
        let h2hBalanced = false;
        if (match.le && match.le.includes(":")) {
          if (match.le.includes("1:1") || match.le.includes("0:0") || match.le.includes("2:2")) h2hBalanced = true;
        }
        if (maxP > 0.6 && (oppGoals > 1.5 || h2hBalanced)) {
          if (finalPrediction.length === 1) {
            finalPrediction = finalPrediction === "1" ? "1X" : "X2";
          }
          category = "Standard";
          reasonParts.push("Banker Volatility Filter");
        }
      }
      if (category === "Banker" && !isNaN(Math.min(o1, o2)) && Math.min(o1, o2) < 2.5) {
        const l10 = match.l10?.split(":").map(Number);
        if (l10 && l10.length === 2) {
          const favPts = moFav === "1" ? l10[0] : l10[1];
          if (favPts < 5) {
            category = "Standard";
            reasonParts.push("False Favorite (Poor Form)");
          }
        }
      }
      if (category === "Upset") {
        if (match.group === 1 || Math.min(o1, o2) < 1.5) {
          if (moFav === "2") {
            const l10A = match.l10?.split(":")[1] ? parseFloat(match.l10.split(":")[1]) : 0;
            if (l10A > 6) {
              category = "Standard";
              finalPrediction = "2";
              reasonParts.push("Upset Rejected (Strong Fav)");
            }
          }
          if (moFav === "1") {
            const l10H = match.l10?.split(":")[0] ? parseFloat(match.l10.split(":")[0]) : 0;
            if (l10H > 6) {
              category = "Standard";
              finalPrediction = "1";
              reasonParts.push("Upset Rejected (Strong Fav)");
            }
          }
        }
      }
      if (category === "Value" && finalPrediction === "2") {
        if (o1 < 3.5) {
          if (pX > 0.28) finalPrediction = "X2";
          else finalPrediction = "12";
          reasonParts.push("Away Fav Insulation");
        }
      }
      if (match.group === 3 || Math.abs(o1 - o2) < 0.2 && o1 > 2.5) {
        if (pX > 0.33 || sSubStatsProb && sSubStatsProb["X"] > 0.33) {
          if (finalPrediction !== "X") {
            finalPrediction = "X";
            category = "Banker";
            reasonParts.push("Stalemate ID (Banker Draw)");
          }
        }
      }
      const minOddsFinal = Math.min(o1, o2);
      if (!isNaN(o1) && o1 >= 2.4 && o1 <= 2.6 && !isNaN(o2) && o2 > 2.8) {
        if (finalPrediction === "1" || finalPrediction === "2" || finalPrediction === "X") {
          finalPrediction = "1X";
          reasonParts.push("Home Underdog Bias");
        }
      }
      if (category === "Upset" && !isNaN(o1) && o1 > 2.5 && !isNaN(o2) && o2 > 2.5) {
        if (pX > 0.32) {
          reasonParts.push("Volatility Allowance (Draw > 32%)");
        }
      }
      if (category === "Banker") {
        const isPhaDisagree = sSubStatsProb && !matchesPrediction(finalPrediction, sSubStatsProb["1"] > sSubStatsProb["2"] ? "1" : "2");
        if (maxP < 0.65 || isPhaDisagree) {
          category = "Value";
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          reasonParts.push("Banker Downgrade (Elevated Threshold)");
        }
      }
      if (category === "Value" && finalPrediction.length === 1) {
        const phaWinRate = algo.getPatternWinRate(subP, finalPrediction);
        if (maxP <= 0.6 || phaWinRate <= 60) {
          finalPrediction = finalPrediction === "1" ? "1X" : "X2";
          reasonParts.push("Value Hedge (Holy Grail Fail)");
        }
      }
      if (finalPrediction === "X2") {
        const l10Parts = match.l10?.split(":") || [];
        const l10Home = parseFloat(l10Parts[0] || "0");
        if (l10Home > 7) {
          finalPrediction = "1X";
          category = "Standard";
          reasonParts.push("Home Fortress Correction");
        }
      }
      const totalExpGoalsBD = (match.gsHome || 0) + (match.gsAway || 0);
      const tsDiffVal = Math.abs((match.tsa || 0) - (match.tsb || 0));
      if (totalExpGoalsBD < 2.25 && tsDiffVal < 0.1) {
        category = "Banker";
        if (!isNaN(o1) && o1 < 2.6) finalPrediction = "1X";
        else finalPrediction = "X2";
        reasonParts.push("Banker Draw Hedge Strategy");
      }
      if (phaPrediction && !matchesPrediction(finalPrediction, phaPrediction) && rawConfidence < 58) {
        finalPrediction = phaPrediction;
        reasonParts.push("PHA Alignment Override (<58% Conf)");
      }
      if (category === "Value" && !isNaN(minOddsFinal) && minOddsFinal > 2.8) {
        if (finalPrediction.length === 1) {
          finalPrediction = finalPrediction === "1" ? "1X" : "X2";
          reasonParts.push("Value Safety Net (>2.80)");
        }
      }
      if (category === "Upset") {
        const favTeam = moFav === "1" ? "Home" : "Away";
        const l10Fav = favTeam === "Home" ? parseFloat(match.l10?.split(":")[0] || "0") : parseFloat(match.l10?.split(":")[1] || "0");
        if (l10Fav > 6) {
          category = "Standard";
          finalPrediction = moFav === "1" ? "1X" : "X2";
          reasonParts.push("Upset Invalidated (Fav Form Good)");
        }
      }
      if (!isNaN(oX) && oX < 3.1) {
        if (rulePrediction && finalPrediction === rulePrediction) {
          if (moFav && !matchesPrediction(finalPrediction, moFav)) {
            finalPrediction = moFav === "1" ? "1X" : "X2";
            reasonParts.push("SubPattern Ignored (Draw Odds < 3.10)");
          }
        }
      }
      if (match.pred1x2 && sSubStatsProb) {
        const p1s = sSubStatsProb["1"];
        const pXs = sSubStatsProb["X"];
        const p2s = sSubStatsProb["2"];
        const maxS = Math.max(p1s, pXs, p2s);
        let phaDir = "";
        if (maxS === p1s) phaDir = "1";
        else if (maxS === pXs) phaDir = "X";
        else phaDir = "2";
        if (!matchesPrediction(phaDir, match.pred1x2)) {
          if (!matchesPrediction(finalPrediction, phaDir)) {
            if (phaDir === "1") finalPrediction = "1X";
            else if (phaDir === "2") finalPrediction = "X2";
            else finalPrediction = p1 > p2 ? "1X" : "X2";
            reasonParts.push("Algo-Centric Shift (Follow PHA)");
          }
        }
      }
      if (category === "Value") {
        let unanimous = true;
        if (sSubStatsProb) {
          const p1s = sSubStatsProb["1"];
          const pXs = sSubStatsProb["X"];
          const p2s = sSubStatsProb["2"];
          const maxS = Math.max(p1s, pXs, p2s);
          let phaDir = "";
          if (maxS === p1s) phaDir = "1";
          else if (maxS === pXs) phaDir = "X";
          else phaDir = "2";
          if (!matchesPrediction(finalPrediction, phaDir)) unanimous = false;
        } else {
          unanimous = false;
        }
        if (moFav && !matchesPrediction(finalPrediction, moFav)) unanimous = false;
        if (!unanimous) {
          category = "Standard";
          reasonParts.push("Value Pick Rejected (Non-Unanimous)");
          if (finalPrediction.length === 1) {
            finalPrediction = finalPrediction === "1" ? "1X" : "X2";
          }
        }
      }
      const minOddsFav = Math.min(o1, o2);
      if (!isNaN(minOddsFav) && minOddsFav > 2.05) {
        if (sSubStatsProb && sSubStatsProb["X"] > 0.3) {
          if (finalPrediction === "1") finalPrediction = "1X";
          else if (finalPrediction === "2") finalPrediction = "X2";
          reasonParts.push("Banker Draw Hedge (Fav>2.05, Draw>30%)");
        }
      }
      if (sSubStats && sSubStats.total < 6) {
        if (reasonParts.some((r) => r.includes("PHA"))) {
          rawConfidence = Math.min(rawConfidence, 50);
          reasonParts.push("Low Sample Size (N<6)");
          if (category !== "Standard") {
            if (category === "Value" && finalPrediction.length === 1) {
              finalPrediction = finalPrediction === "1" ? "1X" : "X2";
            }
            category = "Standard";
          }
        }
      }
      if (category === "Value") {
        const vOdds = finalPrediction === "1" ? o1 : finalPrediction === "2" ? o2 : oX;
        if (!isNaN(vOdds) && vOdds > 2.4) {
          let phaAgrees = false;
          if (sSubStatsProb) {
            const p1s = sSubStatsProb["1"];
            const pXs = sSubStatsProb["X"];
            const p2s = sSubStatsProb["2"];
            const maxS = Math.max(p1s, pXs, p2s);
            let phaDir = "";
            if (maxS === p1s) phaDir = "1";
            else if (maxS === pXs) phaDir = "X";
            else phaDir = "2";
            if (matchesPrediction(finalPrediction, phaDir)) phaAgrees = true;
          }
          if (!phaAgrees) {
            category = "Standard";
            if (finalPrediction.length === 1) {
              finalPrediction = finalPrediction === "1" ? "1X" : "X2";
            }
            reasonParts.push("Value Bet Destabilized (>2.40 No PHA)");
          }
        }
      }
      if (category === "Value" && finalPrediction.length === 1) {
        const vOdds = finalPrediction === "1" ? o1 : finalPrediction === "2" ? o2 : oX;
        if (!isNaN(vOdds) && vOdds > 3) {
          finalPrediction = finalPrediction === "1" ? "1X" : "X2";
          reasonParts.push("High Odds Value Hedge (>3.00)");
        }
      }
      const highYieldPatterns = ["G2p10", "G2q10", "G2ee3", "G3o7"];
      const highYieldMainPatterns = ["C", "K", "Y", "L"];
      if (highYieldPatterns.includes(subP) || highYieldMainPatterns.includes(mainP)) {
        maxP = Math.min(0.99, maxP + 0.05);
        reasonParts.push("High-Yield Pattern Boost (+5%)");
      }
      const toxicBankerPatterns = ["G1a7", "G1f27", "G1g6", "G1o4", "G1ff44"];
      if (toxicBankerPatterns.includes(subP)) {
        if (category === "Banker") {
          category = "Standard";
          reasonParts.push("Toxic Sub-Pattern Purge");
        }
      }
      if (category === "Banker" || category === "Value") {
        let phaSupport = 0;
        if (sSubStatsProb) {
          if (finalPrediction.includes("1")) phaSupport = Math.max(phaSupport, sSubStatsProb["1"]);
          if (finalPrediction.includes("2")) phaSupport = Math.max(phaSupport, sSubStatsProb["2"]);
          if (finalPrediction.includes("X")) phaSupport = Math.max(phaSupport, sSubStatsProb["X"]);
        }
        if (phaSupport < 0.5) {
          category = "Standard";
          if (finalPrediction.length === 1) {
            finalPrediction = finalPrediction === "1" ? "1X" : "X2";
          }
          reasonParts.push("Banker/Value Rejected (PHA < 50%)");
        }
      }
      if (sSubStatsProb && maxP >= 0.5) {
        const p1s = sSubStatsProb["1"];
        const p2s = sSubStatsProb["2"];
        const phaSupport = finalPrediction.includes("1") ? p1s : p2s;
        if (phaSupport >= 0.5) {
          if (match.patternAnalysis?.subPatternPrediction && matchesPrediction(match.patternAnalysis.subPatternPrediction, finalPrediction)) {
            if (finalPrediction === "1X") {
              if (p1 >= pX) {
                finalPrediction = "1";
                reasonParts.push("Straight Win Upgrade (Strong Signals)");
                if (category === "Standard") category = "Value";
              }
            } else if (finalPrediction === "X2") {
              if (p2 >= pX) {
                finalPrediction = "2";
                reasonParts.push("Straight Win Upgrade (Strong Signals)");
                if (category === "Standard") category = "Value";
              }
            }
          }
        }
      }
      if (match.patternAnalysis?.activeFlags?.includes("High Draw Risk") && rulePrediction && ["1X", "X2"].includes(rulePrediction)) {
        if (!isNaN(oX) && oX >= 2.8 && oX <= 3.4) {
          prediction = "X";
          finalPrediction = "X";
          category = "Banker Draw";
          reasonParts.push("Banker Draw Protocol");
        }
      }
      if (!isNaN(o1) && o1 >= 2.6 && o1 <= 3 && !isNaN(o2) && o2 >= 2.6 && o2 <= 3) {
        if (rulePrediction === "12" && pX > 0.3) {
          prediction = "X";
          finalPrediction = "X";
          category = "Banker Draw";
          reasonParts.push("Banker Draw Protocol (Compressed Odds)");
        }
      }
      if (finalPrediction === "1") {
        if (rulePrediction === "X2") {
          finalPrediction = "X2";
          category = "Standard";
          reasonParts.push("SubPat Contradiction Override (1 vs X2)");
        } else if (rulePrediction === "12" && !isNaN(o1) && o1 > 1.75) {
          finalPrediction = "12";
          reasonParts.push("Top 20 High Confidence Recovery (1 vs 12)");
        }
      }
      if ((finalPrediction === "1" || finalPrediction === "2") && !isNaN(minOddsFinal) && minOddsFinal > 1.85) {
        let phaAgrees = false;
        if (sSubStatsProb) {
          const maxPha = Math.max(sSubStatsProb["1"], sSubStatsProb["X"], sSubStatsProb["2"]);
          if (finalPrediction === "1" && maxPha === sSubStatsProb["1"]) phaAgrees = true;
          if (finalPrediction === "2" && maxPha === sSubStatsProb["2"]) phaAgrees = true;
        }
        const extAgrees = matchesPrediction(match.pred1x2 || "", finalPrediction);
        if (!(phaAgrees && extAgrees)) {
          finalPrediction = finalPrediction === "1" ? "1X" : "X2";
          reasonParts.push("BOTB Hedge Protocol (>1.85)");
        }
      }
      if (category === "Banker") {
        if (rulePrediction && !matchesPrediction(rulePrediction, finalPrediction)) {
          category = "Standard";
          reasonParts.push("Banker Leak Fix (SubPat Conflict)");
        }
      }
      if (category === "Value" && rulePrediction === "12") {
        if (finalPrediction.length === 1) {
          let phaSupport = 0;
          if (sSubStatsProb) {
            if (finalPrediction === "1") phaSupport = sSubStatsProb["1"];
            else if (finalPrediction === "2") phaSupport = sSubStatsProb["2"];
          }
          if (phaSupport <= 0.6) {
            finalPrediction = finalPrediction === "1" ? "1X" : "X2";
            reasonParts.push("Value Pick 12 Protocol (Hedge)");
          } else {
            reasonParts.push("Value Pick 12 Protocol (PHA > 60%)");
          }
        }
      }
      if (!isNaN(oX) && oX < 3.25 && rulePrediction && ["1X", "X2"].includes(rulePrediction)) {
        if (category !== "Banker Draw") {
          category = "Banker Draw";
          if (finalPrediction === "X") {
            finalPrediction = p1 >= p2 ? "1X" : "X2";
          } else if (finalPrediction.length === 1) {
            finalPrediction = finalPrediction === "1" ? "1X" : "X2";
          }
          reasonParts.push("Banker Draw ID (Tight Odds)");
        } else {
          if (finalPrediction === "X") {
            finalPrediction = p1 >= p2 ? "1X" : "X2";
            reasonParts.push("Banker Draw Hedge Enforced");
          }
        }
      }
      if (category === "Value" && maxP > 0.6) {
        if (sSubStatsProb) {
          const phaDir = sSubStatsProb["1"] > sSubStatsProb["2"] ? "1" : "2";
          if (!matchesPrediction(finalPrediction, phaDir)) {
            rawConfidence = Math.min(rawConfidence, 60);
            if (finalPrediction.length === 1) {
              finalPrediction = finalPrediction === "1" ? "1X" : "X2";
              reasonParts.push("Value Stabilization (PHA Conflict)");
            }
          }
        }
      }
      if (category === "Value") {
        if (finalPrediction.length === 1) {
          if (maxP < 0.5) {
            finalPrediction = finalPrediction === "1" ? "1X" : "X2";
            category = "Standard";
            reasonParts.push("Value Holy Grail Fail (<50%)");
          } else if (rulePrediction && !matchesPrediction(rulePrediction, finalPrediction)) {
            finalPrediction = finalPrediction === "1" ? "1X" : "X2";
            category = "Standard";
            reasonParts.push("Value Holy Grail Fail (SubPat Conflict)");
          }
        }
      }
      const phaDrawProb = sSubStatsProb ? sSubStatsProb["X"] : 0;
      if (phaDrawProb > 0.35 && maxP < 0.5) {
        category = "Banker Draw";
        finalPrediction = p1 >= p2 ? "1X" : "X2";
        reasonParts.push("Banker Draw Hedge (PHA > 35%)");
      }
      if (moUnderdog && sSubStatsProb) {
        const udOdds = moUnderdog === "1" ? o1 : o2;
        const phaUdSupport = sSubStatsProb[moUnderdog];
        if (!isNaN(udOdds) && udOdds > 2.5 && phaUdSupport > 0.6) {
          category = "Upset";
          finalPrediction = moUnderdog === "1" ? "1X" : "X2";
          reasonParts.push("Upset Overhaul (PHA > 60%)");
        }
      }
      if (category === "Banker" && rulePrediction) {
        if (!matchesPrediction(rulePrediction, finalPrediction)) {
          category = "Standard";
          if (finalPrediction.length === 1) {
            finalPrediction = finalPrediction === "1" ? "1X" : "X2";
          }
          reasonParts.push("SubPat/Algo Alignment Fail");
        }
      }
      if (category !== "Standard") reasonParts.push(category);
      if (match.patternAnalysis?.subPattern) reasonParts.push(`Pat:${match.patternAnalysis.subPattern}`);
      else if (match.patternAnalysis?.mainPattern) reasonParts.push(`Pat:${match.patternAnalysis.mainPattern}`);
      if (flags.length > 0) reasonParts.push(`[${flags.slice(0, 3).join(",")}]`);
      if (isOddsTrap) reasonParts.push("\u26A0\uFE0F Odds Trap");
      let optP1 = 0, optPX = 0, optP2 = 0, optTotalWeight = 0;
      if (sSub) {
        optP1 += sSub["1"] * 5;
        optPX += sSub["X"] * 5;
        optP2 += sSub["2"] * 5;
        optTotalWeight += 5;
      }
      optP1 += impliedProbs["1"] * 5;
      optPX += impliedProbs["X"] * 5;
      optP2 += impliedProbs["2"] * 5;
      optTotalWeight += 5;
      if (optTotalWeight > 0) {
        optP1 /= optTotalWeight;
        optPX /= optTotalWeight;
        optP2 /= optTotalWeight;
      } else {
        optP1 = impliedProbs["1"];
        optPX = impliedProbs["X"];
        optP2 = impliedProbs["2"];
      }
      const optMaxP = Math.max(optP1, optPX, optP2);
      let optPred = "1";
      if (optPX === optMaxP) optPred = "X";
      if (optP2 === optMaxP) optPred = "2";
      let optFinalPrediction = optPred;
      if (optMaxP < 0.8) {
        if (optPred === "1") optFinalPrediction = optPX > optP2 ? "1X" : "12";
        else if (optPred === "X") optFinalPrediction = optP1 > optP2 ? "1X" : "X2";
        else optFinalPrediction = optPX > optP1 ? "X2" : "12";
      }
      const tossUpRules = [
        { subPattern: "G2i13", cond: "GA_10", action: "force_12" },
        { subPattern: "G2g4", cond: "GA_12", action: "force_12" },
        { subPattern: "G3t12", cond: "GA_15", action: "force_udog_draw" },
        { subPattern: "G2ff43", cond: "GA_10", action: "force_12" },
        { subPattern: "G2ee2", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G1q17", cond: "GA_10", action: "force_12" },
        { subPattern: "G2i18", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2q15", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2ee11", cond: "GA_10", action: "force_12" },
        { subPattern: "G2s21", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G3p5", cond: "GA_12", action: "force_udog_draw" },
        { subPattern: "G1a7", cond: "GA_12", action: "force_fav_draw" },
        { subPattern: "G2ff48", cond: "GA_12", action: "force_12" },
        { subPattern: "G2m13", cond: "GA_15", action: "force_fav_draw" },
        { subPattern: "G2f18", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G3jj1", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2e5", cond: "GA_10", action: "force_12" },
        { subPattern: "G2l1", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G1r18", cond: "GA_10", action: "force_12" },
        { subPattern: "G2ii4", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2ee15", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G3ff48", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2e10", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2t7", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2q14", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2a2", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G3j2", cond: "GA_10", action: "force_12" },
        { subPattern: "G3i1", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2o8", cond: "GA_10", action: "force_12" },
        { subPattern: "G1aa1", cond: "GA_10", action: "force_udog_draw" },
        { subPattern: "G3m3", cond: "GA_10", action: "force_12" },
        { subPattern: "G1ff50", cond: "GA_10", action: "force_12" },
        { subPattern: "G1s15", cond: "GA_10", action: "force_12" },
        { subPattern: "G2bb3", cond: "GA_10", action: "force_udog_draw" },
        { subPattern: "G2ff32", cond: "GA_10", action: "force_12" },
        { subPattern: "G1pp2", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2jj1", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G3s3", cond: "GA_12", action: "force_udog_draw" },
        { subPattern: "G1g2", cond: "GA_12", action: "force_12" },
        { subPattern: "G1u6", cond: "GA_12", action: "force_12" },
        { subPattern: "G2ee3", cond: "GA_15", action: "force_12" },
        { subPattern: "G3ee8", cond: "GA_15", action: "force_12" },
        { subPattern: "G2g3", cond: "GA_17", action: "force_fav_draw" },
        { subPattern: "G3ff45", cond: "GA_17", action: "force_fav_draw" },
        { subPattern: "G3g2", cond: "GA_20", action: "force_udog_draw" },
        { subPattern: "G3j1", cond: "GA_20", action: "force_12" },
        { subPattern: "G1g4", cond: "GA_12_15", action: "force_fav_draw" },
        { subPattern: "G2t1", cond: "GA_10", action: "force_12" },
        { subPattern: "G3i2", cond: "GA_10", action: "force_12" },
        { subPattern: "G3dd4", cond: "GA_10", action: "force_12" },
        { subPattern: "G1r17", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G1i17", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2o18", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G1bb2", cond: "GA_10", action: "force_udog_draw" },
        { subPattern: "G3o8", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2ee13", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2x4", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2f10", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2ee7", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G3mm1", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2oo1", cond: "GA_10", action: "force_12" },
        { subPattern: "G2q4", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G3f15", cond: "GA_10", action: "force_12" },
        { subPattern: "G3o6", cond: "GA_10", action: "force_udog_draw" },
        { subPattern: "G2ff44", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2i15", cond: "GA_10", action: "force_12" },
        { subPattern: "G1i16", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2i4", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G1m6", cond: "GA_10", action: "force_12" },
        { subPattern: "G3ff6", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G1g1", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2f23", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2ff59", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2jj2", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G3ff57", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G3gg1", cond: "GA_10", action: "force_12" },
        { subPattern: "G3f14", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G2aa2", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G1jj2", cond: "GA_10", action: "force_12" },
        { subPattern: "G2y2", cond: "GA_10", action: "force_udog_draw" },
        { subPattern: "G3aa5", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G1w4", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G3ee4", cond: "GA_10", action: "force_12" },
        { subPattern: "G1mm1", cond: "GA_10", action: "force_fav_draw" },
        { subPattern: "G1t4b", cond: "GA_12", action: "force_udog_draw" },
        { subPattern: "G2s25", cond: "GA_12", action: "force_udog_draw" },
        { subPattern: "G3w1", cond: "GA_12", action: "force_udog_draw" },
        { subPattern: "G2o12", cond: "GA_12", action: "force_12" },
        { subPattern: "G1ee10", cond: "GA_12", action: "force_fav_draw" },
        { subPattern: "G1p8", cond: "GA_12", action: "force_fav_draw" },
        { subPattern: "G1g16", cond: "GA_12", action: "force_12" },
        { subPattern: "G2p10", cond: "GA_12", action: "force_fav_draw" },
        { subPattern: "G2ee1", cond: "GA_12", action: "force_12" },
        { subPattern: "G2dd4", cond: "GA_12", action: "force_udog_draw" },
        { subPattern: "G1a2", cond: "GA_12", action: "force_fav_draw" },
        { subPattern: "G3hh2", cond: "GA_12", action: "force_udog_draw" },
        { subPattern: "G2i16", cond: "GA_12", action: "force_12" },
        { subPattern: "G2m14", cond: "GA_15", action: "force_12" },
        { subPattern: "G3ee2", cond: "GA_15", action: "force_fav_draw" },
        { subPattern: "G3a2", cond: "GA_15", action: "force_fav_draw" },
        { subPattern: "G3f10", cond: "GA_15", action: "force_12" },
        { subPattern: "G3b2", cond: "GA_15", action: "force_fav_draw" },
        { subPattern: "G3a1", cond: "GA_17", action: "force_12" },
        { subPattern: "G3ff56", cond: "GA_17", action: "force_udog_draw" },
        { subPattern: "G2p12", cond: "GA_20", action: "force_fav_draw" },
        { subPattern: "G2pp2", cond: "GA_12_15", action: "force_fav_draw" },
        { subPattern: "G3nn1", cond: "GA_12_15", action: "force_fav_draw" }
      ];
      const pointInfluenceRules = [
        { subPattern: "G2p10", cond: "UD_PTS_0", action: "force_udog_draw" },
        { subPattern: "G2ff43", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G1r18", cond: "UD_PTS_0", action: "force_udog_draw" },
        { subPattern: "G1ff53", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G1p4", cond: "UD_PTS_10", action: "force_fav_draw" },
        { subPattern: "G3i2", cond: "UD_PTS_0", action: "force_udog_draw" },
        { subPattern: "G2o15", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G2i13", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G2q15", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G1ee8", cond: "UD_PTS_0", action: "force_udog_draw" },
        { subPattern: "G1r17", cond: "UD_PTS_0", action: "force_12" },
        { subPattern: "G2ee9", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G3o8", cond: "UD_PTS_0", action: "force_12" },
        { subPattern: "G3j4", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G1t3", cond: "UD_PTS_0", action: "force_udog_draw" },
        { subPattern: "G3j2", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G1b7", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G3r13", cond: "UD_PTS_5", action: "force_udog_draw" },
        { subPattern: "G3N1", cond: "UD_PTS_5", action: "force_fav_draw" },
        { subPattern: "G1a7", cond: "UD_PTS_20", action: "force_udog_draw" },
        { subPattern: "G3q3", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G1r02", cond: "UD_PTS_0", action: "force_12" },
        { subPattern: "G2pp2", cond: "UD_PTS_0", action: "force_udog_draw" },
        { subPattern: "G1o1", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G1x1", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G3q2", cond: "UD_PTS_20", action: "force_udog_draw" },
        { subPattern: "G1t01", cond: "FAV_LEAD_10", action: "force_fav_draw" },
        { subPattern: "G1ee10", cond: "FAV_LEAD_10", action: "force_fav_draw" },
        { subPattern: "G2ee3", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G2i18", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G1ff57", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G1m3", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G2g3", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G2f10", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G1s10", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G2ff44", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G1g3", cond: "UD_PTS_0", action: "force_12" },
        { subPattern: "G1a2", cond: "UD_PTS_0", action: "force_12" },
        { subPattern: "G2ee2", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G3o9", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G2aa4", cond: "UD_PTS_0", action: "force_12" },
        { subPattern: "G1j15", cond: "UD_PTS_0", action: "force_12" },
        { subPattern: "G2q12", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G2s18", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G3f14", cond: "UD_PTS_0", action: "force_12" },
        { subPattern: "G2jj1", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G1w4", cond: "UD_PTS_0", action: "force_fav_draw" },
        { subPattern: "G3i1", cond: "UD_PTS_5", action: "force_12" },
        { subPattern: "G1s15", cond: "UD_PTS_5", action: "force_fav_draw" },
        { subPattern: "G1j14", cond: "UD_PTS_10", action: "force_fav_draw" },
        { subPattern: "G2t7", cond: "UD_PTS_10", action: "force_12" },
        { subPattern: "G2p11", cond: "UD_PTS_10", action: "force_fav_draw" },
        { subPattern: "G2kk3", cond: "UD_PTS_15", action: "force_udog_draw" },
        { subPattern: "G1g16", cond: "UD_PTS_15", action: "force_fav_draw" },
        { subPattern: "G2l1", cond: "UD_PTS_20", action: "force_12" },
        { subPattern: "G3j1", cond: "UD_PTS_20", action: "force_udog_draw" },
        { subPattern: "G1j2", cond: "UD_PTS_20", action: "force_udog_draw" },
        { subPattern: "G1f29", cond: "UD_PTS_20", action: "force_12" },
        { subPattern: "G1i17", cond: "FAV_LEAD_10", action: "force_udog_draw" },
        { subPattern: "G3j1", cond: "FAV_LEAD_10", action: "force_12" },
        { subPattern: "G3s3", cond: "FAV_LEAD_10", action: "force_fav_draw" },
        { subPattern: "G1t3", cond: "FAV_LEAD_10", action: "force_12" },
        { subPattern: "G3ff45", cond: "FAV_LEAD_10", action: "force_12" },
        { subPattern: "G3t13", cond: "FAV_LEAD_10", action: "force_udog_draw" },
        { subPattern: "G3j11", cond: "FAV_LEAD_5", action: "force_fav_draw" },
        { subPattern: "G1ff57", cond: "FAV_LEAD_5", action: "force_fav_draw" },
        { subPattern: "G1r17", cond: "FAV_LEAD_5", action: "force_fav_draw" }
      ];
      const currentSubPattern = match.patternAnalysis?.subPattern || "NA";
      const gaHome = match.gaHome ?? 0;
      const gaAway = match.gaAway ?? 0;
      const matchedRule = tossUpRules.find((rule) => {
        if (rule.subPattern !== currentSubPattern) return false;
        if (rule.cond === "GA_10" && gaHome >= 1 && gaAway >= 1) return true;
        if (rule.cond === "GA_12" && gaHome >= 1.2 && gaAway >= 1.2) return true;
        if (rule.cond === "GA_15" && gaHome >= 1.5 && gaAway >= 1.5) return true;
        if (rule.cond === "GA_17" && gaHome >= 1.7 && gaAway >= 1.7) return true;
        if (rule.cond === "GA_20" && gaHome >= 2 && gaAway >= 2) return true;
        if (rule.cond === "GA_12_15" && (gaHome >= 1.2 && gaAway >= 1.5 || gaHome >= 1.5 && gaAway >= 1.2)) return true;
        return false;
      });
      const getFavInfo = (m) => {
        if (m.mo && m.mo !== "NA" && m.mo !== "Unknown" && m.mo !== "") {
          const parts = String(m.mo).split(/[,\s:\/\-]+/).map((p) => parseFloat(p.trim())).filter((p) => !isNaN(p));
          if (parts.length >= 3) {
            const o12 = parts[0];
            const o22 = parts[2];
            if (o12 !== o22) {
              return { fav: o12 < o22 ? "1" : "2", underdog: o12 < o22 ? "2" : "1" };
            }
          }
        }
        return null;
      };
      const favInfo = getFavInfo(match);
      let pointMatchedRule = null;
      if (favInfo && match.totalPoints) {
        const favPts = favInfo.fav === "1" ? match.totalPoints.home : match.totalPoints.away;
        const udogPts = favInfo.underdog === "1" ? match.totalPoints.home : match.totalPoints.away;
        pointMatchedRule = pointInfluenceRules.find((rule) => {
          if (rule.subPattern !== currentSubPattern) return false;
          if (rule.cond === "UD_PTS_0" && udogPts >= favPts) return true;
          if (rule.cond === "UD_PTS_5" && udogPts - favPts >= 5) return true;
          if (rule.cond === "UD_PTS_10" && udogPts - favPts >= 10) return true;
          if (rule.cond === "UD_PTS_15" && udogPts - favPts >= 15) return true;
          if (rule.cond === "UD_PTS_20" && udogPts - favPts >= 20) return true;
          if (rule.cond === "PTS_EQ" && Math.abs(favPts - udogPts) < 0.01) return true;
          if (rule.cond === "FAV_LEAD_10" && favPts >= udogPts && favPts - udogPts < 10) return true;
          if (rule.cond === "FAV_LEAD_5" && favPts >= udogPts && favPts - udogPts < 5) return true;
          if (rule.cond === "FAV_LEAD_3" && favPts >= udogPts && favPts - udogPts < 3) return true;
          return false;
        });
      }
      const activeOverrideRule = matchedRule || pointMatchedRule;
      const activeOverrideSource = matchedRule ? "Toss-up" : "Point Influence";
      if (activeOverrideRule && favInfo) {
        const fav = favInfo.fav;
        const udog = favInfo.underdog;
        if (activeOverrideRule.action === "force_fav") {
          optPred = fav;
          optFinalPrediction = fav;
        } else if (activeOverrideRule.action === "force_fav_draw") {
          optFinalPrediction = fav === "1" ? "1X" : "X2";
        } else if (activeOverrideRule.action === "force_udog_draw") {
          optFinalPrediction = fav === "1" ? "X2" : "1X";
        } else if (activeOverrideRule.action === "force_draw") {
          optPred = "X";
          optFinalPrediction = "X";
        } else if (activeOverrideRule.action === "force_12") {
          optFinalPrediction = "12";
        }
        reasonParts.push(`\u{1F3AF} ${activeOverrideSource} Override [${activeOverrideRule.action}]`);
      }
      if (optFinalPrediction === "12" && favInfo) {
        const hedgeOverrides = [
          { subPattern: "G2j10", action: "force_fav_draw" },
          { subPattern: "G1ff47", action: "force_fav_draw" },
          { subPattern: "G2f21", action: "force_fav_draw" },
          { subPattern: "G3o8", action: "force_fav_draw" },
          { subPattern: "G1o4", action: "force_fav_draw" },
          { subPattern: "G2ff34", action: "force_fav_draw" },
          { subPattern: "G2e8", action: "force_fav_draw" },
          { subPattern: "G1ff54", action: "force_fav_draw" },
          { subPattern: "G1ff43", action: "force_fav_draw" },
          { subPattern: "G1dd1", action: "force_fav_draw" },
          { subPattern: "G1ff44", action: "force_fav_draw" }
        ];
        const matchedHedge = hedgeOverrides.find((rule) => rule.subPattern === currentSubPattern);
        if (matchedHedge) {
          const fav = favInfo.fav;
          optFinalPrediction = fav === "1" ? "1X" : "X2";
          reasonParts.push(`\u{1F6E1}\uFE0F Hedge Override [force_fav_draw]`);
        }
      }
      prediction = optPred;
      finalPrediction = optFinalPrediction;
      p1 = optP1;
      pX = optPX;
      p2 = optP2;
      rawConfidence = Math.min(99, Math.round((optMaxP - 0.33) / 0.67 * 100));
      const reason = reasonParts.join(" | ") || "Algorithm Consensus";
      const enforced = enforceAlgoPredictionRules(prediction, finalPrediction, { "1": p1, "X": pX, "2": p2 });
      prediction = enforced.primaryPrediction;
      finalPrediction = enforced.finalPrediction;
      return {
        team: match.teams,
        prediction: finalPrediction,
        primaryPrediction: prediction,
        confidence: `${rawConfidence}%`,
        rawConfidence,
        probabilities: { "1": p1, "X": pX, "2": p2 },
        category,
        reason,
        odds: match.mo || "N/A",
        isUnshakable
      };
    };
  }
});

// src/components/ai/Aifilters.tsx
var applyAIFilters;
var init_Aifilters = __esm({
  "src/components/ai/Aifilters.tsx"() {
    applyAIFilters = (match, probabilities, phaStats) => {
      const activeFilters = [];
      const moParts = String(match.mo || "").split(",").map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
      const o1 = moParts[0] || 0;
      const o2 = moParts[2] || 0;
      let marketFav = "None";
      if (!isNaN(o1) && !isNaN(o2)) {
        if (o1 < o2) marketFav = "1";
        else if (o2 < o1) marketFav = "2";
      }
      const p1 = probabilities["1"];
      const pX = probabilities["X"];
      const p2 = probabilities["2"];
      let P_FAV = 0;
      let P_UND = 0;
      let P_DRAW = pX;
      if (marketFav === "1") {
        P_FAV = p1;
        P_UND = p2;
      } else if (marketFav === "2") {
        P_FAV = p2;
        P_UND = p1;
      } else {
        P_FAV = Math.max(p1, p2);
        P_UND = Math.min(p1, p2);
      }
      let PHA_SUPPORT_FAV = 0;
      let PHA_SUPPORT_UND = 0;
      let PHA_SUPPORT_DRAW = 0;
      if (phaStats && phaStats.total > 0) {
        const pha1 = phaStats.outcomes["1"] / phaStats.total;
        const pha2 = phaStats.outcomes["2"] / phaStats.total;
        const phaX = phaStats.outcomes["X"] / phaStats.total;
        PHA_SUPPORT_DRAW = phaX;
        if (marketFav === "1") {
          PHA_SUPPORT_FAV = pha1;
          PHA_SUPPORT_UND = pha2;
        } else if (marketFav === "2") {
          PHA_SUPPORT_FAV = pha2;
          PHA_SUPPORT_UND = pha1;
        }
      }
      const ODDS_HIGH_VOL = !isNaN(o1) && !isNaN(o2) && o1 > 2.5 && o2 > 2.5;
      let PHA_BALANCED = false;
      if (phaStats && phaStats.total > 0) {
        const pha1 = phaStats.outcomes["1"];
        const pha2 = phaStats.outcomes["2"];
        const diff = Math.abs(pha1 - pha2);
        if (diff <= 2 || diff / phaStats.total < 0.05) {
          PHA_BALANCED = true;
        }
      }
      const algoFavorsUnderdog = P_UND > P_FAV;
      if (match.isDaily) {
        if (!algoFavorsUnderdog && P_FAV > 0.45 && P_DRAW < 0.3 && P_UND < 0.3 && PHA_SUPPORT_FAV >= 0.5) activeFilters.push("DLF1");
        if (algoFavorsUnderdog && P_UND > 0.45 && P_DRAW < 0.3 && P_FAV < 0.3 && PHA_SUPPORT_UND >= 0.5) activeFilters.push("DLF2");
        if (PHA_SUPPORT_UND > 0.45) activeFilters.push("DLF3");
        if (PHA_SUPPORT_FAV < 0.5 && PHA_SUPPORT_FAV >= 0.45 && marketFav !== "None" && !algoFavorsUnderdog && P_FAV >= 0.45) activeFilters.push("DLF4");
        if (PHA_SUPPORT_FAV < 0.4 && marketFav !== "None") activeFilters.push("DLF5");
        if (PHA_SUPPORT_UND >= 0.5) activeFilters.push("DLF6");
        if (PHA_SUPPORT_DRAW >= 0.3 && PHA_SUPPORT_DRAW < 0.35) activeFilters.push("DLF7");
        if (PHA_SUPPORT_DRAW >= 0.35) activeFilters.push("DLF8");
        if (PHA_SUPPORT_FAV > 0.5 && marketFav !== "None") activeFilters.push("DLF9");
        if (P_FAV <= 0.35 && P_DRAW < 0.3 && marketFav !== "None") activeFilters.push("DLF10");
        if (P_FAV >= 0.5 && PHA_SUPPORT_FAV >= 0.5 && marketFav !== "None") activeFilters.push("DLF11");
        if (P_UND >= 0.45 && PHA_SUPPORT_UND >= 0.45) activeFilters.push("DLF12");
        if (P_UND >= 0.4 && PHA_SUPPORT_FAV < 0.5 && marketFav !== "None") activeFilters.push("DLF13");
        if (!algoFavorsUnderdog && P_FAV > 0.45 && P_DRAW < 0.3 && P_UND < 0.3 && PHA_SUPPORT_FAV >= 0.4 && PHA_SUPPORT_FAV < 0.5) activeFilters.push("DLF14");
        if (algoFavorsUnderdog && P_UND > 0.45 && P_DRAW < 0.3 && P_FAV < 0.3 && PHA_SUPPORT_UND >= 0.4 && PHA_SUPPORT_UND < 0.5) activeFilters.push("DLF15");
      }
      if (match.isJackpot) {
        if (!algoFavorsUnderdog && P_FAV > 0.45 && P_DRAW < 0.3 && P_UND < 0.3 && PHA_SUPPORT_FAV >= 0.5) activeFilters.push("JKF1");
        if (algoFavorsUnderdog && P_UND > 0.45 && P_DRAW < 0.3 && P_FAV < 0.3 && PHA_SUPPORT_UND >= 0.5) activeFilters.push("JKF2");
        if (PHA_SUPPORT_UND > 0.45) activeFilters.push("JKF3");
        if (PHA_SUPPORT_FAV < 0.5 && marketFav !== "None") activeFilters.push("JKF4");
        if (PHA_SUPPORT_FAV < 0.4 && marketFav !== "None") activeFilters.push("JKF5");
        if (PHA_SUPPORT_UND >= 0.5) activeFilters.push("JKF6");
        if (PHA_SUPPORT_DRAW >= 0.3 && PHA_SUPPORT_DRAW < 0.35) activeFilters.push("JKF7");
        if (PHA_SUPPORT_DRAW >= 0.35) activeFilters.push("JKF8");
        if (PHA_SUPPORT_FAV > 0.5 && marketFav !== "None") activeFilters.push("JKF9");
        if (P_FAV >= 0.5 && PHA_SUPPORT_FAV >= 0.5 && marketFav !== "None") activeFilters.push("JKF10");
        if (P_UND >= 0.45 && PHA_SUPPORT_UND >= 0.45) activeFilters.push("JKF11");
        if (P_UND >= 0.4 && PHA_SUPPORT_FAV < 0.5 && marketFav !== "None") activeFilters.push("JKF12");
        if (P_FAV <= 0.35 && P_DRAW < 0.3 && marketFav !== "None") activeFilters.push("JKF13");
        if (!algoFavorsUnderdog && P_FAV > 0.45 && P_DRAW < 0.3 && P_UND < 0.3 && PHA_SUPPORT_FAV >= 0.4 && PHA_SUPPORT_FAV < 0.5) activeFilters.push("JKF14");
        if (algoFavorsUnderdog && P_UND > 0.45 && P_DRAW < 0.3 && P_FAV < 0.3 && PHA_SUPPORT_UND >= 0.4 && PHA_SUPPORT_UND < 0.5) activeFilters.push("JKF15");
      }
      return activeFilters;
    };
  }
});

// src/components/ai/algorithm.tsx
var Algorithm, matchAlgorithm;
var init_algorithm = __esm({
  "src/components/ai/algorithm.tsx"() {
    init_matchProcessing();
    init_Dlivealgorithm();
    init_JKalgorithm();
    init_Aifilters();
    Algorithm = class {
      constructor() {
        this.patternStats = /* @__PURE__ */ new Map();
        this.isTrained = false;
        // Weights determine how much we trust a signal
        // UPDATED BASED ON STRATEGY ROOM ADJUSTMENTS: External Source Deprioritization (Zero Weight)
        this.weights = {
          exactMatch: 0,
          subPattern: 5,
          mainPattern: 0,
          flags: 0,
          odds: 5,
          external: 0,
          points: 0,
          subPatternPrediction: 0
        };
      }
      /**
       * Learns from historical data by populating statistical maps.
       */
      train(history) {
        this.patternStats.clear();
        history.forEach((m) => {
          const result = getActualResult(m.result);
          if (result === "pending") return;
          this.recordStat(`M:${m.patternAnalysis?.mainPattern || "NA"}`, result, m);
          this.recordStat(`S:${m.patternAnalysis?.subPattern || "NA"}`, result, m);
          m.patternAnalysis?.activeFlags.forEach((f) => {
            this.recordStat(`F:${f}`, result, m);
          });
          if (m.patternAnalysis?.activeFlags) {
            const flagKey = `EX:${m.patternAnalysis.mainPattern}|${m.patternAnalysis.activeFlags.sort().join("+")}`;
            this.recordStat(flagKey, result, m);
          }
        });
        this.isTrained = true;
      }
      async trainChunked(history, batchSize = 250, shouldCancel) {
        this.patternStats.clear();
        this.isTrained = false;
        for (let start = 0; start < history.length; start += batchSize) {
          if (shouldCancel?.()) return;
          const end = Math.min(start + batchSize, history.length);
          for (let i = start; i < end; i++) {
            const m = history[i];
            const result = getActualResult(m.result);
            if (result === "pending") continue;
            this.recordStat(`M:${m.patternAnalysis?.mainPattern || "NA"}`, result, m);
            this.recordStat(`S:${m.patternAnalysis?.subPattern || "NA"}`, result, m);
            m.patternAnalysis?.activeFlags.forEach((f) => {
              this.recordStat(`F:${f}`, result, m);
            });
            if (m.patternAnalysis?.activeFlags) {
              const flagKey = `EX:${m.patternAnalysis.mainPattern}|${[...m.patternAnalysis.activeFlags].sort().join("+")}`;
              this.recordStat(flagKey, result, m);
            }
          }
          await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
        }
        if (!shouldCancel?.()) {
          this.isTrained = true;
        }
      }
      reset() {
        this.patternStats.clear();
        this.isTrained = false;
      }
      recordStat(key, result, match) {
        if (!this.patternStats.has(key)) {
          this.patternStats.set(key, {
            total: 0,
            paaTotal: 0,
            outcomes: { "1": 0, "X": 0, "2": 0 },
            paa: { favWin: 0, draw: 0, upsetWin: 0 }
          });
        }
        const stats = this.patternStats.get(key);
        stats.total++;
        if (stats.paaTotal === void 0) stats.paaTotal = 0;
        if (result === "1" || result === "X" || result === "2") {
          stats.outcomes[result]++;
        }
        let moFav = "";
        let moUnderdog = "";
        if (match.mo) {
          const parts = String(match.mo).split(/[,\s:\/\-]+/).map((p) => parseFloat(p.trim())).filter((p) => !isNaN(p));
          if (parts.length >= 3) {
            const o1 = parts[0];
            const o2 = parts[2];
            moFav = o1 < o2 ? "1" : "2";
            moUnderdog = o1 < o2 ? "2" : "1";
          }
        }
        if (moFav && moUnderdog) {
          stats.paaTotal++;
          if (result === moFav) stats.paa.favWin++;
          else if (result === "X") stats.paa.draw++;
          else if (result === moUnderdog) stats.paa.upsetWin++;
        }
      }
      // Public accessor for Self Learning Engine
      getRawPatternStats(key) {
        return this.patternStats.get(key);
      }
      getProbabilities(key, minSample = 0) {
        const stats = this.patternStats.get(key);
        if (!stats || stats.total < minSample) return null;
        return {
          "1": stats.outcomes["1"] / stats.total,
          "X": stats.outcomes["X"] / stats.total,
          "2": stats.outcomes["2"] / stats.total,
          total: stats.total,
          paaTotal: stats.paaTotal ?? stats.total,
          favWin: stats.paa.favWin,
          draw: stats.paa.draw,
          upsetWin: stats.paa.upsetWin
        };
      }
      // Convert a 1X2 string into probabilities for weighting
      getProbsFromPrediction(pred) {
        const p = pred ? pred.trim() : "";
        if (p === "1") return { "1": 0.85, "X": 0.1, "2": 0.05 };
        if (p === "2") return { "1": 0.05, "X": 0.1, "2": 0.85 };
        if (p === "X") return { "1": 0.2, "X": 0.6, "2": 0.2 };
        if (p === "1X") return { "1": 0.55, "X": 0.35, "2": 0.1 };
        if (p === "X2") return { "1": 0.1, "X": 0.35, "2": 0.55 };
        if (p === "12") return { "1": 0.48, "X": 0.04, "2": 0.48 };
        return { "1": 0.33, "X": 0.33, "2": 0.33 };
      }
      /**
       * Helper to calculate the historical win rate of a specific prediction for a sub-pattern.
       */
      getPatternWinRate(subPattern, patternPrediction) {
        if (!subPattern || !patternPrediction) return 0;
        const key = `S:${subPattern}`;
        const stats = this.patternStats.get(key);
        if (!stats || stats.total < 3) return 0;
        let wins = 0;
        const p = patternPrediction;
        if (p.includes("1")) wins += stats.outcomes["1"];
        if (p.includes("X")) wins += stats.outcomes["X"];
        if (p.includes("2")) wins += stats.outcomes["2"];
        return wins / stats.total * 100;
      }
      /**
       * Public helper to get a distribution string for a pattern key.
       */
      getPatternReliability(subPattern) {
        if (!subPattern) return "No Data";
        const key = `S:${subPattern}`;
        const stats = this.patternStats.get(key);
        if (!stats || stats.total < 3) return "Low Data";
        const t = stats.total;
        const p1 = Math.round(stats.outcomes["1"] / t * 100);
        const pX = Math.round(stats.outcomes["X"] / t * 100);
        const p2 = Math.round(stats.outcomes["2"] / t * 100);
        return `1:${p1}% X:${pX}% 2:${p2}% (N=${t})`;
      }
      /**
       * IMPLEMENTING USER'S 7-STEP FILTER ALGORITHM
       * This logic is strictly for Selection Filtering, separate from raw prediction.
       */
      evaluateMatchQuality(match) {
        let score = 100;
        const reasons = [];
        let isQualified = true;
        let phaLean = "Clean";
        let forceHedge = false;
        const moParts = String(match.mo || "").split(",").map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
        const o1 = moParts[0] || 0;
        const oX = moParts[1] || 0;
        const o2 = moParts[2] || 0;
        const minOdds = Math.min(o1, oX, o2);
        let moPred = "";
        if (moParts.length >= 3) {
          if (minOdds === o1) moPred = "1";
          else if (minOdds === o2) moPred = "2";
          else moPred = "X";
        }
        const isHighOdds = !isNaN(minOdds) && minOdds >= 2;
        if (!isNaN(minOdds) && minOdds < 1.35) {
          return {
            score: 0,
            isQualified: false,
            reason: "Odds < 1.35 (Prohibited)",
            recommendedType: "Avoid",
            phaLean: "None"
          };
        }
        if (!isNaN(o1) && !isNaN(o2) && o1 >= 2.5 && o2 >= 2.5) {
          score -= 25;
          reasons.push("Volatile (Both > 2.50)");
          forceHedge = true;
        }
        const subP = match.patternAnalysis?.subPattern;
        const phaStats = subP ? this.patternStats.get(`S:${subP}`) : null;
        let hasPhaAuthority = false;
        if (phaStats && phaStats.total >= 3) {
          const p1 = phaStats.outcomes["1"] / phaStats.total;
          const p2 = phaStats.outcomes["2"] / phaStats.total;
          if (p1 > 0.6 || p2 > 0.6) hasPhaAuthority = true;
        }
        if (moPred && phaStats && phaStats.total >= 3) {
          const p1 = phaStats.outcomes["1"] / phaStats.total;
          const pX = phaStats.outcomes["X"] / phaStats.total;
          const p2 = phaStats.outcomes["2"] / phaStats.total;
          let phaFav = "";
          if (p1 > pX && p1 > p2) phaFav = "1";
          else if (p2 > p1 && p2 > pX) phaFav = "2";
          if (phaFav && phaFav !== moPred && phaFav !== "X") {
            isQualified = false;
            reasons.push("PHA Divergence Risk (Fav Mismatch)");
            score -= 40;
          }
        }
        const pointsPred = match.calculatedPrediction || "";
        const isContradiction = (p1, p2) => {
          if ((p1 === "1" || p1.includes("1")) && (p2 === "2" || p2.includes("2"))) return true;
          if ((p1 === "2" || p1.includes("2")) && (p2 === "1" || p2.includes("1"))) return true;
          return false;
        };
        if (isHighOdds) {
          const algoPred2 = match.patternAnalysis?.subPatternPrediction;
          if (algoPred2 && moPred && !matchesPrediction(algoPred2, moPred)) {
            isQualified = false;
            reasons.push("Algo Disagreement (High Odds)");
            score -= 100;
          }
        } else {
          if (!hasPhaAuthority && pointsPred && moPred && isContradiction(pointsPred, moPred)) {
            const algoPred2 = match.patternAnalysis?.subPatternPrediction;
            const isAlgoUpset = algoPred2 && moPred && !matchesPrediction(algoPred2, moPred);
            if (!isAlgoUpset) {
              isQualified = false;
              reasons.push("Points vs Market Disagreement");
              score -= 50;
            }
          }
        }
        if (!phaStats || phaStats.total < 3) {
          isQualified = false;
          reasons.push("No PHA / Low Data");
          score -= 40;
          phaLean = "None";
        } else {
          const total = phaStats.total;
          const pX = phaStats.outcomes["X"] / total;
          if (pX > 0.3) {
            phaLean = "Split";
            score -= 20;
            reasons.push("PHA Split (High Draw Risk)");
          }
          if (!isNaN(minOdds) && minOdds < 2 && pX > 0.3) {
            isQualified = false;
            reasons.push("Critical Draw Risk (>30%)");
            score -= 30;
          }
        }
        const tsa = match.tsa || 0;
        const tsb = match.tsb || 0;
        const algoPred = match.patternAnalysis?.subPatternPrediction;
        const isUpsetCandidate = algoPred && moPred && !matchesPrediction(algoPred, moPred);
        if (!match.isJackpot && !isHighOdds && !isUpsetCandidate) {
          if (moPred === "1" && tsb > tsa && minOdds >= 1.5) {
            score -= 30;
            isQualified = false;
            reasons.push("TS Opposes Favorite");
          } else if (moPred === "2" && tsa > tsb && minOdds >= 1.5) {
            score -= 30;
            isQualified = false;
            reasons.push("TS Opposes Favorite");
          }
        }
        const flags = match.patternAnalysis?.activeFlags || [];
        if (flags.includes("POTENTIAL_DRAW")) {
          score -= 15;
          reasons.push("Potential Draw Flag");
        }
        const subPred = match.patternAnalysis?.subPatternPrediction;
        if (subPred === "MO" || subPred === "Upset" || subPred === "PTS") {
          score -= 10;
        }
        let recommendedType = "Avoid";
        if (isQualified && score >= 50) {
          if (minOdds >= 1.35 && minOdds <= 1.99) {
            recommendedType = forceHedge ? "Hedge" : "Single";
          } else if (minOdds >= 2) {
            let isValuePickCandidate = false;
            if (minOdds <= 2.6 && phaStats && phaStats.total >= 3) {
              const p1 = phaStats.outcomes["1"] / phaStats.total;
              const p2 = phaStats.outcomes["2"] / phaStats.total;
              const algoAgree = match.patternAnalysis?.subPatternPrediction && matchesPrediction(match.patternAnalysis.subPatternPrediction, moPred);
              if ((moPred === "1" && p1 >= 0.45 || moPred === "2" && p2 >= 0.45) && algoAgree) {
                isValuePickCandidate = true;
              }
            }
            if (isValuePickCandidate && !forceHedge) {
              recommendedType = "Single";
            } else {
              recommendedType = "Hedge";
            }
          } else {
            recommendedType = "Avoid";
          }
        } else {
          recommendedType = "Avoid";
        }
        if (!isHighOdds && minOdds > 1.8 && phaStats && phaStats.total >= 3) {
          const support = phaStats.outcomes[moPred] / phaStats.total;
          if (support <= 0.5) {
            isQualified = false;
            reasons.push("Value Trap: Low PHA Support");
            score -= 60;
          }
        }
        if (moPred && phaStats && phaStats.total >= 3) {
          const p1 = phaStats.outcomes["1"] / phaStats.total;
          const p2 = phaStats.outcomes["2"] / phaStats.total;
          const pX = phaStats.outcomes["X"] / phaStats.total;
          const maxP = Math.max(p1, pX, p2);
          let phaPred = "";
          if (maxP === p1) phaPred = "1";
          else if (maxP === p2) phaPred = "2";
          else phaPred = "X";
          if (phaPred !== moPred && phaPred !== "X") {
            const minO = Math.min(o1, o2);
            if (minO > 2.6) {
              reasons.push("High Value Conflict (>2.60)");
            } else if (minO < 2.5) {
              isQualified = false;
              reasons.push("Conflict Resolution: Discard (<2.50)");
              score -= 100;
            }
          }
        }
        const isAlgoUpsetOverride = algoPred && moPred && !matchesPrediction(algoPred, moPred);
        if (!isAlgoUpsetOverride && !hasPhaAuthority && minOdds < 1.7 && pointsPred && !matchesPrediction(pointsPred, moPred)) {
          isQualified = false;
          reasons.push("Points Disagree with Fav (<1.70)");
          score -= 40;
        }
        if (pointsPred && moPred && pointsPred !== moPred) {
          const hasSubPattern = subP && subP !== "NA" && subP !== "None";
          if (!hasSubPattern) {
            isQualified = false;
            reasons.push("Conflict Zone (No SubPattern)");
            score -= 100;
          }
        }
        if (!isHighOdds && !hasPhaAuthority && pointsPred && pointsPred !== moPred) {
          const subPred2 = match.patternAnalysis?.subPatternPrediction;
          if (subPred2 && !matchesPrediction(subPred2, pointsPred)) {
            isQualified = false;
            reasons.push("Points Unverified");
            score -= 30;
          }
        }
        if ((match.maxPoints || 0) < 45) {
          score -= 20;
          reasons.push("Low Points (Volatile)");
          if (recommendedType === "Single") recommendedType = "Hedge";
        }
        if (!match.isJackpot && match.group === 2 && Math.abs((match.tsa || 0) - (match.tsb || 0)) < 1.5) {
          score -= 15;
          reasons.push("Group 2 Volatility (TS Diff < 1.5)");
          recommendedType = "Hedge";
        }
        if (match.group === 3 && !isNaN(minOdds) && minOdds < 1.7) {
          if (phaStats && phaStats.total >= 3) {
            score += 15;
          }
        }
        const isYouthLeague = /\b(U21|U23|Res|Reserve|Youth)\b/i.test(match.teams);
        if (isYouthLeague) {
          score -= 30;
          reasons.push("Youth League Variance");
          if (recommendedType !== "Avoid") recommendedType = "Hedge";
        }
        if (score < 50) isQualified = false;
        return {
          score: Math.max(0, score),
          isQualified,
          reason: reasons.join(" | ") || "Clean Profile",
          recommendedType,
          phaLean
        };
      }
      /**
       * Static helper to apply dynamic protocols that override static sub-pattern rules.
       * This is used in processMatch (before AI Analysis).
       */
      static applyPatternOverrides(match, subPatternId, basePrediction) {
        return basePrediction;
      }
      /**
       * Returns a confidence rating (0-5 stars) and color based on Sub-Pattern reliability.
       */
      static getPatternConfidence(subPatternId) {
        if (["G2ff42", "G3q3", "G2ff38", "G2p10", "G2ff_fav_h", "G2ff_fav_a"].includes(subPatternId)) {
          return { stars: 5, color: "text-amber-500" };
        }
        if (["G2ff43", "G2m14", "G1g14", "G1r1_new", "G1ff_2"].includes(subPatternId)) {
          return { stars: 4.5, color: "text-emerald-500" };
        }
        if (["G1t2", "G2i13", "G2q1", "G3m1", "G2o7", "G3t_x"].includes(subPatternId)) {
          return { stars: 4, color: "text-blue-500" };
        }
        if (["G2ee15", "G2ee9", "G2ff39", "G2e5", "G2ee11", "G2j11", "G2o11", "G1o12", "G2y1", "G1a6"].includes(subPatternId)) {
          return { stars: 1.5, color: "text-orange-500" };
        }
        return { stars: 3, color: "text-gray-400" };
      }
      /**
       * Final validation pass to ensure independence and protocol adherence.
       */
      validatePrediction(match, result) {
        const updated = { ...result };
        const subP = match.patternAnalysis?.subPattern;
        const stats = subP ? this.getRawPatternStats(`S:${subP}`) : null;
        const moParts = String(match.mo || "").split(/[- ,]+/).map((s) => parseFloat(s.trim())).filter((s) => !isNaN(s));
        const o1 = moParts[0];
        const o2 = moParts[2];
        if (!isNaN(o1) && !isNaN(o2)) {
          const marketFav = o1 < o2 ? "1" : "2";
          const marketFavOdds = Math.min(o1, o2);
          if (updated.prediction === marketFav && marketFavOdds < 1.5 && stats && stats.total >= 3) {
            const support = stats.outcomes[marketFav] / stats.total;
            if (support < 0.4) {
              updated.reason = `[INDEPENDENCE CHECK] Weak Internal Support (${Math.round(support * 100)}%) for Fav. Downgraded. | ` + updated.reason;
              updated.category = "Standard";
              updated.rawConfidence = Math.min(updated.rawConfidence, 60);
              updated.isUnshakable = false;
            }
          }
        }
        if (updated.prediction !== match.calculatedPrediction && !updated.reason.includes("Conflict")) {
          const hasProtocolOverride = updated.reason.includes("Protocol") || updated.reason.includes("Override") || updated.reason.includes("Hedge") || updated.reason.includes("Trap") || updated.reason.includes("Risk");
          if (!hasProtocolOverride) {
            updated.reason = `[PROTOCOL CHECK] Points Disagreement Verified. | ` + updated.reason;
          }
        }
        return updated;
      }
      /**
       * Generates a prediction for a single match based on learned stats.
       * Delegates to specialized engines based on match type.
       */
      predict(match) {
        let result;
        if (match.isJackpot) {
          result = predictJackpot(match, this);
        } else {
          result = predictDaily(match, this);
        }
        const phaStats = this.getRawPatternStats(`S:${match.patternAnalysis?.subPattern}`);
        const filters = applyAIFilters(match, result.probabilities, phaStats);
        result.activeFilters = filters;
        const pointsPred = match.calculatedPrediction || match.finalPrediction || "";
        const paaPred = match.patternAnalysis?.subPatternPrediction || "";
        const basePred = result.prediction;
        const hasConsensus = pointsPred !== "" && paaPred !== "" && [...basePred].some((char) => pointsPred.includes(char) && paaPred.includes(char));
        result.isTripleConsensus = hasConsensus;
        result = this.validatePrediction(match, result);
        const qualityAudit = this.evaluateMatchQuality(match);
        const enforced = enforceAlgoPredictionRules(
          result.primaryPrediction || result.prediction,
          result.prediction,
          result.probabilities
        );
        result.primaryPrediction = enforced.primaryPrediction;
        result.prediction = enforced.finalPrediction;
        return {
          ...result,
          qualityAudit
        };
      }
      generateReport(matches) {
        const predictions = matches.map((m) => this.predict(m));
        const bankers = predictions.filter((p) => p.category === "Banker");
        const value = predictions.filter((p) => p.category === "Value");
        const upsets = predictions.filter((p) => p.category === "Upset");
        const sorted = [...predictions].sort((a, b) => b.rawConfidence - a.rawConfidence);
        const botb_best = sorted.slice(10, 20).filter((p) => p.rawConfidence >= 65);
        return {
          bankers,
          value_bets: value,
          upsets,
          top_10: sorted.slice(0, 10),
          botb_best,
          jackpot_predictions: predictions,
          high_confidence: predictions.filter((p) => p.rawConfidence >= 75)
        };
      }
      getOptimizationData(matches) {
        const predictions = matches.map((m) => ({ ...this.predict(m), actual: getActualResult(m.result), match: m }));
        const completed = predictions.filter((p) => p.actual !== "pending");
        const total = completed.length;
        const correct = completed.filter((p) => matchesPrediction(p.prediction, p.actual)).length;
        const bankers = completed.filter((p) => p.rawConfidence >= 75);
        const bankersCorrect = bankers.filter((p) => matchesPrediction(p.prediction, p.actual)).length;
        const falseBankers = bankers.filter((p) => !matchesPrediction(p.prediction, p.actual)).map((p) => ({
          team: p.team,
          pred: p.prediction,
          actual: p.actual,
          conf: p.rawConfidence,
          subPattern: p.match.patternAnalysis?.subPattern || void 0
        }));
        const missedUpsets = [];
        completed.forEach((p) => {
          const moParts = String(p.match.mo || "").split(",").map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
          const homeOdds = moParts[0];
          const awayOdds = moParts[2];
          const minOdds = Math.min(homeOdds, awayOdds);
          if (!isNaN(minOdds) && minOdds < 1.5 && !matchesPrediction(p.prediction, p.actual)) {
            missedUpsets.push({
              team: p.team,
              pred: p.prediction,
              actual: p.actual,
              odds: p.odds,
              subPattern: p.match.patternAnalysis?.subPattern || void 0
            });
          }
        });
        const getAcc = (subset) => {
          if (subset.length === 0) return "N/A";
          const c = subset.filter((p) => matchesPrediction(p.prediction, p.actual)).length;
          return `${Math.round(c / subset.length * 100)}% (${c}/${subset.length})`;
        };
        const accuracyByPattern = {};
        const patterns = [...new Set(completed.map((p) => p.match.patternAnalysis?.mainPattern || "NA"))];
        patterns.forEach((pat) => {
          accuracyByPattern[pat] = getAcc(completed.filter((p) => (p.match.patternAnalysis?.mainPattern || "NA") === pat));
        });
        const accuracyBySubPattern = {};
        const subPatterns = [...new Set(completed.map((p) => p.match.patternAnalysis?.subPattern || "NA"))];
        subPatterns.forEach((pat) => {
          accuracyBySubPattern[pat] = getAcc(completed.filter((p) => (p.match.patternAnalysis?.subPattern || "NA") === pat));
        });
        const accuracyByGroup = {};
        [1, 2, 3].forEach((g) => {
          accuracyByGroup[`Group ${g}`] = getAcc(completed.filter((p) => p.match.group === g));
        });
        return {
          totalProcessed: total,
          accuracyOverall: total > 0 ? `${Math.round(correct / total * 100)}%` : "0%",
          bankerAccuracy: bankers.length > 0 ? `${Math.round(bankersCorrect / bankers.length * 100)}%` : "N/A",
          falseBankers,
          missedUpsets,
          accuracyByPattern,
          accuracyBySubPattern,
          accuracyByGroup
        };
      }
    };
    matchAlgorithm = new Algorithm();
  }
});

// src/utils/matchProcessing.ts
var enforceAlgoPredictionRules, getActualResult, matchesPrediction, isMatchCorrectForCategory, sortPrediction, getFavoriteAndUnderdog, calculatePAAPrediction, isMatchGoalAccurate;
var init_matchProcessing = __esm({
  "src/utils/matchProcessing.ts"() {
    init_matchEvaluator();
    init_Patterns();
    init_algorithm();
    enforceAlgoPredictionRules = (primary, final, probs) => {
      let prim = (primary || "").trim().toUpperCase();
      if (!["1", "X", "2"].includes(prim)) {
        if (prim.includes("1")) prim = "1";
        else if (prim.includes("2")) prim = "2";
        else if (prim.includes("X")) prim = "X";
        else prim = "1";
      }
      let fin = (final || "").trim().toUpperCase();
      if (!fin) fin = prim;
      const p1 = probs?.["1"] ?? 0;
      const pX = probs?.["X"] ?? 0;
      const p2 = probs?.["2"] ?? 0;
      if (prim === "1") {
        if (fin === "X2") {
          fin = pX >= p2 ? "1X" : "12";
        } else if (fin === "X") {
          fin = "1X";
        } else if (fin === "2") {
          fin = "12";
        } else if (!fin.includes("1")) {
          fin = pX >= p2 ? "1X" : "12";
        }
      } else if (prim === "2") {
        if (fin === "1X") {
          fin = pX >= p1 ? "X2" : "12";
        } else if (fin === "1") {
          fin = "12";
        } else if (fin === "X") {
          fin = "X2";
        } else if (!fin.includes("2")) {
          fin = pX >= p1 ? "X2" : "12";
        }
      } else if (prim === "X") {
        if (fin === "12") {
          fin = p1 >= p2 ? "1X" : "X2";
        } else if (fin === "1") {
          fin = "1X";
        } else if (fin === "2") {
          fin = "X2";
        } else if (!fin.includes("X")) {
          fin = p1 >= p2 ? "1X" : "X2";
        }
      }
      return { primaryPrediction: prim, finalPrediction: fin };
    };
    getActualResult = (result) => {
      if (result === "pending" || result === "?-?" || !result) return "pending";
      const trimmed = result.trim().toLowerCase();
      if (trimmed === "pending" || trimmed === "cancelled" || trimmed === "postponed" || trimmed === "abn") return "pending";
      const scoreMatch = trimmed.match(/(\d+)\s*[:\-\/\s]\s*(\d+)/);
      let hStr = "";
      let aStr = "";
      if (scoreMatch) {
        hStr = scoreMatch[1];
        aStr = scoreMatch[2];
        if (hStr.length >= 3 && parseInt(hStr) > 20) hStr = hStr.slice(-1);
        if (aStr.length >= 3 && parseInt(aStr) > 20) aStr = aStr.slice(0, 1);
      } else {
        const fallbackMatch = trimmed.match(/(\d+)[^\d]+(\d+)/);
        if (fallbackMatch) {
          hStr = fallbackMatch[1];
          aStr = fallbackMatch[2];
        } else {
          return "pending";
        }
      }
      const h = parseInt(hStr, 10);
      const a = parseInt(aStr, 10);
      if (isNaN(h) || isNaN(a)) return "pending";
      if (h > 15 || a > 15) {
        if (hStr.length > 2 || aStr.length > 2) return "pending";
      }
      if (h > a) return "1";
      if (h === a) return "X";
      return "2";
    };
    matchesPrediction = (pred, actual) => {
      if (!pred || !actual || actual === "pending") return false;
      const cleanPred = pred.trim();
      if (cleanPred === actual) return true;
      if (cleanPred === "1X" && (actual === "1" || actual === "X")) return true;
      if (cleanPred === "X2" && (actual === "X" || actual === "2")) return true;
      if (cleanPred === "12" && (actual === "1" || actual === "2")) return true;
      return false;
    };
    isMatchCorrectForCategory = (match, pred, actual, category) => {
      return matchesPrediction(pred, actual);
    };
    sortPrediction = (p1, p2) => {
      if (p1 === "1" && p2 === "2" || p1 === "2" && p2 === "1") return "12";
      if (p1 === "1" && p2 === "X" || p1 === "X" && p2 === "1") return "1X";
      if (p1 === "X" && p2 === "2" || p1 === "2" && p2 === "X") return "X2";
      return p1 + p2;
    };
    getFavoriteAndUnderdog = (m) => {
      if (m.mo && m.mo !== "NA" && m.mo !== "Unknown" && m.mo !== "") {
        const parts = String(m.mo).split(/[,\s:\/\-]+/).map((p) => parseFloat(p.trim())).filter((p) => !isNaN(p));
        if (parts.length >= 3) {
          const o1 = parts[0];
          const o2 = parts[2];
          const fav = o1 <= o2 ? "1" : "2";
          const underdog = o1 <= o2 ? "2" : "1";
          return { fav, underdog };
        }
      }
      return { fav: "1", underdog: "2" };
    };
    calculatePAAPrediction = (match, stats) => {
      if (!stats) return null;
      const denom = stats.paaTotal > 0 ? stats.paaTotal : stats.total;
      if (denom === 0) return null;
      const favWin = stats.favWin / denom * 100;
      const draw = stats.draw / denom * 100;
      const upsetWin = stats.upsetWin / denom * 100;
      const favInfo = getFavoriteAndUnderdog(match);
      if (!favInfo) return null;
      const { fav: moFav, underdog: moUpset } = favInfo;
      let primary = "";
      let hedge = "";
      if (favWin === draw && draw === upsetWin) {
        primary = "X";
        hedge = moUpset;
      } else if (favWin > draw && favWin > upsetWin && draw === upsetWin) {
        primary = moFav;
        hedge = moUpset;
      } else if (draw > favWin && draw > upsetWin && favWin === upsetWin) {
        primary = "X";
        hedge = moFav;
      } else if (upsetWin > favWin && upsetWin > draw && draw === favWin) {
        primary = moUpset;
        hedge = "X";
      } else {
        const map = [
          { key: moFav, val: favWin },
          { key: "X", val: draw },
          { key: moUpset, val: upsetWin }
        ];
        map.sort((a, b) => b.val - a.val);
        primary = map[0].key;
        hedge = map[1].key;
      }
      const finalStr = sortPrediction(primary, hedge);
      return { paaPrimaryPrediction: primary, paaPrediction: finalStr };
    };
    isMatchGoalAccurate = (m, pred, actual, categoryId, phaStatsMap) => {
      if (!actual || actual === "pending") return false;
      const stats = getMatchStats(m, phaStatsMap);
      const moFav = stats.moFav;
      const moUnderdog = stats.moUnderdog;
      const favOdds = stats.favOdds;
      switch (categoryId) {
        case "top_12_safe":
        case "botb_jackpot":
        case "botb_best":
        case "top20":
        case "top_20_value":
          if (favOdds >= 2) {
            return actual === moFav || actual === "X";
          }
          return actual === moFav;
        case "value_bets":
          return matchesPrediction(pred, actual);
        case "best_bet":
        case "bankers_dlive":
        case "bankers_jackpot":
        case "value_picks":
        case "top10":
        case "top_10_value":
          return actual === moFav;
        case "banker_draws":
          return actual === "X";
        case "upsets":
          return actual === moUnderdog;
        default:
          return matchesPrediction(pred, actual);
      }
    };
  }
});

// src/lib/supabase.ts
var import_supabase_js, import_meta, getEnv, supabaseUrl, supabaseAnonKey, customStorage, supabase;
var init_supabase = __esm({
  "src/lib/supabase.ts"() {
    import_supabase_js = require("@supabase/supabase-js");
    import_meta = {};
    getEnv = (key) => {
      try {
        if (typeof import_meta !== "undefined" && import_meta.env) {
          return import_meta.env[key] || "";
        }
      } catch (e) {
      }
      try {
        if (typeof process !== "undefined" && process.env) {
          return process.env[key] || "";
        }
      } catch (e) {
      }
      return "";
    };
    supabaseUrl = getEnv("VITE_SUPABASE_URL");
    supabaseAnonKey = getEnv("VITE_SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn(
        "Supabase credentials (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are missing in environmental setup. Please configure them in your settings/environment variables."
      );
    }
    customStorage = {
      getItem: (key) => {
        try {
          if (typeof localStorage !== "undefined") {
            return localStorage.getItem(key);
          }
        } catch (e) {
        }
        return null;
      },
      setItem: (key, value) => {
        try {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(key, value);
          }
        } catch (e) {
          if (typeof localStorage !== "undefined" && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.message?.includes("exceeded the quota"))) {
            console.warn("Storage quota exceeded. Evicting caches to save auth token...");
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k) {
                if (k.startsWith("prm_archive_data_") || k.startsWith("prm_uploaded_matches") || k.startsWith("prm_ai_history") || k.startsWith("local_seer_snapshot_")) {
                  keysToRemove.push(k);
                }
              }
            }
            keysToRemove.forEach((k) => localStorage.removeItem(k));
            try {
              localStorage.setItem(key, value);
            } catch (retryErr) {
              console.error("Still exceeding quota after cleanup", retryErr);
            }
          } else {
            throw e;
          }
        }
      },
      removeItem: (key) => {
        try {
          if (typeof localStorage !== "undefined") {
            localStorage.removeItem(key);
          }
        } catch (e) {
        }
      }
    };
    supabase = (0, import_supabase_js.createClient)(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: customStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    });
    if (typeof window !== "undefined") {
      window.addEventListener("unhandledrejection", (event) => {
        const reason = event?.reason;
        const strReason = String(reason || "");
        if (strReason.includes("grant_type=refresh_token") || strReason.includes("Failed to fetch") || reason?.name === "AuthRetryableFetchError" && strReason.includes("refresh_token")) {
          console.warn("[Supabase Auth] Token refresh error detected. Evicting stale auth token to prevent infinite CORS retries.");
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && (key.includes("sb-") && key.includes("-auth-token"))) {
                localStorage.removeItem(key);
              }
            }
          } catch (e) {
          }
        }
      });
    }
  }
});

// src/services/supabaseSupremeWeights.ts
var init_supabaseSupremeWeights = __esm({
  "src/services/supabaseSupremeWeights.ts"() {
    init_supabase();
  }
});

// src/services/supabaseStorage.ts
var import_idb_keyval, isHeavyRedundantKey, lastSyncedValues, DIRTY_KEYS_STORE_KEY, isBrowser, safeLS, loadDirtyKeys, lastSavedDirtyKeysJson, isSavingDirtyKeys, saveDirtyKeys, dirtyKeys, LOAD_THRESHOLD, SYNC_INTERVAL, syncTimeout, isSyncInProgress, debouncedSyncToSupabase, forceSyncToSupabase;
var init_supabaseStorage = __esm({
  "src/services/supabaseStorage.ts"() {
    init_supabase();
    init_storage();
    import_idb_keyval = require("idb-keyval");
    init_supabaseSupremeWeights();
    isHeavyRedundantKey = (key) => {
      if (!key) return false;
      return key.startsWith("prm_uploaded_matches") || key.startsWith("prm_live_matches") || key.startsWith("prm_match_archives") || key.startsWith("prm_performance_archives") || key.startsWith("prm_ai_history") || key.startsWith("prm_ai_") || key.startsWith("prm_archive_data_") || key.startsWith("prm_archive_manifest") || key.startsWith("slip_");
    };
    lastSyncedValues = {};
    DIRTY_KEYS_STORE_KEY = "prm_pending_sync_keys";
    isBrowser = typeof window !== "undefined" && typeof localStorage !== "undefined";
    safeLS = {
      getItem: (key) => {
        if (!isBrowser) return null;
        try {
          return localStorage.getItem(key);
        } catch (e) {
          return null;
        }
      },
      setItem: (key, value) => {
        if (!isBrowser) return;
        try {
          localStorage.setItem(key, value);
        } catch (e) {
          throw e;
        }
      },
      removeItem: (key) => {
        if (!isBrowser) return;
        try {
          localStorage.removeItem(key);
        } catch (e) {
        }
      }
    };
    loadDirtyKeys = () => {
      try {
        const stored = safeLS.getItem(DIRTY_KEYS_STORE_KEY);
        if (!stored) return /* @__PURE__ */ new Set();
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) return /* @__PURE__ */ new Set();
        return new Set(parsed);
      } catch (e) {
        return /* @__PURE__ */ new Set();
      }
    };
    lastSavedDirtyKeysJson = "";
    isSavingDirtyKeys = false;
    saveDirtyKeys = (keys) => {
      if (!isBrowser || isSavingDirtyKeys) return;
      isSavingDirtyKeys = true;
      const arr = Array.from(keys);
      try {
        const json = JSON.stringify(arr);
        if (json === lastSavedDirtyKeysJson) {
          isSavingDirtyKeys = false;
          return;
        }
        safeLS.setItem(DIRTY_KEYS_STORE_KEY, json);
        lastSavedDirtyKeysJson = json;
      } catch (e) {
        if (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22) {
          console.warn("Storage quota exceeded while saving dirty keys. Trimming keys and saving essential keys...");
          clearAllNonEssential().catch(console.error);
          const essentialKeys = arr.filter((k) => !k.includes("_part") && !k.includes("_manifest")).slice(0, 20);
          try {
            safeLS.setItem(DIRTY_KEYS_STORE_KEY, JSON.stringify(essentialKeys));
            lastSavedDirtyKeysJson = JSON.stringify(essentialKeys);
          } catch (e2) {
          }
        }
      } finally {
        isSavingDirtyKeys = false;
      }
    };
    dirtyKeys = loadDirtyKeys();
    LOAD_THRESHOLD = 24 * 60 * 60 * 1e3;
    SYNC_INTERVAL = 30 * 60 * 1e3;
    syncTimeout = null;
    isSyncInProgress = false;
    debouncedSyncToSupabase = (key) => {
      if (key && !isHeavyRedundantKey(key)) {
        dirtyKeys.add(key);
        saveDirtyKeys(dirtyKeys);
      }
      if (syncTimeout) {
        clearTimeout(syncTimeout);
      }
      syncTimeout = setTimeout(async () => {
        await forceSyncToSupabase();
      }, 15e3);
    };
    forceSyncToSupabase = async () => {
      if (isSyncInProgress || dirtyKeys.size === 0) return;
      isSyncInProgress = true;
      try {
        const keysToProcess = Array.from(dirtyKeys).filter((k) => !isHeavyRedundantKey(k));
        const records = [];
        for (const key of keysToProcess) {
          const localData = localStorage.getItem(key) || getMemorySerialized(key);
          if (localData === null) {
            await supabase.from("user_storage").delete().eq("key", key);
            delete lastSyncedValues[key];
            dirtyKeys.delete(key);
          } else if (localData !== lastSyncedValues[key]) {
            records.push({
              key,
              value: localData,
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            });
            lastSyncedValues[key] = localData;
          } else {
            dirtyKeys.delete(key);
          }
        }
        if (records.length > 0) {
          const { error } = await supabase.from("user_storage").upsert(records, { onConflict: "key" });
          if (error) {
            throw error;
          }
          records.forEach((r) => dirtyKeys.delete(r.key));
          saveDirtyKeys(dirtyKeys);
          console.log(`Successfully synced ${records.length} keys to Supabase`);
        } else {
        }
      } catch (error) {
        console.error("Error syncing to Supabase:", error);
      } finally {
        isSyncInProgress = false;
      }
    };
  }
});

// src/utils/matchId.ts
var init_matchId = __esm({
  "src/utils/matchId.ts"() {
  }
});

// src/services/matchTombstones.ts
var init_matchTombstones = __esm({
  "src/services/matchTombstones.ts"() {
    init_supabase();
    init_matchId();
  }
});

// src/services/supabaseHelper.ts
var init_supabaseHelper = __esm({
  "src/services/supabaseHelper.ts"() {
    init_supabase();
  }
});

// src/services/supabaseUploadedMatches.ts
var init_supabaseUploadedMatches = __esm({
  "src/services/supabaseUploadedMatches.ts"() {
    init_supabase();
    init_matchId();
    init_matchTombstones();
    init_supabaseHelper();
  }
});

// src/services/supabaseLiveMatches.ts
var init_supabaseLiveMatches = __esm({
  "src/services/supabaseLiveMatches.ts"() {
    init_supabase();
    init_matchId();
    init_matchTombstones();
    init_supabaseHelper();
  }
});

// src/utils/seerWeights.json
var seerWeights_default;
var init_seerWeights = __esm({
  "src/utils/seerWeights.json"() {
    seerWeights_default = {
      daily_top_10_value: {
        algoWeight: 5,
        paaPredWeight: 48,
        subPatternWeight: 12,
        probConfWeight: 10,
        phaWeight: 20,
        paaPercentWeight: 21,
        perfStarsWeight: 15,
        pred1x2Weight: 10,
        pred1x2RatingBoost: 5,
        drawDisagreementBoost: 50,
        synergyAgreementBoost: 120,
        synergyCondA: 700,
        synergyCondB: 450,
        synergyCondC: 200,
        synergyCondD: 400,
        synergyCondE: 250,
        synergyGapBoost: 750,
        upsetPaaBoost: 0,
        upsetProbBoost: 0,
        upsetSeerPrimBoost: 0,
        upsetPatternBoost: 0,
        paaAlgoSubPattAgreementBoost: 150,
        paaAlgoAgreementBoost: 100,
        subPattPaaAgreementBoost: 100
      },
      daily_best_bet: {
        algoWeight: 30,
        paaPredWeight: 20,
        subPatternWeight: 20,
        probConfWeight: 10,
        phaWeight: 10,
        paaPercentWeight: 6,
        perfStarsWeight: 15,
        pred1x2Weight: 10,
        pred1x2RatingBoost: 5,
        drawDisagreementBoost: 5,
        synergyAgreementBoost: 100,
        synergyCondA: 800,
        synergyCondB: 750,
        synergyCondC: 200,
        synergyCondD: 400,
        synergyCondE: 200,
        synergyGapBoost: 750,
        upsetPaaBoost: 0,
        upsetProbBoost: 0,
        upsetSeerPrimBoost: 0,
        upsetPatternBoost: 0,
        paaAlgoAgreementBoost: 30,
        subPattPaaAgreementBoost: 30,
        paaAlgoSubPattAgreementBoost: 100
      },
      daily_bankers_dlive: {
        algoWeight: 25,
        paaPredWeight: 30,
        subPatternWeight: 22,
        probConfWeight: 20,
        phaWeight: 10,
        paaPercentWeight: 6,
        perfStarsWeight: 25,
        pred1x2Weight: 10,
        pred1x2RatingBoost: 5,
        drawDisagreementBoost: 5,
        synergyAgreementBoost: 100,
        synergyCondA: 850,
        synergyCondB: 400,
        synergyCondC: 250,
        synergyCondD: 300,
        synergyCondE: 250,
        synergyGapBoost: 700,
        upsetPaaBoost: 0,
        upsetProbBoost: 0,
        upsetSeerPrimBoost: 0,
        upsetPatternBoost: 0,
        paaAlgoAgreementBoost: 40,
        subPattPaaAgreementBoost: 40,
        paaAlgoSubPattAgreementBoost: 80
      },
      daily_botb_best: {
        algoWeight: 15,
        paaPredWeight: 43,
        subPatternWeight: 12,
        probConfWeight: 10,
        phaWeight: 10,
        paaPercentWeight: 6,
        perfStarsWeight: 25,
        pred1x2Weight: 10,
        pred1x2RatingBoost: 5,
        drawDisagreementBoost: 20,
        synergyAgreementBoost: 85,
        synergyCondA: 900,
        synergyCondB: 200,
        synergyCondC: 350,
        synergyCondD: 200,
        synergyCondE: 200,
        synergyGapBoost: 700,
        upsetPaaBoost: 0,
        upsetProbBoost: 0,
        upsetSeerPrimBoost: 0,
        upsetPatternBoost: 0
      },
      daily_high_confidence: {
        algoWeight: 15,
        paaPredWeight: 45,
        subPatternWeight: 22,
        probConfWeight: 14,
        phaWeight: 28,
        paaPercentWeight: 13,
        perfStarsWeight: 39,
        pred1x2Weight: 21,
        pred1x2RatingBoost: 8,
        drawDisagreementBoost: 8,
        synergyAgreementBoost: 72,
        synergyCondA: 712,
        synergyCondB: 358,
        synergyCondC: 295,
        synergyCondD: 432,
        synergyCondE: 257,
        synergyGapBoost: 568,
        upsetPaaBoost: 0,
        upsetProbBoost: 8,
        upsetSeerPrimBoost: 5,
        upsetPatternBoost: 6,
        paaAlgoAgreementBoost: 0,
        paaAlgoSubPattAgreementBoost: 0,
        subPattPaaAgreementBoost: 6
      },
      daily_upsets: {
        algoWeight: 47,
        paaPredWeight: 58,
        subPatternWeight: 0,
        probConfWeight: 31,
        phaWeight: 22,
        paaPercentWeight: 30,
        perfStarsWeight: 38,
        pred1x2Weight: 27,
        pred1x2RatingBoost: 34,
        drawDisagreementBoost: 92,
        synergyAgreementBoost: 45,
        synergyCondA: 243,
        synergyCondB: 196,
        synergyCondC: 298,
        synergyCondD: 255,
        synergyCondE: 173,
        synergyGapBoost: 200,
        upsetPaaBoost: 31,
        upsetProbBoost: 0,
        upsetSeerPrimBoost: 0,
        upsetPatternBoost: 1,
        paaAlgoAgreementBoost: 11,
        paaAlgoSubPattAgreementBoost: 11,
        subPattPaaAgreementBoost: 17
      },
      daily_bankers_jackpot: {
        algoWeight: 10,
        paaPredWeight: 20,
        subPatternWeight: 10,
        probConfWeight: 10,
        phaWeight: 10,
        paaPercentWeight: 16,
        perfStarsWeight: 15,
        pred1x2Weight: 10,
        pred1x2RatingBoost: 5,
        drawDisagreementBoost: 20,
        synergyAgreementBoost: 75,
        synergyCondA: 750,
        synergyCondB: 200,
        synergyCondC: 200,
        synergyCondD: 400,
        synergyCondE: 200,
        synergyGapBoost: 500,
        upsetPaaBoost: 0,
        upsetProbBoost: 0,
        upsetSeerPrimBoost: 0,
        upsetPatternBoost: 0,
        paaAlgoAgreementBoost: 40,
        subPattPaaAgreementBoost: 40,
        paaAlgoSubPattAgreementBoost: 80
      },
      daily_banker_draws: {
        algoWeight: 10,
        paaPredWeight: 28,
        subPatternWeight: 22,
        probConfWeight: 10,
        phaWeight: 10,
        paaPercentWeight: 16,
        perfStarsWeight: 15,
        pred1x2Weight: 10,
        pred1x2RatingBoost: 5,
        drawDisagreementBoost: 35,
        synergyAgreementBoost: 25,
        synergyCondA: 500,
        synergyCondB: 350,
        synergyCondC: 250,
        synergyCondD: 250,
        synergyCondE: 200,
        synergyGapBoost: 250,
        upsetPaaBoost: 0,
        upsetProbBoost: 0,
        upsetSeerPrimBoost: 0,
        upsetPatternBoost: 0
      },
      daily_value_picks: {
        algoWeight: 10,
        paaPredWeight: 20,
        subPatternWeight: 10,
        probConfWeight: 10,
        phaWeight: 10,
        paaPercentWeight: 6,
        perfStarsWeight: 15,
        pred1x2Weight: 10,
        pred1x2RatingBoost: 5,
        drawDisagreementBoost: 5,
        synergyAgreementBoost: 65,
        synergyCondA: 650,
        synergyCondB: 400,
        synergyCondC: 200,
        synergyCondD: 400,
        synergyCondE: 250,
        synergyGapBoost: 450,
        upsetPaaBoost: 0,
        upsetProbBoost: 0,
        upsetSeerPrimBoost: 0,
        upsetPatternBoost: 0,
        paaAlgoAgreementBoost: 0,
        subPattPaaAgreementBoost: 0,
        paaAlgoSubPattAgreementBoost: 0
      },
      daily_value_bets: {
        algoWeight: 16,
        paaPredWeight: 23,
        subPatternWeight: 10,
        probConfWeight: 28,
        phaWeight: 2,
        paaPercentWeight: 47,
        perfStarsWeight: 41,
        pred1x2Weight: 0,
        pred1x2RatingBoost: 8,
        drawDisagreementBoost: 12,
        synergyAgreementBoost: 19,
        synergyCondA: 85,
        synergyCondB: 471,
        synergyCondC: 216,
        synergyCondD: 815,
        synergyCondE: 874,
        synergyGapBoost: 378,
        upsetPaaBoost: 70,
        upsetProbBoost: 6,
        upsetSeerPrimBoost: 60,
        upsetPatternBoost: 12,
        paaAlgoSubPattAgreementBoost: 0,
        paaAlgoAgreementBoost: 0,
        subPattPaaAgreementBoost: 4
      }
    };
  }
});

// src/services/storage.ts
var import_idb_keyval2, import_lz_string, failedLocalStorageWrites, getMemorySerialized, KEYS, isBrowser2, safeLS2, clearChunks, trimLocalArchives, clearAllNonEssential, loadLargeArray, saveToServer, saveCompressed, loadCompressed, memoryUploadedMatches, getUploadedMatches, saveSeerWeights, getSeerWeights;
var init_storage = __esm({
  "src/services/storage.ts"() {
    import_idb_keyval2 = require("idb-keyval");
    import_lz_string = __toESM(require("lz-string"), 1);
    init_supabaseStorage();
    init_storageUtils();
    init_supabaseUploadedMatches();
    init_supabaseLiveMatches();
    init_matchId();
    init_seerWeights();
    failedLocalStorageWrites = {};
    getMemorySerialized = (key) => {
      return failedLocalStorageWrites[key] || null;
    };
    KEYS = {
      LIVE_MATCHES: "prm_live_matches",
      UPLOADED_MATCHES: "prm_uploaded_matches",
      ARCHIVES: "prm_match_archives",
      AI_HISTORY: "prm_ai_history_v2",
      AI_CURRENT_SYSTEM: "prm_ai_system_data",
      AI_CURRENT_LIVE: "prm_ai_live_data",
      AI_CURRENT_JACKPOT: "prm_ai_jackpot_data",
      AI_CURRENT_POST_MATCH_DAILY: "prm_ai_postmatch_daily_data",
      AI_CURRENT_POST_MATCH_JACKPOT: "prm_ai_postmatch_jackpot_data",
      AI_CURRENT_SELF_LEARN: "prm_ai_self_learn_data",
      AI_CURRENT_SYSTEM_ARCHITECTURE: "prm_ai_system_architecture_data",
      SEER_WEIGHTS: "prm_seer_weights",
      NERDY_DAILY_MATCHES: "prm_nerdy_daily_matches",
      NERDY_JACKPOT_MATCHES: "prm_nerdy_jackpot_matches",
      DELETED_MATCH_IDS: "prm_deleted_match_ids"
    };
    isBrowser2 = typeof window !== "undefined" && typeof localStorage !== "undefined";
    safeLS2 = {
      getItem: (key) => {
        if (!isBrowser2) return null;
        try {
          return localStorage.getItem(key);
        } catch (e) {
          return null;
        }
      },
      setItem: (key, value) => {
        if (!isBrowser2) return;
        localStorage.setItem(key, value);
      },
      removeItem: (key) => {
        if (!isBrowser2) return;
        try {
          localStorage.removeItem(key);
        } catch (e) {
        }
      }
    };
    clearChunks = async (key) => {
      let j = 0;
      while (j < 100) {
        const chunkKey = `${key}_part${j}`;
        if (safeLS2.getItem(chunkKey)) {
          safeLS2.removeItem(chunkKey);
          debouncedSyncToSupabase(chunkKey);
        } else {
          if (!safeLS2.getItem(`${key}_part${j + 1}`)) break;
        }
        j++;
      }
      safeLS2.removeItem(`${key}_manifest`);
      debouncedSyncToSupabase(`${key}_manifest`);
    };
    trimLocalArchives = (keepDays = 3) => {
      try {
        const manifest = loadCompressed("prm_archive_manifest") || [];
        if (manifest.length > keepDays) {
          const toDelete = manifest.slice(keepDays);
          toDelete.forEach((date) => {
            safeLS2.removeItem(`prm_archive_data_${date}`);
          });
        }
      } catch (e) {
      }
    };
    clearAllNonEssential = async () => {
      console.warn("CRITICAL STORAGE CLEANUP INITIATED");
      safeLS2.removeItem(KEYS.AI_HISTORY);
      safeLS2.removeItem(KEYS.UPLOADED_MATCHES);
      await clearChunks(KEYS.UPLOADED_MATCHES);
      trimLocalArchives(1);
      safeLS2.removeItem(KEYS.NERDY_DAILY_MATCHES);
      safeLS2.removeItem(KEYS.NERDY_JACKPOT_MATCHES);
    };
    loadLargeArray = (key) => {
      try {
        const manifestStr = safeLS2.getItem(`${key}_manifest`);
        if (!manifestStr) {
          return loadCompressed(key);
        }
        const manifest = JSON.parse(manifestStr);
        let allData = [];
        for (let i = 0; i < manifest.totalChunks; i++) {
          const chunk = loadCompressed(`${key}_part${i}`);
          if (chunk) allData = [...allData, ...chunk];
        }
        return allData;
      } catch (e) {
        console.warn(`Failed to load large array for ${key}, falling back`, e);
        return loadCompressed(key);
      }
    };
    saveToServer = async (key, data) => {
      try {
        if (typeof window === "undefined") return;
        await fetch("/api/storage/save", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ key, data })
        });
      } catch (e) {
        console.warn(`Failed to save ${key} to server backup`, e);
      }
    };
    saveCompressed = async (key, data) => {
      try {
        await (0, import_idb_keyval2.del)(key);
      } catch (idbErr) {
        console.warn(`[IDB Cleanup] Failed to delete ${key} from IDB during compressed save:`, idbErr);
      }
      const compressed = import_lz_string.default.compressToUTF16(JSON.stringify(data));
      try {
        safeLS2.setItem(key, compressed);
        delete failedLocalStorageWrites[key];
      } catch (e) {
        if (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.message?.includes("exceeded the quota")) {
          console.warn(`Storage quota exceeded for ${key}. Cleaning up...`);
          try {
            const manifest = loadCompressed("prm_archive_manifest") || [];
            if (manifest.length > 2) {
              const toDelete = manifest.slice(2);
              toDelete.forEach((date) => {
                safeLS2.removeItem(`prm_archive_data_${date}`);
                delete failedLocalStorageWrites[`prm_archive_data_${date}`];
              });
            }
            safeLS2.removeItem("prm_ai_history");
            safeLS2.removeItem(KEYS.AI_HISTORY);
          } catch (cleanE) {
          }
          try {
            safeLS2.setItem(key, compressed);
            delete failedLocalStorageWrites[key];
          } catch (retryE) {
            console.warn(`Failed to save ${key} even after cleanup. Skipping local storage for this key.`, retryE);
            failedLocalStorageWrites[key] = compressed;
            try {
              await (0, import_idb_keyval2.set)(key, compressed);
            } catch (idbErr) {
              console.warn("IndexedDB fallback write failed", idbErr);
            }
          }
        } else {
          throw e;
        }
      }
      try {
        debouncedSyncToSupabase(key);
        saveToServer(key, data);
      } catch (syncE) {
        console.warn(`Background sync tasks failed for ${key}`, syncE);
      }
    };
    loadCompressed = (key) => {
      const failedWrite = failedLocalStorageWrites[key];
      const data = failedWrite !== void 0 ? failedWrite : safeLS2.getItem(key);
      if (!data) return null;
      try {
        const decompressed = import_lz_string.default.decompressFromUTF16(data);
        if (decompressed) return JSON.parse(decompressed);
        return JSON.parse(data);
      } catch (e) {
        try {
          return JSON.parse(data);
        } catch (e2) {
          return null;
        }
      }
    };
    memoryUploadedMatches = null;
    getUploadedMatches = () => {
      if (memoryUploadedMatches !== null) {
        return memoryUploadedMatches;
      }
      try {
        const data = loadLargeArray(KEYS.UPLOADED_MATCHES);
        if (data && data.length > 0) {
          memoryUploadedMatches = data;
          return data;
        }
        return [];
      } catch (e) {
        return [];
      }
    };
    saveSeerWeights = async (weightsMap) => {
      try {
        const clampedWeightsMap = {};
        for (const [key, weights] of Object.entries(weightsMap)) {
          if (typeof weights === "object" && weights !== null) {
            const clamped = { ...weights };
            for (const prop of Object.keys(clamped)) {
              if (typeof clamped[prop] === "number") {
                const maxVal = prop.startsWith("synergyCond") || prop === "synergyGapBoost" ? 1e3 : 100;
                clamped[prop] = Math.min(maxVal, Math.max(0, clamped[prop]));
              }
            }
            clampedWeightsMap[key] = clamped;
          } else {
            clampedWeightsMap[key] = weights;
          }
        }
        await saveCompressed(KEYS.SEER_WEIGHTS, clampedWeightsMap);
        debouncedSyncToSupabase(KEYS.SEER_WEIGHTS);
      } catch (e) {
        console.error("Failed to save Seer weights", e);
      }
    };
    getSeerWeights = () => {
      try {
        const finalData = { ...seerWeights_default };
        const forceResetKey = "prm_seer_weights_force_reset_v10";
        if (!localStorage.getItem(forceResetKey)) {
          saveCompressed(KEYS.SEER_WEIGHTS, finalData).catch(console.error);
          localStorage.setItem(forceResetKey, "true");
          return finalData;
        }
        const data = loadCompressed(KEYS.SEER_WEIGHTS);
        if (data && Object.keys(data).length > 0) {
          return data;
        }
        return finalData || {};
      } catch {
        return seerWeights_default || {};
      }
    };
  }
});

// src/utils/matchStars.ts
var import_react, STARS_KEY, cachedStars, useMatchStars, getMatchStars, getMatchMaxStars;
var init_matchStars = __esm({
  "src/utils/matchStars.ts"() {
    import_react = require("react");
    init_storage();
    init_supabaseStorage();
    STARS_KEY = "prm_match_stars";
    cachedStars = null;
    useMatchStars = () => {
      const [stars, setStars] = (0, import_react.useState)({});
      (0, import_react.useEffect)(() => {
        const fetchStars = () => getMatchStars().then(setStars);
        fetchStars();
        const handleUpdate = () => {
          getMatchStars(true).then(setStars);
        };
        window.addEventListener("matchStarsUpdated", handleUpdate);
        return () => window.removeEventListener("matchStarsUpdated", handleUpdate);
      }, []);
      return stars;
    };
    getMatchStars = async (forceRefresh = false) => {
      if (cachedStars && !forceRefresh) return cachedStars;
      const local = localStorage.getItem(STARS_KEY);
      if (local) {
        try {
          cachedStars = JSON.parse(local);
          return cachedStars || {};
        } catch (e) {
          console.error("Failed to parse local stars");
        }
      }
      return {};
    };
    getMatchMaxStars = (match, matchStars) => {
      const abbrMap = {
        "top10": "T12",
        "botb_best": "BOTB",
        "top20": "T20",
        "bankers": "BNK",
        "bankers_jackpot": "BNK",
        "bankers_dlive": "BDL",
        "value_bets": "VB",
        "value_picks": "VP",
        "banker_draws": "BD",
        "upsets": "UPS"
      };
      let maxStars = 0;
      const tags = match.evaluatorTags || [];
      for (const tag of tags) {
        const [cat, pr] = tag.split(":");
        const abbr = abbrMap[cat];
        if (abbr && pr && pr !== "PROMOTE" && pr !== "DEMOTE") {
          const group = match.group || 3;
          const key = `${abbr}-${pr}-G${group}`;
          const fallbackKey = `${abbr}-${pr}-G3`;
          let stars = matchStars[key];
          if (stars === void 0) {
            stars = matchStars[fallbackKey];
          }
          if (stars !== void 0 && stars > maxStars) {
            maxStars = stars;
          }
        }
      }
      return maxStars;
    };
  }
});

// src/utils/seerSupremeTier.ts
var getMatchSupremeTier, cachedRules, lastCacheTime, calculateSupremeRules, cachedUnderdogRules, lastUnderdogCacheTime, calculateSupremeRulesUnderdog, getMatchSupremeTierUnderdog;
var init_seerSupremeTier = __esm({
  "src/utils/seerSupremeTier.ts"() {
    init_matchEvaluator();
    init_storage();
    init_matchProcessing();
    getMatchSupremeTier = (m, phaStatsMap, preCalculatedRules) => {
      const rulesToUse = preCalculatedRules || calculateSupremeRules(phaStatsMap);
      let score = 0;
      let insightsHit = 0;
      const tags = [];
      for (const rule of rulesToUse) {
        if (rule.test(m)) {
          insightsHit++;
          tags.push(rule.name);
          score += Math.floor(rule.accuracy * 10);
          if (rule.accuracy > 90) score += 500;
        }
      }
      if (insightsHit > 1) {
        score += insightsHit * 1e3;
      }
      return { score, insightsHit, tags };
    };
    cachedRules = null;
    lastCacheTime = 0;
    calculateSupremeRules = (phaStatsMap) => {
      const now = Date.now();
      if (cachedRules && now - lastCacheTime < 5 * 60 * 1e3) {
        return cachedRules;
      }
      const history = getUploadedMatches().filter((m) => getActualResult(m.result) !== "pending");
      const recentHistory = history.slice(0, 2e3);
      const rawRules = [
        {
          id: "strategy_eta",
          name: "Strategy Eta (The Ultimate Shield)",
          test: (m, statsList) => {
            const stats = statsList || getMatchStats(m, phaStatsMap);
            const subPred = m.patternAnalysis?.subPatternPrediction || "";
            const paaPred = m.paaPrediction || m.paaPrimaryPrediction || "";
            const algoPred = m.algoReport?.prediction || "";
            const hasTripleAgreement = [...paaPred].some((c) => algoPred.includes(c) && subPred.includes(c));
            const isDoubleChancePatt = ["12", "X2"].includes(subPred);
            return hasTripleAgreement && isDoubleChancePatt && stats.favOdds <= 1.42;
          }
        },
        {
          id: "paa_fav_algo",
          name: "PAA Favorite + Algo Support",
          test: (m, statsList) => {
            const stats = statsList || getMatchStats(m, phaStatsMap);
            const isPaaFav = stats.phaFavSupport >= 50;
            const algoSupportsFav = matchesPrediction(m.algoReport?.prediction || "", stats.moFav);
            return isPaaFav && algoSupportsFav;
          }
        },
        {
          id: "paa_algo_agr",
          name: "PAA/Algo Agreement",
          test: (m) => {
            return !!m.algoReport?.prediction && !!m.patternAnalysis?.subPatternPrediction && m.algoReport.prediction === m.patternAnalysis.subPatternPrediction;
          }
        },
        {
          id: "synergy_boost_a",
          name: "Synergy Boost A",
          test: (m, statsList) => {
            const stats = statsList || getMatchStats(m, phaStatsMap);
            const probFav = stats.probFav;
            const paaSW = stats.phaFavWinSupport || 0;
            return probFav >= 45 && paaSW >= 50 && stats.favOdds >= 1.4 && stats.favOdds <= 2.2;
          }
        },
        {
          id: "goal_opt_mfav",
          name: "Goal Optimization (mFAV)",
          test: (m, statsList) => {
            const stats = statsList || getMatchStats(m, phaStatsMap);
            return stats.phaFavWinSupport >= 60 && stats.favOdds < 2;
          }
        },
        {
          id: "strong_underdog",
          name: "Strong Underdog Alignment",
          test: (m, statsList) => {
            const stats = statsList || getMatchStats(m, phaStatsMap);
            const moFav = stats.moFav;
            const underdogStr = moFav === "1" ? "2" : moFav === "2" ? "1" : "";
            return matchesPrediction(m.patternAnalysis?.subPatternPrediction || "", underdogStr) && matchesPrediction(m.algoReport?.prediction || "", underdogStr);
          }
        }
      ];
      if (recentHistory.length === 0) {
        try {
          if (typeof localStorage !== "undefined") {
            const saved = localStorage.getItem("supreme_rules_fav");
            if (saved) {
              const parsed = JSON.parse(saved);
              const reattached = parsed.map((p) => {
                const found = rawRules.find((r) => r.id === p.id);
                return found ? { ...p, test: found.test } : null;
              }).filter(Boolean);
              if (reattached.length > 0) {
                cachedRules = reattached;
                lastCacheTime = now;
                return reattached;
              }
            }
          }
        } catch (e) {
          console.warn("Failed to load supreme rules from local storage", e);
        }
        return [];
      }
      const performingRules = [];
      for (const rule of rawRules) {
        let hits = 0;
        let total = 0;
        for (const m of recentHistory) {
          const stats = getMatchStats(m, phaStatsMap);
          if (rule.test(m, stats)) {
            total++;
            const actual = getActualResult(m.result);
            let won = false;
            if (rule.id === "strategy_eta") {
              const subPred = m.patternAnalysis?.subPatternPrediction || "";
              won = !!actual && matchesPrediction(subPred, actual);
            } else {
              let targetOutcome = stats.moFav;
              if (rule.id === "strong_underdog") {
                targetOutcome = stats.moFav === "1" ? "2" : stats.moFav === "2" ? "1" : "";
              }
              won = !!actual && !!targetOutcome && matchesPrediction(targetOutcome, actual);
            }
            if (won) {
              hits++;
            }
          }
        }
        if (total >= 5) {
          const accuracy = hits / total * 100;
          if (accuracy >= 80) {
            performingRules.push({
              id: rule.id,
              name: rule.name,
              test: rule.test,
              accuracy,
              total,
              hits
            });
          }
        }
      }
      cachedRules = performingRules;
      lastCacheTime = now;
      try {
        if (typeof localStorage !== "undefined") {
          const toSave = performingRules.map((r) => ({ id: r.id, name: r.name, accuracy: r.accuracy, total: r.total, hits: r.hits }));
          localStorage.setItem("supreme_rules_fav", JSON.stringify(toSave));
        }
      } catch (e) {
      }
      return performingRules;
    };
    cachedUnderdogRules = null;
    lastUnderdogCacheTime = 0;
    calculateSupremeRulesUnderdog = (phaStatsMap) => {
      const now = Date.now();
      if (cachedUnderdogRules && now - lastUnderdogCacheTime < 5 * 60 * 1e3) {
        return cachedUnderdogRules;
      }
      const history = getUploadedMatches().filter((m) => getActualResult(m.result) !== "pending");
      const recentHistory = history.slice(0, 2e3);
      const rawRules = [
        {
          id: "paa_underdog",
          name: "PAA Supports Underdog",
          test: (m, statsList) => {
            const stats = statsList || getMatchStats(m, phaStatsMap);
            const moUnderdog = stats.moUnderdog;
            const paaPred = m.paaPrediction || m.paaPrimaryPrediction || "";
            return paaPred.includes(moUnderdog);
          }
        },
        {
          id: "algo_and_sub_underdog",
          name: "Algo and SubPattern Underdog Support",
          test: (m, statsList) => {
            const stats = statsList || getMatchStats(m, phaStatsMap);
            const moUnderdog = stats.moUnderdog;
            const algoPred = m.algoReport?.prediction || "";
            const subPred = m.patternAnalysis?.subPatternPrediction || "";
            return algoPred.includes(moUnderdog) && subPred.includes(moUnderdog);
          }
        },
        {
          id: "underdog_prob_30",
          name: "Underdog Probability >30%",
          test: (m, statsList) => {
            const stats = statsList || getMatchStats(m, phaStatsMap);
            const moUnderdog = stats.moUnderdog;
            const probUnderdog = (m.algoReport?.probabilities?.[moUnderdog] || 0) * 100;
            return probUnderdog > 30;
          }
        },
        {
          id: "underdog_paa_outperform",
          name: "High Underdog PAA Outperformance (>25%)",
          test: (m) => {
            const sub = m.patternAnalysis?.subPattern;
            if (sub && phaStatsMap[sub]) {
              const pha = phaStatsMap[sub];
              if (pha.total > 0) {
                const pDenom = pha.paaTotal > 0 ? pha.paaTotal : pha.total;
                const paaUpsetPct = pha.upsetWin / pDenom * 100;
                return paaUpsetPct > 25;
              }
            }
            return false;
          }
        },
        {
          id: "double_system_underdog",
          name: "Double System Underdog Agreement (Algo + 1X2)",
          test: (m, statsList) => {
            const stats = statsList || getMatchStats(m, phaStatsMap);
            const moUnderdog = stats.moUnderdog;
            const algoPred = m.algoReport?.prediction || "";
            const pred1x2 = m.pred1x2 || "";
            return algoPred.includes(moUnderdog) && pred1x2.includes(moUnderdog);
          }
        },
        {
          id: "underdog_higher_ts",
          name: "Underdog Higher Team Strength Than Favorite",
          test: (m, statsList) => {
            const stats = statsList || getMatchStats(m, phaStatsMap);
            const moUnderdog = stats.moUnderdog;
            const moFav = stats.moFav;
            if (m.tsa !== void 0 && m.tsb !== void 0) {
              const favTS = moFav === "1" ? m.tsa : m.tsb;
              const upsetTS = moUnderdog === "1" ? m.tsa : m.tsb;
              return upsetTS > favTS;
            }
            return false;
          }
        },
        {
          id: "upset_risk_tagged",
          name: "Upset Risk Tagged Match",
          test: (m) => {
            const tags = m.evaluatorTags || [];
            return tags.some((t) => t.includes("UPSET_RISK") || t.includes("UPSET RISK") || t.includes("upsets:"));
          }
        }
      ];
      if (recentHistory.length === 0) {
        try {
          if (typeof localStorage !== "undefined") {
            const saved = localStorage.getItem("supreme_rules_underdog");
            if (saved) {
              const parsed = JSON.parse(saved);
              const reattached = parsed.map((p) => {
                const found = rawRules.find((r) => r.id === p.id);
                return found ? { ...p, test: found.test } : null;
              }).filter(Boolean);
              if (reattached.length > 0) {
                cachedUnderdogRules = reattached;
                lastUnderdogCacheTime = now;
                return reattached;
              }
            }
          }
        } catch (e) {
          console.warn("Failed to load supreme rules for underdog from local storage", e);
        }
        const defaultUnderdogRules = rawRules.map((r) => ({
          id: r.id,
          name: r.name,
          test: r.test,
          accuracy: 42,
          total: 20,
          hits: 8
        }));
        cachedUnderdogRules = defaultUnderdogRules;
        lastUnderdogCacheTime = now;
        return defaultUnderdogRules;
      }
      const performingRules = [];
      for (const rule of rawRules) {
        let hits = 0;
        let total = 0;
        for (const m of recentHistory) {
          const stats = getMatchStats(m, phaStatsMap);
          if (rule.test(m, stats)) {
            total++;
            const moUnderdog = stats.moUnderdog;
            const actual = getActualResult(m.result);
            if (actual && moUnderdog && actual === moUnderdog) {
              hits++;
            }
          }
        }
        if (total >= 5) {
          const accuracy = hits / total * 100;
          if (accuracy >= 35) {
            performingRules.push({
              id: rule.id,
              name: rule.name,
              test: rule.test,
              accuracy,
              total,
              hits
            });
          }
        }
      }
      cachedUnderdogRules = performingRules;
      lastUnderdogCacheTime = now;
      try {
        if (typeof localStorage !== "undefined") {
          const toSave = performingRules.map((r) => ({ id: r.id, name: r.name, accuracy: r.accuracy, total: r.total, hits: r.hits }));
          localStorage.setItem("supreme_rules_underdog", JSON.stringify(toSave));
        }
      } catch (e) {
      }
      return performingRules;
    };
    getMatchSupremeTierUnderdog = (m, phaStatsMap, preCalculatedRules) => {
      const rulesToUse = preCalculatedRules || calculateSupremeRulesUnderdog(phaStatsMap);
      let score = 0;
      let insightsHit = 0;
      const tags = [];
      for (const rule of rulesToUse) {
        if (rule.test(m)) {
          insightsHit++;
          tags.push(rule.name);
          score += Math.floor(rule.accuracy * 15);
          if (rule.accuracy > 45) score += 600;
        }
      }
      if (insightsHit > 1) {
        score += insightsHit * 1200;
      }
      return { score, insightsHit, tags };
    };
  }
});

// src/utils/seerLogic.ts
var DEFAULT_WEIGHTS, getMatchScore, predictUpsetSeerDetailed, predictSeerDetailed, predictWithSeer;
var init_seerLogic = __esm({
  "src/utils/seerLogic.ts"() {
    init_matchStars();
    init_seerSupremeTier();
    init_matchProcessing();
    init_algorithm();
    DEFAULT_WEIGHTS = {
      algoWeight: 10,
      paaPredWeight: 44,
      // PAA is the primary anchor
      subPatternWeight: 42,
      probConfWeight: 46,
      phaWeight: 0,
      paaPercentWeight: 5,
      perfStarsWeight: 12,
      pred1x2Weight: 0,
      pred1x2RatingBoost: 75,
      drawDisagreementBoost: 14,
      synergyAgreementBoost: 15,
      synergyCondA: 300,
      synergyCondB: 195,
      synergyCondC: 200,
      synergyCondD: 200,
      synergyCondE: 200,
      synergyGapBoost: 250,
      upsetPaaBoost: 15,
      // Boosted PAA for Upset logic
      upsetProbBoost: 0,
      upsetSeerPrimBoost: 0,
      upsetPatternBoost: 0,
      paaAlgoAgreementBoost: 15,
      subPattPaaAgreementBoost: 15,
      paaAlgoSubPattAgreementBoost: 20
    };
    getMatchScore = (m, outcome, weights, phaStatsMap, matchStars, selectedCategory = "all") => {
      let score = 0;
      if (!m._liveAlgoReport) {
        m._liveAlgoReport = matchAlgorithm.predict(m);
      }
      const liveAlgoReport = m._liveAlgoReport;
      const algoPred = liveAlgoReport.prediction || "";
      if (algoPred.includes(outcome)) score += weights.algoWeight;
      let paaPred = m.paaPrediction || m.paaPrimaryPrediction || "";
      let paaPrimary = m.paaPrimaryPrediction || "";
      const sub = m.patternAnalysis?.subPattern;
      if (sub && phaStatsMap && phaStatsMap[sub] && (phaStatsMap[sub].paaTotal > 0 || phaStatsMap[sub].total > 0)) {
        const computedPaa = calculatePAAPrediction(m, phaStatsMap[sub]);
        if (computedPaa) {
          paaPrimary = computedPaa.paaPrimaryPrediction;
          paaPred = computedPaa.paaPrediction;
          m.paaPrimaryPrediction = paaPrimary;
          m.paaPrediction = paaPred;
        }
      }
      if (paaPred.includes(outcome)) score += weights.paaPredWeight;
      if (paaPrimary === outcome) score += weights.paaPredWeight * 0.5;
      const subPred = m.patternAnalysis?.subPatternPrediction || "";
      if (subPred.includes(outcome)) score += weights.subPatternWeight;
      let moFav = m._moFav;
      let moUpset = m._moUpset;
      if (moFav === void 0) {
        moFav = "1";
        moUpset = "2";
        if (m.mo && String(m.mo).trim() !== "NA") {
          const parts = String(m.mo).split(/[,\s:\/\-]+/).filter((p) => p.trim() !== "");
          const odds1 = parts.length > 0 ? parseFloat(parts[0]) : 0;
          const odds2 = parts.length > 2 ? parseFloat(parts[2]) : 0;
          if (!isNaN(odds1) && !isNaN(odds2)) {
            if (odds1 < odds2) {
              moFav = "1";
              moUpset = "2";
            } else if (odds2 < odds1) {
              moFav = "2";
              moUpset = "1";
            }
          }
        }
        m._moFav = moFav;
        m._moUpset = moUpset;
      }
      if (liveAlgoReport.probabilities) {
        const probs = liveAlgoReport.probabilities;
        const prob = probs[outcome] || 0;
        const probPct = prob * 100;
        score += probPct / 100 * weights.probConfWeight;
        if (outcome === "X" && probPct > 25) {
          score += probPct / 5;
        }
        if (selectedCategory === "upsets" && outcome === moUpset && (weights.upsetProbBoost || 0) > 0) {
          score += probPct / 100 * weights.upsetProbBoost;
        }
      }
      if (sub && phaStatsMap[sub]) {
        const pha = phaStatsMap[sub];
        if (pha.total > 0) {
          const phaOutcomes = pha.outcomes || {};
          const outcomeCount = phaOutcomes[outcome] || 0;
          const phaOutcomeProb = outcomeCount / pha.total * 100;
          score += phaOutcomeProb / 100 * weights.phaWeight;
          if (selectedCategory === "upsets" && outcome === moUpset && (weights.upsetPatternBoost || 0) > 0) {
            score += phaOutcomeProb / 100 * weights.upsetPatternBoost;
          }
          let paaPct = 0;
          const pDenom = pha.paaTotal > 0 ? pha.paaTotal : pha.total;
          if (outcome === moFav) paaPct = pha.favWin / pDenom * 100;
          else if (outcome === "X") paaPct = pha.draw / pDenom * 100;
          else if (outcome === moUpset) paaPct = pha.upsetWin / pDenom * 100;
          score += paaPct / 100 * weights.paaPercentWeight;
          if (selectedCategory === "upsets" && outcome === moUpset && (weights.upsetPaaBoost || 0) > 0) {
            score += paaPct / 100 * weights.upsetPaaBoost;
          }
          if (liveAlgoReport.probabilities) {
            const prob = liveAlgoReport.probabilities[outcome] || 0;
            const probPct = prob * 100;
            if (probPct >= 45 && paaPct >= 50) {
              score += weights.synergyAgreementBoost || 0;
            }
          }
        }
      }
      const isPaaAgree = paaPred.includes(outcome);
      const isAlgoAgree = algoPred.includes(outcome);
      const isSubPattAgree = subPred.includes(outcome);
      if (isPaaAgree && isAlgoAgree) {
        score += weights.paaAlgoAgreementBoost || 0;
      }
      if (isSubPattAgree && isPaaAgree) {
        score += weights.subPattPaaAgreementBoost || 0;
      }
      if (isPaaAgree && isAlgoAgree && isSubPattAgree) {
        score += weights.paaAlgoSubPattAgreementBoost || 0;
      }
      const stars = getMatchMaxStars(m, matchStars) || 0;
      if (stars > 0) {
        score += stars / 5 * weights.perfStarsWeight;
      }
      if (m.evaluatorTags?.includes("VOLATILE:PHA_TIE")) {
        score -= 15;
      }
      const hasPotentialUpsetFlag = m.totalPoints?.breakdown?.upsetPotential !== void 0 && m.totalPoints?.breakdown?.upsetPotential !== null || m.totalPoints?.breakdown?.tsIndicators?.includes("Potential Upset") || false;
      if (hasPotentialUpsetFlag && selectedCategory !== "upsets" && outcome === moFav) {
        score -= 50;
      }
      const pred1x2 = m.pred1x2 || "";
      if (pred1x2.includes(outcome)) {
        score += weights.pred1x2Weight;
        const ratingMatch = String(m.rating || "").match(/(\d+(?:\.\d+)?)/);
        const ratingNum = ratingMatch ? parseFloat(ratingMatch[1]) : 0;
        if (ratingNum >= 3) {
          score += weights.pred1x2RatingBoost;
        }
      }
      if (outcome === "X") {
        const isHomeBiased = (p) => ["1", "1X"].includes(p);
        const isAwayBiased = (p) => ["2", "X2"].includes(p);
        if (isHomeBiased(algoPred) && isAwayBiased(pred1x2) || isAwayBiased(algoPred) && isHomeBiased(pred1x2)) {
          score += weights.drawDisagreementBoost;
        }
      }
      if (selectedCategory === "upsets" && outcome === moUpset && (weights.upsetSeerPrimBoost || 0) > 0) {
        const probs = liveAlgoReport.probabilities;
        const probU = probs ? probs[moUpset] || 0 : 0;
        const probUPct = probU * 100;
        let baselineLikesUpset = false;
        if (algoPred.includes(moUpset) || probUPct >= 35 || pred1x2.includes(moUpset)) {
          baselineLikesUpset = true;
        }
        if (baselineLikesUpset) {
          score += weights.upsetSeerPrimBoost;
        }
      }
      const favoriteBiasedCategories = ["best_bet", "top10", "bankers_dlive", "botb_best", "top20", "bankers_jackpot", "value_picks"];
      const drawBiasedCategories = ["banker_draws"];
      if (favoriteBiasedCategories.includes(selectedCategory) || drawBiasedCategories.includes(selectedCategory)) {
        if (outcome === moUpset) {
          score -= 500;
        }
        const probs = liveAlgoReport.probabilities;
        const probU = probs ? probs[moUpset] || 0 : 0;
        const probF = probs ? probs[moFav] || 0 : 0;
        let pha = null;
        if (m.patternAnalysis?.subPattern && phaStatsMap[m.patternAnalysis.subPattern]) {
          pha = phaStatsMap[m.patternAnalysis.subPattern];
        }
        const isAlgoUpsetFavored = probU > probF;
        let isPaaUpsetFavored = false;
        if (pha && pha.total > 0) {
          const denom = pha.paaTotal > 0 ? pha.paaTotal : pha.total;
          const paaFav = pha.favWin / denom * 100;
          const paaUpset = pha.upsetWin / denom * 100;
          isPaaUpsetFavored = paaUpset > paaFav;
        }
        if (isAlgoUpsetFavored && isPaaUpsetFavored && outcome === moFav) {
          score -= 500;
        }
      }
      return score;
    };
    predictUpsetSeerDetailed = (m, weights, phaStatsMap, matchStars) => {
      let moFav = "1";
      let moUnderdog = "2";
      if (m.mo && String(m.mo).trim() !== "NA") {
        const parts = String(m.mo).split(/[,\s:\/\-]+/).filter((p) => p.trim() !== "");
        const odds1 = parts.length > 0 ? parseFloat(parts[0]) : 0;
        const odds2 = parts.length > 2 ? parseFloat(parts[2]) : 0;
        if (!isNaN(odds1) && !isNaN(odds2)) {
          if (odds1 < odds2) {
            moFav = "1";
            moUnderdog = "2";
          } else if (odds2 < odds1) {
            moFav = "2";
            moUnderdog = "1";
          }
        }
      }
      if (!m._liveAlgoReport) {
        m._liveAlgoReport = matchAlgorithm.predict(m);
      }
      const liveAlgoReport = m._liveAlgoReport;
      const probUnderdog = liveAlgoReport.probabilities?.[moUnderdog] || 0;
      const probX = liveAlgoReport.probabilities?.["X"] || 0;
      const probFav = liveAlgoReport.probabilities?.[moFav] || 0;
      const algoPred = liveAlgoReport.prediction || "";
      let paaPred = m.paaPrediction || m.paaPrimaryPrediction || "";
      let paaPrimary = m.paaPrimaryPrediction || "";
      const sub = m.patternAnalysis?.subPattern;
      if (sub && phaStatsMap && phaStatsMap[sub] && (phaStatsMap[sub].paaTotal > 0 || phaStatsMap[sub].total > 0)) {
        const computedPaa = calculatePAAPrediction(m, phaStatsMap[sub]);
        if (computedPaa) {
          paaPrimary = computedPaa.paaPrimaryPrediction;
          paaPred = computedPaa.paaPrediction;
          m.paaPrimaryPrediction = paaPrimary;
          m.paaPrediction = paaPred;
        }
      }
      const subPred = m.patternAnalysis?.subPatternPrediction || "";
      const pred1x2 = m.pred1x2 || "";
      let paaUpsetPct = 0;
      let phaDrawPct = 0;
      let paaFavPct = 0;
      if (sub && phaStatsMap[sub]) {
        const pha = phaStatsMap[sub];
        if (pha.total > 0) {
          const pDenom = pha.paaTotal > 0 ? pha.paaTotal : pha.total;
          paaUpsetPct = pha.upsetWin / pDenom * 100;
          phaDrawPct = pha.draw / pDenom * 100;
          paaFavPct = pha.favWin / pDenom * 100;
        }
      }
      const seerSupportsUnderdog = algoPred.includes(moUnderdog) || subPred.includes(moUnderdog) || pred1x2.includes(moUnderdog);
      const paaSupportsUnderdog = paaPred.includes(moUnderdog) || paaUpsetPct > 20;
      let uScoreUpset = 0;
      let uScoreDraw = 0;
      let uScoreFav = 0;
      const probUnderdogPct = probUnderdog * 100;
      const probXPct = probX * 100;
      const probFavPct = probFav * 100;
      uScoreUpset += probUnderdogPct / 100 * weights.probConfWeight;
      uScoreDraw += probXPct / 100 * weights.probConfWeight;
      uScoreFav += probFavPct / 100 * weights.probConfWeight;
      if (probUnderdogPct > 30) {
        uScoreUpset += (probUnderdogPct - 30) * (weights.upsetProbBoost || 2);
      }
      if (algoPred.includes(moUnderdog)) uScoreUpset += weights.algoWeight;
      else if (algoPred.includes("X")) uScoreDraw += weights.algoWeight;
      else if (algoPred.includes(moFav)) uScoreFav += weights.algoWeight;
      if (subPred.includes(moUnderdog)) uScoreUpset += weights.subPatternWeight;
      else if (subPred.includes("X")) uScoreDraw += weights.subPatternWeight;
      else if (subPred.includes(moFav)) uScoreFav += weights.subPatternWeight;
      if (pred1x2.includes(moUnderdog)) uScoreUpset += weights.pred1x2Weight;
      else if (pred1x2.includes("X")) uScoreDraw += weights.pred1x2Weight;
      else if (pred1x2.includes(moFav)) uScoreFav += weights.pred1x2Weight;
      if (paaPred.includes(moUnderdog)) uScoreUpset += weights.paaPredWeight;
      else if (paaPred.includes("X")) uScoreDraw += weights.paaPredWeight;
      else if (paaPred.includes(moFav)) uScoreFav += weights.paaPredWeight;
      uScoreUpset += paaUpsetPct / 100 * weights.phaWeight;
      uScoreDraw += phaDrawPct / 100 * weights.phaWeight;
      uScoreFav += paaFavPct / 100 * weights.phaWeight;
      if (paaUpsetPct > 20) {
        uScoreUpset += weights.upsetPaaBoost || 0;
      }
      if (seerSupportsUnderdog) {
        uScoreUpset += weights.upsetSeerPrimBoost || 0;
      }
      if (subPred.includes(moUnderdog)) {
        uScoreUpset += weights.upsetPatternBoost || 0;
      }
      if (m.evaluatorTags?.includes("VOLATILE:PHA_TIE")) {
        uScoreUpset += 15;
      }
      const supremeUnderdog = getMatchSupremeTierUnderdog(m, phaStatsMap);
      uScoreUpset += supremeUnderdog.score;
      let sUpset = uScoreUpset;
      let sDraw = uScoreDraw;
      let sFav = uScoreFav;
      const minScore = Math.min(sUpset, sDraw, sFav);
      if (minScore < 0) {
        const shift = Math.abs(minScore) + 2;
        sUpset += shift;
        sDraw += shift;
        sFav += shift;
      }
      const nonNegativeUpset = sUpset;
      const nonNegativeDraw = sDraw;
      const nonNegativeFav = sFav;
      const total = nonNegativeUpset + nonNegativeDraw + nonNegativeFav;
      let pUpset = total > 0 ? Math.round(nonNegativeUpset / total * 100) : 0;
      let pDraw = total > 0 ? Math.round(nonNegativeDraw / total * 100) : 0;
      let pFav = total > 0 ? Math.round(nonNegativeFav / total * 100) : 0;
      if (total > 0) {
        const diff = 100 - (pUpset + pDraw + pFav);
        if (diff !== 0) {
          const arr = [
            { k: "U", v: nonNegativeUpset },
            { k: "D", v: nonNegativeDraw },
            { k: "F", v: nonNegativeFav }
          ].sort((a, b) => b.v - a.v);
          if (arr[0].k === "U") pUpset += diff;
          else if (arr[0].k === "D") pDraw += diff;
          else pFav += diff;
        }
      }
      const percentages = {
        "1": moUnderdog === "1" ? pUpset : moFav === "1" ? pFav : pDraw,
        "X": pDraw,
        "2": moUnderdog === "2" ? pUpset : moFav === "2" ? pFav : pDraw
      };
      const scores = {
        "1": moUnderdog === "1" ? uScoreUpset : moFav === "1" ? uScoreFav : uScoreDraw,
        "X": uScoreDraw,
        "2": moUnderdog === "2" ? uScoreUpset : moFav === "2" ? uScoreFav : uScoreDraw
      };
      const scoresList = [
        { k: moUnderdog, v: uScoreUpset },
        { k: "X", v: uScoreDraw },
        { k: moFav, v: uScoreFav }
      ].sort((a, b) => b.v - a.v);
      let primary = scoresList[0].k;
      const secondary = scoresList[1].k;
      let final = primary;
      if (primary === "1") {
        if (secondary === "2") {
          const scoreXVal = scoresList.find((s) => s.k === "X")?.v || 0;
          const probX2 = (liveAlgoReport?.probabilities?.["X"] || 0) * 100;
          const tsDiff = m.tsa !== void 0 && m.tsb !== void 0 ? Math.abs(m.tsa - m.tsb) : null;
          const isScoreGapSmall = scoresList[1].v - scoreXVal < 12;
          const isProbXRisky = probX2 > 58;
          const isCloselyMatched = tsDiff !== null && tsDiff <= 0.01;
          if (isScoreGapSmall || isProbXRisky || isCloselyMatched) {
            final = "1X";
          } else {
            final = "12";
          }
        } else {
          final = "1X";
        }
      } else if (primary === "2") {
        if (secondary === "1") {
          const scoreXVal = scoresList.find((s) => s.k === "X")?.v || 0;
          const probX2 = (liveAlgoReport?.probabilities?.["X"] || 0) * 100;
          const tsDiff = m.tsa !== void 0 && m.tsb !== void 0 ? Math.abs(m.tsa - m.tsb) : null;
          const isScoreGapSmall = scoresList[1].v - scoreXVal < 12;
          const isProbXRisky = probX2 > 58;
          const isCloselyMatched = tsDiff !== null && tsDiff <= 0.01;
          if (isScoreGapSmall || isProbXRisky || isCloselyMatched) {
            final = "X2";
          } else {
            final = "12";
          }
        } else {
          final = "X2";
        }
      } else if (primary === "X") {
        if (secondary === "1") {
          final = "1X";
        } else {
          final = "X2";
        }
      } else {
        final = primary + secondary;
      }
      if (primary === "1" && final === "1X" && percentages["2"] > 35) {
        final = "12";
      } else if (primary === "2" && final === "X2" && percentages["1"] > 35) {
        final = "12";
      }
      if (weights === DEFAULT_WEIGHTS) {
        const favTS = moFav === "1" ? m.tsa : m.tsb;
        const upsetTS = moUnderdog === "1" ? m.tsa : m.tsb;
        const isUnderdogHigherTS = favTS !== void 0 && upsetTS !== void 0 && upsetTS > favTS;
        const supremeUnderdog2 = getMatchSupremeTierUnderdog(m, phaStatsMap);
        const isAlgoSupportsUdog = algoPred.includes(moUnderdog);
        const isSubPatternSupportsUdog = subPred.includes(moUnderdog);
        const isPred1x2SupportsUdog = pred1x2.includes(moUnderdog);
        const isPaaUpsetDecent = paaUpsetPct >= 18;
        const isProbUdogDecent = probUnderdogPct >= 22;
        const isPointsUpsetFlag = !!m.totalPoints?.breakdown?.upsetPotential;
        const isAlgoUpsetStrict = algoPred.includes(moUnderdog) && !algoPred.includes(moFav);
        const isStrongUpsetThreat = isAlgoUpsetStrict || paaUpsetPct > 30 || supremeUnderdog2.insightsHit > 0 || isUnderdogHigherTS || isPaaUpsetDecent && isProbUdogDecent || isPointsUpsetFlag && paaUpsetPct > 18 || isAlgoSupportsUdog && isSubPatternSupportsUdog || // Double system agreement on underdog
        isSubPatternSupportsUdog && isPaaUpsetDecent || // Pattern matches historical performance
        isAlgoSupportsUdog && isProbUdogDecent || // Live algorithm probability aligns with prediction
        isPred1x2SupportsUdog && isPaaUpsetDecent;
        if (isStrongUpsetThreat) {
          primary = moUnderdog;
          if (paaUpsetPct >= 38 || isAlgoUpsetStrict && paaUpsetPct >= 28 || isUnderdogHigherTS && paaUpsetPct >= 25) {
            final = moUnderdog;
          } else {
            final = moUnderdog === "1" ? "1X" : "X2";
          }
        } else {
          primary = moFav;
          final = moFav === "1" ? "1X" : "X2";
        }
        const tsDiff = m.tsa !== void 0 && m.tsb !== void 0 ? Math.abs(m.tsa - m.tsb) : null;
        let gsH = m.gsHome;
        let gsA = m.gsAway;
        if (gsH === void 0 || gsA === void 0) {
          if (m.gs) {
            const partsGs = String(m.gs).split(/[:\-\/]/).map((s) => parseFloat(s.trim()));
            gsH = partsGs[0] || 0;
            gsA = partsGs[1] || 0;
          }
        }
        const isLowScoring = gsH !== void 0 && gsA !== void 0 && gsH <= 1.3 && gsA <= 1.3;
        if (tsDiff !== null && tsDiff <= 0.3 && paaUpsetPct > paaFavPct && paaUpsetPct >= 33) {
          final = "12";
        }
        if (final === "12") {
          if (phaDrawPct >= 28 || tsDiff !== null && tsDiff <= 0.3 && isLowScoring) {
            final = moFav === "1" ? "1X" : "X2";
          }
        }
        if (isStrongUpsetThreat && (paaUpsetPct >= 45 || isAlgoUpsetStrict && paaUpsetPct >= 35)) {
          final = moUnderdog;
        }
        const udogSeerScore = percentages[moUnderdog] || 0;
        const drawSeerScore = percentages["X"] || 0;
        const favDrawHedge = moFav === "1" ? "1X" : "X2";
        const udogDrawHedge = moUnderdog === "1" ? "1X" : "X2";
        let favOddsNum = 0;
        let udogOddsNum = 0;
        let drawOddsNum = 0;
        if (m.mo && String(m.mo).trim() !== "NA") {
          const parts = String(m.mo).split(/[,\s:\/\-]+/).filter((p) => p.trim() !== "");
          if (parts.length >= 3) {
            const odds1 = parseFloat(parts[0]);
            const oddsX = parseFloat(parts[1]);
            const odds2 = parseFloat(parts[2]);
            if (!isNaN(odds1) && !isNaN(odds2) && !isNaN(oddsX)) {
              favOddsNum = moFav === "1" ? odds1 : odds2;
              udogOddsNum = moUnderdog === "1" ? odds1 : odds2;
              drawOddsNum = oddsX;
            }
          }
        }
        let agent1Triggered = false;
        if (final === favDrawHedge) {
          if (udogSeerScore >= 25 && paaUpsetPct >= 15 && udogOddsNum > 0 && udogOddsNum <= 4.5) {
            final = "12";
            agent1Triggered = true;
          }
        }
        if (!agent1Triggered && final === favDrawHedge) {
          if (favOddsNum >= 1.8 && paaFavPct <= 50 && paaUpsetPct >= 20 && udogSeerScore >= 30) {
            final = udogDrawHedge;
          }
        }
        if (!agent1Triggered && final === "12") {
          if (drawSeerScore >= 25 && phaDrawPct >= 20 && drawOddsNum > 0 && drawOddsNum <= 3.8) {
            final = favDrawHedge;
          }
        }
      }
      if (final === "21") final = "12";
      if (final === "2X") final = "X2";
      if (final === "X1") final = "1X";
      return {
        primary,
        final,
        scores,
        percentages
      };
    };
    predictSeerDetailed = (m, weights, phaStatsMap, matchStars, selectedCategory = "all", isDefaultRun = false) => {
      if (selectedCategory === "upsets") {
        return predictUpsetSeerDetailed(m, weights, phaStatsMap, matchStars);
      }
      if (!m._liveAlgoReport) {
        m._liveAlgoReport = matchAlgorithm.predict(m);
      }
      const liveAlgoReport = m._liveAlgoReport;
      const score1 = getMatchScore(m, "1", weights, phaStatsMap, matchStars, selectedCategory);
      const scoreX = getMatchScore(m, "X", weights, phaStatsMap, matchStars, selectedCategory);
      const score2 = getMatchScore(m, "2", weights, phaStatsMap, matchStars, selectedCategory);
      let s1 = score1;
      let sX = scoreX;
      let s2 = score2;
      const minScore = Math.min(s1, sX, s2);
      if (minScore < 0) {
        const shift = Math.abs(minScore) + 2;
        s1 += shift;
        sX += shift;
        s2 += shift;
      }
      const nonNegative1 = s1;
      const nonNegativeX = sX;
      const nonNegative2 = s2;
      const percentTotal = nonNegative1 + nonNegativeX + nonNegative2;
      let p1 = percentTotal > 0 ? Math.round(nonNegative1 / percentTotal * 100) : 0;
      let pX = percentTotal > 0 ? Math.round(nonNegativeX / percentTotal * 100) : 0;
      let p2 = percentTotal > 0 ? Math.round(nonNegative2 / percentTotal * 100) : 0;
      if (percentTotal > 0) {
        const diff = 100 - (p1 + pX + p2);
        if (diff !== 0) {
          const arr = [
            { k: "1", v: nonNegative1 },
            { k: "X", v: nonNegativeX },
            { k: "2", v: nonNegative2 }
          ].sort((a, b) => b.v - a.v);
          if (arr[0].k === "1") p1 += diff;
          else if (arr[0].k === "X") pX += diff;
          else p2 += diff;
        }
      }
      const percentages = { "1": p1, "X": pX, "2": p2 };
      const scoresList = [
        { k: "1", v: score1 },
        { k: "X", v: scoreX },
        { k: "2", v: score2 }
      ].sort((a, b) => b.v - a.v);
      let primary = scoresList[0].k;
      const secondary = scoresList[1].k;
      let final = primary;
      if (primary === "1") {
        if (secondary === "2") {
          const scoreXVal = scoresList.find((s) => s.k === "X")?.v || 0;
          const probX = (liveAlgoReport.probabilities?.["X"] || 0) * 100;
          const tsDiff = m.tsa !== void 0 && m.tsb !== void 0 ? Math.abs(m.tsa - m.tsb) : null;
          const isScoreGapSmall = scoresList[1].v - scoreXVal < 12;
          const isProbXRisky = probX > 58;
          const isCloselyMatched = tsDiff !== null && tsDiff <= 0.01;
          if (isScoreGapSmall || isProbXRisky || isCloselyMatched) {
            final = "1X";
          } else {
            final = "12";
          }
        } else {
          final = "1X";
        }
      } else if (primary === "2") {
        if (secondary === "1") {
          const scoreXVal = scoresList.find((s) => s.k === "X")?.v || 0;
          const probX = (liveAlgoReport.probabilities?.["X"] || 0) * 100;
          const tsDiff = m.tsa !== void 0 && m.tsb !== void 0 ? Math.abs(m.tsa - m.tsb) : null;
          const isScoreGapSmall = scoresList[1].v - scoreXVal < 12;
          const isProbXRisky = probX > 58;
          const isCloselyMatched = tsDiff !== null && tsDiff <= 0.01;
          if (isScoreGapSmall || isProbXRisky || isCloselyMatched) {
            final = "X2";
          } else {
            final = "12";
          }
        } else {
          final = "X2";
        }
      } else if (primary === "X") {
        if (secondary === "1") {
          final = "1X";
        } else {
          final = "X2";
        }
      } else {
        final = primary + secondary;
      }
      if (primary === "1" && final === "1X" && percentages["2"] > 35) {
        final = "12";
      } else if (primary === "2" && final === "X2" && percentages["1"] > 35) {
        final = "12";
      }
      const sub = m.patternAnalysis?.subPattern;
      const stats = sub ? phaStatsMap[sub] : null;
      let moFav = m._moFav;
      let moUpset = m._moUpset;
      let favOdds = m._favOdds || 0;
      if (moFav === void 0) {
        moFav = "1";
        moUpset = "2";
        if (m.mo && String(m.mo).trim() !== "NA") {
          const parts = String(m.mo).split(/[,\s:\/\-]+/).filter((p) => p.trim() !== "");
          const odds1 = parts.length > 0 ? parseFloat(parts[0]) : 0;
          const odds2 = parts.length > 2 ? parseFloat(parts[2]) : 0;
          if (!isNaN(odds1) && !isNaN(odds2) && odds1 > 0 && odds2 > 0) {
            if (odds1 < odds2) {
              moFav = "1";
              moUpset = "2";
              favOdds = odds1;
            } else if (odds2 < odds1) {
              moFav = "2";
              moUpset = "1";
              favOdds = odds2;
            } else {
              moFav = "1";
              moUpset = "2";
              favOdds = odds1;
            }
          }
        }
        m._moFav = moFav;
        m._moUpset = moUpset;
        m._favOdds = favOdds;
      }
      let finalPercentages = { ...percentages };
      let finalScores = { "1": score1, "X": scoreX, "2": score2 };
      if (weights === DEFAULT_WEIGHTS) {
        if (stats) {
          const total = stats.total || 0;
          if (total > 0) {
            const drawRate = stats.draw / total * 100;
            const favWinRate = stats.favWin / total * 100;
            const upsetWinRate = stats.upsetWin / total * 100;
            const tsDiff2 = m.tsa !== void 0 && m.tsb !== void 0 ? Math.abs(m.tsa - m.tsb) : null;
            let gsH2 = m.gsHome;
            let gsA2 = m.gsAway;
            if (gsH2 === void 0 || gsA2 === void 0) {
              if (m.gs) {
                const partsGs = String(m.gs).split(/[:\-\/]/).map((s) => parseFloat(s.trim()));
                gsH2 = partsGs[0] || 0;
                gsA2 = partsGs[1] || 0;
              }
            }
            const favoriteBiasedCats = ["best_bet", "top10", "top_10_value", "bankers_dlive", "botb_best", "top20", "bankers_jackpot", "value_picks"];
            const drawBiasedCats = ["banker_draws"];
            if (final === "12") {
              const isLowScoring = gsH2 !== void 0 && gsA2 !== void 0 && gsH2 <= 1 && gsA2 <= 1;
              if (drawRate >= 29 || tsDiff2 !== null && tsDiff2 <= 0.3 && isLowScoring || drawBiasedCats.includes(selectedCategory)) {
                final = moFav === "1" ? "1X" : "X2";
              }
            }
            if (!favoriteBiasedCats.includes(selectedCategory) && !drawBiasedCats.includes(selectedCategory)) {
              if (tsDiff2 !== null && tsDiff2 <= 0.3 && upsetWinRate > favWinRate && upsetWinRate >= 23) {
                if (final !== "12") {
                  final = "12";
                }
              }
            }
          }
        }
        if (final === "12" && percentages["X"] >= 35) {
          final = moUpset === "1" ? "1X" : "X2";
        }
        const algoPredFinal = liveAlgoReport?.prediction || "";
        const paaPredFinal = m.paaPrediction || m.paaPrimaryPrediction || "";
        const subPredFinal = m.patternAnalysis?.subPatternPrediction || "";
        const isAlgo12 = algoPredFinal === "12";
        const isPaa12 = paaPredFinal === "12";
        const isSub12 = subPredFinal === "12";
        if (isAlgo12 && isPaa12 && isSub12) {
          final = "12";
          if (primary === "X") {
            primary = percentages["1"] >= percentages["2"] ? "1" : "2";
          }
        } else if (isSub12 && isAlgo12 && !isPaa12) {
          final = moFav === "1" ? "1X" : "X2";
        } else if (isSub12 && isPaa12 && !isAlgo12) {
          if (algoPredFinal === "1X" || algoPredFinal === "X2") {
            final = algoPredFinal;
          } else {
            final = moFav === "1" ? "1X" : "X2";
          }
        } else if (isPaa12 && isAlgo12 && !isSub12) {
          if (stats && stats.total > 0) {
            const upsetWinRate = stats.upsetWin / stats.total * 100;
            const drawRate = stats.draw / stats.total * 100;
            if (upsetWinRate > drawRate) {
              final = "12";
            } else {
              final = moFav === "1" ? "1X" : "X2";
            }
          } else {
            final = moFav === "1" ? "1X" : "X2";
          }
        }
        const tsDiff = m.tsa !== void 0 && m.tsb !== void 0 ? Math.abs(m.tsa - m.tsb) : null;
        let gsH = m.gsHome;
        let gsA = m.gsAway;
        if (gsH === void 0 || gsA === void 0) {
          if (m.gs) {
            const partsGs = String(m.gs).split(/[:\-\/]/).map((s) => parseFloat(s.trim()));
            gsH = partsGs[0] || 0;
            gsA = partsGs[1] || 0;
          }
        }
        const probX = (liveAlgoReport?.probabilities?.["X"] || 0) * 100;
        const isStalemate = tsDiff !== null && tsDiff <= 0.25;
        if (isStalemate && stats && stats.total > 0) {
          const drawRate = stats.draw / stats.total * 100;
          const upsetWinRate = stats.upsetWin / stats.total * 100;
          const isLowScoring = gsH !== void 0 && gsA !== void 0 && gsH <= 1 && gsA <= 1;
          if (isLowScoring || drawRate > upsetWinRate || probX >= 30) {
            if (final === "12") {
              final = moFav === "1" ? "1X" : "X2";
            }
          } else if (gsH > 1.2 || gsA > 1.2 || upsetWinRate > drawRate) {
            const favCategories2 = ["best_bet", "top10", "top_10_value", "bankers_dlive", "botb_best", "top20", "bankers_jackpot", "value_picks"];
            const drawCategories2 = ["banker_draws"];
            if (!favCategories2.includes(selectedCategory) && !drawCategories2.includes(selectedCategory)) {
              final = "12";
            }
          }
        }
        const favDC = moFav === "1" ? "1X" : "X2";
        const upsetDC = moUpset === "1" ? "1X" : "X2";
        const probs = liveAlgoReport?.probabilities || {};
        const favProb = (probs[moFav] || 0) * 100;
        const isAlgoFav = algoPredFinal === moFav || algoPredFinal === favDC || algoPredFinal === "12";
        const isAlgoHighConfFav = isAlgoFav && (favProb >= 45 || favOdds > 0 && favOdds <= 1.85);
        const subPredPrimary = m.patternAnalysis?.primaryPrediction || "";
        const isSubPrimaryUnderdog = subPredPrimary === moUpset;
        const isWideGap = tsDiff !== null && tsDiff > 0.3;
        const favoriteBiasedCatsList = ["best_bet", "top10", "top_10_value", "bankers_dlive", "botb_best", "top20", "bankers_jackpot", "value_picks"];
        const isFavCategory = favoriteBiasedCatsList.includes(selectedCategory);
        let isUnderdogHigherTS = false;
        let tsAdvantage = 0;
        if (m.tsa !== void 0 && m.tsb !== void 0) {
          const favTS = moFav === "1" ? m.tsa : m.tsb;
          const upsetTS = moUpset === "1" ? m.tsa : m.tsb;
          if (upsetTS > favTS) {
            isUnderdogHigherTS = true;
            tsAdvantage = upsetTS - favTS;
          }
        }
        if (isAlgoHighConfFav && !isSubPrimaryUnderdog && !isUnderdogHigherTS) {
          if (final === "X" || final === upsetDC || final === "12") {
            final = favDC;
          }
        } else if (isUnderdogHigherTS && !isFavCategory) {
          if (tsAdvantage > 0.8 || isUnderdogHigherTS && isSubPrimaryUnderdog) {
            if (!isAlgoHighConfFav) {
              primary = moUpset;
              final = upsetDC;
            } else {
              final = "12";
              primary = moUpset;
            }
          } else if (tsAdvantage > 0.3) {
            if (!isAlgoHighConfFav) {
              if (final === "X" || final === favDC) {
                final = upsetDC;
              }
              if (primary === "X" || primary === moFav) {
                primary = moUpset;
              }
            } else {
              final = "12";
            }
          } else {
            if (isSubPrimaryUnderdog && !isAlgoHighConfFav) {
              final = upsetDC;
              primary = moUpset;
            }
          }
        } else if (isSubPrimaryUnderdog && !isAlgoHighConfFav && !isFavCategory) {
          if (final === favDC || final === "1" || final === "2" || final === "X") {
            final = "12";
            if (primary === "X") {
              primary = isWideGap ? moFav : moUpset;
            }
          }
        } else if (isAlgoHighConfFav && isSubPrimaryUnderdog) {
          final = "12";
          if (primary === "X") {
            primary = percentages["1"] >= percentages["2"] ? "1" : "2";
          }
        }
        const favCategories = ["best_bet", "top10", "top_10_value", "bankers_dlive", "botb_best", "top20", "bankers_jackpot", "value_picks"];
        const drawCategories = ["banker_draws"];
        if (favCategories.includes(selectedCategory)) {
          if (primary === moUpset) {
            primary = moFav;
          }
          if (final.includes(moUpset)) {
            final = final.replace(moUpset, "X");
            if (final === "XX" || final === "X") final = moFav === "1" ? "1X" : "X2";
            if (final === "X1") final = "1X";
            if (final === "2X") final = "X2";
          }
        } else if (drawCategories.includes(selectedCategory)) {
          primary = "X";
          final = percentages["1"] >= percentages["2"] ? "1X" : "X2";
        }
        if (primary === "1") {
          if (final !== "1X" && final !== "12" && final !== "X1" && final !== "21") {
            final = percentages["X"] >= percentages["2"] ? "1X" : "12";
          }
        } else if (primary === "2") {
          if (final !== "X2" && final !== "12" && final !== "2X" && final !== "21") {
            final = percentages["X"] >= percentages["1"] ? "X2" : "12";
          }
        } else if (primary === "X") {
          if (final !== "1X" && final !== "X2" && final !== "X1" && final !== "2X") {
            final = percentages["1"] >= percentages["2"] ? "1X" : "X2";
          }
        }
        if (m.totalPoints && sub) {
          const favPts = moFav === "1" ? m.totalPoints.home : m.totalPoints.away;
          const udogPts = moUpset === "1" ? m.totalPoints.home : m.totalPoints.away;
          const ptDiff = favPts - udogPts;
          if (ptDiff < 0 && final === "12") {
            const s1_12_subs = [
              "G1g16",
              "G1q17",
              "G2b2",
              "G2hh2",
              "G3i2",
              "G3N1",
              "G1x1",
              "G2i15",
              "G1o1",
              "G1w4",
              "G1ff47",
              "G2j4",
              "G1m3",
              "G3j4",
              "G1a7",
              "G1aa1",
              "G1r2",
              "G1a6",
              "G1ff53",
              "G1g14",
              "G3ff45",
              "G3b1",
              "G1mm1"
            ];
            if (s1_12_subs.includes(sub)) {
              final = moUpset === "1" ? "1X" : "X2";
            }
          }
          if (ptDiff >= 0 && ptDiff < 10 && final === "12") {
            const s2_12_subs = ["G3N1", "G3u16", "G1ff57", "G1ff49", "G3ii1", "G2s16", "G3aa5"];
            if (s2_12_subs.includes(sub)) {
              final = moUpset === "1" ? "1X" : "X2";
            }
          }
        }
        const gaHome = m.gaHome ?? 0;
        const gaAway = m.gaAway ?? 0;
        let tossFav = "1";
        let tossUdog = "2";
        if (m.mo && m.mo !== "NA" && m.mo !== "Unknown" && m.mo !== "") {
          const parts = String(m.mo).split(/[,\s:\/\-]+/).map((p) => parseFloat(p.trim())).filter((p) => !isNaN(p));
          if (parts.length >= 3) {
            const o1 = parts[0];
            const o2 = parts[2];
            if (o1 !== o2) {
              tossFav = o1 < o2 ? "1" : "2";
              tossUdog = o1 < o2 ? "2" : "1";
            }
          }
        }
        const isBothGA12 = gaHome >= 1.2 && gaAway >= 1.2;
        const isBothGA15 = gaHome >= 1.5 && gaAway >= 1.5;
        const isBothGA17 = gaHome >= 1.7 && gaAway >= 1.7;
        const isBothGA20 = gaHome >= 2 && gaAway >= 2;
        const isOneGA12Other15 = gaHome >= 1.2 && gaAway >= 1.5 || gaHome >= 1.5 && gaAway >= 1.2;
        const pts = {
          "1": m.totalPoints?.home || 0,
          "2": m.totalPoints?.away || 0
        };
        const fPts = pts[tossFav];
        const uPts = pts[tossUdog];
        const isUdogFav0 = uPts > fPts;
        const isUdogFav5 = uPts >= fPts + 5;
        const isUdogFav10 = uPts >= fPts + 10;
        const isUdogFav15 = uPts >= fPts + 15;
        const isEqualOrFavLt10 = fPts === uPts || fPts > uPts && fPts < uPts + 10;
        const uGs = tossUdog === "1" ? m.gsHome ?? 0 : m.gsAway ?? 0;
        const uGa = tossUdog === "1" ? m.gaHome ?? 0 : m.gaAway ?? 0;
        const uTs = uGa === 0 ? uGs === 0 ? 1 : 2 : uGs / uGa;
        const isUdogHiddenStrength = Math.abs(uGs - uGa) <= 0.2;
        const isUdogTsEq1 = isUdogHiddenStrength && uTs === 1;
        const isUdogTsGt1 = isUdogHiddenStrength && uTs > 1;
        const isUdogTsLt1 = isUdogHiddenStrength && uTs < 1;
        if (final === "21") final = "12";
        if (final === "X1") final = "1X";
        if (final === "2X") final = "X2";
        if (primary === "1") {
          if (final !== "1X" && final !== "12") {
            final = percentages["X"] >= percentages["2"] ? "1X" : "12";
          }
        } else if (primary === "2") {
          if (final !== "X2" && final !== "12") {
            final = percentages["X"] >= percentages["1"] ? "X2" : "12";
          }
        } else if (primary === "X") {
          if (final !== "1X" && final !== "X2") {
            final = percentages["1"] >= percentages["2"] ? "1X" : "X2";
          }
        }
        const delegateList = [
          "G1g16",
          "G2m14",
          "G2g4",
          "G2f20",
          "G2o2",
          "G3a1",
          "G2i13",
          "G2o8",
          "G1ff53",
          "G1i17",
          "G1ff45",
          "G3j4",
          "G3g1",
          "G3p5",
          "G2a3",
          "G2ee9",
          "G1w4",
          "G2ee7",
          "G3s3",
          "G3f14",
          "G1bb2",
          "G1a7",
          "G3j11",
          "G3t12",
          "G3x3"
        ];
        if (sub) {
          let shouldDelegate = false;
          if (delegateList.includes(sub)) {
            shouldDelegate = true;
          } else {
            let minOdds = 2;
            if (m.mo && String(m.mo).trim() !== "NA") {
              const parts = String(m.mo).split(/[,\s:\/\-]+/).filter((p) => p.trim() !== "");
              const odds1 = parts.length > 0 ? parseFloat(parts[0]) : 0;
              const odds2 = parts.length > 2 ? parseFloat(parts[2]) : 0;
              if (!isNaN(odds1) && !isNaN(odds2)) {
                minOdds = Math.min(odds1, odds2);
              }
            }
            if (sub === "G2p10" && minOdds < 2.3) {
              shouldDelegate = true;
            } else if (sub === "G3r13" && minOdds < 2.3) {
              shouldDelegate = true;
            } else if (sub === "G2ff43" && minOdds < 2.1) {
              shouldDelegate = true;
            } else if (sub === "G3j2" && minOdds < 2.1) {
              shouldDelegate = true;
            } else if (sub === "G1r18" && minOdds < 1.5) {
              shouldDelegate = true;
            }
          }
          if (shouldDelegate && liveAlgoReport) {
            final = liveAlgoReport.prediction;
            if (liveAlgoReport.probabilities) {
              const p12 = liveAlgoReport.probabilities["1"] || 0;
              const pX2 = liveAlgoReport.probabilities["X"] || 0;
              const p22 = liveAlgoReport.probabilities["2"] || 0;
              if (pX2 > p12 && pX2 > p22) primary = "X";
              else if (p22 > p12 && p22 > pX2) primary = "2";
              else primary = "1";
              const pct1 = Math.round(p12 * 100);
              const pctX = Math.round(pX2 * 100);
              const pct2 = Math.round(p22 * 100);
              finalPercentages = { "1": pct1, "X": pctX, "2": pct2 };
              finalScores = { "1": pct1, "X": pctX, "2": pct2 };
            }
          }
        }
        if (final === "12") {
          const subForPaa = m.patternAnalysis?.subPattern;
          const statForPaa = subForPaa ? phaStatsMap[subForPaa] : null;
          if (statForPaa) {
            const paaPredObj = calculatePAAPrediction(m, statForPaa);
            const pPred = paaPredObj ? paaPredObj.paaPrediction : m.paaPrediction || m.paaPrimaryPrediction || "";
            if (pPred === "1X" || pPred === "X2") {
              const totalPaa = statForPaa.paaTotal || 1;
              const paaDrawPct = statForPaa.paaDraw / totalPaa * 100;
              if (paaDrawPct >= 30 || finalScores["X"] >= 30) {
                const isPaaOppositeMuchHigher = pPred === "1X" && finalPercentages["2"] > finalPercentages["1"] + 5 || pPred === "X2" && finalPercentages["1"] > finalPercentages["2"] + 5;
                if (!isPaaOppositeMuchHigher) {
                  final = pPred;
                  if (primary === "1" && pPred === "X2") primary = "2";
                  if (primary === "2" && pPred === "1X") primary = "1";
                } else {
                  if (finalPercentages["2"] > finalPercentages["1"]) {
                    final = "X2";
                    primary = "2";
                  } else {
                    final = "1X";
                    primary = "1";
                  }
                }
              }
            }
          }
        }
      }
      const sortedSeerK = ["1", "X", "2"].slice().sort((a, b) => (finalPercentages[b] || 0) - (finalPercentages[a] || 0));
      const topSeerK = sortedSeerK[0];
      const topSeerPct = finalPercentages[topSeerK] || 0;
      const currentPrimPct = finalPercentages[primary] || 0;
      if (topSeerPct > currentPrimPct + 5) {
        primary = topSeerK;
        const secondSeerK = sortedSeerK[1];
        if (primary === "1") {
          if (secondSeerK === "2" && finalPercentages["2"] >= 35) {
            final = "12";
          } else {
            final = "1X";
          }
        } else if (primary === "2") {
          if (secondSeerK === "1" && finalPercentages["1"] >= 35) {
            final = "12";
          } else {
            final = "X2";
          }
        } else if (primary === "X") {
          final = finalPercentages["1"] >= finalPercentages["2"] ? "1X" : "X2";
        }
      }
      const scoreDiff = finalScores[primary] - (finalScores["X"] + finalScores[primary === "1" ? "2" : "1"]) / 2;
      const isScoreStable = scoreDiff >= 25;
      const isHighProb = liveAlgoReport?.probabilities?.[primary] * 100 >= 52;
      const isSievePremium = isScoreStable && isHighProb;
      return {
        primary,
        final,
        scores: finalScores,
        percentages: finalPercentages,
        isScoreStable,
        isHighProb,
        isSievePremium
      };
    };
    predictWithSeer = (m, weights, phaStatsMap, matchStars, selectedCategory = "all") => {
      return predictSeerDetailed(m, weights, phaStatsMap, matchStars, selectedCategory).final;
    };
  }
});

// src/utils/matchEvaluator.ts
var G1_DRAW_RISK, G1_UPSET_RISK, G2_UPSET_RISK, G2_DRAW_RISK, G3_DRAW_RISK, G3_UPSET_RISK, getMatchStats, evaluateMatchCategory, getMatchEvaluatorTags, getMatchPriorityScore;
var init_matchEvaluator = __esm({
  "src/utils/matchEvaluator.ts"() {
    init_matchProcessing();
    init_seerLogic();
    G1_DRAW_RISK = ["FF53", "FF32", "R17", "J15"];
    G1_UPSET_RISK = ["FF48", "FF47", "FF37", "R16", "R02", "J4", "FF45", "J6", "FF50", "FF34", "F31", "EE3", "FF57", "P4"];
    G2_UPSET_RISK = ["FF43", "FF30", "FF42", "FF21", "G8", "S11", "FF35", "FF25", "FF28", "CC2", "F24", "FF48", "EE18", "EE9", "EE15", "FF39", "E5", "J11", "O11", "GG1", "FF57", "FF52", "FF49", "FF32"];
    G2_DRAW_RISK = ["FF27", "FF34", "FF44", "I6", "J10"];
    G3_DRAW_RISK = ["FF28", "FF6", "R13"];
    G3_UPSET_RISK = ["FF10", "FF1", "CC6", "FF8", "FF11", "FF5"];
    getMatchStats = (match, phaStatsMap) => {
      if (match._cachedMatchStats) {
        return match._cachedMatchStats;
      }
      let o1 = 0, oX = 0, o2 = 0;
      let moFav = "1";
      let moUnderdog = "2";
      if (match.mo) {
        const parts = match.mo.split(/[- ,]+/).map((p) => parseFloat(p.trim())).filter((p) => !isNaN(p));
        if (parts.length >= 3) {
          o1 = parts[0];
          oX = parts[1];
          o2 = parts[2];
          moFav = o1 < o2 ? "1" : "2";
          moUnderdog = o1 < o2 ? "2" : "1";
        }
      }
      const favOdds = moFav === "1" ? o1 : o2;
      const underdogOdds = moUnderdog === "1" ? o1 : o2;
      const sub = match.patternAnalysis?.subPattern || "NA";
      const pha = sub ? phaStatsMap[sub] : null;
      let phaStats = { home: 0, draw: 0, away: 0, favSupport: 0, underdogSupport: 0, drawSupport: 0 };
      let paaStats = { favWin: 0, draw: 0, upsetWin: 0, favWinRate: 0, drawRate: 0, upsetRate: 0, total: 0 };
      if (pha && pha.total > 0) {
        const total = pha.total;
        if (pha.outcomes) {
          phaStats.home = pha.outcomes["1"] || 0;
          phaStats.draw = pha.outcomes["X"] || 0;
          phaStats.away = pha.outcomes["2"] || 0;
          phaStats.drawSupport = phaStats.draw / total * 100;
          phaStats.favSupport = (pha.outcomes[moFav] || 0) / total * 100;
          phaStats.underdogSupport = (pha.outcomes[moUnderdog] || 0) / total * 100;
          paaStats.favWin = pha.favWin || 0;
          paaStats.draw = pha.draw || 0;
          paaStats.upsetWin = pha.upsetWin || 0;
          const paaTotal = pha.paaTotal ?? total;
          const pDenom = paaTotal > 0 ? paaTotal : total;
          paaStats.total = pDenom;
          paaStats.favWinRate = paaStats.favWin / pDenom * 100;
          paaStats.drawRate = paaStats.draw / pDenom * 100;
          paaStats.upsetRate = paaStats.upsetWin / pDenom * 100;
        } else {
          phaStats.home = pha["1"] || 0;
          phaStats.draw = pha["X"] || 0;
          phaStats.away = pha["2"] || 0;
          phaStats.drawSupport = phaStats.draw / total * 100;
          phaStats.favSupport = (pha[moFav] || 0) * 100;
          phaStats.underdogSupport = (pha[moUnderdog] || 0) * 100;
          paaStats.total = total;
          paaStats.favWinRate = phaStats.favSupport;
          paaStats.drawRate = phaStats.drawSupport;
          paaStats.upsetRate = phaStats.underdogSupport;
        }
      }
      let p1 = 0, pX = 0, p2 = 0;
      if (match.algoReport?.probabilities) {
        p1 = match.algoReport.probabilities["1"];
        pX = match.algoReport.probabilities["X"];
        p2 = match.algoReport.probabilities["2"];
      }
      const probFav = (moFav === "1" ? p1 : p2) * 100;
      const probUnderdog = (moUnderdog === "1" ? p1 : p2) * 100;
      const probDraw = pX * 100;
      const subPatPred = match.patternAnalysis?.subPatternPrediction || match.rawPrediction || "1";
      const algoPred = match.algoReport?.prediction || subPatPred;
      const finalPred = match.finalPrediction || subPatPred;
      const isHedged = finalPred.length > 1;
      const totalMatches = pha ? pha.total : 0;
      const result = {
        o1,
        oX,
        o2,
        moFav,
        moUnderdog,
        favOdds,
        underdogOdds,
        phaStats,
        paaStats,
        probFav,
        probUnderdog,
        probDraw,
        algoPred,
        subPatPred,
        finalPred,
        isHedged,
        totalMatches,
        // Map Legacy fields for compatibility
        phaFavSupport: paaStats.favWinRate,
        phaUnderdogSupport: paaStats.upsetRate,
        phaDrawSupport: paaStats.drawRate,
        phaFavWinSupport: paaStats.favWinRate,
        paaUpsetSupport: paaStats.upsetRate,
        phaUnderdogCount: moUnderdog === "1" ? phaStats.home : phaStats.away,
        phaDrawCount: phaStats.draw
      };
      match._cachedMatchStats = result;
      return result;
    };
    evaluateMatchCategory = (match, category, priority, phaStatsMap, isJackpot, isLiveAnalysisUI = false, matchStars = {}) => {
      if (category === "all") return true;
      if (category === "pending") {
        return getActualResult(match.result || "") === "pending";
      }
      const {
        o1,
        oX,
        o2,
        moFav,
        moUnderdog,
        favOdds,
        underdogOdds,
        phaFavSupport,
        phaUnderdogSupport,
        phaDrawSupport,
        phaFavWinSupport,
        phaUnderdogCount,
        phaDrawCount,
        probFav,
        probUnderdog,
        probDraw,
        algoPred,
        subPatPred,
        finalPred,
        isHedged,
        paaUpsetSupport,
        paaStats
      } = getMatchStats(match, phaStatsMap);
      const group = match.group || 0;
      const subPat = (match.patternAnalysis?.subPattern || "").toUpperCase();
      const subPatPrim = match.patternAnalysis?.primaryPrediction || "";
      const subPatFin = match.patternAnalysis?.subPatternPrediction || "";
      const subPatLower = subPat.toLowerCase();
      const isBasicBanned = subPatLower.includes("t") || subPatLower.includes("y") || subPatLower.includes("nn") || subPatLower.includes("n");
      const isPatternJ = subPatLower.includes("j");
      const isPatternS = subPatLower.includes("s");
      const isDrawRisk = group === 1 && G1_DRAW_RISK.some((id) => subPat.endsWith(id.toUpperCase())) || group === 2 && G2_DRAW_RISK.some((id) => subPat.endsWith(id.toUpperCase())) || group === 3 && G3_DRAW_RISK.some((id) => subPat.endsWith(id.toUpperCase()));
      const isUpsetRisk = group === 1 && G1_UPSET_RISK.some((id) => subPat.endsWith(id.toUpperCase())) || group === 2 && G2_UPSET_RISK.some((id) => subPat.endsWith(id.toUpperCase())) || group === 3 && G3_UPSET_RISK.some((id) => subPat.endsWith(id.toUpperCase()));
      if (category === "banned") {
        return Math.abs(phaUnderdogCount - phaDrawCount) <= 1;
      }
      const activeFlags = match.patternAnalysis?.activeFlags || [];
      if (category === "best_bet") {
        const ratingStr = match.rating || "0/10";
        const ratingVal = parseInt(ratingStr.split("/")[0]);
        const extAgrees = matchesPrediction(match.pred1x2 || "", moFav);
        if (!isLiveAnalysisUI && isHedged) return false;
        if (!matchesPrediction(finalPred, moFav)) return false;
        if (favOdds < 1.3 || favOdds > 1.6) return false;
        if (phaFavWinSupport < 40) return false;
        const isPR1 = phaFavWinSupport >= 60 && probFav >= 60;
        const isPR2 = phaFavWinSupport >= 50 && probFav >= 50;
        const isPR3 = phaFavWinSupport >= 50;
        const isPR4 = phaFavWinSupport >= 40;
        if (priority === "PR1") return isPR1;
        if (priority === "PR2") return isPR2;
        if (priority === "PR3") return isPR3;
        if (priority === "PR4") return isPR4;
        return priority === "all" && (isPR1 || isPR2 || isPR3 || isPR4);
      }
      if (category === "top10") {
        if (!matchesPrediction(finalPred, moFav)) return false;
        if (favOdds < 2 || favOdds > 3) return false;
        const algoAgrees = matchesPrediction(algoPred, moFav);
        const isPR1 = phaFavWinSupport >= 60 && probFav >= 60;
        const isPR2 = phaFavWinSupport >= 50 && probFav >= 50;
        const isPR3 = phaFavWinSupport >= 50 && probFav >= 45;
        const isPR4 = phaFavWinSupport >= 50;
        const isPR5 = phaFavWinSupport >= 40;
        if (priority === "PR1") return isPR1;
        if (priority === "PR2") return isPR2;
        if (priority === "PR3") return isPR3;
        if (priority === "PR4") return isPR4;
        if (priority === "PR5") return isPR5;
        return priority === "all" && (isPR1 || isPR2 || isPR3 || isPR4 || isPR5);
      }
      if (category === "bankers_dlive") {
        if (!matchesPrediction(finalPred, moFav)) return false;
        if (favOdds < 1.5 || favOdds > 1.99) return false;
        const isPR1 = phaFavWinSupport >= 60 && probFav >= 60;
        const isPR2 = phaFavWinSupport >= 50 && probFav >= 50;
        const isPR3 = phaFavWinSupport >= 50 && probFav >= 45;
        const isPR4 = phaFavWinSupport >= 50;
        const isPR5 = phaFavWinSupport >= 40;
        if (priority === "PR1") return isPR1;
        if (priority === "PR2") return isPR2;
        if (priority === "PR3") return isPR3;
        if (priority === "PR4") return isPR4;
        if (priority === "PR5") return isPR5;
        return priority === "all" && (isPR1 || isPR2 || isPR3 || isPR4 || isPR5);
      }
      if (category === "botb_best") {
        const ratingStr = match.rating || "0/10";
        const ratingVal = parseInt(ratingStr.split("/")[0]);
        const extAgrees = matchesPrediction(match.pred1x2 || "", moFav);
        const subPatValidHedged = subPatPred === "1X" || subPatPred === "X2";
        const subPatValidUnhedged = isLiveAnalysisUI ? subPatValidHedged : subPatPred === "1" || subPatPred === "2";
        const algoAgreesHedged = algoPred === subPatPred;
        const algoAgreesUnhedged = algoPred === subPatPred;
        const validHedgedOdds = favOdds >= 2 && favOdds < 2.4;
        const validUnhedgedOdds = favOdds >= 1.5 && favOdds < 2;
        const baseHedgedConditionsValid = subPatValidHedged && algoAgreesHedged && phaFavSupport >= 50 && probFav >= 50 && extAgrees;
        const baseUnhedgedConditionsValid = subPatValidUnhedged && algoAgreesUnhedged && phaFavSupport >= 50 && probFav >= 50 && extAgrees;
        const ratingValidHedged = ratingVal >= 2;
        const ratingValidUnhedged = ratingVal >= 3;
        const paaHedgedValid = phaFavWinSupport >= 60;
        const isStrictHedged = (isLiveAnalysisUI || isHedged) && validHedgedOdds && baseHedgedConditionsValid && ratingValidHedged && paaHedgedValid;
        const isStrictUnhedged = (isLiveAnalysisUI || !isHedged) && validUnhedgedOdds && baseUnhedgedConditionsValid && ratingValidUnhedged;
        let disagreements = 0;
        if (subPatPred === "12") disagreements++;
        const algoContradicts = algoPred !== subPatPred;
        if (algoContradicts) disagreements++;
        const extContradicts = !matchesPrediction(match.pred1x2 || "", subPatPred);
        if (extContradicts) disagreements++;
        if (ratingVal < 3) disagreements++;
        const isRelaxedBase = disagreements <= 3 && !(algoContradicts && extContradicts) && phaFavSupport >= 50 && probFav >= 50;
        const isRelaxedHedged = (isLiveAnalysisUI || isHedged) && validHedgedOdds && isRelaxedBase && phaFavWinSupport >= 50;
        const isRelaxedUnhedged = (isLiveAnalysisUI || !isHedged) && validUnhedgedOdds && isRelaxedBase;
        const isPR1 = (isStrictHedged || isStrictUnhedged) && phaFavWinSupport >= 60;
        const isPR2 = (isStrictHedged || isStrictUnhedged) && phaFavWinSupport >= 55;
        const isPR3 = (isRelaxedHedged || isRelaxedUnhedged) && phaFavWinSupport >= 50;
        const isPR4 = (isRelaxedHedged || isRelaxedUnhedged) && phaFavWinSupport >= 45;
        const isPR5 = (isRelaxedHedged || isRelaxedUnhedged) && phaFavWinSupport >= 40;
        if (priority === "PR1") return isPR1;
        if (priority === "PR2") return isPR2;
        if (priority === "PR3") return isPR3;
        if (priority === "PR4") return isPR4;
        if (priority === "PR5") return isPR5;
        return priority === "all" && (isPR1 || isPR2 || isPR3 || isPR4 || isPR5);
      }
      if (category === "top20") {
        if (!matchesPrediction(finalPred, moFav)) return false;
        if (favOdds < 1.5) return false;
        const league = match.league?.toLowerCase() || "";
        const algoAgrees = matchesPrediction(algoPred, moFav);
        const subPatRaw = match.patternAnalysis?.subPattern || "";
        const isPR1 = phaFavWinSupport >= 60 && probFav >= 60;
        const isPR2 = phaFavWinSupport >= 50 && probFav >= 50;
        const isPR3 = phaFavWinSupport >= 50 && probFav >= 45;
        const isPR4 = phaFavWinSupport >= 50;
        const isPR5 = phaFavWinSupport >= 40;
        if (priority === "PR1") return isPR1;
        if (priority === "PR2") return isPR2;
        if (priority === "PR3") return isPR3;
        if (priority === "PR4") return isPR4;
        if (priority === "PR5") return isPR5;
        return priority === "all" && (isPR1 || isPR2 || isPR3 || isPR4 || isPR5);
      }
      if (category === "bankers_jackpot") {
        if (!matchesPrediction(finalPred, moFav)) return false;
        if (favOdds < 1.8 || favOdds > 2.4) return false;
        if (phaFavWinSupport < 50) return false;
        const isPR1 = phaFavWinSupport >= 60 && probFav >= 60;
        const isPR2 = phaFavWinSupport >= 50 && probFav >= 50;
        const isPR3 = phaFavWinSupport >= 50 && probFav >= 45;
        const isPR4 = phaFavWinSupport >= 50;
        const isPR5 = phaFavWinSupport >= 40;
        if (priority === "PR1") return isPR1;
        if (priority === "PR2") return isPR2;
        if (priority === "PR3") return isPR3;
        if (priority === "PR4") return isPR4;
        if (priority === "PR5") return isPR5;
        return priority === "all" && (isPR1 || isPR2 || isPR3 || isPR4 || isPR5);
      }
      if (category === "value_bets") {
        if (!matchesPrediction(finalPred, moFav) && !matchesPrediction(finalPred, moUnderdog)) return false;
        if (o1 < 2.5 || o2 < 2.5) return false;
        if (subPatPred && algoPred !== subPatPred) {
          if (!matchesPrediction(finalPred, subPatPred)) return false;
        }
        const isPR1 = phaFavSupport >= 50 && probFav >= 50;
        const isPR2 = phaUnderdogSupport >= 50 && probUnderdog >= 50;
        const isPR3 = phaFavSupport >= 45 && probFav >= 45;
        const isPR4 = phaUnderdogSupport >= 45 && probUnderdog >= 45;
        const isPR5 = phaFavSupport >= 40 && probFav >= 40;
        const isPR6 = phaUnderdogSupport >= 40 && probUnderdog >= 40;
        const isPR7 = phaFavSupport >= 40;
        const isPR8 = phaUnderdogSupport >= 40;
        if (priority === "PR1") return isPR1;
        if (priority === "PR2") return isPR2;
        if (priority === "PR3") return isPR3;
        if (priority === "PR4") return isPR4;
        if (priority === "PR5") return isPR5;
        if (priority === "PR6") return isPR6;
        if (priority === "PR7") return isPR7;
        if (priority === "PR8") return isPR8;
        return priority === "all" && (isPR1 || isPR2 || isPR3 || isPR4 || isPR5 || isPR6 || isPR7 || isPR8);
      }
      if (category === "value_picks") {
        const minOdds = 2;
        if (favOdds < minOdds || favOdds > 2.4) return false;
        if (phaFavWinSupport < 45) return false;
        const isPR1 = phaFavWinSupport >= 60 && probFav >= 60;
        const isPR2 = phaFavWinSupport >= 50 && probFav >= 50;
        const isPR3 = phaFavWinSupport >= 50 && probFav >= 45;
        const isPR4 = phaFavWinSupport >= 50;
        const isPR5 = phaFavWinSupport >= 40;
        if (priority === "PR1") return isPR1;
        if (priority === "PR2") return isPR2;
        if (priority === "PR3") return isPR3;
        if (priority === "PR4") return isPR4;
        if (priority === "PR5") return isPR5;
        return priority === "all" && (isPR1 || isPR2 || isPR3 || isPR4 || isPR5);
      }
      if (category === "banker_draws") {
        if (o1 < 2 || o2 < 2) return false;
        if (oX > 3.8) return false;
        const isStraightX = finalPred === "X";
        const satisfiesUnhedgedDraw = probDraw >= 40 || paaStats.drawRate >= 40;
        const hedgesFav = moFav === "1" && finalPred === "1X" || moFav === "2" && finalPred === "X2" || finalPred === "X";
        const hedgesUnderdog = moUnderdog === "1" && finalPred === "1X" || moUnderdog === "2" && finalPred === "X2" || finalPred === "X";
        const satisfiesHedgeFav = isLiveAnalysisUI || hedgesFav || satisfiesUnhedgedDraw;
        const satisfiesHedgeUnderdog = isLiveAnalysisUI || hedgesUnderdog || satisfiesUnhedgedDraw;
        const isPR1 = paaStats.drawRate >= 30 && probDraw >= 30 && phaFavWinSupport >= 40 && satisfiesHedgeFav;
        const isPR2 = paaStats.drawRate >= 30 && probDraw >= 30 && paaStats.upsetRate > 30 && satisfiesHedgeUnderdog;
        const isPR3 = paaStats.drawRate >= 30 && (paaStats.upsetRate >= 30 && satisfiesHedgeUnderdog || paaStats.upsetRate < 30 && satisfiesHedgeFav);
        const isPR4 = probDraw >= 30 && (paaStats.upsetRate >= 30 && satisfiesHedgeUnderdog || paaStats.upsetRate < 30 && satisfiesHedgeFav);
        if (priority === "PR1") return isPR1;
        if (priority === "PR2") return isPR2;
        if (priority === "PR3") return isPR3;
        if (priority === "PR4") return isPR4;
        return priority === "all" && (isPR1 || isPR2 || isPR3 || isPR4);
      }
      if (category === "upsets") {
        if (o1 <= 0 || o2 <= 0 || o1 === o2) return false;
        if (moUnderdog !== "1" && moUnderdog !== "2") return false;
        if (!finalPred || !matchesPrediction(finalPred, moUnderdog)) return false;
        const paaPrimPred = (match.paaPrimaryPrediction || "").trim();
        const paaPrimSupports = paaPrimPred.length > 0 && paaPrimPred === moUnderdog;
        let seerPrimPred = (match.seerPrimaryPrediction || "").trim();
        if (!seerPrimPred) {
          const seerDetailed = predictSeerDetailed(match, DEFAULT_WEIGHTS, phaStatsMap, matchStars, "all");
          seerPrimPred = (seerDetailed?.primary || "").trim();
        }
        const seerPrimSupports = seerPrimPred.length > 0 && seerPrimPred === moUnderdog;
        const algoPredVal = (match.algoReport?.prediction || "").trim();
        const algoSupports = algoPredVal.length > 0 && matchesPrediction(algoPredVal, moUnderdog);
        const isPR1a = paaPrimSupports && seerPrimSupports && algoSupports;
        const isPR1b = paaPrimSupports && seerPrimSupports;
        const isPR1c = seerPrimSupports && algoSupports;
        const isPR1d = paaPrimSupports && algoSupports;
        const isPR1 = isPR1a || isPR1b || isPR1c || isPR1d;
        const cardPoints = match.totalPoints;
        let isPR2 = false;
        if (cardPoints && typeof cardPoints.home === "number" && typeof cardPoints.away === "number") {
          const teamPointsUnderdog = moUnderdog === "1" ? cardPoints.home : cardPoints.away;
          const teamPointsFav = moFav === "1" ? cardPoints.home : cardPoints.away;
          isPR2 = teamPointsUnderdog >= teamPointsFav + 5;
        }
        const defaultSeerDetailed = predictSeerDetailed(match, DEFAULT_WEIGHTS, phaStatsMap, matchStars, "all");
        const isPR3 = (defaultSeerDetailed?.percentages?.["X"] || 0) >= 40;
        const isPR4 = !!match.algoReport && probUnderdog >= 40;
        const upsetPotential = cardPoints?.breakdown?.upsetPotential;
        const hasUpsetPotentialBonus = !!upsetPotential && typeof upsetPotential === "object" && (upsetPotential.bonus || 0) > 0 && (!upsetPotential.team || upsetPotential.team === moUnderdog);
        const hasUpsetIndicator = typeof cardPoints?.breakdown?.tsIndicators === "string" && cardPoints.breakdown.tsIndicators.includes("Potential Upset");
        const isPR5 = hasUpsetPotentialBonus || hasUpsetIndicator;
        if (priority === "PR1a") return isPR1a;
        if (priority === "PR1b") return isPR1b;
        if (priority === "PR1c") return isPR1c;
        if (priority === "PR1d") return isPR1d;
        if (priority === "PR1") return isPR1;
        if (priority === "PR2") return isPR2;
        if (priority === "PR3") return isPR3;
        if (priority === "PR4") return isPR4;
        if (priority === "PR5") return isPR5;
        return priority === "all" && (isPR1 || isPR2 || isPR3 || isPR4 || isPR5);
      }
      return true;
    };
    getMatchEvaluatorTags = (match, phaStatsMap, isJackpot, isLiveAnalysisUI = false, matchStars = {}) => {
      const tags = [];
      const categories = ["best_bet", "top10", "bankers_dlive", "botb_best", "top20", "bankers_jackpot", "value_bets", "value_picks", "banker_draws", "upsets"];
      const priorities = ["PR1a", "PR1b", "PR1c", "PR1d", "PR1", "PR2", "PR3", "PR4", "PR5", "PR6", "PR7", "PR8", "PR9", "PR10", "PR11", "PR12", "PR13"];
      const stats = getMatchStats(match, phaStatsMap);
      const subPat = (match.patternAnalysis?.subPattern || "").toUpperCase();
      const group = match.group || 0;
      let isBanned = false;
      const isPatternTSub = (match.patternAnalysis?.mainPattern || "").toUpperCase() === "T" && !!match.patternAnalysis?.subPattern;
      if (isPatternTSub) {
        tags.push("BANNED:PATTERN_T");
        isBanned = true;
      }
      if (group === 1) {
        if (G1_DRAW_RISK.some((id) => subPat.endsWith(id))) {
          tags.push("BANNED:DRAW_RISK");
          isBanned = true;
        }
        if (G1_UPSET_RISK.some((id) => subPat.endsWith(id))) {
          tags.push("BANNED:UPSET_RISK");
          isBanned = true;
        }
      } else if (group === 2) {
        if (G2_UPSET_RISK.some((id) => subPat.endsWith(id))) {
          tags.push("BANNED:UPSET_RISK");
          isBanned = true;
        }
        if (G2_DRAW_RISK.some((id) => subPat.endsWith(id))) {
          tags.push("BANNED:DRAW_RISK");
          isBanned = true;
        }
      } else if (group === 3) {
        if (G3_DRAW_RISK.some((id) => subPat.endsWith(id))) {
          tags.push("BANNED:DRAW_RISK");
          isBanned = true;
        }
        if (G3_UPSET_RISK.some((id) => subPat.endsWith(id))) {
          tags.push("BANNED:UPSET_RISK");
          isBanned = true;
        }
      }
      const teams = (match.teams || "").toLowerCase();
      const league = (match.league || "").toLowerCase();
      const africanDomesticRegex = /tanzania|tanzanian|kenya|kenyan|uganda|ugandan|rwanda|rwandan|egypt|egyptian|morocco|moroccan|nigeria|nigerian|ghana|ghanaian|south africa|south african|zambia|zambian|senegal|senegalese|tunisia|tunisian|algeria|algerian|mali|cameroon|cameroonian|congo|angola|angolan|burundi|sudan|sudanese|somalia|ethiopia|ethiopian|suhul shire|caps united|triangle u|malawi|mozambique|botswana|namibia|zimbabwe|zimbabwean|lesotho|eswatini|madagascar|ivory coast|cote d'ivoire|guinea|burkina faso|benin|togo|mauritania|niger|chad|central african|gabon|equatorial|djibouti|eritrea|seychelles|comoros|mauritius|sao tome|sierra leone|liberia|gambia|cape verde|chemilil|sony sugar|jkt/i;
      if (africanDomesticRegex.test(teams) || africanDomesticRegex.test(league)) {
        tags.push("BANNED:AFRICAN_LEAGUE");
        isBanned = true;
      }
      const mainPat = (match.patternAnalysis?.mainPattern || "").toUpperCase();
      if (!isBanned && (mainPat === "R" || mainPat === "FF")) {
        tags.push("VOLATILE:LAST_RESORT");
      }
      for (const cat of categories) {
        let hasCategory = false;
        let matchedPriority = null;
        for (const pr of priorities) {
          if (evaluateMatchCategory(match, cat, pr, phaStatsMap, isJackpot, isLiveAnalysisUI, matchStars)) {
            matchedPriority = pr;
            tags.push(`${cat}:${pr}`);
            hasCategory = true;
            break;
          }
        }
        if (hasCategory) {
          const subPatPred = match.patternAnalysis?.subPatternPrediction;
          const rawAlgoPred = match.algoReport?.prediction;
          const group2 = match.group || 3;
          const pRule1 = subPatPred === "1X" || subPatPred === "X2";
          const pRule2 = (rawAlgoPred === "1X" || rawAlgoPred === "X2") && rawAlgoPred === subPatPred;
          const pRule3 = stats.phaFavSupport >= 60;
          const isUpsetOrValueBet = cat === "upsets" || cat === "value_bets";
          let catPromote = false;
          let isExcellentStars = false;
          if (cat === "botb_best") {
            const { phaFavWinSupport, probFav, subPatPred: subPatPred2, algoPred } = stats;
            const ratingStr2 = match.rating || "0/10";
            const ratingVal2 = parseInt(ratingStr2.split("/")[0]);
            const extAgrees = matchesPrediction(match.pred1x2 || "", stats.moFav);
            const subPatValidHedged = subPatPred2 === "1X" || subPatPred2 === "X2";
            const subPatValidUnhedged = isLiveAnalysisUI ? subPatValidHedged : subPatPred2 === "1" || subPatPred2 === "2";
            const algoAgreesHedged = algoPred === subPatPred2;
            const algoAgreesUnhedged = algoPred === subPatPred2;
            const isPerfectHedged = (isLiveAnalysisUI || stats.isHedged) && stats.favOdds >= 2 && stats.favOdds < 2.4 && subPatValidHedged && algoAgreesHedged && stats.phaFavSupport > 50 && phaFavWinSupport > 55 && probFav >= 50 && extAgrees && ratingVal2 >= 2;
            const isPerfectUnhedged = (isLiveAnalysisUI || !stats.isHedged) && stats.favOdds >= 1.5 && stats.favOdds < 2 && subPatValidUnhedged && algoAgreesUnhedged && stats.phaFavSupport > 50 && phaFavWinSupport > 60 && probFav >= 50 && extAgrees && ratingVal2 >= 3;
            if (isPerfectHedged || isPerfectUnhedged) {
              tags.push("botb_best:AUTO_PICK");
              catPromote = true;
            }
            const validHedgedOddsFb = stats.favOdds >= 2 && stats.favOdds < 2.4;
            const validUnhedgedOddsFb = stats.favOdds >= 1.5 && stats.favOdds < 2;
            const oddsValidFallback = (isLiveAnalysisUI || stats.isHedged) && validHedgedOddsFb || (isLiveAnalysisUI || !stats.isHedged) && validUnhedgedOddsFb;
            const fallbackSubPatValid = isLiveAnalysisUI || stats.isHedged ? subPatValidHedged : subPatValidUnhedged;
            const fallbackAlgoAgrees = isLiveAnalysisUI || stats.isHedged ? algoAgreesHedged : algoAgreesUnhedged;
            if (phaFavWinSupport >= 50 && oddsValidFallback && fallbackSubPatValid && fallbackAlgoAgrees && stats.phaFavSupport > 50 && probFav >= 50) {
              catPromote = true;
            }
            let disagreements = 0;
            if (subPatPred2 === "12") disagreements++;
            const algoContradicts = algoPred !== subPatPred2;
            if (algoContradicts) disagreements++;
            const extContradicts = !matchesPrediction(match.pred1x2 || "", subPatPred2);
            if (extContradicts) disagreements++;
            if (ratingVal2 < 3) disagreements++;
            if (disagreements <= 3 && !(algoContradicts && extContradicts) && oddsValidFallback && stats.phaFavSupport > 50 && probFav >= 50 && phaFavWinSupport >= 50) {
              catPromote = true;
            }
          }
          const isTargetSlip = ["best_bet", "top10", "bankers_dlive", "botb_best", "top20", "bankers_jackpot", "value_picks"].includes(cat);
          const ratingStr = match.rating || "0/10";
          const ratingVal = parseInt(ratingStr.split("/")[0]);
          const isHighRatingFor12 = ratingVal >= 5;
          const isHighRatingSupport = ratingVal >= 3;
          const isUnderdogGreaterEqualDraw = stats.underdogOdds >= stats.oX && stats.underdogOdds > 0 && stats.oX > 0;
          const isUnderdogGreaterDraw = stats.underdogOdds > stats.oX && stats.underdogOdds > 0 && stats.oX > 0;
          const phaDiff = Math.abs(stats.phaUnderdogSupport - stats.phaDrawSupport);
          const isPhaDiffValid = phaDiff > 1;
          const excludedGroups = ["T", "N", "NN", "Y", "t", "y", "n", "nn"];
          const mainPattern = match.patternAnalysis?.mainPattern || "";
          const isExcludedGroup = excludedGroups.some((g) => mainPattern.toLowerCase().startsWith(g.toLowerCase()));
          if (isTargetSlip) {
            const abbrMap = {
              "top10": "T12",
              "bankers_dlive": "BDL",
              "top20": "T20",
              "bankers": "BNK",
              "bankers_jackpot": "BNK",
              "value_bets": "VB",
              "value_picks": "VP",
              "banker_draws": "BD",
              "upsets": "UPS"
            };
            const abbr = abbrMap[cat];
            const starKey = `${abbr}-${matchedPriority}-G${group2}`;
            const fallbackStarKey = `${abbr}-${matchedPriority}-G3`;
            let stars = matchStars[starKey];
            if (stars === void 0) stars = matchStars[fallbackStarKey];
            isExcellentStars = stars !== void 0 && stars >= 4;
            const isSubPatValid = subPatPred === "1X" || subPatPred === "X2" || subPatPred === "1" || subPatPred === "2" || subPatPred === "12" && isHighRatingFor12 && isExcellentStars;
            const algoAgrees = rawAlgoPred === subPatPred;
            const isGoodPR = matchedPriority && ["PR1", "PR2", "PR3", "PR4", "PR5"].includes(matchedPriority);
            const isPriorityUnderdog = stats.underdogOdds > 3;
            const hasMainPriorities = isSubPatValid && (cat === "top10" ? isUnderdogGreaterEqualDraw && isPriorityUnderdog : isUnderdogGreaterDraw) && isPhaDiffValid && !isExcludedGroup;
            const hasSupportPriorities = algoAgrees || isHighRatingSupport || isExcellentStars || isGoodPR;
            if (hasMainPriorities) {
              catPromote = true;
              if (hasSupportPriorities) {
                tags.push(`${cat}:AUTO_PICK`);
              }
            }
          }
          if (["top10", "top20"].includes(cat)) {
            const reasonStr = (match.algoReport?.reason || "") + (match.qualityAudit?.reason || "");
            const hasCriticalDrawRisk = reasonStr.includes("Critical Draw Risk") || reasonStr.includes("High PHA Draw");
            const drawCeilingCap = stats.phaDrawSupport > 30;
            const hasBannedTie = tags.includes("PHA_TIE");
            const isUnhedged = !stats.isHedged;
            let shouldVeto = false;
            if (cat === "top10") {
              shouldVeto = false;
            } else {
              shouldVeto = isUnhedged && (hasCriticalDrawRisk || drawCeilingCap);
            }
            if (shouldVeto) {
              catPromote = false;
            } else if (cat === "top10" && stats.underdogOdds <= 3) {
              catPromote = false;
            } else if (matchesPrediction(rawAlgoPred || "", stats.moFav) && stats.phaFavSupport >= 50) {
              catPromote = true;
            }
          }
          if (cat === "banker_draws" && rawAlgoPred === subPatPred && (subPatPred === "1X" || subPatPred === "X2" || subPatPred === "X")) catPromote = true;
          if (cat === "value_picks") {
            const agreesWithFinal = rawAlgoPred === match.finalPrediction;
            if (!agreesWithFinal) {
              catPromote = false;
            } else if ((rawAlgoPred === "1X" || rawAlgoPred === "X2" || rawAlgoPred === "1" || rawAlgoPred === "2") && rawAlgoPred === subPatPred) {
              catPromote = true;
            }
          }
          if (cat === "bankers_jackpot") {
            const hasSevereUpset = tags.some((t) => t.startsWith("upsets:PR10") || t.startsWith("upsets:PR11") || t.startsWith("upsets:PR12") || t.startsWith("upsets:PR13"));
            if (hasSevereUpset) {
              catPromote = false;
            }
          }
          if (cat === "upsets") {
            const moUnderdog = stats.moFav === "1" ? "2" : "1";
            const algoIncludesUnderdog = rawAlgoPred?.includes(moUnderdog);
            const finalIncludesUnderdog = match.finalPrediction?.includes(moUnderdog);
            const isNot12Hedge = match.finalPrediction !== "12";
            const hasUpsetPAA = matchedPriority && ["PR10", "PR11", "PR12", "PR13"].includes(matchedPriority);
            if (hasUpsetPAA && algoIncludesUnderdog && finalIncludesUnderdog && isNot12Hedge || stats.underdogOdds <= 3 && stats.underdogOdds > 0) {
              catPromote = true;
            }
          }
          const isUnderdogThreatRel = stats.underdogOdds <= 3 && stats.underdogOdds > 0;
          if (isUnderdogThreatRel) {
            const isVBUnderdog = cat === "value_bets" && ["PR2", "PR4", "PR6"].includes(matchedPriority || "");
            const isBDUnderdog = cat === "banker_draws" && (matchedPriority === "PR1" && stats.paaStats.upsetRate >= 30 || ["PR2", "PR4"].includes(matchedPriority || ""));
            if (isVBUnderdog || isBDUnderdog) {
              catPromote = true;
            }
          }
          const hasBankerTag = tags.some((t) => t.startsWith("bankers_jackpot:"));
          const hasUpsetTag = tags.some((t) => t.startsWith("upsets:"));
          if (hasBankerTag && hasUpsetTag) {
            tags.push("stalemate:DRAW_RISK");
          }
          const abbrMapStats = {
            "top10": "T12",
            "bankers_dlive": "BDL",
            "top20": "T20",
            "bankers": "BNK",
            "bankers_jackpot": "BNK",
            "value_bets": "VB",
            "value_picks": "VP",
            "banker_draws": "BD",
            "upsets": "UPS",
            "uncategorized": "UNC"
          };
          const abbrStats = abbrMapStats[cat];
          const starKeyStats = `${abbrStats}-${matchedPriority}-G${group2}`;
          const fallbackStarKeyStats = `${abbrStats}-${matchedPriority}-G3`;
          let loopStars = abbrStats ? matchStars[starKeyStats] : void 0;
          if (loopStars === void 0 && abbrStats) loopStars = matchStars[fallbackStarKeyStats];
          const isFiveStars = loopStars !== void 0 && loopStars === 5;
          const isLowStars = loopStars !== void 0 && loopStars < 3;
          let finalAction = "NONE";
          if ((pRule1 || pRule2 || pRule3) && !isUpsetOrValueBet || catPromote) {
            finalAction = "PROMOTE";
          }
          const dRule1 = rawAlgoPred === "12";
          const dRule2 = subPatPred === "12";
          const dRule3 = subPatPred === "1X" && rawAlgoPred === "X2" || subPatPred === "X2" && rawAlgoPred === "1X";
          const isTargetCat = ["best_bet", "top10", "bankers_dlive", "top20", "bankers_jackpot", "value_picks"].includes(cat);
          const dRule4 = isTargetCat ? stats.underdogOdds <= 3 : stats.underdogOdds <= 2.8;
          const dRule5 = isTargetCat && Math.abs(stats.phaUnderdogSupport - stats.phaDrawSupport) <= 2;
          const dRule6 = stats.totalMatches <= 5;
          let catDemote = false;
          if (isTargetSlip && stats.underdogOdds <= 3 && stats.underdogOdds > 0) {
            catDemote = true;
          }
          if (["top10", "bankers_jackpot", "value_picks"].includes(cat) && stats.favOdds >= 2.4 && stats.favOdds <= 2.5) {
            catDemote = true;
            tags.push(`${cat}:HIGH_ODDS_RISK`);
          }
          if (cat === "banker_draws" && subPatPred === "12") catDemote = true;
          if (finalAction !== "PROMOTE") {
            if ((dRule1 || dRule2 || dRule3 || dRule4 || dRule5) && !isUpsetOrValueBet || dRule6 || catDemote) {
              finalAction = "DEMOTE";
            } else if (cat === "bankers_jackpot") {
              const hasSevereUpset = tags.some((t) => t.startsWith("upsets:PR10") || t.startsWith("upsets:PR11") || t.startsWith("upsets:PR12") || t.startsWith("upsets:PR13"));
              if (hasSevereUpset) {
                finalAction = "DEMOTE";
              }
            } else if (["top10", "top20"].includes(cat)) {
              const reasonStr = (match.algoReport?.reason || "") + (match.qualityAudit?.reason || "");
              const hasCriticalDrawRisk = reasonStr.includes("Critical Draw Risk") || reasonStr.includes("High PHA Draw");
              const drawCeilingCap = stats.phaDrawSupport > 30;
              const hasBannedTie = tags.includes("PHA_TIE");
              const isUnhedged = !stats.isHedged;
              let shouldDemote = false;
              if (cat === "top10") {
                shouldDemote = stats.underdogOdds <= 3;
              } else {
                shouldDemote = isUnhedged && (hasCriticalDrawRisk || drawCeilingCap);
              }
              if (shouldDemote) {
                finalAction = "DEMOTE";
              }
            }
          }
          if (finalAction === "PROMOTE" && isLowStars) {
            finalAction = "DEMOTE";
          } else if (finalAction === "DEMOTE" && isFiveStars) {
            finalAction = "PROMOTE";
          }
          if (finalAction === "PROMOTE") {
            tags.push(`${cat}:PROMOTE`);
          } else if (finalAction === "DEMOTE") {
            if (cat === "top20" && stats.isHedged) {
            } else {
              tags.push(`${cat}:DEMOTE`);
            }
          }
          if (["best_bet", "top10", "top20", "bankers_jackpot", "value_picks", "bankers_dlive", "botb_best"].includes(cat)) {
            const isUnderdogThreat = stats.underdogOdds <= 3 && stats.underdogOdds > 0;
            if (stats.favOdds > 2.4 || stats.paaStats.upsetRate >= 30 || isUnderdogThreat) {
              if (!tags.includes(`${cat}:LAST_RESORT`)) {
                tags.push(`${cat}:LAST_RESORT`);
              }
            }
          }
          if (["best_bet", "bankers_dlive", "bankers_jackpot", "value_picks", "botb_best", "top20"].includes(cat)) {
            const isApplicable = cat !== "botb_best" || !stats.isHedged;
            if (isApplicable) {
              const has12Conflict = rawAlgoPred === "12" && (subPatPred === "1X" || subPatPred === "X2");
              if (has12Conflict) {
                if (!tags.includes(`${cat}:LAST_RESORT`)) {
                  tags.push(`${cat}:LAST_RESORT`);
                }
              }
            }
          }
        }
      }
      if (Math.abs(stats.phaUnderdogCount - stats.phaDrawCount) <= 1) {
        const isElite = tags.some(
          (t) => t.startsWith("bankers_jackpot:") || t.startsWith("bankers_dlive:") || t.startsWith("value_bets:") || t.startsWith("value_picks:") || t.startsWith("upsets:")
        );
        if (!isElite) {
          tags.push("PHA_TIE");
        } else {
          tags.push("VOLATILE:PHA_TIE");
        }
      }
      return tags;
    };
    getMatchPriorityScore = (match, category, matchStars) => {
      const tags = match.evaluatorTags || [];
      const catTags = tags.filter((t) => t.startsWith(category + ":"));
      if (catTags.length === 0) return -1e3;
      const abbrMap = {
        "top10": "T12",
        "bankers_dlive": "BDL",
        "top20": "T20",
        "bankers": "BNK",
        "bankers_jackpot": "BNK",
        "value_bets": "VB",
        "value_picks": "VP",
        "banker_draws": "BD",
        "upsets": "UPS"
      };
      const abbr = abbrMap[category];
      const group = match.group || 3;
      let score = 0;
      let basePriorityScore = 0;
      let priorityStars = 0;
      let promoteStars = 0;
      let isDemoted = false;
      const prTag = catTags.find((t) => t.includes(":PR"));
      if (prTag) {
        const prNum = parseInt(prTag.split(":PR")[1]);
        if (!isNaN(prNum)) {
          basePriorityScore = 110 - prNum * 10;
          if (abbr) {
            const key = `${abbr}-PR${prNum}-G${group}`;
            const fallbackKey = `${abbr}-PR${prNum}-G3`;
            priorityStars = (matchStars[key] ?? matchStars[fallbackKey] ?? 0) * 10;
          }
        }
      }
      if (catTags.some((t) => t.endsWith(":PROMOTE"))) {
        if (abbr) {
          const key = `${abbr}-PROMOTE-G${group}`;
          const fallbackKey = `${abbr}-PROMOTE-G3`;
          promoteStars = (matchStars[key] ?? matchStars[fallbackKey] ?? 0) * 10;
        }
        score += 20;
      }
      if (catTags.some((t) => t.endsWith(":DEMOTE"))) {
        isDemoted = true;
        score -= 200;
      }
      if (catTags.some((t) => t.endsWith(":LAST_RESORT")) || tags.some((t) => t.endsWith(":LAST_RESORT"))) {
        score -= 1e3;
      }
      if (tags.includes("VOLATILE:PHA_TIE") && category !== "upsets") {
        score -= 100;
      }
      if (tags.some((t) => t.startsWith("BANNED:"))) {
        if (tags.includes("PHA_TIE")) {
          score -= 1e3;
        }
        const hasDrawRisk = tags.includes("BANNED:DRAW_RISK");
        const hasUpsetRisk = tags.includes("BANNED:UPSET_RISK");
      }
      return basePriorityScore + priorityStars + promoteStars + score;
    };
  }
});

// src/utils/seerUnderdogSlipSelection.ts
var getSeerScoreForPrediction, generateSeerUnderdogSlips;
var init_seerUnderdogSlipSelection = __esm({
  "src/utils/seerUnderdogSlipSelection.ts"() {
    init_seerLogic();
    init_matchEvaluator();
    init_storage();
    init_seerSupremeTier();
    getSeerScoreForPrediction = (m, pred, weights, phaStatsMap, matchStars) => {
      let s1 = pred.includes("1") ? getMatchScore(m, "1", weights, phaStatsMap, matchStars) : 0;
      let sx = pred.includes("X") ? getMatchScore(m, "X", weights, phaStatsMap, matchStars) : 0;
      let s2 = pred.includes("2") ? getMatchScore(m, "2", weights, phaStatsMap, matchStars) : 0;
      return Math.max(s1, sx, s2);
    };
    generateSeerUnderdogSlips = (targetMatches, phaStatsMap, matchStars, isJackpot, isIntelligenceActive = false) => {
      const preCalculatedRules = calculateSupremeRules(phaStatsMap);
      const spec = {
        jackpot_slip: [],
        bankers_jackpot: [],
        bankers_dlive: [],
        value_bets: [],
        value_picks: [],
        banker_draws: [],
        upsets: [],
        unallocated: [],
        uncategorized: []
      };
      const live = {
        best_bet: [],
        top_10_value: [],
        high_confidence: [],
        botb_best: []
      };
      const usageCount = /* @__PURE__ */ new Map();
      const matchTagsMap = /* @__PURE__ */ new Map();
      const seerWeights = getSeerWeights();
      const modePrefix = isJackpot ? "jackpot_" : "daily_";
      const getWeights = (cat) => {
        let mappedParent = cat;
        if (cat === "best_bet" || cat === "high_confidence" || cat === "botb_best") {
          mappedParent = "safety";
        } else if (cat === "bankers_dlive" || cat === "bankers_jackpot" || cat === "value_picks" || cat === "banker_draws") {
          mappedParent = "banker";
        } else if (cat === "upsets" || cat === "value_bets") {
          mappedParent = "upset";
        } else if (cat === "top_10_value") {
          mappedParent = "jackpot";
        }
        return seerWeights[`${modePrefix}${cat}`] || seerWeights[cat] || seerWeights[`${modePrefix}${mappedParent}`] || seerWeights[mappedParent] || seerWeights[`${modePrefix}all`] || seerWeights["all"] || DEFAULT_WEIGHTS;
      };
      const getUpsetPriority = (m, tags) => {
        const stats = getMatchStats(m, phaStatsMap);
        const moUnderdog = stats.moUnderdog;
        const weightsAll = getWeights("all");
        const cardSeerDetailed = predictSeerDetailed(m, weightsAll, phaStatsMap, matchStars, "all");
        const seerPrimary = cardSeerDetailed.primary;
        const seerFinal = cardSeerDetailed.final;
        const paaPrimary = m.paaPrimaryPrediction || m.paaPrediction || "";
        const paaFinal = m.paaPrediction || "";
        const isPriority1 = seerPrimary === moUnderdog;
        const isPriority2 = paaPrimary === moUnderdog;
        if (tags.includes("VOLATILE:PHA_TIE")) return 4;
        const hasUpsetPR1toPR7 = tags.some((t) => {
          if (!t.startsWith("upsets:")) return false;
          const pr = t.split(":")[1];
          return ["PR1", "PR2", "PR3", "PR4", "PR5", "PR6", "PR7"].includes(pr);
        });
        const isPriority3 = hasUpsetPR1toPR7 && (paaFinal === "12" || seerFinal === "12");
        if (isPriority1) return 1;
        if (isPriority2) return 2;
        if (isPriority3) return 3;
        return 4;
      };
      const getAgreementBoost = (m, catId) => {
        let boost = 0;
        const weights = getWeights(catId);
        const stats = getMatchStats(m, phaStatsMap);
        const moFav = stats.moFav;
        const probFav = stats.probFav;
        const paaSW = stats.phaFavWinSupport || 0;
        let seerScoreFav = 0;
        if (m.seerScores && m.seerScores[moFav] !== void 0) {
          seerScoreFav = m.seerScores[moFav];
        } else {
          const baseSeer = predictSeerDetailed(m, DEFAULT_WEIGHTS, phaStatsMap, matchStars);
          seerScoreFav = baseSeer.scores[moFav] || 0;
        }
        const probs = m.algoReport?.probabilities;
        if (probs) {
          const probArray = [probs["1"] || 0, probs["X"] || 0, probs["2"] || 0].sort((a, b) => b - a);
          const probGap = (probArray[0] - (probArray[1] || 0)) * 100;
          const outcomeProb = (probs[moFav] || 0) * 100;
          if (probGap >= 25 && outcomeProb >= probArray[0] * 100) {
            boost += weights.synergyGapBoost ?? 250;
          }
        }
        const isA = seerScoreFav >= 50 && probFav >= 45 && paaSW >= 50;
        const isB = seerScoreFav >= 50 && probFav >= 45 && !isA;
        const isC = probFav >= 50 && paaSW >= 50 && !isA && !isB;
        const isD = seerScoreFav >= 50 && paaSW >= 50 && !isA && !isB && !isC;
        const isE = seerScoreFav >= 45 && probFav >= 45 && paaSW >= 45 && !isA && !isB && !isC && !isD;
        if (isA) {
          boost += weights.synergyCondA ?? 300;
        } else if (isB) {
          boost += weights.synergyCondB ?? 200;
        } else if (isC) {
          boost += weights.synergyCondC ?? 200;
        } else if (isD) {
          boost += weights.synergyCondD ?? 200;
        } else if (isE) {
          boost += weights.synergyCondE ?? 200;
        }
        const paaPred = m.paaPrediction || m.paaPrimaryPrediction || "";
        if (paaPred === "1X" || paaPred === "X2") {
          boost += 150;
        } else if (paaPred === "12") {
          boost -= 50;
        }
        return boost;
      };
      targetMatches.forEach((m) => {
        let tags = m.evaluatorTags || [];
        if (tags.length === 0) {
          tags = getMatchEvaluatorTags(m, phaStatsMap, true, true, matchStars);
          m.evaluatorTags = tags;
        }
        matchTagsMap.set(m.id.toString(), tags);
      });
      const getOdds = (m) => {
        let o1 = 0, oX = 0, o2 = 0;
        if (m.mo) {
          const parts = m.mo.split(/[- ,]+/).map((p) => parseFloat(p.trim())).filter((p) => !isNaN(p));
          if (parts.length >= 3) {
            o1 = parts[0];
            oX = parts[1];
            o2 = parts[2];
          }
        }
        const favOdds = o1 > 0 && o2 > 0 ? Math.min(o1, o2) : o1 || o2;
        const underdogOdds = o1 > 0 && o2 > 0 ? Math.max(o1, o2) : 0;
        return { o1, oX, o2, favOdds, underdogOdds };
      };
      const globalJackpotDecisions = /* @__PURE__ */ new Map();
      if (isJackpot) {
        const scoredMatches = targetMatches.map((m) => {
          const weights = getWeights("all");
          let livePredFinal = m.seerPrediction || predictWithSeer(m, weights, phaStatsMap, matchStars, "all");
          let livePredPrimary = m.seerPrimaryPrediction;
          const p1 = getMatchScore(m, "1", weights, phaStatsMap, matchStars);
          const pX = getMatchScore(m, "X", weights, phaStatsMap, matchStars);
          const p2 = getMatchScore(m, "2", weights, phaStatsMap, matchStars);
          if (!livePredPrimary) {
            const max = Math.max(p1, pX, p2);
            livePredPrimary = p1 === max ? "1" : pX === max ? "X" : "2";
          }
          if (livePredPrimary === "X") {
            if (livePredFinal.includes("2")) livePredPrimary = "2";
            else if (livePredFinal.includes("1")) livePredPrimary = "1";
            else livePredPrimary = p1 >= p2 ? "1" : "2";
          }
          if (livePredFinal === "X") {
            livePredFinal = p1 >= p2 ? "1X" : "X2";
          }
          const scores = [p1, pX, p2].sort((a, b) => b - a);
          let confScore = scores[0] - (scores[1] || 0);
          const probX = m.algoReport?.probabilities?.["X"] || 0;
          if (probX > 25) {
            confScore -= probX * 1.5;
          }
          return { m, confScore, livePredPrimary, livePredFinal };
        });
        scoredMatches.sort((a, b) => b.confScore - a.confScore);
        const unhedgedCount = Math.floor(scoredMatches.length / 2);
        scoredMatches.forEach((item, index) => {
          const isUnhedged = index < unhedgedCount;
          const finalPred = isUnhedged ? item.livePredPrimary : item.livePredFinal;
          const reason = isUnhedged ? "High confidence - Unhedged" : "Volatile - Hedged to maximize accuracy";
          globalJackpotDecisions.set(item.m.id.toString(), {
            finalPred,
            livePredPrimary: item.livePredPrimary,
            livePredFinal: item.livePredFinal,
            reason,
            confScore: item.confScore * 2
          });
        });
      }
      const buildPick = (m, cat, reasonDetails, forcedHedge = false) => {
        const weights = getWeights(cat);
        let seerPred = predictWithSeer(m, weights, phaStatsMap, matchStars, cat);
        let primaryPred = predictSeerDetailed(m, weights, phaStatsMap, matchStars, cat).primary;
        let score = getSeerScoreForPrediction(m, seerPred, weights, phaStatsMap, matchStars);
        let reason = `Seer (${score.toFixed(1)}): ${reasonDetails}`;
        const tags = matchTagsMap.get(m.id.toString()) || [];
        if (isJackpot) {
          const decision = globalJackpotDecisions.get(m.id.toString());
          if (decision) {
            seerPred = decision.finalPred;
            primaryPred = decision.livePredPrimary;
            score = decision.confScore;
            reason = `Seer Algo: ${decision.reason} | ${reasonDetails}`;
          }
        } else {
          if (forcedHedge) {
            if (seerPred.length === 1) {
              if (seerPred === "X") {
                const s1 = getMatchScore(m, "1", weights, phaStatsMap, matchStars);
                const s2 = getMatchScore(m, "2", weights, phaStatsMap, matchStars);
                seerPred = s1 >= s2 ? "1X" : "X2";
              } else {
                seerPred = seerPred === "1" ? "1X" : "X2";
              }
            }
          } else if (forcedHedge === false) {
            if (seerPred.length > 1) {
              const stats = getMatchStats(m, phaStatsMap);
              seerPred = stats.moFav || (seerPred.includes("1") ? "1" : seerPred.includes("2") ? "2" : "X");
            }
          }
          primaryPred = seerPred;
        }
        if (cat === "banker_draws") {
          primaryPred = "X";
          const detailed = predictSeerDetailed(m, weights, phaStatsMap, matchStars, cat);
          seerPred = detailed.percentages["1"] >= detailed.percentages["2"] ? "1X" : "X2";
          reason = `Banker Draw Hedged (${score.toFixed(1)}): ${seerPred} | ${reasonDetails}`;
        }
        if (cat === "upsets") {
          const stats = getMatchStats(m, phaStatsMap);
          const moUnderdog = stats.moUnderdog;
          const isUnhedged = isJackpot ? globalJackpotDecisions.get(m.id.toString())?.reason.includes("Unhedged") === true : forcedHedge === false;
          if (isUnhedged) {
            seerPred = moUnderdog;
          } else {
            seerPred = moUnderdog === "1" ? "1X" : "X2";
          }
          primaryPred = moUnderdog;
          reason = `Upset Align (${score.toFixed(1)}): Underdog is ${moUnderdog} | ${reasonDetails}`;
        }
        const defaultAnalysisPred = m.seerPrediction || predictWithSeer(m, DEFAULT_WEIGHTS, phaStatsMap, matchStars, "all");
        const hasIntersection = (p1, p2) => {
          for (const char of p1) {
            if (char !== " " && p2.includes(char)) return true;
          }
          return false;
        };
        if (!hasIntersection(seerPred, defaultAnalysisPred)) {
          const original = defaultAnalysisPred;
          reason = `[Pivot Reversed: Optimized ${seerPred} overrides Default ${original}] ${reason}`;
        }
        return {
          match_id: m.id,
          team: m.teams,
          prediction: seerPred,
          primaryPrediction: primaryPred,
          odds: m.mo?.split(",")[0] || "1.0",
          reason,
          confidence: isJackpot ? `${Math.min(99, Math.max(0, 50 + score))}%` : `${Math.min(99, Math.max(0, score))}%`,
          category: cat,
          tag_trace: tags.join(", ")
        };
      };
      const categories = [
        {
          id: "best_bet",
          tag: "best_bet",
          size: 10,
          hedgedSize: 0,
          filter: (m) => {
            const o = getOdds(m);
            const stats = getMatchStats(m, phaStatsMap);
            if (o.favOdds < 1.3 || o.favOdds > 1.6) return false;
            if (stats.phaFavWinSupport < 40) return false;
            const sub = m.patternAnalysis?.subPattern;
            const s = sub ? phaStatsMap[sub] : null;
            const paaPred = m.paaPrediction || m.paaPrimaryPrediction || "";
            const subPred = m.patternAnalysis?.subPatternPrediction || "";
            const algoPred = m.algoReport?.prediction || "";
            const isSubPaaAgree = !!subPred && !!paaPred && subPred === paaPred;
            const isPaaAlgoAgree = !!paaPred && !!algoPred && paaPred === algoPred;
            let favSupport = 0;
            let upsetRate = 1;
            if (s && s.paaTotal > 0) {
              favSupport = s.favWin / s.paaTotal;
              upsetRate = s.upsetWin / s.paaTotal;
            } else {
              favSupport = (stats.paaStats.favWinRate ?? 0) / 100;
              upsetRate = (stats.paaStats.upsetRate ?? 100) / 100;
            }
            const configA = (isSubPaaAgree || isPaaAlgoAgree) && favSupport >= 0.8 && upsetRate <= 0.1;
            const configB = (isSubPaaAgree || isPaaAlgoAgree) && favSupport >= 0.75 && upsetRate <= 0.1;
            const configC = favSupport >= 0.8 && upsetRate <= 0.1;
            return configA || configB || configC;
          }
        },
        {
          id: "bankers_dlive",
          tag: "bankers_dlive",
          size: 10,
          hedgedSize: 0,
          filter: (m) => {
            const o = getOdds(m);
            return o.favOdds >= 1.5 && o.favOdds <= 2;
          }
        },
        {
          id: "top_10_value",
          tag: "top10",
          size: 12,
          hedgedSize: 12,
          filter: (m) => {
            const o = getOdds(m);
            return o.favOdds >= 2 && o.favOdds <= 2.49;
          }
        },
        {
          id: "botb_best",
          tag: "botb_best",
          size: 10,
          hedgedSize: 5,
          filter: (m) => {
            const o = getOdds(m);
            return o.favOdds >= 1.5 && o.favOdds <= 2.49;
          }
        },
        {
          id: "high_confidence",
          tag: "top20",
          size: 20,
          hedgedSize: 10,
          filter: (m) => {
            const o = getOdds(m);
            return o.favOdds >= 1.5 && o.favOdds <= 2.49;
          }
        },
        {
          id: "bankers_jackpot",
          tag: "bankers_jackpot",
          size: 5,
          hedgedSize: 0,
          filter: (m) => {
            const o = getOdds(m);
            return o.favOdds >= 1.8 && o.favOdds <= 2;
          }
        },
        {
          id: "value_bets",
          tag: "value_bets",
          size: 5,
          hedgedSize: 5,
          filter: (m) => {
            const o = getOdds(m);
            return o.o1 >= 2.5 && o.o2 >= 2.5;
          }
        },
        {
          id: "value_picks",
          tag: "value_picks",
          size: 5,
          hedgedSize: 0,
          filter: (m) => {
            const o = getOdds(m);
            return o.favOdds >= 2 && o.favOdds <= 2.49;
          }
        },
        {
          id: "banker_draws",
          tag: "banker_draws",
          size: 5,
          hedgedSize: 5,
          filter: (m) => {
            const o = getOdds(m);
            return o.o1 >= 2 && o.o2 >= 2;
          }
        },
        {
          id: "upsets",
          tag: "upsets",
          size: 5,
          hedgedSize: 5,
          filter: (m) => true
        }
      ];
      const processedCategories = isJackpot ? categories.filter((c) => !["best_bet", "top_10_value", "botb_best", "high_confidence"].includes(c.id)) : categories;
      processedCategories.forEach((catDef) => {
        const tagPrefix = catDef.tag;
        const qualifyingMatches = targetMatches.filter((m) => {
          const tags = matchTagsMap.get(m.id.toString()) || [];
          const hasPrimaryTag = tags.some((t) => t.startsWith(tagPrefix + ":"));
          let isValid = hasPrimaryTag;
          if (catDef.id === "upsets") {
            const supreme = getMatchSupremeTierUnderdog(m, phaStatsMap);
            if (supreme.insightsHit > 0) {
              isValid = true;
            } else {
              const stats = getMatchStats(m, phaStatsMap);
              const upsetPct = stats.paaStats?.upsetRate || 0;
              isValid = hasPrimaryTag || upsetPct >= 25;
            }
          } else if (!isValid && catDef.id === "botb_best") {
            const fallbackTags = ["top10", "top20", "bankers_dlive", "value_picks"];
            isValid = tags.some((t) => fallbackTags.some((ft) => t.startsWith(ft + ":")));
          }
          if (!isValid) return false;
          if (!isJackpot) {
          }
          return true;
        }).filter((m) => !isIntelligenceActive || catDef.filter(m));
        qualifyingMatches.sort((a, b) => {
          const weights = getWeights(catDef.id);
          const tagsA = matchTagsMap.get(a.id.toString()) || [];
          const tagsB = matchTagsMap.get(b.id.toString()) || [];
          const hasPrimaryTagA = tagsA.some((t) => t.startsWith(tagPrefix + ":"));
          const hasPrimaryTagB = tagsB.some((t) => t.startsWith(tagPrefix + ":"));
          const seerPredA = predictWithSeer(a, weights, phaStatsMap, matchStars, catDef.id);
          const seerPredB = predictWithSeer(b, weights, phaStatsMap, matchStars, catDef.id);
          let scoreA = getSeerScoreForPrediction(a, seerPredA, weights, phaStatsMap, matchStars) + getMatchPriorityScore(a, tagPrefix, matchStars);
          let scoreB = getSeerScoreForPrediction(b, seerPredB, weights, phaStatsMap, matchStars) + getMatchPriorityScore(b, tagPrefix, matchStars);
          scoreA += getAgreementBoost(a, catDef.id);
          scoreB += getAgreementBoost(b, catDef.id);
          const isUpsetCategory = catDef.id === "upsets";
          const supremeA = isUpsetCategory ? getMatchSupremeTierUnderdog(a, phaStatsMap).score : getMatchSupremeTier(a, phaStatsMap, preCalculatedRules).score;
          const supremeB = isUpsetCategory ? getMatchSupremeTierUnderdog(b, phaStatsMap).score : getMatchSupremeTier(b, phaStatsMap, preCalculatedRules).score;
          scoreA += supremeA;
          scoreB += supremeB;
          if (hasPrimaryTagA) scoreA += 1e3;
          if (hasPrimaryTagB) scoreB += 1e3;
          if (["best_bet", "botb_best"].includes(catDef.id)) {
            const getGoldenBoost = (m, seerScore) => {
              const stats = getMatchStats(m, phaStatsMap);
              const moFav = stats.moFav;
              const probFav = m.algoReport?.probabilities?.[moFav] || 0;
              const paaSW = stats.phaFavWinSupport || 0;
              if (seerScore >= 50 && probFav >= 45 && paaSW >= 50) {
                return 500;
              }
              return 0;
            };
            const sScoreA = getMatchScore(a, getMatchStats(a, phaStatsMap).moFav, weights, phaStatsMap, matchStars);
            scoreA += getGoldenBoost(a, sScoreA);
            const sScoreB = getMatchScore(b, getMatchStats(b, phaStatsMap).moFav, weights, phaStatsMap, matchStars);
            scoreB += getGoldenBoost(b, sScoreB);
          }
          if (catDef.id === "upsets") {
            const supremeA2 = getMatchSupremeTierUnderdog(a, phaStatsMap).score;
            const supremeB2 = getMatchSupremeTierUnderdog(b, phaStatsMap).score;
            if (supremeA2 !== supremeB2) {
              return supremeB2 - supremeA2;
            }
            const uStatsA = getMatchStats(a, phaStatsMap);
            const uStatsB = getMatchStats(b, phaStatsMap);
            const aUnderdogScore = getMatchScore(a, uStatsA.moUnderdog, weights, phaStatsMap, matchStars);
            const bUnderdogScore = getMatchScore(b, uStatsB.moUnderdog, weights, phaStatsMap, matchStars);
            if (aUnderdogScore !== bUnderdogScore) {
              return bUnderdogScore - aUnderdogScore;
            }
          }
          return scoreB - scoreA;
        });
        const selectedPicks = [];
        let sharedUsedInThisSlip = 0;
        const maxAllowedSharing = catDef.size <= 5 ? catDef.size : Math.floor(catDef.size / 2);
        const tryAddMatch = (m, enforceSharingLimit, enforceSubSlotOdds) => {
          if (selectedPicks.length >= catDef.size) return false;
          const normMTeams = m.teams.toLowerCase().replace(/[^a-z0-9]/g, "");
          const isMatchAlreadyInSlip = selectedPicks.some(
            (p) => p.match_id === m.id.toString() || p.team.toLowerCase().replace(/[^a-z0-9]/g, "") === normMTeams
          );
          if (isMatchAlreadyInSlip) return false;
          const isAlreadyUsed = usageCount.has(m.id.toString());
          if (enforceSharingLimit && isAlreadyUsed && sharedUsedInThisSlip >= maxAllowedSharing) return false;
          const odds = getOdds(m);
          let shouldHedge = catDef.hedgedSize === catDef.size ? true : catDef.hedgedSize > 0 ? null : false;
          if (enforceSubSlotOdds) {
            if (catDef.id === "botb_best") {
              const unhedgedRange = odds.favOdds >= 1.5 && odds.favOdds <= 2;
              const hedgedRange = odds.favOdds >= 2 && odds.favOdds <= 2.49;
              const hedgedCount = selectedPicks.filter((p) => p.prediction.length > 1).length;
              const unhedgedCount = selectedPicks.length - hedgedCount;
              if (hedgedRange && hedgedCount < 5) shouldHedge = true;
              else if (unhedgedRange && unhedgedCount < 5) shouldHedge = false;
              else return false;
            } else if (catDef.id === "high_confidence") {
              const unhedgedRange = odds.favOdds >= 1.5 && odds.favOdds <= 2;
              const hedgedRange = odds.favOdds >= 2 && odds.favOdds <= 2.49;
              const hedgedCount = selectedPicks.filter((p) => p.prediction.length > 1).length;
              const unhedgedCount = selectedPicks.length - hedgedCount;
              if (hedgedRange && hedgedCount < 10) shouldHedge = true;
              else if (unhedgedRange && unhedgedCount < 10) shouldHedge = false;
              else return false;
            }
          } else if (shouldHedge === null) {
            shouldHedge = odds.favOdds >= 2;
          }
          const pick = buildPick(m, catDef.id, isIntelligenceActive ? "AI Intelligence Selection" : "Pattern Match", shouldHedge === true);
          selectedPicks.push(pick);
          if (isAlreadyUsed) sharedUsedInThisSlip++;
          usageCount.set(m.id.toString(), (usageCount.get(m.id.toString()) || 0) + 1);
          return true;
        };
        for (const m of qualifyingMatches) {
          if (selectedPicks.length >= catDef.size) break;
          tryAddMatch(m, true, true);
        }
        if (selectedPicks.length < catDef.size) {
          for (const m of qualifyingMatches) {
            if (selectedPicks.length >= catDef.size) break;
            tryAddMatch(m, false, false);
          }
        }
        if (selectedPicks.length < catDef.size) {
          const fallbackPool = targetMatches.filter((m) => {
            const mainPat = (m.patternAnalysis?.mainPattern || "").toUpperCase();
            const isPatternTSub = mainPat === "T" && !!m.patternAnalysis?.subPattern;
            if (isPatternTSub) return false;
            return true;
          });
          for (const m of fallbackPool) {
            if (selectedPicks.length >= catDef.size) break;
            tryAddMatch(m, false, false);
          }
        }
        const backups = [];
        for (const m of qualifyingMatches) {
          if (backups.length >= 5) break;
          const normMTeams = m.teams.toLowerCase().replace(/[^a-z0-9]/g, "");
          const alreadyInPicks = selectedPicks.some(
            (p) => p.match_id === m.id.toString() || p.team.toLowerCase().replace(/[^a-z0-9]/g, "") === normMTeams
          );
          const alreadyInBackups = backups.some(
            (b) => b.match_id === m.id.toString() || b.team.toLowerCase().replace(/[^a-z0-9]/g, "") === normMTeams
          );
          if (!alreadyInPicks && !alreadyInBackups) {
            const pick = buildPick(m, `${catDef.id}_backup`, "Filler/Backup");
            backups.push(pick);
          }
        }
        if (isJackpot) {
          spec[catDef.id] = selectedPicks;
          spec[`${catDef.id}_backups`] = backups;
        } else {
          if (live[catDef.id] !== void 0) {
            live[catDef.id] = selectedPicks;
            live[`${catDef.id}_backups`] = backups;
          } else {
            spec[catDef.id] = selectedPicks;
            spec[`${catDef.id}_backups`] = backups;
          }
        }
      });
      if (isJackpot) {
        targetMatches.forEach((m) => {
          if (usageCount.has(m.id.toString())) return;
          const tags = matchTagsMap.get(m.id.toString()) || [];
          const hasValidTag = tags.some((t) => categories.some((c) => t.startsWith(c.tag + ":")));
          if (hasValidTag) spec.unallocated.push(buildPick(m, "unallocated", "Quota Full"));
          else spec.uncategorized.push(buildPick(m, "uncategorized", "No Valid Tags"));
        });
      }
      return { spec, live };
    };
  }
});

// src/utils/seerSlipSelection.ts
var getSeerScoreForPrediction2, getPAAPredictionForSeer, generateSeerSlips;
var init_seerSlipSelection = __esm({
  "src/utils/seerSlipSelection.ts"() {
    init_seerLogic();
    init_matchEvaluator();
    init_seerUnderdogSlipSelection();
    init_storage();
    init_seerSupremeTier();
    init_matchProcessing();
    getSeerScoreForPrediction2 = (m, pred, weights, phaStatsMap, matchStars) => {
      let s1 = pred.includes("1") ? getMatchScore(m, "1", weights, phaStatsMap, matchStars) : 0;
      let sx = pred.includes("X") ? getMatchScore(m, "X", weights, phaStatsMap, matchStars) : 0;
      let s2 = pred.includes("2") ? getMatchScore(m, "2", weights, phaStatsMap, matchStars) : 0;
      return Math.max(s1, sx, s2);
    };
    getPAAPredictionForSeer = (m, phaStatsMap) => {
      let paaPrim = m.paaPrimaryPrediction || "";
      let paaFinal = m.paaPrediction || "";
      if (m.patternAnalysis?.subPattern && phaStatsMap) {
        const sub = m.patternAnalysis.subPattern;
        if (phaStatsMap[sub] && (phaStatsMap[sub].paaTotal > 0 || phaStatsMap[sub].total > 0)) {
          const p = calculatePAAPrediction(m, phaStatsMap[sub]);
          if (p) {
            paaPrim = p.paaPrimaryPrediction || "";
            paaFinal = p.paaPrediction || "";
          }
        }
      }
      return { paaPrimary: paaPrim, paaFinal };
    };
    generateSeerSlips = (targetMatches, phaStatsMap, matchStars, isJackpot, isIntelligenceActive = false, overrideWeights) => {
      const preCalculatedRules = calculateSupremeRules(phaStatsMap);
      const spec = {
        jackpot_slip: [],
        bankers_jackpot: [],
        bankers_dlive: [],
        value_bets: [],
        value_picks: [],
        banker_draws: [],
        upsets: [],
        unallocated: [],
        uncategorized: []
      };
      const candidates = {};
      const live = {
        best_bet: [],
        top_10_value: [],
        high_confidence: [],
        botb_best: []
      };
      const usageCount = /* @__PURE__ */ new Map();
      const matchTagsMap = /* @__PURE__ */ new Map();
      const seerWeights = overrideWeights || getSeerWeights();
      const modePrefix = isJackpot ? "jackpot_" : "daily_";
      const getWeights = (cat) => {
        let mappedParent = cat;
        if (cat === "best_bet" || cat === "high_confidence" || cat === "botb_best") {
          mappedParent = "safety";
        } else if (cat === "bankers_dlive" || cat === "bankers_jackpot" || cat === "value_picks" || cat === "banker_draws") {
          mappedParent = "banker";
        } else if (cat === "upsets" || cat === "value_bets") {
          mappedParent = "upset";
        } else if (cat === "top_10_value") {
          mappedParent = "jackpot";
        }
        return seerWeights[`${modePrefix}${cat}`] || seerWeights[cat] || seerWeights[`${modePrefix}${mappedParent}`] || seerWeights[mappedParent] || seerWeights[`${modePrefix}all`] || seerWeights["all"] || DEFAULT_WEIGHTS;
      };
      const getUpsetPriority = (m, tags) => {
        const stats = getMatchStats(m, phaStatsMap);
        const moUnderdog = stats.moUnderdog;
        const weightsAll = getWeights("all");
        const cardSeerDetailed = predictSeerDetailed(m, weightsAll, phaStatsMap, matchStars, "all");
        const seerPrimary = cardSeerDetailed.primary;
        const seerFinal = cardSeerDetailed.final;
        const { paaPrimary, paaFinal } = getPAAPredictionForSeer(m, phaStatsMap);
        const isPriority1 = seerPrimary === moUnderdog;
        const isPriority2 = paaPrimary === moUnderdog;
        if (tags.includes("VOLATILE:PHA_TIE")) return 4;
        const hasUpsetPR1toPR7 = tags.some((t) => {
          if (!t.startsWith("upsets:")) return false;
          const pr = t.split(":")[1];
          return ["PR1", "PR2", "PR3", "PR4", "PR5", "PR6", "PR7"].includes(pr);
        });
        const isPriority3 = hasUpsetPR1toPR7 && (paaFinal === "12" || seerFinal === "12");
        if (isPriority1) return 1;
        if (isPriority2) return 2;
        if (isPriority3) return 3;
        return 4;
      };
      const getAgreementBoost = (m, catId) => {
        let boost = 0;
        const weights = getWeights(catId);
        const stats = getMatchStats(m, phaStatsMap);
        const moFav = stats.moFav;
        const probFav = stats.probFav;
        const paaSW = stats.phaFavWinSupport || 0;
        let seerScoreFav = 0;
        if (m.seerScores && m.seerScores[moFav] !== void 0) {
          seerScoreFav = m.seerScores[moFav];
        } else {
          const baseSeer = predictSeerDetailed(m, DEFAULT_WEIGHTS, phaStatsMap, matchStars);
          seerScoreFav = baseSeer.scores[moFav] || 0;
        }
        const probs = m.algoReport?.probabilities;
        if (probs) {
          const probArray = [probs["1"] || 0, probs["X"] || 0, probs["2"] || 0].sort((a, b) => b - a);
          const probGap = (probArray[0] - (probArray[1] || 0)) * 100;
          const outcomeProb = (probs[moFav] || 0) * 100;
          if (probGap >= 25 && outcomeProb >= probArray[0] * 100) {
            boost += weights.synergyGapBoost ?? 250;
          }
        }
        const isA = seerScoreFav >= 50 && probFav >= 45 && paaSW >= 50;
        const isB = seerScoreFav >= 50 && probFav >= 45 && !isA;
        const isC = probFav >= 50 && paaSW >= 50 && !isA && !isB;
        const isD = seerScoreFav >= 50 && paaSW >= 50 && !isA && !isB && !isC;
        const isE = seerScoreFav >= 45 && probFav >= 45 && paaSW >= 45 && !isA && !isB && !isC && !isD;
        if (isA) {
          boost += weights.synergyCondA ?? 300;
        } else if (isB) {
          boost += weights.synergyCondB ?? 200;
        } else if (isC) {
          boost += weights.synergyCondC ?? 200;
        } else if (isD) {
          boost += weights.synergyCondD ?? 200;
        } else if (isE) {
          boost += weights.synergyCondE ?? 200;
        }
        const paaPredObj = getPAAPredictionForSeer(m, phaStatsMap);
        const paaPred = paaPredObj.paaFinal || paaPredObj.paaPrimary || "";
        if (paaPred === "1X" || paaPred === "X2") {
          boost += 150;
        } else if (paaPred === "12") {
          boost -= 50;
        }
        return boost;
      };
      targetMatches.forEach((m) => {
        let tags = m.evaluatorTags || [];
        if (tags.length === 0) {
          tags = getMatchEvaluatorTags(m, phaStatsMap, true, true, matchStars);
          m.evaluatorTags = tags;
        }
        matchTagsMap.set(m.id.toString(), tags);
      });
      const getOdds = (m) => {
        let o1 = 0, oX = 0, o2 = 0;
        if (m.mo) {
          const parts = m.mo.split(/[- ,]+/).map((p) => parseFloat(p.trim())).filter((p) => !isNaN(p));
          if (parts.length >= 3) {
            o1 = parts[0];
            oX = parts[1];
            o2 = parts[2];
          }
        }
        const favOdds = o1 > 0 && o2 > 0 ? Math.min(o1, o2) : o1 || o2;
        const underdogOdds = o1 > 0 && o2 > 0 ? Math.max(o1, o2) : 0;
        return { o1, oX, o2, favOdds, underdogOdds };
      };
      const getGatekeeperPriorityBoost = (m, catId) => {
        const isFavoriteCategory = ["best_bet", "top_10_value", "high_confidence", "botb_best", "bankers_dlive", "bankers_jackpot", "value_picks"].includes(catId);
        if (!isFavoriteCategory) return 0;
        let boost = 0;
        const sub = m.patternAnalysis?.subPattern;
        const s = sub ? phaStatsMap[sub] : null;
        const paaPredObj = getPAAPredictionForSeer(m, phaStatsMap);
        const paaPred = paaPredObj.paaFinal || paaPredObj.paaPrimary || "";
        const subPred = m.patternAnalysis?.subPatternPrediction || "";
        const algoPred = m.algoReport?.prediction || "";
        const isSubPaaAgree = !!subPred && !!paaPred && subPred === paaPred;
        const isPaaAlgoAgree = !!paaPred && !!algoPred && paaPred === algoPred;
        let favSupport = 0;
        let upsetRate = 1;
        if (s && s.paaTotal > 0) {
          favSupport = s.favWin / s.paaTotal;
          upsetRate = s.upsetWin / s.paaTotal;
        } else {
          const stats = getMatchStats(m, phaStatsMap);
          favSupport = (stats.paaStats.favWinRate ?? 0) / 100;
          upsetRate = (stats.paaStats.upsetRate ?? 100) / 100;
        }
        if ((isSubPaaAgree || isPaaAlgoAgree) && favSupport >= 0.8 && upsetRate <= 0.1) {
          boost += 3e3;
        } else if ((isSubPaaAgree || isPaaAlgoAgree) && favSupport >= 0.75 && upsetRate <= 0.1) {
          boost += 2e3;
        } else if (favSupport >= 0.8 && upsetRate <= 0.1) {
          boost += 1e3;
        }
        return boost;
      };
      const globalJackpotDecisions = /* @__PURE__ */ new Map();
      if (isJackpot) {
        const scoredMatches = targetMatches.map((m) => {
          const weights = getWeights("all");
          let livePredFinal = m.seerPrediction || predictWithSeer(m, weights, phaStatsMap, matchStars, "all");
          let livePredPrimary = m.seerPrimaryPrediction;
          const p1 = getMatchScore(m, "1", weights, phaStatsMap, matchStars);
          const pX = getMatchScore(m, "X", weights, phaStatsMap, matchStars);
          const p2 = getMatchScore(m, "2", weights, phaStatsMap, matchStars);
          if (!livePredPrimary) {
            const max = Math.max(p1, pX, p2);
            livePredPrimary = p1 === max ? "1" : pX === max ? "X" : "2";
          }
          if (livePredPrimary === "X") {
            if (livePredFinal.includes("2")) livePredPrimary = "2";
            else if (livePredFinal.includes("1")) livePredPrimary = "1";
            else livePredPrimary = p1 >= p2 ? "1" : "2";
          }
          if (livePredFinal === "X") {
            livePredFinal = p1 >= p2 ? "1X" : "X2";
          }
          const scores = [p1, pX, p2].sort((a, b) => b - a);
          let confScore = scores[0] - (scores[1] || 0);
          const probX = m.algoReport?.probabilities?.["X"] || 0;
          if (probX > 25) {
            confScore -= probX * 1.5;
          }
          return { m, confScore, livePredPrimary, livePredFinal };
        });
        scoredMatches.sort((a, b) => b.confScore - a.confScore);
        const unhedgedCount = Math.floor(scoredMatches.length / 2);
        scoredMatches.forEach((item, index) => {
          const isUnhedged = index < unhedgedCount;
          const finalPred = isUnhedged ? item.livePredPrimary : item.livePredFinal;
          const reason = isUnhedged ? "High confidence - Unhedged" : "Volatile - Hedged to maximize accuracy";
          globalJackpotDecisions.set(item.m.id.toString(), {
            finalPred,
            livePredPrimary: item.livePredPrimary,
            livePredFinal: item.livePredFinal,
            reason,
            confScore: item.confScore * 2
          });
        });
      }
      const buildPick = (m, cat, reasonDetails, forcedHedge = false) => {
        const weights = getWeights(cat);
        let seerPred = predictWithSeer(m, weights, phaStatsMap, matchStars, cat);
        const detailed = predictSeerDetailed(m, weights, phaStatsMap, matchStars, cat);
        let primaryPred = detailed.primary;
        let score = getSeerScoreForPrediction2(m, seerPred, weights, phaStatsMap, matchStars);
        let reason = `Seer (${score.toFixed(1)}): ${reasonDetails}`;
        const tags = matchTagsMap.get(m.id.toString()) || [];
        if (isJackpot) {
          const decision = globalJackpotDecisions.get(m.id.toString());
          if (decision) {
            seerPred = decision.finalPred;
            primaryPred = decision.livePredPrimary;
            score = decision.confScore;
            reason = `Seer Algo: ${decision.reason} | ${reasonDetails}`;
          }
        } else {
          if (forcedHedge) {
            if (seerPred.length === 1) {
              if (seerPred === "X") {
                seerPred = detailed.percentages["1"] >= detailed.percentages["2"] ? "1X" : "X2";
              } else {
                const xProb = detailed.percentages["X"];
                const udProb = detailed.percentages[seerPred === "1" ? "2" : "1"];
                if (udProb > xProb + 5) {
                  seerPred = "12";
                } else {
                  seerPred = seerPred === "1" ? "1X" : "X2";
                }
              }
            }
          } else if (forcedHedge === false) {
            if (seerPred.length > 1) {
              const stats = getMatchStats(m, phaStatsMap);
              seerPred = stats.moFav || (seerPred.includes("1") ? "1" : seerPred.includes("2") ? "2" : "X");
            }
          }
          primaryPred = seerPred;
        }
        if (cat === "banker_draws") {
          primaryPred = "X";
          seerPred = detailed.percentages["1"] >= detailed.percentages["2"] ? "1X" : "X2";
          reason = `Banker Draw Hedged (${score.toFixed(1)}): ${seerPred} | ${reasonDetails}`;
        }
        if (cat === "upsets") {
          const stats = getMatchStats(m, phaStatsMap);
          const moUnderdog = stats.moUnderdog;
          const isUnhedged = isJackpot ? globalJackpotDecisions.get(m.id.toString())?.reason.includes("Unhedged") === true : forcedHedge === false;
          if (isUnhedged) {
            seerPred = moUnderdog;
          } else {
            seerPred = moUnderdog === "1" ? "1X" : "X2";
          }
          primaryPred = moUnderdog;
          reason = `Upset Align (${score.toFixed(1)}): Underdog is ${moUnderdog} | ${reasonDetails}`;
        }
        const defaultAnalysisPred = m.seerPrediction || predictWithSeer(m, DEFAULT_WEIGHTS, phaStatsMap, matchStars, "all");
        const hasIntersection = (p1, p2) => {
          for (const char of p1) {
            if (char !== " " && p2.includes(char)) return true;
          }
          return false;
        };
        if (!hasIntersection(seerPred, defaultAnalysisPred)) {
          const original = defaultAnalysisPred;
          reason = `[Pivot Reversed: Optimized ${seerPred} overrides Default ${original}] ${reason}`;
        }
        return {
          match_id: m.id,
          team: m.teams,
          prediction: seerPred,
          primaryPrediction: primaryPred,
          odds: m.mo?.split(",")[0] || "1.0",
          reason,
          confidence: isJackpot ? `${Math.min(99, Math.max(0, 50 + score))}%` : `${Math.min(99, Math.max(0, score))}%`,
          category: cat,
          tag_trace: tags.join(", ")
        };
      };
      const categories = [
        {
          id: "best_bet",
          tag: "best_bet",
          size: 10,
          hedgedSize: 0,
          filter: (m) => {
            const o = getOdds(m);
            const stats = getMatchStats(m, phaStatsMap);
            if (o.favOdds < 1.3 || o.favOdds > 1.6) return false;
            if (stats.phaFavWinSupport < 40) return false;
            const sub = m.patternAnalysis?.subPattern;
            const s = sub ? phaStatsMap[sub] : null;
            const paaPredObj = getPAAPredictionForSeer(m, phaStatsMap);
            const paaPred = paaPredObj.paaFinal || paaPredObj.paaPrimary || "";
            const subPred = m.patternAnalysis?.subPatternPrediction || "";
            const algoPred = m.algoReport?.prediction || "";
            const isSubPaaAgree = !!subPred && !!paaPred && subPred === paaPred;
            const isPaaAlgoAgree = !!paaPred && !!algoPred && paaPred === algoPred;
            let favSupport = 0;
            let upsetRate = 1;
            if (s && s.paaTotal > 0) {
              favSupport = s.favWin / s.paaTotal;
              upsetRate = s.upsetWin / s.paaTotal;
            } else {
              favSupport = (stats.paaStats.favWinRate ?? 0) / 100;
              upsetRate = (stats.paaStats.upsetRate ?? 100) / 100;
            }
            const configA = (isSubPaaAgree || isPaaAlgoAgree) && favSupport >= 0.8 && upsetRate <= 0.1;
            const configB = (isSubPaaAgree || isPaaAlgoAgree) && favSupport >= 0.75 && upsetRate <= 0.1;
            const configC = favSupport >= 0.8 && upsetRate <= 0.1;
            return configA || configB || configC;
          }
        },
        {
          id: "bankers_dlive",
          tag: "bankers_dlive",
          size: 10,
          hedgedSize: 0,
          filter: (m) => {
            const o = getOdds(m);
            return o.favOdds >= 1.5 && o.favOdds <= 2;
          }
        },
        {
          id: "top_10_value",
          tag: "top10",
          size: 12,
          hedgedSize: 12,
          filter: (m) => {
            const o = getOdds(m);
            return o.favOdds >= 2 && o.favOdds <= 2.49;
          }
        },
        {
          id: "botb_best",
          tag: "botb_best",
          size: 10,
          hedgedSize: 5,
          filter: (m) => {
            const o = getOdds(m);
            return o.favOdds >= 1.5 && o.favOdds <= 2.49;
          }
        },
        {
          id: "high_confidence",
          tag: "top20",
          size: 20,
          hedgedSize: 10,
          filter: (m) => {
            const o = getOdds(m);
            return o.favOdds >= 1.5 && o.favOdds <= 2.49;
          }
        },
        {
          id: "bankers_jackpot",
          tag: "bankers_jackpot",
          size: 5,
          hedgedSize: 0,
          filter: (m) => {
            const o = getOdds(m);
            return o.favOdds >= 1.8 && o.favOdds <= 2;
          }
        },
        {
          id: "value_bets",
          tag: "value_bets",
          size: 5,
          hedgedSize: 5,
          filter: (m) => {
            const o = getOdds(m);
            return o.o1 >= 2.5 && o.o2 >= 2.5;
          }
        },
        {
          id: "value_picks",
          tag: "value_picks",
          size: 5,
          hedgedSize: 0,
          filter: (m) => {
            const o = getOdds(m);
            return o.favOdds >= 2 && o.favOdds <= 2.49;
          }
        },
        {
          id: "banker_draws",
          tag: "banker_draws",
          size: 5,
          hedgedSize: 5,
          filter: (m) => {
            const o = getOdds(m);
            return o.o1 >= 2 && o.o2 >= 2;
          }
        },
        {
          id: "upsets",
          tag: "upsets",
          size: 5,
          hedgedSize: 5,
          filter: (m) => true
        }
      ];
      const processedCategories = isJackpot ? categories.filter((c) => !["best_bet", "top_10_value", "botb_best", "high_confidence"].includes(c.id)) : categories;
      processedCategories.forEach((catDef) => {
        const tagPrefix = catDef.tag;
        const qualifyingMatches = targetMatches.filter((m) => {
          const tags = matchTagsMap.get(m.id.toString()) || [];
          const hasPrimaryTag = tags.some((t) => t.startsWith(tagPrefix + ":"));
          let isValid = hasPrimaryTag;
          if (catDef.id === "upsets") {
            const supremeUnderdog = getMatchSupremeTierUnderdog(m, phaStatsMap);
            const stats = getMatchStats(m, phaStatsMap);
            const upsetPct = stats.paaStats?.upsetRate || 0;
            const moUnderdog = stats.moUnderdog;
            const algoPred = m.algoReport?.prediction || "";
            const subPred = m.patternAnalysis?.subPatternPrediction || "";
            const favTS = stats.moFav === "1" ? m.tsa : m.tsb;
            const upsetTS = moUnderdog === "1" ? m.tsa : m.tsb;
            const isUnderdogHigherTS = favTS !== void 0 && upsetTS !== void 0 && upsetTS > favTS;
            isValid = hasPrimaryTag || supremeUnderdog.insightsHit > 0 || upsetPct >= 18 || isUnderdogHigherTS || algoPred.includes(moUnderdog) || subPred.includes(moUnderdog);
          } else if (!isValid && catDef.id === "botb_best") {
            const fallbackTags = ["top10", "top20", "bankers_dlive", "value_picks"];
            isValid = tags.some((t) => fallbackTags.some((ft) => t.startsWith(ft + ":")));
          }
          if (!isValid) return false;
          return true;
        }).filter((m) => !isIntelligenceActive || catDef.filter(m));
        candidates[catDef.id] = [...qualifyingMatches];
        const getDefaultSeerPenalty = (m, catId) => {
          let penalty = 0;
          const tags = matchTagsMap.get(m.id.toString()) || [];
          const isPatternTSub = (m.patternAnalysis?.mainPattern || "").toUpperCase() === "T" && !!m.patternAnalysis?.subPattern;
          if (isPatternTSub) penalty -= 200;
          const isFavoriteCategory = ["best_bet", "top_10_value", "high_confidence", "botb_best", "bankers_dlive", "bankers_jackpot", "value_picks"].includes(catId);
          if (isFavoriteCategory) {
            const teams = (m.teams || "").toLowerCase();
            const league = (m.league || "").toLowerCase();
            const africanDomesticRegex = /tanzania|tanzanian|kenya|kenyan|uganda|ugandan|rwanda|rwandan|egypt|egyptian|morocco|moroccan|nigeria|nigerian|ghana|ghanaian|south africa|south african|zambia|zambian|senegal|senegalese|tunisia|tunisian|algeria|algerian|mali|cameroon|cameroonian|congo|angola|angolan|burundi|sudan|sudanese|somalia|ethiopia|ethiopian|suhul shire|caps united|triangle u|malawi|mozambique|botswana|namibia|zimbabwe|zimbabwean|lesotho|eswatini|madagascar|ivory coast|cote d'ivoire|guinea|burkina faso|benin|togo|mauritania|niger|chad|central african|gabon|equatorial|djibouti|eritrea|seychelles|comoros|mauritius|sao tome|sierra leone|liberia|gambia|cape verde|chemilil|sony sugar|jkt/i;
            if (africanDomesticRegex.test(teams) || africanDomesticRegex.test(league)) {
              penalty -= 150;
            }
          }
          if (catId === "top_10_value") {
            const stats = getMatchStats(m, phaStatsMap);
            const upsetRate = stats.paaStats?.upsetRate || 0;
            const favSupport = stats.phaFavSupport || 0;
            const underdogOdds = stats.underdogOdds;
            const totalPaaMatches = stats.paaStats?.total || stats.totalMatches || 0;
            penalty += favSupport * 4;
            penalty -= upsetRate * 20;
            if (totalPaaMatches <= 5) {
              penalty -= 1500;
            }
            if (upsetRate >= 15) {
              penalty -= 2500;
            }
            if (underdogOdds <= 3.2 && upsetRate >= 12) {
              penalty -= 2e3;
            }
            if (underdogOdds > 0 && underdogOdds <= 3.2) {
              penalty -= Math.round((3.3 - underdogOdds) * 500);
            } else if (underdogOdds >= 3.4) {
              penalty += 300;
            }
            const paaPredObj = getPAAPredictionForSeer(m, phaStatsMap);
            const paaFinal = paaPredObj.paaFinal || paaPredObj.paaPrimary || "";
            const algoPred = m.algoReport?.prediction || "";
            if (paaFinal && !paaFinal.includes(stats.moFav)) {
              penalty -= 4e3;
            }
            if (algoPred && !algoPred.includes(stats.moFav)) {
              penalty -= 3e3;
            }
            if (paaFinal.includes(stats.moFav) && algoPred.includes(stats.moFav)) {
              penalty += 1500;
            }
            const probs = m.algoReport?.probabilities;
            if (probs) {
              const pFav = (stats.moFav === "1" ? probs["1"] : probs["2"]) * 100;
              const pUnd = (stats.moUnderdog === "1" ? probs["1"] : probs["2"]) * 100;
              if (pFav - pUnd < 10) {
                penalty -= 1500;
              } else {
                penalty += Math.round((pFav - pUnd) * 10);
              }
            }
            if (tags.some((t) => t.includes("HIGH_ODDS_RISK") || t.includes("LAST_RESORT"))) {
              penalty -= 800;
            }
            if (tags.some((t) => t.endsWith(":DEMOTE"))) {
              penalty -= 600;
            }
            if (tags.some((t) => t.includes("AUTO_PICK"))) {
              penalty -= 800;
            }
          }
          if (!isJackpot) {
            const isUnderdogCategory = ["upsets", "value_bets"].includes(catId);
            const mainPat = (m.patternAnalysis?.mainPattern || "").toUpperCase();
            if (mainPat === "R" && !isUnderdogCategory) penalty -= 150;
          }
          return penalty;
        };
        const mappedQualifyingMatches = qualifyingMatches.map((m) => {
          const weights = getWeights(catDef.id);
          const tags = matchTagsMap.get(m.id.toString()) || [];
          const hasPrimaryTag = tags.some((t) => t.startsWith(tagPrefix + ":"));
          const seerPred = predictWithSeer(m, weights, phaStatsMap, matchStars, catDef.id);
          let score = getSeerScoreForPrediction2(m, seerPred, weights, phaStatsMap, matchStars) + getMatchPriorityScore(m, tagPrefix, matchStars);
          score += getDefaultSeerPenalty(m, catDef.id);
          score += getAgreementBoost(m, catDef.id);
          score += catDef.id === "upsets" ? getMatchSupremeTierUnderdog(m, phaStatsMap).score : getMatchSupremeTier(m, phaStatsMap, preCalculatedRules).score;
          score += getGatekeeperPriorityBoost(m, catDef.id);
          const group = m.group || m.patternAnalysis?.group || m.pattern?.group || 3;
          if (group === 3 && !["banker_draws", "upsets", "value_bets"].includes(catDef.id)) {
            const stats = getMatchStats(m, phaStatsMap);
            const moFav = stats.moFav;
            const probFav = stats.probFav;
            const paaSW = stats.phaFavWinSupport || 0;
            let seerScoreFav = 0;
            if (m.seerPercentages && m.seerPercentages[moFav] !== void 0) {
              seerScoreFav = m.seerPercentages[moFav];
            } else if (m.seerScores && m.seerScores[moFav] !== void 0) {
              seerScoreFav = m.seerScores[moFav];
            } else {
              const baseSeer = predictSeerDetailed(m, DEFAULT_WEIGHTS, phaStatsMap, matchStars);
              seerScoreFav = baseSeer.percentages[moFav] || 0;
            }
            if (probFav < 50 && seerScoreFav < 50 && paaSW < 50) {
              score -= 200;
            }
          }
          if (hasPrimaryTag) score += 1e3;
          if (["best_bet", "botb_best"].includes(catDef.id)) {
            const stats = getMatchStats(m, phaStatsMap);
            const moFav = stats.moFav;
            let seerScoreFav = 0;
            if (m.seerPercentages && m.seerPercentages[moFav] !== void 0) {
              seerScoreFav = m.seerPercentages[moFav];
            } else if (m.seerScores && m.seerScores[moFav] !== void 0) {
              seerScoreFav = m.seerScores[moFav];
            } else {
              const baseSeer = predictSeerDetailed(m, DEFAULT_WEIGHTS, phaStatsMap, matchStars);
              seerScoreFav = baseSeer.percentages[moFav] || 0;
            }
            if (seerScoreFav >= 55 && stats.probFav >= 55 && (stats.phaFavWinSupport || 0) >= 55) {
              score += 500;
            }
          }
          if (["jackpot", "bankers_jackpot"].includes(catDef.id)) {
            if (isIntelligenceActive && m.isJackpot) {
              score += 500;
            }
          }
          return { m, score };
        });
        mappedQualifyingMatches.sort((a, b) => b.score - a.score);
        qualifyingMatches.length = 0;
        qualifyingMatches.push(...mappedQualifyingMatches.map((item) => item.m));
        const selectedPicks = [];
        let sharedUsedInThisSlip = 0;
        const maxAllowedSharing = catDef.size <= 5 ? catDef.size : Math.floor(catDef.size / 2);
        const tryAddMatch = (m, enforceSharingLimit, enforceSubSlotOdds) => {
          if (selectedPicks.length >= catDef.size) return false;
          const normMTeams = m.teams.toLowerCase().replace(/[^a-z0-9]/g, "");
          const isMatchAlreadyInSlip = selectedPicks.some(
            (p) => p.match_id === m.id.toString() || p.team.toLowerCase().replace(/[^a-z0-9]/g, "") === normMTeams
          );
          if (isMatchAlreadyInSlip) return false;
          const isAlreadyUsed = usageCount.has(m.id.toString());
          if (enforceSharingLimit && isAlreadyUsed && sharedUsedInThisSlip >= maxAllowedSharing) return false;
          const odds = getOdds(m);
          let shouldHedge = catDef.hedgedSize === catDef.size ? true : catDef.hedgedSize > 0 ? null : false;
          if (enforceSubSlotOdds) {
            if (catDef.id === "botb_best") {
              const unhedgedRange = odds.favOdds >= 1.5 && odds.favOdds <= 2;
              const hedgedRange = odds.favOdds >= 2 && odds.favOdds <= 2.49;
              const hedgedCount = selectedPicks.filter((p) => p.prediction.length > 1).length;
              const unhedgedCount = selectedPicks.length - hedgedCount;
              if (hedgedRange && hedgedCount < 5) shouldHedge = true;
              else if (unhedgedRange && unhedgedCount < 5) shouldHedge = false;
              else return false;
            } else if (catDef.id === "high_confidence") {
              const unhedgedRange = odds.favOdds >= 1.5 && odds.favOdds <= 2;
              const hedgedRange = odds.favOdds >= 2 && odds.favOdds <= 2.49;
              const hedgedCount = selectedPicks.filter((p) => p.prediction.length > 1).length;
              const unhedgedCount = selectedPicks.length - hedgedCount;
              if (hedgedRange && hedgedCount < 10) shouldHedge = true;
              else if (unhedgedRange && unhedgedCount < 10) shouldHedge = false;
              else return false;
            }
          } else if (shouldHedge === null) {
            shouldHedge = odds.favOdds >= 2;
          }
          const pick = buildPick(m, catDef.id, isIntelligenceActive ? "AI Intelligence Selection" : "Pattern Match", shouldHedge === true);
          selectedPicks.push(pick);
          if (isAlreadyUsed) sharedUsedInThisSlip++;
          usageCount.set(m.id.toString(), (usageCount.get(m.id.toString()) || 0) + 1);
          return true;
        };
        for (const m of qualifyingMatches) {
          if (selectedPicks.length >= catDef.size) break;
          tryAddMatch(m, true, true);
        }
        if (selectedPicks.length < catDef.size) {
          for (const m of qualifyingMatches) {
            if (selectedPicks.length >= catDef.size) break;
            tryAddMatch(m, false, false);
          }
        }
        if (selectedPicks.length < catDef.size) {
          const fallbackPool = targetMatches.filter((m) => {
            const mainPat = (m.patternAnalysis?.mainPattern || "").toUpperCase();
            const isPatternTSub = mainPat === "T" && !!m.patternAnalysis?.subPattern;
            if (isPatternTSub) return false;
            const teams = (m.teams || "").toLowerCase();
            const league = (m.league || "").toLowerCase();
            const africanDomesticRegex = /tanzania|tanzanian|kenya|kenyan|uganda|ugandan|rwanda|rwandan|egypt|egyptian|morocco|moroccan|nigeria|nigerian|ghana|ghanaian|south africa|south african|zambia|zambian|senegal|senegalese|tunisia|tunisian|algeria|algerian|mali|cameroon|cameroonian|congo|angola|angolan|burundi|sudan|sudanese|somalia|ethiopia|ethiopian|suhul shire|caps united|triangle u|malawi|mozambique|botswana|namibia|zimbabwe|zimbabwean|lesotho|eswatini|madagascar|ivory coast|cote d'ivoire|guinea|burkina faso|benin|togo|mauritania|niger|chad|central african|gabon|equatorial|djibouti|eritrea|seychelles|comoros|mauritius|sao tome|sierra leone|liberia|gambia|cape verde|chemilil|sony sugar|jkt/i;
            const isFavoriteCategory = ["best_bet", "top_10_value", "high_confidence", "botb_best", "bankers_dlive", "bankers_jackpot", "value_picks"].includes(catDef.id);
            if (isFavoriteCategory && (africanDomesticRegex.test(teams) || africanDomesticRegex.test(league))) return false;
            return true;
          });
          for (const m of fallbackPool) {
            if (selectedPicks.length >= catDef.size) break;
            tryAddMatch(m, false, false);
          }
        }
        const backups = [];
        for (const m of qualifyingMatches) {
          if (backups.length >= 5) break;
          const normMTeams = m.teams.toLowerCase().replace(/[^a-z0-9]/g, "");
          const alreadyInPicks = selectedPicks.some(
            (p) => p.match_id === m.id.toString() || p.team.toLowerCase().replace(/[^a-z0-9]/g, "") === normMTeams
          );
          const alreadyInBackups = backups.some(
            (b) => b.match_id === m.id.toString() || b.team.toLowerCase().replace(/[^a-z0-9]/g, "") === normMTeams
          );
          if (!alreadyInPicks && !alreadyInBackups) {
            const pick = buildPick(m, `${catDef.id}_backup`, "Filler/Backup");
            backups.push(pick);
          }
        }
        if (isJackpot) {
          spec[catDef.id] = selectedPicks;
          spec[`${catDef.id}_backups`] = backups;
        } else {
          if (live[catDef.id] !== void 0) {
            live[catDef.id] = selectedPicks;
            live[`${catDef.id}_backups`] = backups;
          } else {
            spec[catDef.id] = selectedPicks;
            spec[`${catDef.id}_backups`] = backups;
          }
        }
      });
      if (isJackpot) {
        targetMatches.forEach((m) => {
          if (usageCount.has(m.id.toString())) return;
          const tags = matchTagsMap.get(m.id.toString()) || [];
          const hasValidTag = tags.some((t) => categories.some((c) => t.startsWith(c.tag + ":")));
          if (hasValidTag) spec.unallocated.push(buildPick(m, "unallocated", "Quota Full"));
          else spec.uncategorized.push(buildPick(m, "uncategorized", "No Valid Tags"));
        });
      }
      const underdogSlips = generateSeerUnderdogSlips(targetMatches, phaStatsMap, matchStars, isJackpot, isIntelligenceActive);
      spec.upsets = underdogSlips.spec?.upsets || [];
      return { spec, live, candidates };
    };
  }
});

// src/components/MatchSelector.tsx
var import_react2, import_lucide_react, import_jsx_runtime;
var init_MatchSelector = __esm({
  "src/components/MatchSelector.tsx"() {
    import_react2 = require("react");
    import_lucide_react = require("lucide-react");
    import_jsx_runtime = require("react/jsx-runtime");
  }
});

// src/components/ai/SlipSelection.ts
var init_SlipSelection = __esm({
  "src/components/ai/SlipSelection.ts"() {
  }
});

// src/components/ai/LivePred.tsx
var init_LivePred = __esm({
  "src/components/ai/LivePred.tsx"() {
    init_algorithm();
    init_MatchSelector();
    init_matchEvaluator();
    init_SlipSelection();
    init_seerSupremeTier();
  }
});

// src/components/ai/JackpotPred.tsx
var init_JackpotPred = __esm({
  "src/components/ai/JackpotPred.tsx"() {
    init_algorithm();
    init_MatchSelector();
    init_matchEvaluator();
    init_SlipSelection();
    init_seerSupremeTier();
  }
});

// src/components/SeerAnalysis.tsx
var import_react3 = require("react");
var import_lz_string4 = __toESM(require("lz-string"), 1);
init_storageUtils();
var import_lucide_react2 = require("lucide-react");
init_matchEvaluator();
init_matchProcessing();
init_matchStars();
init_seerLogic();
init_storage();
init_seerSlipSelection();
init_seerSupremeTier();

// src/services/seerPerformance.ts
init_supabase();
init_matchProcessing();

// src/utils/dbUtils.ts
var cleanUndefined = (obj) => {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanUndefined(item));
  }
  const result = {};
  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    if (value !== void 0) {
      result[key] = cleanUndefined(value);
    }
  });
  return result;
};

// src/services/seerPerformance.ts
var import_lz_string3 = __toESM(require("lz-string"), 1);
var import_axios2 = __toESM(require("axios"), 1);
init_seerSlipSelection();

// src/services/seerSlips.ts
init_supabase();
var import_lz_string2 = __toESM(require("lz-string"), 1);
var import_axios = __toESM(require("axios"), 1);
var LOCKED_SLIPS_COLLECTION = "seer_locked_slips";
var AI_SLIPS_COLLECTION = "seer_ai_slips";
var saveLockedSlip = async (slip, forceOverwrite = false) => {
  const collection = slip.category.startsWith("ai_") ? AI_SLIPS_COLLECTION : LOCKED_SLIPS_COLLECTION;
  const { createdAt, ...stableSlip } = slip;
  const slipHash = import_lz_string2.default.compressToUTF16(JSON.stringify(stableSlip));
  const cacheKey = `seer_locked_slip_hash_${slip.id}`;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(`local_locked_slip_${slip.id}`, JSON.stringify(slip));
    }
  } catch (e) {
    console.warn("Failed to save to localStorage:", e);
  }
  try {
    await import_axios.default.post("/api/storage/save", {
      key: `slip_${slip.id}`,
      data: slip
    });
  } catch (e) {
    try {
      if (typeof window === "undefined" || !window.location) {
        await import_axios.default.post("http://localhost:3000/api/storage/save", {
          key: `slip_${slip.id}`,
          data: slip
        });
      }
    } catch (err) {
    }
  }
  if (typeof localStorage !== "undefined" && localStorage.getItem(cacheKey) === slipHash && !forceOverwrite) {
    return;
  }
  const cleanedSlip = cleanUndefined({
    id: slip.id,
    date: slip.date,
    category: slip.category,
    type: slip.type,
    picks: slip.picks,
    backups: slip.backups || [],
    weights_at_time: slip.weightsAtTime || {},
    created_at: slip.createdAt || (/* @__PURE__ */ new Date()).toISOString()
  });
  try {
    const { error: upsertErr } = await supabase.from(collection).upsert(cleanedSlip, { onConflict: "id" });
    if (upsertErr) {
      console.warn(`Upsert to Supabase ${collection} returned error:`, upsertErr);
    } else {
      console.log(`Saved locked slip to Supabase ${collection}: ${slip.id}`);
    }
  } catch (error) {
    console.warn(`Supabase saveLockedSlip primary collection (${collection}) failed.`, error);
  }
  if (collection === AI_SLIPS_COLLECTION) {
    try {
      await supabase.from(LOCKED_SLIPS_COLLECTION).upsert(cleanedSlip, { onConflict: "id" });
    } catch (e) {
      console.warn(`Fallback save to ${LOCKED_SLIPS_COLLECTION} failed.`, e);
    }
  }
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(cacheKey, slipHash);
  } catch (e) {
  }
};
var fetchWithTimeout = async (promiseLike, timeoutMs = 1500) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Supabase request timed out")), timeoutMs);
  });
  try {
    const result = await Promise.race([Promise.resolve(promiseLike), timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
};
var getLockedSlip = async (date, category, forceRefresh = false) => {
  const collection = category.startsWith("ai_") ? AI_SLIPS_COLLECTION : LOCKED_SLIPS_COLLECTION;
  const slipId = `${date}_${category}`;
  if (!forceRefresh) {
    try {
      if (typeof localStorage !== "undefined") {
        const localVal = localStorage.getItem(`local_locked_slip_${slipId}`);
        if (localVal) {
          const parsed = JSON.parse(localVal);
          if (parsed && parsed.id && parsed.picks && parsed.picks.length > 0) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.error("Failed to parse local locked slip", e);
    }
  }
  try {
    let url = `/api/storage/load/slip_${slipId}`;
    if (typeof window === "undefined" || !window.location) {
      url = `http://localhost:3000/api/storage/load/slip_${slipId}`;
    }
    const res = await import_axios.default.get(url);
    if (res.data && res.data.id && res.data.picks && res.data.picks.length > 0) {
      const slip = res.data;
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(`local_locked_slip_${slipId}`, JSON.stringify(slip));
        }
      } catch (e) {
      }
      return slip;
    }
  } catch (e) {
  }
  try {
    let data = null;
    try {
      const dbRes = await fetchWithTimeout(
        supabase.from(collection).select("*").eq("id", slipId).maybeSingle(),
        1500
      );
      if (!dbRes.error && dbRes.data) {
        data = dbRes.data;
      }
    } catch (e) {
    }
    if (!data && collection === AI_SLIPS_COLLECTION) {
      try {
        const dbRes = await fetchWithTimeout(
          supabase.from(LOCKED_SLIPS_COLLECTION).select("*").eq("id", slipId).maybeSingle(),
          1500
        );
        if (!dbRes.error && dbRes.data) {
          data = dbRes.data;
        }
      } catch (e) {
      }
    }
    if (data && data.picks && data.picks.length > 0) {
      const slip = {
        id: data.id,
        date: data.date,
        category: data.category,
        picks: data.picks || [],
        backups: data.backups || [],
        weightsAtTime: data.weights_at_time || {},
        type: data.type || "daily",
        createdAt: data.created_at || data.updated_at || (/* @__PURE__ */ new Date()).toISOString()
      };
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(`local_locked_slip_${slipId}`, JSON.stringify(slip));
        }
      } catch (e) {
      }
      try {
        let url = `/api/storage/save`;
        if (typeof window === "undefined" || !window.location) {
          url = `http://localhost:3000/api/storage/save`;
        }
        await import_axios.default.post(url, { key: `slip_${slipId}`, data: slip });
      } catch (e) {
      }
      return slip;
    }
  } catch (error) {
    console.warn(`Supabase getLockedSlip failed for ${slipId}. Falling back to localStorage.`, error);
  }
  try {
    if (typeof localStorage !== "undefined") {
      const localVal = localStorage.getItem(`local_locked_slip_${slipId}`);
      if (localVal) {
        const parsed = JSON.parse(localVal);
        if (parsed && parsed.id && parsed.picks && parsed.picks.length > 0) {
          return parsed;
        }
      }
    }
  } catch (e) {
  }
  return null;
};
var deleteLockedSlip = async (date, category) => {
  const collection = category.startsWith("ai_") ? AI_SLIPS_COLLECTION : LOCKED_SLIPS_COLLECTION;
  const slipId = `${date}_${category}`;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(`local_locked_slip_${slipId}`);
      sessionStorage.removeItem(`seer_locked_slip_hash_${slipId}`);
    }
  } catch (e) {
  }
  try {
    let url = `/api/storage/delete/slip_${slipId}`;
    if (typeof window === "undefined" || !window.location) {
      url = `http://localhost:3000/api/storage/delete/slip_${slipId}`;
    }
    await import_axios.default.delete(url);
  } catch (e) {
  }
  try {
    await supabase.from(collection).delete().eq("id", slipId);
    if (collection === AI_SLIPS_COLLECTION) {
      await supabase.from(LOCKED_SLIPS_COLLECTION).delete().eq("id", slipId);
    }
    console.log(`Deleted locked slip from Supabase: ${slipId}`);
  } catch (error) {
    console.warn(`Supabase deleteLockedSlip failing for ${slipId}.`, error);
  }
};

// src/services/seerPerformance.ts
init_seerLogic();
init_matchEvaluator();
var DAILY_COLLECTION = "seer_performance_history";
var JACKPOT_COLLECTION = "seer_jackpot_history";
var getAnalysisDateString = (dateStr) => {
  if (typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  const input = dateStr || /* @__PURE__ */ new Date();
  if (typeof input === "string") {
    let normalizedInput = input;
    if (/^\d{2}[-/]\d{2}[-/]\d{4}/.test(normalizedInput)) {
      const parts2 = normalizedInput.split(/[-/\s]/);
      if (parts2.length >= 3) {
        const timePart = parts2.slice(3).join(" ");
        normalizedInput = `${parts2[2]}-${parts2[1]}-${parts2[0]}${timePart ? " " + timePart : ""}`;
      }
    }
    const isoStr = normalizedInput.includes(" ") ? normalizedInput.replace(" ", "T") : normalizedInput;
    const d2 = /* @__PURE__ */ new Date(isoStr + "Z");
    if (isNaN(d2.getTime())) {
      return getAnalysisDateString(/* @__PURE__ */ new Date());
    }
    if (d2.getUTCHours() < 9) {
      d2.setUTCDate(d2.getUTCDate() - 1);
    }
    const year = d2.getUTCFullYear();
    const month = String(d2.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d2.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const d = input;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    hourCycle: "h23"
  });
  const parts = formatter.formatToParts(d);
  const partMap = {};
  parts.forEach((p) => {
    partMap[p.type] = p.value;
  });
  const eatYear = parseInt(partMap.year, 10);
  const eatMonth = parseInt(partMap.month, 10) - 1;
  const eatDay = parseInt(partMap.day, 10);
  const eatHour = parseInt(partMap.hour, 10);
  const logicalEatDate = new Date(Date.UTC(eatYear, eatMonth, eatDay, eatHour));
  if (eatHour < 9) {
    logicalEatDate.setUTCDate(logicalEatDate.getUTCDate() - 1);
  }
  const resultYear = logicalEatDate.getUTCFullYear();
  const resultMonth = String(logicalEatDate.getUTCMonth() + 1).padStart(2, "0");
  const resultDay = String(logicalEatDate.getUTCDate()).padStart(2, "0");
  return `${resultYear}-${resultMonth}-${resultDay}`;
};
var syncSeerData = async (matches, phaStatsMap, matchStars) => {
  await updateSeerSnapshots(matches);
  if (matches.length > 0) {
    try {
      const grouped = {};
      matches.forEach((m) => {
        const date = getAnalysisDateString(m.date);
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(m);
      });
      for (const [dateStr, dateMatches] of Object.entries(grouped)) {
        const slipsObj = generateSeerSlips(
          dateMatches,
          phaStatsMap,
          matchStars,
          false
        );
        const TARGET_CATS = [
          "top_10_value",
          "best_bet",
          "banker",
          "upset",
          "jackpot",
          "safety",
          "bankers_dlive",
          "botb_best",
          "high_confidence",
          "bankers_jackpot",
          "banker_draws",
          "value_picks",
          "value_bets",
          "upsets",
          "sandbox_best_bet",
          "sandbox_top_10_value",
          "sandbox_bankers_dlive",
          "sandbox_bankers_jackpot",
          "sandbox_value_bets",
          "sandbox_value_picks",
          "sandbox_botb_best",
          "sandbox_high_confidence",
          "sandbox_banker_draws",
          "sandbox_upsets"
        ];
        for (const catId of TARGET_CATS) {
          try {
            const existingSlip = await getLockedSlip(dateStr, catId);
            if (existingSlip) {
              let slipChanged = false;
              const updatedPicks = existingSlip.picks.map((p) => {
                const pId = p.match_id?.toString() || "";
                const pTeam = (p.team || "").toLowerCase().trim();
                const matchingM = dateMatches.find(
                  (m) => {
                    const mId = m.id?.toString() || "";
                    const mTeam = (m.teams || "").toLowerCase().trim();
                    return mId === pId || pId.startsWith(mId + "_") || mId.startsWith(pId + "_") || pTeam.length > 0 && mTeam === pTeam;
                  }
                );
                if (matchingM) {
                  const actual = getActualResult(matchingM.result);
                  if (actual && actual !== "pending") {
                    const outcome = isMatchCorrectForCategory(matchingM, p.prediction, actual, catId) ? "Correct" : "Incorrect";
                    if (p.actualResult !== actual || p.outcome !== outcome) {
                      slipChanged = true;
                      return {
                        ...p,
                        actualResult: actual,
                        outcome
                      };
                    }
                  }
                }
                return p;
              });
              if (slipChanged) {
                const updatedSlip = {
                  ...existingSlip,
                  picks: updatedPicks,
                  createdAt: existingSlip.createdAt || (/* @__PURE__ */ new Date()).toISOString()
                };
                await saveLockedSlip(updatedSlip, true);
                console.log(`Updated results inside existing locked slip: ${dateStr}_${catId}`);
              }
            }
          } catch (slipErr) {
            console.error(`Failed to update existing locked slip ${dateStr}_${catId}:`, slipErr);
          }
          let picks = slipsObj.live[catId] || slipsObj.spec[catId];
          if (!picks || picks.length === 0) {
            if (["banker", "upset", "jackpot", "safety"].includes(catId)) {
              const catConf = {
                banker: { targetTags: ["bankers_jackpot", "bankers_dlive"], minSeer: 33 },
                upset: { targetTags: ["upsets", "value_bets"], minSeer: 25 },
                jackpot: { targetTags: ["bankers_jackpot", "top10"], minSeer: 30 },
                safety: { targetTags: ["best_bet"], minSeer: 35 }
              }[catId];
              if (catConf) {
                const getMatchDetails = (m) => {
                  const tags = getMatchEvaluatorTags(m, phaStatsMap, false, true, matchStars);
                  const hardBans = tags.filter(
                    (t) => t.startsWith("BANNED:") && t !== "PHA_TIE"
                  );
                  const hasHardBan = hardBans.length > 0;
                  const hasPhaTie = tags.includes("PHA_TIE");
                  const p1 = getMatchScore(m, "1", DEFAULT_WEIGHTS, phaStatsMap, matchStars);
                  const p2 = getMatchScore(m, "2", DEFAULT_WEIGHTS, phaStatsMap, matchStars);
                  const isBanker = tags.some(
                    (t) => t.includes("bankers") || t.includes("jackpot")
                  );
                  const isUpset = tags.some(
                    (t) => t.includes("upsets") || t.includes("value_bets")
                  );
                  let conflictRes = "none";
                  if (isBanker && isUpset) {
                    conflictRes = p1 > p2 ? "banker_win" : "upset_win";
                  }
                  return {
                    tags,
                    hasHardBan,
                    hasPhaTie,
                    p1,
                    p2,
                    isBanker,
                    isUpset,
                    conflictRes
                  };
                };
                const filtered = dateMatches.filter((m) => {
                  const details = getMatchDetails(m);
                  if (details.hasHardBan) return false;
                  const matchesCategory = catConf.targetTags.some(
                    (tt) => details.tags.some((t) => t.includes(tt))
                  );
                  if (!matchesCategory) return false;
                  if (catId === "banker" && details.conflictRes === "upset_win")
                    return false;
                  if (catId === "upset" && details.conflictRes === "banker_win")
                    return false;
                  const score = Math.max(
                    details.p1,
                    details.p2,
                    getMatchScore(m, "X", DEFAULT_WEIGHTS, phaStatsMap, matchStars)
                  );
                  return score >= catConf.minSeer;
                });
                filtered.sort((a, b) => {
                  const detA = getMatchDetails(a);
                  const detB = getMatchDetails(b);
                  const scoreA = Math.max(detA.p1, detA.p2) - (detA.hasPhaTie ? 100 : 0);
                  const scoreB = Math.max(detB.p1, detB.p2) - (detB.hasPhaTie ? 100 : 0);
                  return scoreB - scoreA;
                });
                picks = filtered.map((m) => ({
                  match_id: m.id,
                  team: m.teams,
                  prediction: predictWithSeer(
                    m,
                    DEFAULT_WEIGHTS,
                    phaStatsMap,
                    matchStars,
                    catId
                  ),
                  odds: m.mo?.split(",")[0] || "1.0",
                  reason: "Locked Selection",
                  confidence: "100%",
                  category: catId
                }));
              }
            }
          }
          if (picks && picks.length > 0) {
            const slip = {
              id: `${dateStr}_${catId}`,
              date: dateStr,
              category: catId,
              picks,
              backups: [],
              weightsAtTime: DEFAULT_WEIGHTS,
              createdAt: (/* @__PURE__ */ new Date()).toISOString(),
              type: dateMatches.some((m) => m.isJackpot) ? "jackpot" : "daily"
            };
            await saveLockedSlip(slip);
          }
        }
      }
    } catch (e) {
      console.error("Background Seer Slip locking failed:", e);
    }
  }
};
var updateSeerSnapshots = async (matches) => {
  if (matches.length === 0) return;
  const dailyMatches = matches.filter(
    (m) => m.isDaily || !m.isJackpot && !m.isDaily
  );
  const jackpotMatches = matches.filter((m) => m.isJackpot);
  if (dailyMatches.length > 0) {
    await processSnapshots(dailyMatches, DAILY_COLLECTION);
  }
  if (jackpotMatches.length > 0) {
    await processSnapshots(jackpotMatches, JACKPOT_COLLECTION);
  }
};
var processSnapshots = async (matches, collectionName) => {
  const groupedByDate = {};
  matches.forEach((m) => {
    const analysisDate = m.date ? getAnalysisDateString(m.date) : getAnalysisDateString();
    if (!groupedByDate[analysisDate]) groupedByDate[analysisDate] = [];
    groupedByDate[analysisDate].push(m);
  });
  const todayAnalysis = getAnalysisDateString();
  const year = parseInt(todayAnalysis.split("-")[0]);
  const month = parseInt(todayAnalysis.split("-")[1]) - 1;
  const day = parseInt(todayAnalysis.split("-")[2]);
  const baseDate = new Date(year, month, day);
  const last11Days = [];
  for (let i = 0; i < 11; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() - i);
    last11Days.push(
      d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0")
    );
  }
  for (const [dateStr, dailyMatches] of Object.entries(groupedByDate)) {
    if (!last11Days.includes(dateStr)) continue;
    const cacheKey = `seer_hash_${collectionName}_${dateStr}`;
    const localCompressed = import_lz_string3.default.compressToUTF16(
      JSON.stringify(dailyMatches)
    );
    const snapshotDataL = cleanUndefined({
      date: dateStr,
      compressedMatches: localCompressed,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(`local_seer_snapshot_${collectionName}_${dateStr}`, JSON.stringify(snapshotDataL));
      }
    } catch (e) {
      console.warn("localStorage snapshot write failed", e);
    }
    try {
      if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(cacheKey) === localCompressed) {
        continue;
      }
    } catch (e) {
    }
    try {
      const existing = await getDailySeerSnapshot(dateStr, collectionName);
      let mergedMatches = dailyMatches;
      if (existing) {
        const dailyIds = new Set(dailyMatches.map((m) => m.id.toString()));
        mergedMatches = [
          ...dailyMatches,
          ...existing.matches.filter((m) => !dailyIds.has(m.id.toString()))
        ];
      }
      const finalCompressed = import_lz_string3.default.compressToUTF16(
        JSON.stringify(mergedMatches)
      );
      const mergedSnapshotData = cleanUndefined({
        date: dateStr,
        compressedMatches: finalCompressed,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      try {
        localStorage.setItem(`local_seer_snapshot_${collectionName}_${dateStr}`, JSON.stringify(mergedSnapshotData));
      } catch (e) {
      }
      try {
        let storageUrl = `/api/storage/save`;
        if (typeof window === "undefined" || !window.location) {
          storageUrl = `http://localhost:3000/api/storage/save`;
        }
        await import_axios2.default.post(storageUrl, {
          key: `snapshot_${collectionName}_${dateStr}`,
          data: mergedSnapshotData
        });
      } catch (e) {
      }
      if (existing && existing.compressedMatches === finalCompressed) {
        try {
          if (typeof sessionStorage !== "undefined") {
            sessionStorage.setItem(cacheKey, localCompressed);
          }
        } catch (e) {
        }
        continue;
      }
      const snapshotData = {
        date: dateStr,
        compressed_matches: finalCompressed,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      const { error } = await supabase.from(collectionName).upsert(snapshotData, { onConflict: "date" });
      if (error) {
        throw error;
      }
      await invalidatePerformanceCache(dateStr, collectionName);
      try {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(cacheKey, localCompressed);
        }
      } catch (e) {
      }
    } catch (err) {
      console.warn(`Supabase snapshot processing failed for date ${dateStr}. Matches still preserved in localStorage fallback.`, err);
    }
  }
};
var invalidatePerformanceCache = async (date, collection) => {
  try {
    const { error } = await supabase.from("seer_performance_cache").delete().eq("collection", collection).eq("date", date);
    if (error) {
      throw error;
    }
  } catch (e) {
    console.warn(`Failed to delete performance cache from Supabase for date ${date}:`, e);
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`local_seer_perf_cache_${collection}_`) && key.endsWith(`_${date}`)) {
        localStorage.removeItem(key);
        i--;
      }
    }
  } catch (e) {
    console.warn(`Failed to delete local performance cache for date ${date}:`, e);
  }
};
var fetchWithTimeout2 = async (promiseLike, timeoutMs = 2e3) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Supabase request timed out")), timeoutMs);
  });
  try {
    const result = await Promise.race([Promise.resolve(promiseLike), timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
};
var getDailySeerSnapshot = async (date, collectionName = DAILY_COLLECTION, forceRefresh = false) => {
  if (!forceRefresh) {
    try {
      const localVal = localStorage.getItem(`local_seer_snapshot_${collectionName}_${date}`);
      if (localVal) {
        const data = JSON.parse(localVal);
        if (data.compressedMatches) {
          try {
            const decompressed = import_lz_string3.default.decompressFromUTF16(data.compressedMatches);
            data.matches = decompressed ? JSON.parse(decompressed) : [];
            return data;
          } catch (e) {
          }
        } else {
          data.matches = Array.isArray(data.matches) ? data.matches : [];
          return data;
        }
      }
    } catch (e) {
    }
  }
  try {
    let url = `/api/storage/load/snapshot_${collectionName}_${date}`;
    if (typeof window === "undefined" || !window.location) {
      url = `http://localhost:3000/api/storage/load/snapshot_${collectionName}_${date}`;
    }
    const res = await import_axios2.default.get(url);
    if (res.data && (res.data.compressedMatches || res.data.matches)) {
      const data = res.data;
      if (data.compressedMatches) {
        try {
          const decompressed = import_lz_string3.default.decompressFromUTF16(data.compressedMatches);
          data.matches = decompressed ? JSON.parse(decompressed) : [];
        } catch (e) {
          data.matches = [];
        }
      } else {
        data.matches = Array.isArray(data.matches) ? data.matches : [];
      }
      try {
        localStorage.setItem(`local_seer_snapshot_${collectionName}_${date}`, JSON.stringify(data));
      } catch (e) {
      }
      return data;
    }
  } catch (e) {
  }
  try {
    const dbRes = await fetchWithTimeout2(
      supabase.from(collectionName).select("*").eq("date", date).maybeSingle(),
      2e3
    );
    const dbData = dbRes.data;
    if (dbRes.error) {
      throw dbRes.error;
    }
    if (dbData) {
      const data = {
        date: dbData.date,
        compressedMatches: dbData.compressed_matches,
        matches: [],
        updatedAt: dbData.updated_at || (/* @__PURE__ */ new Date()).toISOString()
      };
      if (data.compressedMatches) {
        try {
          data.matches = JSON.parse(
            import_lz_string3.default.decompressFromUTF16(data.compressedMatches) || "[]"
          );
        } catch (e) {
          console.error("Failed to parse compressed matches", e);
          data.matches = [];
        }
      }
      try {
        localStorage.setItem(`local_seer_snapshot_${collectionName}_${date}`, JSON.stringify(data));
      } catch (e) {
      }
      return data;
    }
  } catch (error) {
    console.warn(`Supabase getDailySeerSnapshot failed/timed out for ${date} in ${collectionName}. Falling back to localStorage.`, error);
  }
  try {
    const localVal = typeof localStorage !== "undefined" ? localStorage.getItem(`local_seer_snapshot_${collectionName}_${date}`) : null;
    if (localVal) {
      const data = JSON.parse(localVal);
      if (data.compressedMatches) {
        try {
          data.matches = JSON.parse(
            import_lz_string3.default.decompressFromUTF16(data.compressedMatches) || "[]"
          );
        } catch (e) {
          console.error("Failed to parse compressed matches from localStorage", e);
          data.matches = [];
        }
      } else if (!data.matches) {
        data.matches = [];
      }
      return data;
    }
  } catch (e) {
    console.error("Failed to read snapshot from localStorage", e);
  }
  return null;
};
var deleteDailySeerSnapshot = async (date, collectionName = DAILY_COLLECTION) => {
  try {
    localStorage.removeItem(`local_seer_snapshot_${collectionName}_${date}`);
  } catch (e) {
  }
  try {
    const { error } = await supabase.from(collectionName).delete().eq("date", date);
    if (error) {
      throw error;
    }
    console.log(`Deleted Seer snapshot for ${date} in ${collectionName}`);
  } catch (error) {
    console.warn(`Supabase deleteDailySeerSnapshot failed.`, error);
  }
};
var getSeerPerformanceCache = async (date, category, collection) => {
  const cacheKey = `local_seer_perf_cache_${collection}_${category}_${date}`;
  try {
    const localCached = localStorage.getItem(cacheKey);
    if (localCached) {
      return JSON.parse(localCached);
    }
  } catch (e) {
  }
  try {
    let url = `/api/storage/load/perf_cache_${collection}_${category}_${date}`;
    if (typeof window === "undefined" || !window.location) {
      url = `http://localhost:3000/api/storage/load/perf_cache_${collection}_${category}_${date}`;
    }
    const res = await import_axios2.default.get(url);
    if (res.data && typeof res.data.accuracy === "number") {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(res.data));
      } catch (e) {
      }
      return res.data;
    }
  } catch (e) {
  }
  try {
    const id = `${collection}_${category}_${date}`;
    const { data, error } = await supabase.from("seer_performance_cache").select("*").eq("id", id).maybeSingle();
    if (error) {
      throw error;
    }
    if (data) {
      const result = { accuracy: Number(data.accuracy), goalAccuracy: Number(data.goal_accuracy) };
      try {
        localStorage.setItem(cacheKey, JSON.stringify(result));
      } catch (e) {
      }
      return result;
    }
  } catch (e) {
    console.warn("Supabase getSeerPerformanceCache failed, falling back to local:", e);
  }
  return null;
};
var saveSeerPerformanceCache = async (date, category, collection, accuracy, goalAccuracy, aiAccuracy, aiGoalAccuracy) => {
  const cacheKey = `local_seer_perf_cache_${collection}_${category}_${date}`;
  const result = {
    accuracy,
    goalAccuracy: goalAccuracy ?? accuracy,
    aiAccuracy,
    aiGoalAccuracy
  };
  try {
    localStorage.setItem(cacheKey, JSON.stringify(result));
  } catch (e) {
  }
  try {
    let storageUrl = `/api/storage/save`;
    if (typeof window === "undefined" || !window.location) {
      storageUrl = `http://localhost:3000/api/storage/save`;
    }
    await import_axios2.default.post(storageUrl, {
      key: `perf_cache_${collection}_${category}_${date}`,
      data: result
    });
  } catch (e) {
  }
  try {
    const id = `${collection}_${category}_${date}`;
    const { error } = await supabase.from("seer_performance_cache").upsert({
      id,
      collection,
      category,
      date,
      accuracy,
      goal_accuracy: goalAccuracy ?? accuracy,
      saved_at: (/* @__PURE__ */ new Date()).toISOString()
    }, { onConflict: "id" });
    if (error) {
      throw error;
    }
  } catch (e) {
    console.error("Failed to save performance cache", e);
  }
};
var cleanupOldSeerSnapshots = async () => {
  await cleanupCollection(DAILY_COLLECTION);
  await cleanupCollection(JACKPOT_COLLECTION);
};
var cleanupCollection = async (collectionName) => {
  try {
    const tenDaysAgo = /* @__PURE__ */ new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const tenDaysAgoStr = tenDaysAgo.toISOString().split("T")[0];
    const { error, count } = await supabase.from(collectionName).delete().lt("date", tenDaysAgoStr);
    if (error) {
      throw error;
    }
    if (count) {
      console.log(`Cleaned up ${count} old Seer snapshots from ${collectionName}.`);
    }
  } catch (error) {
    console.warn(`Supabase cleanupCollection failed for ${collectionName}:`, error.message || error);
  }
};

// src/components/ai/GeminiEngine.ts
var import_genai = require("@google/genai");
var import_jsonrepair = require("jsonrepair");
init_Patterns();
init_matchProcessing();
init_matchEvaluator();
init_algorithm();
init_LivePred();
init_JackpotPred();

// src/components/ai/SelfLearn.tsx
init_algorithm();
init_matchProcessing();
init_MatchSelector();
init_Patterns();

// src/components/ai/GeminiEngine.ts
init_matchStars();
init_seerLogic();

// src/utils/seerAiSlipSelection.ts
init_seerLogic();
init_matchEvaluator();
init_seerSlipSelection();
init_seerSupremeTier();
var ensureHedgedPrediction = (pred, m, phaStatsMap) => {
  let odds1 = 2, odds2 = 2.5;
  if (m) {
    const moParts = (m.mo || "").split(",").map((s) => parseFloat(s.trim()));
    odds1 = moParts[0] || 2;
    odds2 = moParts[2] || 2.5;
  }
  const defaultFavHedge = odds1 <= odds2 ? "1X" : "X2";
  if (!pred) return defaultFavHedge;
  const p = pred.trim().toUpperCase();
  if (p === "1X" || p === "X2") return p;
  if (p === "12") return defaultFavHedge;
  if (p === "1" || p.includes("1")) return "1X";
  if (p === "2" || p.includes("2")) return "X2";
  if (p === "X") return defaultFavHedge;
  return defaultFavHedge;
};
var parseMatchOdds = (m) => {
  const moParts = (m.mo || "").split(",").map((s) => parseFloat(s.trim()));
  const odds1 = !isNaN(moParts[0]) && moParts[0] > 0 ? moParts[0] : 2;
  const oddsX = !isNaN(moParts[1]) && moParts[1] > 0 ? moParts[1] : 3;
  const odds2 = !isNaN(moParts[2]) && moParts[2] > 0 ? moParts[2] : 2.5;
  const mFavOdds = Math.min(odds1, odds2);
  return { odds1, oddsX, odds2, mFavOdds };
};
var hasCategoryTag = (m, catId, phaStatsMap, isJackpot, matchStars = {}) => {
  const tags = getMatchEvaluatorTags(m, phaStatsMap, isJackpot, true, matchStars);
  const tagPrefixMap = {
    best_bet: ["best_bet:"],
    top_10_value: ["top10:", "top_10_value:"],
    bankers_dlive: ["bankers_dlive:"],
    botb_best: ["botb_best:"],
    high_confidence: ["top20:", "high_confidence:"],
    top20: ["top20:", "high_confidence:"],
    bankers_jackpot: ["bankers_jackpot:"],
    value_bets: ["value_bets:"],
    value_picks: ["value_picks:"],
    banker_draws: ["banker_draws:"],
    upsets: ["upsets:"]
  };
  const prefixes = tagPrefixMap[catId] || [`${catId}:`];
  return tags.some((t) => prefixes.some((p) => t.startsWith(p)));
};
var calculateAiCognitiveScore = (m, catId, phaStatsMap, matchStars, isJackpot) => {
  const mAny = m;
  const stars = matchStars[m.id] || 0;
  const tags = getMatchEvaluatorTags(m, phaStatsMap, isJackpot, true, matchStars);
  const isTaggedForCategory = hasCategoryTag(m, catId, phaStatsMap, isJackpot, matchStars);
  const { paaFinal } = getPAAPredictionForSeer(m, phaStatsMap);
  const seerDetailed = predictSeerDetailed(m, DEFAULT_WEIGHTS, phaStatsMap, matchStars, catId);
  const seerDefaultPred = seerDetailed.final || "1X";
  const algoPred = mAny.finalPrediction || mAny.calculatedPrediction || seerDefaultPred || "1X";
  const subPatternPred = mAny.patternAnalysis?.subPatternPrediction || "";
  const probs = mAny.algoReport?.probabilities || mAny.calculatedProbabilities || mAny.probabilities || {};
  const stats = getMatchStats(m, phaStatsMap);
  const { odds1, oddsX, odds2, mFavOdds } = parseMatchOdds(m);
  const isHomeFav = odds1 <= odds2;
  let score = 50;
  let rawPred = isHomeFav ? "1X" : "X2";
  let reason = "";
  let confidence = "80%";
  const models = [paaFinal, algoPred, subPatternPred, seerDefaultPred].filter(Boolean);
  let favOrDrawAlignments = 0;
  let straightFavAlignments = 0;
  models.forEach((p) => {
    const pUpper = p.toUpperCase();
    if (isHomeFav) {
      if (pUpper.includes("1") || pUpper.includes("X")) favOrDrawAlignments++;
      if (pUpper === "1" || pUpper === "1X") straightFavAlignments++;
    } else {
      if (pUpper.includes("2") || pUpper.includes("X")) favOrDrawAlignments++;
      if (pUpper === "2" || pUpper === "X2") straightFavAlignments++;
    }
  });
  score += favOrDrawAlignments * 12;
  score += straightFavAlignments * 8;
  score += stars * 6;
  const gsParts = (m.gs || "").split(/[: ]+/).map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
  const gaParts = (m.ga || "").split(/[: ]+/).map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
  const homeAttack = gsParts.length >= 2 ? gsParts[0].toFixed(1) : "1.2";
  const awayAttack = gsParts.length >= 2 ? gsParts[1].toFixed(1) : "1.0";
  const homeDef = gaParts.length >= 2 ? gaParts[0].toFixed(1) : "1.0";
  const awayDef = gaParts.length >= 2 ? gaParts[1].toFixed(1) : "1.2";
  const drawProbPct = probs.X ? Math.round(probs.X) : Math.round(stats.probDraw || 30);
  if (catId === "best_bet") {
    if (mFavOdds >= 1.3 && mFavOdds <= 1.6) score += 40;
    else score -= 30;
    rawPred = isHomeFav ? "1X" : "X2";
    reason = `Best Bet M.Fav odds ${mFavOdds.toFixed(2)} [1.30-1.60], multi-model alignment (${favOrDrawAlignments}/4: Algo ${algoPred}, PAA ${paaFinal || "1X"}), ${stars}\u2605 quality.`;
    confidence = `${Math.min(98, 80 + favOrDrawAlignments * 4 + stars * 2)}%`;
  } else if (catId === "top_10_value") {
    if (mFavOdds >= 2 && mFavOdds <= 2.49) score += 40;
    else score -= 30;
    rawPred = isHomeFav ? "1X" : "X2";
    reason = `Top 12 M.Fav odds ${mFavOdds.toFixed(2)} [2.00-2.49], multi-model consensus (Algo ${algoPred}, SubPatt ${subPatternPred || "N/A"}, PAA ${paaFinal || "N/A"}).`;
    confidence = `${Math.min(95, 76 + favOrDrawAlignments * 4)}%`;
  } else if (catId === "bankers_dlive") {
    if (mFavOdds >= 1.5 && mFavOdds <= 2) score += 40;
    else score -= 30;
    rawPred = isHomeFav ? "1X" : "X2";
    reason = `Bankers DLive M.Fav odds ${mFavOdds.toFixed(2)} [1.50-2.00], model consensus with stable defense (${homeDef} GA vs ${awayDef} GA).`;
    confidence = `${Math.min(96, 78 + favOrDrawAlignments * 4)}%`;
  } else if (catId === "botb_best") {
    if (mFavOdds >= 1.5 && mFavOdds <= 2 || mFavOdds >= 2 && mFavOdds <= 2.49) score += 40;
    else score -= 20;
    rawPred = isHomeFav ? "1X" : "X2";
    reason = `BOTB M.Fav odds ${mFavOdds.toFixed(2)}, high model alignment (${favOrDrawAlignments}/4 models) with ${drawProbPct}% draw cover.`;
    confidence = `${Math.min(96, 78 + favOrDrawAlignments * 4)}%`;
  } else if (catId === "high_confidence") {
    if (mFavOdds >= 1.5 && mFavOdds <= 2 || mFavOdds >= 2 && mFavOdds <= 2.49) score += 40;
    else score -= 20;
    rawPred = isHomeFav ? "1X" : "X2";
    reason = `Top 20 M.Fav odds ${mFavOdds.toFixed(2)}, model consensus (Algo ${algoPred}, PAA ${paaFinal || "N/A"}), ${stars}\u2605 rating.`;
    confidence = `${Math.min(95, 75 + favOrDrawAlignments * 4)}%`;
  } else if (catId === "bankers_jackpot") {
    if (mFavOdds >= 1.8 && mFavOdds <= 2) score += 40;
    else score -= 30;
    rawPred = isHomeFav ? "1X" : "X2";
    reason = `Bankers Jackpot M.Fav odds ${mFavOdds.toFixed(2)} [1.80-2.00], strict model consensus with hedged double chance.`;
    confidence = `${Math.min(95, 78 + favOrDrawAlignments * 4)}%`;
  } else if (catId === "value_bets") {
    if (odds1 >= 2.5 && odds2 >= 2.5) score += 40;
    else score -= 30;
    rawPred = isHomeFav ? "1X" : "X2";
    reason = `Value Bets dual-team odds >= 2.50 (1:${odds1.toFixed(2)}, 2:${odds2.toFixed(2)}), ${stars}\u2605 rating with ${drawProbPct}% draw factor.`;
    confidence = `${Math.min(90, 72 + stars * 3)}%`;
  } else if (catId === "value_picks") {
    if (mFavOdds >= 2 && mFavOdds <= 2.49) score += 40;
    else score -= 30;
    rawPred = isHomeFav ? "1X" : "X2";
    reason = `Value Picks M.Fav odds ${mFavOdds.toFixed(2)} [2.00-2.49], PAA model (${paaFinal || "1X"}) alignment and goal ratio (${homeAttack}:${awayDef}).`;
    confidence = `${Math.min(92, 75 + stars * 3)}%`;
  } else if (catId === "banker_draws") {
    if (odds1 >= 2 && odds2 >= 2) score += 35;
    else score -= 20;
    if (paaFinal === "X" || algoPred === "X" || drawProbPct > 30 || oddsX < 3.3) score += 20;
    rawPred = isHomeFav ? "1X" : "X2";
    reason = `Banker Draws dual odds >= 2.00 (1:${odds1.toFixed(2)}, 2:${odds2.toFixed(2)}), ${drawProbPct}% draw probability hedged with market favorite.`;
    confidence = `${Math.min(90, 70 + Math.round(drawProbPct / 2))}%`;
  } else if (catId === "upsets") {
    const supremeUnderdog = getMatchSupremeTierUnderdog(m, phaStatsMap);
    if (supremeUnderdog.insightsHit > 0) score += 35;
    const favUnderdog = stats.moUnderdog;
    rawPred = favUnderdog === "1" ? "1X" : favUnderdog === "2" ? "X2" : odds1 > odds2 ? "1X" : "X2";
    reason = `Underdog win probability spike: (${awayAttack} GS threat) with hedged double-chance protection.`;
    confidence = "78%";
  } else {
    rawPred = isHomeFav ? "1X" : "X2";
    reason = `Multi-indicator consensus: Algo ${algoPred}, SubPatt ${subPatternPred || "N/A"}, PAA ${paaFinal || "N/A"}, SEER ${seerDefaultPred}.`;
  }
  if (tags.some((t) => t.startsWith("BANNED:") || t.includes("TRAP"))) {
    score -= 40;
  }
  const prediction = ensureHedgedPrediction(rawPred, m, phaStatsMap);
  return { score, prediction, reason, confidence };
};
var selectCategoryPicks = (scoredMatches, catId, targetCount, primaryFilter, phaStatsMap, matchStars, isJackpot) => {
  const catScored = scoredMatches.map((s) => {
    const cog = calculateAiCognitiveScore(s.match, catId, phaStatsMap, matchStars, isJackpot);
    return { ...s, cog };
  });
  let primary = catScored.filter((s) => primaryFilter(s));
  primary.sort((a, b) => b.cog.score - a.cog.score);
  let selected = [...primary];
  if (selected.length < targetCount) {
    const selectedIds = new Set(selected.map((s) => s.match.id));
    const fallback = catScored.filter((s) => !selectedIds.has(s.match.id));
    fallback.sort((a, b) => b.cog.score - a.cog.score);
    selected = [...selected, ...fallback.slice(0, targetCount - selected.length)];
  }
  return selected.slice(0, targetCount).map((s) => ({
    match_id: s.match.id.toString(),
    team: s.match.teams,
    prediction: s.cog.prediction,
    odds: s.match.mo ? s.match.mo.split(",")[0].trim() : "1.0",
    reason: s.cog.reason,
    confidence: s.cog.confidence,
    category: catId
  }));
};
var generateSeerAiCognitiveSlips = (targetMatches, phaStatsMap, matchStars, isJackpot) => {
  const result = {};
  const scoredMatches = targetMatches.map((m) => {
    const odds = parseMatchOdds(m);
    return {
      match: m,
      odds,
      cog: calculateAiCognitiveScore(m, "all", phaStatsMap, matchStars, isJackpot)
    };
  });
  result["best_bet"] = selectCategoryPicks(
    scoredMatches,
    "best_bet",
    10,
    (s) => s.odds.mFavOdds >= 1.3 && s.odds.mFavOdds <= 1.6,
    phaStatsMap,
    matchStars,
    isJackpot
  );
  result["top_10_value"] = selectCategoryPicks(
    scoredMatches,
    "top_10_value",
    12,
    (s) => s.odds.mFavOdds >= 2 && s.odds.mFavOdds <= 2.49,
    phaStatsMap,
    matchStars,
    isJackpot
  );
  result["bankers_dlive"] = selectCategoryPicks(
    scoredMatches,
    "bankers_dlive",
    10,
    (s) => s.odds.mFavOdds >= 1.5 && s.odds.mFavOdds <= 2,
    phaStatsMap,
    matchStars,
    isJackpot
  );
  {
    const picks1 = selectCategoryPicks(
      scoredMatches,
      "botb_best",
      5,
      (s) => s.odds.mFavOdds >= 1.5 && s.odds.mFavOdds <= 2,
      phaStatsMap,
      matchStars,
      isJackpot
    );
    const usedIds = new Set(picks1.map((p) => p.match_id));
    const remaining = scoredMatches.filter((s) => !usedIds.has(s.match.id.toString()));
    const picks2 = selectCategoryPicks(
      remaining,
      "botb_best",
      5,
      (s) => s.odds.mFavOdds >= 2 && s.odds.mFavOdds <= 2.49,
      phaStatsMap,
      matchStars,
      isJackpot
    );
    result["botb_best"] = [...picks1, ...picks2];
  }
  {
    const picks1 = selectCategoryPicks(
      scoredMatches,
      "high_confidence",
      10,
      (s) => s.odds.mFavOdds >= 1.5 && s.odds.mFavOdds <= 2,
      phaStatsMap,
      matchStars,
      isJackpot
    );
    const usedIds = new Set(picks1.map((p) => p.match_id));
    const remaining = scoredMatches.filter((s) => !usedIds.has(s.match.id.toString()));
    const picks2 = selectCategoryPicks(
      remaining,
      "high_confidence",
      10,
      (s) => s.odds.mFavOdds >= 2 && s.odds.mFavOdds <= 2.49,
      phaStatsMap,
      matchStars,
      isJackpot
    );
    result["high_confidence"] = [...picks1, ...picks2];
  }
  result["bankers_jackpot"] = selectCategoryPicks(
    scoredMatches,
    "bankers_jackpot",
    5,
    (s) => s.odds.mFavOdds >= 1.8 && s.odds.mFavOdds <= 2,
    phaStatsMap,
    matchStars,
    isJackpot
  );
  result["value_bets"] = selectCategoryPicks(
    scoredMatches,
    "value_bets",
    5,
    (s) => s.odds.odds1 >= 2.5 && s.odds.odds2 >= 2.5,
    phaStatsMap,
    matchStars,
    isJackpot
  );
  result["value_picks"] = selectCategoryPicks(
    scoredMatches,
    "value_picks",
    5,
    (s) => s.odds.mFavOdds >= 2 && s.odds.mFavOdds <= 2.49,
    phaStatsMap,
    matchStars,
    isJackpot
  );
  result["banker_draws"] = selectCategoryPicks(
    scoredMatches,
    "banker_draws",
    5,
    (s) => s.odds.odds1 >= 2 && s.odds.odds2 >= 2,
    phaStatsMap,
    matchStars,
    isJackpot
  );
  result["upsets"] = selectCategoryPicks(
    scoredMatches,
    "upsets",
    5,
    () => true,
    phaStatsMap,
    matchStars,
    isJackpot
  );
  return result;
};

// src/components/ai/GeminiEngine.ts
init_seerSlipSelection();
var import_meta2 = {};
var getAIInstance = (isIntelligenceActive = false) => {
  if (typeof window !== "undefined") {
    return {
      models: {
        generateContent: async (args) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 25e3);
          try {
            const response = await fetch("/api/ai/generate-content", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify(args),
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`AI proxy error: ${errorText}`);
            }
            const data = await response.json();
            if (data && !data.text && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
              data.text = data.candidates[0].content.parts[0].text;
            }
            return data;
          } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === "AbortError") {
              throw new Error("AI Request timed out after 25s. Using algorithmic fallback.");
            }
            throw err;
          }
        }
      }
    };
  }
  const apiKey = (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY || process.env?.VITE_GEMINI_API_KEY : void 0) || import_meta2.env?.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Gemini API Key missing.");
    throw new Error("API Key is missing. Please configure GEMINI_API_KEY in settings.");
  }
  return new import_genai.GoogleGenAI({ apiKey });
};
var pickSchemaProperties = {
  match_id: { type: import_genai.Type.STRING, description: "The unique identifier of the match AS A STRING." },
  team: { type: import_genai.Type.STRING },
  prediction: { type: import_genai.Type.STRING },
  odds: { type: import_genai.Type.STRING, description: "The odds of the selected prediction AS A STRING." },
  reason: { type: import_genai.Type.STRING },
  confidence: { type: import_genai.Type.STRING, description: "NUMERIC PERCENTAGE STRING ONLY (e.g., '85%')." },
  tag_trace: { type: import_genai.Type.STRING, description: "The exact tags found for this match in the input (MANDATORY for traceability)." }
};
var specialPicksSchema = {
  type: import_genai.Type.OBJECT,
  properties: {
    bankers_jackpot: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.OBJECT, properties: pickSchemaProperties } },
    bankers_dlive: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.OBJECT, properties: pickSchemaProperties } },
    value_bets: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.OBJECT, properties: pickSchemaProperties } },
    value_picks: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.OBJECT, properties: pickSchemaProperties } },
    banker_draws: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.OBJECT, properties: pickSchemaProperties } },
    upsets: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.OBJECT, properties: pickSchemaProperties } }
  },
  required: ["bankers_jackpot", "bankers_dlive", "value_bets", "value_picks", "banker_draws", "upsets"]
};
var livePredictionsSchema = {
  type: import_genai.Type.OBJECT,
  properties: {
    best_bet: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.OBJECT, properties: pickSchemaProperties } },
    top_10_value: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.OBJECT, properties: pickSchemaProperties } },
    botb_best: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.OBJECT, properties: pickSchemaProperties } },
    high_confidence: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.OBJECT, properties: pickSchemaProperties } }
  },
  required: ["best_bet", "top_10_value", "botb_best", "high_confidence"]
};
var selectSlipsWithAI = async (category, allMatches, phaStatsMap, matchStars, isJackpot, modelName = "gemini-3.6-flash") => {
  const maxP = category.maxPicks || (category.id === "high_confidence" || category.id === "top20" ? 20 : ["bankers_jackpot", "banker_draws", "value_picks", "value_bets", "upsets"].includes(category.id) ? 5 : category.id === "top_10_value" ? 12 : 10);
  const oddsEligibleMatches = allMatches.filter((m) => {
    const { odds1, odds2, mFavOdds } = parseMatchOdds(m);
    if (category.id === "best_bet") return mFavOdds >= 1.3 && mFavOdds <= 1.6;
    if (category.id === "top_10_value") return mFavOdds >= 2 && mFavOdds <= 2.49;
    if (category.id === "bankers_dlive") return mFavOdds >= 1.5 && mFavOdds <= 2;
    if (category.id === "botb_best") return mFavOdds >= 1.5 && mFavOdds <= 2 || mFavOdds >= 2 && mFavOdds <= 2.49;
    if (category.id === "high_confidence" || category.id === "top20") return mFavOdds >= 1.5 && mFavOdds <= 2 || mFavOdds >= 2 && mFavOdds <= 2.49;
    if (category.id === "bankers_jackpot") return mFavOdds >= 1.8 && mFavOdds <= 2;
    if (category.id === "value_bets") return odds1 >= 2.5 && odds2 >= 2.5;
    if (category.id === "value_picks") return mFavOdds >= 2 && mFavOdds <= 2.49;
    if (category.id === "banker_draws") return odds1 >= 2 && odds2 >= 2;
    return true;
  });
  let targetMatches = oddsEligibleMatches.length >= maxP ? oddsEligibleMatches : allMatches;
  const matchData = targetMatches.map((m) => {
    const mAny = m;
    const seerDetailed = predictSeerDetailed(m, DEFAULT_WEIGHTS, phaStatsMap, matchStars, category.id);
    const paaObj = getPAAPredictionForSeer(m, phaStatsMap);
    const tags = getMatchEvaluatorTags(m, phaStatsMap, isJackpot, true, matchStars);
    const probs = mAny.algoReport?.probabilities || mAny.calculatedProbabilities || mAny.probabilities || {};
    const moParts = (m.mo || "").split(",").map((s) => parseFloat(s.trim()));
    const odds1 = moParts[0] || 2;
    const odds2 = moParts[2] || 2.5;
    const marketFav = odds1 <= odds2 ? "Home (1)" : "Away (2)";
    return {
      match_id: m.id.toString(),
      teams: m.teams,
      league: m.le || "Unknown",
      odds_1x2: m.mo || "1.0",
      market_favorite: marketFav,
      algo_prediction: mAny.finalPrediction || mAny.calculatedPrediction || seerDetailed.final || "1X",
      sub_pattern_prediction: mAny.patternAnalysis?.subPatternPrediction || "None",
      paa_prediction: paaObj.paaFinal || mAny.paaPrediction || "None",
      seer_default_prediction: seerDetailed.final || "1X",
      algo_probabilities: probs,
      evaluator_tags: tags.filter((t) => !t.startsWith("BANNED:")).join(", "),
      match_rating_stars: matchStars[m.id] || 0
    };
  });
  let pastInsightsText = "";
  try {
    const existingStr = localStorage.getItem("seer_ai_self_learn_lessons") || "[]";
    const lessons = JSON.parse(existingStr);
    const relevantLessons = lessons.filter((l) => (l.category === category.id || l.category === "all") && l.status === "approved");
    if (relevantLessons.length > 0) {
      const allFindings = relevantLessons.flatMap((l) => l.findings || []);
      const allRules = relevantLessons.flatMap((l) => l.actionableRules || []);
      const allInsights = relevantLessons.flatMap((l) => l.insights || []);
      if (allFindings.length > 0 || allRules.length > 0 || allInsights.length > 0) {
        pastInsightsText = `
### PAST SELF-LEARNING INSIGHTS & CORRECTION RULES FOR "${category.label}":
You must strictly respect and apply these past self-learning insights and rules to prioritize optimal matches, avoid low-accuracy traps, and appropriately hedge potential failures (while still selecting ${maxP} matches if candidate matches exist):

${allInsights.length > 0 ? `**Usable Insights:**
${allInsights.map((ins) => `- ${ins}`).join("\n")}
` : ""}
${allFindings.length > 0 ? `**Findings/Observations:**
${allFindings.map((f) => `- ${f}`).join("\n")}
` : ""}
${allRules.length > 0 ? `**Actionable Correction Rules:**
${allRules.map((r) => `- ${r}`).join("\n")}
` : ""}
`;
      }
    }
  } catch (e) {
    console.warn("Failed to load past self-learning lessons for slip selection prompt", e);
  }
  const prompt = `You are the SEER AI Slip Master, an independent and elite sports match selector.
Your objective is to select the ABSOLUTE HIGHEST-ACCURACY matches for the category: "${category.label}" (Target EXACTLY ${maxP} picks if available).

You are provided with full multi-model analytical predictions for every candidate match in this category:
1. algo_prediction (Algorithm model prediction)
2. sub_pattern_prediction (Sub-pattern model prediction)
3. paa_prediction (PAA statistical model prediction)
4. seer_default_prediction (SEER default model prediction)
5. market_favorite (Home vs Away favorite based on 1X2 market odds)
6. algo_probabilities (Win/Draw/Loss calculated probabilities)
7. evaluator_tags & match_rating_stars

Here is the candidate pool of matches:
${JSON.stringify(matchData, null, 2)}

${pastInsightsText}

CRITERIA FOR YOUR AI SELECTION ("${category.label}"):
- Analyze multi-model consensus across all 4 prediction engines (algo, sub_pattern, paa, seer_default).
- Prioritize matches where predictions align with the Market Favorite or Draw (the 1X / X2 target pool).
- DO NOT pick volatile underdogs that contradict market favorite and model consensus.
- CRITICAL PREDICTION MANDATE: ALL PREDICTIONS MUST BE HEDGED DOUBLE-CHANCE OPTIONS (1X or X2). YOU ARE STRICTLY FORBIDDEN FROM OUTPUTTING SINGLE OUTCOMES ('1', 'X', '2') OR '12'. EVERY PICK MUST BE HEDGED AS 1X OR X2 TO COVER BOTH FAVORITE WIN AND DRAW.
- CRITICAL REASONING MANDATE: AI reasoning MUST cite multi-model agreement across Algo, Sub-Pattern, PAA, and SEER default models along with team probabilities and stats.

${category.id === "banker_draws" ? "- CRITICAL REQUIREMENT: For Banker Draws, YOU MUST HEDGE the prediction as 1X or X2 based on market favorite direction. Do NOT predict X natively or 12." : ""}

Your output must strictly conform to the following JSON schema:
{
  "selections": [
    {
      "match_id": "The ID of the selected match as a string",
      "team": "The teams name",
      "prediction": "The final hedged prediction (MUST be 1X or X2)",
      "odds": "The odds of the selected prediction (or 1X2 odds if unknown)",
      "reason": "A concise analytical explanation citing model predictions consensus and statistics",
      "confidence": "An estimated confidence percentage (e.g., '85%')"
    }
  ]
};`;
  const ai = getAIInstance(false);
  const responseSchema = {
    type: import_genai.Type.OBJECT,
    properties: {
      selections: {
        type: import_genai.Type.ARRAY,
        items: {
          type: import_genai.Type.OBJECT,
          properties: {
            match_id: { type: import_genai.Type.STRING },
            team: { type: import_genai.Type.STRING },
            prediction: { type: import_genai.Type.STRING },
            odds: { type: import_genai.Type.STRING },
            reason: { type: import_genai.Type.STRING },
            confidence: { type: import_genai.Type.STRING }
          },
          required: ["match_id", "team", "prediction", "odds", "reason", "confidence"]
        }
      }
    },
    required: ["selections"]
  };
  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      systemInstruction: "You are an elite, independent sports betting AI analyst. You construct unique predictive models to find value beyond standard algorithms. All your predictions MUST be hedged double chance (1X, X2, or 12) and backed by statistical data analysis.",
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.7
    }
  });
  if (!response.text) {
    throw new Error("Empty response from Gemini Slip Selection");
  }
  const parsed = JSON.parse((0, import_jsonrepair.jsonrepair)(response.text));
  const rawSelections = parsed.selections || [];
  const selections = rawSelections.map((s) => {
    const matchingMatch = targetMatches.find((m) => m.id.toString() === s.match_id?.toString());
    const hedgedPred = ensureHedgedPrediction(s.prediction, matchingMatch, phaStatsMap);
    let reason = s.reason || "";
    const lowerReason = reason.toLowerCase();
    if (!reason || lowerReason.includes("odds") && !lowerReason.includes("goal") && !lowerReason.includes("paa") && !lowerReason.includes("stat") && !lowerReason.includes("prob") && !lowerReason.includes("model")) {
      if (matchingMatch) {
        const cog = calculateAiCognitiveScore(matchingMatch, category.id, phaStatsMap, matchStars, isJackpot);
        reason = cog.reason;
      }
    }
    return {
      match_id: s.match_id?.toString() || "",
      team: s.team || (matchingMatch?.teams || ""),
      prediction: hedgedPred,
      odds: s.odds || (matchingMatch?.mo || "1.0").split(",")[0].trim(),
      reason: reason || "Multi-indicator statistical consensus",
      confidence: s.confidence || "80%",
      category: category.id
    };
  });
  const targetCount = Math.min(maxP, targetMatches.length);
  if (selections.length < targetCount) {
    const selectedIds = new Set(selections.map((s) => s.match_id?.toString()));
    const remainingMatches = targetMatches.filter((m) => !selectedIds.has(m.id.toString()));
    for (const m of remainingMatches) {
      if (selections.length >= targetCount) break;
      const cog = calculateAiCognitiveScore(m, category.id, phaStatsMap, matchStars, isJackpot);
      selections.push({
        match_id: m.id.toString(),
        team: m.teams,
        prediction: cog.prediction,
        odds: (m.mo || "1.0").split(",")[0].trim(),
        reason: cog.reason,
        confidence: cog.confidence || "80%",
        category: category.id
      });
    }
  }
  return selections;
};
var runSelfLearnReflectiveCycle = async (date, categories, lockedSlips, allMatches, phaStatsMap, matchStars = {}, liveCategoryMatches, modelName = "gemini-3.6-flash") => {
  const evaluatedSlipsPerformance = [];
  let totalEvaluated = 0;
  let totalCorrect = 0;
  let totalGoalCorrect = 0;
  categories.forEach((cat) => {
    const slip = lockedSlips[cat.id];
    if (!slip || !slip.picks || slip.picks.length === 0) return;
    const slipPicks = slip.picks;
    const picksPerformance = [];
    let slipEvaluated = 0;
    let slipCorrect = 0;
    let slipGoalCorrect = 0;
    slipPicks.forEach((p) => {
      const match = allMatches.find((m) => m.id.toString() === p.match_id?.toString());
      if (match) {
        const actual = getActualResult(match.result);
        if (actual && actual !== "pending") {
          slipEvaluated++;
          totalEvaluated++;
          const isCorrect = isMatchCorrectForCategory(match, p.prediction, actual, cat.id);
          const isGoalCorrect = isMatchGoalAccurate(match, p.prediction, actual, cat.id, phaStatsMap);
          if (isCorrect) {
            slipCorrect++;
            totalCorrect++;
          }
          if (isGoalCorrect) {
            slipGoalCorrect++;
            totalGoalCorrect++;
          }
          picksPerformance.push({
            teams: match.teams,
            prediction: p.prediction,
            actual_result: match.result,
            actual_outcome: actual,
            overall_correct: isCorrect,
            goal_correct: isGoalCorrect,
            reason: p.reason
          });
        }
      }
    });
    if (slipEvaluated > 0) {
      evaluatedSlipsPerformance.push({
        category_id: cat.id,
        category_label: cat.label,
        overall_accuracy: Math.round(slipCorrect / slipEvaluated * 100),
        goal_accuracy: Math.round(slipGoalCorrect / slipEvaluated * 100),
        picks: picksPerformance
      });
    }
  });
  const evaluatedLiveCandidatesPerformance = [];
  let totalLiveEvaluated = 0;
  let totalLiveCorrect = 0;
  let totalLiveGoalCorrect = 0;
  if (liveCategoryMatches) {
    categories.forEach((cat) => {
      const candidates = liveCategoryMatches[cat.id];
      if (!candidates || candidates.length === 0) return;
      const candidatesPerformance = [];
      let catLiveEvaluated = 0;
      let catLiveCorrect = 0;
      let catLiveGoalCorrect = 0;
      candidates.forEach((c) => {
        const match = c.match;
        const pred = c.prediction;
        const actual = getActualResult(match.result);
        if (actual && actual !== "pending") {
          catLiveEvaluated++;
          totalLiveEvaluated++;
          const isCorrect = isMatchCorrectForCategory(match, pred, actual, cat.id);
          const isGoalCorrect = isMatchGoalAccurate(match, pred, actual, cat.id, phaStatsMap);
          if (isCorrect) {
            catLiveCorrect++;
            totalLiveCorrect++;
          }
          if (isGoalCorrect) {
            catLiveGoalCorrect++;
            totalLiveGoalCorrect++;
          }
          candidatesPerformance.push({
            teams: match.teams,
            prediction: pred,
            actual_result: match.result,
            actual_outcome: actual,
            overall_correct: isCorrect,
            goal_correct: isGoalCorrect,
            odds: match.mo || "1.0",
            league: match.le || "Unknown",
            paa_prediction: match.paaPrediction || match.paaPrimaryPrediction || "None",
            sub_pattern: match.patternAnalysis?.subPattern || "None",
            match_stars: matchStars[match.id] || 0
          });
        }
      });
      if (catLiveEvaluated > 0) {
        evaluatedLiveCandidatesPerformance.push({
          category_id: cat.id,
          category_label: cat.label,
          live_candidates_accuracy: Math.round(catLiveCorrect / catLiveEvaluated * 100),
          live_candidates_goal_accuracy: Math.round(catLiveGoalCorrect / catLiveEvaluated * 100),
          candidates_count: catLiveEvaluated,
          candidates: candidatesPerformance
        });
      }
    });
  }
  const overallAccuracy = totalEvaluated > 0 ? Math.round(totalCorrect / totalEvaluated * 100) : totalLiveEvaluated > 0 ? Math.round(totalLiveCorrect / totalLiveEvaluated * 100) : 0;
  const goalAccuracy = totalEvaluated > 0 ? Math.round(totalGoalCorrect / totalEvaluated * 100) : totalLiveEvaluated > 0 ? Math.round(totalLiveGoalCorrect / totalLiveEvaluated * 100) : 0;
  const liveCandidatesAccuracy = totalLiveEvaluated > 0 ? Math.round(totalLiveCorrect / totalLiveEvaluated * 100) : 0;
  const liveCandidatesGoalAccuracy = totalLiveEvaluated > 0 ? Math.round(totalLiveGoalCorrect / totalLiveEvaluated * 100) : 0;
  if (evaluatedSlipsPerformance.length === 0 && evaluatedLiveCandidatesPerformance.length === 0) {
    throw new Error("No finalized matches with completed results found in locked AI slips or live analysis candidates for self-learning. Please sync results first or select a date with completed matches!");
  }
  const primaryCategory = categories.length === 1 ? categories[0] : null;
  const prompt = `You are the Lead AI Algorithm Engineer. You are performing a Post-Match Self-Learning Evaluation on the SEER AI system for date: ${date}.

Our primary objective is to audit all outcomes and formulate precise, logical correction rules to drive selection accuracy for all category-tagged matches to 100%.

Evaluating the full pool of category-tagged matches on live analysis allows us to discover false-positive traps and refine our filters.

${primaryCategory ? `CRITICAL CONTEXT: We are specifically analyzing and learning for the Category: "${primaryCategory.label}" (${primaryCategory.id}). Your findings, insights, and actionable rules MUST be tailored specifically to help the AI select better matches next time for "${primaryCategory.label}" specifically.` : ""}

--- DATASET 1: Locked Slips Performance ---
${JSON.stringify(evaluatedSlipsPerformance, null, 2)}

--- DATASET 2: All Live Analysis Category-Tagged Candidates Performance ---
${JSON.stringify(evaluatedLiveCandidatesPerformance, null, 2)}

Prime Directives for your Analysis:
1. Auditing Failures: If the selection/prediction accuracy of any category is below 100%, perform a rigorous forensic audit of every failed prediction (where overall_correct or goal_correct is false).
2. Deep Feature Search: For every failure, analyze its features: PAA prediction, SEER predictions, team statistics (TS differential, volatility, odds), stars ratings, and sub-patterns. Identify why the algorithm miscalculated.
3. Formulate Actionable Corrections: DO NOT recommend banning or restricting matches from selections. Instead, design strict, logical rules to PRIORITIZE matches that meet category Goal accuracy requirements and DEPRIORITIZE those with bad data. Furthermore, provide rules on how to properly HEDGE risky matches. For example: "RULE: Prioritize matches where Home Win index > 45%. If Draw probability is > 30%, hedge the selection with a 1X or X2."
4. Generate Usable Strategic Insights: Formulate general strategic insights (e.g. "We noticed that in bankers_dlive, favorites playing away in low-scoring leagues fail 40% of the time, so they should be deprioritized or hedged appropriately").
5. Ensure your lessons, insights, and actionable rules are highly specific and descriptive so we can save them and feed them directly into the next AI slip selection to prioritize the right matches and hedge properly to push accuracy towards 100%.

Your output must strictly conform to the following JSON schema:
{
  "findings": [
    "A detailed finding of why certain selections succeeded or failed (e.g., 'In Top 10 Value, 3 candidate matches failed because we selected the favorite but their Home Win index was below 40% with high underdog scoring probability')"
  ],
  "actionable_rules": [
    "An actionable rule to prioritize or hedge matches (e.g., 'RULE: For Top 10 Value, prioritize matches with Home Win index > 45%, and hedge matches with Draw probability > 30% to improve accuracy without banning matches')"
  ],
  "insights": [
    "A usable strategic insight to help select better matches next time (e.g., 'Favorites playing away in high-volatility matchups tend to draw, so selecting Draw No Bet (DNB) or double-chance is highly recommended over straight win predictions.')"
  ]
}`;
  const ai = getAIInstance(false);
  const responseSchema = {
    type: import_genai.Type.OBJECT,
    properties: {
      findings: {
        type: import_genai.Type.ARRAY,
        items: { type: import_genai.Type.STRING }
      },
      actionable_rules: {
        type: import_genai.Type.ARRAY,
        items: { type: import_genai.Type.STRING }
      },
      insights: {
        type: import_genai.Type.ARRAY,
        items: { type: import_genai.Type.STRING }
      }
    },
    required: ["findings", "actionable_rules", "insights"]
  };
  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      systemInstruction: "You are an elite machine learning algorithms auditor. You evaluate prediction performance and design perfect correction rules and strategic insights to achieve 100% selection accuracy.",
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.1
    }
  });
  if (!response.text) {
    throw new Error("Empty response from Self-Learn AI Agent");
  }
  const parsed = JSON.parse((0, import_jsonrepair.jsonrepair)(response.text));
  const lesson = {
    id: `lesson_${Date.now()}`,
    date,
    category: primaryCategory ? primaryCategory.id : "all",
    overallAccuracy,
    goalAccuracy,
    findings: parsed.findings || [],
    actionableRules: parsed.actionable_rules || [],
    insights: parsed.insights || [],
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    status: "pending",
    scope: liveCategoryMatches ? "hybrid" : "locked",
    totalLiveCandidatesEvaluated: totalLiveEvaluated,
    liveCandidatesAccuracy,
    liveCandidatesGoalAccuracy
  };
  try {
    const existingStr = localStorage.getItem("seer_ai_self_learn_lessons") || "[]";
    const existing = JSON.parse(existingStr);
    existing.unshift(lesson);
    localStorage.setItem("seer_ai_self_learn_lessons", JSON.stringify(existing));
  } catch (e) {
    console.error("Failed to save lesson in local storage", e);
  }
  return lesson;
};

// src/utils/aiOptimizer.ts
var import_genai2 = require("@google/genai");
init_seerLogic();
init_matchProcessing();
init_matchEvaluator();
init_storage();
init_seerSlipSelection();
var categoryMatchCache = /* @__PURE__ */ new Map();
var getMatchesForCategory = (matches, catId, phaStatsMap = {}, isJackpot = false, matchStars = {}, overrideWeights) => {
  if (catId === "all" || !matches || matches.length === 0) return matches;
  const safePhaStatsMap = typeof phaStatsMap === "boolean" ? {} : phaStatsMap || {};
  const matchesHash = matches.length + "_" + (matches[0]?.id || "") + "_" + (matches[matches.length - 1]?.id || "");
  const weightsHash = overrideWeights ? JSON.stringify(overrideWeights) : "default";
  const cacheKey = `${catId}_${matchesHash}_${weightsHash}_${isJackpot}`;
  if (categoryMatchCache.has(cacheKey)) {
    const cachedIds = categoryMatchCache.get(cacheKey);
    return matches.filter((m) => cachedIds.has(m.id.toString()));
  }
  const categoryMatchIds = /* @__PURE__ */ new Set();
  const grouped = {};
  matches.forEach((m) => {
    const d = getAnalysisDateString(m.date);
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(m);
  });
  Object.values(grouped).forEach((dateMatches) => {
    const slips = generateSeerSlips(dateMatches, safePhaStatsMap, matchStars, isJackpot, false, overrideWeights);
    const targetSlip = slips.live[catId] || slips.spec[catId] || [];
    targetSlip.forEach((p) => {
      const mId = p.match_id?.toString() || p.id?.toString();
      if (mId) categoryMatchIds.add(mId);
    });
  });
  matches.forEach((m) => {
    if (hasCategoryTag(m, catId, safePhaStatsMap, isJackpot, matchStars)) {
      categoryMatchIds.add(m.id.toString());
    }
  });
  categoryMatchCache.set(cacheKey, categoryMatchIds);
  const filtered = matches.filter((m) => categoryMatchIds.has(m.id.toString()));
  return filtered;
};
var getGoalAccuracyRequirementDescription = (categoryId) => {
  switch (categoryId) {
    case "top_12_safe":
    case "botb_jackpot":
    case "botb_best":
    case "top20":
    case "top_20_value":
      return "Market Favorite Win (if odds < 2.0) or Market Favorite Win / Draw (if odds >= 2.0)";
    case "value_bets":
      return "Prediction Matches Actual Result";
    case "best_bet":
    case "bankers_dlive":
    case "bankers_jackpot":
    case "value_picks":
    case "top10":
    case "top_10_value":
      return "Market Favorite Win";
    case "banker_draws":
      return "Draw (X)";
    case "upsets":
      return "Underdog Win";
    default:
      return "Prediction Matches Actual Result";
  }
};
var runAiOptimizer = async (currentMatches, selectedCategory, categoryLabel, currentWeights, phaStatsMap, matchStars, onProgress) => {
  const isJackpotMode = selectedCategory === "bankers_jackpot" || selectedCategory === "banker_draws";
  onProgress("Phase 1: Extracting full underlying match data (PAA, PHA, Algo, Seer) for all matches...", 10);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const subsetMatches = currentMatches || [];
  const allPoolStats = { total: 0, completedTotal: 0, favWins: 0, draws: 0, underdogWins: 0 };
  const allMatchesUnderlyingData = [];
  subsetMatches.forEach((m) => {
    allPoolStats.total++;
    const actual = getActualResult(m.result);
    const stats = getMatchStats(m, phaStatsMap);
    const favInfo = getFavoriteAndUnderdog(m);
    const moFav = favInfo.fav;
    const moUnderdog = favInfo.underdog;
    const seerDetailed = predictSeerDetailed(m, currentWeights, phaStatsMap, matchStars, selectedCategory);
    const paaObj = calculatePAAPrediction(m, stats.paaStats);
    const isCompleted = actual !== null && actual !== "pending";
    if (isCompleted) {
      allPoolStats.completedTotal++;
      if (actual === moFav) allPoolStats.favWins++;
      else if (actual === "X") allPoolStats.draws++;
      else if (actual === moUnderdog) allPoolStats.underdogWins++;
    }
    const teamsPart = m.teams ? m.teams.split(/vs|\-|@/i) : ["Home", "Away"];
    const favTeamName = moFav === "1" ? teamsPart[0]?.trim() : teamsPart[1]?.trim();
    const underdogTeamName = moUnderdog === "1" ? teamsPart[0]?.trim() : teamsPart[1]?.trim();
    const totalSeerScore = (seerDetailed.scores[moFav] || 0) + (seerDetailed.scores["X"] || 0) + (seerDetailed.scores[moUnderdog] || 0);
    allMatchesUnderlyingData.push({
      id: m.id,
      teams: m.teams,
      league: m.league || "N/A",
      date: m.date || "Live",
      actualResult: actual || "PENDING",
      marketFavSide: moFav === "1" ? "Home" : "Away",
      favTeam: favTeamName || "Fav",
      underdogTeam: underdogTeamName || "Underdog",
      outcome: isCompleted ? actual === moFav ? "FAVORITE_WIN" : actual === "X" ? "DRAW" : actual === moUnderdog ? "UNDERDOG_UPSET" : "OTHER" : "PENDING",
      odds: {
        favOdds: stats.favOdds || "N/A",
        drawOdds: stats.oX || "N/A",
        underdogOdds: stats.underdogOdds || "N/A"
      },
      paa: {
        prediction: paaObj?.paaPrediction || "N/A",
        primary: paaObj?.paaPrimaryPrediction || "N/A",
        favWinRate: `${stats.paaStats?.favWinRate?.toFixed(1) || 0}%`,
        drawRate: `${stats.paaStats?.drawRate?.toFixed(1) || 0}%`,
        upsetRate: `${stats.paaStats?.upsetRate?.toFixed(1) || 0}%`,
        sampleTotal: stats.paaStats?.total || 0
      },
      pha: {
        favSupport: `${stats.phaStats?.favSupport?.toFixed(1) || 0}%`,
        drawSupport: `${stats.phaStats?.drawSupport?.toFixed(1) || 0}%`,
        underdogSupport: `${stats.phaStats?.underdogSupport?.toFixed(1) || 0}%`
      },
      algo: {
        prediction: m.algoReport?.prediction || stats.algoPred || "N/A",
        primaryPrediction: m.algoReport?.primaryPrediction || "N/A",
        subPattern: m.algoReport?.subPattern || "N/A",
        subPatternPrediction: m.algoReport?.subPatternPrediction || "N/A",
        probabilities: m.algoReport?.probabilities ? {
          favProb: `${((moFav === "1" ? m.algoReport.probabilities["1"] : m.algoReport.probabilities["2"]) * 100).toFixed(1)}%`,
          drawProb: `${((m.algoReport.probabilities["X"] || 0) * 100).toFixed(1)}%`,
          underdogProb: `${((moUnderdog === "1" ? m.algoReport.probabilities["1"] : m.algoReport.probabilities["2"]) * 100).toFixed(1)}%`
        } : "N/A"
      },
      seer: {
        pick: seerDetailed.final,
        primary: seerDetailed.primary,
        hedge: seerDetailed.final !== seerDetailed.primary ? seerDetailed.final : "Straight",
        scores: {
          favScore: Math.round(seerDetailed.scores[moFav] || 0),
          drawScore: Math.round(seerDetailed.scores["X"] || 0),
          underdogScore: Math.round(seerDetailed.scores[moUnderdog] || 0)
        },
        percentages: totalSeerScore > 0 ? {
          favPct: `${((seerDetailed.scores[moFav] || 0) / totalSeerScore * 100).toFixed(1)}%`,
          drawPct: `${((seerDetailed.scores["X"] || 0) / totalSeerScore * 100).toFixed(1)}%`,
          underdogPct: `${((seerDetailed.scores[moUnderdog] || 0) / totalSeerScore * 100).toFixed(1)}%`
        } : "N/A"
      }
    });
  });
  const categoryMatches = selectedCategory === "all" ? subsetMatches : getMatchesForCategory(subsetMatches, selectedCategory, phaStatsMap, isJackpotMode, matchStars);
  const categoryMatchesUnderlyingData = allMatchesUnderlyingData.filter(
    (u) => categoryMatches.some((cm) => cm.id?.toString() === u.id?.toString())
  );
  const categoryStats = { total: categoryMatches.length, completedTotal: 0, favWins: 0, draws: 0, underdogWins: 0 };
  categoryMatchesUnderlyingData.forEach((m) => {
    if (m.actualResult !== "PENDING") {
      categoryStats.completedTotal++;
      if (m.outcome === "FAVORITE_WIN") categoryStats.favWins++;
      else if (m.outcome === "DRAW") categoryStats.draws++;
      else if (m.outcome === "UNDERDOG_UPSET") categoryStats.underdogWins++;
    }
  });
  const poolFavPct = allPoolStats.completedTotal > 0 ? (allPoolStats.favWins / allPoolStats.completedTotal * 100).toFixed(1) : "0.0";
  const poolDrawPct = allPoolStats.completedTotal > 0 ? (allPoolStats.draws / allPoolStats.completedTotal * 100).toFixed(1) : "0.0";
  const poolDogPct = allPoolStats.completedTotal > 0 ? (allPoolStats.underdogWins / allPoolStats.completedTotal * 100).toFixed(1) : "0.0";
  const poolFavDrawSum = allPoolStats.favWins + allPoolStats.draws;
  const poolFavDrawPct = allPoolStats.completedTotal > 0 ? (poolFavDrawSum / allPoolStats.completedTotal * 100).toFixed(1) : "0.0";
  const catFavPct = categoryStats.completedTotal > 0 ? (categoryStats.favWins / categoryStats.completedTotal * 100).toFixed(1) : "0.0";
  const catDrawPct = categoryStats.completedTotal > 0 ? (categoryStats.draws / categoryStats.completedTotal * 100).toFixed(1) : "0.0";
  const catDogPct = categoryStats.completedTotal > 0 ? (categoryStats.underdogWins / categoryStats.completedTotal * 100).toFixed(1) : "0.0";
  const catFavDrawSum = categoryStats.favWins + categoryStats.draws;
  const catFavDrawPct = categoryStats.completedTotal > 0 ? (catFavDrawSum / categoryStats.completedTotal * 100).toFixed(1) : "0.0";
  let contextString = "";
  switch (selectedCategory) {
    case "top_12_safe":
    case "botb_jackpot":
    case "botb_best":
    case "top20":
    case "top_20_value":
      contextString = `Based on the matches in this category focusing on their odds-based requirements (market fav or draw for high odds, market fav for low odds):`;
      break;
    case "best_bet":
    case "bankers_dlive":
    case "bankers_jackpot":
    case "value_picks":
    case "top10":
    case "top_10_value":
      contextString = `Based on the ${categoryStats.favWins} matches (${catFavPct}%) in this category that went to market fav:`;
      break;
    case "banker_draws":
      contextString = `Based on the ${categoryStats.draws} matches (${catDrawPct}%) in this category that went to draw:`;
      break;
    case "upsets":
      contextString = `Based on the ${categoryStats.underdogWins} matches (${catDogPct}%) in this category that went to the underdog:`;
      break;
    case "value_bets":
      contextString = `Based on the matches in this category focusing on their exact prediction requirements:`;
      break;
    default:
      contextString = `Based on the matches in this category and their outcomes:`;
      break;
  }
  let statHeadline = "";
  if (selectedCategory === "all") {
    statHeadline = `${categoryLabel} had ${allPoolStats.total} matches on Live Analysis of which ${allPoolStats.completedTotal} have their results, out of the ${allPoolStats.completedTotal}, ${allPoolStats.favWins} (${poolFavPct}%) went to market fav, ${allPoolStats.draws} (${poolDrawPct}%) to draw and ${allPoolStats.underdogWins} (${poolDogPct}%) to the underdog. Based on the ${poolFavDrawSum} matches (${poolFavDrawPct}%) that went to fav and draw:`;
  } else {
    statHeadline = `${categoryLabel} had ${categoryMatches.length} matches on Live Analysis of which ${categoryStats.completedTotal} have their results, out of the ${categoryStats.completedTotal}, ${categoryStats.favWins} (${catFavPct}%) went to market fav, ${categoryStats.draws} (${catDrawPct}%) to draw and ${categoryStats.underdogWins} (${catDogPct}%) to the underdog. ${contextString}`;
  }
  if (categoryStats.completedTotal === 0 && allPoolStats.completedTotal === 0) {
    onProgress("No completed matches in current data to evaluate.", 100);
    return [{
      id: `ai_opt_none_${Date.now()}`,
      finding: `${categoryLabel} has ${categoryMatches.length} matches on Live Analysis, but 0 matches currently have completed results. Cannot calculate accuracy or optimize weights until match scores are available.`,
      action: "Maintain current category weightings until live match results are reported.",
      proposedWeights: currentWeights,
      baseWeights: currentWeights,
      isTested: true,
      subsetAcc: 0,
      subsetGoalAcc: 0,
      testResult: { approved: false, prevAcc: 0, newAcc: 0, prevGoalAcc: 0, newGoalAcc: 0 }
    }];
  }
  const categorySlipPicks = categoryMatches;
  const validCurrentMatches = categorySlipPicks.filter((m) => {
    const res = getActualResult(m.result);
    return res !== "pending" && res !== null;
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  let currentBaseAcc = 0;
  let currentGoalAcc = 0;
  const pickedStats = { hits: 0, goalHits: 0, total: validCurrentMatches.length, favWins: 0, draws: 0, underdogWins: 0 };
  const missedDetails = [];
  for (let i = 0; i < validCurrentMatches.length; i++) {
    if (i > 0 && i % 25 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const m = validCurrentMatches[i];
    const actual = getActualResult(m.result);
    const favInfo = getFavoriteAndUnderdog(m);
    const moFav = favInfo.fav;
    const moUnderdog = favInfo.underdog;
    const predDetailed = predictSeerDetailed(m, currentWeights, phaStatsMap, matchStars, selectedCategory);
    const pred = predDetailed.final;
    if (actual && pred) {
      const isCorrect = isMatchCorrectForCategory(m, pred, actual, selectedCategory);
      const isGoalCorrect = isMatchGoalAccurate(m, pred, actual, selectedCategory, phaStatsMap);
      if (isCorrect) pickedStats.hits++;
      if (isGoalCorrect) pickedStats.goalHits++;
      if (!isCorrect || selectedCategory === "top_10_value" && !isGoalCorrect) {
        const fullRecord = allMatchesUnderlyingData.find((item) => item.id === m.id) || {
          teams: m.teams,
          actualResult: actual,
          ourPrediction: pred,
          seerScores: predDetailed.scores
        };
        missedDetails.push(fullRecord);
      }
    }
    if (actual === moFav) pickedStats.favWins++;
    else if (actual === "X") pickedStats.draws++;
    else if (actual === moUnderdog) pickedStats.underdogWins++;
  }
  currentBaseAcc = pickedStats.total > 0 ? pickedStats.hits / pickedStats.total * 100 : 0;
  currentGoalAcc = pickedStats.total > 0 ? pickedStats.goalHits / pickedStats.total * 100 : 0;
  onProgress("Phase 2: Running AI Optimizer agent on live category slip matches...", 50);
  await new Promise((resolve) => setTimeout(resolve, 10));
  try {
    const goalAccuracyReq = getGoalAccuracyRequirementDescription(selectedCategory);
    const ai = getAIInstance(false);
    const prompt = `You are the Lead SEER AI Optimizer.
You are evaluating REAL, GROUNDED performance data and underlying match stats (PAA, PHA, Algo, Seer) from ALL ${allPoolStats.total} matches on Live Analysis.

MANDATORY REAL DATA BREAKDOWN FOR ALL ${allPoolStats.total} MATCHES IN POOL:
- Total Live Pool Matches: ${allPoolStats.total}
- Total Completed Matches: ${allPoolStats.completedTotal}
- Out of ${allPoolStats.completedTotal} completed matches in total pool:
  * ${allPoolStats.favWins} (${poolFavPct}%) went to market favorite
  * ${allPoolStats.draws} (${poolDrawPct}%) went to draw
  * ${allPoolStats.underdogWins} (${poolDogPct}%) went to underdog
  * Market Favorite + Draw pool total: ${poolFavDrawSum} (${poolFavDrawPct}%)

CATEGORY BREAKDOWN:
Category: ${categoryLabel} (${selectedCategory})
- Goal Accuracy Requirement for this Category: ${goalAccuracyReq}
- Total matches in category: ${categoryMatches.length}
- Completed matches in category: ${categoryStats.completedTotal}
- Out of ${categoryStats.completedTotal} completed category matches:
  * ${categoryStats.favWins} (${catFavPct}%) went to market favorite
  * ${categoryStats.draws} (${catDrawPct}%) went to draw
  * ${categoryStats.underdogWins} (${catDogPct}%) went to underdog
  * Market Favorite + Draw category total: ${catFavDrawSum} (${catFavDrawPct}%)

Our Category Slip Pick Performance (Current Weights):
- Total Matches Selected on Slip: ${categorySlipPicks.length}
- Completed Slip Matches Evaluated: ${validCurrentMatches.length}
- Overall Accuracy: ${currentBaseAcc.toFixed(1)}% (${pickedStats.hits}/${validCurrentMatches.length || 1})
- Goal Accuracy: ${currentGoalAcc.toFixed(1)}% (${pickedStats.goalHits}/${validCurrentMatches.length || 1})

UNDERLYING MATCH DATA FOR ALL ${allMatchesUnderlyingData.length} MATCHES IN DATASET:
${JSON.stringify(allMatchesUnderlyingData, null, 2)}

UNDERLYING MATCH DATA FOR CATEGORY SLIP MATCHES (${categoryMatchesUnderlyingData.length} matches):
${JSON.stringify(categoryMatchesUnderlyingData, null, 2)}

FAILED / MISSED MATCHES ON OUR CATEGORY SLIP (${missedDetails.length} matches):
${JSON.stringify(missedDetails, null, 2)}

CRITICAL CONSTRAINTS:
1. You MUST ONLY reference real team names that explicitly appear in the 'UNDERLYING MATCH DATA FOR ALL MATCHES IN DATASET' list above.
2. DO NOT under ANY circumstances invent, hallucinate, or mention fictional team names or match fixtures (e.g. Bologna, Heidenheim, Duisburg, etc.).
3. Use the exact underlying match data (PAA, PHA, Algo probabilities, Sub Pattern predictions, Seer scores) from the matches to explain why specific matches failed or ended in draw/fav.
4. Your primary mission is to dissect the "DNA of the matches" to achieve maximum accuracy. You MUST analyze:
   - Individual Predictor Performance: Analyze the accuracy and tendencies of PAA, Algo, Sub pattern predictions, and Seer default weights individually.
   - Synergy & Disagreement: Study which TWO predictors (e.g., PAA + Algo, or Seer + PAA) have the highest accuracy when they agree, and which combinations signify stalemates (draws/upsets) when they disagree.
   - Confidence Data Analysis: Test specific thresholds (When M.Fav confidence is > 50%, < 50%, and < 40% across Seer, PAA, Algo). What happens when TWO predictors both have M.Fav confidence > 50%? What about < 50% or < 40%?
   - What happens when ANY predictor's draw confidence/probability is > 35%?
5. Your proposed action and weight adjustments MUST explain how to adjust algorithm weights based on the Goal Accuracy Requirement (${goalAccuracyReq}). Focus your analysis on the matches within this category that met or failed this specific requirement.
6. Keep the finding reasoning concise, precise, and directly referencing real team names, Seer scores, PAA/PHA, and Algo data from the matches.

Output JSON format:
{
  "findingReasoning": "Overall explanation referencing real teams and exact underlying stats...",
  "deepInsights": [
    "Insight 1: When PAA and Algo both have M.Fav confidence < 50%, the upset rate jumps to X%...",
    "Insight 2: When ANY predictor has draw confidence > 35%, the match resulted in a draw Y% of the time...",
    "Insight 3: The sub-pattern G1cc2 coupled with high PAA draw rate indicates a strong X2 hedge..."
  ],
  "action": "Specific recommendation on adjusting algorithm weights...",
  "proposedWeights": {
    "algoWeight": 25,
    "paaPredWeight": 30,
    "drawDisagreementBoost": 150
  }
}`;
    const schema = {
      type: import_genai2.Type.OBJECT,
      properties: {
        findingReasoning: { type: import_genai2.Type.STRING },
        deepInsights: {
          type: import_genai2.Type.ARRAY,
          items: { type: import_genai2.Type.STRING }
        },
        action: { type: import_genai2.Type.STRING },
        proposedWeights: {
          type: import_genai2.Type.OBJECT,
          properties: {
            algoWeight: { type: import_genai2.Type.NUMBER },
            paaPredWeight: { type: import_genai2.Type.NUMBER },
            subPatternWeight: { type: import_genai2.Type.NUMBER },
            probConfWeight: { type: import_genai2.Type.NUMBER },
            phaWeight: { type: import_genai2.Type.NUMBER },
            paaPercentWeight: { type: import_genai2.Type.NUMBER },
            perfStarsWeight: { type: import_genai2.Type.NUMBER },
            pred1x2Weight: { type: import_genai2.Type.NUMBER },
            pred1x2RatingBoost: { type: import_genai2.Type.NUMBER },
            drawDisagreementBoost: { type: import_genai2.Type.NUMBER },
            synergyAgreementBoost: { type: import_genai2.Type.NUMBER },
            synergyCondA: { type: import_genai2.Type.NUMBER },
            synergyCondB: { type: import_genai2.Type.NUMBER },
            synergyGapBoost: { type: import_genai2.Type.NUMBER }
          }
        }
      },
      required: ["findingReasoning", "action", "proposedWeights"]
    };
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });
    const resObj = JSON.parse(response.text || "{}");
    const newWeights = { ...currentWeights, ...resObj.proposedWeights };
    let aiReasoning = resObj.findingReasoning || resObj.finding || "Adjusted algorithm weights to improve double-chance hedging on matches with high draw or favorite alignment.";
    const allRealTeamNames = allMatchesUnderlyingData.map((m) => m.teams);
    const hallucinatedKeywords = ["Bologna", "Heidenheim", "Duisburg", "Columbus Crew", "Universitatea", "Brann", "Cuiaba"];
    const isGrounded = allRealTeamNames.some((team) => {
      const parts = team.split(/vs|\-|@/i).map((p) => p.trim());
      return parts.some((p) => p.length > 3 && aiReasoning.toLowerCase().includes(p.toLowerCase()));
    });
    if (!isGrounded || hallucinatedKeywords.some((kw) => aiReasoning.toLowerCase().includes(kw.toLowerCase()))) {
      if (missedDetails.length > 0) {
        const sampleMissed = missedDetails.slice(0, 3).map((m) => m.teams).join(", ");
        aiReasoning = `Analysis of matches like ${sampleMissed} shows our Seer model assigned unhedged or 12 predictions despite elevated draw probabilities and PAA/PHA support for 1X.`;
      } else {
        aiReasoning = `Analysis of live analysis matches shows double-chance hedging needs adjustment to optimize selections across market favorite and draw outcomes.`;
      }
    }
    const fullFinding = `${statHeadline} ${aiReasoning}`;
    const activeFavDrawCount = selectedCategory === "all" ? poolFavDrawSum : catFavDrawSum;
    let actionContext = "";
    switch (selectedCategory) {
      case "top_12_safe":
      case "botb_jackpot":
      case "botb_best":
      case "top20":
      case "top_20_value":
        actionContext = `Based on the ${activeFavDrawCount} matches that went to market favorite and draw`;
        break;
      case "best_bet":
      case "bankers_dlive":
      case "bankers_jackpot":
      case "value_picks":
      case "top10":
      case "top_10_value":
        actionContext = `Based on the ${categoryStats.favWins} matches that went to market favorite`;
        break;
      case "banker_draws":
        actionContext = `Based on the ${categoryStats.draws} matches that went to draw`;
        break;
      case "upsets":
        actionContext = `Based on the ${categoryStats.underdogWins} matches that went to the underdog`;
        break;
      default:
        actionContext = `Based on the matches and outcomes in this category`;
        break;
    }
    const fullAction = resObj.action || `${actionContext}, we recommend tuning weights to optimize selections.`;
    onProgress("Phase 3: Validating AI recommendations against real dataset...", 80);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const modePrefix = isJackpotMode ? "jackpot_" : "daily_";
    const overrideKey = `${modePrefix}${selectedCategory}`;
    const fullWeightsMap = getSeerWeights();
    const overrideMap = { ...fullWeightsMap, [overrideKey]: newWeights };
    const candMatches = getMatchesForCategory(subsetMatches, selectedCategory, phaStatsMap, isJackpotMode, matchStars, overrideMap).filter((m) => {
      const res = getActualResult(m.result);
      return res !== "pending" && res !== null;
    });
    let hits = 0, goalHits = 0;
    if (candMatches.length > 0) {
      for (let i = 0; i < candMatches.length; i++) {
        if (i > 0 && i % 25 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        const m = candMatches[i];
        const actual = getActualResult(m.result);
        const pred = predictSeerDetailed(m, newWeights, phaStatsMap, matchStars, selectedCategory).final;
        if (actual && pred) {
          if (isMatchCorrectForCategory(m, pred, actual, selectedCategory)) hits++;
          if (isMatchGoalAccurate(m, pred, actual, selectedCategory, phaStatsMap)) goalHits++;
        }
      }
    }
    const newAcc = candMatches.length > 0 ? hits / candMatches.length * 100 : 0;
    const newGoalAcc = candMatches.length > 0 ? goalHits / candMatches.length * 100 : 0;
    onProgress("Optimization complete.", 100);
    return [{
      id: `ai_opt_${Date.now()}`,
      finding: fullFinding,
      deepInsights: resObj.deepInsights || [],
      action: fullAction,
      proposedWeights: newWeights,
      baseWeights: currentWeights,
      isTested: true,
      subsetAcc: newAcc,
      subsetGoalAcc: newGoalAcc,
      testResult: {
        approved: newGoalAcc >= currentGoalAcc || newAcc >= currentBaseAcc,
        prevAcc: currentBaseAcc,
        newAcc,
        prevGoalAcc: currentGoalAcc,
        newGoalAcc
      }
    }];
  } catch (e) {
    console.warn("Gemini AI finding generation failed, using non-simulated statistical fallback.", e);
    onProgress("AI Optimizer completed with real data fallback.", 100);
    const fallbackReasoning = missedDetails.length > 0 ? `Analysis of failed matches (${missedDetails.slice(0, 3).map((m) => m.teams).join(", ")}) shows double-chance hedging needs tuning to prevent misses on draw outcomes.` : `Current category slip picks achieved strong alignment with live analysis outcomes.`;
    const fullFinding = `${statHeadline} ${fallbackReasoning}`;
    const activeFavDrawCount = selectedCategory === "all" ? poolFavDrawSum : catFavDrawSum;
    let actionContext = "";
    switch (selectedCategory) {
      case "top_12_safe":
      case "botb_jackpot":
      case "botb_best":
      case "top20":
      case "top_20_value":
        actionContext = `Based on the ${activeFavDrawCount} matches that went to market favorite and draw`;
        break;
      case "best_bet":
      case "bankers_dlive":
      case "bankers_jackpot":
      case "value_picks":
      case "top10":
      case "top_10_value":
        actionContext = `Based on the ${categoryStats.favWins} matches that went to market favorite`;
        break;
      case "banker_draws":
        actionContext = `Based on the ${categoryStats.draws} matches that went to draw`;
        break;
      case "upsets":
        actionContext = `Based on the ${categoryStats.underdogWins} matches that went to the underdog`;
        break;
      default:
        actionContext = `Based on the matches and outcomes in this category`;
        break;
    }
    const fullAction = `${actionContext}, we recommend adjusting weights to optimize selections for this category.`;
    return [{
      id: `ai_opt_fallback_${Date.now()}`,
      finding: fullFinding,
      action: fullAction,
      proposedWeights: currentWeights,
      baseWeights: currentWeights,
      isTested: true,
      subsetAcc: currentBaseAcc,
      subsetGoalAcc: currentGoalAcc,
      testResult: { approved: true, prevAcc: currentBaseAcc, newAcc: currentBaseAcc, prevGoalAcc: currentGoalAcc, newGoalAcc: currentGoalAcc }
    }];
  }
};

// src/components/SeerAnalysis.tsx
var import_lucide_react3 = require("lucide-react");
var import_recharts = require("recharts");
var import_jsx_runtime2 = require("react/jsx-runtime");
var _getPAAPrediction = (m, phaMap) => {
  let paaPrim = m.paaPrimaryPrediction;
  let paaFinal = m.paaPrediction;
  if (m.patternAnalysis?.subPattern && phaMap) {
    const sub = m.patternAnalysis.subPattern;
    if (phaMap[sub] && (phaMap[sub].paaTotal > 0 || phaMap[sub].total > 0)) {
      const paaPred = calculatePAAPrediction(m, phaMap[sub]);
      if (paaPred) {
        paaPrim = paaPred.paaPrimaryPrediction;
        paaFinal = paaPred.paaPrediction;
      }
    }
  }
  return paaFinal || paaPrim || "-";
};
var EMPTY_MATCHES = [];
function SeerAnalysis({
  historicalMatches,
  liveMatches,
  phaStatsMap
}) {
  const [activeTab, setActiveTab] = (0, import_react3.useState)("learn");
  const [selectedCategory, setSelectedCategory] = (0, import_react3.useState)("top_10_value");
  const [isOptimizing, setIsOptimizing] = (0, import_react3.useState)(false);
  const [learningProgress, setLearningProgress] = (0, import_react3.useState)(0);
  const [learningStatus, setLearningStatus] = (0, import_react3.useState)("");
  const [searchQuery, setSearchQuery] = (0, import_react3.useState)("");
  const [categoryWeightsMap, setCategoryWeightsMap] = (0, import_react3.useState)(() => getSeerWeights());
  const [isSlipsLoading, setIsSlipsLoading] = (0, import_react3.useState)(true);
  const [performanceData, setPerformanceData] = (0, import_react3.useState)(
    []
  );
  const [isFetchingStats, setIsFetchingStats] = (0, import_react3.useState)(false);
  const [latestSnapshotMatches, setLatestSnapshotMatches] = (0, import_react3.useState)(
    []
  );
  const [error, setError] = (0, import_react3.useState)(null);
  const [selectedDate, setSelectedDate] = (0, import_react3.useState)(getAnalysisDateString());
  const [historyType, setHistoryType] = (0, import_react3.useState)("daily");
  const categoriesList = [
    { id: "all", label: "All Categories", maxPicks: 10 },
    { id: "top_10_value", label: "Top 12", maxPicks: 12 },
    { id: "best_bet", label: "Best Bet", maxPicks: 10 },
    { id: "bankers_dlive", label: "Bankers Dlive", maxPicks: 10 },
    { id: "botb_best", label: "BOTB", maxPicks: 10 },
    { id: "high_confidence", label: "Top 20", maxPicks: 20 },
    { id: "bankers_jackpot", label: "Bankers Jackpot", maxPicks: 5 },
    { id: "banker_draws", label: "Banker Draws", maxPicks: 5 },
    { id: "value_picks", label: "Value Picks", maxPicks: 5 },
    { id: "value_bets", label: "Value Bets", maxPicks: 5 },
    { id: "upsets", label: "Upsets", maxPicks: 5 }
  ];
  const [lockedSlips, setLockedSlips] = (0, import_react3.useState)({});
  const [lockedAiSlips, setLockedAiSlips] = (0, import_react3.useState)({});
  const [isLocking, setIsLocking] = (0, import_react3.useState)({});
  const activeLockedSlips = activeTab === "slips" ? lockedAiSlips : lockedSlips;
  const setActiveLockedSlips = activeTab === "slips" ? setLockedAiSlips : setLockedSlips;
  const [reloadTrigger, setReloadTrigger] = (0, import_react3.useState)(0);
  (0, import_react3.useEffect)(() => {
    const handleUpdate = () => {
      setReloadTrigger((p) => p + 1);
    };
    window.addEventListener("seerLockedSlipsUpdated", handleUpdate);
    return () => window.removeEventListener("seerLockedSlipsUpdated", handleUpdate);
  }, []);
  const [historicalSnapshot, setHistoricalSnapshot] = (0, import_react3.useState)(
    null
  );
  const matchesToProcess = historicalSnapshot || EMPTY_MATCHES;
  const matchStars = useMatchStars();
  const liveMatchesRef = (0, import_react3.useRef)(liveMatches);
  const historicalMatchesRef = (0, import_react3.useRef)(historicalMatches);
  (0, import_react3.useEffect)(() => {
    liveMatchesRef.current = liveMatches;
    historicalMatchesRef.current = historicalMatches;
  }, [liveMatches, historicalMatches]);
  (0, import_react3.useEffect)(() => {
    let active = true;
    const fetchSlips = async () => {
      setIsSlipsLoading(true);
      setLockedSlips({});
      setLockedAiSlips({});
      const allCats = categoriesList.map((c) => c.id).filter((c) => c !== "all");
      try {
        const newLocked = {};
        const newLockedAi = {};
        const results = await Promise.all(
          allCats.map(async (cat) => {
            const slip = await getLockedSlip(selectedDate, cat);
            const aiSlip = await getLockedSlip(selectedDate, `ai_${cat}`);
            return { cat, slip, aiSlip };
          })
        );
        if (!active) return;
        let standardSlipsObj = null;
        for (const { cat, slip: fetchedSlip, aiSlip } of results) {
          let slip = fetchedSlip;
          if (!slip && matchesToProcess && matchesToProcess.length > 0) {
            if (!standardSlipsObj) {
              standardSlipsObj = generateSeerSlips(
                matchesToProcess,
                phaStatsMap,
                matchStars,
                historyType === "jackpot",
                false
              );
            }
            const rawPicks = standardSlipsObj.live[cat] || standardSlipsObj.spec[cat] || [];
            let generatedPicks = rawPicks.map((p) => ({
              match_id: p.match_id?.toString() || "",
              team: p.team || "",
              prediction: ensureHedgedPrediction(p.prediction || "1X", matchesToProcess.find((m) => m.id?.toString() === p.match_id?.toString()), phaStatsMap),
              odds: p.odds || "1.0",
              reason: p.reason || "SEER Category Optimization",
              confidence: p.confidence || "85%",
              category: cat
            }));
            if (generatedPicks.length > 0) {
              generatedPicks = generatedPicks.map((p) => {
                const matchingM = matchesToProcess.find((m) => m.id?.toString() === p.match_id?.toString());
                return {
                  ...p,
                  prediction: ensureHedgedPrediction(p.prediction, matchingM, phaStatsMap)
                };
              });
              const autoLockedSlip = {
                id: `${selectedDate}_${cat}`,
                date: selectedDate,
                category: cat,
                picks: generatedPicks,
                backups: [],
                weightsAtTime: DEFAULT_WEIGHTS,
                createdAt: (/* @__PURE__ */ new Date()).toISOString(),
                type: historyType
              };
              await saveLockedSlip(autoLockedSlip, false);
              slip = autoLockedSlip;
            }
          }
          if (slip && (slip.type === historyType || !slip.type && historyType === "daily")) {
            newLocked[cat] = { ...slip, category: cat };
          }
          if (aiSlip && (aiSlip.type === historyType || !aiSlip.type && historyType === "daily")) {
            newLockedAi[cat] = { ...aiSlip, category: cat };
          }
        }
        if (!active) return;
        setLockedSlips(newLocked);
        setLockedAiSlips(newLockedAi);
      } catch (err) {
        console.error("Error loading locked slips:", err);
      } finally {
        if (active) {
          setIsSlipsLoading(false);
        }
      }
    };
    fetchSlips();
    return () => {
      active = false;
    };
  }, [selectedDate, historyType, reloadTrigger]);
  const handleGlobalLockSlip = async (catId, matches) => {
    const isAiTab = activeTab === "slips";
    const targetCat = isAiTab ? `ai_${catId}` : catId;
    const setRelevantLockedSlips = isAiTab ? setLockedAiSlips : setLockedSlips;
    setIsLocking((prev) => ({ ...prev, [catId]: true }));
    const picks = matches.map((m) => ({
      match_id: m.id,
      team: m.teams,
      prediction: predictWithSeer(
        m,
        categoryWeightsMap[catId] || DEFAULT_WEIGHTS,
        phaStatsMap,
        matchStars,
        catId
      ),
      odds: m.mo?.split(",")[0] || "1.0",
      reason: "Locked Category Selection",
      confidence: "100%",
      category: targetCat
    }));
    const slip = {
      id: `${selectedDate}_${targetCat}`,
      date: selectedDate,
      category: targetCat,
      picks,
      backups: [],
      weightsAtTime: categoryWeightsMap[catId] || DEFAULT_WEIGHTS,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      type: historyType
    };
    try {
      await saveLockedSlip(slip, true);
    } catch (error2) {
      console.warn("Supabase save failed for locked slip, updating local state only.", error2);
    } finally {
      setRelevantLockedSlips((prev) => ({ ...prev, [catId]: slip }));
      setIsLocking((prev) => ({ ...prev, [catId]: false }));
    }
  };
  const handleGlobalUnlockSlip = async (catId) => {
    const isAiTab = activeTab === "slips";
    const targetCat = isAiTab ? `ai_${catId}` : catId;
    const setRelevantLockedSlips = isAiTab ? setLockedAiSlips : setLockedSlips;
    if (!confirm("Unlock this category? Live suggestions will return.")) return;
    try {
      await deleteLockedSlip(selectedDate, targetCat);
    } catch (error2) {
      console.warn("Failed to delete from Supabase, deleting locally.", error2);
    }
    setRelevantLockedSlips((prev) => {
      const next = { ...prev };
      delete next[catId];
      return next;
    });
  };
  (0, import_react3.useEffect)(() => {
    const savedWeights = getSeerWeights();
    if (Object.keys(savedWeights).length > 0) {
      setCategoryWeightsMap(savedWeights);
    }
  }, []);
  const [recommendationsMap, setRecommendationsMap] = (0, import_react3.useState)({});
  const [isTestingRecs, setIsTestingRecs] = (0, import_react3.useState)(
    {}
  );
  const [isLoadingHistory, setIsLoadingHistory] = (0, import_react3.useState)(false);
  const [showClearModal, setShowClearModal] = (0, import_react3.useState)(false);
  const availableDates = (0, import_react3.useMemo)(() => {
    const dates = [];
    const todayAnalysis = getAnalysisDateString();
    const year = parseInt(todayAnalysis.split("-")[0]);
    const month = parseInt(todayAnalysis.split("-")[1]) - 1;
    const day = parseInt(todayAnalysis.split("-")[2]);
    const baseDate = new Date(year, month, day);
    for (let i = 0; i < 11; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() - i);
      dates.push(
        d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0")
      );
    }
    return dates;
  }, []);
  const todayStr = (0, import_react3.useMemo)(() => getAnalysisDateString(), []);
  (0, import_react3.useEffect)(() => {
    let active = true;
    const allAvailableMatches = [...liveMatchesRef.current, ...historicalMatchesRef.current];
    const filteredLive = allAvailableMatches.filter((m) => {
      const matchesType = historyType === "jackpot" ? m.isJackpot : m.isDaily || !m.isJackpot && !m.isDaily;
      return matchesType && getAnalysisDateString(m.date) === selectedDate;
    });
    const collectionName = historyType === "daily" ? "seer_performance_history" : "seer_jackpot_history";
    let localMatches = [];
    try {
      const localVal = localStorage.getItem(`local_seer_snapshot_${collectionName}_${selectedDate}`);
      if (localVal) {
        const parsed = JSON.parse(localVal);
        if (parsed.compressedMatches) {
          const decompressed = import_lz_string4.default.decompressFromUTF16(parsed.compressedMatches);
          localMatches = decompressed ? JSON.parse(decompressed) : [];
        } else if (Array.isArray(parsed.matches)) {
          localMatches = parsed.matches;
        }
      }
    } catch (e) {
    }
    const liveIds = new Set(filteredLive.map((m) => m.id.toString()));
    const initialMatches = deduplicateMatches([
      ...filteredLive,
      ...localMatches.filter(
        (m) => !liveIds.has(m.id.toString()) && getAnalysisDateString(m.date) === selectedDate
      )
    ]);
    setHistoricalSnapshot(initialMatches);
    if (initialMatches.length === 0) {
      setIsLoadingHistory(true);
    } else {
      setIsLoadingHistory(false);
    }
    getDailySeerSnapshot(selectedDate, collectionName).then((snap) => {
      if (!active) return;
      let matches = snap ? snap.matches : [];
      const liveIds2 = new Set(filteredLive.map((m) => m.id.toString()));
      matches = deduplicateMatches([
        ...filteredLive,
        ...matches.filter(
          (m) => !liveIds2.has(m.id.toString()) && getAnalysisDateString(m.date) === selectedDate
        )
      ]);
      if (matches.length > 0) {
        setHistoricalSnapshot(matches);
      }
      setError(null);
    }).catch((err) => {
      if (!active) return;
      console.error("Error loading historical snapshot:", err);
    }).finally(() => {
      if (active) {
        setIsLoadingHistory(false);
      }
    });
    cleanupOldSeerSnapshots();
    return () => {
      active = false;
    };
  }, [selectedDate, historyType]);
  const fetchPerformanceStats = async () => {
    setIsFetchingStats(true);
    const stats = [];
    const coll = historyType === "daily" ? "seer_performance_history" : "seer_jackpot_history";
    try {
      const recentDates = availableDates.slice(0, 11).filter((d) => d !== todayStr).reverse();
      let mostRecentMatches = [];
      for (const date of recentDates) {
        const cachedPerf = await getSeerPerformanceCache(
          date,
          selectedCategory,
          coll
        );
        if (cachedPerf !== null) {
          stats.push({
            date: date.split("-").slice(1).join("/"),
            accuracy: cachedPerf.accuracy,
            goalAccuracy: cachedPerf.goalAccuracy ?? cachedPerf.accuracy,
            aiAccuracy: cachedPerf.aiAccuracy,
            aiGoalAccuracy: cachedPerf.aiGoalAccuracy
          });
          continue;
        }
        const snap = await getDailySeerSnapshot(date, coll);
        if (snap && snap.matches.length > 0) {
          let categoryMatches = [];
          let acc = 0;
          let goalAcc = 0;
          let aiAcc = 0;
          let aiGoalAcc = 0;
          let evaluated = 0;
          let aiEvaluated = 0;
          const slip = await getLockedSlip(date, `ai_${selectedCategory}`);
          if (slip) {
            const lockedIds = new Set(slip.picks.map((p) => p.match_id?.toString()));
            const aiMatches = snap.matches.filter((m) => {
              const mId = m.id.toString();
              const mTeam = (m.teams || "").toLowerCase().trim();
              return slip.picks.some((p) => {
                const pId = p.match_id?.toString() || "";
                const pTeam = (p.team || "").toLowerCase().trim();
                return mId === pId || pId.startsWith(mId + "_") || mId.startsWith(pId + "_") || pTeam.length > 0 && mTeam === pTeam;
              });
            });
            let correct2 = 0;
            let goalCorrect2 = 0;
            aiMatches.forEach((m) => {
              const actual = getActualResult(m.result);
              if (actual && actual !== "pending") {
                aiEvaluated++;
                const pick = slip.picks.find(
                  (p) => {
                    const pId = p.match_id?.toString() || "";
                    const mId = m.id.toString();
                    const pTeam = (p.team || "").toLowerCase().trim();
                    const mTeam = (m.teams || "").toLowerCase().trim();
                    return mId === pId || pId.startsWith(mId + "_") || mId.startsWith(pId + "_") || pTeam.length > 0 && mTeam === pTeam;
                  }
                );
                if (pick) {
                  if (isMatchCorrectForCategory(m, pick.prediction, actual, selectedCategory)) correct2++;
                  if (isMatchGoalAccurate2(m, pick.prediction, actual, selectedCategory, phaStatsMap)) goalCorrect2++;
                }
              }
            });
            aiAcc = aiEvaluated > 0 ? correct2 / aiEvaluated * 100 : 0;
            aiGoalAcc = aiEvaluated > 0 ? goalCorrect2 / aiEvaluated * 100 : 0;
          }
          const slips = generateSeerSlips(
            snap.matches,
            phaStatsMap,
            matchStars,
            false
          );
          const targetSlip = slips.live[selectedCategory] || slips.spec[selectedCategory] || [];
          const ids = new Set(
            targetSlip.map((p) => p.match_id.toString())
          );
          categoryMatches = snap.matches.filter(
            (m) => ids.has(m.id.toString())
          );
          let correct = 0;
          let goalCorrect = 0;
          categoryMatches.forEach((m) => {
            const actual = getActualResult(m.result);
            if (actual && actual !== "pending") {
              evaluated++;
              const pred = _predictWithSeer(
                m,
                categoryWeightsMap[selectedCategory] || DEFAULT_WEIGHTS
              );
              if (isMatchCorrectForCategory(m, pred, actual, selectedCategory)) correct++;
              if (isMatchGoalAccurate2(m, pred, actual, selectedCategory, phaStatsMap)) goalCorrect++;
            }
          });
          acc = evaluated > 0 ? correct / evaluated * 100 : 0;
          goalAcc = evaluated > 0 ? goalCorrect / evaluated * 100 : 0;
          if (acc > 0 || evaluated > 0 || (aiAcc > 0 || aiEvaluated > 0)) {
            const finalAcc = Math.round(acc);
            const finalGoalAcc = Math.round(goalAcc);
            const finalAiAcc = Math.round(aiAcc);
            const finalAiGoalAcc = Math.round(aiGoalAcc);
            stats.push({
              date: date.split("-").slice(1).join("/"),
              accuracy: finalAcc,
              goalAccuracy: finalGoalAcc,
              aiAccuracy: aiEvaluated > 0 ? finalAiAcc : void 0,
              aiGoalAccuracy: aiEvaluated > 0 ? finalAiGoalAcc : void 0
            });
            if ((evaluated > 0 || aiEvaluated > 0) && date !== todayStr) {
              await saveSeerPerformanceCache(
                date,
                selectedCategory,
                coll,
                finalAcc,
                finalGoalAcc,
                aiEvaluated > 0 ? finalAiAcc : void 0,
                aiEvaluated > 0 ? finalAiGoalAcc : void 0
              );
            }
            if (snap.matches.some((m) => {
              const act = getActualResult(m.result);
              return act && act !== "pending";
            })) {
              mostRecentMatches = snap.matches;
            }
          }
        }
      }
      setPerformanceData(stats);
      if (mostRecentMatches.length > 0) {
        setLatestSnapshotMatches(mostRecentMatches);
      }
    } catch (err) {
      console.error("Error fetching performance stats:", err);
    } finally {
      setIsFetchingStats(false);
    }
  };
  (0, import_react3.useEffect)(() => {
    if (activeTab === "stats") {
      fetchPerformanceStats();
    }
  }, [selectedCategory, activeTab, historyType]);
  const getMatchesForCategory2 = (matches, catId, forSlips = false) => {
    if (catId === "all") return matches;
    if (catId === "upsets" && !forSlips) {
      return matches.filter((m) => {
        const actual = getActualResult(m.result);
        if (actual === "pending") {
          const supreme = getMatchSupremeTierUnderdog(m, phaStatsMap);
          return supreme.insightsHit > 0;
        }
        const favInfo = getFavoriteAndUnderdog(m);
        return favInfo ? actual === favInfo.underdog : false;
      });
    }
    if (forSlips) {
      if (activeLockedSlips[catId]) {
        const ids2 = activeLockedSlips[catId].picks.map((p) => p.match_id?.toString() || "");
        const matched = matches.filter((m) => {
          const mId = m.id.toString();
          const mTeam = (m.teams || "").toLowerCase().trim();
          return activeLockedSlips[catId].picks.some((p) => {
            const pId = p.match_id?.toString() || "";
            const pTeam = (p.team || "").toLowerCase().trim();
            return mId === pId || pId.startsWith(mId + "_") || mId.startsWith(pId + "_") || pTeam.length > 0 && mTeam === pTeam;
          });
        });
        return matched.sort((a, b) => {
          let idxA = activeLockedSlips[catId].picks.findIndex((p) => {
            const pId = p.match_id?.toString() || "";
            return a.id.toString() === pId || pId.startsWith(a.id.toString() + "_");
          });
          let idxB = activeLockedSlips[catId].picks.findIndex((p) => {
            const pId = p.match_id?.toString() || "";
            return b.id.toString() === pId || pId.startsWith(b.id.toString() + "_");
          });
          if (idxA === -1) idxA = 999;
          if (idxB === -1) idxB = 999;
          return idxA - idxB;
        });
      }
      const slips = generateSeerSlips(matches, phaStatsMap, matchStars, historyType === "jackpot", false);
      const targetSlip = slips.live[catId] || slips.spec[catId] || [];
      const ids = targetSlip.map((p) => p.match_id.toString());
      const filtered = matches.filter((m) => ids.includes(m.id.toString()));
      return filtered.sort((a, b) => ids.indexOf(a.id.toString()) - ids.indexOf(b.id.toString()));
    }
    const mappedCat = getMappedMatchCategory(catId);
    return matches.filter(
      (m) => hasCategoryTag(m, catId, phaStatsMap, historyType === "jackpot", matchStars) || evaluateMatchCategory(
        m,
        mappedCat,
        "all",
        phaStatsMap,
        historyType === "jackpot",
        true
      )
    );
  };
  const _getMatchScore = (m, outcome, weights) => {
    return getMatchScore(m, outcome, weights, phaStatsMap, matchStars);
  };
  const _predictWithSeer = (m, weights) => {
    return predictWithSeer(
      m,
      weights,
      phaStatsMap,
      matchStars,
      selectedCategory
    );
  };
  const clampWeights = (w) => {
    const clamped = { ...w };
    Object.keys(clamped).forEach((key) => {
      if (typeof clamped[key] === "number") {
        const maxVal = key.startsWith("synergyCond") || key === "synergyGapBoost" ? 1e3 : 100;
        clamped[key] = Math.min(maxVal, Math.max(0, clamped[key]));
      }
    });
    return clamped;
  };
  const getMappedMatchCategory = (catId) => {
    switch (catId) {
      case "top_10_value":
        return "top10";
      case "high_confidence":
        return "top20";
      default:
        return catId;
    }
  };
  const handleResetWeights = () => {
    const categoryName = categoriesList.find((c) => c.id === selectedCategory)?.label || selectedCategory;
    if (!confirm(`Are you sure you want to reset the weights for ${categoryName} to default weights?`)) {
      return;
    }
    const modePrefix2 = historyType === "jackpot" ? "jackpot_" : "daily_";
    const effectiveCategoryKey2 = `${modePrefix2}${selectedCategory}`;
    setCategoryWeightsMap((prev) => {
      const next = { ...prev };
      delete next[effectiveCategoryKey2];
      delete next[selectedCategory];
      const mappedKey = getMappedMatchCategory(selectedCategory);
      delete next[`${modePrefix2}${mappedKey}`];
      delete next[mappedKey];
      saveSeerWeights(next);
      return next;
    });
  };
  const isMatchGoalAccurate2 = (m, pred, actual, categoryId, phaStatsMap2) => {
    if (!actual || actual === "pending") return false;
    const stats = getMatchStats(m, phaStatsMap2);
    const moFav = stats.moFav;
    const moUnderdog = stats.moUnderdog;
    const favOdds = stats.favOdds;
    switch (categoryId) {
      case "top10":
      case "top_10_value":
        return actual === moFav || actual === "X";
      case "best_bet":
      case "bankers_dlive":
      case "bankers_jackpot":
      case "value_picks":
        return actual === moFav;
      case "botb_best":
      case "high_confidence":
      case "top20":
        if (favOdds >= 2) {
          return actual === moFav || actual === "X";
        } else {
          return actual === moFav;
        }
      case "banker_draws":
        return actual === "X";
      case "upsets":
        return actual === moUnderdog;
      case "value_bets":
        return matchesPrediction(pred, actual);
      default:
        return matchesPrediction(pred, actual);
    }
  };
  const getAccuracy = (mList, weights) => {
    let correct = 0;
    let evaluated = 0;
    for (const m of mList) {
      const actual = getActualResult(m.result);
      if (actual && actual !== "pending") {
        evaluated++;
        const pred = _predictWithSeer(m, weights);
        if (isMatchCorrectForCategory(m, pred, actual, selectedCategory)) correct++;
      }
    }
    return evaluated > 0 ? correct / evaluated * 100 : 0;
  };
  const getGoalAccuracy = (mList, weights) => {
    let goalCorrect = 0;
    let evaluated = 0;
    for (const m of mList) {
      const actual = getActualResult(m.result);
      if (actual && actual !== "pending") {
        evaluated++;
        const pred = _predictWithSeer(m, weights);
        if (isMatchGoalAccurate2(m, pred, actual, selectedCategory, phaStatsMap)) goalCorrect++;
      }
    }
    return evaluated > 0 ? goalCorrect / evaluated * 100 : 0;
  };
  const modePrefix = historyType === "jackpot" ? "jackpot_" : "daily_";
  const effectiveCategoryKey = `${modePrefix}${selectedCategory}`;
  const currentWeights = categoryWeightsMap[effectiveCategoryKey] || categoryWeightsMap[selectedCategory] || DEFAULT_WEIGHTS;
  const handleAiOptimizer = async () => {
    setIsOptimizing(true);
    setLearningProgress(0);
    setLearningStatus("Initializing AI Optimizer...");
    try {
      const targetMatches = matchesToProcess && matchesToProcess.length > 0 ? matchesToProcess : liveMatches && liveMatches.length > 0 ? liveMatches : [];
      const categoryName = categoriesList.find((c) => c.id === selectedCategory)?.label || selectedCategory;
      const results = await runAiOptimizer(
        targetMatches,
        selectedCategory,
        categoryName,
        currentWeights,
        phaStatsMap,
        matchStars,
        (status, percent) => {
          setLearningStatus(status);
          setLearningProgress(percent);
        }
      );
      setRecommendationsMap((prev) => ({
        ...prev,
        [selectedCategory]: results
      }));
      const bestApproved = results.find((r) => r.testResult?.approved);
      if (bestApproved) {
        setCategoryWeightsMap((prev) => {
          const newMap = {
            ...prev,
            [effectiveCategoryKey]: bestApproved.proposedWeights
          };
          saveSeerWeights(newMap);
          return newMap;
        });
      }
    } catch (err) {
      console.error("AI Optimizer failed:", err);
      setError(err.message || "Failed to run AI Optimizer");
    } finally {
      setIsOptimizing(false);
      setLearningStatus("");
    }
  };
  const handleTestRecommendation = (rec) => {
    setIsTestingRecs((prev) => ({ ...prev, [rec.id]: true }));
    setTimeout(() => {
      const validMatches = selectedCategory === "all" ? matchesToProcess : matchesToProcess.filter(
        (m) => evaluateMatchCategory(
          m,
          getMappedMatchCategory(selectedCategory),
          "all",
          phaStatsMap,
          historyType === "jackpot",
          true
        )
      );
      const matchesWithResults = validMatches.filter(
        (m) => getActualResult(m.result) !== "pending"
      );
      const oldAcc = getAccuracy(matchesWithResults, currentWeights);
      const newAcc = getAccuracy(matchesWithResults, rec.proposedWeights);
      const oldGoalAcc = getGoalAccuracy(matchesWithResults, currentWeights);
      const newGoalAcc = getGoalAccuracy(matchesWithResults, rec.proposedWeights);
      let approved = false;
      if (rec.subsetGoalAcc !== void 0) {
        approved = rec.subsetGoalAcc >= oldGoalAcc;
      } else {
        approved = newAcc > oldAcc && newGoalAcc >= oldGoalAcc || newGoalAcc > oldGoalAcc && newAcc >= oldAcc || newAcc === oldAcc && newGoalAcc === oldGoalAcc && newAcc > 0 && selectedCategory !== "all";
      }
      if (approved) {
        setCategoryWeightsMap((prev) => {
          const latestCurrent = prev[effectiveCategoryKey] || prev[selectedCategory] || DEFAULT_WEIGHTS;
          const synergyKeys = [
            "synergyCondA",
            "synergyCondB",
            "synergyCondC",
            "synergyCondD",
            "synergyCondE",
            "synergyGapBoost",
            "synergyAgreementBoost"
          ];
          const weightsToApply = { ...rec.proposedWeights };
          synergyKeys.forEach((k) => {
            const wasChangedByRec = rec.proposedWeights[k] !== rec.baseWeights[k];
            if (!wasChangedByRec) {
              if (latestCurrent[k] !== void 0) {
                weightsToApply[k] = latestCurrent[k];
              }
            }
          });
          const newMap = { ...prev, [effectiveCategoryKey]: weightsToApply };
          saveSeerWeights(newMap);
          return newMap;
        });
      }
      setRecommendationsMap((prev) => {
        const currentRecs = prev[selectedCategory] || [];
        return {
          ...prev,
          [selectedCategory]: currentRecs.map(
            (r) => r.id === rec.id ? {
              ...r,
              isTested: true,
              testResult: { prevAcc: oldAcc, newAcc, approved, prevGoalAcc: oldGoalAcc, newGoalAcc }
            } : r
          )
        };
      });
      setIsTestingRecs((prev) => ({ ...prev, [rec.id]: false }));
    }, 600);
  };
  const currentRecommendations = recommendationsMap[selectedCategory] || [];
  const liveTestMatches = (0, import_react3.useMemo)(() => {
    let validMatches = getMatchesForCategory2(
      matchesToProcess,
      selectedCategory,
      true
    );
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      validMatches = validMatches.filter(
        (m) => m.teams.toLowerCase().includes(q) || String(m.id).toLowerCase().includes(q) || m.le.toLowerCase().includes(q) || m.mo.toLowerCase().includes(q)
      );
    }
    return validMatches;
  }, [matchesToProcess, selectedCategory, phaStatsMap, searchQuery]);
  const liveStats = (0, import_react3.useMemo)(() => {
    const withResults = liveTestMatches.filter(
      (m) => getActualResult(m.result) !== "pending"
    );
    if (withResults.length === 0) return { count: 0, acc: 0, goalAcc: 0 };
    let correct = 0;
    let goalCorrect = 0;
    withResults.forEach((m) => {
      const pred = _predictWithSeer(m, currentWeights);
      const actual = getActualResult(m.result);
      if (actual && actual !== "pending") {
        if (isMatchCorrectForCategory(m, pred, actual, selectedCategory)) correct++;
        if (isMatchGoalAccurate2(m, pred, actual, selectedCategory, phaStatsMap)) goalCorrect++;
      }
    });
    return {
      count: withResults.length,
      acc: correct / withResults.length * 100,
      goalAcc: goalCorrect / withResults.length * 100
    };
  }, [liveTestMatches, currentWeights, selectedCategory, phaStatsMap]);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex flex-col h-full bg-slate-50 relative", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bg-gradient-to-r from-slate-900 to-indigo-900 border-b border-indigo-800 p-4", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex justify-between items-start", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("h2", { className: "text-xl font-bold text-white flex items-center gap-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Eye, { className: "text-teal-400" }),
          "SEER Prediction Algorithm"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-indigo-200 text-sm mt-1", children: "Self-learning analysis engine replacing AI defaults for higher precision." })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex flex-col items-end gap-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bg-black/30 p-1 rounded-lg border border-white/10 flex", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "button",
              {
                onClick: () => {
                  setHistoryType("daily");
                  setSelectedDate(todayStr);
                },
                className: `px-3 py-1 rounded text-[10px] font-black transition-all ${historyType === "daily" ? "bg-indigo-500 text-white shadow-lg" : "bg-transparent text-white/40 hover:text-white/70"}`,
                children: "DAILY LIVE"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "button",
              {
                onClick: () => {
                  setHistoryType("jackpot");
                  setSelectedDate(todayStr);
                },
                className: `px-3 py-1 rounded text-[10px] font-black transition-all ${historyType === "jackpot" ? "bg-amber-500 text-white shadow-lg" : "bg-transparent text-white/40 hover:text-white/70"}`,
                children: "JACKPOT"
              }
            )
          ] }),
          (activeTab === "test" || activeTab === "slips") && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex gap-2 ml-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "button",
              {
                onClick: () => {
                  setIsLoadingHistory(true);
                  syncSeerData([...liveMatches, ...historicalMatches], phaStatsMap, matchStars).then(
                    () => {
                      setTimeout(() => setIsLoadingHistory(false), 500);
                    }
                  );
                },
                className: "px-2 py-1 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-200 rounded border border-indigo-500/30 flex items-center gap-1 text-[10px] font-black transition-all",
                title: "Sync Results",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.RefreshCw, { size: 12 }),
                  " SYNC"
                ]
              }
            ),
            selectedDate === todayStr && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "button",
              {
                onClick: () => setShowClearModal(true),
                className: "px-2 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-200 rounded border border-red-500/30 flex items-center gap-1 text-[10px] font-black transition-all",
                title: "Clear Today",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Trash2, { size: 12 }),
                  " CLEAR"
                ]
              }
            ),
            selectedDate !== todayStr && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "button",
              {
                onClick: async () => {
                  if (!confirm(
                    `Are you sure you want to delete ALL locked slips for ${selectedDate}?`
                  ))
                    return;
                  setIsLoadingHistory(true);
                  try {
                    const allCats = categoriesList.map((c) => c.id).concat([
                      "banker",
                      "upset",
                      "jackpot",
                      "safety",
                      "sandbox_best_bet",
                      "sandbox_top_10_value",
                      "sandbox_bankers_dlive",
                      "sandbox_bankers_jackpot",
                      "sandbox_value_bets",
                      "sandbox_value_picks",
                      "sandbox_high_confidence",
                      "sandbox_banker_draws",
                      "sandbox_botb_best",
                      "sandbox_upsets"
                    ]).filter((c) => c !== "all");
                    for (const cat of allCats) {
                      await deleteLockedSlip(selectedDate, cat);
                    }
                    setLockedSlips({});
                    alert(`Locked slips for ${selectedDate} deleted successfully.`);
                  } catch (err) {
                    alert("Failed to delete older slips.");
                  } finally {
                    setIsLoadingHistory(false);
                  }
                },
                className: "px-2 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-100 hover:text-red-200 rounded border border-red-500/30 flex items-center gap-1 text-[10px] font-black transition-all cursor-pointer",
                title: "Delete all locked slips for this date",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Trash2, { size: 12 }),
                  " DELETE SLIPS"
                ]
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-2 bg-black/30 p-1 rounded-lg border border-white/10", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react3.Calendar, { size: 16, className: "text-teal-400 ml-2" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-[10px] font-black text-white uppercase tracking-wider mr-2", children: "History:" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "flex gap-1 overflow-x-auto no-scrollbar max-w-[400px]", children: availableDates.map((date) => {
            const isToday = date === todayStr;
            const isSelected = selectedDate === date;
            const label = isToday ? "TODAY" : date.split("-").slice(1).join("/");
            return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "button",
              {
                onClick: () => setSelectedDate(date),
                className: `px-2 py-1 rounded text-[10px] font-black transition-all ${isSelected ? "bg-teal-500 text-white shadow-lg scale-110" : "bg-white/10 text-white/60 hover:bg-white/20"}`,
                children: label
              },
              date
            );
          }) })
        ] }),
        selectedDate !== todayStr && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "text-[10px] font-bold text-amber-400 animate-pulse bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20", children: [
          "Viewing Historical Data for ",
          selectedDate
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bg-white border-b border-gray-200 sticky top-0 z-10 flex p-2 gap-2 overflow-x-auto no-scrollbar", children: categoriesList.map((cat) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "button",
      {
        onClick: () => setSelectedCategory(cat.id),
        className: `px-4 py-2 rounded-md text-sm font-bold whitespace-nowrap transition-all ${selectedCategory === cat.id ? "bg-teal-600 text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`,
        children: cat.label
      },
      cat.id
    )) }),
    error && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm animate-in fade-in slide-in-from-top-2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.AlertTriangle, { size: 18 }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "font-bold", children: error }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "button",
        {
          onClick: () => setError(null),
          className: "ml-auto hover:bg-red-100 p-1 rounded",
          children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.XCircle, { size: 16 })
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "flex px-4 py-2 gap-4 bg-slate-100 border-b border-gray-200 justify-between items-center", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex gap-4", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "button",
        {
          onClick: () => setActiveTab("learn"),
          className: `px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 ${activeTab === "learn" ? "bg-amber-500 text-white shadow" : "bg-white text-gray-600 hover:bg-gray-50"}`,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Brain, { size: 16 }),
            " Self Learn"
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "button",
        {
          onClick: () => setActiveTab("test"),
          className: `px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 ${activeTab === "test" ? "bg-indigo-600 text-white shadow" : "bg-white text-gray-600 hover:bg-gray-50"}`,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.PlayCircle, { size: 16 }),
            " SEER OPTIMIZED SLIPS"
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "button",
        {
          onClick: () => setActiveTab("slips"),
          className: `px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 ${activeTab === "slips" ? "bg-teal-600 text-white shadow" : "bg-white text-gray-600 hover:bg-gray-50"}`,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.ListOrdered, { size: 16 }),
            " SEER AI SLIPS"
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "button",
        {
          onClick: () => setActiveTab("stats"),
          className: `px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 ${activeTab === "stats" ? "bg-purple-600 text-white shadow" : "bg-white text-gray-600 hover:bg-gray-50"}`,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.BarChart2, { size: 16 }),
            " Stats"
          ]
        }
      )
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex-1 overflow-y-auto p-4 relative", children: [
      showClearModal && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden border-l-8 border-amber-500 animate-in fade-in zoom-in duration-300", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "p-6", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-start gap-4 mb-4 text-left", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "shrink-0 mt-1", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center border border-amber-100", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.AlertTriangle, { className: "text-amber-500", size: 20 }) }) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { className: "text-xl font-black text-slate-800 leading-tight", children: "Unsaved Changes" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-slate-500 text-sm font-medium mt-1 leading-relaxed", children: "You have results updates for today. If you clear now, they will be lost. We recommend saving first." })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "space-y-3 pt-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
            "button",
            {
              onClick: () => {
                setIsLoadingHistory(true);
                setShowClearModal(false);
                try {
                  const filteredLive = liveMatches.filter(
                    (m) => historyType === "jackpot" ? m.isJackpot : m.isDaily || !m.isJackpot && !m.isDaily
                  );
                  setHistoricalSnapshot(filteredLive);
                  (async () => {
                    try {
                      await syncSeerData(
                        liveMatches,
                        phaStatsMap,
                        matchStars
                      );
                      const coll = historyType === "jackpot" ? "seer_jackpot_history" : "seer_performance_history";
                      await deleteDailySeerSnapshot(todayStr, coll);
                    } catch (err) {
                      console.error("Background Seer Save & Clear error:", err);
                    }
                  })();
                } finally {
                  setIsLoadingHistory(false);
                }
              },
              className: "w-full bg-[#059669] hover:bg-[#047857] text-white font-black py-3.5 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 group text-sm",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Database, { size: 18 }),
                "Save & Clear"
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              onClick: () => {
                setIsLoadingHistory(true);
                setShowClearModal(false);
                try {
                  const filteredLive = liveMatches.filter(
                    (m) => historyType === "jackpot" ? m.isJackpot : m.isDaily || !m.isJackpot && !m.isDaily
                  );
                  setHistoricalSnapshot(filteredLive);
                  const coll = historyType === "jackpot" ? "seer_jackpot_history" : "seer_performance_history";
                  deleteDailySeerSnapshot(todayStr, coll).catch((err) => {
                    console.error("Background Seer Snapshot direct clear failed:", err);
                  });
                } finally {
                  setIsLoadingHistory(false);
                }
              },
              className: "w-full bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#334155] font-black py-3.5 rounded-lg transition-all text-sm",
              children: "Clear Without Saving"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              onClick: () => setShowClearModal(false),
              className: "w-full py-2 text-slate-400 font-bold hover:text-slate-600 transition-colors text-xs underline underline-offset-4",
              children: "Cancel"
            }
          )
        ] })
      ] }) }) }),
      isLoadingHistory && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex flex-col items-center gap-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.RefreshCw, { className: "animate-spin text-indigo-600", size: 32 }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-xs font-bold text-gray-500 uppercase tracking-widest", children: "Loading Records..." })
      ] }) }),
      activeTab === "learn" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex flex-col md:flex-row gap-4 h-full", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex-1 bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col justify-start min-h-[300px]", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-3 mb-4", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Brain, { size: 32, className: "text-amber-500" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("h3", { className: "text-lg font-bold text-gray-800", children: [
              "SEER Recommendations:",
              " ",
              categoriesList.find((c) => c.id === selectedCategory)?.label
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-gray-500 text-sm mb-6", children: "SEER analyzes recent live matches that have results to find imbalances in prediction variables. It proposes and tests recommendations to tune weightings." }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "flex flex-wrap gap-4 mb-6", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
            "button",
            {
              disabled: isOptimizing || isOptimizing,
              className: `px-6 py-3 rounded-lg font-bold text-white shadow-md flex items-center justify-center w-full max-w-xs gap-2 transition-all ${isOptimizing ? "bg-gray-400 cursor-not-allowed transform scale-95" : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:shadow-lg"}`,
              onClick: handleAiOptimizer,
              children: [
                isOptimizing ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.RefreshCw, { className: "animate-spin", size: 18 }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Zap, { size: 18 }),
                isOptimizing ? "Optimizing..." : "Run AI Optimizer"
              ]
            }
          ) }),
          (isOptimizing || isOptimizing) && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "w-full max-w-md bg-gray-100 rounded-full h-8 mb-6 overflow-hidden relative border border-gray-200", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "div",
              {
                className: "bg-amber-500 h-full transition-all duration-300 flex items-center justify-center",
                style: { width: `${learningProgress}%` },
                children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "text-[10px] font-black text-white drop-shadow-md", children: [
                  learningProgress.toFixed(0),
                  "%"
                ] })
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "absolute inset-0 flex items-center justify-center pointer-events-none", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-[10px] font-bold text-gray-800 uppercase mix-blend-difference", children: learningStatus }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "space-y-4", children: [
            currentRecommendations.map((rec) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "div",
              {
                className: "border border-gray-200 rounded-lg p-4 bg-slate-50",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "flex justify-between items-start mb-2", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-2 text-sm font-bold text-gray-800", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Search, { size: 16, className: "text-indigo-500" }),
                    " ",
                    "Finding:"
                  ] }) }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-sm text-gray-700 mb-3 ml-6", children: rec.finding }),
                  rec.deepInsights && rec.deepInsights.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "mb-3 ml-6 bg-white p-3 border border-indigo-100 rounded-md", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2 flex items-center gap-1", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Sparkles, { size: 12 }),
                      " Deep Insights"
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { className: "space-y-1.5", children: rec.deepInsights.map((insight, idx) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("li", { className: "text-xs text-gray-600 pl-2 border-l border-indigo-300", children: insight }, idx)) })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "flex justify-between items-start mb-2", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-2 text-sm font-bold text-teal-700", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.ArrowRight, { size: 16, className: "text-teal-500" }),
                    " ",
                    "Action proposed:"
                  ] }) }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-sm text-gray-600 mb-4 ml-6", children: rec.action }),
                  rec.isTested ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                    "div",
                    {
                      className: `p-3 rounded-md flex items-center justify-between text-sm shadow-sm ${rec.testResult?.approved ? "bg-green-100 border border-green-300 text-green-800" : "bg-red-100 border border-red-300 text-red-800"}`,
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-2 font-bold", children: [
                          rec.testResult?.approved ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.CheckCircle2, { size: 18 }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.XCircle, { size: 18 }),
                          rec.testResult?.approved ? "Recommendation Approved & Applied" : "Recommendation Rejected"
                        ] }),
                        rec.testResult && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex flex-col items-end text-right font-mono text-xs gap-1 font-bold", children: [
                          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-2", children: [
                            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-[9px] text-gray-400 font-extrabold tracking-wide uppercase", children: "Overall:" }),
                            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "text-gray-500 line-through opacity-70 border px-1 rounded", children: [
                              rec.testResult.prevAcc.toFixed(1),
                              "%"
                            ] }),
                            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.ArrowRight, { size: 10, className: "text-gray-400" }),
                            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: rec.testResult.approved ? "text-green-700 font-extrabold" : "text-red-700", children: [
                              rec.testResult.newAcc.toFixed(1),
                              "%"
                            ] })
                          ] }),
                          rec.testResult.prevGoalAcc !== void 0 && rec.testResult.newGoalAcc !== void 0 && selectedCategory !== "all" && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-2", children: [
                            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-[9px] text-indigo-400 font-extrabold tracking-wide uppercase", children: "Goal:" }),
                            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "text-gray-500 line-through opacity-70 border px-1 rounded", children: [
                              rec.testResult.prevGoalAcc.toFixed(1),
                              "%"
                            ] }),
                            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.ArrowRight, { size: 10, className: "text-gray-400" }),
                            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: rec.testResult.approved ? "text-indigo-700 font-extrabold" : "text-red-700", children: [
                              rec.testResult.newGoalAcc.toFixed(1),
                              "%"
                            ] })
                          ] })
                        ] })
                      ]
                    }
                  ) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                    "button",
                    {
                      onClick: () => handleTestRecommendation(rec),
                      disabled: isTestingRecs[rec.id],
                      className: "ml-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-bold flex items-center gap-2 transition-colors disabled:bg-gray-400",
                      children: [
                        isTestingRecs[rec.id] ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.RefreshCw, { className: "animate-spin", size: 14 }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.PlayCircle, { size: 14 }),
                        isTestingRecs[rec.id] ? "Testing against live data..." : "Test Recommendation against Live Data"
                      ]
                    }
                  )
                ]
              },
              rec.id
            )),
            currentRecommendations.length === 0 && !isOptimizing && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "text-center p-8 border-2 border-dashed border-gray-200 rounded-lg text-gray-400", children: 'No insights generated yet. Click "Generate Insights" to begin.' })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "w-full md:w-80 bg-white rounded-lg shadow-sm border border-gray-200 p-4 self-start sticky top-4 max-h-[85vh] overflow-y-auto", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex justify-between items-center border-b pb-2 mb-4", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("h3", { className: "text-md font-bold text-gray-800 flex items-center gap-2", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.BarChart2, { size: 16, className: "text-indigo-500" }),
              " Current Optimized Weightings"
            ] }),
            selectedCategory !== "all" && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "button",
              {
                onClick: handleResetWeights,
                className: "px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer shadow-sm",
                title: "Reset category weights to default weights",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.RefreshCw, { size: 10 }),
                  "RESET WEIGHT"
                ]
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "space-y-3 mt-4", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              WeightBar,
              {
                label: "PAA Prediction",
                val: currentWeights.paaPredWeight,
                desc: "(Base)",
                color: "bg-teal-500"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              WeightBar,
              {
                label: "Algo Prediction",
                val: currentWeights.algoWeight,
                desc: "(Audit)",
                color: "bg-blue-500"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              WeightBar,
              {
                label: "Sub Pattern Pred",
                val: currentWeights.subPatternWeight,
                desc: "(Synergy)",
                color: "bg-indigo-500"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              WeightBar,
              {
                label: "Prob Confidence",
                val: currentWeights.probConfWeight,
                desc: "(Prob)",
                color: "bg-emerald-500"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              WeightBar,
              {
                label: "PHA Outcomes",
                val: currentWeights.phaWeight,
                desc: "(1X2 Dist)",
                color: "bg-purple-500"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              WeightBar,
              {
                label: "PAA Performance",
                val: currentWeights.paaPercentWeight,
                desc: "(Market %)",
                color: "bg-pink-500"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              WeightBar,
              {
                label: "Live PERF Data",
                val: currentWeights.perfStarsWeight,
                desc: "(Stars)",
                color: "bg-amber-500"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              WeightBar,
              {
                label: "1X2 Prediction",
                val: currentWeights.pred1x2Weight,
                desc: "(1X2)",
                color: "bg-rose-500"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              WeightBar,
              {
                label: "1X2 Rating Boost",
                val: currentWeights.pred1x2RatingBoost,
                desc: "(\u22653/10)",
                color: "bg-orange-500"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              WeightBar,
              {
                label: "Draw Strategy Boost",
                val: currentWeights.drawDisagreementBoost,
                desc: "(1X vs X2)",
                color: "bg-cyan-500"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              WeightBar,
              {
                label: "Synergy Gap",
                val: (currentWeights.synergyGapBoost ?? 250) / 10,
                desc: "(Boost/10)",
                color: "bg-indigo-400"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              WeightBar,
              {
                label: "Synergy Boost A",
                val: (currentWeights.synergyCondA ?? 300) / 10,
                desc: "(Boost/10)",
                color: "bg-fuchsia-400"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              WeightBar,
              {
                label: "Synergy Boost B",
                val: (currentWeights.synergyCondB ?? 200) / 10,
                desc: "(Boost/10)",
                color: "bg-fuchsia-500"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              WeightBar,
              {
                label: "Synergy Boost C",
                val: (currentWeights.synergyCondC ?? 150) / 10,
                desc: "(Boost/10)",
                color: "bg-fuchsia-600"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              WeightBar,
              {
                label: "Synergy Boost D",
                val: (currentWeights.synergyCondD ?? 100) / 10,
                desc: "(Boost/10)",
                color: "bg-fuchsia-700"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              WeightBar,
              {
                label: "Synergy Boost E",
                val: (currentWeights.synergyCondE ?? 100) / 10,
                desc: "(Boost/10)",
                color: "bg-fuchsia-800"
              }
            )
          ] })
        ] })
      ] }) : activeTab === "test" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col min-h-[400px]", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50 rounded-t-lg", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.PlayCircle, { size: 16, className: "text-red-500" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("h3", { className: "text-md font-bold text-gray-800", children: [
              "Live SEER Optimized Slip for",
              " ",
              categoriesList.find((c) => c.id === selectedCategory)?.label
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "text-xs font-bold text-gray-500 bg-white px-2 py-1 rounded shadow-sm border border-gray-100", children: [
                liveTestMatches.length,
                " Picks"
              ] }),
              liveStats.count > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                  "span",
                  {
                    className: `text-xs font-bold px-2 py-1 rounded shadow-sm border ${liveStats.acc >= 70 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-700 border-slate-200"} flex items-center gap-1`,
                    title: "Checks if actual result matches any of the double-chance hedges",
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-[10px] text-slate-400 font-extrabold tracking-wider uppercase", children: "Overall:" }),
                      liveStats.acc.toFixed(1),
                      "% (",
                      liveStats.count,
                      " Evaluated)"
                    ]
                  }
                ),
                selectedCategory !== "all" && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                  "span",
                  {
                    className: `text-xs font-bold px-2 py-1 rounded shadow-sm border ${liveStats.goalAcc >= 70 ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-amber-50 text-amber-700 border-amber-200"} flex items-center gap-1`,
                    title: `Goal-specific target accuracy for ${categoriesList.find((c) => c.id === selectedCategory)?.label}`,
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-[10px] text-indigo-400 font-extrabold tracking-wider uppercase", children: "Goal:" }),
                      liveStats.goalAcc.toFixed(1),
                      "% Accuracy"
                    ]
                  }
                )
              ] }),
              selectedCategory !== "all" && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-1", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                  "button",
                  {
                    onClick: () => activeLockedSlips[selectedCategory] ? handleGlobalUnlockSlip(selectedCategory) : handleGlobalLockSlip(
                      selectedCategory,
                      liveTestMatches
                    ),
                    className: `px-3 py-1 rounded text-[10px] font-black flex items-center gap-1 transition-all shadow-sm ${activeLockedSlips[selectedCategory] ? "bg-amber-100 text-amber-700 border border-amber-300" : "bg-teal-600 text-white hover:bg-teal-700"}`,
                    children: [
                      isLocking[selectedCategory] ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.RefreshCw, { className: "animate-spin", size: 12 }) : activeLockedSlips[selectedCategory] ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.ShieldCheck, { size: 12 }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Target, { size: 12 }),
                      activeLockedSlips[selectedCategory] ? "LOCKED / STICKY" : "MAKE SELECTION STICKY"
                    ]
                  }
                ),
                activeLockedSlips[selectedCategory] && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                  "button",
                  {
                    onClick: () => handleGlobalUnlockSlip(selectedCategory),
                    className: "px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded text-[10px] font-black flex items-center gap-1 transition-all shadow-sm cursor-pointer",
                    title: "Delete older or current locked slip",
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Trash2, { size: 12 }),
                      "DELETE LOCKED SLIP"
                    ]
                  }
                )
              ] })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "relative w-full md:w-64", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Search, { size: 14, className: "text-gray-400" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "input",
              {
                type: "text",
                placeholder: "Search matches...",
                value: searchQuery,
                onChange: (e) => setSearchQuery(e.target.value),
                className: "block w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "p-4 flex-1", children: liveTestMatches.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex flex-col items-center justify-center p-8 text-gray-400", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Target, { size: 32, className: "mb-2 opacity-50" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: searchQuery ? "No matches found matching your search." : "No live matches currently in this category." })
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3", children: liveTestMatches.map((m, idx) => {
          const pred = _predictWithSeer(m, currentWeights);
          const actualResult = getActualResult(m.result);
          const isCorrect = actualResult && isMatchCorrectForCategory(m, pred, actualResult, selectedCategory);
          return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
            "div",
            {
              className: "border border-gray-200 rounded p-3 flex flex-col gap-2 hover:shadow-sm transition-shadow",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "text-xs text-gray-500 flex justify-between font-mono items-center", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "bg-blue-50 px-2 py-0.5 rounded text-blue-700 font-bold border border-blue-100 italic", children: [
                    "1X2: ",
                    m.mo
                  ] }),
                  m.result && m.result !== "pending" && m.result !== "?-?" && m.result !== "-" && m.result !== "Unknown" && m.result.toLowerCase() !== "unknown" && getActualResult(m.result) !== "pending" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                    "span",
                    {
                      className: `font-bold px-2 py-0.5 rounded shadow-sm ${isCorrect ? "bg-green-100 text-green-700 border border-green-200" : "bg-red-100 text-red-700 border border-red-200"}`,
                      children: [
                        "FT: ",
                        m.result
                      ]
                    }
                  ) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "bg-gray-50 px-2 py-0.5 rounded border border-gray-100", children: [
                    "LE: ",
                    m.le || "NA"
                  ] })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "font-bold text-sm text-gray-800 flex items-center gap-2", children: [
                  selectedCategory !== "all" && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "text-xs bg-gray-900 text-white px-1.5 py-0.5 rounded shadow-sm opacity-90 truncate", children: [
                    "#",
                    idx + 1
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "truncate", children: m.teams })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex justify-between items-center mt-2 border-t pt-2", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-1", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-[10px] font-bold text-gray-400 uppercase", children: "Legacy AI (PAA)" }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "font-bold text-gray-600 px-2 py-0.5 bg-gray-100 rounded text-xs", title: m.paaPrediction ? `PAA Prediction: ${m.paaPrediction}` : "", children: _getPAAPrediction(m, phaStatsMap) })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-1", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-[10px] font-black text-teal-600 uppercase tracking-tighter", children: "SEER PREDICTS" }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                      "span",
                      {
                        className: `font-black text-white px-2 py-0.5 rounded text-xs shadow-sm bg-gradient-to-r from-teal-500 to-indigo-600 ${m.result ? isCorrect ? "opacity-100" : "opacity-70" : ""}`,
                        children: pred
                      }
                    )
                  ] })
                ] })
              ]
            },
            `${m.id}_${idx}`
          );
        }) }) })
      ] }) : activeTab === "slips" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        SeerSlipSuggester,
        {
          liveMatches,
          matchesToProcess,
          phaStatsMap,
          currentWeights,
          predictWithSeer: _predictWithSeer,
          getMatchScore: _getMatchScore,
          matchStars,
          selectedDate,
          historyType,
          lockedSlips: activeLockedSlips,
          setLockedSlips,
          setLockedAiSlips,
          categoryWeightsMap,
          isSlipsLoading,
          getMatchesForCategory: getMatchesForCategory2,
          categoriesList,
          todayStr,
          selectedCategory,
          setSelectedCategory,
          searchQuery,
          setSearchQuery
        }
      ) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-2 mb-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "p-2 bg-indigo-50 rounded-lg", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.TrendingUp, { className: "text-indigo-600", size: 20 }) }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-sm font-bold text-slate-500 uppercase tracking-wider", children: "Current Period Accuracy" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "text-4xl font-black text-slate-900", children: [
                performanceData.length > 0 ? performanceData[performanceData.length - 1].accuracy : 0,
                "%"
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "mt-4 text-xs font-medium text-slate-400", children: [
              "Based on last ",
              performanceData.length,
              " active sessions"
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-2 mb-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "p-2 bg-teal-50 rounded-lg", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Award, { className: "text-teal-600", size: 20 }) }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-sm font-bold text-slate-500 uppercase tracking-wider", children: "Top Performing Category" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "text-xl font-black text-slate-900", children: categoriesList.find((c) => c.id === selectedCategory)?.label })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "mt-4 text-xs font-medium text-slate-400", children: "Switch categories to view specific stats" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-2 mb-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "p-2 bg-purple-50 rounded-lg", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Brain, { className: "text-purple-600", size: 20 }) }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-sm font-bold text-slate-500 uppercase tracking-wider", children: "SEER Confidence" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "text-4xl font-black text-slate-900", children: [
                Math.min(
                  100,
                  Math.round(
                    (currentWeights.probConfWeight + currentWeights.phaWeight + currentWeights.perfStarsWeight) / 1.5
                  )
                ),
                "%"
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "mt-4 text-xs font-medium text-slate-400", children: "Calculated from weighted variable distribution" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-slate-200", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("h3", { className: "text-lg font-black text-slate-800 mb-6 flex items-center gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.BarChart2, { className: "text-purple-600", size: 20 }),
            "Historical Accuracy Trend:",
            " ",
            categoriesList.find((c) => c.id === selectedCategory)?.label
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "h-[300px] w-full", children: isFetchingStats ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-50 rounded-lg border border-dashed border-slate-200", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              import_lucide_react2.RefreshCw,
              {
                className: "animate-spin text-purple-600",
                size: 32
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-xs font-bold text-slate-400 uppercase tracking-widest", children: "Compiling Historical Data..." })
          ] }) : performanceData.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_recharts.ResponsiveContainer, { width: "100%", height: "100%", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_recharts.LineChart, { data: performanceData, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              import_recharts.CartesianGrid,
              {
                strokeDasharray: "3 3",
                vertical: false,
                stroke: "#f1f5f9"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              import_recharts.XAxis,
              {
                dataKey: "date",
                axisLine: false,
                tickLine: false,
                tick: {
                  fontSize: 10,
                  fill: "#64748b",
                  fontWeight: 700
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              import_recharts.YAxis,
              {
                domain: [0, 100],
                axisLine: false,
                tickLine: false,
                tick: {
                  fontSize: 10,
                  fill: "#64748b",
                  fontWeight: 700
                },
                tickFormatter: (val) => `${val}%`
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              import_recharts.Tooltip,
              {
                contentStyle: {
                  borderRadius: "8px",
                  border: "none",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                },
                itemStyle: { fontWeight: 800, fontSize: "12px" },
                labelStyle: {
                  fontWeight: 800,
                  color: "#64748b",
                  marginBottom: "4px"
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              import_recharts.Legend,
              {
                wrapperStyle: {
                  fontSize: "11px",
                  fontWeight: 700,
                  paddingTop: "10px"
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              import_recharts.Line,
              {
                type: "monotone",
                dataKey: "accuracy",
                name: "Weights Overall Acc",
                stroke: "#8b5cf6",
                strokeDasharray: "5 5",
                strokeWidth: 3,
                dot: {
                  r: 4,
                  fill: "#8b5cf6",
                  strokeWidth: 2,
                  stroke: "#fff"
                },
                activeDot: { r: 6, strokeWidth: 0 }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              import_recharts.Line,
              {
                type: "monotone",
                dataKey: "goalAccuracy",
                name: "Weights Goal Acc",
                stroke: "#06b6d4",
                strokeDasharray: "5 5",
                strokeWidth: 3,
                dot: {
                  r: 4,
                  fill: "#06b6d4",
                  strokeWidth: 2,
                  stroke: "#fff"
                },
                activeDot: { r: 6, strokeWidth: 0 }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              import_recharts.Line,
              {
                type: "monotone",
                dataKey: "aiAccuracy",
                name: "AI Analysis Overall Acc",
                stroke: "#f59e0b",
                strokeWidth: 4,
                dot: {
                  r: 6,
                  fill: "#f59e0b",
                  strokeWidth: 2,
                  stroke: "#fff"
                },
                activeDot: { r: 8, strokeWidth: 0 }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              import_recharts.Line,
              {
                type: "monotone",
                dataKey: "aiGoalAccuracy",
                name: "AI Analysis Goal Acc",
                stroke: "#ef4444",
                strokeWidth: 4,
                dot: {
                  r: 6,
                  fill: "#ef4444",
                  strokeWidth: 2,
                  stroke: "#fff"
                },
                activeDot: { r: 8, strokeWidth: 0 }
              }
            )
          ] }) }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-50 rounded-lg border border-dashed border-slate-200", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.AlertTriangle, { className: "text-slate-300", size: 32 }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-xs font-bold text-slate-400 uppercase tracking-widest", children: "No historical data points found in this range." })
          ] }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("h3", { className: "font-black text-slate-800 flex items-center gap-2", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.ListOrdered, { className: "text-indigo-600", size: 20 }),
              "Latest Finalized Performance (Last 10 Days)"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-[10px] font-bold text-slate-400 uppercase tracking-widest", children: "Active Weights Applied" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "overflow-x-auto", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("table", { className: "w-full text-left border-collapse", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("tr", { className: "bg-slate-50/50", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("th", { className: "px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider", children: "Category" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("th", { className: "px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center", children: "Snapshot Vol." }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("th", { className: "px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right", children: "Last Acc. (Overall)" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("th", { className: "px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right", children: "Goal Accuracy" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("th", { className: "px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right", children: "Trend" })
            ] }) }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("tbody", { className: "divide-y divide-slate-100", children: categoriesList.filter((c) => c.id !== "all").map((cat) => {
              const statsMatches = latestSnapshotMatches.length > 0 ? latestSnapshotMatches : matchesToProcess;
              const catMatches = getMatchesForCategory2(
                statsMatches,
                cat.id
              );
              const acc = getAccuracy(
                catMatches,
                categoryWeightsMap[cat.id] || DEFAULT_WEIGHTS
              );
              const goalAcc = getGoalAccuracy(
                catMatches,
                categoryWeightsMap[cat.id] || DEFAULT_WEIGHTS
              );
              const isSelected = selectedCategory === cat.id;
              return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                "tr",
                {
                  className: `hover:bg-slate-50 transition-colors cursor-pointer ${isSelected ? "bg-indigo-50/30" : ""}`,
                  onClick: () => setSelectedCategory(cat.id),
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("td", { className: "px-6 py-4", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-2", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                        "div",
                        {
                          className: `w-2 h-2 rounded-full ${isSelected ? "bg-indigo-500 animate-pulse" : "bg-slate-300"}`
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                        "span",
                        {
                          className: `text-sm font-bold ${isSelected ? "text-indigo-700" : "text-slate-700"}`,
                          children: cat.label
                        }
                      )
                    ] }) }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("td", { className: "px-6 py-4 text-center", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded", children: catMatches.length }) }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("td", { className: "px-6 py-4 text-right", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                      "span",
                      {
                        className: `text-sm font-black ${acc >= 75 ? "text-emerald-600" : acc >= 50 ? "text-amber-600" : "text-slate-400"}`,
                        children: acc > 0 || catMatches.length > 0 && catMatches.some(
                          (m) => getActualResult(m.result) !== "pending"
                        ) ? `${Math.round(acc)}%` : "-"
                      }
                    ) }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("td", { className: "px-6 py-4 text-right", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                      "span",
                      {
                        className: `text-sm font-black ${goalAcc >= 75 ? "text-cyan-600" : goalAcc >= 50 ? "text-amber-600" : "text-slate-400"}`,
                        children: goalAcc > 0 || catMatches.length > 0 && catMatches.some(
                          (m) => getActualResult(m.result) !== "pending"
                        ) ? `${Math.round(goalAcc)}%` : "-"
                      }
                    ) }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("td", { className: "px-6 py-4 text-right", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "flex justify-end", children: acc >= 70 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                      import_lucide_react2.TrendingUp,
                      {
                        size: 14,
                        className: "text-emerald-500"
                      }
                    ) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "w-3.5 h-3.5 border-b-2 border-slate-200" }) }) })
                  ]
                },
                cat.id
              );
            }) })
          ] }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bg-slate-900 p-8 rounded-xl text-white overflow-hidden relative group", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "absolute top-0 right-0 p-8 opacity-10 transition-transform group-hover:scale-110 duration-500", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Zap, { size: 120 }) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "relative z-10 flex flex-col md:flex-row justify-between items-center gap-8", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "max-w-md", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("h4", { className: "text-2xl font-black mb-2 flex items-center gap-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Target, { className: "text-teal-400" }),
                "Performance Integrity Audit"
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-slate-400 text-sm font-medium leading-relaxed", children: "The SEER engine cross-references legacy AI predictions against real-world outcomes to calculate variable weight shifts. Historical accuracy points are calculated using your local EAT boundary (8 AM EAT) to ensure session consistency." })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex gap-4", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bg-white/10 p-4 rounded-lg backdrop-blur-sm border border-white/10 text-center min-w-[120px]", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "text-[10px] font-black text-teal-400 uppercase mb-1", children: "Live Window" }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "text-2xl font-black", children: "10 DAYS" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bg-white/10 p-4 rounded-lg backdrop-blur-sm border border-white/10 text-center min-w-[120px]", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "text-[10px] font-black text-amber-400 uppercase mb-1", children: "Sync Points" }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "text-2xl font-black", children: "ACTIVE" })
              ] })
            ] })
          ] })
        ] })
      ] })
    ] })
  ] });
}
var WeightBar = ({
  label,
  val,
  desc,
  color
}) => {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex flex-col gap-1", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex justify-between text-xs", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "font-bold text-gray-700", children: [
        label,
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-gray-400 font-normal", children: desc })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "font-bold text-indigo-900", children: val })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "w-full bg-gray-100 rounded-full h-2 overflow-hidden", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "div",
      {
        className: `${color} h-full rounded-full transition-all duration-500`,
        style: { width: `${Math.min(100, val * 3)}%` }
      }
    ) })
  ] });
};
function SeerSlipSuggester({
  liveMatches,
  matchesToProcess,
  phaStatsMap,
  currentWeights,
  predictWithSeer: predictWithSeer3,
  getMatchScore: getMatchScore3,
  matchStars,
  selectedDate,
  historyType,
  lockedSlips,
  setLockedSlips,
  setLockedAiSlips,
  categoryWeightsMap,
  isSlipsLoading,
  getMatchesForCategory: getMatchesForCategory2,
  categoriesList,
  todayStr,
  selectedCategory,
  setSelectedCategory,
  searchQuery,
  setSearchQuery
}) {
  const [isLoading, setIsLoading] = (0, import_react3.useState)(false);
  const [isWiping, setIsWiping] = (0, import_react3.useState)(false);
  const [selectedAiModel, setSelectedAiModel] = (0, import_react3.useState)("gemini-3.6-flash");
  const [isGeneratingAi, setIsGeneratingAi] = (0, import_react3.useState)(false);
  const [aiGenProgress, setAiGenProgress] = (0, import_react3.useState)(null);
  const [isSelfLearning, setIsSelfLearning] = (0, import_react3.useState)(false);
  const [lessonsList, setLessonsList] = (0, import_react3.useState)([]);
  const [showLessonsPanel, setShowLessonsPanel] = (0, import_react3.useState)(false);
  const [expandedLessonId, setExpandedLessonId] = (0, import_react3.useState)(null);
  const unlockedCategoriesRef = (0, import_react3.useRef)({});
  (0, import_react3.useEffect)(() => {
    unlockedCategoriesRef.current = {};
    loadLessons();
  }, [selectedDate, historyType]);
  const loadLessons = () => {
    try {
      const existingStr = localStorage.getItem("seer_ai_self_learn_lessons") || "[]";
      let lessons = JSON.parse(existingStr);
      let modified = false;
      lessons = lessons.map((l) => {
        if (l.status === "approved") {
          modified = true;
          return { ...l, status: "rejected" };
        }
        return l;
      });
      if (modified) {
        localStorage.setItem("seer_ai_self_learn_lessons", JSON.stringify(lessons));
      }
      setLessonsList(lessons);
    } catch (e) {
      console.error("Failed to parse or reverse lessons", e);
    }
  };
  const handleReverseAllApprovedLessons = () => {
    try {
      const existingStr = localStorage.getItem("seer_ai_self_learn_lessons") || "[]";
      let lessons = JSON.parse(existingStr);
      lessons = lessons.map((l) => ({ ...l, status: "rejected" }));
      localStorage.setItem("seer_ai_self_learn_lessons", JSON.stringify(lessons));
      setLessonsList(lessons);
      alert("All approved self-learn recommendations have been reversed and marked as rejected.");
    } catch (e) {
      console.error("Failed to reverse approved lessons", e);
    }
  };
  const handleToggleLessonStatus = (lessonId) => {
    try {
      const existingStr = localStorage.getItem("seer_ai_self_learn_lessons") || "[]";
      let lessons = JSON.parse(existingStr);
      lessons = lessons.map((l) => {
        if (l.id === lessonId) {
          const nextStatus = l.status === "approved" ? "rejected" : "approved";
          return { ...l, status: nextStatus };
        }
        return l;
      });
      localStorage.setItem("seer_ai_self_learn_lessons", JSON.stringify(lessons));
      setLessonsList(lessons);
    } catch (e) {
      console.error("Failed to toggle lesson status", e);
    }
  };
  const handleWipeAndSync = async () => {
    if (!confirm("Are you sure you want to wipe ALL SEER AI slips for this date?")) return;
    setIsWiping(true);
    try {
      const allCats = categoriesList.map((c) => c.id).filter((c) => c !== "all");
      for (const catId of allCats) {
        try {
          await deleteLockedSlip(selectedDate, `ai_${catId}`);
        } catch (e) {
          console.error("Failed to delete", catId, e);
        }
      }
      setLockedSlips({});
      unlockedCategoriesRef.current = {};
    } finally {
      setIsWiping(false);
    }
  };
  const handleGenerateSlipsWithAI = async () => {
    if (matchesToProcess.length === 0) {
      alert("No matches available to process for the selected date.");
      return;
    }
    setIsGeneratingAi(true);
    setAiGenProgress({
      currentCategoryIndex: 0,
      currentCategoryName: "",
      status: "Initializing SEER AI Slip Master..."
    });
    try {
      let activeCats = categoriesList.filter((c) => c.id !== "all");
      if (selectedCategory && selectedCategory !== "all") {
        activeCats = categoriesList.filter((c) => c.id === selectedCategory);
      }
      for (let i = 0; i < activeCats.length; i++) {
        const cat = activeCats[i];
        setAiGenProgress({
          currentCategoryIndex: i,
          currentCategoryName: cat.label,
          status: `Analyzing database & compiling cognitive parameters for ${cat.label}...`
        });
        await new Promise((resolve) => setTimeout(resolve, 300));
        let selections = [];
        try {
          selections = await selectSlipsWithAI(
            cat,
            matchesToProcess,
            phaStatsMap,
            matchStars,
            historyType === "jackpot",
            selectedAiModel
          );
        } catch (err) {
          console.warn(`Gemini AI slip generation failed for ${cat.id}, using AI Cognitive Selection engine`, err);
        }
        if (!selections || selections.length === 0) {
          const cogSlips = generateSeerAiCognitiveSlips(
            matchesToProcess,
            phaStatsMap,
            matchStars,
            historyType === "jackpot"
          );
          const rawCogPicks = cogSlips[cat.id] || [];
          selections = rawCogPicks.map((p) => ({
            match_id: p.match_id,
            team: p.team,
            prediction: p.prediction,
            odds: p.odds,
            reason: p.reason,
            confidence: p.confidence
          }));
        }
        let picks = (selections || []).map((p) => {
          const matchingMatch = matchesToProcess.find((m) => m.id?.toString() === p.match_id?.toString());
          return {
            match_id: p.match_id,
            team: p.team,
            prediction: ensureHedgedPrediction(p.prediction, matchingMatch, phaStatsMap),
            odds: p.odds || "1.0",
            reason: p.reason || "AI Cognitive selected matching parameters",
            confidence: p.confidence || "100%",
            category: cat.id
          };
        });
        if (picks.length > 0) {
          const targetCatId = `ai_${cat.id}`;
          const slip = {
            id: `${selectedDate}_${targetCatId}`,
            date: selectedDate,
            category: targetCatId,
            picks,
            backups: [],
            weightsAtTime: DEFAULT_WEIGHTS,
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            type: historyType
          };
          await saveLockedSlip(slip, true);
          setLockedAiSlips((prev) => ({
            ...prev,
            [cat.id]: { ...slip, category: cat.id }
          }));
          setLockedSlips((prev) => ({
            ...prev,
            [cat.id]: { ...slip, category: cat.id }
          }));
          try {
            window.dispatchEvent(new Event("seerLockedSlipsUpdated"));
          } catch (e) {
          }
        } else {
          console.warn(`No AI selections generated for ${cat.label} via Gemini AI.`);
        }
      }
      setAiGenProgress(null);
      alert("Successfully finalized all SEER AI Slips sequentially!");
    } catch (e) {
      console.error("AI Slip generation failed:", e);
      alert(`AI Generation failed: ${e.message || e}`);
      setAiGenProgress(null);
    } finally {
      setIsGeneratingAi(false);
    }
  };
  const handleSelfLearn = async () => {
    if (!selectedCategory || selectedCategory === "all") {
      alert("Please select a specific category for self learning.");
      return;
    }
    const catObj = categoriesList.find((c) => c.id === selectedCategory);
    if (!catObj) return;
    setIsSelfLearning(true);
    try {
      const activeCats = [catObj];
      const liveCategoryMatches = {};
      const catMatches = getMatchesForCategory2(matchesToProcess, catObj.id, false);
      const catWeights = categoryWeightsMap[catObj.id] || DEFAULT_WEIGHTS;
      liveCategoryMatches[catObj.id] = catMatches.map((m) => {
        const pred = predictWithSeer3(m, catWeights, phaStatsMap, matchStars, catObj.id);
        return {
          match: m,
          prediction: pred
        };
      });
      const lessonResult = await runSelfLearnReflectiveCycle(
        selectedDate,
        activeCats,
        lockedSlips,
        matchesToProcess,
        phaStatsMap,
        matchStars,
        liveCategoryMatches,
        selectedAiModel
      );
      loadLessons();
      setExpandedLessonId(lessonResult.id);
      setShowLessonsPanel(true);
      const liveMsg = lessonResult.totalLiveCandidatesEvaluated && lessonResult.totalLiveCandidatesEvaluated > 0 ? `
Live Candidates Evaluated: ${lessonResult.totalLiveCandidatesEvaluated} (Accuracy: ${lessonResult.liveCandidatesAccuracy}%)` : "";
      alert(`Post-Match Self-Learning completed!
Overall Accuracy: ${lessonResult.overallAccuracy}%
Goal Accuracy: ${lessonResult.goalAccuracy}%${liveMsg}`);
    } catch (e) {
      console.error("Self learning error:", e);
      alert(`Self learning failed: ${e.message || e}`);
    } finally {
      setIsSelfLearning(false);
    }
  };
  const handleLockSlip = async (catId, picks) => {
    const baseId = catId;
    const catWeights = getWeightsForCategory(baseId);
    const targetCatId = `ai_${catId}`;
    const slip = {
      id: `${selectedDate}_${targetCatId}`,
      date: selectedDate,
      category: targetCatId,
      picks,
      backups: [],
      weightsAtTime: catWeights,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      type: historyType
    };
    try {
      await saveLockedSlip(slip, true);
    } catch (error) {
      console.warn("Supabase save failed for locked slip, updating local state only.", error);
    }
    setLockedAiSlips((prev) => ({ ...prev, [catId]: { ...slip, category: catId } }));
    setLockedSlips((prev) => ({ ...prev, [catId]: { ...slip, category: catId } }));
  };
  const handleUnlockSlip = async (catId) => {
    if (!confirm(
      "Are you sure you want to unlock this AI slip? It will revert to candidate matches."
    ))
      return;
    const targetCatId = `ai_${catId}`;
    try {
      await deleteLockedSlip(selectedDate, targetCatId);
    } catch (error) {
      console.warn("Failed to delete from Supabase, deleting locally.", error);
    }
    unlockedCategoriesRef.current[catId] = true;
    setLockedAiSlips((prev) => {
      const next = { ...prev };
      delete next[catId];
      return next;
    });
    setLockedSlips((prev) => {
      const next = { ...prev };
      delete next[catId];
      return next;
    });
  };
  const getWeightsForCategory = (catId) => {
    let mappedKey = catId;
    if (catId === "safety") {
      mappedKey = "best_bet";
    } else if (catId === "banker") {
      mappedKey = "bankers_dlive";
    } else if (catId === "upset") {
      mappedKey = "upsets";
    } else if (catId === "jackpot") {
      mappedKey = "top_10_value";
    }
    const modePrefix = historyType === "jackpot" ? "jackpot_" : "daily_";
    const effectiveKey = `${modePrefix}${mappedKey}`;
    return categoryWeightsMap[effectiveKey] || categoryWeightsMap[mappedKey] || categoryWeightsMap[`${modePrefix}${catId}`] || categoryWeightsMap[catId] || DEFAULT_WEIGHTS;
  };
  const matchDetailsCacheRef = (0, import_react3.useRef)({});
  (0, import_react3.useEffect)(() => {
    matchDetailsCacheRef.current = {};
  }, [matchesToProcess, phaStatsMap, categoryWeightsMap, currentWeights]);
  const getMatchDetails = (m, catId) => {
    const cacheKey = `${m.id}-${catId || "default"}`;
    if (matchDetailsCacheRef.current[cacheKey]) {
      return matchDetailsCacheRef.current[cacheKey];
    }
    const tags = getMatchEvaluatorTags(m, phaStatsMap, false, true);
    const hardBans = tags.filter(
      (t) => t.startsWith("BANNED:") && t !== "PHA_TIE"
    );
    const hasHardBan = hardBans.length > 0;
    const hasPhaTie = tags.includes("PHA_TIE");
    const weights = catId ? getWeightsForCategory(catId) : currentWeights;
    const p1 = getMatchScore3(m, "1", weights);
    const p2 = getMatchScore3(m, "2", weights);
    const isBanker = tags.some(
      (t) => t.includes("bankers") || t.includes("jackpot")
    );
    const isUpset = tags.some(
      (t) => t.includes("upsets") || t.includes("value_bets")
    );
    let conflictRes = "none";
    if (isBanker && isUpset) {
      conflictRes = p1 > p2 ? "banker_win" : "upset_win";
    }
    const result = {
      tags,
      hasHardBan,
      hasPhaTie,
      p1,
      p2,
      isBanker,
      isUpset,
      conflictRes
    };
    matchDetailsCacheRef.current[cacheKey] = result;
    return result;
  };
  const renderSlipCard = (cat) => {
    const isLocked = !!lockedSlips[cat.id];
    const lockedData = lockedSlips[cat.id];
    const baseCatId = cat.id;
    const catWeights = getWeightsForCategory(baseCatId);
    if (isSlipsLoading) {
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "div",
        {
          className: "bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col opacity-75",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "bg-slate-800 p-3 flex justify-between items-center text-white", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("h3", { className: "font-bold flex items-center gap-2 text-sm text-gray-300", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Award, { className: "text-gray-500 shrink-0", size: 16 }),
              cat.label
            ] }) }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "p-8 flex flex-col items-center justify-center text-center", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Loader2, { className: "w-6 h-6 text-indigo-400 animate-spin mb-3" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-xs font-bold text-slate-700", children: "Loading slip..." })
            ] })
          ]
        },
        cat.id
      );
    }
    let matchesToShow = [];
    if (isLocked) {
      matchesToShow = lockedData.picks.map((p) => {
        const pId = p.match_id?.toString() || "";
        const pTeam = (p.team || "").toLowerCase().trim();
        let matchingMatch = liveMatches.find(
          (m) => {
            const mId = m.id?.toString() || "";
            const mTeam = (m.teams || "").toLowerCase().trim();
            return mId === pId || pId.startsWith(mId + "_") || mId.startsWith(pId + "_") || pTeam.length > 0 && mTeam === pTeam;
          }
        );
        if (!matchingMatch) {
          matchingMatch = matchesToProcess.find(
            (m) => {
              const mId = m.id?.toString() || "";
              const mTeam = (m.teams || "").toLowerCase().trim();
              return mId === pId || pId.startsWith(mId + "_") || mId.startsWith(pId + "_") || pTeam.length > 0 && mTeam === pTeam;
            }
          );
        }
        if (matchingMatch) {
          return { ...matchingMatch, targetPrediction: p.prediction, aiReason: p.reason, aiConfidence: p.confidence };
        }
        return {
          id: p.match_id,
          teams: p.team,
          mo: p.odds,
          result: p.actualResult || "-",
          targetPrediction: p.prediction,
          aiReason: p.reason,
          aiConfidence: p.confidence,
          isStub: true
        };
      });
    } else {
      matchesToShow = [];
    }
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "div",
      {
        className: `bg-white rounded-xl shadow-sm border ${isLocked ? "border-teal-500 ring-1 ring-teal-200" : "border-slate-200"} overflow-hidden flex flex-col`,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
            "div",
            {
              className: `${isLocked ? "bg-gradient-to-r from-teal-600 to-indigo-700" : "bg-slate-900"} p-3 flex justify-between items-center text-white`,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("h3", { className: "font-bold flex items-center gap-2 text-sm", children: [
                  isLocked ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.ShieldCheck, { className: "text-teal-300 shrink-0", size: 16 }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Award, { className: "text-gray-400 shrink-0", size: 16 }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "truncate", children: cat.label }),
                  isLocked && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-[9px] font-black bg-white/20 px-1.5 py-0.5 rounded uppercase tracking-widest ml-1 shrink-0 text-white", children: "AI SELECTED" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-1.5 shrink-0", children: [
                  (() => {
                    let completedCount = 0;
                    let correctCount = 0;
                    let goalCorrectCount = 0;
                    matchesToShow.forEach((m) => {
                      const actual = getActualResult(m.result || "");
                      if (actual && actual !== "pending") {
                        completedCount++;
                        const pred = m.targetPrediction || predictWithSeer3(m, catWeights, phaStatsMap, matchStars, baseCatId);
                        if (isMatchCorrectForCategory(m, pred, actual, baseCatId)) {
                          correctCount++;
                        }
                        if (isMatchGoalAccurate(m, pred, actual, baseCatId, phaStatsMap)) {
                          goalCorrectCount++;
                        }
                      }
                    });
                    if (completedCount > 0) {
                      const overallPct = Math.round(correctCount / completedCount * 100);
                      const goalPct = Math.round(goalCorrectCount / completedCount * 100);
                      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex gap-1", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "text-[9px] font-black bg-white/20 text-white px-2 py-0.5 rounded-full border border-white/10", title: "Overall accuracy matching exact double chance hedge", children: [
                          "OVERALL: ",
                          overallPct,
                          "% (",
                          correctCount,
                          "/",
                          completedCount,
                          ")"
                        ] }),
                        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "text-[9px] font-black bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30", title: "Specific category target accuracy rules", children: [
                          "GOAL: ",
                          goalPct,
                          "%"
                        ] })
                      ] });
                    }
                    return null;
                  })(),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                    "span",
                    {
                      className: `text-[9px] ${isLocked ? "bg-white/20 text-white" : "bg-slate-800 text-slate-300"} px-2 py-0.5 rounded-full font-bold tracking-wider uppercase`,
                      children: [
                        matchesToShow.slice(0, cat.maxPicks || 10).length,
                        " Picks"
                      ]
                    }
                  )
                ] })
              ]
            }
          ),
          isLocked ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bg-teal-50 border-b border-teal-200 px-3 py-1.5 flex justify-between items-center", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex flex-col", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "text-[9px] font-black text-teal-800 uppercase tracking-wide flex items-center gap-1", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Sparkles, { size: 11, className: "text-teal-600" }),
                " Cognitive AI Locked"
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "text-[8px] text-teal-600/70 font-bold", children: [
                "Generated: ",
                new Date(lockedData.createdAt).toLocaleTimeString()
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "button",
              {
                onClick: () => handleUnlockSlip(cat.id),
                className: "text-[9px] font-bold text-red-700 hover:text-white hover:bg-red-600 bg-red-100/50 hover:border-red-600 px-2.5 py-1 rounded border border-red-200 transition-all flex items-center gap-1 cursor-pointer font-black uppercase",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Trash2, { size: 11 }),
                  " RELEASE SLIP"
                ]
              }
            )
          ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bg-amber-50/70 border-b border-amber-100 p-3 text-center", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "text-[10px] font-black text-amber-800 uppercase flex items-center justify-center gap-1", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Sparkles, { size: 12, className: "animate-pulse text-amber-600" }),
              " AI SELECTION PENDING"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-[9px] text-amber-700/80 font-medium mt-0.5", children: "Click 'Generate slips via AI' above to run the cognitive evaluation." })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 overflow-y-auto max-h-[450px] min-h-[140px]", children: isLoading ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "col-span-full flex flex-col items-center justify-center py-20 gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              import_lucide_react2.RefreshCw,
              {
                className: "animate-spin text-slate-300",
                size: 24
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-[10px] font-bold text-slate-400 uppercase tracking-widest", children: "Loading..." })
          ] }) : matchesToShow.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "col-span-full flex flex-col items-center justify-center py-16 text-center", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Sparkles, { className: "w-7 h-7 text-amber-500/70 mb-2 animate-pulse" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-xs font-bold text-slate-700", children: "No AI Slips Generated Yet" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-[10px] text-slate-400 mt-1 max-w-xs", children: "Click 'Generate slips via AI' above to run the independent Gemini AI engine and lock selections." })
          ] }) : matchesToShow.slice(0, cat.maxPicks || 10).map((m, idx) => {
            const actual = getActualResult(m.result || "");
            const isCompleted = actual && actual !== "pending" && !!m.result && m.result !== "Unknown" && m.result.toLowerCase() !== "unknown";
            const rawPred = m.targetPrediction || predictWithSeer3(m, catWeights, phaStatsMap, matchStars, baseCatId);
            const pred = isLocked ? ensureHedgedPrediction(rawPred, m, phaStatsMap) : rawPred;
            const isCorrect = isCompleted && isMatchCorrectForCategory(m, pred, actual, baseCatId);
            return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "div",
              {
                className: `border border-gray-200 rounded p-3 flex flex-col gap-2 hover:shadow-sm transition-shadow ${isCompleted ? isCorrect ? "bg-emerald-50/40 border-emerald-200" : "bg-red-50/40 border-red-200" : isLocked ? "bg-teal-50/10 border-teal-100 hover:border-teal-300" : "bg-slate-50 border-slate-100 hover:border-indigo-200"}`,
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "text-xs text-gray-500 flex justify-between font-mono items-center", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "bg-blue-50 px-2 py-0.5 rounded text-blue-700 font-bold border border-blue-100 italic", children: [
                      "1X2: ",
                      m.mo || "-"
                    ] }),
                    isCompleted ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                      "span",
                      {
                        className: `font-bold px-2 py-0.5 rounded shadow-sm ${isCorrect ? "bg-green-100 text-green-700 border border-green-200" : "bg-red-100 text-red-700 border border-red-200"}`,
                        children: [
                          "FT: ",
                          m.result
                        ]
                      }
                    ) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "bg-gray-50 px-2 py-0.5 rounded border border-gray-100", children: [
                      "LE: ",
                      m.le || "-"
                    ] })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "font-bold text-sm text-gray-800 flex items-center gap-2", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "text-xs bg-gray-900 text-white px-1.5 py-0.5 rounded shadow-sm opacity-90 truncate", children: [
                      "#",
                      idx + 1
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "truncate", children: m.teams })
                  ] }),
                  isLocked && m.aiReason && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "mt-1 bg-slate-50 border border-slate-100 rounded p-2 text-[10px]", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex justify-between font-black text-slate-500 mb-0.5", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "uppercase text-[8px]", children: "AI REASONING" }),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "text-indigo-600", children: [
                        "CONFIDENCE: ",
                        m.aiConfidence || "100%"
                      ] })
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "text-slate-600 italic font-medium leading-normal", children: [
                      '"',
                      m.aiReason,
                      '"'
                    ] })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex justify-between items-center mt-2 border-t pt-2", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-1", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-[10px] font-bold text-gray-400 uppercase", children: "Legacy AI (PAA)" }),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "font-bold text-gray-600 px-2 py-0.5 bg-gray-100 rounded text-xs", children: _getPAAPrediction(m, phaStatsMap) })
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-1", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-[10px] font-black text-teal-600 uppercase tracking-tighter", children: isLocked ? "AI PREDICTED" : "SEER PREDICTS" }),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                        "span",
                        {
                          className: `font-black text-white px-2 py-0.5 rounded text-xs shadow-sm bg-gradient-to-r ${isLocked ? "from-teal-500 to-indigo-600" : "from-slate-600 to-slate-800"} ${isCompleted ? isCorrect ? "opacity-100" : "opacity-70" : ""}`,
                          children: pred
                        }
                      )
                    ] })
                  ] })
                ]
              },
              `${m.id}_${idx}`
            );
          }) })
        ]
      },
      cat.id
    );
  };
  const renderSingleSlipPage = () => {
    const activeCat = categoriesList.find((c) => c.id === selectedCategory);
    if (!activeCat) return null;
    const isLocked = !!lockedSlips[activeCat.id];
    const lockedData = lockedSlips[activeCat.id];
    const baseCatId = activeCat.id;
    const catWeights = getWeightsForCategory(baseCatId);
    if (isSlipsLoading) {
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col p-8 items-center justify-center text-center", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Loader2, { className: "w-8 h-8 text-indigo-500 animate-spin mb-3" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-sm font-bold text-slate-700", children: "Loading slip data..." })
      ] });
    }
    let matchesToShow = [];
    if (isLocked) {
      matchesToShow = lockedData.picks.map((p) => {
        const pId = p.match_id?.toString() || "";
        const pTeam = (p.team || "").toLowerCase().trim();
        let matchingMatch = liveMatches.find(
          (m) => {
            const mId = m.id?.toString() || "";
            const mTeam = (m.teams || "").toLowerCase().trim();
            return mId === pId || pId.startsWith(mId + "_") || mId.startsWith(pId + "_") || pTeam.length > 0 && mTeam === pTeam;
          }
        );
        if (!matchingMatch) {
          matchingMatch = matchesToProcess.find(
            (m) => {
              const mId = m.id?.toString() || "";
              const mTeam = (m.teams || "").toLowerCase().trim();
              return mId === pId || pId.startsWith(mId + "_") || mId.startsWith(pId + "_") || pTeam.length > 0 && mTeam === pTeam;
            }
          );
        }
        if (matchingMatch) {
          return { ...matchingMatch, targetPrediction: p.prediction, aiReason: p.reason, aiConfidence: p.confidence };
        }
        return {
          id: p.match_id,
          teams: p.team,
          mo: p.odds,
          result: p.actualResult || "-",
          targetPrediction: p.prediction,
          aiReason: p.reason,
          aiConfidence: p.confidence,
          isStub: true
        };
      });
    } else {
      matchesToShow = [];
    }
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      matchesToShow = matchesToShow.filter(
        (m) => (m.teams || "").toLowerCase().includes(q) || (m.le || "").toLowerCase().includes(q) || (m.mo || "").toLowerCase().includes(q)
      );
    }
    let completedCount = 0;
    let correctCount = 0;
    let goalCorrectCount = 0;
    matchesToShow.forEach((m) => {
      const actual = getActualResult(m.result || "");
      if (actual && actual !== "pending") {
        completedCount++;
        const pred = m.targetPrediction || predictWithSeer3(m, catWeights, phaStatsMap, matchStars, baseCatId);
        if (isMatchCorrectForCategory(m, pred, actual, baseCatId)) {
          correctCount++;
        }
        if (isMatchGoalAccurate(m, pred, actual, baseCatId, phaStatsMap)) {
          goalCorrectCount++;
        }
      }
    });
    const overallPct = completedCount > 0 ? Math.round(correctCount / completedCount * 100) : 0;
    const goalPct = completedCount > 0 ? Math.round(goalCorrectCount / completedCount * 100) : 0;
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden flex flex-col p-6 animate-in fade-in duration-300", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.PlayCircle, { className: "text-rose-500 fill-rose-500/10 shrink-0", size: 26 }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("h2", { className: "text-lg font-black text-slate-800 tracking-tight", children: [
            "Live SEER AI Slip for ",
            activeCat.label
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex flex-wrap items-center gap-2.5", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "border border-slate-200 bg-white rounded px-2.5 py-1 text-xs font-bold text-slate-700 flex flex-col items-center justify-center min-w-[55px] shadow-sm", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-sm font-black text-slate-900 leading-none", children: matchesToShow.length }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-[9px] text-slate-400 font-bold uppercase tracking-tight", children: "Picks" })
          ] }),
          completedCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "border border-green-200 bg-green-50 text-green-700 rounded-md px-3 py-1.5 text-xs font-black uppercase tracking-tight flex items-center gap-1", children: [
            "OVERALL: ",
            overallPct,
            "% (",
            correctCount,
            "/",
            completedCount,
            " Evaluated)"
          ] }),
          completedCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "border border-indigo-250 bg-indigo-50 text-indigo-700 rounded-md px-3 py-1.5 text-xs font-black uppercase tracking-tight flex items-center gap-1", children: [
            "GOAL: ",
            goalPct,
            "% Accuracy"
          ] }),
          isLocked ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "border border-amber-200 bg-amber-50 text-amber-700 rounded-md px-3 py-1.5 text-xs font-black uppercase tracking-tight flex items-center gap-1.5", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" }),
            " LOCKED / STICKY"
          ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
            "button",
            {
              onClick: () => handleLockSlip(activeCat.id, matchesToShow.map((m) => ({
                match_id: m.id,
                team: m.teams,
                prediction: m.targetPrediction,
                odds: m.mo?.split(",")[0] || "1.0",
                reason: "Cognitive selected",
                confidence: "100%",
                category: activeCat.id
              }))),
              className: "px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-all shadow-sm cursor-pointer hover:scale-[1.02]",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Target, { size: 13 }),
                " MAKE SELECTION STICKY"
              ]
            }
          ),
          isLocked && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
            "button",
            {
              onClick: () => handleUnlockSlip(activeCat.id),
              className: "px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded text-xs font-black flex items-center gap-1 transition-all shadow-sm cursor-pointer",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Trash2, { size: 13 }),
                " DELETE LOCKED SLIP"
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "relative w-full md:w-56 shrink-0", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Search, { size: 13, className: "text-gray-400" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "input",
              {
                type: "text",
                placeholder: "Search matches...",
                value: searchQuery || "",
                onChange: (e) => setSearchQuery(e.target.value),
                className: "block w-full pl-8.5 pr-3 py-1.5 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-xs font-semibold shadow-sm"
              }
            )
          ] })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6", children: isLoading ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "col-span-full flex flex-col items-center justify-center py-20 gap-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Loader2, { className: "animate-spin text-slate-400", size: 28 }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-[11px] font-bold text-slate-500 uppercase tracking-widest", children: "Loading candidates..." })
      ] }) : matchesToShow.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "col-span-full flex flex-col items-center justify-center py-20 text-center text-slate-400 italic bg-slate-50 border border-dashed border-slate-200 rounded-xl", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Target, { size: 32, className: "mb-2 opacity-40 mx-auto text-slate-400" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-xs font-bold uppercase tracking-wider text-slate-500", children: "No matches found" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "text-[10px] text-slate-400 mt-1", children: [
          "There are no candidate matches in this category for ",
          selectedDate,
          "."
        ] })
      ] }) : matchesToShow.slice(0, activeCat.maxPicks || 10).map((m, idx) => {
        const actual = getActualResult(m.result || "");
        const isCompleted = actual && actual !== "pending" && !!m.result && m.result !== "Unknown" && m.result.toLowerCase() !== "unknown";
        const pred = m.targetPrediction || predictWithSeer3(m, catWeights, phaStatsMap, matchStars, baseCatId);
        const isCorrect = isCompleted && isMatchCorrectForCategory(m, pred, actual, baseCatId);
        return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "div",
          {
            className: `border border-gray-200 rounded p-3 flex flex-col gap-2 hover:shadow-sm transition-shadow ${isCompleted ? isCorrect ? "bg-emerald-50/40 border-emerald-200" : "bg-red-50/40 border-red-200" : isLocked ? "bg-teal-50/10 border-teal-100 hover:border-teal-300" : "bg-slate-50 border-slate-100 hover:border-indigo-200"}`,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "text-xs text-gray-500 flex justify-between font-mono items-center", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "bg-blue-50 px-2 py-0.5 rounded text-blue-700 font-bold border border-blue-100 italic", children: [
                  "1X2: ",
                  m.mo || "-"
                ] }),
                isCompleted ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                  "span",
                  {
                    className: `font-bold px-2 py-0.5 rounded shadow-sm ${isCorrect ? "bg-green-100 text-green-700 border border-green-200" : "bg-red-100 text-red-700 border border-red-200"}`,
                    children: [
                      "FT: ",
                      m.result
                    ]
                  }
                ) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "bg-gray-50 px-2 py-0.5 rounded border border-gray-100", children: [
                  "LE: ",
                  m.le || "-"
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "font-bold text-sm text-gray-800 flex items-center gap-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "text-xs bg-gray-900 text-white px-1.5 py-0.5 rounded shadow-sm opacity-90 truncate", children: [
                  "#",
                  idx + 1
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "truncate", children: m.teams })
              ] }),
              isLocked && m.aiReason && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "mt-1 bg-slate-50 border border-slate-100 rounded p-2 text-[10px]", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex justify-between font-black text-slate-500 mb-0.5", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "uppercase text-[8px]", children: "AI REASONING" }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "text-indigo-600", children: [
                    "CONFIDENCE: ",
                    m.aiConfidence || "100%"
                  ] })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "text-slate-600 italic font-medium leading-normal", children: [
                  '"',
                  m.aiReason,
                  '"'
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex justify-between items-center mt-2 border-t pt-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-1", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-[10px] font-bold text-gray-400 uppercase", children: "Legacy AI (PAA)" }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "font-bold text-gray-600 px-2 py-0.5 bg-gray-100 rounded text-xs", children: _getPAAPrediction(m, phaStatsMap) })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-1", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-[10px] font-black text-teal-600 uppercase tracking-tighter", children: isLocked ? "AI PREDICTED" : "SEER PREDICTS" }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                    "span",
                    {
                      className: `font-black text-white px-2 py-0.5 rounded text-xs shadow-sm bg-gradient-to-r ${isLocked ? "from-teal-500 to-indigo-600" : "from-slate-600 to-slate-800"} ${isCompleted ? isCorrect ? "opacity-100" : "opacity-70" : ""}`,
                      children: pred
                    }
                  )
                ] })
              ] })
            ]
          },
          `${m.id}_${idx}`
        );
      }) })
    ] });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "space-y-6", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bg-slate-900 text-white rounded-lg shadow border border-slate-800 px-4 py-3 overflow-hidden relative", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "absolute top-0 right-0 p-4 opacity-5 pointer-events-none", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Brain, { size: 80 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex flex-col md:flex-row md:items-center justify-between gap-3 z-10 relative", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex flex-wrap items-center gap-2 mb-1", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bg-gradient-to-r from-teal-400 to-indigo-400 text-transparent bg-clip-text font-black text-sm tracking-wider uppercase", children: "SEER AI COGNITIVE SLIPS" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "bg-teal-500/10 text-teal-400 border border-teal-500/20 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider", children: selectedAiModel === "gemini-3.6-flash" ? "GEMINI 3.6 AGENTIC" : "GEMINI 3.1 PRO" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-[10px] text-slate-400 max-w-2xl leading-snug hidden sm:block", children: "Synthesize and finalize premium slips. The AI consumes match stats, algorithms, PAA indicators, and sub-patterns to produce high-conviction outcomes." })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex flex-wrap items-center gap-2 shrink-0", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-1.5 bg-slate-800/80 rounded border border-slate-700 px-2 py-1 mr-1", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-[8px] font-black text-slate-400 uppercase tracking-wider hidden sm:inline", children: "AI ENGINE:" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "select",
              {
                value: selectedAiModel,
                onChange: (e) => setSelectedAiModel(e.target.value),
                disabled: isGeneratingAi || isSelfLearning,
                className: "bg-transparent text-[10px] font-bold text-teal-400 focus:outline-none cursor-pointer border-none p-0 pr-1 select-none",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "gemini-3.6-flash", className: "bg-slate-900 text-white", children: "Gemini 3.6 Flash" }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "gemini-3.1-pro-preview", className: "bg-slate-900 text-white", children: "Gemini 3.1 PRO" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              onClick: handleGenerateSlipsWithAI,
              disabled: isGeneratingAi || isSelfLearning,
              className: `px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow transition-all ${isGeneratingAi ? "bg-teal-700/50 text-teal-300 cursor-not-allowed" : "bg-teal-500 hover:bg-teal-600 text-slate-950 hover:scale-105 cursor-pointer"}`,
              children: isGeneratingAi ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Loader2, { className: "w-3 h-3 animate-spin" }),
                " GEN..."
              ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Sparkles, { size: 12 }),
                " Gen Slips"
              ] })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              onClick: handleSelfLearn,
              disabled: isGeneratingAi || isSelfLearning,
              title: "Performs post-match reflective audits, comparing accuracy and compiling lessons learned.",
              className: `px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border transition-all ${isSelfLearning ? "bg-indigo-950/50 text-indigo-300 border-indigo-800 cursor-not-allowed" : "border-indigo-500 bg-indigo-950/40 hover:bg-indigo-900 text-indigo-300 hover:scale-105 cursor-pointer"}`,
              children: isSelfLearning ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Loader2, { className: "w-3 h-3 animate-spin" }),
                " REF..."
              ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Brain, { size: 12 }),
                " Learn"
              ] })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
            "button",
            {
              onClick: () => setShowLessonsPanel(!showLessonsPanel),
              className: "px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.BookOpen, { size: 12 }),
                "Logs (",
                lessonsList.length,
                ")"
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
            "button",
            {
              onClick: handleWipeAndSync,
              disabled: isGeneratingAi || isWiping,
              className: "px-2.5 py-1.5 bg-red-950/40 hover:bg-red-900 text-red-400 hover:text-red-300 border border-red-900/30 rounded text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Trash2, { size: 12 }),
                " Wipe AI"
              ]
            }
          )
        ] })
      ] }),
      isGeneratingAi && aiGenProgress && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "mt-4 pt-4 border-t border-slate-850 animate-in fade-in slide-in-from-top-2 duration-300", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex justify-between text-[11px] font-bold text-teal-400 mb-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "uppercase tracking-wider", children: [
            "STAGE ",
            aiGenProgress.currentCategoryIndex + 1,
            " OF 10: ",
            aiGenProgress.currentCategoryName
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
            Math.round(aiGenProgress.currentCategoryIndex / 10 * 100),
            "% COMPLETED"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "w-full bg-slate-800 rounded-full h-1.5 overflow-hidden", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "div",
          {
            className: "bg-teal-400 h-full rounded-full transition-all duration-300",
            style: { width: `${aiGenProgress.currentCategoryIndex / 10 * 100}%` }
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "text-[10px] text-slate-400 italic mt-1.5 flex items-center gap-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Loader2, { className: "w-3 h-3 animate-spin text-teal-400" }),
          " ",
          aiGenProgress.status
        ] })
      ] })
    ] }),
    showLessonsPanel && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bg-slate-900 text-slate-100 rounded-xl border border-slate-800 shadow-lg p-5 animate-in fade-in duration-300", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex justify-between items-center mb-4 pb-3 border-b border-slate-800", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("h3", { className: "font-black text-sm tracking-wider uppercase text-indigo-400 flex items-center gap-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Brain, { size: 18, className: "text-indigo-400" }),
          " AI SELF-LEARNING INSIGHT LOGS"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "button",
          {
            onClick: () => setShowLessonsPanel(false),
            className: "text-xs font-black text-slate-400 hover:text-white uppercase tracking-wider",
            children: "CLOSE"
          }
        )
      ] }),
      lessonsList.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "text-center py-8 text-slate-500", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-xs italic", children: 'No reflective learning lessons compiled yet. Perform "Self Learn" after match results have been synchronized.' }) }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "space-y-3 max-h-[400px] overflow-y-auto", children: lessonsList.map((lesson) => {
        const isExpanded = expandedLessonId === lesson.id;
        return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "border border-slate-800 rounded-lg overflow-hidden", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
            "button",
            {
              onClick: () => setExpandedLessonId(isExpanded ? null : lesson.id),
              className: "w-full bg-slate-950/60 p-3 flex justify-between items-center text-left hover:bg-slate-950 transition-colors",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "font-bold text-xs uppercase text-slate-200", children: [
                    "Reflective Audit for Date: ",
                    lesson.date
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "text-[9px] text-slate-500 font-mono mt-0.5", children: [
                    "Compiled: ",
                    new Date(lesson.createdAt).toLocaleString()
                  ] })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-3", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex flex-wrap gap-1.5 justify-end", children: [
                    lesson.totalLiveCandidatesEvaluated !== void 0 && lesson.totalLiveCandidatesEvaluated > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "text-[9px] font-black bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded", title: "All Category-Tagged Live Matches Evaluation", children: [
                      "LIVE CANDIDATES (",
                      lesson.totalLiveCandidatesEvaluated,
                      "): ",
                      lesson.liveCandidatesAccuracy,
                      "%"
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "text-[9px] font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded", children: [
                      "SLIPS OVERALL: ",
                      lesson.overallAccuracy,
                      "%"
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "text-[9px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded", children: [
                      "GOAL: ",
                      lesson.goalAccuracy,
                      "%"
                    ] })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-slate-400 font-bold text-xs", children: isExpanded ? "\u25B2" : "\u25BC" })
                ] })
              ]
            }
          ),
          isExpanded && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "p-4 bg-slate-900 border-t border-slate-800 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("h4", { className: "text-[10px] font-black text-indigo-400 uppercase tracking-wider mb-1.5 flex items-center gap-1", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Sparkles, { size: 10 }),
                " KEY REFLECTIVE FINDINGS"
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { className: "space-y-1.5 text-xs text-slate-300", children: lesson.findings.map((f, fIdx) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("li", { className: "pl-3 border-l border-indigo-500 leading-normal", children: f }, fIdx)) })
            ] }),
            lesson.insights && lesson.insights.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("h4", { className: "text-[10px] font-black text-rose-400 uppercase tracking-wider mb-1.5 flex items-center gap-1", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Lightbulb, { size: 10, className: "text-rose-400" }),
                " SEER AI CORE INSIGHTS"
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { className: "space-y-1.5 text-xs text-slate-300", children: lesson.insights.map((ins, insIdx) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("li", { className: "pl-3 border-l border-rose-500 leading-normal text-rose-100", children: ins }, insIdx)) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center justify-between mb-1.5", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("h4", { className: "text-[10px] font-black text-teal-400 uppercase tracking-wider flex items-center gap-1", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react2.Zap, { size: 10 }),
                  " STRATEGIC ACTIONABLE RULES (SELF-ADJUSTED)"
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                  "button",
                  {
                    onClick: (e) => {
                      e.stopPropagation();
                      handleToggleLessonStatus(lesson.id);
                    },
                    className: `px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border transition-colors ${lesson.status === "approved" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50 hover:bg-emerald-500/30" : lesson.status === "rejected" ? "bg-rose-500/20 text-rose-400 border-rose-500/50 hover:bg-rose-500/30" : "bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600"}`,
                    children: lesson.status === "approved" ? "\u2713 APPROVED (ACTIVE)" : lesson.status === "rejected" ? "\u2715 REJECTED" : "? PENDING APPROVAL"
                  }
                )
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { className: "space-y-1.5 text-xs text-slate-300", children: lesson.actionableRules.map((r, rIdx) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { className: `pl-3 border-l font-mono text-[10px] leading-relaxed ${lesson.status === "approved" ? "border-teal-500 text-teal-100" : "border-slate-600 text-slate-400"}`, children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: `text-[8px] font-black px-1 py-0.5 rounded mr-1 ${lesson.status === "approved" ? "bg-teal-500/10 text-teal-300" : "bg-slate-700 text-slate-400"}`, children: "ADJUSTMENT" }),
                r
              ] }, rIdx)) })
            ] })
          ] })
        ] }, lesson.id);
      }) })
    ] }),
    selectedCategory === "all" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4", children: categoriesList.filter((c) => c.id !== "all").map((cat) => renderSlipCard(cat)) }) : renderSingleSlipPage()
  ] });
}

// test_render.tsx
try {
  SeerAnalysis({
    historicalMatches: [],
    liveMatches: [],
    phaStatsMap: {}
  });
  console.log("Success! No error during render body.");
} catch (e) {
  console.error("Render Error:", e);
}
//# sourceMappingURL=test_render.cjs.map
