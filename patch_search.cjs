const fs = require('fs');
let serverCode = fs.readFileSync('server.ts', 'utf8');

const target = '        updatedMatches.push({\n          ...match,\n          result: foundResult\n        });\n        if (!foundResult || foundResult === match.result) missedNames.push(match.teams);\n      }';

const replacement = `        // Fallback to Search API if not found on the all-matches page
        if (!foundResult || foundResult === match.result) {
            try {
                const teamA = match.teams.split(' vs ')[0].trim();
                const searchRes = await client.get(\`https://nerdytips.com/search/suggest?q=\${encodeURIComponent(teamA)}\`, {
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                
                if (searchRes.data && searchRes.data.matches && searchRes.data.matches.length > 0) {
                    for (const sm of searchRes.data.matches) {
                        const smTeams = \`\${sm.home} vs \${sm.away}\`;
                        if (getMatchSimilarity(match.teams, smTeams) >= 7) {
                            if (sm.finished && sm.score) {
                                foundResult = sm.score.replace(/[–-]/g, ':');
                                console.log(\`Match found via Search API! \${match.teams} -> \${smTeams} | Result: \${foundResult}\`);
                                matchedCount++;
                                break;
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Search API fallback failed for", match.teams, err.message);
            }
        }

        updatedMatches.push({
          ...match,
          result: foundResult
        });
        if (!foundResult || foundResult === match.result) missedNames.push(match.teams);
      }`;

serverCode = serverCode.replace(target, replacement);
fs.writeFileSync('server.ts', serverCode);
console.log('patched');
