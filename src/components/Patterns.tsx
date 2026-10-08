import { Match, TotalPoints } from "../types";

// Helper to avoid floating point issues - Strict check (+-0.2)
const isClose = (a: number, b: number, t = 0.2) =>
  Math.abs(a - b) <= t + Number.EPSILON;

// --- 1. Flag Calculation ---
export const calculateFlags = (m: Match) => {
  const gsHome = m.gsHome || 0;
  const gsAway = m.gsAway || 0;
  const gaHome = m.gaHome || 0;
  const gaAway = m.gaAway || 0;
  const tsb = m.tsb || 0;
  const tsa = m.tsa || 0;

  const diffGS = gsHome - gsAway; // >0 means Home scores more
  const diffGA = gaHome - gaAway; // >0 means Home concedes more (Worse defense)

  // Epsilon for float comparison (handles 0.30000000004 issues)
  const e = 0.001;

  // --- GS FLAGS ---
  const SHGS = diffGS >= 0.3 - e && diffGS <= 0.5 + e;
  const ESHGS = diffGS > 0.5 + e;
  const WHGS = diffGS <= -0.3 + e && diffGS >= -0.5 - e;
  const EWHGS = diffGS < -0.5 - e;

  const SAGS = WHGS;
  const ESAGS = EWHGS;
  const WAGS = SHGS;
  const EWAGS = ESHGS;

  // --- GA FLAGS ---
  const SHGA = diffGA <= -0.3 + e && diffGA >= -0.5 - e;
  const ESHGA = diffGA < -0.5 - e;
  const WHGA = diffGA >= 0.3 - e && diffGA <= 0.5 + e;
  const EWHGA = diffGA > 0.5 + e;

  const SAGA = WHGA;
  const ESAGA = EWHGA;
  const WAGA = SHGA;
  const EWAGA = ESHGA;

  // --- SPECIAL FLAGS ---
  const TSB_1 = isClose(tsb, 1.0, 0.05); // Away TS Exactly 1.0 (Approx)
  const UPSET = (tsa >= 2.0 && tsb <= 0.6) || (tsb >= 2.0 && tsa <= 0.6);
  // Potential Draw: TS >= 2.0 vs (0.6 < TS < 1.0)
  const POTENTIAL_DRAW =
    (tsa >= 2.0 && tsb > 0.6 && tsb < 1.0) ||
    (tsb >= 2.0 && tsa > 0.6 && tsa < 1.0);
  const TS_DIFF_DRAW = Math.abs(tsa - tsb) >= 1.0;
  const TS_HOME_STRONG = tsa >= 2.0;

  // --- BALANCE FLAGS (Added to be visible in UI) ---
  const H_BAL = isClose(gsHome, gaHome, 0.2);
  const A_BAL = isClose(gsAway, gaAway, 0.2);

  // --- NEW SELF-LEARNING FLAGS (Batch 23) ---
  const HGS_STRONG = gsHome > 2.0;
  const AGS_WEAK = gsAway < 1.0;
  const HGA_LEAKY = gaHome > 1.5;
  const LOW_OFFENSE = gsHome < 1.2 && gsAway < 1.2;
  const DEF_MISMATCH = diffGA > 1.0; // Home concedes 1+ more than Away

  // --- NEW GENIUS FLAGS (Batch 24 & 25) ---
  const BOTH_HIGH_SCORING = gsHome > 1.5 && gsAway > 1.5;
  const TS_HOME_DOMINANT = tsa > 1.5 && tsa - tsb > 1.0;
  const TS_AWAY_DOMINANT = tsb > 1.5 && tsb - tsa > 1.0;
  const VERY_LOW_OFFENSE = gsHome < 1.1 && gsAway < 1.1;
  const AWAY_TS_DOMINANCE_G1 = tsb > tsa + 0.5;

  // --- NEW GENIUS FLAGS (Batch 26 - Self Learning Strategy) ---
  const GS_TIGHT = Math.abs(diffGS) <= 0.2 + e;
  const HGS_ABOVE_AVG = gsHome > 1.3;
  const AGA_SOLID = gaAway < 1.2;
  const HIGH_TOTAL_SCORING = gsHome + gsAway > 3.0;
  const TSB_GT_TSA = tsb > tsa;
  const GS_HOME_ADV = diffGS > 0;
  const TSA_HIGH = tsa > 1.5;
  const AGS_VERY_WEAK = gsAway < 0.8;
  const LOW_TOTAL_SCORING = gsHome + gsAway < 2.0;
  const TSA_GT_1 = tsa > 1.0;
  const TS_TIGHT = Math.abs(tsa - tsb) < 0.2 + e;
  const HGS_POOR = gsHome < 0.7;

  // --- NEW GENIUS FLAGS (Batch 27 - Genius Strategy Report) ---
  const GS_STALEMATE = Math.abs(diffGS) <= 0.1 + e; // DiffGS +/- 0.1
  const HGS_ELITE = gsHome > 1.8;
  const HGA_IRON = gaHome < 0.8;
  const AGS_STRONG = gsAway > 1.5;
  const HGS_GOOD = gsHome > 1.5;
  const AWAY_DEF_BETTER = diffGA > 0; // DiffGA > 0
  const HGS_WEAK = gsHome < 1.0;
  const TSB_SOLID = tsb > 1.0;
  const GS_EXACT_EQUAL = Math.abs(diffGS) < 0.01; // DiffGS == 0.0
  const GA_EXACT_EQUAL = Math.abs(diffGA) < 0.01; // DiffGA == 0.0
  const AGS_GT_HGS = gsAway > gsHome;

  // --- NEW GENIUS FLAGS (Batch 28 - Genius Sub Pattern Creator) ---
  const TSA_GT_1_3 = tsa > 1.3;
  const GS_NEAR_EQUAL = diffGS > -0.1;
  const GS_AWAY_LEAN = diffGS <= 0.1;
  const GS_AWAY_ADV = diffGS < 0;
  const HGS_LOW_1_2 = gsHome < 1.2;
  const TSA_WEAK_0_8 = tsa < 0.8;
  const AGS_DECENT_1_0 = gsAway > 1.0;

  // --- NEW FLAGS (BATCH 29 - SELF LEARNING REFINEMENT) ---
  const HOME_DEF_BETTER = diffGA <= 0;
  const HOME_DEF_STRICT = diffGA < 0;
  const HGS_LT_1_5 = gsHome < 1.5;
  const GS_HOME_DOMINANT_1 = diffGS > 1.0;
  const TSA_LT_1 = tsa < 1.0;
  // GS_AWAY_ADV already exists (diffGS < 0)
  const AGA_LT_1_5 = gaAway < 1.5;
  // GS_TIGHT already exists
  const HGS_LT_0_8 = gsHome < 0.8;
  const HGA_LT_1_5 = gaHome < 1.5;

  return {
    SHGS,
    ESHGS,
    WHGS,
    EWHGS,
    SAGS,
    ESAGS,
    WAGS,
    EWAGS,
    SHGA,
    ESHGA,
    WHGA,
    EWHGA,
    SAGA,
    ESAGA,
    WAGA,
    EWAGA,
    TSB_1,
    UPSET,
    POTENTIAL_DRAW,
    TS_DIFF_DRAW,
    TS_HOME_STRONG,
    H_BAL,
    A_BAL,
    HGS_STRONG,
    AGS_WEAK,
    HGA_LEAKY,
    LOW_OFFENSE,
    DEF_MISMATCH,
    BOTH_HIGH_SCORING,
    TS_HOME_DOMINANT,
    TS_AWAY_DOMINANT,
    VERY_LOW_OFFENSE,
    AWAY_TS_DOMINANCE_G1,
    GS_TIGHT,
    HGS_ABOVE_AVG,
    AGA_SOLID,
    HIGH_TOTAL_SCORING,
    TSB_GT_TSA,
    GS_HOME_ADV,
    TSA_HIGH,
    AGS_VERY_WEAK,
    LOW_TOTAL_SCORING,
    TSA_GT_1,
    TS_TIGHT,
    HGS_POOR,
    GS_STALEMATE,
    HGS_ELITE,
    HGA_IRON,
    AGS_STRONG,
    HGS_GOOD,
    AWAY_DEF_BETTER,
    HGS_WEAK,
    TSB_SOLID,
    GS_EXACT_EQUAL,
    GA_EXACT_EQUAL,
    AGS_GT_HGS,
    TSA_GT_1_3,
    GS_NEAR_EQUAL,
    GS_AWAY_LEAN,
    GS_AWAY_ADV,
    HGS_LOW_1_2,
    TSA_WEAK_0_8,
    AGS_DECENT_1_0,
    HOME_DEF_BETTER,
    HOME_DEF_STRICT,
    HGS_LT_1_5,
    GS_HOME_DOMINANT_1,
    TSA_LT_1,
    AGA_LT_1_5,
    HGS_LT_0_8,
    HGA_LT_1_5,
  };
};

const SECONDARY_NOISE_FLAGS = new Set([
  "HGA_LEAKY", "LOW_OFFENSE", "DEF_MISMATCH", "BOTH_HIGH_SCORING", "TS_HOME_DOMINANT",
  "TS_AWAY_DOMINANT", "VERY_LOW_OFFENSE", "AWAY_TS_DOMINANCE_G1", "GS_TIGHT", "HGS_ABOVE_AVG",
  "AGA_SOLID", "HIGH_TOTAL_SCORING", "TSB_GT_TSA", "GS_HOME_ADV", "TSA_HIGH", "AGS_VERY_WEAK",
  "LOW_TOTAL_SCORING", "TSA_GT_1", "TS_TIGHT", "HGS_POOR", "GS_STALEMATE", "HGS_ELITE",
  "HGA_IRON", "AGS_STRONG", "HGS_GOOD", "AWAY_DEF_BETTER", "HGS_WEAK", "TSB_SOLID",
  "GS_EXACT_EQUAL", "GA_EXACT_EQUAL", "AGS_GT_HGS", "TSA_GT_1_3", "GS_NEAR_EQUAL",
  "GS_AWAY_LEAN", "GS_AWAY_ADV", "HGS_LOW_1_2", "TSA_WEAK_0_8", "AGS_DECENT_1_0",
  "HOME_DEF_BETTER", "HOME_DEF_STRICT", "HGS_LT_1_5", "GS_HOME_DOMINANT_1", "TSA_LT_1",
  "AGA_LT_1_5", "HGS_LT_0_8", "HGA_LT_1_5", "HGS_STRONG", "AGS_WEAK"
]);

export const getActiveFlags = (flags: ReturnType<typeof calculateFlags>) => {
  return Object.entries(flags)
    .filter(([key, isActive]) => isActive && !SECONDARY_NOISE_FLAGS.has(key))
    .map(([key]) => key);
};

export const detectLegacyPatterns = (
  match: Match,
  totalPoints: TotalPoints,
  prediction: string,
) => {
  const patterns: string[] = [];

  // P1: Draw Pts >= 28
  if (totalPoints.draw >= 28) patterns.push("P1");

  // P2: L10 Close
  if (match.l10 && match.l10 !== "NA") {
    const parts = match.l10.split(":").map((s) => parseFloat(s));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      if (Math.abs(parts[0] - parts[1]) <= 2) patterns.push("P2");
    }
  }

  // P3: TS Equal
  if (match.tsa !== undefined && match.tsb !== undefined) {
    if (isClose(match.tsa, match.tsb, 0.2)) patterns.push("P3");
  }

  // P4: Pred is X
  if (prediction === "X") patterns.push("P4");

  // P5: LE Draw
  if (match.le && match.le !== "NA" && match.le.includes(":")) {
    // Format usually A1:1 or B1:1. Skip 1st char.
    const scoreStr = match.le.substring(1);
    const parts = scoreStr.split(":").map((s) => parseInt(s));
    if (parts.length === 2 && !isNaN(parts[0]) && parts[0] === parts[1]) {
      patterns.push("P5");
    }
  }

  // P7: Pts Close
  if (isClose(totalPoints.home, totalPoints.away, 3)) patterns.push("P7");

  const pCode = patterns.length > 0 ? patterns.join("") : "NA";
  return { patterns, pCode };
};

// --- Helper: Get Pattern Conditions ---
export const getPatternConditions = (m: Match) => {
  const gsHome = m.gsHome || 0;
  const gsAway = m.gsAway || 0;
  const gaHome = m.gaHome || 0;
  const gaAway = m.gaAway || 0;

  const t = 0.2;

  return {
    // Use Difference for Balance (Equal or close to equal +-0.2)
    hBal: isClose(gsHome, gaHome, t),
    aBal: isClose(gsAway, gaAway, t),
    gsEqual: isClose(gsHome, gsAway, t),
    gaEqual: isClose(gaHome, gaAway, t),
    hgaAgs: isClose(gaHome, gsAway, t),
    agaHgs: isClose(gaAway, gsHome, t),
  };
};

export const matchesPatternDefinition = (
  conditions: ReturnType<typeof getPatternConditions>,
  patternCode: string,
) => {
  const { hBal, aBal, gsEqual, gaEqual, hgaAgs, agaHgs } = conditions;

  switch (patternCode) {
    case "T":
      return hBal && aBal && gsEqual && gaEqual && hgaAgs && agaHgs;
    case "V":
      return hBal && aBal && gaEqual && hgaAgs && agaHgs;
    case "U":
      return hBal && gsEqual && gaEqual && agaHgs;
    case "Y":
      return hBal && gaEqual && hgaAgs && agaHgs;
    case "K":
      return hBal && aBal && gaEqual && hgaAgs;
    case "H":
      return hBal && aBal && gaEqual && agaHgs;
    case "KK":
      return hBal && aBal && gsEqual && hgaAgs && agaHgs;
    case "PP":
      return aBal && gsEqual && hgaAgs && agaHgs;
    case "OO":
      return aBal && gaEqual && hgaAgs && agaHgs;
    case "NN":
      return aBal && gsEqual && gaEqual && agaHgs;
    case "N":
      return hBal && gsEqual && gaEqual;
    case "P":
      return aBal && gaEqual && hgaAgs;
    case "Q":
      return aBal && gsEqual && agaHgs;
    case "M":
      return hBal && gsEqual && hgaAgs;
    case "L":
      return gaEqual && hgaAgs && agaHgs;
    case "MM":
      return gsEqual && gaEqual && agaHgs;
    case "A":
      return hBal && gaEqual && agaHgs;
    case "C":
      return aBal && hgaAgs && agaHgs;
    case "LL":
      return hBal && aBal && agaHgs;
    case "CC":
      return hgaAgs && gaEqual;
    case "DD":
      return hgaAgs && gsEqual;
    case "R":
      return gsEqual && gaEqual;
    case "X":
      return gsEqual && hBal;
    case "B":
      return hBal && gaEqual;
    case "S":
      return hBal && aBal;
    case "BB":
      return hBal && agaHgs;
    case "AA":
      return aBal && agaHgs;
    case "E":
      return hgaAgs && agaHgs;
    case "W":
      return gaEqual && agaHgs;
    case "O":
      return aBal;
    case "F":
      return hBal;
    case "EE":
      return hgaAgs;
    case "I":
      return agaHgs;
    case "G":
      return gaEqual;
    case "J":
      return gsEqual;
    case "GG":
      return gsEqual && agaHgs;
    case "HH":
      return gsEqual && aBal;
    case "II":
      return hBal && hgaAgs;
    case "JJ":
      return gaEqual && aBal;
    case "FF":
      return true;
    default:
      return false;
  }
};

// --- 2. Main Pattern Detection ---
export const detectMainPattern = (m: Match) => {
  const { hBal, aBal, gsEqual, gaEqual, hgaAgs, agaHgs } =
    getPatternConditions(m);

  // 6 Conditions
  if (hBal && aBal && gsEqual && gaEqual && hgaAgs && agaHgs) return "T";

  // 5 Conditions
  if (hBal && aBal && gsEqual && hgaAgs && agaHgs) return "KK"; // New KK
  if (hBal && aBal && gaEqual && hgaAgs && agaHgs) return "V";

  // 4 Conditions
  if (hBal && gsEqual && gaEqual && hgaAgs) return "N"; // Fix: Priority N over R when hBal exists (GS=GS+GA=GA+HGA=AGS+H.bal)
  if (hBal && gsEqual && gaEqual && agaHgs) return "U";
  if (hBal && gaEqual && hgaAgs && agaHgs) return "Y";
  if (hBal && aBal && gaEqual && hgaAgs) return "K";
  if (hBal && aBal && gaEqual && agaHgs) return "H";
  // New OO and PP
  if (aBal && gsEqual && hgaAgs && agaHgs) return "PP";
  if (aBal && gaEqual && hgaAgs && agaHgs) return "OO";
  // New NN
  if (aBal && gsEqual && gaEqual && agaHgs) return "NN";

  // 3 Conditions
  // Priority: R (Double Equal) -> Others
  if (gsEqual && gaEqual && hgaAgs) return "R";
  if (gsEqual && gaEqual && agaHgs) return "MM"; // New MM
  if (hBal && gsEqual && gaEqual) return "N";
  if (aBal && gaEqual && hgaAgs) return "P";
  if (aBal && gsEqual && agaHgs) return "Q";
  if (hBal && gsEqual && hgaAgs) return "M";
  if (gaEqual && hgaAgs && agaHgs) return "L";
  if (hBal && gaEqual && agaHgs) return "A";
  if (aBal && hgaAgs && agaHgs) return "C";
  // New LL
  if (hBal && aBal && agaHgs) return "LL";

  // 2 Conditions
  // Priority: S (Double Balance) -> Others
  if (hBal && aBal) return "S";
  if (hgaAgs && gaEqual) return "CC";
  if (hgaAgs && gsEqual) return "DD";
  if (hBal && agaHgs) return "BB";
  if (aBal && agaHgs) return "AA";
  if (hgaAgs && agaHgs) return "E";
  if (gaEqual && agaHgs) return "W";
  if (gsEqual && gaEqual) return "R";
  if (gsEqual && hBal) return "X";
  if (hBal && gaEqual) return "B";
  // New 2-Condition Patterns
  if (gsEqual && agaHgs) return "GG";
  if (gsEqual && aBal) return "HH";
  if (hBal && hgaAgs) return "II";
  if (gaEqual && aBal) return "JJ";

  // 1 Condition
  if (aBal) return "O";
  if (hBal) return "F";
  if (hgaAgs) return "EE";
  if (agaHgs) return "I";
  if (gaEqual) return "G";
  if (gsEqual) return "J";

  // 0 Conditions
  return "FF";
};

export const PATTERN_DESCRIPTIONS: Record<string, string> = {
  A: "H.Bal + Equal GA + AGA=HGS",
  B: "H.Bal + Equal GA",
  C: "A.Bal + HGA=AGS + AGA=HGS",
  D: "Deprecated (Renamed to EE)",
  E: "HGA=AGS & AGA=HGS (Perfect Cross-Match)",
  F: "H.Bal Only",
  G: "Equal GA Only",
  H: "H.Bal & Equal GA & A.Bal & AGA=HGS",
  I: "AGA=HGS Only",
  J: "Equal GS Only",
  K: "H.Bal & A.Bal + Equal GA + HGA=AGS",
  L: "Equal GA + Cross Match stats",
  M: "H.Bal + Equal GS + HGA=AGS",
  N: "H.Bal + Equal GS + Equal GA",
  O: "A.Bal Only",
  P: "A.Bal + Equal GA + HGA=AGS",
  Q: "A.Bal + Equal GS + AGA=HGS",
  R: "Equal GS + Equal GA",
  S: "H.Bal & A.Bal (Double Balance)",
  T: "Perfect Balance (All Stats Equal/Balanced)",
  U: "H.Bal + Equal GS + Equal GA + AGA=HGS",
  V: "All Balanced except Equal GS",
  W: "Equal GA + AGA=HGS",
  X: "Equal GS + H.Bal",
  Y: "H.Bal + Equal GA + Cross Match",
  Z: "No Distinct Pattern",
  AA: "A.Bal + AGA=HGS",
  BB: "H.Bal + AGA=HGS",
  CC: "HGA=AGS + Equal GA",
  DD: "HGA=AGS + Equal GS",
  EE: "HGA=AGS (Defense/Offense correlation)",
  GG: "Equal GS + AGA=HGS",
  HH: "Equal GS + A.Bal",
  II: "H.Bal + HGA=AGS",
  JJ: "Equal GA + A.Bal",
  KK: "GS=GS + H.Bal + A.Bal + HGA=AGS + HGS=AGA",
  OO: "GA=GA + A.Bal + HGA=AGS + HGS=AGA",
  PP: "GS=GS + A.Bal + HGA=AGS + HGS=AGA",
  LL: "H.Bal + A.Bal + AGA=HGS",
  MM: "GS=GS + GA=GA + AGA=HGS",
  NN: "GS=GS + GA=GA + A.BAL + AGA=HGS",
  FF: "No Balance (No Stats Equal)",
  NA: "No Pattern Detected",
};

export const LEGACY_DESCRIPTIONS: Record<string, string> = {
  P1: "Draw Pts >= 28",
  P2: "L10 Close",
  P3: "TS Equal",
  P4: "Pred is X",
  P5: "LE Draw",
  P7: "Pts Close",
  NA: "Normal Match",
};

export type SubPatternRule = {
  id: string;
  mainPattern: string;
  group: number;
  riders: string[];
  prediction: string;
  moCondition?: "min>2.0" | "min<2.0" | "follow";
  primaryPrediction?: string;
};

