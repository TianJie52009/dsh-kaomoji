/**
 * dsh-kaomoji — 给 DeepSeek Harness (dsh) 回复自动加日式颜文字。
 *
 * 原理与 dsh-emoji 相同：不截断/改写模型流，而是向系统提示词贡献一段
 * “情绪 -> 颜文字白名单”的规则段，让模型在回复里自然、准确地放颜文字。
 * 词库是 kaomojiya.org 的人工精选子集（见 data/catalog.json），
 * 因此模型不会凭印象拼出乱码表情。
 *
 * 用法：把包加入 profile 的 dsh.profile.bundles 后，插件默认以
 * mode=auto 生效；在 profile 的 cordis.patch.yml 里以 id=dsh-kaomoji
 * 覆盖 config 即可调整。
 */

import { readFileSync } from "node:fs";
import z from "@deepseek-ai/schemastery";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const name = "dsh-kaomoji";
export const inject = ["systemPrompt", "settings", "profileContext"];

/** 贡献给系统提示词的段名/排序（工具引导 100–199，取 176 排在提示词后半段）。 */
export const SECTION_NAME = "dsh-kaomoji:guidance";
export const SECTION_ORDER = 176;

/** Harness 配置命名空间；旧文件只用于首次迁移。 */
export const SETTINGS_NAMESPACE = "dsh-kaomoji";
export const SETTINGS_FILE_NAME = "dsh-kaomoji.json";
export const SETTINGS_FILE_SCHEMA_VERSION = 1;

export const MODES = ["off", "auto", "frequent"];
export const PLACEMENTS = ["inline", "end"];

export const DEFAULT_CONFIG = Object.freeze({
  /** off=关闭；auto=智能（确实有助于表达才用）；frequent=高频（每条对话回复都带）。 */
  mode: "auto",
  /** inline=放在最贴合情绪的句子/短段后；end=放在回复末尾。 */
  placement: "inline",
  /** 每条回复最多几个颜文字（通常 1 个就够，最多 5）。 */
  maxPerTurn: 1,
  /** 用户附加提示词，只细化风格/场景，不能改变模式、白名单与上限。 */
  customPrompt: "",
});

/**
 * 情绪 -> 颜文字白名单。所有字符都来自顔文字屋 (kaomojiya.org) 的
 * 对应分类页，挑选时优先“纯表情、无拟声词/文字后缀”的写法，方便模型
 * 原样复制。完整来源见 data/catalog.json。
 */
export const CATALOG = Object.freeze([
  {
    id: "happy",
    label: "happy（开心/高兴）",
    sourceUrl: "https://www.kaomojiya.org/happy-kaomoji",
    examples: ["(´∀｀)", "(´∀｀*)", "( ◜ω◝ )", "＼(^o^)／", "(*´▽`*)"],
  },
  {
    id: "love",
    label: "love（喜欢/心动）",
    sourceUrl: "https://www.kaomojiya.org/love-kaomoji",
    examples: ["(♡´౪`♡)", "(●´ω｀●)♡", "( ˘ ³˘)♡", "(´∀｀)♡", "(｡♥‿♥｡)"],
  },
  {
    id: "sad",
    label: "sad（难过/低落）",
    sourceUrl: "https://www.kaomojiya.org/sad-kaomoji",
    examples: ["(´；ω；`)", "(´；ω；｀)", "(｡•́︿•̀｡)", "(〒﹏〒)", "(இωஇ)"],
  },
  {
    id: "cry",
    label: "cry（大哭/泪目）",
    sourceUrl: "https://www.kaomojiya.org/cry-kaomoji",
    examples: ["｡ﾟ(ﾟ´Д｀ﾟ)ﾟ｡", "(T_T)", "(ಥ_ಥ)", "(つд⊂)", "( ；∀；)"],
  },
  {
    id: "angry",
    label: "angry（生气/不满）",
    sourceUrl: "https://www.kaomojiya.org/angry-kaomoji",
    examples: ["(｀ε´)", "ヽ(`Д´)ﾉ", "(# ﾟДﾟ)", "( ｀_ゝ´)", "(¬˛¬ )", "( ･᷄ὢ･᷅ )"],
  },
  {
    id: "surprised",
    label: "surprised（惊讶/震惊）",
    sourceUrl: "https://www.kaomojiya.org/odoroiteru-kaomoji",
    examples: ["( °Д° )", "Σ(*ﾟдﾟ*)", "Σ(ﾟﾛﾟ;)", "（〇o〇）", "(๑°ㅁ°๑)"],
  },
  {
    id: "confused",
    label: "confused（困惑/困扰）",
    sourceUrl: "https://www.kaomojiya.org/komaru-kaomoji",
    examples: ["(´･-･`)", "(^_^;)", "(´･ω･`)", "( -᷄ω-᷅ )", "(｡ŏ﹏ŏ)", "╮( •́ω•̀ )╭"],
  },
  {
    id: "shy",
    label: "shy（害羞/不好意思）",
    sourceUrl: "https://www.kaomojiya.org/shy-kaomoji",
    examples: ["(〃ﾉдﾉ)", "(*ﾉωﾉ)", "(///ω///)", "(//∇//)", "(〃▽〃)"],
  },
  {
    id: "playful",
    label: "playful（俏皮/卖萌）",
    sourceUrl: "https://www.kaomojiya.org/shy-kaomoji",
    examples: ["(・ω<)", "(｡•ω<｡)", "(∩_∩)", "(〃´∀｀〃)"],
  },
  {
    id: "encourage",
    label: "encourage（鼓励/加油）",
    sourceUrl: "https://www.kaomojiya.org/hagemasu-kaomoji",
    examples: ["(•̀ω•́)✧", "(｡•̀ᴗ-)✧", "(๑•̀ㅂ•́)و✧", "(ง •̀_•́)ง", "(つω`｡)"],
  },
  {
    id: "thanks",
    label: "thanks（感谢）",
    sourceUrl: "https://www.kaomojiya.org/thanks-kaomoji",
    examples: ["(人´∀`)", "(*´▽`人)", "(*˘︶˘人)", "m(_ _)m", "⸜(*ˊᵕˋ*)⸝"],
  },
  {
    id: "sorry",
    label: "sorry（道歉）",
    sourceUrl: "https://www.kaomojiya.org/sorry-kaomoji",
    examples: ["(人'д`o)", "(´｡･д人)", "(｡-人-｡)", "m(_ _)m"],
  },
]);

