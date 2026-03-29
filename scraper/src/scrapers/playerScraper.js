/**
 * playerScraper.js
 *
 * Scrapes player rosters from team pages on the APTA Chicago site.
 *
 * Team pages contain a roster table with columns:
 *   [Team Name] | R (PTI rating) | W | L
 *
 * Player names may be prefixed with ✔ (active) and suffixed with (C) (captain).
 * The "R" column contains the PTI rating as a float (can be negative).
 *
 * Returns: Array<{ name: string, pti: number | null }>
 */

import { goto, sleep } from '../utils/browser.js';
import { log } from '../utils/logger.js';

/**
 * Clean a player name: strip ✔ prefix, (C) captain suffix, extra whitespace.
 */
function cleanPlayerName(raw) {
  return raw
    .replace(/^✔\s*/, '')
    .replace(/\s*\(C\)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse PTI rating. Can be negative (e.g. "-1.2").
 */
function parsePTI(raw) {
  if (!raw) return null;
  const n = parseFloat(raw.trim());
  return isNaN(n) ? null : n;
}

/**
 * Scrape all players from a single team page.
 * The roster is in a table whose header row contains "R", "W", "L" columns.
 */
export async function scrapeTeamRoster(page, teamUrl) {
  await goto(page, teamUrl);
  await sleep(500);

  const rawPlayers = await page.evaluate(() => {
    const results = [];
    const tables = Array.from(document.querySelectorAll('table'));

    for (const table of tables) {
      const headers = Array.from(table.querySelectorAll('th')).map(th =>
        th.innerText.trim()
      );

      // The roster table has headers like: [TeamName, R, W, L, ...]
      // Look for a table with "R", "W", "L" headers (but NOT "Pts" which is standings)
      const rIdx = headers.indexOf('R');
      const wIdx = headers.indexOf('W');
      const lIdx = headers.indexOf('L');
      const hasPts = headers.some(h => h === 'Pts' || h === 'Wks');

      if (rIdx === -1 || wIdx === -1 || lIdx === -1 || hasPts) continue;

      // Found the roster table — parse rows
      const rows = Array.from(table.querySelectorAll('tbody tr, tr')).filter(
        r => r.querySelectorAll('td').length >= 3
      );

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td')).map(td =>
          td.innerText.trim()
        );
        if (cells.length < 3) continue;

        // First cell = player name, second = PTI (R column)
        const name = cells[0];
        const ptiRaw = cells[rIdx] !== undefined ? cells[rIdx] : null;

        // Skip header-like rows or empty names
        if (!name || name.length < 2) continue;
        if (name === 'Captains' || name === 'Players') continue;

        results.push({ name, ptiRaw });
      }

      if (results.length > 0) break;
    }

    return results;
  });

  return rawPlayers.map(({ name, ptiRaw }) => ({
    name: cleanPlayerName(name),
    pti: parsePTI(ptiRaw),
  })).filter(p => p.name.length > 1);
}

/**
 * Scrape players from multiple team pages sequentially.
 */
export async function scrapeAllRosters(page, teamUrls, { onProgress } = {}) {
  const results = new Map();

  for (let i = 0; i < teamUrls.length; i++) {
    const url = teamUrls[i];
    try {
      const players = await scrapeTeamRoster(page, url);
      results.set(url, players);
      if (onProgress) onProgress(i + 1, teamUrls.length, url, players.length);
    } catch (err) {
      log.error(`  Roster scrape failed [${url}]: ${err.message}`);
      results.set(url, []);
    }
    await sleep(300 + Math.random() * 200);
  }

  return results;
}

/**
 * Global player list — not available on this tenniscores site.
 * Returns null so the caller falls back to per-team scraping.
 */
export async function scrapeGlobalPlayerList() {
  return null;
}
