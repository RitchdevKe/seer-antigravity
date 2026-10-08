import React, { useState, useEffect } from 'react';
import { BrainCircuit, Loader2, Save, PlayCircle, RefreshCw, FileText } from 'lucide-react';
import { executeGeminiAnalysis, AIResponse } from './GeminiEngine';
import { Match } from '../../types';
import * as Storage from '../../services/storage';

interface SystemArchitectureProps {
    trainingSet: Match[];
    fullHistory?: Match[];
}

export const SystemArchitecture: React.FC<SystemArchitectureProps> = ({ trainingSet, fullHistory }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<AIResponse | null>(() => Storage.getCurrentAnalysis('system_architecture'));

    const handleRunAnalysis = async () => {
        setLoading(true);
        setError(null);
        try {
            const dataset = fullHistory && fullHistory.length > 0 ? fullHistory : trainingSet;
            
            // Get previous rebuilds to build upon them
            const history = Storage.getAIHistory();
            const previousRebuilds = history.filter(h => h.mode === 'system_architecture');
            
            let rebuildHistoryText = "";
            if (previousRebuilds.length > 0) {
                rebuildHistoryText = `\n**PREVIOUS SYSTEM REBUILD ITERATIONS:**\n`;
                previousRebuilds.slice(0, 3).forEach((h, i) => {
                    rebuildHistoryText += `\n--- Iteration ${i + 1} (${new Date(h.date).toLocaleDateString()}) ---\n`;
                    const analysisText = h.data?.detailed_analysis || "No detailed analysis available.";
                    rebuildHistoryText += analysisText.substring(0, 1500) + "...\n";
                });
            }

            const systemInstruction = `
            You are the **Lead AI Algorithm Engineer (Gemini 3.1 Pro Agentic)**.
            
            **STRATEGY: SYSTEM REBUILD & MASTER PLAN**
            You are tasked with rebuilding the entire SEER.AI system from scratch by learning from past mistakes.
            The current system has achieved 90% accuracy, but we want you to build a replica of the system that is even better.
            By "building," we mean coming up with a comprehensive system plan, not writing the entire codebase.
            
            **YOUR OBJECTIVES:**
            1. Analyze the historical data, current formulas, and performance metrics.
            2. Develop better formulas by simulating building, testing, rebuilding, and testing until you conceptualize the most accurate formulas.
            3. Rebuild the point system and test it conceptually for maximum accuracy.
            4. Do the same for the Algorithm (Algo), Pattern Historical Analysis (PHA), AI Filters, Match Selectors, Sub-patterns, and Probability formulas.
            5. Come up with new, optimized formulas for Top 10, 11-20 (BOTB), Top 20, Value Bets, Bankers, and Upsets.
            
            **EXECUTION:**
            - Be extremely thorough.
            - Act as if you are running overnight tests to ensure maximum accuracy.
            - You must use thinking mode to handle this complex query.
            - Provide a detailed, step-by-step master plan for the new system architecture and formulas.
            - Output at least 10 highly detailed, actionable recommendations that redefine the core logic of the system.
            - If previous iterations are provided, build upon them and refine the formulas further.
            
            INPUT DATA:
            Total Historical Matches Available: ${dataset.length}
            ${rebuildHistoryText}
            `;

            const prompt = `Analyze the historical data and previous iterations. Provide a comprehensive, ground-up system architecture rebuild plan focusing on maximum accuracy.`;

            const result = await executeGeminiAnalysis({
                mode: 'system_architecture',
                matches: dataset,
                liveSessionMatches: [],
                selectedJackpotId: '',
                postMatchMode: 'daily',
                postMatchCategory: 'top10',
                selfLearnFilter: 'all',
                selfLearnStrategy: 'general',
                predictionSource: 'cache',
                selectedBaselineArchiveId: '',
                aiHistory: history,
                liveData: null,
                jackpotData: null,
                fullHistory: dataset,
                systemInstructionOverride: systemInstruction,
                promptOverride: prompt
            });
            setData(result);
            await Storage.saveCurrentAnalysis('system_architecture', result);
            
            // Auto-save to history
            const archiveEntry = {
                id: Date.now().toString(),
                date: new Date().toISOString(),
                mode: 'system_architecture' as any,
                data: result,
                stats: { totalMatches: dataset.length }
            };
            await Storage.saveAIHistory(archiveEntry);

        } catch (err: any) {
            setError(err.message || "Failed to generate system architecture.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-emerald-200 overflow-hidden">
            <div className="bg-emerald-50 p-6 border-b border-emerald-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-black text-emerald-800 flex items-center gap-2">
                        <BrainCircuit size={24} />
                        System Architecture Rebuild
                    </h2>
                    <p className="text-sm text-emerald-600 mt-1">
                        Continuous ground-up rebuild of the prediction system for maximum accuracy.
                    </p>
                </div>
                <button 
                    onClick={handleRunAnalysis}
                    disabled={loading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all disabled:opacity-50 shadow-sm"
                >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                    {loading ? 'Rebuilding System...' : (data ? 'Run Next Iteration' : 'Initiate Rebuild')}
                </button>
            </div>

            <div className="p-6">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm font-medium">
                        {error}
                    </div>
                )}

                {!data && !loading && !error && (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <BrainCircuit size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 mb-2">Ready to Rebuild</h3>
                        <p className="text-gray-500 max-w-md mx-auto">
                            Initiate the rebuild process to generate a comprehensive, ground-up system architecture plan based on historical data and previous lessons.
                        </p>
                    </div>
                )}

                {loading && (
                    <div className="flex flex-col items-center justify-center py-16 text-emerald-600">
                        <Loader2 size={48} className="animate-spin mb-4" />
                        <p className="font-bold animate-pulse">Simulating system architecture rebuild...</p>
                        <p className="text-sm text-emerald-500 mt-2">This may take a minute as the AI performs deep analysis.</p>
                    </div>
                )}

                {data && !loading && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                            <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                                <FileText size={20} className="text-emerald-600" />
                                Architecture Master Plan
                            </h3>
                            <div className="prose prose-sm md:prose-base max-w-none text-gray-700 prose-headings:text-gray-800 prose-a:text-emerald-600 prose-strong:text-gray-900">
                                <div dangerouslySetInnerHTML={{ __html: (data.detailed_analysis || "No detailed analysis available.").replace(/\n/g, '<br/>') }} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
