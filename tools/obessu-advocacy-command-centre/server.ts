import express, { NextFunction, Request, Response, Router } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import { generateJSON, generateText, LocalAiUnavailableError } from './server/localAi.ts';
import { webSearch } from './server/webSearch.ts';
import { transcribeAudio } from './server/transcribe.ts';
import { ValidationError, requireString, optionalString, requireObject, optionalArray } from './server/validate.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(helmet({
  // The Vite-served SPA needs inline styles/scripts during dev; CSP is left to
  // the hosting environment for the production build.
  contentSecurityPolicy: false,
}));
app.use(compression());
// Audio debriefs are the largest payloads (base64-encoded); everything else is small.
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// This is a single-user local tool, but a generous rate limit still protects
// against runaway client loops from hammering the local model/CPU.
const aiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Please wait a moment and try again.' },
});

const ai = Router();
app.use('/api/ai', aiLimiter, ai);

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

/**
 * 1. AI-Generated Action Suggestions
 */
ai.post('/generate-actions', asyncHandler(async (req, res) => {
  const opportunity = requireObject(req.body.opportunity, 'opportunity');
  const stakeholder = req.body.stakeholder ? requireObject(req.body.stakeholder, 'stakeholder') : undefined;
  const linkedPapers = optionalArray(req.body.linkedPapers, 'linkedPapers');

  const prompt = `You are a chief-of-staff for OBESSU (Organising Bureau of European School Student Unions) advocacy in Brussels.
Given this upcoming/completed opportunity, generate 2 to 3 concrete, high-leverage advocacy action steps for the policy team.
Keep actions pragmatic, specific to school student rights/VET/education policies, and achievable in <=60 minutes.

Opportunity:
Title: ${opportunity.title}
Outreach Entity: ${opportunity.outreachEntity} (${opportunity.categorySet})
Policy Area: ${opportunity.policyArea}
Priority: ${opportunity.priority}
Date: ${opportunity.dateOfActivity}
Venue: ${opportunity.venue}
Linked OBESSU Papers: ${linkedPapers.map((p: any) => p?.title || p).join(', ')}
Stakeholder Notes: ${stakeholder?.notes || 'N/A'}

Return a JSON array of actionable tasks.`;

  const actions = await generateJSON(prompt, {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Action item title' },
        description: { type: 'string', description: 'Specific details and instructions' },
        actionType: {
          type: 'string',
          description: 'One of: assess_invitation, prepare_briefing, identify_position, confirm_logistics, prepare_talking_points, record_outcome, send_followup, draft_statement',
        },
        estimatedMinutes: { type: 'integer', description: 'Estimated minutes (e.g. 15, 30, 45)' },
        reason: { type: 'string', description: 'Explainable reason why this matters now' },
        priority: { type: 'string', description: 'High, Medium, or Low' },
      },
      required: ['title', 'description', 'actionType', 'estimatedMinutes', 'reason', 'priority'],
    },
  });

  res.json({ success: true, actions });
}));

/**
 * 2. AI-Assisted Briefing & Document Drafter (Project Brief or Policy Brief)
 */
