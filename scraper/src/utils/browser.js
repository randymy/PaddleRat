import { chromium } from 'playwright';

const BASE_URL = 'https://aptachicago.tenniscores.com';

export { BASE_URL };

export async function launchBrowser({ headless = true } = {}) {
  const browser = await chromium.launch({
    headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  return browser;
}

export async function newPage(browser) {
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  const page = await ctx.newPage();

  // Abort images/fonts/media to speed up scraping
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (['image', 'media', 'font'].includes(type)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  return page;
}

/**
 * Navigate with retry + gentle back-off.
 */
export async function goto(page, url, { retries = 3, delay = 1500 } = {}) {
  for (let i = 0; i < retries; i++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      return;
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(delay * (i + 1));
    }
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
