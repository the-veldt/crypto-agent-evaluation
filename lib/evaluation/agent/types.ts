import type { EvalQuestion } from '../../../datasets/types/evalQuestion';

/**
 * Configuration for agent evaluation runs
 */
export interface AgentEvaluationConfig {
  /** Which agent systems to evaluate */
  agentSystems: ('gpt-5' | 'gpt-5-mini' | 'claude-4.5-sonnet' | 'gemini-3-flash' | 'gemini-3-pro' | 'droyd' | 'droyd-casual' | 'droyd-pro' | 'surf-quick' | 'elfa-fast' | 'elfa-expert' | 'messari-assistant')[];

  /**
   * Dataset file(s) to evaluate:
   * - Single file: 'datasets/agent/assetDiscovery.json'
   * - Multiple files: ['datasets/agent/file1.json', 'datasets/agent/file2.json']
   * - All files: 'all' (loads all .json files from datasets/agent/)
   */
  datasets: string | string[] | 'all';

  /** Model name to use as judge (e.g., 'claude-4.5-sonnet') */
  judgeModel: string;

  /** Directory to save evaluation results */
  outputDir: string;

  /** Use test datasets (datasets/agent/test/) instead of full datasets */
  useTestDatasets?: boolean;

  /** Configuration for standard model agents */
  standardAgentConfig?: {
    tools: string[];        // Default: ['webSearch']
    maxSteps?: number;      // Default: 10
    instructions?: string;  // Custom system instructions
  };

  /** Configuration for Droyd agent */
  droydAgentConfig?: {
    agentType?: 'research' | 'trading' | 'agent'; // Default: 'agent'
  };

  /** Enable loading cached responses when available */
  useCache?: boolean;

  /** Directory containing cached responses (default: datasets/_results/agent/response_cache) */
  cacheDir?: string;
}

/**
 * Single step in an agent's execution
 */
export interface AgentStep {
  stepNumber: number;
  text?: string;
  toolCalls?: ToolCall[];
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * A tool call made by an agent
 */
export interface ToolCall {
  toolName: string;
  parameters: any;
  result?: any;
  executionTimeMs?: number;
  error?: string;
}

/**
 * Result from executing an agent on one task
 */
export interface AgentSystemResult {
  /** Which agent system was used (e.g., 'gpt-5', 'droyd') */
  system: string;

  /** Agent execution trace - all steps taken */
  steps: AgentStep[];

  /** Final answer extracted from agent output */
  finalAnswer: string;

  /** Total execution time in milliseconds */
  executionTimeMs: number;

  /** Total tokens used across all steps */
  totalTokens?: number;

  /** Number of steps taken */
  stepCount: number;

  /** Raw response from the agent */
  rawResponse: any;

  /** All tool calls made during execution */
  toolCalls: ToolCall[];

  /** Error message if execution failed */
  error?: string;
}

/**
 * Agent evaluation scores and reasoning
 */
export interface AgentEvaluation {
  overall_score: number;

  task_completion_score: number;
  task_completion_reasoning: string;

  answer_quality_score: number;
  answer_quality_reasoning: string;

  reasoning_quality_score: number;
  reasoning_quality_reasoning: string;

  efficiency_score: number;
  efficiency_reasoning: string;

  key_strengths: string[];
  key_weaknesses: string[];
  overall_assessment: string;
}

/**
 * Evaluation results for a single question
 */
export interface QuestionEvaluationResult {
  /** The original evaluation question */
  question: EvalQuestion;

  /** Dataset this question came from */
  dataset: string;

  /** Agent results from each system */
  agentResults: AgentSystemResult[];

  /** Evaluations for each successful agent run */
  evaluations: {
    system: string;
    evaluation: AgentEvaluation;
    formattedAgentTrace: string;
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
  config: AgentEvaluationConfig;

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
        taskCompletion: number;
        answerQuality: number;
        reasoningQuality: number;
        efficiency: number;
      };
    };
    averageScoresByDataset: {
      [dataset: string]: {
        [system: string]: {
          overall: number;
          taskCompletion: number;
          answerQuality: number;
          reasoningQuality: number;
          efficiency: number;
        };
      };
    };
    averageExecutionTime: {
      [system: string]: number;
    };
    averageSteps: {
      [system: string]: number;
    };
  };

  /** Path where results were saved */
  outputPath?: string;
}

// ============================================================================
// V2 Types - Pairwise Comparison Framework
// ============================================================================

/**
 * Comparison result for a single dimension
 */
export interface DimensionalComparison {
  /** Which system performed better on this dimension */
  winner: 'A' | 'B' | 'tie';

  /** Confidence in this dimensional assessment */
  confidence: 'high' | 'medium' | 'low';

  /** Reasoning for this dimension */
  reasoning: string;
}

/**
 * A single pairwise comparison between two agent systems
 */
export interface PairwiseComparison {
  /** Question ID this comparison is for */
  questionId: string;

  /** System A identifier (e.g., 'gpt-5') */
  systemA: string;

