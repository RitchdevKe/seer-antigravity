import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import * as fsSync from "fs";
import { exec } from "child_process";
import axios from "axios";
import * as cheerio from "cheerio";
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { GoogleGenAI, Type } from "@google/genai";
import * as dotenv from 'dotenv';
dotenv.config();

import cors from 'cors';
import dbApi, { pgPool } from './src/server/dbApi.js';
import { canonicalizeLeagueName, TOURNAMENT_STAGE_SUFFIX_RE } from "./src/utils/opwCommon";
import { registerDiscoveredLeagueTrigger, BASELINE_20_LEAGUES } from "./src/utils/opwCatalog";

// Support both ESM and CJS for path resolution
// @ts-ignore
const _filename = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url);
// @ts-ignore
const _dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(_filename);

// Helper for fuzzy matching
const getDiceCoefficient = (s1: string, s2: string) => {
  const n1 = s1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const n2 = s2.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (n1 === n2) return 1;
  if (n1.length < 2 || n2.length < 2) return 0;

  const bigrams1 = new Set();
  for (let i = 0; i < n1.length - 1; i++) bigrams1.add(n1.substring(i, i + 2));
  const bigrams2 = new Set();
  for (let i = 0; i < n2.length - 1; i++) bigrams2.add(n2.substring(i, i + 2));

  let intersection = 0;
  for (const b of bigrams1) if (bigrams2.has(b)) intersection++;

  return (2 * intersection) / (bigrams1.size + bigrams2.size);
};

// Help normalize team names by removing common noise
const normalizeTeamName = (name: string) => {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(fc|cf|u\d+|women|w|afc|fk|sc|sv|united|utd|city|town|youth|rl|1900|b|team|sports)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const getMatchSimilarity = (match1: string, match2: string) => {
  const parts1 = match1.toLowerCase().split(' vs ');
  const parts2 = match2.toLowerCase().split(' vs ');
  if (parts1.length < 2 || parts2.length < 2) return 0;

  const t1a = parts1[0].trim();
  const t1b = parts1[1].trim();
  const t2a = parts2[0].trim();
  const t2b = parts2[1].trim();

  const getScore = (a1: string, b1: string, a2: string, b2: string) => {
    const s1 = getTeamScore(a1, a2);
    const s2 = getTeamScore(b1, b2);
    return (s1 + s2) / 2;
  };

  const getTeamScore = (team1: string, team2: string) => {
    const nt1 = normalizeTeamName(team1);
    const nt2 = normalizeTeamName(team2);
    
    if (nt1 === nt2) return 10;
    if (nt1.includes(nt2) || nt2.includes(nt1)) {
        if (nt1.length >= 3 && nt2.length >= 3) return 9;
    }
    
    const dice = getDiceCoefficient(nt1, nt2);
    if (dice > 0.8) return 9;
    if (dice > 0.6) return 7;

    // Word overlap check
    const w1 = nt1.split(' ').filter(w => w.length >= 2);
    const w2 = nt2.split(' ').filter(w => w.length >= 2);
    if (w1.length === 0 || w2.length === 0) return 0;

    let matches = 0;
    for (const word of w1) {
      if (w2.some(w => w === word || (w.length > 3 && word.length > 3 && (w.includes(word) || word.includes(w))))) {
        matches++;
      }
    }
    return (matches / Math.max(w1.length, w2.length)) * 8;
  };

  const normal = getScore(t1a, t1b, t2a, t2b);
  const reverse = getScore(t1a, t1b, t2b, t2a);
  return Math.max(normal, reverse);
};

let jar = new CookieJar();
const cookieFile = path.join(process.cwd(), 'nerdy_cookies.json');
try {
  if (fsSync.existsSync(cookieFile)) {
    const cookieData = fsSync.readFileSync(cookieFile, 'utf-8');
    if (cookieData) {
      jar = CookieJar.fromJSON(cookieData);
      console.log('[NERDY TIPS] Loaded saved session cookies synchronously.');
    }
  }
} catch (e: any) {
  console.log('[NERDY TIPS] No saved session cookies found, starting fresh:', e.message);
}

// Ensure East Africa Time (UTC+3, offset +180 min) and decimal odds cookies are ALWAYS active
try {
  jar.setCookieSync('tz_offset_v2=180; Domain=nerdytips.com; Path=/', 'https://nerdytips.com');
  jar.setCookieSync('timezone=Africa%2FNairobi; Domain=nerdytips.com; Path=/', 'https://nerdytips.com');
  jar.setCookieSync('timezone_manual=1; Domain=nerdytips.com; Path=/', 'https://nerdytips.com');
  jar.setCookieSync('odds_format=decimal; Domain=nerdytips.com; Path=/', 'https://nerdytips.com');
} catch (err: any) {
  console.warn('[NERDY TIPS] Could not pre-seed timezone cookies:', err.message);
}
const client = wrapper(axios.create({ jar }));

function getNerdyTipsDateString(targetDateStr: string): string {
  const activeDate = new Date(targetDateStr + "T12:00:00Z");
  
  const today = new Date();
  const currentEAT = new Date(today.getTime() + (3 * 60 * 60 * 1000));
  const todayDateStr = currentEAT.toISOString().split('T')[0];
  const todayBase = new Date(todayDateStr + "T12:00:00Z");

  const diffTime = activeDate.getTime() - todayBase.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === -3) return "yestarday2";
  if (diffDays === -2) return "yestarday1";
  if (diffDays === -1) return "yestarday";
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tommorow";
  if (diffDays === 2) return "tommorow1";
  if (diffDays === 3) return "tommorow2";

  return targetDateStr; // Fallback to YYYY-MM-DD
}

interface RawScrapedMatchRow {
  html: string;
  time: string;
  teamA: string;
  teamB: string;
  teamsStr: string;
  matchUrl: string;
  scoreH: string;
  scoreA: string;
  result: string;
  mo: string;
  pred1x2: string;
  rating1x2: string;
  gs: string;
  trust: string;
  targetDate: string;
  league?: string;
  country?: string;
}

function sanitizeMatchOdds(mo?: string | null): string {
  if (!mo || mo === 'Unknown' || mo === '-') return 'Unknown';
  const parts = String(mo)
    .split(/[- ,]+/)
    .map(s => s.replace(/[^0-9.]/g, '').trim())
    .filter(s => s.length > 0 && !isNaN(parseFloat(s)) && parseFloat(s) > 0);
  return parts.length > 0 ? parts.join(',') : 'Unknown';
}

function formatDomesticLeagueName(league?: string, country?: string, teams?: string): string {
  if (!league) return '';
  const canon = canonicalizeLeagueName(league, country, teams);
  return canon.canonicalLeague;
}

let persistLeagueQueue: Promise<any> = Promise.resolve();

async function persistDiscoveredLeagueTrigger(triggerName: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    persistLeagueQueue = persistLeagueQueue.then(async () => {
      try {
        const res = await _doPersistDiscoveredLeagueTrigger(triggerName);
        resolve(res);
      } catch (err: any) {
        console.error(`[DISCOVERED LEAGUE ERROR] Failed to persist league trigger ${triggerName}:`, err.message);
        resolve(false);
      }
    });
  });
}

async function _doPersistDiscoveredLeagueTrigger(triggerName: string): Promise<boolean> {
  if (!triggerName.startsWith("Match belongs to ") && !triggerName.startsWith("Match belong to ")) return false;
  if (triggerName.toLowerCase().includes("unknown") || triggerName.toLowerCase().includes("leagues")) return false;

  const dataDir = path.join(process.cwd(), "data");
  const rulesFilePath = path.join(dataDir, "opw_rules.json");
  if (!fsSync.existsSync(rulesFilePath)) return false;

  try {
    const raw = await fs.readFile(rulesFilePath, "utf-8");
    const allRulesData = JSON.parse(raw);
    if (!allRulesData.rules) allRulesData.rules = {};

    let modified = false;
    const isPremier = /^match belongs? to (?:english\s+)?premier\s+league$/i.test(triggerName.trim());
    const isBaseline = BASELINE_20_LEAGUES.has(triggerName);

    const mfavPts = isPremier ? 40 : (isBaseline ? 30 : 5);
    const upsetsPts = isPremier ? 40 : (isBaseline ? 30 : 5);

    const mfavCategories = ['top_12_value', 'best_bet', 'bankers_dlive', 'bankers_jackpot', 'value_picks', 'botb_best', 'top_10_value', 'top12', 'top10', 'banker', 'bankers'];
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    for (const day of days) {
      if (!allRulesData.rules[day]) {
        allRulesData.rules[day] = { savedAt: new Date().toISOString(), categories: {} };
      }
      const cats = allRulesData.rules[day].categories || {};

      for (const mfavCat of mfavCategories) {
        if (cats[mfavCat]) {
          if (Array.isArray(cats[mfavCat].rules)) {
            if (!cats[mfavCat].rules.some((r: any) => r.description === triggerName)) {
              cats[mfavCat].rules.push({ description: triggerName, points: mfavPts });
              modified = true;
            }
          } else if (cats[mfavCat][triggerName] === undefined) {
            cats[mfavCat][triggerName] = mfavPts;
            modified = true;
          }
        }
      }

      const upsetCats = ['upsets', 'underdog_upsets', 'underdog_only', 'upset'];
      for (const uCat of upsetCats) {
        if (cats[uCat]) {
          if (Array.isArray(cats[uCat].rules)) {
            if (!cats[uCat].rules.some((r: any) => r.description === triggerName)) {
              cats[uCat].rules.push({ description: triggerName, points: upsetsPts });
              modified = true;
            }
          } else if (cats[uCat][triggerName] === undefined) {
            cats[uCat][triggerName] = upsetsPts;
            modified = true;
          }
        }
      }
    }

    if (modified) {
      const tempPath = `${rulesFilePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2)}`;
      await fs.writeFile(tempPath, JSON.stringify(allRulesData, null, 2), "utf-8");
      await fs.rename(tempPath, rulesFilePath);
      console.log(`[DISCOVERED LEAGUE] Persisted "${triggerName}" with Mfav: ${mfavPts}, Upsets: ${upsetsPts} to opw_rules.json`);
    }
    return true;
  } catch (err: any) {
    console.error(`[DISCOVERED LEAGUE ERROR] Failed to persist league trigger ${triggerName}:`, err.message);
    return false;
  }
}

function getTodayEATString(): string {
  const now = new Date();
  const eatDate = new Date(now.getTime() + (3 * 3600 * 1000));
  return eatDate.toISOString().split('T')[0];
}

function getDayOffsetEAT(targetDateStr: string): number {
  const todayEatStr = getTodayEATString();
  const [ty, tm, td] = todayEatStr.split('-').map(Number);
  const todayEatUtc = new Date(Date.UTC(ty, tm - 1, td));
  const [y, m, d] = targetDateStr.split('-').map(Number);
  const targetUtc = new Date(Date.UTC(y, m - 1, d));
  return Math.round((targetUtc.getTime() - todayEatUtc.getTime()) / (1000 * 3600 * 24));
}

function getDayOffset(targetDateStr: string): number {
  return getDayOffsetEAT(targetDateStr);
}

