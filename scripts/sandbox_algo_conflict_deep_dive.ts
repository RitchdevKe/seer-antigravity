import * as fs from 'fs';
import * as path from 'path';

import { Match } from '../src/types';
import { getMatchStats } from '../src/utils/matchEvaluator';
import { getOdds } from '../src/utils/volatilityEngine';
import { detectMainPattern, analyzeSubPatterns, getActiveFlags } from '../src/components/Patterns';

const dataPath = path.join(process.cwd(), 'supabase_backup', 'precalculated_matches.json');
const paaPath = path.join(process.cwd(), 'supabase_backup', 'pattern_accuracy_audit.json');

const dbRows = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
const rawMatches = dbRows.map((r: any) => r.data || r);
const paaStatsRaw = JSON.parse(fs.readFileSync(paaPath, 'utf-8'));

const phaStatsMap: Record<string, any> = {};
for (const p of paaStatsRaw) {
    if (p.sub_pattern) {
        phaStatsMap[p.sub_pattern] = p;
    }
}

let validMatches = rawMatches.filter((m: any) => {
    if (!m.result || !m.mo) return false;
    if (!m.algoReport?.probabilities) return false;
    if (!m.totalPoints) return false;
    const odds = getOdds(m as Match);
    if (odds.favOdds < 1.3 || odds.favOdds > 2.80) return false;
    return true;
});

let matchesStats = [];

for (const m of validMatches) {
    const stats = getMatchStats(m, phaStatsMap);
    const odds = getOdds(m);
    
    const mFav = odds.o1 <= odds.o2 ? '1' : '2';
    const mUd = mFav === '1' ? '2' : '1';
    const favDC = mFav === '1' ? '1X' : 'X2';
    const upsetDC = mUd === '1' ? '1X' : 'X2';

    const algoProbs = m.algoReport?.probabilities || { '1': 0, 'X': 0, '2': 0 };
    const rawFav = (algoProbs[mFav] || 0) * 100;
    const rawDraw = (algoProbs['X'] || 0) * 100;
    const rawUnd = (algoProbs[mUd] || 0) * 100;
    
    const subPat = m.patternAnalysis?.subPattern || "N/A";
    const mappedPha = phaStatsMap[subPat] || {};

    const paaDrawCount = mappedPha.draw || stats.paaStats?.draw || 0;
    const paaUpsetCount = mappedPha.upset_win || stats.paaStats?.upsetWin || 0;
    const paaTotal = mappedPha.total || stats.paaStats?.total || 1;
    const phaDrawPct = (paaDrawCount / paaTotal) * 100;
    const phaUpsetPct = (paaUpsetCount / paaTotal) * 100;

    const matrixDraw = (phaDrawPct + rawDraw) / 2;
    const matrixUnd = (phaUpsetPct + rawUnd) / 2;

    let volScore = 0;
    const isFavHome = mFav === '1';
    if (phaUpsetPct > phaDrawPct * 1.2) volScore += 2;
    if (phaUpsetPct > 35) volScore += 1;
    if (phaUpsetPct > 50) volScore += 2;
    if (rawUnd > rawDraw) volScore += 1.5;
    if (rawUnd > rawDraw + 5) volScore += 1.5;
    if (rawUnd > 40) volScore += 1;
    if (rawUnd > 30) volScore += 1;
    if (rawUnd > 45) volScore += 2;
    const homePts = m.totalPoints?.home || 0;
    const awayPts = m.totalPoints?.away || 0;
    const upsetHasMorePoints = (mUd === '1' && homePts > awayPts) || (mUd === '2' && awayPts > homePts);
    if (upsetHasMorePoints) volScore += 2;
    const league = (m.league || '').toLowerCase();
    if (/cup|friendly|tanzania|kenya|uganda|rwanda|egypt|morocco|nigeria|ghana|south africa|zambia|senegal|tunisia|algeria/i.test(league)) volScore += 1;
    if (rawDraw > 35 || phaDrawPct > 40) volScore -= 2;
    const u25Prob = (m.algoReport?.probabilities?.['U2.5'] || 0) * 100;
    if (u25Prob >= 65) volScore -= 1.5;
    if (volScore < 0) volScore = 0;

    let ar = "";
    if (m.result && m.result.includes(':')) {
        const [hg, ag] = m.result.split(':').map(Number);
        if (hg > ag) ar = '1';
        else if (hg < ag) ar = '2';
        else ar = 'X';
    } else {
        ar = (m.result || "").trim();
    }
    const isFav = ar === mFav;
    const isDraw = ar === 'X';
    const isUd = ar === mUd;

    const mainPattern = detectMainPattern(m);
    const activeFlags = getActiveFlags(m);
    const subPatternAnalysis = analyzeSubPatterns(mainPattern, m, activeFlags, []);
    const subPred = subPatternAnalysis?.finalPrediction || favDC;

    const paaPred = m.paaPrediction || favDC;
    const algoPred = m.algoReport?.prediction || favDC;
    const seerPred = m.seerPrediction || favDC;

    const isPaaSeerAgree = (paaPred === favDC && seerPred === favDC);
    const isPaaSubSeerAgree = (paaPred === favDC && seerPred === favDC && subPred === favDC);

    const isAlgo12 = algoPred === '12';
    const isSub1X = subPred === favDC || subPred === upsetDC;
    const isPaa1X = paaPred === favDC || paaPred === upsetDC;
    const isSeer1X = seerPred === favDC || seerPred === upsetDC;

    // Triple consensus: Sub + PAA + Seer all say 1X/X2
    const isTripleConsensus = isAlgo12 && isSub1X && isPaa1X && isSeer1X;
    
    // Double consensus: Seer + PAA say 1X/X2, but Sub says 12
    const isDoubleConsensus = isAlgo12 && !isSub1X && isPaa1X && isSeer1X;

    if (isTripleConsensus || isDoubleConsensus) {
        matchesStats.push({
            isFav, isDraw, isUd,
            odds, isFavHome: mFav === '1', homePts, awayPts,
            matrixUnd, matrixDraw, volScore, rawUnd, rawDraw, phaDrawPct, phaUpsetPct, favDC, upsetDC,
            type: isTripleConsensus ? 'TRIPLE' : 'DOUBLE'
        });
    }
}

