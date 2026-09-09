# Changelog

All notable changes to **dsh-kaomoji** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/lang/zh-CN/).

## [Unreleased]

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
