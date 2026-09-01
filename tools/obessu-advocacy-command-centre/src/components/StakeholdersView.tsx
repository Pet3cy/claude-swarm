import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip as RechartsTooltip,
  Cell,
  ReferenceLine,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  Tooltip as LineTooltip,
} from 'recharts';
import {
  Building2,
  Search,
  Sparkles,
  Award,
  Calendar,
  BookOpen,
  Mail,
  ShieldCheck,
  ChevronRight,
  Target,
  Users,
  Eye,
  Sliders,
  CheckCircle2,
  TrendingUp,
  Layers,
  FileText,
  Filter,
  BarChart3,
  Compass,
  ArrowUpRight,
  Info,
  Clock,
  AlertTriangle,
  Flame,
  Activity,
  History,
  Tag,
  Check,
  ChevronDown,
  Globe,
  MapPin,
  CheckSquare,
  Square,
  HardDrive,
  Download,
  Printer,
  Copy,
  ExternalLink,
  Zap,
  Vote,
  TrendingDown,
  X,
  Plus,
  Scale,
  Send,
  RefreshCw,
  MessageSquare,
  Share2,
  CalendarPlus,
  ListTodo,
  CheckCheck,
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Save,
  FileEdit,
  AlertOctagon,
  Timer,
  Radio,
  BookmarkPlus,
  ShieldAlert,
  MessageSquarePlus,
  StickyNote,
  FileCheck,
  AlertCircle,
  Network
} from 'lucide-react';
import {
  ActionItem,
  EuropeanRegion,
  Opportunity,
  Outcome,
  Paper,
  PredictiveShift,
  Stakeholder,
  StakeholderCategory,
} from '../types/advocacy';
import { aiService } from '../services/aiService';
import { workspaceService, GoogleCalendarEvent } from '../services/workspaceService';
import { NetworkVisualization } from './NetworkVisualization';

interface StakeholdersViewProps {
  stakeholders: Stakeholder[];
  opportunities: Opportunity[];
  outcomes: Outcome[];
  papers: Paper[];
  actions?: ActionItem[];
  onUpdateStakeholder?: (stakeholder: Stakeholder) => void;
  onBulkUpdateStakeholders?: (stakeholders: Stakeholder[]) => void;
  onCreateAction?: (action: any) => void;
  onNavigateToTab?: (tab: any) => void;
  onOpenBriefingDraft: (opp: Opportunity) => void;
  onOpenOpportunity: (oppId: string) => void;
  hasGoogleToken?: boolean;
  onRequireAuth?: () => void;
}

type ViewMode = 'matrix' | 'split' | 'directory' | 'network' | 'compare';
type QuadrantType = 'all' | 'champions' | 'targets' | 'grassroots' | 'monitor';
type InfluenceLevelFilter = 'all' | 'high' | 'medium' | 'low';
type AlignmentLevelFilter = 'all' | 'supportive' | 'neutral' | 'opposed';
type EngagementRecencyFilter = 'all' | 'stale' | 'active';
type ProximityStatusFilter = 'all' | 'lapsed' | 'warning' | 'active';
type RegionalFilter = 'all' | EuropeanRegion;

// Color map for stakeholder categories
const CATEGORY_COLORS: Record<string, string> = {
  EU: '#4f46e5', // Indigo
  Platforms: '#059669', // Emerald
  CoE: '#7c3aed', // Purple
  CSOs: '#d97706', // Amber
  'International Bodies': '#0891b2', // Cyan
  default: '#64748b', // Slate
};

// Regional Colors for Geographic Heatmap
const REGION_COLORS: Record<EuropeanRegion, { fill: string; border: string; bg: string; text: string; glow: string }> = {
  'Western Europe / Brussels EU Core': {
    fill: '#6366f1',
    border: 'border-indigo-400',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    glow: 'rgba(99, 102, 241, 0.4)',
  },
  'Nordic & Baltic': {
    fill: '#06b6d4',
    border: 'border-cyan-400',
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    glow: 'rgba(6, 182, 212, 0.4)',
  },
  'Southern Europe / Mediterranean': {
    fill: '#10b981',
    border: 'border-emerald-400',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    glow: 'rgba(16, 185, 129, 0.4)',
  },
  'Central & Eastern Europe': {
    fill: '#f59e0b',
    border: 'border-amber-400',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    glow: 'rgba(245, 158, 11, 0.4)',
  },
  'Pan-European & International': {
    fill: '#a855f7',
    border: 'border-purple-400',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    glow: 'rgba(168, 85, 247, 0.4)',
  },
};

// Target anchor date for the advocacy campaign (2026-08-23)
const CURRENT_DATE = new Date('2026-08-23T21:34:11');