let sumFav = { count: 0, matrixUnd: 0, matrixDraw: 0, volScore: 0, favOdds: 0, rawUnd: 0, paaUpset: 0, paaDraw: 0, homePts: 0, awayPts: 0 };
let sumDraw = { count: 0, matrixUnd: 0, matrixDraw: 0, volScore: 0, favOdds: 0, rawUnd: 0, paaUpset: 0, paaDraw: 0, homePts: 0, awayPts: 0 };
let sumUd = { count: 0, matrixUnd: 0, matrixDraw: 0, volScore: 0, favOdds: 0, rawUnd: 0, paaUpset: 0, paaDraw: 0, homePts: 0, awayPts: 0 };

for (const s of matchesStats) {
    if (s.isFav) {
        sumFav.count++;
        sumFav.matrixUnd += s.matrixUnd; sumFav.matrixDraw += s.matrixDraw;
        sumFav.volScore += s.volScore; sumFav.favOdds += s.odds.favOdds;
        sumFav.rawUnd += s.rawUnd; sumFav.paaUpset += s.phaUpsetPct;
        sumFav.paaDraw += s.phaDrawPct; sumFav.homePts += s.homePts; sumFav.awayPts += s.awayPts;
    }
    if (s.isDraw) {
        sumDraw.count++;
        sumDraw.matrixUnd += s.matrixUnd; sumDraw.matrixDraw += s.matrixDraw;
        sumDraw.volScore += s.volScore; sumDraw.favOdds += s.odds.favOdds;
        sumDraw.rawUnd += s.rawUnd; sumDraw.paaUpset += s.phaUpsetPct;
        sumDraw.paaDraw += s.phaDrawPct; sumDraw.homePts += s.homePts; sumDraw.awayPts += s.awayPts;
    }
    if (s.isUd) {
        sumUd.count++;
        sumUd.matrixUnd += s.matrixUnd; sumUd.matrixDraw += s.matrixDraw;
        sumUd.volScore += s.volScore; sumUd.favOdds += s.odds.favOdds;
        sumUd.rawUnd += s.rawUnd; sumUd.paaUpset += s.phaUpsetPct;
        sumUd.paaDraw += s.phaDrawPct; sumUd.homePts += s.homePts; sumUd.awayPts += s.awayPts;
    }
}

