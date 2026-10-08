import { extractMLFeatures, generateSITags } from "../src/utils/mlFeatureExtractor";
import { processMatch } from "../src/utils/matchProcessing";

const match = {
  id: 1,
  home: "Rodina M",
  away: "SKA",
  result: "1",
  percentage: "1: 42% X: 31% 2: 27%",
  paaWin: 41, paaDraw: 31, paaUpset: 28, paaPrediction: "1X", paaPrimaryPrediction: "1",
  algoReport: {
    probabilities: { "1": 0.44, "X": 0.28, "2": 0.28 },
    prediction: "1X", primaryPrediction: "1"
  },
  seerPercentages: { "1": 43, "X": 30, "2": 27 },
  seerPrediction: "1X", seerPrimaryPrediction: "1",
  patternAnalysis: { subPattern: "SIh", primaryPrediction: "2", subPatternPrediction: "X2" },
  odds: { home: 2.10, draw: 3.10, away: 3.40 }
};

const processed = processMatch(match as any);
const features = extractMLFeatures(processed);
const tags = generateSITags(features as any).sort();

console.log("Rodina M Tags:", tags);

const combos = [];
for (let i = 0; i < tags.length; i++) {
    for (let j = i + 1; j < tags.length; j++) {
        combos.push(`${tags[i]}+${tags[j]}`);
        for (let k = j + 1; k < tags.length; k++) {
            combos.push(`${tags[i]}+${tags[j]}+${tags[k]}`);
        }
    }
}
console.log("Combos:", combos.length);
