# Changelog

All notable changes to **dsh-kaomoji** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/lang/zh-CN/).

## [Unreleased]

## [0.1.3] - 2026-09-13

### Fixed

- `maxPerTurn` 之前对输出没有实际约束力：提示词写死「一个」，调到 2/3 也不会变。
  现在 `frequent` 会按该上限在回复里分散放置多个颜文字，`auto` 在存在多个
  情绪点时也会用到上限；回复很短时自动少放。

## [0.1.2] - 2026-09-10

### Changed

- `auto` 模式的适用范围明确包含日常推荐、购物建议和实用 how-to 回答：这类
  对话式回答同样会带一个颜文字，只有纯代码、正式技术交付和高风险内容跳过。

## [0.1.1] - 2026-09-10

### Added

- 设置 RPC 默认信任范围改为 `trusted-host`：本机与 Host 声明的受信主机（如 Tailscale
  组网的服务器）都能保存设置；可用 `settingsAuthority: loopback` 收紧回仅本机。
- 设置卡片会显示 RPC 失败原因（来源不受信任 / Host 未加载 / 保存失败），不再静默只读。
- `auto` 模式改为更积极地输出颜文字：友好的寒暄、闲聊、共情类回复都会带一个。

### Fixed

- 远程（Tailscale / 局域网）页面打开设置卡片时只能看、不能改的问题。

## [0.1.0] - 2026-09-09

### Added

- 首个可用版本：向 dsh 系统提示词注入「情绪 → 颜文字」白名单规则。
- 三种模式：`off` / `auto` / `frequent`，默认 `auto`。
- 放置位置可调：`inline`（贴合情绪的句子后，默认）/ `end`（回复末尾）。
- 单条回复颜文字数量上限 `maxPerTurn`（默认 1，范围 1–5）。
- 用户附加提示词 `customPrompt`（只细化风格，不能覆盖模式/白名单/上限）。
- Web 端「设置 → 通用设置」配置卡片：模式 / 放置位置 / 数量上限 / 附加提示词，
  通过 loopback RPC 写入 `~/.dsh/dsh-kaomoji.json`，保存即热生效。
- 与 dsh-emoji 的共存设计：独立提示词段（order 176）、独立 RPC 通道、
  独立设置槽位（通用设置 vs 插件页），互不覆盖。
- 精选词库 `data/catalog.json`（12 个情绪分类，标注来源页），词库来自
  [顔文字屋 kaomojiya.org](https://www.kaomojiya.org/)。
- 零第三方运行时依赖；内置 `node:test` 单测（Host RPC + Client 加载）。
