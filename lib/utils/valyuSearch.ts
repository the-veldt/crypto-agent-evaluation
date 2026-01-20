import { Valyu, SearchOptions, SearchResult } from 'valyu-js';
import { WebSearchResult } from './webSearch';

export interface ValyuSearchOptions {
  query: string;
  numResults?: number;
  searchType?: SearchOptions['searchType'];
  startPublishedDate?: string;
  endPublishedDate?: string;
  includeDomains?: string[];
  excludeDomains?: string[];
  relevanceThreshold?: number;
  category?: string;
  countryCode?: SearchOptions['countryCode'];
  responseLength?: SearchOptions['responseLength'];
  fastMode?: boolean;
  urlOnly?: boolean;
  isToolCall?: boolean;
}

export interface ValyuSearchResult extends WebSearchResult {
  source?: string;
  content?: string;
  description?: string;
  relevanceScore?: number;
}

export interface ValyuSearchResponse {
  results: ValyuSearchResult[];
  totalCharacters?: number;
  resultsBySource?: {
    web: number;
    proprietary: number;
  };
}

/**
 * Performs a web search using Valyu and returns content for LLM consumption
 * @param options - Search options including query and filters
 * @returns Search response with results array
 */
export async function valyuSearch(options: ValyuSearchOptions): Promise<ValyuSearchResponse> {
  const apiKey = process.env.VALYU_API_KEY;

  if (!apiKey) {
    throw new Error('VALYU_API_KEY environment variable is not set');
  }

  const client = new Valyu(apiKey);

  const {
    query,
    numResults = 10,
    searchType = 'all',
    startPublishedDate,
    endPublishedDate,
    includeDomains,
    excludeDomains,
    relevanceThreshold,
    category,
    countryCode,
    responseLength = 'short',
    isToolCall = false,
    fastMode,
    urlOnly,
  } = options;

  try {
    const searchOptions: SearchOptions = {
      searchType,
      maxNumResults: numResults,
      responseLength,
    };

    if (startPublishedDate) {
      searchOptions.startDate = startPublishedDate;
    }
    if (endPublishedDate) {
      searchOptions.endDate = endPublishedDate;
    }
    if (includeDomains && includeDomains.length > 0) {
      searchOptions.includedSources = includeDomains;
    }
    if (excludeDomains && excludeDomains.length > 0) {
      searchOptions.excludeSources = excludeDomains;
    }
    if (relevanceThreshold !== undefined) {
      searchOptions.relevanceThreshold = relevanceThreshold;
    }
    if (category) {
      searchOptions.category = category;
    }
    if (countryCode) {
      searchOptions.countryCode = countryCode;
    }
    if (fastMode !== undefined) {
      searchOptions.fastMode = fastMode;
    }
    if (urlOnly !== undefined) {
      searchOptions.urlOnly = urlOnly;
    }
    if (isToolCall) {
      searchOptions.isToolCall = isToolCall;
    }

    const response = await client.search(query, searchOptions);

    if (!response.success) {
      throw new Error(response.error || 'Valyu search failed');
    }

    // Format results to be compatible with WebSearchResult while preserving Valyu-specific fields
    const results: ValyuSearchResult[] = response.results.map((result: SearchResult) => {
      const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
      return {
        // WebSearchResult compatible fields
        title: result.title,
        url: result.url,
        publishedDate: result.publication_date,
        text: content,
        score: result.relevance_score,
        // Valyu-specific fields
        source: result.source,
        content,
        description: result.description,
        relevanceScore: result.relevance_score,
      };
    });

    return {
      results,
      totalCharacters: response.total_characters,
      resultsBySource: response.results_by_source,
    };
  } catch (error) {
    throw new Error(
      `Valyu search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
