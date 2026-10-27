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
test("native config schema rejects invalid settings", async () => {
  const { Config } = await import("../lib/index.js");
  const value = Config({});
  assert.equal(value.mode.get(), DEFAULT_CONFIG.mode);
  for (const input of [{ mode: "bad" }, { placement: "bad" }, { maxPerTurn: 0 }, { maxPerTurn: 1.5 }, { maxPerTurn: 6 }, { customPrompt: "x".repeat(4001) }]) {
    assert.throws(() => Config(input));
  }
});

test("manifest covers only the nine agreed Harness releases and uses native remotes", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const releases = ["0.2.0-rc.2", ...[1,2,3,4,5].map(n => "0.2.1-alpha." + n), ...[1,2,3].map(n => "0.2.1-rc." + n)];
  assert.deepEqual(pkg.engines.dsh.split(" || "), releases);
  for (const [peer, range] of Object.entries(pkg.peerDependencies)) {
    if (peer.startsWith("@deepseek-ai/dsh-")) assert.equal(range, pkg.engines.dsh);
  }
  assert.equal(pkg.peerDependencies["@deepseek-ai/dsh-host-webserver"], undefined);
  assert.ok(pkg.dsh.client.inject.includes("@deepseek-ai/dsh-api-remotes"));
  for (const peer of pkg.dsh.client.inject) assert.ok(pkg.peerDependencies[peer]);
  assert.equal(pkg.dsh.manifestVersion, 1);
});