ai.post('/generate-document', asyncHandler(async (req, res) => {
  const documentType = requireString(req.body.documentType, 'documentType', 100);
  const title = optionalString(req.body.title, 300) || '';
  const papers = optionalArray(req.body.papers, 'papers');
  const opportunities = optionalArray(req.body.opportunities, 'opportunities');
  const customInstructions = optionalString(req.body.customInstructions, 4000) || '';
  const tone = optionalString(req.body.tone, 200) || '';
  const targetAudience = optionalString(req.body.targetAudience, 300) || '';

  const papersBlock = papers.length > 0
    ? papers.map((p: any, idx: number) => `Paper ${idx + 1}: ${p.title} (${p.category || 'Policy'})\nSummary: ${p.summary || ''}\nKey Demands: ${p.keyDemands?.join('; ') || 'N/A'}\n`).join('\n')
    : 'No specific papers selected; draw on OBESSU core tenets (school student democracy, mental health, VET rights, inclusive education).';

  const opportunitiesBlock = opportunities.length > 0
    ? opportunities.map((o: any, idx: number) => `Milestone ${idx + 1}: [${o.dateOfActivity}] ${o.title} (Entity: ${o.outreachEntity}, Policy Area: ${o.policyArea}, Priority: ${o.priority})`).join('\n')
    : 'General European advocacy calendar.';

  let prompt: string;

  if (documentType === 'project_brief') {
    prompt = `You are a Senior Project & Policy Director at OBESSU (Organising Bureau of European School Student Unions) in Brussels.
Draft a comprehensive, highly professional OBESSU Project Brief / Grant Concept (e.g. for Erasmus+ Key Action 3/CERV or European Youth Foundation).

Project Title / Working Theme: ${title || 'Empowering School Student Unions across Europe'}
Target Audience: ${targetAudience || 'EU Grant Authorities, Member Unions, Civil Society Partners'}
Tone: ${tone || 'Professional, Visionary, Strategic'}

Selected OBESSU Policy Papers & Evidence Base (${papers.length} papers selected):
${papersBlock}

Linked Advocacy Opportunities & Milestones (${opportunities.length} opportunities selected):
${opportunitiesBlock}

Special Instructions:
${customInstructions || 'Provide full operational depth with realistic EU project structure.'}

Draft the Project Brief structured with the following standard OBESSU Project sections:
# [PROJECT TITLE]
## 1. Executive Summary & Strategic Rationale
- High-level project vision and urgency for European secondary school students.
- Direct alignment with EU education priorities (EEA 2030, EU Youth Strategy).

## 2. Policy Baseline & Synthesis of OBESSU Evidence
- Detailed synthesis of the selected OBESSU policy papers.
- Core political demands translated into project goals.

## 3. Specific Objectives & Work Package (WP) Breakdown
- WP1: Consortium Coordination & Student Union Engagement
- WP2: Research, Evidence Gathering & Peer Consultations
- WP3: Capacity Building, Training & Multiplier Events (linking to Pool of Trainers)
- WP4: European Policy Dialogue & Institutional Advocacy (anchored in the selected opportunities)
- WP5: Communication, Dissemination & Youth Campaigning

## 4. Target Groups, Direct Beneficiaries & Partner Union Roles
- National/local school student unions, secondary school pupils, VET apprentices, marginalized youth.

## 5. Advocacy Milestones & Opportunity Alignment
- Concrete timeline linking project deliverables to the specified EU opportunities.

## 6. Expected Impact, Outputs & Key Performance Indicators (KPIs)
- Quantitative and qualitative success metrics.

Provide a comprehensive, complete, ready-to-use document in clear markdown format.`;
  } else {
    prompt = `You are the Head of Policy & Advocacy at OBESSU (Organising Bureau of European School Student Unions) in Brussels.
Draft a structured, authoritative European Policy Brief addressing European policymakers, MEPs, Commission officials, and civil society partners.

Policy Brief Title: ${title || 'Advancing School Student Rights and Educational Equity in Europe'}
Target Audience: ${targetAudience || 'European Parliament (CULT/EMPL), European Commission (DG EAC/EMPL), Member State Ministries'}
Tone: ${tone || 'Authoritative, Evidence-Based, Constructive & Rights-Focused'}

Selected OBESSU Policy Papers (${papers.length} papers selected):
${papersBlock}

Selected Advocacy Opportunities / Decision Windows (${opportunities.length} opportunities selected):
${opportunitiesBlock}

Special Instructions:
${customInstructions || 'Provide concrete, legislative-ready asks and actionable amendments.'}

Draft the Structured Policy Brief with the following standard sections:
# [POLICY BRIEF TITLE]
## 1. Executive Summary & Key Takeaways
- 3-4 bullet point synthesis of the problem, urgency, and core demand.

## 2. Context & Problem Analysis
- Current structural challenges facing secondary school students and apprentices across Europe.
- Gaps in current EU frameworks or Member State implementation.

## 3. Evidence-Based Demands (Synthesis of OBESSU Positions)
- Rigorous integration of the selected OBESSU Policy Papers.
- School student perspectives, democratic governance in schools, student welfare, and equity.

## 4. Institutional Windows & Strategic Relevance
- Why action is required now in light of the upcoming policy opportunities and EU legislative milestones.

## 5. Concrete Policy Recommendations & Asks
- Specific, actionable recommendations for:
  a) The European Commission (e.g. DG EAC, DG EMPL)
  b) The European Parliament (CULT, EMPL, BUDG Committees)
  c) Council of the European Union & National Education Ministries

## 6. Addressing Potential Counterarguments & Implementation Realities
- Proactive answers to institutional hesitation, subsidiarity questions, or budget constraints.

## 7. Conclusion & OBESSU Call to Action
- Next steps for collaboration and student union involvement.

Provide a complete, rigorously articulated document in clean markdown format.`;
  }

  const document = await generateText(prompt, {
    temperature: 0.7,
    system: "You are OBESSU's leading European Policy Director in Brussels. You produce rigorous, eloquent, highly credible policy and project documents representing European school students.",
  });

  res.json({ success: true, document });
}));

