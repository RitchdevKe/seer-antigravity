import fs from 'fs';

const raw = JSON.parse(fs.readFileSync('C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\combined_upsets_matches.json', 'utf8'));

console.log('Sample match keys:', Object.keys(raw[0]));
console.log('Sample match.match keys:', Object.keys(raw[0].match));
console.log('Sample le:', raw[0].match.le);
console.log('Sample rating1x2:', raw[0].match.rating1x2, raw[0].match.rating);
console.log('Sample l10:', raw[0].match.l10Home, raw[0].match.l10h, raw[0].match.l10);
console.log('Sample subPattern:', raw[0].match.patternAnalysis);
console.log('Sample seerScores:', raw[0].match.seerScores, raw[0].match.seerPercentages);
