const PEOPLE = [
  {
    key: 'steve',
    displayName: 'Steve Astin',
    repos: [
      { owner: 'Sastin1', repo: 'limocity-wat-backup' },
      { owner: 'Sastin1', repo: 'github-dashboard' },
      { owner: 'Sastin1', repo: 'pay-limocity' },
    ],
  },
  {
    key: 'thomas',
    displayName: 'Thomas Clark',
    repos: [
      { owner: 'thomaslc214', repo: 'pay-limocity' },
      { owner: 'thomaslc214', repo: 'winston-ai-limo-assistant' },
    ],
  },
];

// --- Categorization ---

function categorizeCommit(message) {
  const msg = message.toLowerCase();
  const first = message.split('\n')[0].toLowerCase();

  if (/bug\s*\d+|hotfix/.test(msg)) return 'bugfix';
  if (/^fix[\s:]/.test(first) || /fix\s+bug/.test(msg)) return 'bugfix';
  if (/e2e|test suite|verification (test|check)/.test(msg)) return 'test';
  if (/^deploy|deployed to|execute wave/.test(first)) return 'deploy';
  // Recognize deployment-scale work: project completion, wave execution, bulk operations
  if (/project complete|wave \d|\/\d+\s*(markets?|done)|across \d+ markets|\d+\s*(pages?|sites?|listings?)\s*(with|across|deployed|complete|built|created|updated)/.test(msg)) return 'deploy';
  if (/\d{2,}\s*(suburb|service|location)\s*pages?\b/.test(msg)) return 'deploy';
  if (/citation|directory.*(submission|wave)|fb \d+\/\d+|bing.*done/.test(msg)) return 'deploy';
  if (/backup|migration\s*\d|repo cleanup|gitignore/.test(msg)) return 'infra';
  if (/doc sweep|session log|worklog|briefing|update docs|session \d{4}/.test(msg)) return 'docs';
  if (/design doc|proposal|strategy|audit report|architecture/.test(msg)) return 'design';
  if (/rewrite|redesign|rename|convert|rebuild|switch.*from.*to|cleanup/.test(msg)) return 'refactor';
  if (/^(add|build|create|wire|implement)\b/.test(first)) return 'feature';
  if (/n8n|workflow|google ads|gbp|crm|zoho/.test(msg)) return 'ops';
  return 'other';
}

function getProject(message) {
  const msg = message.toLowerCase();
  // Order matters — more specific matches first
  // Fleet Manager & Quote Engine before James/Winston (they'd otherwise fall to Other)
  if (/fleet.manager|rating.manager|vehicle.*(inventory|photo)|photo.status|sedan.*limo|cost.*retail.*margin/.test(msg)) return 'Fleet Manager';
  if (/generate.quote|quote.algorithm|quote.*v\d|selection.logic|pax.*(floor|fallback)|hero.*hierarchy|photo.gate|variety.enforcement|affordable.mix|party.bus.split|prom.*section|vehicle.*color.*feature/.test(msg)) return 'Quote Engine';
  if (/james|handoff|fulfillment|checkout|reservation|payment.?link|pay-limocity/.test(msg)) return 'James';
  if (/elevenlabs|voice.*(agent|tool|router|prompt|tracking|call)|voice_calls|post.call.handler/.test(msg)) return 'Winston Voice';
  if (/winston.*(sot|source of truth|system prompt|persona|coaching|instruction|guardrail|governance)/.test(msg)) return 'Winston SOT';
  if (/winston|bug\s*\d+|e2e test|verification.*checklist|round\s*\d+/.test(msg)) return 'Winston Thomas';
  if (/seo|json.ld|schema.*page|\bfaq\b|suburb|meta.title|breadcrumb|divi|wordpress|wp_|wpcode|yoast|page.*builder|wp.rocket|\bcta\b|hero.*section/.test(msg)) return 'Website / SEO';
  // Specific infra/telephony patterns before n8n (which catches generic "workflow"/"trigger")
  if (/twilio|10dlc/.test(msg)) return 'Telephony';
  if (/cross.channel.memory|knowledge.base|pgvector/.test(msg)) return 'Database / Infra';
  if (/n8n|workflow|trigger|webhook|polling|orchestrat|execution/.test(msg)) return 'n8n / Automation';
  if (/supabase|database|migration\s*\d|sql|table|postgres/.test(msg)) return 'Database / Infra';
  if (/\bforms?\b|gravity|lead|zoho|crm|funnel/.test(msg)) return 'Forms / CRM';
  if (/phone|ringcentral|\bsms\b|voice route|inbound|outbound call/.test(msg)) return 'Telephony';
  if (/doc sweep|session log|worklog|briefing|update docs|session \d{4}|system map|cleanup|stale|design doc|onboarding.*guide|architecture.*vis/.test(msg)) return 'Docs / Admin';
  if (/google ads|bidding|cpc|ppc|gbp|analytics|ga4|conversion.*crash|tracking.*broke/.test(msg)) return 'Marketing';
  if (/skill|memory|backup|repo cleanup|gitignore|\.env|eval.dashboard|training.module|dashboard|weekly.hub|vercel/.test(msg)) return 'Tools / Setup';
  return 'Other';
}

