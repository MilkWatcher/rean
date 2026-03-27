// last updated date
const lastUpdatedEl = document.getElementById('last-updated');
if (lastUpdatedEl) {
  const d = new Date(document.lastModified);
  lastUpdatedEl.textContent = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
}

const tabs = document.querySelectorAll('.tab');
const contents = document.querySelectorAll('.tab-content');


tabs.forEach(tab => {
  tab.addEventListener('click', () => {

    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));

    tab.classList.add('active');

    const target = document.getElementById(tab.dataset.tab);
    target.classList.add('active');
  });
});

// clicking "rean" shows the about section
const heroLink = document.getElementById('hero-link');
if (heroLink) {
  heroLink.addEventListener('click', (e) => {
    e.preventDefault();
    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));
    document.getElementById('about').classList.add('active');
  });
}

/*
  === SPOTIFY NOW PLAYING ===

  HOW THIS WORKS:
  - fetch()        → makes an HTTP request to a URL (like your browser does)
  - async/await    → lets you "wait" for the response instead of using callbacks
  - .json()        → parses the response text into a JavaScript object
  - textContent    → sets the text inside an HTML element
  - setInterval    → runs a function repeatedly (every 30 seconds here)

  SETUP: Replace the URL below with your Vercel deployment URL.
*/


const SPOTIFY_API = 'https://spotify-now-playing-delta-sepia.vercel.app/api/now-playing';


async function updateSpotify() {
  const el = document.getElementById('now-playing');
  const recentEl = document.getElementById('recent-tracks');
  if (!el) return;

  try {
    const res = await fetch(SPOTIFY_API);
    const data = await res.json();

    if (data.playing && data.track) {
      el.innerHTML = `<a href="${data.url}" target="_blank">${data.track}</a> — ${data.artist}`;
      el.className = '';
    } else {
      el.textContent = 'nothing rn';
      el.className = 'dim';
    }

    if (recentEl && data.recent && data.recent.length > 0) {
      recentEl.innerHTML = data.recent
        .map(t => `<li><a href="${t.url}" target="_blank">${t.track}</a> — ${t.artist}</li>`)
        .join('');
    }
  } catch (err) {
    el.textContent = 'couldn\'t reach spotify';
    el.className = 'dim';
  }
}

// refresh every 30 secs
updateSpotify();
setInterval(updateSpotify, 30000);

/*
  === GOOGLE SHEETS GYM DATA ===

  HOW THIS WORKS:
  - Your Google Sheet has 2 tabs: "prs" and "log"
  - Google provides a free JSON-like endpoint for published sheets
  - We fetch that data, parse it, and build HTML from it

  SHEET STRUCTURE:
  
  Tab "prs":
  | exercise       | value  |
  |----------------|--------|
  | bench press    | 60kg   |
  | squat          | 80kg   |

  Tab "log":
  | date     | session  | exercise                  | notes       |
  |----------|----------|---------------------------|-------------|
  | 26.03.26 | push day | bench press 60kg 3 x 8    | felt stronk |
  | 26.03.26 | push day | ohp 30kg 3 x 10           |             |
  | 24.03.26 | pull day | deadlift 100kg 3 x 5      |             |

  One row per exercise. Same date+session = grouped into one dropdown.
*/

// ========= REPLACE THIS WITH YOUR GOOGLE SHEET ID =========
const SHEET_ID = '1jbI47H4Jodyre06wDa0ewY3lfxrCn69QEbHdwhp6XdE';
// ===========================================================

// Helper: fetch a sheet tab and parse Google's JSON response
async function fetchSheet(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  const text = await res.text();

  // Google wraps the JSON in a callback — strip it to get pure JSON
  const json = JSON.parse(text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*?)\);/)[1]);

  const rows = json.table.rows;
  if (!rows.length) return [];

  // First row is headers (Google doesn't always detect them)
  const headers = rows[0].c.map(cell => cell ? (cell.v || '').toString().toLowerCase() : '');

  // Convert remaining rows into objects using those headers
  return rows.slice(1).map(row => {
    const obj = {};
    row.c.forEach((cell, i) => {
      obj[headers[i]] = cell ? (cell.v || '').toString() : '';
    });
    return obj;
  });
}

// Render PRs into two columns
async function loadPRs() {
  const prGrid = document.getElementById('pr-grid');
  if (!prGrid) return;

  try {
    const prs = await fetchSheet('prs');
    const half = Math.ceil(prs.length / 2);
    const col1 = prs.slice(0, half);
    const col2 = prs.slice(half);

    const makeList = items =>
      '<ul>' + items.map(p => `<li>${p.exercise}: ${p.value}</li>`).join('') + '</ul>';

    prGrid.innerHTML = makeList(col1) + makeList(col2);
  } catch (err) {
    prGrid.innerHTML = '<p class="dim">couldn\'t load PRs</p>';
  }
}

