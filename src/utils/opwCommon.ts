import { Match } from '../types';
import { predictSeerDetailed, DEFAULT_WEIGHTS } from './seerLogic';
import { getMatchEvaluatorTags } from './matchEvaluator';
import { calculatePAAPrediction, getLogicalDate } from './matchProcessing';
import { predictWithHybridML } from './hybridMachineLearning';
import { loadApprovedCustomTriggers } from './opwTriggerDiscovery';

export * from './opwDayMetadata';


export interface BaseWeightInterval {
    id: string;
    min: number;
    max: number;
    points: number;
    metric: 'pha_market_fav' | 'pha_underdog' | 'market_fav_odds' | 'underdog_odds';
}

export interface OptimizedCategorySettings {
    name: string;
    description: string;
    baseLogic: string;
    rules: { description: string; points: number }[];
    baseWeightIntervals?: BaseWeightInterval[];
}

export interface OptimizedScoreDetail {
    totalScore: number;
    baseInfo: { points: number, mFav: '1'|'2', phaPercentage: number, isUnderdogBase: boolean };
    rulesHit: { description: string, points: number }[];
    optimizedPrediction: string;
    activeHedgingProtocol: string | null;
}

export const isClose = (val1: number, val2: number, threshold: number = 0.2) => Math.abs(val1 - val2) <= threshold + Number.EPSILON;

export function getMatchDayOfWeek(match: Match): DayOfWeek {
    const dateStr = match.date;
    const timeStr = match.time;
    const logicalDate = getLogicalDate(dateStr || '', timeStr);
    if (logicalDate) {
        const parts = logicalDate.split('-');
        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                const d = new Date(Date.UTC(year, month, day, 12, 0, 0));
                const dayNum = d.getUTCDay();
                const dayMap: Record<number, DayOfWeek> = {
                    0: 'sunday',
                    1: 'monday',
                    2: 'tuesday',
                    3: 'wednesday',
                    4: 'thursday',
                    5: 'friday',
                    6: 'saturday'
                };
                if (dayMap[dayNum]) return dayMap[dayNum];
            }
        }
    }
    return 'saturday';
}

export function getMarketFavorite(match: Match): '1' | '2' {
    const moParts = (match.mo || '').split(/[- ,]+/).map(s => parseFloat(s.trim())).filter(p => !isNaN(p));
    const homeOdds = moParts[0] || 0;
    const awayOdds = moParts[2] || 0;
    
    if (homeOdds > 0 && awayOdds > 0) {
        if (awayOdds < homeOdds) return '2';
    }
    return '1';
}

export const enforceAlgoPredictionRules = (
  primary: string,
  final: string,
  probs?: { '1': number; 'X': number; '2': number }
): { primaryPrediction: string; finalPrediction: string } => {
  let prim = (primary || '').trim().toUpperCase();
  let fin = (final || '').trim().toUpperCase();
  if (!fin) fin = prim;

  const p1 = probs?.['1'] ?? 0;
  const pX = probs?.['X'] ?? 0;
  const p2 = probs?.['2'] ?? 0;

  if (!['1', 'X', '2'].includes(prim)) {
    if (prim.includes('1')) prim = '1';
    else if (prim.includes('2')) prim = '2';
    else prim = 'X';
  }

  let isFinValid = false;
  if (prim === '1' && (fin === '1X' || fin === '12' || fin === '1')) isFinValid = true;
  else if (prim === 'X' && (fin === '1X' || fin === 'X2' || fin === 'X')) isFinValid = true;
  else if (prim === '2' && (fin === '12' || fin === 'X2' || fin === '2')) isFinValid = true;
  else if (fin === prim) isFinValid = true;

  if (!isFinValid) {
      if (prim === '1') {
          fin = pX >= p2 ? '1X' : '12';
      } else if (prim === '2') {
          fin = pX >= p1 ? 'X2' : '12';
      } else if (prim === 'X') {
          fin = p1 >= p2 ? '1X' : 'X2';
      }
  }

  return { primaryPrediction: prim, finalPrediction: fin };
};

export const parseLastEncounter = (leStr: string | undefined, mFav: '1' | '2', underdog: '1' | '2') => {
    if (!leStr || leStr === 'NA' || leStr === '-' || leStr === 'Unknown') return null;
    const matchLE = leStr.trim().match(/^([AB])?\s*(\d+)\s*[:\-]\s*(\d+)$/i);
    if (!matchLE) return null;

    const prefix = matchLE[1] ? matchLE[1].toUpperCase() : 'A';
    const s1 = parseInt(matchLE[2], 10);
    const s2 = parseInt(matchLE[3], 10);
    if (isNaN(s1) || isNaN(s2)) return null;

    const teamAGoals = prefix === 'B' ? s2 : s1;
    const teamBGoals = prefix === 'B' ? s1 : s2;

    const mFavGoals = mFav === '1' ? teamAGoals : teamBGoals;
    const underdogGoals = underdog === '1' ? teamAGoals : teamBGoals;

    const mFavWon = mFavGoals > underdogGoals;
    const underdogWon = underdogGoals > mFavGoals;
    const isDraw = mFavGoals === underdogGoals;

    const mFavWasAway = (mFav === '1' && prefix === 'B') || (mFav === '2' && prefix === 'A');
    const underdogWasAway = (underdog === '1' && prefix === 'B') || (underdog === '2' && prefix === 'A');

    return {
        mFavGoals,
        underdogGoals,
        mFavWon,
        underdogWon,
        isDraw,
        mFavWasAway,
        underdogWasAway
    };
};

