import type { EvalQuestion } from '../../../datasets/types/evalQuestion';

/**
 * Configuration for agent evaluation runs
 */
export interface AgentEvaluationConfig {
  /** Which agent systems to evaluate */
  agentSystems: ('gpt-5' | 'gpt-5-mini' | 'claude-4.5-sonnet' | 'gemini-3-flash' | 'droyd')[];

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
