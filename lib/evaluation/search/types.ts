import type { DroydSearchOptions, DroydSearchResponse } from '../../utils/droydSearch';
import type { WebSearchOptions, WebSearchResult } from '../../utils/webSearch';
import type { ParallelSearchOptions, ParallelSearchResponse } from '../../utils/parallelSearch';
import type { ValyuSearchOptions, ValyuSearchResponse } from '../../utils/valyuSearch';
import type { SearchEvaluation } from './evaluateSearchResult';
import type { EvalQuestion } from '../../../datasets/types/evalQuestion';

/**
 * Supported search systems
 */
export type SearchSystem = 'droyd' | 'exa' | 'parallel' | 'valyu';

/**
 * Configuration for search evaluation runs
 */
export interface SearchEvaluationConfig {
  /** Which search systems to evaluate */
  searchSystems: SearchSystem[];

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

  /** Use test datasets (datasets/search/test/) instead of full datasets */
  useTestDatasets?: boolean;

  /** Enable pairwise comparison evaluation (default: false) */
  enablePairwiseComparison?: boolean;

  /** Ranking method to use when pairwise comparison is enabled (default: 'elo') */
  rankingMethod?: 'elo' | 'bradley-terry';

  /** Configuration for Droyd search (if testing Droyd) */
  droydConfig?: Partial<DroydSearchOptions>;

  /** Configuration for Exa search (if testing Exa) */
  exaConfig?: Partial<WebSearchOptions>;

  /** Configuration for Parallel search (if testing Parallel) */
  parallelConfig?: Partial<ParallelSearchOptions>;

  /** Configuration for Valyu search (if testing Valyu) */
  valyuConfig?: Partial<ValyuSearchOptions>;

  /** Keep formattedSearchContents in output (default: false - strips to reduce file size) */
  keepFormattedContents?: boolean;
}

/**
 * Result from executing a search on one system
 */
export interface SearchSystemResult {
  /** Which search system was used */
  system: SearchSystem;

  /** Raw response from the search API (as-is, not normalized) */
  rawResponse: DroydSearchResponse | WebSearchResult[] | ParallelSearchResponse | ValyuSearchResponse;

  /** Search parameters used for this query */
  searchParams: DroydSearchOptions | WebSearchOptions | ParallelSearchOptions | ValyuSearchOptions;

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

  /** Evaluations for each successful search (0-10 scoring) */
  evaluations: {
    system: SearchSystem;
    evaluation: SearchEvaluation;
    formattedSearchContents: string;
    /** Estimated token count of the formatted search contents */
    tokenCount: number;
  }[];

  /** Pairwise comparisons for this question (only present if pairwise comparison is enabled) */
  pairwiseComparisons?: SearchPairwiseComparison[];

  /** Rankings for this question (only present if pairwise comparison is enabled) */
  rankings?: {
    elo?: EloRating[];
    bradleyTerry?: BradleyTerryRating[];
  };

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

    /** Total pairwise comparisons made (only if pairwise enabled) */
    totalComparisons?: number;

    /** Final ELO rankings across all questions (only if pairwise enabled) */
    eloRankings?: EloRating[];

    /** Final Bradley-Terry rankings (only if pairwise enabled) */
    bradleyTerryRankings?: BradleyTerryRating[];

    /** Win rate matrix: system1 vs system2 (only if pairwise enabled) */
    winRateMatrix?: {
      [systemPair: string]: {
        system1: string;
        system2: string;
        system1Wins: number;
        system2Wins: number;
        ties: number;
        system1WinRate: number;
      };
    };

    /** Average token count per system */
    averageTokenCount?: {
      [system: string]: number;
    };
  };

  /** Path where results were saved */
  outputPath?: string;
}

// ============================================================================
// Pairwise Comparison Types
// ============================================================================

/**
 * A single pairwise comparison between two search systems
 */
export interface SearchPairwiseComparison {
  /** Question ID this comparison is for */
  questionId: string;

  /** System A identifier (e.g., 'droyd') */
  systemA: string;

  /** System B identifier (e.g., 'exa') */
  systemB: string;

  /** Winner of the comparison */
  winner: 'A' | 'B' | 'tie';

  /** Confidence level in the decision */
  confidence: 'high' | 'medium' | 'low';

  /** Which system was shown as Response 1 in the blinded comparison */
  response1System: 'A' | 'B';

  /** Overall reasoning for the decision */
  reasoning: string;

  /** Key differentiators that led to the decision */
  keyDifferentiators: string[];

  /** Timestamp of evaluation */
  timestamp: string;
}

/**
 * ELO rating for a search system
 */
export interface EloRating {
  /** System identifier */
  system: string;

  /** Current ELO rating (starts at 1500) */
  rating: number;

  /** Number of comparisons this rating is based on */
  gamesPlayed: number;

  /** Win/loss/tie record */
  record: {
    wins: number;
    losses: number;
    ties: number;
  };
}

/**
 * Bradley-Terry rating with confidence intervals
 */
export interface BradleyTerryRating {
  /** System identifier */
  system: string;

  /** Skill parameter (log-scale) */
  skill: number;

  /** Win probability against average opponent */
  winProbability: number;

  /** 95% confidence interval for skill */
  confidenceInterval: {
    lower: number;
    upper: number;
  };

  /** Standard error of the skill estimate */
  standardError: number;

  /** Number of comparisons */
  gamesPlayed: number;
}
