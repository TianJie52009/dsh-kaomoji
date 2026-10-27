import type z from "@deepseek-ai/schemastery";

/**
 * dsh-kaomoji — 给 DeepSeek Harness (dsh) 回复自动添加日式颜文字。
 *
 * 提示词插件：使用 Node 标准库、Harness 服务及官方 Config schema；Harness 原生设置持久化，Web/桌面端提供通用设置卡片。
 */

export type KaomojiMode = "off" | "auto" | "frequent";
export type KaomojiPlacement = "inline" | "end";

export interface KaomojiConfig {
  mode?: KaomojiMode;
  placement?: KaomojiPlacement;
  maxPerTurn?: number;
  customPrompt?: string;
  /** Legacy JSON import path; no longer used for saving. */
  settingsFile?: string;
  migrationVersion?: number;
}

export interface KaomojiGroup {
  id: string;
  label: string;
  sourceUrl: string;
  examples: string[];
}

export const Config: z;
export const name: string;
export const inject: string[];
export const SECTION_NAME: string;
export const SECTION_ORDER: number;
export const SETTINGS_NAMESPACE: string;
export const SETTINGS_FILE_NAME: string;
export const SETTINGS_FILE_SCHEMA_VERSION: number;
export const MODES: KaomojiMode[];
export const PLACEMENTS: KaomojiPlacement[];
export const DEFAULT_CONFIG: Required<Pick<KaomojiConfig, "mode" | "placement" | "maxPerTurn" | "customPrompt">>;
export const CATALOG: readonly KaomojiGroup[];

export function normalizeConfig(config?: KaomojiConfig): Required<Pick<KaomojiConfig, "mode" | "placement" | "maxPerTurn" | "customPrompt">>;

/** mode=off 时返回空字符串（不会注入任何内容）。 */
export function buildGuidance(config?: KaomojiConfig): string;

/** Cordis 插件入口。 */
export function apply(ctx: any, config?: KaomojiConfig): void;

declare const plugin: { name: string; inject: string[]; Config: z; apply: typeof apply };
export default plugin;
