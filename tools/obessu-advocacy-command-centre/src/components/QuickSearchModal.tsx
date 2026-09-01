import React, { useState, useEffect } from 'react';
import { Search, X, Compass, Building2, BookOpen, CheckSquare, ChevronRight } from 'lucide-react';
import { ActionItem, Opportunity, Paper, Stakeholder } from '../types/advocacy';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunities: Opportunity[];
  stakeholders: Stakeholder[];
  papers: Paper[];
  actions: ActionItem[];
  onSelectOpportunity: (id: string) => void;
}

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({
  isOpen,
  onClose,
  opportunities,
  stakeholders,
  papers,
  actions,
  onSelectOpportunity,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Toggle modal or focus
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.toLowerCase().trim();

  const matchedOpps = q
    ? opportunities.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          o.outreachEntity.toLowerCase().includes(q) ||
          (o.legacyId || '').toLowerCase().includes(q) ||
          o.policyArea.toLowerCase().includes(q)
      ).slice(0, 5)
    : opportunities.slice(0, 3);

  const matchedStakeholders = q
    ? stakeholders.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.canonicalName.toLowerCase().includes(q) ||
          s.aliases?.some((a) => a.toLowerCase().includes(q))
      ).slice(0, 4)
    : stakeholders.slice(0, 2);

  const matchedPapers = q
    ? papers.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.policyArea.toLowerCase().includes(q) ||
          p.keyDemands?.some((d) => d.toLowerCase().includes(q))
      ).slice(0, 4)
    : papers.slice(0, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden space-y-3">
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            autoFocus
            type="text"
            placeholder="Search opportunities, EU stakeholders, position papers..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-sm bg-transparent border-none outline-none text-slate-900 font-medium placeholder:text-slate-400"
          />
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 max-h-[450px] overflow-y-auto space-y-4">
          {/* Opportunities */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block mb-1">
              Advocacy Opportunities ({matchedOpps.length})
            </span>
            <div className="space-y-1">
              {matchedOpps.map((opp) => (
                <div
                  key={opp.id}
                  onClick={() => {
                    onSelectOpportunity(opp.id);
                    onClose();
                  }}
                  className="flex items-center justify-between p-2.5 hover:bg-indigo-50/70 rounded-xl cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Compass className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    <div className="truncate">
                      <p className="text-xs font-bold text-slate-900 truncate">{opp.title}</p>
                      <p className="text-[11px] text-slate-500 truncate">{opp.outreachEntity} • {opp.dateOfActivity}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* Stakeholders */}
          {matchedStakeholders.length > 0 && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block mb-1">
                Stakeholders & Institutions ({matchedStakeholders.length})
              </span>
              <div className="space-y-1">
                {matchedStakeholders.map((stk) => (
                  <div
                    key={stk.id}
                    className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Building2 className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-900 truncate">{stk.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{stk.category} • Score {stk.relationshipScore}/100</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {stk.category}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Papers */}
          {matchedPapers.length > 0 && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block mb-1">
                OBESSU Position Papers ({matchedPapers.length})
              </span>
              <div className="space-y-1">
                {matchedPapers.map((paper) => (
                  <div
                    key={paper.id}
                    className="flex items-center justify-between p-2.5 hover:bg-amber-50/70 rounded-xl cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <BookOpen className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-900 truncate">{paper.title}</p>
                        <p className="text-[11px] text-slate-500 truncate">{paper.policyArea} ({paper.year})</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900">
                      {paper.year}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
