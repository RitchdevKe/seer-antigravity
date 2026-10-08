const axios = require('axios');
async function run() {
  try {
     console.log("Waiting for server...");
     await new Promise(r => setTimeout(r, 2000));
     const res = await axios.post('http://localhost:3000/api/nerdy/fetch', {
       start: "2026-08-27T12:00",
       end: "2026-08-28T08:00"
     });
     console.log("Scraped matches count:", res.data.matches ? res.data.matches.length : 0);
     if (res.data.matches && res.data.matches.length > 0) {
         console.log(res.data.matches[0]);
     }
     if (res.data.error) console.log("Error:", res.data.error);
  } catch (err) {
     if (err.response) {
       console.log("Status:", err.response.status, "Data:", err.response.data);
     } else {
       console.log("Failed:", err.message);
     }
  }
}
run();
