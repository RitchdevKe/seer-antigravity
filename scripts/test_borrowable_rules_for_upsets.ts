import fs from 'fs';
import { Match } from '../src/types';
import { getActualResult } from '../src/utils/matchProcessing';
import { getMarketFavorite, getOptimizedScoreDetailed, getOptimizedBaseWeight, CODE_DEFAULT_CATEGORY_SETTINGS } from '../src/utils/optimizedweights';

const dumpPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\combined_upsets_matches.json';
const matches: Array<{
  id: any;
  teams: string;
  league: string;
  result: string;
  actual: string;
  mFav: string;
  moUnderdog: string;
  outcome: 'MFAV' | 'DRAW' | 'UNDERDOG';
  basePoints: number;
  batch: string;
  match: Match;
}> = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

const phaStatsMap = {};

interface CandidateRule {
  description: string;
  test: (m: Match, detail: any) => boolean;
}

const candidateRules: CandidateRule[] = [
  // 1. Inverted Favorite Dominance (Penalty Candidates)
  {
    description: "INVERT: Mfav GS => 1.8 and GA =< 1.0",
    test: (m) => {
      const mFav = getMarketFavorite(m);
      const gs = mFav === '1' ? (m.gsh ?? 0) : (m.gsa ?? 0);
      const ga = mFav === '1' ? (m.gah ?? 0) : (m.gaa ?? 0);
      return gs >= 1.8 && ga <= 1.0;
    }
  },
  {
    description: "INVERT: Mfav TS >= 2.0 and Ud TS < 0.7",
    test: (m) => {
      const mFav = getMarketFavorite(m);
      const fTS = mFav === '1' ? (m.tsa ?? 0) : (m.tsb ?? 0);
      const uTS = mFav === '1' ? (m.tsb ?? 0) : (m.tsa ?? 0);
      return fTS >= 2.0 && uTS < 0.7;
    }
  },
  {
    description: "INVERT: Point system has >= 70 points on M.fav",
    test: (m) => {
      const mFav = getMarketFavorite(m);
      const pts = mFav === '1' ? (m.pointsh ?? 0) : (m.pointsa ?? 0);
      return pts >= 70;
    }
  },
  {
    description: "INVERT: Point system has >= 60 to <70 points on M.fav",
    test: (m) => {
      const mFav = getMarketFavorite(m);
      const pts = mFav === '1' ? (m.pointsh ?? 0) : (m.pointsa ?? 0);
      return pts >= 60 && pts < 70;
    }
  },
  {
    description: "INVERT: Point system has >= 50 to <60 points on M.fav",
    test: (m) => {
      const mFav = getMarketFavorite(m);
      const pts = mFav === '1' ? (m.pointsh ?? 0) : (m.pointsa ?? 0);
      return pts >= 50 && pts < 60;
    }
  },
  {
    description: "INVERT: M.fav GA is > 0.6 points lower than Underdog GA",
    test: (m) => {
      const mFav = getMarketFavorite(m);
      const fGA = mFav === '1' ? (m.gah ?? 0) : (m.gaa ?? 0);
      const uGA = mFav === '1' ? (m.gaa ?? 0) : (m.gah ?? 0);
      return (uGA - fGA) > 0.6;
    }
  },
  {
    description: "INVERT: 1X2 Rating => 7",
    test: (m) => (m.rating1x2 ?? 0) >= 7.0
  },
  {
    description: "INVERT: Mfav GS - Ud GS >= 1.0",
    test: (m) => {
      const mFav = getMarketFavorite(m);
      const fGS = mFav === '1' ? (m.gsh ?? 0) : (m.gsa ?? 0);
      const uGS = mFav === '1' ? (m.gsa ?? 0) : (m.gsh ?? 0);
      return (fGS - uGS) >= 1.0;
    }
  },
  {
    description: "INVERT: Both TS <= 1.0 + Pred 1X2 on M.fav",
    test: (m) => {
      const mFav = getMarketFavorite(m);
      const fTS = mFav === '1' ? (m.tsa ?? 0) : (m.tsb ?? 0);
      const uTS = mFav === '1' ? (m.tsb ?? 0) : (m.tsa ?? 0);
      const p1x2 = (m.pred1x2 || '').trim();
      return fTS <= 1.0 && uTS <= 1.0 && p1x2 === mFav;
    }
  },
  {
    description: "INVERT: Away favorite + Mfav GA <= 1.0 & Ud GA > 1.0",
    test: (m) => {
      const mFav = getMarketFavorite(m);
      const fGA = mFav === '1' ? (m.gah ?? 0) : (m.gaa ?? 0);
      const uGA = mFav === '1' ? (m.gaa ?? 0) : (m.gah ?? 0);
      return mFav === '2' && fGA <= 1.0 && uGA > 1.0;
    }
  },

  // 2. Underdog Strength Signals (Bonus Candidates)
  {
    description: "BONUS: Underdog was away on LE and Won",
    test: (m) => {
      const mFav = getMarketFavorite(m);
      const moUd = mFav === '1' ? '2' : '1';
      const le = m.lastEncounter || m.lastEncounterDetails;
      if (!le) return false;
      const leRes = le.result || le.score || '';
      const [h, a] = leRes.split(/[-:]/).map(Number);
      if (isNaN(h) || isNaN(a)) return false;
      const leAwayWon = a > h;
      return moUd === '2' && leAwayWon;
    }
  },
  {
    description: "BONUS: LE Underdog won with 2+ goals margin",
    test: (m) => {
      const mFav = getMarketFavorite(m);
      const moUd = mFav === '1' ? '2' : '1';
      const le = m.lastEncounter || m.lastEncounterDetails;
      if (!le) return false;
      const leRes = le.result || le.score || '';
      const [h, a] = leRes.split(/[-:]/).map(Number);
      if (isNaN(h) || isNaN(a)) return false;
      const udMargin = moUd === '1' ? (h - a) : (a - h);
      return udMargin >= 2;
    }
  },
  {
    description: "BONUS: Point System Inversion (Underdog points > Favorite points)",
    test: (m) => {
      const mFav = getMarketFavorite(m);
      const fPts = mFav === '1' ? (m.pointsh ?? 0) : (m.pointsa ?? 0);
      const uPts = mFav === '1' ? (m.pointsa ?? 0) : (m.pointsh ?? 0);
      return uPts > fPts;
    }
  },
  {
    description: "BONUS: Underdog has >= 5 more points on point system",
    test: (m) => {
      const mFav = getMarketFavorite(m);
      const fPts = mFav === '1' ? (m.pointsh ?? 0) : (m.pointsa ?? 0);
      const uPts = mFav === '1' ? (m.pointsa ?? 0) : (m.pointsh ?? 0);
      return (uPts - fPts) >= 5;
    }
  },
  {
    description: "BONUS: Underdog TS > Mfav TS",
    test: (m) => {
      const mFav = getMarketFavorite(m);
      const fTS = mFav === '1' ? (m.tsa ?? 0) : (m.tsb ?? 0);
      const uTS = mFav === '1' ? (m.tsb ?? 0) : (m.tsa ?? 0);
      return uTS > fTS;
    }
  },
  {
    description: "BONUS: Underdog GA <= 1.0 & Mfav GA >= 1.4",
    test: (m) => {
      const mFav = getMarketFavorite(m);
      const fGA = mFav === '1' ? (m.gah ?? 0) : (m.gaa ?? 0);
      const uGA = mFav === '1' ? (m.gaa ?? 0) : (m.gah ?? 0);
      return uGA <= 1.0 && fGA >= 1.4;
    }
  },
  {
    description: "BONUS: Underdog GS >= 1.5 & Underdog GA <= 1.0",
    test: (m) => {
      const mFav = getMarketFavorite(m);
      const uGS = mFav === '1' ? (m.gsa ?? 0) : (m.gsh ?? 0);
      const uGA = mFav === '1' ? (m.gaa ?? 0) : (m.gah ?? 0);
      return uGS >= 1.5 && uGA <= 1.0;
    }
  },
  {
    description: "BONUS: Both teams GS < 1.0",
    test: (m) => (m.gsh ?? 0) < 1.0 && (m.gsa ?? 0) < 1.0
  },
  {
    description: "BONUS: Underdog odds between 2.80 and 3.40",
    test: (m) => {
      const mFav = getMarketFavorite(m);
      const parts = (m.mo || '').split(/[- ,]+/).map(s => parseFloat(s.trim())).filter(p => !isNaN(p));
      const udOdds = mFav === '1' ? parts[2] : parts[0];
      return udOdds >= 2.80 && udOdds <= 3.40;
    }
  },
  {
    description: "BONUS: Underdog odds <= 2.80",
    test: (m) => {
      const mFav = getMarketFavorite(m);
      const parts = (m.mo || '').split(/[- ,]+/).map(s => parseFloat(s.trim())).filter(p => !isNaN(p));
      const udOdds = mFav === '1' ? parts[2] : parts[0];
      return udOdds > 0 && udOdds <= 2.80;
    }
  },
  {
    description: "BONUS: 1X2 supports the underdog",
    test: (m) => {
      const mFav = getMarketFavorite(m);
      const moUd = mFav === '1' ? '2' : '1';
      return (m.pred1x2 || '').trim() === moUd;
    }
  },
  {
    description: "BONUS: Sub pattern primary prediction supports the underdog",
    test: (m) => {
      const mFav = getMarketFavorite(m);
      const moUd = mFav === '1' ? '2' : '1';
      return (m.patternAnalysis?.subPatternPrediction || '').trim() === moUd;
    }
  },
  {
    description: "BONUS: Algo support for Mfav < 40%",
    test: (m) => {
      const mFav = getMarketFavorite(m);
      const p = m.algoReport?.probabilities?.[mFav as '1'|'2'] ?? 50;
      return p < 40;
    }
  }
];

