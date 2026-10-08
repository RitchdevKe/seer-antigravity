import * as fs from 'fs';
import * as path from 'path';

const updates = [
  { id: "G2g3", prim: "2", fin: "12" },
  { id: "G2ee11", prim: "1", fin: "12" },
  { id: "G2ee13", prim: "1", fin: "12" },
  { id: "G1o4", prim: "1", fin: "1X" },
  { id: "G2e5", prim: "1", fin: "1X" },
  { id: "G2a1", prim: "1", fin: "1X" },
  { id: "G2ee7", prim: "2", fin: "X2" },
  { id: "G3q2", prim: "1", fin: "12" },
  { id: "G3m3", prim: "1", fin: "12" },
  { id: "G1q17", prim: "1", fin: "12" },
  { id: "G1o12", prim: "1", fin: "1X" },
  { id: "G1s15", prim: "X", fin: "1X" },
  { id: "G3p5", prim: "X", fin: "1X" },
  { id: "G2o2", prim: "1", fin: "1X" },
  { id: "G1ff47", prim: "1", fin: "1X" },
  { id: "G2s24", prim: "2", fin: "12" },
  { id: "G1o2", prim: "2", fin: "12" },
  { id: "G1i19", prim: "1", fin: "12" },
  { id: "G2cc1", prim: "2", fin: "12" },
  { id: "G2hh2", prim: "1", fin: "12" },
  { id: "G2aa4", prim: "2", fin: "12" },
  { id: "G1ff44", prim: "2", fin: "X2" },
  { id: "G3ff45", prim: "2", fin: "12" },
  { id: "G2x4", prim: "1", fin: "12" },
  { id: "G2bb1", prim: "2", fin: "X2" },
  { id: "G3f14", prim: "2", fin: "12" },
  { id: "G2g8", prim: "1", fin: "12" },
  { id: "G1t4b", prim: "1", fin: "1X" },
  { id: "G3jj1", prim: "2", fin: "X2" },
  { id: "G2c3", prim: "1", fin: "12" },
  { id: "G2oo2", prim: "1", fin: "12" },
  { id: "G3ii3", prim: "1", fin: "12" },
  { id: "G3nn1", prim: "1", fin: "1X" },
  { id: "G3s7", prim: "1", fin: "1X" },
  { id: "G3hh2", prim: "X", fin: "1X" },
  { id: "G2aa2", prim: "1", fin: "12" },
  { id: "G2s29", prim: "1", fin: "12" },
  { id: "G2l2", prim: "1", fin: "1X" },
  { id: "G3ee4", prim: "1", fin: "12" },
  { id: "G3w1", prim: "X", fin: "1X" },
  { id: "G2a5", prim: "1", fin: "1X" },
  { id: "G1q4", prim: "1", fin: "12" },
  { id: "G1ii3", prim: "1", fin: "1X" },
  { id: "G2ff59", prim: "1", fin: "12" },
  { id: "G1dd2", prim: "2", fin: "X2" },
  { id: "G2b4", prim: "1", fin: "12" },
  { id: "G2m6", prim: "2", fin: "X2" },
  { id: "G2ff60", prim: "2", fin: "X2" },
  { id: "G2k2", prim: "1", fin: "12" },
  { id: "G1o20", prim: "1", fin: "12" },
  { id: "G2ee22", prim: "2", fin: "12" },
  { id: "G1g9", prim: "1", fin: "1X" },
  { id: "G3ff49", prim: "1", fin: "1X" },
  { id: "G1s16", prim: "1", fin: "12" },
  { id: "G3a3", prim: "1", fin: "12" },
  { id: "G1s13", prim: "1", fin: "1X" },
  { id: "G1g13", prim: "1", fin: "1X" },
  { id: "G2g7", prim: "1", fin: "1X" },
  { id: "G1dd5", prim: "X", fin: "1X" },
  { id: "G3bb3", prim: "X", fin: "1X" },
  { id: "G2aa6", prim: "2", fin: "X2" },
  { id: "G1i6", prim: "X", fin: "1X" },
  { id: "G1q7", prim: "2", fin: "X2" },
  { id: "G2cc3", prim: "1", fin: "1X" },
  { id: "G2t4", prim: "2", fin: "X2" },
  { id: "G1r3", prim: "1", fin: "1X" },
  { id: "G2l5", prim: "X", fin: "12" },
  { id: "G2s28", prim: "X", fin: "1X" }
];

const patternsPath = path.join(process.cwd(), 'src/components/Patterns.tsx');
let content = fs.readFileSync(patternsPath, 'utf8');

let notFound = [];

for (const { id, prim, fin } of updates) {
  const idRegex = new RegExp(`(id:\\s*["']${id}["'][^}]*?)}`, 's');
  
  const match = content.match(idRegex);
  if (match) {
    let block = match[1];
    
    // Update prediction (fin)
    if (block.match(/prediction:\\s*["'][^"']+["']/)) {
      block = block.replace(/prediction:\\s*["'][^"']+["']/, `prediction: "${fin}"`);
    } else {
      block += `, prediction: "${fin}"`;
    }

    // Update primaryPrediction (prim)
    if (block.match(/primaryPrediction:\\s*["'][^"']+["']/)) {
      block = block.replace(/primaryPrediction:\\s*["'][^"']+["']/, `primaryPrediction: "${prim}"`);
    } else {
      block += `, primaryPrediction: "${prim}"`;
    }

    content = content.replace(idRegex, block + '}');
  } else {
    notFound.push(id);
  }
}

fs.writeFileSync(patternsPath, content);
console.log(`Updated successfully. Not found: ${notFound.join(', ')}`);
