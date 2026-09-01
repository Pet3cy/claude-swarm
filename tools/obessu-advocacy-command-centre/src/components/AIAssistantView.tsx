import React, { useState, useRef, useMemo } from 'react';
import {
  Mic,
  Square,
  Sparkles,
  Search,
  FileText,
  Brain,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Plus,
  ArrowRight,
  BookOpen,
  Building2,
  Calendar,
  Share2,
  HardDrive,
  Copy,
  Check,
  Download,
  Eye,
  Edit3,
  Sliders,
  Layers,
  Filter,
  RefreshCw,
  Clock,
  Hash,
  CheckSquare,
  Bookmark,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  ShieldCheck,
  GraduationCap,
  Presentation,
  X,
  Play,
  MonitorPlay
} from 'lucide-react';
import { Opportunity, Outcome, Paper, Stakeholder } from '../types/advocacy';
import { aiService } from '../services/aiService';
import { workspaceService } from '../services/workspaceService';

interface AIAssistantViewProps {
  opportunities: Opportunity[];
  stakeholders: Stakeholder[];
  papers: Paper[];
  onSaveOutcome: (outcome: Partial<Outcome>) => void;
  onSaveAction: (action: any) => void;
  hasGoogleToken: boolean;
  onRequireAuth: () => void;
}

