import fs from 'fs';

const baseline = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const modified = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));

let total = 0;
let baselineSmartHits = 0;
let modifiedSmartHits = 0;
let smartAppliedCount = 0;

let baselinePivotHits = 0;
let modifiedPivotHits = 0;
let pivotAppliedCount = 0;

for (let i = 0; i < baseline.length; i++) {
    const b = baseline[i];
    const m = modified[i];
    if (b.id !== m.id) continue;
    
    total++;
    
    const isWin = (pred: string, result: string) => pred.includes(result);
    
    // Check if Smart Override changed
    if (b.source === 'Smart Override Engine' || m.source === 'Smart Override Engine') {
        smartAppliedCount++;
        if (isWin(b.prediction, b.results)) baselineSmartHits++;
        if (isWin(m.prediction, m.results)) modifiedSmartHits++;
    }
    
    // Check if Pivot Engine changed
    if (b.source === 'Pivot Engine' || m.source === 'Pivot Engine') {
        pivotAppliedCount++;
        if (isWin(b.prediction, b.results)) baselinePivotHits++;
        if (isWin(m.prediction, m.results)) modifiedPivotHits++;
    }
}

console.log("=== COMPARISON RESULTS ===");
console.log(`Total Evaluated: ${total}`);
console.log("");
console.log("--- SMART OVERRIDE ENGINE ---");
console.log(`Applied on: ${smartAppliedCount} matches`);
console.log(`Baseline Accuracy: ${((baselineSmartHits/smartAppliedCount)*100).toFixed(1)}% (${baselineSmartHits})`);
console.log(`Modified Accuracy: ${((modifiedSmartHits/smartAppliedCount)*100).toFixed(1)}% (${modifiedSmartHits})`);
console.log(`Net Gain: ${modifiedSmartHits - baselineSmartHits}`);
console.log("");
console.log("--- PIVOT ENGINE ---");
console.log(`Applied on: ${pivotAppliedCount} matches`);
console.log(`Baseline Accuracy: ${((baselinePivotHits/pivotAppliedCount)*100).toFixed(1)}% (${baselinePivotHits})`);
console.log(`Modified Accuracy: ${((modifiedPivotHits/pivotAppliedCount)*100).toFixed(1)}% (${modifiedPivotHits})`);
console.log(`Net Gain: ${modifiedPivotHits - baselinePivotHits}`);
