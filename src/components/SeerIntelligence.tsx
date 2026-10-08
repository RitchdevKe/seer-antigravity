import React, { useState, useEffect, useMemo } from 'react';
import { Database, Search, Activity, PlayCircle, Filter, GitBranch, History } from 'lucide-react';
import { Match } from '../types';
import MatchCard from './MatchCard';
import PatternTree from './PatternTree';
import { generateSITags, extractMLFeatures, ML_BASE_PATTERNS_DESCRIPTIONS, ML_VARIABLES_DESCRIPTIONS } from '../utils/mlFeatureExtractor';
import { supabase } from '../lib/supabase';
import { useMLMatrix } from '../context/MLMatrixContext';
import { parseMatchOdds } from '../utils/seerAiSlipSelection';
import { getActualResult } from '../utils/matchProcessing';

interface MLMatrixViewerProps {
    historicalMatches: Match[];
    liveMatches: Match[];
}

export default function SeerIntelligence({ historicalMatches, liveMatches }: MLMatrixViewerProps) {
    const { mlData, isLoading } = useMLMatrix();
    const [activeTab, setActiveTab] = useState<'basePatterns' | 'subPatterns' | 'combos'>('combos');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState<string | null>(null);
    const [expandedMatch, setExpandedMatch] = useState<number | null>(null);
    const [showTree, setShowTree] = useState(false);
    const [sortConfig, setSortConfig] = useState<{key: 'total'|'fav'|'draw'|'und', direction: 'asc'|'desc'}>({ key: 'total', direction: 'desc' });
    
    // New states for datasets and outcome filters
    const [viewMode, setViewMode] = useState<'prehistoric' | 'live'>('prehistoric');
    const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'fav' | 'draw' | 'und'>('all');

    const baseMatches = viewMode === 'prehistoric' ? historicalMatches : liveMatches;

    // Pre-compute tag index ONCE so clicking patterns is instant
    const tagIndex = useMemo(() => {
        const index: Record<string, Match[]> = {};
        
        baseMatches.forEach(m => {
            const features = extractMLFeatures(m);
            if (!features) return;
            const tags = generateSITags(features);
            if (!tags) return;
            
            for (const tag of tags) {
                if (!index[tag]) index[tag] = [];
                index[tag].push(m);
            }
        });
        
        return { tags: index };
    }, [baseMatches]);

    const processItemMatches = useMemo(() => {
        if (!selectedItem) return [];
        let filteredMatches = [];
        
        if (activeTab === 'combos') {
            const requiredTags = selectedItem.split('+');
            if (requiredTags.length === 0) return [];
            
            // Intersection of matches that have ALL required tags
            filteredMatches = tagIndex.tags[requiredTags[0]] || [];
            for (let i = 1; i < requiredTags.length; i++) {
                const tagSet = new Set((tagIndex.tags[requiredTags[i]] || []).map(m => m.id));
                filteredMatches = filteredMatches.filter(m => tagSet.has(m.id));
            }
        } else {
            filteredMatches = tagIndex.tags[selectedItem] || [];
        }

        // Apply outcome filter
        if (outcomeFilter !== 'all') {
            filteredMatches = filteredMatches.filter(m => {
                const actual = getActualResult(m.result);
                if (actual === 'pending') return false; // Can't filter outcome if pending
                
                const { odds1, odds2 } = parseMatchOdds(m);
                const isFavHome = odds1 <= odds2;
                
                if (outcomeFilter === 'fav') {
                    return (actual === '1' && isFavHome) || (actual === '2' && !isFavHome);
                }
                if (outcomeFilter === 'draw') {
                    return actual === 'X';
                }
                if (outcomeFilter === 'und') {
                    return (actual === '2' && isFavHome) || (actual === '1' && !isFavHome);
                }
                return true;
            });
        }
        
        return filteredMatches;
    }, [selectedItem, activeTab, tagIndex, outcomeFilter]);

    if (isLoading || !mlData) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center p-12 text-gray-500">
                <Database className="w-12 h-12 mb-4 animate-bounce text-[var(--color-primary)] text-emerald-600" />
                <p className="font-semibold text-lg animate-pulse text-gray-800">Loading ML Matrix Data...</p>
                <p className="text-sm mt-2 opacity-70 text-gray-600">Computing feature arrays across historical dataset</p>
            </div>
        );
    }

    const currentDataSet = mlData[activeTab] || {};
    let filteredKeys = Object.keys(currentDataSet).filter(k => k.toLowerCase().includes(searchQuery.toLowerCase()));
    
    filteredKeys.sort((a, b) => {
        let valA = 0, valB = 0;
        if (sortConfig.key === 'total') { valA = currentDataSet[a].total; valB = currentDataSet[b].total; }
        else if (sortConfig.key === 'fav') { valA = currentDataSet[a].favPct; valB = currentDataSet[b].favPct; }
        else if (sortConfig.key === 'draw') { valA = currentDataSet[a].drawPct; valB = currentDataSet[b].drawPct; }
        else if (sortConfig.key === 'und') { valA = currentDataSet[a].undPct; valB = currentDataSet[b].undPct; }
        
        return sortConfig.direction === 'desc' ? valB - valA : valA - valB;
    });

    const handleSort = (key: 'total'|'fav'|'draw'|'und') => {
        if (sortConfig.key === key) {
            setSortConfig({ key, direction: sortConfig.direction === 'desc' ? 'asc' : 'desc' });
        } else {
            setSortConfig({ key, direction: 'desc' });
        }
    };

    return (
        <>
        {showTree && <PatternTree mlData={mlData} onClose={() => setShowTree(false)} />}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Database size={20} className="text-emerald-600" />
                        <div>
                            <h2 className="text-lg font-black text-gray-800 tracking-tight leading-tight">Data-Driven ML Matrix</h2>
                            <p className="text-xs font-medium text-gray-500">Live reflection of the self-updating AI matrix.</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="flex bg-gray-200 p-1 rounded-lg">
                            <button 
                                onClick={() => setViewMode('prehistoric')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${viewMode === 'prehistoric' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <History size={14} />
                                Prehistoric
                            </button>
                            <button 
                                onClick={() => setViewMode('live')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${viewMode === 'live' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <Activity size={14} />
                                Live Matches
                            </button>
                        </div>
                        <button onClick={() => setShowTree(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm">
                            <GitBranch size={14} />
                            Pattern Tree
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-white rounded-md border border-gray-200 p-1 shadow-sm">
                        <button onClick={() => {setActiveTab('basePatterns'); setSelectedItem(null);}} className={`px-4 py-1.5 rounded text-xs font-bold transition-colors ${activeTab === 'basePatterns' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}>Base Patterns</button>
                        <button onClick={() => {setActiveTab('subPatterns'); setSelectedItem(null);}} className={`px-4 py-1.5 rounded text-xs font-bold transition-colors ${activeTab === 'subPatterns' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}>Sub Patterns</button>
                        <button onClick={() => {setActiveTab('combos'); setSelectedItem(null);}} className={`px-4 py-1.5 rounded text-xs font-bold transition-colors ${activeTab === 'combos' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}>Exact Combos</button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row min-h-[600px] max-h-[800px]">
                {/* Left side: List of patterns/combos */}
                <div className={`w-full ${selectedItem ? 'md:w-1/2 border-r' : 'md:w-full'} border-gray-200 flex flex-col transition-all duration-300`}>
                    <div className="p-3 border-b border-gray-100">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input 
                                type="text" 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={`Search ${activeTab}...`} 
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto bg-gray-50" style={{maxHeight: '700px'}}>
                        <table className="w-full text-left text-xs text-gray-600">
                            <thead className="bg-white border-b border-gray-200 sticky top-0 z-10">
                                <tr>
                                    <th className="px-2 py-3 font-bold text-gray-700 uppercase tracking-wider text-center w-8">#</th>
                                    <th className="px-4 py-3 font-bold text-gray-700 uppercase tracking-wider">Pattern</th>
                                    {activeTab !== 'combos' && (
                                        <th className="px-4 py-3 font-bold text-gray-700 uppercase tracking-wider">Trigger</th>
                                    )}
                                    <th onClick={() => handleSort('total')} className="px-4 py-3 font-bold text-gray-700 uppercase tracking-wider text-right cursor-pointer hover:bg-gray-100">
                                        Vol {sortConfig.key === 'total' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                                    </th>
                                    <th onClick={() => handleSort('fav')} className="px-4 py-3 font-bold text-gray-700 uppercase tracking-wider text-right cursor-pointer hover:bg-gray-100">
                                        Fav {sortConfig.key === 'fav' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                                    </th>
                                    <th onClick={() => handleSort('draw')} className="px-4 py-3 font-bold text-gray-700 uppercase tracking-wider text-right cursor-pointer hover:bg-gray-100">
                                        Draw {sortConfig.key === 'draw' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                                    </th>
                                    <th onClick={() => handleSort('und')} className="px-4 py-3 font-bold text-gray-700 uppercase tracking-wider text-right cursor-pointer hover:bg-gray-100">
                                        Und {sortConfig.key === 'und' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredKeys.map((k, idx) => {
                                    const st = currentDataSet[k];
                                    const isSelected = selectedItem === k;
                                    return (
                                        <tr 
                                            key={k} 
                                            onClick={() => setSelectedItem(isSelected ? null : k)}
                                            className={`border-b border-gray-100 cursor-pointer transition-colors ${isSelected ? 'bg-emerald-50 hover:bg-emerald-100' : 'bg-white hover:bg-gray-50'}`}
                                        >
                                            <td className="px-2 py-3 text-center text-gray-400 font-mono text-xs w-8">{idx + 1}</td>
                                            <td className="px-4 py-3 font-mono font-bold text-gray-800 break-all truncate max-w-[150px]" title={k}>
                                                {activeTab === 'combos' ? k.split('+').join(' + ') : k}
                                            </td>
                                            {activeTab !== 'combos' && (
                                                <td className="px-4 py-3 text-gray-600 text-xs truncate max-w-[250px]" title={
                                                    activeTab === 'subPatterns' 
                                                    ? `${ML_BASE_PATTERNS_DESCRIPTIONS[k.replace(/[0-9]+$/, '')] || ''} + ${ML_VARIABLES_DESCRIPTIONS[parseInt(k.match(/[0-9]+$/)?.[0] || '0')] || ''}`
                                                    : ML_BASE_PATTERNS_DESCRIPTIONS[k.replace(/[0-9]+$/, '')] || ''
                                                }>
                                                    {activeTab === 'subPatterns' 
                                                        ? (() => {
                                                            const base = ML_BASE_PATTERNS_DESCRIPTIONS[k.replace(/[0-9]+$/, '')];
                                                            const varMatch = k.match(/[0-9]+$/);
                                                            const variable = varMatch ? ML_VARIABLES_DESCRIPTIONS[parseInt(varMatch[0])] : null;
                                                            return variable ? `${base} + ${variable}` : (base || 'Derived sub-pattern');
                                                          })()
                                                        : (ML_BASE_PATTERNS_DESCRIPTIONS[k.replace(/[0-9]+$/, '')] || 'Derived sub-pattern')
                                                    }
                                                </td>
                                            )}
                                            <td className="px-4 py-3 text-right font-bold text-gray-600">{st.total}</td>
                                            <td className="px-4 py-3 text-right font-mono">
                                                <span className={st.favPct >= 60 ? 'text-emerald-600 font-bold' : 'text-gray-500'}>{st.favPct.toFixed(1)}%</span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono">
                                                <span className={st.drawPct >= 35 ? 'text-amber-600 font-bold' : 'text-gray-500'}>{st.drawPct.toFixed(1)}%</span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono">
                                                <span className={st.undPct >= 40 ? 'text-rose-600 font-bold' : 'text-gray-500'}>{st.undPct.toFixed(1)}%</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {filteredKeys.length === 0 && (
                            <div className="p-8 text-center text-gray-400 font-medium">No results found.</div>
                        )}
                    </div>
                </div>

                {/* Right side: Matches viewer */}
                {selectedItem && (
                    <div className="w-full md:w-1/2 flex flex-col bg-gray-50 overflow-y-auto" style={{maxHeight: '700px'}}>
                        <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
                            <h3 className="font-bold text-gray-800 text-sm">Matches for {activeTab === 'combos' ? 'Combo' : 'Pattern'}</h3>
                            <div className="font-mono text-xs text-indigo-600 mt-1 break-all bg-indigo-50 p-2 rounded border border-indigo-100">
                                {selectedItem.split('+').join(' + ')}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 items-center justify-between">
                                <div className="text-xs font-bold text-gray-500 uppercase">
                                    Found: {processItemMatches.length} Matches
                                </div>
                                <div className="flex bg-gray-100 p-1 rounded-md">
                                    <button 
                                        onClick={() => setOutcomeFilter('all')}
                                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${outcomeFilter === 'all' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        All
                                    </button>
                                    <button 
                                        onClick={() => setOutcomeFilter('fav')}
                                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${outcomeFilter === 'fav' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        M.Fav
                                    </button>
                                    <button 
                                        onClick={() => setOutcomeFilter('draw')}
                                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${outcomeFilter === 'draw' ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        Draw
                                    </button>
                                    <button 
                                        onClick={() => setOutcomeFilter('und')}
                                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${outcomeFilter === 'und' ? 'bg-rose-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        Underdog
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 space-y-4">
                            {processItemMatches.length === 0 ? (
                                <div className="text-center p-8 text-gray-400">
                                    No matches match this pattern in the loaded dataset.
                                </div>
                            ) : (
                                processItemMatches.map((m, idx) => (
                                    <MatchCard 
                                        key={`${m.id}_${idx}`} 
                                        match={m} 
                                        expandedMatch={expandedMatch} 
                                        setExpandedMatch={setExpandedMatch} 
                                    />
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
        </>
    );
}
