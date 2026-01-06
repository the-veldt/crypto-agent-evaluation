const DROYD_API_BASE_URL = 'https://api.droyd.ai';

export type SearchMode = 'recent' | 'semantic' | 'auto';
export type ContentType = 'posts' | 'news' | 'developments' | 'tweets' | 'youtube' | 'memories' | 'concepts';
export type SortBy = 'relevance' | 'date';

export interface DroydSearchOptions {
  searchMode?: SearchMode;
  query?: string;
  contentTypes?: ContentType[];
  limit?: number;
  daysBack?: number;
  sortBy?: SortBy;
  minimumRelevanceScore?: number;
  ecosystems?: string[];
  categories?: string[];
  projectIds?: number[];
  imageLimit?: number;
  includeAnalysis?: boolean;
}

export interface DroydProject {
  project_id: number;
  project_name: string;
}

export interface DroydSearchResult {
  post_id?: number;
  title?: string;
  summary?: string;
  post_link?: string;
  published_date?: string;
  source_name?: string;
  projects?: DroydProject[];
  relevance_score?: number;
}

export interface DroydSearchResponse {
  success: boolean;
  analysis?: string;
  content: DroydSearchResult[];
  metadata: {
    content_types: string[];
    days_back: number;
    total_results: number;
    limit: number;
  };
}

/**
 * Performs a search using Droyd API for crypto-specific content
 * @param options - Search options including query, filters, and modes
 * @returns Search results with crypto content
 */
export async function droydSearch(options: DroydSearchOptions): Promise<DroydSearchResponse> {
  const apiKey = process.env.DROYD_API_KEY;

  if (!apiKey) {
    throw new Error('DROYD_API_KEY environment variable is not set');
  }

  const {
    searchMode = 'auto',
    query,
    contentTypes = ['posts', 'news', 'developments', 'tweets', 'youtube'],
    limit = 25,
    daysBack = 30,
    sortBy = 'relevance',
    minimumRelevanceScore = 0.2,
    ecosystems,
    categories,
    projectIds,
    imageLimit,
    includeAnalysis = false,
  } = options;

  // Validate semantic search requires a query
  if ((searchMode === 'semantic' || searchMode === 'auto') && !query) {
    throw new Error('query is required when search_mode is "semantic"');
  }

  // Validate limit range
  if (limit < 1 || limit > 100) {
    throw new Error('limit must be between 1 and 100');
  }

  try {
    const requestBody: any = {
      search_mode: searchMode,
      content_types: contentTypes,
      limit,
      days_back: daysBack,
      sort_by: sortBy,
      minimum_relevance_score: minimumRelevanceScore,
      include_analysis: includeAnalysis,
    };

    // Add query for semantic search
    if (query) {
      requestBody.query = query;
    }

    // Add optional filters
    if (ecosystems && ecosystems.length > 0) {
      requestBody.ecosystems = ecosystems;
    }

    if (categories && categories.length > 0) {
      requestBody.categories = categories;
    }

    if (projectIds && projectIds.length > 0) {
      requestBody.project_ids = projectIds;
    }

    if (imageLimit !== undefined) {
      requestBody.image_limit = imageLimit;
    }


    const response = await fetch(`${DROYD_API_BASE_URL}/api/v1/search`, {
      method: 'POST',
      headers: {
        'x-droyd-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Droyd API error (${response.status}): ${errorData.error || response.statusText}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error(
      `Droyd search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
