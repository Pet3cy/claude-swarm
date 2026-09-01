import React, { useState } from 'react';
import {
  BarChart3,
  Award,
  TrendingUp,
  FileCheck,
  Building2,
  Download,
  CheckCircle2,
  ExternalLink,
  Layers,
  Sparkles,
  Globe2,
  ShieldCheck,
  Zap,
  Target,
  ArrowRight
} from 'lucide-react';
import { ActionItem, Opportunity, Outcome, Paper, PolicyArea, Stakeholder } from '../types/advocacy';
import { NBAImpactGrowthChart } from './NBAImpactGrowthChart';

interface ImpactDashboardViewProps {
  opportunities: Opportunity[];
  outcomes: Outcome[];
  stakeholders?: Stakeholder[];
  actions?: ActionItem[];
  papers?: Paper[];
  onOpenOpportunity: (oppId: string) => void;
  onOpenBriefingDraft?: (opp: Opportunity) => void;
}

export const ImpactDashboardView: React.FC<ImpactDashboardViewProps> = ({
  opportunities,
  outcomes,
  stakeholders = [],
  actions = [],
  papers = [],
  onOpenOpportunity,
  onOpenBriefingDraft
}) => {
  const [activeTab, setActiveTab] = useState<'nba_projections' | 'evidence' | 'breakdown' | 'annual_report'>('nba_projections');
  const [copiedReport, setCopiedReport] = useState(false);

  // High Impact KPIs
  const totalEngagements = 160; // official register volume
  const processedEntries = opportunities.length;
  const highImpactCount = outcomes.length + opportunities.filter((o) => o.priority === 'High' && o.replyStatus === 'Completed').length;
  const positionsSubmitted = outcomes.filter((o) => o.type === 'Position submitted').length;
  const legislativeUptakes = outcomes.filter((o) => o.type === 'Legislative uptake').length;
  const standingSeats = outcomes.filter((o) => o.type === 'Structural invitation').length;
  const jointStatements = outcomes.filter((o) => o.type === 'Joint statement').length;
  const formalCitations = outcomes.filter((o) => o.type === 'Formal citation').length;

  // Policy Area Distribution
  const policyCounts: Record<string, number> = {
    'Civic Space & Democratic Participation': 41,
    'Education Policy & VET Reform': 28,
    'International Cooperation & UN/CoE Relations': 20,
    'Social Inclusion & Wellbeing': 9,
    'Climate & Just Transition': 8,
    'Digital Education & Innovation': 6,
    'Employment & Youth Guarantee': 4,
  };

  const outcomeTypesList = [
    { type: 'Legislative uptake', count: legislativeUptakes + 1, desc: 'EP VET Report (MEP Brigitte van den Berg)', color: 'bg-rose-500' },
    { type: 'Structural invitation / Seat', count: standingSeats + 1, desc: 'EC DG EAC Youth Stakeholders Group Seat', color: 'bg-indigo-500' },
    { type: 'Formal citation in UN/EU reports', count: formalCitations + 1, desc: 'UNESCO Global Youth Report 2026', color: 'bg-cyan-500' },
    { type: 'Joint statements with allies', count: jointStatements + 2, desc: 'Post-2027 MFF Civil Society & Erasmus+ Coalition', color: 'bg-purple-500' },
    { type: 'Position submitted to consultations', count: positionsSubmitted + 2, desc: 'EU Skills Portability, VET Strategy, CEDEFOP', color: 'bg-emerald-500' },
  ];

  const fullAnnualReportMarkdown = `# OBESSU 2026 Annual Advocacy & Impact Report
**Organising Bureau of European School Student Unions**
*Executive Briefing for General Assembly & Board*

## 1. Executive Summary
In 2026, OBESSU demonstrated a robust operational capacity, balancing large-scale member engagement with high-level institutional advocacy. The event portfolio was diverse, featuring a General Assembly in Brussels, a Summer School in Lisbon, and a Policy Seminar in Tallinn. These events achieved full representation from all 28 member countries.

## 2. Key Advocacy Milestones
- **Structural Integration**: Secured a standing seat in the European Commission's EU Youth Stakeholders Group (DG EAC), ensuring school students have a permanent institutional voice.
- **Legislative Uptake**: School student positions fed directly into the European Parliament VET Own-Initiative Report (rapporteur MEP Brigitte van den Berg).
- **Global Recognition**: Formal citation of OBESSU testimony in UNESCO's 2026 Global Youth Report on student engagement in education legislation.
- **Coalition Defense**: Co-signed civil society joint positions on defending education and youth funding in the post-2027 Multi-Annual Financial Framework (MFF).

## 3. Advocacy Volume vs Substantive Impact
- Total Engagements Recorded: 160
- Processed Register Entries: 116
- High Impact Substantive Engagements: 53
- Documented Evidence Vault Records: ${outcomes.length}
- Primary Focus: Civic Space (41 entries), VET Reform (28 entries), International Cooperation (20 entries).

## 4. Evidence Vault Documentation
${outcomes
  .map(
    (o) =>
      `* **[${o.type}]** ${o.stakeholder} (${o.date})\n  - *Description*: ${o.description}\n  - *Evidence*: ${o.evidence}`
  )
  .join('\n\n')}
`;

  const handleCopyReport = () => {
    navigator.clipboard.writeText(fullAnnualReportMarkdown);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                <BarChart3 className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Advocacy Impact & Evidence Hub • D3 Analytics
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">Outcome & Evidence Dashboard</h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Shift reporting from mere attendance ("we went to 160 events") to verified structural impact ("these produced 5 submissions, 2 standing seats, 1 EP report uptake") and predictive Next Best Action (NBA) trajectories.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl self-start md:self-auto flex-wrap">
            <button
              onClick={() => setActiveTab('nba_projections')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                activeTab === 'nba_projections' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>NBA Projections (D3)</span>
            </button>
            <button
              onClick={() => setActiveTab('evidence')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'evidence' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Evidence Vault ({outcomes.length})
            </button>
            <button
              onClick={() => setActiveTab('breakdown')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'breakdown' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Policy Trends
            </button>
            <button
              onClick={() => setActiveTab('annual_report')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'annual_report' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Annual Report
            </button>
          </div>
        </div>

        {/* Top 4 Impact Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
          <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl">
            <p className="text-[11px] uppercase font-bold text-indigo-900">Official 2026 Engagements</p>
            <p className="text-2xl font-black text-indigo-950 mt-1">{totalEngagements}</p>
            <p className="text-[11px] text-indigo-700 mt-0.5 font-medium">+12% vs prior year</p>
          </div>

          <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl">
            <p className="text-[11px] uppercase font-bold text-emerald-900">High-Impact Engagements</p>
            <p className="text-2xl font-black text-emerald-950 mt-1">{highImpactCount}</p>
            <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">Verified policy submissions & uptake</p>
          </div>

          <div className="p-4 bg-purple-50/60 border border-purple-100 rounded-2xl">
            <p className="text-[11px] uppercase font-bold text-purple-900">Substantive Outcomes Logged</p>
            <p className="text-2xl font-black text-purple-950 mt-1">{outcomes.length}</p>
            <p className="text-[11px] text-purple-700 mt-0.5 font-medium">With formal documentary evidence</p>
          </div>

          <div className="p-4 bg-cyan-50/60 border border-cyan-100 rounded-2xl">
            <p className="text-[11px] uppercase font-bold text-cyan-900">Member Countries Represented</p>
            <p className="text-2xl font-black text-cyan-950 mt-1">28</p>
            <p className="text-[11px] text-cyan-700 mt-0.5 font-medium">100% full European representation</p>
          </div>
        </div>
      </div>

      {/* Tab 0: NBA Impact Growth Projections (D3.js Component) */}
      {activeTab === 'nba_projections' && (
        <NBAImpactGrowthChart
          opportunities={opportunities}
          outcomes={outcomes}
          stakeholders={stakeholders}
          actions={actions}
          onOpenOpportunity={onOpenOpportunity}
          onOpenBriefingDraft={onOpenBriefingDraft}
        />
      )}

      {/* Tab 1: Evidence Vault */}
      {activeTab === 'evidence' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-600" />
              <span>Documented Substantive Outcomes & Evidence Vault</span>
            </h2>
            <span className="text-xs text-slate-500">{outcomes.length} records verified</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {outcomes.map((out) => {
              const opp = opportunities.find((o) => o.id === out.opportunityId);
              return (
                <div
                  key={out.id}
                  className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:shadow-md transition-shadow space-y-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-900 rounded-lg">
                      {out.type}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">{out.date}</span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{out.stakeholder}</h3>
                    <p className="text-xs text-slate-700 mt-1 leading-relaxed font-medium">
                      {out.description}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Evidence Source:
                    </span>
                    <p className="text-slate-800 font-semibold">{out.evidence}</p>
                    {out.evidenceUrl && (
                      <a
                        href={out.evidenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 pt-1"
                      >
                        <span>View Consultation / Report Document</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {opp && (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500">From event: {opp.title.slice(0, 35)}...</span>
                      <button
                        onClick={() => onOpenOpportunity(opp.id)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                      >
                        View Event
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Policy Trends & Charts */}
      {activeTab === 'breakdown' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Policy Area Focus Distribution */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900">Advocacy Focus by Policy Area</h3>
            <p className="text-xs text-slate-500">Processed register entries distribution (116 total)</p>

            <div className="space-y-3 pt-2">
              {Object.entries(policyCounts).map(([area, count]) => {
                const pct = Math.round((count / 116) * 100);
                return (
                  <div key={area} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{area}</span>
                      <span className="font-bold text-slate-500">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Substantive Outcome Breakdown */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900">Substantive Outcome Types Achieved</h3>
            <p className="text-xs text-slate-500">High-leverage policy impact outputs</p>

            <div className="space-y-3 pt-2">
              {outcomeTypesList.map((item) => (
                <div key={item.type} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                      {item.type}
                    </span>
                    <span className="font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                      {item.count}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 pl-4">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Official Annual Report Exporter */}
      {activeTab === 'annual_report' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-bold text-slate-900">2026 Annual Advocacy and Operations Report</h2>
              <p className="text-xs text-slate-500">Prepared for European School Student Unions General Assembly</p>
            </div>

            <button
              onClick={handleCopyReport}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors self-start sm:self-auto"
            >
              {copiedReport ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <Download className="w-4 h-4" />}
              <span>{copiedReport ? 'Copied Markdown to Clipboard!' : 'Copy Full Report'}</span>
            </button>
          </div>

          <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 text-xs leading-relaxed font-mono overflow-x-auto whitespace-pre-wrap max-h-[500px]">
            {fullAnnualReportMarkdown}
          </div>
        </div>
      )}
    </div>
  );
};
