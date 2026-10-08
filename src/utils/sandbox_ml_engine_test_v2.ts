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
  const matchesPath = 'C:\\Users\\USER\\OneDrive\\Desktop\\SEER ANTIGRAVITY\\supabase_backup\\precalculated_matches.json';
  const rawData = fs.readFileSync(matchesPath, 'utf8');
  const mlModelData = JSON.parse(fs.readFileSync('C:\\Users\\USER\\OneDrive\\Desktop\\SEER ANTIGRAVITY\\public\\ml_model.json', 'utf8'));
  let rawMatches = JSON.parse(rawData);
  const matches = rawMatches.map((m: any) => m.data || m).slice(-4000);
  
  let totalTested = 0;
  
  let baselineWins = 0;
  let modifiedWins = 0;

  let mlComboDiff = 0; let mlComboBW = 0; let mlComboMW = 0;
  let paaUpsetDiff = 0; let paaUpsetBW = 0; let paaUpsetMW = 0;
  let mirageDiff = 0; let mirageBW = 0; let mirageMW = 0;
  let drawHedgeDiff = 0; let drawHedgeBW = 0; let drawHedgeMW = 0;

  const modifiedReasonings = new Set<string>();

  matches.forEach((m: any) => {
      const res = getMatchResult(m.result);
      if (!res) return;
      
      const baselineResult = baselinePredict(m, mlModelData);
      const modifiedResult = modifiedPredict(m, mlModelData);

      if (!baselineResult.mlApplied || !modifiedResult.mlApplied) return;

      totalTested++;
      if (isWin(baselineResult.mlPrediction, res)) baselineWins++;
      if (isWin(modifiedResult.mlPrediction, res)) modifiedWins++;

      if (modifiedResult.mlReasoning) modifiedReasonings.add(modifiedResult.mlReasoning.split(':')[0]);

      if (baselineResult.mlPrediction !== modifiedResult.mlPrediction) {
          if (baselineResult.matrixStats?.exactCombo?.total !== modifiedResult.matrixStats?.exactCombo?.total) {
              mlComboDiff++;
              if (isWin(baselineResult.mlPrediction, res)) mlComboBW++;
              if (isWin(modifiedResult.mlPrediction, res)) mlComboMW++;
          }
          if (modifiedResult.mlReasoning?.includes('AGREEMENT MIRAGE')) {
              mirageDiff++;
              if (isWin(baselineResult.mlPrediction, res)) mirageBW++;
              if (isWin(modifiedResult.mlPrediction, res)) mirageMW++;
          }
          if (modifiedResult.mlReasoning?.includes('High Draw risk') || modifiedResult.mlReasoning?.includes('HIGH Draw Risk Zone')) {
              drawHedgeDiff++;
              if (isWin(baselineResult.mlPrediction, res)) drawHedgeBW++;
              if (isWin(modifiedResult.mlPrediction, res)) drawHedgeMW++;
          }
          if (modifiedResult.mlReasoning?.includes('PAA+PHA SYNERGY')) {
              paaUpsetDiff++; // Repurposing paaUpsetDiff tracker
              if (isWin(baselineResult.mlPrediction, res)) paaUpsetBW++;
              if (isWin(modifiedResult.mlPrediction, res)) paaUpsetMW++;
          }
      }
  });

  console.log("Unique Modified Reasonings:");
  modifiedReasonings.forEach(r => console.log(r));

  const report = `# Hybrid ML Engine Testing Results

## Overall Performance
- **Total Matches Evaluated:** ${totalTested}
- **Baseline Engine Accuracy:** ${(baselineWins/totalTested*100).toFixed(1)}% (${baselineWins}/${totalTested})
- **Modified Engine Accuracy:** ${(modifiedWins/totalTested*100).toFixed(1)}% (${modifiedWins}/${totalTested})
- **Total Net Gain:** ${modifiedWins - baselineWins} wins

## 1. ML Matrix Combo Matching (Wilson Score)
- **Matches where changed:** ${mlComboDiff}
- **Baseline Wins:** ${mlComboBW}
- **Modified Wins:** ${mlComboMW}
- **Net Gain:** ${mlComboMW - mlComboBW}

## 2. Agreement Mirage Fix (Theory 3)
- **Matches where applied:** ${mirageDiff}
- **Baseline Wins:** ${mirageBW}
- **Modified Wins:** ${mirageMW}
- **Net Gain:** ${mirageMW - mirageBW}

## 3. Draw Risk Hedge Fix (12 -> 1X/X2)
- **Matches where applied:** ${drawHedgeDiff}
- **Baseline Wins:** ${drawHedgeBW}
- **Modified Wins:** ${drawHedgeMW}
- **Net Gain:** ${drawHedgeMW - drawHedgeBW}
## 4. PAA + PHA Synergy Lock (M.Fav PHA)
- **Matches where applied:** ${paaUpsetDiff}
- **Baseline Wins:** ${paaUpsetBW}
- **Modified Wins:** ${paaUpsetMW}
- **Net Gain:** ${paaUpsetMW - paaUpsetBW}
`;

  fs.writeFileSync('C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\ml_engine_test_results_v2.md', report);
  console.log('Testing complete! Check ml_engine_test_results_v2.md');
}

runTest().catch(console.error);
