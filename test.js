const fs = require("fs");
const data = JSON.parse(fs.readFileSync("public/ml_model.json", "utf-8"));
console.log("Combos keys count:", Object.keys(data.combos).length);
const sample = Object.keys(data.combos).slice(0, 5);
console.log("Sample combos:", sample);
