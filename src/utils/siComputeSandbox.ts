import { Match } from '../types';
import { getActualResult, matchesPrediction } from './matchProcessing';
import { extractMLFeatures, generateSITags } from './mlFeatureExtractor';
import { predictWithHybridML } from './hybridMachineLearning';

/**
 * ============================================================================
 * SEER INTELLIGENCE — STANDALONE ML COMPUTE SANDBOX ENGINE
 * ============================================================================
 * STRICT ISOLATION GUARANTEE:
 * - Zero imports from and zero edits to `opwalgo.tsx`, daily OPW components,
 *   `optimizedweights.ts`, `opwCatalog.ts`, or `opwCommon.ts`.
 * - Contains its own standalone Sandbox Trigger Catalog (`SANDBOX_TRIGGERS`)
 *   and high-speed Typed-Array Continuous Permutation Optimizer to test per
 *   Sub-Pattern when ML should support Mfav, Draw, or Underdog across all
 *   30,000+ historical matches.
 */

export type SandboxTriggerRole = 'PRO_MFAV' | 'PRO_DRAW' | 'PRO_UNDERDOG';

export interface SandboxTriggerDef {
  id: number;
  code: string;
  label: string;
  role: SandboxTriggerRole;
  defaultPoints: number; // Positive magnitude (e.g. +15); role determines direction
}

/**
 * Standalone catalog of 48 high-signal match evaluation triggers partitioned into:
 * - PRO_MFAV (0..17): Bonuses that support backing the Market Favorite
 * - PRO_DRAW (18..31): Stalemate / equilibrium triggers that support Draw
 * - PRO_UNDERDOG (32..47): Trap / upset triggers that support Underdog & penalize Mfav
 */
export const SANDBOX_TRIGGERS: SandboxTriggerDef[] = [
  // ── PRO-MFAV TRIGGERS (0..17) ──────────────────────────────────────────────
  { id: 0, code: 'MF_ODDS_BANKER', label: 'Mfav Odds <= 1.45 (Heavy Favorite)', role: 'PRO_MFAV', defaultPoints: 25 },
  { id: 1, code: 'MF_ODDS_SOLID', label: 'Mfav Odds 1.46 to 1.75 (Solid Favorite)', role: 'PRO_MFAV', defaultPoints: 15 },
  { id: 2, code: 'MF_PAA_GE_55', label: 'PAA Win probability >= 55%', role: 'PRO_MFAV', defaultPoints: 25 },
  { id: 3, code: 'MF_PAA_GE_45', label: 'PAA Win probability >= 45%', role: 'PRO_MFAV', defaultPoints: 15 },
  { id: 4, code: 'MF_ALGO_GE_55', label: 'Algo support for Mfav >= 55%', role: 'PRO_MFAV', defaultPoints: 25 },
  { id: 5, code: 'MF_ALGO_GE_45', label: 'Algo support for Mfav >= 45%', role: 'PRO_MFAV', defaultPoints: 15 },
  { id: 6, code: 'MF_SEER_GE_50', label: 'Seer score on Mfav >= 50%', role: 'PRO_MFAV', defaultPoints: 20 },
  { id: 7, code: 'MF_SEER_DRAW_LE_20', label: 'Seer score on draw <= 20%', role: 'PRO_MFAV', defaultPoints: 15 },
  { id: 8, code: 'MF_PHA_GE_50', label: 'PHA support for Mfav >= 50%', role: 'PRO_MFAV', defaultPoints: 20 },
  { id: 9, code: 'MF_TS_DIFF_GE_10', label: 'Mfav TS > Und TS by >= 1.0', role: 'PRO_MFAV', defaultPoints: 20 },
  { id: 10, code: 'MF_TS_DIFF_GE_05', label: 'Mfav TS > Und TS by >= 0.5', role: 'PRO_MFAV', defaultPoints: 15 },
  { id: 11, code: 'MF_PTS_DIFF_GE_10', label: 'Mfav has >= 10 more points on Point System', role: 'PRO_MFAV', defaultPoints: 20 },
  { id: 12, code: 'MF_PTS_DIFF_GE_5', label: 'Mfav has >= 5 more points on Point System', role: 'PRO_MFAV', defaultPoints: 15 },
  { id: 13, code: 'MF_L10_DIFF_GE_3', label: 'Mfav L10 > Und L10 with >= 3 points', role: 'PRO_MFAV', defaultPoints: 20 },
  { id: 14, code: 'MF_GS_DOMINANT', label: 'Mfav GS >= 1.6 and Und GA >= 1.4', role: 'PRO_MFAV', defaultPoints: 20 },
  { id: 15, code: 'MF_DEF_SOLID', label: 'Mfav GA <= 0.9 and Und GS <= 1.0', role: 'PRO_MFAV', defaultPoints: 15 },
  { id: 16, code: 'MF_ALL_AGREE_PRIM', label: 'All predictors agree on Mfav Primary (1/2)', role: 'PRO_MFAV', defaultPoints: 25 },
  { id: 17, code: 'MF_ALL_AGREE_DC', label: 'All predictors agree on Mfav DC (1X/X2)', role: 'PRO_MFAV', defaultPoints: 15 },

  // ── PRO-DRAW TRIGGERS (18..31) ─────────────────────────────────────────────
  { id: 18, code: 'DR_ODDS_LT_300', label: 'Draw Market Odds < 3.00', role: 'PRO_DRAW', defaultPoints: 25 },
  { id: 19, code: 'DR_ODDS_LE_325', label: 'Draw Market Odds <= 3.25', role: 'PRO_DRAW', defaultPoints: 15 },
  { id: 21, code: 'DR_SEER_DOMINANT', label: 'Seer Draw % > Seer Mfav % and > Seer Und %', role: 'PRO_DRAW', defaultPoints: 30 },
  { id: 22, code: 'DR_PHA_GE_30', label: 'PHA Draw >= 30%', role: 'PRO_DRAW', defaultPoints: 20 },
  { id: 23, code: 'DR_ALGO_GE_32', label: 'Algo Draw >= 32%', role: 'PRO_DRAW', defaultPoints: 20 },
  { id: 24, code: 'DR_PAA_GE_32', label: 'PAA Draw >= 32%', role: 'PRO_DRAW', defaultPoints: 20 },
  { id: 25, code: 'DR_TS_TIGHT', label: 'TS difference <= 0.15 (Even Team Strength)', role: 'PRO_DRAW', defaultPoints: 15 },
  { id: 26, code: 'DR_GS_TIGHT', label: 'Mfav GS = Und GS (+-0.15)', role: 'PRO_DRAW', defaultPoints: 15 },
  { id: 27, code: 'DR_LOW_SCORING', label: 'Both teams GS <= 1.15 and GA <= 1.15', role: 'PRO_DRAW', defaultPoints: 20 },
  { id: 28, code: 'DR_PTS_EQUAL', label: 'Point System difference <= 3 pts', role: 'PRO_DRAW', defaultPoints: 15 },
  { id: 29, code: 'DR_L10_EQUAL', label: 'Mfav L10 and Und L10 difference <= 1', role: 'PRO_DRAW', defaultPoints: 15 },
  { id: 30, code: 'DR_ALL_BELOW_40', label: 'High Volatility (All predictor max probs < 40%)', role: 'PRO_DRAW', defaultPoints: 20 },
  { id: 31, code: 'DR_PRED_PRIM_X', label: 'At least 2 predictors call Primary X', role: 'PRO_DRAW', defaultPoints: 25 },

  // ── PRO-UNDERDOG TRIGGERS (32..47) ─────────────────────────────────────────
  { id: 32, code: 'UD_ODDS_COMPETITIVE', label: 'Mfav Odds >= 2.05 (Competitive / Value Odds)', role: 'PRO_UNDERDOG', defaultPoints: 15 },
  { id: 33, code: 'UD_ODDS_LT_DRAW', label: 'Underdog Market Odds < Draw Market Odds', role: 'PRO_UNDERDOG', defaultPoints: 20 },
  { id: 34, code: 'UD_HIDDEN_STRENGTH', label: 'Underdog has Hidden Strength (Und GS >= Und GA)', role: 'PRO_UNDERDOG', defaultPoints: 15 },
  { id: 35, code: 'UD_MFAV_WEAKNESS', label: 'Mfav has Hidden Weakness (Mfav GS <= Mfav GA)', role: 'PRO_UNDERDOG', defaultPoints: 20 },
  { id: 36, code: 'UD_PTS_LEAD_5', label: 'Underdog has >= 5 more points on Point System', role: 'PRO_UNDERDOG', defaultPoints: 25 },
  { id: 37, code: 'UD_PTS_LEAD_1', label: 'Underdog leads Mfav on Point System', role: 'PRO_UNDERDOG', defaultPoints: 15 },
  { id: 38, code: 'UD_TS_LEAD', label: 'Underdog TS > Mfav TS', role: 'PRO_UNDERDOG', defaultPoints: 25 },
  { id: 39, code: 'UD_L10_LEAD', label: 'Underdog L10 > Mfav L10', role: 'PRO_UNDERDOG', defaultPoints: 20 },
  { id: 40, code: 'UD_GS_LEAD', label: 'Underdog GS > Mfav GS by >= 0.2', role: 'PRO_UNDERDOG', defaultPoints: 20 },
  { id: 41, code: 'UD_GA_BETTER', label: 'Underdog GA < Mfav GA by >= 0.2 (Better Defense)', role: 'PRO_UNDERDOG', defaultPoints: 15 },
  { id: 42, code: 'UD_ALGO_PROB_LEAD', label: 'Algo Underdog % > Algo Mfav %', role: 'PRO_UNDERDOG', defaultPoints: 30 },
  { id: 43, code: 'UD_SEER_PROB_GE_35', label: 'Seer Underdog % >= 35%', role: 'PRO_UNDERDOG', defaultPoints: 25 },
  { id: 44, code: 'UD_PAA_UPSET_GE_35', label: 'PAA Upset probability >= 35%', role: 'PRO_UNDERDOG', defaultPoints: 25 },
  { id: 45, code: 'UD_PHA_UND_GE_35', label: 'PHA Underdog >= 35%', role: 'PRO_UNDERDOG', defaultPoints: 25 },
  { id: 46, code: 'UD_SUB_SUPPORTS_UND', label: 'Sub-Pattern rule leans Underdog (X2/1X)', role: 'PRO_UNDERDOG', defaultPoints: 25 },
  { id: 47, code: 'UD_PRED_PRIM_UND', label: 'At least 2 predictors call Underdog Primary', role: 'PRO_UNDERDOG', defaultPoints: 30 },
];