// --- Impact Scoring ---

const BASE_SCORES = {
  feature: 8, deploy: 7, bugfix: 6, refactor: 5, ops: 5,
  design: 4, test: 4, infra: 3, docs: 2, other: 3,
};

function sizeMultiplier(additions, deletions) {
  const net = additions + deletions;
  if (net === 0) return 0.5;
  if (net <= 10) return 0.8;
  if (net <= 50) return 1.0;
  if (net <= 200) return 1.2;
  if (net <= 500) return 1.3;
  return 1.4;
}

function deploymentScaleMultiplier(message) {
  const msg = message.toLowerCase();
  // Detect numeric scale indicators: "409 pages", "35 suburb pages", "64 pages", "9/9 markets"
  const pageMatch = msg.match(/(\d+)\s*(suburb\s*)?pages?\b/);
  const marketMatch = msg.match(/(\d+)\s*markets?\b/) || msg.match(/(\d+)\/\d+\s*markets?\b/);
  const allMatch = msg.match(/\b(all|every|complete|full)\s+\d+\b/) || msg.match(/\d+\s*(suburb|service|location)\s*pages?\b/);
  const bulkKeywords = /across \d+ markets|wave \d|9\/9|complete[d]?:/i.test(msg);

  let scale = 1.0;
  if (pageMatch) {
    const count = parseInt(pageMatch[1]);
    if (count >= 100) scale = Math.max(scale, 2.0);
    else if (count >= 30) scale = Math.max(scale, 1.6);
    else if (count >= 10) scale = Math.max(scale, 1.3);
  }
  if (marketMatch) {
    const count = parseInt(marketMatch[1]);
    if (count >= 5) scale = Math.max(scale, 1.5);
    else if (count >= 3) scale = Math.max(scale, 1.3);
  }
  if (bulkKeywords) scale = Math.max(scale, 1.3);
  if (allMatch) scale = Math.max(scale, 1.2);

  return scale;
}

function scoreCommit(commit) {
  const base = BASE_SCORES[commit.category] || 3;
  const size = sizeMultiplier(commit.additions, commit.deletions);
  const deployScale = deploymentScaleMultiplier(commit.message || commit.fullMessage || '');
  const raw = base * size * deployScale;
  return Math.round(Math.min(raw, 10) * 10) / 10;
}

// --- Synergy Detection ---

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
  'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'must',
  'that', 'this', 'these', 'those', 'it', 'its', 'my', 'your', 'his', 'her', 'our',
  'their', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'not', 'only', 'same', 'so', 'than', 'too', 'very', 'just', 'also',
  'now', 'new', 'from', 'by', 'up', 'about', 'into', 'through', 'after', 'before',
  'add', 'update', 'fix', 'set', 'get', 'use', 'make', 'run', 'move', 'change',
  'co-authored-by', 'claude', 'opus', 'noreply', 'anthropic', 'com', 'session',
]);

