import * as fs from 'fs';
import * as path from 'path';

const extractorPath = path.join(process.cwd(), 'src/utils/mlFeatureExtractor.ts');
let content = fs.readFileSync(extractorPath, 'utf8');

// 1. Update MLFeatures Interface
content = content.replace(
  'study4_paa: { fav: number; draw: number; underdog: number } | null;',
  'study4_paa: { fav: number; draw: number; underdog: number } | null;\n  study4_paaPrimary: string | null;'
);

content = content.replace(
  'study6_seer: { fav: number; draw: number; underdog: number } | null;',
  'study6_seer: { fav: number; draw: number; underdog: number } | null;\n  study6_seerPrimary: string | null;'
);

// 2. Update extractMLFeatures return object
content = content.replace(
  'study4_paa: paa,',
  'study4_paa: paa,\n      study4_paaPrimary: match.paaPrimaryPrediction || null,'
);

content = content.replace(
  'study6_seer: seer,',
  'study6_seer: seer,\n      study6_seerPrimary: match.seerPrimaryPrediction || null,'
);

// 3. Replace ML_BASE_PATTERNS_DESCRIPTIONS
const newDescriptions = `export const ML_BASE_PATTERNS_DESCRIPTIONS: Record<string, string> = {
  "SIa": "Draw odds < 3.0",
  "SIb": "Underdog Market odds < Draw odds",
  "SIc": "PAA prim supports M.fav",
  "SId": "PAA prim supports Draw",
  "SIe": "PAA prim supports Underdog",
  "SIf": "Sub prim pattern supports M.fav",
  "SIg": "Sub prim pattern supports draw",
  "SIh": "Sub patt prim supports underdog",
  "SIi": "Seer prim supports M.fav",
  "SIj": "Seer primary supports Draw",
  "SIk": "Seer prim supports Underdog",
  "SIl": "Algo prim supports M.fav",
  "SIm": "Algo prim supports Draw",
  "SIn": "Algo prim supports Underdog",
  "SIo": "All predictors prim support M.fav",
  "SIp": "All predictors prim supports draw",
  "SIq": "All predictors prim support Underdog",
  "SIr": "Algo+paa+seer prim support M.fav",
  "SIs": "Algo+paa+seer prim support Draw",
  "SIt": "Algo+paa+seer prim support Underdog",
  "SIu": "Algo+paa+sub patt prim support M.fav",
  "SIv": "Algo+paa+sub patt prim support Draw",
  "SIw": "Algo+paa+sub patt prim support Underdog",
  "SIx": "Algo+Sub patt+seer prim support M.fav",
  "SIy": "Algo+sub patt+seer prim support Draw",
  "SIz": "Algo+Sub patt+seer prim support Underdog",
  "SIaa": "Sub patt+paa+seer prim support M.fav",
  "SIbb": "Sub patt+paa+seer prim support Draw",
  "SIcc": "Sub patt+paa+seer prim support Underdog",
  "SIdd": "Point system supports underdog",
  "SIee": "TS supports Underdog",
  "SIff": "Underdog has hidden strenghth",
  "SIgg": "Algo+paa prim support M.fav",
  "SIhh": "Algo+paaprim support Draw",
  "SIii": "Algo+paa prim support Underdog",
  "SIjj": "Algo+seer prim support M.fav",
  "SIkk": "Algo+seer+ prim support Draw",
  "SIll": "Algo+seer prim support Underdog",
  "SImm": "Algo+Sub patt prim support M.fav",
  "SInn": "Algo+Sub patt prim support Draw",
  "SIoo": "Algo+Sub patt prim support Underdog",
  "SIpp": "paa+seer support M.fav",
  "SIqq": "PAA+seer prim support Draw",
  "SIrr": "PAA+seer prim support Underdog",
  "SIss": "PAA+Sub patt prim support M.fav",
  "SItt": "PAA+Sub patt prim support Draw",
  "SIuu": "PAA+Sub patt prim support Underdog",
  "SIvv": "seer+Sub patt prim support M.fav",
  "SIww": "seer+Sub patt prim support Draw",
  "SIxx": "seer+Sub patt prim support Underdog"
};`;

content = content.replace(
  /export const ML_BASE_PATTERNS_DESCRIPTIONS: Record<string, string> = \{[\s\S]*?\};/,
  newDescriptions
);

