import { useState, useEffect } from 'react';
import { AIResponse } from '../components/ai/GeminiEngine';
import { getActualResult } from './matchProcessing';

import * as Storage from '../services/storage';
import { debouncedSyncToSupabase } from '../services/supabaseStorage';

const STARS_KEY = 'prm_match_stars';

const calculateStars = (accuracyInput: number | string): number => {
    const accuracy = typeof accuracyInput === 'string' ? parseInt(accuracyInput) : accuracyInput;
    if (isNaN(accuracy) || accuracy <= 0) return 0;
    if (accuracy < 50) return 1;
    if (accuracy < 65) return 2;
    if (accuracy < 75) return 3;
    if (accuracy < 85) return 4;
    return 5;
};

const extractFromResults = (results: any, calculateStars: (acc: number | string) => number) => {
    const newStars: Record<string, number> = {};
    if (!results) return newStars;

    for (const category in results) {
        const catData = results[category];
        const priorities = catData?.priorities || catData?.byPriorityGroup;
        if (!priorities) continue;

        let catAbbr = category;
        if (category === 'top10') catAbbr = 'T12';
        else if (category === 'top20') catAbbr = 'T20';
        else if (category === 'bankers' || category === 'bankers_jackpot') catAbbr = 'BNK';
        else if (category === 'bankers_dlive') catAbbr = 'BDL';
        else if (category === 'value_bets') catAbbr = 'VB';
        else if (category === 'value_picks') catAbbr = 'VP';
        else if (category === 'banker_draws') catAbbr = 'BD';
        else if (category === 'upsets') catAbbr = 'UPS';

        for (const pr in priorities) {
            const prData = priorities[pr];
            const groups = prData.groups || prData; // tactical_audits has .groups, byPriorityGroup is the groups map
            
            for (const group in groups) {
                const groupData = groups[group];
                if (groupData && groupData.accuracy !== undefined) {
                    const stars = calculateStars(groupData.accuracy);
                    const key = `${catAbbr}-${pr}-G${group}`;
                    newStars[key] = stars;
                }
            }
        }
    }
    return newStars;
};

export const extractMatchStars = (response: AIResponse): Record<string, number> => {
    const archives = Storage.getPerformanceArchives();
    const latestArchive = archives.length > 0 ? archives[0] : null;
    
    if (!latestArchive || !latestArchive.results) {
        // Fallback to AI response if no actual data
        const newStars: Record<string, number> = {};
        if (!response.performance_report?.tactical_audits) return newStars;
        const audits = response.performance_report.tactical_audits;
        for (const category in audits) {
            const catData = audits[category];
            if (!catData?.priorities) continue;

            let catAbbr = category;
            if (category === 'top10') catAbbr = 'T12';
            else if (category === 'top20') catAbbr = 'T20';
            else if (category === 'bankers') catAbbr = 'BNK';
            else if (category === 'bankers_dlive') catAbbr = 'BDL';
            else if (category === 'value_bets') catAbbr = 'VB';
            else if (category === 'value_picks') catAbbr = 'VP';
            else if (category === 'banker_draws') catAbbr = 'BD';
            else if (category === 'upsets') catAbbr = 'UPS';

            for (const pr in catData.priorities) {
                const prData = catData.priorities[pr];
                if (!prData?.groups) continue;

                for (const group in prData.groups) {
                    const groupData = prData.groups[group];
                    if (groupData?.stars !== undefined) {
                        const key = `${catAbbr}-${pr}-G${group}`;
                        newStars[key] = groupData.stars;
                    }
                }
            }
        }
        return newStars;
    }

    // Use actual performance data
    return extractFromResults(latestArchive.results, calculateStars);
};

