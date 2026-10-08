import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import LZString from 'lz-string';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function inspectDates() {
    const filePath = path.join(__dirname, '..', 'db_export', 'user_uploaded_matches.json');
    const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    let matches: any[] = rawData.compressedMatches 
        ? JSON.parse(LZString.decompressFromUTF16(rawData.compressedMatches))
        : (Array.isArray(rawData.matches) ? rawData.matches.map((r: any) => r.data || r) : rawData);

    const dates = new Map<string, number>();

    matches.forEach(m => {
        let d = m.date_played || m.date || 'unknown';
        if (d !== 'unknown') {
            d = d.split('T')[0];
        }
        dates.set(d, (dates.get(d) || 0) + 1);
    });

    const sortedDates = Array.from(dates.entries()).sort((a, b) => b[1] - a[1]);
    console.log("Top dates by match count:");
    sortedDates.slice(0, 10).forEach(([date, count]) => {
        console.log(`${date}: ${count} matches`);
    });
}

inspectDates().catch(console.error);