export const NUM_SANDBOX_TRIGGERS = SANDBOX_TRIGGERS.length;

/**
 * Per-Sub-Pattern calibrated parameters learned by the Sandbox Compute Engine.
 */
export interface SubPatternSandboxModel {
  subPattern: string;
  /** Length = NUM_SANDBOX_TRIGGERS (48). Positive integers [0..60] representing trigger weight magnitude */
  triggerWeights: number[];
  /** Predictor blend weights [0..30] */
  wAlgo: number;
  wPaa: number;
  wSeer: number;
  wPha: number;
  wMatrix: number;
  /** How strongly Pro-Underdog triggers penalize Mfav_Score (in tenths, e.g. 10 = 1.0x) */
  undPenaltyOnFavTenths: number;
  /** How strongly Pro-Draw triggers penalize Mfav_Score (in tenths, e.g. 5 = 0.5x) */
  drawPenaltyOnFavTenths: number;
  /** Decision thresholds for Primary (1 / X / 2) */
  undPrimMargin: number;     // Und_Score - Mfav_Score >= undPrimMargin -> Primary Underdog
  drawPrimMargin: number;    // Draw_Score - Mfav_Score >= drawPrimMargin -> Primary Draw
  minUndPrimScore: number;   // Minimum Und_Score required to call Primary Underdog
  minDrawPrimScore: number;  // Minimum Draw_Score required to call Primary Draw
  /** Decision thresholds for Final DC (1X / X2 / 12) */
  undDcPivotMargin: number;  // (Und_Score - Mfav_Score) >= undDcPivotMargin -> Pivot to Upset DC (X2 or 1X)
  splitDrawCeiling: number;  // Max Draw_Score allowed to call '12' split
  splitMinUndScore: number;  // Min Und_Score required (when Mfav is also strong) to call '12' split
  /** Whether compute found an improvement over Baseline ML */
  useComputed: boolean;
  iterationsRun: number;
}

export interface CompactSandboxMatch {
  match: Match;
  matchId: string;
  subPattern: string;
  mainPattern: string;
  siSubPatterns: string[];
  isFavHome: boolean;
  favWinChar: '1' | '2';
  undWinChar: '1' | '2';
  favDcStr: '1X' | 'X2';
  undDcStr: '1X' | 'X2';
  actual: '1' | 'X' | '2';
  actualOutcomeType: 0 | 1 | 2; // 0 = Fav, 1 = Draw, 2 = Und
  /** Baseline ML predictions (from predictWithHybridML / match.mlInfo) */
  basePrimPred: string;
  baseFinalPred: string;
  basePrimCorrect: boolean;
  baseFinalCorrect: boolean;
  basePrimOutcomeType: 0 | 1 | 2; // 0 = Fav, 1 = Draw, 2 = Und
  baseFinalOutcomeType: 0 | 1 | 2; // 0 = Fav DC (1X/X2), 1 = Split (12) / Draw, 2 = Und DC (X2/1X)
  /** Normalized predictor probabilities [0..100] */
  algoFav: number;
  algoDraw: number;
  algoUnd: number;
  paaFav: number;
  paaDraw: number;
  paaUnd: number;
  seerFav: number;
  seerDraw: number;
  seerUnd: number;
  phaFav: number;
  phaDraw: number;
  phaUnd: number;
  matrixFav: number;
  matrixDraw: number;
  matrixUnd: number;
  /** Active trigger indices (into SANDBOX_TRIGGERS 0..47) */
  triggersHit: Uint8Array;
}

export interface OutcomeCallStats {
  calls: number;
  hits: number;
  accuracy: number;
}