type CoPilotMode = 'doc_studio' | 'voice_debrief' | 'high_thinking' | 'eu_search';
type DocumentType = 'project_brief' | 'policy_brief';

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({
  opportunities,
  stakeholders,
  papers,
  onSaveOutcome,
  onSaveAction,
  hasGoogleToken,
  onRequireAuth,
}) => {
  const [activeMode, setActiveMode] = useState<CoPilotMode>('doc_studio');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ==========================================
  // 1. DOCUMENT STUDIO & EDITOR SIDEBAR STATE
  // ==========================================
  const [docType, setDocType] = useState<DocumentType>('project_brief');
  const [docTitle, setDocTitle] = useState<string>('OBESSU European School Student Rights & VET Empowerment Initiative');
  const [docTone, setDocTone] = useState<string>('Authoritative, Rights-Based & Strategic');
  const [targetAudience, setTargetAudience] = useState<string>('European Commission (DG EAC/EMPL), MEPs & Consortium Partners');
  const [customDirectives, setCustomDirectives] = useState<string>('');
  
  // Selected IDs for multi-selection
  const [selectedPaperTitles, setSelectedPaperTitles] = useState<string[]>(() => {
    return papers.slice(0, 3).map((p) => p.title);
  });
  const [selectedOppIds, setSelectedOppIds] = useState<string[]>(() => {
    return opportunities.slice(0, 2).map((o) => o.id);
  });

  // Sidebar search & filters
  const [paperSearch, setPaperSearch] = useState<string>('');
  const [oppSearch, setOppSearch] = useState<string>('');
  const [oppFilterUpcomingOnly, setOppFilterUpcomingOnly] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Editor content & status
  const [generatedDocContent, setGeneratedDocContent] = useState<string>(() => {
    return `# OBESSU Strategic Briefing: Empowering School Student Democracy & VET Rights (2026–2028)

## 1. Executive Summary & Strategic Rationale
Secondary school students and vocational education and training (VET) apprentices across the European Union face profound structural barriers: lack of statutory participation in school governance, precarious unpaid traineeships, and escalating mental health pressures.

As the sole representative voice of 31 national school student unions across Europe, **OBESSU (Organising Bureau of European School Student Unions)** tables this initiative to bridge European policy declarations with local school student realities.

## 2. Policy Synthesis of Selected OBESSU Papers
This document operationalizes core evidence from OBESSU positions:
- **Declaration of School Student Rights**: Legally enshrined student representation at municipal, national, and European levels (voting rights on school boards).
- **VET & Apprenticeship Quality Charter**: Banning unpaid apprenticeships across all Member States and enforcing binding workplace mentorship.
- **Mental Health in Secondary Schools**: Establishing mandatory student-to-counselor ratios (1:250) and institutionalizing safe civic spaces in schools.

## 3. Work Packages & Implementation Framework
- **WP1: Statutory Governance & Pan-European Network Coordination**
- **WP2: Grassroots Evidence Gathering & Secondary School Surveys**
- **WP3: Capacity Building & Training via the OBESSU Pool of Trainers (PoT)**
- **WP4: Targeted EU Institutional Advocacy & Legislative Dialogue** (aligned with upcoming EP CULT and DG EAC milestones)
- **WP5: European Communications, Student Campaigning & Dissemination**

## 4. Key Institutional Milestones & Advocacy Opportunities
- **European Parliament CULT Committee Hearing on Secondary Education Reform** (Brussels)
- **European Commission DG EAC Structured Dialogue on Student Representation**
- **Lifelong Learning Week Policy Roundtable with European Youth Forum & LLLPlatform**

## 5. Concrete Policy Asks & Demands
1. **Legally Binding Apprentice Remuneration**: Direct inclusion in the revised European Quality Framework for Apprenticeships (EFQ-A).
2. **Dedicated School Student Participation Guarantee**: Ring-fencing 15% of Erasmus+ Key Action 3 and CERV funds for youth-led secondary school student unions.
3. **Establishment of a European Student Rights Monitoring Mechanism** under the European Education Area (EEA 2030) strategic framework.

---
*Drafted by OBESSU Advocacy & Secretariat Hub • Rue de la Sablonnière 20, 1000 Brussels*`;
  });

  const [isGeneratingDoc, setIsGeneratingDoc] = useState<boolean>(false);
  const [editorTab, setEditorTab] = useState<'preview' | 'edit'>('preview');
  const [isExportingGoogleDoc, setIsExportingGoogleDoc] = useState<boolean>(false);
  const [exportedDocUrl, setExportedDocUrl] = useState<string | null>(null);
  const [isExportingGoogleSlides, setIsExportingGoogleSlides] = useState<boolean>(false);
  const [exportedSlidesUrl, setExportedSlidesUrl] = useState<string | null>(null);
  const [isSlidesPreviewOpen, setIsSlidesPreviewOpen] = useState<boolean>(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);

  // Filtered papers list
  const filteredPapers = useMemo(() => {
    return papers.filter((p) => {
      if (!paperSearch.trim()) return true;
      const q = paperSearch.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.summary || '').toLowerCase().includes(q)
      );
    });
  }, [papers, paperSearch]);

  // Filtered opportunities list
  const filteredOpportunities = useMemo(() => {
    const now = new Date().toISOString().split('T')[0];
    return opportunities.filter((o) => {
      if (oppFilterUpcomingOnly && o.dateOfActivity && o.dateOfActivity < now) {
        return false;
      }
      if (!oppSearch.trim()) return true;
      const q = oppSearch.toLowerCase();
      return (
        o.title.toLowerCase().includes(q) ||
        o.outreachEntity.toLowerCase().includes(q) ||
        o.policyArea.toLowerCase().includes(q)
      );
    });
  }, [opportunities, oppSearch, oppFilterUpcomingOnly]);

  // Paper selection toggle
  const togglePaperSelection = (title: string) => {
    setSelectedPaperTitles((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  // Opportunity selection toggle
  const toggleOppSelection = (id: string) => {
    setSelectedOppIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Generate Document Action
  const handleGenerateDocument = async () => {
    const selectedPapersList = papers.filter((p) => selectedPaperTitles.includes(p.title));
    const selectedOppsList = opportunities.filter((o) => selectedOppIds.includes(o.id));

    try {
      setIsGeneratingDoc(true);
      setExportedDocUrl(null);
      
      const res = await aiService.generateDocument({
        documentType: docType,
        title: docTitle,
        papers: selectedPapersList,
        opportunities: selectedOppsList,
        customInstructions: customDirectives,
        tone: docTone,
        targetAudience: targetAudience,
      });

      if (res.document) {
        setGeneratedDocContent(res.document);
        showToast(
          docType === 'project_brief'
            ? 'OBESSU Project Brief generated successfully!'
            : 'Structured Policy Brief generated successfully!'
        );
      }
    } catch (err: any) {
      showToast(`Document generation failed: ${err.message}`);
    } finally {
      setIsGeneratingDoc(false);
    }
  };

  // Export to Google Docs Action
  const handleExportToGoogleDoc = async () => {
    if (!hasGoogleToken) {
      onRequireAuth();
      return;
    }
    if (!generatedDocContent.trim()) {
      showToast('Document content is empty');
      return;
    }

    try {
      setIsExportingGoogleDoc(true);
      const titlePrefix = docType === 'project_brief' ? '[OBESSU Project Brief]' : '[OBESSU Policy Brief]';
      const doc = await workspaceService.createGoogleDoc(
        `${titlePrefix} ${docTitle || 'Document'}`,
        generatedDocContent
      );
      setExportedDocUrl(doc.documentUrl);
      showToast('Exported successfully to Google Docs in your Drive!');
      window.open(doc.documentUrl, '_blank');
    } catch (err: any) {
      showToast(`Google Doc export error: ${err.message}`);
    } finally {
      setIsExportingGoogleDoc(false);
    }
  };

  // Build presentation slides structured from policy/project brief
  const generatedSlidesDeck = useMemo(() => {
    const briefTitle = docTitle || 'OBESSU European Policy Briefing';
    
    // Extract key bullets and demands from content or selected papers
    const selectedPapersList = papers.filter((p) => selectedPaperTitles.includes(p.title));
    const selectedOpportunitiesList = opportunities.filter((o) => selectedOppIds.includes(o.id));
    const keyDemands = selectedPapersList.flatMap((p) => p.keyDemands || []).slice(0, 4);
    const relatedOpps = selectedOpportunitiesList.map((o) => `${o.outreachEntity}: ${o.title} (${o.dateOfActivity || 'Upcoming'})`).slice(0, 4);

    return [
      {
        title: briefTitle,
        subtitle: 'Strategic Policy & Institutional Advocacy Briefing • OBESSU Secretariat',
        category: 'Cover Slide',
        bullets: [
          'Organising Bureau of European School Student Unions (OBESSU)',
          'Rue de la Sablonnière 20, 1000 Brussels, Belgium',
          `Synthesizing ${selectedPaperTitles.length} Policy Papers & ${selectedOppIds.length} Institutional Dossiers`,
          `Presented by Panagiotis Chatzimichail • Head of External Affairs`
        ],
        notes: 'Introductory title slide for meeting with EU Commissioners, MEPs, or civil society partners.'
      },
      {
        title: 'Executive Summary & Institutional Context',
        subtitle: 'European Policy Urgency & Political Momentum',
        category: 'Context & Urgency',
        bullets: [
          'Addressing structural disparities in secondary education & vocational training across Member States.',
          'Aligning student rights with the European Education Area (EEA 2030) and Council Recommendations.',
          'Demanding mandatory structured dialogue mechanisms before legislative adoption.',
          'Leveraging current co-decision windows in EP CULT/EMPL and DG EAC consultations.'
        ],
        notes: 'Establish why action is needed now and the direct relevance to EU policy files.'
      },
      {
        title: 'Core Policy Demands & Legal Positions',
        subtitle: 'Adopted Student Union Mandates',
        category: 'Policy Demands',
        bullets: keyDemands.length > 0 ? keyDemands : [
          'Universal recognition of independent school student democratic unions in all 27 EU Member States.',
          'Legally binding European Quality Framework for Apprenticeships with guaranteed fair remuneration.',
          'Inclusive public education funding protecting marginalized and neurodivergent school students.',
          'Direct transmission of school student assembly resolutions to European Commission policy working groups.'
        ],
        notes: 'Highlight statutory OBESSU positions backed by General Assembly resolutions.'
      },
      {
        title: 'Institutional Targets & Co-decision Leverage',
        subtitle: 'Power Dynamics & Strategic Alliances',
        category: 'Stakeholders & Leverage',
        bullets: relatedOpps.length > 0 ? relatedOpps : [
          'European Parliament: EP CULT & EMPL Committee Rapporteurs and Shadow Rapporteurs.',
          'European Commission: DG EAC (Education, Culture & Youth) & DG EMPL (Apprenticeships & VET).',
          'Council of the EU: Rotating EU Council Presidencies (Education & Youth Working Parties).',
          'Civil Society: European Youth Forum (YJEV), ETUCE (Teachers), and Lifelong Learning Platform.'
        ],
        notes: 'Map who holds decision-making power and our coalition touchpoints.'
      },
      {
        title: 'Advocacy Roadmap & Implementation Milestones',
        subtitle: 'Key Legislative Gates & Deliverables',
        category: 'Action Roadmap',
        bullets: [
          'Stage 1: Bilateral technical briefings with Parliamentary Shadow Rapporteurs and Unit Heads.',
          'Stage 2: Co-hosting European Parliamentary Hearing on School Student Democracy in Brussels.',
          'Stage 3: Mobilization of national school student unions for coordinated Member State outreach.',
          'Stage 4: Monitoring European Commission implementation and publishing Annual Youth Check scorecards.'
        ],
        notes: 'Outline sequential action items and timeline for the advocacy campaign.'
      },
      {
        title: 'Conclusion & Secretariat Contact',
        subtitle: 'Partnering for Inclusive European Education',
        category: 'Contact & Close',
        bullets: [
          'Panagiotis Chatzimichail • Head of External Affairs (panagiotis@obessu.org)',
          'Rui Teixeira • Secretary General (rui.teixeira@obessu.org)',
          'OBESSU Secretariat • Rue de la Sablonnière 20, 1000 Brussels, Belgium',
          'Website: www.obessu.org • Transparency Register ID: 01402283088-75'
        ],
        notes: 'Final slide providing official contact details and institutional transparency register references.'
      }
    ];
  }, [docTitle, generatedDocContent, selectedPaperTitles, selectedOppIds, papers, opportunities]);

  // Export directly as Google Slides
  const handleExportToGoogleSlides = async () => {
    if (!hasGoogleToken) {
      onRequireAuth();
      return;
    }
    if (!generatedDocContent.trim()) {
      showToast('Document content is empty');
      return;
    }

    try {
      setIsExportingGoogleSlides(true);
      const title = docTitle || 'OBESSU Policy Briefing Deck';
      const result = await workspaceService.createGoogleSlides(
        title,
        generatedSlidesDeck.map((s) => ({
          title: s.title,
          subtitle: s.subtitle,
          bullets: s.bullets,
          notes: s.notes
        }))
      );
      setExportedSlidesUrl(result.presentationUrl);
      showToast('Google Slides presentation created successfully in your Google Drive!');
      window.open(result.presentationUrl, '_blank');
    } catch (err: any) {
      showToast(`Google Slides export error: ${err.message}`);
    } finally {
      setIsExportingGoogleSlides(false);
    }
  };

  // Copy to clipboard
  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedDocContent);
      setCopiedSuccess(true);
      showToast('Copied document markdown to clipboard!');
      setTimeout(() => setCopiedSuccess(false), 2000);
    } catch (err) {
      showToast('Failed to copy to clipboard');
    }
  };

  // Download markdown
  const handleDownloadMarkdown = () => {
    const element = document.createElement('a');
    const file = new Blob([generatedDocContent], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = `${docTitle.replace(/\s+/g, '_').toLowerCase() || 'obessu_brief'}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showToast('Markdown file downloaded!');
  };

  // Quick Refinement actions
  const handleQuickRefine = async (directive: string) => {
    setCustomDirectives((prev) => (prev ? `${prev}\n- ${directive}` : `- ${directive}`));
    showToast(`Refinement directive added: "${directive}". Click Generate to apply.`);
  };

  // Word count and stats
  const wordCount = useMemo(() => {
    return generatedDocContent.trim().split(/\s+/).filter(Boolean).length;
  }, [generatedDocContent]);

  const readingTime = useMemo(() => {
    return Math.max(1, Math.ceil(wordCount / 200));
  }, [wordCount]);

  // ==========================================
  // 2. VOICE DEBRIEF STATE & HANDLERS
  // ==========================================
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selectedOppId, setSelectedOppId] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [debriefResult, setDebriefResult] = useState<{
    transcription: string;
    summary: string;
    detectedOutcomes: any[];
    nextActions: any[];
  } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDebriefResult(null);
    } catch (err: any) {
      showToast(`Microphone access error: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      setIsRecording(false);
    }
  };

  const handleProcessAudioDebrief = async () => {
    if (!audioBlob) return;
    try {
      setIsTranscribing(true);
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        const linkedOpp = opportunities.find((o) => o.id === selectedOppId);
        const res = await aiService.transcribeAudio(base64Audio, audioBlob.type, linkedOpp);
        setDebriefResult(res.data);
        showToast('Voice memo transcribed and policy items extracted!');
      };
    } catch (err: any) {
      showToast(`Transcription error: ${err.message}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSaveAllFromDebrief = () => {
    if (!debriefResult) return;
    const linkedOpp = opportunities.find((o) => o.id === selectedOppId);

    // Save detected outcomes
    debriefResult.detectedOutcomes?.forEach((out) => {
      onSaveOutcome({
        opportunityId: linkedOpp?.id,
        stakeholder: linkedOpp?.outreachEntity || 'Institutional Meeting',
        type: out.type || 'Position submitted',
        description: out.description,
        evidence: out.evidence || debriefResult.summary,
        date: new Date().toISOString().split('T')[0],
      });
    });

    // Save next actions
    debriefResult.nextActions?.forEach((act) => {
      onSaveAction({
        opportunityId: linkedOpp?.id,
        title: act.title,
        description: `Generated from voice debrief: ${debriefResult.summary}`,
        actionType: 'send_followup',
        assignedTo: act.assignee || 'Panagiotis Chatzimichail',
        status: 'todo',
        priority: 'High',
        dueAt: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
        estimatedMinutes: act.estimatedMinutes || 20,
        nbaScore: 92,
        reason: 'Extracted from post-meeting voice debrief',
      });
    });

    showToast('All extracted outcomes and actions persisted to command centre!');
  };

  // ==========================================
  // 3. HIGH THINKING STRATEGY STATE & HANDLERS
  // ==========================================
  const [strategyTopic, setStrategyTopic] = useState('Defending Student Representation in the VET Quality Framework');
  const [strategyPolicyArea, setStrategyPolicyArea] = useState('Education Policy & VET Reform');
  const [strategyTarget, setStrategyTarget] = useState('European Parliament CULT & EMPL Committees');
  const [strategyChallenge, setStrategyChallenge] = useState('Employer associations in Cedefop are pushing to dilute the binding requirement for school student and apprentice representation on governance boards.');
  const [isThinking, setIsThinking] = useState(false);
  const [strategyAnalysis, setStrategyAnalysis] = useState<string | null>(null);

  const handleRunStrategy = async () => {
    try {
      setIsThinking(true);
      setStrategyAnalysis(null);
      const res = await aiService.highThinkingStrategy({
        topic: strategyTopic,
        policyArea: strategyPolicyArea,
        targetStakeholder: strategyTarget,
        specificChallenge: strategyChallenge,
      });
      setStrategyAnalysis(res.analysis);
      showToast('Strategic analysis generated with High Thinking Mode!');
    } catch (err: any) {
      showToast(`Strategy error: ${err.message}`);
    } finally {
      setIsThinking(false);
    }
  };

  // ==========================================
  // 4. EU SEARCH GROUNDING STATE & HANDLERS
  // ==========================================
  const [searchQuery, setSearchQuery] = useState('European Parliament VET report Brigitte van den Berg 2026');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{ content: string; sources: any[] } | null>(null);

  const handleRunSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      setIsSearching(true);
      setSearchResult(null);
      const res = await aiService.searchEUPolicy(searchQuery);
      setSearchResult({ content: res.content, sources: res.sources });
    } catch (err: any) {
      showToast(`Search error: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 text-xs font-medium flex items-center gap-2 animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner & Mode Switcher */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-1.5 bg-gradient-to-tr from-indigo-500 to-cyan-400 text-white rounded-lg shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                OBESSU AI Intelligence & Brief Studio
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              AI Advocacy Co-Pilot & Document Studio
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
              Synthesize multiple OBESSU policy papers and European institutional opportunities into comprehensive **Project Briefs** and structured **Policy Brief drafts**, with instant export to Google Docs.
            </p>
          </div>

          {/* Mode Selector Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 p-1.5 rounded-2xl border border-slate-700/80 self-start lg:self-auto overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveMode('doc_studio')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeMode === 'doc_studio'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <FileText className="w-4 h-4 text-indigo-300" />
              <span>Document Studio</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-white/20 rounded-md font-extrabold">Studio</span>
            </button>

            <button
              onClick={() => setActiveMode('voice_debrief')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeMode === 'voice_debrief'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Mic className="w-4 h-4 text-cyan-300" />
              <span>Voice Debrief</span>
            </button>

            <button
              onClick={() => setActiveMode('high_thinking')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeMode === 'high_thinking'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Brain className="w-4 h-4 text-purple-300" />
              <span>High Thinking</span>
            </button>

            <button
              onClick={() => setActiveMode('eu_search')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeMode === 'eu_search'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Search className="w-4 h-4 text-blue-300" />
              <span>EU Policy Radar</span>
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODE 1: DOCUMENT STUDIO WITH SELECTOR SIDEBAR & GOOGLE DOCS    */}
      {/* ============================================================== */}
      {activeMode === 'doc_studio' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT SIDEBAR: Selection of Papers, Opportunities & Config */}
          <div className="lg:col-span-4 space-y-4">
            {/* Document Type Selector Card */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Document Blueprint</span>
                </span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md">
                  Local LLM (Ollama)
                </span>
              </div>

              {/* Type Switcher Buttons */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setDocType('project_brief');
                    if (docTitle.includes('Policy Brief')) {
                      setDocTitle('OBESSU European Project Brief: Secondary Student Empowerment & VET Rights');
                    }
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                    docType === 'project_brief'
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>Project Brief</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDocType('policy_brief');
                    if (docTitle.includes('Project Brief')) {
                      setDocTitle('OBESSU Policy Brief: Mandatory Student Representation & Quality Standards in EU VET');
                    }
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                    docType === 'policy_brief'
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Policy Brief</span>
                </button>
              </div>

              {/* Document Title Input */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Document Working Title
                </label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Target Audience & Tone */}
              <div className="grid grid-cols-1 gap-2.5 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Target Audience</label>
                  <input
                    type="text"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder="e.g. EP CULT/EMPL Committees, DG EAC, Grant Evaluators"
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Voice & Tone</label>
                  <select
                    value={docTone}
                    onChange={(e) => setDocTone(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
                  >
                    <option value="Authoritative, Rights-Based & Strategic">Authoritative, Rights-Based & Strategic</option>
                    <option value="Executive & Policy-Ready (for MEPs / Commission)">Executive & Policy-Ready (for MEPs / Commission)</option>
                    <option value="EU Grant & Consortium Proposal Aligned">EU Grant & Consortium Proposal Aligned</option>
                    <option value="Grassroots Campaign & Youth Union Mobilization">Grassroots Campaign & Youth Union Mobilization</option>
                  </select>
                </div>
              </div>
            </div>

            {/* MULTI-PAPERS SELECTOR */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Select OBESSU Papers
                  </h3>
                </div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full">
                  {selectedPaperTitles.length} / {papers.length} Selected
                </span>
              </div>

              <p className="text-[11px] text-slate-500 leading-snug">
                Select position papers to synthesize core demands, evidence, and policy arguments into the brief.
              </p>

              {/* Paper Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search papers by title or category..."
                  value={paperSearch}
                  onChange={(e) => setPaperSearch(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-hidden"
                />
              </div>

              {/* Quick action buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedPaperTitles(papers.map((p) => p.title))}
                  className="px-2 py-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                >
                  Select All ({papers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPaperTitles([])}
                  className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 rounded-lg transition-colors"
                >
                  Clear
                </button>
              </div>

              {/* Scrollable Paper List */}
              <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                {filteredPapers.map((paper) => {
                  const isSelected = selectedPaperTitles.includes(paper.title);
                  return (
                    <label
                      key={paper.id}
                      className={`flex items-start gap-2.5 p-2 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-50/70 border border-indigo-200/80 text-indigo-950 font-semibold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePaperSelection(paper.title)}
                        className="mt-0.5 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs leading-snug line-clamp-1">{paper.title}</p>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-sm bg-slate-100 text-slate-600 flex-shrink-0">
                            {paper.category || 'Paper'}
                          </span>
                        </div>
                        {paper.keyDemands && paper.keyDemands.length > 0 && (
                          <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                            {paper.keyDemands.length} key demands: {paper.keyDemands[0]}
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* MULTI-OPPORTUNITIES SELECTOR */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Select Opportunities & Events
                  </h3>
                </div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full">
                  {selectedOppIds.length} / {opportunities.length} Selected
                </span>
              </div>

              <p className="text-[11px] text-slate-500 leading-snug">
                Link upcoming institutional hearings, conferences, or consultation windows to establish advocacy timelines.
              </p>

              {/* Opportunity Search & Filter */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search entity, title, or policy..."
                    value={oppSearch}
                    onChange={(e) => setOppSearch(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-hidden"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setOppFilterUpcomingOnly(!oppFilterUpcomingOnly)}
                  className={`px-2 py-1.5 text-[10px] font-bold rounded-xl whitespace-nowrap transition-colors ${
                    oppFilterUpcomingOnly
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {oppFilterUpcomingOnly ? 'Upcoming' : 'All'}
                </button>
              </div>

              {/* Scrollable Opportunities List */}
              <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                {filteredOpportunities.map((opp) => {
                  const isSelected = selectedOppIds.includes(opp.id);
                  return (
                    <label
                      key={opp.id}
                      className={`flex items-start gap-2.5 p-2 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-amber-50/70 border border-amber-200/80 text-amber-950 font-semibold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOppSelection(opp.id)}
                        className="mt-0.5 rounded-sm border-slate-300 text-amber-600 focus:ring-amber-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs leading-snug line-clamp-1 font-bold">{opp.outreachEntity}</p>
                          <span
                            className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-sm ${
                              opp.priority === 'High'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {opp.dateOfActivity || 'TBD'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">{opp.title}</p>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {opp.policyArea}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Custom Directives Textarea */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-2">
              <label className="text-[11px] font-bold text-slate-700 block">
                Additional Instructions / Custom Focus (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Include specific work package for member union training in Eastern Europe and cite Erasmus+ Key Action 3 grant indicators..."
                value={customDirectives}
                onChange={(e) => setCustomDirectives(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-hidden"
              />
            </div>

            {/* Primary Generate Action Button */}
            <button
              onClick={handleGenerateDocument}
              disabled={isGeneratingDoc}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 active:scale-[0.99] text-white text-xs font-extrabold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2.5"
            >
              {isGeneratingDoc ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Papers & Opportunities with your local AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-cyan-300" />
                  <span>
                    Generate {docType === 'project_brief' ? 'OBESSU Project Brief' : 'Policy Brief Draft'}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* RIGHT PANEL: Live Document Editor & Google Docs Exporter */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden flex flex-col min-h-[750px]">
              {/* Document Studio Header & Action Bar */}
              <div className="p-5 border-b border-slate-200/80 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                        docType === 'project_brief'
                          ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          : 'bg-amber-100 text-amber-900 border border-amber-200'
                      }`}
                    >
                      {docType === 'project_brief' ? 'OBESSU Project Brief' : 'Structured Policy Brief'}
                    </span>
                    <span className="text-[11px] text-slate-400">•</span>
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {readingTime} min read (~{wordCount} words)
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug">
                    {docTitle || 'Untitled Document'}
                  </h2>
                </div>

                {/* Primary Export & Interaction Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* View / Edit Mode Switcher */}
                  <div className="flex items-center p-1 bg-slate-200/70 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setEditorTab('preview')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors ${
                        editorTab === 'preview'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorTab('edit')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors ${
                        editorTab === 'edit'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editor</span>
                    </button>
                  </div>

                  {/* Copy Button */}
                  <button
                    type="button"
                    onClick={handleCopyToClipboard}
                    className="p-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1"
                    title="Copy Markdown"
                  >
                    {copiedSuccess ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>

                  {/* Download Markdown */}
                  <button
                    type="button"
                    onClick={handleDownloadMarkdown}
                    className="p-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors"
                    title="Download .md file"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  {/* Export Directly to Google Docs Button */}
                  <button
                    type="button"
                    onClick={handleExportToGoogleDoc}
                    disabled={isExportingGoogleDoc}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <HardDrive className="w-4 h-4" />
                    <span>{isExportingGoogleDoc ? 'Creating Doc...' : 'Export to Docs'}</span>
                  </button>

                  {/* Export Directly as Google Slides Presentation Template */}
                  <button
                    type="button"
                    onClick={handleExportToGoogleSlides}
                    disabled={isExportingGoogleSlides}
                    className="px-3.5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <Presentation className="w-4 h-4" />
                    <span>{isExportingGoogleSlides ? 'Creating Slides...' : 'Export as Google Slides'}</span>
                  </button>

                  {/* Slides Deck Preview Trigger */}
                  <button
                    type="button"
                    onClick={() => setIsSlidesPreviewOpen(true)}
                    className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1"
                    title="Preview Presentation Slides Deck"
                  >
                    <MonitorPlay className="w-4 h-4 text-amber-600" />
                  </button>
                </div>
              </div>

              {/* Exported Document Confirmation Alert */}
              {exportedDocUrl && (
                <div className="p-3.5 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between text-xs px-6 animate-in fade-in">
                  <div className="flex items-center gap-2 text-emerald-900 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>Google Doc created successfully in your Google Drive!</span>
                  </div>
                  <a
                    href={exportedDocUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-emerald-300 rounded-lg font-bold text-indigo-600 hover:text-indigo-800 transition-colors shadow-2xs"
                  >
                    <span>Open in Google Docs</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* Exported Slides Presentation Confirmation Alert */}
              {exportedSlidesUrl && (
                <div className="p-3.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs px-6 animate-in fade-in">
                  <div className="flex items-center gap-2 text-amber-950 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>Google Slides presentation created successfully in your Google Drive!</span>
                  </div>
                  <a
                    href={exportedSlidesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-amber-300 rounded-lg font-bold text-amber-700 hover:text-amber-900 transition-colors shadow-2xs"
                  >
                    <span>Open in Google Slides</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* Active References Ribbon */}
              <div className="px-6 py-2.5 bg-slate-100/60 border-b border-slate-200/60 flex items-center gap-3 overflow-x-auto text-[11px]">
                <span className="font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap text-[10px]">
                  Synthesized Sources:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {selectedPaperTitles.map((t, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-indigo-50 border border-indigo-200/60 text-indigo-900 rounded-md font-medium text-[10px] truncate max-w-[200px]"
                      title={t}
                    >
                      📄 {t}
                    </span>
                  ))}
                  {selectedOppIds.map((id, idx) => {
                    const opp = opportunities.find((o) => o.id === id);
                    return (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-amber-50 border border-amber-200/60 text-amber-900 rounded-md font-medium text-[10px] truncate max-w-[200px]"
                        title={opp?.title}
                      >
                        🏛️ {opp?.outreachEntity || id}
                      </span>
                    );
                  })}
                  {selectedPaperTitles.length === 0 && selectedOppIds.length === 0 && (
                    <span className="text-slate-400 italic">No specific papers/opportunities selected</span>
                  )}
                </div>
              </div>

              {/* Main Document Body */}
              <div className="p-6 sm:p-8 flex-1 flex flex-col">
                {editorTab === 'preview' ? (
                  <div className="prose prose-slate max-w-none text-xs sm:text-sm leading-relaxed text-slate-800 space-y-4 font-sans whitespace-pre-wrap select-text">
                    {generatedDocContent}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                      <span>Markdown Source Editor</span>
                      <span>Live edits update your Google Docs export</span>
                    </div>
                    <textarea
                      value={generatedDocContent}
                      onChange={(e) => setGeneratedDocContent(e.target.value)}
                      rows={28}
                      className="w-full flex-1 p-4 font-mono text-xs leading-relaxed bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-y min-h-[500px]"
                    />
                  </div>
                )}
              </div>

              {/* Footer Refinement Pills Bar */}
              <div className="p-4 border-t border-slate-200 bg-slate-50/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Quick Polish Directives:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleQuickRefine('Make executive summary more concise and punchy')}
                    className="px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 transition-colors"
                  >
                    ⚡ Make More Concise
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickRefine('Emphasize binding student participation rights on school boards')}
                    className="px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 transition-colors"
                  >
                    🗳️ Strengthen Student Democracy
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickRefine('Add specific work package linking to the Pool of Trainers (PoT)')}
                    className="px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 transition-colors"
                  >
                    🎓 Integrate Pool of Trainers
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateDocument}
                    disabled={isGeneratingDoc}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingDoc ? 'animate-spin' : ''}`} />
                    <span>Regenerate</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODE 2: VOICE DEBRIEF TRANSCRIBER                              */}
      {/* ============================================================== */}
      {activeMode === 'voice_debrief' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Mic className="w-5 h-5 text-indigo-600" />
                <span>Post-Meeting Voice Debrief</span>
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800">
                Model: local Whisper + Ollama
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Record a 30–90 second voice memo after meeting with MEPs, Commission officials, or platform partners. The AI will transcribe your speech, extract substantive policy outcomes, and draft follow-up tasks.
            </p>

            {/* Opportunity Selector */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Link to Advocacy Opportunity (Optional)
              </label>
              <select
                value={selectedOppId}
                onChange={(e) => setSelectedOppId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-hidden"
              >
                <option value="">-- General / Ad-hoc Meeting --</option>
                {opportunities.map((opp) => (
                  <option key={opp.id} value={opp.id}>
                    [{opp.legacyId || opp.id}] {opp.outreachEntity}: {opp.title.slice(0, 45)}...
                  </option>
                ))}
              </select>
            </div>

            {/* Recorder Controls */}
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-4">
              {isRecording ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="w-3 h-3 bg-red-500 rounded-full animate-ping" />
                    <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Recording Live...</span>
                  </div>
                  <button
                    onClick={stopRecording}
                    className="px-6 py-3 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 mx-auto"
                  >
                    <Square className="w-4 h-4" />
                    <span>Stop Recording</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={startRecording}
                    className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2.5 mx-auto"
                  >
                    <Mic className="w-4 h-4" />
                    <span>Start Voice Memo Recording</span>
                  </button>
                  <p className="text-[11px] text-slate-400">Or use microphone to debrief right outside the meeting room</p>
                </div>
              )}

              {/* Audio preview player */}
              {audioUrl && !isRecording && (
                <div className="pt-3 border-t border-slate-200/80 space-y-3">
                  <audio controls src={audioUrl} className="w-full h-10" />
                  <button
                    onClick={handleProcessAudioDebrief}
                    disabled={isTranscribing}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                  >
                    {isTranscribing ? (
                      <span>Analyzing Audio with local Whisper + AI...</span>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Transcribe & Extract Policy Intelligence</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Results Side */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900">Extracted Intelligence & Actions</h3>

            {!debriefResult ? (
              <div className="h-64 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-xs text-slate-400 p-6 text-center">
                Record a voice memo on the left to inspect transcription, substantive policy outcomes, and generated action items.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary */}
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900">Executive Debrief</span>
                  <p className="text-xs text-indigo-950 font-medium leading-relaxed">{debriefResult.summary}</p>
                </div>

                {/* Detected Outcomes */}
                {debriefResult.detectedOutcomes && debriefResult.detectedOutcomes.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                      Detected Substantive Outcomes ({debriefResult.detectedOutcomes.length})
                    </span>
                    {debriefResult.detectedOutcomes.map((out, i) => (
                      <div key={i} className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                        <span className="font-bold text-emerald-900">{out.type}</span>
                        <p className="text-emerald-800">{out.description}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Next Actions */}
                {debriefResult.nextActions && debriefResult.nextActions.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Generated Action Items ({debriefResult.nextActions.length})
                    </span>
                    {debriefResult.nextActions.map((act, i) => (
                      <div key={i} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between">
                        <span className="font-semibold text-slate-800">{act.title}</span>
                        <span className="text-[11px] text-slate-500">{act.estimatedMinutes || 15}m</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Save Button */}
                <button
                  onClick={handleSaveAllFromDebrief}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Persist Extracted Outcomes & Actions to System</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODE 3: HIGH THINKING STRATEGY                                 */}
      {/* ============================================================== */}
      {activeMode === 'high_thinking' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Brain className="w-5 h-5 text-indigo-600" />
                <span>Deep Strategic Reasoning</span>
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
                Local LLM (deep reasoning mode)
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Use your local model's extended reasoning to tackle high-stakes European legislative challenges, draft amendments, and analyze negotiation leverage.
            </p>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Policy Area</label>
                <input
                  type="text"
                  value={strategyPolicyArea}
                  onChange={(e) => setStrategyPolicyArea(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Advocacy Topic</label>
                <input
                  type="text"
                  value={strategyTopic}
                  onChange={(e) => setStrategyTopic(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Target Institution</label>
                <input
                  type="text"
                  value={strategyTarget}
                  onChange={(e) => setStrategyTarget(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Strategic Challenge / Red Line</label>
                <textarea
                  rows={3}
                  value={strategyChallenge}
                  onChange={(e) => setStrategyChallenge(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>

              <button
                onClick={handleRunStrategy}
                disabled={isThinking}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                {isThinking ? (
                  <span>Executing Deep Reasoning...</span>
                ) : (
                  <>
                    <Brain className="w-4 h-4" />
                    <span>Run High-Thinking Strategic Analysis</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900">Legislative & Negotiation Playbook</h3>

            {!strategyAnalysis ? (
              <div className="h-96 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-xs text-slate-400 p-6 text-center">
                Configure the challenge parameters on the left and run the high-thinking engine.
              </div>
            ) : (
              <div className="p-6 bg-slate-900 text-slate-100 rounded-2xl text-xs leading-relaxed font-sans whitespace-pre-wrap max-h-[600px] overflow-y-auto">
                {strategyAnalysis}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODE 4: EU POLICY RADAR & SEARCH GROUNDING                     */}
      {/* ============================================================== */}
      {activeMode === 'eu_search' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">EU Policy Radar (Google Search Grounded)</h2>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
              Local LLM with free web search grounding
            </span>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search live EU education directives, EP reports, Cedefop calls..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRunSearch()}
              className="flex-1 px-4 py-3 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 text-slate-800 font-medium"
            />
            <button
              onClick={handleRunSearch}
              disabled={isSearching}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl shadow-xs transition-colors"
            >
              {isSearching ? 'Searching...' : 'Search Policy Radar'}
            </button>
          </div>

          {searchResult && (
            <div className="space-y-4 pt-2">
              <div className="p-6 bg-slate-50 rounded-2xl text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">
                {searchResult.content}
              </div>

              {searchResult.sources && searchResult.sources.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Live Cited Web Sources:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {searchResult.sources.map((s, idx) => (
                      <a
                        key={idx}
                        href={s.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-400 rounded-xl text-xs font-medium text-indigo-700 transition-colors"
                      >
                        <span>{s.title || s.uri}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* GOOGLE SLIDES PRESENTATION DECK PREVIEW MODAL                  */}
      {/* ============================================================== */}
      {isSlidesPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full p-6 sm:p-8 border border-slate-200 space-y-5 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-gradient-to-tr from-amber-600 to-orange-600 text-white rounded-2xl shadow-xs">
                  <Presentation className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    OBESSU Briefing Deck • Google Slides Presentation Template
                  </h3>
                  <p className="text-xs text-slate-500">
                    Executive 6-slide presentation structured for institutional meetings, MEP hearings & stakeholder briefings
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSlidesPreviewOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Slide Navigation Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-shrink-0">
              {generatedSlidesDeck.map((slide, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveSlideIndex(idx)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    activeSlideIndex === idx
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-black/20 text-[10px] flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span>{slide.category}</span>
                </button>
              ))}
            </div>

            {/* Slide Canvas Preview */}
            {generatedSlidesDeck[activeSlideIndex] && (
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl border border-slate-700/80 shadow-inner flex flex-col justify-between min-h-[280px]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                      OBESSU Executive Deck • Slide {activeSlideIndex + 1} of {generatedSlidesDeck.length}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Rue de la Sablonnière 20, 1000 Brussels
                    </span>
                  </div>

                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                      {generatedSlidesDeck[activeSlideIndex].title}
                    </h2>
                    {generatedSlidesDeck[activeSlideIndex].subtitle && (
                      <p className="text-xs font-semibold text-indigo-300 mt-1">
                        {generatedSlidesDeck[activeSlideIndex].subtitle}
                      </p>
                    )}
                  </div>

                  {/* Bullet Points */}
                  <ul className="space-y-2.5 pt-2">
                    {generatedSlidesDeck[activeSlideIndex].bullets.map((bullet, bIdx) => (
                      <li key={bIdx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-200 font-medium">
                        <span className="text-amber-400 font-bold mt-0.5">•</span>
                        <span className="leading-relaxed">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Speaker Notes */}
                {generatedSlidesDeck[activeSlideIndex].notes && (
                  <div className="mt-6 pt-3 border-t border-white/10 text-[11px] text-slate-400 italic">
                    <strong>Speaker notes:</strong> {generatedSlidesDeck[activeSlideIndex].notes}
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 flex-shrink-0 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSlideIndex((prev) => Math.max(0, prev - 1))}
                  disabled={activeSlideIndex === 0}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold disabled:opacity-40"
                >
                  Previous Slide
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSlideIndex((prev) => Math.min(generatedSlidesDeck.length - 1, prev + 1))}
                  disabled={activeSlideIndex === generatedSlidesDeck.length - 1}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold disabled:opacity-40"
                >
                  Next Slide
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportToGoogleSlides}
                  disabled={isExportingGoogleSlides}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 active:scale-[0.99] text-white rounded-xl text-xs font-extrabold shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Presentation className="w-4 h-4" />
                  <span>{isExportingGoogleSlides ? 'Creating Google Slides...' : 'Export to Google Slides (Drive)'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
