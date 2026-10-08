import fs from 'fs';
import path from 'path';

const targetFile = path.resolve('src/utils/optimizedweights.ts');
const evalBlockFile = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\top12_eval_block.txt';

let src = fs.readFileSync(targetFile, 'utf8');
const evalBlock = fs.readFileSync(evalBlockFile, 'utf8');

// The start delimiter:
const startDelim = "        // Dynamic rule evaluations\n        if ((evalCategoryId || categoryId) === 'top_10_value') {";
// The end delimiter is right before hedge protocol evaluation:
const endDelim = "            // --- FINAL HEDGE PROTOCOL EVALUATION ---";

const startIndex = src.indexOf(startDelim);
if (startIndex === -1) {
    console.error("Could not find start delimiter!");
    process.exit(1);
}

const endIndex = src.indexOf(endDelim, startIndex);
if (endIndex === -1) {
    console.error("Could not find end delimiter!");
    process.exit(1);
}

// Slice and replace
const before = src.slice(0, startIndex);
const after = src.slice(endIndex);

const updatedSrc = before + evalBlock.trimEnd() + '\n\n' + after;

fs.writeFileSync(targetFile, updatedSrc, 'utf8');
console.log(`Successfully replaced top_10_value evaluation block in ${targetFile}`);
