import { tool, zodSchema } from 'ai';
import { z } from 'zod';
import { droydSearch } from '@/lib/utils/droydSearch';

/**
 * Tool for searching crypto-specific content using Droyd API
 */
export const droydSearchTool = tool({
  description: 'Search for crypto-specific content including news, articles, developments, tweets, and YouTube videos. Supports both recent content discovery and semantic question-based search. Useful for researching crypto projects, ecosystems, trends, and market analysis.',
  inputSchema: zodSchema(z.object({
    searchMode: z.enum(['recent', 'semantic']).optional().describe('Search mode: "recent" for time-based discovery, "semantic" for question-based search (default: recent)'),
    query: z.string().optional().describe('Search query (required for semantic mode)'),
    contentTypes: z.array(z.enum(['posts', 'news', 'developments', 'tweets', 'youtube', 'memories', 'concepts'])).optional().describe('Types of content to search (default: posts, news, developments, tweets, youtube)'),
    limit: z.number().min(10).max(100).optional().describe('Number of results to return (default: 25)'),
    daysBack: z.number().min(1).max(90).optional().describe('Number of days to look back (default: 7)'),
    sortBy: z.enum(['relevance', 'date']).optional().describe('Sort results by relevance or date (default: relevance)'),
    minimumRelevanceScore: z.number().min(0).max(1).optional().describe('Minimum relevance score threshold (default: 0.2)'),
    ecosystems: z.array(z.string()).max(5).optional().describe('Filter by ecosystem slugs like "ethereum", "solana", "base" (max 5)'),
    categories: z.array(z.string()).max(5).optional().describe('Filter by category slugs like "defi", "nft", "gaming", "ai" (max 5)'),
    projectIds: z.array(z.number()).max(25).optional().describe('Filter by specific project IDs (max 25)'),
    imageLimit: z.number().min(1).max(10).optional().describe('Maximum images per result (1-10)'),
    includeAnalysis: z.boolean().optional().describe('Include AI analysis for semantic search (default: true)'),
  })),
  execute: async (params) => {
    try {
      const response = await droydSearch({
        searchMode: params.searchMode,
        query: params.query,
        contentTypes: params.contentTypes,
        limit: params.limit,
        daysBack: params.daysBack,
        sortBy: params.sortBy,
        minimumRelevanceScore: params.minimumRelevanceScore,
        ecosystems: params.ecosystems,
        categories: params.categories,
        projectIds: params.projectIds,
        imageLimit: params.imageLimit,
        includeAnalysis: params.includeAnalysis,
      });

      return {
        success: true,
        analysis: response.analysis,
        results: response.content.map((item) => ({
          postId: item.post_id,
          title: item.title,
          summary: item.summary,
          link: item.post_link,
          publishedDate: item.published_date,
          sourceName: item.source_name,
          projects: item.projects,
          relevanceScore: item.relevance_score,
        })),
        metadata: response.metadata,
        message: `Found ${response.content.length} results${params.query ? ` for: "${params.query}"` : ''}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to perform Droyd search',
      };
    }
  },
});
