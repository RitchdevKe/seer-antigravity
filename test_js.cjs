const axios = require('axios');
const fs = require('fs');

async function run() {
  const url = `https://nerdytips.com/build/assets/app-IEuaQJVI.js`;
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  
  // Search for API endpoints in the JS
  const urls = res.data.match(/["']\/[a-z0-9\-_\/]+["']/gi);
  if (urls) {
      console.log("Endpoints found in JS:", new Set(urls.filter(u => !u.includes('.css') && !u.includes('.svg') && !u.includes('.png'))));
  }
}
run();
