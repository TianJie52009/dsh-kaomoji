> 接手或维护本项目先读 [HANDOFF.md](./HANDOFF.md)。

# dsh-kaomoji

给 DeepSeek Harness 回复按情绪添加日式颜文字。通过系统提示词贡献规则，不改写模型流；词库见 [data/catalog.json](./data/catalog.json)。

[English](./README.en.md) · [更新记录](./CHANGELOG.md) · [兼容验证](./COMPATIBILITY.md)

## 安装与编辑

```powershell
dsh plugin --profile web add dsh-kaomoji@0.3.0
```

桌面端在所用 profile 安装相同包。安装/更新后重启 Host 并刷新客户端，在「设置 → 通用设置」中编辑「颜文字（dsh-kaomoji）」卡片。保存后下一次回复生效。

- 模式：关闭 / 智能 / 高频。
- 位置：贴合内容 / 回复结尾。
- 每条上限：1–5，默认 1。
- 附加提示词：最多 4000 字符；不能改变词库、模式或数量规则。
- 两个插件可共存；Emoji 规则要求避免与颜文字出现在同一句/同行。

## 兼容范围

仅支持 Harness **0.2.0-rc.2 ～ 0.2.1-rc.3** 已发布的 9 个版本（含 alpha.1–alpha.5、rc.1–rc.3）。新旧范围外版本不在本次支持承诺内；清单使用精确版本集合，避免预发布 semver 范围漏选。

界面通过官方 `remote.settings` 编辑 Host 配置；插件不注册 HTTP 路由，不依赖 `webServer`，也不把配置存在浏览器。Web 与桌面复用 Harness 自己的通信载体和认证。

## 旧配置自动迁移

首次加载后，从旧 `dsh-kaomoji.json`（schemaVersion 1）导入到当前 profile 的 Harness 原生配置；新配置里已有的用户字段优先，旧值只补缺失项。

- 优先读取当前 Harness 数据目录，兼容旧的 `DSH_HOME/.dsh/` 嵌套路径。
- 原来的 `settingsFile` 自定义路径继续作为导入源；以后保存使用 Harness 配置。
- 原 JSON 保留不删；写入成功后同一笔提交保存 `migrationVersion: 1`，升级或重启不会重复覆盖。
- 恢复默认使用 Harness 的继承配置，并保留迁移标记，防止旧值回来。
- 文件损坏、无写权限或冲突会记录警告，不标记成功；修复后重启可重试。
- 迁移按 profile 进行；换电脑或更换整个数据目录时，需把原配置文件或 profile 一起带过去。

高级部署默认值仍可放在 profile 的 `cordis.patch.yml`：

```yaml
- id: dsh-kaomoji
  config:
    mode: auto
    placement: inline
    maxPerTurn: 1
    customPrompt: ""
```

`migrationVersion` 是内部迁移标记，保持当前值即可。

## 开发与发布

```powershell
npm ci --legacy-peer-deps
npm test
npm run test:compat
npm pack --dry-run
.\publish.cmd
```

兼容测试下载官方运行时到隔离目录 `.compat/`；可用 `DSH_COMPAT_HOME` 指定共享测试缓存。测试不修改实际 Harness profile。

## dsh-market 新版本同步

仓库已经收录，新版本由市场目录的定时任务重新抓取 npm 元数据，不需要每次重复提交插件条目。发布到 npm 且推送 GitHub 后运行：

```powershell
.\sync-market.cmd
# 发布满 24 小时后仍未同步，可显式请求上游刷新：
.\sync-market.cmd --request-refresh
```

默认只检查 GitHub、npm latest、目录版本和发布日期；未同步返回退出码 2。请求刷新需要 `GH_TOKEN` 或 `GITHUB_TOKEN`，会先查重复请求，再在目录仓库创建 issue；不会自行修改上游目录或绕过等待期。市场自身的新包等待策略可能更长，脚本会输出发布日期供核对。

[上游目录规则](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md) · [市场页面](https://awesome-dsh-plugin.com/p/TianJie52009/dsh-kaomoji/)

## License

[MIT](./LICENSE)；词库来源：[顔文字屋](https://www.kaomojiya.org/)。