async function scrapeAllMatchRowsForDate(client: any, targetDate: string): Promise<RawScrapedMatchRow[]> {
  const offset = getDayOffset(targetDate);
  const pageUrl = `https://nerdytips.com/all-matches?d=${offset}`;

  console.log(`[NERDY SCRAPER] Fetching page ${pageUrl} for date ${targetDate} (offset ${offset})...`);
  let pageRes;
  try {
    pageRes = await client.get(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': 'tz_offset_v2=180; timezone=Africa%2FNairobi; timezone_manual=1; odds_format=decimal'
      }
    });
  } catch (e: any) {
    console.error(`[NERDY SCRAPER] Failed to load ${pageUrl}:`, e.message);
    return [];
  }

  const $ = cheerio.load(pageRes.data);

  // Check rendered timezone offset on html[data-server-tz]
  const serverTzAttr = $('html').attr('data-server-tz');
  const serverTzMinutes = serverTzAttr ? parseInt(serverTzAttr, 10) : 180;
  const tzDiffHours = (180 - (isNaN(serverTzMinutes) ? 180 : serverTzMinutes)) / 60;

  // Map every group key to its league and country from the page headers
  const groupMeta: Record<string, { league: string; country: string }> = {};

  interface ScrapedEntry {
    html: string;
    league?: string;
    country?: string;
  }
  const allRowEntries: ScrapedEntry[] = [];
  const seenInitialUrls = new Set<string>();

  // 1. Iterate over every .group container on the page (excluding promotional containers like #lg-free)
  $('.group').each((_, el) => {
    const groupEl = $(el);
    if (groupEl.closest('#lg-free').length > 0 || groupEl.is('#lg-free')) return;

    const k = groupEl.attr('data-lg-k') || groupEl.find('[data-lg-k]').attr('data-lg-k');
    let league = groupEl.find('.lgl .text-heading, .lgl h3, [data-lg-head] .text-heading, .league-title, .competition-title').first().text().trim();
    let country = groupEl.find('.lgl .text-muted, [data-lg-head] .text-muted, .country-name').first().text().trim();
    if (!country) {
      const flagSrc = groupEl.find('img[src*="flags"]').attr('src') || '';
      const flagM = flagSrc.match(/flags\/([^\/.]+)\.svg/i);
      if (flagM) country = decodeURIComponent(flagM[1]).replace(/_/g, ' ');
    }
    if (!league) {
      league = groupEl.find('.lgl').first().text().trim();
    }
    if (!country && league) {
      if (league.includes(':')) {
        const parts = league.split(':');
        country = parts[0].trim();
        league = parts.slice(1).join(':').trim();
      } else if (league.includes(' - ')) {
        const parts = league.split(' - ');
        const rightSide = parts.slice(1).join(' - ').trim();
        if (!TOURNAMENT_STAGE_SUFFIX_RE.test(rightSide)) {
          country = parts[0].trim();
          league = rightSide;
        }
      }
    }

    if (league.toLowerCase().includes("free prediction")) return;

    if (k) {
      groupMeta[k] = { league, country };
    }

    groupEl.find('a[href*="/match-details/"]').each((_, matchEl) => {
      const u = $(matchEl).attr('href');
      if (u) seenInitialUrls.add(u);
      allRowEntries.push({
        html: $.html(matchEl),
        league: league || undefined,
        country: country || undefined
      });
    });
  });

  // Also catch any standalone [data-lg-k] elements that may not have used .group
  $('[data-lg-k]').each((_, el) => {
    const k = $(el).attr('data-lg-k');
    if (!k || groupMeta[k]) return;
    const groupEl = $(el).closest('.group').length ? $(el).closest('.group') : $(el).parent();
    let league = groupEl.find('.lgl .text-heading, .lgl h3, [data-lg-head] .text-heading, .league-title, .competition-title').first().text().trim();
    let country = groupEl.find('.lgl .text-muted, [data-lg-head] .text-muted, .country-name').first().text().trim();
    if (league) groupMeta[k] = { league, country };
  });

  // Include any initial match-details outside .group containers
  $('a[href*="/match-details/"]').each((_, el) => {
    if ($(el).closest('#lg-free').length > 0) return;
    const u = $(el).attr('href');
    if (u && !seenInitialUrls.has(u)) {
      seenInitialUrls.add(u);
      const parentGroup = $(el).closest('.group, [data-lg-head], section');
      const pLeague = parentGroup.find('.lgl .text-heading, .text-heading').first().text().trim() || undefined;
      const pCountry = parentGroup.find('.lgl .text-muted, .text-muted').first().text().trim() || undefined;
      allRowEntries.push({ html: $.html(el), league: pLeague, country: pCountry });
    }
  });

  const groupKeys: string[] = Object.keys(groupMeta);

  if (groupKeys.length > 0) {
    const chunkPromises = [];
    for (let i = 0; i < groupKeys.length; i += 20) {
      const chunk = groupKeys.slice(i, i + 20);
      const rowsUrl = `https://nerdytips.com/all-matches/rows?d=${offset}&g=${encodeURIComponent(chunk.join(','))}`;

      chunkPromises.push(client.get(rowsUrl, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cookie': 'tz_offset_v2=180; timezone=Africa%2FNairobi; timezone_manual=1; odds_format=decimal'
        }
      }).catch((err: any) => {
        console.error(`[NERDY SCRAPER] Failed rows chunk:`, err.message);
        return { data: null };
      }));
    }

    const chunkResults = await Promise.all(chunkPromises);
    for (const cRes of chunkResults) {
      if (cRes?.data?.groups) {
        for (const gk of Object.keys(cRes.data.groups)) {
          const meta = groupMeta[gk] || { league: '', country: '' };
          const $g = cheerio.load(cRes.data.groups[gk]);
          $g('a[href*="/match-details/"]').each((_, el) => {
            allRowEntries.push({
              html: $g.html(el),
              league: meta.league || undefined,
              country: meta.country || undefined
            });
          });
        }
      }
    }
  }

  console.log(`[NERDY SCRAPER] Date ${targetDate}: Collected ${allRowEntries.length} total matches from NerdyTips`);

  // Deduplicate row entries, strictly prioritizing entries that have explicit league metadata
  const entriesByUrl = new Map<string, ScrapedEntry>();
  for (const rowEntry of allRowEntries) {
    const $row = cheerio.load(rowEntry.html);
    const u = $row('a').first().attr('href') || '';
    if (!u) continue;
    const existing = entriesByUrl.get(u);
    if (!existing || (!existing.league && rowEntry.league)) {
      entriesByUrl.set(u, rowEntry);
    }
  }

  const results: RawScrapedMatchRow[] = [];
  const seenUrls = new Set<string>();

  for (const rowEntry of entriesByUrl.values()) {
    const rawHtml = rowEntry.html;
    const $row = cheerio.load(rawHtml);
    const root = $row('a').first();
    const matchUrl = root.attr('href') || '';
    if (matchUrl && seenUrls.has(matchUrl)) continue;
    if (matchUrl) seenUrls.add(matchUrl);

    // True kickoff time on root data-kick attribute, converted to EAT (UTC+3)
    let dataKick = (root.attr('data-kick') || root.find('[data-kick]').attr('data-kick') || '').trim();
    if (dataKick && dataKick.includes(':') && tzDiffHours !== 0) {
      try {
        const [dh, dm] = dataKick.split(':').map(Number);
        if (!isNaN(dh) && !isNaN(dm)) {
          let adjustedH = Math.round(dh + tzDiffHours);
          adjustedH = (adjustedH % 24 + 24) % 24;
          dataKick = `${adjustedH.toString().padStart(2, '0')}:${dm.toString().padStart(2, '0')}`;
        }
      } catch (e) {}
    }

    const time = (dataKick && dataKick.includes(':'))
      ? dataKick
      : (root.find('.tb-mrow__date [data-time], .nt-time [data-time]').attr('data-time') ||
         root.find('.tb-mrow__date [data-time], .nt-time [data-time]').text().trim() || 
         root.find('.tb-mrow__date, .nt-time').text().trim().replace(/[^0-9:]/g, ''));

    const teamLines = root.find('.tb-teamline, .nt-tl');
    let teamA = $row(teamLines[0]).find('.tb-tname, .nt-nm-l, .nt-nm-x').first().text().trim();
    if (!teamA) teamA = $row(teamLines[0]).find('.nt-nm').first().text().trim();

    let teamB = $row(teamLines[1]).find('.tb-tname, .nt-nm-l, .nt-nm-x').first().text().trim();
    if (!teamB) teamB = $row(teamLines[1]).find('.nt-nm').first().text().trim();
    if (!teamA || !teamB) continue;

    let scoreH = root.find('[data-score-h]').first().text().trim() || $row(teamLines[0]).find('.tb-hs, .nt-sc, .tb-score, .score').first().text().trim();
    let scoreA = root.find('[data-score-a]').first().text().trim() || $row(teamLines[1]).find('.tb-hs, .nt-sc, .tb-score, .score').first().text().trim();
    if (!scoreH || !scoreA) {
      const rowScoreMatch = root.text().match(/\b(\d+)\s*[-:]\s*(\d+)\b/);
      if (rowScoreMatch && (root.text().includes('FT') || root.find('.tb-ft, .is-ft').length > 0)) {
        scoreH = rowScoreMatch[1];
        scoreA = rowScoreMatch[2];
      }
    }
    let result = "";
    if (scoreH && scoreA) result = `${scoreH}:${scoreA}`;

    const cleanOdd = (raw: string): string => {
      const cleaned = String(raw || '').replace(/[^0-9.]/g, '').trim();
      const n = parseFloat(cleaned);
      return (!isNaN(n) && n > 0) ? cleaned : '';
    };
    const odds = root.find('.tb-odd__pill, .tb-odd').map((_, o) => cleanOdd($row(o).text())).toArray().filter(Boolean);
    const [odd1, oddX, odd2] = odds;
    const mo = [odd1, oddX, odd2].filter(Boolean).join(',') || "Unknown";

    // 1X2 pick & confidence/rating on the match row
    const pickScoreEl = root.find('.tbm-pickscore');
    const pickCells = root.find('.tb-mcell__pick').map((_, c) => $row(c).text().trim()).toArray();
    let pred1x2Raw = pickScoreEl.find('.tb-mcell__pick').text().trim() ||
                     pickScoreEl.find('.tb-mcell__val').text().trim() ||
                     pickScoreEl.text().trim() ||
                     pickCells[0] || root.find('.tb-tip').text().trim();
    let pred1x2 = normalize1x2(pred1x2Raw, teamA, teamB) || "";

    let rating1x2 = "Unknown";
    const pickScoreTt = pickScoreEl.attr('data-tt') || "";
    const ttMatch = pickScoreTt.match(/trust for ([^\s]+) is ([0-9.]+)\/10/i);
    if (ttMatch) {
      if (!pred1x2) pred1x2 = normalize1x2(ttMatch[1], teamA, teamB) || "";
      rating1x2 = `${ttMatch[2]}/10`;
    }
    if (rating1x2 === "Unknown") {
      const style = pickScoreEl.attr('style') || "";
      const pctMatch = style.match(/--pct:\s*(\d+)%/);
      if (pctMatch) {
        rating1x2 = `${(parseInt(pctMatch[1], 10) / 10).toFixed(1)}/10`;
      }
    }

    // Check best tip cell if 1X2 is still empty or contains double chance tip
    const bestTipEl = root.find('.tbm-besttip');
    const bestTipPick = bestTipEl.find('.tb-mcell__pick').text().trim();
    const normBest = normalize1x2(bestTipPick, teamA, teamB);
    const bestTipTt = bestTipEl.attr('data-tt') || "";
    const bestTtMatch = bestTipTt.match(/best tip is ([^\s]+) with (?:a )?trust of ([0-9.]+)\/10/i) || bestTipTt.match(/best tip is ([^\s]+) with/i);
    const normBestTt = bestTtMatch ? normalize1x2(bestTtMatch[1], teamA, teamB) : null;
    const bestRatingVal = bestTtMatch && bestTtMatch[2] ? `${bestTtMatch[2]}/10` : "Unknown";

    if (!pred1x2) {
      if (normBest) {
        pred1x2 = normBest;
        if (rating1x2 === "Unknown" && bestRatingVal !== "Unknown") rating1x2 = bestRatingVal;
      } else if (normBestTt) {
        pred1x2 = normBestTt;
        if (rating1x2 === "Unknown" && bestRatingVal !== "Unknown") rating1x2 = bestRatingVal;
      }
    }

    // Check all pick cells in the row for 1X or X2 double chance if 1X2 is still empty
    if (!pred1x2) {
      for (const cellText of pickCells) {
        const normCell = normalize1x2(cellText, teamA, teamB);
        if (normCell) {
          pred1x2 = normCell;
          break;
        }
      }
    }

    let gs = pickCells[1] || "Unknown";
    if (gs.length < 2) gs = "Unknown";

    const trustVal = root.find('.tb-trust__val').first().text().trim() || root.find('.am-meta__conf').first().text().trim();
    const trust = trustVal ? `${trustVal}/10` : (root.find('.tb-trust, .tb-conf').text().trim().replace(/Confidence/g, '').trim() || "Unknown");

    let rowLeague = rowEntry.league;
    let rowCountry = rowEntry.country;
    if (rowLeague) {
      rowLeague = formatDomesticLeagueName(rowLeague, rowCountry);
    }

    results.push({
      html: rawHtml,
      time,
      teamA,
      teamB,
      teamsStr: `${teamA} vs ${teamB}`,
      matchUrl,
      scoreH,
      scoreA,
      result,
      mo,
      pred1x2,
      rating1x2,
      gs,
      trust,
      targetDate,
      league: rowLeague,
      country: rowCountry
    });
  }

  return results;
}

async function loginToNerdyTips(client: any, email: string, password: string): Promise<boolean> {
  const loginUrl = "https://nerdytips.com/login";
  try {
    const loginPage = await client.get(loginUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    
    if (loginPage.data.includes('logout') || loginPage.data.includes('Logout')) {
      console.log(`[NERDY TIPS LOGGED IN] Already authenticated with saved cookies.`);
      return true;
    }

    const $login = cheerio.load(loginPage.data);
    const csrfToken = $login('input[name="_csrf"]').val() || $login('input[name="_token"]').val() || '';

    const loginPayload: Record<string, string> = {
      username: email,
      email: email,
      password: password,
      remember: "1",
      login: "Login Now",
      inlineCheckboxLogin: "yes"
    };
    if (csrfToken) {
      loginPayload['_csrf'] = csrfToken as string;
      loginPayload['_token'] = csrfToken as string;
    }

    const loginResponse = await client.post(loginUrl, new URLSearchParams(loginPayload).toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://nerdytips.com',
        'Referer': loginUrl
      }
    });

    let responseData = loginResponse.data;
    if (typeof responseData === 'string') {
      try { responseData = JSON.parse(responseData); } catch (e) {}
    }

    if (responseData?.device_blocked) {
      console.warn(`[NERDY TIPS DEVICE BLOCKED] Device limit reached for account ${email}. Please reset active devices on nerdytips.com.`);
    } else if (responseData?.ok || responseData?.user?.loggedin) {
      console.log(`[NERDY TIPS LOGGED IN] Successfully authenticated (ok: true)`);
      await fs.writeFile(cookieFile, JSON.stringify(jar.toJSON()));
    } else {
      console.warn(`[NERDY TIPS LOGIN FAILED?] Unexpected response: ${typeof responseData === 'string' ? responseData.substring(0, 150) : JSON.stringify(responseData).substring(0, 150)}`);
    }
    return true;
  } catch (err: any) {
    console.warn(`Nerdy Tips login attempt warning: ${err.message}. Proceeding with fetch.`);
    return false;
  }
}

function cleanNerdyResult(result: string): string {
  if (!result) return "";
  
  // 1. Try to find a score pattern with word boundaries (e.g., " 1:0" or " 1-0")
  // This avoids catching numbers attached to team names like "U23"
  const boundaryMatches = result.match(/\b(\d{1,2})\s*[:\-]\s*(\d{1,2})\b/g);
  if (boundaryMatches && boundaryMatches.length > 0) {
    return boundaryMatches[boundaryMatches.length - 1].replace(/\s+/g, '').replace('-', ':');
  }

  // 2. Fallback: Extract only the score pattern (e.g., "1:1" or "1-1")
  const matches = result.match(/(\d+)\s*[:\-]\s*(\d+)/g);
  if (matches && matches.length > 0) {
    // Return the last match found as it's usually the final score
    let lastMatch = matches[matches.length - 1].replace(/\s+/g, '').replace('-', ':');
    
    const parts = lastMatch.split(':');
    let h = parts[0];
    let a = parts[1];
    
    // If home score is suspiciously long or high (e.g., "231"), it likely has a team number prefix
    // Football scores are rarely > 15. If it's higher, we take the last digit as a guess.
    if (h.length >= 2) {
        const hNum = parseInt(h);
        if (hNum > 15) {
            h = h.slice(-1);
        }
    }
    
    // Same for away score - if it's suspiciously high, take the first digit (prefix might be team number)
    if (a.length >= 2) {
        const aNum = parseInt(a);
        if (aNum > 15) {
            a = a.slice(0, 1);
        }
    }
    
    return `${h}:${a}`;
  }
  return result;
}

const ALLOWED_1X2 = ['1', 'X', '2', '1X', 'X2'];

function parseConfidence(confText: string | undefined | null): string {
  if (!confText) return "";
  const clean = confText.trim();
  const m = clean.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:\/\s*10)?/);
  if (m) {
    let num = parseFloat(m[1]);
    if (!isNaN(num)) {
      if (num > 10 && num <= 100) num = num / 10;
      return `${num.toFixed(1)}/10`;
    }
  }
  return "";
}

function parseOdd(str: string | undefined | null): number {
  if (!str) return 0;
  const clean = str.trim();
  if (clean.includes('/')) {
    const parts = clean.split('/');
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    if (!isNaN(num) && !isNaN(den) && den > 0) {
      return (num / den) + 1;
    }
  }
  const val = parseFloat(clean);
  return isNaN(val) ? 0 : val;
}

