const axios = require('axios');
async function run() {
  try {
     const res = await axios.get('https://nerdytips.com/search/suggest?q=Cucuta', { headers: { 'User-Agent': 'Mozilla/5.0' } });
     console.log("Cucuta:", res.data);
  } catch (err) {
     console.log("Error:", err.message);
  }
}
run();
