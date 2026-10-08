import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { Match } from '../types';
import { parseExcelMatches } from './excelParser';
import { getStableMatchId } from './matchId';

/**
 * Creates a .zip archive containing all matches exported in standard NerdyTips format:
 * - nerdytips_matches.xlsx (Spreadsheet with exact NerdyTips headers & indices)
 * - nerdytips_matches.csv (CSV format)
 * - matches_backup.json (High-fidelity JSON backup)
 */
export const createMatchesZipBlob = async (matches: Match[]): Promise<Blob> => {
  const zip = new JSZip();

  // Standard NerdyTips header & index structure
  const header = [
    "ID",
    "Teams",
    "Result",
    "1X2 Tip",
    "1X2 Rating",
    "GS (A:B)",
    "GA (A:B)",
    "L10/Form",
    "LE/H2H",
    "Market Odds",
    "Date/Time"
  ];

  const rows = matches.map((m, idx) => [
    m.id || idx + 1,
    m.teams || '',
    m.result || 'pending',
    m.pred1x2 || '',
    m.rating || '',
    m.gs || '',
    m.ga || '',
    m.l10 || '',
    m.le || '',
    m.mo || '',
    m.date || ''
  ]);

  // 1. Build XLSX File
  const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "NerdyTips Matches");
  const xlsxArrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  zip.file("nerdytips_matches.xlsx", xlsxArrayBuffer);

  // 2. Build CSV File
  const csvContent = XLSX.utils.sheet_to_csv(worksheet);
  zip.file("nerdytips_matches.csv", csvContent);

  // 3. Build JSON File
  zip.file("matches_backup.json", JSON.stringify(matches, null, 2));

  // Generate zip blob
  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
};

/**
 * Extracts and parses matches from an uploaded ZIP file.
 * Handles .xlsx, .xls, .csv, and .json files stored inside the zip archive.
 */
export const extractMatchesFromZip = async (zipArrayBuffer: ArrayBuffer): Promise<Match[]> => {
  const zip = await JSZip.loadAsync(zipArrayBuffer);
  const allExtractedMatches: Match[] = [];

  const fileEntries = Object.keys(zip.files);

  for (const fileName of fileEntries) {
    const fileEntry = zip.files[fileName];
    if (fileEntry.dir) continue;

    const lowerName = fileName.toLowerCase();

    try {
      if (lowerName.endsWith('.json')) {
        const text = await fileEntry.async('text');
        const parsed = JSON.parse(text);
        const matchesArray = Array.isArray(parsed) ? parsed : (parsed.matches || []);
        if (Array.isArray(matchesArray)) {
          matchesArray.forEach((m: any) => {
            if (m && typeof m === 'object' && m.teams) {
              const id = m.id || getStableMatchId(m);
              allExtractedMatches.push({
                ...m,
                id,
                isPrecalculated: true
              } as Match);
            }
          });
        }
      } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) {
        const buffer = await fileEntry.async('arraybuffer');
        const parsed = parseExcelMatches(buffer);
        if (Array.isArray(parsed)) {
          allExtractedMatches.push(...parsed);
        }
      }
    } catch (err) {
      console.warn(`Failed to parse file ${fileName} inside ZIP archive:`, err);
    }
  }

  // Deduplicate extracted matches by stable match ID
  const uniqueMap = new Map<string, Match>();
  allExtractedMatches.forEach(m => {
    const stableId = getStableMatchId(m);
    if (!uniqueMap.has(stableId)) {
      uniqueMap.set(stableId, { ...m, id: stableId });
    }
  });

  return Array.from(uniqueMap.values());
};
