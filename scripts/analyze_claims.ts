import 'dotenv/config';
import { supabase } from '../src/lib/supabase';
import { getActualResult, matchesPrediction } from '../src/utils/matchProcessing';

async function analyze() {
  const { data: res } = await supabase.from('live_matches')
    .select('data, result')
    .neq('result', '')
    .neq('result', '?-?')
    .neq('result', 'Unknown')
    .neq('result', 'pending');

  let total = 0;
  
  let algoFavCorrect = 0, algoFavTotal = 0;
  let subUndCorrect = 0, subUndTotal = 0;
  let seerDrawCorrect = 0, seerDrawTotal = 0;

  res?.forEach(r => {
    const m = r.data;
    const act = getActualResult(r.result);
    if (act === 'pending' || !m.algoReport || !m.patternAnalysis || !m.totalPoints) return;
    
    total++;
    
    const odds = m.mo ? m.mo.split(',').map(Number) : [0,0,0];
    let favSide = 'home';
    let undSide = 'away';
    if (odds.length === 3 && odds[2] < odds[0]) {
      favSide = 'away';
      undSide = 'home';
    }

    const algoPred = m.algoReport.prediction;
    if ((favSide === 'home' && (algoPred === '1X' || algoPred === '1')) || 
        (favSide === 'away' && (algoPred === 'X2' || algoPred === '2'))) {
        algoFavTotal++;
        if (matchesPrediction(algoPred, act)) algoFavCorrect++;
    }

    const subPred = m.patternAnalysis.subPatternPrediction;
    if ((undSide === 'home' && (subPred === '1X' || subPred === '1')) || 
        (undSide === 'away' && (subPred === 'X2' || subPred === '2'))) {
        subUndTotal++;
        if (matchesPrediction(subPred, act)) subUndCorrect++;
    }

    const seerPred = m.calculatedPrediction; 
    if (seerPred === 'X' || m.totalPoints.draw > m.totalPoints.home && m.totalPoints.draw > m.totalPoints.away) {
        seerDrawTotal++;
        if (matchesPrediction('1X', act) || matchesPrediction('X2', act)) {
            // Did it actually draw?
            if (act === 'X') seerDrawCorrect++;
        }
    }
  });

  console.log('Total Completed Matches:', total);
  if (algoFavTotal > 0) console.log(`Algo on M.Fav: ${(algoFavCorrect/algoFavTotal*100).toFixed(1)}% (${algoFavCorrect}/${algoFavTotal})`);
  if (subUndTotal > 0) console.log(`Sub-pattern on Underdogs: ${(subUndCorrect/subUndTotal*100).toFixed(1)}% (${subUndCorrect}/${subUndTotal})`);
  if (seerDrawTotal > 0) console.log(`SEER predicting Draws (Actually ended in Draw): ${(seerDrawCorrect/seerDrawTotal*100).toFixed(1)}% (${seerDrawCorrect}/${seerDrawTotal})`);
}

analyze();
