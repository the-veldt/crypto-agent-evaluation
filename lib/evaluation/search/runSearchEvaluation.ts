import { readFile, mkdir, writeFile, readdir } from 'fs/promises';
import { join, basename } from 'path';
import { encode } from 'gpt-tokenizer';
import { modelMap } from '../../agents/agentFactory/models';
import {
  executeDroydSearch,
  executeExaSearch,
  executeParallelSearch,
  executeValyuSearch,
} from './searchExecutor';
import { formatSearchResultsForEvaluation } from './searchResultFormatter';
import { evaluateSearchResult } from './evaluateSearchResult';
import { pairwiseCompareSearchResults } from './pairwiseCompareSearch';
import { calculateEloRatings, calculateBradleyTerryRatings } from './rankings';
import type { EvalQuestion } from '../../../datasets/types/evalQuestion';
import type {
  SearchEvaluationConfig,
  EvaluationRunResult,
  QuestionEvaluationResult,
  SearchSystemResult,
  SearchPairwiseComparison,
} from './types';

/**
 * Load dataset files and combine questions
 */
async function loadDatasets(
  datasets: string | string[] | 'all',
  useTestDatasets: boolean = false
): Promise<{
  questions: EvalQuestion[];
  datasetNames: string[];
}> {
  const DATASETS_DIR = useTestDatasets ? 'datasets/search/test' : 'datasets/search';
  let filePaths: string[] = [];

  if (datasets === 'all') {
    // Load all .json files from datasets directory
    const files = await readdir(DATASETS_DIR);
    filePaths = files
      .filter((f) => f.endsWith('.json'))
      .map((f) => join(DATASETS_DIR, f));
  } else if (Array.isArray(datasets)) {
    filePaths = datasets;
  } else {
    filePaths = [datasets];
  }

  if (filePaths.length === 0) {
    throw new Error('No dataset files found');
  }

  const allQuestions: EvalQuestion[] = [];
  const datasetNames: string[] = [];

  for (const filePath of filePaths) {
    console.log(`  Loading ${filePath}...`);
    const content = await readFile(filePath, 'utf-8');
    const questions: EvalQuestion[] = JSON.parse(content);
    allQuestions.push(...questions);
    datasetNames.push(basename(filePath, '.json'));
  }

  return { questions: allQuestions, datasetNames };
}

/**
 * Validate that required API keys are present
 */
function validateApiKeys(config: SearchEvaluationConfig): void {
  const errors: string[] = [];

  // Check judge model API key
  if (config.judgeModel.startsWith('claude') && !process.env.ANTHROPIC_API_KEY) {
    errors.push('ANTHROPIC_API_KEY is required for Claude models');
  }

  // Check search system API keys
  if (config.searchSystems.includes('droyd') && !process.env.DROYD_API_KEY) {
    errors.push('DROYD_API_KEY is required when testing Droyd search');
  }

  if (config.searchSystems.includes('exa') && !process.env.EXA_API_KEY) {
    errors.push('EXA_API_KEY is required when testing Exa search');
  }

  if (config.searchSystems.includes('parallel') && !process.env.PARALLEL_API_KEY) {
    errors.push('PARALLEL_API_KEY is required when testing Parallel search');
  }

  if (config.searchSystems.includes('valyu') && !process.env.VALYU_API_KEY) {
    errors.push('VALYU_API_KEY is required when testing Valyu search');
  }

  if (errors.length > 0) {
    throw new Error(`Missing required API keys:\n${errors.join('\n')}`);
  }
}

/**
 * Calculate summary statistics from evaluation results
 */
