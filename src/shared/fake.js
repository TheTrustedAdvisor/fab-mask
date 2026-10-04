/*
 * Deterministic fake values for the "fake data" mode. The same input always yields the same
 * output (hash-seeded), so a person or ID stays recognisable as "the same" throughout a demo
 * without revealing the original.
 */
(function (root) {
  'use strict';

  const FIRST = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Robin', 'Jamie', 'Avery', 'Riley',
    'Quinn', 'Charlie', 'Dana', 'Elliot', 'Finley', 'Harper', 'Kai', 'Lena', 'Mila', 'Noah', 'Olivia',
    'Paul', 'Rosa', 'Sofia', 'Tom', 'Uma', 'Vera', 'Yuki', 'Zoe', 'Ben'];
  const LAST = ['Meier', 'Rossi', 'Novak', 'Berg', 'Larsen', 'Costa', 'Weber', 'Silva', 'Kowalski', 'Jansen',
    'Moreau', 'Keller', 'Svensson', 'Fischer', 'Dubois', 'Horvat', 'Lindqvist', 'Brunner', 'Ortega', 'Hayes'];
  const COMPANIES = ['Contoso', 'Fabrikam', 'Northwind Traders', 'Adventure Works', 'Tailspin Toys',
    'Wingtip Toys', 'Litware', 'Proseware', 'Woodgrove Bank', 'Lamna Healthcare', 'Alpine Ski House',
    'Coho Winery', 'Trey Research', 'Fourth Coffee', 'Margie’s Travel'];
  const WORKSPACE_SUFFIX = ['Analytics', 'Sales', 'Finance', 'Operations', 'Marketing', 'Data Platform', 'Reporting'];
  const ENV = ['Prod', 'Dev', 'Test', 'UAT'];

  // Tokens kept as-is when scrambling endpoints/secrets, so the structure stays readable.
  const SAFE_TOKENS = new Set([
    'https', 'http', 'abfss', 'abfs', 'powerbi', 'onelake', 'dfs', 'blob', 'core', 'windows', 'net', 'com',
    'fabric', 'microsoft', 'datawarehouse', 'pbidedicated', 'kusto', 'database', 'sql', 'azuresynapse',
    'vault', 'azure', 'servicebus', 'dynamics', 'sharepoint', 'azuredatabricks', 'snowflakecomputing',
    'documents', 'azurewebsites', 'api', 'myorg', 'v1', 'lakehouse', 'tables', 'files', 'warehouse',
    'server', 'data', 'source', 'initial', 'catalog', 'user', 'uid', 'endpoint', 'tcp', 'accountkey',
    'sharedaccesskey', 'password', 'pwd', 'sig', 'extension', 'extensiondatasourcekind',
    'extensiondatasourcepath', 'url', 'path', 'kind', 'sites', 'crm', 'crm4', 'eyj', 'bearer'
  ]);

  const GUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

  // Per-install salt (set by the content script): without it, anyone could check a guessed original
  // value (e.g. a tenant ID) against the public algorithm.
  let salt = '';
  function setSalt(value) {
    salt = typeof value === 'string' ? value : '';
  }

  /** FNV-1a 32-bit hash (salted). */
  function hash(input) {
    const text = salt + input;
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  /** xorshift32 stream seeded from a string. */
  function rng(seedText) {
    let x = hash(seedText) || 0x9e3779b9;
    return () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return (x >>> 0) / 4294967296;
    };
  }

  const pick = (list, r) => list[Math.floor(r() * list.length)];

  function fakeGuid(original) {
    const r = rng(`guid:${original.toLowerCase()}`);
    const hex = () => Math.floor(r() * 16).toString(16);
    const part = (n) => Array.from({ length: n }, hex).join('');
    return `${part(8)}-${part(4)}-4${part(3)}-${'89ab'[Math.floor(r() * 4)]}${part(3)}-${part(12)}`;
  }

  function personParts(original) {
    const r = rng(`person:${original.trim().toLowerCase()}`);
    return [pick(FIRST, r), pick(LAST, r)];
  }

  function fakeName(original) {
    const words = original.trim().split(/\s+/).filter(Boolean);
    const [first, last] = personParts(original);
    return words.length <= 1 ? first : `${first} ${last}`;
  }

  /** "Jane Doe, John Smith" -> "Alex Meier, Sam Rossi" */
  function fakeNameList(original) {
    return original.split(/(\s*[,;]\s*)/).map((part, i) => (i % 2 ? part : part.trim() ? fakeName(part) : part)).join('');
  }

  function fakeEmail(original) {
    const local = original.split('@')[0];
    const [first, last] = personParts(local.replace(/[._-]+/g, ' '));
    return `${first}.${last}@contoso.com`.toLowerCase();
  }

  function fakeCompany(original) {
    return pick(COMPANIES, rng(`company:${original.trim().toLowerCase()}`));
  }

  function fakeWorkspace(original) {
    const r = rng(`workspace:${original.trim().toLowerCase()}`);
    return `${pick(COMPANIES, r)} ${pick(WORKSPACE_SUFFIX, r)} ${pick(ENV, r)}`;
  }

  function fakeIp(original) {
    const r = rng(`ip:${original}`);
    const n = () => 1 + Math.floor(r() * 253);
    return `10.${n()}.${n()}.${n()}`;
  }

  /** Same length and character classes, consistent per token: "x6eps4" -> "k2qza9". */
  function scrambleToken(token) {
    const r = rng(`token:${token}`);
    let out = '';
    for (const ch of token) {
      if (/[0-9]/.test(ch)) out += Math.floor(r() * 10);
      else if (/[A-Z]/.test(ch)) out += String.fromCharCode(65 + Math.floor(r() * 26));
      else if (/[a-z]/.test(ch)) out += String.fromCharCode(97 + Math.floor(r() * 26));
      else out += ch;
    }
    return out;
  }

  /** Keeps known structural tokens (hosts, keywords), scrambles everything else. */
  function scramble(text) {
    return text
      .replace(GUID_RE, (g) => fakeGuid(g))
      .replace(/[A-Za-z0-9]+/g, (tok) => (tok.length < 2 || SAFE_TOKENS.has(tok.toLowerCase()) ? tok : scrambleToken(tok)));
  }

  /** Fake value for a detected match of the given kind (see detector.classify). */
  function fakeFor(kind, match) {
    switch (kind) {
      case 'guid': return fakeGuid(match);
      case 'email': return fakeEmail(match);
      case 'name': return fakeName(match);
      case 'term': return fakeCompany(match);
      case 'ipAddress': return fakeIp(match);
      default: return scramble(match); // endpoint, secret, unknown
    }
  }

  const api = { setSalt, hash, fakeGuid, fakeName, fakeNameList, fakeEmail, fakeCompany, fakeWorkspace, fakeIp, scramble, fakeFor };
  root.FabricMask = Object.assign(root.FabricMask || {}, { fake: api });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
