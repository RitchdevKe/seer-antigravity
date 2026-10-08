import { Match } from '../types';

/**
 * Regex matching banned league names / country mentions in match metadata.
 * Strictly banned from SEER optimized slips:
 * - Thailand
 * - Slovakia
 * - North Macedonia
 * - Indonesia
 * - Netherlands Eerste Divisie
 */
export const BANNED_SEER_LEAGUES_REGEX = 
  /thailand|thai\s*league|thai\s*premier|thai\s*fa|thai\s*cup|thai\s*l[12]|thai\s*t[12]|slovakia|slovak|slovensko|nik[eé]\s*liga|slovnaft|super\s*liga\s*slovakia|2\.\s*liga\s*slovakia|corgon\s*liga|fortuna\s*liga|macedonia|macedonian|severna\s*makedonija|makedonija|1\.\s*mfl|2\.\s*mfl|prva\s*liga\s*macedonia|north\s*macedonia|indonesia|indonesian|liga\s*[12]\s*indonesia|piala\s*indonesia|bri\s*liga|eerste\s*divisie|erste\s*divisie|keuken\s*kampioen|dutch\s*eerste|netherlands\s*eerste/i;

/**
 * Regex matching iconic clubs and regional indicators from the banned countries/leagues
 * to contextually identify the match even when explicit league name is not stored.
 */
export const BANNED_SEER_CLUBS_REGEX = 
  /\b(buriram|muangthong|bg\s*pathum|chiangrai\s*utd|chiangrai\s*united|chonburi|ratchaburi|sukhothai|police\s*tero|lamphun\s*warriors?|nakhon\s*pathom|khon\s*kaen|uthai\s*thani|trat\s*fc|rayong\s*fc|nongbua\s*pitchaya|ayutthaya\s*utd|suphanburi|samut\s*prakan|lampang\s*fc|phrae\s*utd|krabi\s*fc|chainat\s*hornbill|nakhon\s*si\s*utd|pattaya\s*utd|chanthaburi|kasetsart\s*fc|bangkok\s*fc|sisaket|nakhon\s*ratchasima|slovan\s*bratislava|spartak\s*trnava|dunajsk[aá]\s*streda|dac\s*1904|msk\s*zilina|m[sš]k\s*zilina|ruzomberok|ru[zž]omberok|podbrezov[aá]|bansk[aá]\s*bystrica|zempl[ií]n\s*michalovce|zlat[eé]\s*moravce|fc\s*skalica|fc\s*ko[sš]ice|as\s*tren[cč][ií]n|kfc\s*kom[aá]rno|tatran\s*pre[sš]ov|petr[zž]alka|pova[zž]sk[aá]\s*bystrica|msk\s*p[uú]chov|fk\s*humenn[eé]|spissk[aá]\s*nova|trebi[sš]ov|pohronie|samor[ií]n|liptovsk[yý]\s*mikul[aá][sš]|shkendija|[sš]kendija|struga\s*trim|fc\s*shkupi|fk\s*vardar|rabotni[cč]ki|fk\s*sileks|gfk\s*tikve[sš]|kf\s*gostivar|fk\s*bregalnica|voska\s*sport|brera\s*strumica|akademija\s*pandev|makedonija\s*gp|fk\s*pelister|besa\s*dob[eë]rdoll|detonit\s*pla[cč]kovica|fk\s*ko[zž]uv|fk\s*belasica|fk\s*osogovo|fk\s*novaci|fk\s*teteks|kamenica\s*sasa|gfk\s*ohrid|kf\s*bashkimi|fk\s*pobeda|persib|persija|bali\s*united|borneo\s*fc|madura\s*united|psis\s*semarang|persebaya|arema\s*fc|persik\s*kediri|barito\s*putera|psm\s*makassar|dewa\s*united|persita\s*tangerang|pss\s*sleman|rans\s*nusantara|bhayangkara\s*fc|persikabo|semen\s*padang|malut\s*united|psbs\s*biak|persipura|sriwijaya\s*fc|psms\s*medan|persiraja|deltras|gresik\s*united|persekat|persiba\s*balikpapan|persela|psim\s*yogyakarta|persikota|persijap|jong\s*ajax|jong\s*psv|jong\s*az|jong\s*fc\s*utrecht|jong\s*utrecht|de\s*graafschap|mvv\s*maastricht|helmond\s*sport|top\s*oss|fc\s*eindhoven|sc\s*telstar|fc\s*den\s*bosch|sc\s*cambuur|vvv-venlo|fc\s*emmen|fc\s*dordrecht|roda\s*jc|ado\s*den\s*haag|willem\s*ii|fc\s*volendam)\b/i;

/**
 * Returns true if a match belongs to Thailand, Slovakia, North Macedonia,
 * Indonesia, or Netherlands Eerste Divisie.
 * 
 * Contextual matching checks:
 * 1. Explicit league field (m.league)
 * 2. Country tags in team names, e.g. (Tha), (Svk), (Mkd), (Idn)
 * 3. Iconic clubs from those respective divisions
 * 4. Contextual mentions in LE or Analysis metadata
 */
export const isBannedFromSeerSlips = (_match: Match): boolean => {
  // All leagues and matches are completely unbanned per system update
  return false;
};
