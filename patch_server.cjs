const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');

const targetStr = `
          if (text === 'wins' || text === 'goals scored' || text === 'goals against' ||
              text.includes('wins') || text.includes('goals scored') || text.includes('goals against') || text.includes('goals conceded')) {
            const parent = $details(el).parent();
            
            let homeVal = parent.find('[class*="homeValue"], [class*="home"]').first().text().trim();
            let awayVal = parent.find('[class*="awayValue"], [class*="away"]').first().text().trim();
            
            if (!homeVal) homeVal = parent.children().first().text().trim();
            if (!awayVal) awayVal = parent.children().last().text().trim();
`;

const replacementStr = `
          if (text === 'wins' || text === 'goals scored' || text === 'goals against' ||
              text.includes('wins') || text.includes('goals scored') || text.includes('goals against') || text.includes('goals conceded')) {
            const parent = $details(el).parent();
            const grandparent = parent.parent();
            
            let homeNode = grandparent.find('.md-ps__v--h').clone();
            let awayNode = grandparent.find('.md-ps__v--a').clone();
            
            homeNode.find('.sr-only').remove();
            awayNode.find('.sr-only').remove();
            
            let homeVal = homeNode.text().trim();
            let awayVal = awayNode.text().trim();
            
            if (!homeVal || !awayVal) {
              homeVal = parent.find('[class*="homeValue"], [class*="home"]').first().text().trim();
              awayVal = parent.find('[class*="awayValue"], [class*="away"]').first().text().trim();
              
              if (!homeVal) homeVal = parent.children().first().text().trim();
              if (!awayVal) awayVal = parent.children().last().text().trim();
            }
`;

if (file.includes(targetStr.trim())) {
    file = file.replace(targetStr.trim(), replacementStr.trim());
    fs.writeFileSync('server.ts', file);
    console.log("Successfully patched server.ts");
} else {
    console.log("Target string not found, patch failed");
}
