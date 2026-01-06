import type { DroydSearchOptions, DroydSearchResponse } from '../../utils/droydSearch';
import type { WebSearchOptions, WebSearchResult } from '../../utils/webSearch';
import type { SearchEvaluation } from './evaluateSearchResult';
import type { EvalQuestion } from '../../../datasets/types/evalQuestion';

/**
 * Configuration for search evaluation runs
 */
export interface SearchEvaluationConfig {
  /** Which search systems to evaluate ('droyd', 'exa', or both) */
  searchSystems: ('droyd' | 'exa')[];

  /**
   * Dataset file(s) to evaluate:
   * - Single file: 'datasets/search/assetDiscovery.json'
   * - Multiple files: ['datasets/search/assetDiscovery.json', 'datasets/search/other.json']
   * - All files: 'all' (loads all .json files from datasets/search/)
   */
  datasets: string | string[] | 'all';

  /** Model name to use as judge (e.g., 'claude-4.5-sonnet') */
  judgeModel: string;

  /** Directory to save evaluation results */
  outputDir: string;

  /** Configuration for Droyd search (if testing Droyd) */
  droydConfig?: Partial<DroydSearchOptions>;

  /** Configuration for Exa search (if testing Exa) */
  exaConfig?: Partial<WebSearchOptions>;
}

/**
 * Result from executing a search on one system
 */
export interface SearchSystemResult {
  /** Which search system was used */
  system: 'droyd' | 'exa';

  /** Raw response from the search API (as-is, not normalized) */
  rawResponse: DroydSearchResponse | WebSearchResult[];

  /** Search parameters used for this query */
  searchParams: DroydSearchOptions | WebSearchOptions;

  /** Time taken to execute the search in milliseconds */
  executionTimeMs: number;

  /** Error message if the search failed */
  error?: string;
}

/**
 * Evaluation results for a single question
 */
export interface QuestionEvaluationResult {
  /** The original evaluation question */
  question: EvalQuestion;

  /** Search results from each system */
  searchResults: SearchSystemResult[];

  /** Evaluations for each successful search */
  evaluations: {
    system: 'droyd' | 'exa';
    evaluation: SearchEvaluation;
    formattedSearchContents: string;
  }[];

  /** When this question was evaluated */
  timestamp: string;

  /** Error message if evaluation failed for this question */
  error?: string;
}

/**
 * Complete results from an evaluation run
 */
export interface EvaluationRunResult {
  /** Unique identifier for this run */
  runId: string;

  /** When the evaluation started */
  timestamp: string;

  /** Configuration used for this run */
  config: SearchEvaluationConfig;

  /** Dataset name (extracted from path) */
  dataset: string;

  /** Model used as judge */
  judgeModel: string;

  /** Results for each question */
  results: QuestionEvaluationResult[];

  /** Summary statistics */
  summary: {
    totalQuestions: number;
    successfulEvaluations: number;
    failedEvaluations: number;
    averageScores: {
      [system: string]: {
        overall: number;
        queryRelevance: number;
        quality: number;
        informationDensity: number;
        completeness: number;
      };
    };
  };

  /** Path where results were saved */
  outputPath?: string;
}
