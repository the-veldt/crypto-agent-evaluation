import { droydSearch, type DroydSearchOptions } from '../../utils/droydSearch';
import { webSearch, type WebSearchOptions } from '../../utils/webSearch';
import { parallelSearch, type ParallelSearchOptions } from '../../utils/parallelSearch';
import { valyuSearch, type ValyuSearchOptions } from '../../utils/valyuSearch';
import type { SearchSystemResult } from './types';

/**
 * Execute a Droyd search and capture metadata
 * @param query - The search query
 * @param config - Droyd search configuration
 * @returns Search result with raw response and metadata
 */
export async function executeDroydSearch(
  query: string,
  config: Partial<DroydSearchOptions> = {}
): Promise<SearchSystemResult> {
  const startTime = performance.now();

  const searchParams: DroydSearchOptions = {
    query,
    ...config,
  };

  try {
    const rawResponse = await droydSearch(searchParams);
    const executionTimeMs = performance.now() - startTime;

    return {
      system: 'droyd',
      rawResponse,
      searchParams,
      executionTimeMs,
    };
  } catch (error) {
    const executionTimeMs = performance.now() - startTime;

    return {
      system: 'droyd',
      rawResponse: {
        success: false,
        content: [],
        metadata: {
          content_types: [],
          days_back: config.daysBack || 30,
          total_results: 0,
          limit: config.limit || 25,
        },
      },
      searchParams,
      executionTimeMs,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute an Exa web search and capture metadata
 * @param query - The search query
 * @param config - Exa search configuration
 * @returns Search result with raw response and metadata
 */
export async function executeExaSearch(
  query: string,
  config: Partial<WebSearchOptions> = {}
): Promise<SearchSystemResult> {
  const startTime = performance.now();

  const searchParams: WebSearchOptions = {
    query,
    ...config,
  };

  try {
    const rawResponse = await webSearch(searchParams);
    const executionTimeMs = performance.now() - startTime;

    return {
      system: 'exa',
      rawResponse,
      searchParams,
      executionTimeMs,
    };
  } catch (error) {
    const executionTimeMs = performance.now() - startTime;

    return {
      system: 'exa',
      rawResponse: [],
      searchParams,
      executionTimeMs,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute a Parallel search and capture metadata
 * @param query - The search query (used as objective)
 * @param config - Parallel search configuration
 * @returns Search result with raw response and metadata
 */
export async function executeParallelSearch(
  query: string,
  config: Partial<ParallelSearchOptions> = {}
): Promise<SearchSystemResult> {
  const startTime = performance.now();

  const searchParams: ParallelSearchOptions = {
    objective: query,
    ...config,
  };

  try {
    const rawResponse = await parallelSearch(searchParams);
    const executionTimeMs = performance.now() - startTime;

    return {
      system: 'parallel',
      rawResponse,
      searchParams,
      executionTimeMs,
    };
  } catch (error) {
    const executionTimeMs = performance.now() - startTime;

    return {
      system: 'parallel',
      rawResponse: {
        results: [],
        searchId: '',
      },
      searchParams,
      executionTimeMs,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute a Valyu search and capture metadata
 * @param query - The search query
 * @param config - Valyu search configuration
 * @returns Search result with raw response and metadata
 */
export async function executeValyuSearch(
  query: string,
  config: Partial<ValyuSearchOptions> = {}
): Promise<SearchSystemResult> {
  const startTime = performance.now();

  const searchParams: ValyuSearchOptions = {
    query,
    ...config,
  };

  try {
    const rawResponse = await valyuSearch(searchParams);
    const executionTimeMs = performance.now() - startTime;

    return {
      system: 'valyu',
      rawResponse,
      searchParams,
      executionTimeMs,
    };
  } catch (error) {
    const executionTimeMs = performance.now() - startTime;

    return {
      system: 'valyu',
      rawResponse: {
        results: [],
      },
      searchParams,
      executionTimeMs,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
