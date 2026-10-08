const axios = require('axios');
async function run() {
  console.log("Waiting for server to start...");
  await new Promise(r => setTimeout(r, 2000));
  try {
     const res = await axios.post('http://localhost:3000/api/nerdy/fetch', {
       start: "2026-08-27T12:00",
       end: "2026-08-28T08:00"
     }, { timeout: 300000 });
     const arr = Array.isArray(res.data) ? res.data : (res.data.matches || []);
     console.log("Scraped matches count:", arr.length);
  } catch (err) {
     console.log("Failed:", err.message);
  }
}
run();
