const axios = require('axios');
async function run() {
  try {
     const res = await axios.post('http://localhost:3000/api/nerdy/fetch', {
       start: "2026-08-26T12:00",
       end: "2026-08-27T08:00"
     }, { timeout: 300000 });
     const matches = res.data.matches;
     console.log(`Extracted ${matches.length} matches.`);
     
     let missingOdds = 0;
     for (const m of matches) {
         if (!m.marketOdds) {
             missingOdds++;
             console.log(`Missing odds for: ${m.teamA} vs ${m.teamB}`);
         } else {
             // Check if it's "Unknown" or similar
             const hasValue = Object.values(m.marketOdds).some(v => v !== 'Unknown');
             if (!hasValue) {
                 missingOdds++;
                 console.log(`Missing odds (Unknown) for: ${m.teamA} vs ${m.teamB}`);
             }
         }
     }
     console.log(`Total missing odds: ${missingOdds}`);
  } catch (e) {
     console.log(e.message);
  }
}
run();
