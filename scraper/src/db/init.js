import Database from 'better-sqlite3';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../../data');
const DB_PATH = join(DATA_DIR, 'apta.db');

const RESET = process.argv.includes('--reset');

export function getDb() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function initDb(db) {
  db.exec(`
    -- Series: e.g. "Chicago 40+ Series", "Chicago Open Series"
    CREATE TABLE IF NOT EXISTS series (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      scraped_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Teams: e.g. "Lincoln Park Racquet Club A"
    CREATE TABLE IF NOT EXISTS teams (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      series_id   INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
      scraped_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(name, series_id)
    );

    -- Players: unique by name (PTI is per-player, not per-team)
    CREATE TABLE IF NOT EXISTS players (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      pti         REAL,
      scraped_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Player <-> Team memberships (many-to-many)
    CREATE TABLE IF NOT EXISTS player_teams (
      player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      team_id     INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      PRIMARY KEY (player_id, team_id)
    );

    -- Scrape run log
    CREATE TABLE IF NOT EXISTS scrape_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at  TEXT    NOT NULL,
      finished_at TEXT,
      series_count  INTEGER DEFAULT 0,
      team_count    INTEGER DEFAULT 0,
      player_count  INTEGER DEFAULT 0,
      status      TEXT    NOT NULL DEFAULT 'running',
      notes       TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_players_name   ON players(name);
    CREATE INDEX IF NOT EXISTS idx_teams_series   ON teams(series_id);
    CREATE INDEX IF NOT EXISTS idx_pt_player      ON player_teams(player_id);
    CREATE INDEX IF NOT EXISTS idx_pt_team        ON player_teams(team_id);
  `);
}

// If run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  import('chalk').then(({ default: chalk }) => {
    if (RESET && existsSync(DB_PATH)) {
      unlinkSync(DB_PATH);
      console.log(chalk.yellow('⚠  Existing database deleted.'));
    }
    const db = getDb();
    initDb(db);
    console.log(chalk.green(`✓  Database initialized at ${DB_PATH}`));
    db.close();
  });
}