export const saveMatchStars = async (response: AIResponse) => {
    const newStars = extractMatchStars(response);

    if (Object.keys(newStars).length === 0) return;

    try {
        const existing = await getMatchStars();
        const updated = { ...existing, ...newStars };
        
        localStorage.setItem(STARS_KEY, JSON.stringify(updated));
        cachedStars = updated;
        debouncedSyncToSupabase(STARS_KEY);
        
        console.log('Match stars updated successfully:', newStars);
        window.dispatchEvent(new Event('matchStarsUpdated'));
    } catch (error) {
        console.error('Error saving match stars:', error);
    }
};

export const saveManualMatchStars = async (stars: Record<string, number>) => {
    if (Object.keys(stars).length === 0) return;
    try {
        const existing = await getMatchStars();
        const updated = { ...existing, ...stars };
        
        localStorage.setItem(STARS_KEY, JSON.stringify(updated));
        cachedStars = updated;
        debouncedSyncToSupabase(STARS_KEY);
        
        console.log('Manual match stars saved locally and synced');
        window.dispatchEvent(new Event('matchStarsUpdated'));
    } catch (error) {
        console.error('Error saving manual match stars:', error);
    }
};

export const updateMatchStarsFromPerformance = async () => {
    const archives = Storage.getPerformanceArchives();
    const latestArchive = archives.length > 0 ? archives[0] : null;
    
    if (!latestArchive || !latestArchive.results) return;

    const newStars = extractFromResults(latestArchive.results, calculateStars);

    if (Object.keys(newStars).length === 0) return;

    try {
        const existing = await getMatchStars();
        const updated = { ...existing, ...newStars };
        
        localStorage.setItem(STARS_KEY, JSON.stringify(updated));
        cachedStars = updated;
        debouncedSyncToSupabase(STARS_KEY);
        
        console.log('Match stars updated successfully from performance data:', newStars);
        window.dispatchEvent(new Event('matchStarsUpdated'));
    } catch (error) {
        console.error('Error saving match stars from performance data:', error);
    }
};



let cachedStars: Record<string, number> | null = null;
let fetchPromise: Promise<Record<string, number>> | null = null;

export const useMatchStars = () => {
    const [stars, setStars] = useState<Record<string, number>>({});

    useEffect(() => {
        const fetchStars = () => getMatchStars().then(setStars);
        fetchStars();
        
        const handleUpdate = () => {
             getMatchStars(true).then(setStars);
        };
        
        window.addEventListener('matchStarsUpdated', handleUpdate);
        return () => window.removeEventListener('matchStarsUpdated', handleUpdate);
    }, []);

    return stars;
};

export const getMatchStars = async (forceRefresh = false): Promise<Record<string, number>> => {
    if (cachedStars && !forceRefresh) return cachedStars;
    
    const local = localStorage.getItem(STARS_KEY);
    if (local) {
        try {
            cachedStars = JSON.parse(local);
            return cachedStars || {};
        } catch (e) {
            console.error('Failed to parse local stars');
        }
    }
    
    // Legacy fallback just in case
    return {};
};

export const getMatchMaxStars = (match: any, matchStars: Record<string, number>): number => {
    const abbrMap: Record<string, string> = {
        'top10': 'T12', 'botb_best': 'BOTB', 'top20': 'T20', 
        'bankers': 'BNK', 'bankers_jackpot': 'BNK',
        'bankers_dlive': 'BDL',
        'value_bets': 'VB', 'value_picks': 'VP', 
        'banker_draws': 'BD', 'upsets': 'UPS'
    };

    let maxStars = 0;
    const tags = match.evaluatorTags || [];
    
    for (const tag of tags) {
        const [cat, pr] = tag.split(':');
        const abbr = abbrMap[cat];
        if (abbr && pr && pr !== 'PROMOTE' && pr !== 'DEMOTE') {
            const group = match.group || 3;
            const key = `${abbr}-${pr}-G${group}`;
            const fallbackKey = `${abbr}-${pr}-G3`;
            
            let stars = matchStars[key];
            if (stars === undefined) {
                stars = matchStars[fallbackKey];
            }
            
            if (stars !== undefined && stars > maxStars) {
                maxStars = stars;
            }
        }
    }

    return maxStars;
};