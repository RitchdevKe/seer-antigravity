
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import fs from "fs";

const VITE_SUPABASE_URL = "https://seer.myshule.ke";
const VITE_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg4MDM1Njg5LCJleHAiOjIxMDM2MTE2ODl9.HwQ49UlqAjR5wdRmI1wkEtbtmOKR92sczbXlmjhmZ00";

const raw = fs.readFileSync("matches_import/matches_backup.json", "utf8");
const matches = JSON.parse(raw);
console.log(`Loaded ${matches.length} matches. Preparing upload...`);

function getStableMatchId(match) {
    if (match.id && typeof match.id === "string" && match.id.includes("_vs_")) {
        return match.id.replace(/\s+/g, "_");
    }
    const cleanTeams = (match.teams || "").replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
    const cleanDate = (match.date || "").replace(/[^0-9\s-:]/g, "").trim().replace(/\s+/g, "_").replace(/:/g, "_").replace(/-/g, "_");
    return `${cleanTeams}_${cleanDate}`;
}

async function upload() {
    const records = matches.map(m => ({
        id: getStableMatchId(m),
        teams: m.teams || "",
        result: m.result || "",
        date: m.date || "",
        data: m
    }));

    const chunkSize = 200;
    for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize);
        let retries = 3;
        while (retries > 0) {
            try {
                const res = await fetch(`${VITE_SUPABASE_URL}/rest/v1/precalculated_matches?on_conflict=id`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${VITE_SUPABASE_ANON_KEY}`,
                        "apikey": VITE_SUPABASE_ANON_KEY,
                        "Prefer": "resolution=merge-duplicates,return=minimal"
                    },
                    body: JSON.stringify(chunk)
                });
                
                if (!res.ok) {
                    const txt = await res.text();
                    throw new Error(txt);
                }
                console.log(`Uploaded chunk ${i} to ${i + chunk.length}`);
                break; // success
            } catch (err) {
                console.error(`Chunk ${i} failed (retries left: ${retries - 1}):`, err.message);
                retries--;
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }
    console.log("Upload complete!");
}

upload();

