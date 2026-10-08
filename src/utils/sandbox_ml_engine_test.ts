import fs from 'fs';
import path from 'path';
import { predictWithHybridML as baselinePredict } from './hybridMachineLearning';
import { predictWithHybridML as modifiedPredict } from './hybridMachineLearning_modified';

function getMatchResult(resultStr: string): string | null {
  if (!resultStr || !resultStr.includes(':')) return null;
  const [hStr, aStr] = resultStr.split(':');
  const h = parseInt(hStr, 10);
  const a = parseInt(aStr, 10);
  if (isNaN(h) || isNaN(a)) return null;
  if (h > a) return '1';
  if (h === a) return 'X';
  return '2';
}

function isWin(pred: string, result: string): boolean {
  if (!pred || !result) return false;
  return pred.includes(result);
}

async function runTest() {
  const matchesPath = 'C:\\Users\\USER\\OneDrive\\Desktop\\SEER ANTIGRAVITY\\public\\embedded_matches.json';
  const rawData = fs.readFileSync(matchesPath, 'utf8');
  const mlModelData = JSON.parse(fs.readFileSync('C:\\Users\\USER\\OneDrive\\Desktop\\SEER ANTIGRAVITY\\public\\ml_model.json', 'utf8'));
  let rawMatches = JSON.parse(rawData);
  const matches = rawMatches.map((m: any) => m.data || m);
  
  let totalTested = 0;
  
  let baselineWins = 0;
  let modifiedWins = 0;

  let twoPillarsApplied = 0;
  let twoPillarsBaselineWins = 0;
  let twoPillarsModifiedWins = 0;

  let extremeChaosApplied = 0;
  let extremeChaosBaselineWins = 0;
  let extremeChaosModifiedWins = 0;

  matches.forEach((m: any) => {
      const res = getMatchResult(m.result);
      if (!res) return;

      // Extract raw inputs required for Hybrid ML
      // (Normally ML Features Extractor requires full Match object)
      
      const baselineResult = baselinePredict(m, mlModelData);
      const modifiedResult = modifiedPredict(m, mlModelData);

      if (!baselineResult.mlApplied || !modifiedResult.mlApplied) return;

      totalTested++;
      if (isWin(baselineResult.mlPrediction, res)) baselineWins++;
      if (isWin(modifiedResult.mlPrediction, res)) modifiedWins++;

      // Identify differences due to Two Pillars
      if (modifiedResult.mlReasoning.includes('THE TWO PILLARS')) {
          twoPillarsApplied++;
          if (isWin(baselineResult.mlPrediction, res)) twoPillarsBaselineWins++;
          if (isWin(modifiedResult.mlPrediction, res)) twoPillarsModifiedWins++;
      }

      // Identify differences due to Extreme Chaos
      if (modifiedResult.mlReasoning.includes('EXTREME CHAOS')) {
          extremeChaosApplied++;
          if (isWin(baselineResult.mlPrediction, res)) extremeChaosBaselineWins++;
          if (isWin(modifiedResult.mlPrediction, res)) extremeChaosModifiedWins++;
      }
  });

  const report = `# Hybrid ML Engine Testing Results

## Overall Performance
- **Total Matches Evaluated:** ${totalTested}
- **Baseline Engine Accuracy:** ${(baselineWins/totalTested*100).toFixed(1)}% (${baselineWins}/${totalTested})
- **Modified Engine Accuracy:** ${(modifiedWins/totalTested*100).toFixed(1)}% (${modifiedWins}/${totalTested})
- **Total Net Gain:** ${modifiedWins - baselineWins} wins

## 1. The Two Pillars Override (Algo + PAA)
- **Matches where applied:** ${twoPillarsApplied}
- **Baseline Logic Wins:** ${twoPillarsBaselineWins}
- **Two Pillars Logic Wins:** ${twoPillarsModifiedWins}
- **Net Gain:** ${twoPillarsModifiedWins - twoPillarsBaselineWins} wins

## 2. Extreme Chaos Override (All Prob <= 40%)
- **Matches where applied:** ${extremeChaosApplied}
- **Baseline Logic Wins:** ${extremeChaosBaselineWins}
- **Extreme Chaos Logic Wins:** ${extremeChaosModifiedWins}
- **Net Gain:** ${extremeChaosModifiedWins - extremeChaosBaselineWins} wins
`;

  fs.writeFileSync('C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\ml_engine_test_results.md', report);
  console.log('Testing complete! Check ml_engine_test_results.md');
}

runTest().catch(console.error);
