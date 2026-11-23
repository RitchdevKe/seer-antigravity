import { Match } from '../types';
import { predictSeerDetailed, DEFAULT_WEIGHTS } from './seerLogic';
import { getMatchEvaluatorTags } from './matchEvaluator';
import { calculatePAAPrediction, getLogicalDate } from './matchProcessing';
import { predictWithHybridML } from './hybridMachineLearning';
import { registerDiscoveredLeagueTrigger, REMOVED_TRIGGER_DESCRIPTIONS } from './opwCatalog';
import { parseL10 } from './l10Utils';

export * from './opwDayMetadata';

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';


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
    const dayMap: Record<number, DayOfWeek> = {
        0: 'sunday',
        1: 'monday',
        2: 'tuesday',
        3: 'wednesday',
        4: 'thursday',
        5: 'friday',
        6: 'saturday'
    };

    // Check explicit matchDay or targetDay if set
    const explicitDay = (match as any).matchDay || (match as any).targetDay || (match as any).day;
    if (explicitDay && typeof explicitDay === 'string') {
        const d = explicitDay.toLowerCase().trim();
        if (['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].includes(d)) {
            return d as DayOfWeek;
        }
    }

    const dateStr = match.date || (match as any).targetDate || (match as any).extractedAt || '';
    const timeStr = match.time;
    const logicalDate = getLogicalDate(dateStr, timeStr);
    if (logicalDate) {
        const parts = logicalDate.split('-');
        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                const d = new Date(Date.UTC(year, month, day, 12, 0, 0));
                const dayNum = d.getUTCDay();
                if (dayMap[dayNum]) return dayMap[dayNum];
            }
        }
    }

    // Secondary fallback: use liveMatchDay if present on match object
    if ((match as any).liveMatchDay) {
        return (match as any).liveMatchDay as DayOfWeek;
    }

    // Contextual fallback: derive from active prediction cycle rather than hardcoding saturday
    try {
        const activeDate = getLogicalDate(new Date().toISOString().split('T')[0]);
        const parts = activeDate.split('-');
        if (parts.length === 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const d = parseInt(parts[2], 10);
            if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                const dateObj = new Date(Date.UTC(y, m, d, 12, 0, 0));
                const dayNum = dateObj.getUTCDay();
                if (dayMap[dayNum]) return dayMap[dayNum];
            }
        }
    } catch (e) {}

    return 'saturday';
}

export function getMarketFavorite(match: Match): '1' | '2' {
    const moParts = (match.mo || (match as any).odds || (match as any).data?.mo || (match as any).data?.odds || '').split(/[- ,]+/).map(s => parseFloat(s.replace(/[^0-9.]/g, '').trim())).filter(p => !isNaN(p));
    const homeOdds = moParts[0] || (match.homeOdds ? parseFloat(String(match.homeOdds).replace(/[^0-9.]/g, '')) : 0) || 0;
    const awayOdds = moParts.length >= 3 ? (moParts[2] || 0) : (moParts.length === 2 ? (moParts[1] || 0) : (match.awayOdds ? parseFloat(String(match.awayOdds).replace(/[^0-9.]/g, '')) : 0));
    
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
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    const africanCountriesRegex = /\b(africa|african|caf|tanzania|tanzanian|kenya|kenyan|uganda|ugandan|rwanda|rwandan|egypt|egyptian|morocco|moroccan|nigeria|nigerian|ghana|ghanaian|south africa|south african|zambia|zambian|senegal|senegalese|tunisia|tunisian|algeria|algerian|mali|cameroon|cameroonian|congo|angola|angolan|burundi|sudan|sudanese|somalia|ethiopia|ethiopian|malawi|mozambique|botswana|namibia|zimbabwe|zimbabwean|lesotho|eswatini|madagascar|ivory coast|cote d'ivoire|guinea|burkina faso|benin|togo|mauritania|niger|chad|central african|gabon|equatorial|djibouti|eritrea|seychelles|comoros|mauritius|sao tome|sierra leone|liberia|gambia|cape verde)\b/i;
    
    if (africanCountriesRegex.test(country) || africanCountriesRegex.test(league)) return true;

    // African domestic teams & clubs (including user examples Mbeya City, Kagera Sugar, Khroub, Teleghma)
    const africanTeamsRegex = /\b(mbeya\s*city|kagera\s*sugar|khroub|teleghma|as\s*khroub|nrb\s*teleghma|rc\s*kouba|usm\s*h|usm\s*el\s*harrach|simba|young\s*africans|azam|singida|geita\s*gold|namungo|coastal\s*union|dodoma\s*jiji|tabora\s*u|tabora\s*united|mashujaa|pamba|suhul shire|caps united|triangle u|chemilil|sony sugar|jkt|gor mahia|afc leopards|tusker|kcca|vipers|sc villa|rayon sports|apr fc|al hilal|al merreikh|esperance|etoile du sahel|club africain|cs sfaxien|raja|wydad|far rabat|as vita|tp mazembe|kaizer chiefs|orlando pirates|mamelodi sundowns|supersport|hearts of oak|asante kotoko|enyimba|kano pillars|rivers united|al ahly|zamalek|pyramids)\b/i;

    return africanTeamsRegex.test(teams) || africanCountriesRegex.test(teams);
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
    const league = (match.league || '').toLowerCase();
    const teams = (match.teams || '').toLowerCase();

    // Exclude specifically calibrated girones (Girone 1 and Girone 4) so they fire their own precise triggers
    if (/\b(?:girone|group|avdeling)\s*(?:1|4)\b/i.test(league + ' ' + teams)) return false;

    if (tags.some(t => /norway.*(?:3|third)/i.test(t))) return true;

    if (/\b(?:norway|norwegian|norge)\b/i.test(league) || /\b(?:norway|norwegian|norge)\b/i.test(teams) || /\((?:nor|norway)\)/i.test(teams)) {
        if (/\b(?:3rd\s*division|3\.\s*division|3\.\s*divisjon|division\s*3|div\s*3|3\s*divisjon)\b/i.test(league) ||
            /\b(?:3rd\s*division|3\.\s*division|3\.\s*divisjon|division\s*3|div\s*3|3\s*divisjon)\b/i.test(teams)) {
            return true;
        }
    }

    return false;
};

export const checkIsVietnamMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    if (/\b(?:asean|afc|champions league)\b/i.test(league)) return false;
    if (country.includes('vietnam')) return true;
    if (/\b(?:vietnam|vietnamese|v-league|v\.league|v\s*league|v1\s*league)\b/i.test(league)) return true;
    if (/\((?:vie|vietnam)\)/i.test(teams)) return true;
    if (/\b(?:viettel|hong\s*linh\s*ha\s*tinh|ha\s*tinh|hanoi\s*fc|ho\s*chi\s*minh|binh\s*duong|nam\s*dinh|song\s*lam\s*nghe\s*an|congan\s*hanoi|thanh\s*hoa|hai\s*phong|da\s*nang|binh\s*dinh|quang\s*nam)\b/i.test(teams)) return true;
    return false;
};

export const checkIsEgyptianMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    if (country.includes('egypt')) return true;
    if (/\b(?:egypt|egyptian|premier\s*league\s*\(\s*egypt\s*\)|egyptian\s*premier|egypt\s*cup)\b/i.test(league)) return true;
    if (/\((?:egy|egypt)\)/i.test(teams)) return true;
    if (/\b(?:ghazl\s*el\s*mehalla|abu\s*qair\s*semad|future\s*fc|national\s*bank\s*of\s*egypt|al\s*ittihad|wadi\s*degla|el\s*mokawloon|el\s*gouna|tersana|kahraba\s*ismailia|masar|el\s*dakhleya|haras\s*el\s*hodood|el\s*seka\s*el\s*hadid|al\s*ahly|zamalek|pyramids\s*fc|ismaily|enppi|ceramica\s*cleopatra|talaea\s*el\s*gaish|pharco|smouha|zed\s*fc)\b/i.test(teams)) return true;
    return false;
};

export const checkIsRomaniaLiga2Match = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const isRomanianContext = country.includes('romania') || /\b(?:romania|romanian|rumania)\b/i.test(league) || /\((?:rou|rom|romania)\)/i.test(teams);
    if (isRomanianContext && /\b(?:liga\s*2|liga\s*ii|division\s*2|div\s*2|second\s*division)\b/i.test(league)) {
        return true;
    }
    if (/\bromania.*(?:liga\s*2|liga\s*ii)\b/i.test(league) || /\bromania.*(?:liga\s*2|liga\s*ii)\b/i.test(teams)) {
        return true;
    }
    if (/\b(?:politehnica\s*timisoara|csa\s*steaua\s*bucuresti|chindia\s*targoviste|csc\s*selimbar|corvinul\s*hunedoara|fk\s*csikszereda|gloria\s*buzau|viitorul\s*pandurii|csm\s*resita|dumbravita|metaloglobus)\b/i.test(teams) && !/\b(?:liga\s*1|liga\s*i|superliga)\b/i.test(league)) {
        return true;
    }
    return false;
};

export const checkIsIraqMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    if (country.includes('iraq')) return true;
    if (/\b(?:iraq|iraqi|stars\s*league\s*\(\s*iraq\s*\)|iraqi\s*premier|iraq\s*stars\s*league)\b/i.test(league)) return true;
    if (/\((?:irq|iraq)\)/i.test(teams)) return true;
    if (/\b(?:al\s*talaba|al\s*shorta|naft\s*maysan|erbil|duhok|al\s*zawra|al\s*zawra'a|al\s*quwa\s*al\s*jawiya|al\s*kahrabaa|al\s*najaf|zakho|al\s*mina'a|al\s*naft|karbala)\b/i.test(teams)) return true;
    return false;
};

export const checkIsArgentinaPrimeraLPFMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const isArgentineContext = country.includes('argentina') || /\b(?:argentina|argentine)\b/i.test(league) || /\((?:arg|argentina)\)/i.test(teams);
    if (isArgentineContext) {
        if (/\b(?:primera|lpf|liga\s*profesional|copa\s*de\s*la\s*liga|proyecci[oó]n|reserva|reserve)\b/i.test(league) || /\b(?:primera|lpf)\b/i.test(teams)) {
            return true;
        }
    }
    if (/\bargentina.*(?:primera|lpf|liga\s*profesional|proyecci[oó]n|reserva)\b/i.test(league)) {
        return true;
    }
    if (/\b(?:boca\s*juniors|colon|atletico\s*tucuman|talleres\s*cordoba|belgrano|san\s*martin\s*san\s*juan|sarmiento|velez\s*sarsfield|godoy\s*cruz|barracas\s*central|lanus|central\s*cordoba|argentinos\s*juniors|san\s*lorenzo|river\s*plate|racing\s*club|independiente|estudiantes|gimnasia|newell|rosario\s*central)\b/i.test(teams) && /\b(?:res\.|reserva|reserve|proyecci[oó]n|lpf|primera)\b/i.test(teams + ' ' + league)) {
        return true;
    }
    return false;
};

export const checkIsColombiaPrimeraAMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const isColombianContext = country.includes('colombia') || /\b(?:colombia|colombian)\b/i.test(league) || /\((?:col|colombia)\)/i.test(teams);
    if (isColombianContext) {
        if (/\b(?:primera\s*a|liga\s*betplay|categor[ií]a\s*primera\s*a)\b/i.test(league) && !/\b(?:primera\s*b|categor[ií]a\s*primera\s*b)\b/i.test(league)) {
            return true;
        }
    }
    if (/\bcolombia.*(?:primera\s*a|liga\s*betplay)\b/i.test(league) && !/\b(?:primera\s*b)\b/i.test(league)) {
        return true;
    }
    if (/\b(?:millonarios|fortaleza\s*fc|atletico\s*nacional|deportes\s*tolima|santa\s*fe|america\s*de\s*cali|junior\s*barranquilla|deportivo\s*cali|independiente\s*medellin|once\s*caldas|bucaramanga|deportivo\s*pereira|aguilas\s*doradas|la\s*equidad|envigado|alianza\s*petrolera|boyaca\s*chico|jaguares\s*de\s*cordoba|deportivo\s*pasto)\b/i.test(teams) && !/\b(?:primera\s*b|categor[ií]a\s*primera\s*b)\b/i.test(league)) {
        return true;
    }
    return false;
};

export const checkIsSwitzerlandChallengeLeagueMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const isSwissContext = country.includes('switzerland') || country.includes('schweiz') || country.includes('suisse') ||
        /\b(?:switzerland|swiss|schweiz|suisse)\b/i.test(league) ||
        /\((?:sui|swi|che)\)/i.test(teams);

    if (isSwissContext && /\b(?:challenge\s*league|challenge)\b/i.test(league) && !/\b(?:super\s*league|promotion)\b/i.test(league)) {
        return true;
    }
    if (/\bswitzerland.*(?:challenge\s*league|challenge)\b/i.test(league) || /\bswiss.*challenge\s*league\b/i.test(league)) {
        return true;
    }
    if (/\b(?:aarau|bellinzona|baden|nyonnais|stade\s*nyonnais|schaffhausen|thun|vaduz|wil\s*1900|neuchatel\s*xamax|xamax|etoile\s*carouge|stade\s*lausanne\s*ouchy)\b/i.test(teams) &&
        /\b(?:challenge)\b/i.test(league)) {
        return true;
    }
    return false;
};

export const checkIsCzechRepublicNflMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const isCzechContext = country.includes('czech') || /\b(?:czech|czechia|cesko|ceska)\b/i.test(league) || /\((?:cze|czech)\)/i.test(teams);

    if (isCzechContext && (/\b(?:nfl|fnl|national\s*football\s*league|n[aá]rodn[ií]\s*(?:fotbalov[aá]\s*)?liga|chance\s*n[aá]rodn[ií]|2\.\s*liga|druh[aá]\s*liga)\b/i.test(league) || /\b(?:nfl|fnl)\b/i.test(teams)) && !/\b(?:1\.\s*liga|first\s*league|chance\s*liga\b(?!.*n[aá]rodn[ií]))/i.test(league)) {
        return true;
    }
    if (/\bczech.*(?:nfl|fnl|2\.\s*liga|second\s*division)\b/i.test(league)) {
        return true;
    }
    if (/\b(?:vyskov|zbrojovka\s*brno|chrudim|sfc\s*opava|opava|vlasim|viktoria\s*zizkov|sparta\s*(?:praha\s*)?b|slavia\s*(?:praha\s*)?b|sigma\s*olomouc\s*b|taborsko|prostejov|varnsdorf|sk\s*lisen|lisen|vysocina\s*jihlava|jihlava)\b/i.test(teams) &&
        !/\b(?:1\.\s*liga|first\s*league)\b/i.test(league)) {
        return true;
    }
    return false;
};

export const checkIsKazakhstanMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    if (country.includes('kazakhstan')) return true;
    if (/\b(?:kazakhstan|kazakh|qazaqstan)\b/i.test(league)) return true;
    if (/\((?:kaz|kazakhstan)\)/i.test(teams)) return true;
    if (/\b(?:astana|kairat|tobol|ordabasy|aktobe|shakhter\s*karagandy|kyzylzhar|atyrau|kaisar|zhetysu|yelimay|turan|zhenis|okzhetpes|taraz|ekibastuz|akzhayik|caspiy|kaspij|sd\s*family|khan\s*tengri|akademiya\s*ontustik)\b/i.test(teams) && !/\b(?:champions league|europa|conference)\b/i.test(league)) {
        return true;
    }
    return false;
};

export const checkIsNorthernIrelandMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    if (country.includes('northern ireland') || country.includes('n. ireland')) return true;
    if (/\b(?:northern\s*ireland|n\.\s*ireland|nifl)\b/i.test(league)) return true;
    if (/\((?:nir|northern ireland)\)/i.test(teams)) return true;
    if (/\b(?:linfield|cliftonville|glentoran|larne|crusaders|coleraine|ballymena\s*united|glenavon|carrick\s*rangers|portadown|dungannon\s*swifts|loughgall|bangor|annagh\s*united|ballinamallard|harland\s*&\s*wolff\s*welders|ards|newington|dergview|institute|newry\s*city)\b/i.test(teams) &&
        !/\b(?:champions league|europa|conference)\b/i.test(league)) {
        return true;
    }
    return false;
};

export const checkIsBolivianMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    if (country.includes('bolivia')) return true;
    if (/\b(?:bolivia|bolivian|divisi[oó]n\s*profesional|copa\s*sim[oó]n\s*bol[ií]var|copa\s*pace[ñn]a)\b/i.test(league)) return true;
    if (/\((?:bol|bolivia)\)/i.test(teams)) return true;
    if (/\b(?:the\s*strongest|bolivar|always\s*ready|wilstermann|jorge\s*wilstermann|oriente\s*petrolero|blooming|nacional\s*potosi|real\s*tomayapo|aurora|guabira|royal\s*pari|san\s*antonio\s*bulo\s*bulo|independiente\s*petrolero|universitario\s*de\s*vinto|u\.\s*de\s*vinto|real\s*santa\s*cruz|gv\s*san\s*jose|vaca\s*diez|palmaflor|libertad\s*gran\s*mamore)\b/i.test(teams) && !/\b(?:copa\s*libertadores|copa\s*sudamericana)\b/i.test(league)) {
        return true;
    }
    return false;
};

export const checkIsBig5LeagueMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    // 1. England Premier League
    const isEnglandContext = country.includes('england') || /\b(?:england|english)\b/i.test(league) || /\((?:eng|england)\)/i.test(teams);
    const isYouthReserveDevelopment = /\b(?:premier\s*league\s*2|pl\s*2|pl2|division\s*(?:one|two|1|2)|u21|u23|u20|u19|u18|reserve|res\.|reserva|women|w\b|fem|cup|development|trophy)\b/i.test(league + ' ' + teams);
    if (!isYouthReserveDevelopment) {
        if ((isEnglandContext || !country) && /\b(?:premier\s*league|epl|english\s*premier)\b/i.test(league)) {
            return true;
        }
        const eplClubs = /\b(?:chelsea|bournemouth|arsenal|leeds|liverpool|manchester\s*city|man\s*city|manchester\s*united|man\s*united|man\s*utd|tottenham|spurs|newcastle(?:\s*united)?|aston\s*villa|brighton(?:\s*&\s*hove\s*albion)?|west\s*ham(?:\s*united)?|everton|brentford|crystal\s*palace|fulham|wolverhampton(?:\s*wanderers)?|wolves|nottingham\s*forest|leicester(?:\s*city)?|ipswich(?:\s*town)?|southampton)\b/i;
        if (eplClubs.test(teams) && !/\b(?:champions\s*league|europa|conference|fa\s*cup|carabao|efl\s*cup|community\s*shield)\b/i.test(league)) {
            if (isEnglandContext || league.includes('premier') || !country || country === 'unknown') {
                return true;
            }
        }
    }

    // 2. Spain La Liga
    const isSpainContext = country.includes('spain') || /\b(?:spain|spanish|espa[ñn]a)\b/i.test(league) || /\((?:esp|spain)\)/i.test(teams);
    if ((isSpainContext || !country) && /\b(?:la\s*liga|primera\s*divisi[oó]n|laliga|liga\s*santander|la\s*liga\s*ea\s*sports)\b/i.test(league) && !/\b(?:2|ii|segunda|portugal|u21|u19|fem)\b/i.test(league)) {
        return true;
    }
    if (!/\b(?:u21|u23|u20|u19|u18|res\.|reserva|women|w\b|fem)\b/i.test(teams + ' ' + league)) {
        const laLigaClubs = /\b(?:real\s*madrid|barcelona|atletico\s*madrid|athletic\s*bilbao|real\s*sociedad|real\s*betis|villarreal|valencia|sevilla|girona|celta\s*vigo|osasuna|mallorca|getafe|rayo\s*vallecano|las\s*palmas|alaves|deportivo\s*alaves|espanyol|leganes|valladolid|real\s*valladolid)\b/i;
        if (laLigaClubs.test(teams) && !/\b(?:champions\s*league|europa|conference|copa\s*del\s*rey|supercopa)\b/i.test(league)) {
            if (isSpainContext || league.includes('liga') || !country || country === 'unknown') return true;
        }
    }

    // 3. Italy Serie A
    const isItalyContext = country.includes('italy') || /\b(?:italy|italian|italia)\b/i.test(league) || /\((?:ita|italy)\)/i.test(teams);
    if ((isItalyContext || !country) && /\b(?:serie\s*a|serie\s*a\s*tim|serie\s*a\s*enilive)\b/i.test(league) && !/\b(?:brazil|u21|u19|fem|b\b|c\b)\b/i.test(league) && !country.includes('brazil')) {
        return true;
    }
    if (!/\b(?:u21|u23|u20|u19|u18|res\.|reserva|women|w\b|fem)\b/i.test(teams + ' ' + league)) {
        const serieAClubs = /\b(?:inter\s*milan|internazionale|ac\s*milan|juventus|napoli|atalanta|as\s*roma|roma\b|lazio|fiorentina|bologna|torino|monza|genoa|cagliari|lecce|hellas\s*verona|verona\b|empoli|parma|como\b|venezia|udinese)\b/i;
        if (serieAClubs.test(teams) && !/\b(?:champions\s*league|europa|conference|coppa\s*italia|supercoppa)\b/i.test(league) && !country.includes('brazil')) {
            if (isItalyContext || league.includes('serie') || !country || country === 'unknown') return true;
        }
    }


    // 5. France Ligue 1
    const isFranceContext = country.includes('france') || /\b(?:france|french)\b/i.test(league) || /\((?:fra|france)\)/i.test(teams);
    if ((isFranceContext || !country) && /\b(?:ligue\s*1|ligue\s*1\s*mcdonald'?s|ligue\s*1\s*uber\s*eats)\b/i.test(league) && !/\b(?:algeria|ivory|ligue\s*2|fem)\b/i.test(league) && !country.includes('algeria')) {
        return true;
    }
    if (!/\b(?:u21|u23|u20|u19|u18|res\.|reserva|women|w\b|fem)\b/i.test(teams + ' ' + league)) {
        const ligue1Clubs = /\b(?:psg\b|paris\s*saint[- ]germain|as\s*monaco|monaco\b|marseille\b|olympique\s*marseille|lyon\b|olympique\s*lyonnais|lille\s*osc|lille\b|stade\s*rennais|rennes\b|ogc\s*nice|nice\b|rc\s*lens|lens\b|stade\s*de\s*reims|reims\b|stade\s*brestois|brest\b|strasbourg\b|toulouse\b|fc\s*nantes|nantes\b|montpellier\b|le\s*havre|auxerre\b|angers\b|saint[- ]etienne)\b/i;
        if (ligue1Clubs.test(teams) && !/\b(?:champions\s*league|europa|conference|coupe\s*de\s*france)\b/i.test(league) && !country.includes('algeria')) {
            if (isFranceContext || league.includes('ligue 1') || !country || country === 'unknown') return true;
        }
    }

    return false;
};

