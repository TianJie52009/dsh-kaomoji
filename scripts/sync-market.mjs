import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export function marketStatus({ version, publishedAt, catalogVersion, createdAt }, now = Date.now()) {
  const published = Date.parse(publishedAt);
  const created = Date.parse(createdAt);
  if (!Number.isFinite(published) || !Number.isFinite(created)) throw new Error('Missing publication/repository date');
  return {
    synced: version === catalogVersion,
    repoReady: now - created >= 86400000,
    releaseReady: now - published >= 86400000,
    releaseReadyAt: new Date(published + 86400000).toISOString(),
  };
}

async function main() {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  const repo = pkg.repository.url.replace(/^git\+https:\/\/github.com\//, '').replace(/\.git$/, '');
  const upstream = 'awesome-dsh-plugin/awesome-dsh-plugin';
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const requestRefresh = process.argv.includes('--request-refresh');
  if (process.argv.slice(2).some(arg => arg !== '--request-refresh')) throw new Error('Usage: node scripts/sync-market.mjs [--request-refresh]');
  const json = async (url, options = {}) => {
    const headers = { accept: 'application/json', 'user-agent': `${pkg.name}-market-sync` };
    if (new URL(url).hostname === 'api.github.com' && token) headers.authorization = `Bearer ${token}`;
    const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
    return response.json();
  };
  const [registry, repository, catalog] = await Promise.all([
    json(`https://registry.npmjs.org/${encodeURIComponent(pkg.name)}`),
    json(`https://api.github.com/repos/${repo}`),
    json('https://awesome-dsh-plugin.com/plugins.json'),
  ]);
  if (registry['dist-tags'].latest !== pkg.version) throw new Error(`npm latest is ${registry['dist-tags'].latest}; expected ${pkg.version}. Publish/verify npm first.`);
  const entry = catalog.plugins.find(item => item.url.toLowerCase() === `https://github.com/${repo}`.toLowerCase());
  if (!entry) throw new Error('Repository is not listed. Follow https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md to submit data/plugins/<owner>__<repo>.yml.');
  if (entry.npm !== pkg.name) throw new Error(`Catalog links a different npm package: ${entry.npm}`);
  const facts = { version: pkg.version, publishedAt: registry.time[pkg.version], catalogVersion: entry.version, createdAt: repository.created_at };
  const status = marketStatus(facts);
  console.log(JSON.stringify({ package: pkg.name, github: repository.html_url, catalogUpdated: catalog.updated, ...facts, ...status }, null, 2));
  console.log('Market listing: ' + entry.page);
  if (status.synced) {
    console.log('Market catalog already lists this version. Refresh the market UI; its own fresh-release policy may still delay installation.');
    return;
  }
  console.log('The upstream nightly build refreshes npm versions; updating the existing catalog entry is automatic.');
  if (!status.repoReady || !status.releaseReady) {
    console.log('Wait until the repository and this npm release are at least 24 hours old, then run this script again.');
    process.exitCode = 2;
    return;
  }
  if (!requestRefresh) {
    console.log('Still stale after the wait? Run sync-market.cmd --request-refresh to request an upstream re-probe (requires GH_TOKEN or GITHUB_TOKEN).');
    process.exitCode = 2;
    return;
  }
  if (!token) throw new Error('Set GH_TOKEN or GITHUB_TOKEN with permission to open an issue on the catalog repository.');
  const title = `Refresh npm metadata: ${pkg.name} ${pkg.version}`;
  const query = encodeURIComponent(`repo:${upstream} is:issue is:open in:title "${pkg.name}" "${pkg.version}"`);
  const existing = await json(`https://api.github.com/search/issues?q=${query}`);
  if (existing.items.length) {
    console.log('Existing refresh request: ' + existing.items[0].html_url);
    return;
  }
  const body = [
    `The existing entry for https://github.com/${repo} still reports npm ${entry.version ?? 'unknown'}.`,
    `npm latest is ${pkg.name}@${pkg.version}, published ${facts.publishedAt}.`,
    `Registry: https://registry.npmjs.org/${pkg.name}/${pkg.version}`,
    `Catalog: https://awesome-dsh-plugin.com/plugins.json (updated ${catalog.updated}).`,
    'Please re-probe the npm metadata for this existing entry. This is a version refresh request, not a duplicate plugin submission.',
  ].join('\n\n');
  const issue = await json(`https://api.github.com/repos/${upstream}/issues`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, body }) });
  console.log('Refresh requested: ' + issue.html_url);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