/**
 * Standalone one-page briefing drafter.
 */
ai.post('/draft-briefing', asyncHandler(async (req, res) => {
  const opportunity = requireObject(req.body.opportunity, 'opportunity');
  const stakeholder = req.body.stakeholder ? requireObject(req.body.stakeholder, 'stakeholder') : undefined;
  const papers = optionalArray(req.body.papers, 'papers');
  const instructions = optionalString(req.body.instructions, 2000);

  const prompt = `You are a senior European education policy analyst drafting an official OBESSU (Organising Bureau of European School Student Unions) advocacy briefing.

Event Details:
- Title: ${opportunity.title}
- Stakeholder / Institution: ${opportunity.outreachEntity} (${opportunity.categorySet})
- Policy Focus: ${opportunity.policyArea}
- Date & Location: ${opportunity.dateOfActivity}, ${opportunity.venue}
- Assigned Lead: ${opportunity.assignedTo}

Relevant OBESSU Policy Papers & Key Positions:
${papers.map((p: any) => `* ${p.title}: ${p.summary || ''}\n  Key Demands: ${p.keyDemands?.join('; ') || ''}`).join('\n\n')}

Stakeholder Intelligence:
${stakeholder ? `- Relationship Score: ${stakeholder.relationshipScore}/100\n- Context: ${stakeholder.notes}` : 'No previous history recorded.'}

Additional Instructions: ${instructions || 'Structure a 1-page executive brief with: 1. Executive Summary, 2. Strategic Objectives, 3. Key OBESSU Demands & Talking Points, 4. Anticipated Counterarguments / Nuances, 5. Concrete Actionable Ask for MEP / Commissioner.'}

Draft a polished, professional policy briefing ready for distribution.`;

  const briefing = await generateText(prompt, {
    temperature: 0.7,
    system: "You are OBESSU's leading European Policy Director in Brussels. Your tone is constructive, rights-based, and evidence-grounded.",
  });

  res.json({ success: true, briefing });
}));

/**
 * 3. Transcribe Audio Voice Debrief — local Whisper (transformers.js) for
 * speech-to-text, then the local LLM extracts structured outcomes/actions.
 */
