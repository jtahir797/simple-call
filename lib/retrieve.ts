// Lightweight BM25 retrieval over the user's knowledge base.
// No vector DB needed: the knowledge base is small (one project) and travels with each request.

export interface Chunk {
  id: string;
  title: string;
  text: string;
}

const STOP = new Set(
  "a an the and or but if of to in on for with at by from is are was were be been being it its this that these those as do does did can could will would should we you i our your they them their he she his her not no yes so just about into than then there what when where which who why how any all some more most very also have has had get got may might".split(" ")
);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map((t) => t.replace(/(ing|ed|es|s)$/, ""));
}

/** Split markdown into chunks by heading, then by paragraph if a section is long. */
export function chunkKnowledge(md: string, maxLen = 900): Chunk[] {
  const out: Chunk[] = [];
  const sections = md.split(/\n(?=#{1,4}\s)/);
  let n = 0;
  for (const sec of sections) {
    const trimmed = sec.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^#{1,4}\s+(.*)/);
    const title = m ? m[1].trim() : "General";
    const body = m ? trimmed.slice(m[0].length).trim() : trimmed;
    if (body.length <= maxLen) {
      out.push({ id: `k${++n}`, title, text: body });
      continue;
    }
    let buf = "";
    for (const para of body.split(/\n\s*\n/)) {
      if ((buf + "\n\n" + para).length > maxLen && buf) {
        out.push({ id: `k${++n}`, title, text: buf.trim() });
        buf = "";
      }
      buf += "\n\n" + para;
    }
    if (buf.trim()) out.push({ id: `k${++n}`, title, text: buf.trim() });
  }
  return out;
}

export function retrieve(md: string, query: string, k = 6): Chunk[] {
  const chunks = chunkKnowledge(md);
  if (chunks.length <= k) return chunks;
  const docs = chunks.map((c) => tokens(c.title + " " + c.title + " " + c.text));
  const avg = docs.reduce((a, d) => a + d.length, 0) / docs.length;
  const df = new Map<string, number>();
  docs.forEach((d) => new Set(d).forEach((t) => df.set(t, (df.get(t) ?? 0) + 1)));
  const q = Array.from(new Set(tokens(query)));
  const k1 = 1.4;
  const b = 0.75;
  const N = docs.length;
  const scored = docs.map((d, i) => {
    const tf = new Map<string, number>();
    d.forEach((t) => tf.set(t, (tf.get(t) ?? 0) + 1));
    let score = 0;
    for (const t of q) {
      const f = tf.get(t);
      if (!f) continue;
      const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.length) / avg)));
    }
    return { i, score };
  });
  scored.sort((a, b2) => b2.score - a.score);
  const picked = scored.slice(0, k).filter((s) => s.score > 0).map((s) => chunks[s.i]);
  // Always give the Answer agent the status section for grounding if nothing matched.
  if (picked.length === 0) return chunks.slice(0, k);
  return picked;
}

/** Planner-driven search: run several queries, keep each chunk's best rank, return the top k. */
export function retrieveMulti(md: string, queries: string[], k = 6): Chunk[] {
  const seen = new Map<string, { c: Chunk; rank: number }>();
  queries
    .filter((q) => q && q.trim())
    .slice(0, 4)
    .forEach((q) => {
      retrieve(md, q, k).forEach((c, i) => {
        const prev = seen.get(c.id);
        if (!prev || i < prev.rank) seen.set(c.id, { c, rank: i });
      });
    });
  return Array.from(seen.values())
    .sort((a, b) => a.rank - b.rank)
    .slice(0, k)
    .map((x) => x.c);
}