export const checkIsPremierLeagueMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    // Guard: Explicit non-English countries can never be the English Premier League
    if (country && !['england', 'united kingdom', 'uk', 'unknown', ''].some(c => country.includes(c))) {
        return false;
    }

    // Strictly exclude youth, reserve, development and multi-division leagues (e.g. Premier League 2 Division One)
    if (/\b(?:premier\s*league\s*2|pl\s*2|pl2|division\s*(?:one|two|1|2)|u21|u23|u20|u19|u18|reserve|res\.|reserva|women|w\b|fem|cup|development|trophy)\b/i.test(league + ' ' + teams)) {
        return false;
    }

    const isEnglandContext = country.includes('england') || /\b(?:england|english)\b/i.test(league) || /\((?:eng|england)\)/i.test(teams);
    if ((isEnglandContext || !country) && /\b(?:premier\s*league|epl|english\s*premier)\b/i.test(league)) {
        return true;
    }
    const eplClubs = /\b(?:chelsea|bournemouth|arsenal(?!\s+(?:sarand[ií]|tula|kyiv|dzyarzhynsk))|leeds|liverpool(?!\s+montevideo)|manchester\s*city|man\s*city|manchester\s*united|man\s*united|man\s*utd|tottenham|spurs|newcastle(?:\s*united)?(?!\s+(?:olympic|jets))|aston\s*villa|brighton(?:\s*&\s*hove\s*albion)?|west\s*ham(?:\s*united)?|everton(?!\s+(?:de\s+vi[nñ]a|vi[nñ]a))|brentford|crystal\s*palace|fulham|wolverhampton(?:\s*wanderers)?|wolves|nottingham\s*forest|leicester(?:\s*city)?|ipswich(?:\s*town)?|southampton)\b/i;
    if (eplClubs.test(teams) && !/\b(?:champions\s*league|europa|conference|fa\s*cup|carabao|efl\s*cup|community\s*shield)\b/i.test(league)) {
        if (isEnglandContext || league.includes('premier') || !country || country === 'unknown') return true;
    }
    return false;
};

export const checkIsBundesligaMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const isGermanContext = country.includes('germany') || /\b(?:germany|german|deutschland)\b/i.test(league) || /\((?:ger|germany)\)/i.test(teams);
    if ((isGermanContext || !country) && /\bbundesliga\b/i.test(league) && !/\b(?:2\.\s*bundesliga|2|ii|u19|women|frauen)\b/i.test(league)) {
        return true;
    }
    if (!/\b(?:u21|u23|u20|u19|u18|res\.|reserva|women|w\b|fem|frauen)\b/i.test(teams + ' ' + league)) {
        const bundesligaClubs = /\b(?:bayern\s*munich|bayern\s*m[uü]nchen|borussia\s*dortmund|dortmund\b|bayer\s*leverkusen|rb\s*leipzig|eintracht\s*frankfurt|vfb\s*stuttgart|vfl\s*wolfsburg|borussia\s*m[oö]nchengladbach|freiburg|union\s*berlin|hoffenheim|werder\s*bremen|augsburg|mainz|heidenheim|st\.?\s*pauli|holstein\s*kiel|vfl\s*bochum)\b/i;
        if (bundesligaClubs.test(teams) && !/\b(?:champions\s*league|europa|conference|dfb[- ]pokal)\b/i.test(league)) {
            if (isGermanContext || league.includes('bundesliga') || !country || country === 'unknown') return true;
        }
    }
    return false;
};

export const checkIsLaLigaMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const isSpainContext = country.includes('spain') || /\b(?:spain|spanish|espa[ñn]a)\b/i.test(league) || /\((?:esp|spain)\)/i.test(teams);
    if ((isSpainContext || !country) && /\b(?:la\s*liga|primera\s*divisi[oó]n|laliga|liga\s*santander|la\s*liga\s*ea\s*sports)\b/i.test(league) && !/\b(?:2|ii|segunda|portugal|u21|u19|fem)\b/i.test(league)) {
        return true;
    }
    if (!/\b(?:u21|u23|u20|u19|u18|res\.|reserva|women|w\b|fem)\b/i.test(teams + ' ' + league)) {
        const laLigaClubs = /\b(?:real\s*madrid|barcelona|atletico\s*madrid|athletic\s*bilbao|real\s*sociedad|real\s*betis|villarreal|valencia|sevilla|girona|celta\s*vigo|osasuna|mallorca|getafe|rayo\s*vallecano|las\s*palmas|alaves|deportivo\s*alaves|espanyol|leganes|valladolid|real\s*valladolid)\b/i;
        if (laLigaClubs.test(teams) && !/\b(?:champions\s*league|europa|conference|copa\s*del\s*rey|supercopa)\b/i.test(league)) {
            if (isSpainContext || league.includes('liga') || !country || country === 'unknown') return true;
        }
    }
    return false;
};

export const checkIsLigue1Match = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const isFranceContext = country.includes('france') || /\b(?:france|french)\b/i.test(league) || /\((?:fra|france)\)/i.test(teams);
    if ((isFranceContext || !country) && /\b(?:ligue\s*1|ligue\s*1\s*mcdonald'?s|ligue\s*1\s*uber\s*eats)\b/i.test(league) && !/\b(?:algeria|ivory|ligue\s*2|fem)\b/i.test(league) && !country.includes('algeria')) {
        return true;
    }
    if (!/\b(?:u21|u23|u20|u19|u18|res\.|reserva|women|w\b|fem)\b/i.test(teams + ' ' + league)) {
        const ligue1Clubs = /\b(?:psg\b|paris\s*saint[- ]germain|as\s*monaco|monaco\b|marseille\b|olympique\s*marseille|lyon\b|olympique\s*lyonnais|lille\s*osc|lille\b|stade\s*rennais|rennes\b|ogc\s*nice|nice\b|rc\s*lens|lens\b|stade\s*de\s*reims|reims\b|stade\s*brestois|brest\b|strasbourg\b|toulouse\b|fc\s*nantes|nantes\b|montpellier\b|le\s*havre|auxerre\b|angers\b|saint[- ]etienne)\b/i;
        if (ligue1Clubs.test(teams) && !/\b(?:champions\s*league|europa|conference|coupe\s*de\s*france)\b/i.test(league) && !country.includes('algeria')) {
            if (isFranceContext || league.includes('ligue 1') || !country || country === 'unknown') return true;
        }
    }
    return false;
};

export const checkIsBahrainMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    return country.includes('bahrain') || /\bbahrain\b/i.test(league) || /\((?:bhr|bahrain)\)/i.test(teams);
};

export const checkIsCroatiaMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    return country.includes('croatia') || country.includes('hrvatska') || /\b(?:croatia|croatian|hrvatska|hnl|1\.\s*hnl)\b/i.test(league) || /\((?:cro|hrv)\)/i.test(teams);
};

export const checkIsIraqiLeagueMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const isIraq = country.includes('iraq') || /\biraq\b/i.test(league) || /\((?:irq|iraq)\)/i.test(teams);
    return isIraq;
};

export const checkIsVenezuelaCopaMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const isVen = country.includes('venezuela') || /\bvenezuela\b/i.test(league) || /\((?:ven|venezuela)\)/i.test(teams);
    return isVen && /\bcopa\b/i.test(league);
};

export const checkIsMontenegroFirstLeagueMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const isMne = country.includes('montenegro') || /\bmontenegro\b/i.test(league) || /\((?:mne|montenegro)\)/i.test(teams);
    return isMne && /\b(?:first\s*league|1\.\s*cfl|prva\s*liga)\b/i.test(league);
};

export const checkIsUsaUslSuperLeagueMatch = (match: Match): boolean => {
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    return /\busl\s*super\s*league\b/i.test(league + ' ' + teams);
};


export const checkIsEuropeanChasersMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    // Portugal Primeira Liga
    const isPortugalContext = country.includes('portugal') || /\b(?:portugal|portuguese)\b/i.test(league) || /\((?:por|portugal)\)/i.test(teams);
    if ((isPortugalContext || !country) && /\b(?:primeira\s*liga|liga\s*portugal|liga\s*nos|liga\s*betclic|la\s*liga\s*portugal)\b/i.test(league) && !/\b(?:liga\s*2|liga\s*ii|segunda)\b/i.test(league)) {
        return true;
    }
    if (isPortugalContext && /\b(?:benfica|sporting\s*(?:cp|lisbon)?|porto|braga|vitoria\s*guimaraes|boavista|famalicao|rio\s*ave|gil\s*vicente|estoril|arouca|moreirense|farense|casa\s*pia|santa\s*clara|nacional)\b/i.test(teams) && !/\b(?:taca|cup|segunda)\b/i.test(league)) {
        return true;
    }

    // Netherlands Eredivisie
    const isDutchContext = country.includes('netherlands') || country.includes('holland') || /\b(?:netherlands|dutch|holland)\b/i.test(league) || /\((?:ned|hol)\)/i.test(teams);
    if ((isDutchContext || !country) && /\b(?:eredivisie|dutch\s*eredivisie)\b/i.test(league) && !/\b(?:eerste\s*divisie|women)\b/i.test(league)) {
        return true;
    }
    if (isDutchContext && /\b(?:ajax|psv(?:\s*eindhoven)?|feyenoord|az\s*alkmaar|twente|utrecht|heerenveen|vitesse|groningen|go\s*ahead\s*eagles|nec\s*nijmegen|sparta\s*rotterdam|fortuna\s*sittard|pec\s*zwolle|almere\s*city|heracles|nac\s*breda|willem\s*ii)\b/i.test(teams) && !/\b(?:knvb|eerste)\b/i.test(league)) {
        return true;
    }

    // Belgium Pro League
    const isBelgianContext = country.includes('belgium') || /\b(?:belgium|belgian)\b/i.test(league) || /\((?:bel|belgium)\)/i.test(teams);
    if ((isBelgianContext || !country) && /\b(?:pro\s*league|jupiler\s*pro\s*league|jupiler\s*league|belgian\s*pro\s*league)\b/i.test(league) && !/\b(?:challenger|u21)\b/i.test(league)) {
        return true;
    }
    if (isBelgianContext && /\b(?:club\s*brugge|anderlecht|krc\s*genk|genk|kaagent|gent\b|standard\s*liege|union\s*saint[- ]gilloise|union\s*sg|royal\s*antwerp|antwerp|cercle\s*brugge|mechelen|charleroi|sint[- ]truiden|westerlo|kortrijk|oh\s*leuven|dender|beerschot)\b/i.test(teams) && !/\b(?:croky|cup|challenger|u21)\b/i.test(league)) {
        return true;
    }

    return false;
};

export const checkIsNonEuropeanMajorLeagueMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    // 1. Brazil Série A
    const isBrazilContext = country.includes('brazil') || country.includes('brasil') || /\b(?:brazil|brasil|brasileir[aã]o)\b/i.test(league) || /\((?:bra|brazil)\)/i.test(teams);
    if (isBrazilContext && (/\b(?:s[eé]rie\s*a|brasileir[aã]o)\b/i.test(league) || /\b(?:s[eé]rie\s*a)\b/i.test(teams)) && !/\b(?:s[eé]rie\s*[bcd]|copa|u20)\b/i.test(league)) {
        return true;
    }
    if (isBrazilContext && /\b(?:fluminense|palmeiras|flamengo|corinthians|sao\s*paulo|gremio|internacional|cruzeiro|vasco|botafogo|bragantino|fortaleza\s*ec|bahia|atletico\s*mineiro|atletico-mg|criciuma|juventude|vitoria|atletico\s*goianiense|cuiaba)\b/i.test(teams) && !/\b(?:s[eé]rie\s*[bcd]|copa|estadual)\b/i.test(league)) {
        return true;
    }

    // 2. Argentina Primera División
    const isArgContext = country.includes('argentina') || /\b(?:argentina|argentine)\b/i.test(league) || /\((?:arg|argentina)\)/i.test(teams);
    if (isArgContext && /\b(?:primera\s*divisi[oó]n|liga\s*profesional|lpf|copa\s*de\s*la\s*liga)\b/i.test(league) && !/\b(?:res\.|reserva|proyecci[oó]n|primera\s*[b-d]|nacional)\b/i.test(league + ' ' + teams)) {
        return true;
    }

    // 3. MLS (USA / Canada)
    const isMlsContext = country.includes('usa') || country.includes('united states') || country.includes('canada') || /\b(?:usa|mls|major\s*league\s*soccer)\b/i.test(league) || /\((?:usa|can)\)/i.test(teams);
    if (isMlsContext && /\b(?:mls|major\s*league\s*soccer)\b/i.test(league) && !/\b(?:mls\s*next|usl)\b/i.test(league)) {
        return true;
    }
    if (/\b(?:inter\s*miami|lafc|los\s*angeles\s*fc|la\s*galaxy|new\s*york\s*red\s*bulls|nycfc|columbus\s*crew|fc\s*cincinnati|seattle\s*sounders|philadelphia\s*union|atlanta\s*united|orlando\s*city|portland\s*timbers|sporting\s*kc|houston\s*dynamo|real\s*salt\s*lake|minnesota\s*united|austin\s*fc|nashville\s*sc|vancouver\s*whitecaps|toronto\s*fc|cf\s*montreal|charlotte\s*fc|st\.\s*louis\s*city)\b/i.test(teams) && !/\b(?:usl|next\s*pro)\b/i.test(league)) {
        return true;
    }

    // 4. Saudi Pro League
    const isSaudiContext = country.includes('saudi') || /\b(?:saudi|roshn)\b/i.test(league) || /\((?:ksa|saudi)\)/i.test(teams);
    if ((isSaudiContext || !country) && /\b(?:saudi\s*pro\s*league|roshn\s*saudi|saudi\s*league|spl)\b/i.test(league)) {
        return true;
    }
    if (isSaudiContext && /\b(?:al\s*hilal|al\s*nassr|al\s*ittihad|al\s*ahli|al\s*shabab|al\s*ettifaq|al\s*fateh|al\s*taawoun|al\s*fayha|damac|al\s*khaleej|al\s*wehda|al\s*raed|al\s*riyadh|al\s*okhdood|al\s*qadsiah|al\s*kholood|al\s*orobah)\b/i.test(teams) && !/\b(?:kings\s*cup|division\s*1)\b/i.test(league)) {
        return true;
    }

    return false;
};

export const checkIsUefaEflMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    // Exclude Carabao Cup (handled by dedicated trigger)
    if (/\b(?:carabao|efl\s*cup)\b/i.test(league + ' ' + teams)) {
        return false;
    }

    // 1. UEFA Club Competitions & Nations League
    if (/\b(?:champions\s*league|europa\s*league|conference\s*league|uefa\s*super\s*cup|uefa\s*nations\s*league)\b/i.test(league) ||
        /\buefa.*(?:champions|europa|conference)\b/i.test(league)) {
        if (!/\b(?:caf|afc|concacaf|ofc)\b/i.test(league)) {
            return true;
        }
    }

    // 2. EFL Competitions (Championship, League One, League Two, EFL Trophy)
    const isEnglandContext = country.includes('england') || /\b(?:england|english|efl)\b/i.test(league) || /\((?:eng|england)\)/i.test(teams);
    const isExcludedEfl = /\b(?:premier|u21|u23|u20|u19|u18|reserve|res\.|women|fem|development)\b/i.test(league + ' ' + teams);
    if (!isExcludedEfl) {
        if (isEnglandContext && /\b(?:championship|league\s*one|league\s*1|league\s*two|league\s*2|efl\s*trophy|bristol\s*street|papa\s*john)\b/i.test(league)) {
            return true;
        }
        if (/\b(?:efl\s*championship|efl\s*league\s*(?:one|1|two|2)|efl\s*trophy)\b/i.test(league)) {
            return true;
        }
    }

    return false;
};

export const checkIsMajorTournamentMatch = (match: Match): boolean => {
    const league = (match.league || (match as any).data?.league || '').toLowerCase();

    // 1. FA Cup
    if (/\b(?:the\s*fa\s*cup|fa\s*cup)\b/i.test(league)) return true;

    // 2. The FA Community Shield
    if (/\b(?:community\s*shield|fa\s*community\s*shield)\b/i.test(league)) return true;

    // 3. Copa del Rey (Spain)
    if (/\b(?:copa\s*del\s*rey|supercopa\s*de\s*espa[ñn]a)\b/i.test(league)) return true;

    // 4. Coppa Italia (Italy)
    if (/\b(?:coppa\s*italia|supercoppa\s*italiana)\b/i.test(league)) return true;

    // 5. Coupe de France (France)
    if (/\b(?:coupe\s*de\s*france|troph[eé]e\s*des\s*champions)\b/i.test(league)) return true;

    // 6. DFB-Pokal / DFL-Supercup (Germany)
    if (/\b(?:dfb[- ]pokal|dfl[- ]supercup)\b/i.test(league)) return true;

    return false;
};

export const checkIsCarabaoCupMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    // Strictly guard against Egyptian or non-English competitions
    if (country && country !== 'england' && country !== 'united kingdom' && country !== 'uk' && country !== 'world' && country !== 'unknown') {
        return false;
    }
    if (/\b(?:egypt|portugal|france|scotland|japan|germany|spain|italy)\b/i.test(country)) {
        return false;
    }
    if (/\b(?:zed\b|el\s*gaish\b|tala'?ea|ahly|zamalek|pyramids|enppi)\b/i.test(teams)) {
        return false;
    }

    if (/\b(?:carabao\s*cup|carabao|efl\s*cup|league\s*cup\s*\(\s*england\s*\))\b/i.test(league)) {
        return true;
    }
    if (/\b(?:carabao|efl\s*cup)\b/i.test(teams)) {
        return true;
    }
    return false;
};

export const checkIsUsaUslChampionshipMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    if (/\b(?:usl\s*championship|usl-championship)\b/i.test(league)) return true;
    const isUsaContext = country.includes('usa') || country.includes('united states') || /\((?:usa|us)\)/i.test(teams);
    if (isUsaContext && /\busl\b/i.test(league)) return true;
    if (/\b(?:usl\s*championship)\b/i.test(teams)) return true;
    return false;
};

export const checkIsChileSegundaDivisionMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    if (/\bchile\s*:\s*segunda(?:\s*division|\s*división)?\b/i.test(league)) return true;
    const isChileContext = country.includes('chile') || /\bchile\b/i.test(league) || /\((?:chi|chile)\)/i.test(teams);
    if (isChileContext && /\bsegunda(?:\s*division|\s*divisi[oó]n)?\b/i.test(league) && !/\bprimera\b/i.test(league)) {
        return true;
    }
    return false;
};

export const checkIsHungaryMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    if (country.includes('hungary') || country.includes('hungarian')) return true;
    if (/\b(?:hungary|hungarian|magyar|nb\s*i{1,3}|nemzeti\s*bajnoks[aá]g)\b/i.test(league)) return true;
    if (/\((?:hun|hungary)\)/i.test(teams)) return true;
    if (/\b(?:ferencvaros|ferencv[aá]rosi|ujpest|[uú]jpest|debrecen|debreceni|fehervar|feh[eé]rv[aá]r|puskas\s*akademia|pusk[aá]s\s*akad[eé]mia|paksi|mtk\s*budapest|zalaegerszeg|diosgyor|di[oó]sgy[oő]r|kisvarda|kisv[aá]rda|kecskemet|kecskem[eé]t|mezokovesd|mez[oő]k[oö]vesd|vasas|nyiregyhaza|ny[ií]regyh[aá]za)\b/i.test(teams) && !/\b(?:champions league|europa|conference)\b/i.test(league)) {
        return true;
    }
    return false;
};

export const checkIsEnglandAmateurNationalLeagueMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    if (/national\s*league/i.test(league)) {
        const isEnglishContext = country.includes('england') || /\b(?:england|english|amateur)\b/i.test(league) || /\((?:eng|england)\)/i.test(teams);
        if (isEnglishContext || !country) {
            return true;
        }
    }
    if (/\beng(?:land|alnd)?\s*amateur\s*:\s*national\s*league\b/i.test(league) || /\beng(?:land|alnd)?\s*amateur\s*:\s*national\s*league\b/i.test(teams)) {
        return true;
    }
    return false;
};

export const checkIsUkraineMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    if (country.includes('ukraine') || country.includes('ukrainian')) return true;
    if (/\b(?:ukraine|ukrainian|premier\s*liha|persha\s*liha|druha\s*liha|ukrainian\s*cup)\b/i.test(league)) return true;
    if (/\((?:ukr|ukraine)\)/i.test(teams)) return true;
    if (/\b(?:shakhtar|dynamo\s*kyiv|dinamo\s*kiev|dnipro|kryvbas|polissya|zorya\s*luhansk|vorskla|rukh\s*lviv|oleksandriya|chornomorets|kolos\s*kovalivka|metalist|veres\s*rivne|obolon|lzn\s*cherkasy)\b/i.test(teams) && !/\b(?:champions league|europa|conference)\b/i.test(league)) {
        return true;
    }
    return false;
};

export const checkIsThailandMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    if (country.includes('thailand')) return true;
    if (/\b(?:thailand|thai\s*league(?:\s*[123])?|thai\s*fa\s*cup|thai\s*league\s*cup)\b/i.test(league)) return true;
    if (/\((?:tha|thailand)\)/i.test(teams)) return true;
    if (/\b(?:buriram\s*united|bangkok\s*united|port\s*fc|muangthong\s*united|bg\s*pathum|chiangrai\s*united|ratchaburi|chonburi|khon\s*kaen|pt\s*prachuap|sukhothai|nakhon\s*ratchasima|rayong|lamphun\s*warriors|uthai\s*thani|nongbua\s*pitchaya)\b/i.test(teams) && !/\b(?:afc\s*champions|afc\s*cup)\b/i.test(league)) {
        return true;
    }
    return false;
};

export const checkIsHungaryNbiMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    if (/\bhungary\s*:\s*(?:nb\s*i\b|nbi\b|otp\s*bank\s*liga)/i.test(league + ' ' + teams)) return true;
    const isHungaryContext = country.includes('hungary') || country.includes('hungarian') || /\b(?:hungary|hungarian)\b/i.test(league) || /\((?:hun|hungary)\)/i.test(teams);
    if (isHungaryContext) {
        if (/\b(?:otp\s*bank\s*liga|nemzeti\s*bajnoks[aá]g\s*i\b)\b/i.test(league)) return true;
        if (/\b(?:nb\s*i\b|nbi\b)\b/i.test(league) && !/\b(?:nb\s*i{2,3}|nb\s*[23]|nemzeti\s*bajnoks[aá]g\s*(?:ii|iii|[23]))\b/i.test(league)) {
            return true;
        }
    }
    return false;
};

export const checkIsThaiLeague1Match = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    if (/\bthailand\s*:\s*thai\s*league\s*1\b/i.test(league + ' ' + teams)) return true;
    const isThaiContext = country.includes('thailand') || /\bthailand\b/i.test(league) || /\((?:tha|thailand)\)/i.test(teams);
    if (isThaiContext) {
        if (/\b(?:thai\s*league\s*1\b|t1\b|hilux\s*revo\s*thai\s*league)\b/i.test(league)) return true;
        if (/\bthai\s*league\b/i.test(league) && !/\bthai\s*league\s*[234]\b/i.test(league) && !/\bcup\b/i.test(league)) {
            return true;
        }
    }
    if (/\bthai\s*league\s*1\b/i.test(league + ' ' + teams)) return true;
    return false;
};

