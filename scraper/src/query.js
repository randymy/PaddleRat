#!/usr/bin/env node
/**
 * query.js — Quick DB inspection tool
 *
 * Usage:
 *   node src/query.js stats
 *   node src/query.js players [--limit 20]
 *   node src/query.js teams [series name]
 *   node src/query.js player "John Smith"
 *   node src/query.js series
 */

import { getDb } from './db/init.js';
import chalk from 'chalk';

const db   = getDb();
const cmd  = process.argv[2] || 'stats';
const arg  = process.argv[3] || '';
const lim  = parseInt(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || '50');

const fmt = {
  header: (t) => console.log('\n' + chalk.bold.cyan(t)),
  row:    (...cols) => console.log(cols.join('  ')),
};

switch (cmd) {
  case 'stats': {
    fmt.header('Database Stats');
    const q = (sql) => db.prepare(sql).get();
    console.log(`  Series:  ${q('SELECT COUNT(*) n FROM series').n}`);
    console.log(`  Teams:   ${q('SELECT COUNT(*) n FROM teams').n}`);
    console.log(`  Players: ${q('SELECT COUNT(*) n FROM players').n}`);
    console.log(`  Links:   ${q('SELECT COUNT(*) n FROM player_teams').n}`);
    const last = db.prepare('SELECT * FROM scrape_log ORDER BY id DESC LIMIT 1').get();
    if (last) {
      console.log(`\n  Last run: ${last.started_at} → ${last.status}`);
    }
    break;
  }

  case 'series': {
    fmt.header('All Series');
    const rows = db.prepare(`
      SELECT s.name, COUNT(t.id) AS teams
      FROM series s LEFT JOIN teams t ON t.series_id = s.id
      GROUP BY s.id ORDER BY s.name
    `).all();
    rows.forEach((r) => console.log(`  ${chalk.white(r.name.padEnd(50))} ${chalk.gray(r.teams + ' teams')}`));
    break;
  }

  case 'teams': {
    fmt.header('Teams' + (arg ? ` in "${arg}"` : ''));
    const rows = db.prepare(`
      SELECT t.name AS team, s.name AS series, COUNT(pt.player_id) AS players
      FROM teams t
      JOIN series s ON s.id = t.series_id
      LEFT JOIN player_teams pt ON pt.team_id = t.id
      WHERE s.name LIKE ?
      GROUP BY t.id ORDER BY s.name, t.name
      LIMIT ?
    `).all(`%${arg}%`, lim);
    rows.forEach((r) =>
      console.log(`  ${r.team.padEnd(45)} ${chalk.gray(r.series.padEnd(30))} ${r.players} players`)
    );
    break;
  }

  case 'players': {
    fmt.header('Players (top by PTI)');
    const rows = db.prepare(`
      SELECT p.name, p.pti,
             GROUP_CONCAT(t.name, ' | ') AS teams
      FROM players p
      LEFT JOIN player_teams pt ON pt.player_id = p.id
      LEFT JOIN teams t ON t.id = pt.team_id
      GROUP BY p.id
      ORDER BY p.pti ASC NULLS LAST
      LIMIT ?
    `).all(lim);
    rows.forEach((r) =>
      console.log(
        `  ${r.name.padEnd(30)} PTI: ${chalk.yellow(String(r.pti ?? 'N/A').padEnd(8))} ${chalk.gray(r.teams || '')}`
      )
    );
    break;
  }

  case 'player': {
    if (!arg) { console.log('Usage: node src/query.js player "Name"'); break; }
    fmt.header(`Player: ${arg}`);
    const p = db.prepare(`SELECT * FROM players WHERE name LIKE ?`).get(`%${arg}%`);
    if (!p) { console.log('  Not found'); break; }
    console.log(`  Name: ${p.name}`);
    console.log(`  PTI:  ${p.pti ?? 'N/A'}`);
    const teams = db.prepare(`
      SELECT t.name, s.name AS series
      FROM teams t
      JOIN series s ON s.id = t.series_id
      JOIN player_teams pt ON pt.team_id = t.id
      WHERE pt.player_id = ?
    `).all(p.id);
    if (teams.length) {
      console.log('  Teams:');
      teams.forEach((t) => console.log(`    • ${t.name} (${t.series})`));
    }
    break;
  }

  default:
    console.log('Commands: stats | series | teams [series] | players | player "Name"');
}

db.close();
