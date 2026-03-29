/**
 * index.js — Main scraper orchestrator
 *
 * Usage:
 *   node src/index.js             # full scrape
 *   node src/index.js --explore   # just map the site structure
 *   node src/index.js --headful   # run with visible browser (debug)
 */

import { launchBrowser, newPage, BASE_URL, sleep } from './utils/browser.js';
import { log, makeProgressBar } from './utils/logger.js';
import { getDb, initDb } from './db/init.js';
import {
  upsertSeries,
  upsertTeam,
  upsertPlayer,
  linkPlayerTeam,
  startScrapeLog,
  finishScrapeLog,
  getStats,
} from './db/queries.js';
import { scrapeAllSeries } from './scrapers/seriesScraper.js';
import { scrapeTeamRoster, scrapeGlobalPlayerList } from './scrapers/playerScraper.js';
import { explore } from './scrapers/siteExplorer.js';

const HEADFUL  = process.argv.includes('--headful');
const EXPLORE  = process.argv.includes('--explore');

async function main() {
  log.section('APTA Chicago Scraper');

  // --- DB setup ---
  const db = getDb();
  initDb(db);
  log.success('Database ready');

  // --- Browser setup ---
  const browser = await launchBrowser({ headless: !HEADFUL });
  const page    = await newPage(browser);
  log.success(`Browser launched (headless=${!HEADFUL})`);

  // --- Explore mode ---
  if (EXPLORE) {
    log.section('Site Explorer Mode');
    await explore(page, BASE_URL);
    await browser.close();
    return;
  }

  const logId = startScrapeLog(db);

  try {
    // ─────────────────────────────────────────────────
    // PHASE 1: Discover Series + Teams
    // ─────────────────────────────────────────────────
    log.section('Phase 1 — Discovering Series & Teams');

    const seriesData = await scrapeAllSeries(page);
    log.success(`Scraped ${seriesData.length} series`);

    // Persist series & teams
    const teamUrlToDbId = new Map(); // teamUrl -> { teamId, seriesName }

    for (const { seriesName, teams } of seriesData) {
      if (!seriesName) continue;
      const seriesId = upsertSeries(db, seriesName);

      for (const team of teams) {
        if (!team.name) continue;
        const teamId = upsertTeam(db, team.name, seriesId);
        if (team.href) {
          teamUrlToDbId.set(team.href, { teamId, teamName: team.name, seriesName });
        }
      }
    }

    const stats1 = getStats(db);
    log.success(`DB after Phase 1 → series: ${stats1.series}, teams: ${stats1.teams}`);

    // ─────────────────────────────────────────────────
    // PHASE 2: Scrape Players
    // ─────────────────────────────────────────────────
    log.section('Phase 2 — Scraping Players');

    // Try global player list first (faster)
    const globalPlayers = await scrapeGlobalPlayerList(page, BASE_URL);

    if (globalPlayers && globalPlayers.length > 0) {
      log.info(`Using global player list (${globalPlayers.length} players)`);
      const bar = makeProgressBar('Players');
      bar.start(globalPlayers.length, 0);

      for (let i = 0; i < globalPlayers.length; i++) {
        const { name, pti } = globalPlayers[i];
        upsertPlayer(db, name, pti);
        bar.update(i + 1);
      }
      bar.stop();

    } else {
      // Fall back to scraping each team roster individually
      const teamUrls = [...teamUrlToDbId.keys()];
      log.info(`Scraping ${teamUrls.length} team rosters individually…`);

      const bar = makeProgressBar('Teams');
      bar.start(teamUrls.length, 0);

      for (let i = 0; i < teamUrls.length; i++) {
        const url = teamUrls[i];
        const { teamId, teamName } = teamUrlToDbId.get(url);

        try {
          const players = await scrapeTeamRoster(page, url);

          const insertMany = db.transaction((players) => {
            for (const { name, pti } of players) {
              if (!name) continue;
              const playerId = upsertPlayer(db, name, pti);
              linkPlayerTeam(db, playerId, teamId);
            }
          });
          insertMany(players);

        } catch (err) {
          log.error(`  Failed roster for ${teamName}: ${err.message}`);
        }

        bar.update(i + 1);
        await sleep(400 + Math.random() * 200);
      }

      bar.stop();
    }

    // ─────────────────────────────────────────────────
    // DONE
    // ─────────────────────────────────────────────────
    const finalStats = getStats(db);
    finishScrapeLog(db, logId, {
      series:  finalStats.series,
      teams:   finalStats.teams,
      players: finalStats.players,
    });

    log.section('Complete!');
    console.log(`  Series:  ${finalStats.series}`);
    console.log(`  Teams:   ${finalStats.teams}`);
    console.log(`  Players: ${finalStats.players}`);
    console.log(`  Links:   ${finalStats.links} (player↔team)`);
    console.log(`\n  Database: data/apta.db`);

  } catch (err) {
    log.error('Fatal error:', err.message);
    finishScrapeLog(db, logId, { series: 0, teams: 0, players: 0 }, 'error', err.message);
    throw err;
  } finally {
    await browser.close();
    db.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
