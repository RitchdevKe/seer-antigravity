const fs = require('fs');
const path = 'c:/Users/USER/OneDrive/Desktop/SEER ANTIGRAVITY/supabase_backup/live_matches.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Find recent matches with a known result
let validMatches = data.filter(m => m.result && m.result !== 'Unknown' && m.result !== 'Postponed');
validMatches.sort((a, b) => new Date(b.date) - new Date(a.date));

// Let's grab the top 100 recent and see if we can identify the batch of 39
const recent = validMatches.slice(0, 100);

const stats = recent.map(m => {
    let moFav = m.data?._moFav || m.data?._cachedMatchStats?.moFav;
    let resultOutcome = 'Unknown';
    if (m.result) {
        const parts = m.result.split(':').map(Number);
        if (parts.length === 2) {
            if (parts[0] > parts[1]) resultOutcome = '1';
            else if (parts[0] < parts[1]) resultOutcome = '2';
            else resultOutcome = 'X';
        }
    }
    
    let isSuccess = false;
    if (moFav && (resultOutcome === moFav || resultOutcome === 'X')) {
        isSuccess = true;
    }
    
    return {
        id: m.id,
        date: m.date,
        result: m.result,
        resultOutcome,
        moFav,
        isFavOrDraw: isSuccess,
        algoPred: m.data?.algoReport?.prediction || '',
        paaPrimary: m.data?.paaPrimaryPrediction || '',
        subPattern: m.data?.patternAnalysis?.subPattern || '',
        subPatternPred: m.data?.patternAnalysis?.subPatternPrediction || '',
        probFav: m.data?._cachedMatchStats?.probFav || 0,
        probDraw: m.data?._cachedMatchStats?.probDraw || 0,
        phaFavSupport: m.data?._cachedMatchStats?.phaFavSupport || 0,
        upsetRate: m.data?._cachedMatchStats?.paaStats?.upsetRate || 0,
        totalPoints: m.data?.totalPoints || {}
    };
});

// Group by date to find the batch of 39
const byDate = {};
stats.forEach(s => {
    const d = s.date.split(' ')[0];
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(s);
});

for (const [date, matches] of Object.entries(byDate)) {
    const favOrDraw = matches.filter(m => m.isFavOrDraw).length;
    console.log(`Date: ${date}, Total: ${matches.length}, FavOrDraw: ${favOrDraw}`);
    if (matches.length >= 35 && matches.length <= 45) {
        console.log("Found likely batch. Successful matches:");
        console.log(JSON.stringify(matches.filter(m => m.isFavOrDraw), null, 2));
    }
}
