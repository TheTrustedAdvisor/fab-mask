/*
 * Sensitive-text detection. Pure functions, no DOM access.
 * createDetector(settings) -> { test(text): boolean, redact(text, replacement?): string }
 */
(function (root) {
  'use strict';

  // Each category is a list of regex *sources*; they are compiled into one alternation per
  // detector so a text node is scanned only once.
  const PATTERNS = {
    guid: [
      // Workspace, item, tenant, capacity, gateway, connection IDs …
      String.raw`\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b`
    ],
    email: [
      // UPNs and e-mail addresses incl. guest accounts (user_contoso.com#EXT#@tenant.onmicrosoft.com)
      String.raw`[a-z0-9._%+'#-]{1,64}@[a-z0-9-]{1,63}(?:\.[a-z0-9-]{1,63}){0,10}\.[a-z]{2,24}\b`
    ],
    endpoint: [
      // SQL analytics endpoints, warehouses, KQL / Eventhouse, Spark, Azure data services
      String.raw`\b[a-z0-9][a-z0-9-]{0,62}(?:\.[a-z0-9-]{1,63}){0,6}\.(?:datawarehouse\.fabric\.microsoft\.com|datawarehouse\.pbidedicated\.windows\.net|kusto\.fabric\.microsoft\.com|pbidedicated\.windows\.net|database\.windows\.net|sql\.azuresynapse\.net|dfs\.core\.windows\.net|blob\.core\.windows\.net|vault\.azure\.net|servicebus\.windows\.net|kusto\.windows\.net|dynamics\.com|sharepoint\.com|azuredatabricks\.net|snowflakecomputing\.com|documents\.azure\.com|azurewebsites\.net)\b`,
      // Power Query data source references as shown in semantic model settings:
      // Sql{"server":"…","database":"…"}, Extension{"extensionDataSourcePath":"https://org.crm.dynamics.com"}
      String.raw`\b[a-z][a-z0-9.]{0,40}\{\s{0,5}"[a-z]{1,40}"\s{0,5}:\s{0,5}"[^"]{0,2048}"`,
      // OneLake / ADLS paths (abfss://ws@onelake.dfs.fabric.microsoft.com/…, https://onelake…/…)
      String.raw`\b(?:abfss?|https?):\/\/[^\s"'<>]{0,256}onelake[^\s"'<>]{0,2048}`,
      String.raw`\babfss?:\/\/[^\s"'<>]+`,
      // XMLA endpoint – contains the workspace name
      String.raw`\bpowerbi:\/\/[^\s"'<>]+`,
      // Connection-string fragments
      String.raw`\b(?:server|data source|initial catalog|user id|uid|endpoint|addr|address)\s{0,5}=\s{0,5}[^;"'<>\n]{1,2048}`
    ],
    secret: [
      // JSON Web Tokens (bearer tokens)
      // Anchored at the start of a token run: `\b` alone would retry after every '-' (quadratic).
      String.raw`(?<![a-z0-9_-])eyJ[a-z0-9_-]{10,4096}\.[a-z0-9_-]{10,4096}\.[a-z0-9_-]{10,4096}`,
      // key=value secrets in connection strings / SAS URLs
      String.raw`\b(?:accountkey|sharedaccesskey|password|pwd|client_?secret|sig|api[_-]?key|access[_-]?token)\s{0,5}[=:]\s{0,5}[^\s;&"'<>]{6,}`,
      // Azure storage account keys (88 chars base64)
      String.raw`(?<![a-z0-9+/])[a-z0-9+/]{86}==`
    ],
    ipAddress: [
      String.raw`\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b`
    ]
  };

  const DETECTABLE_CATEGORIES = Object.keys(PATTERNS);
  const CHUNK_SIZE = 65536;
  const CHUNK_OVERLAP = 8192;

  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function buildSources(settings) {
    const sources = [];
    const categories = (settings && settings.categories) || {};
    for (const key of DETECTABLE_CATEGORIES) {
      if (categories[key]) sources.push(...PATTERNS[key]);
    }
    const terms = (settings && settings.customTerms) || [];
    for (const term of terms) {
      if (typeof term !== 'string' || term.trim().length < 2) continue;
      const t = term.trim();
      // Whole-word match where the term starts/ends with a word character ("AB" ≠ "ABOUT").
      const start = /^\w/.test(t) ? String.raw`(?<![\p{L}\p{N}_])` : '';
      const end = /\w$/.test(t) ? String.raw`(?![\p{L}\p{N}_])` : '';
      sources.push(start + escapeRegExp(t) + end);
    }
    return sources;
  }

  const NOOP_DETECTOR = Object.freeze({
    active: false,
    test: () => false,
    redact: (text) => text
  });

  function createDetector(settings) {
    const sources = buildSources(settings);
    if (sources.length === 0) return NOOP_DETECTOR;
    const source = sources.map((s) => `(?:${s})`).join('|');
    const testRe = new RegExp(source, 'iu');
    const globalRe = new RegExp(source, 'giu');
    return {
      active: true,
      test(text) {
        if (typeof text !== 'string' || text.length === 0) return false;
        if (text.length <= CHUNK_SIZE) return testRe.test(text);
        // Very long texts (notebook outputs, JSON) are tested in overlapping chunks so the cost of a
        // single call stays bounded; matches are far shorter than the overlap.
        for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
          if (testRe.test(text.slice(i, i + CHUNK_SIZE))) return true;
        }
        return false;
      },
      redact(text, replacement = '••••••') {
        if (typeof text !== 'string' || !text) return text;
        globalRe.lastIndex = 0;
        return text.replace(globalRe, replacement);
      }
    };
  }

  const api = { PATTERNS, DETECTABLE_CATEGORIES, createDetector, escapeRegExp };

  root.FabricMask = Object.assign(root.FabricMask || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
