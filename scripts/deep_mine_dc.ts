import 'dotenv/config';
import { supabase } from '../src/lib/supabase';
import { getActualResult } from '../src/utils/matchProcessing';
import { extractMLFeatures, generateSITags } from '../src/utils/mlFeatureExtractor';

async function mineAllMatchesDC() {
  const { data: res } = await supabase.from('live_matches')
    .select('data, result')
    .neq('result', '')
    .neq('result', '?-?')
    .neq('result', 'Unknown')
    .neq('result', 'pending');

  const allData: { actual: string, tags: string[], paa: string }[] = [];
  
  res?.forEach(r => {
    const m = r.data;
    const act = getActualResult(r.result);
    if (act === 'pending' || !m.paaPrediction) return;
    
    const features = extractMLFeatures(m);
    const tags = generateSITags(features);
    
    let actualOutcome = 'Draw';
    if (act === '1' && features.favIndex === 0) actualOutcome = 'Fav';
    else if (act === '2' && features.favIndex === 2) actualOutcome = 'Fav';
    else if (act === '1' && features.favIndex === 2) actualOutcome = 'Underdog';
    else if (act === '2' && features.favIndex === 0) actualOutcome = 'Underdog';

    allData.push({
        actual: actualOutcome,
        tags,
        paa: m.paaPrediction
    });
  });
  
  const comboStats: Record<string, { total: number, rFav: number, rDraw: number, rUnd: number }> = {};
  
  allData.forEach(fd => {
      // 3-tag combos take too long, let's stick to 2-tag combos
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
      .filter(([_, stats]) => stats.total >= 10)
      .map(([combo, stats]) => {
          // Double Chance Options
          const FavDraw = stats.rFav + stats.rDraw;
          const UndDraw = stats.rUnd + stats.rDraw;
          const FavUnd = stats.rFav + stats.rUnd;
          
          let highest = 'Fav/Draw (1X or X2 for Fav)';
          let highestCount = FavDraw;
          if (UndDraw > highestCount) { highest = 'Und/Draw (Upset DC)'; highestCount = UndDraw; }
          if (FavUnd > highestCount) { highest = 'Fav/Und (12)'; highestCount = FavUnd; }
          
          return {
              combo,
              total: stats.total,
              highestResult: highest,
              highestCount,
              percentage: (highestCount / stats.total) * 100
          };
      })
      .filter(c => c.percentage >= 95) // 95%+ Double Chance correlation!
      .sort((a, b) => b.total - a.total);

  console.log('\nTop Highly Predictive Tags for DOUBLE CHANCE (95%+ winrate):');
  actionableCombos.slice(0, 30).forEach(c => {
      console.log(`${c.combo} -> ALWAYS results in ${c.highestResult} (Hits ${c.percentage.toFixed(1)}% of the time, ${c.highestCount}/${c.total})`);
  });
}

mineAllMatchesDC();
