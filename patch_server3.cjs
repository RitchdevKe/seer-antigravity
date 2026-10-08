const fs = require('fs');
let serverCode = fs.readFileSync('server.ts', 'utf8');

const target = `            const matchesPage = await client.post('https://nerdytips.com/all-matches/get-matches', new URLSearchParams({
              date: nerdyDateStr,
              type: 'all',
              page: page.toString(),
              country: '',
              all_remaining: '0' // Use 0 to ensure consistent pagination
            }).toString(), {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
              }
            });`;

const replacement = `            const matchesPage = await client.get(\`https://nerdytips.com/all-matches?d=\${nerdyDateStr}\`, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
              }
            });
            hasMore = false;`;

const normalizedTarget = target.replace(/\r\n/g, '\n');
const normalizedServer = serverCode.replace(/\r\n/g, '\n');

if (normalizedServer.includes(normalizedTarget)) {
    serverCode = normalizedServer.replace(normalizedTarget, replacement);
    fs.writeFileSync('server.ts', serverCode);
    console.log("Success! Replaced POST for results extraction.");
} else {
    console.log("Could not find the target code in server.ts");
}