export const checkIsIsraelMatch = (match: Match): boolean => {
    const league = (match.league || '').toLowerCase();
    const teams = (match.teams || '').toLowerCase();
    return /\b(israel|ligat\s*ha['`’]?al|liga\s*leumit|israeli)\b/i.test(league) ||
           /\b(israel|ligat\s*ha['`’]?al|liga\s*leumit|israeli)\b/i.test(teams) ||
           /\((isr|israel)\)/i.test(teams) ||
           /\b(maccabi|hapoel|beitar|bnei\s*sakhnin|bnei\s*yehuda|ironi\s*kiryat\s*shmona|ironi\s*tiberias|fc\s*ashdod|sektzia\s*nes\s*tziona)\b/i.test(teams) ||
           /\b(m\.\s*tel\s*aviv|m\.\s*haifa|m\.\s*netanya|m\.\s*petah\s*tikva|h\.\s*beer\s*sheva|h\.\s*tel\s*aviv|h\.\s*haifa|h\.\s*jerusalem|h\.\s*hadera|h\.\s*petah\s*tikva)\b/i.test(teams);
};


export const checkIsEuropeanLeague3Match = (match: Match): boolean => {
    const league = (match.league || '').toLowerCase();
    const teams = (match.teams || '').toLowerCase();
    
    // Explicit 3 / III league patterns
    const tier3Regex = /\b(league\s*3|league\s*iii|liga\s*3|liga\s*iii|division\s*3|division\s*iii|div\s*3|tier\s*3|3\.\s*liga|serie\s*c|league\s*one|national\s*1|primera\s*federaci[oó]n|segunda\s*b|3rd\s*division|third\s*division)\b/i;
    if (tier3Regex.test(league) || tier3Regex.test(teams)) return true;

    // Check European country with tier 3 identifier or Roman numeral III
    const europeanCountries = /\b(england|germany|spain|italy|france|portugal|netherlands|scotland|turkey|poland|austria|switzerland|czech|sweden|norway|greece|belgium|denmark|croatia|serbia|romania|bulgaria|hungary|slovakia|slovenia|finland|ireland|wales|northern ireland|cyprus)\b/i;
    const hasEuropeanContext = europeanCountries.test(league) || europeanCountries.test(teams);
    if (hasEuropeanContext && /\b(tier\s*3|div(?:ision)?\s*3|3\b|iii\b)/i.test(league)) {
        return true;
    }
    
    return false;
};

export const checkIsAfricanLeagueMatch = (match: Match): boolean => {
    const tags = match.evaluatorTags || [];
    if (tags.includes('BANNED:AFRICAN_LEAGUE')) return true;
    const league = (match.league || '').toLowerCase();
    const teams = (match.teams || '').toLowerCase();
    const africanDomesticRegex = /\b(africa|african|caf|tanzania|tanzanian|kenya|kenyan|uganda|ugandan|rwanda|rwandan|egypt|egyptian|morocco|moroccan|nigeria|nigerian|ghana|ghanaian|south africa|south african|zambia|zambian|senegal|senegalese|tunisia|tunisian|algeria|algerian|mali|cameroon|cameroonian|congo|angola|angolan|burundi|sudan|sudanese|somalia|ethiopia|ethiopian|malawi|mozambique|botswana|namibia|zimbabwe|zimbabwean|lesotho|eswatini|madagascar|ivory coast|cote d'ivoire|guinea|burkina faso|benin|togo|mauritania|niger|chad|central african|gabon|equatorial|djibouti|eritrea|seychelles|comoros|mauritius|sao tome|sierra leone|liberia|gambia|cape verde)\b|suhul shire|caps united|triangle u|chemilil|sony sugar|jkt/i;
    return africanDomesticRegex.test(league) || africanDomesticRegex.test(teams);
};

export const checkIsEnglandAmateurMatch = (match: Match): boolean => {
    const tags = match.evaluatorTags || [];
    if (tags.some(t => /england.*amateur/i.test(t))) return true;
    const league = (match.league || '').toLowerCase();
    const teams = (match.teams || '').toLowerCase();

    // Explicit England Amateur in league or teams string
    if (/england\s*(?:[:\-])?\s*amateur/i.test(league) || /england\s*(?:[:\-])?\s*amateur/i.test(teams)) {
        return true;
    }

    // English non-league / amateur competitions
    const isEnglishContext = /\b(england|english)\b/i.test(league) || /\((?:eng|england)\)/i.test(teams);
    if (isEnglishContext && /\b(amateur|national\s*league|isthmian|southern\s*(?:football\s*)?league|northern\s*premier|fa\s*trophy|non-league)\b/i.test(league)) {
        return true;
    }

    if (/\b(national\s*league\s*(?:north|south)|isthmian\s*league|northern\s*premier\s*league|southern\s*league\s*premier|fa\s*trophy)\b/i.test(league)) {
        return true;
    }

    return false;
};

export const checkIsNorway3rdDivisionMatch = (match: Match): boolean => {
    const tags = match.evaluatorTags || [];
    if (tags.some(t => /norway.*(?:3|third)/i.test(t))) return true;
    const league = (match.league || '').toLowerCase();
    const teams = (match.teams || '').toLowerCase();

    if (/\b(?:norway|norwegian|norge)\b/i.test(league) || /\b(?:norway|norwegian|norge)\b/i.test(teams) || /\((?:nor|norway)\)/i.test(teams)) {
        if (/\b(?:3rd\s*division|3\.\s*division|3\.\s*divisjon|division\s*3|div\s*3|3\s*divisjon)\b/i.test(league) ||
            /\b(?:3rd\s*division|3\.\s*division|3\.\s*divisjon|division\s*3|div\s*3|3\s*divisjon)\b/i.test(teams)) {
            return true;
        }
    }

    return false;
};

export interface MatchEvaluationStats {
    mFav: '1' | '2';
    underdog: '1' | '2';
    gaHome: number;
    gaAway: number;
    gsHome: number;
    gsAway: number;
    mFavGA: number;
    underdogGA: number;
    mFavGS: number;
    underdogGS: number;
    mFavPoints: number;
    udPoints: number;
    rawTsa: number;
    rawTsb: number;
    favTS: number;
    udTS: number;
    isVolatile: boolean;
    subPatternStr: string;
    pha: any;
    isPhaTie: boolean;
    isGSGAGA: boolean;
    paaSWin: number;
    phaDrawPct: number;
    phaUdPct: number;
    algoPrimPred: string;
    algoPred: string;
    algoProbs: number;
    algoPercentage: number;
    seerPrimPred: string;
    seerPred: string;
    seerScoreUd: number;
    seerScoreDraw: number;
    seerScoreFav: number;
    subPrimPred: string;
    subPred: string;
    paaPrimPred: string;
    paaPred: string;
    mlPrimPred: string;
    mlPred: string;
    pred1x2: string;
    initialMatchTags: string[];
    bothTeamsGAGreaterThanGS: boolean;
    o1: number;
    oX: number;
    o2: number;
    udOdds: number;
    favOdds: number;
    oddsDiff: number;
    isAwayFav: boolean;
    oddsUnderdogLessEqDraw: boolean;
    leData: any;
    leWasDraw: boolean;
    isIsraelMatch: boolean;
    isAfricanLeagueMatch: boolean;
    isEnglandAmateurMatch: boolean;
    isNorway3rdDivisionMatch: boolean;
    mFavL10: number;
    underdogL10: number;
    hasValidL10: boolean;
    underdogHasHigherL10: boolean;
    isL10Close: boolean;
    isL10Equal: boolean;
    rating1X2: number | null;
    isRatingLessEq2_5: boolean;
    isRatingLessThan3_0: boolean;
    isRating5to7: boolean;
    isRatingGreaterEq7: boolean;
    isMfavGaLe1_1AndUndGaGt1_1: boolean;
    isMfavGsUndGsClose: boolean;
    isBothTeamsGaGe1_5: boolean;
    underdogHiddenStrengthOrWeakness: boolean;
    isG2E5: boolean;
    isPaaSubAlgoMl12: boolean;
    optimizedPrediction: string;
    activeHedgingProtocol: string | null;
    evalCategoryId: string;
}

export function extractMatchEvaluationStats(
    match: Match,
    phaStatsMap: Record<string, any>,
    categoryId: string
): MatchEvaluationStats {
    let evalCategoryId = categoryId;
    if (categoryId === 'safety') evalCategoryId = 'best_bet';
    else if (categoryId === 'banker') evalCategoryId = 'bankers_dlive';
    else if (categoryId === 'jackpot') evalCategoryId = 'bankers_jackpot';
    else if (['top12', 'top10', 'top_12', 'top_12_value', 'top_10_value', 'sandbox_top_12_value', 'sandbox_top_10_value'].includes(categoryId)) {
        evalCategoryId = 'top_12_value';
    }
    else if (categoryId === 'botb_best' || categoryId === 'high_confidence') {
        const tags = match.evaluatorTags || [];
        if (tags.some(t => t.startsWith('top12:') || t.startsWith('top10:'))) evalCategoryId = 'top_12_value';
        else if (tags.some(t => t.startsWith('bankers_dlive:'))) evalCategoryId = 'bankers_dlive';
        else if (tags.some(t => t.startsWith('bankers_jackpot:'))) evalCategoryId = 'bankers_jackpot';
        else if (tags.some(t => t.startsWith('value_picks:'))) evalCategoryId = 'value_picks';
        else evalCategoryId = 'top_12_value';
    }

    const mFav = getMarketFavorite(match);
    const underdog = mFav === '1' ? '2' : '1';

    let mlInfo = match.mlInfo;
    if (!mlInfo) {
        try {
            mlInfo = predictWithHybridML(match);
        } catch (e) {}
    }
    const optimizedPrediction = mlInfo?.mlPrediction || match.finalPrediction || match.rawPrediction || "1";
    const activeHedgingProtocol: string | null = null;

    let seerScoreUd = 0;
    let seerScoreDraw = 0;
    let seerScoreFav = 0;
    let baseSeer: any = null;

    if (match.seerPercentages && match.seerPercentages[underdog] !== undefined) {
        seerScoreUd = match.seerPercentages[underdog];
        seerScoreDraw = match.seerPercentages['X'] || 0;
        seerScoreFav = match.seerPercentages[mFav] || 0;
    } else if (match.seerScores && match.seerScores[underdog] !== undefined) {
        seerScoreUd = match.seerScores[underdog];
        seerScoreDraw = match.seerScores['X'] || 0;
        seerScoreFav = match.seerScores[mFav] || 0;
    } else {
        try {
            baseSeer = predictSeerDetailed({ ...match }, DEFAULT_WEIGHTS, phaStatsMap || {}, {});
            if (baseSeer?.percentages) {
                seerScoreUd = baseSeer.percentages[underdog] || 0;
                seerScoreDraw = baseSeer.percentages['X'] || 0;
                seerScoreFav = baseSeer.percentages[mFav] || 0;
            }
        } catch (e) {}
    }

    // Fallback to algoReport probabilities if seer scores are still 0
    if (seerScoreDraw === 0 && match.algoReport?.probabilities) {
        seerScoreDraw = Math.round((match.algoReport.probabilities['X'] || 0) * 100);
        seerScoreUd = Math.round((match.algoReport.probabilities[underdog] || 0) * 100);
        seerScoreFav = Math.round((match.algoReport.probabilities[mFav] || 0) * 100);
    }

    if (seerScoreDraw > 0 && seerScoreDraw <= 1) seerScoreDraw = Math.round(seerScoreDraw * 100);
    if (seerScoreUd > 0 && seerScoreUd <= 1) seerScoreUd = Math.round(seerScoreUd * 100);
    if (seerScoreFav > 0 && seerScoreFav <= 1) seerScoreFav = Math.round(seerScoreFav * 100);

    let gaHome = parseFloat(match.gaHome?.toString() || '0');
    let gaAway = parseFloat(match.gaAway?.toString() || '0');
    let gsHome = parseFloat(match.gsHome?.toString() || '0');
    let gsAway = parseFloat(match.gsAway?.toString() || '0');

    if ((gsHome === 0 && gsAway === 0) && typeof match.gs === 'string' && match.gs.includes(':')) {
        const parts = match.gs.split(/[:\- ]+/).map(s => parseFloat(s.trim()));
        if (!isNaN(parts[0])) gsHome = parts[0];
        if (!isNaN(parts[1])) gsAway = parts[1];
    }
    if ((gaHome === 0 && gaAway === 0) && typeof match.ga === 'string' && match.ga.includes(':')) {
        const parts = match.ga.split(/[:\- ]+/).map(s => parseFloat(s.trim()));
        if (!isNaN(parts[0])) gaHome = parts[0];
        if (!isNaN(parts[1])) gaAway = parts[1];
    }

    const mFavGA = mFav === '1' ? gaHome : gaAway;
    const underdogGA = underdog === '1' ? gaHome : gaAway;
    const mFavGS = mFav === '1' ? gsHome : gsAway;
    const underdogGS = underdog === '1' ? gsHome : gsAway;

    const mFavPoints = mFav === '1' ? (match.totalPoints?.home || 0) : (match.totalPoints?.away || 0);
    const udPoints = underdog === '1' ? (match.totalPoints?.home || 0) : (match.totalPoints?.away || 0);

    let rawTsa = match.tsa !== undefined && match.tsa !== null ? parseFloat(match.tsa.toString()) : NaN;
    let rawTsb = match.tsb !== undefined && match.tsb !== null ? parseFloat(match.tsb.toString()) : NaN;

    if (isNaN(rawTsa) || rawTsa === 0) {
        if (gaHome > 0) rawTsa = parseFloat((gsHome / gaHome).toFixed(3));
        else if (gsHome > 0) rawTsa = 2.0;
        else rawTsa = 0;
    }
    if (isNaN(rawTsb) || rawTsb === 0) {
        if (gaAway > 0) rawTsb = parseFloat((gsAway / gaAway).toFixed(3));
        else if (gsAway > 0) rawTsb = 2.0;
        else rawTsb = 0;
    }

    const favTS = mFav === '1' ? rawTsa : rawTsb;
    const udTS = mFav === '1' ? rawTsb : rawTsa;
    const isVolatile = mFavGA >= 1.1 && underdogGA >= 1.1;

    const subPatternStr = match.patternAnalysis?.subPattern || '';
    const pha = subPatternStr ? phaStatsMap[subPatternStr] : null;
    let isPhaTie = false;
    if (pha && pha.total > 0) {
        const maxPha = Math.max(pha.favWin, pha.draw, pha.upsetWin);
        let maxCount = 0;
        if (pha.favWin === maxPha) maxCount++;
        if (pha.draw === maxPha) maxCount++;
        if (pha.upsetWin === maxPha) maxCount++;
        if (maxCount >= 2) isPhaTie = true;
    }

    const isGSGAGA = gsHome === gaHome && gsHome === gsAway && gsHome === gaAway && gsHome !== 0;

    let paaSWin = 0;
    let phaDrawPct = 0;
    let phaUdPct = 0;
    if (pha) {
        const totalPaa = (pha.paaTotal ?? pha.total) > 0 ? (pha.paaTotal ?? pha.total) : 0;
        if (totalPaa > 0) {
            const drawCount = pha.draw ?? pha.outcomes?.['X'] ?? 0;
            const udCount = pha.upsetWin ?? pha.outcomes?.[underdog] ?? 0;
            phaDrawPct = Math.round((drawCount / totalPaa) * 100);
            phaUdPct = Math.round((udCount / totalPaa) * 100);
            const favCount = pha.favWin ?? pha.outcomes?.[mFav] ?? 0;
            paaSWin = Math.round((favCount / totalPaa) * 100);
        }
    }
    if (paaSWin === 0 && match.paaWin) {
        paaSWin = match.paaWin;
    }
    if (phaDrawPct === 0 && match.paaDraw !== undefined) {
        phaDrawPct = match.paaDraw;
    } else if (phaDrawPct === 0 && match.seerPercentages?.['X'] !== undefined) {
        phaDrawPct = match.seerPercentages['X'];
    }

    if (phaUdPct === 0 && match.paaUpset !== undefined) {
        phaUdPct = match.paaUpset;
    } else if (phaUdPct === 0 && match.seerPercentages?.[underdog] !== undefined) {
        phaUdPct = match.seerPercentages[underdog];
    }

    const algoReport = match.algoReport;
    const rawAlgoPrim = (() => {
        if (algoReport?.primaryPrediction && algoReport.primaryPrediction !== 'N/A' && ['1', 'X', '2'].includes(algoReport.primaryPrediction)) {
            return algoReport.primaryPrediction;
        }
        if (match.rawPrediction && ['1', 'X', '2'].includes(match.rawPrediction)) {
            return match.rawPrediction;
        }
        if (algoReport?.prediction && ['1', 'X', '2'].includes(algoReport.prediction)) {
            return algoReport.prediction;
        }
        if (algoReport?.probabilities) {
            const p1 = algoReport.probabilities['1'] || 0;
            const pX = algoReport.probabilities['X'] || 0;
            const p2 = algoReport.probabilities['2'] || 0;
            if (p1 >= pX && p1 >= p2 && p1 > 0) return '1';
            if (p2 >= p1 && p2 >= pX && p2 > 0) return '2';
            if (pX >= p1 && pX >= p2 && pX > 0) return 'X';
        }
        if (algoReport?.prediction === '1X') return '1';
        if (algoReport?.prediction === 'X2') return '2';
        if (algoReport?.prediction === '12') return '1';
        return '';
    })();
    const rawAlgoFin = algoReport?.prediction || match.finalPrediction || match.rawPrediction || '';
    let algoPrimPred = rawAlgoPrim;
    let algoPred = rawAlgoFin;
    if (algoPrimPred && algoPred) {
        const enforced = enforceAlgoPredictionRules(algoPrimPred, algoPred, algoReport?.probabilities);
        algoPrimPred = enforced.primaryPrediction;
        algoPred = enforced.finalPrediction;
    }

    let seerPrim = match.seerPrimaryPrediction || '';
    if (!seerPrim && match.seerPercentages) {
        const p1 = match.seerPercentages['1'] || 0;
        const pX = match.seerPercentages['X'] || 0;
        const p2 = match.seerPercentages['2'] || 0;
        const maxP = Math.max(p1, pX, p2);
        if (maxP > 0) {
            if (p2 === maxP) seerPrim = '2';
            else if (p1 === maxP) seerPrim = '1';
            else seerPrim = 'X';
        }
    }
    if (!seerPrim && match.seerScores) {
        const s1 = match.seerScores['1'] || 0;
        const sX = match.seerScores['X'] || 0;
        const s2 = match.seerScores['2'] || 0;
        const maxS = Math.max(s1, sX, s2);
        if (maxS > 0) {
            if (s2 === maxS) seerPrim = '2';
            else if (s1 === maxS) seerPrim = '1';
            else seerPrim = 'X';
        }
    }
    if (!seerPrim && baseSeer?.primary) {
        seerPrim = baseSeer.primary;
    }

    let seerFin = match.seerPrediction || baseSeer?.final || match.finalPrediction || match.rawPrediction || '';
    const isHedged = (p: string) => ['1X', 'X1', '12', '21', 'X2', '2X'].includes(p);
    const isStraight = (p: string) => ['1', 'X', '2'].includes(p);
    if (isHedged(seerPrim) && isStraight(seerFin)) {
        const temp = seerPrim;
        seerPrim = seerFin;
        seerFin = temp;
    }
    if (seerPrim && seerFin) {
        const syncedSeer = enforceAlgoPredictionRules(seerPrim, seerFin, baseSeer?.percentages || match.seerPercentages);
        seerPrim = syncedSeer.primaryPrediction;
        seerFin = syncedSeer.finalPrediction;
    }
    const seerPred = seerFin;
    const seerPrimPred = seerPrim;

    const subPred = match.patternAnalysis?.subPatternPrediction || '';
    const subPrimPred = match.patternAnalysis?.primaryPrediction || '';

    let paaPrim = match.paaPrimaryPrediction;
    let paaFin = match.paaPrediction;
    if ((!paaPrim || !paaFin) && match.patternAnalysis?.subPattern && phaStatsMap) {
        const sub = match.patternAnalysis.subPattern;
        if (phaStatsMap[sub]) {
            const computedPaa = calculatePAAPrediction(match, phaStatsMap[sub]);
            if (computedPaa) {
                if (!paaPrim && computedPaa.paaPrimaryPrediction) paaPrim = computedPaa.paaPrimaryPrediction;
                if (!paaFin && computedPaa.paaPrediction) paaFin = computedPaa.paaPrediction;
            }
        }
    }
    if (paaPrim && paaFin) {
        const syncedPAA = enforceAlgoPredictionRules(paaPrim, paaFin);
        paaPrim = syncedPAA.primaryPrediction;
        paaFin = syncedPAA.finalPrediction;
    }
    const paaPred = paaFin || match.paaPrediction || match.paaPrimaryPrediction || '';
    const paaPrimPred = paaPrim || match.paaPrimaryPrediction || '';

    let mlPrim = mlInfo?.mlPrimaryPrediction || match.rawPrediction || '';
    let mlFin = mlInfo?.mlPrediction || match.finalPrediction || '';
    if (mlInfo?.mlApplied && mlPrim && mlFin) {
        const syncedML = enforceAlgoPredictionRules(mlPrim, mlFin, mlInfo.probabilities);
        mlPrim = syncedML.primaryPrediction;
        mlFin = syncedML.finalPrediction;
    }
    const mlPred = mlFin;
    const pred1x2 = match.pred1x2 || '';

    let initialMatchTags = match.evaluatorTags || [];
    if (initialMatchTags.length === 0 && phaStatsMap && Object.keys(phaStatsMap).length > 0) {
        try {
            initialMatchTags = getMatchEvaluatorTags(match, phaStatsMap, match.isJackpot || false, true);
        } catch (e) {}
    }

    const bothTeamsGAGreaterThanGS = gaHome > gsHome && gaAway > gsAway;

    const moParts = (match.mo || '').split(/[- ,]+/).map(s => parseFloat(s.trim())).filter(p => !isNaN(p));
    const o1 = moParts[0] || 0;
    const oX = moParts[1] || 0;
    const o2 = moParts[2] || 0;
    const udOdds = underdog === '1' ? o1 : underdog === '2' ? o2 : 0;
    const favOdds = mFav === '1' ? o1 : mFav === '2' ? o2 : 0;
    const oddsDiff = Math.abs(o1 - o2);
    const isAwayFav = mFav === '2';

    let oddsUnderdogLessEqDraw = false;
    if (udOdds > 0 && oX > 0 && udOdds <= oX) {
        oddsUnderdogLessEqDraw = true;
    }

    const algoProbs = match.algoReport?.probabilities?.[mFav] || 0;
    const algoPercentage = algoProbs * 100;

    const leData = parseLastEncounter(match.le, mFav, underdog);
    const leWasDraw = leData !== null && leData.isDraw;
    const isIsraelMatch = checkIsIsraelMatch(match);
    const isAfricanLeagueMatch = checkIsAfricanLeagueMatch(match);
    const isEnglandAmateurMatch = checkIsEnglandAmateurMatch(match);
    const isNorway3rdDivisionMatch = checkIsNorway3rdDivisionMatch(match);

    const l10Parts = (match.l10 || '').split(/[:\- ]+/).map(s => parseFloat(s.trim()));
    const l10Home = !isNaN(l10Parts[0]) ? l10Parts[0] : 0;
    const l10Away = !isNaN(l10Parts[1]) ? l10Parts[1] : 0;
    const mFavL10 = mFav === '1' ? l10Home : l10Away;
    const underdogL10 = underdog === '1' ? l10Home : l10Away;
    const hasValidL10 = !!(match.l10 && match.l10 !== 'NA' && match.l10 !== '-' && match.l10.includes(':') && !isNaN(l10Parts[0]) && !isNaN(l10Parts[1]));
    const underdogHasHigherL10 = hasValidL10 && (underdogL10 > mFavL10);
    const isL10Close = hasValidL10 && Math.abs(mFavL10 - underdogL10) <= 1;
    const isL10Equal = hasValidL10 && mFavL10 === underdogL10;

    const rawRating = match.rating || (match as any).rating1x2 || '';
    const ratingMatch = String(rawRating).match(/(\d+(?:\.\d+)?)/);
    const rating1X2 = ratingMatch ? parseFloat(ratingMatch[1]) : null;
    const isRatingLessEq2_5 = rating1X2 !== null && rating1X2 <= 2.5 + Number.EPSILON;
    const isRatingLessThan3_0 = rating1X2 !== null && rating1X2 < 3.0;
    const isRating5to7 = rating1X2 !== null && rating1X2 >= 5.0 - Number.EPSILON && rating1X2 < 7.0 - Number.EPSILON;
    const isRatingGreaterEq7 = rating1X2 !== null && rating1X2 >= 7.0 - Number.EPSILON;

    const isMfavGaLe1_1AndUndGaGt1_1 = mFavGA <= 1.105 && underdogGA > 1.105;
    const isMfavGsUndGsClose = Math.abs(mFavGS - underdogGS) <= 0.2 + Number.EPSILON;
    const isBothTeamsGaGe1_5 = mFavGA >= 1.495 && underdogGA >= 1.495;

    const underdogHiddenStrengthOrWeakness = (underdogGS > 0 || underdogGA > 0) && (Math.round(Math.abs(underdogGS - underdogGA) * 100) / 100 <= 0.2001);
    const isG2E5 = (subPatternStr || (match as any).subPattern || '').toUpperCase() === 'G2E5';
    const isPaaSubAlgoMl12 = (paaPred === '12' || paaPrimPred === '12') && subPred === '12' && (algoPred === '12' || algoPrimPred === '12') && (mlPred === '12' || mlPrim === '12');

    return {
        mFav,
        underdog,
        gaHome,
        gaAway,
        gsHome,
        gsAway,
        mFavGA,
        underdogGA,
        mFavGS,
        underdogGS,
        mFavPoints,
        udPoints,
        rawTsa,
        rawTsb,
        favTS,
        udTS,
        isVolatile,
        subPatternStr,
        pha,
        isPhaTie,
        isGSGAGA,
        paaSWin,
        phaDrawPct,
        phaUdPct,
        algoPrimPred,
        algoPred,
        algoProbs,
        algoPercentage,
        seerPrimPred,
        seerPred,
        seerScoreUd,
        seerScoreDraw,
        seerScoreFav,
        subPrimPred,
        subPred,
        paaPrimPred,
        paaPred,
        mlPrimPred: mlPrim,
        mlPred,
        pred1x2,
        initialMatchTags,
        bothTeamsGAGreaterThanGS,
        o1,
        oX,
        o2,
        udOdds,
        favOdds,
        oddsDiff,
        isAwayFav,
        oddsUnderdogLessEqDraw,
        leData,
        leWasDraw,
        isIsraelMatch,
        isAfricanLeagueMatch,
        isEnglandAmateurMatch,
        isNorway3rdDivisionMatch,
        mFavL10,
        underdogL10,
        hasValidL10,
        underdogHasHigherL10,
        isL10Close,
        isL10Equal,
        rating1X2,
        isRatingLessEq2_5,
        isRatingLessThan3_0,
        isRating5to7,
        isRatingGreaterEq7,
        isMfavGaLe1_1AndUndGaGt1_1,
        isMfavGsUndGsClose,
        isBothTeamsGaGe1_5,
        underdogHiddenStrengthOrWeakness,
        isG2E5,
        isPaaSubAlgoMl12,
        optimizedPrediction,
        activeHedgingProtocol,
        evalCategoryId
    };
}

/**
 * Evaluates the full master catalog of candidate triggers for a match.
 * Calls applyRule(desc, condition, defaultPts) for every catalog trigger.
 * If points for a trigger are 0 in that category, it will still be pushed to rulesHit with 0 pts,
 * ensuring all triggers are visible and properly tracked in OPW Comparison Analysis.
 */
export function evaluateAllCatalogTriggers(
    stats: MatchEvaluationStats,
    match: Match,
    ruleMap?: Map<string, number>,
    applyRule?: (desc: string, condition: boolean, defaultPts?: number) => void
): Set<string> {
    const hitSet = new Set<string>();
    let udTrapHits = 0;
    const rawApplyRule = typeof applyRule === 'function' ? applyRule : null;
    const trackedApplyRule = (desc: string, condition: boolean, defaultPts?: number) => {
        if (condition) {
            hitSet.add(desc);
            if (ruleMap && typeof ruleMap.has === 'function') {
                const pts = ruleMap.has(desc) ? (ruleMap.get(desc) ?? defaultPts ?? 0) : (defaultPts ?? 0);
                if (pts < 0 && (
                    desc.includes("Underdog") ||
                    desc.includes("Youth League") ||
                    desc.includes("volatile") ||
                    desc.includes("Draw Trap") ||
                    desc.includes("Both teams GA >= 1.5")
                )) {
                    udTrapHits++;
                }
            }
        }
        if (rawApplyRule) {
            rawApplyRule(desc, condition, defaultPts);
        }
    };
    applyRule = trackedApplyRule;

    const isHomeFav = !stats.isAwayFav;
    const isAwayFav = stats.isAwayFav;
    const isTsDiffClose = Math.abs(stats.favTS - stats.udTS) <= 0.1 + Number.EPSILON;
    const isUdGaLtMfavGa = stats.underdogGA < stats.mFavGA - 0.1;
    const isDrawOddsGt3_5 = stats.oX > 3.5;

    // --- 1. Predictor & Algorithm Consensus ---
    applyRule("Seer score on draw <= 20%", stats.seerScoreDraw > 0 && stats.seerScoreDraw <= 20, 0);
    applyRule("Seer score on draw >= 35%", stats.seerScoreDraw >= 35, 0);
    applyRule("Seer score on underdog >= 45%", stats.seerScoreUd >= 45, 0);
    applyRule("Seer primary predicts on underdog", stats.seerPrimPred === stats.underdog, 0);
    applyRule("Algo support for Mfav > 50%", stats.algoPercentage > 50, 0);
    applyRule("Algo support for Mfav is 45-50%", stats.algoPercentage >= 45 && stats.algoPercentage <= 50, 0);
    applyRule("Algo for Mfav support <40%", stats.algoPercentage > 0 && stats.algoPercentage < 40, 0);
    applyRule("Algo final prediction is 1X/X2", stats.algoPred === '1X' || stats.algoPred === 'X2', 0);
    applyRule("Algo primary prediction supports the underdog", stats.algoPrimPred === stats.underdog, 0);
    const isAllPredictorsAgree = ['1X', 'X2'].includes(stats.algoPred) && ['1X', 'X2'].includes(stats.seerPred) && ['1X', 'X2'].includes(stats.paaPred) && ['1X', 'X2'].includes(stats.subPred);
    const isPaaSeerAlgoMlAgree = ['1X', 'X2'].includes(stats.paaPred) && ['1X', 'X2'].includes(stats.seerPred) && ['1X', 'X2'].includes(stats.algoPred) && ['1X', 'X2'].includes(stats.mlPred);
    if (isAllPredictorsAgree) {
        applyRule("All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2", true, 0);
    } else if (isPaaSeerAlgoMlAgree) {
        applyRule("PAA, Seer, Algo, and ML agree on 1X/X2", true, 0);
    }
    applyRule("PAA, Seer, and ML agree on 1X/X2", 
        ['1X', 'X2'].includes(stats.paaPred) && ['1X', 'X2'].includes(stats.seerPred) && ['1X', 'X2'].includes(stats.mlPred), 0);
    applyRule("PAA, SubPattern, Algo, and ML agree on 12 hedge", stats.isPaaSubAlgoMl12, 0);
    applyRule("PAA, SubPattern, and Algo agree on 12 hedge", 
        (stats.paaPred === '12' || stats.paaPrimPred === '12') && stats.subPred === '12' && (stats.algoPred === '12' || stats.algoPrimPred === '12'), 0);
    applyRule("Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12", 
        ['1X', 'X2'].includes(stats.algoPred) && ['1X', 'X2'].includes(stats.seerPred) && ['1X', 'X2'].includes(stats.mlPred) && stats.paaPred === '12' && stats.subPred === '12', 0);
    applyRule("PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", 
        ['1X', 'X2'].includes(stats.paaPred) && ['1X', 'X2'].includes(stats.mlPred) && ['1X', 'X2'].includes(stats.seerPred) && stats.subPred === '12' && stats.algoPred === '12', 0);
    applyRule("Sub pattern primary on draw and hedges with underdog", 
        stats.subPrimPred === 'X' && (stats.subPred === (stats.underdog === '1' ? '1X' : 'X2') || stats.subPred === '12'), 0);
    applyRule("Sub pattern primary prediction supports the underdog", stats.subPrimPred === stats.underdog, 0);
    applyRule("1X2 Rating =>7", stats.isRatingGreaterEq7, 0);

    // --- 2. Team Strength (TS) & Form / Hidden Factors ---
    applyRule("Mfav TS >= 3.0 and Ud TS < 0.8", stats.favTS >= 3.0 && stats.udTS < 0.8, 0);
    applyRule("Mfav TS 1.5-1.99 and Ud TS < 0.5", stats.favTS >= 1.5 && stats.favTS < 2.0 && stats.udTS < 0.5, 0);
    applyRule("Mfav TS 1.0-1.50 and Ud TS < 0.8", stats.favTS >= 1.0 && stats.favTS <= 1.5 && stats.udTS < 0.8, 0);
    applyRule("Mfav TS < 1.5, Ud TS < 0.8, Seer score draw >= 35%", stats.favTS < 1.5 && stats.udTS < 0.8 && stats.seerScoreDraw >= 35, 0);
    applyRule("Mfav TS >= 2.0 and Underdog TS < 0.7 + Seer score on draw >= 35%", stats.favTS >= 2.0 && stats.udTS < 0.7 && stats.seerScoreDraw >= 35, 0);
    applyRule("M.fav TS >= 2.0 and Underdog TS < 1.0", stats.favTS >= 2.0 && stats.udTS < 1.0, 0);
    applyRule("TS difference <= 0.1", isTsDiffClose, 0);
    applyRule("Underdog has hidden strength", stats.underdogHiddenStrengthOrWeakness && stats.underdogGS >= stats.underdogGA, 0);
    applyRule("Underdog has hidden weakness", stats.underdogHiddenStrengthOrWeakness && stats.underdogGS < stats.underdogGA, 0);
    applyRule("M.fav has hidden strength", (stats.mFavGS > 0 || stats.mFavGA > 0) && (Math.abs(stats.mFavGS - stats.mFavGA) <= 0.2001) && stats.mFavGS >= stats.mFavGA, 0);
    applyRule("M.fav has hidden weakness", (stats.mFavGS > 0 || stats.mFavGA > 0) && (Math.abs(stats.mFavGS - stats.mFavGA) <= 0.2001) && stats.mFavGS < stats.mFavGA, 0);
    applyRule("Underdog has >= 5 more points on point system", stats.udPoints - stats.mFavPoints >= 5, 0);
    applyRule("M.fav has hidden strength+Mfav GA=Und GA (+-0.2)", !stats.underdogHiddenStrengthOrWeakness && Math.abs(stats.mFavGA - stats.underdogGA) <= 0.2, 0);

    // --- 3. Goal Scoring & Defensive Dynamics (GS / GA) ---
    applyRule("Both teams GS < 1.0", stats.mFavGS < 1.0 && stats.underdogGS < 1.0, 0);
    applyRule("Both teams GS < 1.0 and Both team GS <GA", stats.mFavGS < 1.0 && stats.underdogGS < 1.0 && stats.gsHome < stats.gaHome && stats.gsAway < stats.gaAway, 0);
    applyRule("Both team GS => 1.8", stats.mFavGS >= 1.8 && stats.underdogGS >= 1.8, 0);
    applyRule("Both teams GA > GS", stats.bothTeamsGAGreaterThanGS, 0);
    applyRule("Both teams GA > GS and Both team GS <=1.0", stats.bothTeamsGAGreaterThanGS && stats.gsHome <= 1.0 && stats.gsAway <= 1.0, 0);
    applyRule("Both teams GA >= 1.1 (volatile match)", stats.isVolatile, 0);
    applyRule("Both teams GA >= 1.1 (volatile) and Underdog has hidden strength", stats.isVolatile && stats.underdogHiddenStrengthOrWeakness, 0);
    applyRule("Both teams GA >= 1.5", stats.isBothTeamsGaGe1_5, 0);
    applyRule("M.fav GA is > 0.6 points lower than Underdog GA", stats.underdogGA - stats.mFavGA > 0.6, 0);
    applyRule("Mfav GA=Und GA (+-0.2)", Math.abs(stats.mFavGA - stats.underdogGA) <= 0.2, 0);
    applyRule("Mfav GS = Und Gs +-0.2", stats.isMfavGsUndGsClose, 0);
    applyRule("Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA", stats.isMfavGsUndGsClose && stats.mFavGA >= stats.underdogGA, 0);
    applyRule("Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength", stats.isMfavGsUndGsClose && stats.underdogHiddenStrengthOrWeakness, 0);
    applyRule("Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA", stats.isMfavGsUndGsClose && isUdGaLtMfavGa, 0);
    applyRule("Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)", stats.isMfavGsUndGsClose && Math.abs(stats.mFavGA - stats.underdogGA) <= 0.2, 0);
    applyRule("Underdog GS < 1.0 but M.fav GS > 1.0", stats.underdogGS < 1.0 && stats.mFavGS > 1.0, 0);
    applyRule("Underdog GS >Mfav GS with >=0.4 points", stats.underdogGS - stats.mFavGS >= 0.4, 0);
    applyRule("Underdog GA >= 1.5 and GS => 1.8", stats.underdogGA >= 1.5 && stats.underdogGS >= 1.8, 0);
    applyRule("A match has GS=GS=GA=GA", stats.isGSGAGA, 0);
    applyRule("Equal GS + AGA=HGS + M.fav has hidden strength", stats.gsHome === stats.gsAway && stats.gaAway === stats.gsHome && (stats.mFavGS > 0 && Math.abs(stats.mFavGS - stats.mFavGA) <= 0.2), 0);
    applyRule("Equal GS + AGA=HGS + M.fav has hidden weakness", stats.gsHome === stats.gsAway && stats.gaAway === stats.gsHome && (stats.mFavGS > 0 && Math.abs(stats.mFavGS - stats.mFavGA) <= 0.2 && stats.mFavGS < stats.mFavGA), 0);

    // --- 4. Odds & Market Structure ---
    applyRule("Underdog odds <= 2.80", stats.udOdds > 0 && stats.udOdds <= 2.80, 0);
    applyRule("Odds for underdog >= 2.80 to 3.0", stats.udOdds >= 2.80 && stats.udOdds <= 3.0, 0);
    applyRule("Odds for draw is < 3.0", stats.oX > 0 && stats.oX < 3.0, 0);
    applyRule("Odds for underdog <= odds for draw but < 2.8", stats.oddsUnderdogLessEqDraw && stats.udOdds < 2.8, 0);
    applyRule("Odds for underdog <= odds for draw but between 2.8 to 3.0", stats.oddsUnderdogLessEqDraw && stats.udOdds >= 2.8 && stats.udOdds <= 3.0, 0);

    // --- 5. Head-to-Head / Last Encounter (LE) ---
    applyRule("LE : Underdog won the last encounter", !!stats.leData?.underdogWon, 0);
    applyRule("LE Underdog won with 2+ goals", !!stats.leData?.underdogWon && (stats.leData.underdogGoals - stats.leData.mFavGoals >= 2), 0);
    applyRule("Underdog was away on LE and Won", !!stats.leData?.underdogWon && !!stats.leData?.underdogWasAway, 0);
    applyRule("LE was a draw+Underdog has hidden strength/weakness", stats.leWasDraw && stats.underdogHiddenStrengthOrWeakness, 0);
    applyRule("LE, Underdog won the last encounter +Mfav L10= Und L10", !!stats.leData?.underdogWon && stats.isL10Equal, 0);

    // --- 6. League & Special ---
    applyRule("Match belong to israel leagues", stats.isIsraelMatch, 0);
    applyRule("Match belong to African leagues", stats.isAfricanLeagueMatch, 0);
    applyRule("Match belong to England Amateur", stats.isEnglandAmateurMatch, -10);
    applyRule("Match belong to norway 3rd division", stats.isNorway3rdDivisionMatch, -10);
    const effectivePct = match.percentage ?? match.probabilityConfidence ?? (match.totalPoints ? Math.min(100, match.totalPoints) : 0);
    applyRule("Match has BB, T12, or BD opw < 10%", effectivePct < 10 && effectivePct > 0, 0);
    applyRule("Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog", effectivePct >= 10 && effectivePct <= 25 && stats.subPrimPred === stats.underdog, 0);

    // --- 7. Value & Statistical Metrics ---
    const isTsDiffGe1 = Math.abs(stats.favTS - stats.udTS) >= 1.0;
    const isUdOddsLt28 = stats.udOdds > 0 && stats.udOdds < 2.8;
    const isAlgo4550 = stats.algoPercentage >= 45 && stats.algoPercentage <= 50;
    const isAlgoLt40 = stats.algoPercentage > 0 && stats.algoPercentage < 40;
    const isMfavGaUdGaClose = Math.abs(stats.mFavGA - stats.underdogGA) <= 0.2;
    const isBothGsGe18 = stats.mFavGS >= 1.8 && stats.underdogGS >= 1.8;
    const isMfavTs115UdLt08 = stats.favTS >= 1.0 && stats.favTS <= 1.5 && stats.udTS < 0.8;

    applyRule("TS difference >= 1.0", isTsDiffGe1, 0);

    applyRule("Mfav GA close to Ud GA (+-0.2) + Algo support 45-50%", isMfavGaUdGaClose && isAlgo4550, 0);
    applyRule("Both team GS => 1.8 + Mfav GA close to Ud GA (+-0.2)", isBothGsGe18 && isMfavGaUdGaClose, 0);

    applyRule("Mfav TS 1.0-1.50 and Ud TS < 0.8 + Odds underdog < 2.8", isMfavTs115UdLt08 && isUdOddsLt28, 0);
    applyRule("Mfav TS 1.0-1.50 and Ud TS < 0.8 + Algo support < 40%", isMfavTs115UdLt08 && isAlgoLt40, 0);

    // --- 8. Missing LE, L10 & Advanced Statistical Triggers ---
    applyRule("LE was a draw", stats.leWasDraw, 0);
    applyRule("Mfav L10 = Und L10", stats.isL10Equal, 0);
    applyRule("LE was a draw + Mfav L10 = Und L10", stats.leWasDraw && stats.isL10Equal, 0);
    applyRule("LE was a draw + Mfav has hidden strength", stats.leWasDraw && ((stats.mFavGS > 0 || stats.mFavGA > 0) && Math.abs(stats.mFavGS - stats.mFavGA) <= 0.2001 && stats.mFavGS >= stats.mFavGA), 0);
    applyRule("Underdog has higher L10 than Mfav", stats.underdogHasHigherL10, 0);
    applyRule("Mfav L10 and Underdog L10 difference <= 1", stats.isL10Close, 0);

    applyRule("1X2 Rating < 3.0", stats.isRatingLessThan3_0, 0);
    applyRule("1X2 Rating 5.0 to 7.0", stats.isRating5to7, 0);
    applyRule("Mfav GA <= 1.1 and Underdog GA > 1.1", stats.isMfavGaLe1_1AndUndGaGt1_1, 0);
    applyRule("Underdog GS < 1.0 and Mfav GA < 1.0 (Dominant Defense)", stats.underdogGS < 1.0 && stats.mFavGA < 1.0, 0);
    applyRule("Mfav GS >= 1.5 and Underdog GS < 1.0", stats.mFavGS >= 1.5 && stats.underdogGS < 1.0, 0);
    applyRule("Underdog GA >= 1.8 and Mfav GA <= 1.0", stats.underdogGA >= 1.8 && stats.mFavGA <= 1.0, 0);
    applyRule("PAA Win probability >= 50%", stats.paaSWin >= 50, 0);
    applyRule("PAA Win probability < 35%", stats.paaSWin > 0 && stats.paaSWin < 35, 0);
    applyRule("PHA Draw probability >= 35%", stats.phaDrawPct >= 35, 0);
    applyRule("PHA Underdog probability >= 35%", stats.phaUdPct >= 35, 0);
    applyRule("PHA is a tie between outcomes", stats.isPhaTie, 0);
    applyRule("SubPattern is G2E5", stats.isG2E5, 0);

    // --- 8b. High-Impact Compound Trap Triggers & Underdog Odds ---
    applyRule("Odds for underdog >= 3.0", stats.udOdds >= 3.0, 0);
    applyRule("LE : Underdog won the last encounter+ Underdog has higher L10 than Mfav", !!stats.leData?.underdogWon && stats.underdogHasHigherL10, 0);
    const isYouthLeague = /\b(u21|u23|u20|u19)\b/i.test(match.league || '') || /\b(u21|u23|u20|u19)\b/i.test(match.teams || '');
    applyRule("LE : Underdog won the last encounter+Youth League (U21,U23,U20,U19)", !!stats.leData?.underdogWon && isYouthLeague, 0);
    applyRule("TS difference <= 0.1+Both teams GA >= 1.1 (volatile match)", isTsDiffClose && stats.isVolatile, 0);
    const isLeUdWon2Plus = !!stats.leData?.underdogWon && (stats.leData.underdogGoals - stats.leData.mFavGoals >= 2);
    applyRule("LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)", isLeUdWon2Plus && stats.isVolatile, 0);

    // --- 8c. User Calibrated Compound Danger Triggers (All Categories) ---
    const isPaaSubAlgo12 = (stats.paaPred === '12' || stats.paaPrimPred === '12') && stats.subPred === '12' && (stats.algoPred === '12' || stats.algoPrimPred === '12');
    const isPaaMlSeer1xX2SubAlgo12 = ['1X', 'X2'].includes(stats.paaPred) && ['1X', 'X2'].includes(stats.mlPred) && ['1X', 'X2'].includes(stats.seerPred) && stats.subPred === '12' && stats.algoPred === '12';
    const isUdHiddenStrength = stats.underdogHiddenStrengthOrWeakness && stats.underdogGS >= stats.underdogGA;

    applyRule("Youth League (U21,U23,U20,U19)+ Odds for underdog >= 2.80 to 3.0", isYouthLeague && stats.udOdds >= 2.80 && stats.udOdds <= 3.0, 0);
    applyRule("Odds for draw is < 3.0+PAA, SubPattern, and Algo agree on 12 hedge", (stats.oX > 0 && stats.oX < 3.0) && isPaaSubAlgo12, 0);
    applyRule("PAA, SubPattern, and Algo agree on 12 hedge+Both teams GA >= 1.1 (volatile match)", isPaaSubAlgo12 && stats.isVolatile, 0);
    applyRule("Youth League (U21,U23,U20,U19)+PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", isYouthLeague && isPaaMlSeer1xX2SubAlgo12, 0);
    applyRule("Underdog odds <= 2.80+Underdog GA >= 1.5 and GS => 1.8", (stats.udOdds > 0 && stats.udOdds <= 2.80) && (stats.underdogGA >= 1.5 && stats.underdogGS >= 1.8), 0);
    applyRule("Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)", stats.isL10Close && stats.isVolatile, 0);
    applyRule("LE was a draw+1X2 Rating < 3.0", stats.leWasDraw && stats.isRatingLessThan3_0, 0);
    applyRule("Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)", stats.isL10Equal && stats.isVolatile, 0);

    // New Pro Underdog & Pro Mfav triggers
    applyRule("Pha Underdog and Pha draw both >20%", stats.phaUdPct >= 20 && stats.phaDrawPct >= 20, 0);
    const mFavHiddenStrengthOrWeakness = (stats.mFavGS > 0 || stats.mFavGA > 0) && (Math.abs(stats.mFavGS - stats.mFavGA) <= 0.2001);
    const isBothHiddenSW = mFavHiddenStrengthOrWeakness && stats.underdogHiddenStrengthOrWeakness;
    applyRule("Mfav has hidden strength/weakness+Underdog has hidden strength/weakness", isBothHiddenSW, 0);

    const isDrawAndUdOddsGe3 = stats.oX >= 3.0 && stats.udOdds >= 3.0;
    applyRule("Odds for Draw and Underdog >= 3.0", isDrawAndUdOddsGe3, 0);

    // --- 8d. New User-Specified Underdog Triggers ---
    const isMfavAwayButWasHomeLastLeWonLe1Goal = 
        stats.isAwayFav && 
        !!stats.leData && 
        !stats.leData.mFavWasAway && 
        stats.leData.mFavWon && 
        (stats.leData.mFavGoals - stats.leData.underdogGoals <= 1);

    applyRule("Mfav is away but was home last LE won with <=1 goal", isMfavAwayButWasHomeLastLeWonLe1Goal, 0);
    applyRule("Mfav is away but was home last LE won with <=1 goal+ Odds for underdog >= 2.80 to 3.0", 
        isMfavAwayButWasHomeLastLeWonLe1Goal && (stats.udOdds >= 2.80 && stats.udOdds <= 3.0), 0);
    applyRule("Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1", 
        stats.isL10Equal && stats.isL10Close, 0);
    applyRule("Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal", 
        stats.isMfavGsUndGsClose && isMfavAwayButWasHomeLastLeWonLe1Goal, 0);
    applyRule("Match belongs to European countries league 3 (III).", checkIsEuropeanLeague3Match(match), 0);

    const allMatchTags = [...(match.evaluatorTags || []), ...(stats.initialMatchTags || [])];
    const hasBannedUpsetRisk = allMatchTags.some(t => t.toUpperCase() === 'BANNED:UPSET_RISK');
    const hasBannedDrawRisk = allMatchTags.some(t => t.toUpperCase() === 'BANNED:DRAW_RISK');

    applyRule("Match has Banned:Upset risk tag", hasBannedUpsetRisk, 0);
    applyRule("Match has Banned:Draw risk tag", hasBannedDrawRisk, 0);

    // --- 8e. New User-Specified Underdog & Mfav Triggers ---
    applyRule("Seer score on draw >= 35%+1X2 Rating < 3.0", stats.seerScoreDraw >= 35 && stats.isRatingLessThan3_0, 0);

    const isMfavGsGe2 = stats.mFavGS >= 2.0;
    const isMfavGsUndGaClose = Math.abs(stats.mFavGS - stats.underdogGA) <= 0.2001;
    applyRule("Mfav GS=>2.0=Underdog GA +-0.2", isMfavGsGe2 && isMfavGsUndGaClose, 0);
    applyRule("Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%", isMfavGsGe2 && isMfavGsUndGaClose && stats.seerScoreDraw >= 35, 0);

    const isMfavL10Ge3Higher = stats.hasValidL10 && (stats.mFavL10 - stats.underdogL10 >= 3);
    applyRule("Mfav L10 > Und L10 with >=3 points", isMfavL10Ge3Higher, 0);
    applyRule("Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5", isMfavL10Ge3Higher && stats.mFavL10 >= 5, 0);
    applyRule("Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5.", isMfavL10Ge3Higher && stats.mFavL10 >= 5, 0);

    // --- 8f. 12 New Last Encounter (LE) & L10 Form Triggers ---
    const leGoalDiff = (stats.leData && stats.leData.mFavWon) 
        ? (stats.leData.mFavGoals - stats.leData.underdogGoals) 
        : 0;
    const isMfavAwayWonLeLe1 = !!stats.leData?.mFavWon && !!stats.leData?.mFavWasAway && leGoalDiff <= 1;
    const isMfavHomeWonLeLe1 = !!stats.leData?.mFavWon && !stats.leData?.mFavWasAway && leGoalDiff <= 1;
    const isMfavHomeWonLe1To3 = !!stats.leData?.mFavWon && !stats.leData?.mFavWasAway && leGoalDiff > 1 && leGoalDiff <= 3;
    const isMfavAwayWonLe1To3 = !!stats.leData?.mFavWon && !!stats.leData?.mFavWasAway && leGoalDiff > 1 && leGoalDiff <= 3;
    const isMfavHomeWonLeGt3 = !!stats.leData?.mFavWon && !stats.leData?.mFavWasAway && leGoalDiff > 3;
    const isMfavAwayWonLeGt3 = !!stats.leData?.mFavWon && !!stats.leData?.mFavWasAway && leGoalDiff > 3;

    applyRule("Mfav was away and won last Encounter <=1 goal", isMfavAwayWonLeLe1, 0);
    applyRule("Mfav was home and won last Encounter <=1 goal", isMfavHomeWonLeLe1, 0);
    applyRule("Mfav was home and won last Encounter >1 to =<3 goal", isMfavHomeWonLe1To3, 0);
    applyRule("Mfav was Away and won last Encounter >1 to =<3 goal", isMfavAwayWonLe1To3, 0);
    applyRule("Mfav was home and won last Encounter >3 goal", isMfavHomeWonLeGt3, 0);
    applyRule("Mfav was Away and won last Encounter >3 goal", isMfavAwayWonLeGt3, 0);

    applyRule("Mfav was away and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", isMfavAwayWonLeLe1 && isMfavL10Ge3Higher, 0);
    applyRule("Mfav was home and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", isMfavHomeWonLeLe1 && isMfavL10Ge3Higher, 0);
    applyRule("Mfav was home and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", isMfavHomeWonLe1To3 && isMfavL10Ge3Higher, 0);
    applyRule("Mfav was Away and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", isMfavAwayWonLe1To3 && isMfavL10Ge3Higher, 0);
    applyRule("Mfav was home and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", isMfavHomeWonLeGt3 && isMfavL10Ge3Higher, 0);
    applyRule("Mfav was Away and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", isMfavAwayWonLeGt3 && isMfavL10Ge3Higher, 0);


    // --- 9. Compound Trap Multipliers & Dampers ---
    // When multiple dangerous signals co-occur on a match, apply an additional compound penalty
    if (udTrapHits >= 3) {
        if (rawApplyRule) rawApplyRule("Compound Underdog Trap Damper (3+ co-occurring danger signals)", true, -15);
        hitSet.add("Compound Underdog Trap Damper (3+ co-occurring danger signals)");
    } else if (udTrapHits >= 2) {
        if (rawApplyRule) rawApplyRule("Dual Risk Co-occurrence Damper", true, -10);
        hitSet.add("Dual Risk Co-occurrence Damper");
    }

    // --- 10. User Approved Custom Combos & Parameter Continuations ---
    try {
        const approved = loadApprovedCustomTriggers();
        for (let i = 0; i < approved.length; i++) {
            const custom = approved[i];
            if (!custom.isActive) continue;

            if (custom.type === 'synergy_combo' && custom.triggerA && custom.triggerB) {
                // Synergistic combo: fires if both underlying triggers hit on this match
                const bothHit = hitSet.has(custom.triggerA) && hitSet.has(custom.triggerB);
                if (bothHit) {
                    trackedApplyRule(custom.description, true, custom.points);
                }
            } else if (custom.type === 'progression_continuation') {
                if (custom.description === "Odds for underdog <= odds for draw but > 3.0") {
                    trackedApplyRule(custom.description, stats.oddsUnderdogLessEqDraw && stats.udOdds > 3.0, custom.points);
                } else if (custom.description === "Odds for underdog > odds for draw and between 2.8 to 3.0") {
                    trackedApplyRule(custom.description, !stats.oddsUnderdogLessEqDraw && stats.udOdds >= 2.8 && stats.udOdds <= 3.0, custom.points);
                } else if (custom.triggerA && custom.triggerB && hitSet.has(custom.triggerA) && hitSet.has(custom.triggerB)) {
                    trackedApplyRule(custom.description, true, custom.points);
                }
            }
        }
    } catch (e) {
        // Safe failover
    }

    return hitSet;
}

export * from './opwCatalog';
export * from './opwTriggerDiscovery';


