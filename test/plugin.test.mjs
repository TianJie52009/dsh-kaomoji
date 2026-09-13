import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  CATALOG,
  DEFAULT_CONFIG,
  MODES,
  PLACEMENTS,
  SETTINGS_RPC_CHANNEL,
  SECTION_NAME,
  SECTION_ORDER,
  apply,
  buildGuidance,
  name,
  normalizeConfig,
} from "../lib/index.js";

test("package name and inject are stable", () => {
  assert.equal(name, "dsh-kaomoji");
  assert.deepEqual([...MODES], ["off", "auto", "frequent"]);
  assert.deepEqual([...PLACEMENTS], ["inline", "end"]);
  assert.equal(SECTION_NAME, "dsh-kaomoji:guidance");
  assert.equal(typeof SECTION_ORDER, "number");
});

test("catalog json stays in sync with code catalog", () => {
  const json = JSON.parse(
    readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8"),
  );
  assert.equal(json.schemaVersion, 1);
  assert.equal(json.categories.length, CATALOG.length);
  const codeById = new Map(CATALOG.map((group) => [group.id, group]));
  for (const category of json.categories) {
    const code = codeById.get(category.id);
    assert.ok(code, `missing code catalog entry: ${category.id}`);
    assert.deepEqual(category.examples, code.examples);
  }
  const ids = new Set(CATALOG.map((group) => group.id));
  assert.equal(ids.size, CATALOG.length, "catalog ids must be unique");
});

test("every kaomoji example is a non-empty literal", () => {
  for (const group of CATALOG) {
    assert.ok(group.label.length > 0);
    assert.ok(group.sourceUrl.startsWith("https://www.kaomojiya.org/"));
    assert.ok(group.examples.length >= 3, `${group.id} needs at least 3 examples`);
    for (const example of group.examples) {
      assert.ok(example.trim().length > 0, `${group.id} has an empty example`);
    }
  }
});

test("normalizeConfig validates and fills defaults", () => {
  assert.deepEqual(normalizeConfig(), { ...DEFAULT_CONFIG });
  assert.deepEqual(normalizeConfig(null), { ...DEFAULT_CONFIG });
  assert.equal(normalizeConfig({ mode: "bogus" }).mode, "auto");
  assert.equal(normalizeConfig({ placement: "middle" }).placement, "inline");
  assert.equal(normalizeConfig({ maxPerTurn: 99 }).maxPerTurn, 1);
  assert.equal(normalizeConfig({ maxPerTurn: 0 }).maxPerTurn, 1);
  assert.equal(normalizeConfig({ maxPerTurn: 4 }).maxPerTurn, 4);
  assert.equal(normalizeConfig({ customPrompt: 42 }).customPrompt, "");
});

test("buildGuidance returns empty when mode is off", () => {
  assert.equal(buildGuidance({ mode: "off" }), "");
});

test("buildGuidance covers mode, placement and whitelist", () => {
  const auto = buildGuidance({ mode: "auto" });
  assert.match(auto, /Kaomoji guidance/);
  assert.match(auto, /everyday recommendations or shopping advice/);
  assert.match(auto, /right after the sentence/);
  assert.match(auto, /Never exceed 1 kaomoji/);
  assert.match(auto, /code blocks, inline code, links, tables/);
  for (const group of CATALOG) {
    assert.ok(auto.includes(group.examples[0]), `missing example of ${group.id}`);
  }

  const frequent = buildGuidance({ mode: "frequent", placement: "end" });
  assert.match(frequent, /In every conversational reply/);
  assert.match(frequent, /at the very end of the reply/);

  const multi = buildGuidance({ mode: "frequent", maxPerTurn: 3 });
  assert.match(multi, /Use 3 kaomoji, one after each of 3 different emotion-carrying sentences/);
  assert.match(multi, /Distribute the kaomoji across the reply/);
  assert.match(multi, /Never exceed 3 kaomoji/);
});

test("customPrompt is appended without changing core rules", () => {
  const guidance = buildGuidance({
    mode: "frequent",
    customPrompt: "不要卖萌",
  });
  assert.match(guidance, /User-provided kaomoji guidance:\n不要卖萌/);
  assert.match(guidance, /cannot change the mode, the whitelist, or the per-reply limit/);
});

