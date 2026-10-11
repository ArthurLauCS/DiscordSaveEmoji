# Discord Save Emoji (DSE)

[简体中文](README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md)

透過 Discord 官方訊息右鍵 Apps 選單，將訊息和 reaction 的自訂表情儲存到自己的伺服器。不修改用戶端，不使用個人帳號 Token。

![Windows](docs/desktop.png)

## 安裝

從 [Releases](https://github.com/ArthurLauCS/DiscordSaveEmoji/releases/latest) 下載 DSE-Setup-1.0.0-x64.exe，安裝後雙擊桌面捷徑。僅支援 Windows 10/11 x64，內含 Node.js，不需系統管理員權限，不提供 Linux 版。安裝包未簽章，可能顯示未知發行者；請核對 SHA256，不需要關閉 Windows 安全防護。首次未填 Token 時顯示啟動失敗為正常現象。

## 1. 建立 Discord 應用程式

在 Developer Portal 建立應用程式。在 Installation 啟用 User Install 和 Guild Install。User Install 選 applications.commands；Guild Install 選 bot + applications.commands，只授予 Create Expressions。不要啟用特權 Intent，關閉 Requires OAuth2 Code Grant，Interactions Endpoint URL 留空。

[Discord Developer Portal](https://discord.com/developers/applications)

## 2. 填寫設定並啟動

在 Bot 頁面取得 Bot Token（必要時自行 Reset Token）。按主視窗「開啟env設定」，將 Token 填在 DISCORD_TOKEN= 後並儲存。不要加 Bot 前綴或分享 Token。OWNER_ID 和 TARGET_GUILD_ID 通常留空：自動辨識應用程式擁有者，稍後用 /setup 綁定伺服器。按「啟動服務」，等待已連線。

```dotenv
DISCORD_TOKEN=YOUR_BOT_TOKEN_HERE
TARGET_GUILD_ID=
OWNER_ID=
```

## 3. 安裝官方擴充功能

連線後分別按「新增至我的應用程式」和「新增至目標伺服器」，完成 Discord 授權。推薦以自己建立的私人伺服器為目標；機器人只需加入此目標。在目標伺服器輸入 /setup，收到已綁定提示即可。不需要瀏覽器外掛，也不用修改 Discord 用戶端。

## 4. 右鍵訊息儲存

右鍵含自訂表情的訊息 → Apps（應用程式）→ 儲存表情 / Save Emoji。多個表情時勾選所需項目，按選單外提交；單一表情直接儲存。成功後在目標伺服器的表情面板使用。選單最多 25 個，重複操作會再次佔用欄位；不支援貼圖及一般 Unicode 表情。

![Discord Apps menu — cropped to exclude personal information](docs/discord-menu.png)

## 限制與疑難排解

儲存不能取代 Nitro。跨伺服器傳送仍需 Nitro / Nitro Basic 和外部表情權限。來源伺服器無需安裝機器人，但仍受 Discord 對個人應用程式的限制。找不到指令請確認兩種安裝皆完成並重新整理 Discord。失敗請檢查 Token、網路、權限和表情欄位；限流後稍後再試。關閉視窗後繼續在系統匣執行；結束、關機或離線時無法儲存。自動啟動指登入 Windows 後啟動，需勾選後儲存。

## 設定、升級與解除安裝

設定保存在 %LOCALAPPDATA%\DiscordSaveEmoji：.env（Token）、.dse.json（目標綁定）、settings.json（介面語言）。選擇語言或變更自動啟動後按儲存設定。Discord 指令名稱和回覆跟隨 Discord 語言。關閉視窗後繼續在系統匣執行；雙擊系統匣圖示或捷徑可重新開啟；使用「結束並停止服務」退出。修改 env 後停止再啟動。升級前先從系統匣退出。升級及解除安裝會保留設定；解除安裝會移除自動啟動項。需要清除憑證時手動刪除設定目錄。舊原始碼版本可將 .env 和 .dse.json 複製到此目錄。不要同時執行桌面版與原始碼服務，也不要在兩台電腦同時執行同一個機器人。

## 詳細限制

Discord 沒有伺服器 Token。自動辨識應用程式擁有者（團隊應用程式使用團隊擁有者），可用 OWNER_ID 指定其他使用者；僅此人能操作。目標需有機器人；使用者需擁有伺服器或建立/管理表情權限，機器人需 Create Expressions。相同使用者的 /setup 綁定優先於 TARGET_GUILD_ID。每次儲存重新檢查權限。只從 Discord CDN 下載，逾時 15 秒，上限 256 KiB，支援 PNG/GIF，不壓縮、不處理附件或嵌入卡片。僅能讀取 Discord 該次交互提供的 reaction。同一訊息去重，跨操作不去重。部分成功會保留，限流停止剩餘項目；逾時後先檢查目標再重試。不傳送公開訊息、不插入用戶端輸入框、不繞過訂閱。無需入站連接埠或公開回呼。

## 建置與測試

Windows · Node.js 22.12+ · .NET Framework 4.x compiler · Inno Setup 6+

```powershell
npm ci
npm test
pwsh -File windows/build.ps1
```

可用 -Iscc 指定 ISCC.exe 路徑。輸出：dist/DSE-Setup-1.0.0-x64.exe 和 SHA256SUMS.txt。Node.js 取自建置機器。打包採用檔案白名單，排除憑證、綁定及原始截圖，保留依賴許可。語言包位於 locales/*.json；以 node windows/build-help.mjs 重新產生離線說明。

原始碼除錯：複製 .env.example 為 .env，先退出桌面版，再執行 npm start。詳見 [TESTING.md](TESTING.md)。尚未在 Windows 10 實機及實際重新啟動後測試自動啟動，未提供簽章。

[Discord commands](https://docs.discord.com/developers/interactions/application-commands) · [Emoji API](https://docs.discord.com/developers/resources/emoji) · [Nitro](https://support.discord.com/hc/en-us/articles/115000435108-What-are-Nitro-Nitro-Basic)

圖示以 imagegen 產生，提示詞見 assets/icon-prompt.txt；與 Discord 無官方隸屬關係。
