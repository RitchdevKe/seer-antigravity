<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/5ac502cc-e044-4ff9-a902-441d1c1790b5

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

---

## Global Definitions

**Market Favorite**
- The Market Favorite is defined as the team with the LOWER market odds.
- It can be either team `1` (Home) or team `2` (Away).
- `Draw` (X) is NEVER considered the Market Favorite, regardless of the odds.
- All SEER code, logic, and agents must adhere strictly to this definition.
