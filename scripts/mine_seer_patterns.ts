import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractMLFeatures } from '../src/utils/mlFeatureExtractor.js';
import { Match } from '../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXPORT_DIR = path.join(__dirname, '..', 'db_export');
const MATCHES_FILE = path.join(EXPORT_DIR, 'user_uploaded_matches.json');
const PATTERNS_OUTPUT_FILE = path.join(__dirname, '..', 'src', 'data', 'seer_patterns.json');

function main() {
    console.log("Loading historical matches...");
    if (!fs.existsSync(MATCHES_FILE)) {
        console.error("matches.json not found!");
        return;
    }

    const matchesContent = fs.readFileSync(MATCHES_FILE, 'utf8');
    let matches: Match[];
    try {
        matches = JSON.parse(matchesContent);
    } catch (e) {
        console.error("Failed to parse matches.json", e);
        return;
    }

    console.log(`Total matches loaded: ${matches.length}`);

    const buckets: Record<string, {
        total: number, 
        fav: number, 
        draw: number, 
        underdog: number, 
        features: any
    }> = {};

    let analyzed = 0;

    for (const item of matches) {
        const matchObj = item.data ? item.data : item;
        const resultStr = item.result || matchObj.result;
        
        if (!resultStr || !resultStr.includes(':')) continue;
        const parts = resultStr.split(':');
        const hg = parseInt(parts[0], 10);
        const ag = parseInt(parts[1], 10);
        if (isNaN(hg) || isNaN(ag)) continue;

        let actualResult: 1 | 'X' | 2;
        if (hg > ag) actualResult = 1;
        else if (hg < ag) actualResult = 2;
        else actualResult = 'X';
        
        const features = extractMLFeatures(matchObj);
        if (!features) continue;
        
        // Create deterministic signature of features
        const signature = JSON.stringify({
            f1: features.study1_underdogLessThanDraw,
            f3: features.study3_subPattern,
            f8: features.study8_hiddenStrength,
            f9: features.study9_phaTie,
            f10: features.study10_hiddenWeakness,
            f13: features.study13_pointsSupport,
            f14: features.study14_predictorsAgreeDC,
            f15: features.study15_predictorsAgreePrim,
            f16: features.study16_allPercentagesBelow40,
            f17: features.study17_group,
            f18: features.study18_category,
            f21: features.study21_drawOddsBelow3
        });

        if (!buckets[signature]) {
            buckets[signature] = { total: 0, fav: 0, draw: 0, underdog: 0, features };
        }
        
        buckets[signature].total++;
        
        if (actualResult === 'X') {
            buckets[signature].draw++;
        } else {
            const winningIndex = actualResult === 1 ? 0 : 2;
            if (winningIndex === features.favIndex) buckets[signature].fav++;
            else if (winningIndex === features.underdogIndex) buckets[signature].underdog++;
        }
        
        analyzed++;
    }

    console.log(`Extracted features for ${analyzed} valid matches.`);
    console.log(`Found ${Object.keys(buckets).length} unique feature combinations.`);

    const sortedBuckets = Object.entries(buckets)
        .filter(([_, data]) => data.total >= 5)
        .map(([sig, data]) => {
            const maxVal = Math.max(data.fav, data.draw, data.underdog);
            let lean = 'Mixed';
            if (maxVal === data.fav) lean = 'Favorite';
            else if (maxVal === data.draw) lean = 'Draw';
            else if (maxVal === data.underdog) lean = 'Underdog';

            return {
                sig,
                data,
                favPct: (data.fav / data.total) * 100,
                drawPct: (data.draw / data.total) * 100,
                undPct: (data.underdog / data.total) * 100,
                maxPct: (maxVal / data.total) * 100,
                lean
            };
        });

    console.log("Top 5 largest buckets before confidence filter:");
    const largest = [...sortedBuckets].sort((a, b) => b.data.total - a.data.total).slice(0, 5);
    for (const b of largest) {
        console.log(`Size: ${b.data.total}, MaxPct: ${b.maxPct.toFixed(1)}% (${b.lean}), Fav: ${b.favPct.toFixed(1)}%, Draw: ${b.drawPct.toFixed(1)}%, Und: ${b.undPct.toFixed(1)}%`);
    }

    const filteredBuckets = sortedBuckets
        .sort((a, b) => b.data.total - a.data.total); // Sort by sample size first

    const results: Record<string, any> = {};
    
    // Let's group them by lean to assign nice names
    const byLean: Record<string, typeof sortedBuckets> = {
        'Favorite': [],
        'Draw': [],
        'Underdog': []
    };

    for (const b of filteredBuckets) {
        byLean[b.lean].push(b);
    }

    let letterCode = 97; // 'a'
    
    for (const lean of ['Favorite', 'Draw', 'Underdog']) {
        const bucketsForLean = byLean[lean];
        
        let groupCounter = 1;
        let currentLetter = String.fromCharCode(letterCode);

        for (const b of bucketsForLean) {
            const name = `SI${currentLetter}${groupCounter}`;
            results[name] = {
                name,
                lean: b.lean,
                accuracy: b.maxPct,
                totalMatches: b.data.total,
                favPct: b.favPct,
                drawPct: b.drawPct,
                undPct: b.undPct,
                features: b.data.features
            };
            
            groupCounter++;
            if (groupCounter > 9) { // Switch letter after 9 variations
                groupCounter = 1;
                letterCode++;
                currentLetter = String.fromCharCode(letterCode);
            }
        }
        
        if (groupCounter > 1) {
            letterCode++; // Next lean starts on a new letter
        }
    }

    fs.writeFileSync(PATTERNS_OUTPUT_FILE, JSON.stringify(results, null, 2));
    console.log(`Discovered ${Object.keys(results).length} SI Patterns (No min accuracy, >= 5 matches).`);
    console.log(`Saved to ${PATTERNS_OUTPUT_FILE}`);
}

main();
