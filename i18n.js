import { readFileSync } from 'node:fs';

export const languages = ['zh-CN', 'zh-TW', 'en'];
export const packs = Object.fromEntries(languages.map((lang) => [lang,
  JSON.parse(readFileSync(new URL(`locales/${lang}.json`, import.meta.url), 'utf8')),
]));
export function translator(locale = 'zh-CN') {
  const language = languages.includes(locale) ? locale : locale.startsWith('zh') ? 'zh-CN' : 'en';
  return (key, values = {}) => (packs[language][key] ?? packs.en[key] ?? key)
    .replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
}
