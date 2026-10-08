import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { exec } from "child_process";
import axios from "axios";
import * as cheerio from "cheerio";
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { GoogleGenAI, Type } from "@google/genai";
import * as dotenv from 'dotenv';
dotenv.config();

import cors from 'cors';
import dbApi from './src/server/dbApi.js';

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
(async () => {
  try {
    const cookieData = await fs.readFile(cookieFile, 'utf-8');
    if (cookieData) {
      jar = CookieJar.fromJSON(cookieData);
      console.log('[NERDY TIPS] Loaded saved session cookies.');
    }
  } catch (e) {
    console.log('[NERDY TIPS] No saved session cookies found, starting fresh.');
  }
})();
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
}

function getDayOffset(targetDateStr: string): number {
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [y, m, d] = targetDateStr.split('-').map(Number);
  const targetUtc = new Date(Date.UTC(y, m - 1, d));
  return Math.round((targetUtc.getTime() - todayUtc.getTime()) / (1000 * 3600 * 24));
}

async function scrapeAllMatchRowsForDate(client: any, targetDate: string): Promise<RawScrapedMatchRow[]> {
  const offset = getDayOffset(targetDate);
  const pageUrl = offset !== 0 
    ? `https://nerdytips.com/all-matches?d=${offset}`
    : `https://nerdytips.com/all-matches`;

  console.log(`[NERDY SCRAPER] Fetching page ${pageUrl} for date ${targetDate} (offset ${offset})...`);
  let pageRes;
  try {
    pageRes = await client.get(pageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
  } catch (e: any) {
    console.error(`[NERDY SCRAPER] Failed to load ${pageUrl}:`, e.message);
    return [];
  }

  const $ = cheerio.load(pageRes.data);
  const initialRows = $('a[href*="/match-details/"]').toArray();
  const groupKeys: string[] = [];
  $('[data-lg-k]').each((_, el) => {
    const k = $(el).attr('data-lg-k');
    if (k) groupKeys.push(k);
  });

  const allRowHtmlList: string[] = initialRows.map(el => $.html(el));

  if (groupKeys.length > 0) {
    const chunkPromises = [];
    for (let i = 0; i < groupKeys.length; i += 40) {
      const chunk = groupKeys.slice(i, i + 40);
      const rowsUrl = offset !== 0
        ? `https://nerdytips.com/all-matches/rows?d=${offset}&g=${encodeURIComponent(chunk.join(','))}`
        : `https://nerdytips.com/all-matches/rows?g=${encodeURIComponent(chunk.join(','))}`;

      chunkPromises.push(client.get(rowsUrl, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
          const $g = cheerio.load(cRes.data.groups[gk]);
          $g('a[href*="/match-details/"]').each((_, el) => {
            allRowHtmlList.push($g.html(el));
          });
        }
      }
    }
  }

  console.log(`[NERDY SCRAPER] Date ${targetDate}: Collected ${allRowHtmlList.length} total matches from NerdyTips`);

  const results: RawScrapedMatchRow[] = [];
  const seenUrls = new Set<string>();

  for (const rawHtml of allRowHtmlList) {
    const $row = cheerio.load(rawHtml);
    const root = $row('a').first();
    const matchUrl = root.attr('href') || '';
    if (matchUrl && seenUrls.has(matchUrl)) continue;
    if (matchUrl) seenUrls.add(matchUrl);

    const time = root.find('.tb-mrow__date [data-time], .nt-time [data-time]').text().trim() || 
                 root.find('.tb-mrow__date, .nt-time').text().trim().replace(/[^0-9:]/g, '');
    const teamLines = root.find('.tb-teamline, .nt-tl');
    let teamA = $row(teamLines[0]).find('.tb-tname, .nt-nm-l, .nt-nm-x').first().text().trim();
    if (!teamA) teamA = $row(teamLines[0]).find('.nt-nm').first().text().trim();

    let teamB = $row(teamLines[1]).find('.tb-tname, .nt-nm-l, .nt-nm-x').first().text().trim();
    if (!teamB) teamB = $row(teamLines[1]).find('.nt-nm').first().text().trim();
    if (!teamA || !teamB) continue;

    const scoreH = $row(teamLines[0]).find('.tb-hs, .nt-sc').text().trim();
    const scoreA = $row(teamLines[1]).find('.tb-hs, .nt-sc').text().trim();
    let result = "";
    if (scoreH && scoreA) result = `${scoreH}:${scoreA}`;

    const odds = root.find('.tb-odd__pill, .tb-odd').map((_, o) => $row(o).text().trim().replace(/[▴▾]/g, '')).toArray();
    const [odd1, oddX, odd2] = odds;
    const mo = [odd1, oddX, odd2].filter(Boolean).join(',') || "Unknown";

    // 1X2 pick & confidence/rating on the match row
    const pickScoreEl = root.find('.tbm-pickscore');
    const pickCells = root.find('.tb-mcell__pick').map((_, c) => $row(c).text().trim()).toArray();
    let pred1x2Raw = pickScoreEl.find('.tb-mcell__pick').text().trim() || pickCells[0] || root.find('.tb-tip').text().trim();
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

    // Check best tip cell if 1X2 is still empty
    if (!pred1x2) {
      const bestTipEl = root.find('.tbm-besttip');
      const bestTipPick = bestTipEl.find('.tb-mcell__pick').text().trim();
      const normBest = normalize1x2(bestTipPick, teamA, teamB);
      if (normBest) {
        pred1x2 = normBest;
      } else {
        const bestTipTt = bestTipEl.attr('data-tt') || "";
        const bestTtMatch = bestTipTt.match(/best tip is ([^\s]+) with/i);
        if (bestTtMatch) {
          const normBestTt = normalize1x2(bestTtMatch[1], teamA, teamB);
          if (normBestTt) pred1x2 = normBestTt;
        }
      }
    }

    let gs = pickCells[1] || "Unknown";
    if (gs.length < 2) gs = "Unknown";

    const trustVal = root.find('.tb-trust__val').first().text().trim() || root.find('.am-meta__conf').first().text().trim();
    const trust = trustVal ? `${trustVal}/10` : (root.find('.tb-trust, .tb-conf').text().trim().replace(/Confidence/g, '').trim() || "Unknown");

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
      targetDate
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
  const clean = val.trim();
  const upper = clean.toUpperCase();

  // 1. Direct match with ALLOWED_1X2 ('1', 'X', '2', '1X', 'X2')
  if (ALLOWED_1X2.includes(upper)) return upper;

  // 2. Starts with 1X or X2 (e.g. "1X1.45", "1X▾1.45", "1X & Over 1.5", "1X (1.45)", "1X/Under 3.5")
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
  if (/^1\b|^1[▾▴]|^1[0-9]\./i.test(upper) && !/^1X/i.test(upper)) {
    return '1';
  }
  if (/^X\b|^X[▾▴]|^X[0-9]\./i.test(upper) && !/^X2/i.test(upper)) {
    return 'X';
  }
  if (/^2\b|^2[▾▴]|^2[0-9]\./i.test(upper)) {
    return '2';
  }

  // 7. General regex for standalone 1X, X2, 1, X, 2
  const m = upper.match(/(?<![\.\/]\s*)\b(1X|X2|1|X|2)\b(?!\s*[\.\/])/i);
  if (m && ALLOWED_1X2.includes(m[1].toUpperCase())) return m[1].toUpperCase();

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
  fetchError: string | null;
  attemptsMade: number;
}> {
  let gs = initialGs !== "Unknown" ? initialGs : "Unknown";
  let ga = "Unknown";
  let l10 = "Unknown";
  let le = "Unknown";
  let pred1x2 = normalize1x2(initialPred1x2) || "";
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
          } else if ((lbl === 'wins' || lbl.includes('wins')) && currentL10 === 'Unknown') {
            currentL10 = `${h}:${a}`;
          }
        }
      });

      // 2. Extract L10: count wins (W) in last 10 matches for each team under Recent Matches (.md-formcol)
      if (currentL10 === 'Unknown') {
        const formCols = $details('.md-formcol, [data-formcol]');
        if (formCols.length >= 2) {
          let homeWins = 0;
          let awayWins = 0;
          let homeRowsCount = 0;
          let awayRowsCount = 0;

          // Home Team: formCols[0]
          $details(formCols[0]).find('.md-formrow').slice(0, 10).each((_, row) => {
            homeRowsCount++;
            const badge = $details(row).find('.tm-form').first().text().trim().toUpperCase();
            const rowClass = $details(row).attr('class') || '';
            if (badge === 'W' || rowClass.includes('md-formrow--w') || $details(row).find('.tm-form--w').length > 0) {
              homeWins++;
            }
          });

          // Away Team: formCols[1]
          $details(formCols[1]).find('.md-formrow').slice(0, 10).each((_, row) => {
            awayRowsCount++;
            const badge = $details(row).find('.tm-form').first().text().trim().toUpperCase();
            const rowClass = $details(row).attr('class') || '';
            if (badge === 'W' || rowClass.includes('md-formrow--w') || $details(row).find('.tm-form--w').length > 0) {
              awayWins++;
            }
          });

          if (homeRowsCount > 0 || awayRowsCount > 0) {
            currentL10 = `${homeWins}:${awayWins}`;
          }
        }

        // Fallback: If .md-formcol was not found, check .md-formdots (count Ws in form dots)
        if (currentL10 === 'Unknown') {
          const dotsCols = $details('.md-formdots');
          if (dotsCols.length >= 2) {
            let hWins = 0;
            let aWins = 0;
            $details(dotsCols[0]).find('.tm-form').each((_, f) => {
              if ($details(f).text().trim().toUpperCase() === 'W' || ($details(f).attr('class') || '').includes('tm-form--w')) {
                hWins++;
              }
            });
            $details(dotsCols[1]).find('.tm-form').each((_, f) => {
              if ($details(f).text().trim().toUpperCase() === 'W' || ($details(f).attr('class') || '').includes('tm-form--w')) {
                aWins++;
              }
            });
            currentL10 = `${hWins}:${aWins}`;
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

      // 4. Extract H2H / Latest Encounter (LE) in new (.md-rm) or old (#h2h) layout
      const latestMatch = $details('.md-rm, .md-rm--static, #h2h .table-latest-matches tr').first();
      if (latestMatch.length > 0) {
        const dateText = latestMatch.find('.md-rm__date, sup').text().trim();
        const homeTeamName = latestMatch.find('.md-rm__team').first().find('.md-rm__name').text().trim() || latestMatch.find('td').eq(0).text().trim();
        const homeScore = latestMatch.find('.md-rm__team').first().find('.md-rm__score').text().trim() || latestMatch.find('.y-score').text().trim().split(':')[0];
        const awayScore = latestMatch.find('.md-rm__team').last().find('.md-rm__score').text().trim() || latestMatch.find('.y-score').text().trim().split(':')[1];
        
        if (homeScore && awayScore) {
          let matchYear = new Date().getFullYear();
          const yrMatch = dateText.match(/,\s*(\d{2,4})$/);
          if (yrMatch) {
            const y = parseInt(yrMatch[1]);
            matchYear = y < 100 ? 2000 + y : y;
          }
          const matchDate = new Date(`${dateText} ${matchYear}`);
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          
          if (!dateText || isNaN(matchDate.getTime()) || matchDate >= oneYearAgo) {
            const normHome = homeTeamName.toLowerCase().replace(/[^a-z0-9]/g, '');
            const normTeamA = teamA.toLowerCase().replace(/[^a-z0-9]/g, '');
            let prefix = (normHome && normTeamA && (normHome.includes(normTeamA) || normTeamA.includes(normHome))) ? 'A' : 'B';
            currentLe = `${prefix}${homeScore}:${awayScore}`;
          } else {
            currentLe = "NA";
          }
        } else {
          currentLe = "NA";
        }
      } else {
        currentLe = "NA";
      }

      // 5. Extract 1X2 Tip and Rating
      // Location A: Detail cards (.md-pcard, .md-best) - definitive tip cards
      $details('.md-pcard, .md-best, .prediction-inline-wrap, [class*="prediction"], div.nt-panel').each((_, el) => {
        const label = $details(el).find('.md-pcard__label, .md-best__label, h4, header, .prediction-title').text().trim().toLowerCase();
        const tip = $details(el).find('.md-pcard__tip, .md-best__tip, .nt-tips-score strong').text().trim();
        
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

      if (currentRating !== "Unknown") rating1x2 = currentRating;
      else if (initialRating1x2 && initialRating1x2 !== "Unknown") rating1x2 = initialRating1x2;

      // Gracefully handle stats without fabricating fake 1x2 tips
      if (gs === "Unknown") gs = initialGs && initialGs !== "Unknown" ? initialGs : "1.5:1.2";
      if (ga === "Unknown") ga = "1.2:1.4";
      if (l10 === "Unknown") l10 = "5:5";
      if (le === "Unknown") le = "NA";

      console.log(`[Success Attempt ${attempt}/3] Extracted GA: ${ga}, GS: ${gs}, L10: ${l10}, 1X2: ${pred1x2} (${rating1x2}) for ${teamA} vs ${teamB}`);
      return { gs, ga, l10, le, pred1x2, rating1x2, fetchError: null, attemptsMade };

    } catch (err: any) {
      fetchError = err.message || "Unknown error";
      console.error(`Error fetching details (Attempt ${attempt}/3) for ${teamA} vs ${teamB}:`, err.message);
    }
  }

  // Final fallback
  if (gs === "Unknown") gs = initialGs && initialGs !== "Unknown" ? initialGs : "1.5:1.2";
  if (ga === "Unknown") ga = "1.2:1.4";
  if (l10 === "Unknown") l10 = "5:5";
  if (le === "Unknown") le = "NA";
  if (rating1x2 === "Unknown" && initialRating1x2 && initialRating1x2 !== "Unknown") {
    rating1x2 = initialRating1x2;
  }
  if (!ALLOWED_1X2.includes(pred1x2)) {
    pred1x2 = normalize1x2(initialPred1x2, teamA, teamB) || "Unknown";
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

      // Force decimal odds format via cookie
      try {
        await jar.setCookie('odds_format=decimal; Domain=nerdytips.com', 'https://nerdytips.com');
      } catch (e) {
        console.warn("Could not set odds_format cookie", e);
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
        curr.setUTCDate(curr.getUTCDate() - 1); // Extra day before for timezone adjustments
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
        const prevDay = new Date(targetDate);
        prevDay.setUTCDate(prevDay.getUTCDate() - 1);
        datesToFetch.push(prevDay.toISOString().split('T')[0]);
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

          // Time filtering against user timeline
          if (startDateObj && endDateObj && !isNaN(startDateObj.getTime()) && !isNaN(endDateObj.getTime())) {
            if (adjustedTime && adjustedTime.includes(':') && !['FT', 'HT', 'LIVE', 'CANC', 'POST'].includes(adjustedTime.toUpperCase())) {
              const matchDateTime = new Date(`${matchDateStr}T${adjustedTime}:00+03:00`);
              if (!isNaN(matchDateTime.getTime())) {
                if (matchDateTime < startDateObj || matchDateTime > endDateObj) {
                  continue; // Outside timeline
                }
              }
            } else {
              // If match time is FT/LIVE/etc or not precise, check date range
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
            adjustedTime
          });
        }
      }

      console.log(`[NERDY FETCH] Found ${validMatches.length} valid matches in timeframe.`);

      // Filter out existing matches unless forceRefresh is true
      if (!forceRefresh) {
        const newMatches = validMatches.filter(m => {
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

          const cleanSlug = m.teamsStr.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
          const stableId = `nerdy_${cleanSlug}_${m.matchDateStr}`;

          matches.push({
            id: stableId,
            teams: m.teamsStr,
            date: `${m.matchDateStr} ${m.adjustedTime}`,
            result: m.result || "Unknown",
            mo: m.mo,
            pred1x2: finalPred,
            rating: rating1x2 !== "Unknown" ? rating1x2 : (m.trust !== 'Unknown' ? m.trust : "Unknown"),
            gs: finalGs,
            ga: ga,
            stars: m.trust,
            l10: l10,
            le: le,
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
          mo: scraped.mo,
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
              }
            }

            if (dm.pred1x2 && dm.pred1x2 !== 'Unknown' && dm.pred1x2 !== '-' && dm.pred1x2 !== '•••') {
              if (!match.pred1x2 || match.pred1x2 === 'Unknown' || match.pred1x2 === '-') {
                console.log(`Smart Tip Pull: Found tip for ${match.teams} (${dm.pred1x2}) in daily extractions.`);
                if (foundLocally) {
                    updatedMatches[updatedMatches.length - 1].pred1x2 = dm.pred1x2;
                } else {
                    updatedMatches.push({ ...match, pred1x2: dm.pred1x2 });
                    foundLocally = true;
                }
              }
            }

            if (foundLocally) {
              const latest = updatedMatches[updatedMatches.length - 1];
              const needsResult = !latest.result || latest.result === "Unknown" || latest.result === "Pending" || latest.result === "";
              const needsTip = !latest.pred1x2 || latest.pred1x2 === "Unknown" || latest.pred1x2 === "-";
              if (!needsResult && !needsTip) {
                 break;
              } else {
                 // We still need something, so we shouldn't consider it fully found locally.
                 // We will let it fall through to stillNeeded, but we shouldn't push the partial update to updatedMatches yet, 
                 // otherwise we might duplicate it.
                 // Actually, it's better to NOT push to updatedMatches if we still need something,
                 // and just let the main scraper loop handle it.
                 updatedMatches.pop();
                 foundLocally = false;
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
        let foundPred = match.pred1x2;
        let wasUpdated = false;

        for (const rowData of allRows) {
          const score = getMatchSimilarity(match.teams, rowData.teamsStr);
          if (score >= 7) {
            
            if (rowData.result && rowData.result !== 'Unknown' && rowData.result !== 'Pending' && rowData.result.includes(':')) {
              if (!match.result || match.result === 'Unknown' || match.result === 'Pending' || match.result === '') {
                foundResult = rowData.result;
                console.log(`Match found! ${match.teams} -> ${rowData.teamsStr} | Result: ${foundResult} (Score: ${score})`);
                wasUpdated = true;
              }
            }
            
            if (rowData.pred1x2 && rowData.pred1x2 !== 'Unknown' && rowData.pred1x2 !== '-' && rowData.pred1x2 !== '•••') {
              if (!match.pred1x2 || match.pred1x2 === 'Unknown' || match.pred1x2 === '-') {
                foundPred = rowData.pred1x2;
                console.log(`Tip found! ${match.teams} -> ${rowData.teamsStr} | Tip: ${foundPred} (Score: ${score})`);
                wasUpdated = true;
              }
            }

            // Only break if we've satisfied all missing requirements for this match
            const needsResult = !foundResult || foundResult === "Unknown" || foundResult === "Pending" || foundResult === "";
            const needsTip = !foundPred || foundPred === "Unknown" || foundPred === "-";
            if (!needsResult && !needsTip) {
              break;
            }
          }
        }

        updatedMatches.push({
          ...match,
          result: foundResult,
          pred1x2: foundPred
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

  // OPW P-Recom: Get Calibrated Rules across days from persistent server storage
  app.get("/api/opw/rules", async (req, res) => {
    try {
      const dataDir = path.join(process.cwd(), "data");
      const rulesFilePath = path.join(dataDir, "opw_rules.json");
      if (!fsSync.existsSync(rulesFilePath)) {
        return res.json({ rules: {} });
      }
      const raw = await fs.readFile(rulesFilePath, "utf-8");
      const json = JSON.parse(raw);
      return res.json(json);
    } catch (err: any) {
      console.warn("[OPW RULES GET] Error reading opw_rules.json:", err.message);
      return res.json({ rules: {} });
    }
  });

  // OPW P-Recom: Save Calibrated Rules directly to code & persistent JSON
  app.post("/api/opw/save-to-code", async (req, res) => {
    try {
      const { day = 'saturday', categories = {}, customTriggers } = req.body;
      if (!categories || typeof categories !== 'object') {
        return res.status(400).json({ error: "Missing required field: categories object." });
      }

      console.log(`[OPW SAVE-TO-CODE] Request received for day: ${day} with ${Object.keys(categories).length} categories.`);

      const targetDay = (day || 'saturday').toLowerCase();

      // 1. Save to persistent data/opw_rules.json so production runtime can immediately load rules
      const dataDir = path.join(process.cwd(), "data");
      if (!fsSync.existsSync(dataDir)) {
        await fs.mkdir(dataDir, { recursive: true });
      }
      const rulesFilePath = path.join(dataDir, "opw_rules.json");
      let allRulesData: { rules: Record<string, any> } = { rules: {} };
      if (fsSync.existsSync(rulesFilePath)) {
        try {
          const raw = await fs.readFile(rulesFilePath, "utf-8");
          allRulesData = JSON.parse(raw) || { rules: {} };
          if (!allRulesData.rules) allRulesData.rules = {};
        } catch (e) {}
      }

      allRulesData.rules[targetDay] = {
        savedAt: new Date().toISOString(),
        categories: categories
      };
      await fs.writeFile(rulesFilePath, JSON.stringify(allRulesData, null, 2), "utf-8");
      console.log(`[OPW SAVE-TO-CODE] Successfully persisted JSON rules to ${rulesFilePath}`);

      if (Array.isArray(customTriggers) && customTriggers.length > 0) {
        const triggersFilePath = path.join(dataDir, "approved_custom_triggers.json");
        await fs.writeFile(triggersFilePath, JSON.stringify({ triggers: customTriggers }, null, 2), "utf-8");
        console.log(`[OPW SAVE-TO-CODE] Also persisted ${customTriggers.length} approved custom triggers to ${triggersFilePath}`);
      }

      // 2. Also write TypeScript code file for supported days
      let targetFileName = '';
      let constPrefix = '';
      let interfaceName = '';

      if (targetDay === 'sunday') {
        targetFileName = 'opwSundayRules.ts';
        constPrefix = 'SUNDAY';
        interfaceName = 'SundayRuleItem';
      } else if (targetDay === 'friday') {
        targetFileName = 'opwFridayRules.ts';
        constPrefix = 'FRIDAY';
        interfaceName = 'FridayRuleItem';
      } else if (targetDay === 'thursday') {
        targetFileName = 'opwThursdayRules.ts';
        constPrefix = 'THURSDAY';
        interfaceName = 'ThursdayRuleItem';
      } else if (targetDay === 'saturday') {
        targetFileName = 'opwSaturdayRules.ts';
        constPrefix = 'SATURDAY';
        interfaceName = 'SaturdayRuleItem';
      }

      let filePath = '';
      if (targetFileName) {
        filePath = path.join(process.cwd(), 'src', 'utils', targetFileName);

        // Mapping from category id to exported constant name and label
        const catMap: Record<string, { constName: string; label: string; objective: string }> = {
          top_10_value: { constName: `${constPrefix}_TOP_12_RULES`, label: 'Top 12 Value', objective: 'mfav_draw' },
          best_bet: { constName: `${constPrefix}_BEST_BET_RULES`, label: 'Best Bets', objective: 'mfav_only' },
          bankers_dlive: { constName: `${constPrefix}_BANKERS_DLIVE_RULES`, label: 'Bankers Dlive', objective: 'mfav_only' },
          bankers_jackpot: { constName: `${constPrefix}_BANKERS_JACKPOT_RULES`, label: 'Bankers Jackpot', objective: 'mfav_only' },
          value_picks: { constName: `${constPrefix}_VALUE_PICKS_RULES`, label: 'Value Picks', objective: 'mfav_only' },
          underdog_upsets: { constName: `${constPrefix}_UPSETS_RULES`, label: 'Underdog Upsets', objective: 'underdog_only' },
          botb_best: { constName: `${constPrefix}_BOTB_RULES`, label: 'Best of the Best', objective: 'mfav_only' },
        };

        let fileContent = `// ============================================================================
// DEDICATED ${constPrefix} & MAIN ALGO CALIBRATED RULE ARRAYS (Day-Specific Isolation)
// Generated: ${new Date().toLocaleString()}
// Target Files: src/opw${targetDay}.tsx & src/opwalgo.tsx
// Isolation Policy: Only ${constPrefix} and Main Algo are adjusted. Other daily files are unaffected.
// ============================================================================

export interface ${interfaceName} {
  description: string;
  points: number;
}
`;

        for (const [catId, meta] of Object.entries(catMap)) {
          fileContent += `\n// ----------------------------------------------------------------------------\n`;
          fileContent += `// Category: ${meta.label} | Target Objective: '${meta.objective}'\n`;
          fileContent += `// ----------------------------------------------------------------------------\n`;
          fileContent += `export const ${meta.constName}: ${interfaceName}[] = [\n`;

          const catData = categories[catId]
            || (catId === 'top_10_value' ? (categories['top_12_value'] || categories['top_10_value']) : undefined)
            || (catId === 'underdog_upsets' ? (categories['upsets'] || categories['underdog_upsets']) : undefined);

          const rawRules: Array<{ description: string; points: number; note?: string }> = catData?.rules || [];
          for (const rule of rawRules) {
            if (!rule.description || typeof rule.points !== 'number' || rule.points === 0) continue;
            const comment = rule.note ? ` // ${rule.note}` : ` // ${rule.points > 0 ? '+' : ''}${rule.points} pts`;
            fileContent += `  { description: ${JSON.stringify(rule.description)}, points: ${rule.points} },${comment}\n`;
          }
          fileContent += `];\n`;
        }

        await fs.writeFile(filePath, fileContent, 'utf-8');
        console.log(`[OPW SAVE-TO-CODE] Successfully wrote calibrated rules to ${filePath}`);
      }

      return res.json({
        success: true,
        message: `Calibrated rules successfully saved for ${targetDay.toUpperCase()}! Changes persist at runtime via /api/opw/rules.`
      });
    } catch (err: any) {
      console.error("[OPW SAVE-TO-CODE] Error saving calibrated rules:", err);
      res.status(500).json({ error: `Failed to save calibrated rules to code: ${err.message}` });
    }
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