function extractKeywords(commits) {
  const keywords = new Map();
  for (const c of commits) {
    const firstLine = c.message.split('\n')[0].toLowerCase();
    const words = firstLine.replace(/[^a-z0-9-]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
    for (const w of words) {
      keywords.set(w, (keywords.get(w) || 0) + 1);
    }
  }
  return keywords;
}

function getWeekKey(dateStr) {
  const d = new Date(dateStr);
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return start.toISOString().slice(0, 10);
}

function detectSynergies(steveCommits, thomasCommits) {
  const steveByWeek = {};
  const thomasByWeek = {};
  for (const c of steveCommits) {
    const wk = getWeekKey(c.committedDate);
    (steveByWeek[wk] = steveByWeek[wk] || []).push(c);
  }
  for (const c of thomasCommits) {
    const wk = getWeekKey(c.committedDate);
    (thomasByWeek[wk] = thomasByWeek[wk] || []).push(c);
  }

  const allWeeks = [...new Set([...Object.keys(steveByWeek), ...Object.keys(thomasByWeek)])].sort();
  const synergies = [];

  for (const week of allWeeks) {
    const sc = steveByWeek[week] || [];
    const tc = thomasByWeek[week] || [];
    if (sc.length === 0 || tc.length === 0) continue;

    const sk = extractKeywords(sc);
    const tk = extractKeywords(tc);
    const shared = [];
    for (const [word] of sk) {
      if (tk.has(word)) shared.push(word);
    }

    if (shared.length > 0) {
      const significant = shared.filter(w => !['file', 'files', 'page', 'pages', 'data', 'config'].includes(w));
      if (significant.length > 0) {
        synergies.push({
          week,
          keywords: significant.slice(0, 8),
          steveCommitCount: sc.length,
          thomasCommitCount: tc.length,
        });
      }
    }
  }

  return synergies;
}

// --- GitHub GraphQL ---

async function fetchAllCommits(token, owner, repo) {
  const allNodes = [];
  let cursor = null;
  let hasNext = true;

  while (hasNext) {
    const afterClause = cursor ? `, after: "${cursor}"` : '';
    const query = `{
      repository(owner: "${owner}", name: "${repo}") {
        defaultBranchRef {
          target {
            ... on Commit {
              history(first: 100${afterClause}) {
                nodes {
                  oid
                  message
                  committedDate
                  additions
                  deletions
                  changedFilesIfAvailable
                  author { name user { login } }
                }
                pageInfo { hasNextPage endCursor }
                totalCount
              }
            }
          }
        }
      }
    }`;

    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'github-dashboard',
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API error ${res.status}: ${text}`);
    }

    const json = await res.json();
    if (json.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
    }

    const history = json.data.repository.defaultBranchRef.target.history;
    allNodes.push(...history.nodes);
    hasNext = history.pageInfo.hasNextPage;
    cursor = history.pageInfo.endCursor;
  }

  return allNodes;
}

function enrichCommits(nodes) {
  return nodes.map(n => {
    const category = categorizeCommit(n.message);
    const commit = {
      sha: n.oid.slice(0, 7),
      message: n.message.split('\n')[0],
      fullMessage: n.message,
      committedDate: n.committedDate,
      additions: n.additions,
      deletions: n.deletions,
      filesChanged: n.changedFilesIfAvailable || 0,
      authorName: n.author.name,
      authorLogin: n.author.user?.login || null,
      category,
      project: getProject(n.message.split('\n')[0]),
    };
    commit.impactScore = scoreCommit(commit);
    return commit;
  });
}

// --- WordPress Metrics ---

const WP_BASE = 'https://limocity.com/wp-json/wp/v2';
const WP_HEADERS = { 'User-Agent': 'github-dashboard' };

async function wpCount(endpoint, extraParams = '') {
  try {
    const url = `${WP_BASE}/${endpoint}?per_page=1&status=publish${extraParams}`;
    const res = await fetch(url, { headers: WP_HEADERS });
    if (!res.ok) return 0;
    return parseInt(res.headers.get('X-WP-Total') || '0', 10);
  } catch {
    return 0;
  }
}

async function fetchWPMetrics() {
  const now = new Date();
  const daysAgo = (n) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d.toISOString().split('.')[0];
  };

  const [totalPages, modifiedLast7d, modifiedLast14d, modifiedLast30d, totalPosts, suburbPages] = await Promise.all([
    wpCount('pages'),
    wpCount('pages', `&modified_after=${daysAgo(7)}`),
    wpCount('pages', `&modified_after=${daysAgo(14)}`),
    wpCount('pages', `&modified_after=${daysAgo(30)}`),
    wpCount('posts'),
    wpCount('pages', '&search=limo+service'),
  ]);

  return {
    totalPages,
    totalPosts,
    suburbPages,
    modifiedLast7d,
    modifiedLast14d,
    modifiedLast30d,
    fetchedAt: now.toISOString(),
  };
}

// --- Handler ---

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });
  }

  try {
    // Fetch WordPress metrics in parallel with GitHub data
    const wpMetricsPromise = fetchWPMetrics();
    const results = {};

    for (const person of PEOPLE) {
      // Fetch all repos for this person in parallel
      const repoResults = await Promise.all(
        person.repos.map(r => fetchAllCommits(token, r.owner, r.repo).then(nodes => ({ nodes, repo: r })))
      );

      // Merge and deduplicate commits by SHA
      const seen = new Set();
      const allNodes = [];
      for (const { nodes, repo } of repoResults) {
        for (const n of nodes) {
          if (!seen.has(n.oid)) {
            seen.add(n.oid);
            n._sourceRepo = `${repo.owner}/${repo.repo}`;
            allNodes.push(n);
          }
        }
      }

      // Sort by date descending
      allNodes.sort((a, b) => new Date(b.committedDate) - new Date(a.committedDate));

      const commits = enrichCommits(allNodes);
      const totalAdditions = commits.reduce((s, c) => s + c.additions, 0);
      const totalDeletions = commits.reduce((s, c) => s + c.deletions, 0);
      const avgImpact = commits.length > 0
        ? Math.round((commits.reduce((s, c) => s + c.impactScore, 0) / commits.length) * 10) / 10
        : 0;

      results[person.key] = {
        repos: person.repos.map(r => `${r.owner}/${r.repo}`),
        displayName: person.displayName,
        totalCommits: commits.length,
        totalAdditions,
        totalDeletions,
        avgImpactScore: avgImpact,
        commits,
      };
    }

    const synergies = detectSynergies(
      results.steve.commits,
      results.thomas.commits
    );

    const wpMetrics = await wpMetricsPromise;

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      ...results,
      synergies,
      wpMetrics,
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    return res.status(500).json({ error: err.message });
  }
}
