import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

test("client bundle loads through the dsh ModuleLoader format", () => {
  const source = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
  let registered;
  const fakeReact = {
    createElement: (...args) => ({ __kind: "element", args }),
    useState: (value) => [value, () => {}],
    useEffect: () => {},
  };
  const context = {
    window: {
      __ModuleLoader__: {
        load(entry) {
          registered = entry;
        },
      },
    },
    console,
    Symbol,
    Object,
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "lib/client.js" });

  assert.ok(registered, "client bundle must self-register via window.__ModuleLoader__.load");
  assert.equal(registered.id, "dsh-kaomoji");
  assert.equal(typeof registered.factory, "function");

  const loaded = registered.factory((name) => {
    if (name === "react") return fakeReact;
    throw new Error(`unexpected client require: ${name}`);
  });
  assert.equal(loaded.apply, loaded.apply);
  assert.equal(typeof loaded.apply, "function");
  assert.deepEqual(Array.from(loaded.inject), ["slots", "locale"]);
  assert.equal(loaded.RPC_CHANNEL, "/dsh-kaomoji-settings");
  assert.equal(typeof loaded.createSettingsStore, "function");
});

test("client settings store serializes optimistic writes over the rpc handle", async () => {
  const source = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
  let registered;
  const context = {
    window: {
      __ModuleLoader__: {
        load(entry) {
          registered = entry;
        },
      },
    },
    console,
    Symbol,
    Object,
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "lib/client.js" });

  let revision = 0;
  const calls = [];
  const fetchImpl = async (url, init) => {
      assert.equal(url, "/dsh-kaomoji-settings");
      assert.equal(init.method, "POST");
      const { endpoint, payload } = JSON.parse(init.body);
      calls.push(endpoint);
      if (endpoint === "get") {
        return { status: 200, json: async () => ({
          ok: true,
          value: {
            settings: { mode: "auto", placement: "inline", maxPerTurn: 1, customPrompt: "" },
            revision,
            writable: true,
          },
        }) };
      }
      if (endpoint === "save") {
        revision += 1;
        return { status: 200, json: async () => ({
          ok: true,
          value: {
            settings: payload.settings,
            revision,
            writable: true,
          },
        }) };
      }
      throw new Error("unexpected endpoint");
  };
  const loaded = registered.factory((name) => {
    assert.equal(name, "react");
    return {
      createElement: (...args) => ({ __kind: "element", args }),
      useState: (value) => [value, () => {}],
      useEffect: () => {},
    };
  });
  const store = loaded.createSettingsStore(fetchImpl);
  await store.refresh();
  assert.equal(store.getSnapshot().settings.mode, "auto");
  assert.equal(store.getSnapshot().status, "ready");

  await store.patch({ mode: "frequent", placement: "end" });
  assert.equal(store.getSnapshot().settings.mode, "frequent");
  assert.equal(store.getSnapshot().settings.placement, "end");
  assert.equal(store.getSnapshot().justSaved, true);
  assert.deepEqual(calls, ["get", "save"]);
});

test("client settings store surfaces an untrusted origin as read-only", async () => {
  const source = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
  let registered;
  const context = {
    window: {
      __ModuleLoader__: {
        load(entry) {
          registered = entry;
        },
      },
    },
    console,
    Symbol,
    Object,
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "lib/client.js" });

  const loaded = registered.factory(() => ({
    createElement: (...args) => ({ __kind: "element", args }),
    useState: (value) => [value, () => {}],
    useEffect: () => {},
  }));
  const store = loaded.createSettingsStore(async () => ({
    status: 403,
    json: async () => ({ ok: false, error: { code: "forbidden", message: "forbidden origin" } }),
  }));
  await store.refresh();
  assert.equal(store.getSnapshot().status, "unavailable");
  assert.equal(store.getSnapshot().writable, false);
  assert.equal(store.getSnapshot().saveError, "forbidden");
  assert.equal(store.getSnapshot().saveErrorMessage, "forbidden origin");
  // 不可写时 patch/reset 不应产生任何写入。
  await store.patch({ mode: "frequent" });
  await store.reset();
  assert.equal(store.getSnapshot().settings.mode, "auto");
});