  /** System B identifier (e.g., 'droyd') */
  systemB: string;

  /** Winner of the comparison */
  winner: 'A' | 'B' | 'tie';

  /** Confidence level in the decision */
  confidence: 'high' | 'medium' | 'low';

  /** Which system was shown as Response 1 in the blinded comparison */
  response1System: 'A' | 'B';

  /** Dimensional assessments (optional - simplified comparisons only use overall winner) */
  dimensions?: {
    taskCompletion: DimensionalComparison;
    answerQuality: DimensionalComparison;
    reasoningQuality: DimensionalComparison;
    efficiency: DimensionalComparison;
  };

  /** Overall reasoning for the decision */
  reasoning: string;

  /** Key differentiators that led to the decision */
  keyDifferentiators: string[];

  /** Timestamp of evaluation */
  timestamp: string;
}

/**
 * ELO rating for a system
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

  /** Rating by dimension */
  dimensionalRatings?: {
    taskCompletion: number;
    answerQuality: number;
    reasoningQuality: number;
    efficiency: number;
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

  /** Dimensional skill parameters */
  dimensionalSkills?: {
    taskCompletion: number;
    answerQuality: number;
    reasoningQuality: number;
    efficiency: number;
  };
}

/**
 * Evaluation results for a single question (V2)
 */
export interface QuestionEvaluationResultV2 {
  /** The original evaluation question */
  question: EvalQuestion;

  /** Dataset this question came from */
  dataset: string;

  /** Agent results from each system */
  agentResults: AgentSystemResult[];

  /** All pairwise comparisons for this question */
  pairwiseComparisons: PairwiseComparison[];

  /** Rankings for this question */
  rankings: {
    /** ELO ratings after this question */
    elo?: EloRating[];

    /** Bradley-Terry ratings for this question */
    bradleyTerry?: BradleyTerryRating[];
  };

  /** When this question was evaluated */
  timestamp: string;

  /** Error message if evaluation failed */
  error?: string;
}

/**
 * Complete evaluation run result (V2)
 */
export interface EvaluationRunResultV2 {
  /** Unique identifier for this run */
  runId: string;

  /** When the evaluation started */
  timestamp: string;

  /** Configuration used for this run */
  config: AgentEvaluationConfigV2;

  /** Dataset name(s) */
  dataset: string;

  /** Model used as judge */
  judgeModel: string;

  /** Results for each question */
  results: QuestionEvaluationResultV2[];

  /** Summary statistics and final rankings */
  summary: {
    totalQuestions: number;
    successfulEvaluations: number;
    failedEvaluations: number;
    totalComparisons: number;

    /** Final ELO rankings across all questions */
    eloRankings?: EloRating[];

    /** Final Bradley-Terry rankings */
    bradleyTerryRankings?: BradleyTerryRating[];

    /** Win rate matrix: system1 vs system2 */
    winRateMatrix: {
      [systemPair: string]: {
        system1: string;
        system2: string;
        system1Wins: number;
        system2Wins: number;
        ties: number;
        system1WinRate: number;
      };
    };

    /** Average execution metrics (preserved from V1) */
    averageExecutionTime: {
      [system: string]: number;
    };

    averageSteps: {
      [system: string]: number;
    };

    /** Rankings by dataset */
    rankingsByDataset?: {
      [dataset: string]: {
        elo?: EloRating[];
        bradleyTerry?: BradleyTerryRating[];
      };
    };

    /** Cache statistics (only present if useCache was enabled) */
    cacheStatistics?: {
      hits: number;
      misses: number;
      hitRate: number;
    };
  };

  /** Path where results were saved */
  outputPath?: string;
}

/**
 * Configuration for agent evaluation runs (V2)
 */
export interface AgentEvaluationConfigV2 {
  /** Which agent systems to evaluate */
  agentSystems: ('gpt-5' | 'gpt-5-mini' | 'claude-4.5-sonnet' | 'gemini-3-flash' | 'gemini-3-pro' | 'droyd' | 'droyd-casual' | 'droyd-pro' | 'surf-quick' | 'elfa-fast' | 'elfa-expert' | 'messari-assistant')[];

  /** Dataset file(s) to evaluate */
  datasets: string | string[] | 'all';

  /** Model name to use as judge */
  judgeModel: string;

  /** Directory to save evaluation results */
  outputDir: string;

  /** Ranking method to use */
  rankingMethod: 'elo' | 'bradley-terry';

  /** Keep rawResponse in output (default: false) */
  keepRawResponse?: boolean;

  /** Use test datasets */
  useTestDatasets?: boolean;

  /** Configuration for standard model agents */
  standardAgentConfig?: {
    tools: string[];
    maxSteps?: number;
    instructions?: string;
  };

  /** Configuration for Droyd agent */
  droydAgentConfig?: {
    agentType?: 'research' | 'trading' | 'agent';
  };

  /** Enable loading cached responses when available */
  useCache?: boolean;

  /** Directory containing cached responses (default: datasets/_results/agent/response_cache) */
  cacheDir?: string;
}
