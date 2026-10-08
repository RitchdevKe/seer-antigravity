import { SeerLockedSlip } from '../services/seerSlips';
import { Pick } from '../components/ai/GeminiCards';
import { Match } from '../types';
import { getActualResult } from './matchProcessing';
import { getTriggerSemanticPolarity } from './opwCatalog';
import axios from 'axios';

export interface ProtectedPenaltyGuard {
  trigger: string;
  floorPoints: number; // e.g. -10, -15, -20 (must be <= -5)
  sourceMatch?: string; // Match teams where trap occurred, e.g. "Farnham Town vs Truro City"
  sourceDate?: string; // Date of match
  category?: string; // Category ID
  reason: string; // Explanatory context
  markedAt: string; // ISO timestamp
}

export interface SlipUpsetPostMortem {
  matchId: string;
  teams: string;
  date: string;
  category: string;
  rankOnSlip: number;
  prediction: string;
  actualResult: string;
  opwPoints: number;
  outcome: 'Incorrect';
  mFav?: string;
  underdog?: string;

  // Active warning penalties that fired on the match (warnings overpowered by bonuses)
  activePenalties: {
    trigger: string;
    points: number;
    isProtected: boolean;
    currentFloor?: number;
  }[];

  // Triggers present on this upset match that were NEVER present on any winning slip match
  exclusiveSpoilerTriggers: {
    trigger: string;
    points: number;
    polarity: string;
  }[];

  // All triggers hit on this match
  allTriggersHit: {
    description: string;
    points: number;
  }[];

  // Mathematical points deficit needed to drop this match below slip capacity (e.g. out of Top 12)
  exitSlipScoreThreshold: number;
  pointsDeficitToExit: number;
}

const STORAGE_KEY = 'opw_protected_penalty_guards_v1';
let cachedGuards: ProtectedPenaltyGuard[] | null = null;

/**
 * Load all protected penalty guards from localStorage (with memory cache fallback)
 */
export function loadProtectedPenaltyGuards(): ProtectedPenaltyGuard[] {
  if (typeof window === 'undefined') return cachedGuards || [];
  if (cachedGuards !== null) return cachedGuards;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cachedGuards = [];
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      cachedGuards = parsed;
      return parsed;
    }
  } catch (e) {
    console.error('Error loading protected penalty guards:', e);
  }

  cachedGuards = [];
  return [];
}

/**
 * Save or update a protected penalty guard
 */
export function saveProtectedPenaltyGuard(guard: ProtectedPenaltyGuard): void {
  // Normalize floor points to be negative and on 5-point grid
  const normalizedFloor = Math.min(-5, Math.round(guard.floorPoints / 5) * 5);
  const updatedGuard: ProtectedPenaltyGuard = {
    ...guard,
    floorPoints: normalizedFloor
  };

  const current = loadProtectedPenaltyGuards();
  const idx = current.findIndex(g => g.trigger === updatedGuard.trigger);

  if (idx >= 0) {
    // If updating, take the deeper penalty floor (more negative)
    const existing = current[idx];
    const deeperFloor = Math.min(existing.floorPoints, updatedGuard.floorPoints);
    current[idx] = {
      ...updatedGuard,
      floorPoints: deeperFloor
    };
  } else {
    current.push(updatedGuard);
  }

  cachedGuards = current;

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      window.dispatchEvent(new CustomEvent('opwProtectedGuardsUpdated', { detail: { guards: current } }));
      
      // Async backup to backend storage
      axios.post('/api/storage/save', {
        key: STORAGE_KEY,
        data: current
      }).catch(e => console.warn('Failed to sync protected guards to server:', e));
    } catch (e) {
      console.error('Error saving protected penalty guard:', e);
    }
  }
}

/**
 * Remove a protected penalty guard
 */
export function removeProtectedPenaltyGuard(trigger: string): void {
  const current = loadProtectedPenaltyGuards();
  const filtered = current.filter(g => g.trigger !== trigger);
  cachedGuards = filtered;

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      window.dispatchEvent(new CustomEvent('opwProtectedGuardsUpdated', { detail: { guards: filtered } }));
      
      axios.post('/api/storage/save', {
        key: STORAGE_KEY,
        data: filtered
      }).catch(e => console.warn('Failed to sync guard removal to server:', e));
    } catch (e) {
      console.error('Error removing protected penalty guard:', e);
    }
  }
}

/**
 * Check if a trigger is protected against upward relaxation
 */
export function isProtectedPenalty(trigger: string): boolean {
  const guards = loadProtectedPenaltyGuards();
  return guards.some(g => g.trigger === trigger);
}

/**
 * Get the locked penalty floor for a trigger, or null if not protected
 */
export function getProtectedFloor(trigger: string): number | null {
  const guards = loadProtectedPenaltyGuards();
  const found = guards.find(g => g.trigger === trigger);
  return found ? found.floorPoints : null;
}

