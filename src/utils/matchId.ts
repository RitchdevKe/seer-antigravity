
import { Match } from '../types';

/**
 * Generates a stable, deterministic ID for a match based on its core identity fields.
 * 
 * NEW FORMAT: {YYYY-MM-DD}-{HH:MM}/{YYYYMMDD}_{TeamName}
 * Example: 2026-09-03-15:00/20260903_Sakaryaspor_vs_Hatayspor
 * 
 * This format embeds the match date AND time directly in the ID,
 * enabling reliable day-based filtering (the 9am-9am prediction window).
 * 
 * BACKWARD COMPAT: Matches that already have a non-empty id are left untouched.
 * Only new matches (from Excel import or live scraping) get the new format.
 */
export const getStableMatchId = (match: Match): string => {
  if (!match) return `Unknown_Match_${Date.now()}`;
  if ((match as any)._stableId) return (match as any)._stableId;
  if (!match.teams) {
    if (match.id) return String(match.id);
    return `Unknown_Match_${Date.now()}`;
  }

  // 1. Clean the team names to replace spaces and punctuation with underscores, keeping team casings
  // "Sakaryaspor vs Hatayspor" -> "Sakaryaspor_vs_Hatayspor"
  const name = match.teams
    .trim()
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  // 2. Parse the date string
  let dateStr = (match.date || '').trim();
  if (!dateStr) {
    dateStr = new Date().toISOString().split('T')[0];
  }
  
  // Extract date and time portions
  let datePortion = dateStr;
  let timePortion = (match.time || '').trim();
  
  // Handle ISO strings like "2026-09-03T15:00:00Z"
  if (datePortion.includes('T')) {
    if (!timePortion) {
      timePortion = datePortion.split('T')[1]?.substring(0, 5) || '';
    }
    datePortion = datePortion.split('T')[0];
  }
  
  // Handle "2026-09-03 15:00" format
  if (datePortion.includes(' ')) {
    const parts = datePortion.split(' ');
    datePortion = parts[0];
    if (!timePortion && parts[1]) {
      timePortion = parts[1].substring(0, 5);
    }
  }
  
  // Normalize DD/MM/YYYY or DD-MM-YYYY to YYYY-MM-DD
  if (/^\d{2}[-/]\d{2}[-/]\d{4}/.test(datePortion)) {
    const parts = datePortion.split(/[-/]/);
    if (parts.length >= 3) {
      datePortion = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  
  // Build compact date for the unique code: YYYYMMDD
  const compactDate = datePortion.replace(/[-/.]/g, '');
  
  // Build the new format: {YYYY-MM-DD}-{HH:MM}/{YYYYMMDD}_{TeamName}
  const dateTimePrefix = timePortion ? `${datePortion}-${timePortion}` : datePortion;
  const sid = `${dateTimePrefix}/${compactDate}_${name}`;
  
  (match as any)._stableId = sid;
  return sid;
};
