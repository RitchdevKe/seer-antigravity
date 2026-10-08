/**
 * Theory Test: Algo=12 vs Hedged Predictors
 *
 * Theory 1: When PAA + SEER + SubPatt final prediction is 1X or X2, but Algo is 12
 * Theory 2: When PAA + SEER final prediction is 1X or X2, but Algo is 12
 *
 * For each theory: what % go to Fav win, Draw, Underdog?
 *
 * Run: npx tsx scripts/theory_algo12_test.ts
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DATA_PATH = path.join(ROOT, 'supabase_backup/precalculated_matches.json');

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getOutcome(result: string | undefined): '1' | '2' | 'X' | 'pending' {
    if (!result || result === 'pending') return 'pending';
    const p = result.split(':').map(Number);
    if (p.length !== 2 || isNaN(p[0]) || isNaN(p[1])) return 'pending';
    if (p[0] > p[1]) return '1';
    if (p[0] < p[1]) return '2';
    return 'X';
}

function getMoFav(mo: string | undefined, moFavField?: string): string {
    if (moFavField) return moFavField;
    const nums = (mo || '').split(/[,\s]+/).map(parseFloat).filter(n => !isNaN(n) && n > 0);
    if (nums.length >= 3) return nums[0] <= nums[2] ? '1' : '2';
    return '1';
}

function isHedged(pred: string | undefined): boolean {
    return pred === '1X' || pred === 'X2';
}

function isAlgo12(pred: string | undefined): boolean {
    return pred === '12';
}

interface Stats {
    total: number;
    favWin: number;
    draw: number;
    underdog: number;
    pending: number;
    // sub-breakdown by hedge direction
    hedgeTo1X: number;   // prediction is 1X (favoured to home+draw)
    hedgeToX2: number;   // prediction is X2 (favoured to draw+away)
    favWin_1X: number;
    draw_1X: number;
    underdog_1X: number;
    favWin_X2: number;
    draw_X2: number;
    underdog_X2: number;
}

function emptyStats(): Stats {
    return {
        total: 0, favWin: 0, draw: 0, underdog: 0, pending: 0,
        hedgeTo1X: 0, hedgeToX2: 0,
        favWin_1X: 0, draw_1X: 0, underdog_1X: 0,
        favWin_X2: 0, draw_X2: 0, underdog_X2: 0,
    };
}

function addToStats(s: Stats, outcome: '1' | '2' | 'X' | 'pending', moFav: string, predDirection: '1X' | 'X2') {
    s.total++;
    if (outcome === 'pending') { s.pending++; return; }

    const favWon = outcome === moFav;
    const isDraw = outcome === 'X';
    const isUnderdog = !favWon && !isDraw;

    if (favWon) s.favWin++;
    else if (isDraw) s.draw++;
    else s.underdog++;

    if (predDirection === '1X') {
        s.hedgeTo1X++;
        if (favWon) s.favWin_1X++;
        else if (isDraw) s.draw_1X++;
        else s.underdog_1X++;
    } else {
        s.hedgeToX2++;
        if (favWon) s.favWin_X2++;
        else if (isDraw) s.draw_X2++;
        else s.underdog_X2++;
    }
}

function pct(n: number, total: number): string {
    if (total === 0) return '0.0%';
    return ((n / total) * 100).toFixed(1) + '%';
}

function printStats(label: string, s: Stats) {
    const resolved = s.total - s.pending;
    const W = 75;
    console.log('\n' + '═'.repeat(W));
    console.log(`  ${label}`);
    console.log('═'.repeat(W));
    console.log(`  Matching matches  : ${s.total}`);
    console.log(`  Resolved          : ${resolved}  (${s.pending} pending excluded)`);
    console.log('');
    console.log(`  OVERALL OUTCOMES:`);
    console.log(`  ├─ Fav Win    : ${s.favWin.toString().padStart(5)}  →  ${pct(s.favWin, resolved).padStart(6)}`);
    console.log(`  ├─ Draw       : ${s.draw.toString().padStart(5)}  →  ${pct(s.draw, resolved).padStart(6)}`);
    console.log(`  ├─ Underdog   : ${s.underdog.toString().padStart(5)}  →  ${pct(s.underdog, resolved).padStart(6)}`);
    console.log(`  └─ Fav+Draw   : ${(s.favWin+s.draw).toString().padStart(5)}  →  ${pct(s.favWin+s.draw, resolved).padStart(6)}`);

    if (s.hedgeTo1X > 0) {
        const r1X = s.hedgeTo1X - (s.pending > 0 ? 0 : 0); // approximate
        const res1X = s.favWin_1X + s.draw_1X + s.underdog_1X;
        console.log('');
        console.log(`  SUB-BREAKDOWN — prediction = 1X  (${s.hedgeTo1X} matches)`);
        console.log(`  ├─ Fav Win    : ${s.favWin_1X.toString().padStart(5)}  →  ${pct(s.favWin_1X, res1X).padStart(6)}  ✅ (covered by 1X)`);
        console.log(`  ├─ Draw       : ${s.draw_1X.toString().padStart(5)}  →  ${pct(s.draw_1X, res1X).padStart(6)}  ✅ (covered by 1X)`);
        console.log(`  └─ Underdog   : ${s.underdog_1X.toString().padStart(5)}  →  ${pct(s.underdog_1X, res1X).padStart(6)}  ❌ (not covered)`);
    }

    if (s.hedgeToX2 > 0) {
        const resX2 = s.favWin_X2 + s.draw_X2 + s.underdog_X2;
        console.log('');
        console.log(`  SUB-BREAKDOWN — prediction = X2  (${s.hedgeToX2} matches)`);
        console.log(`  ├─ Draw       : ${s.draw_X2.toString().padStart(5)}  →  ${pct(s.draw_X2, resX2).padStart(6)}  ✅ (covered by X2)`);
        console.log(`  ├─ Fav Win    : ${s.favWin_X2.toString().padStart(5)}  →  ${pct(s.favWin_X2, resX2).padStart(6)}  ❌ (not covered by X2 if moFav=1)  ⚠️`);
        console.log(`  └─ Underdog   : ${s.underdog_X2.toString().padStart(5)}  →  ${pct(s.underdog_X2, resX2).padStart(6)}  ✅ (covered by X2 if moFav=1)  or ❌ if moFav=2`);
    }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
function run() {
    console.log('Loading data...');
    const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    const all = raw.map((item: any) => item.data || item)
        .filter((m: any) => m.result && m.result !== 'pending');

    console.log(`Total resolved matches: ${all.length}`);

    const theory1 = emptyStats();  // PAA+SEER+SubPatt hedge, Algo=12
    const theory2 = emptyStats();  // PAA+SEER hedge, Algo=12
    const theory1_control = emptyStats();  // PAA+SEER+SubPatt hedge, Algo NOT 12 (control)
    const theory2_control = emptyStats();  // PAA+SEER hedge, Algo NOT 12 (control)

    // Also track what algo=12 does overall
    const algoIs12Overall = emptyStats();
    // And what hedged final (any predictor) + algo=12 does
    const finalHedged_algo12 = emptyStats();

    let t1_misses_on_moFav = 0;
    let t1_misses_on_udg = 0;

    for (const m of all) {
        const outcome = getOutcome(m.result);
        if (outcome === 'pending') continue;

        const moFav = getMoFav(m.mo, m._moFav);
        const algoPred: string = m.algoReport?.prediction || '';
        const paaPred: string = m.paaPrediction || '';
        const seerPred: string = m.seerPrediction || m.finalPrediction || '';
        const subPatPred: string = m.patternAnalysis?.subPatternPrediction || '';

        const paaHedged = isHedged(paaPred);
        const seerHedged = isHedged(seerPred);
        const subPatHedged = isHedged(subPatPred);
        const algoIs12 = isAlgo12(algoPred);

        // Overall algo=12
        if (algoIs12) {
            addToStats(algoIs12Overall, outcome, moFav, '1X');
        }

        // Theory 1: PAA + SEER + SubPatt all hedged, Algo=12
        if (paaHedged && seerHedged && subPatHedged) {
            const dir = (paaPred === '1X' || seerPred === '1X' || subPatPred === '1X') ? '1X' : 'X2';
            if (algoIs12) {
                addToStats(theory1, outcome, moFav, dir as '1X' | 'X2');
            } else {
                addToStats(theory1_control, outcome, moFav, dir as '1X' | 'X2');
            }
        }

        // Theory 2: PAA + SEER hedged, Algo=12
        if (paaHedged && seerHedged) {
            const dir = (paaPred === '1X' || seerPred === '1X') ? '1X' : 'X2';
            if (algoIs12) {
                addToStats(theory2, outcome, moFav, dir as '1X' | 'X2');
            } else {
                addToStats(theory2_control, outcome, moFav, dir as '1X' | 'X2');
            }
        }
    }

    const W = 75;
    console.log('\n' + '█'.repeat(W));
    console.log('  THEORY TEST: Algo=12 vs Hedged Predictors');
    console.log('  Date: ' + new Date().toISOString().substring(0, 10));
    console.log('  Corpus: All resolved matches in precalculated_matches.json');
    console.log('█'.repeat(W));

    // ── CONTEXT: Overall Algo=12 ──────────────────────────────────────────────
    const aRes = algoIs12Overall.total;
    console.log(`\n  CONTEXT — Algo prediction = 12 (any match): ${algoIs12Overall.total} matches`);
    console.log(`  └─ Fav: ${pct(algoIs12Overall.favWin, aRes)}  Draw: ${pct(algoIs12Overall.draw, aRes)}  UDG: ${pct(algoIs12Overall.underdog, aRes)}`);

    // ── Theory 1 ──────────────────────────────────────────────────────────────
    printStats('THEORY 1: PAA+SEER+SubPatt all hedged (1X or X2)  AND  Algo = 12', theory1);

    const t1_ctrl_res = theory1_control.total;
    console.log(`\n  CONTROL (same hedge conditions, Algo ≠ 12): ${theory1_control.total} matches`);
    console.log(`  └─ Fav: ${pct(theory1_control.favWin, t1_ctrl_res)}  Draw: ${pct(theory1_control.draw, t1_ctrl_res)}  UDG: ${pct(theory1_control.underdog, t1_ctrl_res)}`);

    // ── Theory 2 ──────────────────────────────────────────────────────────────
    printStats('THEORY 2: PAA+SEER both hedged (1X or X2)  AND  Algo = 12', theory2);

    const t2_ctrl_res = theory2_control.total;
    console.log(`\n  CONTROL (same hedge conditions, Algo ≠ 12): ${theory2_control.total} matches`);
    console.log(`  └─ Fav: ${pct(theory2_control.favWin, t2_ctrl_res)}  Draw: ${pct(theory2_control.draw, t2_ctrl_res)}  UDG: ${pct(theory2_control.underdog, t2_ctrl_res)}`);

    // ── Interpretation ────────────────────────────────────────────────────────
    const t1Res = theory1.total - theory1.pending;
    const t2Res = theory2.total - theory2.pending;

    console.log('\n' + '─'.repeat(W));
    console.log('  INTERPRETATION');
    console.log('─'.repeat(W));
    const t1UdgPct = t1Res > 0 ? (theory1.underdog / t1Res) * 100 : 0;
    const t2UdgPct = t2Res > 0 ? (theory2.underdog / t2Res) * 100 : 0;

    console.log(`  Theory 1 — when 3 predictors hedge & Algo says 12:`);
    console.log(`    Underdog rate = ${t1UdgPct.toFixed(1)}%  |  Fav+Draw = ${(100-t1UdgPct).toFixed(1)}%`);
    if (t1UdgPct >= 35) {
        console.log(`    ⚠️  HIGH RISK: underdog rate >= 35%. Consider routing to UPSETS only when algo=12.`);
    } else if (t1UdgPct >= 25) {
        console.log(`    ⚠️  MODERATE RISK: underdog rate >= 25%. Hedge to 12 is safer than 1X/X2.`);
    } else {
        console.log(`    ✅  LOW RISK: underdog rate < 25%. Safe to keep hedge as 1X/X2.`);
    }

    console.log(`\n  Theory 2 — when 2 predictors hedge & Algo says 12:`);
    console.log(`    Underdog rate = ${t2UdgPct.toFixed(1)}%  |  Fav+Draw = ${(100-t2UdgPct).toFixed(1)}%`);
    if (t2UdgPct >= 35) {
        console.log(`    ⚠️  HIGH RISK: underdog rate >= 35%. Algo=12 overrides hedge — re-check routing.`);
    } else if (t2UdgPct >= 25) {
        console.log(`    ⚠️  MODERATE RISK. Recommend keeping Algo=12 as the final hedge instead of 1X/X2.`);
    } else {
        console.log(`    ✅  LOW RISK: underdog rate < 25%. Current hedge logic is sound.`);
    }

    console.log('\n' + '█'.repeat(W));
}

run();
