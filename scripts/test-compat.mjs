import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, 'package.json')));
const versions = pkg.engines.dsh.split(' || ');
const work = resolve(process.env.DSH_COMPAT_HOME || join(root, '.compat'));
const npmCli = process.env.npm_execpath || join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const run = (args, options) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, { stdio: 'inherit', ...options });
  child.on('error', reject);
  child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Command failed (${code}): ${args[0]}`)));
});

// Isolated official packages; ignore lifecycle scripts and leave live profiles alone.
for (const version of versions) {
  const dir = join(work, version);
  mkdirSync(dir, { recursive: true });
  const dependencies = {
    '@deepseek-ai/cordis': '~4.0.4',
    '@deepseek-ai/schemastery': '~3.18.4',
    '@deepseek-ai/cordis-plugin-loader': '~1.0.5',
    '@deepseek-ai/cordis-plugin-include': '~1.0.9',
    '@deepseek-ai/cordis-plugin-group': '~1.0.1',
  };
  for (const name of ['dsh-settings', 'dsh-config-editor', 'dsh-app-boot', 'dsh-home-paths', 'dsh-launch-environment', 'dsh-system-prompt', 'dsh-scope', 'dsh-client-ui-settings', 'dsh-client-ui-settings-general', 'dsh-api-remotes', 'dsh-client-ui-slots', 'dsh-client-connection', 'dsh-client-locale']) {
    dependencies[`@deepseek-ai/${name}`] = version;
  }
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies }, null, 2));
  await run([npmCli, 'install', '--ignore-scripts', '--legacy-peer-deps', '--no-audit', '--no-fund', '--registry=https://registry.npmjs.org', `--cache=${join(work, 'npm-cache')}`], { cwd: dir });
  const settingsClient = readFileSync(join(dir, 'node_modules/@deepseek-ai/dsh-client-ui-settings/lib/client.js'), 'utf8');
  const generalClient = readFileSync(join(dir, 'node_modules/@deepseek-ai/dsh-client-ui-settings-general/lib/client.js'), 'utf8');
  const remotesClient = readFileSync(join(dir, 'node_modules/@deepseek-ai/dsh-api-remotes/lib/client.js'), 'utf8');
  assert.match(settingsClient, /remote\.settings\.(describe|mutate)/);
  assert.match(generalClient, /settings\.general\.item/);
  for (const method of ["settings/describe", "settings/update", "settings/replace"]) assert.ok(remotesClient.includes(method), method + " must be generated");
  assert.ok(settingsClient.includes("settings/document-updated"), "Settings invalidation must be available");
  await run(['--expose-internals', join(root, 'scripts/verify-runtime.mjs')], { cwd: dir, env: { ...process.env, DSH_RUNTIME_DIR: dir } });
}
console.log(`PASS all ${versions.length} Harness versions for ${pkg.name}`);
