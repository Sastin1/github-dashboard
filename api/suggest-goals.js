// AI Goal Suggestions — generates next-week goals based on current progress

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(200).json({ suggestions: {} });

  try {
    const { currentGoals, commandCenter, recentCommits } = req.body;

    // Build context from current week's goals
    const goalsBlock = ['steve', 'thomas'].map(person => {
      const goals = currentGoals?.[person] || [];
      if (goals.length === 0) return `${person === 'steve' ? 'Steve' : 'Thomas'}: No goals set this week.`;
      const goalLines = goals.map(g => `  - [${g.status}] ${g.text} (${g.project})`).join('\n');
      return `${person === 'steve' ? 'Steve' : 'Thomas'}:\n${goalLines}`;
    }).join('\n\n');

    // Build context from command center initiatives
    const ccBlock = (commandCenter || []).map(init =>
      `- ${init.name} (${init.status}, ${init.readiness}% ready): ${init.headline || ''}\n  Next: ${(init.nextSteps || []).slice(0, 2).join('; ')}`
    ).join('\n');

    // Build context from recent commits
    const commitsBlock = (recentCommits || []).slice(0, 20).map(c =>
      `- [${c.person}] ${c.message} (${c.project})`
    ).join('\n');

    const prompt = `You are a planning assistant for LimoCity, a limo/transportation company with a 2-person team (Steve = owner/manager/engineer, Thomas = AI agent developer).

Based on this week's goals, initiative status, and recent work, suggest 3-5 focused goals for NEXT week for each person.

THIS WEEK'S GOALS:
${goalsBlock}

INITIATIVE STATUS:
${ccBlock || 'No initiative data available.'}

RECENT COMMITS:
${commitsBlock || 'No recent commit data.'}

Rules:
- Each goal should be specific and completable in 1 week
- Carry forward any unfinished goals that are still relevant (mark with "[carry-forward]")
- Suggest goals that advance the most important initiatives
- Write in plain language, not developer jargon
- Include a project tag for each goal (e.g., "Website / SEO", "James", "Winston SOT", etc.)
- Prioritize goals that unblock other work or have the highest business impact

Return ONLY valid JSON:
{
  "steve": [{ "text": "...", "project": "..." }, ...],
  "thomas": [{ "text": "...", "project": "..." }, ...],
  "rationale": "Brief 1-2 sentence explanation of priorities"
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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('Anthropic API error:', response.status);
      return res.status(200).json({ suggestions: {} });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(200).json({ suggestions: {} });

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ suggestions: parsed });

  } catch (err) {
    console.error('Suggest goals error:', err);
    return res.status(200).json({ suggestions: {} });
  }
}
