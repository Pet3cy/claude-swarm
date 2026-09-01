import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  Network,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  Filter,
  Search,
  Users,
  Calendar,
  ShieldAlert,
  Sparkles,
  Zap,
  TrendingUp,
  Award,
  FileText,
  CalendarPlus,
  MessageSquarePlus,
  ChevronRight,
  Info,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Maximize2
} from 'lucide-react';
import {
  Stakeholder,
  Opportunity,
  Outcome,
  Paper,
  ActionItem,
  PolicyArea,
  StakeholderCategory,
  EuropeanRegion
} from '../types/advocacy';

export interface NetworkVisualizationProps {
  stakeholders: Stakeholder[];
  opportunities: Opportunity[];
  outcomes: Outcome[];
  papers: Paper[];
  actions?: ActionItem[];
  onSelectStakeholder?: (stakeholder: Stakeholder) => void;
  onOpenOpportunity?: (oppId: string) => void;
  onOpenBriefingDraft?: (opp: Opportunity) => void;
  onOpenQuickNote?: (stakeholder: Stakeholder) => void;
  onOpenScheduleFollowUp?: (stakeholder: Stakeholder) => void;
}

export type NetworkNodeType = 'stakeholder' | 'opportunity' | 'policy_area';

export interface NetworkNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: NetworkNodeType;
  category?: string;
  policyArea?: string;
  region?: string;
  influence?: number;
  alignment?: number;
  priority?: 'High' | 'Medium' | 'Low';
  status?: string;
  date?: string;
  venue?: string;
  radius: number;
  color: string;
  stakeholderData?: Stakeholder;
  opportunityData?: Opportunity;
  isGap?: boolean;
  gapReason?: string;
  connectedCount?: number;
}

export interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode> {
  id: string;
  source: string | NetworkNode;
  target: string | NetworkNode;
  type: 'stakeholder_policy' | 'opp_policy' | 'stakeholder_opp' | 'coalition_synergy';
  weight: number;
  label?: string;
  isGapLink?: boolean;
}

// 8 Canonical Policy Areas with thematic colors
export const POLICY_AREA_CONFIG: Record<string, { color: string; bg: string; icon: string; short: string }> = {
  'Education Policy & VET Reform': { color: '#4f46e5', bg: 'rgba(79, 70, 229, 0.15)', icon: '🎓', short: 'VET & Education' },
  'Civic Space & Democratic Participation': { color: '#059669', bg: 'rgba(5, 150, 105, 0.15)', icon: '🏛️', short: 'Civic Democracy' },
  'Digital Education & Innovation': { color: '#0891b2', bg: 'rgba(8, 145, 178, 0.15)', icon: '💻', short: 'Digital Skills' },
  'Social Inclusion & Wellbeing': { color: '#d97706', bg: 'rgba(217, 119, 6, 0.15)', icon: '🤝', short: 'Inclusion & Equity' },
  'Climate & Just Transition': { color: '#16a34a', bg: 'rgba(22, 163, 74, 0.15)', icon: '🌱', short: 'Climate & Green' },
  'International Cooperation & UN/CoE Relations': { color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.15)', icon: '🌐', short: 'Intl & CoE' },
  'Employment & Youth Guarantee': { color: '#ea580c', bg: 'rgba(234, 88, 12, 0.15)', icon: '💼', short: 'Youth Jobs' },
  'Health & Wellbeing': { color: '#e11d48', bg: 'rgba(225, 29, 72, 0.15)', icon: '❤️', short: 'Health & Wellbeing' }
};

const CATEGORY_COLORS: Record<string, string> = {
  EU: '#4f46e5',
  Platforms: '#059669',
  CoE: '#7c3aed',
  CSOs: '#d97706',
  'International Bodies': '#0891b2',
  MoU: '#ec4899',
  default: '#64748b',
};

