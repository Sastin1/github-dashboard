// --- Initiative Context (strategic picture for each project) ---
const INITIATIVE_CONTEXT = {
  'James': {
    description: 'Post-sale AI agent — reservation fulfillment, vehicle sourcing from affiliates, dispatch coordination, complaint de-escalation (HEARD framework)',
    currentPhase: 'Architecture complete, awaiting Winston launch for dual-agent activation',
    milestones: ['11 tools connected', 'Dual-agent routing built', 'Complaint system with HEARD framework', '33-column complaints table', 'Handoff table for Winston→James'],
    blockers: ['Missing tools: lookup_booking, update_fulfillment_status, contact_affiliate', 'Cannot activate until Winston is live'],
  },
  'Winston Thomas': {
    description: 'Thomas\'s development/test copy of Winston sales agent — n8n workflows, tool sub-workflows, bug fixes, feature testing',
    currentPhase: 'Active development and testing, merges back to SOT when stable',
    milestones: ['20 test rounds completed', '44 bugs found and fixed', 'First clean E2E pass (Round 20)', '10 tools verified working'],
    blockers: [],
  },
  'Winston SOT': {
    description: 'Winston Source of Truth — production master system prompt, persona, coaching rules, governance guardrails',
    currentPhase: 'Production master, receives fixes from Winston Thomas when stable',
    milestones: ['System prompt v2 deployed (8,580 chars)', '6-stage sales state machine', '22 checkpoints passing', 'All Round 1-13 fixes applied'],
    blockers: [],
  },
  'Winston Voice': {
    description: 'ElevenLabs voice agent — inbound call handling, voice routing, phone system integration',
    currentPhase: 'Development, starting with Dallas market',
    milestones: ['ElevenLabs account set up', 'Voice tool router built'],
    blockers: ['Awaiting Winston text agent stability before voice launch'],
  },
  'Quote Engine': {
    description: 'generate_quote algorithm — vehicle selection, pricing, hero hierarchy, occasion logic, pax capacity, affordable mix',
    currentPhase: 'Active iteration and refinement',
    milestones: ['Hero vehicle hierarchy', 'Party bus split logic', 'Prom section', 'Variety enforcement', 'Photo gate'],
    blockers: [],
  },
  'Fleet Manager': {
    description: 'Vehicle inventory — Rating Manager (cost/retail/margin), photos, sedan/limo mapping, fleet data across affiliates',
    currentPhase: 'Active development',
    milestones: ['Rating Manager for cost/retail/margin', 'Vehicle photo management'],
    blockers: [],
  },
  'Website / SEO': {
    description: 'LimoCity WordPress/Divi site — service pages, suburb SEO, schema markup, FAQ deployment, meta optimization across 8 markets',
    currentPhase: 'Ongoing optimization and content deployment',
    milestones: ['JSON-LD schema across markets', 'FAQ content deployed', 'Suburb pages live', 'CTA and hero section optimization'],
    blockers: [],
  },
  'n8n / Automation': {
    description: 'Workflow automation — dual-agent routing, SMS/email monitors, webhook orchestration, tool sub-workflows',
    currentPhase: 'Core infrastructure, continuously extended',
    milestones: ['Email Monitor rebuilt to event-driven', 'SMS Monitor built', 'Dual-agent routing (Winston/James)'],
    blockers: [],
  },
  'Database / Infra': {
    description: 'Supabase/Postgres backend — customer profiles, conversations, memory tables, PostgreSQL triggers',
    currentPhase: 'Active and maintained',
    milestones: ['Cross-channel memory system', '4 memory tables', 'PostgreSQL auto-save trigger', 'Knowledge base with pgvector (76 entries)'],
    blockers: [],
  },
  'Telephony': {
    description: 'Twilio SMS infrastructure + RingCentral phone system across 9 markets',
    currentPhase: 'Phase 1 complete, awaiting 10DLC campaign approval',
    milestones: ['9 Twilio local numbers', '10DLC brand registered', 'SMS workflows migrated from RingCentral'],
    blockers: ['10DLC campaign registration pending (1-3 week wait)'],
  },
  'Forms / CRM': {
    description: 'Gravity Forms lead capture + Zoho CRM integration',
    currentPhase: 'Operational',
    milestones: ['Forms across all markets', 'Zoho deal creation automated'],
    blockers: [],
  },
  'Marketing': {
    description: 'Google Ads, Google Business Profile, analytics and conversion tracking',
    currentPhase: 'Active management',
    milestones: ['Dallas conversion crash identified and fixed', 'GTM triggers verified'],
    blockers: [],
  },
  'Tools / Setup': {
    description: 'Developer tooling, environment config, repo management, eval dashboard',
    currentPhase: 'Maintained as needed',
    milestones: ['Eval dashboard deployed', 'Batch scenario testing working'],
    blockers: [],
  },
  'Docs / Admin': {
    description: 'Internal documentation, session logs, system maps, architecture viz',
    currentPhase: 'Maintained',
    milestones: ['Architecture visualization deployed', 'System documentation current'],
    blockers: [],
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ initiatives: [], topPriority: null });
  }

  try {
    const { projects, dateRange } = req.body;
    if (!projects || !Array.isArray(projects) || projects.length === 0) {
      return res.status(200).json({ initiatives: [], topPriority: null });
    }

    // Build context for each project
    const projectBlocks = projects.map(p => {
      const ctx = INITIATIVE_CONTEXT[p.name] || { description: 'General work', currentPhase: 'Unknown', milestones: [], blockers: [] };
      return `### ${p.name}
- Description: ${ctx.description}
- Current phase: ${ctx.currentPhase}
- Known milestones achieved: ${ctx.milestones.join('; ') || 'None documented'}
- Known blockers: ${ctx.blockers.join('; ') || 'None'}
- Recent activity (${p.dateRange}): ${p.commitCount} commits, ${p.activeDays} active days, ${p.totalLines} lines changed
- Contributors: ${p.contributors.join(', ')}
- Recent commit messages:
${p.commits.slice(0, 8).map(m => `  - ${m}`).join('\n')}`;
    }).join('\n\n');

    const prompt = `You are a strategic advisor analyzing GitHub activity for the CEO of LimoCity, a limo/transportation company building an AI-powered platform. The company is pre-launch — building AI sales agents (Winston), fulfillment agents (James), and supporting infrastructure.

Your job: assess each initiative's launch readiness and provide actionable intelligence.

## Initiative Data

${projectBlocks}

## Instructions

For EACH initiative above, return:
- "name": exact project name
- "readiness": 0-100 (how close to launch/completion, based on milestones achieved vs what's still needed)
- "status": one of "on-track", "at-risk", "blocked", "complete", "maintenance"
- "headline": one sentence summary of current state (max 15 words, plain language for a CEO)
- "recentWins": array of 1-3 concrete accomplishments from the commit activity (past tense verbs)
- "nextSteps": array of 1-3 logical next actions (imperative verbs)
- "risks": array of 0-2 risks or concerns (empty if none)
- "momentum": "accelerating" | "steady" | "slowing" | "stalled" (based on commit frequency and recency)
- "owner": "steve" | "thomas" | "both" (based on who's contributing)

Also return:
- "topPriority": name of the single most important initiative to focus on right now
- "topPriorityReason": one sentence explaining why (max 20 words)

Rules:
- Write for a non-technical CEO — no jargon, no file names, no technical terms
- Be honest about blockers and risks — sugar-coating helps nobody
- Readiness should reflect real launch readiness, not just activity level
- If an initiative has 1-2 commits and looks like maintenance, readiness can be high but status should be "maintenance"
- Skip initiatives with the name "Other" — don't include them in output

Return ONLY valid JSON:
{
  "topPriority": "...",
  "topPriorityReason": "...",
  "initiatives": [
    { "name": "...", "readiness": 75, "status": "on-track", "headline": "...", "recentWins": [...], "nextSteps": [...], "risks": [...], "momentum": "steady", "owner": "both" },
    ...
  ]
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      return res.status(200).json({ initiatives: [], topPriority: null });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Could not parse JSON from Claude response:', text);
      return res.status(200).json({ initiatives: [], topPriority: null });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json({
      initiatives: parsed.initiatives || [],
      topPriority: parsed.topPriority || null,
      topPriorityReason: parsed.topPriorityReason || null,
    });

  } catch (err) {
    console.error('Command center error:', err);
    return res.status(200).json({ initiatives: [], topPriority: null });
  }
}
