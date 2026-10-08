const axios = require('axios');
async function run() {
  try {
     const res = await axios.post('http://localhost:3000/api/nerdy/fetch', {
       start: "2026-08-26T12:00",
       end: "2026-08-27T08:00"
     });
     console.log("Scraped matches count:", res.data.matches ? res.data.matches.length : 0);
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