export interface SubPatternEvaluationSummary {
  subPattern: string;
  totalMatches: number;
  favCount: number;
  drawCount: number;
  undCount: number;
  favPct: number;
  drawPct: number;
  undPct: number;
  /** Baseline ML metrics */
  basePrimCorrect: number;
  basePrimPct: number;
  baseFinalCorrect: number;
  baseFinalPct: number;
  baseCalls: {
    fav: OutcomeCallStats;
    draw: OutcomeCallStats;
    und: OutcomeCallStats;
    favDc: OutcomeCallStats;
    undDc: OutcomeCallStats;
    split12: OutcomeCallStats;
  };
  /** Sandbox Computed ML metrics */
  sandboxPrimCorrect: number;
  sandboxPrimPct: number;
  sandboxFinalCorrect: number;
  sandboxFinalPct: number;
  sandboxCalls: {
    fav: OutcomeCallStats;
    draw: OutcomeCallStats;
    und: OutcomeCallStats;
    favDc: OutcomeCallStats;
    undDc: OutcomeCallStats;
    split12: OutcomeCallStats;
  };
  primLiftMatches: number;
  primLiftPct: number;
  finalLiftMatches: number;
  finalLiftPct: number;
  improved: boolean;
  model: SubPatternSandboxModel;
}

export interface MatchSandboxPredictionDetail {
  primPred: '1' | 'X' | '2';
  finalPred: '1X' | 'X2' | '12';
  primLean: 'Fav' | 'Draw' | 'Und';
  finalLean: 'FavDC' | 'UndDC' | 'Split12';
  mfavScore: number;
  drawScore: number;
  undScore: number;
  proMfavPts: number;
  proDrawPts: number;
  proUndPts: number;
  primCorrect: boolean;
  finalCorrect: boolean;
  activeTriggers: Array<{ def: SandboxTriggerDef; weight: number }>;
}

const SANDBOX_STORAGE_KEY = 'seer_si_sandbox_models_v1';

