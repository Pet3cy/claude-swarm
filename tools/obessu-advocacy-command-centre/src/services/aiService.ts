import { Opportunity, Paper, Stakeholder } from '../types/advocacy';

export const aiService = {
  async generateActions(opportunity: Opportunity, stakeholder?: Stakeholder, linkedPapers?: Paper[]) {
    const res = await fetch('/api/ai/generate-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunity, stakeholder, linkedPapers }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to generate actions');
    }
    return await res.json();
  },

  async generateDocument(params: {
    documentType: 'project_brief' | 'policy_brief';
    title: string;
    papers: Paper[];
    opportunities: Opportunity[];
    customInstructions?: string;
    tone?: string;
    targetAudience?: string;
  }) {
    const res = await fetch('/api/ai/generate-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to generate document');
    }
    return await res.json();
  },

  async draftBriefing(
    opportunity: Opportunity,
    stakeholder?: Stakeholder,
    papers?: Paper[],
    instructions?: string
  ) {
    const res = await fetch('/api/ai/draft-briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunity, stakeholder, papers, instructions }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to draft policy briefing');
    }
    return await res.json();
  },

  async transcribeAudio(audioData: string, mimeType = 'audio/webm', opportunityContext?: any) {
    const res = await fetch('/api/ai/transcribe-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioData, mimeType, opportunityContext }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to transcribe audio voice memo');
    }
    return await res.json();
  },

  async highThinkingStrategy(params: {
    topic: string;
    policyArea: string;
    context?: string;
    targetStakeholder?: string;
    specificChallenge: string;
  }) {
    const res = await fetch('/api/ai/high-thinking-strategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'High thinking analysis failed');
    }
    return await res.json();
  },

  async searchEUPolicy(query: string) {
    const res = await fetch('/api/ai/search-eu-policy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'EU policy search failed');
    }
    return await res.json();
  },

  async summarizeStakeholder(stakeholder: Stakeholder, pastOpportunities: Opportunity[], outcomes: any[]) {
    const res = await fetch('/api/ai/summarize-stakeholder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stakeholder, pastOpportunities, outcomes }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to summarize stakeholder');
    }
    return await res.json();
  },

  async suggestFollowup(opportunity: Opportunity, notes?: string) {
    const res = await fetch('/api/ai/suggest-followup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunity, notes }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to suggest follow-up');
    }
    return await res.json();
  },

  async compareStakeholders(stakeholderA: Stakeholder, stakeholderB: Stakeholder) {
    const res = await fetch('/api/ai/high-thinking-strategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: `Comparative Strategic Synthesis: ${stakeholderA.name} vs ${stakeholderB.name}`,
        policyArea: 'European Institutional Governance & Coalition Alignment',
        targetStakeholder: `${stakeholderA.name} & ${stakeholderB.name}`,
        specificChallenge: `Assess relative power differential (Entity A ${stakeholderA.influenceScore ?? 80}% influence vs Entity B ${stakeholderB.influenceScore ?? 80}% influence), coalition synergies, policy divergence on European education & youth rights, and optimal OBESSU bilateral approach.`,
        context: `Entity A: ${stakeholderA.name} (${stakeholderA.category}, Region: ${stakeholderA.region || 'Brussels Core'}). Notes: ${stakeholderA.notes}\n\nEntity B: ${stakeholderB.name} (${stakeholderB.category}, Region: ${stakeholderB.region || 'Brussels Core'}). Notes: ${stakeholderB.notes}`,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to compare stakeholders');
    }
    const data = await res.json();
    return data.analysis;
  },
};
