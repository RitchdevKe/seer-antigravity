import { config } from 'dotenv';
config();
import * as fs from 'fs';
import * as path from 'path';
import { supabase } from '../src/lib/supabase';
import { Match } from '../src/types';

async function updateLiveAnalysis() {
    console.log("Fetching live matches...");
    const { data: liveMatches, error: liveError } = await supabase.from('live_matches').select('*');
    if (liveError) throw liveError;
    
    console.log(`Fetched ${liveMatches.length} live matches.`);
    if (liveMatches.length === 0) {
        console.log("No live matches to update.");
        return;
    }

    console.log("Loading all matches from embedded_matches.json...");
    const embeddedPath = path.resolve('public/embedded_matches.json');
    let uploadedMatches = [];
    if (fs.existsSync(embeddedPath)) {
        uploadedMatches = JSON.parse(fs.readFileSync(embeddedPath, 'utf8'));
    } else {
        console.log("No embedded matches found.");
        return;
    }
    
    console.log(`Loaded ${uploadedMatches.length} uploaded matches from embedded JSON.`);

    const uploadedMap = new Map<string, string>();
    uploadedMatches.forEach(um => {
        if (um.data && um.data.result && um.data.result !== '-' && um.data.result !== '') {
            uploadedMap.set(um.id, um.data.result);
        }
    });

    console.log(`Found ${uploadedMap.size} matches with valid results in recent uploads.`);

    let updatedCount = 0;
    const CHUNK_SIZE = 100;
    const matchesToUpdate: any[] = [];

    liveMatches.forEach(lm => {
        const currentResult = lm.data.result || '-';
        if (currentResult === '-' || currentResult === '') {
            if (uploadedMap.has(lm.id)) {
                const newResult = uploadedMap.get(lm.id);
                console.log(`Updating result for ${lm.id}: ${currentResult} -> ${newResult}`);
                lm.data.result = newResult;
                lm.result = newResult;
                matchesToUpdate.push(lm);
                updatedCount++;
            }
        }
    });

    if (updatedCount > 0) {
        console.log(`Updating ${updatedCount} live matches in Supabase...`);
        for (let i = 0; i < matchesToUpdate.length; i += CHUNK_SIZE) {
            const chunk = matchesToUpdate.slice(i, i + CHUNK_SIZE);
            const { error: updateError } = await supabase.from('live_matches').upsert(chunk, { onConflict: 'id' });
            if (updateError) {
                console.error("Error updating live matches chunk:", updateError);
            }
        }
        console.log(`✅ Successfully updated ${updatedCount} live matches with results from yesterday.`);
    } else {
        console.log("No live matches needed updating.");
    }
}

updateLiveAnalysis().catch(console.error);
