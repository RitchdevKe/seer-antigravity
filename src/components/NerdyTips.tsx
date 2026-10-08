
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Cpu, 
  RefreshCw, 
  Download, 
  FileSpreadsheet,
  Send, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Calendar, 
  Clock,
  ChevronRight,
  ChevronDown,
  Search,
  Target,
  Copy,
  ExternalLink,
  X
} from 'lucide-react';
import { utils, writeFile } from 'xlsx';
import { supabase } from '../lib/supabase';
import { Match } from '../types';
import { JACKPOT_OPTIONS } from '../constants';
import { formatScore } from '../utils/matchProcessing';
import { getNerdyMatchesCache, saveNerdyMatchesCache } from '../services/storage';

interface NerdyTipsProps {
  onPushToLive: (matches: Match[]) => void;
  onPushResultsToLive?: (matches: Match[]) => number;
  liveMatches?: Match[];
}

const NerdyTips: React.FC<NerdyTipsProps> = ({ onPushToLive, onPushResultsToLive, liveMatches = [] }) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'jackpot'>('daily');
  const [dailyMatches, setDailyMatches] = useState<Match[]>([]);
  const [jackpotMatches, setJackpotMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSqlSetup, setShowSqlSetup] = useState(false);
  
  // Jackpot specific
  const [jackpotText, setJackpotText] = useState('');
  const [jackpotType, setJackpotType] = useState('sportpesa_13'); // Default to Sportpesa 13 ID

  
  const renderL10 = (formString: string) => {
    if (!formString || formString === '-' || formString === 'Unknown') return '-';
    const str = formString.trim();
    if (/^\d+\s*:\s*\d+$/.test(str)) return str;
    
    const parts = str.split(':');
    if (parts.length === 2) {
        const homeWins = (parts[0].match(/W/gi) || []).length;
        const awayWins = (parts[1].match(/W/gi) || []).length;
        return `${homeWins}:${awayWins}`;
    }
    return str;
  };

  const renderFormBadges = (formString: string) => {

    if (!formString || formString === '-' || formString === 'Unknown') return <span className="text-gray-400">-</span>;
    
    const parts = formString.split(':');
    return (
      <div className="flex flex-col gap-1">
        {parts.map((teamForm, idx) => (
          <div key={idx} className="flex gap-0.5">
            {teamForm.split('-').map((result, rIdx) => {
              let bgColor = 'bg-gray-200';
              let textColor = 'text-gray-600';
              if (result === 'W') { bgColor = 'bg-green-100'; textColor = 'text-green-700'; }
              else if (result === 'L') { bgColor = 'bg-red-100'; textColor = 'text-red-700'; }
              else if (result === 'D') { bgColor = 'bg-gray-100'; textColor = 'text-gray-600'; }
              
              return (
                <span key={rIdx} className={`w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded-sm ${bgColor} ${textColor}`}>
                  {result}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    );
  };
  
  const sortMatches = (fetchedMatches: Match[]) => {
    const tomorrow = getTomorrowDate();
    return [...fetchedMatches].sort((a, b) => {
      const dateA = a.date.split(' ')[0];
      const dateB = b.date.split(' ')[0];
      const timeA = a.date.split(' ')[1] || "00:00";
      const timeB = b.date.split(' ')[1] || "00:00";
      
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA); // Descending by date
      }
      
      if (dateA === tomorrow) {
        return timeA.localeCompare(timeB); // Ascending for tomorrow
      } else {
        return timeB.localeCompare(timeA); // Descending for today and yesterday
      }
    });
  };

  const deduplicateMatches = (matches: Match[]) => {
    const seen = new Set();
    return matches.filter(match => {
      // Always use a normalized key for deduplication to prevent same-match duplicates
      // with different ID prefixes (e.g., 'nerdy_...' vs '...')
      const dedupKey = `${match.teams.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${match.date.split(' ')[0]}`;
      if (seen.has(dedupKey)) return false;
      seen.add(dedupKey);
      return true;
    });
  };

  const getActiveMatches = () => {
    if (activeTab === 'daily') return dailyMatches;
    // Filter jackpot matches by selected type
    return jackpotMatches.filter(m => m.jackpotIds && m.jackpotIds.includes(jackpotType));
  };
  const getCollectionName = () => activeTab === 'daily' ? 'nerdy_matches' : 'nerdy_jackpot_matches';

  const filteredMatches = useMemo(() => {
    const activeMatches = getActiveMatches();
    if (!searchTerm.trim()) return activeMatches;
    const term = searchTerm.toLowerCase();
    return activeMatches.filter(m => 
      m.teams.toLowerCase().includes(term) || 
      (m.league && m.league.toLowerCase().includes(term)) ||
      (m.pred1x2 && m.pred1x2.toLowerCase().includes(term))
    );
  }, [dailyMatches, jackpotMatches, activeTab, searchTerm]);

  const handlePushMatchToOther = async (match: Match) => {
    try {
      const sourceCol = activeTab === 'daily' ? 'nerdy_matches' : 'nerdy_jackpot_matches';
      const targetCol = activeTab === 'daily' ? 'nerdy_jackpot_matches' : 'nerdy_matches';
      
      let newId = String(match.id);
      if (activeTab === 'daily') {
        if (!newId.startsWith('nerdy_jackpot_')) {
          newId = newId.replace('nerdy_', 'nerdy_jackpot_');
        }
      } else {
        newId = newId.replace('nerdy_jackpot_', 'nerdy_');
      }

      let newJackpotIds = match.jackpotIds || [];
      if (activeTab === 'daily' && jackpotType && !newJackpotIds.includes(jackpotType)) {
        newJackpotIds = [...newJackpotIds, jackpotType];
      }

      const newMatch = {
        ...match,
        id: newId,
        isJackpot: activeTab === 'daily',
        isDaily: activeTab === 'jackpot',
        jackpotIds: newJackpotIds
      };

      // Save to other database table in Supabase
      const newMatchFull = {
        id: newId,
        teams: newMatch.teams,
        date: newMatch.date,
        analysis: newMatch.analysis || null,
        percentage: newMatch.percentage || null,
        stars: newMatch.stars || null,
        tip: newMatch.tip || null,
        odds: newMatch.odds || null,
        result: newMatch.result || null,
        jackpot_ids: newMatch.jackpotIds,
        rating1x2: newMatch.rating || null,
        gs: newMatch.gs || null,
        ga: newMatch.ga || null,
        l10: newMatch.l10 || null,
        le: newMatch.le || null,
        mo: newMatch.mo || null,
        pred1x2: newMatch.pred1x2 || null,
        data: newMatch,
        updated_at: new Date().toISOString()
      };

      const { error: moveErr } = await supabase
        .from(targetCol)
        .upsert(newMatchFull, { onConflict: 'id' });

      let moveErrResult = moveErr;

      if (moveErrResult && (moveErrResult.message?.toLowerCase().includes('column') || moveErrResult.code === '42703')) {
         console.warn("Full individual upsert failed due to missing columns, trying JSON data upsert...", moveErrResult.message);
         // Try Level 2: Standard fields + data JSONB field
         const intermediateMatch = {
           id: newMatchFull.id,
           teams: newMatchFull.teams,
           date: newMatchFull.date,
           analysis: newMatchFull.analysis,
           percentage: newMatchFull.percentage,
           stars: newMatchFull.stars,
           tip: newMatchFull.tip,
           odds: newMatchFull.odds,
           result: newMatchFull.result,
           jackpot_ids: newMatchFull.jackpot_ids,
           data: newMatchFull.data,
           updated_at: newMatchFull.updated_at
         };
         
         const { error: intermediateErr } = await supabase
           .from(targetCol)
           .upsert(intermediateMatch, { onConflict: 'id' });
           
         moveErrResult = intermediateErr;

         if (moveErrResult && (moveErrResult.message?.toLowerCase().includes('column') || moveErrResult.code === '42703')) {
            console.warn("JSON data upsert failed as well, trying Level 3 extreme minimal upsert...", moveErrResult.message);
            // Try Level 3: Extreme minimal (without data column)
            const minimalMatch = {
              id: newMatchFull.id,
              teams: newMatchFull.teams,
              date: newMatchFull.date,
              analysis: newMatchFull.analysis,
              percentage: newMatchFull.percentage,
              stars: newMatchFull.stars,
              tip: newMatchFull.tip,
              odds: newMatchFull.odds,
              result: newMatchFull.result,
              jackpot_ids: newMatchFull.jackpot_ids,
              updated_at: newMatchFull.updated_at
            };
            const { error: minMoveErr } = await supabase.from(targetCol).upsert(minimalMatch, { onConflict: 'id' });
            if (minMoveErr) throw minMoveErr;
            setError("Note: Match pushed with minimal data. Please update your database schema.");
         } else if (moveErrResult) {
            throw moveErrResult;
         } else {
            // Level 2 succeeded! Data stored in 'data'. Clear error.
            setError(null);
         }
      } else if (moveErrResult) {
         throw moveErrResult;
      }

      // Retain original match in source table and update target table/state
      if (activeTab === 'daily') {
        const updatedJackpot = sortMatches(deduplicateMatches([newMatch, ...jackpotMatches])).slice(0, 5000);
        setJackpotMatches(updatedJackpot);
        saveNerdyMatchesCache('jackpot', updatedJackpot);
      } else {
        const updatedDaily = sortMatches(deduplicateMatches([newMatch, ...dailyMatches])).slice(0, 5000);
        setDailyMatches(updatedDaily);
        saveNerdyMatchesCache('daily', updatedDaily);
      }

      setSuccess(`Match added to ${activeTab === 'daily' ? 'Jackpot Extractions' : 'Daily Extractions'} and retained in ${activeTab === 'daily' ? 'Daily Extractions' : 'Jackpot Extractions'}.`);
    } catch (err: any) {
      console.error("Error pushing match:", err);
      setError(`Failed to push match: ${err.message || err}`);
    }
  };

  // Extraction parameters
  const getLocalDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTomorrowDate = () => {
    const now = new Date();
    now.setDate(now.getDate() + 1);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [startDate, setStartDate] = useState(getLocalDate());
  const [startTime, setStartTime] = useState("12:00");
  const [endDate, setEndDate] = useState(getTomorrowDate());
  const [endTime, setEndTime] = useState("08:00");

  useEffect(() => {
    fetchSavedMatches();
  }, []);

  const fetchSavedMatches = async (forceRefreshParam = false) => {
    setLoading(true);
    try {
      const now = Date.now();
      const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
      const lastFetchStr = localStorage.getItem('prm_nerdy_matches_last_fetch');
      const lastFetch = lastFetchStr ? parseInt(lastFetchStr, 10) : 0;

      // 1. Initial load from local cache to be responsive
      const isValidStat = (val: string | undefined) => !val || val.length <= 15;
      const filterMatches = (matches: Match[]) => matches.filter(m => isValidStat(m.ga) && isValidStat(m.gs) && isValidStat(m.l10));
      const cachedDaily = filterMatches(getNerdyMatchesCache('daily'));
      const cachedJackpot = filterMatches(getNerdyMatchesCache('jackpot'));
      
      let hasCachedData = false;
      if (cachedDaily.length > 0) {
        setDailyMatches(cachedDaily);
        hasCachedData = true;
      }
      if (cachedJackpot.length > 0) {
        setJackpotMatches(cachedJackpot);
        hasCachedData = true;
      }

      // 2. Opt for cached data instead of frequent Supabase requests
      const recentFetch = lastFetch > 0 && (now - lastFetch < CACHE_TTL);
      if (!forceRefreshParam && recentFetch && hasCachedData) {
        console.log("Using cached Nerdy Tips matches (skipping Supabase fetch).");
        setLoading(false);
        return;
      }

      console.log("Fetching Nerdy Tips matches from Supabase...");

      // 3. Fetch Daily from Supabase
      const { data: dailyData, error: dailyErr } = await supabase
        .from('nerdy_matches')
        .select('*')
        .order('date', { ascending: false })
        .limit(1000);

      if (dailyErr) {
        console.warn("Daily matches fetch failed (table might need schema update):", dailyErr.message);
      } else if (dailyData) {
        const fetchedDaily: Match[] = dailyData.map(row => {
          const rowData = row.data || {};
          return {
            id: row.id,
            teams: row.teams,
            date: row.date,
            result: row.result || rowData.result || '',
            analysis: row.analysis || rowData.analysis || '',
            percentage: row.percentage || rowData.percentage || '',
            stars: row.stars || rowData.stars || '',
            tip: row.tip || rowData.tip || '',
            odds: row.odds || rowData.odds || '',
            rating: row.rating1x2 || row.rating || rowData.rating || rowData.rating1x2 || '',
            jackpotIds: row.jackpot_ids || rowData.jackpotIds || [],
            ga: row.ga || rowData.ga || '',
            gs: row.gs || rowData.gs || '',
            l10: row.l10 || rowData.l10 || '',
            le: row.le || rowData.le || '',
            mo: row.mo || rowData.mo || '',
            pred1x2: row.pred1x2 || rowData.pred1x2 || '',
            isDaily: true,
            isJackpot: false
          } as any as Match;
        });

        const sortedDaily = sortMatches(fetchedDaily);
        setDailyMatches(sortedDaily);
        saveNerdyMatchesCache('daily', sortedDaily);
      }

      // 3. Fetch Jackpot from Supabase
      const { data: jackpotData, error: jackpotErr } = await supabase
        .from('nerdy_jackpot_matches')
        .select('*')
        .order('date', { ascending: false })
        .limit(1000);

      if (jackpotErr) {
        console.warn("Jackpot matches fetch failed (table might need schema update):", jackpotErr.message);
      } else if (jackpotData) {
        const fetchedJackpot: Match[] = jackpotData.map(row => {
          const rowData = row.data || {};
          return {
            id: row.id,
            teams: row.teams,
            date: row.date,
            analysis: row.analysis || rowData.analysis || '',
            percentage: row.percentage || rowData.percentage || '',
            stars: row.stars || rowData.stars || '',
            tip: row.tip || rowData.tip || '',
            odds: row.odds || rowData.odds || '',
            result: row.result || rowData.result || '',
            jackpotIds: row.jackpot_ids || rowData.jackpotIds || [],
            rating: row.rating1x2 || row.rating || rowData.rating || rowData.rating1x2 || '',
            gs: row.gs || rowData.gs || '',
            ga: row.ga || rowData.ga || '',
            l10: row.l10 || rowData.l10 || '',
            le: row.le || rowData.le || '',
            mo: row.mo || rowData.mo || '',
            pred1x2: row.pred1x2 || rowData.pred1x2 || '',
            isDaily: false,
            isJackpot: true
          } as any as Match;
        });

        const sortedJackpot = sortMatches(fetchedJackpot);
        setJackpotMatches(sortedJackpot);
        saveNerdyMatchesCache('jackpot', sortedJackpot);
      }
      
      localStorage.setItem('prm_nerdy_matches_last_fetch', now.toString());

      setError(null);
    } catch (err: any) {
      console.error("Error fetching nerdy matches from Supabase:", err);
      setError(`Failed to load saved matches: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExtract = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      let endpoint = '/api/nerdy/fetch';
      const activeMatches = getActiveMatches();
      let payload: any = {
        start: `${startDate}T${startTime}:00`,
        end: `${endDate}T${endTime}:00`,
        existingMatches: activeMatches.map(m => `${m.teams}_${m.date.split(' ')[0]}`)
      };

      if (activeTab === 'jackpot') {
        if (!jackpotText.trim()) {
          throw new Error("Please paste jackpot matches.");
        }
        endpoint = '/api/nerdy/jackpot';
        payload.jackpotMatchesText = jackpotText;
        payload.jackpotType = jackpotType;
        payload.dailyMatches = dailyMatches; // Send daily matches for smart extraction check
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMsg = `Server error: ${response.status} ${response.statusText}`;
        try {
          const text = await response.text();
          if (text) {
            try {
              const data = JSON.parse(text);
              if (data.error) errorMsg = data.error;
            } catch {
              if (text.length < 100 && !text.startsWith('<')) errorMsg = text;
              else if (response.status === 404) errorMsg = "API endpoint not found. Ensure backend server is running.";
            }
          }
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const responseData = await response.json();
      const rawExtractedMatches: Match[] = Array.isArray(responseData) ? responseData : (responseData.matches || []);
      
      // Ensure GS, GA, L10 are valid strings without discarding past or finished matches
      const sanitizeStat = (val: string | undefined) => {
        if (!val || val === 'Unknown' || val.trim() === '' || val.length > 25) {
          return '0:0';
        }
        return val.trim();
      };

      const extractedMatches = rawExtractedMatches.map(m => ({
        ...m,
        gs: sanitizeStat(m.gs),
        ga: sanitizeStat(m.ga),
        l10: sanitizeStat(m.l10)
      }));
      
      if (extractedMatches.length === 0) {
        setSuccess("No matches found for the selected parameters.");
        setLoading(false);
        return;
      }

      // Save to Supabase
      const collectionName = getCollectionName();
      
      const allExistingMatches = [...dailyMatches, ...jackpotMatches];
      
      const findExisting = (m: Match) => {
        const normTeams = m.teams.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const mDate = new Date(m.date.split(' ')[0]);
        return allExistingMatches.find(ex => {
          const exNorm = ex.teams.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          if (normTeams !== exNorm && !normTeams.includes(exNorm) && !exNorm.includes(normTeams)) return false;
          const exDate = new Date(ex.date.split(' ')[0]);
          if (isNaN(mDate.getTime()) || isNaN(exDate.getTime())) return false;
          const diffDays = Math.abs((mDate.getTime() - exDate.getTime()) / (1000 * 3600 * 24));
          return diffDays <= 1; // Allow +/- 1 day for timezone shifts
        });
      };

      const recordsToUpsert = extractedMatches.map(match => {
        const existingRecord = findExisting(match);
        // Use existingRecord's id if it exists, otherwise use match.id from backend, otherwise fallback
        const docId = existingRecord?.id || match.id || `${match.teams.replace(/[^a-zA-Z0-9]/g, '_')}_${match.date.split(' ')[0]}`;
        
        let finalJackpotIds = match.jackpotIds || [];
        if (activeTab === 'jackpot') {
          const currentIds = existingRecord?.jackpotIds || (existingRecord as any)?.jackpot_ids || [];
          if (!currentIds.includes(jackpotType)) {
            finalJackpotIds = [...currentIds, jackpotType];
          } else {
            finalJackpotIds = currentIds;
          }
        }

        if (existingRecord) {
            // Overwrite the extracted match with the existing record to preserve odds and data
            // but keep the NEWly extracted date to allow time adjustments to propagate
            const newDate = match.date;
            Object.assign(match, existingRecord);
            match.date = newDate;
        }

        if (activeTab === 'jackpot') {
            match.jackpotIds = finalJackpotIds;
            match.isJackpot = true;
        }

        const source = match;

        // Create a full record with all fields
        return {
          id: docId,
          teams: source.teams,
          date: source.date,
          analysis: source.analysis || null,
          percentage: source.percentage || null,
          stars: source.stars || null,
          tip: source.tip || null,
          odds: source.odds || null,
          result: source.result || null,
          jackpot_ids: finalJackpotIds,
          rating1x2: (source as any).rating1x2 || source.rating || null,
          gs: source.gs || null,
          ga: source.ga || null,
          l10: source.l10 || null,
          le: source.le || null,
          mo: source.mo || null,
          pred1x2: source.pred1x2 || null,
          data: (source as any).data || source,
          updated_at: new Date().toISOString()
        };
      });

      // Deduplicate records by ID before upserting
      const uniqueRecordsMap = new Map<string, any>();
      recordsToUpsert.forEach(record => {
        uniqueRecordsMap.set(String(record.id), record);
      });
      const finalRecordsToUpsert = Array.from(uniqueRecordsMap.values());

      try {
        // Process upserts in chunks to prevent statement timeouts
        const chunkSize = 20;
        let minimalFallbackTriggered = false;
        
        for (let i = 0; i < finalRecordsToUpsert.length; i += chunkSize) {
          const chunk = finalRecordsToUpsert.slice(i, i + chunkSize);
          
          const { error: upsertErr } = await supabase
            .from(collectionName)
            .upsert(chunk, { onConflict: 'id' });

          if (upsertErr) {
            if (upsertErr.message?.toLowerCase().includes('column') || upsertErr.code === '42703') {
              console.warn("Full upsert failed due to missing columns, trying JSON data upsert...", upsertErr.message);
              
              // Try Level 2: Standard fields + data JSONB field
              const intermediateRecords = chunk.map(r => ({
                id: r.id,
                teams: r.teams,
                date: r.date,
                analysis: r.analysis,
                percentage: r.percentage,
                stars: r.stars,
                tip: r.tip,
                odds: r.odds,
                result: r.result,
                jackpot_ids: r.jackpot_ids,
                data: r.data,
                updated_at: r.updated_at
              }));

              const { error: intermediateErr } = await supabase
                .from(collectionName)
                .upsert(intermediateRecords, { onConflict: 'id' });

              if (intermediateErr && (intermediateErr.message?.toLowerCase().includes('column') || intermediateErr.code === '42703')) {
                console.warn("JSON data upsert failed as well, trying Level 3 extreme minimal upsert...", intermediateErr.message);
                
                // Try Level 3: Extreme minimal (without data column)
                const minimalRecords = chunk.map(r => ({
                  id: r.id,
                  teams: r.teams,
                  date: r.date,
                  analysis: r.analysis,
                  percentage: r.percentage,
                  stars: r.stars,
                  tip: r.tip,
                  odds: r.odds,
                  result: r.result,
                  jackpot_ids: r.jackpot_ids,
                  updated_at: r.updated_at
                }));

                const { error: minUpsertErr } = await supabase
                  .from(collectionName)
                  .upsert(minimalRecords, { onConflict: 'id' });
                
                if (minUpsertErr) throw minUpsertErr;
                minimalFallbackTriggered = true;
              } else if (intermediateErr) {
                throw intermediateErr;
              }
            } else {
              throw upsertErr;
            }
          }
        }
        
        if (minimalFallbackTriggered) {
           setError("Note: Matches saved with minimal data. Please run the SQL in supabase_schema.sql to support all fields.");
        } else {
           setError(null);
        }
      } catch (dbErr: any) {
        console.error("Supabase upsert persistent error:", dbErr);
        throw new Error(`Database error: ${dbErr.message || dbErr}. Make sure your tables are correctly configured.`);
      }

      // Update state and cache
      if (activeTab === 'daily') {
        const newDaily = sortMatches(deduplicateMatches([...extractedMatches, ...dailyMatches])).slice(0, 5000);
        setDailyMatches(newDaily);
        saveNerdyMatchesCache('daily', newDaily);
      } else {
        // For local state update, we need to handle merging of jackpot IDs as well
        const updatedJackpotMatches = [...jackpotMatches];
        extractedMatches.forEach(em => {
          const docId = em.id || `${em.teams.replace(/[^a-zA-Z0-9]/g, '_')}_${em.date.split(' ')[0]}`;
          const index = updatedJackpotMatches.findIndex(m => m.id === docId);
          
          const newMatch = { ...em, id: docId, isJackpot: true };
          if (index !== -1) {
            const currentIds = updatedJackpotMatches[index].jackpotIds || [];
            newMatch.jackpotIds = Array.from(new Set([...currentIds, jackpotType]));
            updatedJackpotMatches[index] = newMatch;
          } else {
            newMatch.jackpotIds = [jackpotType];
            updatedJackpotMatches.push(newMatch);
          }
        });

        const newJackpot = sortMatches(deduplicateMatches(updatedJackpotMatches)).slice(0, 5000);
        setJackpotMatches(newJackpot);
        saveNerdyMatchesCache('jackpot', newJackpot);
      }
      
      setSuccess(`Successfully extracted ${extractedMatches.length} matches.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMatch = async (id: string) => {
    const collectionName = getCollectionName();
    try {
      const { error: delErr } = await supabase
        .from(collectionName)
        .delete()
        .eq('id', id);

      if (delErr) throw delErr;

      if (activeTab === 'daily') {
        const newDaily = dailyMatches.filter(m => m.id !== id);
        setDailyMatches(newDaily);
        saveNerdyMatchesCache('daily', newDaily);
      } else {
        const newJackpot = jackpotMatches.filter(m => m.id !== id);
        setJackpotMatches(newJackpot);
        saveNerdyMatchesCache('jackpot', newJackpot);
      }
      setSuccess("Match deleted successfully.");
    } catch (err: any) {
      console.error(err);
      setError(`Failed to delete match: ${err.message || err}`);
    }
  };

  const handleDeleteAll = async () => {
    setLoading(true);
    setError(null);
    const collectionName = getCollectionName();
    try {
      // 1. Attempt deletion via dedicated fast backend endpoint
      let deleteSuccess = false;
      try {
        const resp = await fetch('/api/nerdy/delete-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: activeTab })
        });
        if (resp.ok) {
          deleteSuccess = true;
        }
      } catch (apiErr) {
        console.warn("Direct delete-all API endpoint unreachable, falling back to db query:", apiErr);
      }

      // 2. Fallback via supabase query builder if direct endpoint wasn't reached
      if (!deleteSuccess) {
        const { error: delErr } = await supabase
          .from(collectionName)
          .delete()
          .neq('id', '');

        if (delErr) {
          console.warn("Supabase delete returned error:", delErr);
        }
      }
    } catch (err: any) {
      console.warn("Database delete encountered an issue:", err);
    } finally {
      // 3. Unconditionally clear local React state and storage caches so UI is immediately clean
      if (activeTab === 'daily') {
        setDailyMatches([]);
        saveNerdyMatchesCache('daily', []);
      } else {
        setJackpotMatches([]);
        saveNerdyMatchesCache('jackpot', []);
      }
      localStorage.removeItem('prm_nerdy_matches_last_fetch');
      setSuccess(`All ${activeTab === 'jackpot' ? 'Jackpot' : 'Daily'} matches deleted.`);
      setShowDeleteConfirm(false);
      setLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    const activeMatches = getActiveMatches();
    if (activeMatches.length === 0) return;
    
    try {
      const data = activeMatches.map(m => ({
        Date: m.date,
        Teams: m.teams,
        Result: m.result || 'Pending',
        '1X2 Tip': m.pred1x2 || '-',
        '1X2 Rating': m.rating || '-',
        'GS (A:B)': m.gs || '-',
        'GA (A:B)': m.ga || '-',
        'L10/Form': m.l10 || '-',
        'LE/H2H': m.le || '-',
        'Market Odds': m.mo || '-'
      }));

      const worksheet = utils.json_to_sheet(data);
      const workbook = utils.book_new();
      utils.book_append_sheet(workbook, worksheet, "Matches");
      writeFile(workbook, `NerdyMatches_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
      setSuccess("Excel file downloaded.");
    } catch (err) {
      console.error("Excel download error:", err);
      setError("Failed to generate Excel file.");
    }
  };

  const handlePushToLive = () => {
    if (filteredMatches.length === 0) return;
    
    // Ensure matches have correct flags when pushed
    const matchesToPush = filteredMatches.map(m => ({
      ...m,
      isJackpot: activeTab === 'jackpot' ? true : (m.isJackpot || false),
      isDaily: activeTab === 'daily' ? true : (m.isDaily || false),
      jackpotIds: activeTab === 'jackpot' 
        ? Array.from(new Set([...(m.jackpotIds || []), jackpotType]))
        : (m.jackpotIds || [])
    }));

    onPushToLive(matchesToPush);
    setSuccess(`Matches pushed to Live Analysis ${activeTab === 'jackpot' ? 'Jackpot' : 'Daily'}.`);
  };

  const handlePushResultsToLive = () => {
    if (filteredMatches.length === 0 || !onPushResultsToLive) return;
    
    // Ensure matches have correct flags when pushed results
    const matchesWithResults = filteredMatches.map(m => ({
      ...m,
      isJackpot: activeTab === 'jackpot' ? true : (m.isJackpot || false),
      isDaily: activeTab === 'daily' ? true : (m.isDaily || false),
      jackpotIds: activeTab === 'jackpot' 
        ? Array.from(new Set([...(m.jackpotIds || []), jackpotType]))
        : (m.jackpotIds || [])
    }));

    const count = onPushResultsToLive(matchesWithResults);
    if (count > 0) {
      setSuccess(`Results pushed to Live Analysis ${activeTab === 'jackpot' ? 'Jackpot' : 'Daily'} (${count} updated).`);
    } else {
      setSuccess("No new results to update in Live Analysis.");
    }
  };

  const handleFetchResults = async () => {
    const activeMatches = getActiveMatches();
    if (activeMatches.length === 0) return;
    
    const matchesWithoutResults = activeMatches.filter(m => {
      const needsResult = !m.result || m.result === "Unknown" || m.result === "" || m.result === "Pending";
      const needsTip = !m.pred1x2 || m.pred1x2 === "Unknown" || m.pred1x2 === "-";
      return needsResult || needsTip;
    });
    
    if (matchesWithoutResults.length === 0) {
      setSuccess("All extracted matches already have results and tips.");
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/nerdy/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          matches: matchesWithoutResults,
          dailyMatches: dailyMatches, // Send daily matches for smart pulling
          isJackpot: activeTab === 'jackpot'
        })
      });

      if (!response.ok) {
        let errorMsg = `Server error: ${response.status} ${response.statusText}`;
        try {
          const text = await response.text();
          if (text) {
            try {
              const data = JSON.parse(text);
              if (data.error) errorMsg = data.error;
            } catch {
              // Not JSON, just use the text if it's short, or keep the status
              if (text.length < 100 && !text.startsWith('<')) {
                errorMsg = text;
              } else if (response.status === 404) {
                errorMsg = "API endpoint not found. Ensure the backend server is running, not just the Vite preview.";
              }
            }
          }
        } catch (e) {
           // Ignore errors trying to parse error response
        }
        throw new Error(errorMsg);
      }

      const fetchedMatches: Match[] = await response.json();
      
      const collectionName = getCollectionName();
      let updatedCount = 0;
      const recordsToUpdate: any[] = [];
      
      const normalize = (str: string) => str.toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .replace(/\(w\)$|\(u\d+\)$|women$|u\d+$/g, '');

      for (const fetchedMatch of fetchedMatches) {
        if (fetchedMatch.result && fetchedMatch.result !== "Unknown" && fetchedMatch.result !== "") {
          const normalizedResult = fetchedMatch.result;
          
          const normFetchedTeams = normalize(fetchedMatch.teams);
          const existingMatch = activeMatches.find(m => {
            const normMTeams = normalize(m.teams);
            
            const mDate = new Date(m.date.split(' ')[0]);
            const fDate = new Date(fetchedMatch.date.split(' ')[0]);
            const diffDays = (!isNaN(mDate.getTime()) && !isNaN(fDate.getTime())) ? Math.abs((mDate.getTime() - fDate.getTime()) / (1000 * 3600 * 24)) : 100;
            const sameDate = diffDays <= 1;
            
            const teamsMatch = normMTeams === normFetchedTeams || 
                               normMTeams.includes(normFetchedTeams) || 
                               normFetchedTeams.includes(normMTeams);
            return sameDate && teamsMatch;
          });

          if (existingMatch && existingMatch.result !== normalizedResult) {
            recordsToUpdate.push({
              id: existingMatch.id,
              teams: existingMatch.teams,
              date: existingMatch.date,
              analysis: existingMatch.analysis || null,
              percentage: existingMatch.percentage || null,
              stars: existingMatch.stars || null,
              tip: existingMatch.tip || null,
              odds: existingMatch.odds || null,
              result: normalizedResult,
              jackpot_ids: existingMatch.jackpotIds || [],
              rating1x2: existingMatch.rating || null,
              gs: existingMatch.gs || null,
              ga: existingMatch.ga || null,
              l10: existingMatch.l10 || null,
              le: existingMatch.le || null,
              mo: existingMatch.mo || null,
              pred1x2: existingMatch.pred1x2 || null,
              data: { ...existingMatch, result: normalizedResult },
              updated_at: new Date().toISOString()
            });
            updatedCount++;
          }
        }
      }
      
      if (recordsToUpdate.length > 0) {
        // Deduplicate records by ID before upserting
        const uniqueUpdatesMap = new Map<string, any>();
        recordsToUpdate.forEach(record => {
          uniqueUpdatesMap.set(record.id, record);
        });
        const finalRecordsToUpdate = Array.from(uniqueUpdatesMap.values());

        const { error: syncErr } = await supabase
          .from(collectionName)
          .upsert(finalRecordsToUpdate, { onConflict: 'id' });

        if (syncErr) {
           if (syncErr.message?.toLowerCase().includes('column') || syncErr.code === '42703') {
              console.warn("Full sync upsert failed due to missing columns, trying JSON data upsert...", syncErr.message);
              
              // Try Level 2: Standard fields + data JSONB field
              const intermediateUpdates = finalRecordsToUpdate.map(r => ({
                id: r.id,
                teams: r.teams,
                date: r.date,
                analysis: r.analysis,
                percentage: r.percentage,
                stars: r.stars,
                tip: r.tip,
                odds: r.odds,
                result: r.result,
                jackpot_ids: r.jackpot_ids,
                data: r.data,
                updated_at: r.updated_at
              }));

              const { error: intermediateErr } = await supabase
                .from(collectionName)
                .upsert(intermediateUpdates, { onConflict: 'id' });

              if (intermediateErr && (intermediateErr.message?.toLowerCase().includes('column') || intermediateErr.code === '42703')) {
                console.warn("JSON data upsert failed as well, trying Level 3 extreme minimal upsert...", intermediateErr.message);
                
                // Try Level 3: Extreme minimal (without data column)
                const minimalUpdates = finalRecordsToUpdate.map(r => ({
                  id: r.id,
                  teams: r.teams,
                  date: r.date,
                  analysis: r.analysis,
                  percentage: r.percentage,
                  stars: r.stars,
                  tip: r.tip,
                  odds: r.odds,
                  result: r.result,
                  jackpot_ids: r.jackpot_ids,
                  updated_at: r.updated_at
                }));

                const { error: minSyncErr } = await supabase.from(collectionName).upsert(minimalUpdates, { onConflict: 'id' });
                if (minSyncErr) throw minSyncErr;
                setError("Note: Results synced with minimal data. Please update your database schema.");
              } else if (intermediateErr) {
                throw intermediateErr;
              } else {
                // Level 2 succeeded! Data stored in 'data'. Clear error.
                setError(null);
              }
           } else {
             throw syncErr;
           }
        }
      }

      setSuccess(`Successfully updated results for ${updatedCount} matches.`);
      
      // Update local state by merging results into the FULL lists
      const updateFullList = (list: Match[]) => list.map(m => {
        const fetched = fetchedMatches.find(fm => {
          const normFM = normalize(fm.teams);
          const normM = normalize(m.teams);
          return m.date.split(' ')[0] === fm.date.split(' ')[0] && 
                 (normM === normFM || normM.includes(normFM) || normFM.includes(normM));
        });
        if (fetched && fetched.result && fetched.result !== "Unknown") {
          return { ...m, result: fetched.result };
        }
        return m;
      });

      if (activeTab === 'daily') {
        setDailyMatches(prev => {
          const res = updateFullList(prev);
          saveNerdyMatchesCache('daily', res);
          return res;
        });
      } else {
        setJackpotMatches(prev => {
          const res = updateFullList(prev);
          saveNerdyMatchesCache('jackpot', res);
          return res;
        });
      }
    } catch (err: any) {
      setError(`Result Fetch Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMorningResults = async () => {
    const activeMatches = getActiveMatches();
    if (activeMatches.length === 0) return;

    // Filter activeMatches that were played/started between 00:00 and 12:00 EAT
    const morningMatches = activeMatches.filter(m => {
      if (!m.date || !m.date.includes(' ')) return false;
      const [, timeStr] = m.date.split(' ');
      if (!timeStr || !timeStr.includes(':')) return false;
      const [hStr, mStr] = timeStr.split(':');
      const hours = parseInt(hStr, 10);
      const minutes = parseInt(mStr, 10);
      if (isNaN(hours) || isNaN(minutes)) return false;
      const totalMin = hours * 60 + minutes;
      
      // Expand to 00:00 to 12:00 EAT (Morning matches)
      return totalMin >= 0 && totalMin <= 720;
    });

    if (morningMatches.length === 0) {
      setError("No unfinished morning matches found (00:00 - 12:00 EAT). All results might be up to date.");
      setSuccess(null);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      // Fetch fresh results from backend without dailyMatches cache to ensure scraping occurs
      const response = await fetch('/api/nerdy/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          matches: morningMatches,
          dailyMatches: [], // Empty array to bypass smart pull check and force fresh scrape
          isJackpot: activeTab === 'jackpot'
        })
      });

      if (!response.ok) {
        let errorMsg = `Server error: ${response.status} ${response.statusText}`;
        try {
          const text = await response.text();
          if (text) {
            try {
              const data = JSON.parse(text);
              if (data.error) errorMsg = data.error;
            } catch {
              if (text.length < 100 && !text.startsWith('<')) errorMsg = text;
              else if (response.status === 404) errorMsg = "API endpoint not found. Ensure backend server is running.";
            }
          }
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const fetchedMatches: Match[] = await response.json();
      
      const collectionName = getCollectionName();
      let updatedCount = 0;
      const recordsToUpdate: any[] = [];
      
      const normalize = (str: string) => str.toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .replace(/\(w\)$|\(u\d+\)$|women$|u\d+$/g, '');

      for (const fetchedMatch of fetchedMatches) {
        if (fetchedMatch.result && fetchedMatch.result !== "Unknown" && fetchedMatch.result !== "") {
          const normalizedResult = fetchedMatch.result;
          
          const normFetchedTeams = normalize(fetchedMatch.teams);
          const existingMatch = morningMatches.find(m => {
            const normMTeams = normalize(m.teams);
            
            const mDate = new Date(m.date.split(' ')[0]);
            const fDate = new Date(fetchedMatch.date.split(' ')[0]);
            const diffDays = (!isNaN(mDate.getTime()) && !isNaN(fDate.getTime())) ? Math.abs((mDate.getTime() - fDate.getTime()) / (1000 * 3600 * 24)) : 100;
            const sameDate = diffDays <= 1;
            
            const teamsMatch = normMTeams === normFetchedTeams || 
                               normMTeams.includes(normFetchedTeams) || 
                               normFetchedTeams.includes(normMTeams);
            return sameDate && teamsMatch;
          });

          // Update if the result is different (which is standard, but here we can update even if result was previously set/incomplete)
          if (existingMatch && existingMatch.result !== normalizedResult) {
            recordsToUpdate.push({
              id: existingMatch.id,
              teams: existingMatch.teams,
              date: existingMatch.date,
              analysis: existingMatch.analysis || null,
              percentage: existingMatch.percentage || null,
              stars: existingMatch.stars || null,
              tip: existingMatch.tip || null,
              odds: existingMatch.odds || null,
              result: normalizedResult,
              jackpot_ids: existingMatch.jackpotIds || [],
              rating1x2: existingMatch.rating || null,
              gs: existingMatch.gs || null,
              ga: existingMatch.ga || null,
              l10: existingMatch.l10 || null,
              le: existingMatch.le || null,
              mo: existingMatch.mo || null,
              pred1x2: existingMatch.pred1x2 || null,
              data: { ...existingMatch, result: normalizedResult },
              updated_at: new Date().toISOString()
            });
            updatedCount++;
          }
        }
      }
      
      if (recordsToUpdate.length > 0) {
        // Deduplicate records by ID before upserting
        const uniqueUpdatesMap = new Map<string, any>();
        recordsToUpdate.forEach(record => {
          uniqueUpdatesMap.set(record.id, record);
        });
        const finalRecordsToUpdate = Array.from(uniqueUpdatesMap.values());

        const { error: syncErr } = await supabase
          .from(collectionName)
          .upsert(finalRecordsToUpdate, { onConflict: 'id' });

        if (syncErr) {
           if (syncErr.message?.toLowerCase().includes('column') || syncErr.code === '42703') {
              console.warn("Full sync upsert failed due to missing columns, trying JSON data upsert...", syncErr.message);
              
              // Try Level 2: Standard fields + data JSONB field
              const intermediateUpdates = finalRecordsToUpdate.map(r => ({
                id: r.id,
                teams: r.teams,
                date: r.date,
                analysis: r.analysis,
                percentage: r.percentage,
                stars: r.stars,
                tip: r.tip,
                odds: r.odds,
                result: r.result,
                jackpot_ids: r.jackpot_ids,
                data: r.data,
                updated_at: r.updated_at
              }));

              const { error: intermediateErr } = await supabase
                .from(collectionName)
                .upsert(intermediateUpdates, { onConflict: 'id' });

              if (intermediateErr && (intermediateErr.message?.toLowerCase().includes('column') || intermediateErr.code === '42703')) {
                console.warn("JSON data upsert failed as well, trying Level 3 extreme minimal upsert...", intermediateErr.message);
                
                // Try Level 3: Extreme minimal (without data column)
                const minimalUpdates = finalRecordsToUpdate.map(r => ({
                  id: r.id,
                  teams: r.teams,
                  date: r.date,
                  analysis: r.analysis,
                  percentage: r.percentage,
                  stars: r.stars,
                  tip: r.tip,
                  odds: r.odds,
                  result: r.result,
                  jackpot_ids: r.jackpot_ids,
                  updated_at: r.updated_at
                }));

                const { error: minSyncErr } = await supabase.from(collectionName).upsert(minimalUpdates, { onConflict: 'id' });
                if (minSyncErr) throw minSyncErr;
                setError("Note: Results synced with minimal data. Please update your database schema.");
              } else if (intermediateErr) {
                throw intermediateErr;
              } else {
                setError(null);
              }
           } else {
             throw syncErr;
           }
        }
      }

      setSuccess(`Successfully updated results/goals for ${updatedCount} morning matches.`);
      
      // Update local state by merging results into the FULL lists
      const updateFullList = (list: Match[]) => list.map(m => {
        const fetched = fetchedMatches.find(fm => {
          const normFM = normalize(fm.teams);
          const normM = normalize(m.teams);
          return m.date.split(' ')[0] === fm.date.split(' ')[0] && 
                 (normM === normFM || normM.includes(normFM) || normFM.includes(normM));
        });
        if (fetched && fetched.result && fetched.result !== "Unknown") {
          return { ...m, result: fetched.result };
        }
        return m;
      });

      if (activeTab === 'daily') {
        setDailyMatches(prev => {
          const res = updateFullList(prev);
          saveNerdyMatchesCache('daily', res);
          return res;
        });
      } else {
        setJackpotMatches(prev => {
          const res = updateFullList(prev);
          saveNerdyMatchesCache('jackpot', res);
          return res;
        });
      }
    } catch (err: any) {
      setError(`Morning Result Update Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('daily')}
          className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'daily' ? 'border-amber-600 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Daily Extractions
        </button>
        <button
          onClick={() => setActiveTab('jackpot')}
          className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'jackpot' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Jackpot Extractions
        </button>
      </div>

      {/* Controls */}
      <div className={`${activeTab === 'jackpot' ? 'bg-indigo-50 border-indigo-100' : 'bg-amber-50 border-amber-100'} border rounded-xl p-4 md:p-6`}>
        {activeTab === 'jackpot' && (
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                  <label className="block text-sm font-semibold text-indigo-800 mb-2">Jackpot Type</label>
                  <select
                    value={jackpotType}
                    onChange={(e) => setJackpotType(e.target.value)}
                    className="w-full bg-white text-slate-900 border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {JACKPOT_OPTIONS.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.name}</option>
                    ))}
                  </select>
               </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-indigo-800 mb-2">Paste Matches (e.g. Team A vs Team B)</label>
              <textarea
                value={jackpotText}
                onChange={(e) => setJackpotText(e.target.value)}
                placeholder="Team A vs Team B&#10;Team C vs Team D"
                className="w-full bg-white text-slate-900 border border-indigo-200 rounded-lg px-3 py-2 text-sm h-32 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>
            <div className="text-xs text-indigo-600 flex items-start gap-1">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>Provide the dates below to limit the search. The AI will fuzzy match the pasted text against the extracted matches.</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1">
              <Calendar size={12} /> Start Date
            </label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1">
              <Clock size={12} /> Start Time (EAT)
            </label>
            <input 
              type="text" 
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              placeholder="HH:mm"
              className="w-full bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1">
              <Calendar size={12} /> End Date
            </label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1">
              <Clock size={12} /> End Time (EAT)
            </label>
            <input 
              type="text" 
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              placeholder="HH:mm"
              className="w-full bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExtract}
            disabled={loading}
            className={`flex-1 md:flex-none ${activeTab === 'jackpot' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-600 hover:bg-amber-700'} text-white px-6 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-sm`}
          >
            {loading ? <RefreshCw className="animate-spin" size={18} /> : <Download size={18} />}
            {activeTab === 'jackpot' ? 'Extract Jackpot Matches' : 'Extract Matches'}
          </button>
          
          <button
            onClick={handleFetchResults}
            disabled={loading || getActiveMatches().length === 0}
            className={`flex-1 md:flex-none bg-white border ${activeTab === 'jackpot' ? 'border-indigo-200 text-indigo-700 hover:bg-indigo-50' : 'border-amber-200 text-amber-700 hover:bg-amber-50'} px-6 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-sm`}
          >
            <Search size={18} />
            Fetch Results
          </button>

          <button
            onClick={handleUpdateMorningResults}
            disabled={loading || getActiveMatches().length === 0}
            className={`flex-1 md:flex-none bg-amber-50 border ${activeTab === 'jackpot' ? 'border-indigo-300 text-indigo-800 hover:bg-indigo-100' : 'border-amber-300 text-amber-800 hover:bg-amber-100'} px-6 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-sm`}
            title="Re-fetch and update goals of all morning matches (00:00 - 12:00) to overwrite half-time scores with full-time results."
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Update Morning Results (00:00-12:00)
          </button>

          <button
            onClick={() => fetchSavedMatches(true)}
            disabled={loading}
            className={`flex-1 md:flex-none bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-6 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-sm`}
            title="Force reload all matches from database"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Reload DB
          </button>

          <button
            onClick={() => setShowSqlSetup(true)}
            className="flex-1 md:flex-none bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 px-6 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
            title="View database table setup & upgrade SQL instructions"
          >
            <Cpu size={18} />
            DB Setup
          </button>

          <button
            onClick={handlePushToLive}
            disabled={loading || filteredMatches.length === 0}
            className={`flex-1 md:flex-none ${activeTab === 'jackpot' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-emerald-600 hover:bg-emerald-700'} text-white px-6 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-sm`}
          >
            <Send size={18} />
            {activeTab === 'jackpot' ? 'Push to Live Analysis Jackpot' : 'Push to Live Analysis'}
          </button>

          {onPushResultsToLive && (
            <button
              onClick={handlePushResultsToLive}
              disabled={loading || filteredMatches.length === 0}
              className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-sm"
            >
              <CheckCircle size={18} />
              {activeTab === 'jackpot' ? 'Push Results to Live Jackpot' : 'Push Results to Live'}
            </button>
          )}

          <button
            onClick={handleDownloadExcel}
            disabled={loading || getActiveMatches().length === 0}
            className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-sm"
          >
            <FileSpreadsheet size={18} />
            Download Excel
          </button>

          <div className="relative flex-1 md:flex-none">
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading || getActiveMatches().length === 0}
                className="w-full bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 px-6 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Trash2 size={18} />
                Delete All
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteAll}
                  disabled={loading}
                  className="bg-red-600 text-white px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-red-700 transition-all flex items-center gap-1"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={loading}
                  className="bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-gray-300 transition-all"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-sm">
              <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-800 block text-sm">
                  {error.includes("Schema") || error.includes("column") || error.includes("relation") 
                    ? "Database Schema Incompatibility" 
                    : "Extraction or Connection Error"}
                </span>
                <p className="mt-0.5 text-xs text-amber-700 leading-relaxed">
                  {error.includes("Unexpected token '<'") 
                    ? "The backend server is not running on the expected port (or you started the app with 'vite' instead of 'npm run dev'). Please ensure the Express server is running to use extraction features."
                    : error}
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setShowSqlSetup(true)}
              className="px-3 py-1.5 self-start sm:self-center shrink-0 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              type="button"
            >
              <Cpu size={14} /> Update Tables SQL
            </button>
          </div>
        )}

        {success && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg flex items-center gap-2 text-sm">
            <CheckCircle size={16} />
            {success}
          </div>
        )}
      </div>

      {/* Matches List */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <h3 className="font-bold text-gray-700 flex items-center gap-2">
            <Cpu size={18} className={activeTab === 'jackpot' ? 'text-indigo-600' : 'text-amber-600'} />
            Extracted {activeTab === 'jackpot' ? 'Jackpot' : 'Daily'} Matches ({filteredMatches.length}{searchTerm ? ` / ${getActiveMatches().length}` : ''})
          </h3>

          <div className="relative w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search teams, league, tip..."
              className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none w-full md:w-72 transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                <th className="px-4 py-3 border-b border-gray-100">Date/Time</th>
                <th className="px-4 py-3 border-b border-gray-100">Teams</th>
                <th className="px-4 py-3 border-b border-gray-100">Result</th>
                <th className="px-4 py-3 border-b border-gray-100">1X2 Tip</th>
                <th className="px-4 py-3 border-b border-gray-100">1X2 Rating</th>
                <th className="px-4 py-3 border-b border-gray-100">GS (A:B)</th>
                <th className="px-4 py-3 border-b border-gray-100">GA (A:B)</th>
                <th className="px-4 py-3 border-b border-gray-100">L10/Form</th>
                <th className="px-4 py-3 border-b border-gray-100">LE/H2H</th>
                <th className="px-4 py-3 border-b border-gray-100">Market Odds</th>
                <th className="px-4 py-3 border-b border-gray-100 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredMatches.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-gray-400 italic">
                    {searchTerm ? `No matches found matching "${searchTerm}"` : `No ${activeTab} matches extracted yet. Use the controls above to fetch data.`}
                  </td>
                </tr>
              ) : (
                filteredMatches.map((match, idx) => (
                  <tr key={`${match.id}_${idx}`} className={`hover:${activeTab === 'jackpot' ? 'bg-indigo-50/30' : 'bg-amber-50/30'} transition-colors group`}>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">
                      {match.date}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-bold text-gray-800">{match.teams}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold ${match.result && match.result !== 'Pending' ? 'text-emerald-600' : 'text-gray-400 italic'}`}>
                        {formatScore(match.result)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 ${activeTab === 'jackpot' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'} rounded text-[10px] font-bold uppercase`}>
                        {match.pred1x2 || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold uppercase">
                        {match.rating || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-600">
                      {match.gs || '-'}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-600">
                      {match.ga || '-'}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-600 text-center">
                      {renderL10(match.l10 || '-')}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-600 text-center">
                      {match.le || '-'}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-600">
                      {match.mo || '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handlePushMatchToOther(match)}
                          className={`p-1.5 border border-transparent rounded transition-all opacity-0 group-hover:opacity-100 ${
                            activeTab === 'daily' 
                              ? 'text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100' 
                              : 'text-amber-600 hover:bg-amber-50 hover:border-amber-100'
                          }`}
                          title={`Add to ${activeTab === 'daily' ? 'Jackpot' : 'Daily'} Extractions`}
                        >
                          <Target size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteMatch(match.id as string)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete Match"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showSqlSetup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl border border-gray-100 flex flex-col my-8 max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Cpu className="text-amber-600 animate-pulse" size={20} />
                <div>
                  <h3 className="text-base font-bold text-gray-800">Supabase Table Schema Setup & Update</h3>
                  <p className="text-xs text-gray-500">Run this SQL in your Supabase dashboard to support all NerdyTips analytics</p>
                </div>
              </div>
              <button
                onClick={() => setShowSqlSetup(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto flex flex-col gap-5 text-sm text-gray-700">
              {/* Instructions Callout */}
              <div className="p-3.5 bg-indigo-50 border border-indigo-100 text-indigo-900 rounded-xl leading-relaxed text-xs">
                <span className="font-bold text-indigo-950 block mb-1">💡 Step-by-Step Instructions:</span>
                <ol className="list-decimal pl-4 space-y-1 text-indigo-900">
                  <li>Log in to your <strong>Supabase Dashboard</strong> (supabase.com)</li>
                  <li>Select your project, and click on the <strong>SQL Editor</strong> menu on the left sidebar</li>
                  <li>Click <strong>"New query"</strong> to open a blank query canvas</li>
                  <li>Copy either SQL block below, paste it into the editor, and click <strong>"Run"</strong></li>
                  <li>Close this popup, click <strong>"Reload DB"</strong> on this app, and try extracting matches again!</li>
                </ol>
              </div>

              {/* Box 1: Migration (Safe Alteration) */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-800 text-xs uppercase tracking-wider">Option A: Upgrade Existing Tables (Safe - Preserves existing data)</span>
                  <button
                    onClick={() => {
                        navigator.clipboard.writeText(`-- Upgrade existing Nerdy Tips tables to support missing columns
ALTER TABLE IF EXISTS nerdy_matches ADD COLUMN IF NOT EXISTS rating1x2 TEXT;
ALTER TABLE IF EXISTS nerdy_matches ADD COLUMN IF NOT EXISTS gs TEXT;
ALTER TABLE IF EXISTS nerdy_matches ADD COLUMN IF NOT EXISTS ga TEXT;
ALTER TABLE IF EXISTS nerdy_matches ADD COLUMN IF NOT EXISTS l10 TEXT;
ALTER TABLE IF EXISTS nerdy_matches ADD COLUMN IF NOT EXISTS le TEXT;
ALTER TABLE IF EXISTS nerdy_matches ADD COLUMN IF NOT EXISTS mo TEXT;
ALTER TABLE IF EXISTS nerdy_matches ADD COLUMN IF NOT EXISTS pred1x2 TEXT;
ALTER TABLE IF EXISTS nerdy_matches ADD COLUMN IF NOT EXISTS data JSONB;

ALTER TABLE IF EXISTS nerdy_jackpot_matches ADD COLUMN IF NOT EXISTS rating1x2 TEXT;
ALTER TABLE IF EXISTS nerdy_jackpot_matches ADD COLUMN IF NOT EXISTS gs TEXT;
ALTER TABLE IF EXISTS nerdy_jackpot_matches ADD COLUMN IF NOT EXISTS ga TEXT;
ALTER TABLE IF EXISTS nerdy_jackpot_matches ADD COLUMN IF NOT EXISTS l10 TEXT;
ALTER TABLE IF EXISTS nerdy_jackpot_matches ADD COLUMN IF NOT EXISTS le TEXT;
ALTER TABLE IF EXISTS nerdy_jackpot_matches ADD COLUMN IF NOT EXISTS mo TEXT;
ALTER TABLE IF EXISTS nerdy_jackpot_matches ADD COLUMN IF NOT EXISTS pred1x2 TEXT;
ALTER TABLE IF EXISTS nerdy_jackpot_matches ADD COLUMN IF NOT EXISTS data JSONB;`);
                      alert("Option A: Table upgrade columns copied to clipboard!");
                    }}
                    className="flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-800 bg-amber-50 border border-amber-100 px-2.5 py-1.5 rounded-lg font-semibold transition-colors shadow-2xs"
                    type="button"
                  >
                    <Copy size={12} /> Copy Upgrade SQL
                  </button>
                </div>
                <div className="relative">
                  <pre className="p-3 bg-gray-950 text-amber-300 text-xs font-mono rounded-lg overflow-x-auto max-h-[170px] leading-relaxed border border-gray-800">
{`-- Upgrade existing Nerdy Tips tables to support missing columns
ALTER TABLE IF EXISTS nerdy_matches ADD COLUMN IF NOT EXISTS rating1x2 TEXT;
ALTER TABLE IF EXISTS nerdy_matches ADD COLUMN IF NOT EXISTS gs TEXT;
ALTER TABLE IF EXISTS nerdy_matches ADD COLUMN IF NOT EXISTS ga TEXT;
ALTER TABLE IF EXISTS nerdy_matches ADD COLUMN IF NOT EXISTS l10 TEXT;
ALTER TABLE IF EXISTS nerdy_matches ADD COLUMN IF NOT EXISTS le TEXT;
ALTER TABLE IF EXISTS nerdy_matches ADD COLUMN IF NOT EXISTS mo TEXT;
ALTER TABLE IF EXISTS nerdy_matches ADD COLUMN IF NOT EXISTS pred1x2 TEXT;
ALTER TABLE IF EXISTS nerdy_matches ADD COLUMN IF NOT EXISTS data JSONB;

ALTER TABLE IF EXISTS nerdy_jackpot_matches ADD COLUMN IF NOT EXISTS rating1x2 TEXT;
ALTER TABLE IF EXISTS nerdy_jackpot_matches ADD COLUMN IF NOT EXISTS gs TEXT;
ALTER TABLE IF EXISTS nerdy_jackpot_matches ADD COLUMN IF NOT EXISTS ga TEXT;
ALTER TABLE IF EXISTS nerdy_jackpot_matches ADD COLUMN IF NOT EXISTS l10 TEXT;
ALTER TABLE IF EXISTS nerdy_jackpot_matches ADD COLUMN IF NOT EXISTS le TEXT;
ALTER TABLE IF EXISTS nerdy_jackpot_matches ADD COLUMN IF NOT EXISTS mo TEXT;
ALTER TABLE IF EXISTS nerdy_jackpot_matches ADD COLUMN IF NOT EXISTS pred1x2 TEXT;
ALTER TABLE IF EXISTS nerdy_jackpot_matches ADD COLUMN IF NOT EXISTS data JSONB;`}
                  </pre>
                </div>
              </div>

              {/* Box 2: Create brand new tables if needed */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center bg-transparent">
                  <span className="font-semibold text-gray-800 text-xs uppercase tracking-wider">Option B: Clean Create Tables (Run if tables don't exist yet)</span>
                  <button
                    onClick={() => {
                        navigator.clipboard.writeText(`-- 1. Create Tables for Nerdy Tips
CREATE TABLE IF NOT EXISTS nerdy_matches (
    id TEXT PRIMARY KEY,
    teams TEXT,
    date TEXT,
    analysis TEXT,
    percentage TEXT,
    stars TEXT,
    tip TEXT,
    odds TEXT,
    result TEXT,
    jackpot_ids TEXT[],
    rating1x2 TEXT,
    gs TEXT,
    ga TEXT,
    l10 TEXT,
    le TEXT,
    mo TEXT,
    pred1x2 TEXT,
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS nerdy_jackpot_matches (
    id TEXT PRIMARY KEY,
    teams TEXT,
    date TEXT,
    analysis TEXT,
    percentage TEXT,
    stars TEXT,
    tip TEXT,
    odds TEXT,
    result TEXT,
    jackpot_ids TEXT[],
    rating1x2 TEXT,
    gs TEXT,
    ga TEXT,
    l10 TEXT,
    le TEXT,
    mo TEXT,
    pred1x2 TEXT,
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_uploaded_matches (
    id TEXT PRIMARY KEY,
    teams TEXT,
    result TEXT,
    date TEXT,
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS live_matches (
    id TEXT PRIMARY KEY,
    teams TEXT,
    result TEXT,
    date TEXT,
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Indexes for rapid queries and filters
CREATE INDEX IF NOT EXISTS idx_nerdy_matches_date ON nerdy_matches(date DESC);
CREATE INDEX IF NOT EXISTS idx_nerdy_jackpot_matches_date ON nerdy_jackpot_matches(date DESC);
CREATE INDEX IF NOT EXISTS idx_user_uploaded_matches_date ON user_uploaded_matches(date DESC);
CREATE INDEX IF NOT EXISTS idx_live_matches_date ON live_matches(date DESC);

-- 3. Disable Row Level Security (RLS) & Grant Full Permissions
ALTER TABLE IF EXISTS nerdy_matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS nerdy_jackpot_matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_uploaded_matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS live_matches DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE nerdy_matches TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE nerdy_jackpot_matches TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE user_uploaded_matches TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE live_matches TO anon, authenticated, postgres, service_role;`);
                        alert("Option B: Brand new table creation scripts copied to clipboard!");
                    }}
                    className="flex items-center gap-1.5 text-xs text-indigo-700 hover:text-indigo-800 bg-indigo-50 border border-indigo-100 px-2.5 py-1.5 rounded-lg font-semibold transition-colors shadow-2xs"
                    type="button"
                  >
                    <Copy size={12} /> Copy Fresh Table SQL
                  </button>
                </div>
                <div className="relative">
                  <pre className="p-3 bg-gray-950 text-indigo-300 text-xs font-mono rounded-lg overflow-x-auto max-h-[170px] leading-relaxed border border-gray-800">
{`-- Create Tables for Nerdy Tips
CREATE TABLE IF NOT EXISTS nerdy_matches (
    id TEXT PRIMARY KEY,
    teams TEXT,
    date TEXT,
    analysis TEXT,
    percentage TEXT,
    stars TEXT,
    tip TEXT,
    odds TEXT,
    result TEXT,
    jackpot_ids TEXT[],
    rating1x2 TEXT,
    gs TEXT, ga TEXT, l10 TEXT, le TEXT, mo TEXT, pred1x2 TEXT,
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS nerdy_jackpot_matches (
    id TEXT PRIMARY KEY,
    teams TEXT,
    date TEXT,
    analysis TEXT,
    percentage TEXT,
    stars TEXT,
    tip TEXT,
    odds TEXT,
    result TEXT,
    jackpot_ids TEXT[],
    rating1x2 TEXT,
    gs TEXT, ga TEXT, l10 TEXT, le TEXT, mo TEXT, pred1x2 TEXT,
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_uploaded_matches ( ... );
CREATE TABLE IF NOT EXISTS live_matches ( ... );

-- Click copy to include indices, parameters and permission grants!`}
                  </pre>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50/50 rounded-b-2xl">
              <button
                onClick={() => setShowSqlSetup(false)}
                className="bg-gray-800 hover:bg-gray-900 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-all"
                type="button"
              >
                Close SQL Helper
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NerdyTips;