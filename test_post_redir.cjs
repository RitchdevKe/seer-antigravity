const axios = require('axios');
async function run() {
  try {
    const res = await axios.post('https://nerdytips.com/all-matches/get-matches', new URLSearchParams({
        date: '-1',
        type: 'all',
        page: '1',
        country: '',
        all_remaining: '0'
    }).toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest'
        },
        maxRedirects: 0
    });
    console.log("Status:", res.status);
    console.log("Data length:", res.data.length);
  } catch (err) { 
    if (err.response) {
       console.error("Status:", err.response.status, "Location:", err.response.headers.location);
    } else {
       console.error("Failed:", err.message);
    }
  }
}
run();
