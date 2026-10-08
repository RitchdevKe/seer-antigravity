import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ML_BASE_PATTERNS_DESCRIPTIONS } from '../utils/mlFeatureExtractor';

interface MLMatrixContextType {
    mlData: any;
    isLoading: boolean;
    refreshMatrixData: () => Promise<void>;
}

const MLMatrixContext = createContext<MLMatrixContextType | undefined>(undefined);

export const useMLMatrix = () => {
    const context = useContext(MLMatrixContext);
    if (context === undefined) {
        throw new Error('useMLMatrix must be used within an MLMatrixProvider');
    }
    return context;
};

interface MLMatrixProviderProps {
    children: ReactNode;
}

export const MLMatrixProvider: React.FC<MLMatrixProviderProps> = ({ children }) => {
    const [mlData, setMlData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const fetchMatrixData = useCallback(async () => {
        try {
            const [baseSubRes, combosRes] = await Promise.all([
                supabase.from('ml_matrix_data').select('*').in('matrix_type', ['basePatterns', 'subPatterns']).limit(1000),
                supabase.from('ml_matrix_data').select('*').eq('matrix_type', 'combos').order('total_matches', { ascending: false }).limit(1000)
            ]);
                
            if (baseSubRes.error) throw baseSubRes.error;
            
            // Transform flat DB rows back into the nested object structure expected by the UI
            const model: any = { basePatterns: {}, subPatterns: {}, combos: {} };
            
            // Ensure all 51 base patterns are always displayed even if they have 0 matches in the DB
            Object.keys(ML_BASE_PATTERNS_DESCRIPTIONS).forEach(key => {
                model.basePatterns[key] = {
                    total: 0, fav: 0, draw: 0, und: 0,
                    favPct: 0, drawPct: 0, undPct: 0
                };
            });
            
            const allData = [...(baseSubRes.data || []), ...(combosRes.data || [])];
            allData.forEach(row => {
                if (!model[row.matrix_type]) return;
                
                const total = row.total_matches;
                // Calculate percentages on the fly
                model[row.matrix_type][row.item_key] = {
                    total,
                    fav: row.fav_wins,
                    draw: row.draws,
                    und: row.und_wins,
                    favPct: total > 0 ? (row.fav_wins / total) * 100 : 0,
                    drawPct: total > 0 ? (row.draws / total) * 100 : 0,
                    undPct: total > 0 ? (row.und_wins / total) * 100 : 0
                };
            });
            
            setMlData(model);
        } catch (err) {
            console.error("Failed to load ml_matrix_data from Supabase:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        // Initial load
        fetchMatrixData();

        // Optional: Real-time subscription to automatically fetch on DB updates
        const subscription = supabase
            .channel('ml_matrix_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'ml_matrix_data'
                },
                () => {
                    console.log("Realtime: ml_matrix_data changed, refreshing...");
                    fetchMatrixData();
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [fetchMatrixData]);

    return (
        <MLMatrixContext.Provider value={{ mlData, isLoading, refreshMatrixData: fetchMatrixData }}>
            {children}
        </MLMatrixContext.Provider>
    );
};
