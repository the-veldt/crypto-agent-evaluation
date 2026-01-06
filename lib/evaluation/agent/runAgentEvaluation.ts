import { readFile, mkdir, writeFile, readdir } from 'fs/promises';
import { join, basename } from 'path';
import { modelMap } from '../../agents/agentFactory/models';
import { executeAgent } from './agentExecutor';
import { formatAgentResultForEvaluation } from './agentResultFormatter';
import { evaluateAgentResult } from './evaluateAgentResult';
import type { EvalQuestion } from '../../../datasets/types/evalQuestion';
import type {
  AgentEvaluationConfig,
  EvaluationRunResult,
  QuestionEvaluationResult,
  AgentSystemResult,
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

  const allQuestions: Array<EvalQuestion & { dataset: string }> = [];
  const datasetNames: string[] = [];

  for (const filePath of filePaths) {
    console.log(`  Loading ${filePath}...`);
    const content = await readFile(filePath, 'utf-8');
    const questions: EvalQuestion[] = JSON.parse(content);
    const datasetName = basename(filePath, '.json');

    // Tag each question with its source dataset
    const taggedQuestions = questions.map(q => ({ ...q, dataset: datasetName }));
    allQuestions.push(...taggedQuestions);
    datasetNames.push(datasetName);
  }

  return { questions: allQuestions, datasetNames };
}

/**
 * Validate that required API keys are present
 */
