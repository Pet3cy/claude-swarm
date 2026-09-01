export type PolicyArea =
  | 'Digital Education & Innovation'
  | 'Civic Space & Democratic Participation'
  | 'Climate & Just Transition'
  | 'Social Inclusion & Wellbeing'
  | 'Education Policy & VET Reform'
  | 'International Cooperation & UN/CoE Relations'
  | 'Employment & Youth Guarantee'
  | 'Health & Wellbeing';

export type PriorityLevel = 'High' | 'Medium' | 'Low';

export type EngagementType =
  | 'Participation (In-person)'
  | 'Participation'
  | 'Participation (Virtual)'
  | 'Speaking (In-person)'
  | 'Speaking (Virtual)'
  | 'Declined';

export type ReplyStatus =
  | 'Pending'
  | 'Completed'
  | 'Cooperation'
  | 'Not going'
  | 'In discussion';

export type OpportunityStatus =
  | 'new'
  | 'assessing'
  | 'accepted'
  | 'declined'
  | 'preparing'
  | 'engaged'
  | 'following_up'
  | 'outcome_captured'
  | 'closed';

export type StakeholderCategory =
  | 'EU'
  | 'CSOs'
  | 'Platforms'
  | 'CoE'
  | 'International Bodies'
  | 'MoU';

export type OutcomeType =
  | 'Position submitted'
  | 'Formal citation'
  | 'Joint statement'
  | 'Structural invitation'
  | 'Legislative uptake'
  | 'Follow-up secured'
  | 'Network coordination';

export interface Outcome {
  id: string;
  opportunityId?: string;
  type: OutcomeType;
  description: string;
  evidence: string;
  evidenceUrl?: string;
  date: string;
  policyArea?: PolicyArea;
  stakeholder: string;
  impactScore?: number;
}

export interface Paper {
  id: string;
  title: string;
  policyArea: PolicyArea;
  summary: string;
  keyDemands: string[];
  pdfUrl?: string;
  publicationYear?: number;
  year?: number;
}

export type EuropeanRegion =
  | 'Western Europe / Brussels EU Core'
  | 'Nordic & Baltic'
  | 'Southern Europe / Mediterranean'
  | 'Central & Eastern Europe'
  | 'Pan-European & International';

export interface PredictiveShift {
  direction: 'positive' | 'negative' | 'volatile';
  deltaPercent: number; // e.g. +15, -8
  confidence: number; // 0 - 100
  legislativeTrigger: string;
  rationale: string;
  sourcePattern: string;
  detectedDate: string;
}

export interface Stakeholder {
  id: string;
  name: string;
  canonicalName: string;
  category: StakeholderCategory;
  region?: EuropeanRegion;
  tags?: string[];
  predictiveShift?: PredictiveShift;
  relationshipScore: number; // 0 - 100
  influenceScore?: number; // 0 - 100 (Power/Impact on decision-making)
  alignmentScore?: number; // 0 - 100 (Alignment with OBESSU policy positions)
  notes: string;
  richNotes?: string;
  notesUpdatedAt?: string;
  notesAuthor?: string;
  lastInPersonMeetingDate?: string;
  contactEmail?: string;
  aliases: string[];
  standingSeat?: boolean;
}

export interface Opportunity {
  id: string;
  legacyId?: string;
  title: string;
  requestDate?: string;
  sentBy?: string;
  outreachEntity: string;
  stakeholderId?: string;
  email?: string;
  policyArea: PolicyArea;
  fields?: string[];
  papers: string[];
  track?: 'Policy' | 'Projects' | 'Membership';
  priority: PriorityLevel;
  engagementType?: EngagementType;
  replyStatus: ReplyStatus;
  status: OpportunityStatus;
  dateOfActivity: string;
  venue: string;
  assignedTo: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  categorySet: StakeholderCategory;
  outcome?: Outcome | { type: OutcomeType; description: string; evidence?: string };
  updatedAt?: string;
  notes?: string;
  nbaScore?: number;
  aiBriefing?: string;
  googleCalendarEventId?: string;
  isExternalActivity?: boolean;
}

export type ActionType =
  | 'assess_invitation'
  | 'prepare_briefing'
  | 'identify_position'
  | 'confirm_logistics'
  | 'prepare_talking_points'
  | 'attend_event'
  | 'record_outcome'
  | 'attach_evidence'
  | 'send_followup'
  | 'draft_statement';

export type ActionStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'deferred';

export interface ActionItem {
  id: string;
  opportunityId?: string;
  parentActionId?: string;
  title: string;
  description?: string;
  actionType: ActionType;
  assignedTo: string;
  status: ActionStatus;
  priority: PriorityLevel;
  dueAt: string;
  estimatedMinutes: number;
  nbaScore: number;
  reason: string;
  completedAt?: string;
  deferredUntil?: string;
  createdAt: string;
  updatedAt: string;
  googleTaskId?: string;
  factors?: {
    strategicPriority: number;
    urgency: number;
    impact: number;
    policyRelevance: number;
    relationshipValue: number;
    readiness: number;
    effortPenalty: number;
    stalenessBonus: number;
  };
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  department: 'Secretariat' | 'Governing Board';
  title?: string;
  portfolio?: string;
  bio?: string;
  active: boolean;
  avatarColor: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  entityType: 'opportunity' | 'action' | 'outcome' | 'stakeholder' | 'settings';
  entityId: string;
  details: string;
}

export interface DataHealthIssue {
  id: string;
  type: 'missing_date' | 'unassigned_high_priority' | 'missing_papers' | 'pending_overdue' | 'unrecorded_outcome' | 'quarantined_record';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  opportunityId?: string;
  actionableFix: string;
}

export interface BackupData {
  app: string;
  version: number;
  exportedAt: string;
  data: {
    obessu_invitation_registry: any[];
    obessu_external_activities: any[];
    obessu_settings: {
      outcomeTracking: boolean;
      dataHealthChecks: boolean;
    };
    obessu_registry_deleted: Record<string, number>;
    obessu_validation_ignored: string[];
    obessu_directory_overrides: any;
    obessu_google_calendar_removed_ids: string[];
  };
}
