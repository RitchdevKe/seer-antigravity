
const fs = require("fs");
let code = fs.readFileSync("src/utils/optimizedweights.ts", "utf8");

code = code.replace(/{ description: "Seer score on draw <= 20%", points: 5 }/g, "{ description: \"Seer score on draw <= 20%\", points: 10 }");
code = code.replace(/{ description: "Algo final prediction is 1X\/X2", points: 0 }/g, "{ description: \"Algo final prediction is 1X/X2\", points: 5 }");
code = code.replace(/{ description: "Odds for underdog < 3.0", points: -5 }/g, "{ description: \"Odds for underdog < 3.0\", points: -10 }");
code = code.replace(/{ description: "Underdog GS < 1.0 And M.fav GS > 1.8", points: 10 }/g, "{ description: \"Underdog GS < 1.0 but M.fav GS > 1.0\", points: 5 }");
code = code.replace(/{ description: "M.fav GA is > 0.6 points lower than Underdog GA", points: 10 },/g, "{ description: \"M.fav GA is > 0.6 points lower than Underdog GA\", points: 10 },\n            { description: \"Mfav GA <= 1.0 but Underdog GA > 1.0\", points: 5 },");

fs.writeFileSync("src/utils/optimizedweights.ts", code);
console.log("Static rules updated");

