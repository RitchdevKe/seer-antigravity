const axios = require('axios');
async function run() {
  console.log("Waiting for server to start...");
  await new Promise(r => setTimeout(r, 3000));
  try {
     const res = await axios.post('http://localhost:3000/api/nerdy/fetch', {
       start: "2026-08-27T12:00",
       end: "2026-08-28T08:00"
     }, { timeout: 120000 });
     console.log("Scraped matches count:", res.data.matches ? res.data.matches.length : 0);
     if (res.data.matches && res.data.matches.length > 0) {
         const m = res.data.matches[0];
         console.log("First match:", m.teams, "| GS:", m.gs, "| GA:", m.ga, "| L10:", m.l10, "| MO:", m.mo, "| Trust:", m.stars);
     }
     if (res.data.error) console.log("Error:", res.data.error);
  } catch (err) {
     if (err.response) {
       console.log("Status:", err.response.status, "Data:", JSON.stringify(err.response.data).substring(0, 500));
     } else {
       console.log("Failed:", err.message);
     }
  }
}
run();
