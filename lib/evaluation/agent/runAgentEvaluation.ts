/**
 * Agent Evaluation Runner V2 - Pairwise Comparison Framework
 *
 * Orchestrates evaluation using pairwise comparisons and ELO/Bradley-Terry rankings.
 * Supports automatic rawResponse stripping for smaller output files.
 */

import { readFile, mkdir, writeFile, readdir } from 'fs/promises';
import { join, basename } from 'path';
import { modelMap } from '../../agents/agentFactory/models';
import { executeAgent } from './agentExecutor';
import { pairwiseCompareSimple } from './evaluateAgentResult';
import {
  calculateEloRatings,
  calculateBradleyTerryRatings,
} from './rankings';
import type { EvalQuestion } from '../../../datasets/types/evalQuestion';
import type {
  AgentEvaluationConfigV2,
  EvaluationRunResultV2,
  QuestionEvaluationResultV2,
  AgentSystemResult,
  PairwiseComparison,
} from './types';

/**
 * Load dataset files and combine questions
 */
async function loadDatasets(
  datasets: string | string[] | 'all',
  useTestDatasets: boolean = false
): Promise<{
  questions: Array<EvalQuestion & { dataset: string }>;
  datasetNames: string[];
}> {
  const DATASETS_DIR = useTestDatasets ? 'datasets/agent/test' : 'datasets/agent';
  let filePaths: string[] = [];

  if (datasets === 'all') {
    // Load all .json files from datasets/agent/
    const files = await readdir(DATASETS_DIR);
    filePaths = files.filter((f) => f.endsWith('.json')).map((f) => join(DATASETS_DIR, f));
  } else if (Array.isArray(datasets)) {
    filePaths = datasets;
  } else {
    filePaths = [datasets];
  }

  if (filePaths.length === 0) {
    throw new Error('No dataset files found');
  }

  const allQuestions: Array<EvalQuestion & { dataset: string }> = [];
  const datasetNames: string[] = [];

  for (const filePath of filePaths) {
    console.log(`  Loading ${filePath}...`);
    const content = await readFile(filePath, 'utf-8');
    const questions: EvalQuestion[] = JSON.parse(content);
    const datasetName = basename(filePath, '.json');

    // Tag each question with its source dataset
    const taggedQuestions = questions.map((q) => ({ ...q, dataset: datasetName }));
    allQuestions.push(...taggedQuestions);
    datasetNames.push(datasetName);
  }

  return { questions: allQuestions, datasetNames };
}

/**
 * Validate that required API keys are present
 */
function validateApiKeys(config: AgentEvaluationConfigV2): void {
  const errors: string[] = [];

  // Check judge model API key
  if (config.judgeModel.startsWith('claude') && !process.env.ANTHROPIC_API_KEY) {
    errors.push('ANTHROPIC_API_KEY is required for Claude models');
  }

  if (config.judgeModel.startsWith('gpt') && !process.env.OPENAI_API_KEY) {
    errors.push('OPENAI_API_KEY is required for GPT models');
  }

  if (config.judgeModel.startsWith('gemini') && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    errors.push('GOOGLE_GENERATIVE_AI_API_KEY is required for Gemini models');
  }

  // Check agent system API keys
  if (config.agentSystems.includes('gpt-5') && !process.env.OPENAI_API_KEY) {
    errors.push('OPENAI_API_KEY is required when testing GPT-5 agent');
  }

  if ((config.agentSystems.includes('gemini-3-flash') || config.agentSystems.includes('gemini-3-pro')) && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    errors.push('GOOGLE_GENERATIVE_AI_API_KEY is required when testing Gemini agent');
  }

  if (config.agentSystems.includes('droyd') && !process.env.DROYD_API_KEY) {
    errors.push('DROYD_API_KEY is required when testing Droyd agent');
  }

  if (errors.length > 0) {
    throw new Error(`Missing required API keys:\n${errors.join('\n')}`);
  }
}

/**
 * Generate all unique pairs from a list of systems
 * For N systems, generates N*(N-1)/2 pairs
 */
function generateAllPairs(systems: string[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];

  for (let i = 0; i < systems.length; i++) {
    for (let j = i + 1; j < systems.length; j++) {
      pairs.push([systems[i], systems[j]]);
    }
  }

  return pairs;
}

/**
 * Strip rawResponse from agent results to reduce file size
 */
function stripRawResponse(agentResults: AgentSystemResult[]): AgentSystemResult[] {
  return agentResults.map((result) => {
    const { rawResponse, ...rest } = result;
    return rest as AgentSystemResult;
  });
}

/**
 * Calculate win rate matrix from comparisons
 */
