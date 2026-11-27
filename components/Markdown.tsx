// Tiny, safe markdown renderer (HTML is escaped first). Covers what the report agents produce.

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inline(s: string) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|\s)_(.+?)_(?=\s|$|[.,;:])/g, "$1<em>$2</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

export function mdToHtml(md: string): string {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let i = 0;
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push(`<p>${para.map(inline).join(para.length > 1 ? "<br/>" : "")}</p>`);
    para = [];
  };
  while (i < lines.length) {
    const raw = lines[i];
    const l = raw.trim();
    if (!l) {
      flush();
      i++;
      continue;
    }
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flush();
      const lvl = Math.min(4, Math.max(2, h[1].length));
      out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`);
      i++;
      continue;
    }
    if (/^---+$/.test(l)) {
      flush();
      out.push("<hr/>");
      i++;
      continue;
    }
    if (l.startsWith("|")) {
      flush();
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const r = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!r.every((c) => /^:?-+:?$/.test(c))) rows.push(r);
        i++;
      }
      const [head, ...body] = rows;
      out.push(
        `<table><thead><tr>${(head ?? []).map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`
      );
      continue;
    }
    if (/^[-*]\s+/.test(l)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        let t = lines[i].trim().replace(/^[-*]\s+/, "");
        let box = "";
        if (/^\[ \]\s*/.test(t)) {
          box = '<span class="box"></span>';
          t = t.replace(/^\[ \]\s*/, "");
        } else if (/^\[x\]\s*/i.test(t)) {
          box = '<span class="box done"></span>';
          t = t.replace(/^\[x\]\s*/i, "");
        }
        items.push(`<li>${box}${inline(t)}</li>`);
        i++;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    para.push(raw.replace(/\s{2,}$/, ""));
    i++;
  }
  flush();
  return out.join("\n");
}

export default function Markdown({ text }: { text: string }) {
  return <div className="md" dangerouslySetInnerHTML={{ __html: mdToHtml(text) }} />;
}
