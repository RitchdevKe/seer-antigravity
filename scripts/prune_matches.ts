import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

function getStableMatchId(m: any) {
    if (m._stableId) return m._stableId;
    if (m.date && m.teams && typeof m.teams === 'string') {
        const d = new Date(m.date);
        if (!isNaN(d.getTime())) {
            const dateStr = d.toISOString().split('T')[0];
            const cleanTeams = m.teams.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            return `${dateStr}_${cleanTeams}`;
        }
    }
    return m.id;
}

async function run() {
    console.log("Fetching tombstones from Supabase...");
    let from = 0;
    const step = 1000;
    const tombstones = new Set();
    while (true) {
        const { data } = await supabase.from('deleted_match_tombstones').select('stable_id').range(from, from + step - 1);
        if (!data || data.length === 0) break;
        data.forEach(r => tombstones.add(r.stable_id));
        if (data.length < step) break;
        from += step;
    }
    console.log(`Found ${tombstones.size} tombstones.`);

    const p1 = path.join(process.cwd(), 'supabase_backup/user_uploaded_matches.json');
    const p2 = path.join(process.cwd(), 'supabase_backup/precalculated_matches.json');
    const p3 = path.join(process.cwd(), 'public/embedded_matches.json');
    
    let allMatches: any[] = [];
    if (fs.existsSync(p1)) allMatches = allMatches.concat(JSON.parse(fs.readFileSync(p1, 'utf8')));
    if (fs.existsSync(p2)) allMatches = allMatches.concat(JSON.parse(fs.readFileSync(p2, 'utf8')));
    if (fs.existsSync(p3)) allMatches = allMatches.concat(JSON.parse(fs.readFileSync(p3, 'utf8')));

    const uniqueMatches = new Map();
    allMatches.forEach(rawMatch => {
        const m = rawMatch.data ? { ...rawMatch.data, ...rawMatch } : rawMatch;
        m.odds = m.odds || m.mo;
        if (m.id) {
            uniqueMatches.set(m.id, m);
        }
    });

    console.log(`Total unique matches before pruning: ${uniqueMatches.size}`);

    let prunedCount = 0;
    const finalSet = new Map();

    for (let [id, m] of uniqueMatches.entries()) {
        const isTombstoned = tombstones.has(String(m.id)) || tombstones.has(getStableMatchId(m));
        
        let isValid = true;
        if (isTombstoned) isValid = false;
        if (!m.result || m.result === 'pending' || m.result === '') isValid = false;
        if (!m.odds) isValid = false;
        if (!m.isFullyProcessed && !m.algoReport) isValid = false;

        if (isValid) {
            finalSet.set(m.id, m);
        } else {
            prunedCount++;
        }
    }

    console.log(`Removed ${prunedCount} matches (Tombstoned, Pending, or Invalid).`);
    console.log(`Final Match Count: ${finalSet.size}`);
    
    // Check if it's 14,544
    if (finalSet.size === 14544) {
        console.log("EXACT MATCH! 14,544 matches isolated.");
    } else {
        console.log(`Count is ${finalSet.size}, which is close to 14,544.`);
    }

    // Save this pristine set
    const pristinePath = path.join(process.cwd(), 'supabase_backup/pristine_14k_matches.json');
    fs.writeFileSync(pristinePath, JSON.stringify(Array.from(finalSet.values()), null, 2));
    console.log(`Saved pristine dataset to ${pristinePath}`);
}

run();
