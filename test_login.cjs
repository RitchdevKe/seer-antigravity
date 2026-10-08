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
  
  let csrfToken = null;
  try {
     const lp = await client.get("https://nerdytips.com/login");
     const $l = cheerio.load(lp.data);
     csrfToken = $l('input[name="_token"]').val();
     console.log("CSRF Token:", csrfToken);
  } catch(e) {}
  
  const loginPayload = {
      email, password, login: "Login Now", inlineCheckboxLogin: "yes"
  };
  if (csrfToken) loginPayload['_token'] = csrfToken;
  
  const loginRes = await client.post("https://nerdytips.com/login", new URLSearchParams(loginPayload).toString(), {
      headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0'
      }
  });
  
  const isLogged = loginRes.data.includes("Logout") || loginRes.data.includes("account");
  console.log("Is Logged in?", isLogged);
  if (loginRes.data.includes("Invalid")) {
      console.log("Invalid credentials!");
  }

  // now fetch matches
  const mRes = await client.get("https://nerdytips.com/all-matches?d=0", { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $m = cheerio.load(mRes.data);
  const cards = $m('.tb-match, .am-mrow, .am-drow');
  console.log("Cards on d=0 after login:", cards.length);
  
  const locked = $m('.is-locked');
  console.log("Locked cells:", locked.length);
}
run();