function calculateSummary(
  results: QuestionEvaluationResult[],
  config: SearchEvaluationConfig
): EvaluationRunResult['summary'] {
  const summary: EvaluationRunResult['summary'] = {
    totalQuestions: results.length,
    successfulEvaluations: 0,
    failedEvaluations: 0,
    averageScores: {},
  };

  const systemScores: {
    [system: string]: {
      overall: number[];
      queryRelevance: number[];
      quality: number[];
      informationDensity: number[];
      completeness: number[];
      tokenCounts: number[];
    };
  } = {};

  // Collect all comparisons for pairwise summary
  const allComparisons: SearchPairwiseComparison[] = [];

  // Collect all scores by system
  for (const result of results) {
    for (const evaluation of result.evaluations) {
      const { system, evaluation: evalData } = evaluation;

      if (!systemScores[system]) {
        systemScores[system] = {
          overall: [],
          queryRelevance: [],
          quality: [],
          informationDensity: [],
          completeness: [],
          tokenCounts: [],
        };
      }

      systemScores[system].overall.push(evalData.overall_score);
      systemScores[system].queryRelevance.push(evalData.query_relevance_score);
      systemScores[system].quality.push(evalData.search_contents_quality_score);
      systemScores[system].informationDensity.push(
        evalData.relevant_information_density_score
      );
      systemScores[system].completeness.push(evalData.completeness_score);
      systemScores[system].tokenCounts.push(evaluation.tokenCount);

      summary.successfulEvaluations++;
    }

    if (result.error || result.evaluations.length === 0) {
      summary.failedEvaluations++;
    }

    // Collect pairwise comparisons
    if (result.pairwiseComparisons) {
      allComparisons.push(...result.pairwiseComparisons);
    }
  }

  // Calculate averages
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  for (const [system, scores] of Object.entries(systemScores)) {
    summary.averageScores[system] = {
      overall: avg(scores.overall),
      queryRelevance: avg(scores.queryRelevance),
      quality: avg(scores.quality),
      informationDensity: avg(scores.informationDensity),
      completeness: avg(scores.completeness),
    };
  }

  // Calculate average token counts per system
  summary.averageTokenCount = {};
  for (const [system, scores] of Object.entries(systemScores)) {
    summary.averageTokenCount[system] = Math.round(avg(scores.tokenCounts));
  }

  // Add pairwise comparison summary if enabled
  if (config.enablePairwiseComparison && allComparisons.length > 0) {
    const systems = config.searchSystems;

    summary.totalComparisons = allComparisons.length;
    summary.winRateMatrix = calculateWinRateMatrix(allComparisons);

    if (config.rankingMethod === 'elo') {
      summary.eloRankings = calculateEloRatings(allComparisons, systems);
    } else {
      summary.bradleyTerryRankings = calculateBradleyTerryRatings(allComparisons, systems);
    }
  }

  return summary;
}

/**
 * Get result count from a search result based on the system type
 */
