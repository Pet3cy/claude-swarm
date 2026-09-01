import React, { useState, useMemo } from 'react';
import {
  Compass,
  Search,
  Filter,
  Calendar,
  MapPin,
  Sparkles,
  BookOpen,
  CheckCircle2,
  Clock,
  Award,
  ChevronRight,
  Plus,
  CalendarPlus,
  FileText,
  Send,
  ExternalLink,
  Tag,
  Building2,
  X
} from 'lucide-react';
import { Opportunity, Paper, PolicyArea, PriorityLevel, Stakeholder, StakeholderCategory, UserProfile } from '../types/advocacy';
import { initialUsers } from '../data/initialData';
import { workspaceService } from '../services/workspaceService';

interface OpportunitiesViewProps {
  opportunities: Opportunity[];
  stakeholders: Stakeholder[];
  papers: Paper[];
  selectedOppId: string | null;
  onSelectOpportunity: (id: string | null) => void;
  onUpdateOpportunity: (opp: Opportunity) => void;
  onCreateOpportunity: (opp: Partial<Opportunity>) => void;
  onOpenBriefingDraft: (opp: Opportunity) => void;
  onOpenRecordOutcome: (opp: Opportunity) => void;
  hasGoogleToken: boolean;
  onRequireAuth: () => void;
}

