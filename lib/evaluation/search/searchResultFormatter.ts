import type { SearchSystemResult } from './types';

/**
 * Format search results as a string for LLM evaluation
 * Converts raw JSON response to formatted text with metadata
 *
 * @param searchResult - The search result to format
 * @param query - The original query
 * @returns Formatted string for LLM consumption
 */
export function formatSearchResultsForEvaluation(
  searchResult: SearchSystemResult,
  query: string
): string {
  return `Search System: ${searchResult.system}
Query: "${query}"

Search Results (JSON):
${JSON.stringify(searchResult.rawResponse, null, 2)}

Execution Time: ${searchResult.executionTimeMs.toFixed(2)}ms
Search Parameters: ${JSON.stringify(searchResult.searchParams, null, 2)}`;
}
