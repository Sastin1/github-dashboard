export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ summaries: {} });
  }

  try {
    const { clusters } = req.body;
    if (!clusters || !Array.isArray(clusters) || clusters.length === 0) {
      return res.status(200).json({ summaries: {} });
    }

    // Build the prompt with cluster data
    const clusterText = clusters.map((cl, i) => {
      const commitList = cl.commits.slice(0, 15).map(m => `  - ${m}`).join('\n');
      return `[${i}] ${cl.person} - ${cl.project} (${cl.commits.length} commits, ${cl.activeDays} active days, ${cl.totalLines} lines changed):\n${commitList}`;
    }).join('\n\n');

    const prompt = `You are summarizing GitHub commit activity for a non-technical manager at a limo/transportation company called LimoCity.

For each project cluster below, write exactly 1-2 sentences explaining:
1. What the person was trying to accomplish
2. Whether it appears to be complete, in progress, or needs more work
3. Naturally weave in the scope/effort (e.g., "substantial multi-day build" or "quick one-off fix")

Use plain, specific language. No developer jargon. No bullet points. No markdown.
Each summary should feel like a verbal status update in a team standup.

Example good summary: "Built and deployed the ops dashboard with live data feeds — a substantial effort across several working sessions. Work appears complete with monitoring in place."

Example bad summary: "Execute wave 2 ops dashboard real data form outbound."

Return ONLY valid JSON with no other text: { "summaries": { "0": "summary text", "1": "summary text", ... } }
Keys are the cluster index as a string. One summary per cluster.

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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      return res.status(200).json({ summaries: {} });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Could not parse JSON from Claude response:', text);
      return res.status(200).json({ summaries: {} });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ summaries: parsed.summaries || {} });

  } catch (err) {
    console.error('Summarize error:', err);
    return res.status(200).json({ summaries: {} });
  }
}
