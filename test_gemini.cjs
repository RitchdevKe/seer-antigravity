const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');
dotenv.config();

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: 'hi'
  });
  console.log(response.text);
}
main().catch(console.error);