function validateApiKeys(config: AgentEvaluationConfig): void {
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

  if (
    config.agentSystems.includes('gemini-3-flash') &&
    !process.env.GOOGLE_GENERATIVE_AI_API_KEY
  ) {
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
 * Calculate summary statistics from evaluation results
 */
export function calculateSummary(results: QuestionEvaluationResult[]) {
  const summary = {
    totalQuestions: results.length,
    successfulEvaluations: 0,
    failedEvaluations: 0,
    averageScores: {} as {
      [system: string]: {
        overall: number;
        taskCompletion: number;
        answerQuality: number;
        reasoningQuality: number;
        efficiency: number;
      };
    },
    averageScoresByDataset: {} as {
      [dataset: string]: {
        [system: string]: {
          overall: number;
          taskCompletion: number;
          answerQuality: number;
          reasoningQuality: number;
          efficiency: number;
        };
      };
    },
    averageExecutionTime: {} as {
      [system: string]: number;
    },
    averageSteps: {} as {
      [system: string]: number;
    },
  };

  const systemScores: {
    [system: string]: {
      overall: number[];
      taskCompletion: number[];
      answerQuality: number[];
      reasoningQuality: number[];
      efficiency: number[];
    };
  } = {};

  const datasetSystemScores: {
    [dataset: string]: {
      [system: string]: {
        overall: number[];
        taskCompletion: number[];
        answerQuality: number[];
        reasoningQuality: number[];
        efficiency: number[];
      };
    };
  } = {};

  const systemMetrics: {
    [system: string]: {
      executionTimes: number[];
      stepCounts: number[];
    };
  } = {};

  // Collect all scores and metrics by system
  for (const result of results) {
    for (const evaluation of result.evaluations) {
      const { system, evaluation: evalData } = evaluation;
      const dataset = result.dataset;

      // Initialize score tracking by system
      if (!systemScores[system]) {
        systemScores[system] = {
          overall: [],
          taskCompletion: [],
          answerQuality: [],
          reasoningQuality: [],
          efficiency: [],
        };
      }

      systemScores[system].overall.push(evalData.overall_score);
      systemScores[system].taskCompletion.push(evalData.task_completion_score);
      systemScores[system].answerQuality.push(evalData.answer_quality_score);
      systemScores[system].reasoningQuality.push(evalData.reasoning_quality_score);
      systemScores[system].efficiency.push(evalData.efficiency_score);

      // Initialize score tracking by dataset + system
      if (!datasetSystemScores[dataset]) {
        datasetSystemScores[dataset] = {};
      }
      if (!datasetSystemScores[dataset][system]) {
        datasetSystemScores[dataset][system] = {
          overall: [],
          taskCompletion: [],
          answerQuality: [],
          reasoningQuality: [],
          efficiency: [],
        };
      }

      datasetSystemScores[dataset][system].overall.push(evalData.overall_score);
      datasetSystemScores[dataset][system].taskCompletion.push(evalData.task_completion_score);
      datasetSystemScores[dataset][system].answerQuality.push(evalData.answer_quality_score);
      datasetSystemScores[dataset][system].reasoningQuality.push(evalData.reasoning_quality_score);
      datasetSystemScores[dataset][system].efficiency.push(evalData.efficiency_score);

      summary.successfulEvaluations++;
    }

    // Collect execution metrics from agent results
    for (const agentResult of result.agentResults) {
      if (!agentResult.error) {
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

    if (result.error || result.evaluations.length === 0) {
      summary.failedEvaluations++;
    }
  }

  // Calculate averages
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  for (const [system, scores] of Object.entries(systemScores)) {
    summary.averageScores[system] = {
      overall: avg(scores.overall),
      taskCompletion: avg(scores.taskCompletion),
      answerQuality: avg(scores.answerQuality),
      reasoningQuality: avg(scores.reasoningQuality),
      efficiency: avg(scores.efficiency),
    };
  }

  for (const [dataset, systems] of Object.entries(datasetSystemScores)) {
    summary.averageScoresByDataset[dataset] = {};
    for (const [system, scores] of Object.entries(systems)) {
      summary.averageScoresByDataset[dataset][system] = {
        overall: avg(scores.overall),
        taskCompletion: avg(scores.taskCompletion),
        answerQuality: avg(scores.answerQuality),
        reasoningQuality: avg(scores.reasoningQuality),
        efficiency: avg(scores.efficiency),
      };
    }
  }

  for (const [system, metrics] of Object.entries(systemMetrics)) {
    summary.averageExecutionTime[system] = avg(metrics.executionTimes);
    summary.averageSteps[system] = avg(metrics.stepCounts);
  }

  return summary;
}

/**
 * Run agent evaluation for a dataset
 *
 * @param config - Evaluation configuration
 * @returns Complete evaluation results
 */
export async function runAgentEvaluation(
  config: AgentEvaluationConfig
): Promise<EvaluationRunResult> {
  // 1. Validate API keys
  console.log('Validating API keys...');
  validateApiKeys(config);

  // 2. Load datasets
  console.log('Loading datasets...');
  const { questions, datasetNames } = await loadDatasets(
    config.datasets,
    config.useTestDatasets
  );
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
      averageScoresByDataset: {},
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

    const questionResult: QuestionEvaluationResult = {
      question,
      dataset: question.dataset,
      agentResults: [],
      evaluations: [],
      timestamp: new Date().toISOString(),
    };

    try {
      // Execute agents for configured systems
      const agentPromises: Promise<AgentSystemResult>[] = [];

      for (const system of config.agentSystems) {
        agentPromises.push(executeAgent(question.query, system, config));
      }

      const agentResults = await Promise.all(agentPromises);
      questionResult.agentResults = agentResults;

      // Log agent execution
      for (const result of agentResults) {
        if (result.error) {
          console.log(`  Running ${result.system} agent... ✗ (${result.error})`);
        } else {
          console.log(
            `  Running ${result.system} agent... ✓ (${(result.executionTimeMs / 1000).toFixed(1)}s, ${result.stepCount} steps)`
          );
        }
      }

      // Evaluate each successful agent run
      for (const agentResult of agentResults) {
        if (agentResult.error) {
          continue; // Skip failed agents
        }

        try {
          const formattedTrace = formatAgentResultForEvaluation(
            agentResult,
            question.query
          );

          const evaluation = await evaluateAgentResult({
            model: judgeModel,
            evalQuestion: question.query,
            agentTrace: formattedTrace,
          });

          questionResult.evaluations.push({
            system: agentResult.system,
            evaluation,
            formattedAgentTrace: formattedTrace,
          });

          console.log(
            `  Evaluating ${agentResult.system} results... ✓ (score: ${evaluation.overall_score.toFixed(1)}/10)`
          );
        } catch (error) {
          console.log(
            `  Evaluating ${agentResult.system} results... ✗ (${error instanceof Error ? error.message : 'Unknown error'})`
          );
        }
      }
    } catch (error) {
      questionResult.error = error instanceof Error ? error.message : 'Unknown error';
      console.log(`  Error processing question: ${questionResult.error}`);
    }

    evaluationResult.results.push(questionResult);
    console.log('');
  }

  // 7. Calculate summary statistics
  evaluationResult.summary = calculateSummary(evaluationResult.results);

  // 8. Save results
  const timestamp = runId.replace(/:/g, '-').replace(/\..+/, '');
  const outputFileName = `agent-eval-${dataset}-${timestamp}.json`;
  const outputPath = join(config.outputDir, outputFileName);

  await writeFile(outputPath, JSON.stringify(evaluationResult, null, 2), 'utf-8');

  evaluationResult.outputPath = outputPath;

  return evaluationResult;
}
