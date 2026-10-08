import { config } from 'dotenv';
config();
import xlsx from 'xlsx';
import { supabase } from '../src/lib/supabase';

async function updateLiveAnalysisUpsertChunks() {
    const filePath = 'C:\\Users\\USER\\Downloads\\NerdyMatches_daily_2026-08-09.xlsx';
    console.log(`Loading excel file: ${filePath}`);
    
    const wb = xlsx.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet) as any[];

    console.log(`Loaded ${data.length} rows from Excel.`);
    
    const updates = [];
    
    for (const row of data) {
        if (!row.Date || !row.Teams || !row.Result) continue;
        
        const result = row.Result.trim();
        if (result === '-' || result === '') continue;

        const dateStr = row.Date.trim();
        const teamsStr = row.Teams.trim();
        
        const id = teamsStr.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_') + '_' + dateStr.replace(/-/g, '_');
        updates.push({ id, result, updated_at: new Date().toISOString() });
    }

    console.log(`Found ${updates.length} matches with results to update.`);

    const chunkSize = 100;
    let successCount = 0;

    for (let i = 0; i < updates.length; i += chunkSize) {
        const chunk = updates.slice(i, i + chunkSize);
        console.log(`Upserting chunk ${i} to ${i + chunk.length}...`);
        
        const { error } = await supabase
            .from('live_matches')
            .upsert(chunk, { onConflict: 'id' });

        if (error) {
            console.error(`Error in chunk ${i}:`, error.message);
        } else {
            successCount += chunk.length;
        }
    }

    console.log(`Successfully upserted ${successCount} matches.`);
    process.exit(0);
}

updateLiveAnalysisUpsertChunks().catch(console.error);
