/**
 * Sandbox Test: New Slip Selection Engine vs 45 Matches (2026-08-08)
 * 
 * Uses the real precalculated field names from the Match data:
 *   - paaWin, paaDraw, paaUpset  (pre-computed % from PHA)
 *   - _moFav, _moUpset           (pre-computed market favourite)
 *   - algoReport.probabilities   (ML probabilities)
 *   - paaPrimaryPrediction       (PAA primary call)
 *   - patternAnalysis.primaryPrediction (Sub-pattern primary call)
 *   - finalPrediction            (engine final prediction)
 *
 * Categories tested (mirroring the actual slip categories):
 *   A) bankers_dlive  : favOdds 1.50 – 1.99  (straight / unhedged)
 *   B) top_10_value   : favOdds 2.00 – 3.00  (hedged recommended)
 *
 * Goal: Select the best 12 from those two pools combined,
 *       filtered by the NEW engine rules (UCS gate, upset gate, PAA floors).
 * 
 * Run: npx tsx scripts/sandbox_slip_test_node.ts
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

function loadJson(relPath: string): any {
    const full = path.join(ROOT, relPath);
    if (!fs.existsSync(full)) return null;
    try { return JSON.parse(fs.readFileSync(full, 'utf8')); } catch { return null; }
}

// ─── MATCH TYPE ───────────────────────────────────────────────────────────────
interface Match {
    id: any;
    date?: string;
    result?: string;
    mo?: string;
    _moFav?: string;
    _moUpset?: string;
    paaWin?: number;        // % favourite wins in historical pattern
    paaDraw?: number;       // % draw in historical pattern
    paaUpset?: number;      // % upset in historical pattern
    algoReport?: { prediction?: string; probabilities?: Record<string, number> };
    patternAnalysis?: { subPattern?: string; primaryPrediction?: string; subPatternPrediction?: string };
    paaPrimaryPrediction?: string;
    paaPrediction?: string;
    finalPrediction?: string;
    rawPrediction?: string;
    seerPrediction?: string;
    group?: number;
    [key: string]: any;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function outcome(result: string | undefined): '1' | '2' | 'X' | 'pending' {
    if (!result || result === 'pending') return 'pending';
    const p = result.split(':').map(Number);
    if (p.length !== 2 || isNaN(p[0]) || isNaN(p[1])) return 'pending';
    if (p[0] > p[1]) return '1';
    if (p[0] < p[1]) return '2';
    return 'X';
}

function parseOdds(mo: string | undefined) {
    const nums = (mo || '').split(/[,\s]+/).map(parseFloat).filter(n => !isNaN(n) && n > 0);
    return { o1: nums[0] ?? 2, oX: nums[1] ?? 3, o2: nums[2] ?? 2 };
}

function favOdds(m: Match): number {
    const { o1, o2 } = parseOdds(m.mo);
    const mf = m._moFav || (o1 <= o2 ? '1' : '2');
    return mf === '1' ? o1 : o2;
}

function moFav(m: Match): string {
    const { o1, o2 } = parseOdds(m.mo);
    return m._moFav || (o1 <= o2 ? '1' : '2');
}

function moUnderdog(m: Match): string {
    return moFav(m) === '1' ? '2' : '1';
}

function mlFavProb(m: Match): number {
    const probs = m.algoReport?.probabilities || {};
    return (probs[moFav(m)] ?? 0.33) * 100;
}

function isFavOrDraw(actual: string, mf: string): boolean {
    return actual === mf || actual === 'X';
}

// ─── UCS CHECK ────────────────────────────────────────────────────────────────
interface UCSResult { ucs: boolean; votes: number; mlProb: number; label: string }

function checkUCS(m: Match): UCSResult {
    const ud = moUnderdog(m);
    const algoPrim = (m.algoReport?.prediction || '').charAt(0);
    const subPatPrim = m.patternAnalysis?.primaryPrediction || '';
    const paaPrim = m.paaPrimaryPrediction || '';
    const mlProb = mlFavProb(m);

    let votes = 0;
    const who: string[] = [];
    if (algoPrim === ud) { votes++; who.push('Algo'); }
    if (subPatPrim === ud) { votes++; who.push('SubPat'); }
    if (paaPrim === ud) { votes++; who.push('PAA'); }

    const ucs = votes >= 2 || (mlProb < 40 && votes >= 1);
    return {
        ucs,
        votes,
        mlProb,
        label: ucs ? `UCS[${who.join('+')}] ML=${mlProb.toFixed(0)}%` : `OK ML=${mlProb.toFixed(0)}%`
    };
}

// ─── SCORING ──────────────────────────────────────────────────────────────────
interface CandidateScore {
    m: Match;
    cat: string;
    favWin: number;
    draw: number;
    upset: number;
    combined: number;
    mlProb: number;
    priority: string;
    score: number;
    ucsLabel: string;
    blockReason?: string;
}

function scoreBankersMatch(m: Match): CandidateScore | null {
    const fo = favOdds(m);
    const favWin = m.paaWin ?? 0;
    const draw = m.paaDraw ?? 0;
    const upset = m.paaUpset ?? 0;
    const combined = favWin + draw;
    const ml = mlFavProb(m);
    const ucs = checkUCS(m);

    const base: CandidateScore = {
        m, cat: 'bankers_dlive',
        favWin, draw, upset, combined, mlProb: ml,
        priority: '', score: 0, ucsLabel: ucs.label
    };

    // 1. Odds gate (bankers_dlive range)
    if (fo < 1.50 || fo > 1.99) {
        return { ...base, blockReason: `favOdds=${fo.toFixed(2)} outside 1.50-1.99` };
    }

    // 2. UCS gate
    if (ucs.ucs) {
        return { ...base, blockReason: ucs.label };
    }

    // 3. Upset gate (>= 30% hard block)
    if (upset >= 30) {
        return { ...base, blockReason: `upsetRate=${upset.toFixed(0)}% >= 30%` };
    }

    // 3b. Combined safety floor: if upset > 20% the combined must be >= 80%
    if (upset > 20 && combined < 80) {
        return { ...base, blockReason: `upsetRate=${upset.toFixed(0)}% > 20% & combined=${combined.toFixed(0)}% < 80% safety floor` };
    }

    // 4. PAA floor
    if (favWin < 40 && combined < 65) {
        return { ...base, blockReason: `favWin=${favWin.toFixed(0)}% & combined=${combined.toFixed(0)}% too low` };
    }

    // Priority tier
    let priority = '';
    if (favWin >= 60 && ml >= 60) priority = 'PR1';
    else if (favWin >= 50 && ml >= 50) priority = 'PR2';
    else if (favWin >= 50 && ml >= 45) priority = 'PR3';
    else if (favWin >= 50) priority = 'PR4';
    else if (favWin >= 40) priority = 'PR5';
    else priority = 'PR5'; // combined safety fallback

    // Score = weighted combo
    const score = (favWin * 0.5) + (ml * 0.3) + (combined * 0.2) - (upset * 0.5);
    return { ...base, priority, score };
}

function scoreTop10Match(m: Match): CandidateScore | null {
    const fo = favOdds(m);
    const favWin = m.paaWin ?? 0;
    const draw = m.paaDraw ?? 0;
    const upset = m.paaUpset ?? 0;
    const combined = favWin + draw;
    const ml = mlFavProb(m);
    const ucs = checkUCS(m);

    const base: CandidateScore = {
        m, cat: 'top_10_value',
        favWin, draw, upset, combined, mlProb: ml,
        priority: '', score: 0, ucsLabel: ucs.label
    };

    // 1. Odds gate (top_10_value range)
    if (fo < 2.00 || fo > 3.00) {
        return { ...base, blockReason: `favOdds=${fo.toFixed(2)} outside 2.00-3.00` };
    }

    // 2. UCS gate
    if (ucs.ucs) {
        return { ...base, blockReason: ucs.label };
    }

    // 3. Upset gate
    if (upset >= 30) {
        return { ...base, blockReason: `upsetRate=${upset.toFixed(0)}% >= 30%` };
    }

    // 3b. Combined safety floor: if upset > 20% the combined must be >= 80%
    if (upset > 20 && combined < 80) {
        return { ...base, blockReason: `upsetRate=${upset.toFixed(0)}% > 20% & combined=${combined.toFixed(0)}% < 80% safety floor` };
    }

    // 4. PAA floor
    if (favWin < 40 && combined < 65) {
        return { ...base, blockReason: `favWin=${favWin.toFixed(0)}% & combined=${combined.toFixed(0)}% too low` };
    }

    // Priority tier
    let priority = '';
    if (favWin >= 60 && ml >= 60) priority = 'PR1';
    else if (favWin >= 50 && ml >= 50) priority = 'PR2';
    else if (favWin >= 50 && ml >= 45) priority = 'PR3';
    else if (favWin >= 50) priority = 'PR4';
    else priority = 'PR5';

    const score = (favWin * 0.45) + (ml * 0.35) + (draw * 0.2) - (upset * 0.6);
    return { ...base, priority, score };
}

// ─── DISPLAY ──────────────────────────────────────────────────────────────────
function printSection(title: string, picks: CandidateScore[]) {
    const W = 90;
    console.log('\n' + '─'.repeat(W));
    console.log(`  ${title}`);
    console.log('─'.repeat(W));

    if (picks.length === 0) {
        console.log('  (none)');
        return;
    }

    let correct = 0, wrong = 0, pend = 0;
    console.log('  #  Pri  Cat         Result   MFav  Outcome   FavWin  Draw  Upset  ML%  Combined');
    console.log('  ' + '-'.repeat(W - 2));

    picks.forEach((c, i) => {
        const act = outcome(c.m.result);
        const mf = moFav(c.m);
        const isOk = act === 'pending' ? null : isFavOrDraw(act, mf);
        if (act === 'pending') pend++;
        else if (isOk) correct++;
        else wrong++;

        const mark = act === 'pending' ? '⏳' : isOk ? '✅' : '❌';
        const outLabel = act === 'pending' ? 'Pending' : act === mf ? 'FAV-WIN' : act === 'X' ? 'DRAW   ' : 'UNDERDOG';
        const fo = favOdds(c.m).toFixed(2);
        console.log(
            `  ${(i+1).toString().padStart(2)} [${c.priority}] ${c.cat.padEnd(12).slice(0,12)} ` +
            `${(c.m.result||'??').padEnd(7)}  [${mf}]  ${mark} ${outLabel}  ` +
            `${c.favWin.toFixed(0).padStart(4)}%  ${c.draw.toFixed(0).padStart(4)}%  ${c.upset.toFixed(0).padStart(4)}%  ${c.mlProb.toFixed(0).padStart(3)}%  ${c.combined.toFixed(0).padStart(3)}%  @${fo}`
        );
    });

    const eff = picks.length - pend;
    const acc = eff > 0 ? ((correct / eff) * 100).toFixed(1) : '0';
    console.log(`\n  ✅ ${correct}  ❌ ${wrong}  ⏳ ${pend}   →  Accuracy: ${correct}/${eff} = ${acc}%`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
function run() {
    const W = 90;
    console.log('='.repeat(W));
    console.log('  SEER SLIP ENGINE — SANDBOX TEST        (2026-08-08 / Pool of 45 Matches)');
    console.log('='.repeat(W));

    const allData: any[] = loadJson('supabase_backup/precalculated_matches.json') || [];
    const matches: Match[] = allData
        .map((item: any) => item.data || item)
        .filter((m: any) => m.date && m.date.startsWith('2026-08-08'));

    console.log(`\n  Matches loaded: ${matches.length}`);

    // ── Ground Truth ──────────────────────────────────────────────────────────
    let tFav = 0, tDraw = 0, tUD = 0, tPend = 0;
    matches.forEach(m => {
        const act = outcome(m.result);
        const mf = moFav(m);
        if (act === 'pending') tPend++;
        else if (act === mf) tFav++;
        else if (act === 'X') tDraw++;
        else tUD++;
    });
    const res = matches.length - tPend;
    console.log(`\n  ACTUAL RESULTS:`);
    console.log(`  ├─ Market Fav wins : ${tFav}  (${((tFav/res)*100).toFixed(0)}%)`);
    console.log(`  ├─ Draws           : ${tDraw}  (${((tDraw/res)*100).toFixed(0)}%)`);
    console.log(`  ├─ Underdog wins   : ${tUD}  (${((tUD/res)*100).toFixed(0)}%)`);
    console.log(`  └─ Fav+Draw pool   : ${tFav+tDraw} / ${res} (${(((tFav+tDraw)/res)*100).toFixed(0)}%)`);

    // ── Score All Matches ─────────────────────────────────────────────────────
    const bankersScored = matches.map(scoreBankersMatch).filter(Boolean) as CandidateScore[];
    const top10Scored   = matches.map(scoreTop10Match).filter(Boolean) as CandidateScore[];

    const bankersQual = bankersScored.filter(c => !c.blockReason).sort((a,b) => b.score - a.score);
    const top10Qual   = top10Scored.filter(c => !c.blockReason).sort((a,b) => b.score - a.score);
    const bankersBlock = bankersScored.filter(c => !!c.blockReason);
    const top10Block   = top10Scored.filter(c => !!c.blockReason);

    // ── Select Top 12 (prefer high-confidence bankers, fill with top10) ───────
    // Merge and pick top 12 by score
    const allQual = [...bankersQual, ...top10Qual].sort((a,b) => b.score - a.score);
    // Deduplicate by match ID (a match could appear in both pools; prefer higher odds category)
    const seen = new Set<string>();
    const deduped = allQual.filter(c => {
        const key = String(c.m.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    const top12 = deduped.slice(0, 12);
    const extra = deduped.slice(12);

    printSection('SELECTED TOP 12', top12);
    printSection('RESERVE (next in queue)', extra.slice(0, 8));

    // ── Blocked Summary ───────────────────────────────────────────────────────
    console.log('\n' + '─'.repeat(W));
    console.log('  BLOCKED MATCHES (reason breakdown):');
    console.log('─'.repeat(W));

    const ucsBlockedB = bankersBlock.filter(c => c.blockReason?.startsWith('UCS'));
    const ucsBlockedT = top10Block.filter(c => c.blockReason?.startsWith('UCS'));
    const allUCSBlocked = [...new Map([...ucsBlockedB,...ucsBlockedT].map(c=>[String(c.m.id),c])).values()];

    console.log(`  UCS blocked (underdog consensus): ${allUCSBlocked.length}`);
    allUCSBlocked.forEach(c => {
        const act = outcome(c.m.result);
        const mf = moFav(c.m);
        const label = act === mf ? '✅FAV' : act === 'X' ? '✅DRW' : '❌UND';
        console.log(`    ${label} [${(c.m.result||'??').padEnd(5)}] ${c.blockReason}`);
    });

    const upsetBlocked = [...bankersBlock,...top10Block].filter(c => c.blockReason?.includes('upsetRate'));
    console.log(`\n  Upset-rate blocked (>=30%): ${upsetBlocked.length}`);

    const oddsBlocked = [...bankersBlock,...top10Block].filter(c => c.blockReason?.includes('outside'));
    // Deduplicate by ID
    const uniqueOddsBlocked = [...new Map(oddsBlocked.map(c=>[String(c.m.id),c])).values()];
    console.log(`  Odds-range blocked (not in any category): ${uniqueOddsBlocked.length}`);
    // Show the ones that went Fav/Draw anyway (missed opportunities)
    const missedFavDraw = uniqueOddsBlocked.filter(c => {
        const act = outcome(c.m.result);
        return isFavOrDraw(act, moFav(c.m));
    });
    console.log(`  → Of those, Fav/Draw outcomes (missed by odds filter): ${missedFavDraw.length}`);
    missedFavDraw.forEach(c => {
        const act = outcome(c.m.result);
        const mf = moFav(c.m);
        const label = act === mf ? 'FAV' : 'DRW';
        const fo = favOdds(c.m).toFixed(2);
        console.log(`    @${fo} [${c.m.result}] ${label}`);
    });

    // ── Final Summary ─────────────────────────────────────────────────────────
    const correct12 = top12.filter(c => { const act = outcome(c.m.result); return isFavOrDraw(act, moFav(c.m)); }).length;
    const wrong12   = top12.filter(c => { const act = outcome(c.m.result); return act !== 'pending' && !isFavOrDraw(act, moFav(c.m)); }).length;
    const pend12    = top12.filter(c => outcome(c.m.result) === 'pending').length;
    const eff12 = top12.length - pend12;
    const acc12 = eff12 > 0 ? ((correct12/eff12)*100).toFixed(1) : '0';

    console.log('\n' + '='.repeat(W));
    console.log('  FINAL SUMMARY');
    console.log('='.repeat(W));
    console.log(`  Pool: ${matches.length} matches | Fav+Draw: ${tFav+tDraw}/${res} (${(((tFav+tDraw)/res)*100).toFixed(0)}%)`);
    console.log(`  Qualified (both categories): ${deduped.length}`);
    console.log(`  Top 12 Selected:            ${top12.length}`);
    console.log(`  Accuracy (Fav/Draw):        ${correct12}/${eff12} = ${acc12}%`);
    console.log(`  UCS correctly blocked:      ${allUCSBlocked.length} matches`);
    console.log(`  Goal (≥12 Fav/Draw):        ${correct12 >= 12 ? '✅ MET' : `❌ NOT MET – got ${correct12}`}`);
    console.log('='.repeat(W));
}

run();
