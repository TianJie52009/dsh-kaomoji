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

/** Minimal host ctx: captures the settings route and the prompt section. */
function makeHostCtx() {
  let route;
  let section;
  const ctx = {
    emit() {},
    effect(register) {
      return register();
    },
    get() {
      return undefined;
    },
    systemPrompt: {
      section(value) {
        section = value;
        return () => {};
      },
    },
    inject(services, register) {
      if (Array.isArray(services) && services.includes("webServer")) {
        register({
          effect(callback) {
            return callback();
          },
          webServer: {
            register(value) {
              route = value;
              return () => {};
            },
          },
        });
      }
    },
  };
  return { ctx, route: () => route, section: () => section };
}

/** Drive one POST through the captured settings route. */
async function postSettings(route, body) {
  const request = {
    method: "POST",
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(JSON.stringify(body));
    },
  };
  let status;
  let payload;
  const response = {
    writeHead(code) {
      status = code;
    },
    end(text) {
      payload = JSON.parse(text);
    },
  };
  await route.handler(request, response);
  return { status, payload };
}

test("apply registers exactly one system prompt section", () => {
  const sections = [];
  let route;
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
      if (Array.isArray(services) && services.includes("webServer")) {
        register({
          effect(callback) {
            return callback();
          },
          webServer: {
            register(value) {
              route = value;
              return () => {};
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
    assert.equal(route.kind, "exact");
    assert.equal(route.path, SETTINGS_RPC_CHANNEL);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("mode off registers an empty section but keeps the settings RPC alive", async () => {
  const dir = mkdtempSync(join(tmpdir(), "dsh-kaomoji-test-"));
  const host = makeHostCtx();

  try {
    apply(host.ctx, { mode: "off", settingsFile: join(dir, "state.json") });
    const section = host.section();
    assert.ok(section);
    assert.equal(section.text(), "");
    assert.equal(host.route().path, SETTINGS_RPC_CHANNEL);

    // 卡片可以在不重启的情况下把插件从 off 切回 frequent。
    const initial = await postSettings(host.route(), { endpoint: "get", payload: {} });
    assert.equal(initial.payload.ok, true);
    const saved = await postSettings(host.route(), {
      endpoint: "save",
      payload: {
        settings: { mode: "frequent", placement: "end", maxPerTurn: 1, customPrompt: "" },
        expectedRevision: initial.payload.value.revision,
      },
    });
    assert.equal(saved.payload.ok, true);
    assert.match(section.text(), /In every conversational reply/);
    assert.match(section.text(), /at the very end of the reply/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings RPC rejects stale revisions and accepts reset", async () => {
  const dir = mkdtempSync(join(tmpdir(), "dsh-kaomoji-test-"));
  const host = makeHostCtx();

  try {
    apply(host.ctx, { mode: "auto", settingsFile: join(dir, "state.json") });
    const before = (await postSettings(host.route(), { endpoint: "get", payload: {} })).payload;
    const stale = (await postSettings(host.route(), {
      endpoint: "save",
      payload: {
        settings: { mode: "frequent", placement: "end", maxPerTurn: 2, customPrompt: "" },
        expectedRevision: before.value.revision + 9,
      },
    })).payload;
    assert.equal(stale.ok, false);
    assert.equal(stale.error.code, "settings-conflict");

    const saved = (await postSettings(host.route(), {
      endpoint: "save",
      payload: {
        settings: { mode: "frequent", placement: "end", maxPerTurn: 2, customPrompt: "少卖萌" },
        expectedRevision: before.value.revision,
      },
    })).payload;
    assert.equal(saved.ok, true);
    assert.equal(saved.value.settings.mode, "frequent");
    assert.equal(saved.value.settings.customPrompt, "少卖萌");

    const reset = (await postSettings(host.route(), {
      endpoint: "reset",
      payload: { expectedRevision: saved.value.revision },
    })).payload;
    assert.equal(reset.ok, true);
    assert.equal(reset.value.settings.mode, "auto");
    assert.equal(reset.value.settings.customPrompt, "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
