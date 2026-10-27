# HANDOFF — dsh-kaomoji

## 接手第一步
- 先读 README.md 的迁移约定，再读 COMPATIBILITY.md 的验证范围。
- package.json 是版本、发布文件和依赖范围的事实来源；不要直接把预发布范围改成宽泛的 caret。
- 修改前检查 git status；npm ci --legacy-peer-deps 后运行 npm test。

## 当前结构与设计原因
- lib/index.js 保留词库及提示词生成，导出 Harness 原生 Config schema；动态字段通过 .get() 读取。
- lib/client.js 是无构建的 ModuleLoader 包，在 settings.general.item 注册卡片，经 remote.settings 保存。
- Config schema 同时放在命名导出和默认插件对象中，后者遗漏会让 Loader 看不到表单。
- migrationVersion 是原生配置里的每 profile 标记；重置必须保留它，避免重新导入旧 JSON。
- settingsFile 只指定历史导入源，禁止重新恢复为两套同时写入的存储。
- 提示词 section 的 interpolate:false 必须保留：自定义提示词中的 {{文本}} 应作为字面量处理。

## 更新流程
- lib/index.js 和 lib/client.js 的模式、限制、默认值保持一致；配套更新 lib/index.d.ts、测试和双语 README。
- 改 Harness 范围时先核对目标版本包；scripts/test-compat.mjs 读取 engines.dsh 的精确集合，逐版本运行隔离验证。
- test/native-settings.test.mjs 覆盖导入、安全失败、优先级和重置；test/client.test.mjs 覆盖原生通信、操作队列、冲突和卸载。
- scripts/verify-runtime.mjs 使用真实 Loader/settings/config-editor，检查不重挂载的动态更新和重启持久化。
- npm pack --dry-run 检查包；更新 CHANGELOG 和验证记录后提交推送，发布 npm latest；版本已发布就递增，不能覆盖。
- npm 发布身份通过 npm whoami 检查；凭据留在本机登录配置或环境变量里，文档和日志不得记录 token。

## 市场同步
- sync-market.cmd 是当前项目的新版本检查入口；默认只读，未同步时退出码 2。
- 上游不是 dsh-market 应用仓库，而是 awesome-dsh-plugin/awesome-dsh-plugin；条目已存在，版本来自 npm 元数据探测。
- --request-refresh 只在仓库和 npm 新版本都满 24h、目录仍旧时请求重抓；需要 GH_TOKEN/GITHUB_TOKEN，并检查已有 issue。
- 市场目录同步和客户端允许安装是两件事；新包等待策略由市场/pnpm 决定，不要删除保护策略。

## 已知边界
- 本次仅承诺 0.2.0-rc.2～0.2.1-rc.3；未来版本另行验证。
- 真实配置树验证不等于完整 Web/桌面应用界面实测，详情见 COMPATIBILITY.md。
- 旧配置按 Host 数据目录共享；迁移后的设置按 profile 独立，换机需带数据。
- 卡片和默认 bundle 使用固定 id dsh-kaomoji；手工改成多个实例 id 时需要另行设计客户端实例选择。
- 迁移失败只写诊断日志，不删除旧文件；排除文件/权限问题后重启 Host 重试。

## 下一步与维护
- 核对本次 GitHub/npm 发布结果与市场同步状态，最终事实写入 COMPATIBILITY.md。
- 每次接手或大改后更新当前状态，并在下面追加一行记录；换 agent 时写清未完成事项。

## 变更历史
| 日期 | agent | 改动 |
|---|---|---|
| 2026-10-27 | Codex | 原生设置、一次性迁移、版本验证脚本与市场同步脚本；发布状态见 COMPATIBILITY.md。 |

### 本次发布完成记录
- 2026-10-27：GitHub main 已推送代码提交 54b8881，v0.3.0 标签已推送；npm latest 已验证为 dsh-kaomoji@0.3.0。
- 注册表下载包与发布前审查的 tarball 字节一致；24 项单测和 9 个官方运行时集成验证通过。
- 市场仍是旧元数据；2026/10/28 13:25:49（北京时间）后再次运行 sync-market.cmd，必要时显式请求刷新。
