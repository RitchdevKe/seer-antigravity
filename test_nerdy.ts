import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

async function run() {
  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar }));
  // 1. Initial login
  const loginUrl = 'https://nerdytips.com/login';
  const loginPage = await client.get(loginUrl);
  const $login = cheerio.load(loginPage.data);
  const csrfToken = $login('input[name="_token"]').val();
  const loginPayload: any = {
    email: process.env.NERDY_TIPS_EMAIL,
    password: process.env.NERDY_TIPS_PASSWORD,
    login: 'Login Now',
    inlineCheckboxLogin: 'yes'
  };
  if (csrfToken) loginPayload['_token'] = csrfToken;
  const loginResponse = await client.post(loginUrl, new URLSearchParams(loginPayload).toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0'
    }
  });
  console.log('Login OK');
  
  const matchesPage = await client.post('https://nerdytips.com/all-matches/get-matches', new URLSearchParams({
    date: '25-08-2026',
    type: 'all',
    page: '1',
    country: '',
    all_remaining: '0'
  }).toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': 'Mozilla/5.0'
    }
  });
  fs.writeFileSync('nerdy_response.html', matchesPage.data);
  console.log('Done');
}
run().catch(console.error);
