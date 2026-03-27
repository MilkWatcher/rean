/*
  === VERCEL SERVERLESS FUNCTION ===

  This runs on Vercel's servers (not your GitHub Pages site).
  It keeps your Spotify secret safe and returns your now-playing data as JSON.

  HOW IT WORKS:
  1. Your website calls this URL
  2. This function uses your refresh_token to get a fresh access_token from Spotify
  3. It calls Spotify's "currently playing" endpoint
  4. Returns the track info as JSON to your website

  DEPLOYMENT:
  1. Create a new folder/repo for this (separate from your GitHub Pages site)
  2. Put this file at: api/now-playing.js
  3. Push to GitHub, connect to Vercel (vercel.com)
  4. Add environment variables in Vercel dashboard:
     - SPOTIFY_CLIENT_ID
     - SPOTIFY_CLIENT_SECRET
     - SPOTIFY_REFRESH_TOKEN
  5. Deploy — you'll get a URL like https://your-app.vercel.app/api/now-playing
*/

async function getAccessToken() {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(
        process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
      ).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.SPOTIFY_REFRESH_TOKEN,
    }),
  });

  const data = await response.json();
  return data.access_token;
}

export default async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 'no-cache');

  try {
    const accessToken = await getAccessToken();

    // fetch currently playing track
    const spotifyRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    // 204 = no content (nothing playing)
    if (spotifyRes.status === 204 || spotifyRes.status > 400) {
      return res.status(200).json({ playing: false });
    }

    const data = await spotifyRes.json();

    const result = {
      playing: data.is_playing,
      track: data.item?.name,
      artist: data.item?.artists?.map(a => a.name).join(', '),
      album: data.item?.album?.name,
      url: data.item?.external_urls?.spotify,
      albumArt: data.item?.album?.images?.[2]?.url,
    };

    // last 5 tracks innit
    const recentRes = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=5', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (recentRes.ok) {
      const recentData = await recentRes.json();
      result.recent = recentData.items?.map(item => ({
        track: item.track?.name,
        artist: item.track?.artists?.map(a => a.name).join(', '),
        url: item.track?.external_urls?.spotify,
      })) || [];
      result._debug = { recentStatus: recentRes.status, itemCount: recentData.items?.length };
    } else {
      const errBody = await recentRes.text();
      result.recent = [];
      result._debug = { recentStatus: recentRes.status, errBody };
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ playing: false, error: 'failed to fetch' });
  }
}