const tcMatches = matchesStats.filter(m => m.type === 'TRIPLE');
const dcMatches = matchesStats.filter(m => m.type === 'DOUBLE');

console.log(`\n--- CONFLICT COUNTS ---`);
console.log(`Triple Consensus (Sub+PAA+Seer vs Algo): ${tcMatches.length}`);
console.log(`Double Consensus (PAA+Seer vs Algo, Sub agrees w/ Algo or is generic): ${dcMatches.length}`);

console.log(`--- AVERAGE STATS BY ACTUAL OUTCOME ---`);
console.log(`When FAV Wins (Count: ${sumFav.count}):`);
console.log(`Avg VolScore: ${(sumFav.volScore / sumFav.count).toFixed(2)}, Avg MatrixUnd: ${(sumFav.matrixUnd / sumFav.count).toFixed(2)}, Avg MatrixDraw: ${(sumFav.matrixDraw / sumFav.count).toFixed(2)}`);
console.log(`Avg RawUnd: ${(sumFav.rawUnd / sumFav.count).toFixed(2)}, Avg PaaUpset: ${(sumFav.paaUpset / sumFav.count).toFixed(2)}, Avg PaaDraw: ${(sumFav.paaDraw / sumFav.count).toFixed(2)}`);
console.log(`Avg FavOdds: ${(sumFav.favOdds / sumFav.count).toFixed(2)}`);

console.log(`\nWhen DRAW Wins (Count: ${sumDraw.count}):`);
console.log(`Avg VolScore: ${(sumDraw.volScore / sumDraw.count).toFixed(2)}, Avg MatrixUnd: ${(sumDraw.matrixUnd / sumDraw.count).toFixed(2)}, Avg MatrixDraw: ${(sumDraw.matrixDraw / sumDraw.count).toFixed(2)}`);
console.log(`Avg RawUnd: ${(sumDraw.rawUnd / sumDraw.count).toFixed(2)}, Avg PaaUpset: ${(sumDraw.paaUpset / sumDraw.count).toFixed(2)}, Avg PaaDraw: ${(sumDraw.paaDraw / sumDraw.count).toFixed(2)}`);
console.log(`Avg FavOdds: ${(sumDraw.favOdds / sumDraw.count).toFixed(2)}`);

console.log(`\nWhen UPSET Wins (Count: ${sumUd.count}):`);
console.log(`Avg VolScore: ${(sumUd.volScore / sumUd.count).toFixed(2)}, Avg MatrixUnd: ${(sumUd.matrixUnd / sumUd.count).toFixed(2)}, Avg MatrixDraw: ${(sumUd.matrixDraw / sumUd.count).toFixed(2)}`);
console.log(`Avg RawUnd: ${(sumUd.rawUnd / sumUd.count).toFixed(2)}, Avg PaaUpset: ${(sumUd.paaUpset / sumUd.count).toFixed(2)}, Avg PaaDraw: ${(sumUd.paaDraw / sumUd.count).toFixed(2)}`);
console.log(`Avg FavOdds: ${(sumUd.favOdds / sumUd.count).toFixed(2)}`);

// === TRIPLE CONSENSUS: STRICT DOUBLE CHANCE STRATEGY ===
console.log(`\n==============================================`);
console.log(`=== TRIPLE CONSENSUS: STRICT DOUBLE CHANCE ===`);
console.log(`==============================================`);
let bestROI_TC = -100;
let bestNetGain_TC = -1000;
let bestSettings_TC = "";

