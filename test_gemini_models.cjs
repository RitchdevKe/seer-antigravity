const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');
dotenv.config();

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  console.log("Listing models...");
  // Try to find the list models method
  console.log(Object.keys(ai.models));
  // The correct method according to @google/genai might be list or similar, let's just use REST API
  const axios = require('axios');
  const res = await axios.get('https://generativelanguage.googleapis.com/v1beta/models?key=' + process.env.GEMINI_API_KEY);
  console.log(res.data.models.map(m => m.name));
}
main().catch(console.error);
