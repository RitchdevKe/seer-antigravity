import 'dotenv/config';
import { supabase } from '../src/lib/supabase';
import { getActualResult } from '../src/utils/matchProcessing';
import { extractMLFeatures, generateSITags } from '../src/utils/mlFeatureExtractor';

async function testUserClaims() {
  const { data: res } = await supabase.from('live_matches')
    .select('data, result')
    .neq('result', '')
    .neq('result', '?-?')
    .neq('result', 'Unknown')
    .neq('result', 'pending');

  let algoFavMatches = 0;
  let algoFavDCHits = 0;

  let subUndMatches = 0;
  let subUndDCHits = 0;

  let seerDrawMatches = 0;
  let seerDrawDCHits = 0;

  res?.forEach(r => {
    const m = r.data;
    const act = getActualResult(r.result);
    if (act === 'pending') return;
    
    const feats = extractMLFeatures(m);
    
    // Check if result is Fav, Und, or Draw
    let actualOutcome = 'Draw';
    if (act === '1' && feats.favIndex === 0) actualOutcome = 'Fav';
    else if (act === '2' && feats.favIndex === 2) actualOutcome = 'Fav';
    else if (act === '1' && feats.favIndex === 2) actualOutcome = 'Underdog';
    else if (act === '2' && feats.favIndex === 0) actualOutcome = 'Underdog';

    // 1. Algo predicts M.Fav (Algo Fav probability is highest)
    if (feats.study5_algo) {
        const a = feats.study5_algo;
        if (a.fav > a.draw && a.fav > a.underdog) {
            algoFavMatches++;
            if (actualOutcome === 'Fav' || actualOutcome === 'Draw') algoFavDCHits++; // DC = Fav or Draw
        }
    }

    // 2. Sub-pattern predicts Underdog
    if (feats.study3_subPatternPrediction) {
        // Subpattern prediction is '1', 'X', '2'
        const sp = feats.study3_subPatternPrediction;
        let isUndPred = false;
        if (sp === '1' && feats.favIndex === 2) isUndPred = true;
        if (sp === '2' && feats.favIndex === 0) isUndPred = true;
        
        if (isUndPred) {
            subUndMatches++;
            if (actualOutcome === 'Underdog' || actualOutcome === 'Draw') subUndDCHits++; // DC = Und or Draw
        }
    }

    // 3. SEER (default) predicts Draw
    if (feats.study6_seer) {
        const s = feats.study6_seer;
        if (s.draw > s.fav && s.draw > s.underdog) {
            seerDrawMatches++;
            if (actualOutcome === 'Underdog' || actualOutcome === 'Draw') seerDrawDCHits++; // Draw prediction usually means Upset DC (Und or Draw)
        }
    }
  });

  console.log(`Algo M.Fav Prediction -> Fav DC Hit Rate: ${algoFavDCHits}/${algoFavMatches} (${((algoFavDCHits/algoFavMatches)*100).toFixed(1)}%)`);
  console.log(`Sub-pattern Underdog Prediction -> Und DC Hit Rate: ${subUndDCHits}/${subUndMatches} (${((subUndDCHits/subUndMatches)*100).toFixed(1)}%)`);
  console.log(`SEER Draw Prediction -> Und DC Hit Rate: ${seerDrawDCHits}/${seerDrawMatches} (${((seerDrawDCHits/seerDrawMatches)*100).toFixed(1)}%)`);
}

testUserClaims();
