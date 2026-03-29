# APTA Chicago Scraper

Scrapes player PTI ratings, team rosters, and series data from  
**https://aptachicago.tenniscores.com** into a local SQLite database.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright browsers (one-time)
npx playwright install chromium

# 3. Initialize the database
npm run db:init

# 4. Run the scraper
npm run scrape
```

Results are saved to `data/apta.db` (SQLite).

---

## Commands

| Command | Description |
|---|---|
| `npm run scrape` | Full scrape: series → teams → players |
| `node src/index.js --explore` | Map the site's URL structure (no DB writes) |
| `node src/index.js --headful` | Run with a visible browser (good for debugging) |
| `npm run db:init` | Create DB schema (safe to re-run) |
| `npm run db:reset` | **Delete** the DB and recreate schema |

---

## Database Schema

```
series          id, name, scraped_at
teams           id, name, series_id → series, scraped_at
players         id, name, pti, scraped_at
player_teams    player_id → players, team_id → teams
scrape_log      run history with counts + status
```

### Useful queries

```sql
-- All players with their PTI, sorted best first
SELECT name, pti FROM players ORDER BY pti ASC;

-- Players on a specific team
SELECT p.name, p.pti
FROM players p
JOIN player_teams pt ON pt.player_id = p.id
JOIN teams t         ON t.id = pt.team_id
WHERE t.name LIKE '%Lincoln Park%';

-- All teams in a series
SELECT t.name FROM teams t
JOIN series s ON s.id = t.series_id
WHERE s.name LIKE '%40+%';

-- Players who play on multiple teams
SELECT p.name, COUNT(*) AS team_count
FROM players p
JOIN player_teams pt ON pt.player_id = p.id
GROUP BY p.id
HAVING team_count > 1;

-- Last scrape run
SELECT * FROM scrape_log ORDER BY id DESC LIMIT 1;
```

---

## Tuning Selectors

The site's HTML structure determines which CSS selectors work. Run the explorer first:

```bash
node src/index.js --explore
```

This prints the page titles, heading text, and table column headers for every  
page it visits — with no DB writes. Use that output to adjust the selectors in:

- `src/scrapers/seriesScraper.js` — `SEL` object at the top
- `src/scrapers/playerScraper.js` — table parsing logic

---

## Architecture

```
src/
├── index.js                  # Orchestrator (phases 1 & 2)
├── db/
│   ├── init.js               # Schema creation
│   └── queries.js            # Upsert helpers (idempotent)
├── scrapers/
│   ├── seriesScraper.js      # Discover series + teams
│   ├── playerScraper.js      # Scrape rosters / global player list
│   └── siteExplorer.js       # Site structure mapper
└── utils/
    ├── browser.js            # Playwright setup, retry logic
    └── logger.js             # Colored output + progress bars
data/
└── apta.db                   # SQLite output
```

---

## Version 2 — Match Data (planned)

Matches will add:
- `matches` table: date, home_team, away_team, score, series_id
- `match_results` table: player pairings, sets, winner
- Scraper: `matchScraper.js` iterating schedule/results pages

---

## Notes

- Scraping is polite: ~400–600ms delay between requests
- Re-runs are **idempotent** — existing records are updated, not duplicated
- All scrapers skip images/fonts/media to run fast
- If you hit rate limits, increase `sleep()` values in `browser.js`
