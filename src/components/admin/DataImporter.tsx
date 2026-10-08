import React, { useState } from 'react';
import { savePrecalculatedMatches, loadEmbeddedMatches, clearAllMatches, loadPrecalculatedMatches } from '../../services/supabaseMatches';
import { Match } from '../../types';
import { processMatch, getActualResult, matchesPrediction, getFavoriteAndUnderdog, calculatePAAPrediction, calculatePHAPrediction } from '../../utils/matchProcessing';
import { predictSeerDetailed, DEFAULT_WEIGHTS } from '../../utils/seerLogic';
import { useMatchStars } from '../../utils/matchStars';
import { useMLMatrix } from '../../context/MLMatrixContext';
import { getMatchEvaluatorTags } from '../../utils/matchEvaluator';
import { createMatchesZipBlob, extractMatchesFromZip } from '../../utils/zipExportImport';
import { loadUploadedMatchesFromSupabase, deleteUploadedMatchesFromSupabaseBulk } from '../../services/supabaseUploadedMatches';
import { getStableMatchId } from '../../utils/matchId';
import { Upload, AlertCircle, CheckCircle2, Loader2, Database, Zap, Trash2, Cpu, Download, FileArchive } from 'lucide-react';

export function DataImporter() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  
  const matchStars = useMatchStars();
  const { mlData } = useMLMatrix();

  const handleDeleteDuplicates = async () => {
    if (loading) return;
    setLoading(true);
    setStatus({ type: 'info', message: 'Scanning database tables to remove duplicate matches (same teams & stats, removing recent date copies)...' });

    try {
      const res = await fetch('/api/database/delete-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to delete duplicate matches.');
      }

      setStatus({
        type: 'success',
        message: `Duplicate cleanup complete! Deleted ${data.totalDeletedOverall || 0} duplicate match copies from the database.`
      });
    } catch (err: any) {
      console.error("Delete duplicates error:", err);
      setStatus({ type: 'error', message: err.message || 'Failed to clean up duplicate matches.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadZip = async () => {
    if (loading) return;
    setLoading(true);
    setStatus({ type: 'info', message: 'Fetching all matches from Supabase for Zip export...' });

    try {
      const matches = await loadPrecalculatedMatches(true);
      if (!matches || matches.length === 0) {
        throw new Error("No matches found in Supabase database.");
      }

      setStatus({ type: 'info', message: `Building Zip archive for ${matches.length} matches...` });
      const zipBlob = await createMatchesZipBlob(matches);

      // Trigger file download
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nerdytips_supabase_matches_${matches.length}_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus({ type: 'success', message: `Successfully downloaded ${matches.length} matches in ZIP archive!` });
    } catch (err: any) {
      console.error("Zip export error:", err);
      setStatus({ type: 'error', message: err.message || 'Failed to export matches to Zip.' });
    } finally {
      setLoading(false);
    }
  };

  const handleBakeMatches = async () => {
    if (loading) return;

    setLoading(true);
    setStatus({ type: 'info', message: 'Fetching matches from Supabase (Precalculated & Uploaded)...' });

    try {
      // 1. Fetch all matches
      const precalculated = await loadPrecalculatedMatches(true);
      
      let uploaded: Match[] = [];
      try {
        uploaded = await loadUploadedMatchesFromSupabase();
      } catch (e) {
        console.warn("Could not load uploaded matches", e);
      }

      // Merge and deduplicate
      const matchesMap = new Map<string, Match>();
      precalculated.forEach(m => matchesMap.set(getStableMatchId(m), m));
      uploaded.forEach(m => matchesMap.set(getStableMatchId(m), m));
      const matches = Array.from(matchesMap.values());

      if (matches.length === 0) {
        throw new Error("No matches found in Supabase.");
      }

      setStatus({ type: 'info', message: `Processing ${matches.length} matches (Algo/Base)...` });
      
      // 2. Process all matches to calculate patterns and algoReport
      // We must disable isPrecalculated so processMatch actually runs.
      const processedMatches = matches.map(m => processMatch({ ...m, isPrecalculated: false }, mlData));

      setStatus({ type: 'info', message: 'Building Historical Stats (PHA)...' });

      // 3. Build phaStatsMap
      const phaStatsMap: Record<string, any> = {};
      processedMatches.forEach(m => {
          const sub = m.patternAnalysis?.subPattern;
          if (sub) {
              if (!phaStatsMap[sub]) phaStatsMap[sub] = { total: 0, paaTotal: 0, correct: 0, outcomes: { '1': 0, 'X': 0, '2': 0 }, favWin: 0, draw: 0, upsetWin: 0 };
              const actual = getActualResult(m.result);
              if (actual !== 'pending') {
                  phaStatsMap[sub].total++;
                  const pred = m.finalPrediction || m.rawPrediction || '1';
                  if (matchesPrediction(pred, actual)) phaStatsMap[sub].correct++;
                  if (actual === '1' || actual === 'X' || actual === '2') phaStatsMap[sub].outcomes[actual]++;
                  
                  const favInfo = getFavoriteAndUnderdog(m);
                  if (favInfo) {
                    const { fav: moFav, underdog: moUnderdog } = favInfo;
                    phaStatsMap[sub].paaTotal++;
                    if (actual === moFav) phaStatsMap[sub].favWin++;
                    else if (actual === 'X') phaStatsMap[sub].draw++;
                    else if (actual === moUnderdog) phaStatsMap[sub].upsetWin++;
                  }
              }
          }
      });

      setStatus({ type: 'info', message: `Calculating SEER & PAA predictions...` });

      // 4. Calculate PAA & SEER
      const fullyProcessed = processedMatches.map(m => {
          let updated = { ...m };
          
          if (updated.patternAnalysis?.subPattern) {
              const sub = updated.patternAnalysis.subPattern;
              if (phaStatsMap[sub] && phaStatsMap[sub].total > 0) {
                  const stats = phaStatsMap[sub];
                  const paaPred = calculatePAAPrediction(updated, stats);
                  if (paaPred) {
                     updated.paaPrimaryPrediction = paaPred.paaPrimaryPrediction;
                     updated.paaPrediction = paaPred.paaPrediction;
                  }
                  
                  // Override hardcoded rule with dynamic 1X2 prediction using PHA
                  const phaPred = calculatePHAPrediction(stats);
                  if (phaPred && updated.patternAnalysis) {
                      updated.patternAnalysis.subPatternPrediction = phaPred.phaPrediction;
                      updated.patternAnalysis.primaryPrediction = phaPred.phaPrimaryPrediction;
                      updated.rawPrediction = phaPred.phaPrimaryPrediction;
                      updated.finalPrediction = phaPred.phaPrediction;
                  }
              }
          }

          const seerResult = predictSeerDetailed(updated, DEFAULT_WEIGHTS, phaStatsMap, matchStars);
          updated.seerPrimaryPrediction = seerResult.primary;
          updated.seerPrediction = seerResult.final;
          updated.seerPercentages = seerResult.percentages;
          updated.seerScores = seerResult.scores;
          
          updated.evaluatorTags = getMatchEvaluatorTags(updated, phaStatsMap, false, true, matchStars);
          
          // Mark as precalculated so the client doesn't re-run this
          updated.isPrecalculated = true;

          return updated;
      });

      setStatus({ type: 'info', message: `Uploading ${fullyProcessed.length} baked matches to Supabase...` });

      // 5. Upload back to Supabase
      await savePrecalculatedMatches(fullyProcessed);

      setStatus({ type: 'success', message: `Successfully baked and synced ${fullyProcessed.length} matches to Supabase!` });
    } catch (err: any) {
      console.error("Bake error:", err);
      setStatus({ type: 'error', message: err.message || 'Failed to bake matches' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteZeroGoals = async () => {
    if (loading) return;

    if (!confirm("Are you sure you want to delete all matches with GA (A:B) and GS (A:B) as 0:0?")) {
      return;
    }

    setLoading(true);
    setStatus({ type: 'info', message: 'Fetching matches to find 0:0 games...' });

    try {
      const precalculated = await loadPrecalculatedMatches(true);
      
      let uploaded: Match[] = [];
      try {
        uploaded = await loadUploadedMatchesFromSupabase();
      } catch (e) {
        console.warn("Could not load uploaded matches", e);
      }

      const matchesMap = new Map<string, Match>();
      precalculated.forEach(m => matchesMap.set(getStableMatchId(m), m));
      uploaded.forEach(m => matchesMap.set(getStableMatchId(m), m));
      const allMatches = Array.from(matchesMap.values());

      const toDelete = allMatches.filter(m => m.gs === '0:0' && m.ga === '0:0');

      if (toDelete.length === 0) {
         setStatus({ type: 'success', message: 'No matches found with GS 0:0 and GA 0:0.' });
         setLoading(false);
         return;
      }

      setStatus({ type: 'info', message: `Found ${toDelete.length} matches to delete. Deleting from Supabase...` });

      const idsToDelete = toDelete.map(m => getStableMatchId(m));
      
      // Delete from uploaded matches
      await deleteUploadedMatchesFromSupabaseBulk(idsToDelete);

      // Now we also need to delete from precalculated tables
      // For that, we need a helper in supabaseMatches, let's just use the Supabase client here directly for simplicity,
      // or we can import supabase from '../../lib/supabase' if it's available here.
      // We will do it in a helper or directly if we import it.
      
      // We need to write a delete function in supabaseMatches.ts and use it here.
      const { deletePrecalculatedMatchesFromSupabaseBulk } = await import('../../services/supabaseMatches');
      await deletePrecalculatedMatchesFromSupabaseBulk(idsToDelete);

      setStatus({ type: 'success', message: `Successfully deleted ${toDelete.length} matches with 0:0 goals!` });
    } catch (err: any) {
      console.error("Delete error:", err);
      setStatus({ type: 'error', message: err.message || 'Failed to delete matches' });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncEmbedded = async () => {
    if (loading) return;
    
    setLoading(true);
    setStatus({ type: 'info', message: 'Fetching embedded matches...' });

    try {
      const embeddedMatches = await loadEmbeddedMatches();
      if (embeddedMatches.length === 0) {
        throw new Error("No matches found in embedded_matches.json");
      }

      setStatus({ type: 'info', message: `Processing ${embeddedMatches.length} matches...` });
      
      // Batch upload starts
      await savePrecalculatedMatches(embeddedMatches);
      
      setStatus({ type: 'success', message: `Successfully synced ${embeddedMatches.length} matches to Supabase!` });
    } catch (err: any) {
      console.error("Sync error:", err);
      setStatus({ type: 'error', message: err.message || 'Failed to sync embedded matches' });
    } finally {
      setLoading(false);
    }
  };

  const handleClearDatabase = async () => {
    if (loading) return;

    setLoading(true);
    setStatus({ type: 'info', message: 'Wiping database and local cache...' });

    try {
      await clearAllMatches();
      setStatus({ type: 'success', message: 'Database and local cache cleared successfully! You can now re-sync the embedded resource.' });
    } catch (err: any) {
      console.error("Clear error:", err);
      setStatus({ type: 'error', message: err.message || 'Failed to clear database' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatus({ type: 'info', message: 'Reading file...' });

    try {
      const reader = new FileReader();
      
      if (file.name.endsWith('.zip')) {
        reader.onload = async (e) => {
          try {
            const buffer = e.target?.result as ArrayBuffer;
            setStatus({ type: 'info', message: 'Extracting matches from ZIP archive...' });

            const extractedMatches = await extractMatchesFromZip(buffer);
            if (!extractedMatches || extractedMatches.length === 0) {
              throw new Error("No valid match files (.xlsx, .csv, .json) found inside the ZIP archive.");
            }

            setStatus({ type: 'info', message: `Uploading ${extractedMatches.length} matches extracted from ZIP to Supabase...` });
            await savePrecalculatedMatches(extractedMatches);
            setStatus({ type: 'success', message: `Successfully imported ${extractedMatches.length} matches from ZIP archive to Supabase!` });
          } catch (err: any) {
            console.error("ZIP Upload error:", err);
            setStatus({ type: 'error', message: err.message || 'Failed to process ZIP file' });
          } finally {
            setLoading(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (file.name.endsWith('.json')) {
        reader.onload = async (e) => {
          try {
            const text = e.target?.result as string;
            setStatus({ type: 'info', message: 'Parsing JSON... This might take a moment for large files.' });
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const rawMatches = JSON.parse(text);
            const matchesArray = Array.isArray(rawMatches) ? rawMatches : (rawMatches.matches || []);
            
            if (!Array.isArray(matchesArray) || matchesArray.length === 0) {
              throw new Error("Invalid format. Expected an array of matches.");
            }

            setStatus({ type: 'info', message: `Uploading ${matchesArray.length} matches to Supabase...` });
            await savePrecalculatedMatches(matchesArray);
            setStatus({ type: 'success', message: 'Successfully imported matches permanently to Supabase!' });
          } catch (err: any) {
            console.error("Parse/Upload error:", err);
            setStatus({ type: 'error', message: err.message || 'Failed to process file' });
          } finally {
            setLoading(false);
          }
        };
        reader.readAsText(file);
      } else if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx')) {
        const { read, utils } = await import('xlsx');
        
        reader.onload = async (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            setStatus({ type: 'info', message: 'Parsing spreadsheet data...' });
            
            const workbook = read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

            if (!jsonData || jsonData.length === 0) {
              throw new Error("The file is empty.");
            }

            // Map CSV/XLSX columns to Match objects
            // Assuming the structure from the preview: ID, Teams, Result, Pred, Rating, GS, GA, L10, LE, MO...
            let matches: Match[] = jsonData.map((row, index) => {
              if (row.length < 2) return null;
              
              // Skip header if it looks like one (contains "Teams" or "Result")
              if (index === 0 && String(row[1]).toLowerCase().includes('team')) return null;

              const providedId = String(row[0] || '').trim();
              const hasValidId = providedId !== '';
              const id = hasValidId ? providedId : `csv-${Date.now()}-${Math.floor(Math.random() * 10000)}-${index}`;

              const mMatch = {
                id,
                teams: String(row[1] || ''),
                result: String(row[2] || ''),
                pred1x2: String(row[3] || ''),
                rating: String(row[4] || ''),
                gs: String(row[5] || ''),
                ga: String(row[6] || ''),
                l10: String(row[7] || ''),
                le: String(row[8] || ''),
                mo: String(row[9] || ''),
                date: String(row[10] || new Date().toISOString().split('T')[0]),
                isPrecalculated: true
              } as Match;

              return processMatch(mMatch, mlData);
            }).filter(m => m !== null) as Match[];

            if (matches.length === 0) {
              throw new Error("No valid match rows found in the file.");
            }

            setStatus({ type: 'info', message: `Uploading ${matches.length} matches from ${file.name} to Supabase...` });
            await savePrecalculatedMatches(matches);
            setStatus({ type: 'success', message: `Successfully imported ${matches.length} matches from ${file.name}!` });
          } catch (err: any) {
            console.error("Spreadsheet Parse/Upload error:", err);
            setStatus({ type: 'error', message: err.message || 'Failed to process spreadsheet file' });
          } finally {
            setLoading(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        throw new Error("Unsupported file type. Please upload .json, .csv, or .xlsx");
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Unknown error occurred' });
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl max-w-2xl mx-auto mt-8">
      <div className="flex items-center gap-3 mb-6">
        <Database className="w-6 h-6 text-indigo-400" />
        <h2 className="text-xl font-semibold text-white">Database Importer</h2>
      </div>

      <div className="space-y-6">
        <div className="bg-slate-700/30 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-white font-medium flex items-center gap-2">
              <FileArchive className="w-4 h-4 text-amber-400" />
              Download All Matches (ZIP)
            </h3>
            <p className="text-slate-400 text-xs text-balance">
              Export all 12,000+ matches from Supabase as a ZIP file containing NerdyTips formatted Excel, CSV, and JSON backup.
            </p>
          </div>
          <button
            onClick={handleDownloadZip}
            disabled={loading}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all shadow-lg flex items-center gap-2 whitespace-nowrap"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            Download Zip
          </button>
        </div>

        <div className="bg-slate-700/30 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-white font-medium flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              Bake Predictions
            </h3>
            <p className="text-slate-400 text-xs text-balance">
              Process all Supabase matches through Algo & SEER, then save the precalculated results permanently. Fixes unresponsive UI and accuracy issues.
            </p>
          </div>
          <button
            onClick={handleBakeMatches}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all shadow-lg flex items-center gap-2 whitespace-nowrap"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Cpu className="w-3 h-3" />}
            Bake All
          </button>
        </div>

        <div className="bg-slate-700/30 border border-red-500/20 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-white font-medium flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-red-400" />
              Delete 0:0 Goals
            </h3>
            <p className="text-slate-400 text-xs text-balance">
              Remove all matches where GS (A:B) and GA (A:B) are both "0:0".
            </p>
          </div>
          <button
            onClick={handleDeleteZeroGoals}
            disabled={loading}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all shadow-lg flex items-center gap-2 whitespace-nowrap"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Delete
          </button>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-amber-400 font-medium flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-amber-400" />
              Delete Duplicate Matches
            </h3>
            <p className="text-slate-400 text-xs">
              Deletes duplicate matches with identical teams and data stats, removing the recent-date duplicate copy and preserving the original record.
            </p>
          </div>
          <button
            onClick={handleDeleteDuplicates}
            disabled={loading}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold rounded-lg transition-all shadow-lg flex items-center gap-2 whitespace-nowrap"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Delete Duplicates
          </button>
        </div>

        <div className="bg-slate-700/30 border border-indigo-500/20 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-white font-medium flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              Sync Embedded Resource
            </h3>
            <p className="text-slate-400 text-xs">
              Directly upload 19,000+ matches from `embedded_matches.json` to Supabase.
            </p>
          </div>
          <button
            onClick={handleSyncEmbedded}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all shadow-lg flex items-center gap-2 whitespace-nowrap"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            Sync Now
          </button>
        </div>

        <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-red-400 font-medium flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Clear All Data
            </h3>
            <p className="text-slate-500 text-xs text-balance">
              Wipe all matches from Supabase and local cache for a fresh start.
            </p>
          </div>
          <button
            onClick={handleClearDatabase}
            disabled={loading}
            className="px-4 py-2 bg-red-600/10 hover:bg-red-600/20 border border-red-600/30 text-red-400 text-xs font-bold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Wipe Cache
          </button>
        </div>

        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-slate-700"></div>
          <span className="flex-shrink mx-4 text-slate-500 text-[10px] font-bold uppercase tracking-widest">Or Upload File</span>
          <div className="flex-grow border-t border-slate-700"></div>
        </div>

        <p className="text-slate-400 text-sm">
          Upload your JSON, CSV or Excel file containing matches. The system will securely process the file locally in your browser and sync the matches permanently to your Supabase PostgreSQL database.
        </p>

        <label className="relative flex flex-col items-center justify-center w-full h-48 border-2 border-slate-600 border-dashed rounded-lg cursor-pointer bg-slate-700/50 hover:bg-slate-700 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            {loading ? (
              <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-3" />
            ) : (
              <Upload className="w-10 h-10 text-slate-400 mb-3" />
            )}
            <p className="mb-2 text-sm text-slate-300">
              <span className="font-semibold">{loading ? 'Processing...' : 'Click to select Match file'}</span>
            </p>
            <p className="text-xs text-slate-500 text-center px-4">Supports ZIP archives (.zip), JSON Arrays, CSV (No header), or Excel files (.xlsx)</p>
          </div>
          <input 
            type="file" 
            className="hidden" 
            accept=".zip,.json,.csv,.xlsx" 
            onChange={handleFileUpload}
            disabled={loading}
          />
        </label>

        {status && (
          <div className={`p-4 rounded-lg flex items-start gap-3 ${
            status.type === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-400' :
            status.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' :
            'bg-blue-500/10 border border-blue-500/20 text-blue-400'
          }`}>
            {status.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /> : 
             status.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : 
             <Loader2 className="w-5 h-5 shrink-0 animate-spin mt-0.5" />}
            <span className="text-sm font-medium">{status.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}