export const OpportunitiesView: React.FC<OpportunitiesViewProps> = ({
  opportunities,
  stakeholders,
  papers,
  selectedOppId,
  onSelectOpportunity,
  onUpdateOpportunity,
  onCreateOpportunity,
  onOpenBriefingDraft,
  onOpenRecordOutcome,
  hasGoogleToken,
  onRequireAuth,
}) => {
  const [search, setSearch] = useState('');
  const [policyFilter, setPolicyFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [quarterFilter, setQuarterFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'nba' | 'date_asc' | 'date_desc' | 'priority'>('nba');
  const [isCreatingModal, setIsCreatingModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Form state for creating a new opportunity
  const [newTitle, setNewTitle] = useState('');
  const [newEntity, setNewEntity] = useState('');
  const [newPolicyArea, setNewPolicyArea] = useState<PolicyArea>('Civic Space & Democratic Participation');
  const [newPriority, setNewPriority] = useState<PriorityLevel>('High');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newVenue, setNewVenue] = useState('Brussels, Belgium');
  const [newCategory, setNewCategory] = useState<StakeholderCategory>('EU');
  const [newAssignedTo, setNewAssignedTo] = useState<string>('Panagiotis Chatzimichail');
  const [newPapers, setNewPapers] = useState<string[]>([]);

  const selectedOpp = useMemo(
    () => opportunities.find((o) => o.id === selectedOppId) || null,
    [opportunities, selectedOppId]
  );

  const policyAreas: PolicyArea[] = [
    'Digital Education & Innovation',
    'Civic Space & Democratic Participation',
    'Climate & Just Transition',
    'Social Inclusion & Wellbeing',
    'Education Policy & VET Reform',
    'International Cooperation & UN/CoE Relations',
    'Employment & Youth Guarantee',
    'Health & Wellbeing',
  ];

  // Filtering & Sorting
  const filtered = useMemo(() => {
    return opportunities
      .filter((opp) => {
        if (policyFilter !== 'all' && opp.policyArea !== policyFilter) return false;
        if (priorityFilter !== 'all' && opp.priority !== priorityFilter) return false;
        if (categoryFilter !== 'all' && opp.categorySet !== categoryFilter) return false;
        if (quarterFilter !== 'all' && opp.quarter !== quarterFilter) return false;
        if (statusFilter !== 'all' && opp.replyStatus !== statusFilter) return false;

        if (search.trim()) {
          const q = search.toLowerCase();
          const matchTitle = opp.title.toLowerCase().includes(q);
          const matchEntity = opp.outreachEntity.toLowerCase().includes(q);
          const matchId = (opp.legacyId || opp.id).toLowerCase().includes(q);
          const matchPapers = opp.papers?.some((p) => p.toLowerCase().includes(q));
          if (!matchTitle && !matchEntity && !matchId && !matchPapers) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'nba') return (b.nbaScore || 70) - (a.nbaScore || 70);
        if (sortBy === 'date_asc') return new Date(a.dateOfActivity || '').getTime() - new Date(b.dateOfActivity || '').getTime();
        if (sortBy === 'date_desc') return new Date(b.dateOfActivity || '').getTime() - new Date(a.dateOfActivity || '').getTime();
        if (sortBy === 'priority') {
          const pOrder: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
          return (pOrder[b.priority] || 0) - (pOrder[a.priority] || 0);
        }
        return 0;
      });
  }, [opportunities, search, policyFilter, priorityFilter, categoryFilter, quarterFilter, statusFilter, sortBy]);

  const handleSyncToCalendar = async (opp: Opportunity) => {
    if (!hasGoogleToken) {
      onRequireAuth();
      return;
    }
    try {
      await workspaceService.createCalendarEvent({
        title: opp.title,
        description: `OBESSU Advocacy Event\nPolicy Area: ${opp.policyArea}\nEntity: ${opp.outreachEntity}\nPapers: ${opp.papers?.join(', ') || 'N/A'}\nVenue: ${opp.venue}`,
        location: opp.venue || 'Brussels, Belgium',
        date: opp.dateOfActivity,
      });
      showToast(`Added to Google Calendar!`);
    } catch (err: any) {
      showToast(`Calendar error: ${err.message}`);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newEntity.trim()) return;

    onCreateOpportunity({
      title: newTitle,
      outreachEntity: newEntity,
      policyArea: newPolicyArea,
      priority: newPriority,
      dateOfActivity: newDate,
      venue: newVenue,
      categorySet: newCategory,
      assignedTo: newAssignedTo,
      papers: newPapers,
      replyStatus: 'Pending',
      status: 'new',
      quarter: newDate.includes('-01-') || newDate.includes('-02-') || newDate.includes('-03-') ? 'Q1' : 'Q2',
    });

    setIsCreatingModal(false);
    setNewTitle('');
    setNewEntity('');
    showToast('New advocacy opportunity created and scored!');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Controls */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                <Compass className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Institutional Engagement Registry
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">Opportunities & Invitations</h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              {opportunities.length} total invitations and events migrated from official registry. Track workflows, draft AI briefings, and log outcomes.
            </p>
          </div>

          <button
            onClick={() => setIsCreatingModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>New Opportunity</span>
          </button>
        </div>

        {/* Search and Filters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-2 border-t border-slate-100">
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by title, stakeholder, ID (e.g. reg-2026-001), or paper..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 text-slate-800 font-medium placeholder:text-slate-400"
            />
          </div>

          {/* Policy Area Filter */}
          <select
            value={policyFilter}
            onChange={(e) => setPolicyFilter(e.target.value)}
            className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-hidden"
          >
            <option value="all">All Policy Areas</option>
            {policyAreas.map((pa) => (
              <option key={pa} value={pa}>{pa}</option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-hidden"
          >
            <option value="all">All Categories (EU/CSO/CoE)</option>
            <option value="EU">EU Institutions & Agencies</option>
            <option value="Platforms">Platforms & Alliances</option>
            <option value="CoE">Council of Europe (CoE)</option>
            <option value="CSOs">Civil Society (CSOs)</option>
            <option value="International Bodies">International Bodies</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-hidden"
          >
            <option value="all">All Reply Statuses</option>
            <option value="Pending">Pending Decision</option>
            <option value="Completed">Completed</option>
            <option value="Cooperation">Cooperation / Speaking</option>
            <option value="Not going">Not going / Declined</option>
          </select>

          {/* Sort Selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl px-3 py-2 focus:outline-hidden"
          >
            <option value="nba">Sort: NBA Score (Highest)</option>
            <option value="date_desc">Sort: Date (Newest first)</option>
            <option value="date_asc">Sort: Date (Oldest first)</option>
            <option value="priority">Sort: Strategic Priority</option>
          </select>
        </div>
      </div>

      {/* Main Results Table / Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-2">
          <span>Showing {filtered.length} matching entries</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((opp) => {
            const hasOutcome = !!opp.outcome;
            return (
              <div
                key={opp.id}
                onClick={() => onSelectOpportunity(opp.id)}
                className={`bg-white rounded-3xl p-5 border transition-all cursor-pointer hover:shadow-md flex flex-col justify-between space-y-3 ${
                  selectedOppId === opp.id
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 shadow-md'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Top Bar: Legacy ID, NBA Score, Category */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                        {opp.legacyId || opp.id}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          opp.priority === 'High'
                            ? 'bg-rose-100 text-rose-800'
                            : opp.priority === 'Medium'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {opp.priority}
                      </span>
                    </div>

                    <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-indigo-500" />
                      NBA {opp.nbaScore || 75}
                    </span>
                  </div>

                  {/* Outreach Entity and Title */}
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />
                      <span className="truncate">{opp.outreachEntity}</span>
                    </p>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                      {opp.title}
                    </h3>
                  </div>

                  {/* Policy Area Pill */}
                  <div className="mt-2.5">
                    <span className="inline-block text-[11px] font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                      {opp.policyArea}
                    </span>
                  </div>
                </div>

                {/* Bottom Metadata & Status */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{opp.dateOfActivity || 'No date'}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {hasOutcome && (
                      <span className="p-1 bg-emerald-100 text-emerald-700 rounded-md" title="Outcome recorded">
                        <Award className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                        opp.replyStatus === 'Completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : opp.replyStatus === 'Pending'
                          ? 'bg-blue-100 text-blue-800'
                          : opp.replyStatus === 'Cooperation'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {opp.replyStatus}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Opportunity Detail Modal / Drawer */}
      {selectedOpp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                    {selectedOpp.legacyId || selectedOpp.id}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-md">
                    {selectedOpp.categorySet}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-md">
                    {selectedOpp.quarter}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug">
                  {selectedOpp.title}
                </h2>
                <p className="text-xs font-semibold text-indigo-600 mt-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{selectedOpp.outreachEntity}</span>
                </p>
              </div>

              <button
                onClick={() => onSelectOpportunity(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Workflow Pipeline Stepper */}
            <div className="p-4 bg-slate-50 rounded-2xl space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Advocacy Lifecycle Phase</p>
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
                {[
                  { id: 'new', label: '1. New' },
                  { id: 'assessing', label: '2. Assess' },
                  { id: 'accepted', label: '3. Decision' },
                  { id: 'preparing', label: '4. Preparation' },
                  { id: 'engaged', label: '5. Engaged' },
                  { id: 'outcome_captured', label: '6. Outcome' },
                ].map((step, sIdx) => {
                  const isCurrent = selectedOpp.status === step.id;
                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap ${
                        isCurrent
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      <span>{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Key Information Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 font-semibold block mb-0.5">Policy Area</span>
                <span className="font-bold text-slate-800">{selectedOpp.policyArea}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 font-semibold block mb-0.5">Date & Venue</span>
                <span className="font-bold text-slate-800">{selectedOpp.dateOfActivity || 'TBD'} • {selectedOpp.venue}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 font-semibold block mb-0.5">Assigned Lead</span>
                <select
                  value={selectedOpp.assignedTo || 'Unassigned'}
                  onChange={(e) => {
                    onUpdateOpportunity({
                      ...selectedOpp,
                      assignedTo: e.target.value,
                    });
                    showToast(`Reassigned to ${e.target.value}!`);
                  }}
                  className="font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs w-full focus:outline-hidden"
                >
                  <option value="Unassigned">Unassigned</option>
                  <optgroup label="Secretariat">
                    {initialUsers
                      .filter((u) => u.department === 'Secretariat')
                      .map((u) => (
                        <option key={u.id} value={u.name}>
                          {u.name} ({u.role})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Governing Board">
                    {initialUsers
                      .filter((u) => u.department === 'Governing Board')
                      .map((u) => (
                        <option key={u.id} value={u.name}>
                          {u.name} (Board)
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 font-semibold block mb-0.5">Reply Status</span>
                <span className="font-bold text-indigo-700">{selectedOpp.replyStatus}</span>
              </div>
            </div>

            {/* Linked OBESSU Papers */}
            {selectedOpp.papers && selectedOpp.papers.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Associated OBESSU Position Papers
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedOpp.papers.map((paperTitle, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 font-medium"
                    >
                      <BookOpen className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span>{paperTitle}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Substantive Outcome Section */}
            {selectedOpp.outcome ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                  <Award className="w-4 h-4 text-emerald-600" />
                  <span>Documented Outcome: {selectedOpp.outcome.type}</span>
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed font-medium">
                  {selectedOpp.outcome.description}
                </p>
                {selectedOpp.outcome.evidence && (
                  <div className="text-[11px] text-emerald-700 bg-emerald-100/70 p-2 rounded-lg">
                    <strong>Evidence:</strong> {selectedOpp.outcome.evidence}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-700">No Substantive Outcome Logged</p>
                  <p className="text-[11px] text-slate-500">Record a position submission, citation, or joint statement.</p>
                </div>
                <button
                  onClick={() => {
                    onSelectOpportunity(null);
                    onOpenRecordOutcome(selectedOpp);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  Log Outcome
                </button>
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onSelectOpportunity(null);
                    onOpenBriefingDraft(selectedOpp);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  <span>Draft Policy Briefing</span>
                </button>

                <button
                  onClick={() => handleSyncToCalendar(selectedOpp)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl transition-colors"
                >
                  <CalendarPlus className="w-4 h-4 text-slate-500" />
                  <span>Sync Calendar</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedOpp.replyStatus}
                  onChange={(e) => {
                    onUpdateOpportunity({
                      ...selectedOpp,
                      replyStatus: e.target.value as any,
                    });
                    showToast('Updated status!');
                  }}
                  className="text-xs font-bold bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden"
                >
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                  <option value="Cooperation">Cooperation</option>
                  <option value="Not going">Not going</option>
                  <option value="In discussion">In discussion</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Opportunity Modal */}
      {isCreatingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <form
            onSubmit={handleCreateSubmit}
            className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Add New Advocacy Opportunity</h3>
              <button
                type="button"
                onClick={() => setIsCreatingModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Event / Invitation Title</label>
              <input
                type="text"
                required
                placeholder="e.g. EU Youth Strategy Stakeholder Consultation"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Outreach Entity / Org</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. European Commission – DG EAC"
                  value={newEntity}
                  onChange={(e) => setNewEntity(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl text-slate-800"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl text-slate-800"
                >
                  <option value="EU">EU Institutions</option>
                  <option value="Platforms">Platforms</option>
                  <option value="CoE">Council of Europe</option>
                  <option value="CSOs">CSOs</option>
                  <option value="International Bodies">International Bodies</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Policy Area</label>
                <select
                  value={newPolicyArea}
                  onChange={(e) => setNewPolicyArea(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl text-slate-800"
                >
                  {policyAreas.map((pa) => (
                    <option key={pa} value={pa}>{pa}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Priority</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl text-slate-800"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Date of Activity</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl text-slate-800"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Venue / City</label>
                <input
                  type="text"
                  value={newVenue}
                  onChange={(e) => setNewVenue(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Assigned Lead (Secretariat / Board)</label>
              <select
                value={newAssignedTo}
                onChange={(e) => setNewAssignedTo(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl text-slate-800"
              >
                <optgroup label="Secretariat">
                  {initialUsers
                    .filter((u) => u.department === 'Secretariat')
                    .map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Governing Board">
                  {initialUsers
                    .filter((u) => u.department === 'Governing Board')
                    .map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name} (Board Member)
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreatingModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                Save & Score Opportunity
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
