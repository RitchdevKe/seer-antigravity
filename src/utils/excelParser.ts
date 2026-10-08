import * as XLSX from 'xlsx';
import { Match } from '../types';
import { getStableMatchId } from './matchId';

function parseFormToWins(formStr: string): string {
    if (!formStr || formStr === 'NA') return formStr;
    const str = formStr.trim();
    if (/^\d+\s*:\s*\d+$/.test(str)) return str;
    
    const parts = str.split(':');
    if (parts.length === 2) {
        const homeWins = (parts[0].match(/W/gi) || []).length;
        const awayWins = (parts[1].match(/W/gi) || []).length;
        return `${homeWins}:${awayWins}`;
    }
    return str;
}

/**
 * Parses an Excel file (ArrayBuffer) into Match objects based on the specific
 * column format provided by the user, adopting the exact index-based schema
 * from the Data Importer to guarantee absolute consistency and correct parsing.
 */
export const parseExcelMatches = (buffer: ArrayBuffer): Match[] => {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // Convert to arrays of arrays (index-based)
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  
  if (!rows || rows.length === 0) return [];

  // Standard index assignments based on high-integrity Data Importer:
  let idIdx = 0;
  let teamsIdx = 1;
  let resultIdx = 2;
  let predIdx = 3;
  let ratingIdx = 4;
  let gsIdx = 5;
  let gaIdx = 6;
  let l10Idx = 7;
  let leIdx = 8;
  let moIdx = 9;
  let dateIdx = 10;
  let leagueIdx = -1;

  // Scan the first few rows to dynamically detect header positioning if present
  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(rows.length, 5); r++) {
    const row = rows[r];
    if (row && row.some(cell => typeof cell === 'string' && (/team/i.test(cell) || /result/i.test(cell) || /odds/i.test(cell)))) {
      headerRowIdx = r;
      break;
    }
  }

  if (headerRowIdx !== -1) {
    const headerRow = rows[headerRowIdx];
    headerRow.forEach((cell, idx) => {
      const s = String(cell || '').trim().toLowerCase();
      if (/team/i.test(s)) {
        teamsIdx = idx;
      } else if (/result/i.test(s)) {
        resultIdx = idx;
      } else if (/ratio/i.test(s) || /rating/i.test(s)) {
        ratingIdx = idx;
      } else if (s === 'gs') {
        gsIdx = idx;
      } else if (s === 'ga') {
        gaIdx = idx;
      } else if (/x2/i.test(s) || /1x2/i.test(s) || /pred/i.test(s)) {
        predIdx = idx;
      } else if (/le/i.test(s) || /h2h/i.test(s)) {
        leIdx = idx;
      } else if (/l10/i.test(s) || /form/i.test(s)) {
        l10Idx = idx;
      } else if (/market/i.test(s) || /odds/i.test(s)) {
        moIdx = idx;
      } else if (/date/i.test(s)) {
        dateIdx = idx;
      } else if (/league/i.test(s) || /competition/i.test(s) || /tournament/i.test(s) || /country/i.test(s)) {
        leagueIdx = idx;
      } else if (/id/i.test(s) || s === 'no' || s === 'no.') {
        idIdx = idx;
      }
    });
    console.log("Dynamically mapped Excel columns from header row:", { idIdx, teamsIdx, resultIdx, predIdx, ratingIdx, gsIdx, gaIdx, l10Idx, leIdx, moIdx, dateIdx, leagueIdx });
  } else {
    console.log("No explicit headers found. Defaulting to exact DataImporter column indices:", { idIdx, teamsIdx, resultIdx, predIdx, ratingIdx, gsIdx, gaIdx, l10Idx, leIdx, moIdx, dateIdx });
  }

  const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
  let validMatchesCount = 0;
  let noTeamsCount = 0;
  let invalidTeamsCount = 0;

  const matches: Match[] = [];

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < 2) continue;

    // Teams validation
    let teamsStr = String(row[teamsIdx] || '').trim();
    if (!teamsStr) {
      // Find a possible column representing teams if default is blank
      const possibleTeamIdx = row.findIndex(cell => typeof cell === 'string' && (cell.includes(' vs ') || cell.includes(' - ') || cell.includes(' v ')));
      if (possibleTeamIdx !== -1) {
        teamsStr = String(row[possibleTeamIdx]).trim();
      } else {
        noTeamsCount++;
        continue;
      }
    }

    // Skip inadvertent header lines
    if (teamsStr.toLowerCase().includes('team')) continue;

    // Standardize team separator to " vs "
    if (!teamsStr.includes(' vs ')) {
      teamsStr = teamsStr.replace(/\s+-\s+/, ' vs ')
                         .replace(/\s+v\s+/i, ' vs ')
                         .replace(/\s+VS\s+/i, ' vs ')
                         .replace(/\s*-\s*/, ' vs ');
      
      if (!teamsStr.includes(' vs ')) {
        invalidTeamsCount++;
        continue;
      }
    }

    let resultStr = String(row[resultIdx] || '').trim();
    if (!resultStr || resultStr.toLowerCase() === 'pending') {
      resultStr = 'pending';
    }

    let moStr = String(row[moIdx] || '').trim();
    if (!moStr) {
      moStr = "0,0,0";
    }

    const ratingStr = String(row[ratingIdx] || '').trim();
    const gsStr = String(row[gsIdx] || '').trim();
    const gaStr = String(row[gaIdx] || '').trim();
    const pred1x2Str = String(row[predIdx] || '').trim();
    const leStr = String(row[leIdx] || '').trim();
    const l10Str = parseFormToWins(String(row[l10Idx] || '').trim());

    let dateStr = String(row[dateIdx] || '').trim();
    let parsedDate: string | undefined = undefined;

    if (dateStr) {
      if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(dateStr)) {
        parsedDate = dateStr.replace(/\//g, '-');
      } else if (/^\d{2}[-/]\d{2}[-/]\d{4}/.test(dateStr)) {
          // Convert DD-MM-YYYY or DD/MM/YYYY to YYYY-MM-DD
          const parts = dateStr.split(/[-/\s]/);
          if (parts.length >= 3) {
             const day = parts[0];
             const month = parts[1];
             const year = parts[2];
             const timePart = parts.slice(3).join(' ');
             parsedDate = `${year}-${month}-${day}${timePart ? ' ' + timePart : ''}`;
          }
      } else if (!isNaN(Number(dateStr))) {
        try {
          const excelDate = new Date((Number(dateStr) - 25569) * 86400 * 1000);
          // Format as YYYY-MM-DD HH:mm
          const year = excelDate.getUTCFullYear();
          const month = String(excelDate.getUTCMonth() + 1).padStart(2, "0");
          const day = String(excelDate.getUTCDate()).padStart(2, "0");
          const hours = String(excelDate.getUTCHours()).padStart(2, "0");
          const minutes = String(excelDate.getUTCMinutes()).padStart(2, "0");
          parsedDate = `${year}-${month}-${day} ${hours}:${minutes}`;
        } catch {
          parsedDate = undefined;
        }
      } else {
        parsedDate = dateStr; // Pass through whatever the scraper provided so getAnalysisDateString can try to parse it
      }
    }

    const providedId = String(row[idIdx] || '').trim();
    const hasValidId = providedId !== '' && providedId !== 'undefined';
    
    const matchData = {
      teams: teamsStr,
      result: resultStr,
      mo: moStr,
      rating: ratingStr,
      gs: gsStr,
      ga: gaStr,
      pred1x2: pred1x2Str,
      le: leStr,
      l10: l10Str,
      league: leagueIdx !== -1 && row[leagueIdx] ? String(row[leagueIdx]).trim() : undefined,
      date: parsedDate || undefined,
      isPrecalculated: true
    } as Match;

    const id = getStableMatchId(matchData);

    matches.push({
      ...matchData,
      id
    });
    
    validMatchesCount++;
  }

  console.log(`Excel Parse Summary: Total Rows = ${rows.length}, Valid Matches = ${validMatchesCount}. Discarded: ${noTeamsCount} (No Teams String), ${invalidTeamsCount} (Separator matching error).`);

  return matches;
};
