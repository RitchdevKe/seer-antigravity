const fs = require('fs');
let content = fs.readFileSync('src/components/Patterns.tsx', 'utf8');

const updates = [
    { id: 'G2i6', prim: '2', fin: 'X2' },
    { id: 'G1g2', prim: 'X', fin: '1X' },
    { id: 'G1o1', prim: '1', fin: '1X' },
    { id: 'G1g21', prim: '2', fin: 'X2' },
    { id: 'G2s25', prim: '1', fin: '1X' },
    { id: 'G1j4', prim: '1', fin: '12' },
    { id: 'G1g4', prim: '1', fin: '1X' },
    { id: 'G3a1', prim: '2', fin: 'X2' },
    { id: 'G2cc1', prim: '2', fin: '12' },
    { id: 'G2y2', prim: '2', fin: 'X2' },
    { id: 'G3ff57', prim: '1', fin: '1X' },
    { id: 'G2bb3', prim: '1', fin: '12' },
    { id: 'G2s18', prim: '1', fin: '12' },
    { id: 'G3t12', prim: '2', fin: 'X2' },
    { id: 'G3ff39', prim: '2', fin: '12' },
    { id: 'G2l1', prim: '1', fin: '12' },
    { id: 'G2N1', prim: '1', fin: '12' },
    { id: 'G1f2', prim: '2', fin: 'X2' },
    { id: 'G1aa5', prim: '2', fin: '12' },
    { id: 'G1u1', prim: '1', fin: '12' },
    { id: 'G1i11', prim: '2', fin: '12' },
    { id: 'G1r11', prim: '1', fin: '1X' },
];

let changed = 0;
for (const update of updates) {
    const itemRegex = new RegExp('(\\{[^}]*id:\\s*\"' + update.id + '\"[^}]*\\})', 'g');
    
    content = content.replace(itemRegex, (match) => {
        let newMatch = match.replace(/prediction:\s*\"[^\"]*\"/, `prediction: "${update.fin}"`);
        newMatch = newMatch.replace(/primaryPrediction:\s*\"[^\"]*\"/, `primaryPrediction: "${update.prim}"`);
        changed++;
        console.log('Updated ' + update.id);
        return newMatch;
    });
}

fs.writeFileSync('src/components/Patterns.tsx', content);
console.log('Total changed: ' + changed);