test("apply registers exactly one system prompt section", () => {
  const sections = [];
  let rpcOptions;
  const dir = mkdtempSync(join(tmpdir(), "dsh-kaomoji-test-"));
  const fakeCtx = {
    logger: { info() {} },
    emit() {},
    effect(register, label) {
      assert.equal(label, "dsh-kaomoji: guidance");
      return register();
    },
    systemPrompt: {
      section(section) {
        sections.push(section);
        return () => {};
      },
    },
    inject(services, register) {
      if (Array.isArray(services) && services.includes("connection")) {
        register({
          effect(callback) {
            return callback();
          },
          connection: {
            rpc: {
              handle(_channel, _handler, options) {
                rpcOptions = options;
                return () => {};
              },
            },
          },
        });
      }
    },
  };

  try {
    apply(fakeCtx, { mode: "frequent", placement: "end", settingsFile: join(dir, "state.json") });
    assert.equal(sections.length, 1);
    assert.equal(sections[0].name, SECTION_NAME);
    assert.equal(sections[0].order, SECTION_ORDER);
    assert.match(sections[0].text(), /In every conversational reply/);
    // 默认 trusted-host：本机与 Tailscale 这类受信主机都能保存设置。
    assert.equal(rpcOptions.authority, "trusted-host");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("mode off registers an empty section but keeps the settings RPC alive", async () => {
  const dir = mkdtempSync(join(tmpdir(), "dsh-kaomoji-test-"));
  let section;
  let handler;
  const fakeCtx = {
    logger: { info() {}, warn() {} },
    emit() {},
    effect(register) {
      return register();
    },
    systemPrompt: {
      section(value) {
        section = value;
        return () => {};
      },
    },
    inject(services, register) {
      if (Array.isArray(services) && services.includes("connection")) {
        const connectionCtx = {
          effect(callback) {
            return callback();
          },
          connection: {
            rpc: {
              handle(channel, value) {
                assert.equal(channel, SETTINGS_RPC_CHANNEL);
                handler = value;
                return () => {};
              },
            },
          },
        };
        register(connectionCtx);
      }
    },
  };

  try {
    apply(fakeCtx, { mode: "off", settingsFile: join(dir, "state.json") });
    assert.ok(section);
    assert.equal(section.text(), "");
    assert.equal(typeof handler, "function");

    // 卡片可以在不重启的情况下把插件从 off 切回 frequent。
    const initial = await handler("get", {});
    assert.equal(initial.ok, true);
    const saved = await handler("save", {
      settings: { mode: "frequent", placement: "end", maxPerTurn: 1, customPrompt: "" },
      expectedRevision: initial.value.revision,
    });
    assert.equal(saved.ok, true);
    assert.match(section.text(), /In every conversational reply/);
    assert.match(section.text(), /at the very end of the reply/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings RPC rejects stale revisions and accepts reset", async () => {
  const dir = mkdtempSync(join(tmpdir(), "dsh-kaomoji-test-"));
  let handler;
  const fakeCtx = {
    logger: { info() {}, warn() {} },
    emit() {},
    effect(register) {
      return register();
    },
    systemPrompt: {
      section() {
        return () => {};
      },
    },
    inject(services, register) {
      if (Array.isArray(services) && services.includes("connection")) {
        const connectionCtx = {
          effect(callback) {
            return callback();
          },
          connection: {
            rpc: {
              handle(_channel, value) {
                handler = value;
                return () => {};
              },
            },
          },
        };
        register(connectionCtx);
      }
    },
  };

  try {
    apply(fakeCtx, { mode: "auto", settingsFile: join(dir, "state.json") });
    const before = await handler("get", {});
    const stale = await handler("save", {
      settings: { mode: "frequent", placement: "end", maxPerTurn: 2, customPrompt: "" },
      expectedRevision: before.value.revision + 9,
    });
    assert.equal(stale.ok, false);
    assert.equal(stale.error.code, "settings-conflict");

    const saved = await handler("save", {
      settings: { mode: "frequent", placement: "end", maxPerTurn: 2, customPrompt: "少卖萌" },
      expectedRevision: before.value.revision,
    });
    assert.equal(saved.ok, true);
    assert.equal(saved.value.settings.mode, "frequent");
    assert.equal(saved.value.settings.customPrompt, "少卖萌");

    const reset = await handler("reset", {
      expectedRevision: saved.value.revision,
    });
    assert.equal(reset.ok, true);
    assert.equal(reset.value.settings.mode, "auto");
    assert.equal(reset.value.settings.customPrompt, "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
