import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { updateVolatile } from "@deepseek-ai/cosmokit";
import { apply, Config, DEFAULT_CONFIG, SETTINGS_NAMESPACE, SETTINGS_FILE_NAME, SECTION_NAME } from "../lib/index.js";

function fixture(t, user = {}, base = {}) {
  const home = mkdtempSync(join(tmpdir(), "native-settings-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const saved = { ...user };
  const config = Config({ settingsFile: join(home, SETTINGS_FILE_NAME), ...base, ...user });
  let revision = 0, section, disposed = false;
  const callbacks = [], warnings = [], writes = [];
  const ctx = {
    fiber: { entry: { options: { id: SETTINGS_NAMESPACE } } },
    profileContext: { home },
    root: { loader: { await: () => Promise.resolve() } },
    effect(register) { const off=register(); if(typeof off === "function") callbacks.push(off); return off; },
    on() { return () => {}; }, emit() {},
    systemPrompt: { section(value) { section=value; return () => {}; } },
    settings: {
      configure(value) { assert.equal(value.auto, false); return () => {}; },
      describe() { return [{ns: SETTINGS_NAMESPACE, revision, value: { ...DEFAULT_CONFIG, ...base, ...saved }, user: {...saved}}]; },
      async update(ns, patch, expected) {
        assert.equal(ns, SETTINGS_NAMESPACE);
        if (ctx.rejectWrite) throw new Error("disk read-only");
        if (expected !== revision) throw new Error("stale revision");
        writes.push(patch); Object.assign(saved,patch); revision++;
        for (const [key,value] of Object.entries(patch)) if(config[key]?.get) updateVolatile(config[key],Config({[key]:value})[key]);
      },
    },
  };
  t.mock.method(console,"warn", (...args) => warnings.push(args.join(" ")));
  return {home,config,ctx,saved,writes,warnings,section:()=>section,
    start:async()=>{apply(ctx,config); await new Promise(resolve=>setImmediate(resolve));},
    dispose:()=>{if(!disposed){disposed=true; callbacks.reverse().forEach(fn=>fn());}},
  };
}

function legacy(file, settings = {}) {
  mkdirSync(join(file,".."),{recursive:true});
  writeFileSync(file, JSON.stringify({schemaVersion:1, revision:4, settings:{...DEFAULT_CONFIG,mode:"frequent",customPrompt:"old {{literal}}",...settings}}));
}

test("imports legacy JSON once through native settings and preserves the file",async t=>{
  const f=fixture(t); const file=join(f.home,SETTINGS_FILE_NAME); legacy(file);
  const before=readFileSync(file,"utf8"); await f.start();
  assert.equal(f.saved.mode,"frequent"); assert.equal(f.saved.migrationVersion,1);
  assert.equal(f.saved.customPrompt,"old {{literal}}"); assert.equal(readFileSync(file,"utf8"),before);
  assert.equal(f.section().name,SECTION_NAME); assert.equal(f.section().interpolate,false);
  assert.match(f.section().text(),/old {{literal}}/);
  f.dispose(); await f.start(); assert.equal(f.writes.length,1);
});

test("new user fields win, old data fills only missing fields",async t=>{
  const f=fixture(t,{mode:"off",customPrompt:"new"});legacy(join(f.home,SETTINGS_FILE_NAME),{placement:"end"});
  await f.start(); assert.equal(f.saved.mode,"off");assert.equal(f.saved.customPrompt,"new");assert.equal(f.saved.placement,"end");
  assert.equal(f.section().text(),"");updateVolatile(f.config.mode,Config({mode:"frequent"}).mode);assert.notEqual(f.section().text(),"");
});

test("migration marker prevents reimport after reset or upgrade",async t=>{
  const f=fixture(t,{migrationVersion:1});legacy(join(f.home,SETTINGS_FILE_NAME));await f.start();
  assert.equal(f.writes.length,0);assert.equal(f.config.mode.get(),DEFAULT_CONFIG.mode);
});

test("missing file is marked done without overwriting deployment settings",async t=>{
  const f=fixture(t,{}, {mode:"off"});await f.start();assert.deepEqual(f.writes,[{migrationVersion:1}]);assert.equal(f.section().text(),"");
});

test("custom legacy path is honored",async t=>{
  const f=fixture(t);f.config.settingsFile=join(f.home,"custom.json");legacy(f.config.settingsFile);await f.start();assert.equal(f.saved.mode,"frequent");
});

test("old nested DSH_HOME path is recovered",async t=>{
  const f=fixture(t);const previous=process.env.DSH_HOME;process.env.DSH_HOME=f.home;t.after(()=>{if(previous===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=previous;});f.config.settingsFile="";legacy(join(f.home,".dsh",SETTINGS_FILE_NAME));await f.start();assert.equal(f.saved.mode,"frequent");
});

test("invalid legacy file is reported and never overwritten or marked migrated",async t=>{
  const f=fixture(t);const file=join(f.home,SETTINGS_FILE_NAME);writeFileSync(file,"{broken");await f.start();
  assert.equal(f.writes.length,0);assert.equal(readFileSync(file,"utf8"),"{broken");assert.equal(f.warnings.length,1);
});

test("failed native write leaves legacy data available for retry",async t=>{
  const f=fixture(t);legacy(join(f.home,SETTINGS_FILE_NAME));f.ctx.rejectWrite=true;await f.start();
  assert.equal(f.saved.migrationVersion,undefined);assert.equal(f.warnings.length,1);assert.ok(existsSync(join(f.home,SETTINGS_FILE_NAME)));
  f.ctx.rejectWrite=false;await f.start();assert.equal(f.saved.mode,"frequent");
});

test("disposed plugin cancels deferred migration",async t=>{
  const f=fixture(t);let ready;f.ctx.root.loader.await=()=>new Promise(resolve=>ready=resolve);
  apply(f.ctx,f.config);f.dispose();ready();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.writes.length,0);
});