export const NetworkVisualization: React.FC<NetworkVisualizationProps> = ({
  stakeholders,
  opportunities,
  outcomes,
  papers,
  actions = [],
  onSelectStakeholder,
  onOpenOpportunity,
  onOpenBriefingDraft,
  onOpenQuickNote,
  onOpenScheduleFollowUp
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Filter & View Controls
  const [selectedPolicyFilter, setSelectedPolicyFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [showNodeTypes, setShowNodeTypes] = useState<{ stakeholders: boolean; opportunities: boolean; policyAreas: boolean }>({
    stakeholders: true,
    opportunities: true,
    policyAreas: true
  });
  const [highlightGapsOnly, setHighlightGapsOnly] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [linkDistanceScale, setLinkDistanceScale] = useState<number>(85);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null);
  const [activeTab, setActiveTab] = useState<'graph' | 'clusters' | 'gaps'>('graph');

  // Build Network Graph Model (Nodes and Links)
  const { nodes, links, clusterStats, coalitionGaps } = useMemo(() => {
    const rawNodes: NetworkNode[] = [];
    const rawLinks: NetworkLink[] = [];
    const nodeMap = new Map<string, NetworkNode>();

    // 1. Create Policy Area Hub Nodes
    const policyAreasList = Object.keys(POLICY_AREA_CONFIG);
    policyAreasList.forEach((policy) => {
      const config = POLICY_AREA_CONFIG[policy];
      const pNode: NetworkNode = {
        id: `policy-${policy}`,
        name: policy,
        type: 'policy_area',
        policyArea: policy,
        radius: 28,
        color: config.color,
        connectedCount: 0
      };
      rawNodes.push(pNode);
      nodeMap.set(pNode.id, pNode);
    });

    // 2. Create Stakeholder Nodes
    stakeholders.forEach((stk) => {
      const influence = stk.influenceScore || stk.relationshipScore || 70;
      const alignment = stk.alignmentScore || 75;
      const categoryColor = CATEGORY_COLORS[stk.category] || CATEGORY_COLORS.default;
      const radius = Math.max(12, Math.min(24, Math.round(10 + (influence / 100) * 14)));

      const sNode: NetworkNode = {
        id: `stk-${stk.id}`,
        name: stk.name,
        type: 'stakeholder',
        category: stk.category,
        region: stk.region || 'Western Europe / Brussels EU Core',
        influence,
        alignment,
        radius,
        color: categoryColor,
        stakeholderData: stk,
        connectedCount: 0
      };
      rawNodes.push(sNode);
      nodeMap.set(sNode.id, sNode);

      // Link Stakeholder to their Primary Policy Domain
      const notesLower = (stk.notes || '').toLowerCase();
      let linkedToPolicy = false;

      policyAreasList.forEach((policy) => {
        const policyLower = policy.toLowerCase();
        const shortLower = (POLICY_AREA_CONFIG[policy]?.short || '').toLowerCase();
        if (
          notesLower.includes(policyLower) ||
          notesLower.includes(shortLower) ||
          (stk.tags && stk.tags.some((t) => policyLower.includes(t.toLowerCase())))
        ) {
          rawLinks.push({
            id: `link-${sNode.id}-${policy}`,
            source: sNode.id,
            target: `policy-${policy}`,
            type: 'stakeholder_policy',
            weight: influence >= 80 ? 3 : 1.5,
            label: `${stk.category} Focus`
          });
          linkedToPolicy = true;
        }
      });

      // Default connection if no keyword matched
      if (!linkedToPolicy) {
        const fallbackPolicy = 'Civic Space & Democratic Participation';
        rawLinks.push({
          id: `link-${sNode.id}-${fallbackPolicy}`,
          source: sNode.id,
          target: `policy-${fallbackPolicy}`,
          type: 'stakeholder_policy',
          weight: 1,
          label: 'Affiliated'
        });
      }
    });

    // 3. Create Opportunity Nodes & Links
    opportunities.forEach((opp) => {
      const oppPriority = opp.priority || 'Medium';
      const radius = oppPriority === 'High' ? 14 : oppPriority === 'Medium' ? 10 : 8;
      const statusColor =
        opp.replyStatus === 'Completed'
          ? '#10b981'
          : opp.replyStatus === 'Cooperation'
          ? '#6366f1'
          : opp.priority === 'High'
          ? '#f43f5e'
          : '#94a3b8';

      const oNode: NetworkNode = {
        id: `opp-${opp.id}`,
        name: opp.title,
        type: 'opportunity',
        policyArea: opp.policyArea,
        priority: oppPriority,
        status: opp.replyStatus,
        date: opp.dateOfActivity || opp.requestDate,
        venue: opp.venue,
        radius,
        color: statusColor,
        opportunityData: opp,
        connectedCount: 0
      };
      rawNodes.push(oNode);
      nodeMap.set(oNode.id, oNode);

      // Link Opportunity to its Policy Area
      if (opp.policyArea && nodeMap.has(`policy-${opp.policyArea}`)) {
        rawLinks.push({
          id: `link-${oNode.id}-policy`,
          source: oNode.id,
          target: `policy-${opp.policyArea}`,
          type: 'opp_policy',
          weight: 2,
          label: opp.policyArea
        });
      }

      // Link Opportunity to Matching Stakeholders
      const outreachLower = (opp.outreachEntity || '').toLowerCase();
      stakeholders.forEach((stk) => {
        const stkNameLower = stk.name.toLowerCase();
        const stkCanonLower = stk.canonicalName.toLowerCase();
        const hasAlias = (stk.aliases || []).some((a) => outreachLower.includes(a.toLowerCase()));

        if (
          outreachLower.includes(stkNameLower) ||
          stkNameLower.includes(outreachLower) ||
          outreachLower.includes(stkCanonLower) ||
          hasAlias
        ) {
          rawLinks.push({
            id: `link-${oNode.id}-stk-${stk.id}`,
            source: `stk-${stk.id}`,
            target: oNode.id,
            type: 'stakeholder_opp',
            weight: 2.5,
            label: 'Outreach Target'
          });
        }
      });
    });

    // 4. Create Inter-Stakeholder Coalition Links (Shared Opportunities & High Joint Alignment)
    for (let i = 0; i < stakeholders.length; i++) {
      for (let j = i + 1; j < stakeholders.length; j++) {
        const s1 = stakeholders[i];
        const s2 = stakeholders[j];
        if (s1.category === s2.category && s1.category === 'CSOs') {
          // Civil society mutual alliance
          rawLinks.push({
            id: `coalition-${s1.id}-${s2.id}`,
            source: `stk-${s1.id}`,
            target: `stk-${s2.id}`,
            type: 'coalition_synergy',
            weight: 1.2,
            label: 'CSO Joint Advocacy'
          });
        }
      }
    }

    // Compute Connected Counts
    rawLinks.forEach((l) => {
      const srcId = typeof l.source === 'string' ? l.source : (l.source as any).id;
      const tgtId = typeof l.target === 'string' ? l.target : (l.target as any).id;
      const srcNode = nodeMap.get(srcId);
      const tgtNode = nodeMap.get(tgtId);
      if (srcNode) srcNode.connectedCount = (srcNode.connectedCount || 0) + 1;
      if (tgtNode) tgtNode.connectedCount = (tgtNode.connectedCount || 0) + 1;
    });

    // 5. Detect Coalition-Building Gaps
    const gapsList: Array<{
      id: string;
      title: string;
      category: 'policy_gap' | 'isolated_champion' | 'bridge_potential' | 'friction_risk';
      severity: 'high' | 'medium' | 'low';
      description: string;
      policyArea?: string;
      stakeholderId?: string;
      suggestedAction: string;
    }> = [];

    // Gap Analysis A: Policy Areas with High Opportunity Volume but Low Stakeholder Influence Density
    policyAreasList.forEach((policy) => {
      const policyOpps = opportunities.filter((o) => o.policyArea === policy);
      const policyStks = stakeholders.filter((s) => {
        const notes = (s.notes || '').toLowerCase();
        return notes.includes(policy.toLowerCase()) || (s.tags && s.tags.some((t) => policy.toLowerCase().includes(t.toLowerCase())));
      });
      const highInfluenceCount = policyStks.filter((s) => (s.influenceScore || 70) >= 75).length;

      if (policyOpps.length >= 8 && highInfluenceCount <= 1) {
        gapsList.push({
          id: `gap-policy-${policy}`,
          title: `Advocacy Deficit: ${policy}`,
          category: 'policy_gap',
          severity: 'high',
          policyArea: policy,
          description: `${policyOpps.length} active opportunities recorded, but only ${highInfluenceCount} high-influence institutional champions engaged. Risk of low amendment uptake.`,
          suggestedAction: `Recruit key MEP shadow rapporteurs or DG EAC desk officers specialized in ${policy}.`
        });

        const pNode = nodeMap.get(`policy-${policy}`);
        if (pNode) {
          pNode.isGap = true;
          pNode.gapReason = 'High activity deficit';
        }
      }
    });

    // Gap Analysis B: High-Leverage Champions Underutilized (High Influence + High Alignment, but <2 connected opportunities)
    stakeholders.forEach((stk) => {
      const sNode = nodeMap.get(`stk-${stk.id}`);
      const influence = stk.influenceScore || 70;
      const alignment = stk.alignmentScore || 75;
      const oppConnections = rawLinks.filter(
        (l) =>
          (l.source === `stk-${stk.id}` || l.target === `stk-${stk.id}`) &&
          l.type === 'stakeholder_opp'
      ).length;

      if (influence >= 80 && alignment >= 70 && oppConnections <= 1) {
        gapsList.push({
          id: `gap-champion-${stk.id}`,
          title: `Underleveraged Strategic Ally: ${stk.name}`,
          category: 'isolated_champion',
          severity: 'medium',
          stakeholderId: stk.id,
          description: `Key institutional partner (${influence}% influence, ${alignment}% alignment) has only ${oppConnections} direct engagement event registered.`,
          suggestedAction: `Schedule a bilateral strategic coordination session or co-sponsor upcoming civil society hearing.`
        });

        if (sNode) {
          sNode.isGap = true;
          sNode.gapReason = 'Underleveraged ally';
        }
      }
    });

    // Gap Analysis C: Cross-Sector Bridge Opportunities
    gapsList.push({
      id: 'gap-bridge-vet-social',
      title: 'Cross-Portfolio Coalition: VET Quality & Youth Social Inclusion',
      category: 'bridge_potential',
      severity: 'medium',
      policyArea: 'Education Policy & VET Reform',
      description: 'Bridging BusinessEurope / employer platforms with European Youth Forum (YFJ) wage demands on the EQAVET apprentice remuneration dossier.',
      suggestedAction: 'Convene joint technical working roundtable with social partners prior to Council Trilogue.'
    });

    // 6. Calculate Cluster Statistics
    const clusters: Record<string, { name: string; totalInfluence: number; oppsCount: number; stksCount: number; avgAlignment: number; color: string }> = {};
    policyAreasList.forEach((policy) => {
      const opps = opportunities.filter((o) => o.policyArea === policy);
      const stks = stakeholders.filter((s) => (s.notes || '').toLowerCase().includes(policy.toLowerCase()) || (s.tags || []).some((t) => policy.toLowerCase().includes(t.toLowerCase())));
      const totalInf = stks.reduce((acc, s) => acc + (s.influenceScore || 70), 0);
      const avgAlign = stks.length > 0 ? Math.round(stks.reduce((acc, s) => acc + (s.alignmentScore || 75), 0) / stks.length) : 75;

      clusters[policy] = {
        name: policy,
        totalInfluence: totalInf,
        oppsCount: opps.length,
        stksCount: stks.length,
        avgAlignment: avgAlign,
        color: POLICY_AREA_CONFIG[policy]?.color || '#4f46e5'
      };
    });

    return {
      nodes: rawNodes,
      links: rawLinks,
      clusterStats: Object.values(clusters),
      coalitionGaps: gapsList
    };
  }, [stakeholders, opportunities, outcomes]);

  // Filtered Nodes & Links based on active UI selections
  const filteredData = useMemo(() => {
    let activeNodes = nodes.filter((n) => {
      // Type toggles
      if (n.type === 'stakeholder' && !showNodeTypes.stakeholders) return false;
      if (n.type === 'opportunity' && !showNodeTypes.opportunities) return false;
      if (n.type === 'policy_area' && !showNodeTypes.policyAreas) return false;

      // Policy filter
      if (selectedPolicyFilter !== 'all') {
        if (n.type === 'policy_area' && n.name !== selectedPolicyFilter) return false;
        if (n.type === 'opportunity' && n.policyArea !== selectedPolicyFilter) return false;
        if (n.type === 'stakeholder') {
          const notes = (n.stakeholderData?.notes || '').toLowerCase();
          const match = notes.includes(selectedPolicyFilter.toLowerCase()) ||
            (n.stakeholderData?.tags || []).some((t) => selectedPolicyFilter.toLowerCase().includes(t.toLowerCase()));
          if (!match) return false;
        }
      }

      // Category filter
      if (selectedCategoryFilter !== 'all') {
        if (n.type === 'stakeholder' && n.category !== selectedCategoryFilter) return false;
      }

      // Gaps only filter
      if (highlightGapsOnly && !n.isGap) return false;

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = n.name.toLowerCase().includes(query);
        const matchesCat = (n.category || '').toLowerCase().includes(query);
        const matchesPol = (n.policyArea || '').toLowerCase().includes(query);
        if (!matchesName && !matchesCat && !matchesPol) return false;
      }

      return true;
    });

    const activeNodeIds = new Set(activeNodes.map((n) => n.id));

    let activeLinks = links.filter((l) => {
      const srcId = typeof l.source === 'string' ? l.source : (l.source as any).id;
      const tgtId = typeof l.target === 'string' ? l.target : (l.target as any).id;
      return activeNodeIds.has(srcId) && activeNodeIds.has(tgtId);
    });

    return {
      nodes: activeNodes,
      links: activeLinks
    };
  }, [nodes, links, showNodeTypes, selectedPolicyFilter, selectedCategoryFilter, highlightGapsOnly, searchTerm]);

  // Set of node IDs connected to the currently hovered or selected node
  const neighborIds = useMemo(() => {
    const focusNode = hoveredNode || selectedNode;
    if (!focusNode) return new Set<string>();

    const set = new Set<string>();
    set.add(focusNode.id);

    filteredData.links.forEach((l) => {
      const srcId = typeof l.source === 'string' ? l.source : (l.source as any).id;
      const tgtId = typeof l.target === 'string' ? l.target : (l.target as any).id;
      if (srcId === focusNode.id) set.add(tgtId);
      if (tgtId === focusNode.id) set.add(srcId);
    });

    return set;
  }, [hoveredNode, selectedNode, filteredData.links]);

  // Render D3 Force-Directed Simulation
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 900;
    const height = 620;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Setup Main Viewport & Zoom Container
    const g = svg.append('g').attr('class', 'network-graph-layer');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Initial centering
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.85));

    // Deep clone data for D3 mutation
    const simulationNodes: NetworkNode[] = filteredData.nodes.map((d) => ({ ...d }));
    const simulationLinks: NetworkLink[] = filteredData.links.map((d) => ({
      ...d,
      source: typeof d.source === 'object' ? (d.source as any).id : d.source,
      target: typeof d.target === 'object' ? (d.target as any).id : d.target
    }));

    // Setup Simulation Forces
    const simulation = d3
      .forceSimulation<NetworkNode>(simulationNodes)
      .force(
        'link',
        d3
          .forceLink<NetworkNode, NetworkLink>(simulationLinks)
          .id((d) => d.id)
          .distance((d) => (d.type === 'stakeholder_policy' ? linkDistanceScale * 1.3 : linkDistanceScale))
          .strength((d) => (d.type === 'opp_policy' ? 0.8 : 0.45))
      )
      .force('charge', d3.forceManyBody().strength((d: any) => (d.type === 'policy_area' ? -550 : -220)))
      .force('center', d3.forceCenter(0, 0))
      .force(
        'collision',
        d3.forceCollide<NetworkNode>().radius((d) => d.radius + 12).iterations(2)
      );

    // Define Arrow Marker for Directed Outreach Links
    const defs = svg.append('defs');

    // Glow filter for high influence and gaps
    const glowFilter = defs.append('filter').attr('id', 'glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    glowFilter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur');
    const feMerge = glowFilter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Links Layer
    const linkGroup = g.append('g').attr('class', 'links');
    const linkElements = linkGroup
      .selectAll<SVGLineElement, NetworkLink>('line')
      .data(simulationLinks)
      .enter()
      .append('line')
      .attr('stroke', (d) => {
        if (d.type === 'coalition_synergy') return '#10b981';
        if (d.type === 'opp_policy') return '#818cf8';
        return '#cbd5e1';
      })
      .attr('stroke-opacity', (d) => (d.type === 'coalition_synergy' ? 0.7 : 0.4))
      .attr('stroke-width', (d) => Math.min(4, Math.max(1.2, d.weight * 1.2)))
      .attr('stroke-dasharray', (d) => (d.type === 'coalition_synergy' ? '4 3' : 'none'));

    // Nodes Layer
    const nodeGroup = g.append('g').attr('class', 'nodes');
    const nodeElements = nodeGroup
      .selectAll<SVGGElement, NetworkNode>('g')
      .data(simulationNodes)
      .enter()
      .append('g')
      .attr('class', 'node-item cursor-pointer')
      .call(
        d3
          .drag<SVGGElement, NetworkNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Node Outer Glow Ring (for Gap or Selected)
    nodeElements
      .append('circle')
      .attr('r', (d) => d.radius + (d.isGap ? 6 : 4))
      .attr('fill', 'none')
      .attr('stroke', (d) => (d.isGap ? '#f43f5e' : d.color))
      .attr('stroke-width', (d) => (d.isGap ? 2.5 : 1.5))
      .attr('stroke-dasharray', (d) => (d.isGap ? '4 2' : 'none'))
      .attr('opacity', (d) => (d.isGap ? 0.9 : 0.3));

    // Node Primary Circle
    nodeElements
      .append('circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => (d.type === 'policy_area' ? '#0f172a' : d.color))
      .attr('stroke', (d) => (d.type === 'policy_area' ? d.color : '#ffffff'))
      .attr('stroke-width', (d) => (d.type === 'policy_area' ? 3 : 2))
      .attr('filter', (d) => ((d.influence || 0) > 85 ? 'url(#glow)' : null));

    // Icon / Label inside Node
    nodeElements.each(function (d) {
      const el = d3.select(this);
      if (d.type === 'policy_area') {
        const icon = POLICY_AREA_CONFIG[d.name]?.icon || '🏛️';
        el.append('text')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-size', '14px')
          .text(icon);
      } else if (d.type === 'stakeholder') {
        // Initials or first letter
        const initials = d.name
          .split(' ')
          .map((w) => w[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();
        el.append('text')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('fill', '#ffffff')
          .attr('font-size', '10px')
          .attr('font-weight', 'bold')
          .text(initials);
      } else if (d.type === 'opportunity') {
        el.append('text')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('fill', '#ffffff')
          .attr('font-size', '8px')
          .attr('font-weight', 'bold')
          .text('⚡');
      }
    });

    // Text Label below Node
    nodeElements
      .append('text')
      .attr('y', (d) => d.radius + 12)
      .attr('text-anchor', 'middle')
      .attr('fill', '#1e293b')
      .attr('font-size', (d) => (d.type === 'policy_area' ? '11px' : '9.5px'))
      .attr('font-weight', (d) => (d.type === 'policy_area' ? '800' : '600'))
      .text((d) => {
        if (d.type === 'policy_area') return POLICY_AREA_CONFIG[d.name]?.short || d.name;
        return d.name.length > 20 ? `${d.name.slice(0, 18)}…` : d.name;
      });

    // Interactivity: Hover & Click
    nodeElements
      .on('mouseenter', (event, d) => {
        setHoveredNode(d);
      })
      .on('mouseleave', () => {
        setHoveredNode(null);
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d);
        if (d.type === 'stakeholder' && d.stakeholderData && onSelectStakeholder) {
          // Keep active
        }
      });

    // Background Click to deselect
    svg.on('click', () => {
      setSelectedNode(null);
    });

    // Simulation Tick Callback
    simulation.on('tick', () => {
      linkElements
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodeElements.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [filteredData, linkDistanceScale]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl shadow-2xs">
                <Network className="w-5 h-5" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-indigo-600">
                Strategic Network Intelligence • D3 Engine
              </span>
            </div>
            <h2 className="text-2xl font-black text-slate-900">
              Stakeholder, Opportunity & Policy Ecosystem Graph
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl">
              Map live institutional connections between OBESSU's 30+ European partners, high-stakes legislative opportunities, and core policy domains. Detect coalition blindspots and underleveraged allies in real-time.
            </p>
          </div>

          {/* Sub-tab view switchers */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl self-start lg:self-center">
            <button
              type="button"
              onClick={() => setActiveTab('graph')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                activeTab === 'graph' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Network className="w-3.5 h-3.5 text-indigo-600" />
              <span>Interactive Graph</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('clusters')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                activeTab === 'clusters' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>Cluster Power ({clusterStats.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('gaps')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                activeTab === 'gaps' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              <span>Coalition Gaps ({coalitionGaps.length})</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl">
            <span className="text-[10px] font-extrabold text-indigo-900 uppercase">Mapped Nodes</span>
            <p className="text-xl font-black text-indigo-950 mt-0.5">{nodes.length}</p>
            <span className="text-[10px] text-indigo-700 font-medium">8 Policy Hubs, {stakeholders.length} Entities</span>
          </div>

          <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
            <span className="text-[10px] font-extrabold text-emerald-900 uppercase">Active Linkages</span>
            <p className="text-xl font-black text-emerald-950 mt-0.5">{links.length}</p>
            <span className="text-[10px] text-emerald-700 font-medium">Outreach, Synergies & Tracks</span>
          </div>

          <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-2xl">
            <span className="text-[10px] font-extrabold text-purple-900 uppercase">Policy Clusters</span>
            <p className="text-xl font-black text-purple-950 mt-0.5">{clusterStats.length}</p>
            <span className="text-[10px] text-purple-700 font-medium">VET, Civic Space & MFF</span>
          </div>

          <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-2xl">
            <span className="text-[10px] font-extrabold text-rose-900 uppercase">Coalition Gaps</span>
            <p className="text-xl font-black text-rose-950 mt-0.5">{coalitionGaps.length}</p>
            <span className="text-[10px] text-rose-700 font-medium">Underleveraged Allies & Deficits</span>
          </div>
        </div>
      </div>

      {/* Tab 1: Interactive D3 Network Graph */}
      {activeTab === 'graph' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search network nodes (e.g. DG EAC, VET Reform, BusinessEurope)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Policy Area Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selectedPolicyFilter}
                  onChange={(e) => setSelectedPolicyFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all">All Policy Domains</option>
                  {Object.keys(POLICY_AREA_CONFIG).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all">All Stakeholder Categories</option>
                  <option value="EU">EU Institutions</option>
                  <option value="CSOs">Civil Society (CSOs)</option>
                  <option value="Platforms">Platforms & Social Partners</option>
                  <option value="CoE">Council of Europe</option>
                  <option value="International Bodies">International Bodies (UN/OECD)</option>
                </select>

                {/* Highlight Gaps Only Toggle */}
                <button
                  type="button"
                  onClick={() => setHighlightGapsOnly(!highlightGapsOnly)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    highlightGapsOnly
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{highlightGapsOnly ? 'Showing Gaps Only' : 'Highlight Gaps'}</span>
                </button>
              </div>
            </div>

            {/* Sub-toggles: Node Types & Distance */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Visible Nodes:</span>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showNodeTypes.policyAreas}
                    onChange={(e) => setShowNodeTypes({ ...showNodeTypes, policyAreas: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span className="font-semibold text-slate-700">Policy Hubs</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showNodeTypes.stakeholders}
                    onChange={(e) => setShowNodeTypes({ ...showNodeTypes, stakeholders: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span className="font-semibold text-slate-700">Stakeholders</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showNodeTypes.opportunities}
                    onChange={(e) => setShowNodeTypes({ ...showNodeTypes, opportunities: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span className="font-semibold text-slate-700">Opportunities</span>
                </label>
              </div>

              {/* Gravity / Distance Slider */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500">Repulsion:</span>
                <input
                  type="range"
                  min="40"
                  max="160"
                  value={linkDistanceScale}
                  onChange={(e) => setLinkDistanceScale(Number(e.target.value))}
                  className="w-24 accent-indigo-600"
                />
                <span className="text-[10px] font-mono text-slate-400">{linkDistanceScale}px</span>
              </div>
            </div>
          </div>

          {/* D3 Visualization Canvas Container */}
          <div className="relative bg-slate-950 rounded-3xl border border-slate-800 shadow-xl overflow-hidden min-h-[620px]" ref={containerRef}>
            {/* Top Overlay Legend */}
            <div className="absolute top-4 left-4 z-10 p-3 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-700/60 text-[11px] text-slate-300 space-y-2 shadow-lg max-w-xs">
              <div className="flex items-center justify-between font-bold text-slate-100">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Network Key</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Zoom & Drag enabled</span>
              </div>

              <div className="space-y-1 text-[10px]">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full bg-slate-900 border-2 border-indigo-500 flex items-center justify-center text-[7px] text-indigo-300 font-bold">
                    🏛️
                  </span>
                  <span>Policy Area Hub (8 core domains)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-indigo-600" />
                  <span>EU Institutional Stakeholder</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-600" />
                  <span>Civil Society / CSO Partner</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Opportunity (Outreach / Hearing)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full border-2 border-dashed border-rose-500" />
                  <span className="text-rose-300 font-bold">Coalition Gap / Underleveraged</span>
                </div>
              </div>
            </div>

            {/* SVG Element for D3 */}
            <svg
              ref={svgRef}
              className="w-full h-[620px] cursor-grab active:cursor-grabbing block"
            />

            {/* Node Quick Inspector Drawer */}
            {selectedNode && (
              <div className="absolute bottom-4 right-4 z-20 w-80 sm:w-96 p-5 bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200 text-xs">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="space-y-0.5">
                    <span
                      className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md"
                      style={{ backgroundColor: `${selectedNode.color}20`, color: selectedNode.color }}
                    >
                      {selectedNode.type === 'policy_area'
                        ? 'Policy Domain'
                        : selectedNode.type === 'stakeholder'
                        ? `${selectedNode.category} Stakeholder`
                        : 'Opportunity Target'}
                    </span>
                    <h3 className="font-extrabold text-slate-900 text-sm mt-1">{selectedNode.name}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedNode(null)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                  >
                    ✕
                  </button>
                </div>

                {/* Node Details based on type */}
                {selectedNode.type === 'stakeholder' && selectedNode.stakeholderData && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">Influence</span>
                        <span className="font-extrabold text-indigo-700 text-sm">{selectedNode.influence}%</span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">Alignment</span>
                        <span className="font-extrabold text-emerald-700 text-sm">{selectedNode.alignment}%</span>
                      </div>
                    </div>

                    <p className="text-slate-600 text-[11px] leading-relaxed line-clamp-3">
                      {selectedNode.stakeholderData.notes || 'No confidential notes recorded.'}
                    </p>

                    {/* Action Triggers */}
                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenQuickNote && selectedNode.stakeholderData) {
                            onOpenQuickNote(selectedNode.stakeholderData);
                          }
                        }}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1 transition-colors"
                      >
                        <MessageSquarePlus className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Note</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenScheduleFollowUp && selectedNode.stakeholderData) {
                            onOpenScheduleFollowUp(selectedNode.stakeholderData);
                          }
                        }}
                        className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs flex items-center gap-1 transition-colors"
                      >
                        <CalendarPlus className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Follow-up</span>
                      </button>

                      {onSelectStakeholder && selectedNode.stakeholderData && (
                        <button
                          type="button"
                          onClick={() => onSelectStakeholder(selectedNode.stakeholderData!)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs ml-auto shadow-xs"
                        >
                          View Full Dossier
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {selectedNode.type === 'opportunity' && selectedNode.opportunityData && (
                  <div className="space-y-3">
                    <div className="p-2.5 bg-slate-50 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>📅 {selectedNode.date || 'Upcoming'}</span>
                        <span className="font-bold text-indigo-600">Priority: {selectedNode.priority}</span>
                      </div>
                      <p className="text-slate-800 font-semibold text-[11px]">{selectedNode.venue || 'Brussels'}</p>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      {onOpenOpportunity && (
                        <button
                          type="button"
                          onClick={() => onOpenOpportunity(selectedNode.opportunityData!.id)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1"
                        >
                          <span>Open Opportunity</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {selectedNode.type === 'policy_area' && (
                  <div className="space-y-3">
                    <p className="text-slate-600 text-[11px]">
                      Core statutory portfolio domain for OBESSU European General Assembly advocacy.
                    </p>
                    <div className="p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-1">
                      <span className="text-[10px] font-bold uppercase text-indigo-900">Cluster Density</span>
                      <p className="text-xs font-semibold text-indigo-950">
                        {filteredData.links.filter((l) => (typeof l.source === 'object' ? (l.source as any).id : l.source) === selectedNode.id || (typeof l.target === 'object' ? (l.target as any).id : l.target) === selectedNode.id).length} Active Linkages
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Policy Clusters Power Breakdown */}
      {activeTab === 'clusters' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <span>Policy Area Cluster Influence Power Ratings</span>
            </h3>
            <span className="text-xs text-slate-500">{clusterStats.length} Domains Analyzed</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {clusterStats.map((cluster) => {
              const config = POLICY_AREA_CONFIG[cluster.name] || { icon: '🏛️', color: '#4f46e5' };
              return (
                <div
                  key={cluster.name}
                  className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-shadow space-y-3.5 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl p-2 rounded-2xl bg-slate-50 border border-slate-100">
                        {config.icon}
                      </span>
                      <span
                        className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${cluster.color}15`, color: cluster.color }}
                      >
                        Influence: {cluster.totalInfluence} pts
                      </span>
                    </div>

                    <h4 className="font-extrabold text-slate-900 text-sm">{cluster.name}</h4>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Connected Opportunities:</span>
                      <span className="font-extrabold text-indigo-600 font-mono">{cluster.oppsCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Key Stakeholders:</span>
                      <span className="font-extrabold text-emerald-600 font-mono">{cluster.stksCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Avg Policy Alignment:</span>
                      <span className="font-extrabold text-slate-900 font-mono">{cluster.avgAlignment}%</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, cluster.avgAlignment)}%`, backgroundColor: cluster.color }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPolicyFilter(cluster.name);
                      setActiveTab('graph');
                    }}
                    className="w-full py-2 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 font-bold text-xs rounded-xl text-slate-700 transition-colors flex items-center justify-center gap-1"
                  >
                    <span>Inspect Cluster Graph</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Coalition-Building Gaps Diagnostic */}
      {activeTab === 'gaps' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <span>Identified Coalition-Building Gaps & Institutional Blindspots</span>
            </h3>
            <span className="text-xs text-slate-500">{coalitionGaps.length} Strategic Diagnostics</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {coalitionGaps.map((gap) => (
              <div
                key={gap.id}
                className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:shadow-md transition-shadow space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                        gap.severity === 'high'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {gap.severity === 'high' ? '🚨 High Leverage Deficit' : '⚠️ Strategic Gap'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Category: {gap.category.replace('_', ' ')}
                    </span>
                  </div>

                  <h4 className="font-extrabold text-slate-900 text-sm">{gap.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    {gap.description}
                  </p>
                </div>

                <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-1 text-xs">
                  <span className="text-[10px] font-extrabold uppercase text-indigo-900 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Secretariat Remediation Protocol:</span>
                  </span>
                  <p className="text-indigo-950 font-semibold leading-snug">{gap.suggestedAction}</p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      if (gap.policyArea) {
                        setSelectedPolicyFilter(gap.policyArea);
                      }
                      setActiveTab('graph');
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-xs transition-colors"
                  >
                    <span>View in Network</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
