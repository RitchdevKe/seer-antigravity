const axios = require('axios');
const cheerio = require('cheerio');

async function run() {
  const url = `https://nerdytips.com/all-matches?d=1`;
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  
  // Find endpoints in the HTML
  const endpoints = res.data.match(/\/api\/[^"'\s]+/g);
  console.log("Endpoints found:", new Set(endpoints));
  
  // Find any javascript that sets total matches
  const totalMatches = res.data.match(/total[A-Za-z]*\s*:\s*\d+/gi);
  console.log("Total references:", totalMatches);
  
}
run();
