import { config } from 'dotenv';
config();
import xlsx from 'xlsx';
import { supabase } from '../src/lib/supabase';

async function updateLiveAnalysisUpsert() {
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

    const { data: upsertData, error } = await supabase
        .from('live_matches')
        .upsert(updates, { onConflict: 'id' })
        .select();

    if (error) {
        console.error('Error in upsert:', error);
    } else {
        console.log(`Successfully upserted ${upsertData?.length || 0} matches.`);
    }
    process.exit(0);
}

updateLiveAnalysisUpsert().catch(console.error);
