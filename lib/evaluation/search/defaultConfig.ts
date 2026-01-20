import type { SearchEvaluationConfig } from './types';

/**
 * Default configuration for search evaluations
 */
export const defaultSearchEvaluationConfig: SearchEvaluationConfig = {
  searchSystems: ['droyd', 'exa', 'parallel', 'valyu'], // ['droyd', 'exa', 'parallel', 'valyu']
  datasets: 'all', // Load all dataset files from datasets/search/
  judgeModel: 'claude-4.5-sonnet', //'claude-4.5-sonnet',
  outputDir: 'datasets/_results/search',

  // Pairwise comparison settings (disabled by default)
  enablePairwiseComparison: true,
  rankingMethod: 'elo',

  // Provider-specific configurations
  droydConfig: {
    searchMode: 'auto',
    limit: 15,
    daysBack: 30,
    sortBy: 'relevance',
    minimumRelevanceScore: 0.2,
    imageLimit: 2,
    includeAnalysis: false,
    snippetLimit: 1,
  },
  exaConfig: {
    numResults: 12,
    includeText: true,
    maxCharacters: 25000,
  },
  parallelConfig: {
    numResults: 12,
    mode: 'one-shot',
    maxCharactersPerResult: 25000,
  },
  valyuConfig: {
    numResults: 12,
    searchType: 'all',
    responseLength: 'medium',
    isToolCall: false, // true (takes forever)
  },
};
