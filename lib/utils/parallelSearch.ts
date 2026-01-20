import Parallel from 'parallel-web';
import type { Beta } from 'parallel-web/resources/beta/beta';
import { WebSearchResult } from './webSearch';

export type ParallelSearchMode = 'one-shot' | 'agentic';

export interface ParallelSearchOptions {
  objective?: string;
  searchQueries?: string[];
  numResults?: number;
  mode?: ParallelSearchMode;
  includeDomains?: string[];
  excludeDomains?: string[];
  afterDate?: string;
  maxCharactersPerResult?: number;
  maxCharactersTotal?: number;
}

export interface ParallelSearchResult extends WebSearchResult {
  excerpts?: string[];
}

export interface ParallelSearchResponse {
  results: ParallelSearchResult[];
  searchId: string;
}

/**
 * Performs a web search using Parallel and returns content for LLM consumption
 * @param options - Search options including objective and/or search queries
 * @returns Search response with results array
 */
export async function parallelSearch(options: ParallelSearchOptions): Promise<ParallelSearchResponse> {
  const apiKey = process.env.PARALLEL_API_KEY;

  if (!apiKey) {
    throw new Error('PARALLEL_API_KEY environment variable is not set');
  }

  const client = new Parallel({ apiKey });

  const {
    objective,
    searchQueries,
    numResults = 10,
    mode = 'one-shot',
    includeDomains,
    excludeDomains,
    afterDate,
    maxCharactersPerResult,
    maxCharactersTotal,
  } = options;

  if (!objective && (!searchQueries || searchQueries.length === 0)) {
    throw new Error('At least one of objective or searchQueries must be provided');
  }

  try {
    const searchParams: Beta.BetaSearchParams = {
      max_results: numResults,
      mode,
    };

    if (objective) {
      searchParams.objective = objective;
    }
    if (searchQueries && searchQueries.length > 0) {
      searchParams.search_queries = searchQueries;
    }

    // Build source policy if any domain/date filters are provided
    if (includeDomains || excludeDomains || afterDate) {
      searchParams.source_policy = {};
      if (includeDomains && includeDomains.length > 0) {
        searchParams.source_policy.include_domains = includeDomains;
      }
      if (excludeDomains && excludeDomains.length > 0) {
        searchParams.source_policy.exclude_domains = excludeDomains;
      }
      if (afterDate) {
        searchParams.source_policy.after_date = afterDate;
      }
    }

    // Build excerpt settings if provided
    if (maxCharactersPerResult || maxCharactersTotal) {
      searchParams.excerpts = {};
      if (maxCharactersPerResult) {
        searchParams.excerpts.max_chars_per_result = maxCharactersPerResult;
      }
      if (maxCharactersTotal) {
        searchParams.excerpts.max_chars_total = maxCharactersTotal;
      }
    }

    const response = await client.beta.search(searchParams);

    // Format results to be compatible with WebSearchResult
    const results: ParallelSearchResult[] = response.results.map((result: Beta.WebSearchResult) => ({
      // WebSearchResult compatible fields
      title: result.title || '',
      url: result.url,
      publishedDate: result.publish_date || undefined,
      text: result.excerpts?.join('\n\n') || undefined,
      // Parallel-specific fields
      excerpts: result.excerpts || undefined,
    }));

    return {
      results,
      searchId: response.search_id,
    };
  } catch (error) {
    throw new Error(
      `Parallel search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
