const fs = require('fs');
let file = fs.readFileSync('src/utils/matchProcessing.ts', 'utf8');

const target1 = `* Evaluates the logical date of a match based on the 09:00 to 08:59 cycle.`;
const target2 = `* A day starts at 09:00 and ends at 08:59 the next day.`;
const target3 = `* Matches starting before 09:00 belong to the previous logical day.`;
const target4 = `if (timeStr < "09:00") {`;
const target5 = `// If the time is before 09:00, the match conceptually belongs to the previous day`;

file = file.replace(target1, `* Evaluates the logical date of a match based on the 12:00 to 11:59 cycle.`);
file = file.replace(target2, `* A day starts at 12:00 and ends at 11:59 the next day.`);
file = file.replace(target3, `* Matches starting before 12:00 belong to the previous logical day.`);
file = file.replace(target4, `if (timeStr < "12:00") {`);
file = file.replace(target5, `// If the time is before 12:00, the match conceptually belongs to the previous day`);

fs.writeFileSync('src/utils/matchProcessing.ts', file);
console.log("Updated matchProcessing.ts");
