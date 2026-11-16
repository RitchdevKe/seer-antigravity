import React, { useState, useEffect } from 'react';
import { X, Settings2, Plus, Trash2, Save, Info, Activity, Zap, Calendar } from 'lucide-react';
import { 
    OPTIMIZED_CATEGORY_SETTINGS, 
    CODE_DEFAULT_CATEGORY_SETTINGS, 
    OptimizedCategorySettings, 
    BaseWeightInterval, 
    updateOptimizedCategorySettings,
    DAILY_OPTIMIZED_SETTINGS,
    DAILY_DEFAULT_CATEGORY_SETTINGS,
    DayOfWeek,
    DAY_METADATA
} from '../utils/optimizedweights';
import { markKeyDirty } from '../services/supabaseStorage';

interface OptimizedWeightsSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    categoryId: string | null;
}

export default function OptimizedWeightsSettingsModal({ isOpen, onClose, categoryId }: OptimizedWeightsSettingsModalProps) {
    const [selectedDay, setSelectedDay] = useState<DayOfWeek | 'all'>('all');
    const [settings, setSettings] = useState<OptimizedCategorySettings | null>(null);

    useEffect(() => {
        if (isOpen && categoryId) {
            let existing = selectedDay === 'all'
                ? OPTIMIZED_CATEGORY_SETTINGS[categoryId]
                : DAILY_OPTIMIZED_SETTINGS[selectedDay]?.[categoryId];
            
            const HARDCODED_CATEGORIES = ['best_bet', 'bankers_dlive', 'top_12_value', 'top_10_value', 'upsets', 'botb_best', 'bankers_jackpot', 'value_picks', 'high_confidence'];
            if (HARDCODED_CATEGORIES.includes(categoryId)) {
                const codeDefault = selectedDay === 'all'
                    ? CODE_DEFAULT_CATEGORY_SETTINGS[categoryId]
                    : DAILY_DEFAULT_CATEGORY_SETTINGS[selectedDay]?.[categoryId];
                if (codeDefault) {
                    existing = {
                        ...codeDefault,
                        name: existing?.name || codeDefault.name,
                        description: existing?.description || codeDefault.description,
                        baseWeightIntervals: JSON.parse(JSON.stringify(codeDefault.baseWeightIntervals || [])),
                        rules: JSON.parse(JSON.stringify(codeDefault.rules || []))
                    };
                }
            }
            
            if (existing) {
                setSettings(JSON.parse(JSON.stringify(existing)));
            } else {
                setSettings({
                    name: `Custom Category (${categoryId})`,
                    description: "",
                    baseLogic: "",
                    baseWeightIntervals: [],
                    rules: []
                });
            }
        }
    }, [isOpen, categoryId]);

    if (!isOpen || !categoryId || !settings) return null;

    const handleSave = () => {
        updateOptimizedCategorySettings(categoryId, settings, selectedDay !== 'all' ? selectedDay : undefined);
        
        // Before saving, force-inject code defaults for all hardcoded categories
        // to prevent any corrupted/empty state from being persisted
        const HARDCODED_CATEGORIES = ['best_bet', 'bankers_dlive', 'top_12_value', 'top_10_value', 'upsets', 'botb_best', 'bankers_jackpot', 'value_picks', 'high_confidence'];
        for (const hcKey of HARDCODED_CATEGORIES) {
            const codeDefault = CODE_DEFAULT_CATEGORY_SETTINGS[hcKey];
            if (codeDefault && (!OPTIMIZED_CATEGORY_SETTINGS[hcKey] || 
                !OPTIMIZED_CATEGORY_SETTINGS[hcKey].baseWeightIntervals || 
                OPTIMIZED_CATEGORY_SETTINGS[hcKey].baseWeightIntervals!.length === 0)) {
                OPTIMIZED_CATEGORY_SETTINGS[hcKey] = {
                    ...codeDefault,
                    baseWeightIntervals: JSON.parse(JSON.stringify(codeDefault.baseWeightIntervals || [])),
                    rules: JSON.parse(JSON.stringify(codeDefault.rules || []))
                };
            }
        }
        
        // Save to localStorage
        localStorage.setItem('optimized_weights_settings', JSON.stringify(OPTIMIZED_CATEGORY_SETTINGS));
        localStorage.setItem('daily_optimized_weights_settings', JSON.stringify(DAILY_OPTIMIZED_SETTINGS));
        markKeyDirty('optimized_weights_settings');
        markKeyDirty('daily_optimized_weights_settings');
        
        onClose();
    };

    const addInterval = () => {
        const newInterval: BaseWeightInterval = {
            id: Date.now().toString(),
            min: 0,
            max: 100,
            points: 10,
            metric: 'pha_market_fav'
        };
        setSettings({
            ...settings,
            baseWeightIntervals: [...(settings.baseWeightIntervals || []), newInterval]
        });
    };

    const removeInterval = (id: string) => {
        setSettings({
            ...settings,
            baseWeightIntervals: (settings.baseWeightIntervals || []).filter(i => i.id !== id)
        });
    };

    const updateInterval = (id: string, field: keyof BaseWeightInterval, value: any) => {
        setSettings({
            ...settings,
            baseWeightIntervals: (settings.baseWeightIntervals || []).map(i => 
                i.id === id ? { ...i, [field]: value } : i
            )
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-slate-800 text-white p-5 flex justify-between items-center border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-pink-500/20 text-pink-400 rounded-lg">
                            <Settings2 size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black flex items-center gap-2 tracking-wide">
                                Configure Optimized Weights
                            </h2>
                            <p className="text-xs text-slate-300 mt-1">Configure logic for {categoryId}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-300 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-full self-start">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 bg-slate-50 flex-1 overflow-y-auto space-y-6">
                    {/* Day of Week Selector */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
                        <div className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                            <Calendar size={14} className="text-purple-600" />
                            <span>Select Day Configuration:</span>
                            {selectedDay !== 'all' && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                    DAY_METADATA[selectedDay].volatilityTier === 'volatile'
                                        ? 'bg-red-100 text-red-700'
                                        : DAY_METADATA[selectedDay].volatilityTier === 'safest'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-blue-100 text-blue-700'
                                }`}>
                                    {DAY_METADATA[selectedDay].volatilityLabel}
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            <button
                                type="button"
                                onClick={() => setSelectedDay('all')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    selectedDay === 'all'
                                        ? 'bg-slate-900 text-white shadow-xs'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                            >
                                All Days (Global)
                            </button>
                            {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as DayOfWeek[]).map(d => {
                                const isSelected = selectedDay === d;
                                return (
                                    <button
                                        key={d}
                                        type="button"
                                        onClick={() => setSelectedDay(d)}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
                                            isSelected
                                                ? 'bg-purple-700 text-white shadow-xs'
                                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                        }`}
                                    >
                                        {d}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-4">
                        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <Info size={16} className="text-blue-500" /> General Configuration
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Display Name</label>
                                <input 
                                    type="text" 
                                    className="w-full text-sm border-slate-200 rounded-md p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={settings.name}
                                    onChange={(e) => setSettings({...settings, name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Description</label>
                                <input 
                                    type="text" 
                                    className="w-full text-sm border-slate-200 rounded-md p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={settings.description}
                                    onChange={(e) => setSettings({...settings, description: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="bg-slate-100 p-3 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Activity size={18} className="text-emerald-600" />
                                <h3 className="font-bold text-slate-700">Base Weight Intervals</h3>
                            </div>
                            <button 
                                onClick={addInterval}
                                className="flex items-center gap-1 text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-2 py-1 rounded shadow-sm"
                            >
                                <Plus size={14} /> Add Interval
                            </button>
                        </div>
                        <div className="p-4">
                            {(!settings.baseWeightIntervals || settings.baseWeightIntervals.length === 0) ? (
                                <p className="text-sm text-slate-500 text-center py-4">No intervals defined. Add one to start scoring matches.</p>
                            ) : (
                                <div className="space-y-3">
                                    {settings.baseWeightIntervals.map((interval, idx) => (
                                        <div key={interval.id} className="flex flex-wrap md:flex-nowrap items-center gap-2 p-3 bg-slate-50 rounded border border-slate-200">
                                            <div className="flex-1 min-w-[120px]">
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Metric</label>
                                                <select 
                                                    className="w-full text-xs font-medium border-slate-200 rounded p-1.5"
                                                    value={interval.metric}
                                                    onChange={(e) => updateInterval(interval.id, 'metric', e.target.value)}
                                                >
                                                    <option value="pha_market_fav">Market Fav PHA %</option>
                                                    <option value="pha_underdog">Underdog PHA %</option>
                                                </select>
                                            </div>
                                            <div className="w-full md:w-24">
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Min Val</label>
                                                <input 
                                                    type="number" 
                                                    className="w-full text-xs border-slate-200 rounded p-1.5"
                                                    value={interval.min}
                                                    onChange={(e) => updateInterval(interval.id, 'min', parseFloat(e.target.value))}
                                                />
                                            </div>
                                            <div className="w-full md:w-24">
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Max Val</label>
                                                <input 
                                                    type="number" 
                                                    className="w-full text-xs border-slate-200 rounded p-1.5"
                                                    value={interval.max}
                                                    onChange={(e) => updateInterval(interval.id, 'max', parseFloat(e.target.value))}
                                                />
                                            </div>
                                            <div className="w-full md:w-24">
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Points</label>
                                                <input 
                                                    type="number" 
                                                    className="w-full text-xs font-bold text-emerald-600 bg-emerald-50 border-emerald-200 rounded p-1.5"
                                                    value={interval.points}
                                                    onChange={(e) => updateInterval(interval.id, 'points', parseInt(e.target.value))}
                                                />
                                            </div>
                                            <div className="flex items-end h-[42px]">
                                                <button 
                                                    onClick={() => removeInterval(interval.id)}
                                                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors"
                                                    title="Remove interval"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Additional Rules Section - View Only for now, as dynamic rule parsing is complex */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                         <div className="bg-slate-100 p-3 border-b border-slate-200 flex items-center gap-2">
                            <Zap size={18} className="text-amber-500" />
                            <h3 className="font-bold text-slate-700">Hardcoded Category Rules (Read-only)</h3>
                        </div>
                        <div className="p-4">
                            <p className="text-xs text-slate-500 mb-3">
                                These specific rules are hardcoded in the optimized weights algorithm for this category and applied automatically.
                            </p>
                            {settings.rules.length > 0 ? (
                                <div className="space-y-2">
                                    {settings.rules.map((rule, idx) => (
                                        <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                                            <span className="text-xs font-medium text-slate-700">{rule.description}</span>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${rule.points > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                {rule.points > 0 ? '+' : ''}{rule.points} pts
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic">No hardcoded rules for this category.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-white border-t border-slate-200 flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        className="px-4 py-2 text-sm font-black bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm shadow-blue-600/20"
                    >
                        <Save size={16} /> Save Logic Configuration
                    </button>
                </div>
            </div>
        </div>
    );
}