export const checkIsCzech4LigaDivizieFMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    if (/\bczech\s*republic\s*:\s*4\.\s*liga\s*-\s*divizi?e?\s*f\b/i.test(league + ' ' + teams)) return true;
    if (/\b4\.\s*liga\s*-\s*divizi?e?\s*f\b/i.test(league + ' ' + teams)) return true;
    const isCzechContext = country.includes('czech') || /\bczech\b/i.test(league) || /\((?:cze|czech)\)/i.test(teams);
    if (isCzechContext && /\b4\.\s*liga\b/i.test(league) && /\bdivizi?e?\s*f\b/i.test(league)) return true;
    if (/\b4\.\s*liga\b/i.test(league) && /\bdivizi?e?\s*f\b/i.test(league)) return true;
    return false;
};

export const checkIsSpainPrimeraRfefGroup2Match = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    if (/\bspain\s*:\s*primera\s*(?:divisi[oó]n\s*)?rfef\s*-\s*(?:group|grupo)\s*2\b/i.test(league + ' ' + teams)) return true;
    if (/\bprimera\s*(?:divisi[oó]n\s*)?rfef\s*-\s*(?:group|grupo)\s*2\b/i.test(league + ' ' + teams)) return true;
    if (/\bprimera\s*federaci[oó]n\s*-\s*(?:group|grupo)\s*2\b/i.test(league + ' ' + teams)) return true;
    if (/\b1[ªa]\s*(?:rfef|federaci[oó]n)\s*-\s*(?:group|grupo)\s*2\b/i.test(league + ' ' + teams)) return true;

    const isSpainContext = country.includes('spain') || country.includes('españa') || /\b(?:spain|espa[ñn]a)\b/i.test(league) || /\((?:esp|spain)\)/i.test(teams);
    if (isSpainContext && /\b(?:rfef|federaci[oó]n)\b/i.test(league) && /\b(?:group|grupo)\s*2\b/i.test(league)) {
        return true;
    }
    return false;
};

export const checkIsItalySerieDMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    if (/\bitaly\s*:\s*serie\s*d\b/i.test(league + ' ' + teams)) return true;
    if (/\bserie\s*d\b/i.test(league + ' ' + teams)) {
        const isItalyContext = country.includes('italy') || country.includes('italia') || /\b(?:italy|italia)\b/i.test(league) || /\((?:ita|italy)\)/i.test(teams);
        if (isItalyContext || !country || country === 'unknown') return true;
    }
    return false;
};

export const checkIsItalySerieDGironeBMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    if (/\bitaly\s*:\s*serie\s*d\s*-\s*(?:girone|group)\s*b\b/i.test(league + ' ' + teams)) return true;
    if (/\bserie\s*d\s*-\s*(?:girone|group)\s*b\b/i.test(league + ' ' + teams)) return true;
    const isItalyContext = country.includes('italy') || country.includes('italia') || /\b(?:italy|italia)\b/i.test(league) || /\((?:ita|italy)\)/i.test(teams);
    if (isItalyContext && /\bserie\s*d\b/i.test(league) && /\b(?:girone|group)\s*b\b/i.test(league)) {
        return true;
    }
    return false;
};

export const checkIsQatarSecondDivisionMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    if (/\bqatar\s*:\s*(?:second\s*division|2nd\s*division|division\s*2|league\s*2)\b/i.test(league + ' ' + teams)) return true;
    const isQatarContext = country.includes('qatar') || /\bqatar\b/i.test(league) || /\((?:qat|qatar)\)/i.test(teams);
    if (isQatarContext && /\b(?:second\s*division|2nd\s*division|division\s*2|qatar\s*gas\s*league)\b/i.test(league)) {
        return true;
    }
    return false;
};

export const checkIsArgentinaTorneoProyeccionMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    if (/\b(?:torneo\s*proyecci[oó]n|proyecci[oó]n|reserva|reserves?)\b/i.test(league)) {
        const isArgContext = country.includes('argentina') || /\b(?:argentina|argentine|lpf)\b/i.test(league) || /\((?:arg|argentina)\)/i.test(teams);
        if (isArgContext) return true;
    }
    if (/\bargentina.*(?:proyecci[oó]n|reserva)\b/i.test(league)) return true;
    if (/\bargentina\s*:\s*torneo\s*proyecci[oó]n\b/i.test(league)) return true;
    if (/\b(?:boca\s*juniors|colon|atletico\s*tucuman|talleres\s*cordoba|belgrano|san\s*martin\s*san\s*juan|sarmiento|velez\s*sarsfield|godoy\s*cruz|barracas\s*central|lanus|central\s*cordoba|argentinos\s*juniors|san\s*lorenzo|river\s*plate|racing\s*club|independiente|estudiantes|gimnasia|newell|rosario\s*central)\s*res\b/i.test(teams)) {
        return true;
    }
    return false;
};

export const checkIsSlovenia1SnlMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    if (/\bslovenia\s*:\s*1\.\s*snl\b/i.test(league + ' ' + teams)) return true;
    if (/\b1\.\s*snl\b/i.test(league + ' ' + teams)) return true;
    const isSloveniaContext = country.includes('slovenia') || /\bslovenia\b/i.test(league) || /\((?:svn|slo|slovenia)\)/i.test(teams);
    if (isSloveniaContext && /\b(?:1\.\s*snl|prva\s*liga|prvaliga)\b/i.test(league) && !/\b(?:2\.\s*snl|3\.\s*snl|women|u19)\b/i.test(league)) {
        return true;
    }
    return false;
};

export const checkIsSloveniaLeagueMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    if (country.includes('slovenia') || country.includes('slovenija')) return true;
    if (/\b(?:slovenia|slovenian|1\.\s*snl|2\.\s*snl|prva\s*liga|prvaliga|pokal\s*slovenije)\b/i.test(league)) return true;
    if (/\((?:svn|slo|slovenia)\)/i.test(teams)) return true;
    if (/\b(?:maribor|olimpija\s*ljubljana|celje|koper|mura|domzale|bravo|radomlje|nafta|primorje|gorica|rudar\s*velenje|aluminij|beltinci|triglav)\b/i.test(teams)) {
        return true;
    }
    return false;
};

export const checkIsIrelandLeagueMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    if (country.includes('ireland') || country.includes('republic of ireland')) return true;
    if (/\b(?:ireland|irish|fai\s*cup|premier\s*division|first\s*division|leinster\s*senior|munster\s*senior)\b/i.test(league) && !/\bnorthern\s*ireland\b/i.test(league)) return true;
    if (/\((?:irl|ire)\)/i.test(teams) && !/\((?:nir)\)/i.test(teams)) return true;
    if (/\b(?:shamrock\s*rovers|derry\s*city|shelbourne|st\.?\s*patrick'?s|bohemians|sligo\s*rovers|galway\s*united|waterford\s*fc|dundalk|drogheda\s*united|cork\s*city|bray\s*wanderers|ucd|finn\s*harps|wexford|cobh\s*ramblers|athlone\s*town|longford\s*town|kerry\s*fc)\b/i.test(teams)) {
        return true;
    }
    return false;
};

export const checkIsIcelandLeagueMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    if (country.includes('iceland') || country.includes('ísland')) return true;
    if (/\b(?:iceland|icelandic|besta\s*deild|1\.\s*deild|2\.\s*deild|urvalsdeild|lengjubikarinn|fotbolti|borgunarbikar|mjolnisbikar)\b/i.test(league)) return true;
    if (/\((?:isl|ice)\)/i.test(teams)) return true;
    if (/\b(?:valur|breidablik|vikingur\s*reykjavik|kr\s*reykjavik|stjarnan|fh\s*hafnarfjordur|ia\s*akranes|ka\s*akureyri|fram\b|keflavik|fylkir|hk\s*kopavogs|vestri|ibv\s*vestmannaeyjar|grotta|thor\s*akureyri|leiknir|fjolnir|aegir|njardvik)\b/i.test(teams)) {
        return true;
    }
    return false;
};

export const checkIsBrazilSerieBMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const isBrazilContext = country.includes('brazil') || country.includes('brasil') || /\b(?:brazil|brasil)\b/i.test(league) || /\((?:bra|brazil)\)/i.test(teams);
    if (/\b(?:s[eé]rie\s*b)\b/i.test(league) && (isBrazilContext || /\bbrazil\b/i.test(league))) return true;
    if (isBrazilContext && /\b(?:s[eé]rie\s*b)\b/i.test(league + ' ' + teams)) return true;
    const serieBTeams = /\b(?:sport\s*recife|santos\b|novorizontino|mirassol|vila\s*nova|ceara|america\s*mineiro|america-mg|coritiba|avai|operario-pr|operario\s*pr|goias|amazonas|ponte\s*preta|paysandu|botafogo-sp|botafogo\s*sp|chapecoense|crb|crb\s*al|ituano|brusque|guarani)\b/i.test(teams);
    if (isBrazilContext && serieBTeams && !/\b(?:s[eé]rie\s*a|copa\s*do\s*brasil|paulista|carioca|mineiro|gaucho)\b/i.test(league)) {
        return true;
    }
    return false;
};

export const checkIsBelgiumReserveProLeagueMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const isBelgiumContext = country.includes('belgium') || country.includes('belgique') || /\b(?:belgium|belgian)\b/i.test(league) || /\((?:bel)\)/i.test(teams);
    if (/\b(?:reserve\s*pro\s*league|pro\s*league\s*u21|u21\s*pro\s*league)\b/i.test(league)) return true;
    if (isBelgiumContext && /\b(?:reserve|u21)\b/i.test(league) && /\bpro\s*league\b/i.test(league)) return true;
    if (isBelgiumContext && /\b(?:reserve|reserves|u21)\b/i.test(league + ' ' + teams) && /\b(?:anderlecht|club\s*brugge|genk|gent|standard\s*liege|antwerp|mechelen|kortrijk|charleroi|eupen|cercle\s*brugge|westerlo|sint-truiden|beerschot|zulte\s*waregem|dender)\b/i.test(teams)) {
        if (/\b(?:reserve|res\.|u21)\b/i.test(teams) || /\b(?:reserve|u21)\b/i.test(league)) return true;
    }
    return false;
};

export const checkIsSlovakiaLeagueMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    if (country.includes('slovakia') || country.includes('slovensko')) return true;
    if (/\b(?:slovakia|slovak|slovensko|nik[eé]\s*liga|slovnaft|super\s*liga\s*slovakia|2\.\s*liga\s*slovakia|corgon\s*liga|fortuna\s*liga)\b/i.test(league)) return true;
    if (/\((?:svk|slo)\)/i.test(teams) && !/\((?:svn)\)/i.test(teams)) return true;
    if (/\b(?:slovan\s*bratislava|zilina|dac\s*dunajska|spartak\s*trnava|ruzomberok|kosice|podbrezova|dukla\s*banska|skalica|zemplin\s*michalovce|trencin|komarno|tatran\s*presov|petrzalka)\b/i.test(teams)) {
        return true;
    }
    return false;
};

export const checkIsItalySerieBMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const isItalyContext = country.includes('italy') || country.includes('italia') || /\b(?:italy|italian)\b/i.test(league) || /\((?:ita)\)/i.test(teams);
    if (/\b(?:serie\s*b|serie\s*bkt)\b/i.test(league) && (isItalyContext || !country || country === 'Unknown')) return true;
    if (isItalyContext && /\b(?:serie\s*b)\b/i.test(league + ' ' + teams)) return true;
    const serieBClubs = /\b(?:pisa|sassuolo|spezia|cesena|cremonese|juve\s*stabia|brescia|palermo|sudtirol|reggiana|salernitana|mantova|catanzaro|sampdoria|bari|modena|carrarese|frosinone|cittadella|cosenza)\b/i.test(teams);
    if (isItalyContext && serieBClubs && !/\b(?:serie\s*a|serie\s*c|serie\s*d|coppa\s*italia|primavera)\b/i.test(league)) {
        return true;
    }
    return false;
};

export const checkIsSwedenDivision2NorraSvealandMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${league} ${teams}`;

    if (/\bsweden\s*:\s*division\s*2\s*-\s*norra\s*svealand\b/i.test(combined)) return true;
    if (/\bdivision\s*2\s*-\s*norra\s*svealand\b/i.test(combined)) return true;
    if (/\bdiv(?:ision)?\s*2\s*norra\s*svealand\b/i.test(combined)) return true;
    const isSwedenContext = country.includes('sweden') || country.includes('sverige') || /\b(?:sweden|sverige)\b/i.test(league) || /\((?:swe|sweden)\)/i.test(teams);
    if (isSwedenContext && /\bnorra\s*svealand\b/i.test(combined)) {
        return true;
    }
    return false;
};

export const checkIsCzechLigaMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${league} ${teams}`;

    // Exclude lower Czech tiers explicitly
    if (/\b(?:2\.\s*liga|fnl|nfl|3\.\s*liga|msfl|cfl|4\.\s*liga|divizi?e|pohar|cup|mol\s*cup)\b/i.test(league)) return false;

    if (/\bczech\s*(?:republic)?\s*:\s*(?:czech\s*liga|1\.\s*liga|chance\s*liga|fortuna\s*liga)\b/i.test(combined)) return true;
    if (/\bczech\s*liga\b/i.test(combined)) return true;

    const isCzechContext = country.includes('czech') || /\bczech\b/i.test(league) || /\((?:cze|czech)\)/i.test(teams);
    if (isCzechContext) {
        if (/\b(?:1\.\s*liga|chance\s*liga|fortuna\s*liga|gambrinus\s*liga)\b/i.test(league)) return true;
        if (/\bfirst\s*league\b/i.test(league)) return true;
    }
    return false;
};

export const checkIsVietnamVLeague2Match = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${league} ${teams}`;

    // Exclude V.League 1
    if (/\bv(?:\.|-|\s*)league\s*1\b/i.test(league) || /\bv-league\s*1\b/i.test(league)) return false;

    if (/\bvietnam\s*:\s*v(?:\.|-|\s*)league\s*2\b/i.test(combined)) return true;
    if (/\bv(?:\.|-|\s*)league\s*2\b/i.test(combined)) return true;
    if (/\bv-league\s*2\b/i.test(combined)) return true;
    if (/\bh[aạ]ng\s*nh[aấ]t\b/i.test(combined)) return true;

    const isVietnamContext = country.includes('vietnam') || /\bvietnam\b/i.test(league) || /\((?:vie|vnm|vietnam)\)/i.test(teams);
    if (isVietnamContext && (/\b(?:2nd\s*division|second\s*division|division\s*2|league\s*2)\b/i.test(league))) {
        return true;
    }
    return false;
};

export const checkIsPortugalCampeonatoGroupCMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${league} ${teams}`;

    if (/\bportugal\s*:\s*campeonato\s*de\s*portugal(?:\s*prio)?\s*-\s*(?:group|grupo)\s*c\b/i.test(combined)) return true;
    if (/\bcampeonato\s*de\s*portugal(?:\s*prio)?\s*-\s*(?:group|grupo)\s*c\b/i.test(combined)) return true;

    const isPortugalContext = country.includes('portugal') || /\bportugal\b/i.test(league) || /\((?:por|prt|portugal)\)/i.test(teams);
    if (isPortugalContext && /\bcampeonato\s*de\s*portugal\b/i.test(league) && /\b(?:group|grupo)\s*c\b/i.test(league)) {
        return true;
    }
    return false;
};

export const checkIsTurkey1LigMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${league} ${teams}`;

    // Exclude Süper Lig and lower tiers
    if (/\bs[uü]per\s*lig\b/i.test(league) || /\b2\.\s*lig\b/i.test(league) || /\b3\.\s*lig\b/i.test(league)) return false;

    if (/\bturk(?:ey|iye)\s*:\s*(?:1\.\s*lig|tff\s*1\.\s*lig|trendyol\s*1\.\s*lig)\b/i.test(combined)) return true;
    if (/\btff\s*1\.\s*lig\b/i.test(combined)) return true;
    if (/\btrendyol\s*1\.\s*lig\b/i.test(combined)) return true;

    const isTurkeyContext = country.includes('turkey') || country.includes('türkiye') || country.includes('turkiye') || /\b(?:turkey|t[uü]rkiye)\b/i.test(league) || /\((?:tur|turkey)\)/i.test(teams);
    if (isTurkeyContext && /\b1\.\s*lig\b/i.test(league)) {
        return true;
    }
    return false;
};

export const checkIsSpainSegundaDivisionMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${league} ${teams}`;

    // Exclude Primera División / LaLiga EA Sports and Tercera División
    if (/\b(?:primera\s*divisi[oó]n|primera\s*division|laliga\s*(?:ea\s*sports|santander)?$|tercera)\b/i.test(league)) {
        if (!/\b(?:segunda|laliga\s*2|hypermotion|2[ªa]\s*rfef)\b/i.test(league)) {
            return false;
        }
    }

    if (/\bspain\s*:\s*segunda\s*(?:divisi[oó]n|division|federaci[oó]n|federacion|rfef)\b/i.test(combined)) return true;
    if (/\blaliga\s*(?:2|hypermotion)\b/i.test(combined)) return true;
    if (/\b2[ªa]\s*(?:rfef|federaci[oó]n|division|divisi[oó]n)\b/i.test(combined)) return true;
    if (/\bsegunda\s*(?:divisi[oó]n|division|federaci[oó]n|federacion|rfef)\b/i.test(combined)) {
        const isSpainContext = country.includes('spain') || country.includes('españa') || country.includes('espana') || /\b(?:spain|espa[ñn]a)\b/i.test(league) || /\((?:esp|spain)\)/i.test(teams);
        if (isSpainContext || /\bspain\b/i.test(combined)) return true;
    }
    return false;
};

export const checkIsTurkeySuperLigMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${league} ${teams}`;

    if (/\bturk(?:ey|iye)\s*:\s*s[uü]per\s*lig\b/i.test(combined)) return true;
    if (/\btrendyol\s*s[uü]per\s*lig\b/i.test(combined)) return true;

    const isTurkeyContext = country.includes('turkey') || country.includes('türkiye') || country.includes('turkiye') || /\b(?:turkey|t[uü]rkiye)\b/i.test(league) || /\((?:tur|turkey)\)/i.test(teams);
    if (isTurkeyContext && /\bs[uü]per\s*lig\b/i.test(league)) {
        return true;
    }
    return false;
};

export const checkIsRussiaCupMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();

    if (/\brussia\s*:\s*cup\b/i.test(league) || /\brussian\s*cup\b/i.test(league) || /\brussia\s*-\s*cup\b/i.test(league)) return true;
    if (/\bкубок\s*россии\b/i.test(league)) return true;
    if ((country.includes('russia') || country.includes('россия')) && /\bcup\b/i.test(league)) return true;
    return false;
};

export const checkIsAfcChampionsLeagueEliteMatch = (match: Match): boolean => {
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const combined = `${(match.country || '').toLowerCase()} ${league}`;

    if (/afc\s*champions\s*league\s*elite/i.test(combined)) return true;
    if (/afc\s*elite/i.test(combined)) return true;
    if (/champions\s*league\s*elite/i.test(league)) return true;
    return false;
};

export const checkIsCzechRepublicMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    if (country.includes('czech') || country.includes('česk') || /\bcze\b/i.test(country)) return true;
    if (/\bczech\s*(?:republic)?\s*:/i.test(league)) return true;
    if (/\b(?:czech\s*liga|1\.\s*liga|2\.\s*liga|fnl|nfl|3\.\s*liga|msfl|cfl|4\.\s*liga|divizi?e|mol\s*cup)\b/i.test(league) && (country.includes('czech') || /\bczech\b/i.test(league))) return true;
    if (/\bczech\b/i.test(league) || /\((?:cze|czech)\)/i.test(teams)) return true;
    return false;
};

export const checkIsNicaraguaPrimeraDivisionMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const combined = `${country} ${league}`;
    if (/\bnicaragua\s*:\s*primera\s*divisi[oó]n\b/i.test(combined)) return true;
    if ((country.includes('nicaragua') || /\bnicaragua\b/i.test(league)) && /\b(?:primera\s*divisi[oó]n|liga\s*primera|primera)\b/i.test(league)) return true;
    if (/\bliga\s*primera\b/i.test(combined) && country.includes('nicaragua')) return true;
    return false;
};

export const checkIsAfcChampionsLeagueTwoMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const combined = `${country} ${league}`;
    if (/\b(?:world\s*:\s*)?afc\s*champions\s*league\s*(?:two|2)\b/i.test(combined)) return true;
    if (/\bafc\s*champions\s*league\s*(?:two|2)\b/i.test(combined)) return true;
    if (/\bafc\s*(?:champions\s*league\s*)?two\b/i.test(combined)) return true;
    if (/\bafc\s*two\b/i.test(combined)) return true;
    return false;
};

export const checkIsRussiaSecondLeagueMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const combined = `${country} ${league}`;
    if (/\brussia\s*:\s*(?:second\s*league|fnl\s*2|2nd\s*league|2\.\s*league)\b/i.test(combined)) return true;
    if (/\bsecond\s*league(?:\s*-\s*|\s+)group\s*2\b/i.test(combined)) return true;
    if ((country.includes('russia') || country.includes('россия') || /\brussia\b/i.test(league)) && (/\b(?:second\s*league|2nd\s*league|fnl\s*2|вторая\s*лига|division\s*b)\b/i.test(league) || /\bgroup\s*2\b/i.test(league))) return true;
    return false;
};

export const checkIsConmebolLibertadoresMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const league = (match.league || (match as any).data?.league || '').toLowerCase();
    const combined = `${country} ${league}`;
    if (/\b(?:world\s*:\s*)?(?:conmebol\s*)?libertadores\b/i.test(combined)) return true;
    if (/\bcopa\s*libertadores\b/i.test(combined)) return true;
    if (/\bconmebol\s*libertadores\b/i.test(combined)) return true;
    return false;
};

export const normalizeAndTranslateLeague = (rawLeague: string): string => {
    if (!rawLeague) return '';
    let l = rawLeague.toLowerCase().trim();
    // Normalize Spanish / French / German / Italian feminine/women variations to English 'women'
    l = l.replace(/\b(?:femenina|femenino|femenin|frauen|femmes|femminile|donne|kobiety|ženy|zeny)\b/gi, 'women');
    l = l.replace(/\b(?:fem|fem\.|w\b|\(w\))\b/gi, 'women');
    // Normalize division/league names
    l = l.replace(/\bprimera\s*divisi[oó]n\b/gi, 'primera division');
    l = l.replace(/\bprimera\s*federaci[oó]n\b/gi, 'primera federacion');
    l = l.replace(/\bsegunda\s*divisi[oó]n\b/gi, 'segunda division');
    l = l.replace(/\bchampionnat\s*national\b/gi, 'national');
    l = l.replace(/\bösterreich\b|\boesterreich\b/gi, 'austria');
    return l;
};

export const checkIsFranceLigue3Match = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const translatedLeague = normalizeAndTranslateLeague(rawLeague);
    const combined = `${rawLeague} ${translatedLeague} ${teams}`;

    // Exclude Ligue 1, Ligue 2, and lower amateur (National 2, National 3)
    if (/\bligue\s*1\b|\bligue\s*2\b|\bnational\s*2\b|\bnational\s*3\b|\bu19\b|\bu21\b/i.test(translatedLeague)) return false;

    // Direct matches: France: Ligue 3, France: National 1, France: National
    if (/\bfrance\s*:\s*(?:ligue\s*3|national\s*1|national\b)/i.test(rawLeague)) return true;
    if (/\bfrance\s*:\s*(?:ligue\s*3|national\s*1|national\b)/i.test(combined)) return true;
    if (/\b(?:ligue\s*3|championnat\s*national\s*1|national\s*1)\b/i.test(combined)) return true;

    const isFranceContext = country.includes('france') || /\b(?:france|french)\b/i.test(rawLeague) || /\((?:fra|france)\)/i.test(teams);
    if (isFranceContext) {
        if (/\b(?:ligue\s*3|national\s*1|national)\b/i.test(translatedLeague) && !/\b(?:fem|women|coupe)\b/i.test(translatedLeague)) {
            return true;
        }
    }
    return false;
};

export const checkIsSpainPrimeraWomenMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const translatedLeague = normalizeAndTranslateLeague(rawLeague);
    const combined = `${rawLeague} ${translatedLeague} ${teams}`;

    // Check direct pattern like "Spain: Primera División (women)" or "Spain: Primera Division (Women)"
    if (/\bspain\s*:\s*primera\s*divisi[oó]n\s*\(\s*women\s*\)/i.test(rawLeague)) return true;
    if (/\bspain\s*:\s*primera\s*divisi[oó]n\s*\(\s*women\s*\)/i.test(translatedLeague)) return true;

    // Spanish women's league names: Liga F, Primera Division Femenina, Primera Federacion Femenina, Primera Division (Women)
    const isSpainContext = country.includes('spain') || country.includes('españa') || country.includes('espana') ||
        /\b(?:spain|spanish|espa[ñn]a)\b/i.test(rawLeague) || /\((?:esp|spain)\)/i.test(teams);

    const isWomenMatch = /\b(?:women|femenina|femenino|fem|w\b|\(w\))\b/i.test(rawLeague + ' ' + teams) ||
        translatedLeague.includes('women');

    if (isSpainContext && isWomenMatch) {
        if (/\b(?:primera\s*divisi[oó]n|primera\s*division|liga\s*f|primera\s*federaci[oó]n|primera\s*federacion|1\.\s*divisi[oó]n)\b/i.test(rawLeague) ||
            /\b(?:primera\s*division|liga\s*f|primera\s*federacion)\b/i.test(translatedLeague)) {
            return true;
        }
    }
    if (/\bliga\s*f\b/i.test(rawLeague) || /\bliga\s*f\b/i.test(translatedLeague)) {
        if (isSpainContext || !country) return true;
    }
    return false;
};

export const checkIsEnglandNonLeaguePremierMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${rawLeague} ${teams}`;

    // Direct match: "England: Non League Premier", "Non League Premier: Southern Central", etc.
    if (/\bengland\s*:\s*non\s*league\s*premier\b/i.test(combined)) return true;
    if (/\bnon\s*league\s*premier\b/i.test(rawLeague)) return true;
    if (/\bnon-league\s*premier\b/i.test(rawLeague)) return true;

    const isEnglandContext = country.includes('england') || /\b(?:england|english)\b/i.test(rawLeague) || /\((?:eng|england)\)/i.test(teams);
    if (isEnglandContext) {
        if (/\b(?:southern|northern|isthmian)\s*(?:league\s*)?premier\b/i.test(rawLeague)) {
            return true;
        }
        if (/\bpremier\s*division\b/i.test(rawLeague) && /\b(?:southern|northern|isthmian)\b/i.test(rawLeague)) {
            return true;
        }
    }
    return false;
};

export const checkIsEnglandLeagueTwoMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${rawLeague} ${teams} ${country}`;

    // Strictly exclude premier, youth, reserve, development, and non-league competitions
    if (/\b(?:premier|u21|u23|u20|u19|u18|reserve|res\.|women|fem|development|national|isthmian|southern|northern)\b/i.test(rawLeague + ' ' + teams)) {
        return false;
    }

    if (/\bengland\s*:\s*(?:efl\s*)?league\s*(?:two|2)\b/i.test(combined)) return true;
    if (/\befl\s*league\s*(?:two|2)\b/i.test(rawLeague)) return true;
    const isEnglandContext = country.includes('england') || /\b(?:england|english|efl)\b/i.test(rawLeague) || /\((?:eng|england)\)/i.test(teams);
    if (isEnglandContext && /\b(?:efl\s*league\s*(?:two|2)|league\s*(?:two|2))\b/i.test(rawLeague)) return true;
    return false;
};

export const checkIsEnglandNonLeaguePremierSouthernSouthMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${rawLeague} ${teams} ${country}`;

    if (/\bnon\s*league\s*premier\s*(?:-\s*)?southern\s*south\b/i.test(combined)) return true;
    if (/\bsouthern\s*(?:league\s*)?premier\s*(?:division\s*)?south\b/i.test(rawLeague)) return true;
    if (/\bsouthern\s*south\b/i.test(rawLeague) && (/\b(?:non\s*league|premier|england)\b/i.test(combined) || country.includes('england'))) return true;
    return false;
};

export const checkIsEnglandNonLeaguePremierSouthernCentralMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${rawLeague} ${teams} ${country}`;

    if (/\bnon\s*league\s*premier\s*(?:-\s*)?southern\s*central\b/i.test(combined)) return true;
    if (/\bsouthern\s*(?:league\s*)?premier\s*(?:division\s*)?central\b/i.test(rawLeague)) return true;
    if (/\bsouthern\s*central\b/i.test(rawLeague) && (/\b(?:non\s*league|premier|england)\b/i.test(combined) || country.includes('england'))) return true;
    return false;
};

export const checkIsEnglandNonLeaguePremierIsthmianMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${rawLeague} ${teams} ${country}`;

    if (/\bnon\s*league\s*premier\s*(?:-\s*)?isthmian\b/i.test(combined)) return true;
    if (/\bisthmian\s*(?:league\s*)?premier\b/i.test(rawLeague)) return true;
    if (/\bisthmian\s*premier\b/i.test(rawLeague)) return true;
    if (/\bisthmian\b/i.test(rawLeague) && (/\b(?:non\s*league|premier|england)\b/i.test(combined) || country.includes('england'))) return true;
    return false;
};

export const checkIsBangladeshMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${rawLeague} ${teams} ${country}`;

    if (country.includes('bangladesh') || /\bbangladesh\b/i.test(rawLeague) || /\bbangladesh\b/i.test(combined)) return true;
    if (/\((?:ban|bgd)\)/i.test(teams)) return true;
    if (/\bbashundhara\s*kings|abdhani|sheikh\s*russel|sheikh\s*jamal|mohammedan\s*sc\s*dhaka|chittagong\s*abdhani|fortis\s*fc|rahmatganj|police\s*fc\s*dhaka\b/i.test(teams)) return true;
    return false;
};

export const checkIsParaguayDivisionIntermediaMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${rawLeague} ${teams} ${country}`;

    if (/\bparaguay\s*:\s*division\s*intermedia\b/i.test(combined)) return true;
    if (/\bdivision\s*intermedia\b/i.test(rawLeague)) return true;
    if (/\bdivisi[oó]n\s*intermedia\b/i.test(combined)) return true;
    const isParaguay = country.includes('paraguay') || /\bparaguay\b/i.test(rawLeague) || /\((?:par|pry)\)/i.test(teams);
    if (isParaguay && /\bintermedia\b/i.test(rawLeague)) return true;
    return false;
};

export const checkIsGuatemalaLigaNacionalMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${rawLeague} ${teams} ${country}`;

    if (/\bguatemala\s*:\s*liga\s*nacional\b/i.test(combined)) return true;
    if (/\bliga\s*nacional\b/i.test(rawLeague) && (country.includes('guatemala') || /\bguatemala\b/i.test(combined) || /\((?:gua|gtm)\)/i.test(teams))) return true;
    const isGuatemala = country.includes('guatemala') || /\bguatemala\b/i.test(rawLeague) || /\((?:gua|gtm)\)/i.test(teams);
    if (isGuatemala && /\b(?:liga\s*nacional|clausura|apertura)\b/i.test(rawLeague)) return true;
    return false;
};

export const checkIsItalyPrimavera2Match = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${rawLeague} ${teams}`;

    // Strictly exclude Primavera 1 or other Primavera cups if they don't specify 2
    if (/\bprimavera\s*1\b/i.test(rawLeague)) return false;

    // Direct matches: "Italy: Campionato Primavera - 2", "Italy: Campionato Primavera 2", "Campionato Primavera 2"
    if (/\bitaly\s*:\s*campionato\s*primavera\s*(?:-\s*)?2\b/i.test(combined)) return true;
    if (/\bcampionato\s*primavera\s*(?:-\s*)?2\b/i.test(rawLeague)) return true;
    if (/\bprimavera\s*2\b/i.test(rawLeague)) return true;

    const isItalyContext = country.includes('italy') || /\b(?:italy|italian|italia)\b/i.test(rawLeague) || /\((?:ita|italy)\)/i.test(teams);
    if (isItalyContext && /\bprimavera\s*(?:-\s*)?2\b/i.test(rawLeague)) {
        return true;
    }
    return false;
};

export const checkIsBulgariaCupMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${rawLeague} ${teams}`;

    if (/\bbulgaria\s*:\s*cup\b/i.test(combined)) return true;
    if (/\bbulgarian\s*cup\b/i.test(combined)) return true;
    if (/\bkupa\s*na\s*b[aä]lgariya\b/i.test(combined)) return true;

    const isBulgariaContext = country.includes('bulgaria') || /\b(?:bulgaria|bulgarian|b[aä]lgariya)\b/i.test(rawLeague) || /\((?:bul|bgr)\)/i.test(teams);
    if (isBulgariaContext && /\bcup\b/i.test(rawLeague)) {
        return true;
    }
    return false;
};

export const checkIsSwedenDivision2Match = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${rawLeague} ${teams}`;

    if (/\bsweden\s*:\s*division\s*2\b/i.test(combined)) return true;
    if (/\bdivision\s*2\s*-\s*(?:norra|s[oö]dra|v[aä]stra)?\s*(?:svealand|g[oö]taland|norrland)\b/i.test(combined)) return true;
    if (/\bdiv(?:ision)?\s*2\s*(?:norra|s[oö]dra|v[aä]stra)?\s*(?:svealand|g[oö]taland|norrland)\b/i.test(combined)) return true;

    const isSwedenContext = country.includes('sweden') || country.includes('sverige') || /\b(?:sweden|sverige)\b/i.test(rawLeague) || /\((?:swe|sweden)\)/i.test(teams);
    if (isSwedenContext && /\bdivision\s*2\b/i.test(rawLeague)) {
        return true;
    }
    return false;
};

export const checkIsElSalvadorLeaguesMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${rawLeague} ${teams}`;

    if (/\bel\s*salvador\s*:\s*leagues?\b/i.test(combined)) return true;
    if (country.includes('el salvador') || country.includes('salvador')) return true;
    if (/\b(?:el\s*salvador|salvadorean|salvadore[ñn]o)\b/i.test(rawLeague)) return true;
    if (/\((?:slv|esa)\)/i.test(teams)) return true;

    const elSalvadorTeams = /\b(?:c\.?d\.?\s*fas|fas\b|alianza\s*fc|alianza\b|aguila|luis\s*angel\s*firpo|firpo|isidro\s*metapan|metapan|municipal\s*limeno|11\s*deportivo|fuerte\s*san\s*francisco|platense\s*zacatecoluca|drag[oó]n|santa\s*tecla|chalatenango|sonsonate)\b/i;
    if (elSalvadorTeams.test(teams) && !/\b(?:champions\s*league|concacaf)\b/i.test(rawLeague)) {
        return true;
    }
    return false;
};

export const checkIsPhilippinesMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${rawLeague} ${teams}`;

    if (country.includes('philippines') || country.includes('pilipinas')) return true;
    if (/\b(?:philippines?|filipino|pfl|philippine\s*football\s*league)\b/i.test(rawLeague)) return true;
    if (/\((?:phi|phl)\)/i.test(teams)) return true;

    const philippineClubs = /\b(?:kaya\s*fc|united\s*city|dynamic\s*herb\s*cebu|stallion\s*laguna|mendiola|maharlika|loyola|davao\s*aguilas|taguig\s*fc|tuloy\s*fc)\b/i;
    if (philippineClubs.test(teams) && !/\b(?:afc\s*champions|afc\s*cup)\b/i.test(rawLeague)) {
        return true;
    }
    return false;
};

export const checkIsSpainTerceraDivisionMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const translatedLeague = normalizeAndTranslateLeague(rawLeague);
    const combined = `${rawLeague} ${translatedLeague} ${teams}`;

    if (/\bspain\s*:\s*tercera\s*(?:divisi[oó]n|division|federaci[oó]n|federacion|rfef)\b/i.test(combined)) return true;
    if (/\btercera\s*(?:divisi[oó]n|division|federaci[oó]n|federacion|rfef)\b/i.test(combined)) return true;
    if (/\b3[ªa]\s*(?:rfef|federaci[oó]n|division|divisi[oó]n)\b/i.test(combined)) return true;

    const isSpainContext = country.includes('spain') || country.includes('españa') || country.includes('espana') ||
        /\b(?:spain|spanish|espa[ñn]a)\b/i.test(rawLeague) || /\((?:esp|spain)\)/i.test(teams);
    if (isSpainContext && /\btercera\b/i.test(combined)) {
        return true;
    }
    return false;
};

export const checkIsChileMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    if (country.includes('chile') || country.includes('chileno')) return true;
    if (/\bchile\s*:\s*/i.test(rawLeague)) return true;
    if (/\b(?:chile|chilean|campeonato\s*nacional\s*chile|copa\s*chile)\b/i.test(rawLeague)) return true;
    if (/\((?:chi|chile)\)/i.test(teams)) return true;

    const chileClubs = /\b(?:colo[- ]colo|universidad\s*de\s*chile|universidad\s*catolica|cobreloa|union\s*espanola|audax\s*italiano|palestino|everton\s*de\s*vina|o'?higgins|huachipato|coquimbo\s*unido|deportes\s*iquique|cobresal|nublense|deportes\s*copiapo|curico\s*unido|magallanes|santiago\s*wanderers|deportes\s*la\s*serena|rangers\s*de\s*talca|san\s*luis\s*de\s*quillota|union\s*san\s*felipe|barnechea|deportes\s*antofagasta|deportes\s*temuco|deportes\s*recoleta|deportes\s*santa\s*cruz|universidad\s*de\s*concepcion)\b/i;
    if (chileClubs.test(teams) && !/\b(?:libertadores|sudamericana)\b/i.test(rawLeague)) {
        return true;
    }
    return false;
};

export const checkIsSaudiArabiaDivision1Match = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${rawLeague} ${teams}`;

    if (/\bsaudi\s*arabia\s*:\s*division\s*1\b/i.test(combined)) return true;
    if (/\byelo\s*league\b/i.test(combined)) return true;
    if (/\bsaudi\s*first\s*division\b/i.test(combined)) return true;

    const isSaudiContext = country.includes('saudi') || /\b(?:saudi|saudi\s*arabia)\b/i.test(rawLeague) || /\((?:ksa|sau)\)/i.test(teams);
    if (isSaudiContext && /\b(?:division\s*1|1st\s*division|first\s*division|yelo)\b/i.test(rawLeague)) {
        return true;
    }
    return false;
};

export const checkIsLatviaMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    if (country.includes('latvia') || country.includes('latvija')) return true;
    if (/\blatvia\s*:\s*/i.test(rawLeague)) return true;
    if (/\b(?:latvia|latvian|virsliga|1\.\s*liga\s*\(latvia\))\b/i.test(rawLeague)) return true;
    if (/\((?:lva|lat)\)/i.test(teams)) return true;

    const latviaClubs = /\b(?:riga\s*fc|rfs\b|valmiera|liepaja|daugavpils|tukums|jelgava|metta|grobi[nņ]a|auda)\b/i;
    if (latviaClubs.test(teams) && !/\b(?:champions\s*league|conference\s*league|europa\s*league)\b/i.test(rawLeague)) {
        return true;
    }
    return false;
};

export const checkIsHongKongMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    if (country.includes('hong kong') || country.includes('hongkong')) return true;
    if (/\bhong\s*kong\s*:\s*/i.test(rawLeague)) return true;
    if (/\b(?:hong\s*kong|hongkong|hk\s*premier|sapling\s*cup)\b/i.test(rawLeague)) return true;
    if (/\((?:hkg)\)/i.test(teams)) return true;

    const hkClubs = /\b(?:kitchee|eastern\s*aa|lee\s*man|southern\s*district|hong\s*kong\s*fc|tai\s*po|sham\s*shui\s*po|hk\s*rangers|north\s*district|kwoon\s*chung\s*southern)\b/i;
    if (hkClubs.test(teams) && !/\b(?:afc\s*champions|afc\s*cup)\b/i.test(rawLeague)) {
        return true;
    }
    return false;
};

export const checkIsEstoniaMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    if (country.includes('estonia') || country.includes('eesti')) return true;
    if (/\bestonia\s*:\s*/i.test(rawLeague)) return true;
    if (/\b(?:estonia|estonian|meistriliiga|premium\s*liiga|esiliiga)\b/i.test(rawLeague)) return true;
    if (/\((?:est)\)/i.test(teams)) return true;

    const estoniaClubs = /\b(?:flora\s*tallinn|levadia|nomme\s*kalju|paide\s*linnameeskond|narva\s*trans|tartu\s*tammeka|kuressaare|tallinna\s*kalev|parnu\s*vaprus|nomme\s*united)\b/i;
    if (estoniaClubs.test(teams) && !/\b(?:champions\s*league|conference\s*league|europa\s*league)\b/i.test(rawLeague)) {
        return true;
    }
    return false;
};

export const checkIsCostaRicaMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    if (country.includes('costa rica') || country.includes('costarica')) return true;
    if (/\bcosta\s*rica\s*:\s*/i.test(rawLeague)) return true;
    if (/\b(?:costa\s*rica|costarican|costarricense|primera\s*divisi[oó]n\s*\(costa\s*rica\)|liga\s*promerica)\b/i.test(rawLeague)) return true;
    if (/\((?:crc)\)/i.test(teams)) return true;

    const costaRicaClubs = /\b(?:saprissa|alajuelense|herediano|cartagines|san\s*carlos|sporting\s*san\s*jose|puntarenas|perez\s*zeledon|santos\s*de\s*guapiles|guanacasteca|liberia|santa\s*ana)\b/i;
    if (costaRicaClubs.test(teams) && !/\b(?:concacaf|central\s*american\s*cup)\b/i.test(rawLeague)) {
        return true;
    }
    return false;
};

export const checkIsItalySerieCMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${rawLeague} ${teams}`;

    // Exclude Serie A and Serie B
    if (/\bserie\s*[abd]\b/i.test(rawLeague) && !/\bserie\s*c\b/i.test(rawLeague)) return false;

    if (/\bitaly\s*:\s*serie\s*c\b/i.test(combined)) return true;
    if (/\bserie\s*c\s*-\s*girone\s*[abc]\b/i.test(combined)) return true;
    if (/\bserie\s*c\b/i.test(rawLeague)) return true;
    if (/\blega\s*pro\b/i.test(combined)) return true;

    const isItalyContext = country.includes('italy') || country.includes('italia') || /\b(?:italy|italian)\b/i.test(rawLeague) || /\((?:ita)\)/i.test(teams);
    if (isItalyContext && (/\bserie\s*c\b/i.test(combined) || /\bgirone\s*[abc]\b/i.test(rawLeague))) {
        return true;
    }
    return false;
};

export const checkIsKosovoMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();

    if (country.includes('kosovo') || country.includes('kosova')) return true;
    if (/\bkosovo\s*:\s*/i.test(rawLeague)) return true;
    if (/\b(?:kosovo|kosovar|superliga\s*e\s*kosov[eë]s|liga\s*e\s*par[eë])\b/i.test(rawLeague)) return true;
    if (/\((?:kos)\)/i.test(teams)) return true;

    const kosovoClubs = /\b(?:ballkani|drita|prishtina|gjilani|llapi|malisheva|feronikeli|dukagjini|trepca|suhareka)\b/i;
    if (kosovoClubs.test(teams) && !/\b(?:champions\s*league|conference\s*league|europa\s*league)\b/i.test(rawLeague)) {
        return true;
    }
    return false;
};

export const checkIsSwedenSuperettanMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${rawLeague} ${teams}`;

    if (/\bsweden\s*:\s*superettan\b/i.test(combined)) return true;
    if (/\bsuperettan\b/i.test(rawLeague)) return true;

    const isSwedenContext = country.includes('sweden') || country.includes('sverige') || /\b(?:sweden|sverige)\b/i.test(rawLeague) || /\((?:swe|sweden)\)/i.test(teams);
    if (isSwedenContext && /\bsuperettan\b/i.test(combined)) {
        return true;
    }
    return false;
};

export const checkIsNorway3rdDivisionGirone1Match = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    const isNorway = country.includes('norway') || country.includes('norge') || /\b(?:norway|norwegian|norge)\b/i.test(rawLeague) || /\((?:nor)\)/i.test(teams);
    if (!isNorway && !/\bnorway\b/i.test(combined)) return false;

    const is3rdDiv = /\b(?:3rd\s*division|3\.\s*division|3\.\s*divisjon|division\s*3|div\s*3|3\s*divisjon)\b/i.test(combined);
    const isGirone1 = /\b(?:girone\s*1|group\s*1|avdeling\s*1)\b/i.test(combined);

    return is3rdDiv && isGirone1;
};

export const checkIsNetherlandsEersteDivisieMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    if (/\b(?:eerste\s*divisie|keuken\s*kampioen\s*divisie)\b/i.test(rawLeague)) return true;
    if (/\bnetherlands\s*:\s*eerste\s*divisie\b/i.test(combined)) return true;

    const isDutchContext = country.includes('netherlands') || country.includes('holland') || /\b(?:netherlands|dutch|holland)\b/i.test(rawLeague) || /\((?:ned|hol)\)/i.test(teams);
    if (isDutchContext && /\b(?:eerste|divisie\s*2|division\s*2|tier\s*2)\b/i.test(rawLeague)) return true;

    return false;
};

export const checkIsArgentinaPrimeraAMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    // Exclude reserva, proyeccion, B, C, D, Copa Argentina
    if (/\b(?:res\.|reserva|proyecci[oó]n|primera\s*[b-d]|nacional|copa\s*argentina)\b/i.test(combined)) return false;

    if (/\bargentina\s*:\s*primera\s*a\b/i.test(combined)) return true;

    const isArgContext = country.includes('argentina') || /\b(?:argentina|argentine)\b/i.test(rawLeague) || /\((?:arg|argentina)\)/i.test(teams);
    if (isArgContext && /\b(?:primera\s*a|primera\s*divisi[oó]n|liga\s*profesional|torneo\s*betano)\b/i.test(rawLeague)) return true;

    return false;
};

export const checkIsArgentinaNoLeagueMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').trim().toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').trim().toLowerCase();

    const isArg = country === 'argentina' || country.startsWith('argentina') || /\bargentina\b/i.test(country);
    if (!isArg) return false;

    // No league, or league is literally empty, '-', 'n/a', or just 'argentina'
    if (!rawLeague || rawLeague === 'argentina' || rawLeague === '-' || rawLeague === 'n/a' || rawLeague === 'unknown') return true;

    return false;
};

export const checkIsDenmarkSuperligaMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    if (/\bdenmark\s*:\s*superliga\b/i.test(combined)) return true;

    const isDenmarkContext = country.includes('denmark') || country.includes('danmark') || /\b(?:denmark|danish|danmark)\b/i.test(rawLeague) || /\((?:den|dnk)\)/i.test(teams);
    if (isDenmarkContext && /\bsuperliga\b/i.test(rawLeague) && !/\b(?:u21|u19|women|kvinde)\b/i.test(rawLeague)) {
        return true;
    }
    return false;
};

export const checkIsColombiaPrimeraBMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    if (/\bcolombia\s*:\s*primera\s*b\b/i.test(combined)) return true;
    if (/\btorneo\s*betplay\b/i.test(combined) && !/\bliga\s*betplay\b/i.test(combined)) return true;

    const isColombiaContext = country.includes('colombia') || /\bcolombia\b/i.test(rawLeague) || /\((?:col|colombia)\)/i.test(teams);
    if (isColombiaContext && /\b(?:primera\s*b|torneo\s*betplay|segunda)\b/i.test(rawLeague)) return true;

    return false;
};

export const checkIsPanamaLigaPanamenaMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    if (/\bpanama\s*:\s*liga\s*paname[ñn]a\b/i.test(combined)) return true;
    if (/\blpf\b/i.test(rawLeague) && (country.includes('panama') || /\bpanama\b/i.test(combined))) return true;

    const isPanamaContext = country.includes('panama') || country.includes('panamá') || /\b(?:panama|panam[aá])\b/i.test(rawLeague) || /\((?:pan|panama)\)/i.test(teams);
    if (isPanamaContext && (/\b(?:liga\s*paname[ñn]a|lpf|clausura|apertura)\b/i.test(rawLeague) || !rawLeague)) return true;

    return false;
};

export const checkIsGeorgiaErovnuliLigaMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    if (/\bgeorgia\s*:\s*erovnuli\s*liga\b/i.test(combined)) return true;
    if (/\berovnuli\s*liga\b/i.test(rawLeague)) return true;

    const isGeorgiaContext = country.includes('georgia') || /\bgeorgia\b/i.test(rawLeague) || /\((?:geo)\)/i.test(teams);
    if (isGeorgiaContext && (/\b(?:erovnuli|crystalbet\s*erovnuli|liga\s*1)\b/i.test(rawLeague) || !rawLeague)) return true;

    return false;
};

export const checkIsUzbekistanProLeagueAMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    if (/\buzbekistan\s*:\s*pro\s*league(?:\s*a)?\b/i.test(combined)) return true;
    if (/\b(?:pro\s*league\s*a|o['’`]?zbekiston\s*pro\s*ligasi)\b/i.test(rawLeague)) return true;

    const isUzbekContext = country.includes('uzbekistan') || /\buzbekistan\b/i.test(rawLeague) || /\((?:uzb|uzbekistan)\)/i.test(teams);
    if (isUzbekContext && /\bpro\s*league\b/i.test(rawLeague) && !/\bsuper\s*league\b/i.test(rawLeague)) {
        return true;
    }
    return false;
};

export const checkIsIsraelLigaLeumitMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    if (/\bisrael\s*:\s*liga\s*leumit\b/i.test(combined)) return true;
    if (/\bliga\s*leumit\b/i.test(rawLeague)) return true;

    const isIsraelContext = country.includes('israel') || /\b(?:israel|israeli)\b/i.test(rawLeague) || /\((?:isr)\)/i.test(teams);
    if (isIsraelContext && /\bleumit\b/i.test(rawLeague)) return true;

    return false;
};

export const checkIsEgyptSecondLeagueMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    if (/\begypt\s*:\s*second\s*league\b/i.test(combined)) return true;
    if (/\bsecond\s*league\s*(?:a|b)?\b/i.test(rawLeague) && (country.includes('egypt') || /\b(?:egypt|egyptian)\b/i.test(rawLeague + ' ' + teams) || /\((?:egy)\)/i.test(teams))) {
        return true;
    }
    if (/\begypt.*second\s*league\b/i.test(combined) || /\begyptian.*second\s*league\b/i.test(combined)) {
        return true;
    }
    return false;
};

export const checkIsBulgariaSecondLeagueMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    if (/\bbulgaria\s*:\s*second\s*league\b/i.test(combined)) return true;
    if (/\b(?:vtora\s*liga|second\s*league|second\s*prof\.\s*league)\b/i.test(rawLeague) && (country.includes('bulgaria') || /\b(?:bulgaria|bulgarian|b[aä]lgariya)\b/i.test(rawLeague + ' ' + teams) || /\((?:bul|bgr)\)/i.test(teams))) {
        return true;
    }
    if (/\bbulgaria.*second\s*league\b/i.test(combined) || /\bbulgarian.*second\s*league\b/i.test(combined)) {
        return true;
    }
    return false;
};

export const checkIsWalesMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    if (country === 'wales' || country.includes('wales') || country.includes('cymru')) return true;
    if (/\b(?:wales|welsh|cymru)\b/i.test(rawLeague)) return true;
    if (/\((?:wal|cym)\)/i.test(teams)) return true;
    return false;
};

export const checkIsSouthAfrica1stDivisionMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    if (/\bsouth\s*africa\s*:\s*1st\s*division\b/i.test(combined)) return true;
    if (/\b(?:1st\s*division|first\s*division|motsepe\s*foundation|nfd)\b/i.test(rawLeague) && (country.includes('south africa') || /\bsouth\s*africa\b/i.test(rawLeague + ' ' + teams) || /\((?:rsa)\)/i.test(teams))) {
        return true;
    }
    if (/\bsouth\s*africa.*(?:1st|first)\s*division\b/i.test(combined)) return true;
    return false;
};

export const checkIsPolandILigaMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    // Exclude II Liga, III Liga, Ekstraklasa, Cup
    if (/\b(?:ii\s*liga|iii\s*liga|2\.\s*liga|3\.\s*liga|ekstraklasa|puchar)\b/i.test(rawLeague)) return false;

    if (/\bpoland\s*:\s*i\s*liga\b/i.test(combined)) return true;
    if (/\b(?:1\.\s*liga|i\s*liga|betclic\s*1\.\s*liga|pierwsza\s*liga)\b/i.test(rawLeague) && (country.includes('poland') || /\b(?:poland|polish|polska)\b/i.test(rawLeague + ' ' + teams) || /\((?:pol)\)/i.test(teams))) {
        return true;
    }
    if (/\bpoland.*(?:i|1\.)\s*liga\b/i.test(combined) || /\bpolish.*(?:i|1\.)\s*liga\b/i.test(combined)) {
        return true;
    }
    return false;
};

export const checkIsTanzaniaLigiKuuBaraMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    if (/\btanzania\s*:\s*ligi\s*kuu\s*bara\b/i.test(combined)) return true;
    if (/\bligi\s*kuu\s*bara\b/i.test(rawLeague)) return true;
    const isTanzanianContext = country.includes('tanzania') || /\btanzania\b/i.test(rawLeague + ' ' + teams) || /\((?:tan|tza)\)/i.test(teams);
    if (isTanzanianContext && /\b(?:ligi\s*kuu|premier\s*league)\b/i.test(rawLeague)) {
        return true;
    }
    return false;
};

export const checkIsUzbekistanSuperLeagueMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    if (/\buzbekistan\s*:\s*super\s*league\b/i.test(combined)) return true;
    if (/\b(?:super\s*league|o['’`]?zbekiston\s*superligasi)\b/i.test(rawLeague) && (country.includes('uzbekistan') || /\buzbekistan\b/i.test(rawLeague + ' ' + teams) || /\((?:uzb)\)/i.test(teams))) {
        return true;
    }
    return false;
};

export const checkIsArgentinaCountryOnlyMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').trim().toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').trim().toLowerCase();
    if (country === 'argentina' && (!rawLeague || rawLeague === 'argentina' || rawLeague === '-' || rawLeague === 'n/a' || rawLeague === 'unknown')) {
        return true;
    }
    if (!country && rawLeague === 'argentina') return true;
    return false;
};

export const checkIsFranceCountryOnlyMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').trim().toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').trim().toLowerCase();
    if (country === 'france' && (!rawLeague || rawLeague === 'france' || rawLeague === '-' || rawLeague === 'n/a' || rawLeague === 'unknown')) {
        return true;
    }
    if (!country && rawLeague === 'france') return true;
    return false;
};

export const checkIsSpainCountryOnlyMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').trim().toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').trim().toLowerCase();
    if (country === 'spain' && (!rawLeague || rawLeague === 'spain' || rawLeague === '-' || rawLeague === 'n/a' || rawLeague === 'unknown')) {
        return true;
    }
    if (!country && rawLeague === 'spain') return true;
    return false;
};

export const checkIsAustraliaMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').trim().toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').trim().toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    if (country === 'australia' || country.includes('australia')) return true;
    if (/\b(?:australia|australian|a-league)\b/i.test(rawLeague)) return true;
    if (/\((?:aus|australia)\)/i.test(teams)) return true;
    return false;
};

export const checkIsIsraelLigaAlefMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    if (/\bisrael\s*:\s*liga\s*alef\b/i.test(combined)) return true;
    if (/\bliga\s*alef\b/i.test(rawLeague)) return true;
    const isIsraelContext = country.includes('israel') || /\b(?:israel|israeli)\b/i.test(rawLeague) || /\((?:isr)\)/i.test(teams);
    if (isIsraelContext && /\balef\b/i.test(rawLeague)) return true;
    return false;
};

export const checkIsRussiaPremierLeagueMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    if (/\b(?:youth|u21|u19|second\s*league|fnl|cup|women)\b/i.test(rawLeague + ' ' + teams)) return false;
    if (/\brussia\s*:\s*premier\s*league\b/i.test(combined)) return true;
    const isRussiaContext = country.includes('russia') || /\brussia\b/i.test(rawLeague) || /\((?:rus)\)/i.test(teams);
    if (isRussiaContext && /\bpremier\s*league\b/i.test(rawLeague)) return true;
    return false;
};

export const checkIsKenyaFkfPremierLeagueMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    if (/\bkenya\s*:\s*(?:fkf\s*)?premier\s*league\b/i.test(combined)) return true;
    if (/\bfkf\s*premier\s*league\b/i.test(rawLeague)) return true;
    const isKenyaContext = country.includes('kenya') || /\b(?:kenya|kenyan)\b/i.test(rawLeague) || /\((?:ken)\)/i.test(teams);
    if (isKenyaContext && /\b(?:fkf|premier\s*league)\b/i.test(rawLeague)) return true;
    return false;
};

export const checkIsNorway3rdDivisionGirone4Match = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    if (/\bnorway\s*:\s*3\.\s*division\s*-\s*(?:girone|group|avdeling)\s*4\b/i.test(combined)) return true;
    const isNorwayContext = country.includes('norway') || country.includes('norge') || /\b(?:norway|norwegian|norge)\b/i.test(rawLeague + ' ' + teams) || /\((?:nor)\)/i.test(teams);
    if (isNorwayContext && /\b(?:3\.\s*division|3rd\s*division|3\.\s*divisjon)\b/i.test(rawLeague) && /\b(?:girone|group|avdeling)\s*4\b/i.test(rawLeague)) {
        return true;
    }
    return false;
};

export const checkIsRussiaYouthChampionshipMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    if (/\brussia\s*:\s*youth\s*(?:championship|league)\b/i.test(combined)) return true;
    const isRussiaContext = country.includes('russia') || /\b(?:russia|russian)\b/i.test(rawLeague + ' ' + teams) || /\((?:rus)\)/i.test(teams);
    if (isRussiaContext && /\byouth\s*(?:championship|league)\b/i.test(rawLeague)) return true;
    return false;
};

export const checkIsAustriaRegionalligaWestMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    if (/\baustria\s*:\s*regionalliga\s*(?:-\s*)?west\b/i.test(combined)) return true;
    const isAustriaContext = country.includes('austria') || country.includes('österreich') || /\b(?:austria|austrian|[oö]sterreich)\b/i.test(rawLeague + ' ' + teams) || /\((?:aut)\)/i.test(teams);
    if (isAustriaContext && /\bregionalliga\s*(?:-\s*)?west\b/i.test(rawLeague)) return true;
    return false;
};

export const checkIsIrelandPremierDivisionMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    // Strictly exclude Northern Ireland
    if (/\bnorthern\s*ireland\b/i.test(combined)) return false;

    if (/\b(?:republic\s*of\s*)?ireland\s*:\s*premier\s*division\b/i.test(combined)) return true;
    const isIrelandContext = country === 'ireland' || country === 'republic of ireland' || /\b(?:ireland|irish)\b/i.test(rawLeague) || /\((?:irl)\)/i.test(teams);
    if (isIrelandContext && /\bpremier\s*division\b/i.test(rawLeague)) return true;
    return false;
};

export const checkIsIranPersianGulfProLeagueMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    // Exclude Hazfi Cup, Azadegan League / Division 1
    if (/\b(?:hazfi\s*cup|azadegan|division\s*1|league\s*1|league\s*2)\b/i.test(combined)) return false;

    if (/\biran\s*:\s*persian\s*gulf\s*(?:pro\s*)?league\b/i.test(combined)) return true;
    if (/\bpersian\s*gulf\s*(?:pro\s*)?league\b/i.test(rawLeague)) return true;

    const isIranContext = country.includes('iran') || /\biran\b/i.test(rawLeague) || /\((?:irn|iran)\)/i.test(teams);
    if (isIranContext && /\b(?:persian\s*gulf|pro\s*league|premier\s*league)\b/i.test(rawLeague)) return true;

    return false;
};

export const checkIsCostaRicaLigaDeAscensoMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    if (/\bcosta\s*rica\s*:\s*liga\s*de\s*ascenso\b/i.test(combined)) return true;
    if (/\bliga\s*de\s*ascenso\b/i.test(rawLeague)) return true;

    const isCostaRicaContext = country.includes('costa rica') || /\bcosta\s*rica\b/i.test(rawLeague) || /\((?:crc|costa rica)\)/i.test(teams);
    if (isCostaRicaContext && /\b(?:liga\s*de\s*ascenso|ascenso|segunda\s*divisi[oó]n)\b/i.test(rawLeague)) return true;

    return false;
};

