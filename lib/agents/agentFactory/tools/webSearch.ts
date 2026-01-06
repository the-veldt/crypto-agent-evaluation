import { tool, zodSchema } from 'ai';
import { z } from 'zod';
import { webSearch } from '@/lib/utils/webSearch';

/**
 * Tool for performing web searches using Exa to retrieve current information
 */
export const webSearchTool = tool({
  description: 'Search the web for current information and retrieve content. Useful for finding up-to-date information, news, articles, and web content. Returns title, URL, and text content from search results.',
  inputSchema: zodSchema(z.object({
    query: z.string().describe('The search query'),
    numResults: z.number().optional().describe('Number of results to return (default: 5)'),
    startPublishedDate: z.string().optional().describe('Filter results published after this date (YYYY-MM-DD format)'),
    endPublishedDate: z.string().optional().describe('Filter results published before this date (YYYY-MM-DD format)'),
    includeDomains: z.array(z.string()).optional().describe('Only include results from these domains'),
    maxCharacters: z.number().optional().describe('Maximum characters of text content per result (default: 2000)'),
  })),
  execute: async (params) => {
    try {
      const results = await webSearch({
        query: params.query,
        numResults: params.numResults,
        startPublishedDate: params.startPublishedDate,
        endPublishedDate: params.endPublishedDate,
        includeDomains: params.includeDomains,
        includeText: true,
        maxCharacters: params.maxCharacters,
      });

      return {
        success: true,
        results: results.map((result) => ({
          title: result.title,
          url: result.url,
          publishedDate: result.publishedDate,
          author: result.author,
          text: result.text,
          score: result.score,
        })),
        message: `Found ${results.length} results for query: "${params.query}"`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to perform web search',
      };
    }
  },
});
