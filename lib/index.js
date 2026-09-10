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

import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export const name = "dsh-kaomoji";
export const inject = ["systemPrompt"];

/** 贡献给系统提示词的段名/排序（工具引导 100–199，取 176 排在提示词后半段）。 */
export const SECTION_NAME = "dsh-kaomoji:guidance";
export const SECTION_ORDER = 176;

/** 设置命名空间与客户端 RPC 通道（与 dsh-emoji 的 /dsh-emoji-settings 互不冲突）。 */
export const SETTINGS_NAMESPACE = "dsh-kaomoji";
export const SETTINGS_RPC_CHANNEL = "/dsh-kaomoji-settings";
export const SETTINGS_FILE_NAME = "dsh-kaomoji.json";
export const SETTINGS_FILE_SCHEMA_VERSION = 1;

export const MODES = ["off", "auto", "frequent"];
export const PLACEMENTS = ["inline", "end"];
/** 设置 RPC 的信任范围：trusted-host = 本机 + 服务端声明的受信主机（如 Tailscale）。 */
export const SETTINGS_AUTHORITIES = ["trusted-host", "loopback"];

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

  const modeLines = {
    auto: [
      "Most friendly, casual, empathetic, or playful replies should include one fitting kaomoji.",
      "Skip it only when the reply is purely code, a formal/technical deliverable, or serious/high-stakes content.",
      "One per reply is usually enough; never replace real content with it.",
    ],
    frequent: [
      "In every conversational reply — except code-only output, formal/technical deliverables, or tool calls — include one fitting kaomoji.",
    ],
  };
  const placementLine =
    settings.placement === "end"
      ? "Put the kaomoji at the very end of the reply (same line after a space, or on its own line)."
      : "Put it right after the sentence or short paragraph whose mood it matches best.";

  const poolLines = CATALOG.map(
    (group) => `${group.label}: ${group.examples.join(" | ")}`,
  );
  const custom = settings.customPrompt.trim();

  return [
    "[dsh-kaomoji] Kaomoji guidance for this reply:",
    ...modeLines[settings.mode],
    placementLine,
    `Use at most ${String(settings.maxPerTurn)} kaomoji per reply.`,
    "Never place a kaomoji inside code blocks, inline code, links, tables, or tool output.",
    "Use only the literal kaomoji listed below, copied character-for-character; do not invent, mutate, or re-combine them.",
    ...poolLines,
    custom ? `User-provided kaomoji guidance:\n${custom}` : "",
    "User guidance may refine tone or scenes but cannot change the mode, the whitelist, or the per-reply limit.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** 解析 RPC/持久化文档里的设置对象；非法字段返回 undefined，由调用方拒绝。 */
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

function parseRevision(value) {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
}

function cloneSettings(settings) {
  return { ...settings, customPrompt: settings.customPrompt };
}

/** 设置 RPC 的信任范围；未显式配置时用 trusted-host（本机 + 服务端声明的受信主机）。 */
function resolveAuthority(config) {
  return config?.settingsAuthority === "loopback" ? "loopback" : "trusted-host";
}

function defaultSettingsFile(config) {
  if (typeof config?.settingsFile === "string" && config.settingsFile.trim() !== "") {
    return resolve(config.settingsFile);
  }
  const home =
    typeof process.env.DSH_HOME === "string" && process.env.DSH_HOME.trim() !== ""
      ? process.env.DSH_HOME
      : homedir();
  return join(home, ".dsh", SETTINGS_FILE_NAME);
}

function loadSettingsDocument(file) {
  try {
    const raw = JSON.parse(readFileSync(file, "utf8"));
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined;
    if (raw.schemaVersion !== SETTINGS_FILE_SCHEMA_VERSION) return undefined;
    const settings = parseSettings(raw.settings);
    const revision = parseRevision(raw.revision);
    if (settings === undefined || revision === undefined) return undefined;
    return { settings, revision };
  } catch {
    return undefined;
  }
}

function writeSettingsDocument(file, settings, revision) {
  mkdirSync(dirname(file), { recursive: true });
  const payload = `${JSON.stringify(
    {
      schemaVersion: SETTINGS_FILE_SCHEMA_VERSION,
      settings,
      revision,
    },
    null,
    2,
  )}\n`;
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, payload, "utf8");
  try {
    renameSync(tmp, file);
  } catch {
    // Windows 上 rename 覆盖被占用文件可能失败；退回直接写，保证不丢配置。
    rmSync(tmp, { force: true });
    writeFileSync(file, payload, "utf8");
  }
}

function rpcError(code, message) {
  return {
    ok: false,
    error: {
      code,
      message,
      details: { ns: SETTINGS_NAMESPACE },
    },
  };
}

function describeSettings(current, revision, writable) {
  return {
    settings: cloneSettings(current),
    revision,
    writable,
    namespace: SETTINGS_NAMESPACE,
  };
}