function calculateWinRateMatrix(comparisons: PairwiseComparison[]): {
  [systemPair: string]: {
    system1: string;
    system2: string;
    system1Wins: number;
    system2Wins: number;
    ties: number;
    system1WinRate: number;
  };
} {
  const matrix: any = {};

  for (const comparison of comparisons) {
    const key = `${comparison.systemA}_vs_${comparison.systemB}`;

    if (!matrix[key]) {
      matrix[key] = {
        system1: comparison.systemA,
        system2: comparison.systemB,
        system1Wins: 0,
        system2Wins: 0,
        ties: 0,
        system1WinRate: 0,
      };
    }

    if (comparison.winner === 'A') {
      matrix[key].system1Wins++;
    } else if (comparison.winner === 'B') {
      matrix[key].system2Wins++;
    } else {
      matrix[key].ties++;
    }
  }

  // Calculate win rates
  for (const key in matrix) {
    const data = matrix[key];
    const total = data.system1Wins + data.system2Wins + data.ties;
    data.system1WinRate = total > 0 ? data.system1Wins / total : 0;
  }

  return matrix;
}

/**
 * Calculate summary statistics from evaluation results
 */
function calculateSummaryV2(
  results: QuestionEvaluationResultV2[],
  config: AgentEvaluationConfigV2
): EvaluationRunResultV2['summary'] {
  let totalComparisons = 0;
  let successfulEvaluations = 0;
  let failedEvaluations = 0;

  // Cache statistics tracking
  let cacheHits = 0;
  let freshExecutions = 0;

  const allComparisons: PairwiseComparison[] = [];
  const systemMetrics: {
    [system: string]: {
      executionTimes: number[];
      stepCounts: number[];
    };
  } = {};

  // Collect all data
  for (const result of results) {
    if (result.error) {
      failedEvaluations++;
      continue;
    }

    allComparisons.push(...result.pairwiseComparisons);
    totalComparisons += result.pairwiseComparisons.length;

    if (result.pairwiseComparisons.length > 0) {
      successfulEvaluations++;
    }

    // Collect execution metrics and track cache hits
    for (const agentResult of result.agentResults) {
      if (!agentResult.error) {
        // Track cache hits vs fresh executions
        if ((agentResult as any)._fromCache) {
          cacheHits++;
        } else {
          freshExecutions++;
        }

        if (!systemMetrics[agentResult.system]) {
          systemMetrics[agentResult.system] = {
            executionTimes: [],
            stepCounts: [],
          };
        }
        systemMetrics[agentResult.system].executionTimes.push(agentResult.executionTimeMs);
        systemMetrics[agentResult.system].stepCounts.push(agentResult.stepCount);
      }
    }
  }

  // Calculate rankings (no dimensional breakdowns in simple mode)
  const systems = config.agentSystems;
  let eloRankings, bradleyTerryRankings;

  if (allComparisons.length > 0) {
    if (config.rankingMethod === 'elo') {
      eloRankings = calculateEloRatings(allComparisons, systems);
    } else {
      bradleyTerryRankings = calculateBradleyTerryRatings(allComparisons, systems);
    }
  }

  // Calculate execution metrics
  const averageExecutionTime: any = {};
  const averageSteps: any = {};

  for (const [system, metrics] of Object.entries(systemMetrics)) {
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    averageExecutionTime[system] = avg(metrics.executionTimes);
    averageSteps[system] = avg(metrics.stepCounts);
  }

  return {
    totalQuestions: results.length,
    successfulEvaluations,
    failedEvaluations,
    totalComparisons,
    eloRankings,
    bradleyTerryRankings,
    winRateMatrix: calculateWinRateMatrix(allComparisons),
    averageExecutionTime,
    averageSteps,
    // Add cache statistics if cache was used
    ...(config.useCache && {
      cacheStatistics: {
        hits: cacheHits,
        misses: freshExecutions,
        hitRate: cacheHits + freshExecutions > 0 ? cacheHits / (cacheHits + freshExecutions) : 0,
      },
    }),
  };
}

/**
 * Run agent evaluation with pairwise comparisons (V2)
 *
 * @param config - Evaluation configuration
 * @returns Complete evaluation results with rankings
 */
