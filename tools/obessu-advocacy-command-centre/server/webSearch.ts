/**
 * Free, keyless web search used to replace Gemini's Google Search grounding.
 * Queries DuckDuckGo's HTML endpoint (no API key, no account, no cost) and
 * extracts result titles/links/snippets with a small, dependency-free parser.
 */

export interface WebSearchResult {
  title: string;
  uri: string;
  snippet: string;
}

const RESULT_BLOCK_RE = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function unwrapDuckDuckGoRedirect(href: string): string {
  // DDG HTML results wrap outbound links as //duckduckgo.com/l/?uddg=<encoded-url>&...
  try {
    const url = new URL(href.startsWith('//') ? `https:${href}` : href);
    const target = url.searchParams.get('uddg');
    return target ? decodeURIComponent(target) : href;
  } catch {
    return href;
  }
}

export async function webSearch(query: string, limit = 5): Promise<WebSearchResult[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        // A descriptive UA is good etiquette for the free HTML endpoint.
        'User-Agent': 'obessu-advocacy-command-centre-local/1.0 (+local research tool)',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Web search failed with status ${res.status}`);
    }

    const html = await res.text();
    const results: WebSearchResult[] = [];

    for (const match of html.matchAll(RESULT_BLOCK_RE)) {
      if (results.length >= limit) break;
      const [, href, titleHtml, snippetHtml] = match;
      const title = stripTags(titleHtml);
      const snippet = stripTags(snippetHtml);
      const uri = unwrapDuckDuckGoRedirect(href);
      if (title && uri) results.push({ title, uri, snippet });
    }

    return results;
  } finally {
    clearTimeout(timeout);
  }
}