export function loadSavedSandboxModels(): Record<string, SubPatternSandboxModel> {
  try {
    const raw = localStorage.getItem(SANDBOX_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveSandboxModelsToStorage(models: Record<string, SubPatternSandboxModel>): void {
  try {
    localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(models));
  } catch (e) {
    console.warn('Failed to save sandbox models to localStorage:', e);
  }
}

export function clearSavedSandboxModels(): void {
  try {
    localStorage.removeItem(SANDBOX_STORAGE_KEY);
  } catch {}
}

export function createDefaultSandboxModel(subPattern: string): SubPatternSandboxModel {
  return {
    subPattern,
    triggerWeights: SANDBOX_TRIGGERS.map(t => t.defaultPoints),
    wAlgo: 10,
    wPaa: 8,
    wSeer: 10,
    wPha: 8,
    wMatrix: 12,
    undPenaltyOnFavTenths: 8,
    drawPenaltyOnFavTenths: 4,
    undPrimMargin: 15,
    drawPrimMargin: 18,
    minUndPrimScore: 65,
    minDrawPrimScore: 60,
    undDcPivotMargin: 12,
    splitDrawCeiling: 42,
    splitMinUndScore: 62,
    useComputed: false,
    iterationsRun: 0,
  };
}

function parseL10WinsOrPts(l10Str?: string): number | null {
  if (!l10Str || typeof l10Str !== 'string') return null;
  const clean = l10Str.trim();
  if (!clean || clean === 'NA') return null;
  // Format "7-2-1" (W-D-L) or numeric
  const parts = clean.split(/[-/,\s]+/).map(n => parseFloat(n)).filter(n => !isNaN(n));
  if (parts.length >= 3) {
    return parts[0] * 3 + parts[1]; // Standard football points over L10
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return null;
}

/**
 * Extracts a CompactSandboxMatch from a Match object.
 * Evaluates all 48 standalone sandbox triggers and baseline ML predictions.
 */
export function buildCompactSandboxMatch(
  m: Match,
  mlData?: any,
  phaStatsMap?: Record<string, any>
): CompactSandboxMatch | null {
  const actual = getActualResult(m.result || '');
  if (actual !== '1' && actual !== 'X' && actual !== '2') return null;

  const features = extractMLFeatures(m);
  if (!features) return null;

  const isFavHome = features.favIndex === 0;
  const favWinChar: '1' | '2' = isFavHome ? '1' : '2';
  const undWinChar: '1' | '2' = isFavHome ? '2' : '1';
  const favDcStr: '1X' | 'X2' = isFavHome ? '1X' : 'X2';
  const undDcStr: '1X' | 'X2' = isFavHome ? 'X2' : '1X';

  const actualOutcomeType: 0 | 1 | 2 =
    actual === favWinChar ? 0 : actual === 'X' ? 1 : 2;

  // Ensure Baseline ML info exists
  const mlInfo = m.mlInfo && m.mlInfo.mlApplied ? m.mlInfo : predictWithHybridML(m, mlData);
  const baseFinalPred = (mlInfo?.mlPrediction || m.finalPrediction || m.rawPrediction || favDcStr).trim().toUpperCase();
  const basePrimPred = (mlInfo?.mlPrimaryPrediction || m.rawPrediction || favWinChar).trim().toUpperCase();

  const basePrimCorrect = basePrimPred === actual;
  const baseFinalCorrect = matchesPrediction(baseFinalPred, actual);

  const basePrimOutcomeType: 0 | 1 | 2 =
    basePrimPred === favWinChar ? 0 : basePrimPred === 'X' ? 1 : 2;

  const baseFinalOutcomeType: 0 | 1 | 2 =
    baseFinalPred === favDcStr || baseFinalPred === favWinChar
      ? 0
      : baseFinalPred === undDcStr || baseFinalPred === undWinChar
      ? 2
      : 1;

  // Predictor probabilities (normalized 0..100)
  const algoFav = features.study5_algo?.fav ?? 45;
  const algoDraw = features.study5_algo?.draw ?? 28;
  const algoUnd = features.study5_algo?.underdog ?? 27;

  let paaFav = features.study4_paa?.fav ?? 0;
  let paaDraw = features.study4_paa?.draw ?? 0;
  let paaUnd = features.study4_paa?.underdog ?? 0;
  const subCode = m.patternAnalysis?.subPattern || features.study3_subPattern || 'NO_SUB';
  if (paaFav === 0 && paaDraw === 0 && paaUnd === 0 && phaStatsMap && phaStatsMap[subCode]) {
    const st = phaStatsMap[subCode];
    const denom = st.paaTotal > 0 ? st.paaTotal : st.total;
    if (denom > 0) {
      paaFav = (st.favWin / denom) * 100;
      paaDraw = (st.draw / denom) * 100;
      paaUnd = (st.upsetWin / denom) * 100;
    }
  }
  if (paaFav === 0 && paaDraw === 0 && paaUnd === 0) {
    paaFav = algoFav;
    paaDraw = algoDraw;
    paaUnd = algoUnd;
  }

  const seerFav = features.study6_seer?.fav ?? algoFav;
  const seerDraw = features.study6_seer?.draw ?? algoDraw;
  const seerUnd = features.study6_seer?.underdog ?? algoUnd;

  const phaFav = features.study2_pha?.fav ?? paaFav;
  const phaDraw = features.study2_pha?.draw ?? paaDraw;
  const phaUnd = features.study2_pha?.underdog ?? paaUnd;

  const matrixFav = mlInfo?.mlPercentages?.fav ?? ((algoFav + paaFav) / 2);
  const matrixDraw = mlInfo?.mlPercentages?.draw ?? ((seerDraw + paaDraw) / 2);
  const matrixUnd = mlInfo?.mlPercentages?.underdog ?? ((algoUnd + seerUnd) / 2);

  // Match stats for trigger evaluation
  const homeOdds = features.odds?.home ?? 0;
  const drawOdds = features.odds?.draw ?? 0;
  const awayOdds = features.odds?.away ?? 0;
  const favOdds = isFavHome ? homeOdds : awayOdds;
  const undOdds = isFavHome ? awayOdds : homeOdds;

  const tsa = m.tsa ?? 0;
  const tsb = m.tsb ?? 0;
  const favTs = isFavHome ? tsa : tsb;
  const undTs = isFavHome ? tsb : tsa;
  const tsDiff = favTs - undTs;

  const gsHome = m.gsHome ?? 0;
  const gaHome = m.gaHome ?? 0;
  const gsAway = m.gsAway ?? 0;
  const gaAway = m.gaAway ?? 0;
  const favGs = isFavHome ? gsHome : gsAway;
  const favGa = isFavHome ? gaHome : gaAway;
  const undGs = isFavHome ? gsAway : gsHome;
  const undGa = isFavHome ? gaAway : gaHome;

  const ptsHome = parseFloat(String((m as any).pts1 ?? '')) || (m.totalPoints?.home ?? 0);
  const ptsAway = parseFloat(String((m as any).pts2 ?? '')) || (m.totalPoints?.away ?? 0);
  const favPts = isFavHome ? ptsHome : ptsAway;
  const undPts = isFavHome ? ptsAway : ptsHome;
  const ptsDiff = favPts - undPts;

  const l10HomePts = parseL10WinsOrPts(m.l10Home);
  const l10AwayPts = parseL10WinsOrPts(m.l10Away);
  const favL10 = isFavHome ? l10HomePts : l10AwayPts;
  const undL10 = isFavHome ? l10AwayPts : l10HomePts;
  const l10Diff = favL10 !== null && undL10 !== null ? favL10 - undL10 : null;

  // Primary predictor votes
  const primVotes = [
    features.study5_algoPrimary,
    features.study4_paaPrimary,
    features.study6_seerPrimary,
    features.study3_subPatPrimary,
  ].filter(Boolean) as string[];
  const drawPrimVotes = primVotes.filter(p => p === 'X').length;
  const undPrimVotes = primVotes.filter(p => p === undWinChar).length;

  const subRulePred = (features.study3_subPatternPrediction || m.finalPrediction || '').trim().toUpperCase();
  const subSupportsUnd =
    subRulePred === undWinChar || subRulePred === undDcStr;

  const hitList: number[] = [];

  // ── Evaluate PRO-MFAV triggers (0..17) ─────────────────────────────────────
  if (favOdds > 0 && favOdds <= 1.45) hitList.push(0);
  if (favOdds > 1.45 && favOdds <= 1.75) hitList.push(1);
  if (paaFav >= 55) hitList.push(2);
  else if (paaFav >= 45) hitList.push(3);
  if (algoFav >= 55) hitList.push(4);
  else if (algoFav >= 45) hitList.push(5);
  if (seerFav >= 50) hitList.push(6);
  if (seerDraw > 0 && seerDraw <= 20) hitList.push(7);
  if (phaFav >= 50) hitList.push(8);
  if (tsDiff >= 1.0) hitList.push(9);
  else if (tsDiff >= 0.5) hitList.push(10);
  if (ptsDiff >= 10) hitList.push(11);
  else if (ptsDiff >= 5) hitList.push(12);
  if (l10Diff !== null && l10Diff >= 3) hitList.push(13);
  if (favGs >= 1.6 && undGa >= 1.4) hitList.push(14);
  if (favGa > 0 && favGa <= 0.9 && undGs > 0 && undGs <= 1.0) hitList.push(15);
  if (features.study15_predictorsAgreePrim && primVotes[0] === favWinChar) hitList.push(16);
  if (features.study14_predictorsAgreeDC && !subSupportsUnd) hitList.push(17);

  // ── Evaluate PRO-DRAW triggers (18..31) ────────────────────────────────────
  if (drawOdds > 0 && drawOdds < 3.0) hitList.push(18);
  else if (drawOdds >= 3.0 && drawOdds <= 3.25) hitList.push(19);
  if (seerDraw > seerFav && seerDraw > seerUnd) hitList.push(21);
  if (phaDraw >= 30) hitList.push(22);
  if (algoDraw >= 32) hitList.push(23);
  if (paaDraw >= 32) hitList.push(24);
  if ((tsa > 0 || tsb > 0) && Math.abs(tsDiff) <= 0.15) hitList.push(25);
  if ((favGs > 0 || undGs > 0) && Math.abs(favGs - undGs) <= 0.15) hitList.push(26);
  if (favGs > 0 && undGs > 0 && favGs <= 1.15 && undGs <= 1.15 && favGa <= 1.15 && undGa <= 1.15) hitList.push(27);
  if ((favPts > 0 || undPts > 0) && Math.abs(ptsDiff) <= 3) hitList.push(28);
  if (l10Diff !== null && Math.abs(l10Diff) <= 1) hitList.push(29);
  if (features.study16_allPercentagesBelow40) hitList.push(30);
  if (drawPrimVotes >= 2) hitList.push(31);

  // ── Evaluate PRO-UNDERDOG triggers (32..47) ────────────────────────────────
  if (favOdds >= 2.05) hitList.push(32);
  if (features.study1_underdogLessThanDraw) hitList.push(33);
  if (undGs > 0 && undGs >= undGa) hitList.push(34);
  if (favGs > 0 && favGs <= favGa) hitList.push(35);
  if (ptsDiff <= -5) hitList.push(36);
  else if (ptsDiff < 0) hitList.push(37);
  if (tsDiff < -0.1) hitList.push(38);
  if (l10Diff !== null && l10Diff <= -2) hitList.push(39);
  if (undGs - favGs >= 0.2) hitList.push(40);
  if (favGa - undGa >= 0.2) hitList.push(41);
  if (algoUnd > algoFav) hitList.push(42);
  if (seerUnd >= 35) hitList.push(43);
  if (paaUnd >= 35) hitList.push(44);
  if (phaUnd >= 35) hitList.push(45);
  if (subSupportsUnd) hitList.push(46);
  if (undPrimVotes >= 2) hitList.push(47);

  const siTags = generateSITags(features) || [];
  const siSubPatterns = siTags.filter(t => /\d$/.test(t));

  return {
    match: m,
    matchId: String(m.id || `${m.teams}_${m.date}`),
    subPattern: subCode,
    mainPattern: m.patternAnalysis?.mainPattern || 'NA',
    siSubPatterns,
    isFavHome,
    favWinChar,
    undWinChar,
    favDcStr,
    undDcStr,
    actual,
    actualOutcomeType,
    basePrimPred,
    baseFinalPred,
    basePrimCorrect,
    baseFinalCorrect,
    basePrimOutcomeType,
    baseFinalOutcomeType,
    algoFav,
    algoDraw,
    algoUnd,
    paaFav,
    paaDraw,
    paaUnd,
    seerFav,
    seerDraw,
    seerUnd,
    phaFav,
    phaDraw,
    phaUnd,
    matrixFav,
    matrixDraw,
    matrixUnd,
    triggersHit: new Uint8Array(hitList),
  };
}

/**
 * Evaluates a single CompactSandboxMatch using a SubPatternSandboxModel.
 * Fast path used inside the compute loop and for match inspection.
 */
export function predictMatchWithSandboxModel(
  cm: CompactSandboxMatch,
  model: SubPatternSandboxModel
): {
  primOutcome: 0 | 1 | 2; // 0 = Fav, 1 = Draw, 2 = Und
  finalOutcome: 0 | 1 | 2; // 0 = FavDC (1X/X2), 1 = Split (12), 2 = UndDC (X2/1X)
  mfavScore: number;
  drawScore: number;
  undScore: number;
  proMfavPts: number;
  proDrawPts: number;
  proUndPts: number;
} {
  if (!model.useComputed) {
    return {
      primOutcome: cm.basePrimOutcomeType,
      finalOutcome: cm.baseFinalOutcomeType,
      mfavScore: cm.matrixFav,
      drawScore: cm.matrixDraw,
      undScore: cm.matrixUnd,
      proMfavPts: 0,
      proDrawPts: 0,
      proUndPts: 0,
    };
  }

  const wSum = (model.wAlgo + model.wPaa + model.wSeer + model.wPha + model.wMatrix) || 1;
  const baseFav =
    (cm.algoFav * model.wAlgo +
      cm.paaFav * model.wPaa +
      cm.seerFav * model.wSeer +
      cm.phaFav * model.wPha +
      cm.matrixFav * model.wMatrix) /
    wSum;
  const baseDraw =
    (cm.algoDraw * model.wAlgo +
      cm.paaDraw * model.wPaa +
      cm.seerDraw * model.wSeer +
      cm.phaDraw * model.wPha +
      cm.matrixDraw * model.wMatrix) /
    wSum;
  const baseUnd =
    (cm.algoUnd * model.wAlgo +
      cm.paaUnd * model.wPaa +
      cm.seerUnd * model.wSeer +
      cm.phaUnd * model.wPha +
      cm.matrixUnd * model.wMatrix) /
    wSum;

  let proMfavPts = 0;
  let proDrawPts = 0;
  let proUndPts = 0;

  const hits = cm.triggersHit;
  const weights = model.triggerWeights;
  for (let i = 0; i < hits.length; i++) {
    const tIdx = hits[i];
    const w = weights[tIdx] || 0;
    if (tIdx <= 17) {
      proMfavPts += w;
    } else if (tIdx <= 31) {
      proDrawPts += w;
    } else {
      proUndPts += w;
    }
  }

  const mfavScore =
    baseFav +
    proMfavPts -
    (proUndPts * model.undPenaltyOnFavTenths) / 10 -
    (proDrawPts * model.drawPenaltyOnFavTenths) / 10;
  const drawScore = baseDraw + proDrawPts;
  const undScore = baseUnd + proUndPts;

  // 1. Primary (1 / X / 2) decision
  let primOutcome: 0 | 1 | 2 = 0;
  const undLeadOverFav = undScore - mfavScore;
  const drawLeadOverFav = drawScore - mfavScore;

  if (
    undScore >= model.minUndPrimScore &&
    undLeadOverFav >= model.undPrimMargin &&
    undScore >= drawScore - 5
  ) {
    primOutcome = 2; // Support Underdog
  } else if (
    drawScore >= model.minDrawPrimScore &&
    drawLeadOverFav >= model.drawPrimMargin
  ) {
    primOutcome = 1; // Support Draw
  } else {
    primOutcome = 0; // Support Mfav
  }

  // 2. Final DC (1X / X2 / 12) decision
  let finalOutcome: 0 | 1 | 2 = 0;
  if (undLeadOverFav >= model.undDcPivotMargin) {
    // Pivot to Underdog + Draw (X2 if Home Fav, 1X if Away Fav)
    finalOutcome = 2;
  } else if (
    undScore >= model.splitMinUndScore &&
    mfavScore >= 45 &&
    drawScore <= model.splitDrawCeiling
  ) {
    // High Mfav + High Underdog + Low Draw -> Split '12'
    finalOutcome = 1;
  } else {
    // Default Mfav + Draw (1X if Home Fav, X2 if Away Fav)
    finalOutcome = 0;
  }

  return {
    primOutcome,
    finalOutcome,
    mfavScore,
    drawScore,
    undScore,
    proMfavPts,
    proDrawPts,
    proUndPts,
  };
}

/**
 * Detailed match-level prediction breakdown for the Sandbox UI inspector.
 */
export function getDetailedSandboxMatchPrediction(
  cm: CompactSandboxMatch,
  model: SubPatternSandboxModel
): MatchSandboxPredictionDetail {
  const res = predictMatchWithSandboxModel(cm, model);

  const primPred: '1' | 'X' | '2' =
    res.primOutcome === 0
      ? cm.favWinChar
      : res.primOutcome === 1
      ? 'X'
      : cm.undWinChar;

  const finalPred: '1X' | 'X2' | '12' =
    res.finalOutcome === 0
      ? cm.favDcStr
      : res.finalOutcome === 2
      ? cm.undDcStr
      : '12';

  const primLean: 'Fav' | 'Draw' | 'Und' =
    res.primOutcome === 0 ? 'Fav' : res.primOutcome === 1 ? 'Draw' : 'Und';
  const finalLean: 'FavDC' | 'UndDC' | 'Split12' =
    res.finalOutcome === 0 ? 'FavDC' : res.finalOutcome === 2 ? 'UndDC' : 'Split12';

  const primCorrect = primPred === cm.actual;
  const finalCorrect = matchesPrediction(finalPred, cm.actual);

  const activeTriggers: Array<{ def: SandboxTriggerDef; weight: number }> = [];
  for (let i = 0; i < cm.triggersHit.length; i++) {
    const tIdx = cm.triggersHit[i];
    const def = SANDBOX_TRIGGERS[tIdx];
    if (def) {
      activeTriggers.push({
        def,
        weight: model.triggerWeights[tIdx] ?? def.defaultPoints,
      });
    }
  }

  return {
    primPred,
    finalPred,
    primLean,
    finalLean,
    mfavScore: Math.round(res.mfavScore * 10) / 10,
    drawScore: Math.round(res.drawScore * 10) / 10,
    undScore: Math.round(res.undScore * 10) / 10,
    proMfavPts: res.proMfavPts,
    proDrawPts: res.proDrawPts,
    proUndPts: res.proUndPts,
    primCorrect,
    finalCorrect,
    activeTriggers,
  };
}

/**
 * Evaluates an entire Sub-Pattern's matches comparing Baseline ML vs Sandbox Model.
 */
export function evaluateSubPatternMatches(
  subPattern: string,
  matches: CompactSandboxMatch[],
  model: SubPatternSandboxModel
): SubPatternEvaluationSummary {
  const total = matches.length;
  let favCount = 0;
  let drawCount = 0;
  let undCount = 0;

  let basePrimCorrect = 0;
  let baseFinalCorrect = 0;
  let sandboxPrimCorrect = 0;
  let sandboxFinalCorrect = 0;

  const initCallStats = (): OutcomeCallStats => ({ calls: 0, hits: 0, accuracy: 0 });
  const baseCalls = {
    fav: initCallStats(),
    draw: initCallStats(),
    und: initCallStats(),
    favDc: initCallStats(),
    undDc: initCallStats(),
    split12: initCallStats(),
  };
  const sandboxCalls = {
    fav: initCallStats(),
    draw: initCallStats(),
    und: initCallStats(),
    favDc: initCallStats(),
    undDc: initCallStats(),
    split12: initCallStats(),
  };

  for (let i = 0; i < total; i++) {
    const cm = matches[i];
    if (cm.actualOutcomeType === 0) favCount++;
    else if (cm.actualOutcomeType === 1) drawCount++;
    else undCount++;

    // Baseline stats
    if (cm.basePrimCorrect) basePrimCorrect++;
    if (cm.baseFinalCorrect) baseFinalCorrect++;

    if (cm.basePrimOutcomeType === 0) {
      baseCalls.fav.calls++;
      if (cm.basePrimCorrect) baseCalls.fav.hits++;
    } else if (cm.basePrimOutcomeType === 1) {
      baseCalls.draw.calls++;
      if (cm.basePrimCorrect) baseCalls.draw.hits++;
    } else {
      baseCalls.und.calls++;
      if (cm.basePrimCorrect) baseCalls.und.hits++;
    }

    if (cm.baseFinalOutcomeType === 0) {
      baseCalls.favDc.calls++;
      if (cm.baseFinalCorrect) baseCalls.favDc.hits++;
    } else if (cm.baseFinalOutcomeType === 2) {
      baseCalls.undDc.calls++;
      if (cm.baseFinalCorrect) baseCalls.undDc.hits++;
    } else {
      baseCalls.split12.calls++;
      if (cm.baseFinalCorrect) baseCalls.split12.hits++;
    }

    // Sandbox stats
    const pred = predictMatchWithSandboxModel(cm, model);
    const sPrimCorrect = pred.primOutcome === cm.actualOutcomeType;
    const sFinalCorrect =
      pred.finalOutcome === 0
        ? cm.actualOutcomeType === 0 || cm.actualOutcomeType === 1
        : pred.finalOutcome === 2
        ? cm.actualOutcomeType === 2 || cm.actualOutcomeType === 1
        : cm.actualOutcomeType === 0 || cm.actualOutcomeType === 2;

    if (sPrimCorrect) sandboxPrimCorrect++;
    if (sFinalCorrect) sandboxFinalCorrect++;

    if (pred.primOutcome === 0) {
      sandboxCalls.fav.calls++;
      if (sPrimCorrect) sandboxCalls.fav.hits++;
    } else if (pred.primOutcome === 1) {
      sandboxCalls.draw.calls++;
      if (sPrimCorrect) sandboxCalls.draw.hits++;
    } else {
      sandboxCalls.und.calls++;
      if (sPrimCorrect) sandboxCalls.und.hits++;
    }

    if (pred.finalOutcome === 0) {
      sandboxCalls.favDc.calls++;
      if (sFinalCorrect) sandboxCalls.favDc.hits++;
    } else if (pred.finalOutcome === 2) {
      sandboxCalls.undDc.calls++;
      if (sFinalCorrect) sandboxCalls.undDc.hits++;
    } else {
      sandboxCalls.split12.calls++;
      if (sFinalCorrect) sandboxCalls.split12.hits++;
    }
  }

  const finalizeCallStats = (obj: typeof baseCalls) => {
    (Object.keys(obj) as Array<keyof typeof obj>).forEach(k => {
      obj[k].accuracy = obj[k].calls > 0 ? (obj[k].hits / obj[k].calls) * 100 : 0;
    });
  };
  finalizeCallStats(baseCalls);
  finalizeCallStats(sandboxCalls);

  const basePrimPct = total > 0 ? (basePrimCorrect / total) * 100 : 0;
  const baseFinalPct = total > 0 ? (baseFinalCorrect / total) * 100 : 0;
  const sandboxPrimPct = total > 0 ? (sandboxPrimCorrect / total) * 100 : 0;
  const sandboxFinalPct = total > 0 ? (sandboxFinalCorrect / total) * 100 : 0;

  return {
    subPattern,
    totalMatches: total,
    favCount,
    drawCount,
    undCount,
    favPct: total > 0 ? (favCount / total) * 100 : 0,
    drawPct: total > 0 ? (drawCount / total) * 100 : 0,
    undPct: total > 0 ? (undCount / total) * 100 : 0,
    basePrimCorrect,
    basePrimPct,
    baseFinalCorrect,
    baseFinalPct,
    baseCalls,
    sandboxPrimCorrect,
    sandboxPrimPct,
    sandboxFinalCorrect,
    sandboxFinalPct,
    sandboxCalls,
    primLiftMatches: sandboxPrimCorrect - basePrimCorrect,
    primLiftPct: sandboxPrimPct - basePrimPct,
    finalLiftMatches: sandboxFinalCorrect - baseFinalCorrect,
    finalLiftPct: sandboxFinalPct - baseFinalPct,
    improved:
      sandboxFinalCorrect > baseFinalCorrect ||
      (sandboxFinalCorrect === baseFinalCorrect && sandboxPrimCorrect > basePrimCorrect),
    model,
  };
}

/**
 * ============================================================================
 * HIGH-SPEED TYPED-ARRAY SUB-PATTERN OPTIMIZER
 * ============================================================================
 * Optimizes a SubPatternSandboxModel across all historical matches in that
 * sub-pattern to learn when to support Mfav, Draw, or Underdog.
 *
 * Uses a 3-Stage deterministic + stochastic permutation search:
 * 1. Empirical Trigger Lift Seeding (computes exact Fav%, Draw%, Und% per trigger)
 * 2. Decision Boundary & Predictor Weight Coordinate Sweep
 * 3. High-Speed Trigger Weight & Threshold Permutation Loop (with strict ratchet)
 */
export function optimizeSubPatternModel(
  subPattern: string,
  matches: CompactSandboxMatch[],
  existingModel?: SubPatternSandboxModel,
  iterations: number = 1200,
  targetMode: 'both' | 'final' | 'primary' = 'both'
): SubPatternSandboxModel {
  const N = matches.length;
  if (N === 0) {
    return existingModel || createDefaultSandboxModel(subPattern);
  }

  // Record exact Baseline ML accuracy on this sub-pattern
  let basePrimHits = 0;
  let baseFinalHits = 0;
  let subFavCount = 0;
  let subDrawCount = 0;
  let subUndCount = 0;

  for (let i = 0; i < N; i++) {
    const m = matches[i];
    if (m.basePrimCorrect) basePrimHits++;
    if (m.baseFinalCorrect) baseFinalHits++;
    if (m.actualOutcomeType === 0) subFavCount++;
    else if (m.actualOutcomeType === 1) subDrawCount++;
    else subUndCount++;
  }

  const subFavRate = subFavCount / N;
  const subDrawRate = subDrawCount / N;
  const subUndRate = subUndCount / N;

  // Stage 1: Empirical Trigger Lift Analysis inside this sub-pattern
  const trigCounts = new Int32Array(NUM_SANDBOX_TRIGGERS);
  const trigFavHits = new Int32Array(NUM_SANDBOX_TRIGGERS);
  const trigDrawHits = new Int32Array(NUM_SANDBOX_TRIGGERS);
  const trigUndHits = new Int32Array(NUM_SANDBOX_TRIGGERS);

  for (let i = 0; i < N; i++) {
    const m = matches[i];
    const out = m.actualOutcomeType;
    const hits = m.triggersHit;
    for (let j = 0; j < hits.length; j++) {
      const t = hits[j];
      trigCounts[t]++;
      if (out === 0) trigFavHits[t]++;
      else if (out === 1) trigDrawHits[t]++;
      else trigUndHits[t]++;
    }
  }

  const empiricalWeights = new Array<number>(NUM_SANDBOX_TRIGGERS);
  for (let t = 0; t < NUM_SANDBOX_TRIGGERS; t++) {
    const def = SANDBOX_TRIGGERS[t];
    const cnt = trigCounts[t];
    if (cnt < 3) {
      empiricalWeights[t] = def.defaultPoints;
      continue;
    }
    if (def.role === 'PRO_MFAV') {
      const rate = trigFavHits[t] / cnt;
      const lift = rate - subFavRate;
      // Scale into [5..50] — Pro-Mfav triggers always remain positive bonuses
      const pts = Math.round((def.defaultPoints + lift * 90) / 5) * 5;
      empiricalWeights[t] = Math.max(5, Math.min(50, pts));
    } else if (def.role === 'PRO_DRAW') {
      const rate = trigDrawHits[t] / cnt;
      const lift = rate - subDrawRate;
      const pts = Math.round((def.defaultPoints + lift * 100) / 5) * 5;
      empiricalWeights[t] = Math.max(5, Math.min(50, pts));
    } else {
      // PRO_UNDERDOG
      const rate = trigUndHits[t] / cnt;
      const nonFavRate = (trigUndHits[t] + trigDrawHits[t]) / cnt;
      const lift = (rate - subUndRate) * 0.6 + (nonFavRate - (1 - subFavRate)) * 0.4;
      const pts = Math.round((def.defaultPoints + lift * 100) / 5) * 5;
      empiricalWeights[t] = Math.max(5, Math.min(50, pts));
    }
  }

  // Fast evaluator function over the N matches in this sub-pattern
  const evaluateCandidate = (cand: SubPatternSandboxModel): { primHits: number; finalHits: number } => {
    let primHits = 0;
    let finalHits = 0;

    const wSum = (cand.wAlgo + cand.wPaa + cand.wSeer + cand.wPha + cand.wMatrix) || 1;
    const weights = cand.triggerWeights;
    const undPenFactor = cand.undPenaltyOnFavTenths / 10;
    const drawPenFactor = cand.drawPenaltyOnFavTenths / 10;

    for (let i = 0; i < N; i++) {
      const cm = matches[i];
      const baseFav =
        (cm.algoFav * cand.wAlgo +
          cm.paaFav * cand.wPaa +
          cm.seerFav * cand.wSeer +
          cm.phaFav * cand.wPha +
          cm.matrixFav * cand.wMatrix) /
        wSum;
      const baseDraw =
        (cm.algoDraw * cand.wAlgo +
          cm.paaDraw * cand.wPaa +
          cm.seerDraw * cand.wSeer +
          cm.phaDraw * cand.wPha +
          cm.matrixDraw * cand.wMatrix) /
        wSum;
      const baseUnd =
        (cm.algoUnd * cand.wAlgo +
          cm.paaUnd * cand.wPaa +
          cm.seerUnd * cand.wSeer +
          cm.phaUnd * cand.wPha +
          cm.matrixUnd * cand.wMatrix) /
        wSum;

      let proMfavPts = 0;
      let proDrawPts = 0;
      let proUndPts = 0;

      const hits = cm.triggersHit;
      for (let j = 0; j < hits.length; j++) {
        const tIdx = hits[j];
        const w = weights[tIdx];
        if (tIdx <= 17) proMfavPts += w;
        else if (tIdx <= 31) proDrawPts += w;
        else proUndPts += w;
      }

      const mfavScore = baseFav + proMfavPts - proUndPts * undPenFactor - proDrawPts * drawPenFactor;
      const drawScore = baseDraw + proDrawPts;
      const undScore = baseUnd + proUndPts;

      const undLead = undScore - mfavScore;
      const drawLead = drawScore - mfavScore;

      let primOut: 0 | 1 | 2 = 0;
      if (undScore >= cand.minUndPrimScore && undLead >= cand.undPrimMargin && undScore >= drawScore - 5) {
        primOut = 2;
      } else if (drawScore >= cand.minDrawPrimScore && drawLead >= cand.drawPrimMargin) {
        primOut = 1;
      }

      let finalOut: 0 | 1 | 2 = 0;
      if (undLead >= cand.undDcPivotMargin) {
        finalOut = 2;
      } else if (undScore >= cand.splitMinUndScore && mfavScore >= 45 && drawScore <= cand.splitDrawCeiling) {
        finalOut = 1;
      }

      const actualOut = cm.actualOutcomeType;
      if (primOut === actualOut) primHits++;

      if (finalOut === 0) {
        if (actualOut === 0 || actualOut === 1) finalHits++;
      } else if (finalOut === 2) {
        if (actualOut === 2 || actualOut === 1) finalHits++;
      } else {
        if (actualOut === 0 || actualOut === 2) finalHits++;
      }
    }

    return { primHits, finalHits };
  };

  const isStrictlyBetter = (
    newPrim: number,
    newFinal: number,
    bestPrim: number,
    bestFinal: number
  ): boolean => {
    if (targetMode === 'final') {
      return newFinal > bestFinal || (newFinal === bestFinal && newPrim > bestPrim);
    }
    if (targetMode === 'primary') {
      return newPrim > bestPrim || (newPrim === bestPrim && newFinal > bestFinal);
    }
    // 'both': combined net gain with priority on not regressing either
    const newTotal = newFinal * 2 + newPrim;
    const bestTotal = bestFinal * 2 + bestPrim;
    if (newFinal >= bestFinal && newPrim >= bestPrim && (newFinal > bestFinal || newPrim > bestPrim)) {
      return true;
    }
    return newTotal > bestTotal && newFinal >= baseFinalHits && newPrim >= basePrimHits;
  };

  // Initialize best state from existingModel (if already computed) or baseline
  let bestModel: SubPatternSandboxModel = existingModel
    ? {
        ...existingModel,
        triggerWeights: [...existingModel.triggerWeights],
        useComputed: true,
      }
    : {
        ...createDefaultSandboxModel(subPattern),
        triggerWeights: [...empiricalWeights],
        useComputed: true,
      };

  let bestScore = existingModel?.useComputed
    ? evaluateCandidate(bestModel)
    : { primHits: basePrimHits, finalHits: baseFinalHits };

  let foundImprovementOverBaseline =
    bestScore.finalHits > baseFinalHits ||
    (bestScore.finalHits === baseFinalHits && bestScore.primHits > basePrimHits);

  // Also test the empirical seed directly right away
  const empCandidate: SubPatternSandboxModel = {
    ...createDefaultSandboxModel(subPattern),
    triggerWeights: [...empiricalWeights],
    useComputed: true,
  };
  const empEval = evaluateCandidate(empCandidate);
  if (isStrictlyBetter(empEval.primHits, empEval.finalHits, bestScore.primHits, bestScore.finalHits)) {
    bestScore = empEval;
    bestModel = empCandidate;
    foundImprovementOverBaseline = true;
  }

  // Stage 2: Fast Threshold Grid Sweep (adapts to sub-pattern's Fav/Draw/Und balance)
  const undDcMargins = [-25, -10, 0, 8, 15, 25, 40, 60, 90];
  const splitCeilings = [20, 35, 45, 58, 70];
  const undPrimMargins = [-15, -5, 5, 15, 25, 40, 65];
  const drawPrimMargins = [-15, -5, 5, 15, 25, 40, 65];

  for (const dcM of undDcMargins) {
    for (const spC of splitCeilings) {
      const probe: SubPatternSandboxModel = {
        ...bestModel,
        undDcPivotMargin: dcM,
        splitDrawCeiling: spC,
      };
      const ev = evaluateCandidate(probe);
      if (isStrictlyBetter(ev.primHits, ev.finalHits, bestScore.primHits, bestScore.finalHits)) {
        bestScore = ev;
        bestModel = probe;
        foundImprovementOverBaseline = true;
      }
    }
  }

  for (const uPM of undPrimMargins) {
    for (const dPM of drawPrimMargins) {
      const probe: SubPatternSandboxModel = {
        ...bestModel,
        undPrimMargin: uPM,
        drawPrimMargin: dPM,
      };
      const ev = evaluateCandidate(probe);
      if (isStrictlyBetter(ev.primHits, ev.finalHits, bestScore.primHits, bestScore.finalHits)) {
        bestScore = ev;
        bestModel = probe;
        foundImprovementOverBaseline = true;
      }
    }
  }

  // Find which triggers actually fire in this sub-pattern so mutations don't waste cycles
  const activeTrigIndices: number[] = [];
  for (let t = 0; t < NUM_SANDBOX_TRIGGERS; t++) {
    if (trigCounts[t] > 0) activeTrigIndices.push(t);
  }

  // Stage 3: High-Speed Stochastic Coordinate + Multi-Trigger Permutation Search
  const deltas = [-15, -10, -5, 5, 10, 15, 20];
  for (let iter = 0; iter < iterations; iter++) {
    const candidate: SubPatternSandboxModel = {
      ...bestModel,
      triggerWeights: [...bestModel.triggerWeights],
    };

    const mode = iter % 5;
    if (mode === 0 || mode === 1) {
      // Mutate 1 to 3 active trigger weights (respecting strict positive polarity within each role)
      const numMut = 1 + (iter % 3);
      for (let m = 0; m < numMut; m++) {
        if (activeTrigIndices.length === 0) break;
        const tIdx = activeTrigIndices[Math.floor(Math.random() * activeTrigIndices.length)];
        const delta = deltas[Math.floor(Math.random() * deltas.length)];
        candidate.triggerWeights[tIdx] = Math.max(0, Math.min(60, candidate.triggerWeights[tIdx] + delta));
      }
    } else if (mode === 2) {
      // Mutate Final DC pivot thresholds & penalty factors
      candidate.undDcPivotMargin = Math.max(
        -40,
        Math.min(120, candidate.undDcPivotMargin + deltas[Math.floor(Math.random() * deltas.length)])
      );
      candidate.splitDrawCeiling = Math.max(
        10,
        Math.min(90, candidate.splitDrawCeiling + deltas[Math.floor(Math.random() * deltas.length)])
      );
      candidate.splitMinUndScore = Math.max(
        25,
        Math.min(110, candidate.splitMinUndScore + deltas[Math.floor(Math.random() * deltas.length)])
      );
      candidate.undPenaltyOnFavTenths = Math.max(
        2,
        Math.min(18, candidate.undPenaltyOnFavTenths + (Math.random() < 0.5 ? -2 : 2))
      );
    } else if (mode === 3) {
      // Mutate Primary decision thresholds
      candidate.undPrimMargin = Math.max(
        -30,
        Math.min(100, candidate.undPrimMargin + deltas[Math.floor(Math.random() * deltas.length)])
      );
      candidate.drawPrimMargin = Math.max(
        -30,
        Math.min(100, candidate.drawPrimMargin + deltas[Math.floor(Math.random() * deltas.length)])
      );
      candidate.minUndPrimScore = Math.max(
        25,
        Math.min(110, candidate.minUndPrimScore + deltas[Math.floor(Math.random() * deltas.length)])
      );
      candidate.minDrawPrimScore = Math.max(
        25,
        Math.min(110, candidate.minDrawPrimScore + deltas[Math.floor(Math.random() * deltas.length)])
      );
    } else {
      // Combined mutation: Predictor blend weights + 2 triggers + threshold
      candidate.wAlgo = Math.max(2, Math.min(30, candidate.wAlgo + (Math.random() < 0.5 ? -3 : 3)));
      candidate.wPaa = Math.max(2, Math.min(30, candidate.wPaa + (Math.random() < 0.5 ? -3 : 3)));
      candidate.wSeer = Math.max(2, Math.min(30, candidate.wSeer + (Math.random() < 0.5 ? -3 : 3)));
      candidate.wPha = Math.max(2, Math.min(30, candidate.wPha + (Math.random() < 0.5 ? -3 : 3)));
      candidate.wMatrix = Math.max(2, Math.min(30, candidate.wMatrix + (Math.random() < 0.5 ? -3 : 3)));
      if (activeTrigIndices.length > 0) {
        const tIdx = activeTrigIndices[Math.floor(Math.random() * activeTrigIndices.length)];
        const delta = deltas[Math.floor(Math.random() * deltas.length)];
        candidate.triggerWeights[tIdx] = Math.max(0, Math.min(60, candidate.triggerWeights[tIdx] + delta));
      }
    }

    const ev = evaluateCandidate(candidate);
    if (isStrictlyBetter(ev.primHits, ev.finalHits, bestScore.primHits, bestScore.finalHits)) {
      bestScore = ev;
      bestModel = candidate;
      foundImprovementOverBaseline = true;
    }
  }

  bestModel.iterationsRun = (existingModel?.iterationsRun || 0) + iterations;
  // Strict Anti-Regression Ratchet: Only enable `useComputed = true` if it beats Baseline ML
  bestModel.useComputed =
    foundImprovementOverBaseline &&
    (bestScore.finalHits > baseFinalHits ||
      (bestScore.finalHits === baseFinalHits && bestScore.primHits > basePrimHits));

  return bestModel;
}

/**
 * Computes empirical trigger stats inside a given set of matches for the Trigger Inspector table.
 */
export function computeTriggerStatsForSubPattern(matches: CompactSandboxMatch[]): Array<{
  def: SandboxTriggerDef;
  total: number;
  favCount: number;
  drawCount: number;
  undCount: number;
  favPct: number;
  drawPct: number;
  undPct: number;
}> {
  const counts = new Int32Array(NUM_SANDBOX_TRIGGERS);
  const favs = new Int32Array(NUM_SANDBOX_TRIGGERS);
  const draws = new Int32Array(NUM_SANDBOX_TRIGGERS);
  const unds = new Int32Array(NUM_SANDBOX_TRIGGERS);

  for (let i = 0; i < matches.length; i++) {
    const cm = matches[i];
    const out = cm.actualOutcomeType;
    const hits = cm.triggersHit;
    for (let j = 0; j < hits.length; j++) {
      const t = hits[j];
      counts[t]++;
      if (out === 0) favs[t]++;
      else if (out === 1) draws[t]++;
      else unds[t]++;
    }
  }

  return SANDBOX_TRIGGERS.map((def, idx) => {
    const t = counts[idx];
    return {
      def,
      total: t,
      favCount: favs[idx],
      drawCount: draws[idx],
      undCount: unds[idx],
      favPct: t > 0 ? (favs[idx] / t) * 100 : 0,
      drawPct: t > 0 ? (draws[idx] / t) * 100 : 0,
      undPct: t > 0 ? (unds[idx] / t) * 100 : 0,
    };
  });
}
