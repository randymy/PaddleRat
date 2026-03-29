/**
 * seriesScraper.js
 *
 * Scrapes all Divisions and their Teams from the APTA Chicago site.
 *
 * Site structure (tenniscores.com):
 *   Homepage shows division selectors (1, 2, 3, … 40, 99, plus "SW" variants)
 *   under a group label (e.g. "Chicago"). Team links are listed with &team= URLs.
 *   Division links use &did= params. All URLs use encoded mod/did/team params.
 *
 * Returns: Array<{ seriesName: string, teams: Array<{name, href}> }>
 */

import { goto, BASE_URL, sleep } from '../utils/browser.js';
import { log } from '../utils/logger.js';

/**
 * Scrape all divisions and teams from the homepage in a single page load.
 *
 * The homepage contains:
 *  - Division group labels in `.div_group_divs:not(.div_list_option)` (e.g. "Chicago")
 *  - Division links in `.div_list_option a` (numbered divisions with &did= URLs)
 *  - Team links in `.div_list_teams_option a` (team names with &team= URLs)
 */
export async function scrapeAllSeries(page) {
  log.info('Discovering divisions & teams from homepage…');
  await goto(page, BASE_URL);
  await sleep(1500);

  const data = await page.evaluate(() => {
    // --- Division group name (e.g. "Chicago") ---
    const groupEls = document.querySelectorAll('.div_group_divs:not(.div_list_option)');
    const groupName = groupEls.length > 0 ? groupEls[0].innerText.trim() : 'Chicago';

    // --- Division links (numbered: 1, 2, … 40, 99, "7 SW", etc.) ---
    const divLinks = Array.from(document.querySelectorAll('.div_list_option a')).map(a => ({
      name: a.innerText.trim(),
      href: a.href,
    })).filter(d => d.name.length > 0);

    // --- Team links (club names with &team= URLs) ---
    const teamLinks = Array.from(document.querySelectorAll('.div_list_teams_option a')).map(a => ({
      name: a.innerText.trim(),
      href: a.href,
    })).filter(t => t.name.length > 0);

    return { groupName, divLinks, teamLinks };
  });

  log.success(`Group: "${data.groupName}" — ${data.divLinks.length} divisions, ${data.teamLinks.length} teams`);

  // Parse team names to extract their division number (e.g. "Glen Ellyn - 1" → division "1")
  const divisionTeams = new Map(); // divisionName → teams[]

  for (const team of data.teamLinks) {
    // Team names follow pattern "Club Name - DivNumber"
    const match = team.name.match(/^(.+?)\s*-\s*(\S+.*)$/);
    const divName = match ? match[2].trim() : 'Unknown';
    if (!divisionTeams.has(divName)) divisionTeams.set(divName, []);
    divisionTeams.get(divName).push({ name: team.name, href: team.href });
  }

  // Build results in the format index.js expects
  const results = [];
  for (const [divName, teams] of divisionTeams) {
    results.push({
      seriesName: `${data.groupName} Division ${divName}`,
      teams,
    });
  }

  // Also include any divisions that had no teams matched
  for (const div of data.divLinks) {
    const seriesName = `${data.groupName} Division ${div.name}`;
    if (!results.find(r => r.seriesName === seriesName)) {
      results.push({ seriesName, teams: [] });
    }
  }

  return results;
}
