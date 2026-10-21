const cheerio = require('cheerio');
const robotsParser = require('robots-parser');
const { cleanText, isJobListing, normalizeListing } = require('./normalize');
const { extractDetailFields } = require('./extractDetail');

const USER_AGENT = 'SarkariJobFetcher/1.0 (+contact your site administrator)';
const robotsCache = new Map();

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' }
    });
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error(`Source did not return HTML (content-type: ${contentType || 'unknown'})`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function getRobots(origin, timeoutMs) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  const robotsUrl = new URL('/robots.txt', origin).href;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(robotsUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'user-agent': USER_AGENT, accept: 'text/plain' }
    });
    if (response.status === 404) {
      robotsCache.set(origin, null);
      return null;
    }
    if (!response.ok) throw new Error(`Could not verify robots.txt (HTTP ${response.status})`);
    const text = await response.text();
    const robots = robotsParser(robotsUrl, text);
    robotsCache.set(origin, robots);
    return robots;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Timed out while checking robots.txt');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function assertRobotsAllows(sourceUrl, timeoutMs) {
  const origin = new URL(sourceUrl).origin;
  const robots = await getRobots(origin, timeoutMs);
  if (robots && !robots.isAllowed(sourceUrl, USER_AGENT)) {
    throw new Error('Fetching the configured URL is disallowed by robots.txt. Use a permitted source or obtain permission.');
  }
}

async function mapPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }
  const runners = Array.from({ length: Math.min(concurrency, items.length) || 1 }, () => run());
  await Promise.all(runners);
  return results;
}

/** Stage 1 — listing page: title + real detail URL */
function scrapeListings(html, sourceUrl) {
  const $ = cheerio.load(html);
  const found = new Map();

  $('a[href]').each((_, element) => {
    const anchor = $(element);
    const title = cleanText(anchor.text() || anchor.attr('title') || anchor.find('img').attr('alt') || '');
    if (!isJobListing(title)) return;

    const rawHref = anchor.attr('href');
    if (!rawHref || rawHref.startsWith('#') || /^(javascript:|mailto:|tel:)/i.test(rawHref)) return;

    const job = normalizeListing({ title, url: rawHref, sourceUrl });
    if (!job) return;
    if (!found.has(job.id)) found.set(job.id, job);
  });

  return [...found.values()];
}

/** Stage 2 — detail page: dates, vacancies, eligibility, fees, links */
async function enrichJobDetails(listing, { timeoutMs, sourceUrl }) {
  const verifiedAt = new Date().toISOString();
  try {
    await assertRobotsAllows(listing.url, timeoutMs);
    const html = await fetchText(listing.url, timeoutMs);
    const $ = cheerio.load(html);
    const details = extractDetailFields($, listing.url);

    return {
      ...listing,
      ...details,
      title: details.postName || listing.title,
      postName: details.postName || listing.title,
      sourceUrl: listing.url,
      publishedAt: details.publishedAt || listing.publishedAt,
      lastVerifiedAt: verifiedAt,
      detailFetchError: null
    };
  } catch (error) {
    return {
      ...listing,
      lastVerifiedAt: verifiedAt,
      detailFetchError: error.message || 'Detail page fetch failed'
    };
  }
}

async function scrapeJobs({
  sourceUrl,
  timeoutMs,
  detailLimit = 20,
  detailConcurrency = 3
}) {
  await assertRobotsAllows(sourceUrl, timeoutMs);
  const listHtml = await fetchText(sourceUrl, timeoutMs);
  const listings = scrapeListings(listHtml, sourceUrl);

  if (!listings.length) {
    throw new Error('The source was reached, but no matching job detail links were detected. The page structure may have changed.');
  }

  // detailLimit <= 0 means fetch every listing (no cap).
  const limited = detailLimit > 0 ? listings.slice(0, detailLimit) : listings;
  console.log(`[scraper] stage1=${listings.length} listings, stage2 fetching ${limited.length} detail pages`);

  const jobs = await mapPool(limited, Math.max(1, detailConcurrency), (listing) =>
    enrichJobDetails(listing, { timeoutMs, sourceUrl })
  );

  // Deduplicate by id (URL)
  const unique = new Map();
  for (const job of jobs) {
    if (!unique.has(job.id)) unique.set(job.id, job);
  }

  const result = [...unique.values()];
  if (!result.length) {
    throw new Error('Detail pages were requested, but no job records could be built.');
  }
  return result;
}

module.exports = { scrapeJobs, scrapeListings };
