/*
  === SPOTIFY REFRESH TOKEN HELPER ===

  PURPOSE: Gets you a refresh token so your site can access your Spotify data.
  You only need to run this ONCE.

  HOW TO USE:
  1. Install Node.js if you don't have it (nodejs.org)
  2. Open terminal in this folder
  3. Run: npm install express open
  4. Edit the CLIENT_ID and CLIENT_SECRET below with your values
  5. Run: node get-token.js
  6. It'll open your browser — log in to Spotify and authorize
  7. Copy the refresh_token it prints — you'll need it for Vercel
*/

const http = require('http');
const { exec } = require('child_process');


const CLIENT_ID = 'a7ae6cf3be3246ff93a505a7c16054ba';
const CLIENT_SECRET = '097ffa0f697949028be6535c31027358';


const REDIRECT_URI = 'http://127.0.0.1:3000/callback';
const SCOPES = 'user-read-currently-playing user-read-recently-played';

// Step 1: Open browser for Spotify login
const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}`;

console.log('\nOpening browser for Spotify authorization...');
console.log('\nCopy and paste this URL into your browser:\n');
console.log(authUrl + '\n');

// Step 2: Start a tiny server to catch the callback
const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/callback')) return;

  // Extract the auth code from the URL
  const url = new URL(req.url, 'http://localhost:3000');
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.end('Authorization denied. Check the terminal.');
    console.log('\nError:', error);
    server.close();
    return;
  }

  // Step 3: Exchange the code for tokens
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const data = await response.json();

    if (data.refresh_token) {
      console.log('\n✓ Success! Here\'s your refresh token:\n');
      console.log('REFRESH_TOKEN=' + data.refresh_token);
      console.log('\nSave this! You\'ll need it when deploying to Vercel.');
      res.end('Got your refresh token! Check the terminal. You can close this tab.');
    } else {
      console.log('\nError getting token:', data);
      res.end('Error — check the terminal.');
    }
  } catch (err) {
    console.log('\nFetch error:', err.message);
    res.end('Error — check the terminal.');
  }

  server.close();
});

server.listen(3000, () => {
  console.log('Waiting for Spotify callback on http://localhost:3000...');
});
