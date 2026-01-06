import Exa from 'exa-js';

export interface WebSearchOptions {
  query: string;
  numResults?: number;
  startPublishedDate?: string;
  endPublishedDate?: string;
  includeDomains?: string[];
  excludeDomains?: string[];
  includeText?: boolean;
  maxCharacters?: number;
}

export interface WebSearchResult {
  title: string;
  url: string;
  publishedDate?: string;
  author?: string;
  text?: string;
  score?: number;
}

/**
 * Performs a web search using Exa and returns content for LLM consumption
 * @param options - Search options including query and filters
 * @returns Array of search results with content
 */
export async function webSearch(options: WebSearchOptions): Promise<WebSearchResult[]> {
  const apiKey = process.env.EXA_API_KEY;

  if (!apiKey) {
    throw new Error('EXA_API_KEY environment variable is not set');
  }

  const exa = new Exa(apiKey);

  const {
    query,
    numResults = 5,
    startPublishedDate,
    endPublishedDate,
    includeDomains,
    excludeDomains,
    includeText = true,
    maxCharacters = 2000,
  } = options;

  try {
    // Use search to get both search results and content in one call
    const searchOptions: any = {
      numResults,
      startPublishedDate,
      endPublishedDate,
      includeDomains,
      excludeDomains,
    };

    if (includeText) {
      searchOptions.contents = {
        text: { maxCharacters },
      };
    }

    const results = await exa.search(query, searchOptions);

    // Format results for easier consumption
    return results.results.map((result: any) => ({
      title: result.title,
      url: result.url,
      publishedDate: result.publishedDate,
      author: result.author,
      text: result.text,
      score: result.score,
    }));
  } catch (error) {
    throw new Error(
      `Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
