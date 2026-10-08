import { supabase } from '../lib/supabase';
import { Match } from '../types';
import { extractMLFeatures, generateSITags } from '../utils/mlFeatureExtractor';
import { getActualResult, processMatch } from '../utils/matchProcessing';

/**
 * Updates the Supabase ML Matrix Data for any new, completed matches.
 * Automatically de-duplicates to ensure a match is only counted once.
 */
export const updateMLMatrixFromMatches = async (matches: Match[]): Promise<boolean> => {
    try {
        if (!matches || matches.length === 0) return true;

        // 1. Filter for valid matches with a final result
        const completedMatches = matches.filter(m => {
            const res = getActualResult(m.result || '');
            return res && res !== 'pending';
        });

        if (completedMatches.length === 0) return true;

        // 2. Filter out matches that have already been processed for the ML Matrix
        const matchIds = completedMatches.map(m => String(m.id));
        
        // Fetch already processed IDs
        const CHUNK_SIZE = 500;
        const alreadyProcessedIds = new Set<string>();
        
        for (let i = 0; i < matchIds.length; i += CHUNK_SIZE) {
            const chunk = matchIds.slice(i, i + CHUNK_SIZE);
            const { data, error } = await supabase
                .from('ml_matrix_processed_matches')
                .select('match_id')
                .in('match_id', chunk);
                
            if (error) {
                console.error("Failed to check processed matches for ML matrix", error);
                return false;
            }
            if (data) {
                data.forEach(row => alreadyProcessedIds.add(row.match_id));
            }
        }

        const newMatchesToProcess = completedMatches.filter(m => !alreadyProcessedIds.has(String(m.id)));
        if (newMatchesToProcess.length === 0) return true;

        // 3. Aggregate stats
        const matrix: Record<string, any> = {};

        newMatchesToProcess.forEach(rawMatch => {
            const cleanM = JSON.parse(JSON.stringify(rawMatch));
            delete cleanM.isPrecalculated;
            const processed = processMatch(cleanM);

            const features = extractMLFeatures(processed);
            if (!features) return;

            const isFavHome = features.favIndex === 0;
            const actualResult = getActualResult(processed.result || '');
            
            let outcome: 'fav' | 'draw' | 'und';
            if (actualResult === 'X') outcome = 'draw';
            else if ((actualResult === '1' && isFavHome) || (actualResult === '2' && !isFavHome)) outcome = 'fav';
            else outcome = 'und';

            const tags = generateSITags(features);
            if (!tags || tags.length === 0) return;

            const updateKey = (type: string, key: string) => {
                const id = `${type}_${key}`;
                if (!matrix[id]) {
                    matrix[id] = { matrix_type: type, item_key: key, total_matches: 0, fav_wins: 0, draws: 0, und_wins: 0 };
                }
                matrix[id].total_matches++;
                if (outcome === 'fav') matrix[id].fav_wins++;
                if (outcome === 'draw') matrix[id].draws++;
                if (outcome === 'und') matrix[id].und_wins++;
            };

            tags.forEach(tag => {
                if (/^[a-zA-Z]+$/.test(tag)) updateKey('basePatterns', tag);
                else updateKey('subPatterns', tag);
            });

            const comboKey = [...tags].sort().join('+');
            updateKey('combos', comboKey);
        });

        const rowsToUpdate = Object.values(matrix);
        if (rowsToUpdate.length === 0) return true;

        // 4. Update the actual matrix data in DB
        // Since we need to *increment* existing rows, and Supabase doesn't have a native upsert-increment via the JS client easily without RPC,
        // we first fetch existing values, add ours, and then upsert.
        // Wait, fetching could be slow if there are thousands of keys. Let's do it in chunks.
        const allKeys = rowsToUpdate.map(r => r.item_key);
        const existingDataMap = new Map<string, any>();
        
        for (let i = 0; i < allKeys.length; i += CHUNK_SIZE) {
            const chunk = allKeys.slice(i, i + CHUNK_SIZE);
            const { data, error } = await supabase
                .from('ml_matrix_data')
                .select('*')
                .in('item_key', chunk);
                
            if (error) {
                console.error("Failed to fetch existing ML matrix data", error);
                continue;
            }
            if (data) {
                data.forEach(row => existingDataMap.set(`${row.matrix_type}_${row.item_key}`, row));
            }
        }

        // Merge existing and new
        const finalRows = rowsToUpdate.map(newRow => {
            const id = `${newRow.matrix_type}_${newRow.item_key}`;
            const existing = existingDataMap.get(id);
            if (existing) {
                return {
                    ...newRow,
                    total_matches: existing.total_matches + newRow.total_matches,
                    fav_wins: existing.fav_wins + newRow.fav_wins,
                    draws: existing.draws + newRow.draws,
                    und_wins: existing.und_wins + newRow.und_wins,
                    last_updated: new Date().toISOString()
                };
            }
            return newRow;
        });

        // Upsert final rows
        for (let i = 0; i < finalRows.length; i += CHUNK_SIZE) {
            const chunk = finalRows.slice(i, i + CHUNK_SIZE);
            const { error } = await supabase
                .from('ml_matrix_data')
                .upsert(chunk, { onConflict: 'matrix_type,item_key' });
            if (error) {
                console.error("Error upserting ML matrix chunk", error);
                return false;
            }
        }

        // 5. Mark as processed
        const bookkeepingRows = newMatchesToProcess.map(m => ({ match_id: String(m.id) }));
        for (let i = 0; i < bookkeepingRows.length; i += CHUNK_SIZE) {
            const chunk = bookkeepingRows.slice(i, i + CHUNK_SIZE);
            const { error } = await supabase
                .from('ml_matrix_processed_matches')
                .upsert(chunk, { onConflict: 'match_id' });
            if (error) {
                console.error("Error updating ML matrix bookkeeping", error);
            }
        }

        console.log(`Successfully updated ML Matrix with ${newMatchesToProcess.length} new matches.`);
        return true;
    } catch (error) {
        console.error("Error in updateMLMatrixFromMatches:", error);
        return false;
    }
};
