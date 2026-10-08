import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { extractMLFeatures, generateSITags } from '../src/utils/mlFeatureExtractor';
import { getActualResult, processMatch } from '../src/utils/matchProcessing';

const dataPath = path.resolve(process.cwd(), 'public/embedded_matches.json');
const matches = JSON.parse(fs.readFileSync(dataPath, 'utf-8')).map((d: any) => d.data);

const matrix: Record<string, any> = {};
const updateKey = (type: string, key: string, outcome: string) => {
    const id = type + '_' + key;
    if (!matrix[id]) {
        matrix[id] = { matrix_type: type, item_key: key, total_matches: 0, fav_wins: 0, draws: 0, und_wins: 0 };
    }
    matrix[id].total_matches++;
    if (outcome === 'fav') matrix[id].fav_wins++;
    if (outcome === 'draw') matrix[id].draws++;
    if (outcome === 'und') matrix[id].und_wins++;
};

let processedCount = 0;
let silCountFeat = 0;

matches.forEach((rawMatch: any) => {
    if (!rawMatch) return;
    const actualResult = getActualResult(rawMatch.result || '');
    if (actualResult === 'pending' || !actualResult) return;

    const cleanM = JSON.parse(JSON.stringify(rawMatch));
    delete cleanM.isPrecalculated;
    const processed = processMatch(cleanM);

    const features = extractMLFeatures(processed);
    if (!features) return;

    const isFavHome = features.favIndex === 0;
    let outcome = 'und';
    if (actualResult === 'X') outcome = 'draw';
    else if ((actualResult === '1' && isFavHome) || (actualResult === '2' && !isFavHome)) outcome = 'fav';

    const tags = generateSITags(features);
    if (tags.includes('SIl')) {
        silCountFeat++;
    }

    if (tags && tags.length > 0) {
        tags.forEach(tag => {
            if (/^[a-zA-Z]+$/.test(tag)) {
                updateKey('basePatterns', tag, outcome);
            } else {
                updateKey('subPatterns', tag, outcome);
            }
        });
    }
    processedCount++;
});

console.log({ processedCount, silCountFeat, matrixSIl: matrix['basePatterns_SIl'] });
