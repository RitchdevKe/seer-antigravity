import { config } from 'dotenv';
config();
import xlsx from 'xlsx';
import { supabase } from '../src/lib/supabase';
import { getStableMatchId } from '../src/utils/matchId';
import { Match } from '../src/types';

async function uploadLiveMatches() {
    const filePath = 'C:\\Users\\USER\\Downloads\\NerdyMatches_daily_2026-08-10.xlsx';
    console.log(`Loading excel file: ${filePath}`);
    
    const wb = xlsx.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    console.log(`Loaded ${rows.length} rows from Excel.`);
    
    if (!rows || rows.length === 0) return;

    let idIdx = 0, teamsIdx = 1, resultIdx = 2, predIdx = 3, ratingIdx = 4;
    let gsIdx = 5, gaIdx = 6, l10Idx = 7, leIdx = 8, moIdx = 9, dateIdx = 10;

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
        if (/team/i.test(s)) teamsIdx = idx;
        else if (/result/i.test(s)) resultIdx = idx;
        else if (/ratio/i.test(s) || /rating/i.test(s)) ratingIdx = idx;
        else if (s === 'gs') gsIdx = idx;
        else if (s === 'ga') gaIdx = idx;
        else if (/x2/i.test(s) || /1x2/i.test(s) || /pred/i.test(s)) predIdx = idx;
        else if (/le/i.test(s) || /h2h/i.test(s)) leIdx = idx;
        else if (/l10/i.test(s) || /form/i.test(s)) l10Idx = idx;
        else if (/market/i.test(s) || /odds/i.test(s)) moIdx = idx;
        else if (/date/i.test(s)) dateIdx = idx;
        else if (/id/i.test(s) || s === 'no' || s === 'no.') idIdx = idx;
      });
    }

    const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
    const matches: any[] = [];

    for (let r = startRow; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length < 2) continue;

      let teamsStr = String(row[teamsIdx] || '').trim();
      if (!teamsStr) {
        const possibleTeamIdx = row.findIndex(cell => typeof cell === 'string' && (cell.includes(' vs ') || cell.includes(' - ') || cell.includes(' v ')));
        if (possibleTeamIdx !== -1) teamsStr = String(row[possibleTeamIdx]).trim();
        else continue;
      }
      if (teamsStr.toLowerCase().includes('team')) continue;
      if (!teamsStr.includes(' vs ')) {
        teamsStr = teamsStr.replace(/\s+-\s+/, ' vs ').replace(/\s+v\s+/i, ' vs ').replace(/\s+VS\s+/i, ' vs ').replace(/\s*-\s*/, ' vs ');
        if (!teamsStr.includes(' vs ')) continue;
      }

      let resultStr = String(row[resultIdx] || '').trim();
      if (!resultStr || resultStr.toLowerCase() === 'pending') resultStr = 'pending';
      let moStr = String(row[moIdx] || '').trim();
      if (!moStr) moStr = "0,0,0";

      let dateStr = String(row[dateIdx] || '').trim();
      let parsedDate = dateStr;
      if (dateStr && !isNaN(Number(dateStr))) {
        try {
          const excelDate = new Date((Number(dateStr) - 25569) * 86400 * 1000);
          const year = excelDate.getUTCFullYear();
          const month = String(excelDate.getUTCMonth() + 1).padStart(2, "0");
          const day = String(excelDate.getUTCDate()).padStart(2, "0");
          parsedDate = `${year}-${month}-${day}`;
        } catch { parsedDate = dateStr; }
      } else if (dateStr && /^\d{2}[-/]\d{2}[-/]\d{4}/.test(dateStr)) {
          const parts = dateStr.split(/[-/\s]/);
          parsedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }

      const matchData = {
        teams: teamsStr,
        result: resultStr,
        mo: moStr,
        rating: String(row[ratingIdx] || '').trim(),
        gs: String(row[gsIdx] || '').trim(),
        ga: String(row[gaIdx] || '').trim(),
        pred1x2: String(row[predIdx] || '').trim(),
        le: String(row[leIdx] || '').trim(),
        l10: String(row[l10Idx] || '').trim(),
        date_played: parsedDate,
      };

      const fullMatch = {
        teams: teamsStr,
        date_played: parsedDate,
        mo: moStr,
        rating: matchData.rating,
        gs: matchData.gs,
        ga: matchData.ga,
        pred1x2: matchData.pred1x2,
        le: matchData.le,
        l10: matchData.l10,
        result: matchData.result,
        isPrecalculated: true,
        isDaily: true
      };
      
      const id = getStableMatchId(fullMatch as any);
      (fullMatch as any).id = id;

      matches.push({
        id,
        teams: teamsStr,
        result: matchData.result || '-',
        date: parsedDate || '',
        data: fullMatch,
        updated_at: new Date().toISOString()
      });
    }

    console.log(`Found ${matches.length} matches to upload.`);

    const chunkSize = 100;
    let successCount = 0;

    for (let i = 0; i < matches.length; i += chunkSize) {
        const chunk = matches.slice(i, i + chunkSize);
        console.log(`Upserting chunk ${i} to ${i + chunk.length}...`);
        
        const { error } = await supabase
            .from('live_matches')
            .upsert(chunk, { onConflict: 'id' });

        if (error) {
            console.error(`Error in chunk ${i}:`, error);
        } else {
            successCount += chunk.length;
        }
    }

    console.log(`Successfully upserted ${successCount} matches into live_matches.`);
    process.exit(0);
}

uploadLiveMatches().catch(console.error);
