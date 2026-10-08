const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const cheerio = require('cheerio');
const fs = require('fs');

async function run() {
  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar, withCredentials: true, maxRedirects: 5 }));
  
  const email = "jose.mfavour@gmail.com";
  const password = "Lovi@2025";
  
  const lp = await client.get("https://nerdytips.com/login", { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $l = cheerio.load(lp.data);
  const csrf = $l('input[name="_csrf"]').first().val();
  
  const payload = {
      _csrf: csrf,
      username: email,
      password: password,
      remember: 1
  };
  
  console.log("Login Payload:", payload);
  
  const loginRes = await client.post("https://nerdytips.com/login", new URLSearchParams(payload).toString(), {
      headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0'
      }
  });
  
  const isLogged = loginRes.data.includes("/logout") || loginRes.data.includes("Logout") || loginRes.data.includes("account");
  console.log("Logged in:", isLogged);
  
  const mRes = await client.get("https://nerdytips.com/all-matches?d=0", { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $m = cheerio.load(mRes.data);
  const cards = $m('.tb-match, .am-drow, .am-mrow');
  console.log("Cards on d=0 after login:", cards.length);
  const locked = $m('.is-locked');
  console.log("Locked cells after login:", locked.length);
}
run();