// Render gym log — group rows by date+session, create dropdowns
async function loadGymLog() {
  const gymLog = document.getElementById('gym-log');
  if (!gymLog) return;

  try {
    const rows = await fetchSheet('log');

    // Group exercises by date + session
    const days = [];
    const dayMap = {};

    rows.forEach(row => {
      const key = `${row.date}|${row.session}`;
      if (!dayMap[key]) {
        dayMap[key] = { date: row.date, session: row.session, exercises: [], notes: '' };
        days.push(dayMap[key]);
      }
      dayMap[key].exercises.push(row.exercise);
      // Use the last non-empty notes value for that day
      if (row.notes) dayMap[key].notes = row.notes;
    });

    // Build HTML for each day
    gymLog.innerHTML = days.map(day => `
      <details class="gym-day">
        <summary>${day.date} — ${day.session}</summary>
        <ul>
          ${day.exercises.map(e => `<li>${e}</li>`).join('')}
        </ul>
        ${day.notes ? `<p class="gym-note">notes: ${day.notes}</p>` : ''}
      </details>
    `).join('');

  } catch (err) {
    gymLog.innerHTML = '<p class="dim">couldn\'t load gym log</p>';
  }
}

// Load gym data
loadPRs();
loadGymLog();

/*
  === GYM LOG SEARCH ===
  Same as before — filters the dynamically loaded days.
  Uses 'input' event so it works after data loads.
*/
const gymSearch = document.getElementById('gym-search');
if (gymSearch) {
  gymSearch.addEventListener('input', () => {
    const query = gymSearch.value.toLowerCase();
    const days = document.querySelectorAll('.gym-day');

    days.forEach(day => {
      const text = day.textContent.toLowerCase();
      if (text.includes(query)) {
        day.classList.remove('hidden');
      } else {
        day.classList.add('hidden');
      }
    });
  });
}

/*
  === GAME STATS ===

  osu!mania: pulled live from osu! API via your Vercel function.
  vsrg + overwatch: still from Google Sheets (no public API).
*/

// ========= REPLACE WITH YOUR VERCEL URL =========
const OSU_API = 'https://spotify-now-playing-delta-sepia.vercel.app/api/osu-stats';
// =================================================

// Helper: render a simple stat list as two columns
function renderStatGrid(data) {
  const half = Math.ceil(data.length / 2);
  const col1 = data.slice(0, half);
  const col2 = data.slice(half);
  const makeList = items =>
    '<ul>' + items.map(s => {
      const parts = Object.values(s).filter(v => v);
      return `<li>${parts.join(' — ')}</li>`;
    }).join('') + '</ul>';
  return makeList(col1) + (col2.length ? makeList(col2) : '');
}

// osu!mania — live from osu! API
async function loadMania() {
  const statsEl = document.getElementById('mania-stats');
  const topEl = document.getElementById('mania-top');

  try {
    const res = await fetch(OSU_API);
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    if (statsEl) {
      statsEl.innerHTML = `<div class="pr-grid">
        <ul>
          <li>rank: ${data.rank}</li>
          <li>country: ${data.countryRank}</li>
          <li>pp: ${data.pp}</li>
        </ul>
        <ul>
          <li>accuracy: ${data.accuracy}</li>
          <li>playcount: ${data.playcount}</li>
          <li>level: ${data.level}</li>
        </ul>
      </div>`;
    }

    if (topEl && data.topPlays?.length) {
      topEl.innerHTML = data.topPlays
        .map(t => `<li>${t.song} — ${t.pp} <span class="dim">(${t.accuracy} ${t.mods})</span></li>`)
        .join('');
    }
  } catch (err) {
    if (statsEl) statsEl.innerHTML = '<p class="dim">couldn\'t load mania stats</p>';
    if (topEl) topEl.innerHTML = '<li class="dim">couldn\'t load top plays</li>';
  }
}

// vsrg stats
async function loadVSRG() {
  const el = document.getElementById('vsrg-stats');
  if (!el) return;

  try {
    const stats = await fetchSheet('vsrg');
    if (stats.length) {
      const mid = Math.ceil(stats.length / 2);
      const col = items => '<ul>' + items.map(s => {
        let text = `${s.stat}: ${s.value}`;
        if (s.dan) text += ` <span class="dim">(${s.dan})</span>`;
        return `<li>${text}</li>`;
      }).join('') + '</ul>';
      el.innerHTML = '<div class="pr-grid">' +
        col(stats.slice(0, mid)) + col(stats.slice(mid)) + '</div>';
    }
  } catch (err) {
    el.innerHTML = '<p class="dim">couldn\'t load vsrg stats</p>';
  }
}

// overwatch stats
async function loadOW() {
  const el = document.getElementById('ow-stats');
  if (!el) return;

  try {
    const stats = await fetchSheet('overwatch');
    if (stats.length) {
      el.innerHTML = '<div class="pr-grid">' + renderStatGrid(stats) + '</div>';
    }
  } catch (err) {
    el.innerHTML = '<p class="dim">couldn\'t load ow stats</p>';
  }
}

loadMania();
loadVSRG();
loadOW();
