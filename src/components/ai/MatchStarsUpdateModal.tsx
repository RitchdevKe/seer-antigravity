import React, { useState, useEffect } from 'react';
import { X, Star, Save, AlertTriangle, ArrowRight } from 'lucide-react';
import { AIResponse } from './GeminiEngine';
import { extractMatchStars, getMatchStars, saveMatchStars } from '../../utils/matchStars';

interface MatchStarsUpdateModalProps {
    onClose: () => void;
    latestDailyData: AIResponse;
}

interface StarComparison {
    key: string;
    prev: number | undefined;
    current: number;
    isNew: boolean;
    isChanged: boolean;
}

export const MatchStarsUpdateModal: React.FC<MatchStarsUpdateModalProps> = ({ onClose, latestDailyData }) => {
    const [comparisons, setComparisons] = useState<StarComparison[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const loadStars = async () => {
            try {
                const existingStars = await getMatchStars();
                const newStars = extractMatchStars(latestDailyData);

                const comps: StarComparison[] = [];
                for (const key in newStars) {
                    const current = newStars[key];
                    const prev = existingStars[key];
                    comps.push({
                        key,
                        prev,
                        current,
                        isNew: prev === undefined,
                        isChanged: prev !== undefined && prev !== current
                    });
                }
                setComparisons(comps);
            } catch (error) {
                console.error("Error loading stars for comparison:", error);
            } finally {
                setLoading(false);
            }
        };
        loadStars();
    }, [latestDailyData]);

    const handleUpdate = async () => {
        setSaving(true);
        try {
            await saveMatchStars(latestDailyData);
            alert("Match stars updated successfully!");
            onClose();
        } catch (error) {
            console.error("Error updating stars:", error);
            alert("Failed to update match stars.");
        } finally {
            setSaving(false);
        }
    };

    const renderStars = (count: number | undefined) => {
        if (count === undefined) return <span className="text-gray-400 text-xs italic">None</span>;
        const stars = [];
        const fullStars = Math.floor(count);
        const hasHalfStar = count % 1 >= 0.5;

        for (let i = 0; i < fullStars; i++) {
            stars.push(<Star key={`full-${i}`} size={12} className="text-yellow-500 fill-current" />);
        }
        if (hasHalfStar) {
            stars.push(<Star key="half" size={12} className="text-yellow-500 opacity-50 fill-current" />);
        }
        return <div className="flex -space-x-0.5">{stars}</div>;
    };

    const newStarsCount = comparisons.filter(c => c.isNew).length;
    const changedStarsCount = comparisons.filter(c => c.isChanged).length;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-2">
                        <Star className="text-yellow-500" size={24} />
                        <h2 className="text-lg font-bold text-gray-800">Match Stars Update</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto flex-1 bg-gray-50/50">
                    {loading ? (
                        <div className="flex justify-center items-center h-32 text-gray-500">
                            Loading comparisons...
                        </div>
                    ) : comparisons.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-gray-500 gap-2">
                            <AlertTriangle size={24} className="text-yellow-500" />
                            <p>No match stars found in the latest Daily Live audit.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex gap-4 mb-4">
                                <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-lg text-sm font-medium border border-blue-100">
                                    Total Stars: {comparisons.length}
                                </div>
                                <div className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg text-sm font-medium border border-emerald-100">
                                    New Auto-Created: {newStarsCount}
                                </div>
                                <div className="bg-amber-50 text-amber-700 px-3 py-2 rounded-lg text-sm font-medium border border-amber-100">
                                    Changed: {changedStarsCount}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {comparisons.map(comp => (
                                    <div key={comp.key} className={`p-3 rounded-lg border flex flex-col gap-2 ${comp.isNew ? 'bg-emerald-50/50 border-emerald-200' : comp.isChanged ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-gray-200'}`}>
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-sm text-gray-800">{comp.key}</span>
                                            {comp.isNew && <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">New</span>}
                                            {comp.isChanged && <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-100 px-2 py-0.5 rounded">Updated</span>}
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-500 uppercase font-semibold">Previous</span>
                                                {renderStars(comp.prev)}
                                            </div>
                                            <ArrowRight size={14} className="text-gray-400" />
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-500 uppercase font-semibold">Current</span>
                                                {renderStars(comp.current)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-white">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleUpdate}
                        disabled={saving || comparisons.length === 0}
                        className="px-4 py-2 text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save size={16} />
                        {saving ? 'Updating...' : 'Update Match Stars'}
                    </button>
                </div>
            </div>
        </div>
    );
};