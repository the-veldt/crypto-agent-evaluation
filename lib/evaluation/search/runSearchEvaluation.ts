import { readFile, mkdir, writeFile, readdir } from 'fs/promises';
import { join, basename } from 'path';
import { modelMap } from '../../agents/agentFactory/models';
import { executeDroydSearch, executeExaSearch } from './searchExecutor';
import { formatSearchResultsForEvaluation } from './searchResultFormatter';
import { evaluateSearchResult } from './evaluateSearchResult';
import type { EvalQuestion } from '../../../datasets/types/evalQuestion';
import type {
  SearchEvaluationConfig,
  EvaluationRunResult,
  QuestionEvaluationResult,
  SearchSystemResult,
} from './types';

/**
 * Load dataset files and combine questions
 */
async function loadDatasets(datasets: string | string[] | 'all'): Promise<{
  questions: EvalQuestion[];
  datasetNames: string[];
}> {
  const DATASETS_DIR = 'datasets/search';
  let filePaths: string[] = [];

  if (datasets === 'all') {
    // Load all .json files from datasets/search/
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

  if (errors.length > 0) {
    throw new Error(`Missing required API keys:\n${errors.join('\n')}`);
  }
}

/**
 * Calculate summary statistics from evaluation results
 */
function calculateSummary(results: QuestionEvaluationResult[]) {
  const summary = {
    totalQuestions: results.length,
    successfulEvaluations: 0,
    failedEvaluations: 0,
    averageScores: {} as {
      [system: string]: {
        overall: number;
        queryRelevance: number;
        quality: number;
        informationDensity: number;
        completeness: number;
      };
    },
  };

  const systemScores: {
    [system: string]: {
      overall: number[];
      queryRelevance: number[];
      quality: number[];
      informationDensity: number[];
      completeness: number[];
    };
  } = {};

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
        };
      }

      systemScores[system].overall.push(evalData.overall_score);
      systemScores[system].queryRelevance.push(evalData.query_relevance_score);
      systemScores[system].quality.push(evalData.search_contents_quality_score);
      systemScores[system].informationDensity.push(
        evalData.relevant_information_density_score
      );
      systemScores[system].completeness.push(evalData.completeness_score);

      summary.successfulEvaluations++;
    }

    if (result.error || result.evaluations.length === 0) {
      summary.failedEvaluations++;
    }
  }

  // Calculate averages
  for (const [system, scores] of Object.entries(systemScores)) {
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

    summary.averageScores[system] = {
      overall: avg(scores.overall),
      queryRelevance: avg(scores.queryRelevance),
      quality: avg(scores.quality),
      informationDensity: avg(scores.informationDensity),
      completeness: avg(scores.completeness),
    };
  }

  return summary;
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
  const { questions, datasetNames } = await loadDatasets(config.datasets);
  console.log(`Loaded ${questions.length} questions from ${datasetNames.length} dataset(s): ${datasetNames.join(', ')}\n`);

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
        }
      }

      const searchResults = await Promise.all(searchPromises);
      questionResult.searchResults = searchResults;

      // Log search execution
      for (const result of searchResults) {
        if (result.error) {
          console.log(`  Running ${result.system} search... ✗ (${result.error})`);
        } else {
          const resultCount =
            result.system === 'droyd'
              ? (result.rawResponse as any).content?.length || 0
              : (result.rawResponse as any[]).length;
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

          questionResult.evaluations.push({
            system: searchResult.system,
            evaluation,
            formattedSearchContents: formattedContents,
          });

          console.log(
            `  Evaluating ${searchResult.system} results... ✓ (score: ${evaluation.overall_score.toFixed(1)}/10)`
          );
        } catch (error) {
          console.log(
            `  Evaluating ${searchResult.system} results... ✗ (${error instanceof Error ? error.message : 'Unknown error'})`
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
  evaluationResult.summary = calculateSummary(evaluationResult.results);

  // 8. Save results
  const timestamp = runId.replace(/:/g, '-').replace(/\..+/, '');
  const outputFileName = `search-eval-${dataset}-${timestamp}.json`;
  const outputPath = join(config.outputDir, outputFileName);

  await writeFile(outputPath, JSON.stringify(evaluationResult, null, 2), 'utf-8');

  evaluationResult.outputPath = outputPath;

  return evaluationResult;
}