// 4. Rewrite generateSITags
const newGenerateTags = `export function generateSITags(features: MLFeatures): string[] {
  const tags: string[] = [];
  const basePatterns: string[] = [];

  const favWin = features.favIndex === 0 ? "1" : "2";
  const undWin = features.favIndex === 0 ? "2" : "1";
  
  const drawOdds = features.odds?.draw || 0;
  const undOdds = features.odds ? (features.favIndex === 0 ? features.odds.away : features.odds.home) : 0;

  const paaPrim = features.study4_paaPrimary;
  const subPrim = features.study3_subPatPrimary;
  const seerPrim = features.study6_seerPrimary;
  const algoPrim = features.study5_algoPrimary;

  // 1. Draw odds < 3.0
  if (drawOdds > 0 && drawOdds < 3.0) basePatterns.push('SIa');
  // 2. Underdog Market odds < Draw odds
  if (drawOdds > 0 && undOdds > 0 && undOdds < drawOdds) basePatterns.push('SIb');

  // PAA Primary
  if (paaPrim === favWin) basePatterns.push('SIc');
  if (paaPrim === 'X') basePatterns.push('SId');
  if (paaPrim === undWin) basePatterns.push('SIe');

  // Sub Pattern Primary
  if (subPrim === favWin) basePatterns.push('SIf');
  if (subPrim === 'X') basePatterns.push('SIg');
  if (subPrim === undWin) basePatterns.push('SIh');

  // Seer Primary
  if (seerPrim === favWin) basePatterns.push('SIi');
  if (seerPrim === 'X') basePatterns.push('SIj');
  if (seerPrim === undWin) basePatterns.push('SIk');

  // Algo Primary
  if (algoPrim === favWin) basePatterns.push('SIl');
  if (algoPrim === 'X') basePatterns.push('SIm');
  if (algoPrim === undWin) basePatterns.push('SIn');

  // All predictors prim
  if (paaPrim === favWin && subPrim === favWin && seerPrim === favWin && algoPrim === favWin) basePatterns.push('SIo');
  if (paaPrim === 'X' && subPrim === 'X' && seerPrim === 'X' && algoPrim === 'X') basePatterns.push('SIp');
  if (paaPrim === undWin && subPrim === undWin && seerPrim === undWin && algoPrim === undWin) basePatterns.push('SIq');

  // Algo+paa+seer
  if (algoPrim === favWin && paaPrim === favWin && seerPrim === favWin) basePatterns.push('SIr');
  if (algoPrim === 'X' && paaPrim === 'X' && seerPrim === 'X') basePatterns.push('SIs');
  if (algoPrim === undWin && paaPrim === undWin && seerPrim === undWin) basePatterns.push('SIt');

  // Algo+paa+sub patt
  if (algoPrim === favWin && paaPrim === favWin && subPrim === favWin) basePatterns.push('SIu');
  if (algoPrim === 'X' && paaPrim === 'X' && subPrim === 'X') basePatterns.push('SIv');
  if (algoPrim === undWin && paaPrim === undWin && subPrim === undWin) basePatterns.push('SIw');

  // Algo+Sub patt+seer
  if (algoPrim === favWin && subPrim === favWin && seerPrim === favWin) basePatterns.push('SIx');
  if (algoPrim === 'X' && subPrim === 'X' && seerPrim === 'X') basePatterns.push('SIy');
  if (algoPrim === undWin && subPrim === undWin && seerPrim === undWin) basePatterns.push('SIz');

  // Sub patt+paa+seer
  if (subPrim === favWin && paaPrim === favWin && seerPrim === favWin) basePatterns.push('SIaa');
  if (subPrim === 'X' && paaPrim === 'X' && seerPrim === 'X') basePatterns.push('SIbb');
  if (subPrim === undWin && paaPrim === undWin && seerPrim === undWin) basePatterns.push('SIcc');

  // 30. Point system supports underdog
  if (features.study13_pointsSupport === 'Underdog') basePatterns.push('SIdd');
  
  // 31. TS supports Underdog
  if (features.study7_tsFavVsUnderdog !== null && features.study7_tsFavVsUnderdog < 0) basePatterns.push('SIee');
  
  // 32. Underdog has hidden strength
  if (features.study8_hiddenStrength) basePatterns.push('SIff');

  // Algo+paa
  if (algoPrim === favWin && paaPrim === favWin) basePatterns.push('SIgg');
  if (algoPrim === 'X' && paaPrim === 'X') basePatterns.push('SIhh');
  if (algoPrim === undWin && paaPrim === undWin) basePatterns.push('SIii');

  // Algo+seer
  if (algoPrim === favWin && seerPrim === favWin) basePatterns.push('SIjj');
  if (algoPrim === 'X' && seerPrim === 'X') basePatterns.push('SIkk');
  if (algoPrim === undWin && seerPrim === undWin) basePatterns.push('SIll');

  // Algo+Sub patt
  if (algoPrim === favWin && subPrim === favWin) basePatterns.push('SImm');
  if (algoPrim === 'X' && subPrim === 'X') basePatterns.push('SInn');
  if (algoPrim === undWin && subPrim === undWin) basePatterns.push('SIoo');

  // paa+seer
  if (paaPrim === favWin && seerPrim === favWin) basePatterns.push('SIpp');
  if (paaPrim === 'X' && seerPrim === 'X') basePatterns.push('SIqq');
  if (paaPrim === undWin && seerPrim === undWin) basePatterns.push('SIrr');

  // paa+Sub patt
  if (paaPrim === favWin && subPrim === favWin) basePatterns.push('SIss');
  if (paaPrim === 'X' && subPrim === 'X') basePatterns.push('SItt');
  if (paaPrim === undWin && subPrim === undWin) basePatterns.push('SIuu');

  // seer+Sub patt
  if (seerPrim === favWin && subPrim === favWin) basePatterns.push('SIvv');
  if (seerPrim === 'X' && subPrim === 'X') basePatterns.push('SIww');
  if (seerPrim === undWin && subPrim === undWin) basePatterns.push('SIxx');

  const variables = getVariableTriggers(features);

  // Push patterns (all base patterns are standalone predictive conditions now)
  for (const bp of basePatterns) {
    tags.push(bp);
    for (const v of variables) {
      tags.push(\`\${bp}\${v}\`);
    }
  }

  return tags;
}`;

content = content.replace(
  /export function generateSITags\(features: MLFeatures\): string\[\] \{[\s\S]*?return tags;\n\}/,
  newGenerateTags
);

fs.writeFileSync(extractorPath, content);
console.log('mlFeatureExtractor.ts patched successfully!');
