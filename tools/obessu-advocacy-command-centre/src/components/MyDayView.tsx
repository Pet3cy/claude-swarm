import React, { useState, useMemo } from 'react';
import {
  Sun,
  Flame,
  CheckCircle2,
  Clock,
  Calendar,
  ArrowRight,
  Sparkles,
  BookOpen,
  FileText,
  Building2,
  Send,
  Plus,
  RefreshCw,
  Info,
  CalendarPlus,
  CheckSquare,
  ChevronRight,
  MoreVertical,
  Award,
  Mail,
  Copy,
  Check,
  X,
  Share2,
  Users,
  AlertTriangle,
  ExternalLink,
  Layers
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ActionItem, Opportunity, Paper, Stakeholder, UserProfile } from '../types/advocacy';
import { workspaceService } from '../services/workspaceService';

interface MyDayViewProps {
  currentUser: UserProfile;
  actions: ActionItem[];
  opportunities: Opportunity[];
  stakeholders: Stakeholder[];
  papers: Paper[];
  onCompleteAction: (actionId: string) => void;
  onDeferAction: (actionId: string, days: number) => void;
  onReassignAction: (actionId: string, newAssignee: string) => void;
  onOpenOpportunity: (oppId: string) => void;
  onOpenBriefingDraft: (opp: Opportunity) => void;
  onOpenRecordOutcome: (opp: Opportunity) => void;
  onOpenVoiceDebrief: (opp?: Opportunity) => void;
  hasGoogleToken: boolean;
  onRequireAuth: () => void;
}

