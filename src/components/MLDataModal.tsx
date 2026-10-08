import React from 'react';
import { X, Database, Target, Cpu } from 'lucide-react';

import { ML_BASE_PATTERNS_DESCRIPTIONS, ML_VARIABLES_DESCRIPTIONS } from '../utils/mlFeatureExtractor';

interface MLDataModalProps {
    isOpen: boolean;
    onClose: () => void;
    matrixStats: any;
    tags: string[];
}

export default function MLDataModal({ isOpen, onClose, matrixStats, tags }: MLDataModalProps) {
    if (!isOpen || !matrixStats) return null;

    const { exactCombo, subPatterns } = matrixStats;

    const getTagDescription = (tag: string) => {
        if (ML_BASE_PATTERNS_DESCRIPTIONS[tag]) return ML_BASE_PATTERNS_DESCRIPTIONS[tag];
        const baseMatch = tag.match(/^[a-zA-Z]+/);
        const varMatch = tag.match(/\d+$/);
        if (baseMatch && varMatch) {
            const base = baseMatch[0];
            const vId = parseInt(varMatch[0], 10);
            const baseDesc = ML_BASE_PATTERNS_DESCRIPTIONS[base] || base;
            const varDesc = ML_VARIABLES_DESCRIPTIONS[vId] || `Variable ${vId}`;
            return `${baseDesc} + ${varDesc}`;
        }
        return tag;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Database className="text-indigo-600" size={20} />
                        <h2 className="text-lg font-bold text-gray-800">ML Matrix Data</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto bg-white flex-1">
                    
                    {/* Exact Combo Section */}
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <Target size={16} className="text-emerald-600" />
                            <h3 className="text-md font-bold text-gray-800">Exact Combination</h3>
                        </div>
                        
                        <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
                            <div className="text-xs text-emerald-800 mb-3 bg-white p-3 rounded border border-emerald-200 flex flex-wrap gap-2">
                                {tags.sort().map(t => (
                                    <span key={t} className="bg-emerald-100 px-2 py-1 rounded border border-emerald-200" title={getTagDescription(t)}>
                                        <strong>{t}</strong>
                                    </span>
                                ))}
                            </div>
                            
                            {exactCombo ? (
                                <div className="grid grid-cols-4 gap-2 text-center">
                                    <div className="bg-white p-2 rounded border border-emerald-100 shadow-sm">
                                        <div className="text-[10px] font-bold text-gray-500 uppercase">Matches</div>
                                        <div className="text-sm font-black text-gray-800">{exactCombo.total}</div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-emerald-100 shadow-sm">
                                        <div className="text-[10px] font-bold text-gray-500 uppercase">Fav %</div>
                                        <div className={`text-sm font-black ${exactCombo.favPct >= 50 ? 'text-emerald-600' : 'text-gray-600'}`}>{exactCombo.favPct.toFixed(1)}%</div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-emerald-100 shadow-sm">
                                        <div className="text-[10px] font-bold text-gray-500 uppercase">Draw %</div>
                                        <div className={`text-sm font-black ${exactCombo.drawPct >= 35 ? 'text-amber-500' : 'text-gray-600'}`}>{exactCombo.drawPct.toFixed(1)}%</div>
                                    </div>
                                    <div className="bg-white p-2 rounded border border-emerald-100 shadow-sm">
                                        <div className="text-[10px] font-bold text-gray-500 uppercase">Und %</div>
                                        <div className={`text-sm font-black ${exactCombo.undPct >= 40 ? 'text-rose-500' : 'text-gray-600'}`}>{exactCombo.undPct.toFixed(1)}%</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-gray-500 italic text-center py-2">No historical data for this exact combination.</div>
                            )}
                        </div>
                    </div>

                    {/* Sub Patterns Section */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Cpu size={16} className="text-indigo-600" />
                            <h3 className="text-md font-bold text-gray-800">Active Patterns & Sub-Patterns</h3>
                        </div>
                        
                        {subPatterns && subPatterns.length > 0 ? (
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-3 py-2 font-bold text-gray-600">Tag & Description</th>
                                            <th className="px-3 py-2 font-bold text-gray-600 text-right">Vol</th>
                                            <th className="px-3 py-2 font-bold text-gray-600 text-right">Fav %</th>
                                            <th className="px-3 py-2 font-bold text-gray-600 text-right">Draw %</th>
                                            <th className="px-3 py-2 font-bold text-gray-600 text-right">Und %</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {subPatterns.sort((a: any, b: any) => b.stats.total - a.stats.total).map((sp: any, i: number) => {
                                            const isBase = /^[a-zA-Z]+$/.test(sp.tag);
                                            return (
                                            <tr key={i} className={`hover:bg-gray-50 ${isBase ? 'bg-indigo-50/50' : ''}`}>
                                                <td className="px-3 py-2">
                                                    <div className="font-mono font-bold text-indigo-700">{sp.tag}</div>
                                                    <div className="text-[10px] text-gray-500 mt-0.5">{getTagDescription(sp.tag)}</div>
                                                </td>
                                                <td className="px-3 py-2 text-right text-gray-700 font-medium">{sp.stats.total}</td>
                                                <td className={`px-3 py-2 text-right font-medium ${sp.stats.favPct >= 50 ? 'text-emerald-600 font-bold' : 'text-gray-500'}`}>{sp.stats.favPct.toFixed(1)}%</td>
                                                <td className={`px-3 py-2 text-right font-medium ${sp.stats.drawPct >= 35 ? 'text-amber-500 font-bold' : 'text-gray-500'}`}>{sp.stats.drawPct.toFixed(1)}%</td>
                                                <td className={`px-3 py-2 text-right font-medium ${sp.stats.undPct >= 40 ? 'text-rose-500 font-bold' : 'text-gray-500'}`}>{sp.stats.undPct.toFixed(1)}%</td>
                                            </tr>
                                        )})}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500 italic text-center py-4 bg-gray-50 rounded-lg border border-gray-100">No active sub-patterns found.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
