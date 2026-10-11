# Discord Save Emoji (DSE)

[简体中文](README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md)

右键 Discord 消息 → **Apps（应用）→ 保存表情 / Save Emoji**，把消息或 reaction 中的自定义表情存到自己的服务器。使用官方 **User Install + 消息上下文命令**，无需修改客户端，不使用用户账号 Token。

![Windows 小窗口](docs/desktop.png)

## 下载安装

1. 从 [GitHub Releases](https://github.com/ArthurLauCS/DiscordSaveEmoji/releases/latest) 下载 `DSE-Setup-1.0.0-x64.exe`。
2. 双击安装，再打开桌面的 **Discord Save Emoji**。仅支持 Windows 10/11 x64；安装包内含 Node.js，无需自行安装，无需管理员权限。不提供 Linux 版本。
3. 首次未填写 Token 时显示启动失败属正常现象。按下方步骤配置，或点击窗口内“帮助”。

安装包未做代码签名，Windows 可能显示未知发布者；请核对发布页的 SHA256，不需要关闭系统安全保护。

## 一次性配置

1. 打开 [Discord Developer Portal](https://discord.com/developers/applications)，创建自己的应用。
2. **Installation** 启用 `User Install` 和 `Guild Install`。
3. **Default Install Settings**：User Install 选 `applications.commands`；Guild Install 选 `bot` + `applications.commands`，权限只授予 **Create Expressions**（创建表达式，值 `8796093022208`）。不需要 Administrator。
4. **Bot** 页面取得 Bot Token。不要启用 Privileged Gateway Intents；`Requires OAuth2 Code Grant` 关闭；`Interactions Endpoint URL` 留空。
5. 点击小窗口的 **打开env配置**，填写并保存：

   ```dotenv
   DISCORD_TOKEN=你的BotToken
   TARGET_GUILD_ID=
   OWNER_ID=
   ```

   不要加 `Bot ` 前缀，不要把 Token 发给别人。Discord 没有“服务器 Token”。唯一必填凭证是你创建的应用的 Bot Token；应用不会读取 Discord 客户端登录凭证。
6. 点击 **启动服务**（已运行时先停止再启动），等待显示“服务已启动 · Discord 已连接”。
7. 分别点击 **添加到我的应用**、**添加到目标服务器**，完成两次 Discord 授权。目标推荐自己创建的私人服务器，机器人只需加入这个目标。
8. 在目标服务器执行 **`/setup`**，收到已绑定提示后即可跨服务器收藏。用户 ID 从应用所有者自动读取，目标 ID 从 `/setup` 自动保存。

私人部署仅允许应用所有者操作，团队应用默认使用团队所有者。`OWNER_ID` 可指定另一位使用者，但该使用者仍须拥有目标服务器相应权限。

## 日常使用

![保存表情操作示意图（非 Discord 实际截图，不含个人或服务器信息）](docs/discord-menu.png)

- 右键含自定义表情的**消息** → Apps → 保存表情（可能先进入应用名称子菜单）。一个表情直接保存，多个时显示仅自己可见的多选菜单，勾选后点击菜单外提交。
- 成功后，在目标服务器的表情面板中选择使用。菜单名称与回复跟随 Discord 的语言；桌面窗口和帮助支持简体中文、繁体中文、英文，选择后点击 **保存设置**。
- 勾选 **登录 Windows 后自动启动** 再保存，之后登录 Windows 会自动在托盘运行。取消勾选并保存即可关闭。也可在 Windows“启动应用”中禁用；系统禁用会优先于本软件设置。
- 关闭窗口会继续托盘运行；双击托盘图标或桌面快捷方式重新打开。托盘菜单的 **退出并停止服务** 才会退出。
- 修改 env 后停止并重新启动服务。退出、关机、休眠或断网期间命令不能正常响应。

## 能力边界

- **不能替代 Nitro**：保存本身不需要 Nitro；个人账号跨服务器发送仍需 **Nitro / Nitro Basic**，并满足外部表情权限。本应用不绕过订阅，也不替你发送公共消息或向客户端输入框插入表情。
- 来源服务器无需安装机器人、无需任何服务器 Token，但仍受 Discord 对个人应用、客户端入口及频道权限的限制，不能承诺所有受限位置均可调用。
- 目标服务器必须有机器人；你须是服务器所有者或有创建/管理表达式权限，机器人须有 Create Expressions 权限。每次保存都会重新检查。
- 支持消息正文和 Discord 在该次交互中返回的自定义 reaction 表情，支持静态 PNG、动态 GIF。不扫描频道，不处理贴纸、普通 Unicode、图片附件或嵌入卡片。
- 菜单最多 25 项；同一消息按 ID 去重，跨操作不去重，重复保存会占用新槽位。每次只处理一项操作，上传按顺序执行。
- 下载超时 15 秒，最大 256 KiB，不自动压缩。部分失败不会撤销已保存项目；遇到限流会停止剩余项目。网络超时后先检查目标服务器，避免盲目重试造成重复。
- 程序需要能访问 Discord API、Gateway 和 CDN，无需开放入站端口或配置公网回调。

## 配置、升级与卸载

配置位于 `%LOCALAPPDATA%\DiscordSaveEmoji`：`.env` 保存凭证，`.dse.json` 保存绑定，`settings.json` 保存界面语言。`/setup` 的绑定优先于同一用户的 `TARGET_GUILD_ID`。改变目标时在新目标执行 `/setup`。

升级前从托盘退出，再运行新安装包。升级和卸载都会保留用户配置；卸载会移除开机自启项。需要彻底删除凭证时可手动删除上述配置目录。迁移旧源码版本时，将 `.env` 和 `.dse.json` 复制到该目录；不要同时运行源码服务和桌面服务，也不要在两台电脑上同时使用同一个 Bot Token。

## 排错

| 现象 | 检查方法 |
| --- | --- |
| 启动失败 | 检查 Bot Token、网络、安装上下文，以及配置文件是否可读；修改后重新启动 |
| 找不到保存命令 | 确认 User Install 安装到“我的应用”，刷新 Discord，等待全局命令同步 |
| This command is outdated | 更新语言菜单后可能命中旧缓存；刷新 Discord 后重新右键，必要时稍后再试 |
| 找不到 `/setup` | 确认 Guild Install 已安装到目标，频道允许应用命令 |
| 无法保存 | 检查机器人和自己的创建表达式权限、目标槽位、来源是否已删除 |
| 状态显示重连 | 等待网络恢复；登录阶段失败则恢复网络后手动启动 |
| 已保存但来源频道显示 `:name:` | 目标已保存不代表来源允许外部表情预览；去目标表情面板确认 |

## 开发和构建

Windows，Node.js 22.12+（发布包使用构建机器上的 Node 版本），.NET Framework 4.x 编译器，Inno Setup 6+。

```powershell
npm ci
npm test
pwsh -File windows/build.ps1
# 如果 Inno Setup 位于其他目录：
# ./windows/build.ps1 -Iscc 'C:\path\ISCC.exe'
```

构建输出为 `dist/DSE-Setup-1.0.0-x64.exe` 和 `SHA256SUMS.txt`。打包使用显式文件白名单，排除 `.env`、绑定、日志和私人截图。Node.js 及 npm 依赖的许可随安装包保留。语言包在 `locales/*.json`，离线帮助由 `node windows/build-help.mjs` 生成；新增翻译必须与英文键和占位符一致。

源码调试：复制 `.env.example` 为 `.env`，`npm start`。此模式不会读取桌面版配置目录，启动前请退出桌面版。

## 验证与已知限制

测试记录见 [TESTING.md](TESTING.md)。未在 Windows 10 实机或真实重启后测试自启；未提供签名证书。原生窗口使用 .NET Framework WinForms，服务使用随包 Node.js 和 discord.js。

## 官方参考与图标

[应用安装上下文](https://docs.discord.com/developers/resources/application) · [上下文命令](https://docs.discord.com/developers/interactions/application-commands) · [表情权限与大小限制](https://docs.discord.com/developers/resources/emoji) · [Nitro 权益](https://support.discord.com/hc/en-us/articles/115000435108-What-are-Nitro-Nitro-Basic)

图标由 imagegen 生成，提示词在 `assets/icon-prompt.txt`；不使用 Discord 官方标志。本项目与 Discord 无官方隶属关系。