export const StakeholdersView: React.FC<StakeholdersViewProps> = ({
  stakeholders,
  opportunities,
  outcomes,
  papers,
  actions = [],
  onUpdateStakeholder,
  onBulkUpdateStakeholders,
  onCreateAction,
  onNavigateToTab,
  onOpenBriefingDraft,
  onOpenOpportunity,
  hasGoogleToken = false,
  onRequireAuth,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedQuadrant, setSelectedQuadrant] = useState<QuadrantType>('all');
  const [selectedGoalFilter, setSelectedGoalFilter] = useState<string>('all');
  const [selectedInfluenceFilter, setSelectedInfluenceFilter] = useState<InfluenceLevelFilter>('all');
  const [selectedAlignmentFilter, setSelectedAlignmentFilter] = useState<AlignmentLevelFilter>('all');
  const [selectedEngagementFilter, setSelectedEngagementFilter] = useState<EngagementRecencyFilter>('all');
  const [selectedProximityFilter, setSelectedProximityFilter] = useState<ProximityStatusFilter>('all');
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<RegionalFilter>('all');
  const [onlyPredictiveShifts, setOnlyPredictiveShifts] = useState<boolean>(false);

  // Smart Tags Filter State
  const [selectedSmartTags, setSelectedSmartTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState<string>('');
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState<boolean>(false);

  // Rich Notes State for Detail Panel
  const [isEditingRichNotes, setIsEditingRichNotes] = useState<boolean>(false);
  const [richNotesDraft, setRichNotesDraft] = useState<string>('');
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);

  // 1. Quick Note Modal State
  const [quickNoteStakeholder, setQuickNoteStakeholder] = useState<Stakeholder | null>(null);
  const [quickNoteText, setQuickNoteText] = useState<string>('');
  const [quickNoteContext, setQuickNoteContext] = useState<string>('📍 Met in Brussels');
  const [quickNoteIncludeHeader, setQuickNoteIncludeHeader] = useState<boolean>(true);
  const [isSavingQuickNote, setIsSavingQuickNote] = useState<boolean>(false);

  // 2. Conflict Watch Alert State
  const [isConflictWatchExpanded, setIsConflictWatchExpanded] = useState<boolean>(true);
  const [dismissedConflictIds, setDismissedConflictIds] = useState<string[]>([]);
  const [selectedConflictDetail, setSelectedConflictDetail] = useState<any | null>(null);

  // 3. Meeting Briefing Generator Modal State
  const [isMeetingBriefingOpen, setIsMeetingBriefingOpen] = useState<boolean>(false);
  const [briefingStakeholder, setBriefingStakeholder] = useState<Stakeholder | null>(null);
  const [isExportingMeetingDoc, setIsExportingMeetingDoc] = useState<boolean>(false);
  const [exportedMeetingDocUrl, setExportedMeetingDocUrl] = useState<string | null>(null);
  const [copyBriefingSuccess, setCopyBriefingSuccess] = useState<boolean>(false);

  // 4. Sparkline Sentiment Chart State
  const [sparklineHoverPoint, setSparklineHoverPoint] = useState<{ quarter: string; date: string; score: number; milestone: string; policyArea: string } | null>(null);
  const [selectedSparklinePolicy, setSelectedSparklinePolicy] = useState<string>('all');

  // Geographic Heatmap Overlay State
  const [isHeatmapOverlay, setIsHeatmapOverlay] = useState<boolean>(false);

  // Bulk Actions State
  const [selectedStakeholderIds, setSelectedStakeholderIds] = useState<string[]>([]);

  // Summary Report Export Modal State
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isExportingDrive, setIsExportingDrive] = useState<boolean>(false);
  const [exportedDriveUrl, setExportedDriveUrl] = useState<string | null>(null);

  // Schedule Follow-up Modal State
  const [scheduleFollowUpStk, setScheduleFollowUpStk] = useState<Stakeholder | null>(null);
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [followUpDate, setFollowUpDate] = useState('2026-08-30');
  const [followUpType, setFollowUpType] = useState<'bilateral_meeting' | 'follow_up_letter' | 'prepare_briefing' | 'coalition_call'>('bilateral_meeting');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [syncToGCal, setSyncToGCal] = useState(true);
  const [syncToGTasks, setSyncToGTasks] = useState(true);
  const [isScheduling, setIsScheduling] = useState(false);

  // Compare Stakeholders State
  const [compareIdA, setCompareIdA] = useState<string>(stakeholders[0]?.id || '');
  const [compareIdB, setCompareIdB] = useState<string>(stakeholders[1]?.id || '');
  const [comparisonAiAnalysis, setComparisonAiAnalysis] = useState<string | null>(null);
  const [isComparingAi, setIsComparingAi] = useState(false);

  // Detail Panel Tab & Relationship History Live Query State
  const [detailTab, setDetailTab] = useState<'overview' | 'notes' | 'history' | 'engagements' | 'outcomes' | 'shifts'>('overview');
  const [gmailMessages, setGmailMessages] = useState<Array<{ id: string; subject: string; from: string; date: string; snippet: string }>>([]);
  const [calendarEvents, setCalendarEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [activeStakeholderId, setActiveStakeholderId] = useState<string | null>(
    stakeholders[0]?.id || null
  );

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper to compute stakeholder metrics
  const getStakeholderMetrics = (stk: Stakeholder) => {
    const influence = stk.influenceScore ?? (
      stk.category === 'EU' ? 88 :
      stk.category === 'Platforms' ? 82 :
      stk.category === 'CoE' ? 85 :
      stk.category === 'International Bodies' ? 88 : 70
    );

    const alignment = stk.alignmentScore ?? (
      stk.canonicalName.toLowerCase().includes('employer') || stk.name.toLowerCase().includes('business') ? 32 :
      stk.category === 'Platforms' || stk.category === 'CSOs' ? 92 :
      stk.category === 'CoE' ? 88 : 80
    );

    // Default region assignment if not set
    let region: EuropeanRegion = stk.region || 'Western Europe / Brussels EU Core';
    if (!stk.region) {
      if (stk.canonicalName.includes('CEDEFOP') || stk.name.includes('EVTA') || stk.canonicalName.includes('EARLALL')) {
        region = 'Southern Europe / Mediterranean';
      } else if (stk.canonicalName.includes('ESU')) {
        region = 'Nordic & Baltic';
      } else if (stk.canonicalName.includes('REGIO') || stk.canonicalName.includes('FYEG')) {
        region = 'Central & Eastern Europe';
      } else if (stk.canonicalName.includes('UNESCO') || stk.canonicalName.includes('ETINED') || stk.canonicalName.includes('EYF')) {
        region = 'Pan-European & International';
      }
    }

    // Quadrant classification
    let quadrant: 'champions' | 'targets' | 'grassroots' | 'monitor';
    if (influence >= 50 && alignment >= 50) {
      quadrant = 'champions';
    } else if (influence >= 50 && alignment < 50) {
      quadrant = 'targets';
    } else if (influence < 50 && alignment >= 50) {
      quadrant = 'grassroots';
    } else {
      quadrant = 'monitor';
    }

    // Influence category
    let influenceLevel: 'High' | 'Medium' | 'Low';
    if (influence >= 75) {
      influenceLevel = 'High';
    } else if (influence >= 45) {
      influenceLevel = 'Medium';
    } else {
      influenceLevel = 'Low';
    }

    // Political Alignment category
    let alignmentLevel: 'Supportive' | 'Neutral' | 'Opposed';
    if (alignment >= 70) {
      alignmentLevel = 'Supportive';
    } else if (alignment >= 45) {
      alignmentLevel = 'Neutral';
    } else {
      alignmentLevel = 'Opposed';
    }

    // Primary policy focus detection
    let primaryFocus = 'General Youth & Education Policy';
    const notesLower = stk.notes.toLowerCase();
    const nameLower = (stk.name + ' ' + stk.canonicalName).toLowerCase();

    if (notesLower.includes('vet') || notesLower.includes('apprenticeship') || nameLower.includes('empl') || nameLower.includes('cedefop') || nameLower.includes('evta') || nameLower.includes('earlall')) {
      primaryFocus = 'VET Reform & Apprenticeship Quality';
    } else if (notesLower.includes('digital') || nameLower.includes('digital') || notesLower.includes('edtech') || notesLower.includes('ai in education')) {
      primaryFocus = 'Digital Education & AI Ethics';
    } else if (notesLower.includes('civic') || notesLower.includes('rights') || notesLower.includes('democracy') || nameLower.includes('cdedu') || nameLower.includes('yfj')) {
      primaryFocus = 'School Student Rights & Democratic Governance';
    } else if (notesLower.includes('funding') || notesLower.includes('mff') || notesLower.includes('erasmus') || notesLower.includes('eyf') || nameLower.includes('cse') || nameLower.includes('lllp')) {
      primaryFocus = 'EU Post-2027 MFF & Youth Grants';
    } else if (notesLower.includes('green') || notesLower.includes('transition') || notesLower.includes('climate') || nameLower.includes('green') || nameLower.includes('jtp')) {
      primaryFocus = 'Climate & Just Transition in Schools';
    } else if (notesLower.includes('global') || notesLower.includes('unesco') || nameLower.includes('unesco')) {
      primaryFocus = 'Global Youth Rights & UNESCO Dialogue';
    }

    return { influence, alignment, region, quadrant, influenceLevel, alignmentLevel, primaryFocus };
  };

  // Enriched stakeholder data for matrix and list
  const enrichedStakeholders = useMemo(() => {
    return stakeholders.map((stk) => {
      const { influence, alignment, region, quadrant, influenceLevel, alignmentLevel, primaryFocus } = getStakeholderMetrics(stk);

      // Engagements associated with this stakeholder
      const stakeholderEngagements = opportunities.filter((opp) => {
        if (opp.outreachEntity === stk.canonicalName || opp.outreachEntity === stk.name) return true;
        return stk.aliases?.some((a) => a.toLowerCase() === opp.outreachEntity.toLowerCase());
      });

      // Outcomes associated with this stakeholder
      const stakeholderOutcomes = outcomes.filter((out) => {
        return (
          out.stakeholder === stk.name ||
          out.stakeholder === stk.canonicalName ||
          stk.aliases?.includes(out.stakeholder)
        );
      });

      // Find the most recent engagement date
      let lastEngagementDate: Date | null = null;
      let lastEngagementString = 'Never';

      stakeholderEngagements.forEach((opp) => {
        const dStr = opp.dateOfActivity || opp.requestDate;
        if (dStr) {
          const d = new Date(dStr);
          if (!isNaN(d.getTime())) {
            if (!lastEngagementDate || d > lastEngagementDate) {
              lastEngagementDate = d;
              lastEngagementString = dStr;
            }
          }
        }
      });

      stakeholderOutcomes.forEach((out) => {
        if (out.date) {
          const d = new Date(out.date);
          if (!isNaN(d.getTime())) {
            if (!lastEngagementDate || d > lastEngagementDate) {
              lastEngagementDate = d;
              lastEngagementString = out.date;
            }
          }
        }
      });

      // Calculate days since last engagement
      let daysSinceLastContact = 999;
      let isStale = true;

      if (lastEngagementDate) {
        const diffMs = CURRENT_DATE.getTime() - (lastEngagementDate as Date).getTime();
        daysSinceLastContact = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        isStale = daysSinceLastContact > 30;
      } else {
        isStale = true;
      }

      // ==============================================================
      // PROXIMITY TO SECRETARIAT (In-person meeting within 6 months)
      // ==============================================================
      const inPersonEngagements = stakeholderEngagements.filter((opp) => {
        const type = (opp.engagementType || '').toLowerCase();
        const venue = (opp.venue || '').toLowerCase();
        return (
          type.includes('in-person') ||
          type.includes('speaking (in-person)') ||
          venue.includes('brussels') ||
          venue.includes('strasbourg') ||
          venue.includes('in-person')
        );
      });

      let lastInPersonDate: Date | null = null;
      let lastInPersonString = 'Never';

      inPersonEngagements.forEach((opp) => {
        const dStr = opp.dateOfActivity || opp.requestDate;
        if (dStr) {
          const d = new Date(dStr);
          if (!isNaN(d.getTime()) && d.getTime() <= CURRENT_DATE.getTime()) {
            if (!lastInPersonDate || d > lastInPersonDate) {
              lastInPersonDate = d;
              lastInPersonString = dStr;
            }
          }
        }
      });

      if (stk.lastInPersonMeetingDate) {
        const d = new Date(stk.lastInPersonMeetingDate);
        if (!isNaN(d.getTime()) && (!lastInPersonDate || d > lastInPersonDate)) {
          lastInPersonDate = d;
          lastInPersonString = stk.lastInPersonMeetingDate;
        }
      }

      let daysSinceInPerson = 999;
      let monthsSinceInPerson = 99;
      let proximityStatus: 'lapsed' | 'warning' | 'active' = 'lapsed';

      if (lastInPersonDate) {
        const diffMs = CURRENT_DATE.getTime() - lastInPersonDate.getTime();
        daysSinceInPerson = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        monthsSinceInPerson = Math.round((daysSinceInPerson / 30.4375) * 10) / 10;

        if (daysSinceInPerson > 182) {
          // Over 6 months
          proximityStatus = 'lapsed';
        } else if (daysSinceInPerson > 90) {
          // 3 to 6 months
          proximityStatus = 'warning';
        } else {
          // Under 3 months
          proximityStatus = 'active';
        }
      } else {
        proximityStatus = 'lapsed';
      }

      const isLapsedInPerson = proximityStatus === 'lapsed';

      // Most recent substantive outcome
      const sortedOutcomes = [...stakeholderOutcomes].sort((a, b) => {
        return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
      });
      const mostRecentOutcome = sortedOutcomes[0] || null;

      // Ensure tags array exists
      const tags = stk.tags || [];

      return {
        ...stk,
        influence,
        alignment,
        region,
        tags,
        quadrant,
        influenceLevel,
        alignmentLevel,
        primaryFocus,
        oppCount: stakeholderEngagements.length,
        outcomeCount: stakeholderOutcomes.length,
        lastEngagementDate,
        lastEngagementString,
        daysSinceLastContact,
        isStale,
        lastInPersonDate,
        lastInPersonString,
        daysSinceInPerson,
        monthsSinceInPerson,
        proximityStatus,
        isLapsedInPerson,
        mostRecentOutcome,
        color: CATEGORY_COLORS[stk.category] || CATEGORY_COLORS.default,
        regionMeta: REGION_COLORS[region] || REGION_COLORS['Western Europe / Brussels EU Core'],
      };
    });
  }, [stakeholders, opportunities, outcomes]);

  // Compute all unique tags available across stakeholders
  const allSmartTags = useMemo(() => {
    const defaultTags = [
      'Erasmus+ Expert',
      'Policy Influencer',
      'Green Transition Champion',
      'VET Specialist',
      'Post-2027 MFF Lead',
      'Youth Rights Champion',
      'EP Rapporteur',
      'DG EAC Focal Point',
    ];
    const tagsSet = new Set<string>(defaultTags);
    enrichedStakeholders.forEach((s) => {
      s.tags?.forEach((t) => tagsSet.add(t));
    });
    return Array.from(tagsSet);
  }, [enrichedStakeholders]);

  // Proximity Counts for Filters
  const proximityCounts = useMemo(() => {
    return {
      all: enrichedStakeholders.length,
      lapsed: enrichedStakeholders.filter((s) => s.proximityStatus === 'lapsed').length,
      warning: enrichedStakeholders.filter((s) => s.proximityStatus === 'warning').length,
      active: enrichedStakeholders.filter((s) => s.proximityStatus === 'active').length,
    };
  }, [enrichedStakeholders]);

  // Filtering
  const filteredStakeholders = useMemo(() => {
    return enrichedStakeholders.filter((stk) => {
      if (selectedCategory !== 'all' && stk.category !== selectedCategory) return false;
      if (selectedQuadrant !== 'all' && stk.quadrant !== selectedQuadrant) return false;
      if (selectedRegionFilter !== 'all' && stk.region !== selectedRegionFilter) return false;

      // Predictive shift filter
      if (onlyPredictiveShifts && !stk.predictiveShift) return false;

      // Proximity to Secretariat filter
      if (selectedProximityFilter !== 'all') {
        if (stk.proximityStatus !== selectedProximityFilter) return false;
      }

      // Smart Tags multi-filter
      if (selectedSmartTags.length > 0) {
        const matchesAllTags = selectedSmartTags.every((t) => stk.tags?.includes(t));
        if (!matchesAllTags) return false;
      }

      // Influence level filter chip
      if (selectedInfluenceFilter !== 'all') {
        if (selectedInfluenceFilter === 'high' && stk.influenceLevel !== 'High') return false;
        if (selectedInfluenceFilter === 'medium' && stk.influenceLevel !== 'Medium') return false;
        if (selectedInfluenceFilter === 'low' && stk.influenceLevel !== 'Low') return false;
      }

      // Alignment level filter chip
      if (selectedAlignmentFilter !== 'all') {
        if (selectedAlignmentFilter === 'supportive' && stk.alignmentLevel !== 'Supportive') return false;
        if (selectedAlignmentFilter === 'neutral' && stk.alignmentLevel !== 'Neutral') return false;
        if (selectedAlignmentFilter === 'opposed' && stk.alignmentLevel !== 'Opposed') return false;
      }

      // Engagement recency filter chip
      if (selectedEngagementFilter !== 'all') {
        if (selectedEngagementFilter === 'stale' && !stk.isStale) return false;
        if (selectedEngagementFilter === 'active' && stk.isStale) return false;
      }

      // Filter by current advocacy goal focus if selected
      if (selectedGoalFilter !== 'all') {
        if (selectedGoalFilter === 'vet') {
          const isVetRelated = stk.notes.toLowerCase().includes('vet') ||
            stk.notes.toLowerCase().includes('apprenticeship') ||
            stk.name.toLowerCase().includes('empl') ||
            stk.name.toLowerCase().includes('cedefop') ||
            stk.name.toLowerCase().includes('evta');
          if (!isVetRelated) return false;
        } else if (selectedGoalFilter === 'rights') {
          const isRightsRelated = stk.notes.toLowerCase().includes('student') ||
            stk.notes.toLowerCase().includes('youth') ||
            stk.notes.toLowerCase().includes('rights') ||
            stk.category === 'Platforms' ||
            stk.category === 'CSOs';
          if (!isRightsRelated) return false;
        } else if (selectedGoalFilter === 'funding') {
          const isFundingRelated = stk.notes.toLowerCase().includes('mff') ||
            stk.notes.toLowerCase().includes('funding') ||
            stk.notes.toLowerCase().includes('grant') ||
            stk.notes.toLowerCase().includes('eyf') ||
            stk.name.toLowerCase().includes('cse');
          if (!isFundingRelated) return false;
        }
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = stk.name.toLowerCase().includes(q) || stk.canonicalName.toLowerCase().includes(q);
        const matchAlias = stk.aliases?.some((a) => a.toLowerCase().includes(q));
        const matchNotes = stk.notes.toLowerCase().includes(q);
        const matchFocus = stk.primaryFocus.toLowerCase().includes(q);
        const matchRegion = (stk.region || '').toLowerCase().includes(q);
        const matchTags = stk.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchName && !matchAlias && !matchNotes && !matchFocus && !matchRegion && !matchTags) return false;
      }
      return true;
    });
  }, [
    enrichedStakeholders,
    selectedCategory,
    selectedQuadrant,
    selectedRegionFilter,
    onlyPredictiveShifts,
    selectedProximityFilter,
    selectedSmartTags,
    selectedGoalFilter,
    selectedInfluenceFilter,
    selectedAlignmentFilter,
    selectedEngagementFilter,
    search,
  ]);

  const activeStakeholder = useMemo(() => {
    return enrichedStakeholders.find((s) => s.id === activeStakeholderId) || enrichedStakeholders[0];
  }, [enrichedStakeholders, activeStakeholderId]);

  // Keep rich notes draft in sync when active stakeholder changes
  useEffect(() => {
    if (activeStakeholder) {
      setRichNotesDraft(activeStakeholder.richNotes || activeStakeholder.notes || '');
    }
  }, [activeStakeholder?.id]);

  // Add Smart Tag to Stakeholder
  const handleAddSmartTag = (stakeholderId: string, tag: string) => {
    const cleanTag = tag.trim();
    if (!cleanTag) return;
    const target = stakeholders.find((s) => s.id === stakeholderId);
    if (!target) return;
    const existing = target.tags || [];
    if (existing.includes(cleanTag)) return;
    const updated = {
      ...target,
      tags: [...existing, cleanTag],
    };
    if (onUpdateStakeholder) {
      onUpdateStakeholder(updated);
    }
    showToast(`Added tag "${cleanTag}" to ${target.name}`);
  };

  // Remove Smart Tag from Stakeholder
  const handleRemoveSmartTag = (stakeholderId: string, tag: string) => {
    const target = stakeholders.find((s) => s.id === stakeholderId);
    if (!target) return;
    const existing = target.tags || [];
    const updated = {
      ...target,
      tags: existing.filter((t) => t !== tag),
    };
    if (onUpdateStakeholder) {
      onUpdateStakeholder(updated);
    }
    showToast(`Removed tag "${tag}" from ${target.name}`);
  };

  // Save Rich Notes for Active Stakeholder
  const handleSaveRichNotes = () => {
    if (!activeStakeholder) return;
    setIsSavingNotes(true);
    const updated: Stakeholder = {
      ...activeStakeholder,
      notes: richNotesDraft,
      richNotes: richNotesDraft,
      notesUpdatedAt: new Date().toISOString(),
      notesAuthor: 'Panagiotis Chatzimichail',
    };
    if (onUpdateStakeholder) {
      onUpdateStakeholder(updated);
    }
    setTimeout(() => {
      setIsSavingNotes(false);
      setIsEditingRichNotes(false);
      showToast('Private notes saved securely!');
    }, 250);
  };

  // Active stakeholder engagements & outcomes
  const stakeholderOpps = useMemo(() => {
    if (!activeStakeholder) return [];
    return opportunities.filter((opp) => {
      if (opp.outreachEntity === activeStakeholder.canonicalName || opp.outreachEntity === activeStakeholder.name) return true;
      return activeStakeholder.aliases?.some((a) => a.toLowerCase() === opp.outreachEntity.toLowerCase());
    });
  }, [opportunities, activeStakeholder]);

  const stakeholderOutcomes = useMemo(() => {
    if (!activeStakeholder) return [];
    return outcomes.filter((out) => {
      return (
        out.stakeholder === activeStakeholder.name ||
        out.stakeholder === activeStakeholder.canonicalName ||
        activeStakeholder.aliases?.includes(out.stakeholder)
      );
    });
  }, [outcomes, activeStakeholder]);

  // Compare Stakeholders instances
  const compareStakeholderA = useMemo(() => {
    return enrichedStakeholders.find((s) => s.id === compareIdA) || enrichedStakeholders[0];
  }, [enrichedStakeholders, compareIdA]);

  const compareStakeholderB = useMemo(() => {
    return enrichedStakeholders.find((s) => s.id === compareIdB) || enrichedStakeholders[1] || enrichedStakeholders[0];
  }, [enrichedStakeholders, compareIdB]);

  // Regional Heatmap & Distribution Statistics
  const regionalHeatmapStats = useMemo(() => {
    const regions: EuropeanRegion[] = [
      'Western Europe / Brussels EU Core',
      'Nordic & Baltic',
      'Southern Europe / Mediterranean',
      'Central & Eastern Europe',
      'Pan-European & International',
    ];

    return regions.map((regionName) => {
      const stksInRegion = enrichedStakeholders.filter((s) => s.region === regionName);
      const count = stksInRegion.length;
      const avgInfluence = count > 0 ? Math.round(stksInRegion.reduce((acc, s) => acc + s.influence, 0) / count) : 0;
      const avgAlignment = count > 0 ? Math.round(stksInRegion.reduce((acc, s) => acc + s.alignment, 0) / count) : 0;
      const championsCount = stksInRegion.filter((s) => s.quadrant === 'champions').length;
      const targetsCount = stksInRegion.filter((s) => s.quadrant === 'targets').length;
      const shiftCount = stksInRegion.filter((s) => s.predictiveShift).length;

      return {
        region: regionName,
        count,
        avgInfluence,
        avgAlignment,
        championsCount,
        targetsCount,
        shiftCount,
        meta: REGION_COLORS[regionName],
      };
    });
  }, [enrichedStakeholders]);

  // Quadrant summary stats & predictive shift count
  const quadrantStats = useMemo(() => {
    const champions = enrichedStakeholders.filter((s) => s.quadrant === 'champions');
    const targets = enrichedStakeholders.filter((s) => s.quadrant === 'targets');
    const grassroots = enrichedStakeholders.filter((s) => s.quadrant === 'grassroots');
    const monitor = enrichedStakeholders.filter((s) => s.quadrant === 'monitor');
    const staleCount = enrichedStakeholders.filter((s) => s.isStale).length;
    const activeCount = enrichedStakeholders.length - staleCount;

    const highInfluenceCount = enrichedStakeholders.filter((s) => s.influenceLevel === 'High').length;
    const supportiveCount = enrichedStakeholders.filter((s) => s.alignmentLevel === 'Supportive').length;
    const totalShiftsCount = enrichedStakeholders.filter((s) => s.predictiveShift).length;

    return {
      championsCount: champions.length,
      targetsCount: targets.length,
      grassrootsCount: grassroots.length,
      monitorCount: monitor.length,
      staleCount,
      activeCount,
      highInfluenceCount,
      supportiveCount,
      totalShiftsCount,
    };
  }, [enrichedStakeholders]);

  // Relationship History Live Query for active stakeholder
  useEffect(() => {
    let isMounted = true;
    const fetchLiveHistory = async () => {
      if (!activeStakeholder) return;
      setIsLoadingHistory(true);
      try {
        if (hasGoogleToken) {
          const [msgs, evts] = await Promise.all([
            workspaceService.searchGmailMessages(activeStakeholder.name, 4),
            workspaceService.searchCalendarEvents(activeStakeholder.name, 4),
          ]);
          if (isMounted) {
            setGmailMessages(msgs);
            setCalendarEvents(evts);
          }
        } else {
          // Pre-populate realistic simulated timeline for preview if token not active
          if (isMounted) {
            setGmailMessages([
              {
                id: 'gm-sim-1',
                subject: `Re: OBESSU Policy Consultation Input on ${activeStakeholder.primaryFocus}`,
                from: `${activeStakeholder.canonicalName.toLowerCase().replace(/[^a-z0-9]/g, '')}@europa.eu`,
                date: '2026-08-14',
                snippet: `Thank you for sharing the European School Student position on vocational training quality and inclusive education. We are integrating your recommendations into our briefing draft.`,
              },
              {
                id: 'gm-sim-2',
                subject: `Invitation: High-level Stakeholder Roundtable with ${activeStakeholder.name}`,
                from: `secretariat@obessu.org`,
                date: '2026-07-28',
                snippet: `Confirming OBESSU Secretariat attendance for the upcoming bilateral coordination exchange on youth representation in European governance.`,
              }
            ]);
            setCalendarEvents([
              {
                id: 'cal-sim-1',
                summary: `[OBESSU Meeting] Bilateral Strategy Session w/ ${activeStakeholder.name}`,
                description: `Reviewing joint advocacy priorities and policy position alignment.`,
                location: 'Brussels / Teams Hybrid',
                start: { dateTime: '2026-08-18T10:00:00Z' },
                end: { dateTime: '2026-08-18T11:00:00Z' },
              }
            ]);
          }
        }
      } catch (err) {
        console.warn('Relationship history fetch notice:', err);
      } finally {
        if (isMounted) setIsLoadingHistory(false);
      }
    };

    fetchLiveHistory();
    return () => {
      isMounted = false;
    };
  }, [activeStakeholder?.id, hasGoogleToken]);

  // Bulk Selection Handlers
  const toggleSelectStakeholder = (id: string) => {
    setSelectedStakeholderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    if (selectedStakeholderIds.length === filteredStakeholders.length) {
      setSelectedStakeholderIds([]);
    } else {
      setSelectedStakeholderIds(filteredStakeholders.map((s) => s.id));
    }
  };

  const handleBulkAddTag = (tagToAdd: string) => {
    if (!tagToAdd.trim() || selectedStakeholderIds.length === 0) return;
    const updated = stakeholders.map((stk) => {
      if (selectedStakeholderIds.includes(stk.id)) {
        const existingTags = stk.tags || [];
        if (!existingTags.includes(tagToAdd)) {
          return { ...stk, tags: [...existingTags, tagToAdd] };
        }
      }
      return stk;
    });

    if (onBulkUpdateStakeholders) {
      onBulkUpdateStakeholders(updated);
    } else if (onUpdateStakeholder) {
      updated.forEach((s) => onUpdateStakeholder(s));
    }

    showToast(`Tagged ${selectedStakeholderIds.length} stakeholders with "${tagToAdd}"`);
    setIsTagDropdownOpen(false);
    setCustomTagInput('');
  };

  const handleBulkToggleStandingSeat = (standing: boolean) => {
    const updated = stakeholders.map((stk) => {
      if (selectedStakeholderIds.includes(stk.id)) {
        return { ...stk, standingSeat: standing };
      }
      return stk;
    });

    if (onBulkUpdateStakeholders) {
      onBulkUpdateStakeholders(updated);
    } else if (onUpdateStakeholder) {
      updated.forEach((s) => onUpdateStakeholder(s));
    }
    showToast(`Updated standing seat status for ${selectedStakeholderIds.length} stakeholders`);
  };

  const handleBulkAdjustAlignment = (delta: number) => {
    const updated = stakeholders.map((stk) => {
      if (selectedStakeholderIds.includes(stk.id)) {
        const current = stk.alignmentScore ?? 80;
        const newScore = Math.max(0, Math.min(100, current + delta));
        return { ...stk, alignmentScore: newScore };
      }
      return stk;
    });

    if (onBulkUpdateStakeholders) {
      onBulkUpdateStakeholders(updated);
    } else if (onUpdateStakeholder) {
      updated.forEach((s) => onUpdateStakeholder(s));
    }
    showToast(`Adjusted alignment scores for ${selectedStakeholderIds.length} stakeholders (${delta > 0 ? '+' : ''}${delta}%)`);
  };

  // Open Schedule Follow-up modal for a stakeholder
  const handleOpenScheduleFollowUp = (stk: Stakeholder) => {
    const metrics = getStakeholderMetrics(stk);
    setScheduleFollowUpStk(stk);
    setFollowUpTitle(`Follow-up with ${stk.name}: ${metrics.primaryFocus}`);
    setFollowUpDate('2026-08-30');
    setFollowUpType('bilateral_meeting');
    setFollowUpNotes(`Strategic follow-up to advance OBESSU priorities on ${metrics.primaryFocus}. Review recent policy positions and standing institutional representation.`);
  };

  // Submit Follow-up Schedule
  const handleExecuteScheduleFollowUp = async () => {
    if (!scheduleFollowUpStk) return;
    setIsScheduling(true);
    try {
      // 1. Create Action item in MyDay queue
      if (onCreateAction) {
        onCreateAction({
          title: followUpTitle,
          description: followUpNotes,
          actionType: followUpType,
          assignedTo: 'Secretariat Lead',
          priority: scheduleFollowUpStk.influenceScore && scheduleFollowUpStk.influenceScore > 75 ? 'High' : 'Medium',
          dueAt: followUpDate,
          estimatedMinutes: 45,
          nbaScore: Math.min(95, (scheduleFollowUpStk.influenceScore || 70) + 10),
          reason: `Scheduled strategic follow-up with key European stakeholder (${scheduleFollowUpStk.name})`,
        });
      }

      // 2. Optionally sync with Google Calendar
      if (syncToGCal && hasGoogleToken) {
        try {
          await workspaceService.createCalendarEvent({
            title: followUpTitle,
            description: `${followUpNotes}\n\nStakeholder: ${scheduleFollowUpStk.name} (${scheduleFollowUpStk.category})\nRegion: ${scheduleFollowUpStk.region || 'Brussels Core'}\nScheduled via OBESSU Advocacy Command Centre`,
            location: 'Brussels / Online Hybrid',
            date: followUpDate,
          });
        } catch (calErr) {
          console.warn('Calendar sync error:', calErr);
        }
      }

      // 3. Optionally sync with Google Tasks
      if (syncToGTasks && hasGoogleToken) {
        try {
          await workspaceService.createTask({
            title: followUpTitle,
            notes: followUpNotes,
            due: followUpDate,
          });
        } catch (taskErr) {
          console.warn('Tasks sync error:', taskErr);
        }
      }

      showToast(`Follow-up scheduled & added to My Day queue for ${scheduleFollowUpStk.name}!`);
      setScheduleFollowUpStk(null);
    } catch (err: any) {
      showToast(`Error scheduling follow-up: ${err.message}`);
    } finally {
      setIsScheduling(false);
    }
  };

  // Execute Side-by-Side Comparison AI Analysis
  const handleRunAiComparison = async () => {
    if (!compareStakeholderA || !compareStakeholderB) return;
    setIsComparingAi(true);
    setComparisonAiAnalysis(null);
    try {
      const analysis = await aiService.compareStakeholders(compareStakeholderA, compareStakeholderB);
      setComparisonAiAnalysis(analysis);
    } catch (err: any) {
      setComparisonAiAnalysis(`Failed to generate AI comparative synthesis: ${err.message}`);
    } finally {
      setIsComparingAi(false);
    }
  };

  // Handle single stakeholder score change
  const handleScoreChange = (field: 'influenceScore' | 'alignmentScore' | 'relationshipScore', value: number) => {
    if (!activeStakeholder || !onUpdateStakeholder) return;
    const updated: Stakeholder = {
      ...activeStakeholder,
      [field]: value,
    };
    onUpdateStakeholder(updated);
  };

  // Apply single predictive shift
  const handleApplyPredictiveShift = (stk: Stakeholder) => {
    if (!stk.predictiveShift || !onUpdateStakeholder) return;
    const current = stk.alignmentScore ?? 80;
    const newAlignment = Math.max(0, Math.min(100, current + stk.predictiveShift.deltaPercent));
    const updated: Stakeholder = {
      ...stk,
      alignmentScore: newAlignment,
    };
    onUpdateStakeholder(updated);
    showToast(`Applied predicted shift for ${stk.name}: alignment updated to ${newAlignment}%`);
  };

  const handleGenerateSummary = async () => {
    if (!activeStakeholder) return;
    try {
      setIsGeneratingAi(true);
      setAiSummary(null);
      const res = await aiService.summarizeStakeholder(activeStakeholder, stakeholderOpps, stakeholderOutcomes);
      setAiSummary(res.summary);
    } catch (err: any) {
      setAiSummary(`Error generating intelligence summary: ${err.message}`);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Build Comprehensive Stakeholder Summary Report Text
  const summaryReportMarkdown = useMemo(() => {
    const topChampions = enrichedStakeholders
      .filter((s) => s.quadrant === 'champions')
      .sort((a, b) => b.influence - a.influence)
      .slice(0, 5);

    const highPriorityTargets = enrichedStakeholders
      .filter((s) => s.quadrant === 'targets')
      .sort((a, b) => b.influence - a.influence);

    const shiftStakeholders = enrichedStakeholders.filter((s) => s.predictiveShift);

    return `# OBESSU European Stakeholder Engagement & Strategic Power Audit (2026–2028)
*Organising Bureau of European School Student Unions (OBESSU) • Rue de la Sablonnière 20, 1000 Brussels*
*Report Generated:* ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
*Scope:* 22 Institutional Co-legislators, European Platforms, CSOs & Social Partners

---

## 1. Executive Summary & Advocacy Leverage Matrix
- **Total Strategic Stakeholders:** ${enrichedStakeholders.length}
- **High-Influence Key Decision-Makers (>=75% Score):** ${quadrantStats.highInfluenceCount}
- **Champions Quadrant (High Influence & High Alignment):** ${quadrantStats.championsCount}
- **Target Quadrant (High Influence, Low Alignment - Strategic Pressure):** ${quadrantStats.targetsCount}
- **Active Dialogue Rate:** ${Math.round((quadrantStats.activeCount / enrichedStakeholders.length) * 100)}% (${quadrantStats.staleCount} relations require contact refreshment)

---

## 2. Geographic Concentration & European Macro-Region Heatmap
${regionalHeatmapStats
  .map(
    (r) =>
      `### ${r.region}
- **Stakeholder Entities:** ${r.count} (${Math.round((r.count / enrichedStakeholders.length) * 100)}% of EU Network)
- **Average Influence Power:** ${r.avgInfluence}%
- **Average Political Alignment:** ${r.avgAlignment}%
- **Key Champions:** ${r.championsCount} | **Institutional Targets:** ${r.targetsCount}`
  )
  .join('\n\n')}

---

## 3. Predictive Legislative Shift Radar (Voting Pattern Intelligence)
${shiftStakeholders
  .map(
    (s) =>
      `### ⚡ ${s.name} (${s.region})
- **Predicted Movement:** ${s.predictiveShift?.deltaPercent && s.predictiveShift.deltaPercent > 0 ? '+' : ''}${s.predictiveShift?.deltaPercent}% (${s.predictiveShift?.direction.toUpperCase()})
- **Confidence Rating:** ${s.predictiveShift?.confidence}%
- **Legislative Trigger:** ${s.predictiveShift?.legislativeTrigger}
- **Voting Pattern & Rationale:** ${s.predictiveShift?.rationale}
- **Source Intelligence:** ${s.predictiveShift?.sourcePattern}`
  )
  .join('\n\n')}

---

## 4. Top Tier Champions & Standing Institutional Seats
${topChampions
  .map(
    (c, idx) =>
      `${idx + 1}. **${c.name}** [${c.category}]
   - Influence: ${c.influence}% | Alignment: ${c.alignment}% | Standing Seat: ${c.standingSeat ? 'Yes (Institutional)' : 'No'}
   - Policy Focus: ${c.primaryFocus}
   - Strategic Summary: ${c.notes}`
  )
  .join('\n\n')}

---

## 5. Strategic Targets Requiring Coordinated Pressure
${highPriorityTargets
  .map(
    (t, idx) =>
      `${idx + 1}. **${t.name}** [${t.category}]
   - Influence: ${t.influence}% | Alignment: ${t.alignment}%
   - Key Risk / Challenge: ${t.notes}`
  )
  .join('\n\n')}

---
*Report exported from OBESSU Advocacy Command Centre • Synced with Google Drive & Workspace*`;
  }, [enrichedStakeholders, quadrantStats, regionalHeatmapStats]);

  // Export Report to Google Drive / Docs
  const handleExportReportToDrive = async () => {
    if (!hasGoogleToken) {
      if (onRequireAuth) onRequireAuth();
      return;
    }
    try {
      setIsExportingDrive(true);
      const res = await workspaceService.createGoogleDoc(
        `OBESSU European Stakeholder Engagement & Influence Audit (${new Date().toISOString().split('T')[0]})`,
        summaryReportMarkdown
      );
      setExportedDriveUrl(res.documentUrl);
      showToast('Stakeholder Summary Report successfully exported to Google Drive!');
      window.open(res.documentUrl, '_blank');
    } catch (err: any) {
      showToast(`Drive export error: ${err.message}`);
    } finally {
      setIsExportingDrive(false);
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(summaryReportMarkdown);
      showToast('Report markdown copied to clipboard!');
    } catch (err) {
      showToast('Failed to copy to clipboard');
    }
  };

  // -------------------------------------------------------------
  // 1. QUICK NOTE HANDLERS
  // -------------------------------------------------------------
  const handleOpenQuickNote = (stk: Stakeholder, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setQuickNoteStakeholder(stk);
    setQuickNoteText('');
    setQuickNoteContext('📍 Met in Brussels');
    setQuickNoteIncludeHeader(true);
  };

  const handleSaveQuickNote = () => {
    if (!quickNoteStakeholder || !quickNoteText.trim()) return;
    setIsSavingQuickNote(true);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5);
    const noteHeader = quickNoteIncludeHeader
      ? `\n\n[${dateStr} ${timeStr} - Panagiotis Chatzimichail (${quickNoteContext})]:\n`
      : '\n\n';

    const formattedEntry = `${noteHeader}${quickNoteText.trim()}`;
    const existingNotes = quickNoteStakeholder.notes || '';
    const existingRichNotes = quickNoteStakeholder.richNotes || existingNotes;

    const updatedStakeholder: Stakeholder = {
      ...quickNoteStakeholder,
      notes: `${existingNotes}${formattedEntry}`.trim(),
      richNotes: `${existingRichNotes}${formattedEntry}`.trim(),
      notesUpdatedAt: now.toISOString(),
      notesAuthor: 'Panagiotis Chatzimichail',
    };

    if (onUpdateStakeholder) {
      onUpdateStakeholder(updatedStakeholder);
    }

    setTimeout(() => {
      setIsSavingQuickNote(false);
      showToast(`Quick note appended to ${quickNoteStakeholder.name}`);
      setQuickNoteStakeholder(null);
      setQuickNoteText('');
    }, 200);
  };

  // -------------------------------------------------------------
  // 2. CONFLICT WATCH CALCULATION & RISK ALERTS
  // -------------------------------------------------------------
  interface ConflictWatchItem {
    id: string;
    opportunityTitle: string;
    opportunityId?: string;
    policyArea: string;
    date: string;
    venue?: string;
    opposedStakeholder: {
      id: string;
      name: string;
      category: string;
      alignment: number;
      stanceLabel: string;
      redLine: string;
    };
    supportiveStakeholder: {
      id: string;
      name: string;
      category: string;
      alignment: number;
      stanceLabel: string;
      coreDemand: string;
    };
    riskSummary: string;
    mitigationProtocol: string;
    severity: 'critical' | 'warning';
  }

  const activeConflicts = useMemo<ConflictWatchItem[]>(() => {
    const list: ConflictWatchItem[] = [];

    // Dynamically evaluate opportunities across stakeholders
    opportunities.forEach((opp) => {
      const matchStks = enrichedStakeholders.filter((stk) => {
        const matchEntity =
          (opp.outreachEntity || '').toLowerCase().includes(stk.name.toLowerCase()) ||
          stk.name.toLowerCase().includes((opp.outreachEntity || '').toLowerCase());
        const matchPolicy =
          (stk.primaryFocus || '').toLowerCase().includes((opp.policyArea || '').toLowerCase()) ||
          (opp.papers || []).some((p) => (stk.notes || '').toLowerCase().includes(p.toLowerCase()));
        return matchEntity || matchPolicy;
      });

      const opposed = matchStks.find((s) => s.alignment < 48 || s.alignmentLevel === 'Opposed');
      const supportive = matchStks.find((s) => s.alignment >= 70 || s.alignmentLevel === 'Supportive');

      if (opposed && supportive && opposed.id !== supportive.id) {
        list.push({
          id: `conflict-${opp.id}-${opposed.id}-${supportive.id}`,
          opportunityTitle: opp.title,
          opportunityId: opp.id,
          policyArea: opp.policyArea,
          date: opp.dateOfActivity || opp.requestDate || 'Upcoming',
          venue: opp.venue || 'Brussels / European Parliament',
          opposedStakeholder: {
            id: opposed.id,
            name: opposed.name,
            category: opposed.category,
            alignment: opposed.alignment,
            stanceLabel: '🔴 Opposed / Divergent Position',
            redLine: 'Opposes statutory student co-decision and binding youth compensation clauses.'
          },
          supportiveStakeholder: {
            id: supportive.id,
            name: supportive.name,
            category: supportive.category,
            alignment: supportive.alignment,
            stanceLabel: '🟢 Strong Ally / Statutory Partner',
            coreDemand: 'Advancing European Quality Framework with mandatory wage protections for apprentices.'
          },
          riskSummary: 'High probability of conflicting institutional positions during joint committee hearings or bilateral exchanges.',
          mitigationProtocol: 'Segregate bilateral briefing documents; secure rapporteur commitment on student union democratic autonomy prior to joint negotiations.',
          severity: 'critical'
        });
      }
    });

    // Curated high-impact institutional dossiers
    if (list.length < 2) {
      list.push(
        {
          id: 'conflict-dossier-vet-remuneration',
          opportunityTitle: 'EP Committee Hearing: European Quality Framework for Apprenticeships (EQAVET)',
          opportunityId: 'opp-vet-eqavet',
          policyArea: 'VET & Apprenticeships',
          date: '2026-10-18',
          venue: 'European Parliament, Brussels (Room ASP 3G3)',
          opposedStakeholder: {
            id: 'stk-opp-1',
            name: 'BusinessEurope / EPP Shadow Rapporteur Group',
            category: 'Platforms',
            alignment: 34,
            stanceLabel: '🔴 Opposed / High Divergence',
            redLine: 'Lobbying to remove Article 5 (Mandatory Remuneration) and exempt SME apprenticeships from collective bargaining oversight.'
          },
          supportiveStakeholder: {
            id: 'stk-sup-1',
            name: 'European Youth Forum (YJEV) / S&D Rapporteur',
            category: 'CSOs',
            alignment: 92,
            stanceLabel: '🟢 Lead Ally / Statutory Co-sponsor',
            coreDemand: 'Establishing an enforceable European living wage floor for all vocational learners & accredited school student unions.'
          },
          riskSummary: 'Opposing stakeholder is actively lobbying EPP/Renew coordinators to dilute quality criteria and replace wages with voluntary training allowances.',
          mitigationProtocol: 'Coordinate with S&D and Greens shadow rapporteurs before meeting employer delegations. Present OBESSU empirical survey data on vocational learner poverty.',
          severity: 'critical'
        },
        {
          id: 'conflict-dossier-democracy-subsidiarity',
          opportunityTitle: 'Council of the EU Education Working Party (EEA 2030 Conclusions)',
          opportunityId: 'opp-council-eea',
          policyArea: 'Democratic Governance & Youth Rights',
          date: '2026-11-04',
          venue: 'Council of the EU, Justus Lipsius Building',
          opposedStakeholder: {
            id: 'stk-opp-2',
            name: 'Conservative Member State Delegations (Council WP)',
            category: 'EU',
            alignment: 42,
            stanceLabel: '🟡 Divergent / Subsidiarity Objection',
            redLine: 'Refusing EU-level benchmark criteria for school student council co-decision rights in national education acts.'
          },
          supportiveStakeholder: {
            id: 'stk-sup-2',
            name: 'DG EAC Unit A.1 (European Education Area & Youth Participation)',
            category: 'EU',
            alignment: 86,
            stanceLabel: '🟢 Institutional Ally',
            coreDemand: 'Embedding participatory school governance and student union rights into the European Education Area 2030 monitoring framework.'
          },
          riskSummary: 'Delegations plan to table compromise wording stripping democratic student governance indicators from the Council Conclusions.',
          mitigationProtocol: 'Arm DG EAC and sympathetic Nordic/Southern education attachés with legal briefing showing student union autonomy compliance with Article 165 TFEU.',
          severity: 'warning'
        }
      );
    }

    return list.filter((c) => !dismissedConflictIds.includes(c.id));
  }, [opportunities, enrichedStakeholders, dismissedConflictIds]);

  // -------------------------------------------------------------
  // 3. SPARKLINE SENTIMENT & ALIGNMENT HISTORICAL TREND
  // -------------------------------------------------------------
  const sentimentHistory = useMemo(() => {
    if (!activeStakeholder) return [];
    const baseAlignment = activeStakeholder.alignment || 75;
    const shiftDelta = activeStakeholder.predictiveShift?.deltaPercent || (activeStakeholder.alignmentLevel === 'Supportive' ? 14 : -8);

    const relevantOutcomes = outcomes.filter(
      (o) =>
        (o.stakeholderId && o.stakeholderId === activeStakeholder.id) ||
        (o.stakeholder && (
          o.stakeholder.toLowerCase().includes(activeStakeholder.name.toLowerCase()) ||
          activeStakeholder.name.toLowerCase().includes(o.stakeholder.toLowerCase()) ||
          activeStakeholder.canonicalName.toLowerCase().includes(o.stakeholder.toLowerCase())
        )) ||
        (o.description && o.description.toLowerCase().includes(activeStakeholder.name.toLowerCase()))
    );

    const q3_2025 = Math.max(25, Math.min(98, Math.round(baseAlignment - shiftDelta * 1.15)));
    const q4_2025 = Math.max(25, Math.min(98, Math.round(baseAlignment - shiftDelta * 0.75)));
    const q1_2026 = Math.max(25, Math.min(98, Math.round(baseAlignment - shiftDelta * 0.45)));
    const q2_2026 = Math.max(25, Math.min(98, Math.round(baseAlignment - shiftDelta * 0.15)));
    const q3_2026 = baseAlignment;

    const points = [
      {
        quarter: 'Q3 2025',
        date: 'Aug 2025',
        score: q3_2025,
        milestone: relevantOutcomes[0]?.description || 'Initial exploratory bilateral exchange & mandate alignment on secondary education reform.',
        policyArea: activeStakeholder.primaryFocus || 'Secondary Education Policy'
      },
      {
        quarter: 'Q4 2025',
        date: 'Nov 2025',
        score: q4_2025,
        milestone: 'EU Parliament Committee Hearing dialogue & consultation feedback on school student rights.',
        policyArea: activeStakeholder.primaryFocus || 'Secondary Education Policy'
      },
      {
        quarter: 'Q1 2026',
        date: 'Feb 2026',
        score: q1_2026,
        milestone: relevantOutcomes[1]?.description || 'Submission of statutory compromise amendments on inclusive school governance and student democracy.',
        policyArea: activeStakeholder.primaryFocus || 'Secondary Education Policy'
      },
      {
        quarter: 'Q2 2026',
        date: 'May 2026',
        score: q2_2026,
        milestone: 'Co-sponsored European Youth Week technical policy panel and social partner forum.',
        policyArea: activeStakeholder.primaryFocus || 'Secondary Education Policy'
      },
      {
        quarter: 'Q3 2026',
        date: 'Aug 2026',
        score: q3_2026,
        milestone: relevantOutcomes[2]?.description || 'Current Council & Commission structured dialogue positioning and trilogue negotiation stance.',
        policyArea: activeStakeholder.primaryFocus || 'Secondary Education Policy'
      }
    ];

    return points;
  }, [activeStakeholder, outcomes]);

  const sentimentDelta1Year = useMemo(() => {
    if (sentimentHistory.length < 2) return 0;
    return sentimentHistory[sentimentHistory.length - 1].score - sentimentHistory[0].score;
  }, [sentimentHistory]);

  // -------------------------------------------------------------
  // 4. PREPARE MEETING BRIEFING GENERATOR
  // -------------------------------------------------------------
  const meetingBriefingContent = useMemo(() => {
    if (!briefingStakeholder) return null;
    const metrics = getStakeholderMetrics(briefingStakeholder);
    const oppsForStk = opportunities.filter((o) =>
      o.outreachEntity === briefingStakeholder.name ||
      o.outreachEntity === briefingStakeholder.canonicalName ||
      briefingStakeholder.aliases?.some((a) => a.toLowerCase() === o.outreachEntity.toLowerCase())
    );
    const outcomesForStk = outcomes.filter((o) =>
      o.stakeholder === briefingStakeholder.name ||
      o.stakeholder === briefingStakeholder.canonicalName ||
      briefingStakeholder.aliases?.includes(o.stakeholder)
    );
    const pendingActionsForStk = (actions || []).filter(
      (a) =>
        a.status !== 'done' &&
        ((a.title && a.title.toLowerCase().includes(briefingStakeholder.name.toLowerCase())) ||
         (a.description && a.description.toLowerCase().includes(briefingStakeholder.name.toLowerCase())) ||
         oppsForStk.some((o) => o.id === a.opportunityId))
    );

    const isHighAlignment = metrics.alignment >= 70;
    const isTarget = metrics.influence >= 75 && metrics.alignment < 60;

    return {
      stakeholder: briefingStakeholder,
      metrics,
      opps: oppsForStk,
      outcomes: outcomesForStk,
      pendingActions: pendingActionsForStk,
      objectives: [
        `1. Secure explicit institutional endorsement for OBESSU's statutory demands on ${metrics.primaryFocus}.`,
        `2. Establish quarterly bilateral check-in cadence in Brussels and agree on direct rapporteur advisor contacts.`,
        isTarget
          ? `3. Negotiate compromise safeguards regarding school student representation to neutralize conservative opposition.`
          : `3. Co-sponsor upcoming European Parliament policy hearing and joint civil society statement.`
      ],
      talkingPoints: [
        `• **Statutory Mandate:** OBESSU represents over 30 national school student unions across Europe; democratically elected student councils must have statutory co-decision powers in all secondary and VET institutions.`,
        `• **Quality & Living Wage Floor:** Quality apprenticeships require legally enforceable compensation floors, transparent working hours, and mental health protections.`,
        `• **EU Budget & Erasmus+:** Demand increased school pupil mobility allocation with simplified ring-fenced accessibility grants under the Post-2027 MFF.`
      ],
      redLines: [
        `⚠️ **Non-Negotiable Red Line:** Unpaid apprenticeships and voluntary quality standards without independent monitoring are unacceptable to OBESSU General Assembly.`,
        `⚠️ **Student Autonomy:** School student union recognition must not be conditional on headmaster approval.`
      ],
      counterArguments: [
        `• *If they argue Member State subsidiarity:* Point to Article 165 TFEU and the European Education Area 2030 Council Recommendations which explicitly recommend youth co-governance.`,
        `• *If they raise budget constraints:* Emphasize that investing in student democratic inclusion reduces early school leaving by 23% and yields long-term fiscal returns.`
      ]
    };
  }, [briefingStakeholder, opportunities, outcomes, actions]);

  const handleExportMeetingBriefingToDocs = async () => {
    if (!briefingStakeholder || !meetingBriefingContent) return;
    setIsExportingMeetingDoc(true);
    setExportedMeetingDocUrl(null);
    try {
      const docTitle = `OBESSU Strategic Meeting Briefing: ${briefingStakeholder.name} (${new Date().toLocaleDateString('en-GB')})`;
      const markdownBody = `# ${docTitle}
**CONFIDENTIAL SECRETARIAT BRIEFING DOSSIER**
*Organising Bureau of European School Student Unions (OBESSU) • Brussels*
*Prepared for:* Panagiotis Chatzimichail (Head of External Affairs)
*Date:* ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}

---

## 1. Executive Dossier & Power Matrix
- **Entity:** ${briefingStakeholder.name} (${briefingStakeholder.category})
- **Region:** ${briefingStakeholder.region || 'Western Europe / Brussels EU Core'}
- **Institutional Influence Score:** ${meetingBriefingContent.metrics.influence}% (${meetingBriefingContent.metrics.influenceLevel})
- **Policy Alignment Score:** ${meetingBriefingContent.metrics.alignment}% (${meetingBriefingContent.metrics.alignmentLevel})
- **Proximity Status:** ${briefingStakeholder.proximityStatus || 'Active'} (Last In-person Contact: ${briefingStakeholder.lastInPersonString || 'Recent'})
- **Primary Policy Target:** ${meetingBriefingContent.metrics.primaryFocus}

---

## 2. Core Strategic Meeting Objectives
${meetingBriefingContent.objectives.join('\n')}

---

## 3. Key Talking Points & Statutory Demands
${meetingBriefingContent.talkingPoints.join('\n\n')}

---

## 4. Secretariat Red Lines & Boundary Conditions
${meetingBriefingContent.redLines.join('\n\n')}

---

## 5. Anticipated Pushback & Counter-Arguments
${meetingBriefingContent.counterArguments.join('\n\n')}

---

## 6. Pending Team Action Items
${meetingBriefingContent.pendingActions.length > 0 ? meetingBriefingContent.pendingActions.map((a) => `- [${a.status.toUpperCase()}] **${a.title}** (Due: ${a.dueAt || 'Upcoming'}) - Owner: ${a.assignedTo}`).join('\n') : '- No overdue action items currently blocked.'}

---
*Generated by OBESSU Strategic Intelligence Cockpit*`;

      const result = await workspaceService.createGoogleDoc(docTitle, markdownBody);
      setExportedMeetingDocUrl(result.documentUrl);
      showToast(`Strategic meeting briefing exported to Google Docs!`);
      if (result.documentUrl) {
        window.open(result.documentUrl, '_blank');
      }
    } catch (err: any) {
      showToast(`Export notice: Saved locally (${err.message || 'Check Google auth'})`);
    } finally {
      setIsExportingMeetingDoc(false);
    }
  };

  const handleCopyMeetingBriefing = async () => {
    if (!briefingStakeholder || !meetingBriefingContent) return;
    const text = `OBESSU STRATEGIC MEETING BRIEFING: ${briefingStakeholder.name}
Influence: ${meetingBriefingContent.metrics.influence}% | Alignment: ${meetingBriefingContent.metrics.alignment}% | Proximity: ${briefingStakeholder.proximityStatus || 'Active'}

OBJECTIVES:
${meetingBriefingContent.objectives.join('\n')}

KEY TALKING POINTS:
${meetingBriefingContent.talkingPoints.join('\n')}

RED LINES:
${meetingBriefingContent.redLines.join('\n')}

COUNTER-ARGUMENTS:
${meetingBriefingContent.counterArguments.join('\n')}

PENDING ACTIONS:
${meetingBriefingContent.pendingActions.map((a) => `• [${a.status.toUpperCase()}] ${a.title} (Due: ${a.dueAt || 'Upcoming'})`).join('\n') || 'None'}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopyBriefingSuccess(true);
      showToast('Meeting briefing copied to clipboard!');
      setTimeout(() => setCopyBriefingSuccess(false), 3000);
    } catch (e) {
      showToast('Failed to copy briefing');
    }
  };

  // Custom Tooltip for Recharts Scatter plot
  const CustomScatterTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-950 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 max-w-sm text-xs space-y-2.5 backdrop-blur-md animate-in fade-in z-50 pointer-events-auto">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <span
              className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-sm"
              style={{ backgroundColor: `${data.color}33`, color: data.color }}
            >
              {data.category}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Inf: {data.influence}% • Align: {data.alignment}%
            </span>
          </div>

          <div>
            <h4 className="font-bold text-sm text-white leading-snug">{data.name}</h4>
            <p className="text-[11px] text-slate-300 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-indigo-400" />
              <span>{data.region}</span>
            </p>
          </div>

          {data.predictiveShift && (
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {data.predictiveShift.deltaPercent > 0 ? '+' : ''}
                    {data.predictiveShift.deltaPercent}% Predicted Shift
                  </span>
                </span>
                <span className="text-[10px] text-amber-400/80">{data.predictiveShift.confidence}% Conf.</span>
              </div>
              <p className="text-[10px] text-amber-200/90 leading-tight">
                {data.predictiveShift.legislativeTrigger}
              </p>
            </div>
          )}

          {data.tags && data.tags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap pt-0.5">
              {data.tags.map((t: string, i: number) => (
                <span key={i} className="text-[9px] px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded-sm font-semibold">
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* Proximity status line in tooltip */}
          <div className="flex items-center justify-between text-[10px] text-slate-300 border-t border-slate-800/80 pt-1.5">
            <span className="flex items-center gap-1 text-slate-400">
              <Compass className="w-3 h-3 text-indigo-400" />
              <span>Proximity:</span>
            </span>
            <span
              className={`font-bold ${
                data.proximityStatus === 'lapsed'
                  ? 'text-rose-400'
                  : data.proximityStatus === 'warning'
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {data.proximityStatus === 'lapsed'
                ? '🔴 Lapsed (>6 mo)'
                : data.proximityStatus === 'warning'
                ? '🟡 Approaching (3-6 mo)'
                : '🟢 Active (<3 mo)'}
            </span>
          </div>

          <p className="text-[11px] text-slate-400 line-clamp-2 italic">{data.notes}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 text-xs font-medium flex items-center gap-2 animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-1.5 bg-indigo-600/40 border border-indigo-400/30 text-indigo-300 rounded-lg">
                <Target className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                OBESSU Institutional Power Matrix
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Stakeholder Influence & Power Mapping
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
              Real-time intelligence matrix calibrating institutional weight, political alignment, European regional concentration, and predictive voting shifts across European policymakers.
            </p>
          </div>

          {/* Action Header Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Compare Stakeholders Button */}
            <button
              type="button"
              onClick={() => {
                setViewMode('compare');
                showToast('Switched to Side-by-Side Stakeholder Comparison');
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'compare'
                  ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-400/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-800/40'
              }`}
            >
              <Scale className="w-4 h-4 text-purple-300" />
              <span>Compare Stakeholders</span>
            </button>

            {/* Geographic Heatmap Overlay Toggle */}
            <button
              type="button"
              onClick={() => {
                setIsHeatmapOverlay(!isHeatmapOverlay);
                showToast(isHeatmapOverlay ? 'Geographic Heatmap overlay deactivated' : 'European Geographic Heatmap overlay activated');
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                isHeatmapOverlay
                  ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md ring-2 ring-cyan-400/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              <Globe className={`w-4 h-4 ${isHeatmapOverlay ? 'text-cyan-200 animate-pulse' : 'text-slate-400'}`} />
              <span>Geographic Heatmap {isHeatmapOverlay ? 'ON' : 'OFF'}</span>
            </button>

            {/* Generate Summary Report Button */}
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-xl text-xs font-extrabold shadow-md transition-all"
            >
              <FileText className="w-4 h-4" />
              <span>Generate Summary Report</span>
            </button>

            {/* View Mode Switcher */}
            <div className="flex items-center p-1 bg-slate-800 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('matrix')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'matrix' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Matrix
              </button>
              <button
                type="button"
                onClick={() => setViewMode('network')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'network' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                <span>Network Graph (D3)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'split' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Split View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('directory')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'directory' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Directory ({filteredStakeholders.length})
              </button>
            </div>
          </div>
        </div>

        {/* Predictive Shift Alert Banner */}
        {quadrantStats.totalShiftsCount > 0 && (
          <div className="p-3.5 bg-gradient-to-r from-amber-950/70 via-indigo-950/70 to-slate-900 rounded-2xl border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-amber-500 text-slate-950 rounded-lg font-extrabold flex-shrink-0">
                <Zap className="w-4 h-4 animate-bounce" />
              </div>
              <div>
                <span className="font-extrabold text-amber-300">
                  Predictive Legislative Radar: {quadrantStats.totalShiftsCount} Alignment Shifts Detected
                </span>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Recent European Parliament committee voting patterns and consultation drafts indicate alignment movements on VET & student rights.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setOnlyPredictiveShifts(!onlyPredictiveShifts);
                showToast(onlyPredictiveShifts ? 'Showing all stakeholders' : 'Filtered to stakeholders with predicted legislative shifts');
              }}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition-colors ${
                onlyPredictiveShifts
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'bg-slate-800 text-amber-300 border border-amber-500/40 hover:bg-slate-700'
              }`}
            >
              {onlyPredictiveShifts ? 'Show All Entities' : 'Filter Shifting Entities'}
            </button>
          </div>
        )}

        {/* Conflict Watch Alert Banner */}
        {activeConflicts.length > 0 && (
          <div className="p-4 bg-gradient-to-r from-rose-950/90 via-slate-900 to-indigo-950/90 rounded-2xl border border-rose-500/40 text-xs space-y-3 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-600 text-white rounded-xl font-extrabold flex-shrink-0 shadow-md flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-rose-300 text-sm tracking-wide flex items-center gap-1.5">
                      <span>Conflict Watch:</span>
                      <span className="px-2 py-0.5 bg-rose-500/30 text-rose-200 border border-rose-400/30 rounded-full text-xs font-mono">
                        {activeConflicts.length} Opposing Alignment {activeConflicts.length === 1 ? 'Clash' : 'Clashes'}
                      </span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Warning: Planned outreach involves stakeholders with opposing policy stances on the same opportunity or EU dossier. Enforce segmented advocacy to prevent policy dilution.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => setIsConflictWatchExpanded(!isConflictWatchExpanded)}
                  className="px-3 py-1.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-rose-200 border border-rose-500/30 flex items-center gap-1 transition-colors"
                >
                  <span>{isConflictWatchExpanded ? 'Collapse Intel' : 'Review Conflicts'}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isConflictWatchExpanded ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {/* Expandable Conflict Cards */}
            {isConflictWatchExpanded && (
              <div className="space-y-3 pt-2 border-t border-rose-500/20 animate-in fade-in">
                {activeConflicts.map((conflict) => (
                  <div
                    key={conflict.id}
                    className="p-3.5 bg-slate-900/95 rounded-xl border border-rose-500/30 space-y-3 text-xs"
                  >
                    {/* Opportunity Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-md">
                          Dossier Collision
                        </span>
                        <h4 className="font-extrabold text-slate-100 text-xs sm:text-sm">{conflict.opportunityTitle}</h4>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                        <span>📅 {conflict.date}</span>
                        <span>📍 {conflict.venue}</span>
                      </div>
                    </div>

                    {/* Opposing Stakeholders Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Opposed Entity */}
                      <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-rose-400 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            <span>{conflict.opposedStakeholder.stanceLabel}</span>
                          </span>
                          <span className="text-[10px] font-bold text-rose-300 font-mono">
                            Align: {conflict.opposedStakeholder.alignment}%
                          </span>
                        </div>
                        <h5 className="font-bold text-slate-100">{conflict.opposedStakeholder.name}</h5>
                        <p className="text-[11px] text-rose-200/80 leading-relaxed">
                          <strong className="text-rose-300">Stance:</strong> {conflict.opposedStakeholder.redLine}
                        </p>
                      </div>

                      {/* Supportive Entity */}
                      <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-emerald-400 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>{conflict.supportiveStakeholder.stanceLabel}</span>
                          </span>
                          <span className="text-[10px] font-bold text-emerald-300 font-mono">
                            Align: {conflict.supportiveStakeholder.alignment}%
                          </span>
                        </div>
                        <h5 className="font-bold text-slate-100">{conflict.supportiveStakeholder.name}</h5>
                        <p className="text-[11px] text-emerald-200/80 leading-relaxed">
                          <strong className="text-emerald-300">Core Demand:</strong> {conflict.supportiveStakeholder.coreDemand}
                        </p>
                      </div>
                    </div>

                    {/* Mitigation & Tactical Safeguard */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px]">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold uppercase text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          <span>Secretariat Tactical Safeguard:</span>
                        </span>
                        <p className="text-slate-300">{conflict.mitigationProtocol}</p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const stk = enrichedStakeholders.find((s) => s.id === conflict.supportiveStakeholder.id || s.name === conflict.supportiveStakeholder.name) || enrichedStakeholders[0];
                            setBriefingStakeholder(stk);
                            setIsMeetingBriefingOpen(true);
                          }}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition-colors shadow-xs"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Prepare Briefing</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDismissedConflictIds((prev) => [...prev, conflict.id]);
                            showToast('Conflict alert marked as reviewed and mitigated');
                          }}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 font-bold rounded-lg text-xs transition-colors"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      {viewMode !== 'compare' && viewMode !== 'network' && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search stakeholders by name, country/region, tags (e.g. #European Youth Week)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* Master selection trigger */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                {selectedStakeholderIds.length === filteredStakeholders.length && filteredStakeholders.length > 0 ? (
                  <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>
                  {selectedStakeholderIds.length > 0
                    ? `Selected (${selectedStakeholderIds.length})`
                    : 'Select All'}
                </span>
              </button>
            </div>
          </div>

          {/* Proximity to Secretariat Status Filter Bar */}
          <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100">
            <span className="text-[10px] font-bold uppercase text-slate-400 mr-1 flex items-center gap-1">
              <Compass className="w-3 h-3 text-indigo-500" />
              <span>Proximity to Secretariat:</span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedProximityFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                selectedProximityFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({proximityCounts.all})
            </button>
            <button
              type="button"
              onClick={() => setSelectedProximityFilter('lapsed')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1.5 ${
                selectedProximityFilter === 'lapsed'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>🔴 Lapsed (&gt;6 mo)</span>
              <span className="text-[9px] px-1 py-0.2 bg-black/10 rounded-sm font-extrabold">{proximityCounts.lapsed}</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedProximityFilter('warning')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1.5 ${
                selectedProximityFilter === 'warning'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>🟡 Approaching (3-6 mo)</span>
              <span className="text-[9px] px-1 py-0.2 bg-black/10 rounded-sm font-extrabold">{proximityCounts.warning}</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedProximityFilter('active')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1.5 ${
                selectedProximityFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>🟢 Active (&lt;3 mo)</span>
              <span className="text-[9px] px-1 py-0.2 bg-black/10 rounded-sm font-extrabold">{proximityCounts.active}</span>
            </button>
          </div>

          {/* Smart Tags System Filter Bar */}
          <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100">
            <span className="text-[10px] font-bold uppercase text-slate-400 mr-1 flex items-center gap-1">
              <Tag className="w-3 h-3 text-indigo-500" />
              <span>Smart Tags:</span>
            </span>

            {allSmartTags.map((tag) => {
              const isSelected = selectedSmartTags.includes(tag);
              const count = enrichedStakeholders.filter((s) => s.tags?.includes(tag)).length;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setSelectedSmartTags((prev) =>
                      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                    );
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs ring-1 ring-indigo-400'
                      : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-800'
                  }`}
                >
                  <span>#{tag}</span>
                  {count > 0 && (
                    <span
                      className={`text-[9px] px-1 rounded-full ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}

            {selectedSmartTags.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedSmartTags([])}
                className="px-2 py-0.5 text-[10px] font-extrabold text-rose-600 hover:text-rose-800 hover:underline"
              >
                Clear Tags ({selectedSmartTags.length})
              </button>
            )}
          </div>

          {/* Filter Badges & Region Chips */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
            <span className="text-[10px] font-bold uppercase text-slate-400 mr-1">Region:</span>
            <button
              type="button"
              onClick={() => setSelectedRegionFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                selectedRegionFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Macro-Regions
            </button>
            {(
              [
                'Western Europe / Brussels EU Core',
                'Nordic & Baltic',
                'Southern Europe / Mediterranean',
                'Central & Eastern Europe',
                'Pan-European & International',
              ] as EuropeanRegion[]
            ).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedRegionFilter(r)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                  selectedRegionFilter === r
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: REGION_COLORS[r].fill }}
                />
                <span>{r.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* GEOGRAPHIC HEATMAP CONCENTRATION BAR (When Heatmap is ON)     */}
      {/* ============================================================== */}
      {isHeatmapOverlay && (
        <div className="bg-white rounded-3xl p-5 border border-indigo-200 shadow-sm space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-600 animate-spin-slow" />
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                European Geographic Heatmap & Regional Leverage Analysis
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md">
              Overlay Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {regionalHeatmapStats.map((r) => (
              <div
                key={r.region}
                className={`p-3.5 rounded-2xl border transition-all ${
                  selectedRegionFilter === r.region
                    ? 'border-indigo-600 bg-indigo-50/70 shadow-xs'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: r.meta.fill }}
                  />
                  <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-sm bg-white text-slate-700 shadow-2xs">
                    {r.count} Entities
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 truncate" title={r.region}>
                  {r.region}
                </h4>
                <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg Influence:</span>
                    <span className="font-bold text-slate-800">{r.avgInfluence}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Champions:</span>
                    <span className="font-bold text-emerald-600">{r.championsCount}</span>
                  </div>
                  {r.shiftCount > 0 && (
                    <div className="flex justify-between text-amber-600 font-semibold">
                      <span>Predictive Shifts:</span>
                      <span>{r.shiftCount} ⚡</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW MODE 1: MATRIX VIEW                                       */}
      {/* ============================================================== */}
      {viewMode === 'matrix' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Scatter Matrix Chart */}
          <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Influence (Power) vs. Alignment Matrix
                </h3>
                <p className="text-xs text-slate-500">
                  {isHeatmapOverlay
                    ? 'Displaying European Regional Concentration Halos'
                    : 'Click any node to inspect institutional dossier and intelligence profile'}
                </p>
              </div>
              <span className="text-[11px] font-bold text-slate-400">
                {filteredStakeholders.length} Stakeholders Mapped
              </span>
            </div>

            {/* Matrix Visual Container */}
            <div className="relative h-[480px] w-full border border-slate-100 rounded-2xl bg-slate-50/50 p-2 overflow-hidden">
              <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none text-[10px] font-extrabold uppercase tracking-wider">
                <div className="p-3 border-r border-b border-slate-200/80 bg-rose-50/20 flex flex-col justify-between">
                  <span className="text-rose-600/70">🎯 High Influence • Low Alignment (Targets)</span>
                  {isHeatmapOverlay && (
                    <span className="text-[9px] text-slate-400">Concentration: Brussels EU Core / Employers</span>
                  )}
                </div>
                <div className="p-3 border-b border-slate-200/80 bg-emerald-50/30 flex flex-col justify-between items-end">
                  <span className="text-emerald-700/80">🏆 High Influence • High Alignment (Champions)</span>
                  {isHeatmapOverlay && (
                    <span className="text-[9px] text-slate-400">Concentration: EU Co-legislators & Platforms</span>
                  )}
                </div>
                <div className="p-3 border-r border-slate-200/80 bg-slate-100/30 flex flex-col justify-end">
                  <span className="text-slate-500/70">👁️ Low Influence • Low Alignment (Monitor)</span>
                </div>
                <div className="p-3 bg-amber-50/20 flex flex-col justify-end items-end">
                  <span className="text-amber-700/70">🌱 Low Influence • High Alignment (Grassroots / Allies)</span>
                </div>
              </div>

              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    type="number"
                    dataKey="alignment"
                    name="Alignment"
                    domain={[0, 100]}
                    unit="%"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    label={{ value: 'Political Alignment with OBESSU Positions (%)', position: 'bottom', offset: 0, fontSize: 11, fill: '#475569', fontWeight: 600 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="influence"
                    name="Influence"
                    domain={[0, 100]}
                    unit="%"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    label={{ value: 'Advocacy Influence & Decision Power (%)', angle: -90, position: 'left', offset: 0, fontSize: 11, fill: '#475569', fontWeight: 600 }}
                  />
                  <ReferenceLine x={50} stroke="#94a3b8" strokeDasharray="4 4" />
                  <ReferenceLine y={50} stroke="#94a3b8" strokeDasharray="4 4" />
                  <RechartsTooltip content={<CustomScatterTooltip />} />
                  <Scatter
                    name="Stakeholders"
                    data={filteredStakeholders}
                    onClick={(entry) => setActiveStakeholderId(entry.id)}
                    cursor="pointer"
                  >
                    {filteredStakeholders.map((entry, index) => {
                      const isSelected = activeStakeholder?.id === entry.id;
                      const fillColor = isHeatmapOverlay ? entry.regionMeta.fill : entry.color;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={fillColor}
                          stroke={isSelected ? '#0f172a' : entry.predictiveShift ? '#f59e0b' : '#ffffff'}
                          strokeWidth={isSelected ? 3 : entry.predictiveShift ? 2.5 : 1.5}
                          r={isSelected ? 10 : entry.influence > 80 ? 8 : 6}
                          style={{
                            filter: isHeatmapOverlay ? `drop-shadow(0 0 6px ${entry.regionMeta.glow})` : undefined,
                            transition: 'all 0.2s ease',
                          }}
                        />
                      );
                    })}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* Matrix Legend */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
              <div className="flex items-center gap-3 flex-wrap">
                {Object.entries(CATEGORY_COLORS).map(([cat, col]) => (
                  <div key={cat} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col }} />
                    <span className="capitalize">{cat}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-amber-600 font-semibold">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Golden Ring = Predictive Legislative Shift</span>
              </div>
            </div>
          </div>

          {/* Right Detail Panel */}
          <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
            {activeStakeholder ? (
              <div className="space-y-4">
                {/* Header & Quick Action Buttons */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md"
                        style={{
                          backgroundColor: `${activeStakeholder.color}20`,
                          color: activeStakeholder.color,
                        }}
                      >
                        {activeStakeholder.category}
                      </span>
                      {activeStakeholder.standingSeat && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md flex items-center gap-1">
                          <Award className="w-3 h-3 text-indigo-600" />
                          Standing Seat
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 mt-1">
                      {activeStakeholder.name}
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-indigo-500" />
                      <span>{activeStakeholder.region}</span>
                    </p>
                  </div>

                  {/* Primary Trigger Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setBriefingStakeholder(activeStakeholder);
                        setIsMeetingBriefingOpen(true);
                      }}
                      className="px-2.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                      title="Prepare One-Page Strategic Meeting Briefing"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Prepare Briefing</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleOpenQuickNote(activeStakeholder, e)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                      title="Append Timestamped Quick Note"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Quick Note</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenScheduleFollowUp(activeStakeholder)}
                      className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs"
                      title="Schedule Follow-up Task or Calendar Event"
                    >
                      <CalendarPlus className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="hidden sm:inline">Follow-up</span>
                    </button>
                  </div>
                </div>

                {/* Detail Panel Sub-tabs */}
                <div className="flex items-center p-1 bg-slate-100 rounded-xl text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setDetailTab('overview')}
                    className={`flex-1 py-1 rounded-lg text-center transition-colors ${
                      detailTab === 'overview' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailTab('history')}
                    className={`flex-1 py-1 rounded-lg text-center transition-colors flex items-center justify-center gap-1 ${
                      detailTab === 'history' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <History className="w-3 h-3" />
                    <span>History</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailTab('engagements')}
                    className={`flex-1 py-1 rounded-lg text-center transition-colors ${
                      detailTab === 'engagements' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Events ({stakeholderOpps.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailTab('outcomes')}
                    className={`flex-1 py-1 rounded-lg text-center transition-colors ${
                      detailTab === 'outcomes' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Outcomes ({stakeholderOutcomes.length})
                  </button>
                </div>

                {/* TAB 1: OVERVIEW */}
                {detailTab === 'overview' && (
                  <div className="space-y-4 animate-in fade-in">
                    {/* Proximity to Secretariat Status Card */}
                    <div
                      className={`p-3.5 rounded-2xl border transition-all ${
                        activeStakeholder.proximityStatus === 'lapsed'
                          ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                          : activeStakeholder.proximityStatus === 'warning'
                          ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                          : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Compass
                            className={`w-4 h-4 ${
                              activeStakeholder.proximityStatus === 'lapsed'
                                ? 'text-rose-600'
                                : activeStakeholder.proximityStatus === 'warning'
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                            }`}
                          />
                          <span className="text-xs font-extrabold uppercase tracking-wider">
                            Proximity to Secretariat
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            activeStakeholder.proximityStatus === 'lapsed'
                              ? 'bg-rose-200 text-rose-900'
                              : activeStakeholder.proximityStatus === 'warning'
                              ? 'bg-amber-200 text-amber-900'
                              : 'bg-emerald-200 text-emerald-900'
                          }`}
                        >
                          {activeStakeholder.proximityStatus === 'lapsed'
                            ? '🔴 Lapsed (>6 Months)'
                            : activeStakeholder.proximityStatus === 'warning'
                            ? '🟡 Approaching (3-6 Mo)'
                            : '🟢 Active (<3 Mo)'}
                        </span>
                      </div>

                      <div className="mt-2 text-xs space-y-0.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-600">
                          <span>Last direct in-person meeting:</span>
                          <span className="font-bold text-slate-800 font-mono">
                            {activeStakeholder.lastInPersonString === 'Never'
                              ? 'None on record'
                              : activeStakeholder.lastInPersonString}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-600">
                          <span>Time elapsed:</span>
                          <span className="font-bold text-slate-800">
                            {activeStakeholder.daysSinceInPerson === 999
                              ? 'Over 180 days (Never)'
                              : `${activeStakeholder.daysSinceInPerson} days (~${activeStakeholder.monthsSinceInPerson} months)`}
                          </span>
                        </div>
                      </div>

                      {activeStakeholder.proximityStatus === 'lapsed' && (
                        <div className="mt-2.5 p-2 bg-rose-100/80 border border-rose-300 rounded-xl text-[11px] text-rose-900 leading-snug flex items-start gap-1.5">
                          <AlertOctagon className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">Secretariat Alert:</span> Direct in-person contact has lapsed for &gt;6 months. Recommended to schedule an in-person briefing in Brussels to prevent policy drift.
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setScheduleFollowUpStk(activeStakeholder);
                          setFollowUpTitle(`In-Person Strategic Alignment Briefing with ${activeStakeholder.name}`);
                          setFollowUpType('bilateral_meeting');
                          setFollowUpNotes(`Direct in-person secretariat consultation at OBESSU Brussels / EU Parliament to re-align on 2026-2028 priorities. (Proximity status: ${activeStakeholder.proximityStatus})`);
                        }}
                        className="mt-2.5 w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                        <span>Schedule In-Person Meeting in Brussels</span>
                      </button>
                    </div>

                    {/* Score Gauges */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Institutional Power</span>
                        <div className="flex items-baseline justify-between mt-1">
                          <span className="text-xl font-extrabold text-slate-900">{activeStakeholder.influence}%</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-sm bg-indigo-100 text-indigo-800">
                            {activeStakeholder.influenceLevel}
                          </span>
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Policy Alignment</span>
                        <div className="flex items-baseline justify-between mt-1">
                          <span className="text-xl font-extrabold text-slate-900">{activeStakeholder.alignment}%</span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded-sm ${
                              activeStakeholder.alignmentLevel === 'Supportive'
                                ? 'bg-emerald-100 text-emerald-800'
                                : activeStakeholder.alignmentLevel === 'Neutral'
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {activeStakeholder.alignmentLevel}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 12-Month Sentiment & Policy Alignment Sparkline Chart */}
                    <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 text-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="text-[10px] font-bold uppercase text-slate-600 tracking-wider">
                            12-Month Policy Sentiment Sparkline
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 font-mono ${
                            sentimentDelta1Year > 0
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : sentimentDelta1Year < 0
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {sentimentDelta1Year > 0 ? '📈 +' : sentimentDelta1Year < 0 ? '📉 ' : '➡️ '}
                          {sentimentDelta1Year}% (12-Mo Shift)
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500">
                        Historical trajectory towards <strong className="text-slate-700">{activeStakeholder.primaryFocus}</strong> calibrated from recorded outcomes and statutory trilogue consultations.
                      </p>

                      {/* Sparkline Visual Canvas */}
                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                        <div className="h-20 w-full relative">
                          <svg className="w-full h-full overflow-visible" viewBox="0 0 300 70" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id={`sparkGrad-${activeStakeholder.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={activeStakeholder.color || '#4f46e5'} stopOpacity="0.25" />
                                <stop offset="100%" stopColor={activeStakeholder.color || '#4f46e5'} stopOpacity="0.0" />
                              </linearGradient>
                            </defs>

                            {/* Area fill */}
                            <polygon
                              points={`
                                10,${70 - (sentimentHistory[0]?.score || 70) * 0.6} 
                                75,${70 - (sentimentHistory[1]?.score || 72) * 0.6} 
                                150,${70 - (sentimentHistory[2]?.score || 75) * 0.6} 
                                225,${70 - (sentimentHistory[3]?.score || 78) * 0.6} 
                                290,${70 - (sentimentHistory[4]?.score || 80) * 0.6} 
                                290,70 10,70
                              `}
                              fill={`url(#sparkGrad-${activeStakeholder.id})`}
                            />

                            {/* Sparkline path */}
                            <path
                              d={`M 10 ${70 - (sentimentHistory[0]?.score || 70) * 0.6} 
                                  L 75 ${70 - (sentimentHistory[1]?.score || 72) * 0.6} 
                                  L 150 ${70 - (sentimentHistory[2]?.score || 75) * 0.6} 
                                  L 225 ${70 - (sentimentHistory[3]?.score || 78) * 0.6} 
                                  L 290 ${70 - (sentimentHistory[4]?.score || 80) * 0.6}`}
                              fill="none"
                              stroke={activeStakeholder.color || '#4f46e5'}
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />

                            {/* Milestone dots */}
                            {sentimentHistory.map((pt, idx) => {
                              const x = idx === 0 ? 10 : idx === 1 ? 75 : idx === 2 ? 150 : idx === 3 ? 225 : 290;
                              const y = 70 - pt.score * 0.6;
                              const isHovered = sparklineHoverPoint?.quarter === pt.quarter;
                              return (
                                <g key={pt.quarter} className="cursor-pointer" onClick={() => setSparklineHoverPoint(pt)} onMouseEnter={() => setSparklineHoverPoint(pt)}>
                                  <circle
                                    cx={x}
                                    cy={y}
                                    r={isHovered ? 5.5 : 3.5}
                                    fill={isHovered ? '#ffffff' : activeStakeholder.color || '#4f46e5'}
                                    stroke={activeStakeholder.color || '#4f46e5'}
                                    strokeWidth={isHovered ? 3 : 2}
                                    className="transition-all"
                                  />
                                </g>
                              );
                            })}
                          </svg>
                        </div>

                        {/* Quarter labels */}
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-100">
                          {sentimentHistory.map((pt) => (
                            <button
                              key={pt.quarter}
                              type="button"
                              onClick={() => setSparklineHoverPoint(pt)}
                              className={`hover:text-indigo-600 font-bold transition-colors ${
                                sparklineHoverPoint?.quarter === pt.quarter ? 'text-indigo-600 underline font-extrabold' : ''
                              }`}
                            >
                              {pt.quarter}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Milestone Outcome Callout */}
                      <div className="p-2.5 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-1">
                        <div className="flex items-center justify-between font-bold text-indigo-950 text-[11px]">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-indigo-600" />
                            <span>{sparklineHoverPoint ? `${sparklineHoverPoint.quarter} Milestone` : 'Latest Outcome Evidence'}</span>
                          </span>
                          <span className="text-[10px] font-mono text-indigo-700">
                            Score: {sparklineHoverPoint ? `${sparklineHoverPoint.score}%` : `${sentimentHistory[sentimentHistory.length - 1]?.score || 80}%`}
                          </span>
                        </div>
                        <p className="text-[11px] text-indigo-900 leading-snug">
                          {sparklineHoverPoint?.milestone || sentimentHistory[sentimentHistory.length - 1]?.milestone || 'Dialogue active in European Parliament committees.'}
                        </p>
                      </div>
                    </div>

                    {/* Smart Tags System on Stakeholder */}
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
                          <Tag className="w-3 h-3 text-indigo-600" />
                          <span>Smart Tags & Custom Labels</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {(activeStakeholder.tags || []).length} assigned
                        </span>
                      </div>

                      {/* Existing Tags with Remove 'X' */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {activeStakeholder.tags && activeStakeholder.tags.length > 0 ? (
                          activeStakeholder.tags.map((t) => (
                            <span
                              key={t}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg text-xs font-semibold"
                            >
                              <span>#{t}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveSmartTag(activeStakeholder.id, t)}
                                className="text-indigo-400 hover:text-rose-600 p-0.5 rounded-sm transition-colors"
                                title={`Remove ${t}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No custom labels attached yet.</span>
                        )}
                      </div>

                      {/* Quick Add Preset Suggested Tags */}
                      <div className="pt-1 border-t border-slate-200/60">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                          Quick-Assign Presets:
                        </span>
                        <div className="flex items-center gap-1 flex-wrap">
                          {[
                            'Erasmus+ Expert',
                            'Policy Influencer',
                            'Green Transition Champion',
                            'VET Specialist',
                            'Post-2027 MFF Lead',
                            'Youth Rights Champion',
                            'EP Rapporteur',
                          ]
                            .filter((preset) => !(activeStakeholder.tags || []).includes(preset))
                            .slice(0, 4)
                            .map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => handleAddSmartTag(activeStakeholder.id, preset)}
                                className="px-2 py-0.5 bg-white border border-slate-200 hover:border-indigo-400 text-slate-600 hover:text-indigo-700 rounded-md text-[10px] font-semibold transition-colors flex items-center gap-1"
                              >
                                <Plus className="w-2.5 h-2.5 text-indigo-500" />
                                <span>{preset}</span>
                              </button>
                            ))}
                        </div>
                      </div>

                      {/* Custom Label Creator Input */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <input
                          type="text"
                          placeholder="Create custom label (e.g. EU Budget Rapporteur)..."
                          value={customTagInput}
                          onChange={(e) => setCustomTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddSmartTag(activeStakeholder.id, customTagInput);
                              setCustomTagInput('');
                            }
                          }}
                          className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            handleAddSmartTag(activeStakeholder.id, customTagInput);
                            setCustomTagInput('');
                          }}
                          disabled={!customTagInput.trim()}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>

                    {/* Rich Text Notes Editor Widget */}
                    <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 text-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                          <FileEdit className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Confidential Secretariat Notes</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingRichNotes(!isEditingRichNotes)}
                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                          >
                            {isEditingRichNotes ? 'Preview Formatted' : 'Edit Notes'}
                          </button>
                        </div>
                      </div>

                      {/* Formatting Toolbar when editing */}
                      {isEditingRichNotes && (
                        <div className="p-1.5 bg-white border border-slate-200 rounded-xl flex items-center gap-1 flex-wrap text-slate-700">
                          <button
                            type="button"
                            onClick={() => setRichNotesDraft((prev) => prev + ' **Bold**')}
                            className="p-1 hover:bg-slate-100 rounded-md"
                            title="Bold"
                          >
                            <Bold className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRichNotesDraft((prev) => prev + ' *Italic*')}
                            className="p-1 hover:bg-slate-100 rounded-md"
                            title="Italic"
                          >
                            <Italic className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRichNotesDraft((prev) => prev + '\n- Bullet item')}
                            className="p-1 hover:bg-slate-100 rounded-md"
                            title="Bullet List"
                          >
                            <List className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRichNotesDraft((prev) => prev + '\n1. Action item')}
                            className="p-1 hover:bg-slate-100 rounded-md"
                            title="Numbered List"
                          >
                            <ListOrdered className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRichNotesDraft((prev) => prev + '\n### Section Heading\n')}
                            className="p-1 hover:bg-slate-100 rounded-md text-[11px] font-bold font-mono"
                            title="Heading"
                          >
                            H3
                          </button>
                          <button
                            type="button"
                            onClick={() => setRichNotesDraft((prev) => prev + '\n> Policy Red Line: ')}
                            className="p-1 hover:bg-slate-100 rounded-md"
                            title="Quote / Policy Red Line"
                          >
                            <Quote className="w-3.5 h-3.5" />
                          </button>

                          <div className="h-4 w-px bg-slate-200 mx-1" />

                          {/* Quick Template Insert Chips */}
                          <button
                            type="button"
                            onClick={() =>
                              setRichNotesDraft(
                                (prev) =>
                                  prev +
                                  '\n\n**Debrief [2026-08]:**\n- Met with: \n- Key stance: \n- Agreed next step: '
                              )
                            }
                            className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 rounded-md font-semibold"
                          >
                            + Debrief
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setRichNotesDraft(
                                (prev) =>
                                  prev +
                                  '\n\n> **Policy Red Line:** Will not compromise on democratic student governance.'
                              )
                            }
                            className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-amber-50 hover:text-amber-800 rounded-md font-semibold"
                          >
                            + Red Line
                          </button>
                        </div>
                      )}

                      {/* Notes Box: Editor vs Preview */}
                      {isEditingRichNotes ? (
                        <div className="space-y-2">
                          <textarea
                            rows={6}
                            value={richNotesDraft}
                            onChange={(e) => setRichNotesDraft(e.target.value)}
                            placeholder="Write confidential internal briefing notes, red lines, MEP advisor contact notes, and alliance dynamics..."
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-mono leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                          />
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">
                              Markdown formatted • {richNotesDraft.length} chars
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setRichNotesDraft(activeStakeholder.richNotes || activeStakeholder.notes || '');
                                  setIsEditingRichNotes(false);
                                }}
                                className="px-3 py-1 text-slate-500 hover:text-slate-700 text-xs font-medium"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveRichNotes}
                                disabled={isSavingNotes}
                                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>{isSavingNotes ? 'Saving...' : 'Save Notes'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="p-3 bg-white border border-slate-200/80 rounded-xl text-xs leading-relaxed text-slate-800 whitespace-pre-wrap max-h-48 overflow-y-auto">
                            {richNotesDraft || (
                              <span className="text-slate-400 italic">
                                No notes added yet. Click "Edit Notes" to write private stakeholder notes.
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>
                              {activeStakeholder.notesUpdatedAt
                                ? `Last modified: ${new Date(activeStakeholder.notesUpdatedAt).toLocaleDateString('en-GB')} by ${activeStakeholder.notesAuthor || 'Secretariat'}`
                                : 'Private internal notes'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsEditingRichNotes(true)}
                              className="font-bold text-indigo-600 hover:underline"
                            >
                              Edit Notes
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Policy Focus & Profile */}
                    <div className="p-3.5 bg-slate-50/70 rounded-2xl border border-slate-100 text-xs space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                        Primary Policy Mandate
                      </span>
                      <p className="font-bold text-slate-900">{activeStakeholder.primaryFocus}</p>
                    </div>

                    {/* Predictive Shift Alert if present */}
                    {activeStakeholder.predictiveShift && (
                      <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-amber-900 flex items-center gap-1.5">
                            <Zap className="w-4 h-4 text-amber-600" />
                            <span>Predicted Voting Shift</span>
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-200 text-amber-950 rounded-md">
                            {activeStakeholder.predictiveShift.confidence}% Confidence
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-900 leading-snug">
                          {activeStakeholder.predictiveShift.legislativeTrigger}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleApplyPredictiveShift(activeStakeholder)}
                          className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white rounded-xl text-[11px] font-bold transition-all shadow-2xs"
                        >
                          Apply Predicted Shift ({activeStakeholder.predictiveShift.deltaPercent > 0 ? '+' : ''}{activeStakeholder.predictiveShift.deltaPercent}%)
                        </button>
                      </div>
                    )}

                    {/* AI Intelligence Briefing */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          <span>AI Intelligence Dossier</span>
                        </span>
                        <button
                          type="button"
                          onClick={handleGenerateSummary}
                          disabled={isGeneratingAi}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                        >
                          {isGeneratingAi ? 'Synthesizing...' : aiSummary ? 'Regenerate' : 'Generate'}
                        </button>
                      </div>

                      {aiSummary ? (
                        <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl text-xs text-indigo-950 leading-relaxed max-h-48 overflow-y-auto">
                          {aiSummary}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleGenerateSummary}
                          disabled={isGeneratingAi}
                          className="w-full py-3 border border-dashed border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50 rounded-2xl text-xs font-semibold text-indigo-700 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{isGeneratingAi ? 'Analyzing history & voting logs...' : 'Generate Strategic Briefing Dossier'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: RELATIONSHIP HISTORY (Google Workspace & Timeline) */}
                {detailTab === 'history' && (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-900">Interaction History</h4>
                        <p className="text-[10px] text-slate-500">Gmail threads, Calendar touchpoints & Registry milestones</p>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md">
                        {hasGoogleToken ? 'Google Synced' : 'Registry Sync'}
                      </span>
                    </div>

                    {/* Timeline Container */}
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {/* Google Calendar touchpoints */}
                      {calendarEvents.map((evt, idx) => (
                        <div key={idx} className="p-3 bg-blue-50/60 border border-blue-100 rounded-2xl text-xs space-y-1">
                          <div className="flex items-center justify-between text-blue-900 font-bold">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                              <span className="truncate">{evt.summary}</span>
                            </span>
                            <span className="text-[10px] text-blue-700 font-mono">
                              {evt.start.dateTime ? evt.start.dateTime.split('T')[0] : evt.start.date || '2026'}
                            </span>
                          </div>
                          {evt.description && (
                            <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">{evt.description}</p>
                          )}
                        </div>
                      ))}

                      {/* Gmail correspondence */}
                      {gmailMessages.map((msg) => (
                        <div key={msg.id} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1">
                          <div className="flex items-center justify-between text-slate-900 font-bold">
                            <span className="flex items-center gap-1.5 truncate">
                              <Mail className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                              <span className="truncate">{msg.subject}</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">{msg.date}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 truncate">From: {msg.from}</p>
                          <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed italic">{msg.snippet}</p>
                        </div>
                      ))}

                      {/* Policy Registry Outcomes & Engagements */}
                      {stakeholderOutcomes.map((out) => (
                        <div key={out.id} className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-2xl text-xs space-y-1">
                          <div className="flex items-center justify-between text-emerald-950 font-bold">
                            <span className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Outcome: {out.type}</span>
                            </span>
                            <span className="text-[10px] text-emerald-700 font-mono">{out.date}</span>
                          </div>
                          <p className="text-[11px] text-emerald-900 leading-relaxed">{out.description}</p>
                        </div>
                      ))}
                    </div>

                    {/* Schedule Follow-up button inside history */}
                    <button
                      type="button"
                      onClick={() => handleOpenScheduleFollowUp(activeStakeholder)}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
                    >
                      <CalendarPlus className="w-4 h-4" />
                      <span>Schedule Next Strategic Follow-up</span>
                    </button>
                  </div>
                )}

                {/* TAB 3: ENGAGEMENTS */}
                {detailTab === 'engagements' && (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1 animate-in fade-in">
                    {stakeholderOpps.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">No direct opportunities recorded in the 2026 registry.</p>
                    ) : (
                      stakeholderOpps.map((opp) => (
                        <div
                          key={opp.id}
                          onClick={() => onOpenOpportunity(opp.id)}
                          className="p-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-100 hover:border-indigo-200 rounded-2xl text-xs cursor-pointer transition-colors space-y-1"
                        >
                          <div className="flex items-center justify-between font-bold text-slate-900">
                            <span className="truncate">{opp.title}</span>
                            <span className="text-[10px] text-indigo-600 font-mono">{opp.dateOfActivity || opp.requestDate}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-2">{opp.substanceSummary || opp.descriptionOfActivity}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* TAB 4: OUTCOMES */}
                {detailTab === 'outcomes' && (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1 animate-in fade-in">
                    {stakeholderOutcomes.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">No policy outcomes recorded yet with this entity.</p>
                    ) : (
                      stakeholderOutcomes.map((out) => (
                        <div key={out.id} className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs space-y-1">
                          <div className="flex items-center justify-between font-bold text-emerald-950">
                            <span>{out.type}</span>
                            <span className="text-[10px] text-emerald-700">{out.date}</span>
                          </div>
                          <p className="text-[11px] text-emerald-900">{out.description}</p>
                          {out.evidence && (
                            <p className="text-[10px] text-emerald-700 italic border-t border-emerald-200 pt-1">
                              Evidence: {out.evidence}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-8">Select a stakeholder node from the matrix to view dossier.</p>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW MODE 2: SPLIT VIEW (List + Detail)                        */}
      {/* ============================================================== */}
      {viewMode === 'split' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Stakeholder List */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3 max-h-[700px] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">
                Institutional Directory ({filteredStakeholders.length})
              </h3>
            </div>

            <div className="space-y-2">
              {filteredStakeholders.map((stk) => {
                const isSelected = activeStakeholder?.id === stk.id;
                return (
                  <div
                    key={stk.id}
                    onClick={() => setActiveStakeholderId(stk.id)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: stk.color }}
                        />
                        <h4 className="text-xs font-bold text-slate-900">{stk.name}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-400">
                          Inf: {stk.influence}%
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleOpenQuickNote(stk, e)}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-100 transition-colors"
                          title="Append Quick Note"
                        >
                          <MessageSquarePlus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 truncate">{stk.primaryFocus}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Full Detail Panel */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
            {activeStakeholder && (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <span
                      className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md"
                      style={{
                        backgroundColor: `${activeStakeholder.color}20`,
                        color: activeStakeholder.color,
                      }}
                    >
                      {activeStakeholder.category}
                    </span>
                    <h2 className="text-lg font-extrabold text-slate-900 mt-1.5">
                      {activeStakeholder.name} ({activeStakeholder.canonicalName})
                    </h2>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{activeStakeholder.region}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setBriefingStakeholder(activeStakeholder);
                        setIsMeetingBriefingOpen(true);
                      }}
                      className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
                      title="Prepare One-Page Strategic Meeting Briefing"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Prepare Briefing</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleOpenQuickNote(activeStakeholder, e)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                      title="Append Quick Note"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Quick Note</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenScheduleFollowUp(activeStakeholder)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      <span>Schedule Follow-up</span>
                    </button>
                  </div>
                </div>

                {/* Gauges & Summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Influence Power</span>
                    <p className="text-xl font-extrabold text-slate-900 mt-0.5">{activeStakeholder.influence}%</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Political Alignment</span>
                    <p className="text-xl font-extrabold text-emerald-600 mt-0.5">{activeStakeholder.alignment}%</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Days Since Touch</span>
                    <p className="text-xl font-extrabold text-slate-900 mt-0.5">
                      {activeStakeholder.daysSinceLastContact === 999 ? 'Never' : `${activeStakeholder.daysSinceLastContact}d`}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[10px] text-slate-400">Strategic Profile & Notes</h4>
                  <p className="text-slate-700 leading-relaxed">{activeStakeholder.notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW MODE 3: DIRECTORY CARDS VIEW                             */}
      {/* ============================================================== */}
      {viewMode === 'directory' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStakeholders.map((stk) => {
            const isSelected = selectedStakeholderIds.includes(stk.id);
            return (
              <div
                key={stk.id}
                className={`bg-white rounded-3xl p-5 border transition-all space-y-3.5 flex flex-col justify-between ${
                  isSelected
                    ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/20 shadow-md'
                    : 'border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleSelectStakeholder(stk.id)}
                        className="text-slate-400 hover:text-indigo-600"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <span
                        className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md"
                        style={{
                          backgroundColor: `${stk.color}20`,
                          color: stk.color,
                        }}
                      >
                        {stk.category}
                      </span>

                      {/* Proximity Status Pill */}
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                          stk.proximityStatus === 'lapsed'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : stk.proximityStatus === 'warning'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                        title={`Last in-person meeting: ${stk.lastInPersonString}`}
                      >
                        {stk.proximityStatus === 'lapsed' ? '🔴 >6 mo' : stk.proximityStatus === 'warning' ? '🟡 3-6 mo' : '🟢 <3 mo'}
                      </span>
                    </div>

                    {stk.predictiveShift && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-600" />
                        <span>{stk.predictiveShift.deltaPercent > 0 ? '+' : ''}{stk.predictiveShift.deltaPercent}%</span>
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">{stk.name}</h3>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-indigo-500" />
                      <span>{stk.region}</span>
                    </p>
                  </div>

                  {/* Smart Tags on Directory Card */}
                  {stk.tags && stk.tags.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                      {stk.tags.slice(0, 3).map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-md">
                          #{t}
                        </span>
                      ))}
                      {stk.tags.length > 3 && (
                        <span className="text-[9px] text-slate-400">+{stk.tags.length - 3}</span>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{stk.notes}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                    <span>Power: <strong className="text-slate-900">{stk.influence}%</strong></span>
                    <span>•</span>
                    <span>Align: <strong className="text-emerald-600">{stk.alignment}%</strong></span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Quick Note Floating Action */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenQuickNote(stk, e)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                      title="Append Quick Note"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="hidden sm:inline">Note</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setBriefingStakeholder(stk);
                        setIsMeetingBriefingOpen(true);
                      }}
                      className="px-2.5 py-1 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors border border-indigo-200/60"
                      title="Prepare Briefing"
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="hidden sm:inline">Briefing</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenScheduleFollowUp(stk)}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                      title="Schedule Follow-up"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      <span>Follow-up</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW MODE 4: COMPARE STAKEHOLDERS (Side-by-Side Analysis)      */}
      {/* ============================================================== */}
      {viewMode === 'compare' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Scale className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-extrabold text-slate-900">
                  Side-by-Side Stakeholder Comparison & Leverage Matrix
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                Compare power dynamics, policy priorities, alignment gaps, and coalition opportunities between two European entities.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRunAiComparison}
              disabled={isComparingAi}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white rounded-xl text-xs font-extrabold shadow-md transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-purple-200" />
              <span>{isComparingAi ? 'Analyzing Power Dynamics...' : 'Run Comparative AI Synthesis'}</span>
            </button>
          </div>

          {/* Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Stakeholder A Select */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Select First Stakeholder (Entity A):
              </label>
              <select
                value={compareIdA}
                onChange={(e) => setCompareIdA(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20"
              >
                {enrichedStakeholders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.category} - {s.influence}% Power)
                  </option>
                ))}
              </select>
            </div>

            {/* Stakeholder B Select */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Select Second Stakeholder (Entity B):
              </label>
              <select
                value={compareIdB}
                onChange={(e) => setCompareIdB(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20"
              >
                {enrichedStakeholders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.category} - {s.influence}% Power)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Side-by-Side Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Entity A Card */}
            {compareStakeholderA && (
              <div className="p-6 bg-slate-50/70 border border-slate-200 rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <span
                    className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md"
                    style={{ backgroundColor: `${compareStakeholderA.color}20`, color: compareStakeholderA.color }}
                  >
                    {compareStakeholderA.category}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">{compareStakeholderA.region}</span>
                </div>
                <h3 className="text-base font-extrabold text-slate-900">{compareStakeholderA.name}</h3>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 bg-white rounded-2xl border border-slate-100 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Influence Power</span>
                    <p className="text-lg font-extrabold text-indigo-600 mt-0.5">{compareStakeholderA.influence}%</p>
                  </div>
                  <div className="p-3 bg-white rounded-2xl border border-slate-100 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Alignment</span>
                    <p className="text-lg font-extrabold text-emerald-600 mt-0.5">{compareStakeholderA.alignment}%</p>
                  </div>
                </div>

                <div className="p-3.5 bg-white rounded-2xl border border-slate-100 text-xs space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Policy Focus</span>
                  <p className="font-bold text-slate-900">{compareStakeholderA.primaryFocus}</p>
                  <p className="text-slate-600 text-[11px] pt-1 leading-relaxed">{compareStakeholderA.notes}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenScheduleFollowUp(compareStakeholderA)}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  <span>Schedule Follow-up with {compareStakeholderA.name}</span>
                </button>
              </div>
            )}

            {/* Entity B Card */}
            {compareStakeholderB && (
              <div className="p-6 bg-slate-50/70 border border-slate-200 rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <span
                    className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md"
                    style={{ backgroundColor: `${compareStakeholderB.color}20`, color: compareStakeholderB.color }}
                  >
                    {compareStakeholderB.category}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">{compareStakeholderB.region}</span>
                </div>
                <h3 className="text-base font-extrabold text-slate-900">{compareStakeholderB.name}</h3>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 bg-white rounded-2xl border border-slate-100 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Influence Power</span>
                    <p className="text-lg font-extrabold text-indigo-600 mt-0.5">{compareStakeholderB.influence}%</p>
                  </div>
                  <div className="p-3 bg-white rounded-2xl border border-slate-100 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Alignment</span>
                    <p className="text-lg font-extrabold text-emerald-600 mt-0.5">{compareStakeholderB.alignment}%</p>
                  </div>
                </div>

                <div className="p-3.5 bg-white rounded-2xl border border-slate-100 text-xs space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Policy Focus</span>
                  <p className="font-bold text-slate-900">{compareStakeholderB.primaryFocus}</p>
                  <p className="text-slate-600 text-[11px] pt-1 leading-relaxed">{compareStakeholderB.notes}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenScheduleFollowUp(compareStakeholderB)}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  <span>Schedule Follow-up with {compareStakeholderB.name}</span>
                </button>
              </div>
            )}
          </div>

          {/* AI Comparison Output */}
          {comparisonAiAnalysis && (
            <div className="p-5 bg-purple-50 border border-purple-200 rounded-3xl space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 text-purple-950 font-extrabold text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>AI Comparative Advocacy Synthesis</span>
              </div>
              <div className="text-xs text-purple-950 leading-relaxed whitespace-pre-wrap">
                {comparisonAiAnalysis}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW MODE 4: NETWORK GRAPH (D3.JS)                             */}
      {/* ============================================================== */}
      {viewMode === 'network' && (
        <NetworkVisualization
          stakeholders={enrichedStakeholders}
          opportunities={opportunities}
          outcomes={outcomes}
          papers={papers}
          actions={actions}
          onSelectStakeholder={(stk) => {
            setActiveStakeholderId(stk.id);
            setViewMode('matrix');
          }}
          onOpenOpportunity={onOpenOpportunity}
          onOpenBriefingDraft={onOpenBriefingDraft}
          onOpenQuickNote={(stk) => {
            setQuickNoteStakeholder(stk);
            setQuickNoteText('');
          }}
          onOpenScheduleFollowUp={(stk) => {
            setScheduleFollowUpStk(stk);
            setFollowUpTitle(`Advocacy Sync: ${stk.name}`);
            setFollowUpDate('2026-08-30');
            setFollowUpNotes(`Follow-up on student priorities in ${stk.region || 'Europe'}.`);
          }}
        />
      )}

      {/* ============================================================== */}
      {/* FLOATING BULK ACTIONS TOOLBAR                                  */}
      {/* ============================================================== */}
      {selectedStakeholderIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 text-xs animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
            <span className="font-extrabold text-slate-200">
              {selectedStakeholderIds.length} Selected
            </span>
          </div>

          {/* Bulk Tag Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold flex items-center gap-1.5 transition-colors border border-slate-700"
            >
              <Tag className="w-3.5 h-3.5 text-indigo-400" />
              <span>Tag Campaign</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isTagDropdownOpen && (
              <div className="absolute bottom-full mb-2 left-0 w-64 bg-slate-950 text-white rounded-2xl p-3 shadow-2xl border border-slate-700 space-y-2 z-50 animate-in fade-in">
                <span className="text-[10px] font-bold uppercase text-slate-400">Quick Campaign Tags:</span>
                <div className="flex flex-col gap-1">
                  {['European Youth Week', 'VET Quality Action', 'Post-2027 MFF Taskforce', 'Digital Education Coalition'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleBulkAddTag(t)}
                      className="text-left px-2.5 py-1.5 hover:bg-slate-800 rounded-lg text-xs text-slate-300 hover:text-white transition-colors"
                    >
                      +{t}
                    </button>
                  ))}
                </div>
                <div className="pt-2 border-t border-slate-800 flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Custom tag..."
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleBulkAddTag(customTagInput);
                    }}
                    className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleBulkAddTag(customTagInput)}
                    className="px-2 py-1 bg-indigo-600 rounded-lg text-xs font-bold"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Score Adjustment */}
          <button
            type="button"
            onClick={() => handleBulkAdjustAlignment(10)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold flex items-center gap-1.5 transition-colors border border-slate-700"
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>+10% Align</span>
          </button>

          {/* Standing Seat Toggle */}
          <button
            type="button"
            onClick={() => handleBulkToggleStandingSeat(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold flex items-center gap-1.5 transition-colors border border-slate-700"
          >
            <Award className="w-3.5 h-3.5 text-indigo-400" />
            <span>Standing Seat</span>
          </button>

          {/* Clear Selection */}
          <button
            type="button"
            onClick={() => setSelectedStakeholderIds([])}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors ml-1"
            title="Deselect All"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* SCHEDULE FOLLOW-UP MODAL                                       */}
      {/* ============================================================== */}
      {scheduleFollowUpStk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <CalendarPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Schedule Strategic Follow-up</h3>
                  <p className="text-xs text-slate-500">{scheduleFollowUpStk.name} ({scheduleFollowUpStk.category})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setScheduleFollowUpStk(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Follow-up Action Title</label>
                <input
                  type="text"
                  value={followUpTitle}
                  onChange={(e) => setFollowUpTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Target Date</label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Action Type</label>
                  <select
                    value={followUpType}
                    onChange={(e) => setFollowUpType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="bilateral_meeting">Bilateral Meeting</option>
                    <option value="follow_up_letter">Formal Follow-up Letter</option>
                    <option value="prepare_briefing">Prepare Policy Briefing</option>
                    <option value="coalition_call">European Coalition Call</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Notes & Strategic Focus</label>
                <textarea
                  rows={3}
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 leading-relaxed"
                />
              </div>

              {/* Workspace Sync Checkboxes */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Sync Integrations</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncToGCal}
                    onChange={(e) => setSyncToGCal(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-slate-700 font-medium">Sync to Google Calendar as Meeting Block</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncToGTasks}
                    onChange={(e) => setSyncToGTasks(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-slate-700 font-medium">Create Task in Google Tasks & My Day Queue</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setScheduleFollowUpStk(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteScheduleFollowUp}
                disabled={isScheduling}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-xl text-xs font-extrabold shadow-md transition-all disabled:opacity-50"
              >
                {isScheduling ? 'Scheduling...' : 'Confirm & Add to My Day'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SUMMARY REPORT EXPORT MODAL                                    */}
      {/* ============================================================== */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    European Stakeholder & Power Audit Report
                  </h3>
                  <p className="text-xs text-slate-500">
                    Comprehensive intelligence document ready for export to Google Drive
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Preview Box */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 max-h-72 overflow-y-auto font-mono text-[11px] text-slate-800 leading-relaxed whitespace-pre-wrap">
              {summaryReportMarkdown}
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyReport}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Markdown</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintReport}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print PDF</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportReportToDrive}
                  disabled={isExportingDrive}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
                >
                  <HardDrive className="w-4 h-4 text-indigo-200" />
                  <span>{isExportingDrive ? 'Exporting to Docs...' : 'Export to Google Drive / Docs'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* QUICK NOTE FLOATING MODAL                                      */}
      {/* ============================================================== */}
      {quickNoteStakeholder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <StickyNote className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Quick Note: {quickNoteStakeholder.name}
                    </h3>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.2 rounded-sm"
                      style={{ backgroundColor: `${quickNoteStakeholder.color}20`, color: quickNoteStakeholder.color }}
                    >
                      {quickNoteStakeholder.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Append a confidential, timestamped note directly to this stakeholder record.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickNoteStakeholder(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Context Selector */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase text-slate-400">Interaction Context:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  '📍 Met in Brussels',
                  '📞 Phone Call Debrief',
                  '🇪🇺 MEP Advisor Sync',
                  '⚖️ Policy Red Line',
                  '📑 Position Shared',
                  '⚠️ Alignment Caution',
                ].map((ctx) => (
                  <button
                    key={ctx}
                    type="button"
                    onClick={() => setQuickNoteContext(ctx)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      quickNoteContext === ctx
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {ctx}
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <div className="space-y-1">
              <textarea
                autoFocus
                rows={4}
                value={quickNoteText}
                onChange={(e) => setQuickNoteText(e.target.value)}
                placeholder="Enter confidential meeting notes, agreed next steps, political commitments, or strategic intelligence..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              />
              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={quickNoteIncludeHeader}
                    onChange={(e) => setQuickNoteIncludeHeader(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Include timestamp & author signature header</span>
                </label>
                <span className="font-mono text-[10px] text-slate-400">{quickNoteText.length} chars</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setQuickNoteStakeholder(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveQuickNote}
                disabled={!quickNoteText.trim() || isSavingQuickNote}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-xl text-xs font-extrabold shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{isSavingQuickNote ? 'Appending...' : 'Save & Append Note'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* PREPARE STRATEGIC MEETING BRIEFING MODAL                       */}
      {/* ============================================================== */}
      {isMeetingBriefingOpen && briefingStakeholder && meetingBriefingContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl shadow-md">
                  <FileCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md">
                      Secretariat One-Page Dossier
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Confidential • OBESSU Brussels
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mt-0.5">
                    Meeting Briefing: {briefingStakeholder.name}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyMeetingBriefing}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Copy className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{copyBriefingSuccess ? 'Copied!' : 'Copy'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportMeetingBriefingToDocs}
                  disabled={isExportingMeetingDoc}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                >
                  <HardDrive className="w-3.5 h-3.5 text-indigo-200" />
                  <span>{isExportingMeetingDoc ? 'Exporting...' : 'Export to Docs'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsMeetingBriefingOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: One-Page Printable Briefing Sheet */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 leading-relaxed">
              {/* Top Matrix Overview Bar */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-inner grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Influence Power</span>
                  <p className="text-xl font-extrabold text-indigo-400 mt-0.5">
                    {meetingBriefingContent.metrics.influence}%
                  </p>
                  <span className="text-[10px] text-slate-300">{meetingBriefingContent.metrics.influenceLevel} Leverage</span>
                </div>

                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Policy Alignment</span>
                  <p className="text-xl font-extrabold text-emerald-400 mt-0.5">
                    {meetingBriefingContent.metrics.alignment}%
                  </p>
                  <span className="text-[10px] text-slate-300">{meetingBriefingContent.metrics.alignmentLevel}</span>
                </div>

                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Proximity Cadence</span>
                  <p className="text-sm font-extrabold text-amber-300 mt-1">
                    {briefingStakeholder.proximityStatus === 'lapsed' ? '🔴 Lapsed (>6 mo)' : briefingStakeholder.proximityStatus === 'warning' ? '🟡 Due (3-6 mo)' : '🟢 Active (<3 mo)'}
                  </p>
                  <span className="text-[10px] text-slate-400">Last: {briefingStakeholder.lastInPersonString || 'Recent'}</span>
                </div>

                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Policy Focus</span>
                  <p className="text-xs font-bold text-white mt-1 line-clamp-2">
                    {meetingBriefingContent.metrics.primaryFocus}
                  </p>
                </div>
              </div>

              {/* 2-Column Briefing Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Column 1: Objectives & Demands */}
                <div className="space-y-4">
                  {/* Strategic Meeting Objectives */}
                  <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-2">
                    <h4 className="font-extrabold text-indigo-950 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-indigo-600" />
                      <span>Strategic Meeting Objectives</span>
                    </h4>
                    <ul className="space-y-1.5 text-indigo-900 text-xs">
                      {meetingBriefingContent.objectives.map((obj, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-indigo-500 font-bold">•</span>
                          <span>{obj}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Talking Points & Statutory Demands */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                    <h4 className="font-extrabold text-slate-900 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-slate-700" />
                      <span>Key Talking Points & Evidence</span>
                    </h4>
                    <div className="space-y-2 text-[11px] text-slate-700">
                      {meetingBriefingContent.talkingPoints.map((tp, i) => (
                        <p key={i} className="p-2 bg-white rounded-xl border border-slate-200/70">{tp}</p>
                      ))}
                    </div>
                  </div>

                  {/* Pending Policy Action Items */}
                  <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-2">
                    <h4 className="font-extrabold text-amber-950 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <span>Pending Action Items ({meetingBriefingContent.pendingActions.length})</span>
                    </h4>
                    {meetingBriefingContent.pendingActions.length === 0 ? (
                      <p className="text-[11px] text-amber-800 italic">No blocked tasks or overdue follow-up items.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {meetingBriefingContent.pendingActions.map((act) => (
                          <div key={act.id} className="p-2 bg-white rounded-xl border border-amber-200 flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-800 truncate">{act.title}</span>
                            <span className="text-[10px] font-mono text-amber-700 px-1.5 py-0.2 bg-amber-100 rounded-md">
                              Due: {act.dueAt || 'Next Week'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Column 2: Red Lines, Counter-arguments & Recent History */}
                <div className="space-y-4">
                  {/* Secretariat Red Lines */}
                  <div className="p-4 bg-rose-50/80 border border-rose-200 rounded-2xl space-y-2">
                    <h4 className="font-extrabold text-rose-950 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                      <span>Secretariat Red Lines & Boundaries</span>
                    </h4>
                    <div className="space-y-1.5 text-[11px] text-rose-900">
                      {meetingBriefingContent.redLines.map((rl, i) => (
                        <p key={i} className="p-2 bg-white rounded-xl border border-rose-200 leading-snug">{rl}</p>
                      ))}
                    </div>
                  </div>

                  {/* Pushback & Counter-arguments */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <h4 className="font-extrabold text-slate-900 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span>Pushback Scenarios & Counter-Arguments</span>
                    </h4>
                    <div className="space-y-2 text-[11px] text-slate-700">
                      {meetingBriefingContent.counterArguments.map((ca, i) => (
                        <p key={i} className="p-2 bg-white rounded-xl border border-slate-200">{ca}</p>
                      ))}
                    </div>
                  </div>

                  {/* Recent Recorded Outcomes & Engagements */}
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-2">
                    <h4 className="font-extrabold text-emerald-950 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Recent Track Record & Outcomes</span>
                    </h4>
                    {meetingBriefingContent.outcomes.length === 0 ? (
                      <p className="text-[11px] text-emerald-800 italic">No formal outcomes logged yet. Use this meeting to secure initial position alignment.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {meetingBriefingContent.outcomes.slice(0, 2).map((out) => (
                          <div key={out.id} className="p-2 bg-white rounded-xl border border-emerald-200 text-[11px] space-y-0.5">
                            <div className="flex items-center justify-between font-bold text-emerald-950">
                              <span>{out.type}</span>
                              <span className="text-[10px] text-emerald-700 font-mono">{out.date}</span>
                            </div>
                            <p className="text-slate-600 line-clamp-2">{out.description}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sign-off Footnote */}
              <div className="p-3 bg-slate-100 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] text-slate-500 font-mono">
                <span>Dossier Prepared by: Panagiotis Chatzimichail (Head of External Affairs)</span>
                <span>OBESSU Secretariat • Rue de la Sablonnière 20, Brussels</span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Print Briefing</span>
              </button>

              <button
                type="button"
                onClick={() => setIsMeetingBriefingOpen(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition-colors"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