/**
 * Checks if a pick resulted in an outright upset (underdog win / favorite failure, not just a draw)
 */
export function isOutrightUpset(pick: Pick): boolean {
  if (pick.outcome !== 'Incorrect') return false;

  const actual = getActualResult(pick.actualResult || '');
  if (!actual || actual === 'pending') return false;

  // If actual was a draw ('X'), in many categories that's a push or hedged draw, not an outright upset loss
  // If actual was '1' or '2', and favorite failed, that's an outright upset
  const mFav = pick.opwBaseInfo?.mFav;
  if (mFav) {
    if (mFav === '1' && actual === '2') return true;
    if (mFav === '2' && actual === '1') return true;
  }

  // Prediction-based check
  const pred = pick.prediction || '';
  if ((pred.includes('1') && !pred.includes('2')) && actual === '2') return true;
  if ((pred.includes('2') && !pred.includes('1')) && actual === '1') return true;

  // In Best Bet / Bankers / Value, if outcome is Incorrect and it's not a draw, it's an outright upset
  return actual !== 'X';
}

/**
 * Performs deep differential post-mortem analysis on locked slips:
 * Identifies upset casualties, extracts warnings that were overpowered, computes point deficits,
 * and pinpoints exclusive spoiler triggers.
 */
export function analyzeSlipUpsets(slip: SeerLockedSlip, allPoolMatches?: Match[]): SlipUpsetPostMortem[] {
  if (!slip || !slip.picks || slip.picks.length === 0) return [];

  const picks = slip.picks;
  const protectedGuards = loadProtectedPenaltyGuards();
  const guardsMap = new Map<string, number>(protectedGuards.map(g => [g.trigger, g.floorPoints]));

  // 1. Identify winning picks on this slip (True Positives)
  const winningPicks = picks.filter(p => p.outcome === 'Correct');
  const winningTriggerSet = new Set<string>();
  winningPicks.forEach(wp => {
    (wp.opwRulesHit || []).forEach(r => winningTriggerSet.add(r.description));
  });

  // 2. Identify slip cutoff score (the lowest score on the slip)
  const scores = picks.map(p => p.opwPoints ?? 0).filter(s => s > 0);
  const minSlipScore = scores.length > 0 ? Math.min(...scores) : 70;
  // If pool matches exist, find score of match right below the slip capacity
  let cutoffScore = minSlipScore - 1;
  if (allPoolMatches && allPoolMatches.length > picks.length) {
    const sortedPool = [...allPoolMatches].sort((a, b) => {
      const sa = (a as any).lockedOpwScore?.totalScore ?? (a as any).totalScore ?? 0;
      const sb = (b as any).lockedOpwScore?.totalScore ?? (b as any).totalScore ?? 0;
      return sb - sa;
    });
    const exitMatch = sortedPool[picks.length];
    if (exitMatch) {
      cutoffScore = (exitMatch as any).lockedOpwScore?.totalScore ?? (exitMatch as any).totalScore ?? (minSlipScore - 1);
    }
  }

  // 3. Process each upset match on the slip
  const postMortems: SlipUpsetPostMortem[] = [];

  picks.forEach((pick, index) => {
    if (!isOutrightUpset(pick)) return;

    const pickScore = pick.opwPoints ?? 0;
    const rulesHit = pick.opwRulesHit || [];

    // Separate active penalties from bonuses
    const activePenalties = rulesHit
      .filter(r => r.points < 0)
      .map(r => ({
        trigger: r.description,
        points: r.points,
        isProtected: guardsMap.has(r.description),
        currentFloor: guardsMap.get(r.description)
      }));

    // Identify exclusive spoiler triggers (present on this upset match, absent on ALL winners)
    const exclusiveSpoilerTriggers = rulesHit
      .filter(r => !winningTriggerSet.has(r.description) && r.points > 0)
      .map(r => ({
        trigger: r.description,
        points: r.points,
        polarity: getTriggerSemanticPolarity(r.description)
      }));

    // Calculate required deficit to drop below cutoff
    // Deficit = (pickScore - cutoffScore) + 1 point margin
    const pointsDeficitToExit = Math.max(5, (pickScore - cutoffScore) + 1);

    postMortems.push({
      matchId: (pick.match_id || `${slip.date}_${index}`).toString(),
      teams: pick.team,
      date: slip.date,
      category: slip.category,
      rankOnSlip: index + 1,
      prediction: pick.prediction,
      actualResult: pick.actualResult || 'Unknown',
      opwPoints: pickScore,
      outcome: 'Incorrect',
      mFav: pick.opwBaseInfo?.mFav,
      underdog: pick.opwBaseInfo?.mFav === '1' ? '2' : '1',
      activePenalties,
      exclusiveSpoilerTriggers,
      allTriggersHit: rulesHit,
      exitSlipScoreThreshold: cutoffScore,
      pointsDeficitToExit
    });
  });

  return postMortems;
}