ai.post('/transcribe-audio', asyncHandler(async (req, res) => {
  const audioData = requireString(req.body.audioData, 'audioData', 30_000_000);
  const mimeType = optionalString(req.body.mimeType, 100) || 'audio/webm';
  const opportunityContext = req.body.opportunityContext;

  const cleanBase64 = audioData.includes('base64,') ? audioData.split('base64,')[1] : audioData;
  const { transcription } = await transcribeAudio(cleanBase64, mimeType);

  if (!transcription) {
    res.json({
      success: true,
      data: { transcription: '', summary: 'No speech detected in the recording.', detectedOutcomes: [], nextActions: [] },
    });
    return;
  }

  const prompt = `You are an OBESSU Advocacy debrief analyst.
Below is a transcript of a voice memo recorded by an OBESSU policy officer directly after an advocacy meeting/event.

Transcript:
"""
${transcription}
"""

${opportunityContext ? `Context regarding the event: ${JSON.stringify(opportunityContext)}` : ''}

From this transcript:
1. Write an Executive Summary of what happened.
2. Identify any substantive Policy Outcomes (e.g. position submitted, quote promised, standing seat offered, joint initiative).
3. List the immediate Action Items / Follow-ups required.`;

  const extracted = await generateJSON<{
    summary: string;
    detectedOutcomes: Array<{ type: string; description: string; evidence?: string }>;
    nextActions: Array<{ title: string; assignee?: string; estimatedMinutes?: number }>;
  }>(prompt, {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Short debrief executive summary' },
      detectedOutcomes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Outcome type e.g. Position submitted, Joint statement, Formal citation, Follow-up secured' },
            description: { type: 'string' },
            evidence: { type: 'string' },
          },
          required: ['type', 'description'],
        },
      },
      nextActions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            assignee: { type: 'string' },
            estimatedMinutes: { type: 'integer' },
          },
          required: ['title'],
        },
      },
    },
    required: ['summary', 'detectedOutcomes', 'nextActions'],
  });

  res.json({ success: true, data: { transcription, ...extracted } });
}));

/**
 * 4. High Thinking Strategic Analysis — uses a higher token budget / lower
 * temperature to encourage deeper reasoning from the local model.
 */
ai.post('/high-thinking-strategy', asyncHandler(async (req, res) => {
  const topic = requireString(req.body.topic, 'topic', 2000);
  const specificChallenge = requireString(req.body.specificChallenge, 'specificChallenge', 4000);
  const policyArea = optionalString(req.body.policyArea, 300) || 'General EU Youth & Education Policy';
  const targetStakeholder = optionalString(req.body.targetStakeholder, 300) || 'European Commission / European Parliament';
  const context = optionalString(req.body.context, 6000) || 'N/A';

  const prompt = `You are the chief strategic counsel for European school student unions (OBESSU).
Perform an exhaustive, high-reasoning policy analysis for the following high-stakes EU legislative or advocacy challenge.

Policy Focus: ${policyArea}
Topic: ${topic}
Target Institutional Stakeholder: ${targetStakeholder}
Specific Challenge / Dilemma: ${specificChallenge}

Context:
${context}

Provide:
1. Deep Stakeholder Power & Incentive Analysis (what do EU institutions want vs student union red lines).
2. Recommended Strategic Positioning & Narrative Architecture.
3. Concrete Legislative Amendments / Policy Clauses to table.
4. Negotiation Playbook (Fallback concessions, coalition partners e.g. LLLP, ESN, ESU, and escalation points).
5. Risk Matrix and 12-Month Impact Forecast.`;

  const analysis = await generateText(prompt, { temperature: 0.4 });
  res.json({ success: true, analysis });
}));

/**
 * 5. Live EU Policy Radar — free, keyless DuckDuckGo web search (replaces
 * Gemini's Google Search grounding tool) summarized by the local model.
 */
