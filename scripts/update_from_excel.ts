import { config } from 'dotenv';
config();
import xlsx from 'xlsx';
import { supabase } from '../src/lib/supabase';

async function updateLiveAnalysis() {
    const filePath = 'C:\\Users\\USER\\Downloads\\NerdyMatches_daily_2026-08-11.xlsx';
    console.log(`Loading excel file: ${filePath}`);
    
    const wb = xlsx.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet) as any[];

    console.log(`Loaded ${data.length} rows from Excel.`);
    let updateCount = 0;
    
    for (const row of data) {
        if (!row.Date || !row.Teams || !row.Result) continue;
        
        const result = row.Result.trim();
        if (result === '-' || result === '') continue;

        const dateStr = row.Date.trim();
        const teamsStr = row.Teams.trim();
        
        // Reconstruct ID the same way as DB
        const id = teamsStr.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_') + '_' + dateStr.replace(/-/g, '_');

        // First fetch the existing match to get the data JSON payload
        const { data: existingRecords } = await supabase
            .from('live_matches')
            .select('data')
            .eq('id', id);

        if (!existingRecords || existingRecords.length === 0) {
            console.log(`Not found in DB: ${id}`);
            continue;
        }
        
        const existingData = existingRecords[0].data;
        if (existingData) {
            existingData.result = result;
        }

        const { error, data: updated } = await supabase
            .from('live_matches')
            .update({ result, data: existingData, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select();
            
        if (error) {
            console.error(`Error updating ${teamsStr}:`, error.message);
        } else if (updated && updated.length > 0) {
            console.log(`Updated successfully: ${id} to ${result}`);
            console.log(`Supabase returned top-level result: ${updated[0].result}`);
            console.log(`Supabase returned data.result: ${updated[0].data.result}`);
            updateCount++;
        }
    }

    console.log(`Successfully processed and updated matches. ${updateCount} matches checked/updated.`);
}

updateLiveAnalysis().catch(console.error);
