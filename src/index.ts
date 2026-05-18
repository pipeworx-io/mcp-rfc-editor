interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * RFC Editor MCP.
 */


const BASE = 'https://www.rfc-editor.org';
const UA = 'pipeworx-mcp-rfc-editor/1.0 (+https://pipeworx.io)';
const TTL_MS = 6 * 60 * 60 * 1000;
let INDEX_CACHE: { at: number; xml: string } | null = null;

const tools: McpToolExport['tools'] = [
  { name: 'rfc_text', description: 'Full RFC plain text.', inputSchema: { type: 'object', properties: { number: { type: 'number' } }, required: ['number'] } },
  { name: 'rfc_metadata', description: 'RFC index entry metadata.', inputSchema: { type: 'object', properties: { number: { type: 'number' } }, required: ['number'] } },
  { name: 'errata', description: 'Known errata.', inputSchema: { type: 'object', properties: { number: { type: 'number' } } } },
  { name: 'bcp', description: 'BCP → RFC list.', inputSchema: { type: 'object', properties: { number: { type: 'number' } }, required: ['number'] } },
  { name: 'std', description: 'STD → RFC list.', inputSchema: { type: 'object', properties: { number: { type: 'number' } }, required: ['number'] } },
  { name: 'search', description: 'Substring search in title/abstract.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, status: { type: 'string' } }, required: ['query'] } },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'rfc_text': {
      const n = ((args.number as number) | 0).toString();
      const res = await fetch(`${BASE}/rfc/rfc${n}.txt`, { headers: { 'User-Agent': UA } });
      if (res.status === 404) throw new Error(`RFC ${n} not found.`);
      if (!res.ok) throw new Error(`RFC Editor: ${res.status}`);
      return { rfc: Number(n), format: 'text', body: await res.text() };
    }
    case 'rfc_metadata': {
      const n = ((args.number as number) | 0).toString().padStart(4, '0');
      const xml = await loadIndex();
      const entry = extractEntry(xml, `RFC${n}`, 'rfc-entry');
      return entry ? parseRfcEntry(entry) : null;
    }
    case 'errata': {
      const n = args.number != null ? ((args.number as number) | 0).toString() : '';
      const url = n ? `${BASE}/errata/rfc${n}.json` : `${BASE}/errata.json`;
      const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
      if (!res.ok) throw new Error(`RFC Editor errata: ${res.status}`);
      try { return await res.json(); } catch { return { format: 'raw', body: await res.text() }; }
    }
    case 'bcp':
    case 'std': {
      const kind = name.toUpperCase();
      const n = ((args.number as number) | 0).toString().padStart(4, '0');
      const xml = await loadIndex();
      const entry = extractEntry(xml, `${kind}${n}`, `${name === 'bcp' ? 'bcp' : 'std'}-entry`);
      return entry ? extractRfcList(entry) : null;
    }
    case 'search': {
      const q = reqStr(args, 'query', '"transport"').toLowerCase();
      const status = (args.status as string | undefined)?.toUpperCase();
      const xml = await loadIndex();
      const out: unknown[] = [];
      const re = /<rfc-entry>([\s\S]*?)<\/rfc-entry>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(xml)) !== null) {
        const body = m[1];
        const title = matchOne(/<title>([\s\S]*?)<\/title>/, body) ?? '';
        const abstract = matchOne(/<abstract>([\s\S]*?)<\/abstract>/, body) ?? '';
        const cur = matchOne(/<current-status>([\s\S]*?)<\/current-status>/, body);
        if (status && cur && cur.trim().toUpperCase() !== status) continue;
        const blob = `${title} ${abstract}`.toLowerCase();
        if (blob.includes(q)) {
          out.push(parseRfcEntry(m[0]));
          if (out.length >= 100) break;
        }
      }
      return { query: q, count: out.length, results: out };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function extractEntry(xml: string, idText: string, kind: 'rfc-entry' | 'bcp-entry' | 'std-entry'): string | null {
  const re = new RegExp(`<${kind}>([\\s\\S]*?<doc-id>${idText}<\\/doc-id>[\\s\\S]*?)<\\/${kind}>`);
  const m = re.exec(xml);
  return m ? m[0] : null;
}

function parseRfcEntry(xml: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ['doc-id', 'title', 'date', 'current-status', 'publication-status', 'abstract']) {
    const v = matchOne(new RegExp(`<${k}>([\\s\\S]*?)<\\/${k}>`), xml);
    if (v) out[k.replace('-', '_')] = v.trim();
  }
  const authors: string[] = [];
  for (const m of xml.matchAll(/<author>([\s\S]*?)<\/author>/g)) {
    const name = matchOne(/<name>([\s\S]*?)<\/name>/, m[1]);
    if (name) authors.push(name.trim());
  }
  if (authors.length) out.authors = authors;
  return out;
}

function extractRfcList(xml: string): unknown {
  const rfcs: string[] = [];
  for (const m of xml.matchAll(/<doc-id>(RFC\d+)<\/doc-id>/g)) rfcs.push(m[1]);
  return { rfcs };
}

async function loadIndex(): Promise<string> {
  const now = Date.now();
  if (INDEX_CACHE && now - INDEX_CACHE.at < TTL_MS) return INDEX_CACHE.xml;
  const res = await fetch(`${BASE}/rfc-index.xml`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`RFC index: ${res.status}`);
  const xml = await res.text();
  INDEX_CACHE = { at: now, xml };
  return xml;
}

function matchOne(re: RegExp, s: string): string | null {
  const m = re.exec(s);
  return m ? m[1] : null;
}

function reqStr(args: Record<string, unknown>, key: string, example: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Required argument "${key}" is missing. Pass a string like ${example}.`);
  return v;
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
