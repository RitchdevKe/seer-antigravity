import fs from 'fs';
import { predictSeerDetailed } from '../src/utils/seerLogic';
import { generateHistoricalStatsMap } from '../src/utils/matchProcessing';

const matches = JSON.parse(fs.readFileSync('./public/embedded_matches.json', 'utf8'));
const mData = matches.map(m => m.data);
const phaStatsMap = generateHistoricalStatsMap(mData);
const matchData = mData.find(x => x.teams === 'Athlone Town vs UCD');

const DEFAULT_WEIGHTS = { paa: 0.35, points: 0.25, form: 0.15, h2h: 0.15, ml: 0.1 };
const seer = predictSeerDetailed(matchData, DEFAULT_WEIGHTS, phaStatsMap, {home: 3, away: 3});

const rawPrim = matchData.algoReport?.primaryPrediction || matchData.rawPrediction || matchData.algoReport?.prediction;
const paaPrim = matchData.paaPrimaryPrediction;
const subPrim = matchData.rawPrediction;

console.log('--- RETRIEVED DATA FOR: Athlone Town vs UCD ---');
console.log('ALGO PRIM:', rawPrim, '| ALGO FIN:', matchData.algoReport?.prediction);
console.log('PAA PRIM:', paaPrim, '| PAA FIN:', matchData.paaPrediction);
console.log('SUB PATT PRIM (Engine):', subPrim, '| SUB PATT FIN:', matchData.finalPrediction);
console.log('SEER PRIM:', seer.primary, '| SEER FIN:', seer.final);
