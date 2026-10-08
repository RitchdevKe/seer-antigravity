import * as fs from 'fs';
import * as path from 'path';

const file = path.join(process.cwd(), 'src', 'components', 'Patterns.tsx');
let content = fs.readFileSync(file, 'utf-8');

const updates: Record<string, { prim: string; fin: string }> = {
  G2g3: { prim: '1', fin: '1X' },
  G2ee11: { prim: '1', fin: '12' },
  G2i15: { prim: '2', fin: '12' },
  G2ee1: { prim: '1', fin: '12' },
  G2e5: { prim: '1', fin: '1X' },
  G3q2: { prim: '1', fin: '12' },
  G1q17: { prim: '1', fin: '12' },
  G3m3: { prim: '1', fin: '12' },
  G1j4: { prim: '2', fin: '12' },
  G2s24: { prim: '2', fin: '12' },
  G2o18: { prim: '1', fin: '12' },
  G2hh2: { prim: 'X', fin: '1X' },
  G2o10: { prim: '1', fin: '12' },
  G2y2: { prim: '2', fin: 'X2' },
  G1i19: { prim: '1', fin: '12' },
  G2e9: { prim: '2', fin: '12' },
  G2aa4: { prim: '2', fin: '12' },
  G1a6: { prim: 'X', fin: '1X' },
  G3x3: { prim: '2', fin: 'X2' },
  G1ff44: { prim: '2', fin: 'X2' },
  G3ff45: { prim: '2', fin: '12' },
  G2bb1: { prim: '2', fin: 'X2' },
  G3ii3: { prim: '1', fin: '12' },
  G3hh2: { prim: 'X', fin: '1X' },
  G2c3: { prim: '1', fin: '12' },
  G3o7: { prim: '2', fin: 'X2' },
  G3o6: { prim: '1', fin: '12' },
  G2ff60: { prim: '2', fin: 'X2' },
  G1s12: { prim: '2', fin: '12' },
  G1hh1: { prim: '1', fin: '12' },
  G1f2: { prim: '2', fin: '12' },
  G1s16: { prim: '1', fin: '12' },
  G1ii3: { prim: 'X', fin: 'X2' },
  G1bb1: { prim: '1', fin: '1X' },
  G1u1: { prim: '2', fin: '12' },
};

for (const [id, val] of Object.entries(updates)) {
  const blockRegex = new RegExp(`({\\s*id:\\s*["']${id}["'][\\s\\S]*?})`, 'g');
  
  content = content.replace(blockRegex, (match) => {
    let newMatch = match;
    
    if (newMatch.includes('primaryPrediction:')) {
      newMatch = newMatch.replace(/primaryPrediction:\s*["'][^"']*["']/, `primaryPrediction: "${val.prim}"`);
    } else {
      if (newMatch.includes('\\n')) {
        newMatch = newMatch.replace(/(\n\s*})$/, `,\n    primaryPrediction: "${val.prim}"$1`);
      } else {
        newMatch = newMatch.replace(/(})$/, `, primaryPrediction: "${val.prim}" $1`);
      }
    }

    if (newMatch.includes(' prediction:')) {
      newMatch = newMatch.replace(/ prediction:\s*["'][^"']*["']/, ` prediction: "${val.fin}"`);
    } else if (newMatch.includes('\n    prediction:')) {
      newMatch = newMatch.replace(/\n\s*prediction:\s*["'][^"']*["']/, `\n    prediction: "${val.fin}"`);
    } else {
      newMatch = newMatch.replace(/prediction:\s*["'][^"']*["']/, `prediction: "${val.fin}"`);
    }
    
    return newMatch;
  });
}

fs.writeFileSync(file, content, 'utf-8');
console.log('Done');
