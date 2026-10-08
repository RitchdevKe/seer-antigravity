import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getStableMatchId } from './src/utils/matchId';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function migrateLiveMatches() {
  console.log("Fetching current live_matches...");
  const { data, error } = await supabase.from('live_matches').select('*');
  
  if (error) {
    console.error("Error fetching live matches:", error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log("No live matches to migrate.");
    return;
  }
  
  console.log(`Found ${data.length} live matches. Migrating IDs...`);
  
  const toInsert = [];
  const toDelete = [];
  
  for (const row of data) {
    // Check if it already has the new format
    if (row.id.includes('/')) {
      console.log(`Match ${row.id} already has new format. Skipping.`);
      continue;
    }
    
    // Parse the match object to compute the new ID
    const matchObj = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    
    // Compute the new stable ID
    // We clear any existing _stableId to force re-computation
    delete matchObj._stableId;
    matchObj.id = undefined; // temp clear to compute from teams/date
    const newId = getStableMatchId(matchObj);
    
    matchObj.id = newId;
    
    toInsert.push({
      id: newId,
      teams: row.teams,
      result: row.result,
      date: row.date,
      data: matchObj
    });
    
    toDelete.push(row.id);
  }
  
  if (toInsert.length === 0) {
    console.log("All live matches are already in the new format.");
    return;
  }
  
  console.log(`Migrating ${toInsert.length} matches...`);
  
  // Insert new matches
  const { error: insertError } = await supabase.from('live_matches').upsert(toInsert);
  if (insertError) {
    console.error("Error inserting new match IDs:", insertError);
    return;
  }
  
  // Delete old matches
  console.log("New matches inserted. Deleting old records...");
  
  // Batch delete to avoid limits
  const BATCH_SIZE = 50;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = toDelete.slice(i, i + BATCH_SIZE);
    const { error: deleteError } = await supabase.from('live_matches').delete().in('id', batch);
    
    if (deleteError) {
      console.error(`Error deleting batch ${i}:`, deleteError);
    }
  }
  
  console.log("Migration complete!");
}

migrateLiveMatches();