export async function runAgentEvaluation(
  config: AgentEvaluationConfigV2
): Promise<EvaluationRunResultV2> {
  // 1. Validate API keys
  console.log('Validating API keys...');
  validateApiKeys(config);

  // 2. Load datasets
  console.log('Loading datasets...');
  const { questions, datasetNames } = await loadDatasets(config.datasets, config.useTestDatasets);
  console.log(
    `Loaded ${questions.length} questions from ${datasetNames.length} dataset(s): ${datasetNames.join(', ')}${config.useTestDatasets ? ' (TEST MODE)' : ''}\n`
  );

  // 3. Get judge model
  const modelInfo = modelMap[config.judgeModel as keyof typeof modelMap];
  if (!modelInfo) {
    throw new Error(`Unknown model: ${config.judgeModel}`);
  }
  const judgeModel = modelInfo.model;

  // 4. Create output directory
  await mkdir(config.outputDir, { recursive: true });

  // 5. Initialize result structure
  const runId = new Date().toISOString();
  const dataset = datasetNames.join('+');

  const evaluationResult: EvaluationRunResultV2 = {
    runId,
    timestamp: runId,
    config,
    dataset,
    judgeModel: config.judgeModel,
    results: [],
    summary: {
      totalQuestions: 0,
      successfulEvaluations: 0,
      failedEvaluations: 0,
      totalComparisons: 0,
      winRateMatrix: {},
      averageExecutionTime: {},
      averageSteps: {},
    },
  };

  // 6. Process each question
  console.log(`Processing ${questions.length} questions...\n`);

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const questionNum = i + 1;

    console.log(`Processing Question ${questionNum}/${questions.length} (qid: ${question.qid})`);
    console.log(`  Query: "${question.query}"`);

    const questionResult: QuestionEvaluationResultV2 = {
      question,
      dataset: question.dataset,
      agentResults: [],
      pairwiseComparisons: [],
      rankings: {},
      timestamp: new Date().toISOString(),
    };

    try {
      // Execute all agents in parallel (with cache support)
      const agentPromises = config.agentSystems.map((system) =>
        executeAgent(question.query, system, config, question.qid)
      );

      const agentResults = await Promise.all(agentPromises);
      questionResult.agentResults = agentResults;

      // Log execution
      for (const result of agentResults) {
        if (result.error) {
          console.log(`  Running ${result.system} agent... ✗ (${result.error})`);
        } else {
          console.log(
            `  Running ${result.system} agent... ✓ (${(result.executionTimeMs / 1000).toFixed(1)}s, ${result.stepCount} steps)`
          );
        }
      }

      // Filter successful results
      const successfulResults = agentResults.filter((r) => !r.error);
      const successfulSystems = successfulResults.map((r) => r.system);

      if (successfulResults.length < 2) {
        console.log(
          `  ⚠ Only ${successfulResults.length} successful agent(s), skipping pairwise comparisons`
        );
        continue;
      }

      // Generate all pairs
      const pairs = generateAllPairs(successfulSystems);
      console.log(`  Running ${pairs.length} pairwise comparisons...`);

      // Perform pairwise comparisons in parallel (simplified output-only evaluation)
      const comparisonPromises = pairs.map(([systemA, systemB]) => {
        const resultA = successfulResults.find((r) => r.system === systemA)!;
        const resultB = successfulResults.find((r) => r.system === systemB)!;

        return pairwiseCompareSimple({
          model: judgeModel,
          question: question.query,
          systemAResult: resultA,
          systemBResult: resultB,
          systemAName: systemA,
          systemBName: systemB,
        }).then((comparison) => ({
          ...comparison,
          questionId: question.qid,
        }));
      });

      const comparisons = await Promise.all(comparisonPromises);
      questionResult.pairwiseComparisons = comparisons;

      // Log comparisons
      for (const comparison of comparisons) {
        const winnerLabel =
          comparison.winner === 'tie'
            ? 'TIE'
            : comparison.winner === 'A'
              ? comparison.systemA
              : comparison.systemB;
        console.log(
          `    ${comparison.systemA} vs ${comparison.systemB}: ${winnerLabel} (${comparison.confidence})`
        );
      }

      // Calculate rankings for this question
      if (config.rankingMethod === 'elo') {
        questionResult.rankings.elo = calculateEloRatings(comparisons, successfulSystems);
      } else {
        questionResult.rankings.bradleyTerry = calculateBradleyTerryRatings(
          comparisons,
          successfulSystems
        );
      }
    } catch (error) {
      questionResult.error = error instanceof Error ? error.message : 'Unknown error';
      console.log(`  Error processing question: ${questionResult.error}`);
    }

    evaluationResult.results.push(questionResult);
    console.log('');
  }

  // 7. Calculate summary statistics
  evaluationResult.summary = calculateSummaryV2(evaluationResult.results, config);

  // 8. Strip rawResponse and cache metadata if configured (default: true)
  if (!config.keepRawResponse) {
    console.log('Stripping rawResponse data from results...');
    for (const result of evaluationResult.results) {
      result.agentResults = stripRawResponse(result.agentResults);
    }
  }

  // Always strip cache metadata before saving (internal tracking only)
  for (const result of evaluationResult.results) {
    result.agentResults = result.agentResults.map((ar) => {
      const { _fromCache, ...rest } = ar as any;
      return rest as AgentSystemResult;
    });
  }

  // 9. Save results
  const timestamp = runId.replace(/:/g, '-').replace(/\..+/, '');
  const outputFileName = `agent-eval-${dataset}-${timestamp}-v2.json`;
  const outputPath = join(config.outputDir, outputFileName);

  await writeFile(outputPath, JSON.stringify(evaluationResult, null, 2), 'utf-8');

  evaluationResult.outputPath = outputPath;

  return evaluationResult;
}
