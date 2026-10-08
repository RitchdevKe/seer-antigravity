import { supabase } from '../src/lib/supabase';
import { processMatch, getActualResult, getFavoriteAndUnderdog } from '../src/utils/matchProcessing';
import { getMatchEvaluatorTags, getMatchStats } from '../src/utils/matchEvaluator';
import { predictSeerDetailed, DEFAULT_WEIGHTS, getMatchScore } from '../src/utils/seerLogic';
import { Match } from '../src/types';

async function main() {
  console.log("=========================================================================");
  console.log("🧠 SEER COGNITIVE RESEARCH AGENT: TOP 12 VALUE SLIP");
  console.log("=========================================================================");

  // 1. Fetch matches from database
  console.log("Fetching matches from database...");
  const rawMatches: Match[] = [];
  const step = 1000;
  for (let table of ['precalculated_matches', 'user_uploaded_matches', 'live_matches']) {
    let from = 0;
    while (true) {
      const { data, error } = await supabase.from(table).select('id, data').range(from, from + step - 1);
      if (error || !data || data.length === 0) break;
      data.forEach(row => { if (row.data) rawMatches.push(row.data as Match); });
      if (data.length < step) break;
      from += step;
    }
  }

  // Deduplicate
  const uniqueMatchesMap = new Map<string, Match>();
  rawMatches.forEach(m => {
    if (m && m.id) uniqueMatchesMap.set(m.id.toString(), m);
  });
  const matches = Array.from(uniqueMatchesMap.values());
  console.log(`Loaded ${matches.length} unique matches.`);

  // 2. Fetch PHA Stats Map
  console.log("Fetching PHA Stats...");
  let phaStatsMap: Record<string, any> = {};
  try {
    const { data: phaData } = await supabase.from('pha_stats').select('*');
    if (phaData && phaData.length > 0) {
      phaData.forEach(row => {
        if (row.sub_pattern) phaStatsMap[row.sub_pattern] = row;
      });
    }
  } catch (e) {
    console.log("Failed to fetch PHA stats.");
  }

  // 3. Process and find Top 12 candidate matches
  console.log("Filtering Top 12 (top_10_value) candidates...");
  const candidates: Match[] = [];
  matches.forEach(rawMatch => {
    const m = processMatch(rawMatch);
    const tags = getMatchEvaluatorTags(m, phaStatsMap);
    const hasPrimaryTag = tags.some(t => t.startsWith('top10:'));
    const stats = getMatchStats(m, phaStatsMap);
    
    // Check if match fits 'top_10_value' filter
    if (hasPrimaryTag || (stats.favOdds >= 2.0 && stats.favOdds <= 2.49)) {
      candidates.push(m);
    }
  });

  // Keep only matches with actual results
  const completedCandidates = candidates.filter(m => {
    const actual = getActualResult(m.result ? String(m.result) : 'UNKNOWN');
    return actual !== 'UNKNOWN' && actual !== 'pending';
  });

  console.log(`Found ${completedCandidates.length} COMPLETED candidates for Top 12 Value.`);

  // Function to simulate selection for a specific weight configuration
  const runSimulation = (weights: any) => {
    const scored = completedCandidates.map(m => {
      let score = 0;
      
      const stats = getMatchStats(m, phaStatsMap);
      const tags = getMatchEvaluatorTags(m, phaStatsMap);
      const hasPrimaryTag = tags.some(t => t.startsWith('top10:'));

      const seerResult = predictSeerDetailed(m, weights, phaStatsMap, {});
      const primaryPred = seerResult.primary;
      const moFav = stats.moFav as '1'|'2';
      
      score += seerResult.percentages[primaryPred] * 2;
      
      // Category gatekeeper boost logic for top_10_value from seerSlipSelection.ts
      let boost = 0;
      const subPred = m.patternAnalysis?.subPatternPrediction || '';
      const algoPred = m.algoReport?.prediction || '';
      // Simple mock for paaPred since we don't import getPAAPredictionForSeer
      const paaPred = m.paaPrediction || m.paaPrimaryPrediction || ''; 

      const isSubPaaAgree = !!subPred && !!paaPred && subPred === paaPred;
      const isPaaAlgoAgree = !!paaPred && !!algoPred && paaPred === algoPred;

      let favSupport = stats.phaFavWinSupport || 0;
      let upsetRate = stats.paaStats?.upsetRate || 0;

      if ((isSubPaaAgree || isPaaAlgoAgree) && favSupport >= 80 && upsetRate <= 10) boost += 3000;
      else if ((isSubPaaAgree || isPaaAlgoAgree) && favSupport >= 75 && upsetRate <= 10) boost += 2000;
      else if (favSupport >= 80 && upsetRate <= 10) boost += 1000;
      score += boost;

      // Penalties for top_10_value from seerSlipSelection.ts
      let penalty = 0;
      penalty += favSupport * 4;
      penalty -= upsetRate * 20;
      const totalPaaMatches = stats.paaStats?.total || stats.totalMatches || 0;
      if (totalPaaMatches <= 5) penalty -= 1000;
      if (upsetRate >= 20) penalty -= 1000;
      if (upsetRate >= 15 && stats.underdogOdds <= 3.8) penalty -= 1000;
      if (favSupport < 60) penalty -= 800;
      if (stats.probFav < 0.45) penalty -= 800;
      
      score += penalty;
      
      // African leagues penalty
      const teams = (m.teams || '').toLowerCase();
      const league = (m.league || '').toLowerCase();
      const africanRegex = /tanzania|kenya|uganda|rwanda|egypt|morocco|nigeria|ghana|south africa|zambia|senegal|tunisia|algeria|mali|cameroon|congo|angola|burundi|sudan|somalia|ethiopia|zimbabwe|ivory coast/i;
      if (africanRegex.test(teams) || africanRegex.test(league)) {
        score -= 150;
      }

      const seerScoreFav = seerResult.percentages[moFav] || 0;
      if (stats.probFav < 0.50 && seerScoreFav < 50 && favSupport < 50) score -= 200;
      if (hasPrimaryTag) score += 1000;

      return { m, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // Select top 12 matches (ignoring sharing limits just to test raw power)
    const selected: Match[] = [];
    for (const item of scored) {
      if (selected.length >= 12) break;
      const m = item.m;
      const normMTeams = m.teams.toLowerCase().replace(/[^a-z0-9]/g, '');
      const alreadyIn = selected.some(p => p.id.toString() === m.id.toString() || p.teams.toLowerCase().replace(/[^a-z0-9]/g, '') === normMTeams);
      if (!alreadyIn) {
        selected.push(m);
      }
    }

    let successes = 0;
    let pureFavWins = 0;
    selected.forEach(m => {
      const stats = getMatchStats(m, phaStatsMap);
      const actual = getActualResult(m.result ? String(m.result) : 'UNKNOWN');
      if (actual === stats.moFav) { successes++; pureFavWins++; }
      else if (actual === 'X') { successes++; }
    });

    return {
      selected,
      successPct: selected.length > 0 ? (successes / selected.length) * 100 : 0,
      pureFavPct: selected.length > 0 ? (pureFavWins / selected.length) * 100 : 0,
      weights
    };
  };

  const baseWeights = {
    algoWeight: 30,
    paaPredWeight: 48,
    subPatternWeight: 30,
    probConfWeight: 12,
    phaWeight: 10,
    paaPercentWeight: 40,
    perfStarsWeight: 21,
    pred1x2Weight: 20,
    pred1x2RatingBoost: 29,
    drawDisagreementBoost: 20,
    synergyAgreementBoost: 6,
    synergyCondA: 601,
    synergyCondB: 449,
    synergyCondC: 181,
    synergyCondD: 444,
    synergyCondE: 160,
    synergyGapBoost: 735,
    upsetPaaBoost: 5,
    upsetProbBoost: 0,
    upsetSeerPrimBoost: 2,
    upsetPatternBoost: 3,
    paaAlgoSubPattAgreementBoost: 60,
    paaAlgoAgreementBoost: 80,
    subPattPaaAgreementBoost: 40
  };

  console.log("\nEvaluating Current configuration...");
  const currentSim = runSimulation(baseWeights);
  console.log(`Current Top 12 Selection Success Rate (Fav Win or Draw): ${currentSim.successPct.toFixed(1)}%`);
  console.log(`Current Pure Favorite Win Rate:                 ${currentSim.pureFavPct.toFixed(1)}%\n`);

  console.log("-------------------------------------------------------------------------");
  console.log("🔍 GRID SEARCH OVER PARAMETER COMBINATIONS FOR TOP_10_VALUE");
  console.log("-------------------------------------------------------------------------");

  const paaOptions = [40, 70, 95];
  const algoOptions = [10, 40, 80];
  const subOptions = [10, 40, 80];
  const probOptions = [10, 50, 90];
  const paaPercentOptions = [10, 50, 90];
  const synergyAOptions = [500, 800];
  const gapOptions = [500, 800];

  let found100Count = 0;
  let bestSuccess = 0;
  let bestPureFav = 0;
  const successfulScenarios: any[] = [];

  for (const paa of paaOptions) {
    for (const algo of algoOptions) {
      for (const sub of subOptions) {
        for (const prob of probOptions) {
            for (const percent of paaPercentOptions) {
                for (const synA of synergyAOptions) {
                    for (const gap of gapOptions) {
                        const testW = {
                            ...baseWeights,
                            paaPredWeight: paa,
                            algoWeight: algo,
                            subPatternWeight: sub,
                            probConfWeight: prob,
                            paaPercentWeight: percent,
                            synergyCondA: synA,
                            synergyGapBoost: gap,
                            paaAlgoAgreementBoost: 80,
                            subPattPaaAgreementBoost: 80,
                            paaAlgoSubPattAgreementBoost: 120
                        };
                        const sim = runSimulation(testW);
                        
                        if (sim.successPct > bestSuccess) {
                            bestSuccess = sim.successPct;
                        }
                        if (sim.successPct === 100) {
                            found100Count++;
                            successfulScenarios.push({
                            paa, algo, sub, prob, percent, synA, gap,
                            pureFavPct: sim.pureFavPct,
                            weights: testW
                            });
                        } else if (sim.successPct >= 91.6) { // 11/12 or better
                            successfulScenarios.push({
                                paa, algo, sub, prob, percent, synA, gap,
                                pureFavPct: sim.pureFavPct,
                                weights: testW,
                                successPct: sim.successPct
                            });
                        }
                    }
                }
            }
        }
      }
    }
  }

  console.log(`Grid search found highest success rate of ${bestSuccess}%`);

  if (successfulScenarios.length > 0) {
    // Sort by successPct desc, then pureFavPct desc
    successfulScenarios.sort((a, b) => {
        const sA = a.successPct || 100;
        const sB = b.successPct || 100;
        if (sB !== sA) return sB - sA;
        return b.pureFavPct - a.pureFavPct;
    });

    console.log("\nTop 5 Weighting Configurations:\n");
    successfulScenarios.slice(0, 5).forEach((scen, idx) => {
      const s = scen.successPct || 100;
      console.log(`🏆 OPTIMIZED OPTION #${idx+1} (Success Rate: ${s.toFixed(1)}%, Pure Fav Win: ${scen.pureFavPct.toFixed(1)}%)`);
      console.log(`   - paaPredWeight:       ${scen.paa}`);
      console.log(`   - algoWeight:          ${scen.algo}`);
      console.log(`   - subPatternWeight:    ${scen.sub}`);
      console.log(`   - probConfWeight:      ${scen.prob}`);
      console.log(`   - paaPercentWeight:    ${scen.percent}`);
      console.log(`   - synergyCondA:        ${scen.synA}`);
      console.log(`   - synergyGapBoost:     ${scen.gap}`);
      console.log();
    });
  }
}

main().catch(console.error);