export const MyDayView: React.FC<MyDayViewProps> = ({
  currentUser,
  actions,
  opportunities,
  stakeholders,
  papers,
  onCompleteAction,
  onDeferAction,
  onReassignAction,
  onOpenOpportunity,
  onOpenBriefingDraft,
  onOpenRecordOutcome,
  onOpenVoiceDebrief,
  hasGoogleToken,
  onRequireAuth,
}) => {
  const [syncingTaskId, setSyncingTaskId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [scoreInfoActionId, setScoreInfoActionId] = useState<string | null>(null);

  // Weekly NBA Digest Modal state
  const [isDigestModalOpen, setIsDigestModalOpen] = useState(false);
  const [digestIntroNote, setDigestIntroNote] = useState(
    'Dear Secretariat & Governing Board, here is the curated Next Best Action (NBA) digest outlining our top European advocacy priorities, legislative deadlines, and upcoming institutional hearings for this week.'
  );
  const [digestRecipients, setDigestRecipients] = useState('secretariat@obessu.org, board@obessu.org');
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [copiedDigest, setCopiedDigest] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filter actions for current user that are active (todo / in_progress) and not deferred to future
  const now = new Date();
  const userActions = actions
    .filter((a) => {
      // If action is assigned to current user, or if assigned to default lead Panagiotis when logged in as Panagiotis
      if (a.assignedTo === currentUser.name) return true;
      if (!a.assignedTo || a.assignedTo === 'Unassigned') {
        return currentUser.role.includes('Head of External') || currentUser.role.includes('Policy') || currentUser.role.includes('Secretary');
      }
      return false;
    })
    .filter((a) => {
      if (a.status === 'done') return false;
      if (a.deferredUntil && new Date(a.deferredUntil) > now) return false;
      return true;
    })
    .sort((a, b) => b.nbaScore - a.nbaScore);

  // Top 3 Next Best Actions guardrail
  const topActions = userActions.slice(0, 3);
  const remainingActions = userActions.slice(3);

  // Upcoming active opportunities in next 14 days
  const upcomingEvents = opportunities
    .filter((o) => {
      if (o.replyStatus === 'Not going' || o.replyStatus === 'Declined') return false;
      if (!o.dateOfActivity) return false;
      const actDate = new Date(o.dateOfActivity);
      const diffDays = (actDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
      return diffDays >= -1 && diffDays <= 21;
    })
    .sort((a, b) => new Date(a.dateOfActivity).getTime() - new Date(b.dateOfActivity).getTime())
    .slice(0, 5);

  // Follow-ups due (completed events without outcome or recent)
  const followUpsDue = opportunities.filter((o) => o.replyStatus === 'Completed' && !o.outcome).slice(0, 3);

  // Metrics
  const totalMinutes = topActions.reduce((acc, a) => acc + (a.estimatedMinutes || 30), 0);
  const completedTodayCount = actions.filter((a) => {
    if (a.status !== 'done' || !a.completedAt) return false;
    const compDate = new Date(a.completedAt);
    return compDate.toDateString() === now.toDateString();
  }).length;

  // ==========================================
  // WEEKLY NBA DIGEST AGGREGATION & BUILDER
  // ==========================================
  const overdueActions = useMemo(() => {
    return actions.filter((a) => {
      if (a.status === 'done') return false;
      if (!a.dueAt) return false;
      return new Date(a.dueAt).getTime() < now.getTime();
    }).sort((a, b) => b.nbaScore - a.nbaScore);
  }, [actions, now]);

  const upcomingWeekActions = useMemo(() => {
    const sevenDaysMs = 7 * 86400000;
    return actions.filter((a) => {
      if (a.status === 'done') return false;
      if (!a.dueAt) return true;
      const dueTime = new Date(a.dueAt).getTime();
      return dueTime >= now.getTime() && dueTime <= now.getTime() + sevenDaysMs;
    }).sort((a, b) => b.nbaScore - a.nbaScore);
  }, [actions, now]);

  const highPriorityAllActions = useMemo(() => {
    return actions
      .filter((a) => a.status !== 'done' && (a.priority === 'High' || a.nbaScore >= 75))
      .sort((a, b) => b.nbaScore - a.nbaScore)
      .slice(0, 10);
  }, [actions]);

  const upcomingWeekHearings = useMemo(() => {
    const sevenDaysMs = 7 * 86400000;
    return opportunities
      .filter((o) => {
        if (o.replyStatus === 'Declined' || o.replyStatus === 'Not going') return false;
        if (!o.dateOfActivity) return false;
        const actTime = new Date(o.dateOfActivity).getTime();
        return actTime >= now.getTime() - 86400000 && actTime <= now.getTime() + sevenDaysMs;
      })
      .sort((a, b) => new Date(a.dateOfActivity).getTime() - new Date(b.dateOfActivity).getTime());
  }, [opportunities, now]);

  const digestFormattedMarkdown = useMemo(() => {
    const dateStr = new Date().toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const overdueList = overdueActions.slice(0, 5).map((a) => {
      const opp = opportunities.find((o) => o.id === a.opportunityId);
      return `* **[OVERDUE] ${a.title}** (Score: ${a.nbaScore}/100) — Lead: **${a.assignedTo}** | Due: ${a.dueAt.split('T')[0]}${opp ? ` | Entity: ${opp.outreachEntity}` : ''}`;
    }).join('\n');

    const topNbaList = highPriorityAllActions.slice(0, 6).map((a, i) => {
      const opp = opportunities.find((o) => o.id === a.opportunityId);
      return `${i + 1}. **${a.title}** (${a.priority} Priority, Score: ${a.nbaScore}/100)\n   * Assignee: **${a.assignedTo}** | Deadline: ${a.dueAt.split('T')[0]}\n   * Strategic Justification: ${a.reason}${opp ? `\n   * Related Policy File: ${opp.title} (${opp.policyArea})` : ''}`;
    }).join('\n\n');

    const hearingsList = upcomingWeekHearings.length > 0
      ? upcomingWeekHearings.map((h) => `* **${h.title}** — ${h.outreachEntity}\n  * Date: **${h.dateOfActivity}** | Venue: ${h.venue || 'Brussels'}\n  * Policy Area: ${h.policyArea} | Lead: **${h.assignedTo}**`).join('\n')
      : '* No formal institutional hearings scheduled for the next 7 days.';

    const followUpsList = followUpsDue.length > 0
      ? followUpsDue.map((f) => `* **${f.title}** (${f.outreachEntity}) — Event completed on ${f.dateOfActivity}; policy outcome & evidence logging pending.`).join('\n')
      : '* All past event debriefs and outcome logs are currently up to date.';

    return `# OBESSU Strategic Advocacy & Next Best Action (NBA) Digest
**Week of ${dateStr}**
*Dispatched by Panagiotis Chatzimichail • Head of External Affairs*

---

### 📌 Secretariat Strategic Note
${digestIntroNote}

---

### 🚨 Critical & Overdue Advocacy Actions (${overdueActions.length} Total)
${overdueList || '* No overdue actions across the team! All critical deadlines met.'}

---

### ⚡ Top Ranked Next Best Actions (This Week's Priorities)
${topNbaList}

---

### 🏛️ European Institutional Milestones & Hearings (Next 7 Days)
${hearingsList}

---

### 📝 Strategic Outcomes & Follow-up Debriefs Needed
${followUpsList}

---
*OBESSU Advocacy Command Centre • Organising Bureau of European School Student Unions*
*Rue de la Sablonnière 20, 1000 Brussels, Belgium • www.obessu.org*`;
  }, [overdueActions, highPriorityAllActions, upcomingWeekHearings, followUpsDue, opportunities, digestIntroNote]);

  const handleCopyDigest = async () => {
    try {
      await navigator.clipboard.writeText(digestFormattedMarkdown);
      setCopiedDigest(true);
      showToast('Weekly NBA Digest copied to clipboard!');
      setTimeout(() => setCopiedDigest(false), 2500);
    } catch {
      showToast('Failed to copy digest');
    }
  };

  const handleCreateGmailDraftDigest = async () => {
    if (!hasGoogleToken) {
      onRequireAuth();
      return;
    }
    try {
      setIsCreatingDraft(true);
      const subject = `[OBESSU Weekly NBA Digest] European Advocacy Priorities • Week of ${new Date().toLocaleDateString('en-GB')}`;
      await workspaceService.createDraft(digestRecipients, subject, digestFormattedMarkdown);
      showToast('Draft created in your Gmail account successfully!');
    } catch (err: any) {
      showToast(`Gmail draft error: ${err.message}`);
    } finally {
      setIsCreatingDraft(false);
    }
  };

  const handleSendGmailDigest = async () => {
    if (!hasGoogleToken) {
      onRequireAuth();
      return;
    }
    try {
      setIsSendingEmail(true);
      const subject = `[OBESSU Weekly NBA Digest] European Advocacy Priorities • Week of ${new Date().toLocaleDateString('en-GB')}`;
      await workspaceService.sendEmail(digestRecipients, subject, digestFormattedMarkdown);
      showToast('Weekly NBA Digest sent to team via Gmail!');
      setIsDigestModalOpen(false);
    } catch (err: any) {
      showToast(`Send email error: ${err.message}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleCompleteWithCelebration = (actionId: string, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    confetti({
      particleCount: 40,
      spread: 60,
      origin: {
        x: (rect.left + rect.width / 2) / window.innerWidth,
        y: (rect.top + rect.height / 2) / window.innerHeight,
      },
      colors: ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b'],
    });
    onCompleteAction(actionId);
    showToast('Action marked as completed! Workflow updated.');
  };

  const handleSyncToGoogleTasks = async (action: ActionItem) => {
    if (!hasGoogleToken) {
      onRequireAuth();
      return;
    }
    try {
      setSyncingTaskId(action.id);
      await workspaceService.createTask({
        title: action.title,
        notes: `${action.description || ''}\nReason: ${action.reason}\nNBA Score: ${action.nbaScore}/100`,
        due: action.dueAt,
      });
      showToast('Successfully synced to Google Tasks!');
    } catch (err: any) {
      showToast(`Google Tasks error: ${err.message}`);
    } finally {
      setSyncingTaskId(null);
    }
  };

  const handleSyncEventToCalendar = async (opp: Opportunity) => {
    if (!hasGoogleToken) {
      onRequireAuth();
      return;
    }
    try {
      await workspaceService.createCalendarEvent({
        title: opp.title,
        description: `OBESSU Policy Area: ${opp.policyArea}\nEntity: ${opp.outreachEntity}\nPapers: ${opp.papers?.join(', ') || 'N/A'}\nVenue: ${opp.venue}`,
        location: opp.venue || 'Brussels, Belgium',
        date: opp.dateOfActivity,
      });
      showToast(`Added "${opp.outreachEntity}" to Google Calendar!`);
    } catch (err: any) {
      showToast(`Calendar error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 text-xs font-medium flex items-center gap-2 animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-indigo-700/40">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="p-1.5 bg-amber-400/20 text-amber-300 rounded-lg border border-amber-400/30">
                <Sun className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                Morning Advocacy Dispatch
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-3 flex-wrap">
              <span>Good morning, {currentUser.name.split(' ')[0]}</span>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                currentUser.department === 'Governing Board'
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                  : 'bg-cyan-400/20 text-cyan-200 border border-cyan-400/30'
              }`}>
                {currentUser.department} • {currentUser.role}
              </span>
            </h1>
            <p className="text-indigo-200/90 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              {currentUser.portfolio ? `${currentUser.portfolio} — ` : ''}The Next Best Action engine prioritized your upcoming European policy engagements and briefing deadlines.
            </p>
          </div>

          {/* Quick Workload Status */}
          <div className="flex items-center gap-3 self-start md:self-auto bg-slate-900/60 backdrop-blur-md p-3.5 rounded-2xl border border-indigo-500/30">
            <div className="text-center px-3 border-r border-slate-700">
              <p className="text-[10px] uppercase font-semibold text-slate-400">Planned Today</p>
              <p className="text-lg font-black text-indigo-400">{totalMinutes}m</p>
            </div>
            <div className="text-center px-3 border-r border-slate-700">
              <p className="text-[10px] uppercase font-semibold text-slate-400">NBA Actions</p>
              <p className="text-lg font-black text-white">{topActions.length}</p>
            </div>
            <div className="text-center px-3">
              <p className="text-[10px] uppercase font-semibold text-slate-400">Completed</p>
              <p className="text-lg font-black text-emerald-400">{completedTodayCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: "Do This Next" Top 3 vs Right Sidebar (Upcoming Events & Follow-ups) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: "Do This Next" Priority Queue */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Do This Next (Priority Focus)</h2>
                <p className="text-xs text-slate-500 font-medium">Ranked by Next Best Action Score & Institutional Urgency</p>
              </div>
            </div>

            {/* Generate Weekly NBA Digest Primary Button */}
            <button
              type="button"
              onClick={() => setIsDigestModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-[0.98] text-white rounded-xl text-xs font-extrabold shadow-md transition-all self-start sm:self-auto"
            >
              <Mail className="w-4 h-4 text-indigo-200" />
              <span>Generate Weekly NBA Digest</span>
            </button>
          </div>

          {topActions.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center shadow-xs">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Award className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">All caught up for today!</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                No urgent tasks remaining in your immediate queue. Review the shared team board or explore strategic opportunities.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {topActions.map((action, idx) => {
                const opp = opportunities.find((o) => o.id === action.opportunityId);
                const stakeholder = opp
                  ? stakeholders.find((s) => s.canonicalName === opp.outreachEntity || s.aliases?.includes(opp.outreachEntity))
                  : undefined;
                const isScoreExpanded = scoreInfoActionId === action.id;

                return (
                  <div
                    key={action.id}
                    className="group bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all duration-200 relative overflow-hidden"
                  >
                    {/* Top Row: Rank Badge, NBA Score, Effort, Opportunity Badge */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center shadow-xs">
                          {idx + 1}
                        </span>

                        {/* NBA Score Pill with Explainability Popover Trigger */}
                        <button
                          onClick={() => setScoreInfoActionId(isScoreExpanded ? null : action.id)}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 rounded-xl text-xs font-bold transition-colors"
                          title="Click to see explainable scoring breakdown"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          <span>NBA Score {action.nbaScore}</span>
                          <Info className="w-3 h-3 text-indigo-400" />
                        </button>

                        <span className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-xl text-xs font-medium">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {action.estimatedMinutes} min
                        </span>

                        {opp && (
                          <button
                            onClick={() => onOpenOpportunity(opp.id)}
                            className="text-xs font-medium text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-xl transition-colors truncate max-w-xs"
                          >
                            {opp.outreachEntity}
                          </button>
                        )}
                      </div>

                      {/* Due Countdown */}
                      <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Due {action.dueAt}
                      </span>
                    </div>

                    {/* Action Title and Description */}
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug group-hover:text-indigo-950 transition-colors">
                      {action.title}
                    </h3>
                    {action.description && (
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{action.description}</p>
                    )}

                    {/* Explainable "Why this matters" context box */}
                    <div className="mt-3.5 p-3 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-start gap-2.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 mt-0.5 whitespace-nowrap">
                        Why this matters:
                      </span>
                      <p className="text-xs text-slate-700 font-medium leading-relaxed">{action.reason}</p>
                    </div>

                    {/* Expandable Score Breakdown Box */}
                    {isScoreExpanded && action.factors && (
                      <div className="mt-3 p-4 bg-indigo-950 text-indigo-100 rounded-2xl text-xs space-y-2.5 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between pb-2 border-b border-indigo-800/80 font-bold text-white">
                          <span>Deterministic NBA Formula Breakdown (0-100)</span>
                          <span>Score: {action.nbaScore}/100</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                          <div>
                            <span className="text-indigo-300">Strategic Priority (25%):</span>{' '}
                            <strong className="text-white">{(action.factors.strategicPriority * 100).toFixed(0)}%</strong>
                          </div>
                          <div>
                            <span className="text-indigo-300">Urgency (20%):</span>{' '}
                            <strong className="text-white">{(action.factors.urgency * 100).toFixed(0)}%</strong>
                          </div>
                          <div>
                            <span className="text-indigo-300">Impact Potential (20%):</span>{' '}
                            <strong className="text-white">{(action.factors.impact * 100).toFixed(0)}%</strong>
                          </div>
                          <div>
                            <span className="text-indigo-300">Policy Relevance (15%):</span>{' '}
                            <strong className="text-white">{(action.factors.policyRelevance * 100).toFixed(0)}%</strong>
                          </div>
                          <div>
                            <span className="text-indigo-300">Relationship Value (10%):</span>{' '}
                            <strong className="text-white">{(action.factors.relationshipValue * 100).toFixed(0)}%</strong>
                          </div>
                          <div>
                            <span className="text-indigo-300">Readiness & Context (10%):</span>{' '}
                            <strong className="text-white">{(action.factors.readiness * 100).toFixed(0)}%</strong>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Linked Papers / Stakeholder pills */}
                    {opp && opp.papers && opp.papers.length > 0 && (
                      <div className="mt-3 flex items-center flex-wrap gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Linked OBESSU Papers:</span>
                        {opp.papers.map((p, pIdx) => (
                          <span
                            key={pIdx}
                            className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-lg"
                          >
                            <BookOpen className="w-3 h-3 text-amber-600" />
                            {p}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Action Execution Footer */}
                    <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
                      {/* Left helper shortcuts: Briefing Drafter / Outcome logger */}
                      <div className="flex items-center gap-2">
                        {opp && (
                          <button
                            onClick={() => onOpenBriefingDraft(opp)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Draft AI Briefing
                          </button>
                        )}
                        <button
                          onClick={() => handleSyncToGoogleTasks(action)}
                          disabled={syncingTaskId === action.id}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl transition-colors"
                          title="Sync to Google Tasks"
                        >
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="hidden sm:inline">Push to Tasks</span>
                        </button>
                      </div>

                      {/* Right controls: Complete, Defer, More */}
                      <div className="flex items-center gap-2">
                        <div className="relative group/defer">
                          <button className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl transition-colors">
                            Defer ▾
                          </button>
                          <div className="hidden group-hover/defer:block absolute right-0 bottom-full mb-1 w-32 bg-slate-900 text-white rounded-xl shadow-xl p-1 z-30 text-xs">
                            <button
                              onClick={() => onDeferAction(action.id, 1)}
                              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-800"
                            >
                              +1 Day
                            </button>
                            <button
                              onClick={() => onDeferAction(action.id, 3)}
                              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-800"
                            >
                              +3 Days
                            </button>
                            <button
                              onClick={() => onDeferAction(action.id, 7)}
                              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-800"
                            >
                              +1 Week
                            </button>
                          </div>
                        </div>

                        <button
                          onClick={(e) => handleCompleteWithCelebration(action.id, e)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Complete Action</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Collapsible Secondary Actions */}
          {remainingActions.length > 0 && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-3xl">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-semibold">{remainingActions.length} additional tasks in queue</span>
                <span className="text-[11px] text-slate-400">Guarded to keep your focus on Top 3</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Upcoming Schedule & Follow-ups Due */}
        <div className="space-y-6">
          {/* Audio Quick Voice Debrief Card */}
          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-5 text-white shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-md">
                Post-Meeting Tool
              </span>
              <Sparkles className="w-4 h-4 text-cyan-300" />
            </div>
            <h3 className="text-base font-bold">Voice Debrief Transcriber</h3>
            <p className="text-xs text-indigo-100 mt-1 leading-relaxed">
              Just finished an EU meeting? Record a quick voice memo to automatically transcribe, extract outcomes, and generate follow-up emails via your local Whisper + LLM (Ollama).
            </p>
            <button
              onClick={() => onOpenVoiceDebrief()}
              className="mt-4 w-full py-2.5 bg-white hover:bg-slate-100 text-indigo-900 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <Sun className="w-4 h-4 text-indigo-600" />
              <span>Record Meeting Debrief</span>
            </button>
          </div>

          {/* Upcoming High-Value Events */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>Upcoming Engagements</span>
              </h3>
              <span className="text-[11px] text-slate-400">Next 3 Weeks</span>
            </div>

            <div className="space-y-3">
              {upcomingEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-900 line-clamp-1">{ev.title}</p>
                      <p className="text-[11px] text-slate-500 font-medium">{ev.outreachEntity}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 whitespace-nowrap">
                      {ev.dateOfActivity}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                    <span className="text-[10px] text-slate-500 font-medium">{ev.venue}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleSyncEventToCalendar(ev)}
                        className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"
                        title="Add to Google Calendar"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onOpenOpportunity(ev.id)}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center"
                      >
                        <span>View</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Follow-ups that are due */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-600" />
                <span>Follow-ups & Evidence Due</span>
              </h3>
              <span className="text-[11px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-md">
                {followUpsDue.length} pending
              </span>
            </div>

            {followUpsDue.length === 0 ? (
              <p className="text-xs text-slate-500 italic">All completed events have recorded evidence.</p>
            ) : (
              <div className="space-y-3">
                {followUpsDue.map((opp) => (
                  <div key={opp.id} className="p-3 bg-amber-50/50 border border-amber-200/60 rounded-2xl space-y-2">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{opp.outreachEntity}</p>
                      <p className="text-[11px] text-slate-600 line-clamp-1">{opp.title}</p>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => onOpenRecordOutcome(opp)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Award className="w-3 h-3" />
                        <span>Log Outcome</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* WEEKLY NBA DIGEST EMAIL MODAL                                  */}
      {/* ============================================================== */}
      {isDigestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-6 sm:p-8 border border-slate-200 space-y-5 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-purple-600 text-white rounded-2xl shadow-xs">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Weekly Next Best Action (NBA) Team Digest
                  </h3>
                  <p className="text-xs text-slate-500">
                    Curated executive summary of high-priority advocacy actions, upcoming hearings & overdue tasks for team email dispatch
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDigestModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-4 gap-2.5 flex-shrink-0 text-xs">
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl text-center">
                <span className="text-[10px] font-extrabold uppercase text-indigo-500">Top Priorities</span>
                <p className="text-lg font-black text-indigo-900 mt-0.5">{highPriorityAllActions.length}</p>
              </div>
              <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-2xl text-center">
                <span className="text-[10px] font-extrabold uppercase text-rose-500">Overdue Items</span>
                <p className="text-lg font-black text-rose-900 mt-0.5">{overdueActions.length}</p>
              </div>
              <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-2xl text-center">
                <span className="text-[10px] font-extrabold uppercase text-purple-500">Hearings (7d)</span>
                <p className="text-lg font-black text-purple-900 mt-0.5">{upcomingWeekHearings.length}</p>
              </div>
              <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-2xl text-center">
                <span className="text-[10px] font-extrabold uppercase text-amber-500">Debriefs Due</span>
                <p className="text-lg font-black text-amber-900 mt-0.5">{followUpsDue.length}</p>
              </div>
            </div>

            {/* Config: Recipients & Intro Note */}
            <div className="space-y-3 flex-shrink-0 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Email Recipients (Secretariat & Board)</label>
                <input
                  type="text"
                  value={digestRecipients}
                  onChange={(e) => setDigestRecipients(e.target.value)}
                  placeholder="secretariat@obessu.org, board@obessu.org"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Secretariat Intro / Context Note</label>
                <textarea
                  rows={2}
                  value={digestIntroNote}
                  onChange={(e) => setDigestIntroNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 leading-relaxed"
                />
              </div>
            </div>

            {/* Markdown Preview */}
            <div className="flex-1 overflow-y-auto min-h-48 p-4 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 font-mono text-xs leading-relaxed whitespace-pre-wrap selection:bg-indigo-500 selection:text-white">
              {digestFormattedMarkdown}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 flex-shrink-0 flex-wrap">
              <button
                type="button"
                onClick={handleCopyDigest}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                {copiedDigest ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                <span>{copiedDigest ? 'Copied to Clipboard!' : 'Copy Formatted Digest'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreateGmailDraftDigest}
                  disabled={isCreatingDraft}
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Mail className="w-4 h-4 text-indigo-600" />
                  <span>{isCreatingDraft ? 'Creating Draft...' : 'Create Gmail Draft'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendGmailDigest}
                  disabled={isSendingEmail}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-[0.99] text-white rounded-xl text-xs font-extrabold shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSendingEmail ? 'Sending Dispatch...' : 'Send to Team via Gmail'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
