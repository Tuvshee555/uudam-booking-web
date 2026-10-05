import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';

const hash = (value) => createHash('sha256').update(value).digest('hex');
function canonical(value) {
  if (Array.isArray(value)) {
    const items = value.map(canonical);
    return items.every((item) => item && typeof item === 'object' && typeof item.id === 'string')
      ? items.sort((a, b) => a.id.localeCompare(b.id)) : items;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

async function capture(base) {
  const api = {};
  const pages = {};
  const paths = ['/api/trips', '/api/categories', '/api/categories/tree', '/api/tags',
    '/api/settings', '/api/posts', '/api/knowledge', '/api/price-bands'];
  async function get(path, json) {
    const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(60_000),
      headers: { 'Cache-Control': 'no-cache' } });
    if (!response.ok) throw new Error(`HTTP ${response.status} at ${path}`);
    if (!json) { await response.text(); return response.status; }
    return response.json();
  }
  for (const path of paths) api[path] = await get(path, true);
  for (const trip of api['/api/trips']) {
    const path = `/api/trips/${encodeURIComponent(trip.slug || trip.id)}`;
    api[path] = await get(path, true);
  }
  for (const path of ['/mn', '/mn/trips', '/mn/departures', '/mn/custom-trip', '/mn/guide',
    '/mn/discover', '/mn/about', '/mn/contact', '/mn/faq', '/mn/terms',
    `/mn/trips/${encodeURIComponent(api['/api/trips'][0].slug)}`]) pages[path] = await get(path, false);
  const guards = {};
  for (const path of ['/api/trips?all=true', '/api/stats', '/api/users', '/api/bookings']) {
    const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(60_000) });
    guards[path] = response.status;
    await response.text();
    if (![401, 403].includes(response.status)) throw new Error(`Admin protection changed at ${path}`);
  }
  return { capturedAt: new Date().toISOString(), base, api, pages, guards };
}

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i]] = process.argv[i + 1];
const directory = resolve(args['--directory'] || 'tmp/website-consolidation-check');
if (!directory.startsWith(resolve('tmp') + sep)) throw new Error('Reports must remain inside tmp.');
mkdirSync(directory, { recursive: true });
const baselinePath = resolve(directory, 'baseline.json');
try {
  if (args['--baseline-url']) {
    const baseline = await capture(args['--baseline-url']);
    writeFileSync(baselinePath, JSON.stringify(baseline), { flag: 'wx' });
    console.log(JSON.stringify({ baselineCaptured: true, trips: baseline.api['/api/trips'].length,
      apiChecks: Object.keys(baseline.api).length, pages: baseline.pages, adminGuards: baseline.guards }));
  } else if (args['--compare-url']) {
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
    const actual = await capture(args['--compare-url']);
    const differences = Object.keys(baseline.api).filter((path) =>
      JSON.stringify(canonical(baseline.api[path])) !== JSON.stringify(canonical(actual.api[path])));
    const report = { verifiedAt: new Date().toISOString(), base: actual.base,
      trips: actual.api['/api/trips'].length, apiChecks: Object.keys(actual.api).length,
      exactContentMatch: differences.length === 0, differences,
      pages: actual.pages, adminGuards: actual.guards };
    writeFileSync(resolve(directory, `comparison-${hash(actual.base).slice(0, 8)}.json`), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (differences.length) process.exitCode = 1;
  } else throw new Error('Provide --baseline-url or --compare-url.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Verification failed.');
  process.exitCode = 1;
}