const results: Array<{
  description: string;
  totalTriggers: number;
  underdogWins: number;
  draws: number;
  mfavWins: number;
  underdogWinPct: number;
  satTriggers: number;
  satUnderdogWins: number;
  satWinPct: number;
  sunTriggers: number;
  sunUnderdogWins: number;
  sunWinPct: number;
}> = [];

candidateRules.forEach(cr => {
  let satTot = 0, satUd = 0, satDr = 0, satMf = 0;
  let sunTot = 0, sunUd = 0, sunDr = 0, sunMf = 0;

  matches.forEach(m => {
    const isSat = m.batch.includes('Saturday');
    if (cr.test(m.match, null)) {
      if (isSat) {
        satTot++;
        if (m.outcome === 'UNDERDOG') satUd++;
        else if (m.outcome === 'DRAW') satDr++;
        else satMf++;
      } else {
        sunTot++;
        if (m.outcome === 'UNDERDOG') sunUd++;
        else if (m.outcome === 'DRAW') sunDr++;
        else sunMf++;
      }
    }
  });

  const totalTriggers = satTot + sunTot;
  const underdogWins = satUd + sunUd;
  const draws = satDr + sunDr;
  const mfavWins = satMf + sunMf;

  results.push({
    description: cr.description,
    totalTriggers,
    underdogWins,
    draws,
    mfavWins,
    underdogWinPct: totalTriggers > 0 ? (underdogWins / totalTriggers) * 100 : 0,
    satTriggers: satTot,
    satUnderdogWins: satUd,
    satWinPct: satTot > 0 ? (satUd / satTot) * 100 : 0,
    sunTriggers: sunTot,
    sunUnderdogWins: sunUd,
    sunWinPct: sunTot > 0 ? (sunUd / sunTot) * 100 : 0
  });
});

console.log('Desc'.padEnd(65) + ' | Tot |  Ud | Drw |  Mf |   Ud% |  Sat% |  Sun%');
console.log('-'.repeat(110));
results.forEach(r => {
  console.log(
    r.description.padEnd(65) + ' | ' +
    r.totalTriggers.toString().padStart(3) + ' | ' +
    r.underdogWins.toString().padStart(3) + ' | ' +
    r.draws.toString().padStart(3) + ' | ' +
    r.mfavWins.toString().padStart(3) + ' | ' +
    r.underdogWinPct.toFixed(1).padStart(5) + '% | ' +
    r.satWinPct.toFixed(1).padStart(5) + '% | ' +
    r.sunWinPct.toFixed(1).padStart(5) + '%'
  );
});

// Save to scratch
const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
fs.writeFileSync(`${outDir}\\upsets_borrowable_rules_stats.json`, JSON.stringify(results, null, 2));