ai.post('/search-eu-policy', asyncHandler(async (req, res) => {
  const query = requireString(req.body.query, 'query', 500);

  const results = await webSearch(
    `${query} European Union education youth policy Erasmus+ site:europa.eu OR site:europarl.europa.eu OR euractiv.com`,
  );

  const sourcesBlock = results.length > 0
    ? results.map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\nURL: ${r.uri}`).join('\n\n')
    : 'No live web results were found; answer from general knowledge and note the lack of fresh sources.';

  const prompt = `Search results for the query "${query}" regarding European Union education, youth, VET, Erasmus+, or civil society policy developments:

${sourcesBlock}

Summarize the current legislative status, key MEPs or Commission initiatives involved, deadlines for public consultations or amendments, and actionable opportunities for school student advocacy. Cite sources by their [number] where relevant.`;

  const content = await generateText(prompt, { temperature: 0.3 });

  res.json({
    success: true,
    content,
    sources: results.map((r) => ({ uri: r.uri, title: r.title })),
  });
}));

/**
 * 6. Stakeholder Memory & Summary Generator
 */
ai.post('/summarize-stakeholder', asyncHandler(async (req, res) => {
  const stakeholder = requireObject(req.body.stakeholder, 'stakeholder');
  const pastOpportunities = optionalArray(req.body.pastOpportunities, 'pastOpportunities');
  const outcomes = optionalArray(req.body.outcomes, 'outcomes');

  const prompt = `Generate a concise Stakeholder Intelligence Profile for OBESSU advocacy.

Stakeholder: ${stakeholder.name} (${stakeholder.category})
Relationship Score: ${stakeholder.relationshipScore}/100
Notes: ${stakeholder.notes}

Past Engagements (${pastOpportunities.length} total):
${pastOpportunities.slice(0, 8).map((o: any) => `- [${o.dateOfActivity}] ${o.title} (${o.replyStatus})`).join('\n')}

Substantive Outcomes Achieved (${outcomes.length} total):
${outcomes.map((out: any) => `* [${out.type}] ${out.description}`).join('\n') || 'None recorded yet.'}

Provide:
1. Executive Assessment (Are they an ally, institutional target, or funder?)
2. Historical Collaboration Trajectory
3. High-Leverage Opportunities to Advance School Student Rights with them
4. Recommended Approach for Future Invitations.`;

  const summary = await generateText(prompt);
  res.json({ success: true, summary });
}));

/**
 * 7. Suggest Follow-up Correspondence & Outcome Draft
 */
ai.post('/suggest-followup', asyncHandler(async (req, res) => {
  const opportunity = requireObject(req.body.opportunity, 'opportunity');
  const notes = optionalString(req.body.notes, 4000);

  const prompt = `Draft a polite, impactful post-meeting follow-up email and recommended next action for OBESSU.

Event: ${opportunity.title}
Entity: ${opportunity.outreachEntity}
Policy Area: ${opportunity.policyArea}
Notes/Meeting Debrief: ${notes || 'Discussion on student participation and VET quality standards.'}

Return JSON with:
- subject: Email subject line
- body: Formal yet warm email body thanking them, reiterating OBESSU's commitment, linking relevant positions, and proposing next steps.
- followUpActionTitle: A concise task for Google Tasks / internal queue.`;

  const data = await generateJSON(prompt, {
    type: 'object',
    properties: {
      subject: { type: 'string' },
      body: { type: 'string' },
      followUpActionTitle: { type: 'string' },
    },
    required: ['subject', 'body', 'followUpActionTitle'],
  });

  res.json({ success: true, data });
}));

// Centralized error handling: validation errors -> 400, unreachable local
// model -> 503 with setup guidance, everything else -> 500.
app.use('/api/ai', (err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ValidationError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof LocalAiUnavailableError) {
    console.error('Local AI unavailable:', err.message);
    res.status(503).json({ error: err.message });
    return;
  }
  console.error('AI endpoint error:', err);
  res.status(500).json({ error: err?.message || 'Unexpected server error' });
});

// Vite dev server integration in development mode
if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  // Production static file serving
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`OBESSU Advocacy Command Centre (local edition) listening on http://localhost:${PORT}`);
});
