/**
 * Sandbox Test: New Slip Selection Engine vs 39 Matches (2026-08-08)
 * Tests whether the improved engine would have selected 12 matches
 * that ended in Market Favorite or Draw.
 */
import fs from 'fs';
import path from 'path';
import { generateSeerAiCognitiveSlips } from '../src/utils/seerAiSlipSelection';
import { generateSeerSlips } from '../src/utils/seerSlipSelection';
import { Match } from '../src/types';

const ROOT = process.cwd();

function loadJson(filePath: string): any {
    const full = path.join(ROOT, filePath);
    if (!fs.existsSync(full)) return null;
    const raw = fs.readFileSync(full, 'utf8');
    try { return JSON.parse(raw); } catch { return null; }
}

function getActualOutcome(result: string): string {
    if (!result) return 'pending';
    const parts = result.split(':').map(Number);
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return 'pending';
    if (parts[0] > parts[1]) return '1';
    if (parts[0] < parts[1]) return '2';
    return 'X';
}

function getMarketFav(m: Match): string {
    if (!m.mo) return '1';
    const parts = m.mo.split(/[- ,]+/).map(p => parseFloat(p.trim())).filter(p => !isNaN(p) && p > 0);
    if (parts.length < 3) return '1';
    return parts[0] < parts[2] ? '1' : '2';
}

function isFavOrDraw(outcome: string, mfav: string): boolean {
    return outcome === mfav || outcome === 'X';
}

