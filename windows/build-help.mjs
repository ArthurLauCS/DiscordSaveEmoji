import { mkdirSync, writeFileSync } from 'node:fs';
import { languages, packs } from '../i18n.js';
mkdirSync('docs', { recursive: true });
const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
for (const language of languages) {
  const p = packs[language];
  writeFileSync(`docs/help-${language}.html`, `<!doctype html>
<html lang="${language}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${p.helpTitle}</title><style>body{font:17px/1.8 system-ui,sans-serif;background:#f5f6fc;color:#24263b;max-width:860px;margin:40px auto;padding:0 24px}h1{font-size:36px}h2{margin-top:40px}a{color:#5247cc}img{max-width:100%;border:1px solid #ddd;border-radius:12px}code,pre{background:#e8e9f2;padding:10px;border-radius:6px}footer{margin:40px 0;color:#60657c}</style>
<nav>${languages.map(l=>`<a href="help-${l}.html">${l}</a>`).join(' · ')}</nav>
<h1>${p.helpTitle}</h1><p>${p.helpIntro}</p><img src="desktop.png" alt="DSE Windows desktop window">
${['Create', 'Env', 'Install', 'Use', 'Boundary'].map(section=>`<h2>${p['help'+section]}</h2><p>${escape(p['help'+section+'Body'])}</p>${section==='Create'?'<p><a href="https://discord.com/developers/applications">Discord Developer Portal ↗</a></p>':''}${section==='Env'?'<pre>DISCORD_TOKEN=YOUR_BOT_TOKEN_HERE\nTARGET_GUILD_ID=\nOWNER_ID=</pre>':''}${section==='Use'?'<img src="discord-menu.png" alt="Save Emoji workflow illustration (not a screenshot)">':''}`).join('')}
<footer>Config: %LOCALAPPDATA%\\DiscordSaveEmoji\\.env · Binding: .dse.json · <a href="https://github.com/ArthurLauCS/DiscordSaveEmoji">GitHub</a></footer></html>`);
}
