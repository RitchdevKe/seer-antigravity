import 'dotenv/config';
import { supabase } from '../src/lib/supabase';
import { getActualResult, matchesPrediction } from '../src/utils/matchProcessing';
import { extractMLFeatures, generateSITags } from '../src/utils/mlFeatureExtractor';

async function mineFailedMatches() {
  const { data: res } = await supabase.from('live_matches')
    .select('data, result')
    .neq('result', '')
    .neq('result', '?-?')
    .neq('result', 'Unknown')
    .neq('result', 'pending');

  const failedData: { actual: string, tags: string[], paa: string }[] = [];
  
  res?.forEach(r => {
    const m = r.data;
    const act = getActualResult(r.result);
    if (act === 'pending' || !m.paaPrediction) return;
    
    const features = extractMLFeatures(m);
    const tags = generateSITags(features);
    
    // Convert 1X2 result to Fav/Und/Draw based on features.favIndex
    let actualOutcome = 'Draw';
    if (act === '1' && features.favIndex === 0) actualOutcome = 'Fav';
    else if (act === '2' && features.favIndex === 2) actualOutcome = 'Fav';
    else if (act === '1' && features.favIndex === 2) actualOutcome = 'Underdog';
    else if (act === '2' && features.favIndex === 0) actualOutcome = 'Underdog';

    if (!matchesPrediction(m.paaPrediction, act)) {
        failedData.push({
            actual: actualOutcome,
            tags,
            paa: m.paaPrediction
        });
    }
  });
  
  const comboStats: Record<string, { total: number, rFav: number, rDraw: number, rUnd: number }> = {};
  
  failedData.forEach(fd => {
      for(let i=0; i<fd.tags.length; i++) {
          for(let j=i+1; j<fd.tags.length; j++) {
              const combo = [fd.tags[i], fd.tags[j]].sort().join('+');
              if (!comboStats[combo]) comboStats[combo] = { total: 0, rFav: 0, rDraw: 0, rUnd: 0 };
              comboStats[combo].total++;
              if (fd.actual === 'Fav') comboStats[combo].rFav++;
              if (fd.actual === 'Draw') comboStats[combo].rDraw++;
              if (fd.actual === 'Underdog') comboStats[combo].rUnd++;
          }
      }
  });

  const actionableCombos = Object.entries(comboStats)
      .filter(([_, stats]) => stats.total >= 8)
      .map(([combo, stats]) => {
          let highest = 'Fav';
          let highestCount = stats.rFav;
          if (stats.rDraw > highestCount) { highest = 'Draw'; highestCount = stats.rDraw; }
          if (stats.rUnd > highestCount) { highest = 'Underdog'; highestCount = stats.rUnd; }
          
          return {
              combo,
              total: stats.total,
              highestResult: highest,
              highestCount,
              percentage: (highestCount / stats.total) * 100
          };
      })
      .filter(c => c.percentage >= 80)
      .sort((a, b) => b.total - a.total);

  console.log('\nTop Predictive Pivot Rules for Failed Matches (80%+ correlation):');
  actionableCombos.slice(0, 20).forEach(c => {
      console.log(`${c.combo} -> Pivots to ${c.highestResult} (Hits ${c.percentage.toFixed(1)}% of the time, ${c.highestCount}/${c.total})`);
  });
}

mineFailedMatches();
