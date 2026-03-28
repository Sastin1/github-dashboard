// --- Project Context (from LimoCity strategy docs) ---
const PROJECT_CONTEXT = {
  'James': {
    description: 'Post-sale AI agent handling reservation fulfillment — finding the right vehicle from affiliates, dispatch coordination, booking confirmations, changes, and complaint de-escalation (HEARD framework)',
    benefit: 'Automates the entire post-sale pipeline so customers get confirmed vehicles without manual staff coordination',
  },
  'Winston Thomas': {
    description: 'Thomas\'s test/development copy of the Winston sales agent — n8n workflows, tool sub-workflows, bug fixes, feature testing. Gets merged back into the SOT when stable.',
    benefit: 'Lets Thomas develop and test changes to Winston without risking the live production agent',
  },
  'Winston SOT': {
    description: 'Winston Source of Truth — the master system prompts, persona instructions, coaching rules, governance guardrails, and behavioral guidelines. This is the production version.',
    benefit: 'Controls Winston\'s personality, accuracy, and compliance — the instructions that make the agent reliable',
  },
  'Winston Voice': {
    description: 'ElevenLabs voice agent integration — inbound call handling, voice routing, speech-to-text/text-to-speech, phone system connection. Steve\'s work.',
    benefit: 'Lets customers talk to Winston by phone, starting with Dallas market',
  },
  'Quote Engine': {
    description: 'The generate_quote algorithm that selects the right vehicles and calculates pricing — hero vehicle hierarchy, occasion-based logic, pax capacity, affordable mix, variety enforcement',
    benefit: 'Ensures every customer gets accurate, optimized vehicle quotes instantly across all markets',
  },
  'Fleet Manager': {
    description: 'Vehicle inventory management — Rating Manager for cost/retail/margin, vehicle photos, sedan/limo mapping, fleet data across affiliates',
    benefit: 'Keeps vehicle inventory accurate so quotes and fulfillment always have the right vehicles available',
  },
  'Website / SEO': {
    description: 'LimoCity marketing website (WordPress/Divi) — service pages, suburb SEO pages, schema markup, FAQ deployment, meta optimization across 8 markets',
    benefit: 'Drives organic search traffic and converts visitors to bookings with zero ad spend',
  },
  'n8n / Automation': {
    description: 'Workflow automation connecting all systems — dual-agent routing (Winston/James), SMS/email monitors, webhook orchestration, tool sub-workflows',
    benefit: 'Keeps all business systems synchronized and routes customers to the right agent automatically',
  },
  'Database / Infra': {
    description: 'Supabase/Postgres backend — customer profiles, conversations, memory tables, PostgreSQL triggers for automatic memory capture',
    benefit: 'Reliable data foundation that both AI agents and all business systems depend on',
  },
  'Forms / CRM': {
    description: 'Gravity Forms lead capture on website + Zoho CRM integration for lead management',
    benefit: 'Captures leads from all markets and routes them into the sales pipeline automatically',
  },
  'Telephony': {
    description: 'RingCentral phone system across 9 market numbers + ElevenLabs voice agent integration',
    benefit: 'Every customer call reaches the right person or AI agent, no missed opportunities',
  },
  'Docs / Admin': {
    description: 'Internal documentation, session logs, system maps, briefing documents',
    benefit: 'Keeps the team aligned and preserves institutional knowledge',
  },
  'Marketing': {
    description: 'Google Ads campaigns, Google Business Profile optimization, analytics and tracking',
    benefit: 'Drives paid traffic and local search visibility for bookings',
  },
  'Tools / Setup': {
    description: 'Developer tooling, environment configuration, repository management, deployment scripts',
    benefit: 'Keeps the development environment productive and organized',
  },
  'Other': {
    description: 'Miscellaneous tasks',
    benefit: 'General maintenance and operational work',
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const debug = req.query?.debug === '1';
  if (!apiKey) {
    return res.status(200).json({ cards: {}, ...(debug && { _debug: 'no api key' }) });
  }

  try {
    const { clusters } = req.body;
    if (!clusters || !Array.isArray(clusters) || clusters.length === 0) {
      return res.status(200).json({ cards: {} });
    }

    // Build project context block (only include projects in the clusters)
    const relevantProjects = [...new Set(clusters.map(cl => cl.project))];
    const projectContextBlock = relevantProjects.map(proj => {
      const ctx = PROJECT_CONTEXT[proj];
      return ctx
        ? `- ${proj}: ${ctx.description}. Business value: ${ctx.benefit}.`
        : `- ${proj}: General work.`;
    }).join('\n');

    // Build cluster data
    const clusterText = clusters.map((cl, i) => {
      const commitList = cl.commits.slice(0, 10).map(m => `  - ${m}`).join('\n');
      const priorList = (cl.priorCommits && cl.priorCommits.length > 0)
        ? `\n  Prior work on this project (outside current period):\n${cl.priorCommits.slice(0, 5).map(m => `  - ${m}`).join('\n')}`
        : '';
      return `[${i}] ${cl.person} - ${cl.project} (${cl.commits.length} commits, ${cl.activeDays} active days, ${cl.totalLines} lines changed):\n${commitList}${priorList}`;
    }).join('\n\n');

    const prompt = `You are analyzing GitHub commit activity for a non-technical manager at LimoCity, a limo/transportation company.

PROJECT CONTEXT (what each project is and why it matters):
${projectContextBlock}

For each commit cluster below, return a structured status card:

1. "goal" — One sentence: what this specific work is building toward. Use the project context to understand the bigger picture, but be specific to what the commits actually show. Don't just repeat the project description — focus on what this particular batch of work is trying to achieve.

2. "done" — Array of 2-5 accomplishments completed THIS period (from the main commit list). Each item: short phrase starting with a past-tense verb (e.g., "Built...", "Fixed...", "Set up..."). Collapse similar commits into one item. Plain language — no developer jargon, no file names, no technical terms.

3. "donePrior" — Array of 0-3 accomplishments completed BEFORE this period (from "Prior work" commits, if any). Same format as "done". Empty array [] if no prior work is listed. These represent previously completed milestones.

4. "remaining" — Array of 0-3 items that likely still need to happen based on the commits and project context. Empty array [] if work appears complete. Be conservative — only list what you can reasonably infer.

Rules:
- Write for a business manager, not a developer
- "done" items should be concrete and specific, not vague
- "donePrior" items should summarize what was accomplished before the current period — only include if prior work commits are provided
- "remaining" items should be logical next steps, not wild speculation
- For small clusters (1-2 commits, quick fixes), keep it proportional — short goal, 1-2 done items, likely empty remaining
- The goal should explain WHY this work matters, not just WHAT was done

Return ONLY valid JSON with no other text:
{ "cards": { "0": { "goal": "...", "done": ["...", "..."], "donePrior": ["..."], "remaining": ["..."] }, "1": { ... } } }
Keys are the cluster index as strings.

---
${clusterText}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      return res.status(200).json({ cards: {}, ...(debug && { _debug: `API ${response.status}: ${errText.slice(0, 200)}` }) });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Could not parse JSON from Claude response:', text);
      return res.status(200).json({ cards: {} });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ cards: parsed.cards || {} });

  } catch (err) {
    console.error('Summarize error:', err);
    return res.status(200).json({ cards: {}, ...(debug && { _debug: `catch: ${err.message}` }) });
  }
}
