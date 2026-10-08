import * as fs from 'fs';
import * as path from 'path';

const patternsPath = path.join(process.cwd(), 'src/components/Patterns.tsx');
let content = fs.readFileSync(patternsPath, 'utf8');

// The corrupted blocks end with: `, prediction: "12", primaryPrediction: "1"}`
// We replace them with just `}`
const regex = /, prediction: "[^"]+", primaryPrediction: "[^"]+"}/g;
const matches = content.match(regex);
console.log('Found corrupted blocks:', matches ? matches.length : 0);

if (matches) {
    content = content.replace(regex, '}');
    fs.writeFileSync(patternsPath, content);
    console.log('Cleaned up corrupted blocks.');
}