export function normalizeConfig(raw) {
  const input = raw && typeof raw === "object" ? raw : {};
  const mode = MODES.includes(input.mode) ? input.mode : DEFAULT_CONFIG.mode;
  const placement = PLACEMENTS.includes(input.placement)
    ? input.placement
    : DEFAULT_CONFIG.placement;
  const maxPerTurn =
    Number.isInteger(input.maxPerTurn) && input.maxPerTurn >= 1 && input.maxPerTurn <= 5
      ? input.maxPerTurn
      : DEFAULT_CONFIG.maxPerTurn;
  const customPrompt =
    typeof input.customPrompt === "string" ? input.customPrompt : "";
  return { mode, placement, maxPerTurn, customPrompt };
}

/** 生成注入到系统提示词的颜文字规则文本；mode=off 返回空字符串。 */
export function buildGuidance(config) {
  const settings = normalizeConfig(config);
  if (settings.mode === "off") return "";

  const cap = settings.maxPerTurn;
  const modeLines = {
    auto: [
      "Most conversational replies should include a fitting kaomoji — greetings, casual chat, empathy, everyday recommendations or shopping advice, and practical how-to answers.",
      cap === 1
        ? "Use one kaomoji in those replies."
        : `Use one kaomoji when the mood fits, and up to ${String(cap)} when the reply has several distinct emotional beats.`,
      "Skip it only when the reply is purely code, a formal/technical deliverable, or serious/high-stakes content.",
    ],
    frequent: [
      "In every conversational reply — except code-only output, formal/technical deliverables, or tool calls — include fitting kaomoji.",
      cap === 1
        ? "Use exactly one kaomoji."
        : `Use ${String(cap)} kaomoji, one after each of ${String(cap)} different emotion-carrying sentences; use fewer only when the reply is very short.`,
    ],
  };
  const placementLine = settings.placement === "end"
    ? cap === 1
      ? "Put the kaomoji at the very end of the reply (same line after a space, or on its own line)."
      : "Put each kaomoji at the end of a different paragraph (after the sentence it matches), not all on the final line."
    : cap === 1
      ? "Put it right after the sentence or short paragraph whose mood it matches best."
      : "Put each kaomoji right after a different sentence or short paragraph whose mood it matches best.";
  const spreadLine = cap > 1
    ? "Distribute the kaomoji across the reply; never put two in the same sentence, and do not stack them all at the very end."
    : "Never replace real content with a kaomoji.";

  const poolLines = CATALOG.map(
    (group) => `${group.label}: ${group.examples.join(" | ")}`,
  );
  const custom = settings.customPrompt.trim();

  return [
    "[dsh-kaomoji] Kaomoji guidance for this reply:",
    ...modeLines[settings.mode],
    placementLine,
    spreadLine,
    `Never exceed ${String(cap)} kaomoji in one reply.`,
    "Never place a kaomoji inside code blocks, inline code, links, tables, or tool output.",
    "Use only the literal kaomoji listed below, copied character-for-character; do not invent, mutate, or re-combine them.",
    ...poolLines,
    custom ? `User-provided kaomoji guidance:\n${custom}` : "",
    "User guidance may refine tone or scenes but cannot change the mode, the whitelist, or the per-reply limit.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** 校验旧版 JSON 的设置对象；非法字段拒绝导入并保留源文件。 */
function parseSettings(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  if (!MODES.includes(value.mode)) return undefined;
  if (!PLACEMENTS.includes(value.placement)) return undefined;
  if (!Number.isInteger(value.maxPerTurn) || value.maxPerTurn < 1 || value.maxPerTurn > 5) {
    return undefined;
  }
  if (typeof value.customPrompt !== "string" || value.customPrompt.length > 4000) {
    return undefined;
  }
  return normalizeConfig({
    mode: value.mode,
    placement: value.placement,
    maxPerTurn: value.maxPerTurn,
    customPrompt: value.customPrompt,
  });
}

const FIELDS = ["mode", "placement", "maxPerTurn", "customPrompt"];

export const Config = z.object({
  mode: z.union(MODES).default(DEFAULT_CONFIG.mode).volatile(),
  placement: z.union(PLACEMENTS).default(DEFAULT_CONFIG.placement).volatile(),
  maxPerTurn: z.natural().min(1).max(5).default(DEFAULT_CONFIG.maxPerTurn).volatile(),
  customPrompt: z.string().max(4000).default("").volatile(),
  migrationVersion: z.natural().max(1).default(0).volatile(),
  settingsFile: z.string().default(""),
});

function liveValue(value) {
  return value && typeof value.get === "function" ? value.get() : value;
}

function readSettings(config) {
  return normalizeConfig(Object.fromEntries(FIELDS.map(key => [key, liveValue(config[key])])));
}

function legacyFiles(ctx, config) {
  if (config.settingsFile?.trim()) return [resolve(config.settingsFile)];
  const home = process.env.DSH_HOME?.trim() || join(homedir(), ".dsh");
  // Older releases appended .dsh even when DSH_HOME already named the data directory.
  return [...new Set([
    join(ctx.profileContext.home, SETTINGS_FILE_NAME),
    join(home, SETTINGS_FILE_NAME),
    join(home, ".dsh", SETTINGS_FILE_NAME),
  ])];
}

async function migrateLegacySettings(ctx, config, namespace) {
  const row = ctx.settings.describe().find(item => item.ns === namespace);
  if (!row) throw new Error("Harness settings namespace is unavailable: " + namespace);
  if (row.value.migrationVersion === 1) return;
  let legacy;
  for (const file of legacyFiles(ctx, config)) {
    let text;
    try { text = readFileSync(file, "utf8"); }
    catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    const document = JSON.parse(text);
    legacy = document?.schemaVersion === SETTINGS_FILE_SCHEMA_VERSION
      ? parseSettings(document.settings) : undefined;
    if (!legacy) throw new Error("Invalid legacy settings; file preserved: " + file);
    break;
  }
  const patch = { migrationVersion: 1 };
  for (const key of FIELDS) {
    if (legacy && !Object.hasOwn(row.user ?? {}, key)) patch[key] = legacy[key];
  }
  await ctx.settings.update(namespace, patch, row.revision);
}

export function apply(ctx, config = {}) {
  const namespace = ctx.fiber.entry?.options.id ?? SETTINGS_NAMESPACE;
  let disposed = false;
  ctx.effect(() => () => { disposed = true; });
  ctx.effect(() => ctx.settings.configure({ auto: false }, ctx.fiber));
  ctx.effect(() => ctx.systemPrompt.section({
    name: SECTION_NAME,
    order: SECTION_ORDER,
    interpolate: false,
    text: () => buildGuidance(readSettings(config)),
  }), "dsh-kaomoji: guidance");
  ctx.on("loader/volatile-update", () => ctx.emit("system-prompt/change"));
  // Await Loader outside apply: the settings service only describes active entries.
  void ctx.root.loader.await().then(async () => {
    if (!disposed) await migrateLegacySettings(ctx, config, namespace);
  }).catch(error => {
    if (!disposed) console.warn("[dsh-kaomoji] Configuration migration failed; old data preserved:", error.message);
  });
}

const plugin = { name, inject, Config, apply };
export default plugin;