function normalize1x2(val: string | undefined | null, teamA?: string, teamB?: string): string | null {
  if (!val) return null;
  const clean = val.replace(/[\u25BC\u25B2\u25BE\u25B4\u25B6\u25C0\u25BD\u25B3▼▲▾▴\r\n\t]+/g, ' ').trim();
  const upper = clean.toUpperCase();

  // 1. Direct match with ALLOWED_1X2 ('1', 'X', '2', '1X', 'X2')
  if (ALLOWED_1X2.includes(upper)) return upper;

  // 2. Starts with 1X or X2 (e.g. "1X1.45", "1X & Over 1.5", "1X (1.45)", "1X/Under 3.5")
  if (/^1X\b|^1X[^a-zA-Z]/i.test(upper) || upper.startsWith('1X')) {
    return '1X';
  }
  if (/^X2\b|^X2[^a-zA-Z]/i.test(upper) || upper.startsWith('X2')) {
    return 'X2';
  }

  // 3. Double Chance explicit boundaries (e.g., "Double Chance 1X", "DC 1X", "Pick: 1X")
  if (/\b1X\b/i.test(upper)) return '1X';
  if (/\bX2\b/i.test(upper)) return 'X2';

  // 4. Word-based Double Chance: "1 or X", "1 or Draw", "Draw or 1", "Home or Draw", "1/X", "1-X"
  if (/\b(1\s*(?:or|\/|-)\s*X|X\s*(?:or|\/|-)\s*1|1\s*or\s*draw|draw\s*or\s*1|home\s*or\s*draw|draw\s*or\s*home)\b/i.test(upper)) {
    return '1X';
  }
  if (/\b(2\s*(?:or|\/|-)\s*X|X\s*(?:or|\/|-)\s*2|2\s*or\s*draw|draw\s*or\s*2|away\s*or\s*draw|draw\s*or\s*away)\b/i.test(upper)) {
    return 'X2';
  }

  // 5. Team name based "Team A or draw" / "Team B or draw" if team names provided
  if (teamA && teamB) {
    const normVal = clean.toLowerCase();
    const tALower = teamA.toLowerCase().trim();
    const tBLower = teamB.toLowerCase().trim();
    if (tALower && (normVal.includes(`${tALower} or draw`) || normVal.includes(`draw or ${tALower}`))) return '1X';
    if (tBLower && (normVal.includes(`${tBLower} or draw`) || normVal.includes(`draw or ${tBLower}`))) return 'X2';

    const tAWords = tALower.split(/[\s\-_]+/).filter(w => w.length > 2);
    const tBWords = tBLower.split(/[\s\-_]+/).filter(w => w.length > 2);
    if (tAWords.some(w => normVal.includes(`${w} or draw`) || normVal.includes(`draw or ${w}`))) return '1X';
    if (tBWords.some(w => normVal.includes(`${w} or draw`) || normVal.includes(`draw or ${w}`))) return 'X2';
  }

  // 6. Direct single 1, X, 2 (starts with 1, X, 2 followed by non-alpha/odds or word boundary)
  if (/^1\b|^1[0-9]\./i.test(upper) && !/^1X/i.test(upper)) {
    return '1';
  }
  if (/^X\b|^X[0-9]\./i.test(upper) && !/^X2/i.test(upper)) {
    return 'X';
  }
  if (/^2\b|^2[0-9]\./i.test(upper)) {
    return '2';
  }

  // 7. General regex for standalone 1X, X2, 1, X, 2
  const m = upper.match(/(?<![\.\/]\s*)\b(1X|X2|1|X|2)\b(?!\s*[\.\/])/i);
  if (m && ALLOWED_1X2.includes(m[1].toUpperCase())) return m[1].toUpperCase();

  return null;
}

/**
 * Resilient date parser for H2H Last Encounter (LE) records.
 * Supports:
 * - "MMM DD, YY" or "MMM DD, YYYY" (e.g. "Jul 11, 26" or "Nov 28, 25")
 * - "DD MMM, YY" or "DD MMM YYYY" (e.g. "11 Jul 2026")
 * - "DD.MM.YYYY" or "DD/MM/YYYY" or "DD-MM-YYYY" (e.g. "11.07.2026")
 * - "YYYY-MM-DD"
 */
