import fs from 'fs';
import path from 'path';
import { getActualResult } from '../src/utils/matchProcessing';

function run() {
    const dataPath = path.join(process.cwd(), 'supabase_backup/precalculated_matches.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    // Find the latest date in the dataset (grouped by day)
    const dateCounts: Record<string, number> = {};
    for (const item of data) {
        const m = item.data || item;
        let date = m.date || 'Unknown';
        if (date !== 'Unknown' && date.length >= 10) {
            date = date.substring(0, 10);
        }
        dateCounts[date] = (dateCounts[date] || 0) + 1;
    }

    // Sort dates descending
    const sortedDates = Object.keys(dateCounts).filter(d => d !== 'Unknown').sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    console.log("Most recent dates in dataset:");
    for (let i = 0; i < 5; i++) {
        console.log(`${sortedDates[i]}: ${dateCounts[sortedDates[i]]} matches`);
    }

    // Let's find the date with exactly or around 39 matches, or just the most recent one.
    // The user mentioned "Live analysis had 39 matches".
    let targetDate = sortedDates[0];
    for(const d of sortedDates) {
        if (dateCounts[d] === 39) {
            targetDate = d;
            break;
        }
    }

    console.log(`\nAnalyzing matches for date: ${targetDate} (${dateCounts[targetDate]} matches)`);

    const matches = data.filter((item: any) => {
        const m = item.data || item;
        return m.date && m.date.startsWith(targetDate);
    }).map((item: any) => item.data || item);

    let mfavWins = 0;
    let draws = 0;
    let undWins = 0;

    matches.forEach((m: any) => {
        const actual = getActualResult(m.result);
        if (actual === 'pending') return;

        // Determine Market Favorite
        // M.Fav is the team with lower odds between 1 and 2.
        const odds1 = m.odds?.home || 0;
        const odds2 = m.odds?.away || 0;
        
        let mfav = '1';
        if (odds2 > 0 && odds2 < odds1) {
            mfav = '2';
        } else if (odds1 === 0 && odds2 === 0) {
            // fallback if no odds
            mfav = '1';
        }

        if (actual === mfav) {
            mfavWins++;
        } else if (actual === 'X') {
            draws++;
        } else {
            undWins++;
        }
    });

    console.log(`Actual Results Breakdown:`);
    console.log(`Market Favorite Wins: ${mfavWins}`);
    console.log(`Draws: ${draws}`);
    console.log(`Underdog Wins: ${undWins}`);
}

run();