// RULES MUST BE ORDERED: Specific (more riders) BEFORE General (fewer riders)
export const SUB_PATTERN_RULES: SubPatternRule[] = [
  // G1 FF Specific (EWHGS+ESAGS+WHGA+SAGA + home leaks/away goals)
  {
    id: "G1ff59",
    mainPattern: "FF",
    group: 1,
    riders: [
      "EWHGS",
      "ESAGS",
      "WHGA",
      "SAGA",
      "HGA_LEAKY",
      "TSB_GT_TSA",
      "AWAY_DEF_BETTER",
      "HGS_WEAK",
      "AGS_GT_HGS",
      "GS_AWAY_LEAN",
      "GS_AWAY_ADV",
      "HGS_LOW_1_2",
      "TSA_WEAK_0_8",
      "AGS_DECENT_1_0",
      "HGS_LT_1_5",
      "TSA_LT_1",
      "HGS_LT_0_8",
    ],
    prediction: "X2",
    primaryPrediction: "2",
  },
  // G2 FF Specific (EWHGS+ESAGS+WHGA+SAGA + home leaks/away goals)
  {
    id: "G2ff59",
    mainPattern: "FF",
    group: 2,
    riders: [
      "EWHGS",
      "ESAGS",
      "WHGA",
      "SAGA",
      "HGA_LEAKY",
      "TSB_GT_TSA",
      "AWAY_DEF_BETTER",
      "HGS_WEAK",
      "AGS_GT_HGS",
      "GS_AWAY_LEAN",
      "GS_AWAY_ADV",
      "HGS_LOW_1_2",
      "TSA_WEAK_0_8",
      "AGS_DECENT_1_0",
      "HGS_LT_1_5",
      "TSA_LT_1",
      "HGS_LT_0_8",
    ],
    prediction: "12",
    primaryPrediction: "1",
  },
  // G3 FF Specific (EWHGS+ESAGS+WHGA+SAGA + home leaks/away goals)
  {
    id: "G3ff59",
    mainPattern: "FF",
    group: 3,
    riders: [
      "EWHGS",
      "ESAGS",
      "WHGA",
      "SAGA",
      "HGA_LEAKY",
      "TSB_GT_TSA",
      "AWAY_DEF_BETTER",
      "HGS_WEAK",
      "AGS_GT_HGS",
      "GS_AWAY_LEAN",
      "GS_AWAY_ADV",
      "HGS_LOW_1_2",
      "TSA_WEAK_0_8",
      "AGS_DECENT_1_0",
      "HGS_LT_1_5",
      "TSA_LT_1",
      "HGS_LT_0_8",
    ],
    prediction: "12",
    primaryPrediction: "2",
  },
  // G1 FF Specific (EWHGS+ESAGS+WHGA+SAGA + home leaks/away goals - No HGS_LT_0_8)
  {
    id: "G1ff60",
    mainPattern: "FF",
    group: 1,
    riders: [
      "EWHGS",
      "ESAGS",
      "WHGA",
      "SAGA",
      "HGA_LEAKY",
      "TSB_GT_TSA",
      "AWAY_DEF_BETTER",
      "HGS_WEAK",
      "AGS_GT_HGS",
      "GS_AWAY_LEAN",
      "GS_AWAY_ADV",
      "HGS_LOW_1_2",
      "TSA_WEAK_0_8",
      "AGS_DECENT_1_0",
      "HGS_LT_1_5",
      "TSA_LT_1",
    ],
    prediction: "X2",
    primaryPrediction: "2",
  },
  // G2 FF Specific (EWHGS+ESAGS+WHGA+SAGA + home leaks/away goals - No HGS_LT_0_8)
  {
    id: "G2ff60",
    mainPattern: "FF",
    group: 2,
    riders: [
      "EWHGS",
      "ESAGS",
      "WHGA",
      "SAGA",
      "HGA_LEAKY",
      "TSB_GT_TSA",
      "AWAY_DEF_BETTER",
      "HGS_WEAK",
      "AGS_GT_HGS",
      "GS_AWAY_LEAN",
      "GS_AWAY_ADV",
      "HGS_LOW_1_2",
      "TSA_WEAK_0_8",
      "AGS_DECENT_1_0",
      "HGS_LT_1_5",
      "TSA_LT_1",
    ],
    prediction: "12",
    primaryPrediction: "2",
  },
  // G3 FF Specific (EWHGS+ESAGS+WHGA+SAGA + home leaks/away goals - No HGS_LT_0_8)
  {
    id: "G3ff60",
    mainPattern: "FF",
    group: 3,
    riders: [
      "EWHGS",
      "ESAGS",
      "WHGA",
      "SAGA",
      "HGA_LEAKY",
      "TSB_GT_TSA",
      "AWAY_DEF_BETTER",
      "HGS_WEAK",
      "AGS_GT_HGS",
      "GS_AWAY_LEAN",
      "GS_AWAY_ADV",
      "HGS_LOW_1_2",
      "TSA_WEAK_0_8",
      "AGS_DECENT_1_0",
      "HGS_LT_1_5",
      "TSA_LT_1",
    ],
    prediction: "12",
    primaryPrediction: "2",
  },
  // G1 FF (NEW 4-FLAG)
  {
    id: "G1ff58",
    mainPattern: "FF",
    group: 1,
    riders: [
      "WHGS",
      "SAGS",
      "ESHGA",
      "EWAGA",
      "AGS_WEAK",
      "HGA_LEAKY",
      "LOW_OFFENSE",
      "VERY_LOW_OFFENSE",
      "TSB_GT_TSA",
      "LOW_TOTAL_SCORING",
      "TS_TIGHT",
      "HGS_POOR",
      "HGS_WEAK",
      "AGS_GT_HGS",
      "GS_AWAY_LEAN",
      "GS_AWAY_ADV",
      "HGS_LOW_1_2",
      "TSA_WEAK_0_8",
      "HOME_DEF_BETTER",
      "HOME_DEF_STRICT",
      "HGS_LT_1_5",
      "TSA_LT_1",
      "HGS_LT_0_8",
    ],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G2ff58",
    mainPattern: "FF",
    group: 2,
    riders: [
      "WHGS",
      "SAGS",
      "ESHGA",
      "EWAGA",
      "AGS_WEAK",
      "HGA_LEAKY",
      "LOW_OFFENSE",
      "VERY_LOW_OFFENSE",
      "TSB_GT_TSA",
      "LOW_TOTAL_SCORING",
      "TS_TIGHT",
      "HGS_POOR",
      "HGS_WEAK",
      "AGS_GT_HGS",
      "GS_AWAY_LEAN",
      "GS_AWAY_ADV",
      "HGS_LOW_1_2",
      "TSA_WEAK_0_8",
      "HOME_DEF_BETTER",
      "HOME_DEF_STRICT",
      "HGS_LT_1_5",
      "TSA_LT_1",
      "HGS_LT_0_8",
    ],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G3ff58",
    mainPattern: "FF",
    group: 3,
    riders: [
      "WHGS",
      "SAGS",
      "ESHGA",
      "EWAGA",
      "AGS_WEAK",
      "HGA_LEAKY",
      "LOW_OFFENSE",
      "VERY_LOW_OFFENSE",
      "TSB_GT_TSA",
      "LOW_TOTAL_SCORING",
      "TS_TIGHT",
      "HGS_POOR",
      "HGS_WEAK",
      "AGS_GT_HGS",
      "GS_AWAY_LEAN",
      "GS_AWAY_ADV",
      "HGS_LOW_1_2",
      "TSA_WEAK_0_8",
      "HOME_DEF_BETTER",
      "HOME_DEF_STRICT",
      "HGS_LT_1_5",
      "TSA_LT_1",
      "HGS_LT_0_8",
    ],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G1ff56",
    mainPattern: "FF",
    group: 1,
    riders: ["ESHGS", "EWAGS", "WHGA", "SAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G1ff57",
    mainPattern: "FF",
    group: 1,
    riders: ["ESHGS", "EWAGS", "EWHGA", "ESAGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // BANNED: UPSET RISK
  {
    id: "G1e10",
    mainPattern: "E",
    group: 1,
    riders: ["WHGS", "SAGS", "WHGA", "SAGA"],
    prediction: "1",
    primaryPrediction: "1",
  },

  // --- BATCH 33 RULES (NEW AWAY DOMINANCE) ---
  {
    id: "G1ff54",
    mainPattern: "FF",
    group: 1,
    riders: [
      "TS_DIFF_DRAW",
      "TS_AWAY_DOMINANT",
      "AWAY_TS_DOMINANCE_G1",
      "AGA_SOLID",
      "TSB_GT_TSA",
      "TSA_GT_1",
      "AWAY_DEF_BETTER",
      "TSB_SOLID",
      "AGS_GT_HGS",
      "TSA_GT_1_3",
      "GS_AWAY_LEAN",
      "GS_AWAY_ADV",
      "AGS_DECENT_1_0",
      "HGS_LT_1_5",
      "AGA_LT_1_5",
      "HGA_LT_1_5",
    ],
    prediction: "12",
    primaryPrediction: "1",
  },

  // --- BATCH 32 RULES (FF REFINEMENTS) ---
  // Group 1
  {
    id: "G1ff51",
    mainPattern: "FF",
    group: 1,
    riders: ["SHGS", "WAGS", "EWHGA", "ESAGA"],
    prediction: "X2",
    primaryPrediction: "X",
  },
  {
    id: "G1ff52",
    mainPattern: "FF",
    group: 1,
    riders: ["WHGS", "SAGS", "WHGA", "SAGA"],
    prediction: "12",
    primaryPrediction: "2",
  },
  {
    id: "G1ff55",
    mainPattern: "FF",
    group: 1,
    riders: ["SHGS", "WAGS", "ESHGA", "EWAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G1ff53",
    mainPattern: "FF",
    group: 1,
    riders: ["EWHGS", "ESAGS", "ESHGA", "EWAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },
  // Group 2
  {
    id: "G2ff56",
    mainPattern: "FF",
    group: 2,
    riders: ["WHGS", "SAGS", "WHGA", "SAGA"],
    prediction: "X2",
    primaryPrediction: "2",
  },
  {
    id: "G2ff57",
    mainPattern: "FF",
    group: 2,
    riders: ["SHGS", "WAGS", "ESHGA", "EWAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // BANNED: UPSET RISK
  {
    id: "G2ff51",
    mainPattern: "FF",
    group: 2,
    riders: ["SHGS", "WAGS", "EWHGA", "ESAGA"],
    prediction: "12",
    primaryPrediction: "2",
  },
  {
    id: "G2ff52",
    mainPattern: "FF",
    group: 2,
    riders: ["ESHGS", "EWAGS", "WHGA", "SAGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // BANNED: UPSET RISK
  {
    id: "G2ff53",
    mainPattern: "FF",
    group: 2,
    riders: ["EWHGS", "ESAGS", "ESHGA", "EWAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },
  // Group 3
  {
    id: "G3ff56",
    mainPattern: "FF",
    group: 3,
    riders: ["WHGS", "SAGS", "WHGA", "SAGA"],
    prediction: "12",
    primaryPrediction: "2",
  },
  {
    id: "G3ff57",
    mainPattern: "FF",
    group: 3,
    riders: ["SHGS", "WAGS", "ESHGA", "EWAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G3ff51",
    mainPattern: "FF",
    group: 3,
    riders: ["SHGS", "WAGS", "EWHGA", "ESAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G3ff52",
    mainPattern: "FF",
    group: 3,
    riders: ["ESHGS", "EWAGS", "WHGA", "SAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G3ff53",
    mainPattern: "FF",
    group: 3,
    riders: ["EWHGS", "ESAGS", "ESHGA", "EWAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },

  // --- BATCH 29 RULES (SELF LEARNING REFINEMENT) ---
  // Group 1
  {
    id: "G1r17",
    mainPattern: "R",
    group: 1,
    riders: ["AWAY_DEF_BETTER", "GS_HOME_ADV"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G1r20",
    mainPattern: "R",
    group: 1,
    riders: ["AWAY_DEF_BETTER", "GS_AWAY_ADV"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G1t3",
    mainPattern: "T",
    group: 1,
    riders: ["HOME_DEF_STRICT"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G1N1",
    mainPattern: "N",
    group: 1,
    riders: ["H_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G2N1",
    mainPattern: "N",
    group: 2,
    riders: ["H_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G3N1",
    mainPattern: "N",
    group: 3,
    riders: ["H_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G1s16",
    mainPattern: "S",
    group: 1,
    riders: ["TSB_GT_TSA"],
    prediction: "12",
    primaryPrediction: "1",
  },

  // Group 2
  {
    id: "G2ee22",
    mainPattern: "EE",
    group: 2,
    riders: ["EWHGS", "ESAGS", "EWHGA", "ESAGA"],
    prediction: "12",
    primaryPrediction: "2",
  },
  {
    id: "G2ff45",
    mainPattern: "FF",
    group: 2,
    riders: ["SHGS", "WAGS", "WHGA", "SAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G2t7",
    mainPattern: "T",
    group: 2,
    riders: ["TSA_LT_1"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  // S-G2-03 UPDATED (Batch 30: id correction to match prompt G2-S-03 mapping)
  {
    id: "G2s27",
    mainPattern: "S",
    group: 2,
    riders: ["HGS_WEAK"],
    prediction: "1X",
    primaryPrediction: "X",
  },
  {
    id: "G2r8",
    mainPattern: "R",
    group: 2,
    riders: ["GS_AWAY_ADV"],
    prediction: "12",
    primaryPrediction: "2",
  },
  {
    id: "G2u11",
    mainPattern: "U",
    group: 2,
    riders: ["AGA_LT_1_5"],
    prediction: "X2",
    primaryPrediction: "X",
  },

  // Group 3
  {
    id: "G3s16",
    mainPattern: "S",
    group: 3,
    riders: ["WHGA", "SAGA", "ESHGS", "EWAGS"],
    prediction: "12",
    primaryPrediction: "1",
  },
  // G3-T-01 UPDATED (Batch 30)
  {
    id: "G3t12",
    mainPattern: "T",
    group: 3,
    riders: [],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G3r13",
    mainPattern: "R",
    group: 3,
    riders: ["GS_TIGHT"],
    prediction: "12",
    primaryPrediction: "1",
  }, // Banned: draw risk
  // G3-U-05 UPDATED (Batch 30)
  {
    id: "G3u16",
    mainPattern: "U",
    group: 3,
    riders: ["HGA_LT_1_5"],
    prediction: "12",
    primaryPrediction: "1",
  },

  // --- GENIUS SUB PATTERNS (BATCH 28 - SELF LEARNING CREATOR) ---
  // Group 1
  // R-G1-01 UPDATED (Batch 30)
  {
    id: "G1r18",
    mainPattern: "R",
    group: 1,
    riders: ["TSA_GT_1_3", "GS_NEAR_EQUAL"],
    prediction: "12",
    primaryPrediction: "1",
  },
  // T-G1-02 UPDATED (Batch 30)
  {
    id: "G1t4",
    mainPattern: "T",
    group: 1,
    riders: ["AWAY_DEF_BETTER", "GS_EXACT_EQUAL"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G1t4b",
    mainPattern: "T",
    group: 1,
    riders: ["GA_EXACT_EQUAL", "GS_EXACT_EQUAL"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  // S-G1-03 UPDATED (Batch 30)
  {
    id: "G1s17",
    mainPattern: "S",
    group: 1,
    riders: ["HGS_GOOD"],
    prediction: "1X",
    primaryPrediction: "X",
  },
  // U-G1-05 UPDATED (Batch 30)
  {
    id: "G1u6",
    mainPattern: "U",
    group: 1,
    riders: ["TSB_GT_TSA"],
    prediction: "1X",
    primaryPrediction: "1",
  },

  // Group 2
  // T-G2-01 UPDATED (Batch 30)
  {
    id: "G2t8",
    mainPattern: "T",
    group: 2,
    riders: ["GS_AWAY_LEAN"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G2u12",
    mainPattern: "U",
    group: 2,
    riders: ["GS_AWAY_ADV"],
    prediction: "1X",
    primaryPrediction: "2",
  },
  {
    id: "G2s28",
    mainPattern: "S",
    group: 2,
    riders: ["HGA_LEAKY"],
    prediction: "1X",
    primaryPrediction: "X",
  },
  {
    id: "G2r9",
    mainPattern: "R",
    group: 2,
    riders: ["HGS_GOOD"],
    prediction: "1",
    primaryPrediction: "1",
  },

  // Group 3
  {
    id: "G3t13",
    mainPattern: "T",
    group: 3,
    riders: ["HGS_LOW_1_2"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G3r14",
    mainPattern: "R",
    group: 3,
    riders: ["TSA_WEAK_0_8"],
    prediction: "X2",
    primaryPrediction: "2",
  },
  {
    id: "G3u17",
    mainPattern: "U",
    group: 3,
    riders: ["AWAY_DEF_BETTER"],
    prediction: "12",
    primaryPrediction: "1",
  },
  // S-G3-05 UPDATED (Batch 30)
  {
    id: "G3s15",
    mainPattern: "S",
    group: 3,
    riders: ["AGS_DECENT_1_0"],
    prediction: "12",
    primaryPrediction: "2",
  },

  // --- NEW GENIUS PATTERNS (BATCH 27 - GENIUS STRATEGY) ---
  // Group 1
  {
    id: "G1t01",
    mainPattern: "T",
    group: 1,
    riders: ["GS_STALEMATE"],
    prediction: "12",
    primaryPrediction: "2",
  },
  // G1r02 UPDATED (Batch 30)
  {
    id: "G1r02",
    mainPattern: "R",
    group: 1,
    riders: ["TSA_HIGH"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G1s03",
    mainPattern: "S",
    group: 1,
    riders: ["HGS_ELITE"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G1u05",
    mainPattern: "U",
    group: 1,
    riders: ["AGS_STRONG"],
    prediction: "1X",
    primaryPrediction: "1",
  },

  // Group 2
  // G2t06 UPDATED (Batch 30)
  {
    id: "G2t06",
    mainPattern: "T",
    group: 2,
    riders: ["HGS_GOOD"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G2r07",
    mainPattern: "R",
    group: 2,
    riders: ["AWAY_DEF_BETTER"],
    prediction: "X2",
    primaryPrediction: "X",
  },
  // G2s08 UPDATED (Batch 30)
  {
    id: "G2s08",
    mainPattern: "S",
    group: 2,
    riders: ["TSB_GT_TSA"],
    prediction: "12",
    primaryPrediction: "2",
  },
  {
    id: "G2u10",
    mainPattern: "U",
    group: 2,
    riders: ["HGS_WEAK"],
    prediction: "X2",
    primaryPrediction: "X",
  },

  // Group 3
  {
    id: "G3t11",
    mainPattern: "T",
    group: 3,
    riders: ["LOW_TOTAL_SCORING"],
    prediction: "X",
    primaryPrediction: "X",
  },
  {
    id: "G3r12",
    mainPattern: "R",
    group: 3,
    riders: ["HGA_LEAKY"],
    prediction: "12",
    primaryPrediction: "2",
  },
  {
    id: "G3s13",
    mainPattern: "S",
    group: 3,
    riders: ["TSB_SOLID"],
    prediction: "X2",
    primaryPrediction: "2",
  },
  {
    id: "G3u15",
    mainPattern: "U",
    group: 3,
    riders: ["AGS_GT_HGS"],
    prediction: "X2",
    primaryPrediction: "2",
  },

  // --- NEW FIXES (BATCH 25) ---
  // G1 I Fix (Bangkok Utd) - UPDATED G1i18 (Batch 30)
  {
    id: "G1i18",
    mainPattern: "I",
    group: 1,
    riders: ["SHGA", "SAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED: user req
  // G2 O Fix (Aswan SC) - UPDATED G2o18 (Batch 30)
  {
    id: "G2o18",
    mainPattern: "O",
    group: 2,
    riders: ["EWHGS", "ESAGS", "WHGA", "SAGA", "A_BAL"],
    prediction: "12",
    primaryPrediction: "2",
  },

  // --- GENIUS SUB PATTERNS (BATCH 24) ---
  // G1 R High-Velocity Home Win - UPDATED G1r1_new (Batch 30)
  {
    id: "G1r19",
    mainPattern: "R",
    group: 1,
    riders: ["BOTH_HIGH_SCORING"],
    prediction: "12",
    primaryPrediction: "1",
  },
  // G3 T Low-Scoring Deadlock
  {
    id: "G3t14",
    mainPattern: "T",
    group: 3,
    riders: ["VERY_LOW_OFFENSE"],
    prediction: "X",
    primaryPrediction: "X",
  },
  // G1 FF Defensive Collapse
  {
    id: "G1ff43",
    mainPattern: "FF",
    group: 1,
    riders: ["EWHGS", "ESAGS", "EWHGA", "ESAGA"],
    prediction: "12",
    primaryPrediction: "2",
  }, // Banned: UPSET RISK
  // G1 FF Mismatch Banker (Away)
  {
    id: "G1ff47",
    mainPattern: "FF",
    group: 1,
    riders: ["WHGS", "SAGS", "SHGA", "WAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G1ff48",
    mainPattern: "FF",
    group: 1,
    riders: ["ESHGS", "EWAGS", "ESHGA", "EWAGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPSET risk
  {
    id: "G2ff48",
    mainPattern: "FF",
    group: 2,
    riders: ["ESHGS", "EWAGS", "ESHGA", "EWAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G3ff48",
    mainPattern: "FF",
    group: 3,
    riders: ["ESHGS", "EWAGS", "ESHGA", "EWAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G2ff38",
    mainPattern: "FF",
    group: 2,
    riders: ["ESHGS", "EWAGS", "ESHGA", "EWAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G3ff38",
    mainPattern: "FF",
    group: 3,
    riders: ["ESHGS", "EWAGS", "ESHGA", "EWAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  // BATCH 31 (Pruned from user request)
  {
    id: "G1ff49",
    mainPattern: "FF",
    group: 1,
    riders: ["EWHGS", "ESAGS", "SHGA", "WAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G2ff49",
    mainPattern: "FF",
    group: 2,
    riders: ["EWHGS", "ESAGS", "SHGA", "WAGA"],
    prediction: "12",
    primaryPrediction: "2",
  }, // BANNED: UPSET RISK
  {
    id: "G3ff49",
    mainPattern: "FF",
    group: 3,
    riders: ["EWHGS", "ESAGS", "SHGA", "WAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G1ff50",
    mainPattern: "FF",
    group: 1,
    riders: ["SHGS", "WAGS", "SHGA", "WAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G2ff50",
    mainPattern: "FF",
    group: 2,
    riders: ["SHGS", "WAGS", "SHGA", "WAGA"],
    prediction: "1",
    primaryPrediction: "1",
  },
  {
    id: "G3ff50",
    mainPattern: "FF",
    group: 3,
    riders: ["SHGS", "WAGS", "SHGA", "WAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },

  // --- NEW PATTERNS (BATCH 23 - SELF LEARNING) ---
  // The 'R' Pattern Defensive Lock
  {
    id: "G2r2",
    mainPattern: "R",
    group: 2,
    riders: ["EWHGA"],
    prediction: "12",
  }, // EWHGA matches DiffGA > 0.5
  // The 'T' Pattern Low-Scoring Draw
  {
    id: "G3t2",
    mainPattern: "T",
    group: 3,
    riders: ["LOW_OFFENSE"],
    prediction: "X",
  },
  // Away Dominance in 'S' Pattern
  {
    id: "G2s26",
    mainPattern: "S",
    group: 2,
    riders: ["EWHGS"],
    prediction: "2",
  }, // EWHGS matches DiffGS < -0.5
  // Defensive Mismatch Indicator (General - mapped to F for Group 2)
  {
    id: "G2f25",
    mainPattern: "F",
    group: 2,
    riders: ["DEF_MISMATCH"],
    prediction: "2",
  },

  // --- NEW PATTERNS (BATCH 21 - Image Corrective) ---
  // G2 S (Barwell/Gicumbi Fix)
  {
    id: "G2s25",
    mainPattern: "S",
    group: 2,
    riders: ["WHGA", "SAGA", "H_BAL", "A_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  // G3 H (KV Mechelen)
  {
    id: "G3h1",
    mainPattern: "H",
    group: 3,
    riders: ["SHGS", "WAGS", "H_BAL", "A_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  },

  // --- NEW PATTERNS (BATCH 20 - Image Analysis II) ---
  // G1 O (Wigan - Away Dominance)
  // G1o20 UPDATED: prim 2 fin X2 based on similar request to G1o4
  {
    id: "G1o20",
    mainPattern: "O",
    group: 1,
    riders: ["EWHGS", "ESAGS", "ESHGA", "EWAGA", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  },
  // G1 O (Estoril - Home Dominance)
  {
    id: "G1o21",
    mainPattern: "O",
    group: 1,
    riders: ["ESHGS", "EWAGS", "EWHGA", "ESAGA", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  },

  // G2 S (Nof Hagalil - Draw Potential with Legacy)
  {
    id: "G2s22",
    mainPattern: "S",
    group: 2,
    riders: ["SHGA", "WAGA", "H_BAL", "A_BAL", "P1", "P2", "P5"],
    prediction: "12",
    primaryPrediction: "2",
  },
  // G2 S (Kortrijk - Home Win, Clean Flags)
  // UPDATED: G2s21 -> 1X (prim X)
  {
    id: "G2s21",
    mainPattern: "S",
    group: 2,
    riders: ["SHGA", "WAGA", "H_BAL", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  },

  // G2 S (Valencia - Home Win with Legacy)
  {
    id: "G2s23",
    mainPattern: "S",
    group: 2,
    riders: ["SHGS", "WAGS", "H_BAL", "A_BAL", "P1", "P2", "P5"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  // G2 S (Valencia - General - derived)
  {
    id: "G2s24",
    mainPattern: "S",
    group: 2,
    riders: ["SHGS", "WAGS", "H_BAL", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req

  // --- NEW PATTERNS (BATCH 18 - Image Analysis) ---
  // G1 O - Strong Home & TSB_1 Combinations
  {
    id: "G1g14",
    mainPattern: "G",
    group: 1,
    riders: [
      "ESHGS",
      "EWAGS",
      "ESHGA",
      "EWAGA",
      "TSB_1",
      "TS_DIFF_DRAW",
      "TS_HOME_STRONG",
      "A_BAL",
    ],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  // Deleted redundant O patterns
  {
    id: "G1o16",
    mainPattern: "O",
    group: 1,
    riders: [
      "EWHGS",
      "ESAGS",
      "ESHGA",
      "EWAGA",
      "TSB_1",
      "TS_DIFF_DRAW",
      "TS_HOME_STRONG",
      "A_BAL",
    ],
    prediction: "1X",
    primaryPrediction: "X",
  }, // Barito Putera
  {
    id: "G1o18",
    mainPattern: "O",
    group: 1,
    riders: [
      "ESHGS",
      "EWAGS",
      "ESHGA",
      "EWAGA",
      "TS_DIFF_DRAW",
      "TS_HOME_STRONG",
      "A_BAL",
    ],
    prediction: "1X",
    primaryPrediction: "1",
  }, // BANNED: DRAW RISK
  {
    id: "G1o19",
    mainPattern: "O",
    group: 1,
    riders: [
      "ESHGS",
      "EWAGS",
      "ESHGA",
      "EWAGA",
      "TS_DIFF_DRAW",
      "TS_HOME_STRONG",
      "A_BAL",
    ],
    prediction: "1",
  }, // Olympiakos
  // UPDATED G1o12: prim 1 fin 1X
  {
    id: "G1o12",
    mainPattern: "O",
    group: 1,
    riders: ["ESHGS", "EWAGS", "SHGA", "WAGA", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  },

  // G1 S - High Scoring Draws & Home Wins
  {
    id: "G1s11",
    mainPattern: "S",
    group: 1,
    riders: ["SHGS", "WAGS", "WHGA", "SAGA", "H_BAL", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G1s12",
    mainPattern: "S",
    group: 1,
    riders: ["ESHGS", "EWAGS", "EWHGA", "ESAGA", "H_BAL", "A_BAL"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED
  {
    id: "G1s13",
    mainPattern: "S",
    group: 1,
    riders: ["ESHGS", "EWAGS", "EWHGA", "ESAGA", "TSB_1", "H_BAL", "A_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G1s14",
    mainPattern: "S",
    group: 1,
    riders: ["ESHGS", "EWAGS", "EWHGA", "ESAGA", "H_BAL", "A_BAL"],
    prediction: "1X",
  }, // Lecce U20
  // UPDATED G1s15 -> X2 (prim X)
  {
    id: "G1s15",
    mainPattern: "S",
    group: 1,
    riders: ["SHGA", "WAGA", "H_BAL", "A_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  },

  // G1 HH
  {
    id: "G1hh2",
    mainPattern: "HH",
    group: 1,
    riders: ["ESHGA", "EWAGA", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // Stuttgart

  // G2 EE - Mixed Results
  {
    id: "G2ee15",
    mainPattern: "EE",
    group: 2,
    riders: ["ESHGS", "EWAGS", "ESHGA", "EWAGA", "TS_DIFF_DRAW"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G2ee16",
    mainPattern: "EE",
    group: 2,
    riders: ["ESHGS", "EWAGS", "ESHGA", "EWAGA", "TS_DIFF_DRAW"],
    prediction: "12",
  }, // Sabail (Upset 2)
  {
    id: "G2ee18",
    mainPattern: "EE",
    group: 2,
    riders: ["ESHGS", "EWAGS", "ESHGA", "EWAGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // Macclesfield
  {
    id: "G2ee19",
    mainPattern: "EE",
    group: 2,
    riders: ["ESHGS", "EWAGS", "ESHGA", "EWAGA", "TS_DIFF_DRAW"],
    prediction: "2",
  }, // Guilsfield
  // UPDATED G2ee14 -> 12 (prim 2)
  {
    id: "G2ee14",
    mainPattern: "EE",
    group: 2,
    riders: ["EWHGS", "ESAGS", "EWHGA", "ESAGA", "UPSET", "TS_DIFF_DRAW"],
    prediction: "X2",
    primaryPrediction: "2",
  },
  {
    id: "G2ee20",
    mainPattern: "EE",
    group: 2,
    riders: ["ESHGS", "EWAGS", "ESHGA", "EWAGA", "TS_DIFF_DRAW"],
    prediction: "X",
  }, // NagaWorld
  {
    id: "G2ee21",
    mainPattern: "EE",
    group: 2,
    riders: ["ESHGS", "EWAGS", "ESHGA", "EWAGA", "TS_DIFF_DRAW"],
    prediction: "X",
  }, // AZ Alkmaar

  // G2 L
  {
    id: "G2l3",
    mainPattern: "L",
    group: 2,
    riders: ["EWHGS", "ESAGS", "TS_DIFF_DRAW"],
    prediction: "12",
    primaryPrediction: "2",
  }, // Bidco
  {
    id: "G2l4",
    mainPattern: "L",
    group: 2,
    riders: ["ESHGS", "EWAGS"],
    prediction: "12",
    primaryPrediction: "1",
  }, // Al Ahli -> UPDATED
  {
    id: "G2l5",
    mainPattern: "L",
    group: 2,
    riders: ["EWHGS", "ESAGS"],
    prediction: "1X",
    primaryPrediction: "X",
  }, // Girona

  // G2 S
  {
    id: "G2s29",
    mainPattern: "S",
    group: 2,
    riders: ["WHGS", "SAGS", "ESHGA", "EWAGA", "H_BAL", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // NEW: 4-flag capture
  {
    id: "G2s16",
    mainPattern: "S",
    group: 2,
    riders: ["WHGS", "SAGS", "H_BAL", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G2s17",
    mainPattern: "S",
    group: 2,
    riders: ["WHGS", "SAGS", "H_BAL", "A_BAL"],
    prediction: "1",
  }, // Whitehawk
  {
    id: "G2s18",
    mainPattern: "S",
    group: 2,
    riders: ["ESHGS", "EWAGS", "H_BAL", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req
  {
    id: "G2s19",
    mainPattern: "S",
    group: 2,
    riders: ["WHGS", "SAGS", "SHGA", "WAGA", "TSB_1", "H_BAL", "A_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // Stoke
  {
    id: "G2s20",
    mainPattern: "S",
    group: 2,
    riders: ["WHGS", "SAGS", "SHGA", "WAGA", "H_BAL", "A_BAL"],
    prediction: "12",
    primaryPrediction: "2",
  }, // Smouha

  // G2 HH - UPDATED G2hh2 (Batch 30)
  {
    id: "G2hh2",
    mainPattern: "HH",
    group: 2,
    riders: ["EWHGA", "ESAGA", "A_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G2hh3",
    mainPattern: "HH",
    group: 2,
    riders: ["EWHGA", "ESAGA", "A_BAL"],
    prediction: "12",
  }, // Atletic L

  // G2 AA
  {
    id: "G2aa5",
    mainPattern: "AA",
    group: 2,
    riders: ["SHGS", "WAGS", "ESHGA", "EWAGA", "TS_DIFF_DRAW", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G2aa6",
    mainPattern: "AA",
    group: 2,
    riders: ["SHGS", "WAGS", "ESHGA", "EWAGA", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // Aarhus

  // G3 S
  {
    id: "G3s7",
    mainPattern: "S",
    group: 3,
    riders: ["ESHGS", "EWAGS", "EWHGA", "ESAGA", "H_BAL", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // Dender

  // --- NEW PATTERNS (BATCH 17 - System Refinements) ---
  // G2-O-11 Home Strong Safety (Specific Riders Updated)
  {
    id: "G2o11",
    mainPattern: "O",
    group: 2,
    riders: ["ESHGS", "EWAGS", "SHGA", "WAGA", "TS_HOME_STRONG", "A_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  // G2-I-13 Away Resilience (Updated Riders) - Batch 21 Update to 2
  // UPDATED: G2i13 -> 12 (prim 2)
  {
    id: "G2i13",
    mainPattern: "I",
    group: 2,
    riders: ["EWHGS", "ESAGS", "EWHGA", "ESAGA"],
    prediction: "X2",
    primaryPrediction: "2",
  }, // UPDATED
  {
    id: "G1j14",
    mainPattern: "J",
    group: 1,
    riders: ["WHGA", "SAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },

  // --- NEW PATTERNS (BATCH 16 - System Analysis) ---
  // G1 J Pattern Emergence (TS_DIFF_DRAW correction)
  {
    id: "G1j13",
    mainPattern: "J",
    group: 1,
    riders: ["WHGA", "SAGA", "TS_DIFF_DRAW"],
    prediction: "X2",
    primaryPrediction: "2",
  },
  // G1 J Reliability Fix (Batch 8 Update) -> 12
  // UPDATED G1j3_fix -> 1X (prim 1)
  {
    id: "G1j15",
    mainPattern: "J",
    group: 1,
    riders: ["SHGA", "WAGA", "TS_HOME_STRONG"],
    prediction: "12",
    primaryPrediction: "1",
  }, // BANNED: DRAW RISK
  // G2 EE Optimization (Volatile cluster coverage)
  {
    id: "G2ee3",
    mainPattern: "EE",
    group: 2,
    riders: ["EWHGS", "ESAGS", "WHGA", "SAGA"],
    prediction: "12",
    primaryPrediction: "2",
  },
  // G1-EE-3 update
  // G3 J Consistency
  {
    id: "G3j11",
    mainPattern: "J",
    group: 3,
    riders: ["SHGA", "WAGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // BANNED: UPSET RISK
  // G3 R Split Analysis (High confidence segment)
  {
    id: "G3r5",
    mainPattern: "R",
    group: 3,
    riders: ["A_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  // G3 R Volatility Hedge (Batch 8 Update) -> X2 - Batch 21 Update to 1X
  {
    id: "G3r6",
    mainPattern: "R",
    group: 3,
    riders: [],
    prediction: "X2",
    primaryPrediction: "2",
  }, // UPDATED: Batch 21 Risk Management
  // G2 FF Dominance Shift
  // G1 Q Scoring Trend (Confirmed) (Matches G1-Q-17 Refinement)
  {
    id: "G1q17",
    mainPattern: "Q",
    group: 1,
    riders: ["SHGA", "WAGA", "TSB_1", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  },
  // G2 M Stability (Confirmed) (Matches G2-M-14 Refinement)
  {
    id: "G2m14",
    mainPattern: "M",
    group: 2,
    riders: ["SHGA", "WAGA", "H_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: Batch 19 Draw Weighting
  // G1 F Strong Any Win (Specific riders) - (Batch 8 Update) -> 12 (Correct)
  {
    id: "G1f31",
    mainPattern: "F",
    group: 1,
    riders: ["EWHGS", "ESAGS", "EWHGA", "ESAGA", "TS_DIFF_DRAW", "H_BAL"],
    prediction: "12",
    primaryPrediction: "2",
  }, // BANNED: UPSET RISK
  // New G1 F Subpattern (G1f32) - UPDATED
  {
    id: "G1f32",
    mainPattern: "F",
    group: 1,
    riders: ["EWHGS", "ESAGS", "WHGA", "SAGA", "TS_DIFF_DRAW", "P5"],
    prediction: "X2",
    primaryPrediction: "2",
  }, // UPDATED: user req

  // G2 Q Home Strength (Perfect sub-pattern)
  {
    id: "G2q10",
    mainPattern: "Q",
    group: 2,
    riders: [
      "ESHGA",
      "EWAGA",
      "POTENTIAL_DRAW",
      "TS_DIFF_DRAW",
      "TS_HOME_STRONG",
      "A_BAL",
    ],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G2ff43",
    mainPattern: "FF",
    group: 2,
    riders: ["EWHGS", "ESAGS", "EWHGA", "ESAGA"],
    prediction: "12",
    primaryPrediction: "2",
  },
  // G1 P High Confidence
  {
    id: "G1p4",
    mainPattern: "P",
    group: 1,
    riders: ["SHGS", "WAGS", "A_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // BANNED: UPSET RISK
  // G2 EE Home Strong (Matches G2-EE-11 Refinement)
  {
    id: "G2ee11",
    mainPattern: "EE",
    group: 2,
    riders: [
      "ESHGS",
      "EWAGS",
      "ESHGA",
      "EWAGA",
      "TS_DIFF_DRAW",
      "TS_HOME_STRONG",
    ],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  // G2 O A_BAL Precision (Confirmed)
  // UPDATED G2o10 -> 12 (prim 1)
  {
    id: "G2o10",
    mainPattern: "O",
    group: 2,
    riders: ["SHGA", "A_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED: user req

  // --- NEW PATTERNS (BATCH 15) ---
  // G1 KK Perugia vs Bra
  {
    id: "G1kk1",
    mainPattern: "KK",
    group: 1,
    riders: ["P1", "P2", "P5"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  // G2 E Al Ahli Doha
  { id: "G2e15", mainPattern: "E", group: 2, riders: ["P5"], prediction: "1" },
  // G3 I Bahrain SC
  {
    id: "G3i7",
    mainPattern: "I",
    group: 3,
    riders: [],
    prediction: "12",
    primaryPrediction: "2",
  },

  // --- NEW PATTERNS (BATCH 14) ---
  {
    id: "G3o9",
    mainPattern: "O",
    group: 3,
    riders: ["A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  // G2 P Pure A_BAL Trend (UPDATED) - User Update
  {
    id: "G2p12",
    mainPattern: "P",
    group: 2,
    riders: ["EWHGS", "ESAGS", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req
  // G1 Q Home Strong Validation
  // UPDATED G1q16 -> 12
  {
    id: "G1q16",
    mainPattern: "Q",
    group: 1,
    riders: ["ESHGA", "EWAGA", "TS_HOME_STRONG", "A_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  // G2 FF Home Strong Dominance (UPDATED)
  // G1 R Generic Hedge (UPDATED) - UPDATED G1r16 (Batch 30)
  {
    id: "G1r16",
    mainPattern: "R",
    group: 1,
    riders: [],
    prediction: "12",
    primaryPrediction: "1",
  },
  // G3 P Away Balance Bias
  // G3p5 UPDATED
  {
    id: "G3p5",
    mainPattern: "P",
    group: 3,
    riders: ["WHGS", "SAGS", "A_BAL"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED Batch 30
  // G2 FF Mixed Flags Hedge
  {
    id: "G2ff44",
    mainPattern: "FF",
    group: 2,
    riders: ["WHGS", "SAGS", "EWHGA", "ESAGA"],
    prediction: "12",
    primaryPrediction: "2",
  },
  // G3 FF Draw Bias
  {
    id: "G3ff45",
    mainPattern: "FF",
    group: 3,
    riders: ["SHGS", "WAGS", "WHGA", "SAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  },

  // --- NEW PATTERNS (BATCH 13 - CRITICAL UPDATES) ---
  // G1 G Home Strong Upset Correction
  {
    id: "G1g21",
    mainPattern: "G",
    group: 1,
    riders: ["EWHGS", "ESAGS", "TS_HOME_STRONG"],
    prediction: "12",
    primaryPrediction: "2",
  },
  // G2 Q Away Balance Shift (Batch 8 Update) -> X2
  {
    id: "G2q15",
    mainPattern: "Q",
    group: 2,
    riders: ["EWHGA", "ESAGA", "A_BAL"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED: Batch 19 Correction
  // G1 EE Home Robustness (UPDATED G1e8 mapping)
  {
    id: "G1ee8",
    mainPattern: "EE",
    group: 1,
    riders: ["SHGS", "WAGS"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G1ee11",
    mainPattern: "EE",
    group: 1,
    riders: [
      "ESHGS",
      "EWAGS",
      "WHGA",
      "SAGA",
      "TS_HOME_STRONG",
      "HGS_STRONG",
      "HGS_ABOVE_AVG",
      "AGA_SOLID",
      "HIGH_TOTAL_SCORING",
      "GS_HOME_ADV",
      "TSA_HIGH",
      "TSA_GT_1",
      "TS_TIGHT",
      "HGS_ELITE",
      "HGS_GOOD",
      "AWAY_DEF_BETTER",
      "TSB_SOLID",
      "TSA_GT_1_3",
      "GS_NEAR_EQUAL",
      "AGS_DECENT_1_0",
      "GS_HOME_DOMINANT_1",
      "AGA_LT_1_5",
      "HGA_LT_1_5",
    ],
    prediction: "12",
    primaryPrediction: "2",
  },
  // G2 E Balanced Away Trend (Batch 8 Update) -> X2
  // UPDATED G2e14 -> 12 (prim 2)
  {
    id: "G2e14",
    mainPattern: "E",
    group: 2,
    riders: ["WHGS", "SAGS", "WHGA", "SAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  // --- NEW FROM IMAGES (Group 3) ---
  // G3 I (Nacional)
  {
    id: "G3i5",
    mainPattern: "I",
    group: 3,
    riders: ["ESHGS", "EWAGS", "P2"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  // G3 I (TSV Havelse) - UPDATED G3i6 (Batch 30)
  {
    id: "G3i6",
    mainPattern: "I",
    group: 3,
    riders: ["SHGS", "WAGS", "P2"],
    prediction: "12",
    primaryPrediction: "1",
  },

  // G3 S (Gorilla)
  {
    id: "G3s4",
    mainPattern: "S",
    group: 3,
    riders: ["EWHGS", "ESAGS", "ESHGA", "EWAGA", "H_BAL", "A_BAL", "P3"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  // G3 S (KV Mechelen)
  {
    id: "G3s5",
    mainPattern: "S",
    group: 3,
    riders: ["EWHGS", "ESAGS", "ESHGA", "EWAGA", "H_BAL", "A_BAL", "P2"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  // G3 S (El Mokawloon)
  {
    id: "G3s6",
    mainPattern: "S",
    group: 3,
    riders: [
      "SHGS",
      "WAGS",
      "WHGA",
      "SAGA",
      "H_BAL",
      "A_BAL",
      "P1",
      "P2",
      "P5",
    ],
    prediction: "1X",
  },

  // G3 F (Egypt)
  {
    id: "G3f16",
    mainPattern: "F",
    group: 3,
    riders: ["SHGA", "WAGA", "H_BAL", "P2"],
    prediction: "12",
    primaryPrediction: "1",
  },

  // G3 O (Virtus Verona)
  {
    id: "G3o8",
    mainPattern: "O",
    group: 3,
    riders: ["EWHGS", "ESAGS", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED

  // --- NEW PATTERNS (BATCH 12 - G1 UPDATES) ---
  // G1 F (SHGS, WHGA -> X) (UPDATED G1f30)
  {
    id: "G1f30",
    mainPattern: "F",
    group: 1,
    riders: ["SHGS", "WHGA"],
    prediction: "12",
    primaryPrediction: "1",
  },

  // G1 LL (SHGA -> 2)
  {
    id: "G1ll2",
    mainPattern: "LL",
    group: 1,
    riders: ["SHGA"],
    prediction: "2",
  },

  // G1 G (Specific Riders)
  {
    id: "G1g18",
    mainPattern: "G",
    group: 1,
    riders: ["P7"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G1g19",
    mainPattern: "G",
    group: 1,
    riders: ["P2"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req
  {
    id: "G1g20",
    mainPattern: "G",
    group: 1,
    riders: ["P1"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED

  // G1 GG
  {
    id: "G1gg1",
    mainPattern: "GG",
    group: 1,
    riders: [],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED

  // G1 II
  {
    id: "G1ii3",
    mainPattern: "II",
    group: 1,
    riders: ["P2"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  { id: "G1ii2", mainPattern: "II", group: 1, riders: [], prediction: "12", primaryPrediction: "1" },

  // G1 JJ (UPDATED G1jj1 mapping)
  {
    id: "G1jj1",
    mainPattern: "JJ",
    group: 1,
    riders: ["SHGS", "WAGS", "A_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G1jj2",
    mainPattern: "JJ",
    group: 1,
    riders: [],
    prediction: "12",
    primaryPrediction: "1",
  },

  // --- MM and NN Patterns (All Groups) ---
  {
    id: "G1mm1",
    mainPattern: "MM",
    group: 1,
    riders: [],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  { id: "G2mm1", mainPattern: "MM", group: 2, riders: [], prediction: "X" },
  {
    id: "G3mm1",
    mainPattern: "MM",
    group: 3,
    riders: [],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED: Batch 22 Risk

  {
    id: "G1nn1",
    mainPattern: "NN",
    group: 1,
    riders: [],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req
  { id: "G2nn1", mainPattern: "NN", group: 2, riders: [], prediction: "X" },
  {
    id: "G3nn1",
    mainPattern: "NN",
    group: 3,
    riders: [],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED

  // --- NEW PATTERNS (BATCH 12) ---
  // G2 JJ
  {
    id: "G2jj2",
    mainPattern: "JJ",
    group: 2,
    riders: ["ESHGS", "EWAGS", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  // G2 I
  // G2-I-19 Updated in Batch 17
  {
    id: "G2i17",
    mainPattern: "I",
    group: 2,
    riders: ["EWHGS", "ESAGS", "UPSET", "TS_DIFF_DRAW"],
    prediction: "X2",
    primaryPrediction: "X",
  }, // UPDATED
  // UPDATED G2i18: prim 1 fin 1X
  {
    id: "G2i18",
    mainPattern: "I",
    group: 2,
    riders: ["ESHGA", "EWAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  // G2i15
  {
    id: "G2i15",
    mainPattern: "I",
    group: 2,
    riders: ["EWHGS", "ESAGS", "WHGA", "SAGA", "TS_DIFF_DRAW"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED
  // G2 M (UPDATED M [EWHGA,ESAGA,H_BAL,POTENTIAL_DRAW] -> X2)
  {
    id: "G2m11",
    mainPattern: "M",
    group: 2,
    riders: ["EWHGA", "ESAGA", "H_BAL", "POTENTIAL_DRAW"],
    prediction: "X2",
    primaryPrediction: "X",
  },
  {
    id: "G2m13",
    mainPattern: "M",
    group: 2,
    riders: ["H_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req
  // G2 E
  {
    id: "G2e13",
    mainPattern: "E",
    group: 2,
    riders: ["EWHGS", "ESAGS", "TS_DIFF_DRAW"],
    prediction: "2",
  },
  // G2-EE-13 High Scoring Coverage (Matches G2-EE-13 Refinement)
  {
    id: "G2ee13",
    mainPattern: "EE",
    group: 2,
    riders: ["ESHGS", "EWAGS", "SHGA", "WAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G2e11",
    mainPattern: "E",
    group: 2,
    riders: ["EWHGS", "ESAGS", "WHGA", "SAGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: Batch 22 Decisive
  {
    id: "G2e12",
    mainPattern: "E",
    group: 2,
    riders: ["EWHGS", "ESAGS"],
    prediction: "1",
  },
  {
    id: "G2e10",
    mainPattern: "E",
    group: 2,
    riders: ["SHGA", "WAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  // G2 CC
  {
    id: "G2cc5",
    mainPattern: "CC",
    group: 2,
    riders: ["WHGS", "SAGS"],
    prediction: "X",
  },
  // G2 F (UPDATED G2f23: F [SHGS+WAGS+ESHGA+EWAGA+H_BAL] -> 1X)
  {
    id: "G2f23",
    mainPattern: "F",
    group: 2,
    riders: ["SHGS", "WAGS", "ESHGA", "EWAGA", "H_BAL"],
    prediction: "1X",
  },
  {
    id: "G2f24",
    mainPattern: "F",
    group: 2,
    riders: ["SHGA", "WAGA", "H_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED

  // --- NEW PATTERNS (BATCH 11) ---
  // G1 S Home Trend (Renamed G1s10 to avoid collision)
  {
    id: "G1s10",
    mainPattern: "S",
    group: 1,
    riders: ["EWHGS", "ESAGS", "ESHGA", "EWAGA", "H_BAL", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req

  // --- NEW PATTERNS (BATCH 10) ---
  // G1 S New Pattern Cluster (UPDATED)
  {
    id: "G1s9",
    mainPattern: "S",
    group: 1,
    riders: ["SHGA", "WAGA", "H_BAL", "A_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  // G1 F High Confidence 1X
  {
    id: "G1f29",
    mainPattern: "F",
    group: 1,
    riders: ["SHGS", "WAGS", "EWHGA", "ESAGA", "H_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G1f22",
    mainPattern: "F",
    group: 1,
    riders: ["SAGS", "TS_DIFF_DRAW"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED

  // --- NEW PATTERNS (BATCH 9) ---
  // G1 Q Specific Coverage Fix
  {
    id: "G1q15",
    mainPattern: "Q",
    group: 1,
    riders: ["ESHGA", "EWAGA", "TS_HOME_STRONG", "A_BAL"],
    prediction: "1X",
  },
  // G1 R Broad Robustness
  { id: "G1r15", mainPattern: "R", group: 1, riders: [], prediction: "1X" },

  // --- NEW PATTERNS (BATCH 8) ---
  // G3 P Upset Correction
  {
    id: "G3p4",
    mainPattern: "P",
    group: 3,
    riders: ["WHGS", "SAGS", "A_BAL"],
    prediction: "X2",
    primaryPrediction: "2",
  },
  // G1 Q Upset Insight - Updated with TSB_1 refinement
  {
    id: "G1q14",
    mainPattern: "Q",
    group: 1,
    riders: ["SHGA", "WAGA", "TSB_1", "A_BAL"],
    prediction: "1X",
  },
  // G2 I Sub-Pattern
  {
    id: "G2i16",
    mainPattern: "I",
    group: 2,
    riders: ["ESHGS", "EWAGS", "SHGA", "WAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED

  // --- NEW PATTERNS (BATCH 7) ---
  // G3 F High Confidence Home
  // UPDATED G3f13 -> 12 (prim 1)
  {
    id: "G3f13",
    mainPattern: "F",
    group: 3,
    riders: ["SHGS", "WAGS", "SHGA", "WAGA", "H_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G3f14",
    mainPattern: "F",
    group: 3,
    riders: ["ESHGS", "EWAGS", "WHGA", "SAGA", "H_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  },

  // G2 FF Upset Strong Home (G2ff36)
  // UPDATED G2ff36 -> 1X (prim 1)

  // G2 M Away Dominance (UPDATED)
  // { id: 'G2m11', ... } is updated above.

  // G2 FF Home Strong Draw (Batch 8 Update) -> 1X
  {
    id: "G2ff39",
    mainPattern: "FF",
    group: 2,
    riders: ["ESHGA", "EWAGA", "SAGS", "WHGS"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G3ff39",
    mainPattern: "FF",
    group: 3,
    riders: ["ESHGA", "EWAGA", "SAGS", "WHGS"],
    prediction: "12",
    primaryPrediction: "1",
  },
  // G3 W Empty Flag Trend (2 Draws, 1 Away -> Dominant X, Final X2)
  {
    id: "G3w5",
    mainPattern: "W",
    group: 3,
    riders: [],
    prediction: "X2",
    primaryPrediction: "X",
  },

  // --- NEW PATTERNS (BATCH 6) ---
  // G1 LL
  {
    id: "G1ll1",
    mainPattern: "LL",
    group: 1,
    riders: ["WHGS", "SAGS", "SHGA", "WAGA", "H_BAL", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  },
  // G2 F (G2f23 updated above)
  // { id: 'G2f23', mainPattern: 'F', group: 2, riders: ['ESHGA', 'EWAGA', 'H_BAL'], prediction: '1X' },
  // G1 FF
  {
    id: "G1ff44",
    mainPattern: "FF",
    group: 1,
    riders: ["WHGS", "SAGS", "EWHGA", "ESAGA"],
    prediction: "X2",
    primaryPrediction: "2",
  },
  // G1 HH
  {
    id: "G1hh1",
    mainPattern: "HH",
    group: 1,
    riders: ["SHGA", "WAGA", "A_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  // G1 FF (UPDATED)
  {
    id: "G1ff45",
    mainPattern: "FF",
    group: 1,
    riders: ["SHGS", "WAGS", "WHGA", "SAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },
  // G1 B (UPDATED)
  {
    id: "G1b7",
    mainPattern: "B",
    group: 1,
    riders: ["H_BAL"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED: user req
  // G2 F (Updated G2f20) (Batch 8 Update) -> 12
  {
    id: "G2f20",
    mainPattern: "F",
    group: 2,
    riders: [
      "EWHGS",
      "ESAGS",
      "EWHGA",
      "ESAGA",
      "POTENTIAL_DRAW",
      "TS_DIFF_DRAW",
      "H_BAL",
    ],
    prediction: "12",
    primaryPrediction: "2",
  },
  // G2 II
  {
    id: "G2ii5",
    mainPattern: "II",
    group: 2,
    riders: ["SHGS", "WAGS", "SHGA", "WAGA", "H_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req
  // G3 FF (UPDATED)
  {
    id: "G3ff32",
    mainPattern: "FF",
    group: 3,
    riders: ["ESHGS", "EWAGS", "SHGA", "WAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  // G2 O
  {
    id: "G2o17",
    mainPattern: "O",
    group: 2,
    riders: ["WHGS", "SAGS", "EWHGA", "ESAGA", "TSB_1", "A_BAL"],
    prediction: "12",
    primaryPrediction: "2",
  },
  // G3 R
  { id: "G3r4", mainPattern: "R", group: 3, riders: [], prediction: "2" },
  // G1 F (UPDATED)
  {
    id: "G1f27",
    mainPattern: "F",
    group: 1,
    riders: ["WHGS", "SAGS", "WHGA", "SAGA", "H_BAL"],
    prediction: "12",
    primaryPrediction: "2",
  },
  // G2 Q (UPDATED) (Batch 8 Update G2q2 -> 1X)
  {
    id: "G2q2",
    mainPattern: "Q",
    group: 2,
    riders: ["SHGA", "WAGA", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  // G2q14 UPDATED (Batch 30)
  {
    id: "G2q14",
    mainPattern: "Q",
    group: 2,
    riders: ["WHGA", "SAGA", "TSB_1", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req
  // G1 F (UPDATED)
  {
    id: "G1f28",
    mainPattern: "F",
    group: 1,
    riders: ["EWHGS", "ESAGS", "SHGA", "WAGA", "H_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  },
  // G2 DD
  {
    id: "G2dd6",
    mainPattern: "DD",
    group: 2,
    riders: ["SHGA", "WAGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED

  // --- NEW PATTERNS (BATCH 5) ---
  // G3 G
  { id: "G3g5", mainPattern: "G", group: 3, riders: [], prediction: "1X" },
  // G1 FF
  {
    id: "G1ff38",
    mainPattern: "FF",
    group: 1,
    riders: ["ESHGS", "EWAGS", "ESHGA", "EWAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  // G2 O (Batch 8 Update) -> 1X is not requested, wait... G2o16 not requested. G2o15 is requested.
  {
    id: "G2o16",
    mainPattern: "O",
    group: 2,
    riders: ["EWHGS", "ESAGS", "A_BAL"],
    prediction: "12",
    primaryPrediction: "2",
  },
  // G3 S
  {
    id: "G3s3",
    mainPattern: "S",
    group: 3,
    riders: ["WHGS", "SAGS", "SHGA", "WAGA", "H_BAL", "A_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  // G2 I
  {
    id: "G2i14",
    mainPattern: "I",
    group: 2,
    riders: ["ESHGS", "EWAGS"],
    prediction: "1X",
  },
  // G2 L
  // UPDATED G2l2
  {
    id: "G2l2",
    mainPattern: "L",
    group: 2,
    riders: ["SHGS", "WAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  // G2 F (G2f21 updated below) - UPDATED G2f21 (Batch 30)
  {
    id: "G2f21",
    mainPattern: "F",
    group: 2,
    riders: ["EWHGS", "ESAGS", "H_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  // G3 HH (UPDATED)
  {
    id: "G3hh3",
    mainPattern: "HH",
    group: 3,
    riders: ["WHGA", "SAGA", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  // G2 F (UPDATED)
  {
    id: "G2f22",
    mainPattern: "F",
    group: 2,
    riders: ["WHGS", "SAGS", "ESHGA", "EWAGA", "H_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // Batch 21 Verify
  // G1 FF
  // G3 F (UPDATED)
  {
    id: "G3f11",
    mainPattern: "F",
    group: 3,
    riders: ["ESHGS", "EWAGS", "H_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  // G1 M - Updated to X2
  {
    id: "G1m3",
    mainPattern: "M",
    group: 1,
    riders: ["EWHGA", "ESAGA", "H_BAL"],
    prediction: "12",
    primaryPrediction: "2",
  },
  {
    id: "G1m6",
    mainPattern: "M",
    group: 1,
    riders: ["WHGA", "SAGA", "H_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  // G2 Q
  {
    id: "G2q13",
    mainPattern: "Q",
    group: 2,
    riders: ["TSB_1", "H_BAL", "A_BAL"],
    prediction: "X",
  },
  // G2 O (Batch 8 Update) -> 1X
  // UPDATED G2o15 -> 12 (prim 2)
  {
    id: "G2o15",
    mainPattern: "O",
    group: 2,
    riders: ["EWHGA", "ESAGA", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  },
  // G1 N (UPDATED) - UPDATED G1n4 (Batch 30)
  // G3 CC
  {
    id: "G3cc6",
    mainPattern: "CC",
    group: 3,
    riders: [],
    prediction: "12",
    primaryPrediction: "1",
  },
  // G3 II (UPDATED)

  {
    id: "G2j10",
    mainPattern: "J",
    group: 2,
    riders: ["EWHGA", "ESAGA"],
    prediction: "12",
    primaryPrediction: "2",
  }, // BANNED: DRAW RISK

  // --- NEW PATTERNS (BATCH 4) ---
  // G2 FF (UPDATED)
  {
    id: "G2ff34",
    mainPattern: "FF",
    group: 2,
    riders: ["EWHGS", "ESAGS", "WHGA", "SAGA"],
    prediction: "12",
    primaryPrediction: "2",
  },
  // G3 HH (UPDATED)
  {
    id: "G3hh2",
    mainPattern: "HH",
    group: 3,
    riders: ["EWHGA", "ESAGA", "A_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  // G2 II
  {
    id: "G2ii3",
    mainPattern: "II",
    group: 2,
    riders: ["EWHGA", "ESAGA", "H_BAL"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED
  // G3 JJ (UPDATED)
  {
    id: "G3jj1",
    mainPattern: "JJ",
    group: 3,
    riders: ["WHGS", "SAGS", "A_BAL"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED
  // G1 FF (UPDATED)
  // G3 G (UPDATED)
  {
    id: "G3g4",
    mainPattern: "G",
    group: 3,
    riders: ["EWHGS", "ESAGS"],
    prediction: "12",
    primaryPrediction: "1",
  },
  // G1 FF (UPDATED)
  {
    id: "G1ff39",
    mainPattern: "FF",
    group: 1,
    riders: ["ESHGA", "EWAGA", "SAGS", "WHGS"],
    prediction: "12",
    primaryPrediction: "2",
  },
  // G2 II (G2ii4 updated below)
  {
    id: "G2ii4",
    mainPattern: "II",
    group: 2,
    riders: ["SHGS", "WAGS", "ESHGA", "EWAGA", "H_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  // G1 A (UPDATED: A [WHGS,SAGS,H_BAL] -> X2) - UPDATED G1a7 (Batch 30)
  {
    id: "G1a7",
    mainPattern: "A",
    group: 1,
    riders: ["WHGS", "SAGS", "H_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  },
  // G2 AA (UPDATED)
  {
    id: "G2aa4",
    mainPattern: "AA",
    group: 2,
    riders: ["WHGS", "SAGS", "EWHGA", "ESAGA", "A_BAL"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED: G2aa4 -> X2
  // G2 AA Specific (G2aa3) - UPDATED
  {
    id: "G2aa3",
    mainPattern: "AA",
    group: 2,
    riders: ["SHGS", "WAGS", "ESHGA", "EWAGA", "TS_HOME_STRONG", "A_BAL"],
    prediction: "12",
  },

  // UPDATED G2aa1 -> X2
  {
    id: "G2aa1",
    mainPattern: "AA",
    group: 2,
    riders: ["SHGA"],
    prediction: "12",
    primaryPrediction: "1",
  },

  // G3 JJ
  {
    id: "G3jj2",
    mainPattern: "JJ",
    group: 3,
    riders: ["EWHGS", "ESAGS", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  // G3 FF (UPDATED)
  // G2 FF
  // G2 O
  {
    id: "G2o14",
    mainPattern: "O",
    group: 2,
    riders: ["EWHGS", "ESAGS", "ESHGA", "EWAGA", "A_BAL"],
    prediction: "X2",
    primaryPrediction: "2",
  }, // UPDATED
  // G1 JJ
  // Old location G1jj1 duplicate removed, defined above
  // G1 FF (UPDATED)
  // { id: 'G1ff40', ... } updated above
  // G1a6 UPDATED (Batch 30)
  {
    id: "G1a6",
    mainPattern: "A",
    group: 1,
    riders: ["ESAGS", "P2"],
    prediction: "12",
    primaryPrediction: "1",
  },

  // G3ff5 UPDATED
  {
    id: "G3ff43",
    mainPattern: "FF",
    group: 3,
    riders: ["EWHGS", "ESAGS", "EWHGA", "ESAGA"],
    prediction: "12",
    primaryPrediction: "2",
  },

  // G2ii2 UPDATED
  {
    id: "G2ii2",
    mainPattern: "II",
    group: 2,
    riders: ["EWHGA", "ESAGA", "POTENTIAL_DRAW", "TS_DIFF_DRAW"],
    prediction: "12",
    primaryPrediction: "2",
  },

  // UPDATED G2ff24: prim 1 fin 12

  // G2ff25 UPDATED

  // G2ff4 UPDATED
  {
    id: "G2ff4",
    mainPattern: "FF",
    group: 2,
    riders: ["EWHGA", "ESAGA", "WHGS", "SAGS"],
    prediction: "X2",
    primaryPrediction: "2",
  },

  // --- NEW PATTERNS (BATCH 3) ---
  // G3 EE (UPDATED)
  {
    id: "G3ee7",
    mainPattern: "EE",
    group: 3,
    riders: ["EWHGS", "ESAGS", "ESHGA", "EWAGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  // G2 FF
  // G3 II (UPDATED)
  {
    id: "G3ii1",
    mainPattern: "II",
    group: 3,
    riders: ["WHGS", "SAGS", "SHGA", "WAGA", "H_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req
  // G2 GG (G2gg2 updated below)
  // UPDATED G2gg2: prim X fin 1X
  {
    id: "G2gg2",
    mainPattern: "GG",
    group: 2,
    riders: ["EWHGA", "ESAGA"],
    prediction: "12",
    primaryPrediction: "2",
  },
  // G1 J (Empty flags - handled by riders: [])
  { id: "G1j11", mainPattern: "J", group: 1, riders: [], prediction: "12" },
  // G3 FF (UPDATED)
  {
    id: "G3ff6",
    mainPattern: "FF",
    group: 3,
    riders: ["ESHGS", "EWAGS", "EWHGA", "ESAGA"],
    prediction: "X2",
    primaryPrediction: "X",
  },
  // G3 K
  {
    id: "G3k1",
    mainPattern: "K",
    group: 3,
    riders: ["H_BAL", "A_BAL"],
    prediction: "X2",
    primaryPrediction: "2",
  }, // UPDATED
  // G1 II
  {
    id: "G1ii1",
    mainPattern: "II",
    group: 1,
    riders: ["SHGS", "WAGS", "EWHGA", "ESAGA", "TS_DIFF_DRAW", "H_BAL"],
    prediction: "1X",
    primaryPrediction: "X",
  }, // UPDATED: user req
  // G3 F (Batch 8 Update) -> 1X
  {
    id: "G3f10",
    mainPattern: "F",
    group: 3,
    riders: ["SHGS", "WAGS", "H_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  // G1 EE (Matches G2-EE-7 Refinement which targets G2, here G1EE7 is distinct)
  {
    id: "G1ee7",
    mainPattern: "EE",
    group: 1,
    riders: ["ESHGS", "EWAGS", "TS_DIFF_DRAW", "TS_HOME_STRONG"],
    prediction: "12",
    primaryPrediction: "1",
  },
  // G2-EE-7 Match
  {
    id: "G2ee7",
    mainPattern: "EE",
    group: 2,
    riders: ["EWHGS", "ESAGS", "EWHGA", "ESAGA", "TS_DIFF_DRAW"],
    prediction: "12",
    primaryPrediction: "2",
  },
  // G2 F (UPDATED)
  {
    id: "G2f18",
    mainPattern: "F",
    group: 2,
    riders: ["ESHGS", "EWAGS", "H_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  // G2 O (UPDATED)
  {
    id: "G2o13",
    mainPattern: "O",
    group: 2,
    riders: ["ESHGA", "EWAGA", "TSB_1", "A_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  // G2 CC
  {
    id: "G2cc4",
    mainPattern: "CC",
    group: 2,
    riders: ["SHGS", "WAGS"],
    prediction: "X",
  },

  // --- PREVIOUS BATCHES ---
  // G2 KK Fix - Updated to 12 (prim 1)
  {
    id: "G2kk3",
    mainPattern: "KK",
    group: 2,
    riders: ["A_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G2ff32",
    mainPattern: "FF",
    group: 2,
    riders: ["ESHGS", "EWAGS", "SHGA", "WAGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // BANNED: UPSET RISK
  // G2 EE (G2ee9 updated here)
  {
    id: "G2ee9",
    mainPattern: "E",
    group: 2,
    riders: ["EWHGS", "ESAGS", "EWHGA", "ESAGA"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED Batch 22
  // G3 GG Contra
  {
    id: "G3gg1",
    mainPattern: "GG",
    group: 3,
    riders: ["EWHGA", "ESAGA"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED

  {
    id: "G2ee10",
    mainPattern: "EE",
    group: 2,
    riders: ["ESHGS", "EWAGS", "TS_DIFF_DRAW", "TS_HOME_STRONG"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G1p8",
    mainPattern: "P",
    group: 1,
    riders: ["A_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G2o12",
    mainPattern: "O",
    group: 2,
    riders: ["EWHGS", "ESAGS", "TSB_1", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  },

  // --- PATTERNS GG, HH, II, JJ, KK, LL ---

  // Pattern GG
  {
    id: "G2gg1",
    mainPattern: "GG",
    group: 2,
    riders: ["ESHGA", "EWAGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // BANNED: UPSET RISK
  // G1 GG (UPDATED)
  {
    id: "G1gg1",
    mainPattern: "GG",
    group: 1,
    riders: [],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  // NEW G3gg2 (UPDATED)
  {
    id: "G3gg2",
    mainPattern: "GG",
    group: 3,
    riders: [],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED

  // Pattern HH
  {
    id: "G2hh1",
    mainPattern: "HH",
    group: 2,
    riders: ["ESHGA", "EWAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED

  // Pattern II
  {
    id: "G2ii1",
    mainPattern: "II",
    group: 2,
    riders: ["WHGA", "SAGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  // NEW G3ii3
  {
    id: "G3ii3",
    mainPattern: "II",
    group: 3,
    riders: ["ESHGA", "EWAGA", "H_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: Batch 19

  // Pattern JJ
  {
    id: "G2jj1",
    mainPattern: "JJ",
    group: 2,
    riders: ["EWHGS", "ESAGS"],
    prediction: "12",
    primaryPrediction: "2",
  },
  // NEW G3jj3
  {
    id: "G3jj3",
    mainPattern: "JJ",
    group: 3,
    riders: ["A_BAL"],
    prediction: "12",
  },

  // Pattern KK
  {
    id: "G2kk1",
    mainPattern: "KK",
    group: 2,
    riders: ["WHGA"],
    prediction: "1",
  },
  {
    id: "G2kk2",
    mainPattern: "KK",
    group: 2,
    riders: ["WHGS"],
    prediction: "X",
  },
  {
    id: "G2x4",
    mainPattern: "X",
    group: 2,
    riders: ["EWAGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: Batch 22
  // Pattern KK Group 3
  // UPDATED G3kk1: prim 1 fin 1X
  {
    id: "G3kk1",
    mainPattern: "KK",
    group: 3,
    riders: [],
    prediction: "12",
    primaryPrediction: "1",
  },

  // Pattern LL
  {
    id: "G3ll2",
    mainPattern: "LL",
    group: 3,
    riders: ["SHGS", "WAGS", "WHGA", "SAGA", "P2", "P3"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  // UPDATED G3ll1 -> 2
  {
    id: "G3ll1",
    mainPattern: "LL",
    group: 3,
    riders: ["SHGS", "WAGS", "WHGA", "SAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },

  // --- PATTERN A ---
  // UPDATED G2a5: prim 1 fin 1X
  {
    id: "G2a5",
    mainPattern: "A",
    group: 2,
    riders: ["EWAGS", "P2"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G2a6",
    mainPattern: "A",
    group: 2,
    riders: ["ESAGS", "P2", "P4"],
    prediction: "X",
  },
  {
    id: "G2a7",
    mainPattern: "A",
    group: 2,
    riders: ["SAGS", "P2"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req
  {
    id: "G2a8",
    mainPattern: "A",
    group: 2,
    riders: ["EWAGS", "P1", "P5"],
    prediction: "1",
  }, // UPDATED
  {
    id: "G1a5",
    mainPattern: "A",
    group: 1,
    riders: ["ESAGS", "P4"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED

  // Group 3
  {
    id: "G3a3",
    mainPattern: "A",
    group: 3,
    riders: ["WAGS", "P2", "P3"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G3a4",
    mainPattern: "A",
    group: 3,
    riders: ["WAGS", "P2", "P4"],
    prediction: "12",
    primaryPrediction: "1",
  },
  // G3aa5 UPDATED (Batch 30)
  {
    id: "G3aa5",
    mainPattern: "AA",
    group: 3,
    riders: ["SHGS", "WAGS", "EWHGA", "ESAGA"],
    prediction: "12",
    primaryPrediction: "2",
  },
  {
    id: "G3a5",
    mainPattern: "A",
    group: 3,
    riders: ["WAGS", "P2"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G3a2",
    mainPattern: "A",
    group: 3,
    riders: ["EWAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  { id: "G3a6", mainPattern: "A", group: 3, riders: [], prediction: "1X" },

  // G3a1 UPDATED (Batch 30)
  {
    id: "G3a1",
    mainPattern: "A",
    group: 3,
    riders: ["WAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  },

  // Base Group 1
  {
    id: "G1a1",
    mainPattern: "A",
    group: 1,
    riders: ["SAGS"],
    prediction: "X2",
    primaryPrediction: "1",
  },
  {
    id: "G1a2",
    mainPattern: "A",
    group: 1,
    riders: ["ESAGS"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED: Batch 21 No-Draw
  {
    id: "G1a3",
    mainPattern: "A",
    group: 1,
    riders: ["WAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED G1a3 to 1X based on G1f3 pattern (F is a subset of A often) - Reverting to '2' as per original unless conflict. User requested G1f3 update only.
  {
    id: "G1a4",
    mainPattern: "A",
    group: 1,
    riders: ["EWAGS"],
    prediction: "1",
  },

  {
    id: "G2a1",
    mainPattern: "A",
    group: 2,
    riders: ["WAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G2a2",
    mainPattern: "A",
    group: 2,
    riders: ["EWAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G2a3",
    mainPattern: "A",
    group: 2,
    riders: ["SAGS"],
    prediction: "X2",
    primaryPrediction: "X",
  },
  // G2a4 UPDATED (Batch 30)
  {
    id: "G2a4",
    mainPattern: "A",
    group: 2,
    riders: ["ESAGS"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req
  { id: "G2a9", mainPattern: "A", group: 2, riders: [], prediction: "1" },

  // --- PATTERN B ---
  {
    id: "G2b6",
    mainPattern: "B",
    group: 2,
    riders: ["SAGS", "P1"],
    prediction: "1",
  },
  {
    id: "G2b7",
    mainPattern: "B",
    group: 2,
    riders: ["ESAGS", "P2", "P4"],
    prediction: "1X",
    primaryPrediction: "1",
  },

  {
    id: "G2b5",
    mainPattern: "B",
    group: 2,
    riders: ["EWAGS", "P5"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req
  {
    id: "G1b6",
    mainPattern: "B",
    group: 1,
    riders: ["ESAGS", "P1", "P5"],
    prediction: "1X",
  },

  // Group 3
  {
    id: "G3b3",
    mainPattern: "B",
    group: 3,
    riders: ["EWAGS", "P1", "P2", "P3"],
    prediction: "1",
  },
  {
    id: "G3b1",
    mainPattern: "B",
    group: 3,
    riders: ["EWAGS"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G3b2",
    mainPattern: "B",
    group: 3,
    riders: ["WAGS"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req

  // Base Group 1
  { id: "G1b1", mainPattern: "B", group: 1, riders: ["SAGS"], prediction: "1X" },
  {
    id: "G1b2",
    mainPattern: "B",
    group: 1,
    riders: ["SAGS"],
    prediction: "MO",
  },
  {
    id: "G1b3",
    mainPattern: "B",
    group: 1,
    riders: ["ESAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G1b4",
    mainPattern: "B",
    group: 1,
    riders: ["WAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G1b5",
    mainPattern: "B",
    group: 1,
    riders: ["EWAGS"],
    prediction: "1",
  },

  { id: "G2b1", mainPattern: "B", group: 2, riders: ["SAGS"], prediction: "2" },
  {
    id: "G2b2",
    mainPattern: "B",
    group: 2,
    riders: ["ESAGS"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req
  { id: "G2b3", mainPattern: "B", group: 2, riders: ["WAGS"], prediction: "12" },
  {
    id: "G2b4",
    mainPattern: "B",
    group: 2,
    riders: ["EWAGS"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req

  // --- PATTERN C ---
  // Group 1
  { id: "G1c1", mainPattern: "C", group: 1, riders: ["WHGS"], prediction: "1X" },
  { id: "G1c2", mainPattern: "C", group: 1, riders: ["WHGA"], prediction: "12" },
  { id: "G1c3", mainPattern: "C", group: 1, riders: ["SHGS"], prediction: "12" },
  { id: "G1c4", mainPattern: "C", group: 1, riders: ["WAGA"], prediction: "12" },

  // Group 2
  {
    id: "G2c7",
    mainPattern: "C",
    group: 2,
    riders: ["WHGA", "P1", "P2"],
    prediction: "2",
  },
  // UPDATED G2c6 -> 1X (prim X)
  {
    id: "G2c6",
    mainPattern: "C",
    group: 2,
    riders: ["WHGA", "P2"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED: user req
  {
    id: "G2c8",
    mainPattern: "C",
    group: 2,
    riders: ["WAGA", "P1"],
    prediction: "X",
  },

  {
    id: "G2c1",
    mainPattern: "C",
    group: 2,
    riders: ["WHGS"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G2c2",
    mainPattern: "C",
    group: 2,
    riders: ["WHGA"],
    prediction: "X2",
    primaryPrediction: "X",
  },
  {
    id: "G2c3",
    mainPattern: "C",
    group: 2,
    riders: ["SHGS"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req
  { id: "G2c5", mainPattern: "C", group: 2, riders: ["WAGS"], prediction: "12" },
  { id: "G2c4", mainPattern: "C", group: 2, riders: ["WAGA"], prediction: "12" },

  // Group 3
  { id: "G3c1", mainPattern: "C", group: 3, riders: ["WHGS"], prediction: "12" },
  { id: "G3c2", mainPattern: "C", group: 3, riders: ["WHGA"], prediction: "12" },
  { id: "G3c3", mainPattern: "C", group: 3, riders: ["SHGS"], prediction: "12" },
  { id: "G3c4", mainPattern: "C", group: 3, riders: ["WAGA"], prediction: "12" },

  // --- PATTERN CC ---
  // Group 3
  {
    id: "G3cc2",
    mainPattern: "CC",
    group: 3,
    riders: ["WHGS", "P1", "P2", "P3", "P4", "P5"],
    prediction: "1",
  }, // UPDATED
  {
    id: "G3cc5",
    mainPattern: "CC",
    group: 3,
    riders: ["WHGS", "SAGS"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G3cc1",
    mainPattern: "CC",
    group: 3,
    riders: ["WHGS"],
    prediction: "2",
  },

  {
    id: "G2cc3",
    mainPattern: "CC",
    group: 2,
    riders: ["EWHGS", "P5"],
    prediction: "1X",
    primaryPrediction: "X",
  },
  // UPDATED G2cc2 to 1 (from 1X)
  {
    id: "G2cc2",
    mainPattern: "CC",
    group: 2,
    riders: ["EWAGS"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G2cc1",
    mainPattern: "CC",
    group: 2,
    riders: ["EWHGS", "ESAGS"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED

  // Batch 8 Update G1cc6 -> 12 - G1cc6 UPDATED (Batch 30)
  {
    id: "G1cc6",
    mainPattern: "CC",
    group: 1,
    riders: ["SHGS", "WAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G1cc3",
    mainPattern: "CC",
    group: 1,
    riders: ["P1", "P2", "P3", "P7"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G1cc4",
    mainPattern: "CC",
    group: 1,
    riders: ["ESHGS", "P1", "P5"],
    prediction: "1",
  }, // UPDATED
  { id: "G1cc5", mainPattern: "CC", group: 1, riders: ["P1"], prediction: "2" },

  // Base CC
  {
    id: "G1cc1",
    mainPattern: "CC",
    group: 1,
    riders: ["SHGS"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G1cc2",
    mainPattern: "CC",
    group: 1,
    riders: ["ESHGS"],
    prediction: "12",
    primaryPrediction: "1",
  },

  // --- PATTERN DD ---
  // Group 1 Specifics
  {
    id: "G1dd6",
    mainPattern: "DD",
    group: 1,
    riders: ["SAGA", "P1", "P5"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G1dd5",
    mainPattern: "DD",
    group: 1,
    riders: ["SAGA", "P2"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  // Group 1 Base
  {
    id: "G1dd1",
    mainPattern: "DD",
    group: 1,
    riders: ["SAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G1dd2",
    mainPattern: "DD",
    group: 1,
    riders: ["ESAGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G1dd3",
    mainPattern: "DD",
    group: 1,
    riders: ["WAGA"],
    prediction: "X2",
  },
  {
    id: "G1dd4",
    mainPattern: "DD",
    group: 1,
    riders: ["EWAGA"],
    prediction: "1",
  },

  // Group 2
  {
    id: "G2dd5",
    mainPattern: "DD",
    group: 2,
    riders: ["ESAGA", "P5"],
    prediction: "12",
    primaryPrediction: "2",
  },
  {
    id: "G2dd1",
    mainPattern: "DD",
    group: 2,
    riders: ["SAGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G2dd7",
    mainPattern: "DD",
    group: 2,
    riders: ["ESAGA", "POTENTIAL_DRAW", "TS_DIFF_DRAW"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: Batch 21 Outcome Swing
  {
    id: "G2dd2",
    mainPattern: "DD",
    group: 2,
    riders: ["ESAGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G2dd3",
    mainPattern: "DD",
    group: 2,
    riders: ["WAGA"],
    prediction: "1X",
  },
  {
    id: "G2dd4",
    mainPattern: "DD",
    group: 2,
    riders: ["EWAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },

  // Group 3
  // NEW G3dd5
  {
    id: "G3dd5",
    mainPattern: "DD",
    group: 3,
    riders: ["SHGA", "WAGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G3dd1",
    mainPattern: "DD",
    group: 3,
    riders: ["SAGA"],
    prediction: "12",
  },
  {
    id: "G3dd2",
    mainPattern: "DD",
    group: 3,
    riders: ["ESAGA"],
    prediction: "2",
  },
  {
    id: "G3dd3",
    mainPattern: "DD",
    group: 3,
    riders: ["WAGA"],
    prediction: "12",
  },
  {
    id: "G3dd4",
    mainPattern: "DD",
    group: 3,
    riders: ["EWAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED: user req

  // --- PATTERN EE (Renamed D) ---
  {
    id: "G1ee10",
    mainPattern: "EE",
    group: 1,
    riders: ["ESHGS", "EWAGS", "WHGA", "SAGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req
  {
    id: "G1ee9",
    mainPattern: "EE",
    group: 1,
    riders: ["WHGS", "SAGS"],
    prediction: "12",
    primaryPrediction: "2",
  },
  {
    id: "G1ee6",
    mainPattern: "EE",
    group: 1,
    riders: ["ESHGS", "EWAGS", "EWHGA", "ESAGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req
  {
    id: "G1ee5",
    mainPattern: "EE",
    group: 1,
    riders: ["SHGS", "P3"],
    prediction: "2",
  },
  {
    id: "G1ee1",
    mainPattern: "EE",
    group: 1,
    riders: ["SHGS"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G1ee2",
    mainPattern: "EE",
    group: 1,
    riders: ["WHGS"],
    prediction: "2",
  },
  {
    id: "G1ee3",
    mainPattern: "EE",
    group: 1,
    riders: ["ESHGS", "EWAGA", "WHGA", "SAGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // BANNED: UPSET RISK
  {
    id: "G1ee4",
    mainPattern: "EE",
    group: 1,
    riders: ["WAGA"],
    prediction: "1",
  },

  {
    id: "G2ee5",
    mainPattern: "EE",
    group: 2,
    riders: ["EWHGS", "EWAGA"],
    prediction: "X2",
    primaryPrediction: "2",
  }, // UPDATED
  // UPDATED G2ee1: prim 1 fin 1X
  {
    id: "G2ee1",
    mainPattern: "EE",
    group: 2,
    riders: ["SHGS", "WAGS", "ESHGA", "EWAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G2ee2",
    mainPattern: "EE",
    group: 2,
    riders: ["WHGS"],
    prediction: "X2",
    primaryPrediction: "2",
  },
  {
    id: "G2ee4",
    mainPattern: "EE",
    group: 2,
    riders: ["WAGA"],
    prediction: "1",
  },

  // NEW G3ee8
  {
    id: "G3ee8",
    mainPattern: "EE",
    group: 3,
    riders: ["ESHGA", "EWAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G3ee6",
    mainPattern: "EE",
    group: 3,
    riders: ["WHGS", "P2", "P3"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G3ee5",
    mainPattern: "EE",
    group: 3,
    riders: ["WHGS", "P2"],
    prediction: "1X",
    primaryPrediction: "X",
  },
  {
    id: "G3ee1",
    mainPattern: "EE",
    group: 3,
    riders: ["SHGS"],
    prediction: "1",
  },
  // UPDATED G3ee2: prim 1 fin 12
  {
    id: "G3ee2",
    mainPattern: "EE",
    group: 3,
    riders: ["WHGS"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G3ee3",
    mainPattern: "EE",
    group: 3,
    riders: ["SAGA"],
    prediction: "2",
  },
  {
    id: "G3ee4",
    mainPattern: "EE",
    group: 3,
    riders: ["WAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED

  // --- PATTERN E ---
  // G2e9
  {
    id: "G2e9",
    mainPattern: "E",
    group: 2,
    riders: ["ESHGS", "EWAGS", "SHGA", "WAGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G2e4",
    mainPattern: "E",
    group: 2,
    riders: ["SAGA", "WHGS", "P2", "P4"],
    prediction: "X",
  },
  {
    id: "G2e3",
    mainPattern: "E",
    group: 2,
    riders: ["EWHGS", "ESAGA"],
    prediction: "X2",
    primaryPrediction: "2",
  },

  {
    id: "G1e1",
    mainPattern: "E",
    group: 1,
    riders: [],
    prediction: "1X",
    primaryPrediction: "1",
  },

  {
    id: "G2e1",
    mainPattern: "E",
    group: 2,
    riders: ["SHGS", "WAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  // Updated G2e2 to 12
  {
    id: "G2e2",
    mainPattern: "E",
    group: 2,
    riders: ["WHGS", "SAGS", "WHGA", "SAGA"],
    prediction: "12",
  },

  {
    id: "G2e5",
    mainPattern: "E",
    group: 2,
    riders: ["EWAGS", "EWAGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G2e6",
    mainPattern: "E",
    group: 2,
    riders: ["EWAGS", "EWAGA", "P5"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  // UPDATED G2e7: prim 1 fin 12
  {
    id: "G2e7",
    mainPattern: "E",
    group: 2,
    riders: ["EWAGS", "EWAGA", "UPSET"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  // Batch 8 Update G2e8 -> X2
  {
    id: "G2e8",
    mainPattern: "E",
    group: 2,
    riders: ["SAGS", "ESAGA"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED

  // --- PATTERN F ---
  // Group 3
  // NEW G3f15
  {
    id: "G3f15",
    mainPattern: "F",
    group: 3,
    riders: ["ESHGA", "EWAGA", "H_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G3ff30",
    mainPattern: "FF",
    group: 3,
    riders: ["ESHGA", "EWAGA", "SHGS", "WAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G3ff44",
    mainPattern: "FF",
    group: 3,
    riders: ["WHGS", "SAGS", "EWHGA", "ESAGA"],
    prediction: "12",
    primaryPrediction: "2",
  },
  {
    id: "G3ff1",
    mainPattern: "FF",
    group: 3,
    riders: ["WHGS", "SAGS", "SHGA", "WAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G3f4",
    mainPattern: "F",
    group: 3,
    riders: ["EWAGS", "EWAGA", "P5"],
    prediction: "X",
  },
  // UPDATED G3f9: prim 1 fin 12
  {
    id: "G3f9",
    mainPattern: "F",
    group: 3,
    riders: ["WAGS", "WAGA", "P5"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: prim 2 fin 12 in list but keeping user request context from G3ff9
  {
    id: "G3f1",
    mainPattern: "F",
    group: 3,
    riders: ["WAGS", "SAGA"],
    prediction: "X",
  },
  {
    id: "G3f2",
    mainPattern: "F",
    group: 3,
    riders: ["EWAGS", "SAGA"],
    prediction: "1",
  },
  {
    id: "G3f3",
    mainPattern: "F",
    group: 3,
    riders: ["EWAGS", "EWAGA"],
    prediction: "1",
  },
  {
    id: "G3f5",
    mainPattern: "F",
    group: 3,
    riders: ["WAGS", "EWAGA"],
    prediction: "1",
  },
  {
    id: "G3f6",
    mainPattern: "F",
    group: 3,
    riders: ["EWAGS", "WAGA"],
    prediction: "1",
  },
  {
    id: "G3f7",
    mainPattern: "F",
    group: 3,
    riders: ["WAGS", "WAGA"],
    prediction: "1",
  },
  {
    id: "G3f8",
    mainPattern: "F",
    group: 3,
    riders: ["EWAGS", "ESAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },

  // Group 2
  {
    id: "G2ff30",
    mainPattern: "FF",
    group: 2,
    riders: ["ESHGA", "EWAGA", "SHGS", "WAGS"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G2f17",
    mainPattern: "F",
    group: 2,
    riders: ["EWHGA", "ESAGA", "POTENTIAL_DRAW"],
    prediction: "12",
    primaryPrediction: "1",
  },
  // UPDATED G2ff24: prim 1 fin 12
  {
    id: "G2f16",
    mainPattern: "F",
    group: 2,
    riders: ["EWAGS", "WAGA"],
    prediction: "X2",
    primaryPrediction: "2",
  },
  {
    id: "G2f15",
    mainPattern: "F",
    group: 2,
    riders: ["ESAGA", "SAGS"],
    prediction: "X2",
    primaryPrediction: "X",
  },
  {
    id: "G2f14",
    mainPattern: "F",
    group: 2,
    riders: ["EWAGS", "EWAGA", "P2"],
    prediction: "2",
  },
  {
    id: "G2f13",
    mainPattern: "F",
    group: 2,
    riders: ["WAGS", "WAGA"],
    prediction: "2",
  },
  {
    id: "G2f12",
    mainPattern: "F",
    group: 2,
    riders: ["EWAGS", "EWAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  },

  {
    id: "G2f11",
    mainPattern: "F",
    group: 2,
    riders: ["WAGS", "ESAGA", "P4", "P5"],
    prediction: "1",
  },
  // Batch 8 Update G2f10 -> X2
  {
    id: "G2f10",
    mainPattern: "F",
    group: 2,
    riders: ["WAGS", "ESAGA"],
    prediction: "12",
    primaryPrediction: "2",
  },
  {
    id: "G2f9",
    mainPattern: "F",
    group: 2,
    riders: ["ESAGS", "SAGA"],
    prediction: "12",
    primaryPrediction: "2",
  },
  {
    id: "G2f8",
    mainPattern: "F",
    group: 2,
    riders: ["WAGS", "EWAGA"],
    prediction: "1",
  },
  // UPDATED G2f7 -> 2
  {
    id: "G2f7",
    mainPattern: "F",
    group: 2,
    riders: ["WHGS", "SAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G2f6",
    mainPattern: "F",
    group: 2,
    riders: ["EWAGS", "WAGA"],
    prediction: "1X",
    primaryPrediction: "2",
  },
  {
    id: "G2f5",
    mainPattern: "F",
    group: 2,
    riders: ["ESAGS", "EWAGA"],
    prediction: "X",
  },
  {
    id: "G2f3",
    mainPattern: "F",
    group: 2,
    riders: ["EWAGS", "WHGA"],
    prediction: "1",
  },
  {
    id: "G2f2",
    mainPattern: "F",
    group: 2,
    riders: ["ESAGS", "ESAGA"],
    prediction: "12",
    primaryPrediction: "2",
  },

  // Group 1
  {
    id: "G1g12",
    mainPattern: "G",
    group: 1,
    riders: ["EWHGS", "P2"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED
  {
    id: "G1ff34",
    mainPattern: "FF",
    group: 1,
    riders: ["EWHGS", "ESAGS", "WHGA", "SAGA"],
    prediction: "12",
    primaryPrediction: "2",
  }, // BANNED: UPSET RISK
  {
    id: "G1ff32",
    mainPattern: "FF",
    group: 1,
    riders: ["ESHGS", "EWAGS", "SHGA", "WAGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G1f25",
    mainPattern: "F",
    group: 1,
    riders: ["EWHGS", "ESAGS", "WHGA", "SAGA"],
    prediction: "12",
    primaryPrediction: "2",
  },
  {
    id: "G1f23",
    mainPattern: "F",
    group: 1,
    riders: ["ESAGS", "P1", "P5", "P2"],
    prediction: "12",
  },
  {
    id: "G1f12",
    mainPattern: "F",
    group: 1,
    riders: ["ESAGS", "P1", "P5"],
    prediction: "1X",
  },
  {
    id: "G1f9",
    mainPattern: "F",
    group: 1,
    riders: ["ESAGS", "P1", "P2", "P5"],
    prediction: "1",
  },
  {
    id: "G1f8",
    mainPattern: "F",
    group: 1,
    riders: ["P4", "P5"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G1f11",
    mainPattern: "F",
    group: 1,
    riders: ["ESAGS", "P4"],
    prediction: "2",
  },
  {
    id: "G1f6",
    mainPattern: "F",
    group: 1,
    riders: ["SAGS", "SAGA"],
    prediction: "X2",
  },
  {
    id: "G1f7",
    mainPattern: "F",
    group: 1,
    riders: ["SAGS", "P4"],
    prediction: "1",
  },
  {
    id: "G1f10",
    mainPattern: "F",
    group: 1,
    riders: ["P5"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED: prim 2 fin X2
  {
    id: "G1f24",
    mainPattern: "F",
    group: 1,
    riders: ["EWHGS", "ESAGS", "WHGA", "SAGA"],
    prediction: "2",
  },
  // G1f21 UPDATED (Batch 30)
  {
    id: "G1f21",
    mainPattern: "F",
    group: 1,
    riders: ["ESHGS", "ESAGA", "P2", "P7"],
    prediction: "12",
    primaryPrediction: "2",
  },
  // G1f5 UPDATED (Batch 30)
  {
    id: "G1f5",
    mainPattern: "F",
    group: 1,
    riders: ["ESHGS", "ESAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G1f3",
    mainPattern: "F",
    group: 1,
    riders: ["EWAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED: G1f3 -> 1X
  // Base Group 1
  {
    id: "G1f22",
    mainPattern: "F",
    group: 1,
    riders: ["SAGS", "TS_DIFF_DRAW"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED
  {
    id: "G1f1",
    mainPattern: "F",
    group: 1,
    riders: ["SAGS"],
    prediction: "X2",
    primaryPrediction: "X",
  }, // UPDATED
  {
    id: "G1f2",
    mainPattern: "F",
    group: 1,
    riders: ["ESAGS"],
    prediction: "12",
    primaryPrediction: "1",
  },
  { id: "G1f4", mainPattern: "F", group: 1, riders: ["SAGS"], prediction: "12" },

  // --- PATTERN G ---
  {
    id: "G1g17",
    mainPattern: "G",
    group: 1,
    riders: ["EWHGS", "ESAGS", "TS_HOME_STRONG"],
    prediction: "12",
  },
  // UPDATED G1g16: prim 1 fin 1X
  {
    id: "G1g16",
    mainPattern: "G",
    group: 1,
    riders: ["TS_HOME_STRONG"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G1g15",
    mainPattern: "G",
    group: 1,
    riders: ["SAGS", "P1", "P2", "P5", "P7"],
    prediction: "X2",
    primaryPrediction: "2",
  },
  {
    id: "G1g13",
    mainPattern: "G",
    group: 1,
    riders: ["EWHGS", "P2", "P5"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED
  {
    id: "G1g11",
    mainPattern: "G",
    group: 1,
    riders: ["SAGS", "P1", "P2", "P5"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G1g10",
    mainPattern: "G",
    group: 1,
    riders: ["SAGS", "P4"],
    prediction: "1X",
  },
  {
    id: "G1g8",
    mainPattern: "G",
    group: 1,
    riders: ["EWAGS", "P1", "P4", "P5"],
    prediction: "1X",
  },
  {
    id: "G1g5",
    mainPattern: "G",
    group: 1,
    riders: ["EWHGS", "P4"],
    prediction: "1",
  },
  {
    id: "G1g6",
    mainPattern: "G",
    group: 1,
    riders: ["EWAGS", "P2"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: Batch 21 Volatility Shield

  {
    id: "G1g14",
    mainPattern: "G",
    group: 1,
    riders: ["SAGS", "P2"],
    prediction: "X2",
    primaryPrediction: "1",
  }, // UPDATED: Batch 19 Home Reliability
  {
    id: "G1g7",
    mainPattern: "G",
    group: 1,
    riders: ["SAGS", "P2"],
    prediction: "1",
  },
  {
    id: "G1g9",
    mainPattern: "G",
    group: 1,
    riders: ["WAGS", "P7"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED: user req

  // Base Group 1
  {
    id: "G1g1",
    mainPattern: "G",
    group: 1,
    riders: ["EWAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G1g2",
    mainPattern: "G",
    group: 1,
    riders: ["EWHGS"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G1g3",
    mainPattern: "G",
    group: 1,
    riders: ["SAGS"],
    prediction: "12",
    primaryPrediction: "1",
  },
  // G1g4 UPDATED (Batch 30)
  {
    id: "G1g4",
    mainPattern: "G",
    group: 1,
    riders: ["WAGS"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G1g19",
    mainPattern: "G",
    group: 1,
    riders: ["P2"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED: user req

  {
    id: "G3g3",
    mainPattern: "G",
    group: 3,
    riders: ["ESHGS", "EWAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G2g6",
    mainPattern: "G",
    group: 2,
    riders: ["EWHGS", "P1", "P5"],
    prediction: "X2",
    primaryPrediction: "X",
  }, // UPDATED
  {
    id: "G2g7",
    mainPattern: "G",
    group: 2,
    riders: ["ESHGS", "P5"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED: user req
  {
    id: "G2g8",
    mainPattern: "G",
    group: 2,
    riders: ["ESHGS", "P2"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G2g5",
    mainPattern: "G",
    group: 2,
    riders: ["SHGS", "P2"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G2g4",
    mainPattern: "G",
    group: 2,
    riders: ["ESHGS"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G2g3",
    mainPattern: "G",
    group: 2,
    riders: ["EWHGS"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED: user req
  { id: "G2g2", mainPattern: "G", group: 2, riders: ["SHGS"], prediction: "12" },
  { id: "G2g1", mainPattern: "G", group: 2, riders: ["WHGS"], prediction: "12" },

  // G3g1 UPDATED (Batch 30)
  {
    id: "G3g1",
    mainPattern: "G",
    group: 3,
    riders: ["WAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G3g2",
    mainPattern: "G",
    group: 3,
    riders: ["SAGS"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: prim 1 fin 1X

  // --- PATTERN H ---
  { id: "G1h1", mainPattern: "H", group: 1, riders: ["WAGS"], prediction: "1" },
  {
    id: "G1h2",
    mainPattern: "H",
    group: 1,
    riders: ["SAGS"],
    prediction: "1X",
    primaryPrediction: "X",
  }, // UPDATED: user req

  {
    id: "G2h3",
    mainPattern: "H",
    group: 2,
    riders: ["SHGS", "WAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G2h1",
    mainPattern: "H",
    group: 2,
    riders: ["WAGS"],
    prediction: "1X",
  },
  {
    id: "G2h2",
    mainPattern: "H",
    group: 2,
    riders: ["SAGS"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req

  // --- PATTERN I ---
  {
    id: "G3o10",
    mainPattern: "O",
    group: 3,
    riders: ["ESHGS", "EWAGS", "EWHGA", "ESAGA", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // NEW: 4-flag capture
  {
    id: "G3o7",
    mainPattern: "O",
    group: 3,
    riders: ["EWHGA", "ESAGA", "A_BAL"],
    prediction: "X2",
    primaryPrediction: "2",
  }, // UPDATED
  {
    id: "G3i4",
    mainPattern: "I",
    group: 3,
    riders: ["ESHGS", "EWAGS", "WHGA", "SAGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req
  {
    id: "G3i1",
    mainPattern: "I",
    group: 3,
    riders: ["P3"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G3i3",
    mainPattern: "I",
    group: 3,
    riders: ["EWHGA", "ESAGA", "P1", "P3", "P5"],
    prediction: "1X",
    primaryPrediction: "X",
  }, // UPDATED
  {
    id: "G3i2",
    mainPattern: "I",
    group: 3,
    riders: ["SHGS", "WAGS", "WHGA", "SAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },

  {
    id: "G1i17",
    mainPattern: "I",
    group: 1,
    riders: ["EWHGS", "ESAGS", "SHGA", "WAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G1i19",
    mainPattern: "I",
    group: 1,
    riders: ["EWHGS", "ESAGS", "ESHGA", "EWAGA", "TS_HOME_STRONG"],
    prediction: "12",
    primaryPrediction: "1",
  },
  // UPDATED G1i16 -> 12 (prim 1)
  {
    id: "G1i16",
    mainPattern: "I",
    group: 1,
    riders: ["EWHGS", "ESAGS", "ESHGA", "EWAGA"],
    prediction: "12",
    primaryPrediction: "2",
  },
  {
    id: "G1i9",
    mainPattern: "I",
    group: 1,
    riders: ["EWHGA", "ESAGS"],
    prediction: "1",
  },

  {
    id: "G1i14",
    mainPattern: "I",
    group: 1,
    riders: ["ESHGA", "SAGS", "P5"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G1i13",
    mainPattern: "I",
    group: 1,
    riders: ["ESHGA", "SAGS", "P2", "P7"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G1i10",
    mainPattern: "I",
    group: 1,
    riders: ["ESHGA", "SAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED: user req

  // G1i6 UPDATED (Batch 30)
  {
    id: "G1i6",
    mainPattern: "I",
    group: 1,
    riders: ["SAGS", "P2", "P5"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G1i7",
    mainPattern: "I",
    group: 1,
    riders: ["SAGS", "P4"],
    prediction: "1",
  },
  {
    id: "G1i4",
    mainPattern: "I",
    group: 1,
    riders: ["ESAGS", "P4"],
    prediction: "1",
  },
  {
    id: "G1i8",
    mainPattern: "I",
    group: 1,
    riders: ["ESAGS", "P2"],
    prediction: "1",
  },
  { id: "G1i5", mainPattern: "I", group: 1, riders: ["P4"], prediction: "2" },
  // Base Group 1
  {
    id: "G1i11",
    mainPattern: "I",
    group: 1,
    riders: ["SHGA", "P3", "P7"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED
  {
    id: "G1i12",
    mainPattern: "I",
    group: 1,
    riders: ["SHGA", "P3", "P4"],
    prediction: "2",
  },
  {
    id: "G1i15",
    mainPattern: "I",
    group: 1,
    riders: ["SHGA", "P3"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED
  {
    id: "G1i1",
    mainPattern: "I",
    group: 1,
    riders: ["SHGA"],
    prediction: "X2",
    primaryPrediction: "2",
  }, // UPDATED: user req
  {
    id: "G1i2",
    mainPattern: "I",
    group: 1,
    riders: ["ESAGS"],
    prediction: "X2",
    primaryPrediction: "2",
  }, // UPDATED
  { id: "G1i3", mainPattern: "I", group: 1, riders: ["SAGS"], prediction: "2" },

  // Deleted redundant I upset pattern (redundant with FF48)
  {
    id: "G2i7",
    mainPattern: "I",
    group: 2,
    riders: ["SAGS", "P1", "P2", "P5"],
    prediction: "X",
  },
  {
    id: "G2i5",
    mainPattern: "I",
    group: 2,
    riders: ["ESAGS", "ESHGA"],
    prediction: "1X",
    primaryPrediction: "X",
  },
  {
    id: "G2i6",
    mainPattern: "I",
    group: 2,
    riders: ["SAGS", "ESAGA"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED: G2i6 -> 12
  {
    id: "G2i9",
    mainPattern: "I",
    group: 2,
    riders: ["ESAGS", "ESAGA"],
    prediction: "X2",
    primaryPrediction: "X",
  },
  {
    id: "G2i10",
    mainPattern: "I",
    group: 2,
    riders: ["WAGS", "EWAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G2i8",
    mainPattern: "I",
    group: 2,
    riders: ["WHGA", "P2"],
    prediction: "12",
    primaryPrediction: "2",
  },
  {
    id: "G2i11",
    mainPattern: "I",
    group: 2,
    riders: ["WHGA", "P5"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G2i4",
    mainPattern: "I",
    group: 2,
    riders: ["WHGA"],
    prediction: "X2",
    primaryPrediction: "2",
  }, // UPDATED

  {
    id: "G2i1",
    mainPattern: "I",
    group: 2,
    riders: ["SHGA"],
    prediction: "1X",
  },
  { id: "G2i2", mainPattern: "I", group: 2, riders: ["SAGS"], prediction: "2" },
  {
    id: "G2i3",
    mainPattern: "I",
    group: 2,
    riders: ["ESHGA", "EWAGS"],
    prediction: "1",
  },

  // --- PATTERN J ---
  // Group 1 Specifics
  // G1j3_fix updated above
  {
    id: "G1j9",
    mainPattern: "J",
    group: 1,
    riders: ["SAGA", "P1", "P2", "P5"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req
  // UPDATED G1j7 to 1X
  {
    id: "G1j7",
    mainPattern: "J",
    group: 1,
    riders: ["SAGA", "P2", "P4"],
    prediction: "1X",
  },
  {
    id: "G1j6",
    mainPattern: "J",
    group: 1,
    riders: ["SHGA", "P2"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: Batch 21 Draw Insurance
  {
    id: "G1j8",
    mainPattern: "J",
    group: 1,
    riders: ["SHGS", "WHGA"],
    prediction: "X",
  },
  {
    id: "G1j5",
    mainPattern: "J",
    group: 1,
    riders: ["ESAGA", "P4"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED
  {
    id: "G1j4",
    mainPattern: "J",
    group: 1,
    riders: ["ESHGA"],
    prediction: "12",
    primaryPrediction: "1",
  },
  // Base Group 1
  {
    id: "G1j2",
    mainPattern: "J",
    group: 1,
    riders: ["ESAGA"],
    prediction: "12",
    primaryPrediction: "2",
  }, // BANNED: UPSET RISK
  {
    id: "G1j1",
    mainPattern: "J",
    group: 1,
    riders: ["SAGA"],
    prediction: "X2",
    primaryPrediction: "2",
  }, // UPDATED
  {
    id: "G1j3",
    mainPattern: "J",
    group: 1,
    riders: ["SHGA"],
    prediction: "X2",
    primaryPrediction: "X",
  },
  {
    id: "G1j10",
    mainPattern: "J",
    group: 1,
    riders: ["ESHGA", "P2"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED

  {
    id: "G2j9",
    mainPattern: "J",
    group: 2,
    riders: ["ESHGA", "EWAGA", "P5"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G2j5",
    mainPattern: "J",
    group: 2,
    riders: ["ESHGA", "P5"],
    prediction: "X2",
    primaryPrediction: "2",
  },
  {
    id: "G2j6",
    mainPattern: "J",
    group: 2,
    riders: ["ESAGA", "P2", "P5"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED
  {
    id: "G2j7",
    mainPattern: "J",
    group: 2,
    riders: ["ESAGA", "P4"],
    prediction: "1",
  },
  { id: "G2j1", mainPattern: "J", group: 2, riders: ["SAGA"], prediction: "2" },
  {
    id: "G2j2",
    mainPattern: "J",
    group: 2,
    riders: ["ESAGA"],
    prediction: "X2",
    primaryPrediction: "X",
  },
  { id: "G2j3", mainPattern: "J", group: 2, riders: ["SHGA"], prediction: "1" },
  {
    id: "G2j8",
    mainPattern: "J",
    group: 2,
    riders: ["ESHGA", "POTENTIAL_DRAW"],
    prediction: "1",
  },
  {
    id: "G2j11",
    mainPattern: "J",
    group: 2,
    riders: ["ESHGA", "EWAGA", "TS_DIFF_DRAW"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G2j4",
    mainPattern: "J",
    group: 2,
    riders: ["ESHGA", "EWAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  },

  // Group 3 (Replaced)
  // NEW G3j10
  {
    id: "G3j10",
    mainPattern: "J",
    group: 3,
    riders: ["SHGA", "WAGA", "H_BAL"],
    prediction: "2",
  },
  {
    id: "G3j6",
    mainPattern: "J",
    group: 3,
    riders: ["SHGA", "P2"],
    prediction: "X2",
    primaryPrediction: "2",
  },
  {
    id: "G3j7",
    mainPattern: "J",
    group: 3,
    riders: ["SAGA", "P2", "P4"],
    prediction: "2",
  }, // UPDATED
  {
    id: "G3j8",
    mainPattern: "J",
    group: 3,
    riders: ["SHGS", "WHGA"],
    prediction: "X",
  },
  {
    id: "G3j9",
    mainPattern: "J",
    group: 3,
    riders: ["SAGA", "P1", "P2", "P5"],
    prediction: "12",
    primaryPrediction: "2",
  },
  {
    id: "G3j5",
    mainPattern: "J",
    group: 3,
    riders: ["ESAGA", "P4"],
    prediction: "2",
  },
  {
    id: "G3j1",
    mainPattern: "J",
    group: 3,
    riders: ["SAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED: user req
  // G3j2
  {
    id: "G3j2",
    mainPattern: "J",
    group: 3,
    riders: ["EWHGA", "ESAGA"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED: Batch 22
  {
    id: "G3j3",
    mainPattern: "J",
    group: 3,
    riders: ["SHGA"],
    prediction: "1X",
  },
  {
    id: "G3j4",
    mainPattern: "J",
    group: 3,
    riders: ["ESHGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED

  // --- PATTERN K ---
  {
    id: "G1k3",
    mainPattern: "K",
    group: 1,
    riders: ["P1", "P3"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: prim X fin 1X
  // G1k2 UPDATED (Batch 30)
  {
    id: "G1k2",
    mainPattern: "K",
    group: 1,
    riders: ["P2", "P3"],
    prediction: "X2",
    primaryPrediction: "X",
  },
  // Base Group 1
  {
    id: "G1k1",
    mainPattern: "K",
    group: 1,
    riders: [],
    prediction: "12",
    primaryPrediction: "1",
  },

  {
    id: "G2k1",
    mainPattern: "K",
    group: 2,
    riders: ["WAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G2k2",
    mainPattern: "K",
    group: 2,
    riders: ["WHGS"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req

  // --- PATTERN L ---
  { id: "G1l1", mainPattern: "L", group: 1, riders: [], prediction: "12" },

  {
    id: "G2l1",
    mainPattern: "L",
    group: 2,
    riders: ["WHGS"],
    prediction: "12",
    primaryPrediction: "1",
  },

  // --- PATTERN M ---
  {
    id: "G1m5",
    mainPattern: "M",
    group: 1,
    riders: ["P1", "P5"],
    prediction: "2",
  },
  { id: "G1m4", mainPattern: "M", group: 1, riders: ["P4"], prediction: "1" },
  { id: "G1m2", mainPattern: "M", group: 1, riders: ["P7"], prediction: "1" },
  {
    id: "G3m2",
    mainPattern: "M",
    group: 3,
    riders: ["P1", "P2", "P3"],
    prediction: "12",
    primaryPrediction: "2",
  },
  // Group 1 Base
  {
    id: "G1m1",
    mainPattern: "M",
    group: 1,
    riders: [],
    prediction: "1X",
    primaryPrediction: "X",
  },

  {
    id: "G2m10",
    mainPattern: "M",
    group: 2,
    riders: ["EWHGA", "ESAGA", "POTENTIAL_DRAW"],
    prediction: "X2",
  },
  {
    id: "G2m5",
    mainPattern: "M",
    group: 2,
    riders: ["ESAGA", "P5"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G2m6",
    mainPattern: "M",
    group: 2,
    riders: ["EWAGA", "P5"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G2m7",
    mainPattern: "M",
    group: 2,
    riders: ["WAGA", "P2"],
    prediction: "1X",
    primaryPrediction: "X",
  },
  {
    id: "G2m8",
    mainPattern: "M",
    group: 2,
    riders: ["ESAGA", "P4"],
    prediction: "1",
  },
  {
    id: "G2m9",
    mainPattern: "M",
    group: 2,
    riders: ["EWAGA", "P1"],
    prediction: "12",
    primaryPrediction: "1",
  },

  {
    id: "G2m1",
    mainPattern: "M",
    group: 2,
    riders: ["WAGA"],
    prediction: "1X",
  },
  {
    id: "G2m2",
    mainPattern: "M",
    group: 2,
    riders: ["EWAGA"],
    prediction: "12",
    primaryPrediction: "2",
  },
  {
    id: "G2m3",
    mainPattern: "M",
    group: 2,
    riders: ["SAGA"],
    prediction: "12",
  },
  {
    id: "G2m4",
    mainPattern: "M",
    group: 2,
    riders: ["ESAGA"],
    prediction: "X2",
  },

  {
    id: "G3m3",
    mainPattern: "M",
    group: 3,
    riders: [],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G3m1",
    mainPattern: "M",
    group: 3,
    riders: ["P3"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req

  // --- PATTERN O ---
  // UPDATED G1o4: prim 1 fin 12
  {
    id: "G1o4",
    mainPattern: "O",
    group: 1,
    riders: ["WHGA"],
    prediction: "1X",
    primaryPrediction: "1",
  },

  {
    id: "G1o13",
    mainPattern: "O",
    group: 1,
    riders: ["ESHGS", "EWAGS", "SHGA", "WAGA", "TSB_1", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: G1o13 -> 12
  {
    id: "G3o6",
    mainPattern: "O",
    group: 3,
    riders: ["SHGS", "WAGS", "EWHGA", "ESAGA", "A_BAL"],
    prediction: "X2",
    primaryPrediction: "X",
  }, // UPDATED
  {
    id: "G1o11",
    mainPattern: "O",
    group: 1,
    riders: ["ESHGS", "EWAGS", "SHGA", "WAGA", "TS_HOME_STRONG"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G2o8",
    mainPattern: "O",
    group: 2,
    riders: ["ESHGS", "EWAGS", "ESHGA", "EWAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G2o7",
    mainPattern: "O",
    group: 2,
    riders: ["ESHGS", "EWAGS"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: Batch 19 Away Lock
  {
    id: "G2o6",
    mainPattern: "O",
    group: 2,
    riders: ["EWHGS", "ESAGS", "ESHGA", "EWAGA", "TSB_1"],
    prediction: "1X",
  },
  {
    id: "G2o5",
    mainPattern: "O",
    group: 2,
    riders: ["EWHGS", "EWHGA"],
    prediction: "2",
    primaryPrediction: "2",
  },

  {
    id: "G1o8",
    mainPattern: "O",
    group: 1,
    riders: ["WHGA", "P1", "P5", "P7"],
    prediction: "2",
  },
  {
    id: "G1o7",
    mainPattern: "O",
    group: 1,
    riders: ["SHGA", "TSB_1"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G1o6",
    mainPattern: "O",
    group: 1,
    riders: ["P2", "P4", "P5"],
    prediction: "2",
  },
  // Group 3 Specific
  {
    id: "G3o5",
    mainPattern: "O",
    group: 3,
    riders: ["P7"],
    prediction: "1X",
    primaryPrediction: "1",
  },

  // Group 1
  {
    id: "G1o9",
    mainPattern: "O",
    group: 1,
    riders: ["WHGS", "P2", "P5"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED
  {
    id: "G1o10",
    mainPattern: "O",
    group: 1,
    riders: ["ESHGS", "SHGA"],
    prediction: "2",
  },
  {
    id: "G1o1",
    mainPattern: "O",
    group: 1,
    riders: ["SHGS"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED: user req
  {
    id: "G1o2",
    mainPattern: "O",
    group: 1,
    riders: ["WHGS"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED: G1o2 -> 12
  { id: "G1o3", mainPattern: "O", group: 1, riders: ["SHGA"], prediction: "12" },
  {
    id: "G1o5",
    mainPattern: "O",
    group: 1,
    riders: ["ESHGS", "SHGA"],
    prediction: "12",
  },

  // Group 2
  {
    id: "G2o1",
    mainPattern: "O",
    group: 2,
    riders: ["SHGS"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G2o2",
    mainPattern: "O",
    group: 2,
    riders: ["WHGS"],
    prediction: "12",
    primaryPrediction: "1",
  },
  { id: "G2o3", mainPattern: "O", group: 2, riders: ["SHGA"], prediction: "1" },
  {
    id: "G2o4",
    mainPattern: "O",
    group: 2,
    riders: ["WHGA"],
    prediction: "X2",
    primaryPrediction: "X",
  },
  // UPDATED G2o15 -> 12 (prim 1)
  {
    id: "G2o15",
    mainPattern: "O",
    group: 2,
    riders: ["EWHGA", "ESAGA", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  },

  {
    id: "G2o17",
    mainPattern: "O",
    group: 2,
    riders: ["WHGS", "SAGS", "EWHGA", "ESAGA", "TSB_1", "A_BAL"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED

  // Group 3 Base
  {
    id: "G3o1",
    mainPattern: "O",
    group: 3,
    riders: ["SHGS"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G3o2",
    mainPattern: "O",
    group: 3,
    riders: ["WHGS"],
    prediction: "12",
    primaryPrediction: "2",
  },
  {
    id: "G3o3",
    mainPattern: "O",
    group: 3,
    riders: ["SHGA"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G3o4",
    mainPattern: "O",
    group: 3,
    riders: ["WHGA"],
    prediction: "X2",
    primaryPrediction: "2",
  },
  {
    id: "G3o9",
    mainPattern: "O",
    group: 3,
    riders: ["A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED

  // --- PATTERN P ---
  {
    id: "G1p7",
    mainPattern: "P",
    group: 1,
    riders: ["ESHGS", "EWAGS", "TSB_1", "A_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // External App Logic
  {
    id: "G2p11",
    mainPattern: "P",
    group: 2,
    riders: ["TSB_1"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED
  {
    id: "G2p9",
    mainPattern: "P",
    group: 2,
    riders: ["EWHGS", "ESAGS", "A_BAL"],
    prediction: "X2",
  }, // Updated G2p9 per Critical Pattern Insight
  // Batch 8 Update G2p10 -> 1X (Banker)
  {
    id: "G2p10",
    mainPattern: "P",
    group: 2,
    riders: ["A_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G2p4",
    mainPattern: "P",
    group: 2,
    riders: ["ESHGS"],
    prediction: "1",
  },
  {
    id: "G1p5",
    mainPattern: "P",
    group: 1,
    riders: ["SHGS", "TSB_1"],
    prediction: "2",
  },
  { id: "G1p6", mainPattern: "P", group: 1, riders: ["P3"], prediction: "1X" },
  { id: "G1p3", mainPattern: "P", group: 1, riders: ["P1"], prediction: "1X" },
  // Group 2 Specific
  { id: "G2p2", mainPattern: "P", group: 2, riders: ["P1"], prediction: "1X" },

  {
    id: "G2p5",
    mainPattern: "P",
    group: 2,
    riders: ["EWHGS"],
    prediction: "1X",
    primaryPrediction: "X",
  },
  {
    id: "G2p6",
    mainPattern: "P",
    group: 2,
    riders: ["WHGS", "P2", "P4"],
    prediction: "1",
  },
  {
    id: "G2p7",
    mainPattern: "P",
    group: 2,
    riders: ["ESHGS", "P2"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G2p8",
    mainPattern: "P",
    group: 2,
    riders: ["EWHGS", "P2", "P4"],
    prediction: "1",
  },

  // Group 2 Base
  {
    id: "G2p1",
    mainPattern: "P",
    group: 2,
    riders: ["WHGS"],
    prediction: "X2",
    primaryPrediction: "2",
  },
  {
    id: "G2p3",
    mainPattern: "P",
    group: 2,
    riders: ["SHGS"],
    prediction: "1X",
    primaryPrediction: "X",
  },

  // Group 3
  {
    id: "G3p3",
    mainPattern: "P",
    group: 3,
    riders: ["EWHGS", "ESAGS"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: Batch 21 Home Strength
  {
    id: "G3p1",
    mainPattern: "P",
    group: 3,
    riders: ["WHGS"],
    prediction: "1X",
    primaryPrediction: "X",
  },
  { id: "G3p2", mainPattern: "P", group: 3, riders: ["SHGS"], prediction: "1" },
  // G3p5 UPDATED (Batch 30)
  {
    id: "G3p5",
    mainPattern: "P",
    group: 3,
    riders: ["WHGS", "SAGS", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  },

  // --- PATTERN Q ---
  // G2q2 UPDATED (Batch 30)
  {
    id: "G2q2",
    mainPattern: "Q",
    group: 2,
    riders: ["SHGA", "WAGA", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  // Batch 8 Update G3q3 -> 1X (Banker)
  {
    id: "G3q3",
    mainPattern: "Q",
    group: 3,
    riders: ["EWHGA", "ESAGA", "A_BAL"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED: user req
  {
    id: "G3q2",
    mainPattern: "Q",
    group: 3,
    riders: ["WHGA", "SAGA", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  // Batch 8 Update G2q12 -> X2
  {
    id: "G2q12",
    mainPattern: "Q",
    group: 2,
    riders: ["EWHGA", "ESAGA", "TSB_1", "A_BAL"],
    prediction: "X2",
    primaryPrediction: "2",
  },
  {
    id: "G1q13",
    mainPattern: "Q",
    group: 1,
    riders: ["TSB_1"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  // UPDATED G2q11 to 12
  {
    id: "G2q11",
    mainPattern: "Q",
    group: 2,
    riders: ["EWHGA", "ESAGA", "A_BAL"],
    prediction: "12",
  },
  {
    id: "G2q9",
    mainPattern: "Q",
    group: 2,
    riders: ["TSB_1", "P4"],
    prediction: "1",
  },
  {
    id: "G1q11",
    mainPattern: "Q",
    group: 1,
    riders: ["SHGA", "WAGA", "TSB_1"],
    prediction: "2",
  },
  {
    id: "G1q12",
    mainPattern: "Q",
    group: 1,
    riders: ["SHGA", "WAGA", "TSB_1"],
    prediction: "X2",
  },
  {
    id: "G1q10",
    mainPattern: "Q",
    group: 1,
    riders: ["SHGA", "TSB_1"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G1q9",
    mainPattern: "Q",
    group: 1,
    riders: ["TSB_1"],
    prediction: "1",
  },
  {
    id: "G1q8",
    mainPattern: "Q",
    group: 1,
    riders: ["P1", "P7"],
    prediction: "2",
  },
  // Group 3 Specific
  {
    id: "G3q1",
    mainPattern: "Q",
    group: 3,
    riders: ["P2", "P3", "P7"],
    prediction: "1",
  },

  // Group 1 Specific
  {
    id: "G1q6",
    mainPattern: "Q",
    group: 1,
    riders: ["SHGA", "P3"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED: user req
  {
    id: "G1q7",
    mainPattern: "Q",
    group: 1,
    riders: ["ESHGA", "P5"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  // Duplicate q16 fix
  {
    id: "G1q16",
    mainPattern: "Q",
    group: 1,
    riders: ["ESHGA", "EWAGA", "TS_HOME_STRONG", "A_BAL"],
    prediction: "X2",
    primaryPrediction: "2",
  },

  // Group 1 Base
  { id: "G1q1", mainPattern: "Q", group: 1, riders: ["WHGA"], prediction: "1" },
  {
    id: "G1q2",
    mainPattern: "Q",
    group: 1,
    riders: ["EWHGA"],
    prediction: "X",
  },
  {
    id: "G1q3",
    mainPattern: "Q",
    group: 1,
    riders: ["SHGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G1q4",
    mainPattern: "Q",
    group: 1,
    riders: ["ESHGA"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  { id: "G1q5", mainPattern: "Q", group: 1, riders: ["SHGA"], prediction: "12" },

  // Group 2
  {
    id: "G2q3",
    mainPattern: "Q",
    group: 2,
    riders: ["WHGA", "P2", "P4"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G2q7",
    mainPattern: "Q",
    group: 2,
    riders: ["WHGA", "P2", "P4"],
    prediction: "1",
  },
  // G2q6 UPDATED (Batch 30)
  {
    id: "G2q6",
    mainPattern: "Q",
    group: 2,
    riders: ["ESHGA", "P2"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G2q8",
    mainPattern: "Q",
    group: 2,
    riders: ["ESHGA", "P5"],
    prediction: "1X",
    primaryPrediction: "1",
  },

  {
    id: "G2q15",
    mainPattern: "Q",
    group: 2,
    riders: ["EWHGA", "ESAGA", "A_BAL"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED

  {
    id: "G2q4",
    mainPattern: "Q",
    group: 2,
    riders: ["ESHGA"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G2q5",
    mainPattern: "Q",
    group: 2,
    riders: ["EWHGA"],
    prediction: "1X",
  },
  // UPDATED G2q1 -> 12 (prim 1)
  {
    id: "G2q1",
    mainPattern: "Q",
    group: 2,
    riders: ["WHGA"],
    prediction: "12",
    primaryPrediction: "1",
  },
  // { id: 'G2q2', ... } handled above
  // G2q14 UPDATED (Batch 30)
  {
    id: "G2q14",
    mainPattern: "Q",
    group: 2,
    riders: ["WHGA", "SAGA", "TSB_1", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req

  // --- PATTERN R ---
  // UPDATED G3r1 to 1X
  { id: "G3r3", mainPattern: "R", group: 3, riders: [], prediction: "12" },
  {
    id: "G1r12",
    mainPattern: "R",
    group: 1,
    riders: ["P1", "P4", "P5"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED
  {
    id: "G1r14",
    mainPattern: "R",
    group: 1,
    riders: ["P1", "P3", "P7"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G1r13",
    mainPattern: "R",
    group: 1,
    riders: ["P1", "P5"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  // G1r8= Prim 1 fin 1X
  {
    id: "G1r8",
    mainPattern: "R",
    group: 1,
    riders: ["P1", "P2", "P3", "P5"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED: user req
  {
    id: "G1r3",
    mainPattern: "R",
    group: 1,
    riders: ["P1", "P2", "P4", "P7"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G1r5",
    mainPattern: "R",
    group: 1,
    riders: ["P1", "P3", "P5"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  // Update G1r9 to generic
  { id: "G1r9", mainPattern: "R", group: 1, riders: [], prediction: "1X" },
  {
    id: "G1r10",
    mainPattern: "R",
    group: 1,
    riders: ["P1", "P3"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED: PRIM 2 FIN 12
  // UPDATED G1r11 -> 1X (prim 1)
  {
    id: "G1r11",
    mainPattern: "R",
    group: 1,
    riders: ["P1"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED: user req
  // G1r6 UPDATED (Batch 30)
  {
    id: "G1r6",
    mainPattern: "R",
    group: 1,
    riders: ["P3"],
    prediction: "12",
    primaryPrediction: "2",
  },
  {
    id: "G1r7",
    mainPattern: "R",
    group: 1,
    riders: ["P4"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  // Group 3 Specific - Updated to generic
  { id: "G3r2", mainPattern: "R", group: 3, riders: [], prediction: "1X" },
  // Group 1 Specific
  // G1r2 UPDATED (Batch 30)
  {
    id: "G1r2",
    mainPattern: "R",
    group: 1,
    riders: ["P3", "P7"],
    prediction: "12",
    primaryPrediction: "2",
  },
  // G1r16 UPDATED (Batch 30)
  {
    id: "G1r16",
    mainPattern: "R",
    group: 1,
    riders: [],
    prediction: "12",
    primaryPrediction: "1",
  },

  // Group 1 Base
  {
    id: "G1r1",
    mainPattern: "R",
    group: 1,
    riders: [],
    prediction: "1X",
    primaryPrediction: "1",
  },

  // Group 2
  { id: "G2r1", mainPattern: "R", group: 2, riders: [], prediction: "X" },
  // Group 3 Base
  { id: "G3r1", mainPattern: "R", group: 3, riders: [], prediction: "1X" },

  // --- PATTERN S ---
  {
    id: "G2s15",
    mainPattern: "S",
    group: 2,
    riders: ["SHGS", "WAGS", "WHGA", "SAGA"],
    prediction: "12",
  },
  {
    id: "G2s14",
    mainPattern: "S",
    group: 2,
    riders: ["WHGS", "SAGS", "ESHGA", "EWAGA", "TSB_1"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G2s12",
    mainPattern: "S",
    group: 2,
    riders: ["EWHGS", "ESAGS", "SHGA", "WAGA"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED
  {
    id: "G2s11",
    mainPattern: "S",
    group: 2,
    riders: ["ESHGS", "EWAGS", "WHGA", "SAGA", "H_BAL", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  },

  // New Specifics
  {
    id: "G2s6",
    mainPattern: "S",
    group: 2,
    riders: ["EWHGS", "EWHGA", "P1", "P2", "P5"],
    prediction: "1",
  },
  {
    id: "G2s9",
    mainPattern: "S",
    group: 2,
    riders: ["WHGS", "ESHGA", "P2"],
    prediction: "1",
  }, // UPDATED

  // New Riders
  {
    id: "G2s3",
    mainPattern: "S",
    group: 2,
    riders: ["EWHGS", "ESHGA"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED
  {
    id: "G2s7",
    mainPattern: "S",
    group: 2,
    riders: ["ESHGS", "SHGA"],
    prediction: "X",
  },
  {
    id: "G2s8",
    mainPattern: "S",
    group: 2,
    riders: ["WHGS", "ESHGA"],
    prediction: "X2",
    primaryPrediction: "X",
  },
  {
    id: "G2s5",
    mainPattern: "S",
    group: 2,
    riders: ["SHGS", "EWHGA"],
    prediction: "12",
    primaryPrediction: "2",
  },
  {
    id: "G2s10",
    mainPattern: "S",
    group: 2,
    riders: ["SHGS", "EWHGA"],
    prediction: "2",
  },

  // Existing Specifics
  {
    id: "G1s8",
    mainPattern: "S",
    group: 1,
    riders: ["SAGS", "EWAGA"],
    prediction: "1X",
    primaryPrediction: "X",
  }, // UPDATED
  {
    id: "G1s6",
    mainPattern: "S",
    group: 1,
    riders: ["P3"],
    prediction: "X2",
    primaryPrediction: "X",
  },
  {
    id: "G1s5",
    mainPattern: "S",
    group: 1,
    riders: ["P1", "P2", "P3", "P5"],
    prediction: "1",
  },
  {
    id: "G1s3",
    mainPattern: "S",
    group: 1,
    riders: ["P2", "P3"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED
  {
    id: "G1s7",
    mainPattern: "S",
    group: 1,
    riders: ["P1", "P5"],
    prediction: "1X",
  },
  { id: "G1s4", mainPattern: "S", group: 1, riders: ["P3"], prediction: "1" },
  {
    id: "G1s10",
    mainPattern: "S",
    group: 1,
    riders: ["EWHGS", "ESAGS", "ESHGA", "EWAGA", "H_BAL", "A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req

  // Base Group 1
  {
    id: "G1s1",
    mainPattern: "S",
    group: 1,
    riders: ["WHGS", "WHGA"],
    prediction: "2",
  },
  {
    id: "G1s2",
    mainPattern: "S",
    group: 1,
    riders: ["SHGA", "SHGS"],
    prediction: "1",
  },

  // Group 2 Base/General
  {
    id: "G2s4",
    mainPattern: "S",
    group: 2,
    riders: ["ESAGS"],
    prediction: "1",
  }, // UPDATED
  {
    id: "G2s1",
    mainPattern: "S",
    group: 2,
    riders: ["WHGS", "WHGA"],
    prediction: "2",
  },
  {
    id: "G2s2",
    mainPattern: "S",
    group: 2,
    riders: ["SHGA", "SHGS"],
    prediction: "1",
  },
  {
    id: "G2s18",
    mainPattern: "S",
    group: 2,
    riders: ["ESHGS", "EWAGS", "H_BAL", "A_BAL"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED: user req

  // Group 3
  {
    id: "G3s1",
    mainPattern: "S",
    group: 3,
    riders: ["WHGS", "WHGA"],
    prediction: "X2",
  },
  {
    id: "G3s2",
    mainPattern: "S",
    group: 3,
    riders: ["SHGA", "SHGS"],
    prediction: "1",
  },
  {
    id: "G3s3",
    mainPattern: "S",
    group: 3,
    riders: ["WHGS", "SAGS", "SHGA", "WAGA", "H_BAL", "A_BAL"],
    prediction: "1X",
    primaryPrediction: "1",
  },

  // --- PATTERN T ---
  // Batch 8 Update G1t2 -> 1X
  {
    id: "G1t2",
    mainPattern: "T",
    group: 1,
    riders: [],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED: Batch 21 Upset Protocol
  // Group 2 Specifics
  // G2t2 UPDATED (Batch 30)
  {
    id: "G2t2",
    mainPattern: "T",
    group: 2,
    riders: ["P1", "P2", "P5"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G2t3",
    mainPattern: "T",
    group: 2,
    riders: ["P1", "P2", "P3"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED
  {
    id: "G2t4",
    mainPattern: "T",
    group: 2,
    riders: ["P1", "P2"],
    prediction: "12",
    primaryPrediction: "2",
  },

  {
    id: "G1t1",
    mainPattern: "T",
    group: 1,
    riders: [],
    prediction: "X2",
    primaryPrediction: "2",
  },
  // G2t1 UPDATED (Batch 30)
  {
    id: "G2t1",
    mainPattern: "T",
    group: 2,
    riders: [],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G3t1",
    mainPattern: "T",
    group: 3,
    riders: [],
    prediction: "1X",
    primaryPrediction: "2",
  }, // UPDATED

  // --- PATTERN U ---
  {
    id: "G1u2",
    mainPattern: "U",
    group: 1,
    riders: ["P1", "P5"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED: user req

  // Group 2
  {
    id: "G2u2",
    mainPattern: "U",
    group: 2,
    riders: ["P2", "P4"],
    prediction: "2",
  },
  {
    id: "G2u1",
    mainPattern: "U",
    group: 2,
    riders: [],
    prediction: "12",
    primaryPrediction: "1",
  },

  {
    id: "G1u1",
    mainPattern: "U",
    group: 1,
    riders: [],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req
  // Batch 8 Update G3u1 -> X2
  {
    id: "G3u1",
    mainPattern: "U",
    group: 3,
    riders: [],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED: user req

  // --- PATTERN V ---
  // Group 2
  {
    id: "G2aa3",
    mainPattern: "AA",
    group: 2,
    riders: ["SHGS", "WAGS", "ESHGA", "EWAGA", "TS_HOME_STRONG", "A_BAL"],
    prediction: "1",
  },
  {
    id: "G2v2",
    mainPattern: "V",
    group: 2,
    riders: ["P2", "P7"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED
  {
    id: "G2v1",
    mainPattern: "V",
    group: 2,
    riders: [],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED

  {
    id: "G1v1",
    mainPattern: "V",
    group: 1,
    riders: [],
    prediction: "MO",
    moCondition: "follow",
  },
  {
    id: "G3v1",
    mainPattern: "V",
    group: 3,
    riders: [],
    prediction: "MO",
    moCondition: "follow",
  },

  // --- PATTERN W ---
  {
    id: "G2w5",
    mainPattern: "W",
    group: 2,
    riders: ["ESHGS", "EWAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  { id: "G1w1", mainPattern: "W", group: 1, riders: ["SHGS"], prediction: "1" },
  {
    id: "G1w2",
    mainPattern: "W",
    group: 1,
    riders: ["ESHGS"],
    prediction: "1",
  },
  {
    id: "G1w3",
    mainPattern: "W",
    group: 1,
    riders: ["SAGS"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req
  {
    id: "G1w4",
    mainPattern: "W",
    group: 1,
    riders: ["ESAGS"],
    prediction: "12",
    primaryPrediction: "2",
  },

  { id: "G2w1", mainPattern: "W", group: 2, riders: ["SHGS"], prediction: "1" },
  {
    id: "G2w2",
    mainPattern: "W",
    group: 2,
    riders: ["ESHGS"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  { id: "G2w3", mainPattern: "W", group: 2, riders: ["SAGS"], prediction: "X" },
  {
    id: "G2w4",
    mainPattern: "W",
    group: 2,
    riders: ["ESAGS"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED: Batch 21 Trend Reversal

  {
    id: "G3w1",
    mainPattern: "W",
    group: 3,
    riders: ["SHGS"],
    prediction: "X2",
    primaryPrediction: "X",
  }, // UPDATED
  {
    id: "G3w2",
    mainPattern: "W",
    group: 3,
    riders: ["ESHGS"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED
  { id: "G3w3", mainPattern: "W", group: 3, riders: ["SAGS"], prediction: "1X" },
  {
    id: "G3w4",
    mainPattern: "W",
    group: 3,
    riders: ["ESAGS"],
    prediction: "2",
  },

  // --- PATTERN X ---
  {
    id: "G1x1",
    mainPattern: "X",
    group: 1,
    riders: ["SAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED: user req
  // G1x2 UPDATED (Batch 30)
  {
    id: "G1x2",
    mainPattern: "X",
    group: 1,
    riders: ["ESAGA"],
    prediction: "12",
    primaryPrediction: "2",
  },
  { id: "G1x3", mainPattern: "X", group: 1, riders: ["WAGA"], prediction: "1" },
  {
    id: "G1x4",
    mainPattern: "X",
    group: 1,
    riders: ["EWAGA"],
    prediction: "1",
  },

  { id: "G2x1", mainPattern: "X", group: 2, riders: ["SAGA"], prediction: "1" },
  {
    id: "G2x2",
    mainPattern: "X",
    group: 2,
    riders: ["ESAGA"],
    prediction: "X2",
    primaryPrediction: "2",
  }, // UPDATED
  { id: "G2x3", mainPattern: "X", group: 2, riders: ["WAGA"], prediction: "X2" },
  {
    id: "G2x4",
    mainPattern: "X",
    group: 2,
    riders: ["EWAGA"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED

  { id: "G3x1", mainPattern: "X", group: 3, riders: ["SAGA"], prediction: "X" },
  {
    id: "G3x2",
    mainPattern: "X",
    group: 3,
    riders: ["ESAGA"],
    prediction: "2",
  },
  {
    id: "G3x3",
    mainPattern: "X",
    group: 3,
    riders: ["WAGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: Batch 21 Draw Trap
  {
    id: "G3x4",
    mainPattern: "X",
    group: 3,
    riders: ["EWAGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req

  // --- PATTERN Y ---
  { id: "G1y1", mainPattern: "Y", group: 1, riders: ["WAGS"], prediction: "1" },
  { id: "G1y2", mainPattern: "Y", group: 1, riders: ["SAGS"], prediction: "X" },

  // Batch 8 Update G2y1 -> 12
  {
    id: "G2y1",
    mainPattern: "Y",
    group: 2,
    riders: ["WAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED: Batch 19 Calibration
  {
    id: "G2y2",
    mainPattern: "Y",
    group: 2,
    riders: ["SAGS"],
    prediction: "12",
    primaryPrediction: "2",
  },

  { id: "G3y1", mainPattern: "Y", group: 3, riders: ["WAGS"], prediction: "X2" },
  { id: "G3y2", mainPattern: "Y", group: 3, riders: ["SAGS"], prediction: "X" },

  // --- PATTERN Z ---
  {
    id: "G1z1",
    mainPattern: "Z",
    group: 1,
    riders: [],
    prediction: "MO",
    moCondition: "follow",
  },
  {
    id: "G2z1",
    mainPattern: "Z",
    group: 2,
    riders: [],
    prediction: "MO",
    moCondition: "follow",
  },
  { id: "G3z1", mainPattern: "Z", group: 3, riders: [], prediction: "2" },

  // --- PATTERN AA ---
  {
    id: "G1aa5",
    mainPattern: "AA",
    group: 1,
    riders: ["WHGS", "SAGS", "ESHGA", "EWAGA", "TS_HOME_STRONG"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED: user req
  {
    id: "G1aa4",
    mainPattern: "AA",
    group: 1,
    riders: ["WHGS", "SAGS", "ESHGA", "EWAGA", "TS_HOME_STRONG"],
    prediction: "2",
  },
  {
    id: "G1aa1",
    mainPattern: "AA",
    group: 1,
    riders: ["SHGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G1aa2",
    mainPattern: "AA",
    group: 1,
    riders: ["ESHGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req
  {
    id: "G1aa3",
    mainPattern: "AA",
    group: 1,
    riders: ["WHGA"],
    prediction: "2",
  },

  {
    id: "G2aa1",
    mainPattern: "AA",
    group: 2,
    riders: ["SHGA"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: PRIM X FIN X2
  {
    id: "G2aa2",
    mainPattern: "AA",
    group: 2,
    riders: ["WHGA"],
    prediction: "12",
    primaryPrediction: "1",
  },

  // Group 3
  {
    id: "G3aa5",
    mainPattern: "AA",
    group: 3,
    riders: ["SHGS", "WAGS", "EWHGA", "ESAGA"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED
  {
    id: "G3aa3",
    mainPattern: "AA",
    group: 3,
    riders: ["WAGS", "WHGA"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G3aa4",
    mainPattern: "AA",
    group: 3,
    riders: ["WAGS", "EWHGA"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G3aa1",
    mainPattern: "AA",
    group: 3,
    riders: ["SHGA"],
    prediction: "1",
  },

  // --- PATTERN BB ---
  {
    id: "G1bb6",
    mainPattern: "BB",
    group: 1,
    riders: ["SAGS", "P3", "P4"],
    prediction: "2",
  },
  // Group 1 Specific
  {
    id: "G1bb5",
    mainPattern: "BB",
    group: 1,
    riders: ["SAGS", "P3", "P7"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  // Group 1 Base
  {
    id: "G1bb1",
    mainPattern: "BB",
    group: 1,
    riders: ["SAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED
  {
    id: "G1bb2",
    mainPattern: "BB",
    group: 1,
    riders: ["ESAGS"],
    prediction: "12",
    primaryPrediction: "1",
  }, // UPDATED: user req
  {
    id: "G1bb3",
    mainPattern: "BB",
    group: 1,
    riders: ["WAGS"],
    prediction: "X",
  },
  {
    id: "G1bb4",
    mainPattern: "BB",
    group: 1,
    riders: ["EWAGS"],
    prediction: "1",
  },

  {
    id: "G2bb1",
    mainPattern: "BB",
    group: 2,
    riders: ["SAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G2bb5",
    mainPattern: "BB",
    group: 2,
    riders: ["ESAGS", "P4"],
    prediction: "1X",
  },
  {
    id: "G2bb2",
    mainPattern: "BB",
    group: 2,
    riders: ["ESAGS"],
    prediction: "12",
    primaryPrediction: "2",
  }, // UPDATED
  {
    id: "G2bb3",
    mainPattern: "BB",
    group: 2,
    riders: ["WAGS"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G2bb4",
    mainPattern: "BB",
    group: 2,
    riders: ["EWAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  },

  {
    id: "G3bb1",
    mainPattern: "BB",
    group: 3,
    riders: ["SAGS"],
    prediction: "2",
  },
  {
    id: "G3bb2",
    mainPattern: "BB",
    group: 3,
    riders: ["ESAGS"],
    prediction: "2",
  },
  {
    id: "G3bb3",
    mainPattern: "BB",
    group: 3,
    riders: ["WAGS"],
    prediction: "1X",
    primaryPrediction: "X",
  }, // UPDATED
  {
    id: "G3bb4",
    mainPattern: "BB",
    group: 3,
    riders: ["EWAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  }, // UPDATED: user req

  // --- NEW PATTERNS KK3, OO1, PP1 ---
  {
    id: "G1kk3",
    mainPattern: "KK",
    group: 1,
    riders: ["SHGA", "WAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G2kk3",
    mainPattern: "KK",
    group: 2,
    riders: ["SHGA", "WAGA"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G3kk3",
    mainPattern: "KK",
    group: 3,
    riders: ["SHGA", "WAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },

  {
    id: "G1oo1",
    mainPattern: "OO",
    group: 1,
    riders: ["WHGS", "SAGS"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G2oo1",
    mainPattern: "OO",
    group: 2,
    riders: ["WHGS", "SAGS"],
    prediction: "1X",
    primaryPrediction: "1",
  },
  {
    id: "G3oo1",
    mainPattern: "OO",
    group: 3,
    riders: ["WHGS", "SAGS"],
    prediction: "12",
    primaryPrediction: "1",
  },

  {
    id: "G1oo2",
    mainPattern: "OO",
    group: 1,
    riders: ["SHGS", "WAGS"],
    prediction: "12",
    primaryPrediction: "2",
  },
  {
    id: "G2oo2",
    mainPattern: "OO",
    group: 2,
    riders: ["SHGS", "WAGS"],
    prediction: "12",
    primaryPrediction: "2",
  },
  {
    id: "G3oo2",
    mainPattern: "OO",
    group: 3,
    riders: ["SHGS", "WAGS"],
    prediction: "12",
    primaryPrediction: "2",
  },

  {
    id: "G1pp1",
    mainPattern: "PP",
    group: 1,
    riders: ["WHGA", "SAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G2pp1",
    mainPattern: "PP",
    group: 2,
    riders: ["WHGA", "SAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G3pp1",
    mainPattern: "PP",
    group: 3,
    riders: ["WHGA", "SAGA"],
    prediction: "12",
    primaryPrediction: "1",
  },

  {
    id: "G1pp2",
    mainPattern: "PP",
    group: 1,
    riders: ["A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G2pp2",
    mainPattern: "PP",
    group: 2,
    riders: ["A_BAL"],
    prediction: "12",
    primaryPrediction: "1",
  },
  {
    id: "G3pp2",
    mainPattern: "PP",
    group: 3,
    riders: ["A_BAL"],
    prediction: "12",
    primaryPrediction: "2",
  },
];

export const analyzeSubPatterns = (
  match: Match,
  mainPattern: string,
  flags: ReturnType<typeof calculateFlags>,
  legacyPatterns: string[],
  maxPoints: number,
) => {
  const activeConditions = new Set<string>();
  Object.entries(flags).forEach(([k, v]) => {
    if (v) activeConditions.add(k);
  });
  legacyPatterns.forEach((p) => activeConditions.add(p));

  const patternConditions = getPatternConditions(match);

  // CHANGED: Filter and Sort strategy instead of .find() to ensure specificity
  const relevantRules = SUB_PATTERN_RULES.filter((r) => {
    // 1. Check Main Pattern & Group
    if (r.mainPattern !== mainPattern) return false;
    if (r.group !== match.group) return false;

    // 2. Check Pattern Definition (Redundant if Main Pattern logic is solid, but safe)
    if (!matchesPatternDefinition(patternConditions, r.mainPattern))
      return false;

    // 3. Check Riders
    const pPatterns = r.riders.filter((x) => x.startsWith("P") && /\d/.test(x));
    const flagPatterns = r.riders.filter(
      (x) => !x.startsWith("P") || !/\d/.test(x),
    );

    // 3a. Check Flags
    if (!flagPatterns.every((f) => activeConditions.has(f))) return false;

    // 3b. Check P-Patterns (Exact match on presence)
    if (pPatterns.length > 0) {
      const matchPPatterns = legacyPatterns.filter(
        (p) => p.startsWith("P") && /\d/.test(p),
      );
      // If rule expects riders, match must have them.
      if (!pPatterns.every((p) => activeConditions.has(p))) return false;
    }

    return true;
  });

  // SORT: Most specific (highest number of riders) first
  relevantRules.sort((a, b) => b.riders.length - a.riders.length);

  const rule = relevantRules.length > 0 ? relevantRules[0] : null;

  if (!rule) return null;

  let prediction = rule.prediction;

  if (prediction === "MO" || prediction === "Upset") {
    try {
      const parts = match.mo?.split(",").map((s) => parseFloat(s.trim())) || [];
      if (parts.length >= 3 && !parts.some(isNaN)) {
        const sorted = [...parts].sort((a, b) => a - b);
        const minVal = sorted[0];

        if (rule.moCondition === "min<2.0" && minVal >= 2.0) {
          prediction = "1";
        } else if (rule.moCondition === "min>2.0" && minVal <= 2.0) {
          prediction = "1";
        } else {
          if (Math.abs(sorted[0] - sorted[1]) <= 0.2) {
            prediction = "X";
          } else {
            const idx = parts.indexOf(minVal);
            prediction = idx === 0 ? "1" : idx === 1 ? "X" : "2";
          }
        }
      } else {
        prediction = "1";
      }
    } catch {
      prediction = "1";
    }
  }

  // --- LOGIC REMOVED FROM HERE ---
  // Conditional Overrides are now handled in algorithm.tsx via applyPatternOverrides

  return {
    subPattern: rule.id,
    prediction,
    override: null,
    applied: true,
    matchedRiders: rule.riders,
    primaryPrediction: rule.primaryPrediction,
  };
};
