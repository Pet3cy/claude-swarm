import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  TrendingUp,
  Target,
  Sparkles,
  Zap,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  Clock,
  Filter,
  Sliders,
  Award,
  ChevronRight,
  FileText,
  Users
} from 'lucide-react';
import { ActionItem, Opportunity, Outcome, PolicyArea, Stakeholder } from '../types/advocacy';

export interface NBAImpactGrowthChartProps {
  opportunities: Opportunity[];
  outcomes: Outcome[];
  stakeholders?: Stakeholder[];
  actions?: ActionItem[];
  onOpenOpportunity?: (oppId: string) => void;
  onOpenBriefingDraft?: (opp: Opportunity) => void;
}

export interface NBAMilestone {
  id: string;
  title: string;
  policyArea: string;
  date: string;
  dayOffset: number; // days from Aug 23, 2026
  nbaScore: number;
  assignedTo: string;
  priority: 'High' | 'Medium' | 'Low';
  impactYield: number; // marginal impact pts
  status: 'pending' | 'completed' | 'in_progress';
  description: string;
}

export const NBAImpactGrowthChart: React.FC<NBAImpactGrowthChartProps> = ({
  opportunities,
  outcomes,
  stakeholders = [],
  actions = [],
  onOpenOpportunity,
  onOpenBriefingDraft
}) => {
  const chartSvgRef = useRef<SVGSVGElement | null>(null);
  const matrixSvgRef = useRef<SVGSVGElement | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);

  // Interactive Scenario & Simulation States
  const [teamVelocity, setTeamVelocity] = useState<number>(100); // 50% - 150%
  const [selectedPolicyFilter, setSelectedPolicyFilter] = useState<string>('all');
  const [selectedScenario, setSelectedScenario] = useState<'all' | 'high_leverage' | 'baseline' | 'lagging'>('all');
  const [hoveredMilestone, setHoveredMilestone] = useState<NBAMilestone | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<NBAMilestone | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'timeline' | 'matrix' | 'priorities'>('timeline');

  // Baseline 2026 Quarter Timeline (Q4 2026: Aug 23 - Nov 30, 2026 - 90 Days)
  const milestoneList: NBAMilestone[] = useMemo(() => {
    return [
      {
        id: 'nba-1',
        title: 'EP VET Own-Initiative Report Compromise Amendments',
        policyArea: 'Education Policy & VET Reform',
        date: '2026-09-08',
        dayOffset: 16,
        nbaScore: 98,
        assignedTo: 'Panagiotis Chatzimichail',
        priority: 'High',
        impactYield: 14,
        status: 'in_progress',
        description: 'Secure secondary vocational student representation clause in rapporteur Brigitte van den Berg draft report.'
      },
      {
        id: 'nba-2',
        title: 'EC DG EAC Youth Stakeholders Advisory Standing Seat',
        policyArea: 'Civic Space & Democratic Participation',
        date: '2026-09-22',
        dayOffset: 30,
        nbaScore: 94,
        assignedTo: 'Secretariat Lead',
        priority: 'High',
        impactYield: 12,
        status: 'pending',
        description: 'Submit institutional charter demands for permanent school student seat in high-level Commission consultations.'
      },
      {
        id: 'nba-3',
        title: 'Post-2027 MFF Joint Civil Society Declaration',
        policyArea: 'Civic Space & Democratic Participation',
        date: '2026-10-10',
        dayOffset: 48,
        nbaScore: 91,
        assignedTo: 'Board Liaison',
        priority: 'High',
        impactYield: 11,
        status: 'pending',
        description: 'Lead education cluster sign-on protecting Erasmus+ and youth chapter ring-fencing against budget consolidation.'
      },
      {
        id: 'nba-4',
        title: 'CEDEFOP Future Skills & AI in Classrooms Hearing',
        policyArea: 'Digital Education & Innovation',
        date: '2026-10-28',
        dayOffset: 66,
        nbaScore: 86,
        assignedTo: 'Policy Officer',
        priority: 'Medium',
        impactYield: 9,
        status: 'pending',
        description: 'Present OBESSU ethical AI in education paper to EU social partners and ETF directors.'
      },
      {
        id: 'nba-5',
        title: 'Council of Europe Advisory Council on Youth (AC) Plenary',
        policyArea: 'International Cooperation & UN/CoE Relations',
        date: '2026-11-12',
        dayOffset: 81,
        nbaScore: 89,
        assignedTo: 'Secretariat Lead',
        priority: 'High',
        impactYield: 10,
        status: 'pending',
        description: 'Adopt draft recommendation on student union freedom of association across all 46 member states.'
      },
      {
        id: 'nba-6',
        title: 'UNESCO Global Youth Report 2026 Launch & Follow-up',
        policyArea: 'International Cooperation & UN/CoE Relations',
        date: '2026-11-28',
        dayOffset: 97,
        nbaScore: 84,
        assignedTo: 'Panagiotis Chatzimichail',
        priority: 'Medium',
        impactYield: 8,
        status: 'pending',
        description: 'Leverage formal citation to initiate bilateral ministerial dialogues in 5 priority member states.'
      }
    ];
  }, []);

  // Filtered Milestones
  const filteredMilestones = useMemo(() => {
    if (selectedPolicyFilter === 'all') return milestoneList;
    return milestoneList.filter((m) => m.policyArea === selectedPolicyFilter);
  }, [milestoneList, selectedPolicyFilter]);

  // Dynamic Trajectory Points calculation based on velocity
  const trajectoryData = useMemo(() => {
    const baselineStart = 53; // Current verified impact points
    const velocityMultiplier = teamVelocity / 100;

    const days = 90;
    const points = [];

    for (let day = 0; day <= days; day += 5) {
      // Calculate milestones achieved up to this day
      const achievedMilestones = filteredMilestones.filter((m) => m.dayOffset <= day);
      const milestoneYieldSum = achievedMilestones.reduce((acc, m) => acc + m.impactYield, 0);

      // High Leverage / Optimistic Curve
      const highLeverage = Math.round(
        baselineStart + (milestoneYieldSum * 1.35 * velocityMultiplier) + Math.pow(day / 90, 1.4) * 22 * velocityMultiplier
      );

      // Baseline Curve
      const baseline = Math.round(
        baselineStart + (milestoneYieldSum * 0.85 * velocityMultiplier) + (day / 90) * 16 * velocityMultiplier
      );

      // Lagging Curve
      const lagging = Math.round(
        baselineStart + (milestoneYieldSum * 0.35) + (day / 90) * 6
      );

      const dateObj = new Date('2026-08-23T00:00:00');
      dateObj.setDate(dateObj.getDate() + day);
      const dateLabel = dateObj.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });

      points.push({
        day,
        dateLabel,
        highLeverage: Math.min(100, highLeverage),
        baseline: Math.min(100, baseline),
        lagging: Math.min(100, lagging)
      });
    }

    return points;
  }, [filteredMilestones, teamVelocity]);

  // Projected Impact at End of Quarter
  const projectedHighEnd = trajectoryData[trajectoryData.length - 1]?.highLeverage || 96;
  const projectedBaseEnd = trajectoryData[trajectoryData.length - 1]?.baseline || 78;
  const projectedSurgePct = Math.round(((projectedHighEnd - 53) / 53) * 100);

  // -------------------------------------------------------------
  // D3 Render: Time-Series Area Trajectory Chart
  // -------------------------------------------------------------
  useEffect(() => {
    if (!chartSvgRef.current || !chartContainerRef.current) return;

    const containerWidth = chartContainerRef.current.clientWidth || 800;
    const width = containerWidth;
    const height = 360;
    const margin = { top: 25, right: 35, bottom: 40, left: 45 };

    const svg = d3.select(chartSvgRef.current);
    svg.selectAll('*').remove();

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X Scale (Days 0 - 90)
    const xScale = d3
      .scaleLinear()
      .domain([0, 90])
      .range([0, innerWidth]);

    // Y Scale (Impact Score 40 - 100)
    const yScale = d3
      .scaleLinear()
      .domain([40, 100])
      .range([innerHeight, 0]);

    // Gridlines
    g.append('g')
      .attr('class', 'grid')
      .attr('opacity', 0.15)
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      );

    // Gradient definitions
    const defs = svg.append('defs');

    // High Leverage Gradient
    const highGrad = defs
      .append('linearGradient')
      .attr('id', 'highLeverageGrad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    highGrad.append('stop').attr('offset', '0%').attr('stop-color', '#6366f1').attr('stop-opacity', 0.4);
    highGrad.append('stop').attr('offset', '100%').attr('stop-color', '#6366f1').attr('stop-opacity', 0.0);

    // Baseline Gradient
    const baseGrad = defs
      .append('linearGradient')
      .attr('id', 'baselineGrad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    baseGrad.append('stop').attr('offset', '0%').attr('stop-color', '#10b981').attr('stop-opacity', 0.25);
    baseGrad.append('stop').attr('offset', '100%').attr('stop-color', '#10b981').attr('stop-opacity', 0.0);

    // Area Generators
    const highArea = d3
      .area<any>()
      .x((d) => xScale(d.day))
      .y0(innerHeight)
      .y1((d) => yScale(d.highLeverage))
      .curve(d3.curveMonotoneX);

    const baseArea = d3
      .area<any>()
      .x((d) => xScale(d.day))
      .y0(innerHeight)
      .y1((d) => yScale(d.baseline))
      .curve(d3.curveMonotoneX);

    // Line Generators
    const highLine = d3
      .line<any>()
      .x((d) => xScale(d.day))
      .y((d) => yScale(d.highLeverage))
      .curve(d3.curveMonotoneX);

    const baseLine = d3
      .line<any>()
      .x((d) => xScale(d.day))
      .y((d) => yScale(d.baseline))
      .curve(d3.curveMonotoneX);

    const lagLine = d3
      .line<any>()
      .x((d) => xScale(d.day))
      .y((d) => yScale(d.lagging))
      .curve(d3.curveMonotoneX);

    // Draw Areas
    if (selectedScenario === 'all' || selectedScenario === 'high_leverage') {
      g.append('path')
        .datum(trajectoryData)
        .attr('fill', 'url(#highLeverageGrad)')
        .attr('d', highArea);
    }

    if (selectedScenario === 'all' || selectedScenario === 'baseline') {
      g.append('path')
        .datum(trajectoryData)
        .attr('fill', 'url(#baselineGrad)')
        .attr('d', baseArea);
    }

    // Draw Lines
    if (selectedScenario === 'all' || selectedScenario === 'lagging') {
      g.append('path')
        .datum(trajectoryData)
        .attr('fill', 'none')
        .attr('stroke', '#f43f5e')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5 4')
        .attr('d', lagLine);
    }

    if (selectedScenario === 'all' || selectedScenario === 'baseline') {
      g.append('path')
        .datum(trajectoryData)
        .attr('fill', 'none')
        .attr('stroke', '#10b981')
        .attr('stroke-width', 2.5)
        .attr('d', baseLine);
    }

    if (selectedScenario === 'all' || selectedScenario === 'high_leverage') {
      g.append('path')
        .datum(trajectoryData)
        .attr('fill', 'none')
        .attr('stroke', '#6366f1')
        .attr('stroke-width', 3.5)
        .attr('d', highLine);
    }

    // X Axis
    const xAxis = d3
      .axisBottom(xScale)
      .tickValues([0, 15, 30, 45, 60, 75, 90])
      .tickFormat((d) => {
        const pt = trajectoryData.find((p) => Math.abs(p.day - Number(d)) <= 2);
        return pt ? pt.dateLabel : `Day ${d}`;
      });

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .attr('color', '#94a3b8')
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .attr('fill', '#64748b');

    // Y Axis
    const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat((d) => `${d} pts`);

    g.append('g')
      .call(yAxis)
      .attr('color', '#94a3b8')
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .attr('fill', '#64748b');

    // Baseline Reference Line (Day 0: 53 pts)
    g.append('line')
      .attr('x1', 0)
      .attr('y1', yScale(53))
      .attr('x2', innerWidth)
      .attr('y2', yScale(53))
      .attr('stroke', '#94a3b8')
      .attr('stroke-dasharray', '3 3')
      .attr('stroke-width', 1.2);

    g.append('text')
      .attr('x', innerWidth - 5)
      .attr('y', yScale(53) - 5)
      .attr('text-anchor', 'end')
      .attr('fill', '#64748b')
      .attr('font-size', '9.5px')
      .attr('font-weight', '700')
      .text('Current Baseline: 53 pts');

    // Draw Interactive Milestone Pins on the High Leverage Curve
    const milestonesGroup = g.append('g').attr('class', 'milestones');

    filteredMilestones.forEach((m) => {
      if (m.dayOffset > 90) return;
      const x = xScale(m.dayOffset);
      const matchPt = trajectoryData.find((p) => Math.abs(p.day - m.dayOffset) <= 3) || trajectoryData[0];
      const y = yScale(matchPt.highLeverage);

      const mG = milestonesGroup
        .append('g')
        .attr('transform', `translate(${x},${y})`)
        .attr('class', 'cursor-pointer')
        .on('mouseenter', () => setHoveredMilestone(m))
        .on('mouseleave', () => setHoveredMilestone(null))
        .on('click', () => setSelectedMilestone(m));

      // Vertical connecting line to baseline
      mG.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', 0)
        .attr('y2', innerHeight - y)
        .attr('stroke', '#6366f1')
        .attr('stroke-width', 1.2)
        .attr('stroke-dasharray', '2 2')
        .attr('opacity', 0.5);

      // Pulse ring
      mG.append('circle')
        .attr('r', 8.5)
        .attr('fill', 'none')
        .attr('stroke', '#6366f1')
        .attr('stroke-width', 2)
        .attr('opacity', 0.4);

      // Main pin
      mG.append('circle')
        .attr('r', 5.5)
        .attr('fill', '#ffffff')
        .attr('stroke', '#4f46e5')
        .attr('stroke-width', 3)
        .attr('class', 'transition-transform hover:scale-125');

      // Small label
      mG.append('text')
        .attr('y', -11)
        .attr('text-anchor', 'middle')
        .attr('fill', '#312e81')
        .attr('font-size', '9px')
        .attr('font-weight', '800')
        .text(`+${m.impactYield}`);
    });
  }, [trajectoryData, selectedScenario, filteredMilestones]);

  // -------------------------------------------------------------
  // D3 Render: Prioritization Matrix / Bubble Chart
  // -------------------------------------------------------------
  useEffect(() => {
    if (!matrixSvgRef.current || activeSubTab !== 'matrix') return;

    const width = 760;
    const height = 340;
    const margin = { top: 20, right: 30, bottom: 40, left: 45 };

    const svg = d3.select(matrixSvgRef.current);
    svg.selectAll('*').remove();

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // X Scale: Urgency (Days to deadline: 0 - 100)
    const xScale = d3.scaleLinear().domain([0, 100]).range([0, innerWidth]);

    // Y Scale: Strategic NBA Score (70 - 100)
    const yScale = d3.scaleLinear().domain([75, 100]).range([innerHeight, 0]);

    // High Priority Zone Background (Top Left: Days < 45, Score > 88)
    g.append('rect')
      .attr('x', xScale(0))
      .attr('y', yScale(100))
      .attr('width', xScale(45) - xScale(0))
      .attr('height', yScale(88) - yScale(100))
      .attr('fill', '#6366f1')
      .attr('opacity', 0.08)
      .attr('rx', 12);

    g.append('text')
      .attr('x', xScale(5))
      .attr('y', yScale(98))
      .attr('fill', '#4f46e5')
      .attr('font-size', '10px')
      .attr('font-weight', '800')
      .text('⚡ High-Leverage Strategic Priority Zone');

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(5).tickFormat((d) => `In ${d} Days`))
      .attr('color', '#94a3b8');

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5).tickFormat((d) => `${d} NBA`))
      .attr('color', '#94a3b8');

    // Render Bubbles
    milestoneList.forEach((m) => {
      const cx = xScale(m.dayOffset);
      const cy = yScale(m.nbaScore);
      const r = Math.max(10, Math.min(22, 8 + m.impactYield * 1.1));

      const bG = g
        .append('g')
        .attr('transform', `translate(${cx},${cy})`)
        .attr('class', 'cursor-pointer')
        .on('mouseenter', () => setHoveredMilestone(m))
        .on('mouseleave', () => setHoveredMilestone(null))
        .on('click', () => setSelectedMilestone(m));

      bG.append('circle')
        .attr('r', r)
        .attr('fill', m.priority === 'High' ? '#6366f1' : '#10b981')
        .attr('fill-opacity', 0.75)
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2);

      bG.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('fill', '#ffffff')
        .attr('font-size', '9px')
        .attr('font-weight', 'bold')
        .text(m.nbaScore);

      bG.append('text')
        .attr('y', r + 11)
        .attr('text-anchor', 'middle')
        .attr('fill', '#1e293b')
        .attr('font-size', '9px')
        .attr('font-weight', '600')
        .text(m.title.length > 22 ? `${m.title.slice(0, 20)}…` : m.title);
    });
  }, [activeSubTab, milestoneList]);

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6 animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-xs font-black uppercase tracking-wider text-indigo-600">
              Next Best Action (NBA) Impact Projection Engine
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            Q4 2026 Strategic Impact Trajectory & Leverage Growth
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl">
            Simulate compound policy uptake and statutory standing seats over the coming quarter. Prioritize advocacy actions with the highest marginal return per team hour.
          </p>
        </div>

        {/* Sub-view switchers */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl self-start lg:self-center">
          <button
            type="button"
            onClick={() => setActiveSubTab('timeline')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'timeline' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
            <span>Trajectory Curve</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('matrix')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'matrix' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Target className="w-3.5 h-3.5 text-emerald-600" />
            <span>Leverage Matrix</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('priorities')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'priorities' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            <span>High-Yield Actions</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
        <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl">
          <span className="text-[10px] font-extrabold uppercase text-indigo-900">Current Baseline</span>
          <p className="text-2xl font-black text-indigo-950 mt-0.5">53 pts</p>
          <span className="text-[10px] text-indigo-700 font-medium">Verified 2026 outcomes</span>
        </div>

        <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
          <span className="text-[10px] font-extrabold uppercase text-emerald-900">Projected High-Yield</span>
          <p className="text-2xl font-black text-emerald-950 mt-0.5">{projectedHighEnd} pts</p>
          <span className="text-[10px] text-emerald-700 font-bold">+{projectedSurgePct}% Q4 surge</span>
        </div>

        <div className="p-3.5 bg-purple-50/70 border border-purple-100 rounded-2xl">
          <span className="text-[10px] font-extrabold uppercase text-purple-900">Baseline Cadence</span>
          <p className="text-2xl font-black text-purple-950 mt-0.5">{projectedBaseEnd} pts</p>
          <span className="text-[10px] text-purple-700 font-medium">Standard follow-up rate</span>
        </div>

        <div className="p-3.5 bg-amber-50/70 border border-amber-100 rounded-2xl">
          <span className="text-[10px] font-extrabold uppercase text-amber-900">NBA Milestones</span>
          <p className="text-2xl font-black text-amber-950 mt-0.5">{filteredMilestones.length}</p>
          <span className="text-[10px] text-amber-700 font-medium">Next 90 days windows</span>
        </div>
      </div>

      {/* Interactive Simulation Controls */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
        {/* Scenario Selectors */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Trajectory:</span>
          {[
            { id: 'all', label: 'All 3 Scenarios' },
            { id: 'high_leverage', label: '🚀 High-Leverage' },
            { id: 'baseline', label: '⚖️ Baseline' },
            { id: 'lagging', label: '⚠️ Lagging' }
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedScenario(s.id as any)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                selectedScenario === s.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Team Velocity Slider */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5 text-indigo-600" />
            <span>Advocacy Velocity:</span>
          </span>
          <input
            type="range"
            min="60"
            max="140"
            step="5"
            value={teamVelocity}
            onChange={(e) => setTeamVelocity(Number(e.target.value))}
            className="w-28 accent-indigo-600"
          />
          <span className="font-mono font-extrabold text-indigo-700 px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-md">
            {teamVelocity}%
          </span>
        </div>
      </div>

      {/* Sub-Tab 1: Trajectory Curve Visualizer */}
      {activeSubTab === 'timeline' && (
        <div className="space-y-4">
          <div className="relative bg-white rounded-2xl border border-slate-200 p-2 overflow-x-auto" ref={chartContainerRef}>
            <svg ref={chartSvgRef} className="w-full h-[360px] min-w-[650px] block" />
          </div>

          {/* Hover / Selected Milestone Card */}
          {(hoveredMilestone || selectedMilestone) && (
            <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-indigo-600 text-white rounded-md">
                    NBA Score: {(hoveredMilestone || selectedMilestone)!.nbaScore}/100
                  </span>
                  <span className="font-extrabold text-indigo-950">
                    {(hoveredMilestone || selectedMilestone)!.title}
                  </span>
                </div>
                <p className="text-[11px] text-indigo-900">
                  {(hoveredMilestone || selectedMilestone)!.description}
                </p>
                <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono pt-0.5">
                  <span>📅 Due: {(hoveredMilestone || selectedMilestone)!.date}</span>
                  <span>👤 Lead: {(hoveredMilestone || selectedMilestone)!.assignedTo}</span>
                  <span className="font-bold text-emerald-700">⚡ Marginal Impact: +{(hoveredMilestone || selectedMilestone)!.impactYield} pts</span>
                </div>
              </div>

              {onOpenOpportunity && (
                <button
                  type="button"
                  onClick={() => {
                    const matchOpp = opportunities.find((o) => o.policyArea === (hoveredMilestone || selectedMilestone)!.policyArea) || opportunities[0];
                    if (matchOpp) onOpenOpportunity(matchOpp.id);
                  }}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 self-start sm:self-center shadow-xs flex-shrink-0"
                >
                  <span>Open Dossier</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 2: Prioritization Leverage Matrix */}
      {activeSubTab === 'matrix' && (
        <div className="space-y-4">
          <div className="p-2 bg-white rounded-2xl border border-slate-200 overflow-x-auto">
            <svg ref={matrixSvgRef} className="w-full h-[340px] min-w-[700px] block" />
          </div>
          <p className="text-[11px] text-slate-500 italic text-center">
            Bubble size indicates marginal policy yield. Top-left quadrant represents high-urgency, high-leverage statutory windows.
          </p>
        </div>
      )}

      {/* Sub-Tab 3: High-Yield Prioritized Action Items */}
      {activeSubTab === 'priorities' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Ranked High-Leverage Next Best Actions ({filteredMilestones.length})
            </h3>
            <span className="text-xs text-slate-500">Sorted by Impact Yield</span>
          </div>

          <div className="space-y-2.5">
            {filteredMilestones.map((m, idx) => (
              <div
                key={m.id}
                className="p-4 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 rounded-2xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-slate-900">{m.title}</h4>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md font-mono">
                        NBA {m.nbaScore}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 font-mono">
                        +{m.impactYield} pts
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">{m.description}</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                      <span>📅 {m.date}</span>
                      <span>📂 {m.policyArea}</span>
                      <span>👤 {m.assignedTo}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-[10px]">
                    High Return
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
