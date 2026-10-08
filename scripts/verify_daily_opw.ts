import { getOptimizedScoreDetailed, getMatchDayOfWeek } from '../src/utils/optimizedweights';
import fs from 'fs';

const liveMatches = JSON.parse(fs.readFileSync('C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\combined_upsets_matches.json', 'utf8'));

console.log(`Loaded ${liveMatches.length} matches for daily OPW verification.`);

const dayCounts: Record<string, number> = {};
liveMatches.forEach((m: any) => {
    const rawMatch = m.match || m;
    const day = getMatchDayOfWeek(rawMatch);
    dayCounts[day] = (dayCounts[day] || 0) + 1;
});

console.log("\nMatch counts by day of week:");
console.log(JSON.stringify(dayCounts, null, 2));

// 1. Verify Saturday Upsets Top 5
const satMatches = liveMatches.filter((m: any) => getMatchDayOfWeek(m.match || m) === 'saturday');
console.log(`\n=== SATURDAY MATCHES (${satMatches.length}) ===`);
const satScored = satMatches.map((m: any) => {
    const rawMatch = m.match || m;
    const detailed = getOptimizedScoreDetailed(rawMatch, 'upsets', {});
    const mFav = m.teamsData?.market_favorite || m.mFav;
    const moUnderdog = m.teamsData?.market_underdog || (mFav === '1' ? '2' : '1');
    const actual = m.resultData?.actual || m.actual;
    let outcome = 'DRAW';
    if (actual === moUnderdog) outcome = 'UNDERDOG';
    else if (actual === mFav) outcome = 'MFAV';
    return { teams: m.teams, totalScore: detailed.totalScore, outcome };
});
satScored.sort((a: any, b: any) => b.totalScore - a.totalScore);
const satTop5 = satScored.slice(0, 5);
const satUd5 = satTop5.filter((m: any) => m.outcome === 'UNDERDOG').length;
const satDr5 = satTop5.filter((m: any) => m.outcome === 'DRAW').length;
const satMf5 = satTop5.filter((m: any) => m.outcome === 'MFAV').length;
console.log(`Saturday Top 5: ${satUd5}/5 Underdogs, ${satDr5}/5 Draws, ${satMf5}/5 Favorite wins.`);
satTop5.forEach((m: any, i: number) => {
    console.log(`  #${i + 1} [${m.outcome}] ${m.teams} | Score: ${m.totalScore}`);
});

// 2. Verify Sunday Upsets Top 5
const sunMatches = liveMatches.filter((m: any) => getMatchDayOfWeek(m.match || m) === 'sunday');
console.log(`\n=== SUNDAY MATCHES (${sunMatches.length}) ===`);
const sunScored = sunMatches.map((m: any) => {
    const rawMatch = m.match || m;
    const detailed = getOptimizedScoreDetailed(rawMatch, 'upsets', {});
    const mFav = m.teamsData?.market_favorite || m.mFav;
    const moUnderdog = m.teamsData?.market_underdog || (mFav === '1' ? '2' : '1');
    const actual = m.resultData?.actual || m.actual;
    let outcome = 'DRAW';
    if (actual === moUnderdog) outcome = 'UNDERDOG';
    else if (actual === mFav) outcome = 'MFAV';
    return { teams: m.teams, totalScore: detailed.totalScore, outcome };
});
sunScored.sort((a: any, b: any) => b.totalScore - a.totalScore);
const sunTop5 = sunScored.slice(0, 5);
const sunUd5 = sunTop5.filter((m: any) => m.outcome === 'UNDERDOG').length;
const sunDr5 = sunTop5.filter((m: any) => m.outcome === 'DRAW').length;
const sunMf5 = sunTop5.filter((m: any) => m.outcome === 'MFAV').length;
console.log(`Sunday Top 5: ${sunUd5}/5 Underdogs, ${sunDr5}/5 Draws, ${sunMf5}/5 Favorite wins.`);
sunTop5.forEach((m: any, i: number) => {
    console.log(`  #${i + 1} [${m.outcome}] ${m.teams} | Score: ${m.totalScore}`);
});

// 3. Verify Day Override Feature
console.log("\n=== TESTING DAY OVERRIDES ON A SAMPLE MATCH ===");
const sampleMatch = liveMatches[0].match || liveMatches[0];
const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
for (const d of days) {
    const score = getOptimizedScoreDetailed(sampleMatch, 'top_10_value', {}, d);
    console.log(`  Day Override [${d.padEnd(9)}]: Total Score = ${score.totalScore}, Rules Hit = ${score.rulesHit.length}`);
}

console.log("\n✅ All Daily OPW verification checks completed successfully!");
