import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fetchAllMatches() {
    let allMatches: any[] = [];
    const pageSize = 1000;
    
    console.log("Fetching tombstones from deleted_match_tombstones using cursor pagination...");
    const tombstoneSet = new Set<string>();
    let hasMoreTombstones = true;
    let lastTombstoneId = '';
    
    while (hasMoreTombstones) {
        const { data, error } = await supabase
            .from('deleted_match_tombstones')
            .select('stable_id')
            .gt('stable_id', lastTombstoneId)
            .order('stable_id', { ascending: true })
            .limit(pageSize);
            
        if (error) {
            console.error('Error fetching tombstones:', error);
            break;
        }
        
        if (data && data.length > 0) {
            data.forEach((row: any) => tombstoneSet.add(row.stable_id));
            lastTombstoneId = data[data.length - 1].stable_id;
            
            if (data.length < pageSize) {
                hasMoreTombstones = false;
            }
        } else {
            hasMoreTombstones = false;
        }
    }
    
    console.log(`Fetched ${tombstoneSet.size} tombstones.`);

    let hasMore = true;
    let lastId = ''; // String ID cursor

    console.log("Starting to fetch all matches from user_uploaded_matches using cursor pagination...");

    let totalFetched = 0;
    while (hasMore) {
        console.log(`Fetching next ${pageSize} matches after ID ${lastId}...`);
        const { data, error } = await supabase
            .from('user_uploaded_matches')
            .select('*')
            .gt('id', lastId)
            .order('id', { ascending: true })
            .limit(pageSize);

        if (error) {
            console.error('Error fetching matches:', error);
            break;
        }

        if (data && data.length > 0) {
            totalFetched += data.length;
            lastId = data[data.length - 1].id;
            
            const filteredData = data.filter(match => !tombstoneSet.has(match.id));
            allMatches = allMatches.concat(filteredData);
            
            if (data.length < pageSize) {
                hasMore = false;
            }
        } else {
            hasMore = false;
        }
    }

    console.log(`Total raw matches fetched: ${totalFetched}`);
    console.log(`Total matches after tombstone filtering: ${allMatches.length}`);
    
    const outPath = path.resolve(process.cwd(), 'public', 'embedded_matches.json');
    fs.writeFileSync(outPath, JSON.stringify(allMatches, null, 2));
    console.log(`Saved ${allMatches.length} matches to ${outPath}`);
}

fetchAllMatches();
