const fs = require('fs');

const plan = `# Goal Description
Fix match extraction failure caused by NerdyTips' new match-details page layout. The UI rewrite changed how \`Wins\`, \`Goals Scored\`, and \`Goals Against\` stats are structured, preventing the scraper from extracting these mandatory fields and causing all scraped matches to be erroneously excluded.

## Proposed Changes
### server.ts
- Update \`scrapeNerdyMatchDetails\` leaf node inspection logic to look for the new DOM structure (a grandparent container with \`.md-ps__v--h\` and \`.md-ps__v--a\` classes).
- Use Cheerio's \`.clone()\` to safely remove screen reader text (\`.sr-only\`) from the values before extracting them.
- Preserve the existing fallback logic to ensure backward compatibility in case the old layout is encountered.

## Verification Plan
- Run a manual extract in the UI or restart the backend to ensure matches for the upcoming day are successfully populated with \`GA\`, \`GS\`, and \`L10\` metrics.
`;
fs.writeFileSync('C:/Users/USER/.gemini/antigravity/brain/62622108-f8b0-4990-938d-f0d5003653f7/implementation_plan.md', plan);
console.log("Plan created");
