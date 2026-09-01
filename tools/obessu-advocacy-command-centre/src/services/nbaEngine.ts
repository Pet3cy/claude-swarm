import { ActionItem, Opportunity, Paper, Stakeholder } from '../types/advocacy';

export interface ScoreBreakdown {
  nbaScore: number;
  reason: string;
  factors: {
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

/**
 * Calculates Next Best Action (NBA) score based on SPEC algorithm:
 * score = 0.25 * strategic_priority + 0.20 * urgency + 0.20 * impact + 0.15 * policy_relevance + 0.10 * relationship_value + 0.10 * readiness - effort_penalty + staleness_bonus
 */
export function calculateActionScore(
  opp: Opportunity,
  stakeholder?: Stakeholder,
  papers: Paper[] = [],
  estimatedMinutes: number = 30,
  actionType: string = 'prepare_briefing',
  deferredUntil?: string,
  createdAt?: string
): ScoreBreakdown {
  const now = new Date();
  
  // 1. Strategic Priority (0 - 1)
  let strategicPriority = 0.5;
  if (opp.priority === 'High') strategicPriority = 1.0;
  else if (opp.priority === 'Medium') strategicPriority = 0.6;
  else strategicPriority = 0.3;

  // 2. Urgency (proximity to event date or deadline) (0 - 1)
  let urgency = 0.3;
  if (opp.dateOfActivity) {
    const actDate = new Date(opp.dateOfActivity);
    const diffDays = (actDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
    if (diffDays < 0) {
      // Past event: if outcome not recorded, urgent follow-up!
      urgency = opp.outcome ? 0.2 : 0.85;
    } else if (diffDays <= 2) {
      urgency = 1.0;
    } else if (diffDays <= 7) {
      urgency = 0.85;
    } else if (diffDays <= 14) {
      urgency = 0.65;
    } else if (diffDays <= 30) {
      urgency = 0.45;
    } else {
      urgency = 0.25;
    }
  }

  // 3. Impact Potential (0 - 1)
  let impact = 0.5;
  if (opp.categorySet === 'EU') impact = 0.9;
  else if (opp.categorySet === 'CoE') impact = 0.85;
  else if (opp.categorySet === 'Platforms') impact = 0.75;
  else if (opp.categorySet === 'International Bodies') impact = 0.95;
  else impact = 0.6;

  if (opp.outcome?.type === 'Legislative uptake' || opp.outcome?.type === 'Structural invitation') {
    impact = 1.0;
  }

  // 4. Policy Relevance (0 - 1)
  let policyRelevance = 0.7;
  const activeCorePolicyAreas = [
    'Education Policy & VET Reform',
    'Civic Space & Democratic Participation',
    'Employment & Youth Guarantee',
    'Digital Education & Innovation'
  ];
  if (activeCorePolicyAreas.includes(opp.policyArea)) {
    policyRelevance = 0.95;
  }

  // 5. Relationship Value (0 - 1)
  let relationshipValue = 0.5;
  if (stakeholder) {
    relationshipValue = (stakeholder.relationshipScore || 70) / 100;
  } else if (opp.categorySet === 'EU' || opp.categorySet === 'Platforms') {
    relationshipValue = 0.8;
  }

  // 6. Readiness (whether papers, venue, and assigned owner exist) (0 - 1)
  let readiness = 0.4;
  if (opp.papers && opp.papers.length > 0) readiness += 0.3;
  if (opp.assignedTo) readiness += 0.2;
  if (opp.venue) readiness += 0.1;
  readiness = Math.min(1.0, readiness);

  // 7. Effort Penalty (prefer actions <= 60 mins)
  let effortPenalty = 0;
  if (estimatedMinutes > 90) {
    effortPenalty = 0.15;
  } else if (estimatedMinutes > 60) {
    effortPenalty = 0.08;
  }

  // 8. Staleness Bonus (unanswered for long time)
  let stalenessBonus = 0;
  if (createdAt) {
    const createdDate = new Date(createdAt);
    const ageDays = (now.getTime() - createdDate.getTime()) / (1000 * 3600 * 24);
    if (ageDays > 5) stalenessBonus = 0.1;
    if (ageDays > 14) stalenessBonus = 0.2;
  }

  // Deferral reduction
  let deferralMultiplier = 1.0;
  if (deferredUntil) {
    const defDate = new Date(deferredUntil);
    if (defDate > now) {
      deferralMultiplier = 0.25; // Heavily reduced while deferred
    }
  }

  // Raw combined formula (0 - 1)
  const positiveScore =
    0.25 * strategicPriority +
    0.20 * urgency +
    0.20 * impact +
    0.15 * policyRelevance +
    0.10 * relationshipValue +
    0.10 * readiness;

  const rawScore = (positiveScore - effortPenalty + stalenessBonus) * deferralMultiplier;
  const nbaScore = Math.max(1, Math.min(99, Math.round(rawScore * 100)));

  // Generate explainable reason
  const reasons: string[] = [];
  if (strategicPriority >= 0.8) reasons.push('High priority');
  if (urgency >= 0.8) reasons.push('Approaching deadline');
  if (readiness >= 0.7 && opp.papers.length > 0) reasons.push('Relevant OBESSU paper linked');
  if (stakeholder && stakeholder.relationshipScore >= 85) reasons.push('Strategic stakeholder');
  if (impact >= 0.8) reasons.push('High EU impact opportunity');
  if (estimatedMinutes <= 30) reasons.push('Quick win (≤30m)');

  const reason = reasons.length > 0 ? reasons.join(' • ') : 'Standard scheduled policy workflow';

  return {
    nbaScore,
    reason,
    factors: {
      strategicPriority,
      urgency,
      impact,
      policyRelevance,
      relationshipValue,
      readiness,
      effortPenalty,
      stalenessBonus
    }
  };
}

/**
 * Generates deterministic action items from an opportunity based on its state
 */
export function generateOpportunityActions(
  opp: Opportunity,
  stakeholders: Stakeholder[] = [],
  papers: Paper[] = []
): ActionItem[] {
  const actions: ActionItem[] = [];
  const stakeholder = stakeholders.find(
    (s) => s.canonicalName === opp.outreachEntity || s.aliases?.includes(opp.outreachEntity)
  );

  const now = new Date();
  const actDate = opp.dateOfActivity ? new Date(opp.dateOfActivity) : null;
  const isPast = actDate && actDate < now;
  const isApproaching = actDate && !isPast && (actDate.getTime() - now.getTime()) / (1000 * 3600 * 24) <= 7;

  // Rule 1: Pending response -> Decide whether to attend
  if (opp.replyStatus === 'Pending' && !isPast) {
    const { nbaScore, reason, factors } = calculateActionScore(opp, stakeholder, papers, 15, 'assess_invitation');
    actions.push({
      id: `act-${opp.id}-assess`,
      opportunityId: opp.id,
      title: `Assess invitation: ${opp.title.slice(0, 45)}...`,
      description: `Review invite from ${opp.outreachEntity} for ${opp.dateOfActivity || 'TBD'} and decide participation status.`,
      actionType: 'assess_invitation',
      assignedTo: opp.assignedTo || 'Panagiotis Chatzimichail',
      status: 'todo',
      priority: opp.priority,
      dueAt: opp.dateOfActivity || new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      estimatedMinutes: 15,
      nbaScore,
      reason,
      createdAt: opp.requestDate || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      factors
    });
  }

  // Rule 2: High priority & pending/accepted -> Prepare briefing
  if ((opp.replyStatus === 'Completed' || opp.replyStatus === 'Cooperation' || opp.replyStatus === 'Pending') && !isPast) {
    const { nbaScore, reason, factors } = calculateActionScore(opp, stakeholder, papers, 35, 'prepare_briefing');
    actions.push({
      id: `act-${opp.id}-briefing`,
      opportunityId: opp.id,
      title: `Prepare briefing & talking points: ${opp.outreachEntity}`,
      description: `Synthesize OBESSU policy demands (${opp.papers?.join(', ') || opp.policyArea}) for ${opp.title}.`,
      actionType: 'prepare_briefing',
      assignedTo: opp.assignedTo || 'Panagiotis Chatzimichail',
      status: 'todo',
      priority: opp.priority,
      dueAt: opp.dateOfActivity || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      estimatedMinutes: 35,
      nbaScore: Math.min(99, nbaScore + 5),
      reason,
      createdAt: opp.requestDate || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      factors
    });
  }

  // Rule 3: Event approaching within 7 days -> Confirm logistics
  if (isApproaching && opp.replyStatus !== 'Not going') {
    const { nbaScore, reason, factors } = calculateActionScore(opp, stakeholder, papers, 15, 'confirm_logistics');
    actions.push({
      id: `act-${opp.id}-logistics`,
      opportunityId: opp.id,
      title: `Confirm intervention & logistics: ${opp.venue}`,
      description: `Verify venue access, speaking slot, and materials for ${opp.outreachEntity}.`,
      actionType: 'confirm_logistics',
      assignedTo: opp.assignedTo || 'Panagiotis Chatzimichail',
      status: 'todo',
      priority: 'High',
      dueAt: opp.dateOfActivity,
      estimatedMinutes: 15,
      nbaScore: Math.min(99, nbaScore + 10),
      reason: 'Event in <7 days • Confirm speech slot and room logistics',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      factors
    });
  }

  // Rule 4: Completed activity without outcome -> Record engagement outcome & evidence
  if (opp.replyStatus === 'Completed' && !opp.outcome) {
    const { nbaScore, reason, factors } = calculateActionScore(opp, stakeholder, papers, 20, 'record_outcome');
    actions.push({
      id: `act-${opp.id}-outcome`,
      opportunityId: opp.id,
      title: `Record outcome & evidence: ${opp.outreachEntity}`,
      description: `Log substantive policy impact (consultation submission, statement, or quote) from completed engagement.`,
      actionType: 'record_outcome',
      assignedTo: opp.assignedTo || 'Panagiotis Chatzimichail',
      status: 'todo',
      priority: 'Medium',
      dueAt: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      estimatedMinutes: 20,
      nbaScore: Math.min(98, nbaScore + 8),
      reason: 'Activity finished • Convert attendance into organizational evidence',
      createdAt: opp.dateOfActivity || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      factors
    });
  }

  // Limit to max 3 immediate actions per opportunity
  return actions.slice(0, 3);
}

/**
 * Generates initial action queue across all opportunities in the system
 */
export function generateAllActions(
  opportunities: Opportunity[],
  stakeholders: Stakeholder[] = [],
  papers: Paper[] = []
): ActionItem[] {
  const allActions: ActionItem[] = [];
  const seenIds = new Set<string>();

  for (const opp of opportunities) {
    if (opp.replyStatus === 'Not going') continue;
    const oppActions = generateOpportunityActions(opp, stakeholders, papers);
    for (const act of oppActions) {
      if (!seenIds.has(act.id)) {
        seenIds.add(act.id);
        allActions.push(act);
      }
    }
  }

  // Sort by NBA score descending
  return allActions.sort((a, b) => b.nbaScore - a.nbaScore);
}
