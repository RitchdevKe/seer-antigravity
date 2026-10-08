
import React, { useState } from 'react';
import { Match } from '../types';
import { runPatternAudit, AuditResult } from '../utils/patternAudit';
import { X, AlertTriangle, Plus, GitMerge, CheckCircle, Loader2, Copy } from 'lucide-react';

interface PatternAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  matches: Match[];
}

const PatternAuditModal: React.FC<PatternAuditModalProps> = ({ isOpen, onClose, matches }) => {
  const [isAuditing, setIsAuditing] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [activeTab, setActiveTab] = useState<'fixes' | 'new' | 'streamline'>('fixes');

  if (!isOpen) return null;

  const handleRunAudit = async () => {
    setIsAuditing(true);
    // Use setTimeout to allow UI to render loading state
    setTimeout(async () => {
      try {
        const auditResult = await runPatternAudit(matches);
        setResult(auditResult);
      } catch (error) {
        console.error("Audit failed:", error);
      } finally {
        setIsAuditing(false);
      }
    }, 100);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50 rounded-t-xl">
          <div>
            <h2 className="text-2xl font-bold text-indigo-900">Pattern Audit System</h2>
            <p className="text-indigo-600 text-sm mt-1">Analyze matches for misclassifications, new patterns, and optimization opportunities.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-indigo-100 rounded-full transition-colors">
            <X size={24} className="text-indigo-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!result && !isAuditing && (
            <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
              <div className="bg-indigo-100 p-4 rounded-full">
                <AlertTriangle size={48} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Ready to Audit</h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  This process will analyze {matches.length} matches against current pattern rules. 
                  It may take a few seconds depending on dataset size.
                </p>
              </div>
              <button 
                onClick={handleRunAudit}
                className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center gap-2"
              >
                Start Audit
              </button>
            </div>
          )}

          {isAuditing && (
            <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
              <Loader2 size={48} className="text-indigo-600 animate-spin" />
              <p className="text-gray-600 font-medium">Analyzing patterns...</p>
            </div>
          )}

          {result && (
            <div className="space-y-6">
              {/* Stats Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <div className="text-blue-600 text-xs font-bold uppercase">Total Matches</div>
                  <div className="text-2xl font-black text-blue-900">{result.stats.totalMatches}</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                  <div className="text-green-600 text-xs font-bold uppercase">Matched</div>
                  <div className="text-2xl font-black text-green-900">{result.stats.matchesWithSubPattern}</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                  <div className="text-yellow-600 text-xs font-bold uppercase">Unmatched</div>
                  <div className="text-2xl font-black text-yellow-900">{result.stats.matchesWithoutSubPattern}</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                  <div className="text-red-600 text-xs font-bold uppercase">Issues Found</div>
                  <div className="text-2xl font-black text-red-900">{result.fixes.length + result.streamlining.length}</div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-200">
                <button 
                  onClick={() => setActiveTab('fixes')}
                  className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'fixes' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  <AlertTriangle size={16} />
                  Fixes & Renames ({result.fixes.length})
                </button>
                <button 
                  onClick={() => setActiveTab('new')}
                  className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'new' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  <Plus size={16} />
                  New Patterns ({result.newPatterns.length})
                </button>
                <button 
                  onClick={() => setActiveTab('streamline')}
                  className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'streamline' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  <GitMerge size={16} />
                  Streamlining ({result.streamlining.length})
                </button>
              </div>

              {/* Tab Content */}
              <div className="bg-gray-50 rounded-b-lg p-4 min-h-[300px]">
                {activeTab === 'fixes' && (
                  <div className="space-y-3">
                    {result.fixes.length === 0 ? (
                      <div className="text-center py-12 text-gray-400">No fixes needed. Great job!</div>
                    ) : (
                      result.fixes.map((fix, idx) => (
                        <div key={idx} className="bg-white p-4 rounded border border-gray-200 shadow-sm flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${fix.type === 'rename' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                                {fix.type.toUpperCase()}
                              </span>
                              <span className="font-mono text-sm text-gray-500">{fix.currentId || 'Match #' + fix.matchId}</span>
                              <span className="text-gray-400">→</span>
                              <span className="font-mono text-sm font-bold text-indigo-600">{fix.suggestedId}</span>
                            </div>
                            <p className="text-sm text-gray-700">{fix.reason}</p>
                            {fix.details && <p className="text-xs text-gray-500 mt-1">{fix.details}</p>}
                          </div>
                          <button onClick={() => copyToClipboard(JSON.stringify(fix, null, 2))} className="text-gray-400 hover:text-indigo-600">
                            <Copy size={16} />
                          </button>
                        </div>
                      ))
                    )}
                    {result.fixes.length > 0 && (
                      <div className="mt-4 flex justify-end sticky bottom-0 bg-gray-50 pt-2">
                        <button
                          onClick={() => copyToClipboard(JSON.stringify(result.fixes, null, 2))}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold text-sm shadow-sm"
                        >
                          <Copy size={16} />
                          Copy All Fixes
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'new' && (
                  <div className="space-y-3">
                    {result.newPatterns.length === 0 ? (
                      <div className="text-center py-12 text-gray-400">No new pattern candidates found.</div>
                    ) : (
                      result.newPatterns.map((p, idx) => (
                        <div key={idx} className="bg-white p-4 rounded border border-gray-200 shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-bold text-indigo-900">Group {p.group} - Pattern {p.mainPattern}</h4>
                              <div className="text-xs text-gray-500 mt-1">Based on {p.matchCount} unclassified matches</div>
                            </div>
                            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded">
                              Suggested ID: {p.suggestedId}
                            </span>
                          </div>
                          <div className="mb-3">
                            <div className="text-xs font-bold text-gray-500 uppercase mb-1">Common Riders (&gt;50%)</div>
                            <div className="flex flex-wrap gap-1">
                              {p.commonRiders.map(r => (
                                <span key={r} className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded border border-gray-200">{r}</span>
                              ))}
                            </div>
                          </div>
                          
                          {p.predictionDetails && (
                            <div className="mb-3 bg-green-50 p-3 rounded border border-green-100">
                                <div className="text-xs font-bold text-green-800 uppercase mb-2">Recommended Prediction</div>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div>
                                        <span className="text-gray-500 block">Accuracy</span>
                                        <span className="font-bold text-green-600">{p.predictionDetails.accuracy}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block">Primary</span>
                                        <span className="font-bold text-gray-800">{p.predictionDetails.primaryPrediction}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block">Final</span>
                                        <span className="font-bold text-indigo-700">{p.predictionDetails.finalPrediction}</span>
                                    </div>
                                </div>
                            </div>
                          )}

                          <div className="bg-gray-50 p-2 rounded text-xs text-gray-500 font-mono">
                            Example Matches: {p.exampleMatches.join(', ')}
                          </div>
                        </div>
                      ))
                    )}
                    {result.newPatterns.length > 0 && (
                      <div className="mt-4 flex justify-end sticky bottom-0 bg-gray-50 pt-2">
                        <button
                          onClick={() => copyToClipboard(JSON.stringify(result.newPatterns, null, 2))}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold text-sm shadow-sm"
                        >
                          <Copy size={16} />
                          Copy All New Patterns
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'streamline' && (
                  <div className="space-y-3">
                    {result.streamlining.length === 0 ? (
                      <div className="text-center py-12 text-gray-400">No streamlining opportunities found.</div>
                    ) : (
                      result.streamlining.map((s, idx) => (
                        <div key={idx} className="bg-white p-4 rounded border border-gray-200 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-mono font-bold text-indigo-600">{s.currentId}</span>
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-bold">Optimization</span>
                          </div>
                          <p className="text-sm text-gray-800 font-medium mb-1">{s.issue}</p>
                          <p className="text-sm text-gray-600 mb-2">{s.suggestion}</p>
                          
                          {s.splitDetails && (
                            <div className="mt-3 bg-indigo-50 p-3 rounded border border-indigo-100">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-indigo-800 uppercase">Recommended Split</span>
                                    <span className="text-xs font-mono bg-white px-2 py-1 rounded border border-indigo-200 text-indigo-600">{s.splitDetails.newId}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <span className="text-gray-500 block">Flags</span>
                                        <span className="font-mono font-medium text-gray-800 break-all">{s.splitDetails.flags.join('+')}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block">Accuracy (Est.)</span>
                                        <span className="font-bold text-green-600">{s.splitDetails.accuracy}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block">Primary Pred</span>
                                        <span className="font-bold text-gray-800">{s.splitDetails.primaryPrediction}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block">Final Pred</span>
                                        <span className="font-bold text-indigo-700">{s.splitDetails.finalPrediction}</span>
                                    </div>
                                </div>
                            </div>
                          )}

                          <div className="text-xs text-gray-400 mt-2">Affected Matches: {s.affectedMatches}</div>
                        </div>
                      ))
                    )}
                    {result.streamlining.length > 0 && (
                      <div className="mt-4 flex justify-end sticky bottom-0 bg-gray-50 pt-2">
                        <button
                          onClick={() => copyToClipboard(JSON.stringify(result.streamlining, null, 2))}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold text-sm shadow-sm"
                        >
                          <Copy size={16} />
                          Copy All Streamlining
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatternAuditModal;