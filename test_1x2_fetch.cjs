const axios = require('axios');
async function run() {
  console.log("Waiting for server to start...");
  await new Promise(r => setTimeout(r, 2000));
  try {
     const res = await axios.post('http://localhost:3000/api/nerdy/fetch', {
       start: "2026-08-27T12:00",
       end: "2026-08-28T08:00"
     }, { timeout: 120000 });
     const arr = Array.isArray(res.data) ? res.data : (res.data.matches || []);
     console.log("Scraped matches count:", arr.length);
     if (arr.length > 0) {
         // Output the first 5 matches to see 1X2 and rating
         for(let i=0; i<5 && i<arr.length; i++){
            const m = arr[i];
            console.log(`[${i}] ${m.teams} | 1X2: ${m.pred1x2} | Rating: ${m.rating}`);
         }
     }
  } catch (err) {
     console.log("Failed:", err.message);
  }
}
run();