const evalPred = (pred, s) => {
    let w = false;
    let oddsToUse = 1;

    if (pred === 'FAV_DC') {
        w = s.isFav || s.isDraw;
        const oFav = s.isFavHome ? s.odds.o1 : s.odds.o2;
        oddsToUse = (oFav * s.odds.oX) / (oFav + s.odds.oX);
    } else if (pred === 'UD_DC') {
        w = s.isUd || s.isDraw;
        const oUd = s.isFavHome ? s.odds.o2 : s.odds.o1;
        oddsToUse = (oUd * s.odds.oX) / (oUd + s.odds.oX);
    } else if (pred === '12') {
        w = s.isFav || s.isUd;
        oddsToUse = (s.odds.o1 * s.odds.o2) / (s.odds.o1 + s.odds.o2);
    }

    return { w, oddsToUse };
};

const dcPreds = ['FAV_DC', 'UD_DC', '12'];

for (let vCut = 1.0; vCut <= 4.0; vCut += 0.5) {
    for (let uCut = 22; uCut <= 30; uCut += 2) {
        for (const hp of dcPreds) {
            for (const lp of dcPreds) {
                if (hp === lp) continue; // Skip if same strategy
                let t = { count: 0, wins: 0, gross: 0 };
                
                for (const s of matchesStats) {
                    let pred = lp;
                    if (s.volScore >= vCut && s.matrixUnd >= uCut) {
                        pred = hp;
                    }

                    const { w, oddsToUse } = evalPred(pred, s);
                    if (w) {
                        t.wins++;
                        t.gross += oddsToUse;
                    }
                    t.count++;
                }

                const roi = t.count > 0 ? ((t.gross - t.count) / t.count) * 100 : -100;
                const netGain = t.gross - t.count;
                if (roi > bestROI_TC || (roi > 0 && netGain > bestNetGain_TC)) {
                    bestROI_TC = roi;
                    bestNetGain_TC = netGain;
                    bestSettings_TC = `Vol>=${vCut.toFixed(1)} & MatUnd>=${uCut} -> ${hp}; Else -> ${lp}`;
                }
            }
        }
    }
}

console.log(`\n--- TRIPLE CONSENSUS BEST SETTINGS (STRICT DC) ---`);
console.log(`Best ROI: ${bestROI_TC.toFixed(1)}%`);
console.log(`Best Net Gain: ${bestNetGain_TC.toFixed(2)} units`);
console.log(`Settings: ${bestSettings_TC}`);

// === DOUBLE CONSENSUS: STRICT DOUBLE CHANCE STRATEGY ===
console.log(`\n==============================================`);
console.log(`=== DOUBLE CONSENSUS: STRICT DOUBLE CHANCE ===`);
console.log(`==============================================`);
let bestROI_DC = -100;
let bestNetGain_DC = -1000;
let bestSettings_DC = "";

for (let vCut = 1.0; vCut <= 4.0; vCut += 0.5) {
    for (let uCut = 22; uCut <= 30; uCut += 2) {
        for (const hp of dcPreds) {
            for (const lp of dcPreds) {
                if (hp === lp) continue;
                let t = { count: 0, wins: 0, gross: 0 };
                
                for (const s of matchesStats) {
                    if (s.type !== 'DOUBLE') continue;
                    let pred = lp;
                    if (s.volScore >= vCut && s.matrixUnd >= uCut) {
                        pred = hp;
                    }

                    const { w, oddsToUse } = evalPred(pred, s);
                    if (w) {
                        t.wins++;
                        t.gross += oddsToUse;
                    }
                    t.count++;
                }

                const roi = t.count > 0 ? ((t.gross - t.count) / t.count) * 100 : -100;
                const netGain = t.gross - t.count;
                if (roi > bestROI_DC || (roi > 0 && netGain > bestNetGain_DC)) {
                    bestROI_DC = roi;
                    bestNetGain_DC = netGain;
                    bestSettings_DC = `Vol>=${vCut.toFixed(1)} & MatUnd>=${uCut} -> ${hp}; Else -> ${lp}`;
                }
            }
        }
    }
}

console.log(`\n--- DOUBLE CONSENSUS BEST SETTINGS (STRICT DC) ---`);
console.log(`Best ROI: ${bestROI_DC.toFixed(1)}%`);
console.log(`Best Net Gain: ${bestNetGain_DC.toFixed(2)} units`);
console.log(`Settings: ${bestSettings_DC}`);
