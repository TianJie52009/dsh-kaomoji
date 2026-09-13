# dsh-kaomoji

> 给 [DeepSeek Harness](https://github.com/deepseek-ai)（dsh）的回复自动添加日式颜文字（kaomoji）。

[![npm](https://img.shields.io/npm/v/dsh-kaomoji.svg)](https://www.npmjs.com/package/dsh-kaomoji)
[![license](https://img.shields.io/github/license/TianJie52009/dsh-kaomoji.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/dsh-kaomoji.svg)](https://nodejs.org)

> 🤖 **纯 Codex 生成**：本仓库的代码与文档均由 OpenAI Codex 自动生成，未经人工逐行审查。使用前请自行阅读并测试。

`dsh-kaomoji` 是一个零第三方依赖的 dsh 插件：它在模型生成前向系统提示词注入一段「情绪 → 颜文字」白名单规则，让模型按回复情绪**原样复制**一个真实、可读的颜文字。精选词库来自日本最大的颜文字站之一 [顔文字屋 kaomojiya.org](https://www.kaomojiya.org/)。

[English](./README.en.md) | 简体中文

## 特性

- **纯提示词方案**：不截断、不改写模型流，也不额外调用模型，稳定且对 KV 缓存友好。
- **白名单防乱码**：模型只会从词库中逐字符复制颜文字，不会凭印象拼出坏字符。
- **情绪分桶**：内置 12 个情绪分类（开心 / 心动 / 难过 / 大哭 / 生气 / 惊讶 / 困惑 / 害羞 / 俏皮 / 鼓励 / 感谢 / 道歉），并随规则给出可用样例。
- **三种频率模式**：`auto`（智能：寒暄/闲聊/推荐建议/共情回复都会带一个，默认）/ `frequent`（每条对话回复都带）/ `off`（关闭）。
- **放置位置可选**：贴在情绪最贴切的句子后（`inline`，默认）或固定在回复末尾（`end`）。
- **可视化配置卡片**：卡片位于「设置 → 通用设置」，保存即生效、无需重启。
- **零第三方运行时依赖**：只用 dsh 自带的 `systemPrompt` 服务与 Node 标准库。

## 工作原理

1. 插件启动时通过 `ctx.systemPrompt.section()` 注册一段名为 `dsh-kaomoji:guidance`、顺序号为 `176` 的提示词段。
2. 每次组装模型提示词时，该段会把下面的内容交给模型：
   - 当前模式与放置规则（如「每条回复一个」「不要放进代码块」）；
   - 按情绪分类的颜文字白名单；
   - 用户附加的 `customPrompt`（可选）。
3. 模型生成时在合适位置直接输出列表内的颜文字——因为它只是普通文本，聊天界面无需任何自定义渲染即可显示。

设置部分走独立的 loopback RPC（`/dsh-kaomoji-settings`）：

1. 「设置 → 通用设置」的卡片读取/写入 `~/.dsh/dsh-kaomoji.json`；
2. Host 收到写入后立刻更新提示词段并发出 `system-prompt/change`，**下一次回复就生效**，不需要重启。

选择提示词注入而不是「流后处理追加」的原因：

- 不需要解析流式输出、判断句子边界或猜测情绪，规避追加错位的风险；
- 由模型在上下文里选择最贴切的情绪桶，而不是按关键词硬猜；
- 与 dsh-emoji 等既有插件保持同一套机制，行为可预期。

### 效果示例

`frequent + end` 模式下的回复结尾：

```text
当然可以，我帮你把正则改成忽略大小写再跑一次测试。
测试已经全绿了 (๑•̀ㅂ•́)و✧
```

## 安装

### 环境要求

- dsh（DeepSeek Harness）Web Profile，内置 `@deepseek-ai/dsh-system-prompt`
- Node.js `^22.19.0 || >=24.0.0`
- pnpm 11（dsh 默认使用 pnpm）

### 方式一：从 npm 安装（推荐）

包已发布到 npm，直接安装即可，dsh CLI 会自动把插件加入 `dsh.profile.bundles`：

```powershell
cd "$env:USERPROFILE\.dsh\profiles\web"
dsh plugin --profile web add dsh-kaomoji
```

> 包刚发布的 24 小时内，如果对方的 pnpm 开启了「新包安全期」，裸名安装可能暂时解析不到；这种情况可先用下面的 GitHub 方式安装。

### 方式二：从 GitHub 直装（无需等 npm）

无需等 npm 发布，dsh CLI 支持直接装 GitHub 仓库：

```powershell
dsh plugin --profile web add github:TianJie52009/dsh-kaomoji
```

等价的 pnpm 写法：

```powershell
cd "$env:USERPROFILE\.dsh\profiles\web"
pnpm add github:TianJie52009/dsh-kaomoji
```

### 方式三：本地开发版

```powershell
# 先把仓库 clone/解压到本地，再把路径换成该目录
pnpm add file:C:\path\to\dsh-kaomoji
```

> 用 pnpm 手动安装时，请确认 `package.json` 的 `dsh.profile.bundles` 已包含 `"dsh-kaomoji"`，否则插件不会加载。

装好后重启 Web Host（或由已安装的 `dsh-hot-reload` 完成热挂载）。Host 端开始注入提示词；Web 端在「设置 → 通用设置」底部会出现「颜文字（dsh-kaomoji）」配置卡片。

## 配置

默认配置即开即用（`mode: auto`）。有两层设置：

1. **部署默认值**：在 profile 的 `cordis.patch.yml` 中以 `id: dsh-kaomoji` 覆盖 `config`（适合管理员/装机默认）；
2. **用户设置**：通用设置卡片里修改，写入 `~/.dsh/dsh-kaomoji.json`，优先级高于部署默认值；点「恢复默认」会删掉用户层，回到部署默认值。

`cordis.patch.yml` 示例：

```yaml
- id: dsh-kaomoji
  config:
    mode: frequent     # off | auto | frequent
    placement: end     # inline | end
    maxPerTurn: 2
    customPrompt: "正式场景克制一点，优先使用「感谢 / 鼓励」类颜文字"
```

### 配置项

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `mode` | `'off' \| 'auto' \| 'frequent'` | `'auto'` | `off` 关闭；`auto` 寒暄/闲聊/推荐建议/共情回复都会带一个；`frequent` 每条对话回复都带一个（两者都跳过纯代码 / 正式技术交付） |
| `placement` | `'inline' \| 'end'` | `'inline'` | 放在情绪最贴切的句子/短段后，或固定在回复末尾 |
| `maxPerTurn` | `number`（1–5） | `1` | 每条回复的颜文字数量上限；`frequent` 会按这个数量分散放在不同句子后，回复太短时自动减少 |
| `customPrompt` | `string` | `''` | 附加风格/场景说明；不能改变模式、白名单或数量上限 |
| `settingsFile` | `string` | `~/.dsh/dsh-kaomoji.json` | （进阶）用户设置持久化文件路径 |
| `settingsAuthority` | `'trusted-host' \| 'loopback'` | `'trusted-host'` | 设置 RPC 信任范围：默认允许本机与 Host 声明的受信主机（Tailscale/局域网）保存设置；改成 `loopback` 则仅本机可改 |

卡片里的修改即时写入用户层并热生效；修改 `cordis.patch.yml` 的部署默认值后需重启 dsh。

### 远程访问（Tailscale / 局域网）

- 只要能正常远程打开 dsh 页面，说明 Host 已信任该来源；默认 `settingsAuthority: trusted-host` 下，通用设置卡片可以直接修改并保存。
- 如果卡片提示「当前来源不在 Host 的信任列表里」，说明服务端 `@deepseek-ai/dsh-client-connection` 没有把该域名/IP 加进 `trustedHosts`；先在服务端配置受信主机，或临时改用 `settingsAuthority: loopback` 并到服务器本机编辑。

## 词库来源与许可

内置词库见 [`data/catalog.json`](./data/catalog.json)，每个分类都标注了 kaomojiya.org 对应的来源页：

| 情绪 | 来源页 |
| --- | --- |
| happy（开心/高兴） | [happy-kaomoji](https://www.kaomojiya.org/happy-kaomoji) |
| love（喜欢/心动） | [love-kaomoji](https://www.kaomojiya.org/love-kaomoji) |
| sad（难过/低落） | [sad-kaomoji](https://www.kaomojiya.org/sad-kaomoji) |
| cry（大哭/泪目） | [cry-kaomoji](https://www.kaomojiya.org/cry-kaomoji) |
| angry（生气/不满） | [angry-kaomoji](https://www.kaomojiya.org/angry-kaomoji) |
| surprised（惊讶/震惊） | [odoroiteru-kaomoji](https://www.kaomojiya.org/odoroiteru-kaomoji) |
| confused（困惑/困扰） | [komaru-kaomoji](https://www.kaomojiya.org/komaru-kaomoji) |
| shy（害羞） | [shy-kaomoji](https://www.kaomojiya.org/shy-kaomoji) |
| playful（俏皮/卖萌） | [shy-kaomoji](https://www.kaomojiya.org/shy-kaomoji)（てへぺろ 系） |
| encourage（鼓励/加油） | [hagemasu-kaomoji](https://www.kaomojiya.org/hagemasu-kaomoji) |
| thanks（感谢） | [thanks-kaomoji](https://www.kaomojiya.org/thanks-kaomoji) |
| sorry（道歉） | [sorry-kaomoji](https://www.kaomojiya.org/sorry-kaomoji) |

顔文字屋的页面声明可免费使用（无需注册，商用・非商用均可）。本插件仅收录其人工精选子集，并在 `catalog.json` 中保留来源标注。本插件本体以 MIT 协议发布。

想扩充词库时，请同步修改：

1. [`data/catalog.json`](./data/catalog.json)——完整词库（含来源标注）；
2. [`lib/index.js`](./lib/index.js) 的 `CATALOG`——真正注入提示词的白名单。

## 本地开发

### 目录结构

```text
dsh-kaomoji/
├── lib/
│   ├── index.js       # 插件入口：config 归一化、规则生成、systemPrompt 段注册
│   ├── client.js      # Web 端：设置 → 通用设置 的配置卡片（ModuleLoader 格式）
│   └── index.d.ts     # TypeScript 声明
├── data/
│   └── catalog.json   # 情绪 -> 颜文字 精选词库（含来源标注）
├── test/
│   └── plugin.test.mjs# node:test 单元测试
├── cordis.patch.yml   # dsh bundle 挂载补丁
├── package.json
├── README.md / README.en.md
├── CHANGELOG.md
└── LICENSE
```

### 常用命令

```powershell
npm test                          # 运行 node:test 单元测试
npm pack                          # 打包验证发布内容（会先跑 prepack: npm test）
```

快速查看注入后的提示词规则：

```powershell
node -e "import('./lib/index.js').then((m) => console.log(m.buildGuidance({ mode: 'frequent', placement: 'end' })))"
```

### 发布到 npm（维护者）

`dsh plugin --profile web add dsh-kaomoji` 这种裸包名安装依赖 npm 上的正式发布。维护者首次发布前需要登录一次官方 registry（`registry.npmmirror.com` 是只读镜像，不能发布）：

```powershell
npm login --registry https://registry.npmjs.org
npm publish --access public --registry https://registry.npmjs.org
```

`package.json` 已声明 `publishConfig.registry = https://registry.npmjs.org/`，发布后其他人即可直接使用上面的「方式二」。

## 兼容性

- 面向 npm `@deepseek-ai/dsh` rc.7 系运行时；
- peer 依赖：`@deepseek-ai/cordis`、`@deepseek-ai/dsh-system-prompt`（均为可选声明，由 Web Profile 提供共享运行时）；
- 与 [dsh-emoji](https://github.com/hellodigua/dsh-emoji) 可共存：提示词段名/排序不同（`dsh-emoji:guidance` @175 vs `dsh-kaomoji:guidance` @176），设置命名空间、RPC 通道、卡片槽位（插件页 vs 通用设置）均无冲突；颜文字是纯文本，dsh-emoji 的流转写只处理规范 Unicode emoji，不会互相改写。

## FAQ

### 回答里没有颜文字？

按顺序检查：

1. **Host 半是否真的挂载了**：`dsh plugin --profile web add dsh-kaomoji` 会把插件同时写进 `dependencies` 和 `dsh.profile.bundles`；如果只用 `pnpm add` 手动装，client 卡片会出现但 Host 不会注入提示词。重新用 dsh CLI 安装一次，或在 profile 的 `cordis.patch.yml` 里补：

   ```yaml
   - insert:
       - id: dsh-kaomoji
         name: dsh-kaomoji
   ```

   然后重启 dsh，日志里应出现 `[dsh-kaomoji] 已挂载（mode=...）`。
2. **确认模式**：默认 `auto` 只在友好/闲聊/共情等场景使用；想要每条对话回复都带，在通用设置卡片切到「高频」，或在 `cordis.patch.yml` 写 `mode: frequent`。
3. **看设置卡片状态**：卡片提示「Host 未加载」或「来源不受信任」时，提示词也不会注入，先按上面的步骤修好挂载/信任。

### 为什么模型偶尔没有加颜文字？

`auto` 模式本来就不要求每回合使用；只有 `frequent` 才要求「对话回复都带一个」。如果 `frequent` 下仍经常漏掉，多半是回复被模型判为纯代码/正式交付，或上下文里其它 persona 指令更强势——可用 `customPrompt` 再强调一次。

### 我想用白名单之外的颜文字怎么办？

在 `customPrompt` 中给出精确字符串，例如「这次回复结尾用 (=^･ω･^=) 猫猫颜文字」。规则允许用户显式指定的内容例外；若你希望长期使用，建议把它加入 `CATALOG` 与 `catalog.json`。

### 会污染代码回复吗？

不会。规则明确禁止把颜文字放进代码块、行内代码、链接、表格和工具输出，且代码型回复不适用 `frequent` 的「每条都带」要求。

### 设置卡片在哪里？

在「设置 → 通用设置」底部（主题、语言、回车行为等行之后）。卡片里可切换模式、放置位置、数量上限和附加提示词；保存即生效，也可以在卡片里一键恢复默认。

### 和 dsh-emoji 一起用会冲突吗？

不会产生技术冲突（见「兼容性」）。唯一要注意的是使用节奏：如果两个插件都开 `frequent`，同一条回复可能既带 😊 又带 (´∀｀)。建议只让其中一个保持 `frequent`，另一个用 `auto`（或在对应设置页关掉），观感会更好。

## License

[MIT](./LICENSE)

词库字符来源：[顔文字屋 kaomojiya.org](https://www.kaomojiya.org/)（页面声明免费使用，商用・非商用均可）。
