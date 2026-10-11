// 从消息文本解析自定义表情 <:name:id> / <a:name:id>，与 extra 合并后按 id 去重
export function parseEmojis(content, extra = []) {
  const found = [...content.matchAll(/<(a?):(\w{2,32}):(\d{17,20})>/g)].map(([, a, name, id]) => ({ id, name, animated: a === 'a' }));
  const validExtra = extra.filter((e) => /^\d{17,20}$/.test(e.id) && /^\w{2,32}$/.test(e.name ?? ''));
  return [...new Map([...found, ...validExtra].map((e) => [e.id, e])).values()];
}
