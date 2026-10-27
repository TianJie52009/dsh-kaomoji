import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const runtime = process.env.DSH_RUNTIME_DIR;
if (!runtime) throw new Error('Run npm run test:compat or set DSH_RUNTIME_DIR to an isolated Harness runtime.');
const require = createRequire(join(runtime, 'package.json'));
const load = name => import(pathToFileURL(require.resolve(name)).href);
const {boot, initProfile, readProfilePatches, evaluatePluginCompatibility} = await load('@deepseek-ai/dsh-app-boot');
const {default: ConfigEditor} = await load('@deepseek-ai/dsh-config-editor');
const {default: Settings} = await load('@deepseek-ai/dsh-settings');
const {default: SystemPrompt} = await load('@deepseek-ai/dsh-system-prompt');
const pluginRoot = fileURLToPath(new URL('../', import.meta.url));
const plugin = await import(pathToFileURL(join(pluginRoot,'lib/index.js')).href);
const pkg = JSON.parse(readFileSync(join(pluginRoot,'package.json')));
const runtimeVersion = require("@deepseek-ai/dsh-settings/package.json").version;
assert.equal(evaluatePluginCompatibility(pkg, {}, runtimeVersion), undefined, "real Host peer gate must accept this release");
const home=realpathSync(mkdtempSync(join(tmpdir(),'dsh-native-integration-')));
const dir=join(home,'profiles','test');
let ctx;
try {
  initProfile(dir,['test-bundle']);
  const bundle=join(dir,'node_modules','test-bundle');mkdirSync(bundle,{recursive:true});
  writeFileSync(join(home,'package.json'),'{"name":"test-installation"}');
  writeFileSync(join(bundle,'package.json'),JSON.stringify({name:'test-bundle',version:'1.0.0',dsh:{bundle:{patch:'cordis.patch.yml'}}}));
  writeFileSync(join(bundle,'cordis.patch.yml'),JSON.stringify([{insert:[
    {id:'config-editor',name:'cordis:editor'},
    {id:'settings',name:'cordis:settings'},
    {id:'prompt',name:'cordis:prompt'},
    {id:pkg.name,name:'cordis:subject'},
  ]}]));
  writeFileSync(join(dir,'cordis.yml'),'[]\n');
  writeFileSync(join(home,plugin.SETTINGS_FILE_NAME),JSON.stringify({schemaVersion:1,revision:9,settings:{...plugin.DEFAULT_CONFIG,mode:'frequent',customPrompt:'legacy {{literal}}'}}));
  const profile={name:'test',startedBundles:['test-bundle'],dir,patchPath:join(dir,'cordis.patch.yml'),installAnchor:join(home,'package.json'),cwd:home,home,overlays:[],telemetryDisabledEnv:undefined};
  const start=()=>boot('test',join(dir,'cordis.yml'),readProfilePatches('test',profile),root=>{
    root.provide('profileContext',profile);
    root.provide('appReady',{onReady:listener=>{listener();return()=>{};}});
    Object.assign(root.loader.builtins,{editor:ConfigEditor,settings:Settings,prompt:SystemPrompt,subject:plugin});
  });
  ctx=await start();
  for(let i=0;i<100;i++){
    if(ctx.settings.describe().find(r=>r.ns===pkg.name)?.value.migrationVersion===1)break;
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  let row=ctx.settings.describe().find(r=>r.ns===pkg.name);
  assert.ok(row, 'namespace must be served');
  assert.equal(row.autoGenerate,false);
  assert.equal(row.value.migrationVersion,1);
  assert.equal(row.value.mode,'frequent');
  assert.equal(row.value.customPrompt,'legacy {{literal}}');
  const entry=[...ctx.loader.entries()].find(e=>e.options.id===pkg.name);
  const fiber=entry.fiber;
  const ref=fiber.config.mode;
  await ctx.settings.update(pkg.name,{mode:'off'},row.revision);
  assert.equal(entry.fiber,fiber,'volatile updates must not remount');
  assert.equal(ref.get(),'off','existing consumers must see the update');
  await assert.rejects(ctx.settings.update(pkg.name,{mode:'auto'},row.revision),/changed since/);
  await assert.rejects(ctx.settings.update(pkg.name,{maxPerTurn:999}),/between|at most|less|maximum|<=|range/i);
  assert.match(readFileSync(profile.patchPath,'utf8'),/migrationVersion: 1/);
  await ctx.fiber.dispose();ctx=await start();
  await new Promise(resolve=>setTimeout(resolve,30));
  row=ctx.settings.describe().find(r=>r.ns===pkg.name);
  assert.equal(row.value.mode,'off','saved settings must survive restart');
  await ctx.settings.replace(pkg.name,{migrationVersion:1},row.revision);
  await ctx.fiber.dispose();ctx=await start();
  await new Promise(resolve=>setTimeout(resolve,30));
  row=ctx.settings.describe().find(r=>r.ns===pkg.name);
  assert.equal(row.value.mode,plugin.DEFAULT_CONFIG.mode,'reset must not reimport legacy data');
  assert.equal(row.value.customPrompt,'');
  console.log('PASS native integration',pkg.name, require('@deepseek-ai/dsh-settings/package.json').version);
} finally {
  if(ctx)await ctx.fiber.dispose();
  rmSync(home,{recursive:true,force:true});
}
