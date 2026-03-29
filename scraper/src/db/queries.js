/**
 * Upsert helpers – all use INSERT OR IGNORE / UPDATE pattern
 * so re-runs are idempotent and always refresh scraped_at + PTI.
 */

export function upsertSeries(db, name) {
  db.prepare(`
    INSERT INTO series (name) VALUES (?)
    ON CONFLICT(name) DO UPDATE SET scraped_at = datetime('now')
  `).run(name);
  return db.prepare(`SELECT id FROM series WHERE name = ?`).get(name).id;
}

export function upsertTeam(db, name, seriesId) {
  db.prepare(`
    INSERT INTO teams (name, series_id) VALUES (?, ?)
    ON CONFLICT(name, series_id) DO UPDATE SET scraped_at = datetime('now')
  `).run(name, seriesId);
  return db.prepare(`SELECT id FROM teams WHERE name = ? AND series_id = ?`).get(name, seriesId).id;
}

export function upsertPlayer(db, name, pti) {
  db.prepare(`
    INSERT INTO players (name, pti) VALUES (?, ?)
    ON CONFLICT(name) DO UPDATE SET
      pti        = excluded.pti,
      scraped_at = datetime('now')
  `).run(name, pti ?? null);
  return db.prepare(`SELECT id FROM players WHERE name = ?`).get(name).id;
}

export function linkPlayerTeam(db, playerId, teamId) {
  db.prepare(`
    INSERT OR IGNORE INTO player_teams (player_id, team_id) VALUES (?, ?)
  `).run(playerId, teamId);
}

export function startScrapeLog(db) {
  const info = db.prepare(`
    INSERT INTO scrape_log (started_at) VALUES (datetime('now'))
  `).run();
  return info.lastInsertRowid;
}

export function finishScrapeLog(db, logId, counts, status = 'ok', notes = null) {
  db.prepare(`
    UPDATE scrape_log
    SET finished_at  = datetime('now'),
        series_count = ?,
        team_count   = ?,
        player_count = ?,
        status       = ?,
        notes        = ?
    WHERE id = ?
  `).run(counts.series, counts.teams, counts.players, status, notes, logId);
}

export function getStats(db) {
  return {
    series:  db.prepare(`SELECT COUNT(*) AS n FROM series`).get().n,
    teams:   db.prepare(`SELECT COUNT(*) AS n FROM teams`).get().n,
    players: db.prepare(`SELECT COUNT(*) AS n FROM players`).get().n,
    links:   db.prepare(`SELECT COUNT(*) AS n FROM player_teams`).get().n,
  };
}