function parseH2HDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const clean = dateStr.trim();
  if (!clean || clean === '-' || clean === 'NA') return null;

  // Support unix timestamp in seconds (10 digits) or ms (13 digits) e.g. data-nt-dt="1793754000"
  if (/^\d{10,13}$/.test(clean)) {
    const ts = parseInt(clean, 10);
    const d = new Date(clean.length === 10 ? ts * 1000 : ts);
    if (!isNaN(d.getTime())) return d;
  }

  // Try standard parse
  let d = new Date(clean);
  if (!isNaN(d.getTime())) return d;

  // Try "DD.MM.YYYY" or "DD/MM/YYYY" or "DD.MM.YY" from anywhere in string
  const dmyMatch = clean.match(/(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{2,4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // Try "MMM DD, YY" or "MMM DD, YYYY" or "MMM DD" (e.g. "Jul 11, 26" or "Nov 04")
  const mdyMatch = clean.match(/([a-zA-Z]{3,})\s+(\d{1,2})(?:,?\s*['\u2019]?(\d{2,4}))?/);
  if (mdyMatch) {
    const monthStr = mdyMatch[1];
    const day = parseInt(mdyMatch[2], 10);
    let year = mdyMatch[3] ? parseInt(mdyMatch[3], 10) : new Date().getFullYear();
    if (year < 100) year += 2000;
    d = new Date(`${monthStr} ${day}, ${year}`);
    if (!isNaN(d.getTime())) {
      if (d > new Date()) {
        d.setFullYear(d.getFullYear() - 1);
      }
      return d;
    }
  }

  // Try "DD MMM, YY" or "DD MMM YYYY" or "DD MMM" (e.g. "11 Jul 26" or "24 Oct")
  const dmyAlpha = clean.match(/(\d{1,2})\s+([a-zA-Z]{3,})(?:,?\s*['\u2019]?(\d{2,4}))?/);
  if (dmyAlpha) {
    const day = parseInt(dmyAlpha[1], 10);
    const monthStr = dmyAlpha[2];
    let year = dmyAlpha[3] ? parseInt(dmyAlpha[3], 10) : new Date().getFullYear();
    if (year < 100) year += 2000;
    d = new Date(`${monthStr} ${day}, ${year}`);
    if (!isNaN(d.getTime())) {
      if (d > new Date()) {
        d.setFullYear(d.getFullYear() - 1);
      }
      return d;
    }
  }

  return null;
}

async function scrapeNerdyMatchDetails(
  matchUrl: string | undefined,
  teamA: string,
  teamB: string,
  initialGs: string = "Unknown",
  initialPred1x2: string = "",
  mo: string = "Unknown",
  initialRating1x2: string = "Unknown",
  clientParam: any = null
): Promise<{
  gs: string;
  ga: string;
  l10: string;
  le: string;
  pred1x2: string;
  rating1x2: string;
  league?: string;
  country?: string;
  kickoffIso?: string;
  fetchError: string | null;
  attemptsMade: number;
}> {
  let gs = initialGs !== "Unknown" ? initialGs : "Unknown";
  let ga = "Unknown";
  let l10 = "Unknown";
  let le = "Unknown";
  let pred1x2 = normalize1x2(initialPred1x2, teamA, teamB) || "";
  let rating1x2 = (initialRating1x2 && initialRating1x2 !== "Unknown") ? initialRating1x2 : "Unknown";
  let fetchError: string | null = null;

  if (!matchUrl) {
    if (!ALLOWED_1X2.includes(pred1x2)) pred1x2 = "";
    return { gs, ga, l10, le, pred1x2, rating1x2, fetchError: "No match URL", attemptsMade: 0 };
  }

  const urlToFetch = matchUrl.startsWith('http') ? matchUrl : `https://nerdytips.com${matchUrl}`;
  let attemptsMade = 0;

  for (let attempt = 1; attempt <= 3; attempt++) {
    attemptsMade = attempt;
    try {
      if (attempt > 1) {
        console.log(`[Attempt ${attempt}/3] Re-scraping match details for ${teamA} vs ${teamB}...`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else {
        console.log(`Fetching match details for ${teamA} vs ${teamB} (${urlToFetch})`);
      }

      const detailsPage = await client.get(urlToFetch, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const $details = cheerio.load(detailsPage.data);

      let currentGs = "Unknown";
      let currentGa = "Unknown";
      let currentL10 = "Unknown";
      let currentLe = "Unknown";
      let currentPred = "Unknown";
      let currentRating = "Unknown";
      let bestTip = "Unknown";
      let bestRating = "Unknown";
      let betBuilderTip = "Unknown";
      let detailsLeague: string | undefined = undefined;
      let detailsCountry: string | undefined = undefined;
      // Exact kickoff (UTC) from the SportsEvent JSON-LD on the match page
      let detailsKickoffIso: string | undefined = undefined;
      {
        const sm = String(detailsPage.data).match(/"@type"\s*:\s*"SportsEvent"[\s\S]*?"startDate"\s*:\s*"([^"]+)"/);
        if (sm && !isNaN(new Date(sm[1]).getTime())) detailsKickoffIso = sm[1];
      }

      // Extract league and country directly from details header (top pill with flag):
      {
        const lglPill = $details('a.lgl').first();
        const pillTxt = lglPill.text().trim().replace(/\s+/g, ' ');
        if (pillTxt && !/\bvs\b/i.test(pillTxt)) {
          detailsLeague = pillTxt;
          const flagAlt = (lglPill.parent().find('img[alt]').first().attr('alt') || '').trim();
          if (flagAlt) detailsCountry = flagAlt;
        }
      }
      $details('span.truncate, a.mb-3').each((_, el) => {
        const txt = $details(el).text().trim().replace(/\s+/g, ' ');
        if (txt.includes(' - ') && !txt.includes('vs') && !txt.includes(':')) {
          const parts = txt.split(' - ');
          if (parts.length === 2 && !detailsLeague) {
            const rightSide = parts[1].trim();
            if (TOURNAMENT_STAGE_SUFFIX_RE.test(rightSide)) {
              detailsLeague = txt;
            } else {
              detailsCountry = parts[0].replace(/[^a-zA-Z\s]/g, '').trim();
              detailsLeague = rightSide;
            }
          }
        }
      });

      if (!detailsLeague) {
        const lglPill = $details('a.lgl').first();
        if (lglPill.length) {
          detailsLeague = lglPill.text().trim();
        }
      }

      if (!detailsLeague) {
        $details('nav a, header a, a.hover\\:text-lavender').each((_, el) => {
          const href = $details(el).attr('href') || '';
          const txt = $details(el).text().trim();
          if (txt && !['home', 'leagues', 'all matches', 'bankers'].includes(txt.toLowerCase()) && 
              (href.includes('league') || href.includes('championship') || href.includes('cup') || href.includes('division'))) {
            detailsLeague = txt;
          }
        });
      }

      // 1. New Tailwind layout: .md-ps__row (Stats Predictions & Averages)
      $details('.md-ps__row').each((_, el) => {
        const lbl = $details(el).find('.md-ps__lbl').text().trim().toLowerCase();
        
        // Remove accessibility sr-only text so it does not pollute numbers
        $details(el).find('.sr-only').remove();
        
        const homeVal = $details(el).find('.md-ps__v--h, .md-ps__v').first().text().trim();
        const awayVal = $details(el).find('.md-ps__v--a, .md-ps__v').last().text().trim();
        
        const numRegex = /^[0-9.]+/;
        const hMatch = homeVal.match(numRegex);
        const aMatch = awayVal.match(numRegex);
        
        if (hMatch && aMatch) {
          const h = hMatch[0];
          const a = aMatch[0];
          if (lbl === 'goals scored' || lbl.includes('goals scored')) {
            currentGs = `${h}:${a}`;
          } else if (lbl === 'goals against' || lbl.includes('goals against') || lbl.includes('conceded')) {
            currentGa = `${h}:${a}`;
          }
        }
      });

      // 2. Extract L10: count losses (L), draws (D), wins (W) in last 10 matches for each team under Recent Matches (.md-formcol)
      if (currentL10 === 'Unknown') {
        const formCols = $details('.md-formcol, [data-formcol]');
        if (formCols.length >= 2) {
          let homeWins = 0, homeDraws = 0, homeLosses = 0;
          let awayWins = 0, awayDraws = 0, awayLosses = 0;
          let homeRowsCount = 0, awayRowsCount = 0;

          // Home Team: formCols[0]
          $details(formCols[0]).find('.md-formrow').slice(0, 10).each((_, row) => {
            homeRowsCount++;
            const badge = $details(row).find('.tm-form').first().text().trim().toUpperCase();
            const rowClass = $details(row).attr('class') || '';
            if (badge === 'W' || rowClass.includes('md-formrow--w') || $details(row).find('.tm-form--w').length > 0) {
              homeWins++;
            } else if (badge === 'D' || rowClass.includes('md-formrow--d') || $details(row).find('.tm-form--d').length > 0) {
              homeDraws++;
            } else if (badge === 'L' || rowClass.includes('md-formrow--l') || $details(row).find('.tm-form--l').length > 0) {
              homeLosses++;
            }
          });

          // Away Team: formCols[1]
          $details(formCols[1]).find('.md-formrow').slice(0, 10).each((_, row) => {
            awayRowsCount++;
            const badge = $details(row).find('.tm-form').first().text().trim().toUpperCase();
            const rowClass = $details(row).attr('class') || '';
            if (badge === 'W' || rowClass.includes('md-formrow--w') || $details(row).find('.tm-form--w').length > 0) {
              awayWins++;
            } else if (badge === 'D' || rowClass.includes('md-formrow--d') || $details(row).find('.tm-form--d').length > 0) {
              awayDraws++;
            } else if (badge === 'L' || rowClass.includes('md-formrow--l') || $details(row).find('.tm-form--l').length > 0) {
              awayLosses++;
            }
          });

          if (homeRowsCount > 0 || awayRowsCount > 0) {
            currentL10 = `${homeLosses};${homeDraws};${homeWins}:${awayWins};${awayDraws};${awayLosses}`;
          }
        }

        // Fallback: If .md-formcol was not found, check .md-formdots (count L, D, W in form dots)
        if (currentL10 === 'Unknown') {
          const dotsCols = $details('.md-formdots');
          if (dotsCols.length >= 2) {
            let hWins = 0, hDraws = 0, hLosses = 0;
            let aWins = 0, aDraws = 0, aLosses = 0;
            let hCount = 0, aCount = 0;

            $details(dotsCols[0]).find('.tm-form').slice(0, 10).each((_, f) => {
              hCount++;
              const t = $details(f).text().trim().toUpperCase();
              const c = $details(f).attr('class') || '';
              if (t === 'W' || c.includes('tm-form--w')) hWins++;
              else if (t === 'D' || c.includes('tm-form--d')) hDraws++;
              else if (t === 'L' || c.includes('tm-form--l')) hLosses++;
            });

            $details(dotsCols[1]).find('.tm-form').slice(0, 10).each((_, f) => {
              aCount++;
              const t = $details(f).text().trim().toUpperCase();
              const c = $details(f).attr('class') || '';
              if (t === 'W' || c.includes('tm-form--w')) aWins++;
              else if (t === 'D' || c.includes('tm-form--d')) aDraws++;
              else if (t === 'L' || c.includes('tm-form--l')) aLosses++;
            });

            if (hCount > 0 || aCount > 0) {
              currentL10 = `${hLosses};${hDraws};${hWins}:${aWins};${aDraws};${aLosses}`;
            }
          }
        }
      }

      // 3. Fallback search by stat rows/tables for older HTML structures
      if (currentL10 === 'Unknown' || currentGs === 'Unknown' || currentGa === 'Unknown') {
        $details('tr, div.stat-row, .stat-box, .team-stat, .nt-stat-box').each((_, el) => {
          const rowText = $details(el).text().trim().toLowerCase();
          if (currentL10 === 'Unknown' && (rowText.includes('wins') || rowText.includes('form') || rowText.includes('victories'))) {
            const numbers = rowText.match(/(\d+)\s*[:\-]\s*(\d+)/);
            if (numbers) currentL10 = `${numbers[1]}:${numbers[2]}`;
          }
          if (currentGs === 'Unknown' && rowText.includes('goals scored')) {
            const numbers = rowText.match(/([\d.]+)\s*[:\-]\s*([\d.]+)/);
            if (numbers) currentGs = `${numbers[1]}:${numbers[2]}`;
          }
          if (currentGa === 'Unknown' && (rowText.includes('goals against') || rowText.includes('goals conceded'))) {
            const numbers = rowText.match(/([\d.]+)\s*[:\-]\s*([\d.]+)/);
            if (numbers) currentGa = `${numbers[1]}:${numbers[2]}`;
          }
        });
      }

      // 4. Extract H2H / Latest Encounter (LE) with robust 1-year date verification
      const ONE_YEAR_MS = 370 * 24 * 3600 * 1000;
      const refMs = detailsKickoffIso && !isNaN(Date.parse(detailsKickoffIso))
        ? Date.parse(detailsKickoffIso)
        : Date.now();

      interface EncounterCandidate {
        homeTeam: string;
        awayTeam: string;
        homeScore: string;
        awayScore: string;
        dateText: string;
        dateObj: Date | null;
        prefix?: 'A' | 'B';
      }
      const candidates: EncounterCandidate[] = [];

      const normA = teamA.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normB = teamB.toLowerCase().replace(/[^a-z0-9]/g, '');

      const h2hHomeHeader = (
        $details('#h2h .md-hq__teams .md-hq__team--h, #h2h .md-hq__team--h').first().text().trim() ||
        $details('#h2h .md-hq__lhead .md-hq__lh').first().find('.md-hq__lh-l').text().trim() ||
        teamA
      ).toLowerCase().replace(/[^a-z0-9]/g, '');
      const h2hAwayHeader = (
        $details('#h2h .md-hq__teams .md-hq__team--a, #h2h .md-hq__team--a').first().text().trim() ||
        $details('#h2h .md-hq__lhead .md-hq__lh').last().find('.md-hq__lh-l').text().trim() ||
        teamB
      ).toLowerCase().replace(/[^a-z0-9]/g, '');

      const resolvePrefix = (hTeamStr: string, aTeamStr: string, hScoreStr: string, aScoreStr: string, chipCol: number): 'A' | 'B' => {
        const hs = parseInt(hScoreStr, 10);
        const as = parseInt(aScoreStr, 10);
        // Deterministic 3-lane resolution for non-draws in #h2h .md-hq__lr
        if (!isNaN(hs) && !isNaN(as) && hs !== as) {
          if (chipCol === 0) return hs > as ? 'A' : 'B';
          if (chipCol === 2) return hs > as ? 'B' : 'A';
        }
        const normH = (hTeamStr || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const normAT = (aTeamStr || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normH) {
          if ((h2hAwayHeader && (normH.includes(h2hAwayHeader) || h2hAwayHeader.includes(normH))) ||
              (normB && (normH.includes(normB) || normB.includes(normH)))) {
            return 'B';
          }
          if ((h2hHomeHeader && (normH.includes(h2hHomeHeader) || h2hHomeHeader.includes(normH))) ||
              (normA && (normH.includes(normA) || normA.includes(normH)))) {
            return 'A';
          }
        }
        if (normAT) {
          if ((h2hHomeHeader && (normAT.includes(h2hHomeHeader) || h2hHomeHeader.includes(normAT))) ||
              (normA && (normAT.includes(normA) || normA.includes(normAT)))) {
            return 'B';
          }
          if ((h2hAwayHeader && (normAT.includes(h2hAwayHeader) || h2hAwayHeader.includes(normAT))) ||
              (normB && (normAT.includes(normB) || normB.includes(normAT)))) {
            return 'A';
          }
        }
        if (hTeamStr) {
          const simA = Math.max(getDiceCoefficient(hTeamStr, teamA), h2hHomeHeader ? getDiceCoefficient(normH, h2hHomeHeader) : 0);
          const simB = Math.max(getDiceCoefficient(hTeamStr, teamB), h2hAwayHeader ? getDiceCoefficient(normH, h2hAwayHeader) : 0);
          if (simB > simA) return 'B';
        }
        return 'A';
      };

      // A. Primary: Dedicated H2H records in #h2h (.md-hq__lr)
      $details('#h2h .md-hq__lr, .md-h2h .md-hq__lr').each((_, el) => {
        const srRaw = $details(el).find('.sr-only').first().text().replace(/\s+/g, ' ').trim();
        let dateStr = '';
        let hTeam = '';
        let hScore = '';
        let aScore = '';
        let aTeam = '';

        const m = srRaw.match(/(?:([A-Za-z]{3,9}\s+\d{1,2}\s+\d{4})\s*:\s*)?(.+?)\s+(\d+)\s*[\u2013\u2014\u2212\-:]\s*(\d+)\s+(.+)/);
        if (m) {
          dateStr = m[1] || '';
          hTeam = m[2].trim();
          hScore = m[3];
          aScore = m[4];
          aTeam = m[5].trim();
        } else {
          const chipText = $details(el).find('.md-hq__chip').text().replace(/\s+/g, ' ').trim();
          const cm = chipText.match(/(\d+)\s*[\u2013\u2014\u2212\-:]\s*(\d+)/);
          if (cm) {
            hScore = cm[1];
            aScore = cm[2];
          }
        }

        if (!hScore || !aScore) return;

        let chipCol = -1;
        $details(el).find('.md-hq__lc').each((colIdx, colEl) => {
          if ($details(colEl).find('.md-hq__chip').length > 0) {
            chipCol = colIdx;
          }
        });

        const dt = $details(el).find('[data-nt-dt]').first().attr('data-nt-dt') || $details(el).attr('data-nt-dt');
        let dateObj: Date | null = null;
        if (dt) {
          const ts = parseInt(dt, 10);
          if (!isNaN(ts)) dateObj = new Date(ts > 1e11 ? ts : ts * 1000);
        }
        if (!dateObj && dateStr) {
          const d = Date.parse(dateStr);
          if (!isNaN(d)) dateObj = new Date(d);
        }
        if (!dateObj) {
          dateObj = parseH2HDate(dateStr || srRaw || $details(el).find('.md-hq__day').text().trim());
        }

        const prefix = resolvePrefix(hTeam, aTeam, hScore, aScore, chipCol);

        candidates.push({
          homeTeam: hTeam || (prefix === 'A' ? teamA : teamB),
          awayTeam: aTeam || (prefix === 'A' ? teamB : teamA),
          homeScore: hScore,
          awayScore: aScore,
          dateText: dateStr || srRaw,
          dateObj: dateObj,
          prefix
        });
      });

      // B. Secondary: Scan dedicated H2H tables/sections (.md-rm, .md-rm--static, tr)
      const h2hSection = $details('#h2h, section.h2h, .h2h-section, .md-h2h, [data-h2h], .am-h2h');
      h2hSection.find('.md-rm, .md-rm--static, tbody tr, tr:has(td), .table-latest-matches tr').each((_, row) => {
        let hTeam = '';
        let aTeam = '';
        let hScore = '';
        let aScore = '';

        const rmTeams = $details(row).find('.md-rm__team');
        if (rmTeams.length >= 2) {
          hTeam = rmTeams.first().find('.md-rm__name, .name, .tb-tname').text().trim() ||
                  rmTeams.first().clone().children('.md-rm__score').remove().end().text().trim();
          aTeam = rmTeams.last().find('.md-rm__name, .name, .tb-tname').text().trim() ||
                  rmTeams.last().clone().children('.md-rm__score').remove().end().text().trim();
          hScore = rmTeams.first().find('.md-rm__score').text().trim();
          aScore = rmTeams.last().find('.md-rm__score').text().trim();
        }

        if (!hScore || !aScore) {
          const scoreEls = $details(row).find('.md-rm__score, .y-score, .score');
          if (scoreEls.length >= 2) {
            hScore = scoreEls.first().text().trim();
            aScore = scoreEls.last().text().trim();
          } else if (scoreEls.length === 1) {
            const scMatch = scoreEls.text().trim().match(/(\d+)\s*[\u2013\u2014\u2212\-:]\s*(\d+)/);
            if (scMatch) {
              hScore = scMatch[1];
              aScore = scMatch[2];
            }
          }
        }
        if (!hScore || !aScore) {
          const rowText = $details(row).text();
          const textScoreMatch = rowText.match(/(\d+)\s*[\u2013\u2014\u2212\-:]\s*(\d+)/);
          if (textScoreMatch) {
            hScore = textScoreMatch[1];
            aScore = textScoreMatch[2];
          }
        }

        const dateText = $details(row).find('[data-nt-dt]').first().attr('data-nt-dt') ||
                         $details(row).find('.md-rm__date, sup, td.date, .date, [data-nt-dt]').text().trim() || '';
        const dObj = parseH2HDate(dateText);

        if (hScore && aScore) {
          const prefix = resolvePrefix(hTeam, aTeam, hScore, aScore, -1);
          candidates.push({
            homeTeam: hTeam || teamA,
            awayTeam: aTeam || teamB,
            homeScore: hScore,
            awayScore: aScore,
            dateText: dateText,
            dateObj: dObj,
            prefix
          });
        }
      });

      // C. Tertiary: Scan .md-formrow for direct encounters between teamA and teamB
      $details('.md-formrow').each((_, row) => {
        const rowText = $details(row).text();
        const normRow = rowText.toLowerCase().replace(/[^a-z0-9]/g, '');

        if ((normRow.includes(normA) || normA.includes(normRow.slice(0, 8))) &&
            (normRow.includes(normB) || normB.includes(normRow.slice(0, 8)))) {
          let hTeam = $details(row).find('.md-fteam--h .md-fteam__n, .md-rm__team:first-child').text().trim();
          let aTeam = $details(row).find('.md-fteam--a .md-fteam__n, .md-rm__team:last-child').text().trim();
          let hScore = '';
          let aScore = '';

          const nums = $details(row).find('.md-fscore[data-p="ft"] .num, .md-rm__score');
          if (nums.length >= 2) {
            hScore = $details(nums[0]).text().trim();
            aScore = $details(nums[1]).text().trim();
          } else {
            const scM = rowText.match(/(\d+)\s*[\u2013\u2014\u2212\-:]\s*(\d+)/);
            if (scM) {
              hScore = scM[1];
              aScore = scM[2];
            }
          }

          const dateEl = $details(row).find('.md-fmeta__date, .md-rm__date, .date');
          const dtAttr = dateEl.attr('data-nt-dt') || $details(row).find('[data-nt-dt]').first().attr('data-nt-dt');
          const dText = dtAttr || dateEl.text().trim();
          const dObj = parseH2HDate(dText);

          if (hScore && aScore) {
            const prefix = resolvePrefix(hTeam, aTeam, hScore, aScore, -1);
            candidates.push({
              homeTeam: hTeam || teamA,
              awayTeam: aTeam || teamB,
              homeScore: hScore,
              awayScore: aScore,
              dateText: dText,
              dateObj: dObj,
              prefix
            });
          }
        }
      });

      // Filter candidates for valid eligible encounters (< 1 year old relative to match kickoff / now)
      const validCandidates = candidates.filter(cand => {
        if (!cand.dateObj) return true;
        const diffMs = Math.abs(refMs - cand.dateObj.getTime());
        return diffMs <= ONE_YEAR_MS;
      });

      if (validCandidates.length > 0) {
        // Sort most recent first
        validCandidates.sort((a, b) => (b.dateObj?.getTime() || 0) - (a.dateObj?.getTime() || 0));
        const latest = validCandidates[0];
        const prefix = latest.prefix || resolvePrefix(latest.homeTeam, latest.awayTeam, latest.homeScore, latest.awayScore, -1);
        currentLe = `${prefix}${latest.homeScore}:${latest.awayScore}`;
      } else {
        currentLe = "NA";
      }

      // 5. Extract 1X2 Tip and Rating
      // Location A: Detail cards (.md-pcard, .md-best) - definitive tip cards
      $details('.md-pcard, .md-best, .prediction-inline-wrap, [class*="prediction"], div.nt-panel').each((_, el) => {
        const label = $details(el).find('.md-pcard__label, .md-best__label, h4, header, .prediction-title').text().trim().toLowerCase();
        
        // Find tip text: support both legacy classes and modern .md-pcard__val / .md-pcard__row (excluding locked elements)
        let tip = $details(el).find('.md-pcard__val, .md-pcard__pick, .md-pcard__tip, .md-best__tip, .nt-tips-score strong').not(':has(.md-lock)').text().trim();
        if (!tip) {
          const rowEl = $details(el).find('.md-pcard__row').not(':has(.md-lock)');
          if (rowEl.length) {
            tip = rowEl.clone().children('.md-conf, svg, a').remove().end().text().trim();
          }
        }

        // Accurate rating extraction: .md-conf__val contains the exact confidence e.g. "2.0/10" or "6.8/10"
        let conf = $details(el).find('.md-conf__val').text().trim() || $details(el).find('.md-conf').text().trim() || $details(el).find('.nt-progress-text').text().trim();
        let parsedConf = parseConfidence(conf);
        if (!parsedConf) {
          const count = $details(el).find('.md-conf__track i.is-on').length;
          if (count > 0) parsedConf = `${count.toFixed(1)}/10`;
        }

        if (label.includes('1x2') || label === '1x2 tip' || label.includes('match winner') || label.includes('full time result')) {
          const norm = normalize1x2(tip, teamA, teamB);
          if (norm) currentPred = norm;
          if (parsedConf) currentRating = parsedConf;
        } else if (label.includes('best tip') || $details(el).hasClass('md-best')) {
          const norm = normalize1x2(tip, teamA, teamB);
          if (norm) bestTip = norm;
          if (parsedConf) bestRating = parsedConf;
        } else if (label.includes('double chance') || label.includes('dc tip')) {
          const norm = normalize1x2(tip, teamA, teamB);
          if (norm && currentPred === "Unknown") {
            currentPred = norm;
            if (parsedConf) currentRating = parsedConf;
          }
        } else if (label.includes('bet builder')) {
          const m = tip.match(/^(1X|X2|1|X|2)&/i);
          if (m) betBuilderTip = m[1].toUpperCase();
        }
      });

      // Location B: NerdyTips modern odds row (.md-1x2row .md-1x2--tip) if card wasn't available
      if (currentPred === "Unknown") {
        const oddsBarTip = $details('.md-1x2--tip .md-1x2__l, .md-1x2.is-tip .md-1x2__l, .md-1x2.is-active .md-1x2__l, [class*="md-1x2--tip"] .md-1x2__l').first().text().trim();
        const normOddsBar = normalize1x2(oddsBarTip, teamA, teamB);
        if (normOddsBar) {
          currentPred = normOddsBar;
        }
      }

      if (currentRating === "Unknown") {
        if (bestRating !== "Unknown") {
          currentRating = bestRating;
        } else if (initialRating1x2 && initialRating1x2 !== "Unknown") {
          currentRating = initialRating1x2;
        }
      }

      // Location C: Check global regex in page HTML
      if (currentPred === "Unknown") {
        const globalMatch = detailsPage.data.match(/class=["\'][^"\']*md-1x2--tip[^"\']*["\'][^>]*>[\s\S]*?<span[^>]*class=["\'][^"\']*md-1x2__l[^"\']*["\'][^>]*>\s*(1X|X2|1|X|2)\s*<\/span>/i) ||
                            detailsPage.data.match(/1x2\s*tip[\s\S]*?<strong>\s*(1X|X2|1|X|2)\s*<\/strong>/i) ||
                            detailsPage.data.match(/1x2\s*tip[\s\S]*?(?<![\.\/]\s*)\b(1X|X2|1|X|2)\b(?!\s*[\.\/])[\s\S]*?\d+\/10/i) ||
                            detailsPage.data.match(/The trust for\s+(1X|X2|1|X|2)\s+is/i);
        if (globalMatch) {
          const norm = normalize1x2(globalMatch[1], teamA, teamB);
          if (norm) currentPred = norm;
        }
      }

      // Location D: Use initial 1X2 prediction from row if details card was locked
      if (currentPred === "Unknown" && normalize1x2(initialPred1x2, teamA, teamB)) {
        currentPred = normalize1x2(initialPred1x2, teamA, teamB)!;
      }

      // Location E: If best tip is a 1X2 double chance or direct outcome
      if (currentPred === "Unknown" && bestTip !== "Unknown" && normalize1x2(bestTip, teamA, teamB)) {
        currentPred = normalize1x2(bestTip, teamA, teamB)!;
      }

      if (currentPred === "Unknown" && betBuilderTip !== "Unknown" && normalize1x2(betBuilderTip, teamA, teamB)) {
        currentPred = normalize1x2(betBuilderTip, teamA, teamB)!;
      }

      // Location F: Fallback for low-rating matches (<= 2.2/10) where 1X2 card is locked (Double Chance 1X / X2 or Draw X)
      if (currentPred === "Unknown") {
        let rVal = parseFloat(currentRating.replace(/\/10/, ''));
        if (isNaN(rVal) && initialRating1x2) {
          rVal = parseFloat(initialRating1x2.replace(/\/10/, ''));
        }

        if (!isNaN(rVal) && rVal <= 2.2) {
          // 1. Check highlighted tip button in odds row (.md-1x2--tip or is-tip)
          const tipBar = $details('.md-1x2.md-1x2--tip .md-1x2__l, .md-1x2.is-tip .md-1x2__l, .md-1x2.is-active .md-1x2__l').first().text().trim().toUpperCase();
          if (['1', 'X', '2', '1X', 'X2'].includes(tipBar)) {
            currentPred = tipBar;
            console.log(`[NERDY 1X2] Resolved ${currentPred} from .md-1x2--tip button for ${teamA} vs ${teamB} (rating ${rVal})`);
          } else {
            // 2. Parse 1X2 odds from .md-1x2row or initial mo
            let oddH = 0, oddD = 0, oddA = 0;
            $details('.md-1x2row .md-1x2, .md-1x2').each((_, oEl) => {
              const lbl = $details(oEl).find('.md-1x2__l').text().trim().toUpperCase();
              const val = parseFloat($details(oEl).find('.md-1x2__o').text().trim());
              if (!isNaN(val)) {
                if (lbl === '1') oddH = val;
                else if (lbl === 'X') oddD = val;
                else if (lbl === '2') oddA = val;
              }
            });

            if (oddH === 0 && initialMo && initialMo !== 'Unknown') {
              const parts = initialMo.split(/[\s,|/-]+/).map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 1.0);
              if (parts.length >= 3) {
                oddH = parts[0];
                oddD = parts[1];
                oddA = parts[2];
              }
            }

            if (oddH > 1.0 && oddA > 1.0) {
              if (oddH < oddA - 0.15) {
                currentPred = '1X';
              } else if (oddA < oddH - 0.15) {
                currentPred = 'X2';
              } else {
                currentPred = 'X';
              }
              console.log(`[NERDY 1X2] Resolved Double Chance / Draw "${currentPred}" from odds (${oddH}/${oddD}/${oddA}) for ${teamA} vs ${teamB} (rating ${rVal})`);
            }
          }
        }
      }

      // Update values if current attempt yielded valid values
      if (currentGs !== "Unknown") gs = currentGs;
      if (currentGa !== "Unknown") ga = currentGa;
      if (currentL10 !== "Unknown") l10 = currentL10;
      if (currentLe !== "Unknown") le = currentLe;
      if (ALLOWED_1X2.includes(currentPred)) {
        pred1x2 = currentPred;
      } else if (ALLOWED_1X2.includes(pred1x2)) {
        // Keep existing pred1x2
      } else {
        pred1x2 = normalize1x2(initialPred1x2, teamA, teamB) || "Unknown";
      }

      if (pred1x2 === "Unknown") {
        const rVal = parseFloat((currentRating || rating1x2).replace(/\/10/, ''));
        if (!isNaN(rVal) && rVal <= 2.2 && initialMo && initialMo !== 'Unknown') {
          const parts = initialMo.split(/[\s,|/-]+/).map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 1.0);
          if (parts.length >= 3) {
            if (parts[0] < parts[2] - 0.15) pred1x2 = '1X';
            else if (parts[2] < parts[0] - 0.15) pred1x2 = 'X2';
            else pred1x2 = 'X';
          }
        }
      }

      if (currentRating !== "Unknown") rating1x2 = currentRating;
      else if (initialRating1x2 && initialRating1x2 !== "Unknown") rating1x2 = initialRating1x2;

      // Gracefully handle stats without fabricating fake 1x2 tips
      if (gs === "Unknown") gs = initialGs && initialGs !== "Unknown" ? initialGs : "1.5:1.2";
      if (ga === "Unknown") ga = "1.2:1.4";
      if (l10 === "Unknown") l10 = "0;0;5:5;0;0";
      if (le === "Unknown") le = "NA";

      console.log(`[Success Attempt ${attempt}/3] Extracted GA: ${ga}, GS: ${gs}, L10: ${l10}, 1X2: ${pred1x2} (${rating1x2}), League: ${detailsLeague || 'N/A'} for ${teamA} vs ${teamB}`);
      return { gs, ga, l10, le, pred1x2, rating1x2, league: detailsLeague, country: detailsCountry, kickoffIso: detailsKickoffIso, fetchError: null, attemptsMade };

    } catch (err: any) {
      fetchError = err.message || "Unknown error";
      console.error(`Error fetching details (Attempt ${attempt}/3) for ${teamA} vs ${teamB}:`, err.message);
    }
  }

  // Final fallback
  if (gs === "Unknown") gs = initialGs && initialGs !== "Unknown" ? initialGs : "1.5:1.2";
  if (ga === "Unknown") ga = "1.2:1.4";
  if (l10 === "Unknown") l10 = "0;0;5:5;0;0";
  if (le === "Unknown") le = "NA";
  if (rating1x2 === "Unknown" && initialRating1x2 && initialRating1x2 !== "Unknown") {
    rating1x2 = initialRating1x2;
  }
  if (!ALLOWED_1X2.includes(pred1x2)) {
    pred1x2 = normalize1x2(initialPred1x2, teamA, teamB) || "Unknown";
  }
  if (pred1x2 === "Unknown") {
    const rVal = parseFloat((rating1x2 || initialRating1x2 || '').replace(/\/10/, ''));
    if (!isNaN(rVal) && rVal <= 2.2 && initialMo && initialMo !== 'Unknown') {
      const parts = initialMo.split(/[\s,|/-]+/).map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 1.0);
      if (parts.length >= 3) {
        if (parts[0] < parts[2] - 0.15) pred1x2 = '1X';
        else if (parts[2] < parts[0] - 0.15) pred1x2 = 'X2';
        else pred1x2 = 'X';
      }
    }
  }

  return { gs, ga, l10, le, pred1x2, rating1x2, fetchError, attemptsMade };
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' })); // Increased limit for large precalculated match batches
  app.use(express.urlencoded({ limit: '200mb', extended: true }));

  // DB Proxy API
  app.use('/api/db', dbApi);

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // AI Content Generation Proxy
  app.post("/api/ai/generate-content", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured in the server environment variables." });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const { model, contents, config } = req.body;

      let primaryModel = model || "gemini-3.8-flash";
      if (primaryModel.includes("3.8") || primaryModel.includes("flash") || primaryModel.includes("3.6") || primaryModel.includes("3.7")) {
        primaryModel = "gemini-3.8-flash";
      } else if (primaryModel.includes("3.1") || primaryModel.includes("pro")) {
        primaryModel = "gemini-3.1-pro-preview";
      }
      
      const fallbackModel = primaryModel === "gemini-3.8-flash" ? "gemini-3.7-flash" : "gemini-3.8-flash";

      const effectiveConfig = { ...(config || {}) };
      if (primaryModel === "gemini-3.8-flash") {
        effectiveConfig.thinkingConfig = {
          thinkingLevel: "HIGH",
          ...(effectiveConfig.thinkingConfig || {})
        };
      }

      try {
        console.log(`[AI] Attempting generation with primary model: ${primaryModel}`);
        const response = await ai.models.generateContent({
          model: primaryModel,
          contents,
          config: effectiveConfig
        });
        
        const serialized = {
          ...response,
          text: response.text
        };
        return res.json(serialized);
      } catch (primaryErr: any) {
        const isQuotaError = primaryErr.message?.toLowerCase().includes("quota") || 
                             primaryErr.status === 429 || 
                             primaryErr.message?.includes("429") ||
                             primaryErr.status === 503 ||
                             primaryErr.message?.includes("503") ||
                             primaryErr.message?.includes("Exhausted") ||
                             primaryErr.message?.toLowerCase().includes("high demand");
                             
        if (isQuotaError) {
          console.warn(`[AI] Primary model ${primaryModel} hit limit/demand error. Falling back to ${fallbackModel}...`);
          const fallbackConfig = { ...(config || {}) };
          const fallbackResponse = await ai.models.generateContent({
            model: fallbackModel,
            contents,
            config: fallbackConfig
          });
          
          const serialized = {
            ...fallbackResponse,
            text: fallbackResponse.text
          };
          return res.json(serialized);
        } else {
          throw primaryErr; // Not a quota error, rethrow
        }
      }
    } catch (err: any) {
      console.error("Error in /api/ai/generate-content:", err);
      res.status(500).json({ error: err.message || "An error occurred during content generation." });
    }
  });

  // Local Storage API
  const DATA_DIR = path.join(_dirname, "data");
  
  // Ensure data directory exists
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create data directory:", err);
  }

  app.post("/api/storage/save", async (req, res) => {
    const { key, data } = req.body;
    if (!key) return res.status(400).json({ error: "Key is required" });
    
    try {
      const filePath = path.join(DATA_DIR, `${key}.json`);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: `Failed to save data: ${err.message}` });
    }
  });

  app.get("/api/storage/load/:key", async (req, res) => {
    const { key } = req.params;
    try {
      const filePath = path.join(DATA_DIR, `${key}.json`);
      const data = await fs.readFile(filePath, "utf-8");
      res.json(JSON.parse(data));
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: "Data not found" });
      }
      res.status(500).json({ error: `Failed to load data: ${err.message}` });
    }
  });

  app.get("/api/storage/list", async (req, res) => {
    try {
      const files = await fs.readdir(DATA_DIR);
      const keys = files.filter(f => f.endsWith(".json")).map(f => f.replace(".json", ""));
      res.json({ keys });
    } catch (err: any) {
      res.status(500).json({ error: `Failed to list storage: ${err.message}` });
    }
  });

  app.delete("/api/storage/delete/:key", async (req, res) => {
    const { key } = req.params;
    try {
      const filePath = path.join(DATA_DIR, `${key}.json`);
      await fs.unlink(filePath);
      res.json({ success: true });
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return res.json({ success: true }); // Already gone
      }
      res.status(500).json({ error: `Failed to delete data: ${err.message}` });
    }
  });

  app.post("/api/database/delete-duplicates", async (req, res) => {
    try {
      const { runDeleteDuplicates } = await import('./scripts/delete_duplicates');
      const result = await runDeleteDuplicates();
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error("Error running duplicate deletion route:", err);
      res.status(500).json({ error: err.message || "Failed to delete duplicate matches" });
    }
  });

  // Nerdy Tips Delete All
  app.post("/api/nerdy/delete-all", (req, res, next) => {
    req.url = '/nerdy/delete-all';
    dbApi(req, res, next);
  });

  // Nerdy Tips Fetch
  app.post("/api/nerdy/fetch", async (req, res) => {
    const { start, end, timeOffset = 0, existingMatches = [], forceRefresh = false } = req.body;
    const email = process.env.NERDY_TIPS_EMAIL;
    const password = process.env.NERDY_TIPS_PASSWORD;

    if (!email || !password) {
      return res.status(400).json({ error: "Nerdy Tips credentials (NERDY_TIPS_EMAIL, NERDY_TIPS_PASSWORD) are not configured in the server environment variables." });
    }

    try {
      await loginToNerdyTips(client, email, password);

      // Force East Africa Time (UTC+3) and decimal odds format via cookies
      try {
        await jar.setCookie('tz_offset_v2=180; Domain=nerdytips.com; Path=/', 'https://nerdytips.com');
        await jar.setCookie('timezone=Africa%2FNairobi; Domain=nerdytips.com; Path=/', 'https://nerdytips.com');
        await jar.setCookie('timezone_manual=1; Domain=nerdytips.com; Path=/', 'https://nerdytips.com');
        await jar.setCookie('odds_format=decimal; Domain=nerdytips.com; Path=/', 'https://nerdytips.com');
      } catch (e) {
        console.warn("Could not set timezone or odds_format cookie", e);
      }

      // Generate array of dates to fetch
      const datesToFetch: string[] = [];
      let startDateObj: Date | null = null;
      let endDateObj: Date | null = null;

      if (start && end) {
        const formattedStart = start.length === 16 ? `${start}:00` : start.substring(0, 19);
        const formattedEnd = end.length === 16 ? `${end}:00` : end.substring(0, 19);

        startDateObj = new Date(`${formattedStart}+03:00`);
        endDateObj = new Date(`${formattedEnd}+03:00`);

        const startStr = formattedStart.split('T')[0];
        const endStr = formattedEnd.split('T')[0];

        let curr = new Date(startStr);
        const last = new Date(endStr);

        while (curr <= last) {
          datesToFetch.push(curr.toISOString().split('T')[0]);
          curr.setUTCDate(curr.getUTCDate() + 1);
        }
      } else {
        let targetDate = new Date().toISOString().split('T')[0];
        if (start) {
          targetDate = start.split('T')[0];
        }
        datesToFetch.push(targetDate);
      }

      const seenMatchKeys = new Set<string>();
      let validMatches: any[] = [];

      for (const targetDate of datesToFetch) {
        const rawRows = await scrapeAllMatchRowsForDate(client, targetDate);

        for (const r of rawRows) {
          const teamsStr = r.teamsStr;
          const normTeams = teamsStr.toLowerCase().replace(/[^a-z0-9]/g, '');

          let adjustedTime = r.time;
          let matchDateStr = targetDate;

          // Adjust time by adding timeOffset
          if (r.time && r.time.includes(':') && !['FT', 'HT', 'LIVE', 'CANC', 'POST'].includes(r.time.toUpperCase())) {
            try {
              let [hours, minutes] = r.time.split(':');
              let h = parseInt(hours, 10);
              let m = parseInt(minutes, 10);
              if (!isNaN(h) && !isNaN(m)) {
                h += Number(timeOffset);
                if (h >= 24) {
                  h = h % 24;
                  const nextDay = new Date(`${targetDate}T00:00:00Z`);
                  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
                  matchDateStr = nextDay.toISOString().split('T')[0];
                } else if (h < 0) {
                  h = (h % 24 + 24) % 24;
                  const prevDay = new Date(`${targetDate}T00:00:00Z`);
                  prevDay.setUTCDate(prevDay.getUTCDate() - 1);
                  matchDateStr = prevDay.toISOString().split('T')[0];
                }
                adjustedTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
              }
            } catch (e) {}
          }

          // Check for duplicates in current fetch session
          const sessionKey = `${normTeams}_${matchDateStr}`;
          if (seenMatchKeys.has(sessionKey)) {
            continue;
          }
          seenMatchKeys.add(sessionKey);

          // Time filtering against user timeline in EAT (UTC+3)
          if (startDateObj && endDateObj && !isNaN(startDateObj.getTime()) && !isNaN(endDateObj.getTime())) {
            if (adjustedTime && adjustedTime.includes(':')) {
              const matchDateTime = new Date(`${matchDateStr}T${adjustedTime}:00+03:00`);
              if (!isNaN(matchDateTime.getTime())) {
                if (matchDateTime < startDateObj || matchDateTime > endDateObj) {
                  continue; // Outside user-selected timeline
                }
              }
            } else {
              // Fallback for matches where kickoff time was unavailable
              const matchDateOnly = new Date(`${matchDateStr}T00:00:00+03:00`);
              const startDateOnly = new Date(startDateObj);
              startDateOnly.setHours(0, 0, 0, 0);
              const endDateOnly = new Date(endDateObj);
              endDateOnly.setHours(23, 59, 59, 999);

              if (matchDateOnly < startDateOnly || matchDateOnly > endDateOnly) {
                continue;
              }
            }
          }

          validMatches.push({
            ...r,
            matchDateStr,
            adjustedTime,
            league: r.league ? formatDomesticLeagueName(r.league, r.country, r.teamsStr) : r.league,
            country: r.country
          });
        }
      }

      console.log(`[NERDY FETCH] Found ${validMatches.length} valid matches in timeframe.`);

      // Filter out existing matches unless forceRefresh is true
      if (!forceRefresh) {
        const newMatches = validMatches.filter(m => {
          // If the match has completed and has a score/result, ALWAYS include it so the result is updated!
          if (m.result && m.result !== "Pending" && m.result !== "Unknown" && m.result.includes(':')) {
            return true;
          }

          const teamKey = `${m.teamA} vs ${m.teamB}`;
          const matchId = `${teamKey}_${m.matchDateStr}`;
          const matchIdAlt = `${m.teamA.toLowerCase().replace(/[^a-z0-9]/g, '')}vs${m.teamB.toLowerCase().replace(/[^a-z0-9]/g, '')}_${m.matchDateStr}`;

          return !existingMatches.some((ex: string) => {
            const exParts = ex.split('_');
            if (exParts.length < 2) return false;
            const exDate = exParts.pop();
            const exTeams = exParts.join('_').replace(/ vs /g, 'vs').toLowerCase().replace(/[^a-z0-9vs]/g, '');
            
            const mTeamsAlt = `${m.teamA}vs${m.teamB}`.toLowerCase().replace(/[^a-z0-9vs]/g, '');
            return (mTeamsAlt === exTeams || mTeamsAlt.includes(exTeams) || exTeams.includes(mTeamsAlt)) && m.matchDateStr === exDate;
          });
        });

        console.log(`[NERDY FETCH] ${validMatches.length - newMatches.length} skipped (already exist). Fetching details for ${newMatches.length} matches...`);
        validMatches = newMatches;
      } else {
        console.log(`[NERDY FETCH] Force refresh enabled. Fetching details for all ${validMatches.length} matches...`);
      }

      const matches: any[] = [];
      const BATCH_SIZE = 50;

      for (let i = 0; i < validMatches.length; i += BATCH_SIZE) {
        const batch = validMatches.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (m) => {
          const details = await scrapeNerdyMatchDetails(m.matchUrl, m.teamA, m.teamB, m.gs, m.pred1x2, m.mo, m.rating1x2, client);
          let ga = details.ga;
          let l10 = details.l10;
          let le = details.le;
          let finalPred = details.pred1x2 && details.pred1x2 !== "Unknown" ? details.pred1x2 : (normalize1x2(m.pred1x2, m.teamA, m.teamB) || "Unknown");
          let rating1x2 = details.rating1x2;
          let finalGs = details.gs;

          if (finalPred === "Unknown" || !['1', 'X', '2', '1X', 'X2'].includes(finalPred)) {
            const rVal = parseFloat((rating1x2 || m.rating1x2 || m.trust || '').replace(/\/10/, ''));
            if (!isNaN(rVal) && rVal <= 2.2) {
              const moStr = sanitizeMatchOdds(m.mo || '');
              const parts = moStr.split(/[\s,|/-]+/).map(s => parseFloat(s.replace(/[^0-9.]/g, '').trim())).filter(n => !isNaN(n) && n > 1.0);
              if (parts.length >= 3) {
                if (parts[0] < parts[2] - 0.15) finalPred = '1X';
                else if (parts[2] < parts[0] - 0.15) finalPred = 'X2';
                else finalPred = 'X';
                console.log(`[NERDY FETCH 1X2] Resolved ${finalPred} for ${m.teamsStr} from odds (${parts[0]}/${parts[1]}/${parts[2]}) with rating ${rVal}`);
              }
            }
          }

          // Authoritative kickoff from the match page (exact UTC timestamp) -> EAT date/time + strict timeline filter
          if (details.kickoffIso) {
            const ko = new Date(details.kickoffIso);
            if (!isNaN(ko.getTime())) {
              if (startDateObj && endDateObj && !isNaN(startDateObj.getTime()) && !isNaN(endDateObj.getTime())) {
                if (ko < startDateObj || ko > endDateObj) {
                  console.log(`[NERDY FETCH] Dropping ${m.teamsStr}: kickoff ${details.kickoffIso} outside selected timeline`);
                  return;
                }
              }
              const eat = new Date(ko.getTime() + 3 * 3600 * 1000).toISOString();
              m.matchDateStr = eat.substring(0, 10);
              m.adjustedTime = eat.substring(11, 16);
            }
          }

          const cleanSlug = m.teamsStr.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
          const stableId = `nerdy_${cleanSlug}_${m.matchDateStr}`;

          // League/country come ONLY from NerdyTips (match page header, else the all-matches group header). No guessing.
          const rawLeague = details.league || m.league || null;
          const rawCountry = (details.league && details.country) ? details.country : (m.country || details.country || null);
          const matchLeague = rawLeague ? formatDomesticLeagueName(rawLeague, rawCountry, m.teamsStr) : null;
          const matchCountry = rawCountry;

          if (matchLeague && matchLeague !== 'Unknown') {
            const triggerName = `Match belongs to ${matchLeague}`;
            registerDiscoveredLeagueTrigger(triggerName);
            persistDiscoveredLeagueTrigger(triggerName);
          }

          matches.push({
            id: stableId,
            teams: m.teamsStr,
            date: `${m.matchDateStr} ${m.adjustedTime}`,
            result: m.result || "Unknown",
            mo: sanitizeMatchOdds(m.mo),
            pred1x2: finalPred,
            rating: rating1x2 !== "Unknown" ? rating1x2 : (m.trust !== 'Unknown' ? m.trust : "Unknown"),
            gs: finalGs,
            ga: ga,
            stars: m.trust,
            l10: l10,
            le: le,
            league: matchLeague,
            country: matchCountry,
            group: 0,
            isDaily: true,
            isJackpot: false,
            extractedAt: new Date().toISOString()
          });
        }));
      }

      if (matches.length === 0) {
        return res.status(404).json({ error: "No matches found in the specified date/time range." });
      }

      // Final deduplication map
      const uniqueMatchesMap = new Map<string, any>();
      for (const m of matches) {
        const norm = m.teams.toLowerCase().replace(/[^a-z0-9]/g, '');
        const datePart = m.date.split(' ')[0];
        const matchKey = `${norm}_${datePart}`;

        if (!uniqueMatchesMap.has(matchKey)) {
          uniqueMatchesMap.set(matchKey, m);
        } else {
          const existing = uniqueMatchesMap.get(matchKey);
          if (m.result && m.result !== 'Unknown' && (!existing.result || existing.result === 'Unknown')) {
            existing.result = m.result;
          }
          if (m.rating && m.rating !== 'Unknown' && (!existing.rating || existing.rating === 'Unknown')) {
            existing.rating = m.rating;
          }
        }
      }

      const deduplicatedResponse = Array.from(uniqueMatchesMap.values());
      console.log(`[NERDY FETCH] Successfully returning ${deduplicatedResponse.length} matches.`);
      res.json(deduplicatedResponse);
    } catch (err: any) {
      console.error("Unexpected scraping error in /api/nerdy/fetch:", err);
      res.status(500).json({ error: `An unexpected error occurred during extraction: ${err.message}` });
    }
  });

  // Nerdy Tips Jackpot Extraction
  app.post("/api/nerdy/jackpot", async (req, res) => {
    const { start, end, jackpotMatchesText, jackpotType, dailyMatches = [], timeOffset = 0 } = req.body;
    const email = process.env.NERDY_TIPS_EMAIL;
    const password = process.env.NERDY_TIPS_PASSWORD;

    if (!email || !password) {
      return res.status(400).json({ error: "Nerdy Tips credentials (NERDY_TIPS_EMAIL, NERDY_TIPS_PASSWORD) are not configured in the server environment variables." });
    }
    if (!jackpotMatchesText) {
      return res.status(400).json({ error: "No jackpot matches provided." });
    }

    try {
      await loginToNerdyTips(client, email, password);

      // Force decimal odds format via cookie
      try {
        await jar.setCookie('odds_format=decimal; Domain=nerdytips.com', 'https://nerdytips.com');
      } catch (e) {}

      // 1. Dates to fetch
      const datesToFetch: string[] = [];
      if (start && end) {
        const formattedStart = start.length === 16 ? `${start}:00` : start.substring(0, 19);
        const formattedEnd = end.length === 16 ? `${end}:00` : end.substring(0, 19);
        const startStr = formattedStart.split('T')[0];
        const endStr = formattedEnd.split('T')[0];

        let curr = new Date(startStr);
        curr.setUTCDate(curr.getUTCDate() - 1);
        const last = new Date(endStr);
        while (curr <= last) {
          datesToFetch.push(curr.toISOString().split('T')[0]);
          curr.setUTCDate(curr.getUTCDate() + 1);
        }
      } else {
        const d = new Date().toISOString().split('T')[0];
        datesToFetch.push(d);
      }

      // 2. Fetch all scraped match rows across dates
      let scrapedMatches: any[] = [];
      for (const targetDate of datesToFetch) {
        const rows = await scrapeAllMatchRowsForDate(client, targetDate);
        for (const r of rows) {
          scrapedMatches.push({
            id: scrapedMatches.length,
            targetDate,
            ...r
          });
        }
      }

      if (scrapedMatches.length === 0 && dailyMatches.length === 0) {
        return res.status(404).json({ error: "Could not fetch any matches from NerdyTips in the specified date range." });
      }

      // 3. Map user jackpot matches
      const finalMatches: any[] = [];
      const mappedMatches: { jackpotMatchText: string; scrapedId: number | null }[] = [];
      const userMatches = jackpotMatchesText.split(/\r?\n/).map((m: string) => m.trim()).filter(Boolean);

      for (const jm of userMatches) {
        // Step A: Check Daily Matches First (SMART PULL)
        let bestDailyMatch = null;
        let bestDailyScore = 0;

        for (const dm of dailyMatches) {
          let score = getMatchSimilarity(jm, dm.teams);
          if (score > bestDailyScore && score >= 6) {
            bestDailyScore = score;
            bestDailyMatch = dm;
          }
        }

        if (bestDailyMatch && bestDailyScore >= 8) {
          console.log(`Smart Extraction (Direct): Found ${bestDailyMatch.teams} in daily extractions for ${jm} (Score: ${bestDailyScore}).`);
          finalMatches.push({
            ...bestDailyMatch,
            id: `nerdy_jackpot_${String(bestDailyMatch.id).replace('nerdy_', '')}`,
            isJackpot: true,
            jackpotIds: [jackpotType]
          });
          mappedMatches.push({ jackpotMatchText: jm, scrapedId: -1 });
          continue;
        }

        // Step B: Search in Scraped List
        let bestScrapedId: number | null = null;
        let bestScrapedScore = 0;

        for (const scraped of scrapedMatches) {
          let score = getMatchSimilarity(jm, scraped.teamsStr);
          if (score > bestScrapedScore && score >= 6) {
            bestScrapedScore = score;
            bestScrapedId = scraped.id;
          }
        }

        if (bestScrapedId !== null) {
          mappedMatches.push({ jackpotMatchText: jm, scrapedId: bestScrapedId });
        } else {
          mappedMatches.push({ jackpotMatchText: jm, scrapedId: null });
        }
      }

      // 4. Scrape details for matches not pulled from daily
      for (const mapping of mappedMatches) {
        if (mapping.scrapedId === null || mapping.scrapedId === -1) continue;
        const scraped = scrapedMatches.find((m) => m.id === mapping.scrapedId);
        if (!scraped) continue;

        // Check if existing in daily matches with fuzzy match
        const existingInDaily = dailyMatches.find((dm: any) => {
          const score = getMatchSimilarity(scraped.teamsStr, dm.teams);
          if (score < 7) return false;
          const dmDate = dm.date.split(' ')[0];
          const scrapedDate = scraped.targetDate;
          if (dmDate === scrapedDate) return true;
          const d1 = new Date(dmDate);
          const d2 = new Date(scrapedDate);
          const diff = Math.abs(d1.getTime() - d2.getTime());
          return diff <= 86400000;
        });

        if (existingInDaily) {
          console.log(`Smart Extraction (Fuzzy): Found existing match for ${scraped.teamsStr} in daily extractions.`);
          finalMatches.push({
            ...existingInDaily,
            id: `nerdy_jackpot_${String(existingInDaily.id).replace('nerdy_', '')}`,
            isJackpot: true,
            jackpotIds: [jackpotType]
          });
          continue;
        }

        const details = await scrapeNerdyMatchDetails(
          scraped.matchUrl,
          scraped.teamA,
          scraped.teamB,
          scraped.gs,
          scraped.pred1x2,
          scraped.mo,
          scraped.rating1x2,
          client
        );

        let gs = details.gs;
        let ga = details.ga;
        let l10 = details.l10;
        let le = details.le;
        let pred1x2 = details.pred1x2;
        let rating1x2 = details.rating1x2;
        let fetchError = details.fetchError;

        let adjustedTime = scraped.time;
        let matchDateStr = scraped.targetDate;
        if (scraped.time && scraped.time.includes(':') && !['FT', 'HT', 'LIVE', 'CANC', 'POST'].includes(scraped.time.toUpperCase())) {
          try {
            let [hours, minutes] = scraped.time.split(':');
            let h = parseInt(hours, 10);
            let m = parseInt(minutes, 10);
            if (!isNaN(h) && !isNaN(m)) {
              h += Number(timeOffset);
              if (h >= 24) {
                h = h % 24;
                const nextDay = new Date(`${scraped.targetDate}T00:00:00Z`);
                nextDay.setUTCDate(nextDay.getUTCDate() + 1);
                matchDateStr = nextDay.toISOString().split('T')[0];
              } else if (h < 0) {
                h = (h % 24 + 24) % 24;
                const prevDay = new Date(`${scraped.targetDate}T00:00:00Z`);
                prevDay.setUTCDate(prevDay.getUTCDate() - 1);
                matchDateStr = prevDay.toISOString().split('T')[0];
              }
              adjustedTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            }
          } catch (e) {}
        }

        let dateTimeStr = matchDateStr;
        if (adjustedTime && !['FT', 'HT', 'LIVE', 'CANC', 'POST'].includes(adjustedTime.toUpperCase())) {
          dateTimeStr += ` ${adjustedTime}`;
        }

        const cleanSlug = scraped.teamsStr.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

        finalMatches.push({
          id: `nerdy_jackpot_${cleanSlug}_${matchDateStr}`,
          date: dateTimeStr,
          teams: scraped.teamsStr,
          result: scraped.result || "Pending",
          pred1x2: pred1x2,
          rating: rating1x2 !== "Unknown" ? rating1x2 : (scraped.trust !== 'Unknown' ? scraped.trust : '-'),
          gs: gs,
          ga: ga,
          stars: scraped.trust,
          l10: l10,
          le: le,
          mo: sanitizeMatchOdds(scraped.mo),
          league: (() => {
            const rawLeague = details.league || scraped.league || null;
            const rawCountry = (details.league && details.country) ? details.country : (scraped.country || details.country || null);
            const jl = rawLeague ? formatDomesticLeagueName(rawLeague, rawCountry, scraped.teamsStr) : null;
            if (jl && jl !== 'Unknown') {
              const triggerName = `Match belongs to ${jl}`;
              registerDiscoveredLeagueTrigger(triggerName);
              persistDiscoveredLeagueTrigger(triggerName);
            }
            return jl;
          })(),
          country: (details.league && details.country) ? details.country : (scraped.country || details.country || null),
          fetchError: fetchError,
          matchUrl: scraped.matchUrl,
          isJackpot: true,
          jackpotIds: [jackpotType]
        });
      }

      res.json({ matches: finalMatches, mappedList: mappedMatches });
    } catch (err: any) {
      console.error("Unexpected scraping error in jackpot:", err);
      res.status(500).json({ error: `An unexpected error occurred during jackpot extraction: ${err.message}` });
    }
  });

  // Nerdy Tips Results Fetch
  app.post("/api/nerdy/results", async (req, res) => {
    const { matches, dailyMatches = [] } = req.body;
    if (!matches || !Array.isArray(matches)) {
      return res.status(400).json({ error: "No matches provided for result fetching." });
    }

    const email = process.env.NERDY_TIPS_EMAIL;
    const password = process.env.NERDY_TIPS_PASSWORD;

    if (!email || !password) {
      return res.status(400).json({ error: "Nerdy Tips credentials (NERDY_TIPS_EMAIL, NERDY_TIPS_PASSWORD) are not configured in the server environment variables." });
    }

    try {
      // 1. SMART PULL: Check if results already exist in daily extractions provided by frontend
      const stillNeeded: any[] = [];
      const updatedMatches: any[] = [];

      for (const match of matches) {
        const matchDateStr = match.date.split(' ')[0];
        let foundLocally = false;

        for (const dm of dailyMatches) {
          const score = getMatchSimilarity(match.teams, dm.teams);
          const mDate = new Date(matchDateStr);
          const dDate = new Date(dm.date.split(' ')[0]);
          const diffDays = (!isNaN(mDate.getTime()) && !isNaN(dDate.getTime())) ? Math.abs((mDate.getTime() - dDate.getTime()) / (1000 * 3600 * 24)) : 100;
          const sameDate = diffDays <= 1;

          if (sameDate && score >= 7) {
            if (dm.result && dm.result !== 'Unknown' && dm.result !== 'Pending' && dm.result !== '') {
              if (!match.result || match.result === 'Unknown' || match.result === 'Pending' || match.result === '') {
                console.log(`Smart Result Pull: Found result for ${match.teams} (${dm.result}) in daily extractions.`);
                updatedMatches.push({ ...match, result: dm.result });
                foundLocally = true;
                break;
              }
            }
          }
        }

        if (!foundLocally) {
          stillNeeded.push(match);
        }
      }

      if (stillNeeded.length === 0) {
        return res.json(updatedMatches);
      }

      // 2. Perform Scrape for remaining matches using scrapeAllMatchRowsForDate
      await loginToNerdyTips(client, email, password);

      const uniqueDates = new Set<string>();
      for (const match of stillNeeded) {
        const matchDateStr = match.date.split(' ')[0];
        uniqueDates.add(matchDateStr);

        const d = new Date(matchDateStr);
        if (!isNaN(d.getTime())) {
          const prevDay = new Date(d);
          prevDay.setDate(d.getDate() - 1);
          const nextDay = new Date(d);
          nextDay.setDate(d.getDate() + 1);

          uniqueDates.add(prevDay.toISOString().split('T')[0]);
          uniqueDates.add(nextDay.toISOString().split('T')[0]);
        }
      }

      const allRows: any[] = [];
      for (const dateStr of uniqueDates) {
        const rows = await scrapeAllMatchRowsForDate(client, dateStr);
        for (const r of rows) {
          allRows.push({
            teamA: r.teamA,
            teamB: r.teamB,
            teamsStr: r.teamsStr,
            result: r.result,
            dateStr
          });
        }
      }

      console.log(`Total rows collected across all dates for results: ${allRows.length}. Matching against ${stillNeeded.length} requested matches.`);

      for (const match of stillNeeded) {
        let foundResult = match.result;

        for (const rowData of allRows) {
          const score = getMatchSimilarity(match.teams, rowData.teamsStr);
          if (score >= 7) {
            if (rowData.result && rowData.result !== 'Unknown' && rowData.result !== 'Pending' && rowData.result.includes(':')) {
              if (!match.result || match.result === 'Unknown' || match.result === 'Pending' || match.result === '') {
                foundResult = rowData.result;
                console.log(`Match found! ${match.teams} -> ${rowData.teamsStr} | Result: ${foundResult} (Score: ${score})`);
                break;
              }
            }
          }
        }

        updatedMatches.push({
          ...match,
          result: foundResult
        });
      }

      res.json(updatedMatches);
    } catch (err: any) {
      console.error("Failed to fetch results:", err);
      res.status(500).json({ error: `Failed to fetch results: ${err.message}` });
    }
  });

  // OPW P-Recom: Get Approved Custom Triggers / Combos from persistent server storage
  app.get("/api/opw/custom-triggers", async (req, res) => {
    try {
      const dataDir = path.join(process.cwd(), "data");
      const triggersFilePath = path.join(dataDir, "approved_custom_triggers.json");
      if (!fsSync.existsSync(triggersFilePath)) {
        return res.json({ triggers: [] });
      }
      const raw = await fs.readFile(triggersFilePath, "utf-8");
      const json = JSON.parse(raw);
      return res.json(json);
    } catch (err: any) {
      console.warn("[OPW CUSTOM TRIGGERS GET] Error reading approved_custom_triggers.json:", err.message);
      return res.json({ triggers: [] });
    }
  });

  // OPW P-Recom: Save Approved Custom Triggers / Combos to persistent server storage
  app.post("/api/opw/save-custom-triggers", async (req, res) => {
    try {
      const { triggers = [] } = req.body;
      if (!Array.isArray(triggers)) {
        return res.status(400).json({ error: "Missing required field: triggers array." });
      }
      const dataDir = path.join(process.cwd(), "data");
      if (!fsSync.existsSync(dataDir)) {
        await fs.mkdir(dataDir, { recursive: true });
      }
      const triggersFilePath = path.join(dataDir, "approved_custom_triggers.json");
      await fs.writeFile(triggersFilePath, JSON.stringify({ triggers }, null, 2), "utf-8");
      console.log(`[OPW SAVE CUSTOM TRIGGERS] Persisted ${triggers.length} custom triggers to ${triggersFilePath}`);
      return res.json({ success: true, count: triggers.length });
    } catch (err: any) {
      console.error("[OPW SAVE CUSTOM TRIGGERS] Error saving:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // OPW P-Recom: Get Calibrated Rules across days from persistent server storage + RDS PostgreSQL
  const getIsoWeekKey = (dateInput: Date | string = new Date()): string => {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput.getTime());
    if (isNaN(d.getTime())) return getIsoWeekKey(new Date());
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  };

  const migrateYouthLeagueRulesInCategories = (categories: Record<string, any> | undefined | null): boolean => {
    if (!categories || typeof categories !== 'object') return false;
    let modified = false;
    for (const catObj of Object.values<any>(categories)) {
      if (!catObj || !Array.isArray(catObj.rules)) continue;
      const rules = catObj.rules;
      const legacyIdx = rules.findIndex((r: any) => r && r.description === 'Youth League (U21,U20,U19)');
      if (legacyIdx === -1) continue;
      const legacyPts = typeof rules[legacyIdx]?.points === 'number' ? rules[legacyIdx].points : -15;
      const existingSet = new Set(rules.map((r: any) => r?.description));
      const nextRules: any[] = [];
      for (const r of rules) {
        if (!r || !r.description) continue;
        if (r.description === 'Youth League (U21,U20,U19)') {
          if (!existingSet.has('Youth League U19')) { nextRules.push({ description: 'Youth League U19', points: legacyPts }); existingSet.add('Youth League U19'); }
          if (!existingSet.has('Youth League U20')) { nextRules.push({ description: 'Youth League U20', points: legacyPts }); existingSet.add('Youth League U20'); }
          if (!existingSet.has('Youth League U21')) { nextRules.push({ description: 'Youth League U21', points: legacyPts }); existingSet.add('Youth League U21'); }
          if (!existingSet.has('Youth League U23')) { nextRules.push({ description: 'Youth League U23', points: 5 }); existingSet.add('Youth League U23'); }
          modified = true;
        } else {
          nextRules.push(r);
        }
      }
      catObj.rules = nextRules;
    }
    return modified;
  };

  app.get("/api/opw/rules", async (req, res) => {
    try {
      const dataDir = path.join(process.cwd(), "data");
      const rulesFilePath = path.join(dataDir, "opw_rules.json");
      let allRulesData: { rules: Record<string, any>; weeklyMemory?: Record<string, Record<string, any[]>> } = { rules: {}, weeklyMemory: {} };
      let dirtyDisk = false;
      if (fsSync.existsSync(rulesFilePath)) {
        try {
          const raw = await fs.readFile(rulesFilePath, "utf-8");
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && parsed.rules) {
            allRulesData = { rules: parsed.rules, weeklyMemory: parsed.weeklyMemory || {} };
            for (const dayEntry of Object.values<any>(allRulesData.rules)) {
              if (migrateYouthLeagueRulesInCategories(dayEntry?.categories)) {
                dirtyDisk = true;
              }
            }
          }
        } catch (e) {}
      }
      if (!allRulesData.weeklyMemory) allRulesData.weeklyMemory = {};

      // Merge with RDS PostgreSQL opw_calibrated_rules so saved rules survive deployments & disk resets
      // RULE: The source with the NEWER timestamp wins entirely for each category. No partial merging.
      try {
        const dbRes = await pgPool.query("SELECT day, categories, saved_at FROM opw_calibrated_rules");
        for (const row of dbRes.rows || []) {
          const d = String(row.day || '').toLowerCase();
          if (d === '_weekly_memory' && row.categories && typeof row.categories === 'object') {
            const dbMem = row.categories.weeklyMemory || row.categories;
            if (dbMem && typeof dbMem === 'object') {
              for (const [mDay, catMap] of Object.entries<any>(dbMem)) {
                if (!catMap || typeof catMap !== 'object') continue;
                if (!allRulesData.weeklyMemory![mDay]) allRulesData.weeklyMemory![mDay] = {};
                for (const [mCat, snaps] of Object.entries<any>(catMap)) {
                  if (!Array.isArray(snaps)) continue;
                  const existing = Array.isArray(allRulesData.weeklyMemory![mDay][mCat]) ? allRulesData.weeklyMemory![mDay][mCat] : [];
                  const byWeek = new Map<string, any>();
                  existing.forEach((s: any) => { if (s?.weekKey) byWeek.set(s.weekKey, s); });
                  snaps.forEach((s: any) => {
                    if (!s?.weekKey) return;
                    const prev = byWeek.get(s.weekKey);
                    const sTs = Date.parse(s.savedAt || '') || 0;
                    const pTs = prev ? (Date.parse(prev.savedAt || '') || 0) : -1;
                    if (sTs >= pTs) byWeek.set(s.weekKey, s);
                  });
                  const merged = Array.from(byWeek.values())
                    .sort((a, b) => String(a.weekKey).localeCompare(String(b.weekKey)))
                    .slice(-3);
                  if (JSON.stringify(merged) !== JSON.stringify(existing)) {
                    allRulesData.weeklyMemory![mDay][mCat] = merged;
                    dirtyDisk = true;
                  }
                }
              }
            }
            continue;
          }
          if (!d || !row.categories || typeof row.categories !== 'object') continue;
          if (migrateYouthLeagueRulesInCategories(row.categories)) {
            pgPool.query("UPDATE opw_calibrated_rules SET categories = $2::jsonb WHERE day = $1", [d, JSON.stringify(row.categories)]).catch(() => {});
          }
          const dbSavedAt = row.saved_at ? new Date(row.saved_at).toISOString() : new Date().toISOString();
          const dbTs = Date.parse(dbSavedAt) || 0;
          const diskEntry = allRulesData.rules[d];
          const diskTs = diskEntry?.savedAt ? (Date.parse(diskEntry.savedAt) || 0) : 0;

          if (!diskEntry || !diskEntry.categories) {
            allRulesData.rules[d] = {
              savedAt: dbSavedAt,
              categories: row.categories
            };
            dirtyDisk = true;
          } else {
            // Per-category merge: for each category, pick the version from whichever source (disk vs DB) is newer.
            // The newer source's category completely replaces the older one — no field-level mixing.
            const mergedCategories: Record<string, any> = {};
            const allCatKeys = new Set([...Object.keys(diskEntry.categories), ...Object.keys(row.categories)]);
            for (const catKey of allCatKeys) {
              const inDisk = diskEntry.categories[catKey];
              const inDb = row.categories[catKey];
              if (inDisk && !inDb) {
                mergedCategories[catKey] = inDisk;
              } else if (inDb && !inDisk) {
                mergedCategories[catKey] = inDb;
              } else {
                // Both exist: newer timestamp wins entirely
                mergedCategories[catKey] = dbTs >= diskTs ? inDb : inDisk;
              }
            }
            const newestSavedAt = dbTs >= diskTs ? dbSavedAt : diskEntry.savedAt;
            if (JSON.stringify(mergedCategories) !== JSON.stringify(diskEntry.categories)) {
              dirtyDisk = true;
            }
            allRulesData.rules[d] = {
              savedAt: newestSavedAt,
              categories: mergedCategories
            };
          }
        }
      } catch (dbErr: any) {
        console.warn("[OPW RULES GET] RDS fallback notice:", dbErr.message);
      }

      if (dirtyDisk) {
        if (!fsSync.existsSync(dataDir)) {
          await fs.mkdir(dataDir, { recursive: true });
        }
        await fs.writeFile(rulesFilePath, JSON.stringify(allRulesData, null, 2), "utf-8").catch(() => {});
      }

      return res.json(allRulesData);
    } catch (err: any) {
      console.warn("[OPW RULES GET] Error reading opw_rules.json:", err.message);
      return res.json({ rules: {} });
    }
  });

  // OPW P-Recom: Save Calibrated Rules directly to persistent JSON & RDS PostgreSQL
  let opwSaveToCodeQueue: Promise<void> = Promise.resolve();
  app.post("/api/opw/save-to-code", async (req, res) => {
    const runSaveTask = async () => {
      try {
        const { day = 'saturday', days, categories = {}, customTriggers } = req.body;
        if (!categories || typeof categories !== 'object') {
          return res.status(400).json({ error: "Missing required field: categories object." });
        }

        const validDays = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
        const targetDay = String(day || 'saturday').toLowerCase();
        const targetDaysList: string[] = Array.isArray(days) && days.length > 0
          ? Array.from(new Set(days.map((d: any) => String(d || '').toLowerCase()).filter((d: string) => validDays.has(d))))
          : (validDays.has(targetDay) ? [targetDay] : ['saturday']);
        if (validDays.has(targetDay) && !targetDaysList.includes(targetDay)) {
          targetDaysList.unshift(targetDay);
        }

        // Normalize category aliases so saving top_12_value also replaces top_10_value, upsets replaces upset, etc.
        const expandedCategories: Record<string, any> = {};
        for (const [catId, catPayload] of Object.entries<any>(categories)) {
          if (!catPayload || !Array.isArray(catPayload.rules)) continue;
          expandedCategories[catId] = catPayload;
          if (catId === 'top_12_value' || catId === 'top_10_value') {
            expandedCategories['top_12_value'] = catPayload;
            expandedCategories['top_10_value'] = catPayload;
          } else if (catId === 'upsets' || catId === 'upset' || catId === 'underdog_upsets') {
            expandedCategories['upsets'] = catPayload;
            expandedCategories['upset'] = catPayload;
            expandedCategories['underdog_upsets'] = catPayload;
          } else if (catId === 'bankers_dlive' || catId === 'banker') {
            expandedCategories['bankers_dlive'] = catPayload;
            expandedCategories['banker'] = catPayload;
          } else if (catId === 'value_bets' || catId === 'value_bet') {
            expandedCategories['value_bets'] = catPayload;
            expandedCategories['value_bet'] = catPayload;
          }
        }

        migrateYouthLeagueRulesInCategories(expandedCategories);
        console.log(`[OPW SAVE-TO-CODE] Saving ${Object.keys(expandedCategories).length} category keys across days [${targetDaysList.join(', ')}].`);

        // 1. Load existing rules from disk AND RDS so other categories on the same day are never deleted
        const dataDir = path.join(process.cwd(), "data");
        if (!fsSync.existsSync(dataDir)) {
          await fs.mkdir(dataDir, { recursive: true });
        }
        const rulesFilePath = path.join(dataDir, "opw_rules.json");
        let allRulesData: { rules: Record<string, any>; weeklyMemory?: Record<string, Record<string, any[]>> } = { rules: {}, weeklyMemory: {} };
        if (fsSync.existsSync(rulesFilePath)) {
          try {
            const raw = await fs.readFile(rulesFilePath, "utf-8");
            allRulesData = JSON.parse(raw) || { rules: {}, weeklyMemory: {} };
            if (!allRulesData.rules) allRulesData.rules = {};
            if (!allRulesData.weeklyMemory) allRulesData.weeklyMemory = {};
          } catch (e) {}
        }
        if (!allRulesData.weeklyMemory) allRulesData.weeklyMemory = {};

        try {
          const dbRes = await pgPool.query("SELECT day, categories, saved_at FROM opw_calibrated_rules WHERE day = ANY($1) OR day = '_weekly_memory'", [targetDaysList]);
          for (const row of dbRes.rows || []) {
            const d = String(row.day || '').toLowerCase();
            if (d === '_weekly_memory' && row.categories && typeof row.categories === 'object') {
              const dbMem = row.categories.weeklyMemory || row.categories;
              if (dbMem && typeof dbMem === 'object') {
                for (const [mDay, catMap] of Object.entries<any>(dbMem)) {
                  if (!catMap || typeof catMap !== 'object') continue;
                  if (!allRulesData.weeklyMemory![mDay]) allRulesData.weeklyMemory![mDay] = {};
                  for (const [mCat, snaps] of Object.entries<any>(catMap)) {
                    if (!Array.isArray(snaps)) continue;
                    const existing = Array.isArray(allRulesData.weeklyMemory![mDay][mCat]) ? allRulesData.weeklyMemory![mDay][mCat] : [];
                    const byWeek = new Map<string, any>();
                    existing.forEach((s: any) => { if (s?.weekKey) byWeek.set(s.weekKey, s); });
                    snaps.forEach((s: any) => { if (s?.weekKey && !byWeek.has(s.weekKey)) byWeek.set(s.weekKey, s); });
                    allRulesData.weeklyMemory![mDay][mCat] = Array.from(byWeek.values())
                      .sort((a, b) => String(a.weekKey).localeCompare(String(b.weekKey)))
                      .slice(-3);
                  }
                }
              }
              continue;
            }
            if (!d || !row.categories || typeof row.categories !== 'object') continue;
            // Pre-populate allRulesData with existing DB categories for categories NOT being saved now.
            // expandedCategories (the incoming save payload) always takes absolute precedence.
            const existingDiskCats = allRulesData.rules[d]?.categories || {};
            const mergedBase: Record<string, any> = {};
            // Start with DB categories as base
            for (const [k, v] of Object.entries(row.categories)) {
              mergedBase[k] = v;
            }
            // Overlay disk categories for any key not in DB
            for (const [k, v] of Object.entries(existingDiskCats)) {
              if (!mergedBase[k]) mergedBase[k] = v;
            }
            allRulesData.rules[d] = {
              savedAt: allRulesData.rules[d]?.savedAt || new Date().toISOString(),
              categories: mergedBase
            };
          }
        } catch (dbReadErr: any) {
          console.warn("[OPW SAVE-TO-CODE] RDS pre-merge read notice:", dbReadErr.message);
        }

        const nowIso = new Date().toISOString();
        const currentWeekKey = getIsoWeekKey(nowIso);
        for (const d of targetDaysList) {
          const prevSavedAt = allRulesData.rules[d]?.savedAt;
          const prevCategories = (allRulesData.rules[d] && typeof allRulesData.rules[d].categories === 'object')
            ? allRulesData.rules[d].categories
            : {};

          if (!allRulesData.weeklyMemory![d]) allRulesData.weeklyMemory![d] = {};
          const prevWeekKey = prevSavedAt ? getIsoWeekKey(prevSavedAt) : '';

          for (const [catId, catPayload] of Object.entries<any>(expandedCategories)) {
            if (!catPayload || !Array.isArray(catPayload.rules)) continue;
            const existingSnaps: any[] = Array.isArray(allRulesData.weeklyMemory![d][catId])
              ? [...allRulesData.weeklyMemory![d][catId]]
              : [];

            // Seed previous week snapshot automatically if it was from an earlier ISO week and not yet captured
            if (existingSnaps.length === 0 && prevWeekKey && prevWeekKey !== currentWeekKey && Array.isArray(prevCategories[catId]?.rules)) {
              const prevPts: Record<string, number> = {};
              prevCategories[catId].rules.forEach((r: any) => {
                if (r && typeof r.description === 'string' && typeof r.points === 'number') {
                  prevPts[r.description] = r.points;
                }
              });
              existingSnaps.push({ weekKey: prevWeekKey, savedAt: prevSavedAt, points: prevPts });
            }

            const newPts: Record<string, number> = {};
            catPayload.rules.forEach((r: any) => {
              if (r && typeof r.description === 'string' && typeof r.points === 'number') {
                newPts[r.description] = r.points;
              }
            });

            const idx = existingSnaps.findIndex(s => s?.weekKey === currentWeekKey);
            const snapEntry = { weekKey: currentWeekKey, savedAt: nowIso, points: newPts };
            if (idx >= 0) existingSnaps[idx] = snapEntry;
            else existingSnaps.push(snapEntry);

            allRulesData.weeklyMemory![d][catId] = existingSnaps
              .sort((a, b) => String(a.weekKey).localeCompare(String(b.weekKey)))
              .slice(-3);
          }

          // Merge category-level map while completely replacing the rules array inside each saved category
          const nextCategories = {
            ...prevCategories,
            ...expandedCategories
          };
          allRulesData.rules[d] = {
            savedAt: nowIso,
            categories: nextCategories
          };
        }

        await fs.writeFile(rulesFilePath, JSON.stringify(allRulesData, null, 2), "utf-8");
        console.log(`[OPW SAVE-TO-CODE] Persisted merged JSON rules + 3-week trigger memory to ${rulesFilePath} for [${targetDaysList.join(', ')}]`);

        // 2. Persist to RDS PostgreSQL opw_calibrated_rules table so rules survive server restarts & deployments
        for (const d of targetDaysList) {
          try {
            await pgPool.query(
              `INSERT INTO opw_calibrated_rules (day, categories, saved_at)
               VALUES ($1, $2::jsonb, $3)
               ON CONFLICT (day) DO UPDATE
               SET categories = EXCLUDED.categories,
                   saved_at = EXCLUDED.saved_at`,
              [d, JSON.stringify(allRulesData.rules[d].categories), nowIso]
            );
          } catch (dbWriteErr: any) {
            console.warn(`[OPW SAVE-TO-CODE] RDS write notice for ${d}:`, dbWriteErr.message);
          }
        }
        try {
          await pgPool.query(
            `INSERT INTO opw_calibrated_rules (day, categories, saved_at)
             VALUES ($1, $2::jsonb, $3)
             ON CONFLICT (day) DO UPDATE
             SET categories = EXCLUDED.categories,
                 saved_at = EXCLUDED.saved_at`,
            ['_weekly_memory', JSON.stringify({ weeklyMemory: allRulesData.weeklyMemory }), nowIso]
          );
        } catch (memDbErr: any) {
          console.warn(`[OPW SAVE-TO-CODE] RDS 3-week memory write notice:`, memDbErr.message);
        }

        if (Array.isArray(customTriggers) && customTriggers.length > 0) {
          const triggersFilePath = path.join(dataDir, "approved_custom_triggers.json");
          await fs.writeFile(triggersFilePath, JSON.stringify({ triggers: customTriggers }, null, 2), "utf-8");
          console.log(`[OPW SAVE-TO-CODE] Also persisted ${customTriggers.length} approved custom triggers to ${triggersFilePath}`);
        }

        return res.json({
          success: true,
          days: targetDaysList,
          savedAt: nowIso,
          message: `Calibrated rules permanently saved for ${targetDaysList.map(d => d.toUpperCase()).join(', ')}!`
        });
      } catch (err: any) {
        console.error("[OPW SAVE-TO-CODE] Error saving calibrated rules:", err);
        res.status(500).json({ error: `Failed to save calibrated rules to code: ${err.message}` });
      }
    };
    const nextRun = opwSaveToCodeQueue.then(runSaveTask, runSaveTask);
    opwSaveToCodeQueue = nextRun.then(() => undefined, () => undefined);
    await nextRun;
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));
    app.use((req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
