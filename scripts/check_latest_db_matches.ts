import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!url || !key) {
  console.error("Missing supabase credentials");
  process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase
    .from('live_matches')
    .select('*')
    .order('id', { ascending: false })
    .limit(30);

  if (error) {
    console.error("Error querying live_matches:", error);
    return;
  }

  console.log(`Fetched ${data?.length} latest matches from live_matches.`);
  if (data && data.length > 0) {
    console.log("Latest 5 matches:");
    data.slice(0, 5).forEach(m => {
      console.log(`ID: ${m.id}, Date: ${m.date}, Teams: ${m.teams || (m.home_team + ' vs ' + m.away_team)}, Result: ${m.result}, Status: ${m.status}`);
    });

    // Count distinct dates
    const dates: Record<string, number> = {};
    data.forEach(m => {
      const d = (m.date || 'Unknown').substring(0, 10);
      dates[d] = (dates[d] || 0) + 1;
    });
    console.log("Date distribution in last 30:", dates);
  }
}

check();