export const checkIsSaudiArabiaProLeagueMatch = (match: Match): boolean => {
    const country = (match.country || (match as any).data?.country || '').toLowerCase();
    const rawLeague = (match.league || (match as any).data?.league || '').toLowerCase();
    const teams = (match.teams || (match as any).data?.teams || '').toLowerCase();
    const combined = `${country} ${rawLeague} ${teams}`;

    // Exclude Division 1, Division 2, King Cup
    if (/\b(?:division\s*1|1\.\s*division|division\s*2|king['’]?s\s*cup)\b/i.test(combined)) return false;

    if (/\bsaudi\s*arabia\s*:\s*pro\s*league\b/i.test(combined)) return true;
    if (/\b(?:saudi\s*pro\s*league|roshn\s*saudi\s*league)\b/i.test(combined)) return true;

    const isSaudiContext = country.includes('saudi') || /\bsaudi\b/i.test(rawLeague) || /\((?:ksa|sau)\)/i.test(teams);
    if (isSaudiContext && /\b(?:pro\s*league|premier\s*league|roshn)\b/i.test(rawLeague)) return true;

    return false;
};

export interface MatchEvaluationStats {
    isFranceLigue3Match: boolean;
    isSpainPrimeraWomenMatch: boolean;
    isEnglandNonLeaguePremierMatch: boolean;
    isItalyPrimavera2Match: boolean;
    isBulgariaCupMatch: boolean;
    isSwedenDivision2Match: boolean;
    isElSalvadorLeaguesMatch: boolean;
    isPhilippinesMatch: boolean;
    isSpainTerceraDivisionMatch: boolean;
    isChileMatch: boolean;
    isSaudiArabiaDivision1Match: boolean;
    isLatviaMatch: boolean;
    isHongKongMatch: boolean;
    isEstoniaMatch: boolean;
    isCostaRicaMatch: boolean;
    isItalySerieCMatch: boolean;
    isKosovoMatch: boolean;
    isSwedenSuperettanMatch: boolean;
    isEnglandLeagueTwoMatch: boolean;
    isEnglandNonLeaguePremierSouthernSouthMatch: boolean;
    isEnglandNonLeaguePremierSouthernCentralMatch: boolean;
    isEnglandNonLeaguePremierIsthmianMatch: boolean;
    isBangladeshMatch: boolean;
    isParaguayDivisionIntermediaMatch: boolean;
    isGuatemalaLigaNacionalMatch: boolean;
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
    drawPoints: number;
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
    isVietnamMatch: boolean;
    isEgyptianMatch: boolean;
    isRomaniaLiga2Match: boolean;
    isIraqMatch: boolean;
    isArgentinaPrimeraLPFMatch: boolean;
    isColombiaPrimeraAMatch: boolean;
    isSwitzerlandChallengeLeagueMatch: boolean;
    isCzechRepublicNflMatch: boolean;
    isKazakhstanMatch: boolean;
    isNorthernIrelandMatch: boolean;
    isBolivianMatch: boolean;
    isBig5LeagueMatch: boolean;
    isEuropeanChasersMatch: boolean;
    isNonEuropeanMajorLeagueMatch: boolean;
    isUefaEflMatch: boolean;
    isTournamentMatch: boolean;
    isCarabaoCupMatch: boolean;
    isUsaUslChampionshipMatch: boolean;
    isChileSegundaDivisionMatch: boolean;
    isHungaryMatch: boolean;
    isEnglandAmateurNationalLeagueMatch: boolean;
    isUkraineMatch: boolean;
    isThailandMatch: boolean;
    isHungaryNbiMatch: boolean;
    isThaiLeague1Match: boolean;
    isCzech4LigaDivizieFMatch: boolean;
    isSpainPrimeraRfefGroup2Match: boolean;
    isItalySerieDMatch: boolean;
    isItalySerieDGironeBMatch: boolean;
    isQatarSecondDivisionMatch: boolean;
    isArgentinaTorneoProyeccionMatch: boolean;
    isSlovenia1SnlMatch: boolean;
    isSwedenDivision2NorraSvealandMatch: boolean;
    isCzechLigaMatch: boolean;
    isVietnamVLeague2Match: boolean;
    isPortugalCampeonatoGroupCMatch: boolean;
    isTurkey1LigMatch: boolean;
    isSpainSegundaDivisionMatch: boolean;
    isTurkeySuperLigMatch: boolean;
    isNorway3rdDivisionGirone1Match: boolean;
    isNetherlandsEersteDivisieMatch: boolean;
    isArgentinaPrimeraAMatch: boolean;
    isArgentinaNoLeagueMatch: boolean;
    isDenmarkSuperligaMatch: boolean;
    isColombiaPrimeraBMatch: boolean;
    isPanamaLigaPanamenaMatch: boolean;
    isGeorgiaErovnuliLigaMatch: boolean;
    isUzbekistanProLeagueAMatch: boolean;
    isIsraelLigaLeumitMatch: boolean;
    isIranPersianGulfProLeagueMatch: boolean;
    isCostaRicaLigaDeAscensoMatch: boolean;
    isSaudiArabiaProLeagueMatch: boolean;
    isRussiaCupMatch: boolean;
    isAfcChampionsLeagueEliteMatch: boolean;
    isCzechRepublicMatch: boolean;
    isNicaraguaPrimeraDivisionMatch: boolean;
    isAfcChampionsLeagueTwoMatch: boolean;
    isRussiaSecondLeagueMatch: boolean;
    isConmebolLibertadoresMatch: boolean;
    isSloveniaMatch: boolean;
    isIrelandMatch: boolean;
    isIcelandMatch: boolean;
    isEgyptSecondLeagueMatch: boolean;
    isBulgariaSecondLeagueMatch: boolean;
    isWalesMatch: boolean;
    isSouthAfrica1stDivisionMatch: boolean;
    isPolandILigaMatch: boolean;
    isTanzaniaLigiKuuBaraMatch: boolean;
    isUzbekistanSuperLeagueMatch: boolean;
    isMfavHome: boolean;
    isBrazilSerieBMatch: boolean;
    isBelgiumReserveProLeagueMatch: boolean;
    isSlovakiaMatch: boolean;
    isItalySerieBMatch: boolean;
    mFavL10: number;
    underdogL10: number;
    hasValidL10: boolean;
    underdogHasHigherL10: boolean;
    isL10Close: boolean;
    isL10Equal: boolean;
    mFavL10WinsDraws: number;
    underdogL10WinsDraws: number;
    isL10WinsDrawsEqual: boolean;
    isL10WinsDrawsMfavGreater: boolean;
    isL10WinsDrawsUndGreater: boolean;
    is1X2SupportsUnderdog: boolean;
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
    phaStatsMap: Record<string, any> = {},
    categoryId: string = 'best_bet'
): MatchEvaluationStats {
    let evalCategoryId = categoryId;
    if (categoryId === 'safety') evalCategoryId = 'best_bet';
    else if (categoryId === 'banker') evalCategoryId = 'bankers_dlive';
    else if (categoryId === 'jackpot') evalCategoryId = 'bankers_jackpot';
    else if (['top12', 'top10', 'top_12', 'top_12_value', 'top_10_value', 'sandbox_top_12_value', 'sandbox_top_10_value'].includes(categoryId)) {
        evalCategoryId = 'top_12_value';
    }
    else if (categoryId === 'botb_best' || categoryId === 'high_confidence') {
        const srcCat = (match as any).sourceCategory;
        if (srcCat && srcCat !== 'botb_best' && srcCat !== 'high_confidence' && srcCat !== 'top20') {
            evalCategoryId = srcCat === 'top_10_value' ? 'top_12_value' : srcCat;
        } else {
            const tags = match.evaluatorTags || [];
            if (tags.some(t => t.startsWith('top12:') || t.startsWith('top10:'))) evalCategoryId = 'top_12_value';
            else if (tags.some(t => t.startsWith('bankers_dlive:'))) evalCategoryId = 'bankers_dlive';
            else if (tags.some(t => t.startsWith('bankers_jackpot:'))) evalCategoryId = 'bankers_jackpot';
            else if (tags.some(t => t.startsWith('value_picks:'))) evalCategoryId = 'value_picks';
            else evalCategoryId = 'best_bet';
        }
    }

    const mFav = getMarketFavorite(match);
    const underdog = mFav === '1' ? '2' : '1';

    let mlInfo = match.mlInfo;
    if (!mlInfo && !(match as any)._isEvaluatingMl && !(match as any)._isEvaluatingOpwInMl) {
        try {
            (match as any)._isEvaluatingMl = true;
            mlInfo = predictWithHybridML(match);
        } catch (e) {} finally {
            delete (match as any)._isEvaluatingMl;
        }
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

    const mFavPoints = mFav === '1' ? (match.totalPoints?.home || (match as any).data?.totalPoints?.home || 0) : (match.totalPoints?.away || (match as any).data?.totalPoints?.away || 0);
    const udPoints = underdog === '1' ? (match.totalPoints?.home || (match as any).data?.totalPoints?.home || 0) : (match.totalPoints?.away || (match as any).data?.totalPoints?.away || 0);
    const drawPoints = match.totalPoints?.draw || (match as any).data?.totalPoints?.draw || 0;

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
    const pha = (subPatternStr && phaStatsMap) ? phaStatsMap[subPatternStr] : null;
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

    const subPred = match.patternAnalysis?.subPatternPrediction || (match as any).subPatternPrediction || (match as any).subPrediction || '';
    const subPrimPred = match.patternAnalysis?.primaryPrediction || (match as any).subPrimaryPrediction || (match as any).subPrimPrediction || '';

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

    const moParts = (match.mo || (match as any).odds || (match as any).data?.mo || (match as any).data?.odds || '').split(/[- ,]+/).map(s => parseFloat(s.replace(/[^0-9.]/g, '').trim())).filter(p => !isNaN(p));
    const o1 = moParts[0] || (match.homeOdds ? parseFloat(String(match.homeOdds).replace(/[^0-9.]/g, '')) : 0);
    const oX = moParts[1] || (match.drawOdds ? parseFloat(String(match.drawOdds).replace(/[^0-9.]/g, '')) : 0);
    const o2 = (moParts.length >= 3 ? moParts[2] : (moParts.length === 2 ? moParts[1] : 0)) || (match.awayOdds ? parseFloat(String(match.awayOdds).replace(/[^0-9.]/g, '')) : 0);
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
    const isVietnamMatch = checkIsVietnamMatch(match);
    const isEgyptianMatch = checkIsEgyptianMatch(match);
    const isRomaniaLiga2Match = checkIsRomaniaLiga2Match(match);
    const isIraqMatch = checkIsIraqMatch(match);
    const isArgentinaPrimeraLPFMatch = checkIsArgentinaPrimeraLPFMatch(match);
    const isColombiaPrimeraAMatch = checkIsColombiaPrimeraAMatch(match);
    const isSwitzerlandChallengeLeagueMatch = checkIsSwitzerlandChallengeLeagueMatch(match);
    const isCzechRepublicNflMatch = checkIsCzechRepublicNflMatch(match);
    const isKazakhstanMatch = checkIsKazakhstanMatch(match);
    const isNorthernIrelandMatch = checkIsNorthernIrelandMatch(match);
    const isBolivianMatch = checkIsBolivianMatch(match);
    const isBig5LeagueMatch = checkIsBig5LeagueMatch(match);
    const isEuropeanChasersMatch = checkIsEuropeanChasersMatch(match);
    const isNonEuropeanMajorLeagueMatch = checkIsNonEuropeanMajorLeagueMatch(match);
    const isUefaEflMatch = checkIsUefaEflMatch(match);
    const isTournamentMatch = checkIsMajorTournamentMatch(match);
    const isCarabaoCupMatch = checkIsCarabaoCupMatch(match);
    const isUsaUslChampionshipMatch = checkIsUsaUslChampionshipMatch(match);
    const isChileSegundaDivisionMatch = checkIsChileSegundaDivisionMatch(match);
    const isHungaryMatch = checkIsHungaryMatch(match);
    const isEnglandAmateurNationalLeagueMatch = checkIsEnglandAmateurNationalLeagueMatch(match);
    const isUkraineMatch = checkIsUkraineMatch(match);
    const isThailandMatch = checkIsThailandMatch(match);
    const isHungaryNbiMatch = checkIsHungaryNbiMatch(match);
    const isThaiLeague1Match = checkIsThaiLeague1Match(match);
    const isCzech4LigaDivizieFMatch = checkIsCzech4LigaDivizieFMatch(match);
    const isSpainPrimeraRfefGroup2Match = checkIsSpainPrimeraRfefGroup2Match(match);
    const isItalySerieDMatch = checkIsItalySerieDMatch(match);
    const isItalySerieDGironeBMatch = checkIsItalySerieDGironeBMatch(match);
    const isQatarSecondDivisionMatch = checkIsQatarSecondDivisionMatch(match);
    const isArgentinaTorneoProyeccionMatch = checkIsArgentinaTorneoProyeccionMatch(match);
    const isSlovenia1SnlMatch = checkIsSlovenia1SnlMatch(match);
    const isSwedenDivision2NorraSvealandMatch = checkIsSwedenDivision2NorraSvealandMatch(match);
    const isCzechLigaMatch = checkIsCzechLigaMatch(match);
    const isVietnamVLeague2Match = checkIsVietnamVLeague2Match(match);
    const isPortugalCampeonatoGroupCMatch = checkIsPortugalCampeonatoGroupCMatch(match);
    const isTurkey1LigMatch = checkIsTurkey1LigMatch(match);
    const isSpainSegundaDivisionMatch = checkIsSpainSegundaDivisionMatch(match);
    const isTurkeySuperLigMatch = checkIsTurkeySuperLigMatch(match);
    const isNorway3rdDivisionGirone1Match = checkIsNorway3rdDivisionGirone1Match(match);
    const isNetherlandsEersteDivisieMatch = checkIsNetherlandsEersteDivisieMatch(match);
    const isArgentinaPrimeraAMatch = checkIsArgentinaPrimeraAMatch(match);
    const isArgentinaNoLeagueMatch = checkIsArgentinaNoLeagueMatch(match);
    const isDenmarkSuperligaMatch = checkIsDenmarkSuperligaMatch(match);
    const isColombiaPrimeraBMatch = checkIsColombiaPrimeraBMatch(match);
    const isPanamaLigaPanamenaMatch = checkIsPanamaLigaPanamenaMatch(match);
    const isGeorgiaErovnuliLigaMatch = checkIsGeorgiaErovnuliLigaMatch(match);
    const isUzbekistanProLeagueAMatch = checkIsUzbekistanProLeagueAMatch(match);
    const isIsraelLigaLeumitMatch = checkIsIsraelLigaLeumitMatch(match);
    const isIranPersianGulfProLeagueMatch = checkIsIranPersianGulfProLeagueMatch(match);
    const isCostaRicaLigaDeAscensoMatch = checkIsCostaRicaLigaDeAscensoMatch(match);
    const isSaudiArabiaProLeagueMatch = checkIsSaudiArabiaProLeagueMatch(match);
    const isRussiaCupMatch = checkIsRussiaCupMatch(match);
    const isAfcChampionsLeagueEliteMatch = checkIsAfcChampionsLeagueEliteMatch(match);
    const isCzechRepublicMatch = checkIsCzechRepublicMatch(match);
    const isNicaraguaPrimeraDivisionMatch = checkIsNicaraguaPrimeraDivisionMatch(match);
    const isAfcChampionsLeagueTwoMatch = checkIsAfcChampionsLeagueTwoMatch(match);
    const isRussiaSecondLeagueMatch = checkIsRussiaSecondLeagueMatch(match);
    const isConmebolLibertadoresMatch = checkIsConmebolLibertadoresMatch(match);
    const isSloveniaMatch = checkIsSloveniaLeagueMatch(match);
    const isIrelandMatch = checkIsIrelandLeagueMatch(match);
    const isIcelandMatch = checkIsIcelandLeagueMatch(match);
    const isEgyptSecondLeagueMatch = checkIsEgyptSecondLeagueMatch(match);
    const isBulgariaSecondLeagueMatch = checkIsBulgariaSecondLeagueMatch(match);
    const isWalesMatch = checkIsWalesMatch(match);
    const isSouthAfrica1stDivisionMatch = checkIsSouthAfrica1stDivisionMatch(match);
    const isPolandILigaMatch = checkIsPolandILigaMatch(match);
    const isTanzaniaLigiKuuBaraMatch = checkIsTanzaniaLigiKuuBaraMatch(match);
    const isUzbekistanSuperLeagueMatch = checkIsUzbekistanSuperLeagueMatch(match);
    const isMfavHome = mFav === '1';
    const isBrazilSerieBMatch = checkIsBrazilSerieBMatch(match);
    const isBelgiumReserveProLeagueMatch = checkIsBelgiumReserveProLeagueMatch(match);
    const isSlovakiaMatch = checkIsSlovakiaLeagueMatch(match);
    const isItalySerieBMatch = checkIsItalySerieBMatch(match);
    const isFranceLigue3Match = checkIsFranceLigue3Match(match);
    const isSpainPrimeraWomenMatch = checkIsSpainPrimeraWomenMatch(match);
    const isEnglandNonLeaguePremierMatch = checkIsEnglandNonLeaguePremierMatch(match);
    const isItalyPrimavera2Match = checkIsItalyPrimavera2Match(match);
    const isBulgariaCupMatch = checkIsBulgariaCupMatch(match);
    const isSwedenDivision2Match = checkIsSwedenDivision2Match(match);
    const isElSalvadorLeaguesMatch = checkIsElSalvadorLeaguesMatch(match);
    const isPhilippinesMatch = checkIsPhilippinesMatch(match);
    const isSpainTerceraDivisionMatch = checkIsSpainTerceraDivisionMatch(match);
    const isChileMatch = checkIsChileMatch(match);
    const isSaudiArabiaDivision1Match = checkIsSaudiArabiaDivision1Match(match);
    const isLatviaMatch = checkIsLatviaMatch(match);
    const isHongKongMatch = checkIsHongKongMatch(match);
    const isEstoniaMatch = checkIsEstoniaMatch(match);
    const isCostaRicaMatch = checkIsCostaRicaMatch(match);
    const isItalySerieCMatch = checkIsItalySerieCMatch(match);
    const isKosovoMatch = checkIsKosovoMatch(match);
    const isSwedenSuperettanMatch = checkIsSwedenSuperettanMatch(match);
    const isEnglandLeagueTwoMatch = checkIsEnglandLeagueTwoMatch(match);
    const isEnglandNonLeaguePremierSouthernSouthMatch = checkIsEnglandNonLeaguePremierSouthernSouthMatch(match);
    const isEnglandNonLeaguePremierSouthernCentralMatch = checkIsEnglandNonLeaguePremierSouthernCentralMatch(match);
    const isEnglandNonLeaguePremierIsthmianMatch = checkIsEnglandNonLeaguePremierIsthmianMatch(match);
    const isBangladeshMatch = checkIsBangladeshMatch(match);
    const isParaguayDivisionIntermediaMatch = checkIsParaguayDivisionIntermediaMatch(match);
    const isGuatemalaLigaNacionalMatch = checkIsGuatemalaLigaNacionalMatch(match);

    const parsedL10 = parseL10(match.l10);
    const l10Home = parsedL10.homeWins;
    const l10Away = parsedL10.awayWins;
    const mFavL10 = mFav === '1' ? l10Home : l10Away;
    const underdogL10 = underdog === '1' ? l10Home : l10Away;
    const hasValidL10 = parsedL10.isValid;
    const underdogHasHigherL10 = hasValidL10 && (underdogL10 > mFavL10);
    const isL10Close = hasValidL10 && Math.abs(mFavL10 - underdogL10) <= 1;
    const isL10Equal = hasValidL10 && mFavL10 === underdogL10;

    const homeWinsDraws = parsedL10.homeW + parsedL10.homeD;
    const awayWinsDraws = parsedL10.awayW + parsedL10.awayD;
    const mFavL10WinsDraws = mFav === '1' ? homeWinsDraws : awayWinsDraws;
    const underdogL10WinsDraws = underdog === '1' ? homeWinsDraws : awayWinsDraws;
    const isL10WinsDrawsEqual = hasValidL10 && mFavL10WinsDraws === underdogL10WinsDraws;
    const isL10WinsDrawsMfavGreater = hasValidL10 && mFavL10WinsDraws > underdogL10WinsDraws;
    const isL10WinsDrawsUndGreater = hasValidL10 && mFavL10WinsDraws < underdogL10WinsDraws;

    const clean1x2 = (pred1x2 || (match as any).tip1x2 || '').toUpperCase().replace(/\s+/g, '');
    const is1X2SupportsUnderdog = Boolean(
        (underdog === '1' && (clean1x2 === '1' || clean1x2 === '1X' || clean1x2.includes('1X') || (clean1x2.includes('1') && !clean1x2.includes('2')))) ||
        (underdog === '2' && (clean1x2 === '2' || clean1x2 === 'X2' || clean1x2.includes('X2') || (clean1x2.includes('2') && !clean1x2.includes('1'))))
    );

    const rawRating = match.rating || (match as any).rating1x2 || (match as any).rating1X2 || '';
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
        drawPoints,
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
        isVietnamMatch,
        isEgyptianMatch,
        isRomaniaLiga2Match,
        isIraqMatch,
        isArgentinaPrimeraLPFMatch,
        isColombiaPrimeraAMatch,
        isSwitzerlandChallengeLeagueMatch,
        isCzechRepublicNflMatch,
        isKazakhstanMatch,
        isNorthernIrelandMatch,
        isBolivianMatch,
        isBig5LeagueMatch,
        isEuropeanChasersMatch,
        isNonEuropeanMajorLeagueMatch,
        isUefaEflMatch,
        isTournamentMatch,
        isCarabaoCupMatch,
        isUsaUslChampionshipMatch,
        isChileSegundaDivisionMatch,
        isHungaryMatch,
        isEnglandAmateurNationalLeagueMatch,
        isUkraineMatch,
        isThailandMatch,
        isHungaryNbiMatch,
        isThaiLeague1Match,
        isCzech4LigaDivizieFMatch,
        isSpainPrimeraRfefGroup2Match,
        isItalySerieDMatch,
        isItalySerieDGironeBMatch,
        isQatarSecondDivisionMatch,
        isArgentinaTorneoProyeccionMatch,
        isSlovenia1SnlMatch,
        isSwedenDivision2NorraSvealandMatch,
        isCzechLigaMatch,
        isVietnamVLeague2Match,
        isPortugalCampeonatoGroupCMatch,
        isTurkey1LigMatch,
        isSpainSegundaDivisionMatch,
        isTurkeySuperLigMatch,
        isNorway3rdDivisionGirone1Match,
        isNetherlandsEersteDivisieMatch,
        isArgentinaPrimeraAMatch,
        isArgentinaNoLeagueMatch,
        isDenmarkSuperligaMatch,
        isColombiaPrimeraBMatch,
        isPanamaLigaPanamenaMatch,
        isGeorgiaErovnuliLigaMatch,
        isUzbekistanProLeagueAMatch,
        isIsraelLigaLeumitMatch,
        isIranPersianGulfProLeagueMatch,
        isCostaRicaLigaDeAscensoMatch,
        isSaudiArabiaProLeagueMatch,
        isRussiaCupMatch,
        isAfcChampionsLeagueEliteMatch,
        isCzechRepublicMatch,
        isNicaraguaPrimeraDivisionMatch,
        isAfcChampionsLeagueTwoMatch,
        isRussiaSecondLeagueMatch,
        isConmebolLibertadoresMatch,
        isSloveniaMatch,
        isIrelandMatch,
        isIcelandMatch,
        isEgyptSecondLeagueMatch,
        isBulgariaSecondLeagueMatch,
        isWalesMatch,
        isSouthAfrica1stDivisionMatch,
        isPolandILigaMatch,
        isTanzaniaLigiKuuBaraMatch,
        isUzbekistanSuperLeagueMatch,
        isMfavHome,
        isBrazilSerieBMatch,
        isBelgiumReserveProLeagueMatch,
        isSlovakiaMatch,
        isItalySerieBMatch,
        isFranceLigue3Match,
        isSpainPrimeraWomenMatch,
        isEnglandNonLeaguePremierMatch,
        isItalyPrimavera2Match,
        isBulgariaCupMatch,
        isSwedenDivision2Match,
        isElSalvadorLeaguesMatch,
        isPhilippinesMatch,
        isSpainTerceraDivisionMatch,
        isChileMatch,
        isSaudiArabiaDivision1Match,
        isLatviaMatch,
        isHongKongMatch,
        isEstoniaMatch,
        isCostaRicaMatch,
        isItalySerieCMatch,
        isKosovoMatch,
        isSwedenSuperettanMatch,
        isEnglandLeagueTwoMatch,
        isEnglandNonLeaguePremierSouthernSouthMatch,
        isEnglandNonLeaguePremierSouthernCentralMatch,
        isEnglandNonLeaguePremierIsthmianMatch,
        isBangladeshMatch,
        isParaguayDivisionIntermediaMatch,
        isGuatemalaLigaNacionalMatch,
        mFavL10,
        underdogL10,
        hasValidL10,
        underdogHasHigherL10,
        isL10Close,
        isL10Equal,
        mFavL10WinsDraws,
        underdogL10WinsDraws,
        isL10WinsDrawsEqual,
        isL10WinsDrawsMfavGreater,
        isL10WinsDrawsUndGreater,
        is1X2SupportsUnderdog,
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
        if (REMOVED_TRIGGER_DESCRIPTIONS.has(desc)) return;
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
    applyRule("Seer score on draw >= 35% to <40%", stats.seerScoreDraw >= 35 && stats.seerScoreDraw < 40, -30);
    applyRule("Seer score on draw >= 40%", stats.seerScoreDraw >= 40, -25);
    applyRule("Seer score on underdog >= 45%", stats.seerScoreUd >= 45, 0);
    applyRule("Seer primary predicts on underdog", stats.seerPrimPred === stats.underdog, 0);

    applyRule("Seer score on Mfav <40%", stats.seerScoreFav < 40, -10);
    applyRule("Seer score on Mfav =>40%  to <50%", stats.seerScoreFav >= 40 && stats.seerScoreFav < 50, 10);
    applyRule("Seer score on Mfav =>50%  to <60%", stats.seerScoreFav >= 50 && stats.seerScoreFav < 60, 15);
    applyRule("Seer score on Mfav =>60%  to <70%", stats.seerScoreFav >= 60 && stats.seerScoreFav < 70, 20);
    applyRule("Seer score on Mfav =>70%", stats.seerScoreFav >= 70, 25);

    applyRule("Algo support for Mfav > 50%", stats.algoPercentage > 50, 0);
    applyRule("Algo support for Mfav is 45-50%", stats.algoPercentage >= 45 && stats.algoPercentage <= 50, 10);
    applyRule("Algo supports Mfav >=45% to <50%", stats.algoPercentage >= 45 && stats.algoPercentage < 50, 10);
    applyRule("Algo for Mfav support <40%", stats.algoPercentage > 0 && stats.algoPercentage < 40, 0);
    applyRule("Algo primary prediction supports the underdog", stats.algoPrimPred === stats.underdog, 0);
    applyRule("Algo Mfav support =>50 to <55%", stats.algoPercentage >= 50 && stats.algoPercentage < 55, 10);
    applyRule("Algo Mfav support =>55 to <60%", stats.algoPercentage >= 55 && stats.algoPercentage < 60, 15);
    applyRule("Algo Mfav support =>60", stats.algoPercentage >= 60, 20);

    // Mutual exclusivity for 1X/X2 consensus triggers:
    // If a match fires any 2 or 3 of these consensus triggers, pick only ONE to avoid over-compensating:
    // 1. "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2"
    // 2. "PAA, Seer, and ML agree on 1X/X2"
    // 3. "Algo final prediction is 1X/X2"
    const isAlgo1xX2 = stats.algoPred === '1X' || stats.algoPred === 'X2';
    const isAllPredictorsAgree = ['1X', 'X2'].includes(stats.algoPred) && ['1X', 'X2'].includes(stats.seerPred) && ['1X', 'X2'].includes(stats.paaPred) && ['1X', 'X2'].includes(stats.subPred);
    const isPaaSeerMlAgree = ['1X', 'X2'].includes(stats.paaPred) && ['1X', 'X2'].includes(stats.seerPred) && ['1X', 'X2'].includes(stats.mlPred);

    if (isAllPredictorsAgree) {
        applyRule("All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2", true, 0);
    } else if (isPaaSeerMlAgree) {
        applyRule("PAA, Seer, and ML agree on 1X/X2", true, 0);
    } else if (isAlgo1xX2) {
        applyRule("Algo final prediction is 1X/X2", true, 0);
    }
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
    applyRule("Mfav TS 1.0-1.50 and Ud TS < 0.8", stats.favTS >= 1.0 && stats.favTS <= 1.5 && stats.udTS < 0.8, 15);
    applyRule("Mfav TS < 1.5, Ud TS < 0.8, Seer score draw >= 35%", stats.favTS < 1.5 && stats.udTS < 0.8 && stats.seerScoreDraw >= 35, 0);
    applyRule("Mfav TS >= 2.0 and Underdog TS < 0.7 + Seer score on draw >= 35%", stats.favTS >= 2.0 && stats.udTS < 0.7 && stats.seerScoreDraw >= 35, 0);
    applyRule("M.fav TS >= 2.0 and Underdog TS < 1.0", stats.favTS >= 2.0 && stats.udTS < 1.0, 0);
    applyRule("Both team TS =< 1.0", (stats.favTS > 0 && stats.udTS > 0 && stats.favTS <= 1.0 && stats.udTS <= 1.0) || (stats.rawTsa > 0 && stats.rawTsb > 0 && stats.rawTsa <= 1.0 && stats.rawTsb <= 1.0), -15);
    applyRule("MFav TS <=1.2", stats.favTS > 0 && stats.favTS <= 1.20, -10);
    applyRule("TS difference <= 0.1", isTsDiffClose, 0);
    const isUdHiddenStrength = stats.underdogHiddenStrengthOrWeakness && stats.underdogGS >= stats.underdogGA;
    const isUdHiddenWeakness = stats.underdogHiddenStrengthOrWeakness && stats.underdogGS < stats.underdogGA;
    const isMfavHiddenStrength = (stats.mFavGS > 0 || stats.mFavGA > 0) && (Math.abs(stats.mFavGS - stats.mFavGA) <= 0.2001) && stats.mFavGS >= stats.mFavGA;
    const isMfavHiddenWeakness = (stats.mFavGS > 0 || stats.mFavGA > 0) && (Math.abs(stats.mFavGS - stats.mFavGA) <= 0.2001) && stats.mFavGS < stats.mFavGA;

    applyRule("Underdog has hidden strength", isUdHiddenStrength, -30);
    applyRule("Underdog has hidden weakness", isUdHiddenWeakness, -10);
    applyRule("Underdog is at home", stats.underdog === '1', -5);
    applyRule("Underdog has hidden strength+Underdog is at home", isUdHiddenStrength && stats.underdog === '1', -30);
    applyRule("M.fav has hidden strength", isMfavHiddenStrength, 0);
    applyRule("M.fav has hidden weakness", isMfavHiddenWeakness, -5);
    applyRule("Underdog has >= 5 more points on point system", stats.udPoints - stats.mFavPoints >= 5, -5);
    applyRule("M.fav has hidden strength+Mfav GA=Und GA (+-0.2)", !stats.underdogHiddenStrengthOrWeakness && Math.abs(stats.mFavGA - stats.underdogGA) <= 0.2, 0);
    applyRule("M.fav has hidden strength+Underdog has hidden strength", isMfavHiddenStrength && isUdHiddenStrength, -15);
    applyRule("Underdog has hidden weakness+M.fav has hidden weakness", isUdHiddenWeakness && isMfavHiddenWeakness, -15);
    applyRule("M.fav has hidden weakness+Mfav GS = Und Gs +-0.2", isMfavHiddenWeakness && stats.isMfavGsUndGsClose, 20);

    // --- 3. Goal Scoring & Defensive Dynamics (GS / GA) ---
    applyRule("Both teams GS < 1.0", stats.mFavGS < 1.0 && stats.underdogGS < 1.0, 0);
    applyRule("Both teams GS < 1.0 and Both team GS <GA", stats.mFavGS < 1.0 && stats.underdogGS < 1.0 && stats.gsHome < stats.gaHome && stats.gsAway < stats.gaAway, 0);
    applyRule("Both team GS => 1.8", stats.mFavGS >= 1.8 && stats.underdogGS >= 1.8, 10);
    applyRule("Both teams GA > GS and Both team GS <=1.0", stats.bothTeamsGAGreaterThanGS && stats.gsHome <= 1.0 && stats.gsAway <= 1.0, 0);
    applyRule("Both teams GA >= 1.1 (volatile match)", stats.isVolatile, 0);
    applyRule("Both teams GA >= 1.1 (volatile) and Underdog has hidden strength", stats.isVolatile && stats.underdogHiddenStrengthOrWeakness, 0);
    applyRule("Both teams GA >= 1.1 +Pha Underdog and Pha draw both >20%", stats.isVolatile && stats.phaUdPct > 20 && stats.phaDrawPct > 20, -15);
    applyRule("Both teams GA >= 1.5", stats.isBothTeamsGaGe1_5, 0);
    applyRule("M.fav GA is > 0.6 points lower than Underdog GA", stats.underdogGA - stats.mFavGA > 0.6, 0);
    applyRule("Mfav GA=Und GA (+-0.2)", Math.abs(stats.mFavGA - stats.underdogGA) <= 0.2001, 5);
    applyRule("Mfav GS = Und Gs +-0.2", stats.isMfavGsUndGsClose, 5);
    applyRule("Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA", stats.isMfavGsUndGsClose && stats.mFavGA >= stats.underdogGA, 5);
    applyRule("Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength", stats.isMfavGsUndGsClose && isUdHiddenStrength, 5);
    applyRule("Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA", stats.isMfavGsUndGsClose && isUdGaLtMfavGa, 5);
    applyRule("Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)", stats.isMfavGsUndGsClose && Math.abs(stats.mFavGA - stats.underdogGA) <= 0.2, 5);
    applyRule("Underdog GS < 1.0 but M.fav GS > 1.0", stats.underdogGS < 1.0 && stats.mFavGS > 1.0, 0);
    applyRule("Underdog GS >Mfav GS with >=0.4 points", stats.underdogGS - stats.mFavGS >= 0.4, 0);
    applyRule("Underdog GS > Mfav GS with >= 0.3", stats.underdogGS - stats.mFavGS >= 0.299, -10);
    applyRule("Mfav GS > Underdog GS with >= 0.3", stats.mFavGS - stats.underdogGS >= 0.299, 10);
    applyRule("Underdog GA >= 1.5 and GS => 1.8", stats.underdogGA >= 1.5 && stats.underdogGS >= 1.8, 0);
    applyRule("A match has GS=GS=GA=GA", stats.isGSGAGA, 0);
    applyRule("Equal GS + AGA=HGS + M.fav has hidden strength", stats.gsHome === stats.gsAway && stats.gaAway === stats.gsHome && (stats.mFavGS > 0 && Math.abs(stats.mFavGS - stats.mFavGA) <= 0.2), 0);
    applyRule("Equal GS + AGA=HGS + M.fav has hidden weakness", stats.gsHome === stats.gsAway && stats.gaAway === stats.gsHome && (stats.mFavGS > 0 && Math.abs(stats.mFavGS - stats.mFavGA) <= 0.2 && stats.mFavGS < stats.mFavGA), 0);

    // --- 4. Odds & Market Structure ---
    applyRule("Underdog odds <= 2.80", stats.udOdds > 0 && stats.udOdds <= 2.80, -30);
    applyRule("Underdog odds <=2.7", stats.udOdds > 0 && stats.udOdds <= 2.70, -20);
    applyRule("Mfav odds >= 2.5", stats.favOdds >= 2.50, -15);
    applyRule("Odds for underdog >= 2.80 to 3.0", stats.udOdds >= 2.80 && stats.udOdds <= 3.0, 0);
    applyRule("Odds for underdog <= odds for draw but < 2.8", stats.oddsUnderdogLessEqDraw && stats.udOdds < 2.8, 0);
    applyRule("Odds for underdog <= odds for draw but between 2.8 to 3.0", stats.oddsUnderdogLessEqDraw && stats.udOdds >= 2.8 && stats.udOdds <= 3.0, 0);
    applyRule("Odds for underdog <= odds for draw but >= 3.0", stats.oddsUnderdogLessEqDraw && stats.udOdds >= 3.0, 0);

    // --- 5. Head-to-Head / Last Encounter (LE) ---
    applyRule("LE : Underdog won the last encounter", !!stats.leData?.underdogWon, 0);
    applyRule("LE Underdog won with 2+ goals", !!stats.leData?.underdogWon && (stats.leData.underdogGoals - stats.leData.mFavGoals >= 2), 0);
    applyRule("Underdog was away on LE and Won", !!stats.leData?.underdogWon && !!stats.leData?.underdogWasAway, 0);
    applyRule("LE was a draw+Underdog has hidden strength/weakness", stats.leWasDraw && stats.underdogHiddenStrengthOrWeakness, 0);
    applyRule("LE, Underdog won the last encounter +Mfav L10= Und L10", !!stats.leData?.underdogWon && stats.isL10Equal, 0);

    // --- 6. Match Situational & Dynamic League Evaluation ---
    applyRule("Mfav is playing at home", stats.isMfavHome, 10);

    // Dynamic League Evaluation: All static pre-loaded league triggers purged.
    // Each match evaluates strictly and solely its own true discovered league.
    const countryLeagueInfo = getMatchCountryAndLeague(match);
    if (countryLeagueInfo.display && countryLeagueInfo.display !== 'Unknown' && !/\bleagues\b/i.test(countryLeagueInfo.display)) {
        const dynamicLeagueTrigger = `Match belongs to ${countryLeagueInfo.display}`;
        if (!REMOVED_TRIGGER_DESCRIPTIONS.has(dynamicLeagueTrigger)) {
            registerDiscoveredLeagueTrigger(dynamicLeagueTrigger);
            if (!hitSet.has(dynamicLeagueTrigger)) {
                applyRule(dynamicLeagueTrigger, true, 5);
            }
        }
    }

    const effectivePct = match?.percentage ?? match?.probabilityConfidence ?? (match?.totalPoints ? Math.min(100, match.totalPoints) : 0);
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

    applyRule("Mfav TS 1.0-1.50 and Ud TS < 0.8 + Odds underdog < 2.8", isMfavTs115UdLt08 && isUdOddsLt28, 0);
    applyRule("Mfav TS 1.0-1.50 and Ud TS < 0.8 + Algo support < 40%", isMfavTs115UdLt08 && isAlgoLt40, 0);

    // --- 8. Missing LE, L10 & Advanced Statistical Triggers ---
    applyRule("LE was a draw", stats.leWasDraw, 0);
    applyRule("Mfav L10 = Und L10", stats.isL10Equal, -5);
    applyRule("LE was a draw + Mfav L10 = Und L10", stats.leWasDraw && stats.isL10Equal, -5);
    applyRule("LE was a draw + Mfav has hidden strength", stats.leWasDraw && ((stats.mFavGS > 0 || stats.mFavGA > 0) && Math.abs(stats.mFavGS - stats.mFavGA) <= 0.2001 && stats.mFavGS >= stats.mFavGA), 0);
    applyRule("Underdog has higher L10 than Mfav", stats.underdogHasHigherL10, -5);
    applyRule("Mfav L10 and Underdog L10 difference <= 1", stats.isL10Close, 0);
    applyRule("Underdog L10 <= 2", stats.hasValidL10 && stats.underdogL10 <= 2, 0);
    applyRule("Both team L10 <= 5", stats.hasValidL10 && stats.mFavL10 <= 5 && stats.underdogL10 <= 5, -15);

    // --- 8a. L10 Form Wins + Draws Triggers & 1X2 Prediction Underdog Trigger ---
    applyRule("L10: Mfav Wins+ Draws = Underdog wins +Draws", stats.isL10WinsDrawsEqual, -5);
    applyRule("L10: Mfav Wins+ Draws > Underdog wins +Draws", stats.isL10WinsDrawsMfavGreater, 20);
    applyRule("L10: Mfav Wins+ Draws < Underdog wins +Draws", stats.isL10WinsDrawsUndGreater, -15);
    applyRule("L10: Mfav Wins+ Draws < Underdog wins +Draws+Odds for underdog >= 2.80 to 3.0", stats.isL10WinsDrawsUndGreater && stats.udOdds >= 2.80 && stats.udOdds <= 3.0, -5);
    applyRule("L10: Mfav Wins+ Draws < Underdog wins +Draws+Underdog has higher L10 than Mfav", stats.isL10WinsDrawsUndGreater && stats.underdogHasHigherL10, -5);

    const has1x2Trigger = typeof ruleMap?.has === 'function' ? ruleMap.has("1X2 supports the underdog") : false;
    if (has1x2Trigger && !(typeof ruleMap?.has === 'function' && ruleMap.has("1X2 pred supports the underdog"))) {
        applyRule("1X2 supports the underdog", stats.is1X2SupportsUnderdog, -15);
    } else {
        applyRule("1X2 pred supports the underdog", stats.is1X2SupportsUnderdog, -15);
    }

    // --- OPW P-Recom 1X2 Prediction Triggers (-15 Points) ---
    const clean1x2 = (match.pred1x2 || (match as any).tip1x2 || '').toUpperCase().replace(/\s+/g, '');
    const is1x2FavDC = (stats.mFav === '1' && (clean1x2 === '1X' || clean1x2 === '1/X')) ||
                       (stats.mFav === '2' && (clean1x2 === 'X2' || clean1x2 === 'X/2'));
    applyRule("1X2 prediction is 1X or X2 in support of MFAV", is1x2FavDC, -15);

    const is1x2UndDC = (stats.underdog === '1' && (clean1x2 === '1X' || clean1x2 === '1/X')) ||
                       (stats.underdog === '2' && (clean1x2 === 'X2' || clean1x2 === 'X/2'));
    applyRule("1X2 prediction is 1X or X2 in support of Underdog", is1x2UndDC, -15);

    const is1x2Draw = clean1x2 === 'X' || clean1x2 === 'DRAW';
    applyRule("1X2 prediction is X", is1x2Draw, -15);

    applyRule("1X2 Rating < 3.0", stats.isRatingLessThan3_0, -15);
    applyRule("1X2 Rating 5.0 to 7.0", stats.isRating5to7, 0);
    applyRule("Mfav GA <= 1.1 and Underdog GA > 1.1", stats.isMfavGaLe1_1AndUndGaGt1_1, 0);
    applyRule("Underdog GS < 1.0 and Mfav GA < 1.0 (Dominant Defense)", stats.underdogGS < 1.0 && stats.mFavGA < 1.0, 0);
    applyRule("Mfav GS >= 1.5 and Underdog GS < 1.0", stats.mFavGS >= 1.5 && stats.underdogGS < 1.0, 0);
    applyRule("Underdog GA >= 1.8 and Mfav GA <= 1.0", stats.underdogGA >= 1.8 && stats.mFavGA <= 1.0, 0);
    applyRule("PAA Win probability >= 50%", stats.paaSWin >= 50, 0);
    applyRule("PAA Win probability < 35%", stats.paaSWin > 0 && stats.paaSWin < 35, 0);
    applyRule("PHA for Mfav <40%", stats.paaSWin > 0 && stats.paaSWin < 40, -15);
    applyRule("PHA Draw probability >= 35%", stats.phaDrawPct >= 35, 0);
    applyRule("PHA on draw =>30%", stats.phaDrawPct >= 30, -25);
    applyRule("PHA Underdog probability >= 35%", stats.phaUdPct >= 35, 0);

    const allMatchTags = [...(match.evaluatorTags || []), ...(stats.initialMatchTags || [])];
    const hasPhaTieTag = stats.isPhaTie || allMatchTags.some(t => {
        const u = t.toUpperCase();
        return u === 'PHA_TIE' || u === 'VOLATILE:PHA_TIE' || u === 'PHA TIE';
    });
    applyRule("Match has PHA TIE tag", hasPhaTieTag, -30);
    applyRule("Underdog has hidden weakness+Match has PHA TIE tag", isUdHiddenWeakness && hasPhaTieTag, -30);
    applyRule("Match belongs to Sweden: Superettan+Match has PHA TIE tag", stats.isSwedenSuperettanMatch && hasPhaTieTag, -30);
    applyRule("Points for Draw =>30 on the point system", stats.drawPoints >= 30, -10);
    applyRule("SubPattern is G2E5", stats.isG2E5, -30);

    // --- 8b. High-Impact Compound Trap Triggers & Underdog Odds ---
    applyRule("Underdog odds >3.0", stats.udOdds > 3.0, 5);
    applyRule("LE : Underdog won the last encounter+ Underdog has higher L10 than Mfav", !!stats.leData?.underdogWon && stats.underdogHasHigherL10, 0);
    const isYouthLeagueU19 = /\bu[- ]?19\b/i.test(match.league || '') || /\bu[- ]?19\b/i.test(match.teams || '');
    const isYouthLeagueU20 = /\bu[- ]?20\b/i.test(match.league || '') || /\bu[- ]?20\b/i.test(match.teams || '');
    const isYouthLeagueU21 = /\bu[- ]?21\b/i.test(match.league || '') || /\bu[- ]?21\b/i.test(match.teams || '');
    const isYouthLeagueU23 = /\bu[- ]?23\b/i.test(match.league || '') || /\bu[- ]?23\b/i.test(match.teams || '');
    const isYouthLeagueU21U20U19 = isYouthLeagueU19 || isYouthLeagueU20 || isYouthLeagueU21;
    applyRule("Youth League U19", isYouthLeagueU19, -15);
    applyRule("Youth League U20", isYouthLeagueU20, -15);
    applyRule("Youth League U21", isYouthLeagueU21, -15);
    applyRule("Youth League U23", isYouthLeagueU23, -5);
    applyRule("Youth League (U21,U20,U19)+ Both team GS => 1.8", (hitSet.has("Youth League U19") || hitSet.has("Youth League U20") || hitSet.has("Youth League U21") || isYouthLeagueU21U20U19) && hitSet.has("Both team GS => 1.8"), -25);
    applyRule("Match belongs to Estonia Leagues +Youth League (U21,U20,U19)", (hitSet.has("Match belongs to Estonia Leagues") || stats.isEstoniaMatch) && (hitSet.has("Youth League U19") || hitSet.has("Youth League U20") || hitSet.has("Youth League U21") || isYouthLeagueU21U20U19), -30);
    const isYouthLeague = /\b(u21|u23|u20|u19)\b/i.test(match.league || '') || /\b(u21|u23|u20|u19)\b/i.test(match.teams || '');
    applyRule("LE : Underdog won the last encounter+Youth League (U21,U23,U20,U19)", !!stats.leData?.underdogWon && isYouthLeague, 0);
    applyRule("TS difference <= 0.1+Both teams GA >= 1.1 (volatile match)", isTsDiffClose && stats.isVolatile, 0);
    const isLeUdWon2Plus = !!stats.leData?.underdogWon && (stats.leData.underdogGoals - stats.leData.mFavGoals >= 2);
    applyRule("LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)", isLeUdWon2Plus && stats.isVolatile, 0);

    // --- 8c. User Calibrated Compound Danger Triggers (All Categories) ---
    const isPaaSubAlgo12 = (stats.paaPred === '12' || stats.paaPrimPred === '12') && stats.subPred === '12' && (stats.algoPred === '12' || stats.algoPrimPred === '12');
    const isPaaMlSeer1xX2SubAlgo12 = ['1X', 'X2'].includes(stats.paaPred) && ['1X', 'X2'].includes(stats.mlPred) && ['1X', 'X2'].includes(stats.seerPred) && stats.subPred === '12' && stats.algoPred === '12';

    applyRule("Youth League (U21,U23,U20,U19)+ Odds for underdog >= 2.80 to 3.0", isYouthLeague && stats.udOdds >= 2.80 && stats.udOdds <= 3.0, -20);
    applyRule("PAA, SubPattern, and Algo agree on 12 hedge+Both teams GA >= 1.1 (volatile match)", isPaaSubAlgo12 && stats.isVolatile, -20);
    applyRule("Youth League (U21,U23,U20,U19)+PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", isYouthLeague && isPaaMlSeer1xX2SubAlgo12, -20);
    applyRule("Underdog odds <= 2.80+Underdog GA >= 1.5 and GS => 1.8", (stats.udOdds > 0 && stats.udOdds <= 2.80) && (stats.underdogGA >= 1.5 && stats.underdogGS >= 1.8), -20);
    applyRule("Underdog odds <= 2.80+Both team GS => 1.8", (hitSet.has("Underdog odds <= 2.80") || (stats.udOdds > 0 && stats.udOdds <= 2.80)) && hitSet.has("Both team GS => 1.8"), -20);
    applyRule("Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)", stats.isL10Close && stats.isVolatile, -20);
    applyRule("LE was a draw+1X2 Rating < 3.0", hitSet.has("LE was a draw") && hitSet.has("1X2 Rating < 3.0"), 15);
    applyRule("Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)", stats.isL10Equal && stats.isVolatile, -20);
    applyRule("Mfav GS = Und Gs +-0.2+ 1X2 Rating < 3.0", hitSet.has("Mfav GS = Und Gs +-0.2") && hitSet.has("1X2 Rating < 3.0"), -10);
    applyRule("1X2 Rating < 3.0+MFav TS <=1.2", hitSet.has("1X2 Rating < 3.0") && hitSet.has("MFav TS <=1.2"), -20);
    applyRule("Both team GS => 1.8+Mfav GS = Und Gs +-0.2", hitSet.has("Both team GS => 1.8") && hitSet.has("Mfav GS = Und Gs +-0.2"), -30);
    applyRule("Underdog has >= 5 more points on point system+Mfav is playing at home", hitSet.has("Underdog has >= 5 more points on point system") && hitSet.has("Mfav is playing at home"), 15);

    const hasMfavGaUndGaClose = hitSet.has("Mfav GA=Und GA (+-0.2)") || hitSet.has("Mfav GA close to Ud GA (+-0.2)");
    applyRule("Both team GS => 1.8 + Mfav GA close to Ud GA (+-0.2)", hitSet.has("Both team GS => 1.8") && hasMfavGaUndGaClose, -15);

    // New Pro Underdog & Pro Mfav triggers
    applyRule("Pha Underdog and Pha draw both >20%", stats.phaUdPct >= 20 && stats.phaDrawPct >= 20, -10);
    const mFavHiddenStrengthOrWeakness = (stats.mFavGS > 0 || stats.mFavGA > 0) && (Math.abs(stats.mFavGS - stats.mFavGA) <= 0.2001);
    const isBothHiddenSW = mFavHiddenStrengthOrWeakness && stats.underdogHiddenStrengthOrWeakness;
    applyRule("Mfav has hidden strength/weakness+Underdog has hidden strength/weakness", isBothHiddenSW, -10);

    // --- 8d. New User-Specified Underdog Triggers ---
    const isMfavAwayButWasHomeLastLeWonLe1Goal = 
        stats.isAwayFav && 
        !!stats.leData && 
        !stats.leData.mFavWasAway && 
        stats.leData.mFavWon && 
        (stats.leData.mFavGoals - stats.leData.underdogGoals <= 1);

    applyRule("Mfav is away but was home last LE won with <=1 goal", isMfavAwayButWasHomeLastLeWonLe1Goal, -5);
    applyRule("Mfav is away but was home last LE won with <=1 goal+ Odds for underdog >= 2.80 to 3.0", 
        isMfavAwayButWasHomeLastLeWonLe1Goal && (stats.udOdds >= 2.80 && stats.udOdds <= 3.0), -20);
    applyRule("Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1", 
        stats.isL10Equal && stats.isL10Close, -15);
    applyRule("Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal", 
        stats.isMfavGsUndGsClose && isMfavAwayButWasHomeLastLeWonLe1Goal, -15);

    const hasBannedUpsetRisk = allMatchTags.some(t => t.toUpperCase() === 'BANNED:UPSET_RISK');
    const hasBannedDrawRisk = allMatchTags.some(t => t.toUpperCase() === 'BANNED:DRAW_RISK');

    applyRule("Match has Banned:Upset risk tag", hasBannedUpsetRisk, -5);
    applyRule("Match has Banned:Draw risk tag", hasBannedDrawRisk, -5);

    // --- 8e. New User-Specified Underdog & Mfav Triggers ---
    const hasSeerDraw35Plus = hitSet.has("Seer score on draw >= 35% to <40%") || hitSet.has("Seer score on draw >= 40%");
    applyRule("Seer score on draw >= 35%+1X2 Rating < 3.0", hasSeerDraw35Plus && hitSet.has("1X2 Rating < 3.0"), -10);

    const isMfavGsGe2 = stats.mFavGS >= 2.0;
    const isMfavGsUndGaClose = Math.abs(stats.mFavGS - stats.underdogGA) <= 0.2001;
    applyRule("Mfav GS=>2.0=Underdog GA +-0.2", isMfavGsGe2 && isMfavGsUndGaClose, -5);
    applyRule("Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%", hitSet.has("Mfav GS=>2.0=Underdog GA +-0.2") && hasSeerDraw35Plus, -15);

    const isMfavL10Ge3Higher = stats.hasValidL10 && (stats.mFavL10 - stats.underdogL10 >= 3);
    applyRule("Mfav L10 > Und L10 with >=3 points", isMfavL10Ge3Higher, 5);
    applyRule("Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5", isMfavL10Ge3Higher && stats.mFavL10 >= 5, 15);

    const isMfavL10Gt5To7 = stats.hasValidL10 && stats.mFavL10 > 5 && stats.mFavL10 <= 7;
    applyRule("Mfav L10(wins) >5 to 7", isMfavL10Gt5To7, 15);

    const isMfavL10Gt7 = stats.hasValidL10 && stats.mFavL10 > 7;
    applyRule("Mfav L10(wins) >7", isMfavL10Gt7, 25);

    const isUndL10Gt5To7 = stats.hasValidL10 && stats.underdogL10 > 5 && stats.underdogL10 <= 7;
    applyRule("Underdog L10(wins) >5 to 7", isUndL10Gt5To7, -5);

    const isUndL10Gt7 = stats.hasValidL10 && stats.underdogL10 > 7;
    applyRule("Underdog L10(wins) >7", isUndL10Gt7, -5);

    const isMfavL10GtUndL10Gt5 = stats.hasValidL10 && stats.mFavL10 > stats.underdogL10 && stats.mFavL10 > 5;
    applyRule("Mfav L10(wins)>Und L10 but >5", isMfavL10GtUndL10Gt5, 5);

    const isMfavL10GtUndL10Le5 = stats.hasValidL10 && stats.mFavL10 > stats.underdogL10 && stats.mFavL10 <= 5;
    applyRule("Mfav L10(wins)>Und L10 but <=5", isMfavL10GtUndL10Le5, 5);

    const isUndL10GtMfavL10Gt5 = stats.hasValidL10 && stats.underdogL10 > stats.mFavL10 && stats.underdogL10 > 5;
    applyRule("Und L10(wins)>Mfav L10 but >5", isUndL10GtMfavL10Gt5, -5);

    const isUndL10GtMfavL10Le5 = stats.hasValidL10 && stats.underdogL10 > stats.mFavL10 && stats.underdogL10 <= 5;
    applyRule("Und L10(wins)>Mfav L10 but <=5", isUndL10GtMfavL10Le5, -5);

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

    applyRule("Mfav was away and won last Encounter <=1 goal", isMfavAwayWonLeLe1, -5);
    applyRule("Mfav was home and won last Encounter <=1 goal", isMfavHomeWonLeLe1, -5);
    applyRule("Mfav was home and won last Encounter >1 to =<3 goal", isMfavHomeWonLe1To3, 10);
    applyRule("Mfav was Away and won last Encounter >1 to =<3 goal", isMfavAwayWonLe1To3, 10);
    applyRule("Mfav was home and won last Encounter >3 goal", isMfavHomeWonLeGt3, 10);
    applyRule("Mfav was Away and won last Encounter >3 goal", isMfavAwayWonLeGt3, 10);

    applyRule("Mfav was away and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", isMfavAwayWonLeLe1 && isMfavL10Ge3Higher, 10);
    applyRule("Mfav was home and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", isMfavHomeWonLeLe1 && isMfavL10Ge3Higher, 10);
    applyRule("Mfav was home and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", isMfavHomeWonLe1To3 && isMfavL10Ge3Higher, 10);
    applyRule("Mfav was Away and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", isMfavAwayWonLe1To3 && isMfavL10Ge3Higher, 10);
    applyRule("Mfav was home and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", isMfavHomeWonLeGt3 && isMfavL10Ge3Higher, 10);
    applyRule("Mfav was Away and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", isMfavAwayWonLeGt3 && isMfavL10Ge3Higher, 10);


    // --- 9. Compound Trap Multipliers & Dampers ---
    // When multiple dangerous signals co-occur on a match, apply an additional compound penalty
    if (rawApplyRule) {
        if (udTrapHits >= 3) {
            rawApplyRule("Compound Underdog Trap Damper (3+ co-occurring danger signals)", true, -15);
            hitSet.add("Compound Underdog Trap Damper (3+ co-occurring danger signals)");
        } else if (udTrapHits >= 2) {
            rawApplyRule("Dual Risk Co-occurrence Damper", true, -10);
            hitSet.add("Dual Risk Co-occurrence Damper");
        }
    }

    // --- Strict Universal Combo Prerequisite Guard ---
    // For any compound/combo trigger (A + B), BOTH constituent triggers MUST be present in hitSet.
    // If either constituent is missing from the match, the combo trigger is strictly pruned.
    const comboPrerequisites: Record<string, string[][]> = {
        "Seer score on draw >= 35%+1X2 Rating < 3.0": [
            ["Seer score on draw >= 35% to <40%", "Seer score on draw >= 40%"],
            ["1X2 Rating < 3.0"]
        ],
        "Both team GS => 1.8+Mfav GS = Und Gs +-0.2": [
            ["Both team GS => 1.8"],
            ["Mfav GS = Und Gs +-0.2"]
        ],
        "Underdog odds <= 2.80+Both team GS => 1.8": [
            ["Underdog odds <= 2.80", "Underdog odds <=2.7"],
            ["Both team GS => 1.8"]
        ],
        "Underdog has >= 5 more points on point system+Mfav is playing at home": [
            ["Underdog has >= 5 more points on point system"],
            ["Mfav is playing at home"]
        ],
        "Underdog has hidden strength+Underdog is at home": [
            ["Underdog has hidden strength"],
            ["Underdog is at home"]
        ],
        "Odds for underdog >= 2.80 to 3.0+Match belongs to Northern ireland": [
            ["Odds for underdog >= 2.80 to 3.0"],
            ["Match belongs to Northern ireland"]
        ],
        "L10: Mfav Wins+ Draws < Underdog wins +Draws+Odds for underdog >= 2.80 to 3.0": [
            ["L10: Mfav Wins+ Draws < Underdog wins +Draws"],
            ["Odds for underdog >= 2.80 to 3.0"]
        ],
        "L10: Mfav Wins+ Draws < Underdog wins +Draws+Underdog has higher L10 than Mfav": [
            ["L10: Mfav Wins+ Draws < Underdog wins +Draws"],
            ["Underdog has higher L10 than Mfav"]
        ],
        "Underdog has hidden weakness+Match has PHA TIE tag": [
            ["Underdog has hidden weakness"],
            ["Match has PHA TIE tag"]
        ],
        "Match belongs to Sweden: Superettan+Match has PHA TIE tag": [
            ["Match belongs to Sweden: Superettan"],
            ["Match has PHA TIE tag"]
        ],
        "Both team GS => 1.8 + Mfav GA close to Ud GA (+-0.2)": [
            ["Both team GS => 1.8"],
            ["Mfav GA=Und GA (+-0.2)", "Mfav GA close to Ud GA (+-0.2)"]
        ],
        "1X2 Rating < 3.0+MFav TS <=1.2": [
            ["1X2 Rating < 3.0"],
            ["MFav TS <=1.2"]
        ],
        "Mfav GS = Und Gs +-0.2+ 1X2 Rating < 3.0": [
            ["Mfav GS = Und Gs +-0.2"],
            ["1X2 Rating < 3.0"]
        ],
        "LE was a draw+1X2 Rating < 3.0": [
            ["LE was a draw"],
            ["1X2 Rating < 3.0"]
        ],
        "M.fav has hidden weakness+Mfav GS = Und Gs +-0.2": [
            ["M.fav has hidden weakness"],
            ["Mfav GS = Und Gs +-0.2"]
        ],
        "M.fav has hidden strength+Underdog has hidden strength": [
            ["M.fav has hidden strength"],
            ["Underdog has hidden strength"]
        ],
        "Underdog has hidden weakness+M.fav has hidden weakness": [
            ["Underdog has hidden weakness"],
            ["M.fav has hidden weakness"]
        ],
        "Both teams GA >= 1.1 +Pha Underdog and Pha draw both >20%": [
            ["Both teams GA >= 1.1 (volatile match)"],
            ["Pha Underdog and Pha draw both >20%"]
        ],
        "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA": [
            ["Mfav GS = Und Gs +-0.2"],
            ["Mfav GA=>Und GA", "Mfav GA=Und GA (+-0.2)"]
        ],
        "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength": [
            ["Mfav GS = Und Gs +-0.2"],
            ["Underdog has hidden strength"]
        ],
        "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA": [
            ["Mfav GS = Und Gs +-0.2"],
            ["Und GA <Mfav GA"]
        ],
        "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)": [
            ["Mfav GS = Und Gs +-0.2"],
            ["Mfav GA=Und GA (+-0.2)", "Mfav GA close to Ud GA (+-0.2)"]
        ],
        "Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%": [
            ["Mfav GS=>2.0=Underdog GA +-0.2"],
            ["Seer score on draw >= 35% to <40%", "Seer score on draw >= 40%"]
        ],
        "Youth League (U21,U20,U19)+ Both team GS => 1.8": [
            ["Youth League U19", "Youth League U20", "Youth League U21"],
            ["Both team GS => 1.8"]
        ],
        "Match belongs to Estonia Leagues +Youth League (U21,U20,U19)": [
            ["Match belongs to Estonia Leagues"],
            ["Youth League U19", "Youth League U20", "Youth League U21"]
        ],
        "Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)": [
            ["Mfav L10 = Und L10"],
            ["Both teams GA >= 1.1 (volatile match)"]
        ],
        "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1": [
            ["Mfav L10 = Und L10"],
            ["Mfav L10 and Underdog L10 difference <= 1"]
        ],
        "Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal": [
            ["Mfav GS = Und Gs +-0.2"],
            ["Mfav is away but was home last LE won with <=1 goal"]
        ],
        "LE was a draw + Mfav L10 = Und L10": [
            ["LE was a draw"],
            ["Mfav L10 = Und L10"]
        ],
        "LE was a draw + Mfav has hidden strength": [
            ["LE was a draw"],
            ["M.fav has hidden strength"]
        ]
    };

    for (const [comboName, reqGroups] of Object.entries(comboPrerequisites)) {
        if (hitSet.has(comboName)) {
            const allReqsMet = reqGroups.every(group => group.some(t => hitSet.has(t)));
            if (!allReqsMet) {
                hitSet.delete(comboName);
            }
        }
    }

    return hitSet;
}

export interface MatchCountryAndLeague {
    country: string;
    league: string;
    display: string;
}

export function isWomenLeagueOrMatch(rawLeague?: string, teams?: string): boolean {
    const l = (rawLeague || '').trim();
    const t = (teams || '').trim();

    const isTeamWomen = (teamName: string): boolean => {
        const clean = teamName.trim();
        if (/(?:&|\band)\s+W$/i.test(clean)) return false;
        return /(?:\s+W|\s*\(\s*W\s*\)|\s+Women|\s+Femenin[oa]|\s+Femenil|\s+Fem\.?|\s+Ladies|\s+Frauen|\s+Kvinner|\s+Dam)$/i.test(clean);
    };

    if (t) {
        const parts = t.split(/\s+vs\.?\s+|\s+-\s+/i).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
            if (parts.every(isTeamWomen)) return true;
            if (parts.some(p => /(?:\s*\(\s*W\s*\)|\s+Women|\s+Femenin[oa]|\s+Femenil|\s+Ladies|\s+Frauen|\s+Kvinner)$/i.test(p))) return true;
        } else if (parts.length === 1 && isTeamWomen(parts[0])) {
            return true;
        }
    }

    if (l) {
        if (/\b(?:women(?:'s)?|femenin[oa]|femenil|frauen(?:liga)?|femminile|femmes|feminino|kobiety|ženy|zeny|kvindeliga(?:en)?|damallsvenskan|toppserien|elitserien\s*women|nwsl|usl\s*super\s*league|wsl|fa\s*wsl|liga\s*f|arkema\s*premi[eè]re\s*ligue|d1\s*arkema|division\s*1\s*f[eé]minine)\b/i.test(l)) {
            return true;
        }
        if (/(?:\s+W|\s*\(\s*(?:W|Women|Fem\.?)\s*\))$/i.test(l)) {
            return true;
        }
    }

    return false;
}

export function appendWomenSuffix(leagueName: string, isWomen: boolean): string {
    if (!leagueName) return leagueName;
    let cleaned = leagueName
        .replace(/\s*\(\s*(?:women|w|fem\.?|femenin[oa])\s*\)\s*$/i, '')
        .replace(/\s+(?:women(?:'s)?|femenin[oa]|femenil|femminile|femmes|feminino|frauen|w)\s*$/i, '')
        .replace(/^frauen[-\s]+/i, '')
        .trim();
    if (!cleaned) cleaned = leagueName.trim();
    if (isWomen) {
        return /\s+W$/i.test(cleaned) ? cleaned.replace(/\s+w$/i, ' W') : `${cleaned} W`;
    }
    return cleaned;
}

export const getMatchCountryAndLeague = (match: Match): MatchCountryAndLeague => {
    let country = (match.country || (match as any).data?.country || '').trim();
    let league = (match.league || (match as any).data?.league || '').trim();
    const teamsStr = (match.teams || (match as any).data?.teams || '').trim();
    const isWomen = isWomenLeagueOrMatch(league, teamsStr);

    // 0. Clean trailing/attached "Predictions" or "Prediction"
    league = league.replace(/\s*predictions?\b/gi, '').trim();
    if (/\s+vs\.?\s+/i.test(league)) {
        league = '';
    }

    // 1. If league contains country (e.g. "Romania: Liga 2", "Romania - Liga 2", "Kenya: Sofapaka league")
    if ((!country || country === 'Unknown') && league) {
        if (league.includes(':')) {
            const parts = league.split(':');
            if (parts.length >= 2) {
                country = parts[0].trim();
                league = parts.slice(1).join(':').trim();
            }
        } else if (league.includes(' - ')) {
            const parts = league.split(' - ');
            if (parts.length >= 2) {
                country = parts[0].trim();
                league = parts.slice(1).join(' - ').trim();
            }
        }
    }

    // No guessing: league/country come strictly from NerdyTips data. Team-name inference removed.
    if (!league || /^unknown$/i.test(league)) league = '';
    if (!country || /^unknown$/i.test(country)) country = '';

    let display = league ? appendWomenSuffix(league, false) : '';
    if (display && display !== 'Unknown') {
        // Normalize Championship to EFL Championship if in England
        if (/^championship$/i.test(display.trim()) && (!country || /england/i.test(country))) {
            display = 'EFL Championship';
        }
        // Normalize Brazilian Serie A
        if (/^s[eé]rie\s*a$/i.test(display.trim()) && country && /brazil/i.test(country)) {
            display = 'Campeonato Brasileiro Série A';
        }
        // Normalize Iraqi Stars League
        if (/iraq/i.test(country) || /iraqi/i.test(country) || /\biraq/i.test(display) || /\biraqi/i.test(display) || /\b(?:al\s*kahraba|zakho|mosul|duhok|al\s*mina|al\s*shorta|al\s*zawra)\b/i.test(match.teams || '')) {
            display = 'Iraqi stars league';
            country = 'Iraq';
        }

        const isEnglishPremierLeague = /^premier\s*league$/i.test(display.trim()) && (!country || /england|united\s*kingdom|uk|world/i.test(country));
        const isStandaloneMajor = isEnglishPremierLeague || /^(?:la\s*liga|serie\s*a|bundesliga|ligue\s*1|fa\s*cup|carabao\s*cup.*|copa\s*del\s*rey|coppa\s*italia|dfb[- ]pokal|primeira\s*liga|eredivisie|belgian\s*pro\s*league|s[uü]per\s*lig|czech\s*first\s*league|campeonato\s*brasileiro\s*s[eé]rie\s*a|efl\s*championship|uefa.*|champions\s*league|europa\s*league|conference\s*league|copa\s*libertadores|copa\s*sudamericana|gulf\s*club\s*champions\s*league|caf.*|afc.*)$/i.test(display.trim());

        if (!isStandaloneMajor && country && country !== 'World' && country !== 'Unknown' && country !== 'UEFA') {
            const cLower = country.toLowerCase();
            const dLower = display.toLowerCase();
            if (!dLower.includes(cLower)) {
                display = `${country} ${display}`.trim();
            }
        }

        if (isWomen) {
            display = appendWomenSuffix(display, true);
        }
    } else {
        display = '';
    }

    if (display && display !== league) {
        league = display;
    }

    return { country, league, display };
};

export interface CanonicalLeagueResult {
    canonicalLeague: string;
    canonicalCountry: string;
    triggerName: string;
}

export const TOURNAMENT_STAGE_SUFFIX_RE = /^(?:qualifications?|qualifiers?|play[- ]?offs?|group\s*[a-z0-9]*|round\s*\d+|stage\s*\d+|finals?|semi[- ]?finals?|quarter[- ]?finals?|preliminary\s*round|relegation|promotion|clausura|apertura)$/i;

export function canonicalizeLeagueName(rawLeague?: string, rawCountry?: string, teams?: string): CanonicalLeagueResult {
    let league = (rawLeague || '').trim().replace(/\s*predictions?\b/gi, '').trim();
    let country = (rawCountry || '').trim();
    const isWomen = isWomenLeagueOrMatch(league, teams);

    // Clean colons
    if (league.includes(':')) {
        const parts = league.split(':');
        if (!country || country === 'Unknown') country = parts[0].trim();
        league = parts.slice(1).join(':').trim();
    } else if (league.includes(' - ')) {
        const parts = league.split(' - ');
        const rightSide = parts.slice(1).join(' - ').trim();
        // Preserve competition name when the suffix is a tournament stage (e.g. "Africa Cup of Nations - Qualification")
        if (!TOURNAMENT_STAGE_SUFFIX_RE.test(rightSide)) {
            if (!country || country === 'Unknown') country = parts[0].trim();
            league = rightSide;
        }
    }

    const baseLeague = appendWomenSuffix(league, false);
    const lLower = baseLeague.toLowerCase();
    const cLower = country.toLowerCase();

    const finish = (canonLeague: string, canonCountry: string): CanonicalLeagueResult => {
        const finalLeague = appendWomenSuffix(canonLeague, isWomen);
        return {
            canonicalLeague: finalLeague,
            canonicalCountry: canonCountry,
            triggerName: `Match belongs to ${finalLeague}`
        };
    };

    // Standalone Majors & Continental
    if (/\bpremier\s*league\b/i.test(lLower) && (cLower === 'england' || cLower === 'united kingdom' || cLower === 'uk' || cLower === 'world' || !country || cLower === 'unknown')) {
        return finish('Premier League', 'England');
    }
    if (/\b(?:champions\s*league|ucl)\b/i.test(lLower) && !/\b(?:gulf|afc|caf|concacaf)\b/i.test(lLower)) {
        return finish('UEFA Champions League', 'World');
    }
    if (/\b(?:europa\s*league|uel)\b/i.test(lLower)) {
        return finish('UEFA Europa League', 'World');
    }
    if (/\b(?:conference\s*league|uecl)\b/i.test(lLower)) {
        return finish('UEFA Conference League', 'World');
    }
    if (/\b(?:gulf\s*club\s*champions\s*league|agcff)\b/i.test(lLower)) {
        return finish('Gulf Club Champions League', 'World');
    }
    if (/\b(?:segunda\s*divisi[oó]n|segunda\s*division|laliga\s*2|laliga\s*hypermotion|hypermotion)\b/i.test(lLower) && (cLower === 'spain' || !country || cLower === 'unknown')) {
        return finish('Segunda División', 'Spain');
    }
    if (/\b(?:la\s*liga|primera\s*divisi[oó]n|laliga\s*ea\s*sports|liga\s*f)\b/i.test(lLower) && (cLower === 'spain' || !country || cLower === 'unknown')) {
        return finish('La Liga', 'Spain');
    }
    if (/\b(?:copa\s*del\s*rey|spanish\s*cup|king'?s\s*cup)\b/i.test(lLower)) {
        return finish('Copa del Rey', 'Spain');
    }
    if (/\b(?:serie\s*a|italian\s*serie\s*a)\b/i.test(lLower) && (cLower === 'italy' || !country || cLower === 'unknown')) {
        return finish('Serie A', 'Italy');
    }
    if (/\b(?:coppa\s*italia|italian\s*cup)\b/i.test(lLower)) {
        return finish('Coppa Italia', 'Italy');
    }
    if (/\b(?:bundesliga|1\.\s*bundesliga|german\s*bundesliga)\b/i.test(lLower) && (cLower === 'germany' || !country || cLower === 'unknown')) {
        return finish('Bundesliga', 'Germany');
    }
    if (/\b(?:dfb[- ]pokal|german\s*cup)\b/i.test(lLower)) {
        return finish('DFB-Pokal', 'Germany');
    }
    if (/\b(?:ligue\s*1|french\s*ligue\s*1)\b/i.test(lLower) && (cLower === 'france' || !country || cLower === 'unknown')) {
        return finish('Ligue 1', 'France');
    }
    if (/\b(?:coupe\s*de\s*france|french\s*cup)\b/i.test(lLower)) {
        return finish('Coupe de France', 'France');
    }
    if (/\b(?:fa\s*cup|english\s*fa\s*cup)\b/i.test(lLower) && (cLower === 'england' || !country || cLower === 'unknown')) {
        return finish('FA Cup', 'England');
    }
    if (/\b(?:carabao\s*cup|efl\s*cup|english\s*league\s*cup)\b/i.test(lLower) && (cLower === 'england' || !country || cLower === 'unknown')) {
        return finish('Carabao Cup (EFL Cup)', 'England');
    }
    if (/\b(?:championship|efl\s*championship)\b/i.test(lLower) && (cLower === 'england' || !country || cLower === 'unknown')) {
        return finish('EFL Championship', 'England');
    }
    if (/\b(?:primeira\s*liga|liga\s*portugal|liga\s*nos)\b/i.test(lLower)) {
        return finish('Primeira Liga', 'Portugal');
    }
    if (/\b(?:eredivisie|dutch\s*eredivisie)\b/i.test(lLower)) {
        return finish('Eredivisie', 'Netherlands');
    }
    if (/\b(?:belgian\s*pro\s*league|jupiler\s*pro\s*league|pro\s*league)\b/i.test(lLower) && (cLower === 'belgium' || !country || cLower === 'unknown')) {
        return finish('Belgian Pro League', 'Belgium');
    }
    if (/\b(?:s[uü]per\s*lig|turkish\s*super\s*lig|trendyol\s*s[uü]per\s*lig)\b/i.test(lLower)) {
        return finish('Süper Lig', 'Turkey');
    }
    if (/\b(?:czech\s*first\s*league|chance\s*liga|fortuna\s*liga|czech\s*liga)\b/i.test(lLower)) {
        return finish('Czech First League', 'Czech Republic');
    }
    if (/\b(?:campeonato\s*brasileiro\s*s[eé]rie\s*a|brasileir[aã]o|s[eé]rie\s*a)\b/i.test(lLower) && (cLower === 'brazil' || cLower.includes('brazil'))) {
        return finish('Campeonato Brasileiro Série A', 'Brazil');
    }
    if (/\b(?:copa\s*libertadores|libertadores)\b/i.test(lLower)) {
        return finish('Copa Libertadores', 'World');
    }
    if (/\b(?:copa\s*sudamericana|sudamericana)\b/i.test(lLower)) {
        return finish('Copa Sudamericana', 'World');
    }
    if (/\b(?:zambia|mtn\s*super\s*league)\b/i.test(lLower) || (cLower === 'zambia' && /super\s*league/i.test(lLower))) {
        return finish('Zambia Super League', 'Zambia');
    }
    if (/\b(?:egypt|egyptian)\b/i.test(lLower) || (cLower === 'egypt' && /premier\s*league/i.test(lLower))) {
        return finish('Egypt Premier League', 'Egypt');
    }
    if (cLower === 'egypt' && /\b(?:league\s*cup|cup)\b/i.test(lLower)) {
        return finish('Egypt League Cup', 'Egypt');
    }
    if (cLower === 'argentina' && /reserve/i.test(lLower)) {
        return finish('Argentina Reserve League', 'Argentina');
    }
    if (cLower === 'argentina' && /liga\s*profesional|primera/i.test(lLower)) {
        return finish('Argentina Primera LPF', 'Argentina');
    }
    if (/\b(?:australian\s*championship|australia\s*championship)\b/i.test(lLower) || (cLower === 'australia' && /championship/i.test(lLower))) {
        return finish('Australian Championship', 'Australia');
    }
    if (/\b(?:iraq|iraqi)\b/i.test(lLower) || cLower === 'iraq' || /\b(?:stars\s*league)\b/i.test(lLower)) {
        return finish('Iraqi stars league', 'Iraq');
    }

    // Clean subdivisions / stages so leagues are never combined with tournament stages
    let cleanedLeague = baseLeague
      .replace(/,\s*(?:reserves?|clausura|apertura|group\s*[a-z0-9]|torneo\s*[a-z0-9]|phase\s*\d|stage\s*\d|round\s*\d|play[- ]?offs?)\b/gi, '')
      .replace(/\s*-\s*(?:clausura|apertura|group\s*[a-z0-9]|stage\s*\d|round\s*\d)\b/gi, '')
      .trim();

    // Default Domestic Prefixing: if country is known and not already prefixed, prefix country
    let display = cleanedLeague;
    if (country && country !== 'World' && country !== 'Unknown' && country !== 'UEFA' && country !== 'International') {
        if (!display.toLowerCase().includes(country.toLowerCase())) {
            display = `${country} ${display}`.trim();
        }
    }

    return finish(display, country);
}

export * from './opwCatalog';