function getResultCount(result: SearchSystemResult): number {
  switch (result.system) {
    case 'droyd':
      return (result.rawResponse as any).content?.length || 0;
    case 'exa':
      return (result.rawResponse as any[]).length;
    case 'parallel':
      return (result.rawResponse as any).results?.length || 0;
    case 'valyu':
      return (result.rawResponse as any).results?.length || 0;
    default:
      return 0;
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
 * Calculate win rate matrix from comparisons
 */
function calculateWinRateMatrix(comparisons: SearchPairwiseComparison[]): {
  [systemPair: string]: {
    system1: string;
    system2: string;
    system1Wins: number;
    system2Wins: number;
    ties: number;
    system1WinRate: number;
  };
} {
  const matrix: {
    [systemPair: string]: {
      system1: string;
      system2: string;
      system1Wins: number;
      system2Wins: number;
      ties: number;
      system1WinRate: number;
    };
  } = {};

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
 * Run search evaluation for a dataset
 *
 * @param config - Evaluation configuration
 * @returns Complete evaluation results
 */
export async function runSearchEvaluation(
  config: SearchEvaluationConfig
): Promise<EvaluationRunResult> {
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

  const evaluationResult: EvaluationRunResult = {
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
      averageScores: {},
    },
  };

  // 6. Process each question
  console.log(`Processing ${questions.length} questions...\n`);

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const questionNum = i + 1;

    console.log(`Processing Question ${questionNum}/${questions.length} (qid: ${question.qid})`);
    console.log(`  Query: "${question.query}"`);

    const questionResult: QuestionEvaluationResult = {
      question,
      searchResults: [],
      evaluations: [],
      timestamp: new Date().toISOString(),
    };

    try {
      // Execute searches for configured systems
      const searchPromises: Promise<SearchSystemResult>[] = [];

      for (const system of config.searchSystems) {
        if (system === 'droyd') {
          searchPromises.push(executeDroydSearch(question.query, config.droydConfig));
        } else if (system === 'exa') {
          searchPromises.push(executeExaSearch(question.query, config.exaConfig));
        } else if (system === 'parallel') {
          searchPromises.push(executeParallelSearch(question.query, config.parallelConfig));
        } else if (system === 'valyu') {
          searchPromises.push(executeValyuSearch(question.query, config.valyuConfig));
        }
      }

      const searchResults = await Promise.all(searchPromises);
      questionResult.searchResults = searchResults;

      // Log search execution
      for (const result of searchResults) {
        if (result.error) {
          console.log(`  Running ${result.system} search... ✗ (${result.error})`);
        } else {
          const resultCount = getResultCount(result);
          console.log(
            `  Running ${result.system} search... ✓ (${(result.executionTimeMs / 1000).toFixed(1)}s, ${resultCount} results)`
          );
        }
      }

      // Evaluate each successful search
      for (const searchResult of searchResults) {
        if (searchResult.error) {
          continue; // Skip failed searches
        }

        try {
          const formattedContents = formatSearchResultsForEvaluation(
            searchResult,
            question.query
          );

          const evaluation = await evaluateSearchResult({
            model: judgeModel,
            evalQuestion: question.query,
            searchContents: formattedContents,
          });

          const tokenCount = encode(formattedContents).length;

          questionResult.evaluations.push({
            system: searchResult.system,
            evaluation,
            formattedSearchContents: formattedContents,
            tokenCount,
          });

          console.log(
            `  Evaluating ${searchResult.system} results... ✓ (score: ${evaluation.overall_score.toFixed(1)}/10, tokens: ${tokenCount})`
          );
        } catch (error) {
          console.log(
            `  Evaluating ${searchResult.system} results... ✗ (${error instanceof Error ? error.message : 'Unknown error'})`
          );
        }
      }

      // Pairwise comparisons (if enabled)
      if (config.enablePairwiseComparison) {
        const successfulResults = searchResults.filter((r) => !r.error);
        const successfulSystems = successfulResults.map((r) => r.system);

        if (successfulResults.length >= 2) {
          const pairs = generateAllPairs(successfulSystems);
          console.log(`  Running ${pairs.length} pairwise comparisons...`);

          const comparisonPromises = pairs.map(([systemA, systemB]) => {
            const resultA = successfulResults.find((r) => r.system === systemA)!;
            const resultB = successfulResults.find((r) => r.system === systemB)!;

            return pairwiseCompareSearchResults({
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
            questionResult.rankings = {
              elo: calculateEloRatings(comparisons, successfulSystems),
            };
          } else {
            questionResult.rankings = {
              bradleyTerry: calculateBradleyTerryRatings(comparisons, successfulSystems),
            };
          }
        } else {
          console.log(
            `  ⚠ Only ${successfulResults.length} successful search(es), skipping pairwise comparisons`
          );
        }
      }
    } catch (error) {
      questionResult.error =
        error instanceof Error ? error.message : 'Unknown error';
      console.log(`  Error processing question: ${questionResult.error}`);
    }

    evaluationResult.results.push(questionResult);
    console.log('');
  }

  // 7. Calculate summary statistics
  evaluationResult.summary = calculateSummary(evaluationResult.results, config);

  // 8. Strip formattedSearchContents if not keeping (default: strip to reduce file size)
  if (!config.keepFormattedContents) {
    for (const result of evaluationResult.results) {
      for (const evaluation of result.evaluations) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (evaluation as any).formattedSearchContents;
      }
    }
  }

  // 9. Save results
  const timestamp = runId.replace(/:/g, '-').replace(/\..+/, '');
  const outputFileName = `search-eval-${dataset}-${timestamp}.json`;
  const outputPath = join(config.outputDir, outputFileName);

  await writeFile(outputPath, JSON.stringify(evaluationResult, null, 2), 'utf-8');

  evaluationResult.outputPath = outputPath;

  return evaluationResult;
}
