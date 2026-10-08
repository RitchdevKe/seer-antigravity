const fs = require('fs');

const replacement = 
  // We rely purely on the Deep Tree for prediction if it's confident enough
  let finalLean = histLean;
  let decisionLogic = 'SUPPORT';
  
  const bestHistProb = Math.max(histFavProb, histDrawProb, histUndProb);
  
  if (bestLeaf && bestLeaf.stats.total >= 5 && bestHistProb >= 70) {
      // Very confident historical pattern!
      decisionLogic = 'SUPPORT';
  } else {
      // Historical pattern is weak, fallback to match card variance scoring
      decisionLogic = 'PIVOT';
      let currentFavScore = 0;
      let currentUndScore = 0;
    
      if (variations['Points']?.includes('Fav')) currentFavScore += 1.5;
      if (variations['Points']?.includes('Und')) currentUndScore += 1.5;
    
      if (variations['TS']?.includes('Fav')) currentFavScore += 1.5;
      if (variations['TS']?.includes('Und')) currentUndScore += 1.5;
    
      ['PHA', 'Algo', 'PAA', 'SEER'].forEach(k => {
         if (variations[k] === 'Fav') currentFavScore += 1;
         if (variations[k] === 'Underdog') currentUndScore += 1;
      });
      
      if (currentFavScore > currentUndScore + 1) finalLean = 'Fav';
      else if (currentUndScore > currentFavScore + 1) finalLean = 'Underdog';
      else finalLean = 'Draw';
  }

  // Calculate final probabilities
  let overallFavProb = histFavProb;
  let overallUndProb = histUndProb;
  let overallDrawProb = histDrawProb;
  
  if (decisionLogic === 'PIVOT') {
      // If pivoting, heavily skew based on lean
      if (finalLean === 'Fav') { overallFavProb = 60; overallDrawProb = 25; overallUndProb = 15; }
      else if (finalLean === 'Underdog') { overallUndProb = 60; overallDrawProb = 25; overallFavProb = 15; }
      else { overallDrawProb = 50; overallFavProb = 25; overallUndProb = 25; }
  }

;

let engine = fs.readFileSync('src/services/seerIntelligenceEngine.ts', 'utf8');
engine = engine.replace(/\/\/ Calculate Current Match Support \(The Pivot Logic\)[\s\S]*?const overallDrawProb = [^\n]+/m, replacement.trim());
fs.writeFileSync('src/services/seerIntelligenceEngine.ts', engine);
console.log('Updated engine logic');
