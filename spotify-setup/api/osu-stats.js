/*
  === OSU!MANIA STATS VERCEL FUNCTION ===

  Fetches public osu!mania profile data using osu! API v2.
  No user login needed — uses client credentials for public data.

  ENV VARS (add these in Vercel dashboard):
  - OSU_CLIENT_ID
  - OSU_CLIENT_SECRET
  - OSU_USERNAME  (your osu! username or user ID)
*/

// Get an access token using client credentials (no user auth needed)
async function getOsuToken() {
  const res = await fetch('https://osu.ppy.sh/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: Number(process.env.OSU_CLIENT_ID),
      client_secret: process.env.OSU_CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: 'public',
    }),
  });
  const data = await res.json();
  return data.access_token;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=300'); // cache for 5 mins

  try {
    const token = await getOsuToken();
    const username = process.env.OSU_USERNAME;

    // Fetch user profile (mode=mania)
    const userRes = await fetch(
      `https://osu.ppy.sh/api/v2/users/${encodeURIComponent(username)}/mania`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (!userRes.ok) {
      return res.status(200).json({ error: 'user not found' });
    }

    const user = await userRes.json();
    const stats = user.statistics;

    // Fetch top plays (best performance, limit 5)
    const scoresRes = await fetch(
      `https://osu.ppy.sh/api/v2/users/${user.id}/scores/best?mode=mania&limit=5`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    let topPlays = [];
    if (scoresRes.ok) {
      const scores = await scoresRes.json();
      topPlays = scores.map(s => ({
        song: `${s.beatmapset?.title} [${s.beatmap?.version}]`,
        pp: `${Math.round(s.pp)}pp`,
        accuracy: `${(s.accuracy * 100).toFixed(2)}%`,
        rank: s.rank,
        mods: s.mods?.join(', ') || 'NM',
      }));
    }

    return res.status(200).json({
      username: user.username,
      rank: stats?.global_rank ? `#${stats.global_rank.toLocaleString()}` : 'unranked',
      countryRank: stats?.country_rank ? `#${stats.country_rank.toLocaleString()}` : '—',
      pp: `${Math.round(stats?.pp || 0)}pp`,
      accuracy: `${(stats?.hit_accuracy || 0).toFixed(2)}%`,
      playcount: stats?.play_count?.toLocaleString() || '0',
      level: stats?.level?.current || 0,
      topPlays,
    });
  } catch (error) {
    return res.status(500).json({ error: 'failed to fetch osu data' });
  }
}
