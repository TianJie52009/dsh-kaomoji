import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
const pkg=JSON.parse(readFileSync(new URL("../package.json",import.meta.url)));
const NS=pkg.name;
const defaults={mode:"auto",placement:"inline",maxPerTurn:1,customPrompt:""};
function load(){
  let registration;
  const events={},effects=[];let slot;
  const context={window:{__ModuleLoader__:{load:value=>registration=value}},console,Symbol,Object};
  vm.createContext(context);vm.runInContext(readFileSync(new URL("../lib/client.js",import.meta.url),"utf8"),context);
  assert.equal(registration.id,NS);
  const plugin=registration.factory(name=>{assert.equal(name,"react");return {createElement:(...args)=>({args}),useState:x=>[x,()=>{}],useEffect:()=>{}};});
  return {plugin,effects,events,ctx:{effect(fn){const off=fn();if(typeof off==="function")effects.push(off);},locale:{register:()=>()=>{}},on(name,fn){events[name]=fn;return()=>{delete events[name];};},slots:{inject(name,fn){fn();},register(value){slot=value;return()=>{};}}},slot:()=>slot};
}
function remote(){
  let value={...defaults,migrationVersion:1},revision=0;
  const calls=[];
  const row=()=>({ns:NS,value:{...value},revision,base:defaults,user:value});
  const r={calls,reject:false,writable:true,
    describe:async()=>r.reject?{ok:false,error:{message:"disconnected"}}:{ok:true,value:{writable:r.writable,namespaces:[row()]}},
    async update(ns,patch,expected){calls.push(["update",patch,expected]);assert.equal(ns,NS);if(expected!==revision)return {ok:false,error:{code:"settings/conflict",message:"conflict"}};Object.assign(value,patch);revision++;return {ok:true,value:row()};},
    async replace(ns,patch,expected){calls.push(["replace",patch,expected]);assert.equal(ns,NS);assert.equal(expected,revision);value={...defaults,...patch};revision++;return {ok:true,value:row()};},
    external(){revision++;value.mode="off";},
  };return r;
}
test("client loads and injects native remote settings",async()=>{
  const l=load(),r=remote();l.ctx.remote={settings:r,$on:(name,fn)=>{l.events[name]=fn;return()=>delete l.events[name];}};
  l.plugin.apply(l.ctx);await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(Array.from(l.plugin.inject),["slots","locale","remote","remote.settings"]);
  assert.equal(l.slot().name,"settings.general.item");assert.equal(l.slot().id,NS);
  assert.equal(typeof l.events["settings/document-updated"],"function");
  l.effects.reverse().forEach(fn=>fn());assert.equal(l.events["settings/document-updated"],undefined);
});
test("rapid edits and reset share one write queue without losing unrelated fields",async()=>{
  const r=remote(),store=load().plugin.createSettingsStore(r);await store.refresh();
  await Promise.all([store.patch({mode:"frequent"}),store.patch({customPrompt:"custom"}),store.patch({maxPerTurn:5})]);
  assert.equal(store.getSnapshot().settings.mode,"frequent");assert.equal(store.getSnapshot().settings.customPrompt,"custom");
  assert.equal(store.getSnapshot().settings.maxPerTurn,5);assert.equal(r.calls.length,3);
  await Promise.all([store.patch({placement:"end"}),store.reset(),store.patch({mode:"off"})]);
  assert.equal(store.getSnapshot().settings.placement,defaults.placement);assert.equal(store.getSnapshot().settings.mode,"off");
  assert.equal(r.calls[4][0],"replace");assert.equal(r.calls[4][1].migrationVersion,1);
});
test("conflict is surfaced and retry reloads the Host values",async()=>{
  const r=remote(),s=load().plugin.createSettingsStore(r);await s.refresh();r.external();await s.patch({mode:"frequent"});
  assert.equal(s.getSnapshot().writable,false);assert.equal(s.getSnapshot().saveErrorMessage,"conflict");await s.refresh();
  assert.equal(s.getSnapshot().settings.mode,"off");assert.equal(s.getSnapshot().writable,true);
});
test("disconnection and read-only profiles disable writes; dispose ignores late results",async()=>{
  const r=remote(),s=load().plugin.createSettingsStore(r);r.reject=true;await s.refresh();assert.equal(s.getSnapshot().writable,false);
  r.reject=false;r.writable=false;await s.refresh();await s.patch({mode:"off"});assert.equal(r.calls.length,0);
  let count=0;s.subscribe(()=>count++);s.dispose();await s.refresh();assert.equal(count,0);
});
test("transport is carrier neutral and contains no direct HTTP or local storage",()=>{
  const source=readFileSync(new URL("../lib/client.js",import.meta.url),"utf8");assert.doesNotMatch(source,/fetch\(|localStorage|webServer/);
});
