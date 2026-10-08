import { supabase } from './src/lib/supabase';
import { processMatch, getActualResult, matchesPrediction } from './src/utils/matchProcessing';
import { Match } from './src/types';
import { generateSeerSlips, calculateMatchProbability } from './src/utils/seerSlipSelection';
import { generateSeerAiCognitiveSlips } from './src/utils/seerAiSlipSelection';
import * as fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

if (typeof global !== 'undefined') {
  (global as any).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
  };
  (global as any).indexedDB = {
    open: () => ({}),
  };
}

function safeGetResult(m: Match): string {
  if (!m || !m.result) return 'pending';
  return getActualResult(String(m.result));
}

async function run() {
  console.log("Loading backup data...");
  const fileContent = fs.readFileSync('./supabase_backup/live_matches.json', 'utf-8');
  const data = JSON.parse(fileContent);
  
  const allMatches: Match[] = [];
  data.forEach((row: any) => { if (row.data) allMatches.push(processMatch(row.data as Match)); });

  // Use all matches, including pending, so we can generate slips for today's live analysis
  const completedMatches = allMatches;
  
  // Group by date
  const byDate = new Map<string, Match[]>();
  completedMatches.forEach(m => {
    let d = m.date || 'unknown';
    if (d.includes(' ')) d = d.split(' ')[0];
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(m);
  });
  
  console.log(`Found ${completedMatches.length} completed matches across ${byDate.size} dates.`);
  for (const [d, matches] of byDate.entries()) {
    console.log(`Date: ${d} | Matches: ${matches.length}`);
  }

  let phaStatsMap: Record<string, any> = {};
  const phaData = JSON.parse(fs.readFileSync('./supabase_backup/pha_stats.json', 'utf-8'));
  phaData.forEach((row: any) => {
    if (row.sub_pattern) phaStatsMap[row.sub_pattern] = row;
  });

  const matchStars: Record<string, number> = {};
  completedMatches.forEach(m => {
    matchStars[m.id.toString()] = calculateMatchProbability(m, phaStatsMap);
  });

  console.log(`Evaluating Pool of ${completedMatches.length} Matches`);
  console.log(`========================================================`);
  
  // Generate SEER Optimized Slips
  const optSlips = generateSeerSlips(completedMatches, phaStatsMap, matchStars, false);
  const top12Opt = optSlips.live['top_10_value'] || [];
  
  // Generate SEER AI Slips
  const aiSlips = generateSeerAiCognitiveSlips(completedMatches, phaStatsMap, matchStars, false, true);
  const top12Ai = aiSlips.live['top_10_value'] || [];

  function evaluateSlip(name: string, slip: any[]) {
    console.log(`\n--- ${name} (Generated: ${slip.length}) ---`);
    let correct = 0;
    slip.forEach((p: any, idx: number) => {
      const m = completedMatches.find(m => m.id.toString() === p.match_id);
      const actual = safeGetResult(m!);
      const isWin = matchesPrediction(p.prediction, actual);
      if (isWin) correct++;
      console.log(`${idx+1}. [${p.prediction}] ${p.team} | Result: ${actual} | ${isWin ? '✅ WIN' : '❌ LOSS'}`);
      if (!isWin) {
          const stats = phaStatsMap[m!.patternAnalysis?.subPattern || ''];
          console.log(`    -> Why selected? ${p.reason}`);
          console.log(`    -> Tags: ${p.tag_trace}`);
          console.log(`    -> Mo Fav: ${m!.moFav} | Upset: ${m!.paaUpset}`);
      }
    });
    console.log(`==> Total Score: ${correct}/${slip.length}`);
  }

  evaluateSlip("SEER Optimized Top 12 Slip", top12Opt);
  evaluateSlip("SEER AI Top 12 Slip", top12Ai);
}

run().catch(console.error);
