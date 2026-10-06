import { ISearchProvider, SearchResultItem, SourceType } from '../../types/research';

export class SearchProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SearchProviderError';
  }
}

/**
 * Helper to classify source quality/type based on domain and URL patterns.
 * Prefers official documentation, academic institutions, and high quality technical portals.
 */
export function classifySourceType(urlStr: string): { domain: string; sourceType: SourceType } {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();

    // Official documentation domains
    if (
      hostname.includes('react.dev') ||
      hostname.includes('reactjs.org') ||
      hostname.includes('nodejs.org') ||
      hostname.includes('python.org') ||
      hostname.includes('postgresql.org') ||
      hostname.includes('developer.mozilla.org') ||
      hostname.includes('docs.oracle.com') ||
      hostname.includes('golang.org') ||
      hostname.includes('rust-lang.org') ||
      hostname.includes('kubernetes.io') ||
      hostname.includes('typescriptlang.org') ||
      hostname.includes('w3.org') ||
      hostname.includes('ietf.org')
    ) {
      return { domain: hostname, sourceType: 'official_documentation' };
    }

    // Academic / Edu domains
    if (
      hostname.endsWith('.edu') ||
      hostname.includes('mit.edu') ||
      hostname.includes('stanford.edu') ||
      hostname.includes('berkeley.edu') ||
      hostname.includes('cmu.edu') ||
      hostname.includes('arxiv.org') ||
      hostname.includes('acm.org') ||
      hostname.includes('ieee.org')
    ) {
      return { domain: hostname, sourceType: 'academic' };
    }

    // High quality technical articles / engineering specs
    if (
      hostname.includes('geeksforgeeks.org') ||
      hostname.includes('baeldung.com') ||
      hostname.includes('digitalocean.com') ||
      hostname.includes('martinfowler.com') ||
      hostname.includes('refactoring.guru') ||
      hostname.includes('web.dev') ||
      hostname.includes('infoq.com')
    ) {
      return { domain: hostname, sourceType: 'technical_article' };
    }

    return { domain: hostname, sourceType: 'other' };
  } catch {
    return { domain: 'unknown', sourceType: 'other' };
  }
}

/**
 * Standard SearchProvider implementation using configurable HTTP API (e.g. Tavily, Serper, or generic JSON search endpoint)
 * If no key is set, throws a clear informative error without leaking secrets.
 */
export class WebSearchProvider implements ISearchProvider {
  private apiKey?: string;
  private providerType: 'tavily' | 'serper' | 'none';

  constructor(apiKey?: string) {
    this.apiKey =
      apiKey ||
      process.env.TAVILY_API_KEY ||
      process.env.SERPER_API_KEY ||
      process.env.SEARCH_API_KEY;

    if (process.env.TAVILY_API_KEY || this.apiKey?.startsWith('tvly-')) {
      this.providerType = 'tavily';
    } else if (process.env.SERPER_API_KEY) {
      this.providerType = 'serper';
    } else if (this.apiKey) {
      this.providerType = 'tavily';
    } else {
      this.providerType = 'none';
    }
  }

  public isConfigured(): boolean {
    return this.providerType !== 'none' && Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  public async search(query: string, maxResults: number = 3): Promise<SearchResultItem[]> {
    if (!this.isConfigured()) {
      throw new SearchProviderError(
        'Search provider is not configured. Please set TAVILY_API_KEY or SEARCH_API_KEY in backend/.env'
      );
    }

    if (this.providerType === 'tavily') {
      return this.searchWithTavily(query, maxResults);
    } else if (this.providerType === 'serper') {
      return this.searchWithSerper(query, maxResults);
    }

    throw new SearchProviderError('No supported search provider configured.');
  }

  private async searchWithTavily(query: string, maxResults: number): Promise<SearchResultItem[]> {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: this.apiKey,
        query,
        search_depth: 'basic',
        max_results: maxResults,
        include_answer: false,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new SearchProviderError(`Tavily search API failed (status ${res.status}): ${errText}`);
    }

    const data = (await res.json()) as Record<string, any>;
    const results: SearchResultItem[] = (data.results || []).map((r: any) => {
      const { sourceType } = classifySourceType(r.url);
      return {
        title: r.title || 'Untitled Source',
        url: r.url,
        snippet: r.content || '',
        sourceType,
      };
    });

    return results;
  }

  private async searchWithSerper(query: string, maxResults: number): Promise<SearchResultItem[]> {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': this.apiKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num: maxResults,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new SearchProviderError(`Serper search API failed (status ${res.status}): ${errText}`);
    }

    const data = (await res.json()) as Record<string, any>;
    const organic = data.organic || [];
    return organic.slice(0, maxResults).map((r: any) => {
      const { sourceType } = classifySourceType(r.link);
      return {
        title: r.title || 'Untitled Source',
        url: r.link,
        snippet: r.snippet || '',
        sourceType,
      };
    });
  }
}