/**
 * 构造 dsh-kaomoji 设置 RPC。只开放 loopback，只有 get/save/reset 三个端点。
 * 持久化在 ~/.dsh/dsh-kaomoji.json（可用 cordis config 的 settingsFile 覆盖路径）。
 */
function createSettingsRpcHandler(ctx, settingsFile, getState, commit) {
  let tail = Promise.resolve();
  const exclusive = async (operation) => {
    const previous = tail;
    let release;
    tail = new Promise((done) => {
      release = done;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  };

  return async (endpoint, payload) => {
    try {
      if (endpoint === "get") {
        const state = getState();
        return {
          ok: true,
          value: describeSettings(state.settings, state.revision, state.writable),
        };
      }
      return await exclusive(async () => {
        const state = getState();
        if (endpoint === "save") {
          if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
            return rpcError("bad-request", "Saving kaomoji settings requires an object payload.");
          }
          const next = parseSettings(payload.settings);
          const expectedRevision = parseRevision(payload.expectedRevision);
          if (next === undefined || expectedRevision === undefined) {
            return rpcError("bad-request", "Kaomoji settings or revision are invalid.");
          }
          if (expectedRevision !== state.revision) {
            return rpcError(
              "settings-conflict",
              "Kaomoji settings changed elsewhere. Reload and try again.",
            );
          }
          const revision = state.revision + 1;
          writeSettingsDocument(settingsFile, next, revision);
          commit(next, revision);
          return {
            ok: true,
            value: describeSettings(next, revision, true),
          };
        }
        if (endpoint === "reset") {
          const expectedRevision = parseRevision(payload?.expectedRevision);
          if (expectedRevision === undefined) {
            return rpcError("bad-request", "The revision is invalid.");
          }
          if (expectedRevision !== state.revision) {
            return rpcError(
              "settings-conflict",
              "Kaomoji settings changed elsewhere. Reload and try again.",
            );
          }
          try {
            rmSync(settingsFile, { force: true });
          } catch {
            // 文件不存在也视为重置成功。
          }
          const base = getState().base;
          const revision = state.revision + 1;
          commit(base, revision);
          return {
            ok: true,
            value: describeSettings(base, revision, true),
          };
        }
        return rpcError("bad-request", `Unknown dsh-kaomoji settings operation: ${endpoint}`);
      });
    } catch (error) {
      ctx.logger?.warn?.(
        `[dsh-kaomoji] settings rpc failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return rpcError("settings-rejected", "The Host rejected the kaomoji settings.");
    }
  };
}

export function apply(ctx, config = {}) {
  const baseSettings = normalizeConfig(config);
  const settingsFile = defaultSettingsFile(config);
  const authority = resolveAuthority(config);
  const stored = loadSettingsDocument(settingsFile);

  // currentSettings = 用户层（~/.dsh/dsh-kaomoji.json）覆盖部署默认值后的实时设置。
  let currentSettings = stored?.settings ?? cloneSettings(baseSettings);
  let revision = stored?.revision ?? 0;
  let writable = true;

  const getState = () => ({
    settings: cloneSettings(currentSettings),
    revision,
    writable,
    base: cloneSettings(baseSettings),
  });

  const adoptSettings = (next, nextRevision = revision) => {
    const changed =
      next.mode !== currentSettings.mode ||
      next.placement !== currentSettings.placement ||
      next.maxPerTurn !== currentSettings.maxPerTurn ||
      next.customPrompt !== currentSettings.customPrompt;
    currentSettings = normalizeConfig(next);
    revision = nextRevision;
    if (changed) ctx.emit("system-prompt/change");
  };

  // mode=off 时 section 仍注册，但 text 返回空串（renderPrompt 会丢弃空段），
  // 保证用户随时能在设置卡片里把插件重新打开。
  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: SECTION_NAME,
        order: SECTION_ORDER,
        text: () => buildGuidance(currentSettings),
      }),
    "dsh-kaomoji: guidance",
  );

  // 设置卡片通过 loopback RPC 读写 ~/.dsh/dsh-kaomoji.json；写入后立即
  // 更新提示词段（emit system-prompt/change），无需重启。
  ctx.inject(["connection"], (connectionCtx) => {
    const handler = createSettingsRpcHandler(ctx, settingsFile, getState, adoptSettings);
    connectionCtx.effect(
      () =>
        connectionCtx.connection.rpc.handle(SETTINGS_RPC_CHANNEL, handler, {
          authority,
        }),
      "dsh-kaomoji: settings rpc",
    );
  });

  ctx.logger?.info?.(
    `[dsh-kaomoji] 已挂载（mode=${currentSettings.mode}, placement=${currentSettings.placement}, authority=${authority}, settingsFile=${settingsFile}）`,
  );
}

const plugin = { name, inject, apply };
export default plugin;
