const axios = require('axios');
const cheerio = require('cheerio');

async function testNerdyDetails() {
    try {
        const urlToFetch = "https://nerdytips.com/predictions/defensa-y-justicia-vs-platense-2026-08-29"; // Just a guess at the URL format, let's fetch any valid one from the all-matches page first.
        
        const dateStr = new Date().toISOString().split('T')[0];
        const res = await axios.get(`https://nerdytips.com/all-matches?d=${dateStr}`);
        const $ = cheerio.load(res.data);
        const firstMatchUrl = $('a[href*="/match/"], a[href*="/match-details/"]').first().attr('href');
        console.log("Found match URL:", firstMatchUrl);
        
        if (!firstMatchUrl) return;
        
        const detailsPage = await axios.get(`https://nerdytips.com${firstMatchUrl}`);
        const $details = cheerio.load(detailsPage.data);
        
        let currentGs = "Unknown";
        let currentGa = "Unknown";
        let currentL10 = "Unknown";
        let currentLe = "Unknown";
        
        $details('*').each((_, el) => {
          if ($details(el).children().length > 0) return; // Only leaf nodes
          const text = $details(el).text().trim().toLowerCase();
  
          // Last 10 matches regex
          const l10Match = text.match(/([a-z\s]+) form:\s*(?:they have|it has)?\s*(\d+)\s+wins,\s*(\d+)\s+draws\s*and\s*(\d+)\s+losses/i);
          if (l10Match) {
            const wins = parseInt(l10Match[2], 10);
            const draws = parseInt(l10Match[3], 10);
            const losses = parseInt(l10Match[4], 10);
            
            if (!isNaN(wins) && !isNaN(draws) && !isNaN(losses)) {
                // Approximate l10 logic
                if (wins > draws && wins > losses) currentL10 = "10";
                else if (draws > wins && draws > losses) currentL10 = "5";
                else if (losses > wins && losses > draws) currentL10 = "1";
                else currentL10 = "5";
            }
          }
  
          // Goals scored
          const gsMatch = text.match(/scored\s+(\d+)\s+goals/i);
          if (gsMatch && currentGs === "Unknown") {
             const g = parseInt(gsMatch[1], 10);
             if (!isNaN(g)) {
                 if (g >= 15) currentGs = "O2.5";
                 else if (g >= 10) currentGs = "O1.5";
                 else currentGs = "U1.5";
             }
          }
  
          // Goals against
          const gaMatch = text.match(/conceded\s+(\d+)\s+goals/i) || text.match(/received\s+(\d+)\s+goals/i);
          if (gaMatch && currentGa === "Unknown") {
              const g = parseInt(gaMatch[1], 10);
              if (!isNaN(g)) {
                 if (g >= 15) currentGa = "O2.5";
                 else if (g >= 10) currentGa = "O1.5";
                 else currentGa = "U1.5";
              }
          }
  
          // League position
          const leMatch = text.match(/(?:they are|it is)\s+on\s+the\s+(\d+)(?:st|nd|rd|th)\s+position/i);
          if (leMatch && currentLe === "Unknown") {
             const pos = parseInt(leMatch[1], 10);
             if (!isNaN(pos)) {
                 if (pos <= 4) currentLe = "Top";
                 else if (pos <= 10) currentLe = "Mid";
                 else currentLe = "Bot";
             }
          }
        });
        
        console.log({ currentGs, currentGa, currentL10, currentLe });
        
    } catch(e) {
        console.error(e.message);
    }
}
testNerdyDetails();