function run() {
    console.log('='.repeat(60));
    console.log('SEER SLIP SELECTION ENGINE — SANDBOX TEST');
    console.log('Target: 2026-08-08 matches');
    console.log('='.repeat(60));

    // Load precalculated matches for 2026-08-08
    const allData = loadJson('supabase_backup/precalculated_matches.json');
    if (!allData) { console.error('Could not load precalculated_matches.json'); process.exit(1); }

    const rawMatches: Match[] = allData
        .filter((item: any) => {
            const m = item.data || item;
            return m.date && m.date.startsWith('2026-08-08');
        })
        .map((item: any) => item.data || item);

    console.log(`\nTotal matches on 2026-08-08: ${rawMatches.length}`);

    // Load PHA stats
    let phaStatsMap: Record<string, any> = {};
    const phaRaw = loadJson('supabase_backup/pha_stats.json');
    if (phaRaw && typeof phaRaw === 'object' && !Array.isArray(phaRaw)) phaStatsMap = phaRaw;

    // Fallback: pattern_accuracy_audit
    if (Object.keys(phaStatsMap).length === 0) {
        const auditRaw = loadJson('supabase_backup/pattern_accuracy_audit.json');
        if (auditRaw) {
            if (Array.isArray(auditRaw)) {
                auditRaw.forEach((entry: any) => {
                    const sub = entry.subPattern || entry.sub_pattern;
                    if (sub) phaStatsMap[sub] = entry;
                });
            } else {
                phaStatsMap = auditRaw;
            }
        }
    }

    // Supplement from ml_matrix_processed_matches
    const mlMatrixRaw = loadJson('supabase_backup/ml_matrix_processed_matches.json');
    if (mlMatrixRaw && Array.isArray(mlMatrixRaw)) {
        mlMatrixRaw.forEach((entry: any) => {
            const sub = entry.subPattern || entry.sub_pattern;
            if (sub && !phaStatsMap[sub]) phaStatsMap[sub] = entry;
        });
    }

    console.log(`PHA stats loaded: ${Object.keys(phaStatsMap).length} sub-patterns\n`);

    const matchStars: Record<string, number> = {};

    // Actual outcomes breakdown
    let totalMfav = 0, totalDraw = 0, totalUnderdog = 0, totalPending = 0;
    rawMatches.forEach(m => {
        const outcome = getActualOutcome(m.result || '');
        const mfav = getMarketFav(m);
        if (outcome === 'pending') { totalPending++; return; }
        if (outcome === mfav) totalMfav++;
        else if (outcome === 'X') totalDraw++;
        else totalUnderdog++;
    });

    console.log('ACTUAL RESULTS BREAKDOWN:');
    console.log(`  Market Favorite wins: ${totalMfav}`);
    console.log(`  Draws:                ${totalDraw}`);
    console.log(`  Underdog wins:        ${totalUnderdog}`);
    console.log(`  Pending/Unknown:      ${totalPending}`);
    console.log(`  Total Fav+Draw pool:  ${totalMfav + totalDraw}`);

    // ─── TEST 1: SEER AI COGNITIVE SLIPS ───
    console.log('\n' + '─'.repeat(60));
    console.log('TEST 1: SEER AI COGNITIVE SLIPS (top_10_value)');
    console.log('─'.repeat(60));

    let aiSlips: any = {};
    try {
        aiSlips = generateSeerAiCognitiveSlips(rawMatches, phaStatsMap, matchStars, false, false);
    } catch (e: any) {
        console.error('Error generating AI slips:', e.message);
    }

    const top10Picks = aiSlips?.live?.top_10_value || [];
    let aiCorrect = 0, aiWrong = 0, aiPending = 0;

    console.log(`\nPicks generated: ${top10Picks.length}`);
    console.log('\n  #  | Pred | Result  | MFav | Outcome');
    console.log('  ' + '-'.repeat(50));

    top10Picks.forEach((pick: any, i: number) => {
        const matchId = pick.match_id || pick.matchId || pick.id;
        const match = rawMatches.find(m => String(m.id) === String(matchId));
        if (!match) { console.log(`  ${(i+1).toString().padStart(2)}. MATCH NOT FOUND (${matchId})`); return; }

        const outcome = getActualOutcome(match.result || '');
        const mfav = getMarketFav(match);
        const pred = (pick.prediction || pick.seerPrediction || '?').padEnd(3);
        const res = (match.result || '??').padEnd(7);
        const isCorrect = outcome === 'pending' ? null : pred.trim().includes(outcome);

        if (outcome === 'pending') { aiPending++; }
        else if (isCorrect) { aiCorrect++; }
        else { aiWrong++; }

        const mark = outcome === 'pending' ? '⏳' : isCorrect ? '✅' : '❌';

        let extraInfo = '';
        if (!isCorrect && outcome !== 'pending') {
            const sub = match.patternAnalysis?.subPattern || '?';
            const upsetRate = match._cachedMatchStats?.paaStats?.upsetRate || 0;
            extraInfo = ` [Upset: ${upsetRate.toFixed(1)}% | Sub: ${sub}]`;
        }

        const outLabel = outcome === 'pending' ? 'Pending' : isCorrect ? 'WIN ' : 'LOSS';
        console.log(`  ${(i+1).toString().padStart(2)}. [${pred}] ${res} MFav=${mfav}  ${mark} ${outLabel}${extraInfo}`);
    });

    const aiTotal = top10Picks.length - aiPending;
    const aiAccuracy = aiTotal > 0 ? ((aiCorrect / aiTotal) * 100).toFixed(1) : '0';
    console.log(`\n  ✅ Correct: ${aiCorrect}/${aiTotal} → Accuracy: ${aiAccuracy}%`);

    // ─── TEST 2: SEER OPTIMIZED SLIPS ───
    console.log('\n' + '─'.repeat(60));
    console.log('TEST 2: SEER OPTIMIZED SLIPS (top_10_value / Top 12)');
    console.log('─'.repeat(60));

    let optSlips: any = {};
    try {
        optSlips = generateSeerSlips(rawMatches, phaStatsMap, matchStars, false, false);
    } catch (e: any) {
        console.error('Error generating Optimized slips:', e.message);
    }

    const optTop12 = optSlips?.live?.top_10_value || [];
    let optCorrect = 0, optWrong = 0, optPending = 0;

    console.log(`\nPicks generated: ${optTop12.length}`);
    console.log('\n  #  | Pred | Result  | MFav | Outcome');
    console.log('  ' + '-'.repeat(50));

    optTop12.forEach((pick: any, i: number) => {
        const matchId = pick.match_id || pick.matchId || pick.id;
        const match = rawMatches.find(m => String(m.id) === String(matchId));
        if (!match) { console.log(`  ${(i+1).toString().padStart(2)}. MATCH NOT FOUND (${matchId})`); return; }

        const outcome = getActualOutcome(match.result || '');
        const mfav = getMarketFav(match);
        const pred = (pick.prediction || pick.seerPrediction || '?').padEnd(3);
        const res = (match.result || '??').padEnd(7);
        const isCorrect = outcome === 'pending' ? null : pred.trim().includes(outcome);

        if (outcome === 'pending') { optPending++; }
        else if (isCorrect) { optCorrect++; }
        else { optWrong++; }

        const mark = outcome === 'pending' ? '⏳' : isCorrect ? '✅' : '❌';
        const outLabel = outcome === 'pending' ? 'Pending' : isCorrect ? 'WIN ' : 'LOSS';
        console.log(`  ${(i+1).toString().padStart(2)}. [${pred}] ${res} MFav=${mfav}  ${mark} ${outLabel}`);
    });

    const optTotal = optTop12.length - optPending;
    const optAccuracy = optTotal > 0 ? ((optCorrect / optTotal) * 100).toFixed(1) : '0';
    console.log(`\n  ✅ Correct: ${optCorrect}/${optTotal} → Accuracy: ${optAccuracy}%`);

    // ─── FINAL SUMMARY ───
    console.log('\n' + '='.repeat(60));
    console.log('FINAL SUMMARY');
    console.log('='.repeat(60));
    console.log(`  Pool: ${rawMatches.length} matches`);
    console.log(`  Available Fav/Draw:      ${totalMfav + totalDraw} of ${rawMatches.length - totalPending}`);
    console.log(`  SEER AI Top10:           ${aiCorrect}/${aiTotal} (${aiAccuracy}%)`);
    console.log(`  SEER Optimized Top12:    ${optCorrect}/${optTotal} (${optAccuracy}%)`);
    console.log('='.repeat(60));
}

run();
