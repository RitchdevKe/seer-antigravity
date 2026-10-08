
import { Match } from '../types';

export const isDuplicateMatch = (m1: Match, m2: Match): boolean => {
    // Standardize team names for comparison
    const t1 = m1.teams.toLowerCase().trim().replace(/\s+/g, ' ');
    const t2 = m2.teams.toLowerCase().trim().replace(/\s+/g, ' ');
    
    // Exact ID match is definitely a duplicate
    if (m1.id && m2.id && m1.id === m2.id) return true;
    
    // Team names + specific date match
    const sameTeams = t1 === t2;
    if (!sameTeams) return false;
    
    // Date comparison (handle different formats if possible, but usually YYYY-MM-DD)
    const d1 = m1.date?.split('T')[0]?.split(' ')[0] || '';
    const d2 = m2.date?.split('T')[0]?.split(' ')[0] || '';
    
    const sameDate = d1 === d2 && d1 !== '';
    
    // If date is missing or same, check stats for identity
    const sameStats = m1.mo === m2.mo && m1.gs === m2.gs && m1.ga === m2.ga && m1.l10 === m2.l10 && m1.le === m2.le;
    
    // If same teams and same stats, it's highly likely the same match even if index/date differs slightly
    if (sameTeams && sameStats) return true;
    
    return sameTeams && sameDate;
};

function parseDateTimestamp(dateStr?: string | null): number {
    if (!dateStr) return 0;
    let s = dateStr.trim().split('T')[0].split(' ')[0];
    if (/^\d{2}[-/]\d{2}[-/]\d{4}/.test(s)) {
        const parts = s.split(/[-/]/);
        if (parts.length >= 3) {
            s = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
    }
    const t = new Date(s).getTime();
    return isNaN(t) ? 0 : t;
}

export const deduplicateMatches = (matches: Match[]): Match[] => {
    if (!matches || matches.length === 0) return [];
    
    // First pass: Group by normalized teams + core stats to remove recent-date duplicates
    const statsGroupMap = new Map<string, Match>();
    
    matches.forEach(m => {
        const teams = (m.teams || '').toLowerCase().trim().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ');
        if (!teams) return;
        
        const mo = (m.mo || '').trim();
        const ga = (m.ga || '').trim();
        const gs = (m.gs || '').trim();
        const l10 = (m.l10 || '').trim();
        const le = (m.le || '').trim();
        const statsKey = `${mo}|${ga}|${gs}|${l10}|${le}`;
        
        // Grouping key for identical teams + identical stats
        const groupKey = `${teams}||${statsKey}`;
        const existing = statsGroupMap.get(groupKey);
        
        if (!existing) {
            statsGroupMap.set(groupKey, { ...m });
        } else {
            // Compare dates: keep the older date copy, discard the recent-date duplicate copy
            const tExisting = parseDateTimestamp(existing.date);
            const tNew = parseDateTimestamp(m.date);
            
            let preferred = existing;
            if (tNew > 0 && (tExisting === 0 || tNew < tExisting)) {
                // new match has an older date -> prefer new match, discard existing (which is more recent)
                preferred = { ...m };
            } else if (tExisting > 0 && tNew >= tExisting) {
                // existing match is older -> keep existing, discard new match (which is more recent duplicate)
                preferred = existing;
            }
            
            // Re-merge meta tags
            if (existing.isJackpot || m.isJackpot) preferred.isJackpot = true;
            if (existing.isDaily || m.isDaily) preferred.isDaily = true;
            
            const ids = new Set([...(existing.jackpotIds || []), ...(m.jackpotIds || [])]);
            if (existing.jackpotId) ids.add(existing.jackpotId);
            if (m.jackpotId) ids.add(m.jackpotId);
            if (ids.size > 0) preferred.jackpotIds = Array.from(ids);
            
            statsGroupMap.set(groupKey, preferred);
        }
    });
    
    const deduplicatedByStats = Array.from(statsGroupMap.values());
    
    // Second pass: Group by normalized teams + date
    const uniqueMap = new Map<string, Match>();
    
    deduplicatedByStats.forEach(m => {
        const teams = (m.teams || '').toLowerCase().trim().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ');
        let dateStr = m.date?.split('T')[0]?.split(' ')[0] || 'no-date';
        if (/^\d{2}[-/]\d{2}[-/]\d{4}/.test(dateStr)) {
            const parts = dateStr.split(/[-/]/);
            if (parts.length >= 3) {
                dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }
        
        const key = `${teams}|${dateStr}`;
        const existing = uniqueMap.get(key);
        
        if (!existing) {
            uniqueMap.set(key, { ...m });
        } else {
            const existingHasResult = existing.result && existing.result.trim() !== '' && existing.result.trim().toLowerCase() !== 'pending';
            const newHasResult = m.result && m.result.trim() !== '' && m.result.trim().toLowerCase() !== 'pending';
            
            let preferred = existing;
            if (newHasResult && !existingHasResult) {
                preferred = { 
                    ...existing, 
                    ...m,
                    le: (m.le && m.le !== 'NA' && m.le.trim() !== '') ? m.le : existing.le,
                    l10: (m.l10 && m.l10 !== 'NA' && m.l10.trim() !== '') ? m.l10 : existing.l10,
                    gs: (m.gs && m.gs !== 'NA' && m.gs.trim() !== '') ? m.gs : existing.gs,
                    ga: (m.ga && m.ga !== 'NA' && m.ga.trim() !== '') ? m.ga : existing.ga,
                    mo: (m.mo && m.mo !== '0,0,0' && m.mo.trim() !== '') ? m.mo : existing.mo,
                    rating: (m.rating && m.rating.trim() !== '') ? m.rating : existing.rating,
                    pred1x2: (m.pred1x2 && m.pred1x2.trim() !== '') ? m.pred1x2 : existing.pred1x2,
                    patternAnalysis: existing.patternAnalysis || m.patternAnalysis,
                    seerPrediction: existing.seerPrediction || m.seerPrediction,
                    seerPrimaryPrediction: existing.seerPrimaryPrediction || m.seerPrimaryPrediction,
                };
            } else if (!existingHasResult && !newHasResult) {
               if (!String(existing.id || '').startsWith('import-') && String(m.id || '').startsWith('import-')) preferred = existing;
            } else if (existingHasResult && newHasResult) {
               preferred = {
                   ...existing,
                   ...m,
                   le: (m.le && m.le !== 'NA' && m.le.trim() !== '') ? m.le : existing.le,
                   l10: (m.l10 && m.l10 !== 'NA' && m.l10.trim() !== '') ? m.l10 : existing.l10,
               };
            }
            
            if (existing.isJackpot || m.isJackpot) preferred.isJackpot = true;
            if (existing.isDaily || m.isDaily) preferred.isDaily = true;
            
            const ids = new Set([...(existing.jackpotIds || []), ...(m.jackpotIds || [])]);
            if (existing.jackpotId) ids.add(existing.jackpotId);
            if (m.jackpotId) ids.add(m.jackpotId);
            if (ids.size > 0) preferred.jackpotIds = Array.from(ids);
            
            uniqueMap.set(key, preferred);
        }
    });
    
    return Array.from(uniqueMap.values());
};
