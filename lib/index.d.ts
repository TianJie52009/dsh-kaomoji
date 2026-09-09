/**
 * dsh-kaomoji — 给 DeepSeek Harness (dsh) 回复自动添加日式颜文字。
 *
 * 纯提示词插件：零第三方运行时依赖，不需要 client 端或 webServer。
 */

export type KaomojiMode = "off" | "auto" | "frequent";
export type KaomojiPlacement = "inline" | "end";

export interface KaomojiConfig {
  mode?: KaomojiMode;
  placement?: KaomojiPlacement;
  maxPerTurn?: number;
  customPrompt?: string;
}

export interface KaomojiGroup {
  id: string;
  label: string;
  sourceUrl: string;
  examples: string[];
}

export const name: string;
export const inject: string[];
export const SECTION_NAME: string;
export const SECTION_ORDER: number;
export const SETTINGS_NAMESPACE: string;
export const SETTINGS_RPC_CHANNEL: string;
export const SETTINGS_FILE_NAME: string;
export const SETTINGS_FILE_SCHEMA_VERSION: number;
export const MODES: KaomojiMode[];
export const PLACEMENTS: KaomojiPlacement[];
export const DEFAULT_CONFIG: Required<KaomojiConfig>;
export const CATALOG: readonly KaomojiGroup[];

export function normalizeConfig(config?: KaomojiConfig): Required<KaomojiConfig>;

/** mode=off 时返回空字符串（不会注入任何内容）。 */
export function buildGuidance(config?: KaomojiConfig): string;

/** Cordis 插件入口。 */
export function apply(ctx: any, config?: KaomojiConfig): void;

declare const plugin: { name: string; inject: string[]; apply: typeof apply };
export default plugin;
