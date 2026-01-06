import type { SearchEvaluationConfig } from './types';

/**
 * Default configuration for search evaluations
 */
export const defaultSearchEvaluationConfig: SearchEvaluationConfig = {
  searchSystems: ['droyd', 'exa'],
  datasets: 'all', // Load all dataset files from datasets/search/
  judgeModel: 'gemini-3-flash', //'claude-4.5-sonnet',
  outputDir: 'datasets/_results/search',
  droydConfig: {
    searchMode: 'auto',
    limit: 15,
    daysBack: 30,
    sortBy: 'relevance',
    minimumRelevanceScore: 0.15,
    imageLimit: 2,
    includeAnalysis: false,
  },
  exaConfig: {
    numResults: 15,
    includeText: true,
    maxCharacters: 2000,
  },
};
