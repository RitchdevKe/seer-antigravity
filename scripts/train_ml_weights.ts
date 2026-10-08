import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractMLFeatures } from '../src/utils/mlFeatureExtractor.js';
import { Matrix } from 'ml-matrix';
// We use a simple custom implementation for logistic regression to avoid dependency typing issues
// and ensure we have full control over the One-Vs-Rest multiclass approach.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXPORT_DIR = path.join(__dirname, '..', 'db_export');
const MATCHES_FILE = path.join(EXPORT_DIR, 'user_uploaded_matches.json');
const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'data', 'ml_weights.json');

// Sigmoid function
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

// Train a single binary logistic regression model using gradient descent
function trainLogisticRegression(X: number[][], y: number[], iterations: number = 1000, lr: number = 0.01) {
    const numSamples = X.length;
    const numFeatures = X[0].length;
    const weights = new Array(numFeatures).fill(0);
    let bias = 0;

    for (let i = 0; i < iterations; i++) {
        const predictions = X.map(row => {
            let z = bias;
            for (let j = 0; j < numFeatures; j++) {
                z += row[j] * weights[j];
            }
            return sigmoid(z);
        });

        const dw = new Array(numFeatures).fill(0);
        let db = 0;

        for (let j = 0; j < numSamples; j++) {
            const error = predictions[j] - y[j];
            db += error;
            for (let k = 0; k < numFeatures; k++) {
                dw[k] += error * X[j][k];
            }
        }

        bias -= (lr * db) / numSamples;
        for (let k = 0; k < numFeatures; k++) {
            weights[k] -= (lr * dw[k]) / numSamples;
        }
    }

    return { weights, bias };
}

function main() {
    console.log("Loading historical matches to train ML model...");
    if (!fs.existsSync(MATCHES_FILE)) {
        console.error("Historical data file not found:", MATCHES_FILE);
        return;
    }

    const rawData = fs.readFileSync(MATCHES_FILE, 'utf-8');
    const matches = JSON.parse(rawData);

    const X: number[][] = [];
    const yFav: number[] = [];
    const yDraw: number[] = [];
    const yUnd: number[] = [];

    let validCount = 0;

    for (const item of matches) {
        const match = item.data ? item.data : item;
        const resultStr = item.result || match.result;
        
        if (!resultStr || !resultStr.includes(':')) continue;
        const parts = resultStr.split(':');
        const hg = parseInt(parts[0], 10);
        const ag = parseInt(parts[1], 10);
        if (isNaN(hg) || isNaN(ag)) continue;

        const features = extractMLFeatures(match);
        if (!features) continue;

        const isHomeFav = features.favIndex === 0;
        
        let actualFav = 0, actualDraw = 0, actualUnd = 0;
        if (hg === ag) {
            actualDraw = 1;
        } else if (hg > ag) {
            if (isHomeFav) actualFav = 1; else actualUnd = 1;
        } else {
            if (!isHomeFav) actualFav = 1; else actualUnd = 1;
        }

        // Feature Vector
        const featureVector = [
            features.study1_underdogLessThanDraw ? 1 : 0,
            features.study8_hiddenStrength ? 1 : 0,
            features.study9_phaTie ? 1 : 0,
            features.study10_hiddenWeakness ? 1 : 0,
            features.study13_pointsSupport === 'Fav' ? 1 : 0,
            features.study13_pointsSupport === 'Draw' ? 1 : 0,
            features.study13_pointsSupport === 'Underdog' ? 1 : 0,
            features.study14_predictorsAgreeDC ? 1 : 0,
            features.study16_allPercentagesBelow40 ? 1 : 0,
            features.study21_drawOddsBelow3 ? 1 : 0,
            features.study7_tsFavVsUnderdog || 0,
            features.study12_maxDrawPercentage || 0,
            // We can add predictions from the other algorithms to let the model weight them!
            (match.paaPrediction?.includes('1') && isHomeFav) || (match.paaPrediction?.includes('2') && !isHomeFav) ? 1 : 0, // PAA Fav
            (match.paaPrediction?.includes('X')) ? 1 : 0, // PAA Draw
            (match.seerPrediction?.includes('1') && isHomeFav) || (match.seerPrediction?.includes('2') && !isHomeFav) ? 1 : 0, // SEER Fav
            (match.algoReport?.prediction?.includes('1') && isHomeFav) || (match.algoReport?.prediction?.includes('2') && !isHomeFav) ? 1 : 0 // Algo Fav
        ];

        X.push(featureVector);
        yFav.push(actualFav);
        yDraw.push(actualDraw);
        yUnd.push(actualUnd);
        
        validCount++;
    }

    console.log(`Extracted features for ${validCount} matches. Training One-Vs-Rest Logistic Regression models...`);

    // Standardize features (Z-score normalization)
    const numFeatures = X[0].length;
    const means = new Array(numFeatures).fill(0);
    const stds = new Array(numFeatures).fill(0);
    
    for (let j = 0; j < numFeatures; j++) {
        for (let i = 0; i < validCount; i++) {
            means[j] += X[i][j];
        }
        means[j] /= validCount;
        
        for (let i = 0; i < validCount; i++) {
            stds[j] += Math.pow(X[i][j] - means[j], 2);
        }
        stds[j] = Math.sqrt(stds[j] / validCount) || 1; // prevent div by zero
        
        for (let i = 0; i < validCount; i++) {
            X[i][j] = (X[i][j] - means[j]) / stds[j];
        }
    }

    // Train models (5000 iterations for convergence)
    console.log("Training Favorite Model...");
    const favModel = trainLogisticRegression(X, yFav, 5000, 0.1);
    
    console.log("Training Draw Model...");
    const drawModel = trainLogisticRegression(X, yDraw, 5000, 0.1);
    
    console.log("Training Underdog Model...");
    const undModel = trainLogisticRegression(X, yUnd, 5000, 0.1);

    const modelExport = {
        normalization: { means, stds },
        models: {
            fav: favModel,
            draw: drawModel,
            und: undModel
        },
        featureMap: [
            "underdogLessThanDraw",
            "hiddenStrength",
            "phaTie",
            "hiddenWeakness",
            "pointsSupportFav",
            "pointsSupportDraw",
            "pointsSupportUnd",
            "predictorsAgreeDC",
            "allPercentagesBelow40",
            "drawOddsBelow3",
            "tsFavVsUnderdog",
            "maxDrawPercentage",
            "paaFav",
            "paaDraw",
            "seerFav",
            "algoFav"
        ]
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(modelExport, null, 2));
    console.log(`\nModels trained successfully! Optimized weights saved to ${OUTPUT_FILE}`);
}

main();
