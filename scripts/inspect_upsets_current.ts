import { getOptimizedScoreDetailed } from '../src/utils/optimizedweights.js';
import fs from 'fs';

const liveMatches = JSON.parse(fs.readFileSync('C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\combined_upsets_matches.json', 'utf8'));

const satMatches = liveMatches.filter((m: any) => m.dateStr === '2026-09-19' || m.id.includes('20260919'));
const sunMatches = liveMatches.filter((m: any) => m.dateStr === '2026-09-20' || m.id.includes('20260920'));

function evalMatches(matches: any[], label: string) {
  const scored = matches.map(m => {
    const rawMatch = m.match || m;
    const detailed = getOptimizedScoreDetailed(rawMatch, 'upsets', {});
    const mFav = m.teamsData?.market_favorite || m.mFav;
    const moUnderdog = m.teamsData?.market_underdog || (mFav === '1' ? '2' : '1');
    const actual = m.resultData?.actual || m.actual;
    
    let outcome = 'DRAW';
    if (actual === moUnderdog) outcome = 'UNDERDOG';
    else if (actual === mFav) outcome = 'MFAV';
    
    return {
      teams: m.teams,
      result: m.result,
      actual,
      mFav,
      moUnderdog,
      outcome,
      totalScore: detailed.totalScore,
      rulesHit: detailed.rulesHit
    };
  });

  scored.sort((a, b) => b.totalScore - a.totalScore);
  const top5 = scored.slice(0, 5);
  const top10 = scored.slice(0, 10);
  const top20 = scored.slice(0, 20);

  const ud5 = top5.filter(m => m.outcome === 'UNDERDOG').length;
  const ud10 = top10.filter(m => m.outcome === 'UNDERDOG').length;
  const ud20 = top20.filter(m => m.outcome === 'UNDERDOG').length;

  const dr5 = top5.filter(m => m.outcome === 'DRAW').length;
  const dr10 = top10.filter(m => m.outcome === 'DRAW').length;
  const dr20 = top20.filter(m => m.outcome === 'DRAW').length;

  const mf5 = top5.filter(m => m.outcome === 'MFAV').length;
  const mf10 = top10.filter(m => m.outcome === 'MFAV').length;
  const mf20 = top20.filter(m => m.outcome === 'MFAV').length;

  const bRank = scored.findIndex(m => m.teams.toLowerCase().includes('brighton') || m.teams.toLowerCase().includes('arsenal')) + 1;
  const bScore = scored.find(m => m.teams.toLowerCase().includes('brighton') || m.teams.toLowerCase().includes('arsenal'))?.totalScore;

  console.log(`\n=================== CURRENT CODEBASE: ${label} ===================`);
  console.log(`Top 5:  ${ud5}/5 (${(ud5/5*100).toFixed(1)}%) [Drw: ${dr5}, MF: ${mf5}]`);
  console.log(`Top 10: ${ud10}/10 (${(ud10/10*100).toFixed(1)}%) [Drw: ${dr10}, MF: ${mf10}]`);
  console.log(`Top 20: ${ud20}/20 (${(ud20/20*100).toFixed(1)}%) [Drw: ${dr20}, MF: ${mf20}]`);
  console.log(`Brighton vs Arsenal: Rank #${bRank} with ${bScore} pts`);

  console.log(`\n--- Top 10 Matches ---`);
  top10.forEach((m, idx) => {
    const mark = m.outcome === 'UNDERDOG' ? '✅ UD' : (m.outcome === 'DRAW' ? '⚠️ DR' : '❌ MF');
    console.log(`${(idx + 1).toString().padStart(2)}. [${mark}] ${m.teams.padEnd(35)} | Res: ${m.result.padEnd(5)} | Score: ${m.totalScore}`);
  });
}

evalMatches(satMatches, "SATURDAY (CURRENT CODE)");
evalMatches(sunMatches, "SUNDAY (CURRENT CODE)");
evalMatches(liveMatches, "COMBINED (CURRENT CODE)");
