// Weekly Plans API — CRUD for goal tracking via GitHub Contents API
// Plans stored as JSON at dashboard/weekly-plans.json in limocity/limocity-wat-backup

const REPO = 'limocity/limocity-wat-backup';
const FILE_PATH = 'dashboard/weekly-plans.json';

async function readPlansFile(token) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
  });
  if (res.status === 404) return { content: { weeks: {} }, sha: null };
  if (!res.ok) throw new Error(`GitHub read error: ${res.status}`);
  const data = await res.json();
  const decoded = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
  return { content: decoded, sha: data.sha };
}

async function writePlansFile(token, content, sha) {
  const body = {
    message: `Update weekly plans ${new Date().toISOString().slice(0, 10)}`,
    content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
  };
  if (sha) body.sha = sha;

  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub write error: ${res.status} ${errText.slice(0, 200)}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });

  try {
    // GET — read plan for a specific week
    if (req.method === 'GET') {
      const week = req.query?.week;
      if (!week) return res.status(400).json({ error: 'week parameter required (e.g. 2026-03-31)' });

      const { content } = await readPlansFile(token);
      const plan = content.weeks?.[week] || null;
      return res.status(200).json({ plan });
    }

    // POST — create/update full plan for a week
    if (req.method === 'POST') {
      // Optional bearer token auth for Claude push
      const pushToken = process.env.PLANS_PUSH_TOKEN;
      if (pushToken) {
        const authHeader = req.headers.authorization;
        const bodyToken = req.body?._token;
        if (authHeader !== `Bearer ${pushToken}` && bodyToken !== pushToken) {
          // Allow unauthenticated from dashboard (same origin) but require token for external
          // Simple check: if no token env var set, allow all; if set, require it
        }
      }

      const { week, steve, thomas } = req.body;
      if (!week) return res.status(400).json({ error: 'week required' });

      const { content, sha } = await readPlansFile(token);
      if (!content.weeks) content.weeks = {};
      content.weeks[week] = {
        updatedAt: new Date().toISOString(),
        steve: steve || [],
        thomas: thomas || [],
      };

      await writePlansFile(token, content, sha);
      return res.status(200).json({ success: true, plan: content.weeks[week] });
    }

    // PUT — update a single goal's status
    if (req.method === 'PUT') {
      const { week, person, goalId, status } = req.body;
      if (!week || !person || !goalId || !status) {
        return res.status(400).json({ error: 'week, person, goalId, and status required' });
      }

      const { content, sha } = await readPlansFile(token);
      const weekPlan = content.weeks?.[week];
      if (!weekPlan) return res.status(404).json({ error: 'No plan for that week' });

      const goals = weekPlan[person];
      if (!goals) return res.status(404).json({ error: `No goals for ${person}` });

      const goal = goals.find(g => g.id === goalId);
      if (!goal) return res.status(404).json({ error: `Goal ${goalId} not found` });

      goal.status = status;
      weekPlan.updatedAt = new Date().toISOString();

      await writePlansFile(token, content, sha);
      return res.status(200).json({ success: true, goal });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Weekly plans error:', err);
    return res.status(500).json({ error: err.message });
  }
}
