/**
 * siteExplorer.js
 *
 * Crawls the APTA Chicago site to understand its URL structure.
 * Prints a map of all discovered sections so you can tune selectors.
 *
 * Run independently with:
 *   node src/scrapers/siteExplorer.js
 */

import { launchBrowser, newPage, goto, BASE_URL, sleep } from '../utils/browser.js';
import { log } from '../utils/logger.js';
import { fileURLToPath } from 'url';

const MAX_DEPTH = 2;
const MAX_LINKS = 200;

async function explore(page, url, depth = 0, visited = new Set()) {
  if (depth > MAX_DEPTH || visited.size > MAX_LINKS) return;
  if (visited.has(url)) return;
  visited.add(url);

  try {
    await goto(page, url);
    await sleep(500);

    const { title, links, h1s, tableHeaders } = await page.evaluate((base) => {
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map((a) => ({ text: a.innerText.trim().slice(0, 60), href: a.href }))
        .filter((l) => l.href.startsWith(base) && !l.href.includes('#'));

      const h1s = Array.from(document.querySelectorAll('h1, h2')).map((h) =>
        h.innerText.trim().slice(0, 80)
      );

      const tableHeaders = Array.from(document.querySelectorAll('table')).map((t) =>
        Array.from(t.querySelectorAll('th')).map((th) => th.innerText.trim())
      );

      return {
        title: document.title,
        links,
        h1s,
        tableHeaders,
      };
    }, BASE_URL);

    console.log('\n' + '  '.repeat(depth) + `📄 ${url}`);
    console.log('  '.repeat(depth) + `   Title: ${title}`);
    if (h1s.length) console.log('  '.repeat(depth) + `   H1/H2: ${h1s.join(' | ')}`);
    if (tableHeaders.length) {
      console.log('  '.repeat(depth) + `   Tables: ${tableHeaders.map((h) => '[' + h.join(', ') + ']').join('; ')}`);
    }
    console.log('  '.repeat(depth) + `   Links (${links.length}): ${links.slice(0, 8).map((l) => l.text || l.href).join(', ')}`);

    if (depth < MAX_DEPTH) {
      const nextUrls = [...new Set(links.map((l) => l.href))].slice(0, 10);
      for (const nextUrl of nextUrls) {
        await explore(page, nextUrl, depth + 1, visited);
      }
    }
  } catch (err) {
    console.log('  '.repeat(depth) + `  ❌ ${url}: ${err.message}`);
  }
}

// Run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    log.section('APTA Chicago Site Explorer');
    const browser = await launchBrowser({ headless: true });
    const page = await newPage(browser);
    try {
      await explore(page, BASE_URL);
    } finally {
      await browser.close();
    }
  })();
}

export { explore };
