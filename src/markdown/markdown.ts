// The small subset of markdown the prompts ask for: "## " headings, bullet or numbered lists,
// paragraphs and **bold**. Shared by the on-screen cards and the PDF.
export type Block =
  | { t: "h"; text: string }
  | { t: "p"; text: string }
  | { t: "ul"; items: string[] };

export function parseMd(md: string): Block[] {
  const blocks: Block[] = [];
  let list: { t: "ul"; items: string[] } | null = null;
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    let m;
    if (!line) { list = null; continue; }
    if ((m = line.match(/^#{1,4}\s+(.*)/))) { list = null; blocks.push({ t: "h", text: m[1].replace(/\*\*/g, "") }); }
    else if ((m = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)/))) { if (!list) { list = { t: "ul", items: [] }; blocks.push(list); } list.items.push(m[1]); }
    else { list = null; blocks.push({ t: "p", text: line }); }
  }
  return blocks;
}

export interface Run { text: string; bold?: true }

export function runs(s: string): Run[] {
  return s.split(/(\*\*.+?\*\*)/g).filter(Boolean)
    .map((part) => /^\*\*.+\*\*$/.test(part) ? { text: part.slice(2, -2), bold: true } : { text: part });
}
