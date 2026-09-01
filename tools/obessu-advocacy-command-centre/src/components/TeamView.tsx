import React, { useState, useMemo } from 'react';
import {
  Users,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Filter,
  UserPlus,
  ArrowRight,
  ShieldCheck,
  Briefcase,
  ChevronRight,
  ExternalLink,
  Mail,
  Award,
  BookOpen,
  Sparkles,
  Building,
  GraduationCap,
  Layers,
  Search
} from 'lucide-react';
import { ActionItem, Opportunity, UserProfile } from '../types/advocacy';

interface TeamViewProps {
  actions: ActionItem[];
  opportunities: Opportunity[];
  users: UserProfile[];
  currentUser: UserProfile;
  onUpdateActionStatus: (actionId: string, newStatus: ActionItem['status']) => void;
  onReassignAction: (actionId: string, newAssignee: string) => void;
  onOpenOpportunity: (oppId: string) => void;
}

export const TeamView: React.FC<TeamViewProps> = ({
  actions,
  opportunities,
  users,
  currentUser,
  onUpdateActionStatus,
  onReassignAction,
  onOpenOpportunity,
}) => {
  const [departmentTab, setDepartmentTab] = useState<'all' | 'Secretariat' | 'Governing Board'>('all');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemberModal, setSelectedMemberModal] = useState<UserProfile | null>(null);

  // Workload calculations per user
  const userWorkload = useMemo(() => {
    return users.map((user) => {
      const userActiveActions = actions.filter(
        (a) => a.assignedTo === user.name && a.status !== 'done'
      );
      const totalMinutes = userActiveActions.reduce((sum, a) => sum + (a.estimatedMinutes || 30), 0);
      const doneCount = actions.filter((a) => a.assignedTo === user.name && a.status === 'done').length;

      let capacityState: 'light' | 'optimal' | 'heavy' = 'optimal';
      if (totalMinutes > 240 || userActiveActions.length > 6) capacityState = 'heavy';
      else if (totalMinutes < 60 && userActiveActions.length < 2) capacityState = 'light';

      return {
        user,
        activeCount: userActiveActions.length,
        totalMinutes,
        doneCount,
        capacityState,
        activeActions: userActiveActions,
      };
    });
  }, [users, actions]);

  // Unassigned actions
  const unassignedActions = useMemo(() => {
    return actions.filter((a) => !a.assignedTo || a.assignedTo === 'Unassigned');
  }, [actions]);

  // Items at risk: High priority opportunities happening within 7 days where briefing is not yet done
  const now = new Date();
  const itemsAtRisk = useMemo(() => {
    return opportunities.filter((opp) => {
      if (opp.priority !== 'High' || opp.replyStatus === 'Not going' || opp.replyStatus === 'Declined') return false;
      if (!opp.dateOfActivity) return false;
      const actDate = new Date(opp.dateOfActivity);
      const diffDays = (actDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
      const hasActiveBriefing = actions.some(
        (a) => a.opportunityId === opp.id && a.actionType === 'prepare_briefing' && a.status !== 'done'
      );
      return diffDays >= 0 && diffDays <= 7 && hasActiveBriefing;
    });
  }, [opportunities, actions, now]);

  // Filtered members for directory view
  const filteredUsers = useMemo(() => {
    return userWorkload.filter(({ user }) => {
      if (departmentTab !== 'all' && user.department !== departmentTab) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = user.name.toLowerCase().includes(q);
        const matchRole = user.role.toLowerCase().includes(q);
        const matchPortfolio = (user.portfolio || '').toLowerCase().includes(q);
        const matchEmail = user.email.toLowerCase().includes(q);
        return matchName || matchRole || matchPortfolio || matchEmail;
      }
      return true;
    });
  }, [userWorkload, departmentTab, searchQuery]);

  // Filtered action pipeline
  const filteredActions = useMemo(() => {
    return actions.filter((a) => {
      if (selectedUserFilter !== 'all') {
        if (selectedUserFilter === 'unassigned') {
          if (a.assignedTo && a.assignedTo !== 'Unassigned') return false;
        } else {
          if (a.assignedTo !== selectedUserFilter) return false;
        }
      }
      if (searchQuery && selectedUserFilter !== 'all') {
        const q = searchQuery.toLowerCase();
        return a.title.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [actions, selectedUserFilter, searchQuery]);

  const columns: { id: ActionItem['status']; label: string; color: string; bg: string }[] = [
    { id: 'todo', label: 'Ready for Action', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
    { id: 'in_progress', label: 'In Progress', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
    { id: 'blocked', label: 'Needs Input / Blocked', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
    { id: 'done', label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  ];

  const secretariatCount = users.filter((u) => u.department === 'Secretariat').length;
  const boardCount = users.filter((u) => u.department === 'Governing Board').length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                OBESSU Structure & Governance
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Secretariat & Governing Board
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
              Official OBESSU institutional structure representing school students across Europe. Manage workload capacity, portfolio dossiers, and institutional representation across EU policymaking.
            </p>
          </div>

          {/* Quick Structure Links */}
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href="https://obessu.org/structure/secretariat/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-xl transition-colors"
            >
              <Building className="w-3.5 h-3.5 text-indigo-600" />
              <span>Secretariat Page</span>
              <ExternalLink className="w-3 h-3 text-indigo-400" />
            </a>
            <a
              href="https://obessu.org/structure/board/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-xl transition-colors"
            >
              <GraduationCap className="w-3.5 h-3.5 text-amber-600" />
              <span>Governing Board Page</span>
              <ExternalLink className="w-3 h-3 text-amber-400" />
            </a>
          </div>
        </div>

        {/* Structure Tabs & Search */}
        <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setDepartmentTab('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                departmentTab === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              All Leadership ({users.length})
            </button>
            <button
              onClick={() => setDepartmentTab('Secretariat')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                departmentTab === 'Secretariat'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Secretariat ({secretariatCount})</span>
            </button>
            <button
              onClick={() => setDepartmentTab('Governing Board')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                departmentTab === 'Governing Board'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Governing Board ({boardCount})</span>
            </button>
          </div>

          {/* Search box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, role or portfolio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        {/* Institutional Context Cards */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {(departmentTab === 'all' || departmentTab === 'Secretariat') && (
            <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-indigo-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                  OBESSU Secretariat • Brussels Hub ({secretariatCount} Staff)
                </h4>
              </div>
              <p className="text-xs text-indigo-950/80 leading-relaxed">
                The central operational and coordination hub responsible for day-to-day EU lobbying, project implementation, member outreach, communications, and institutional management.
              </p>
            </div>
          )}

          {(departmentTab === 'all' || departmentTab === 'Governing Board') && (
            <div className="p-4 bg-amber-50/60 border border-amber-100 rounded-2xl">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-amber-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  OBESSU Governing Board • Elected Leadership ({boardCount} Members)
                </h4>
              </div>
              <p className="text-xs text-amber-950/80 leading-relaxed">
                The five elected student leaders responsible for steering political priorities, statutory representation between General Assemblies, and strategic portfolios.
              </p>
            </div>
          )}
        </div>

        {/* Team Members Grid */}
        <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map(({ user, activeCount, totalMinutes, doneCount, capacityState }) => {
            const isSelectedFilter = selectedUserFilter === user.name;
            return (
              <div
                key={user.id}
                className={`p-4.5 rounded-2xl border transition-all flex flex-col justify-between ${
                  isSelectedFilter
                    ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20 shadow-sm'
                    : 'bg-slate-50/80 hover:bg-slate-100/80 border-slate-200/80'
                }`}
              >
                <div>
                  {/* Card Header: Avatar, Name, Department & Role */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl ${user.avatarColor} text-white flex items-center justify-center text-sm font-black shadow-xs flex-shrink-0`}>
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 leading-snug">{user.name}</p>
                        <p className="text-[11px] font-semibold text-indigo-700 leading-tight">{user.role}</p>
                      </div>
                    </div>

                    <span
                      className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md flex-shrink-0 ${
                        user.department === 'Governing Board'
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                      }`}
                    >
                      {user.department === 'Governing Board' ? 'Board' : 'Sec'}
                    </span>
                  </div>

                  {/* Portfolio Tag */}
                  {user.portfolio && (
                    <div className="mt-3 p-2 bg-white rounded-xl border border-slate-200/60 text-[11px] font-medium text-slate-700 leading-tight">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                        Portfolio / Scope:
                      </span>
                      {user.portfolio}
                    </div>
                  )}

                  {/* Short Bio */}
                  {user.bio && (
                    <p className="mt-2 text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {user.bio}
                    </p>
                  )}
                </div>

                {/* Card Footer: Workload Metrics & Filter Action */}
                <div className="mt-4 pt-3 border-t border-slate-200/70">
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
                    <span>Active: <strong>{activeCount} tasks</strong> ({totalMinutes}m)</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                        capacityState === 'heavy'
                          ? 'bg-rose-100 text-rose-800'
                          : capacityState === 'optimal'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {capacityState === 'heavy' ? 'High Load' : capacityState === 'optimal' ? 'Balanced' : 'Available'}
                    </span>
                  </div>

                  {/* Capacity Bar */}
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all ${
                        capacityState === 'heavy' ? 'bg-rose-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${Math.min(100, (totalMinutes / 240) * 100)}%` }}
                    />
                  </div>

                  {/* Card Button Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      onClick={() => setSelectedUserFilter(isSelectedFilter ? 'all' : user.name)}
                      className={`flex-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all text-center ${
                        isSelectedFilter
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white hover:bg-indigo-50 text-indigo-700 border border-slate-200'
                      }`}
                    >
                      {isSelectedFilter ? 'Showing Tasks' : 'Filter Tasks'}
                    </button>
                    <a
                      href={`mailto:${user.email}`}
                      className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 transition-colors"
                      title={`Email ${user.name} (${user.email})`}
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Items At Risk Alert Strip */}
      {itemsAtRisk.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-3xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold">Items At Risk ({itemsAtRisk.length} events this week without completed briefing)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {itemsAtRisk.map((opp) => (
              <div key={opp.id} className="p-3.5 bg-white border border-amber-200 rounded-2xl shadow-xs">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-bold text-amber-800">{opp.dateOfActivity}</span>
                  <span className="font-semibold text-slate-500">{opp.assignedTo}</span>
                </div>
                <p className="text-xs font-bold text-slate-900 line-clamp-1">{opp.title}</p>
                <p className="text-[11px] text-slate-600 mt-0.5">{opp.outreachEntity}</p>
                <button
                  onClick={() => onOpenOpportunity(opp.id)}
                  className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <span>Resolve Briefing</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shared Action Pipeline (Kanban Board) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Action Pipeline & Task Redistribution
            </h2>
            <p className="text-xs text-slate-500">
              {selectedUserFilter === 'all'
                ? 'Showing tasks across all team members'
                : `Filtered to tasks assigned to: ${selectedUserFilter}`}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedUserFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                selectedUserFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Tasks ({actions.length})
            </button>
            {unassignedActions.length > 0 && (
              <button
                onClick={() => setSelectedUserFilter('unassigned')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  selectedUserFilter === 'unassigned'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                }`}
              >
                Unassigned ({unassignedActions.length})
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {columns.map((col) => {
            const colActions = filteredActions.filter((a) => a.status === col.id);
            return (
              <div key={col.id} className="bg-slate-100/70 rounded-2xl p-4 border border-slate-200/80 flex flex-col min-h-[480px]">
                {/* Column Header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className={`text-xs font-extrabold uppercase tracking-wider ${col.color}`}>
                    {col.label}
                  </span>
                  <span className="text-xs font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                    {colActions.length}
                  </span>
                </div>

                {/* Action Cards */}
                <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                  {colActions.length === 0 ? (
                    <div className="h-32 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-xs text-slate-400">
                      No tasks
                    </div>
                  ) : (
                    colActions.map((action) => {
                      const opp = opportunities.find((o) => o.id === action.opportunityId);
                      return (
                        <div
                          key={action.id}
                          className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs hover:shadow-md transition-shadow space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg">
                              Score {action.nbaScore}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">{action.estimatedMinutes}m</span>
                          </div>

                          <h4 className="text-xs font-bold text-slate-900 leading-snug">{action.title}</h4>
                          {opp && (
                            <p className="text-[11px] text-slate-500 line-clamp-1">{opp.outreachEntity}</p>
                          )}

                          {/* Reassign / Assignee Selector */}
                          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2 text-[11px]">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] uppercase font-bold text-slate-400">Lead:</span>
                              <select
                                value={action.assignedTo || 'Unassigned'}
                                onChange={(e) => onReassignAction(action.id, e.target.value)}
                                className="text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-slate-800 max-w-[140px] truncate focus:outline-hidden"
                              >
                                <option value="Unassigned">Unassigned</option>
                                <optgroup label="Secretariat">
                                  {users
                                    .filter((u) => u.department === 'Secretariat')
                                    .map((u) => (
                                      <option key={u.id} value={u.name}>
                                        {u.name} ({u.role})
                                      </option>
                                    ))}
                                </optgroup>
                                <optgroup label="Governing Board">
                                  {users
                                    .filter((u) => u.department === 'Governing Board')
                                    .map((u) => (
                                      <option key={u.id} value={u.name}>
                                        {u.name} (Board)
                                      </option>
                                    ))}
                                </optgroup>
                              </select>
                            </div>

                            {/* Status selector */}
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] uppercase font-bold text-slate-400">Status:</span>
                              <select
                                value={action.status}
                                onChange={(e) => onUpdateActionStatus(action.id, e.target.value as any)}
                                className="text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-slate-700 focus:outline-hidden"
                              >
                                <option value="todo">Ready</option>
                                <option value="in_progress">In Progress</option>
                                <option value="blocked">Blocked</option>
                                <option value="done">Done</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
