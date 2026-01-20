#!/usr/bin/env tsx

/**
 * Rerun Failed Search Pairwise Comparisons
 *
 * Reads a search evaluation result file, identifies questions that failed
 * due to context length errors, and reruns pairwise comparisons using a
 * model with larger context (e.g., Gemini with 1M tokens).
 */

import { config } from 'dotenv';
import { readFile, writeFile } from 'fs/promises';
import { basename } from 'path';
import type { LanguageModel } from 'ai';
import { modelMap } from '../lib/agents/agentFactory/models.js';
import { pairwiseCompareSearchResults } from '../lib/evaluation/search/pairwiseCompareSearch.js';
import { calculateEloRatings, calculateBradleyTerryRatings } from '../lib/evaluation/search/rankings.js';
import type {
  EvaluationRunResult,
  QuestionEvaluationResult,
  SearchSystemResult,
  SearchPairwiseComparison,
} from '../lib/evaluation/search/types.js';

config({ path: '.env.local' });

/**
 * Information about a failed question that needs rerunning
 */
interface FailedQuestion {
  index: number;
  qid: string;
  query: string;
  error: string;
  searchResults: SearchSystemResult[];
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
 * Identify questions that failed due to context length errors
 */
function identifyFailedQuestions(results: QuestionEvaluationResult[]): FailedQuestion[] {
  return results
    .map((result, index) => ({
      index,
      qid: result.question.qid,
      query: result.question.query,
      error: result.error || '',
      searchResults: result.searchResults,
      hasPairwiseComparisons: !!result.pairwiseComparisons,
    }))
    .filter((r) => {
      // Match "prompt is too long" or similar context length errors
      const hasContextError =
        r.error.includes('prompt is too long') ||
        r.error.includes('context length') ||
        r.error.includes('token');

      // Also catch questions that should have comparisons but don't
      const successfulSearches = r.searchResults.filter((sr) => !sr.error).length;
      const shouldHaveComparisons = successfulSearches >= 2;
      const missingComparisons = shouldHaveComparisons && !r.hasPairwiseComparisons;

      return hasContextError || (r.error && missingComparisons);
    })
    .map(({ index, qid, query, error, searchResults }) => ({
      index,
      qid,
      query,
      error,
      searchResults,
    }));
}

/**
 * Run pairwise comparisons for a single question
 */
async function runPairwiseForQuestion(
  question: FailedQuestion,
  model: LanguageModel,
  rankingMethod: 'elo' | 'bradley-terry'
): Promise<{
  comparisons: SearchPairwiseComparison[];
  rankings: { elo?: ReturnType<typeof calculateEloRatings>; bradleyTerry?: ReturnType<typeof calculateBradleyTerryRatings> };
}> {
  const successfulResults = question.searchResults.filter((r) => !r.error);
  const successfulSystems = successfulResults.map((r) => r.system);

  if (successfulResults.length < 2) {
    throw new Error(`Not enough successful search results (${successfulResults.length}) for ${question.qid}`);
  }

  const pairs = generateAllPairs(successfulSystems);

  console.log(`    Running ${pairs.length} pairwise comparisons...`);

  const comparisonPromises = pairs.map(([systemA, systemB]) => {
    const resultA = successfulResults.find((r) => r.system === systemA)!;
    const resultB = successfulResults.find((r) => r.system === systemB)!;

    return pairwiseCompareSearchResults({
      model,
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

  // Calculate per-question rankings
  const rankings: {
    elo?: ReturnType<typeof calculateEloRatings>;
    bradleyTerry?: ReturnType<typeof calculateBradleyTerryRatings>;
  } = {};

  if (rankingMethod === 'bradley-terry') {
    rankings.bradleyTerry = calculateBradleyTerryRatings(comparisons, successfulSystems);
  } else {
    rankings.elo = calculateEloRatings(comparisons, successfulSystems);
  }

  return { comparisons, rankings };
}

/**
 * Recalculate summary statistics after reruns
 */
function recalculateSummary(evaluationResult: EvaluationRunResult): void {
  const allComparisons: SearchPairwiseComparison[] = [];

  // Collect all comparisons from all questions
  for (const result of evaluationResult.results) {
    if (result.pairwiseComparisons) {
      allComparisons.push(...result.pairwiseComparisons);
    }
  }

  const systems = evaluationResult.config.searchSystems;

  // Update summary
  evaluationResult.summary.totalComparisons = allComparisons.length;
  evaluationResult.summary.winRateMatrix = calculateWinRateMatrix(allComparisons);

  if (evaluationResult.config.rankingMethod === 'bradley-terry') {
    evaluationResult.summary.bradleyTerryRankings = calculateBradleyTerryRatings(allComparisons, systems);
    delete evaluationResult.summary.eloRankings;
  } else {
    evaluationResult.summary.eloRankings = calculateEloRatings(allComparisons, systems);
    delete evaluationResult.summary.bradleyTerryRankings;
  }

  // Recalculate failed count (questions still with errors and no comparisons)
  evaluationResult.summary.failedEvaluations = evaluationResult.results.filter(
    (r) => r.error && !r.pairwiseComparisons
  ).length;
}

function showHelp(): void {
  console.log(`
Usage: npm run rerun-search-evals -- <result-file> [options]

Rerun failed pairwise comparisons using a model with larger context.

Arguments:
  <result-file>          Path to evaluation result JSON file

Options:
  --judge <model>        Judge model to use (default: gemini-2.5-flash)
                         Recommended: gemini-2.5-flash (1M tokens) or gemini-2.5-pro
  --dry-run              Show which questions would be rerun without executing
  --help, -h             Show this help message

Available models with larger context:
  gemini-2.5-flash       1M tokens (recommended - fast)
  gemini-2.5-pro         1M tokens (higher quality)
  gemini-3-flash         1M tokens
  gemini-3-pro           1M tokens
  gpt-5-mini             400K tokens
  gpt-5                  400K tokens

Examples:
  npm run rerun-search-evals -- datasets/_results/search/search-eval-all-2026-01-19.json
  npm run rerun-search-evals -- datasets/_results/search/search-eval-all-2026-01-19.json --dry-run
  npm run rerun-search-evals -- datasets/_results/search/search-eval-all-2026-01-19.json --judge gemini-2.5-pro
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(args.includes('--help') || args.includes('-h') ? 0 : 1);
  }

  // Parse arguments
  const resultFilePath = args[0];
  let judgeModelName = 'gemini-3-flash'; // Default to Gemini for larger context
  let dryRun = false;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--judge') {
      judgeModelName = args[i + 1];
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }

  // Validate model
  const modelInfo = modelMap[judgeModelName as keyof typeof modelMap];
  if (!modelInfo) {
    console.error(`Unknown model: ${judgeModelName}`);
    console.error(`Available models: ${Object.keys(modelMap).join(', ')}`);
    process.exit(1);
  }

  // Display banner
  console.log('========================================');
  console.log('Search Evaluation - Rerun Failed Comparisons');
  console.log('========================================');
  console.log(`Input file: ${resultFilePath}`);
  console.log(`Judge model: ${judgeModelName} (${modelInfo.token_limit.toLocaleString()} tokens)`);
  console.log(`Dry run: ${dryRun}`);
  console.log('========================================\n');

  // Load result file
  let resultContent: string;
  try {
    resultContent = await readFile(resultFilePath, 'utf-8');
  } catch (error) {
    console.error(`Failed to read file: ${resultFilePath}`);
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }

  let evaluationResult: EvaluationRunResult;
  try {
    evaluationResult = JSON.parse(resultContent);
  } catch (error) {
    console.error(`Failed to parse JSON: ${resultFilePath}`);
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }

  console.log(`Loaded evaluation with ${evaluationResult.results.length} questions`);
  console.log(`Original systems: ${evaluationResult.config.searchSystems.join(', ')}`);
  console.log(`Original judge model: ${evaluationResult.judgeModel}`);
  console.log(`Ranking method: ${evaluationResult.config.rankingMethod || 'elo'}`);

  // Identify failed questions
  const failedQuestions = identifyFailedQuestions(evaluationResult.results);

  console.log(`\nFound ${failedQuestions.length} questions with failed pairwise comparisons:\n`);

  for (const fq of failedQuestions) {
    const truncatedQuery = fq.query.length > 60 ? fq.query.substring(0, 60) + '...' : fq.query;
    const truncatedError = fq.error.length > 70 ? fq.error.substring(0, 70) + '...' : fq.error;
    console.log(`  [${fq.qid}] "${truncatedQuery}"`);
    console.log(`    Error: ${truncatedError}`);
    const successfulCount = fq.searchResults.filter((r) => !r.error).length;
    console.log(`    Successful searches: ${successfulCount}/${fq.searchResults.length}`);
    console.log('');
  }

  if (dryRun) {
    console.log('[DRY RUN] Exiting without making changes.');
    return;
  }

  if (failedQuestions.length === 0) {
    console.log('No failed questions to rerun. Exiting.');
    return;
  }

  const judgeModel = modelInfo.model;
  const rankingMethod = evaluationResult.config.rankingMethod || 'elo';

  // Process each failed question
  console.log(`\nRerunning ${failedQuestions.length} failed pairwise comparisons...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const fq of failedQuestions) {
    const truncatedQuery = fq.query.length > 50 ? fq.query.substring(0, 50) + '...' : fq.query;
    console.log(`Processing [${fq.qid}]: "${truncatedQuery}"`);

    try {
      const { comparisons, rankings } = await runPairwiseForQuestion(fq, judgeModel, rankingMethod);

      // Update the result in place
      const resultIndex = fq.index;
      evaluationResult.results[resultIndex].pairwiseComparisons = comparisons;
      evaluationResult.results[resultIndex].rankings = rankings;
      // Clear the error since we succeeded
      delete evaluationResult.results[resultIndex].error;

      // Log comparison results
      for (const comp of comparisons) {
        const winnerLabel =
          comp.winner === 'tie' ? 'TIE' : comp.winner === 'A' ? comp.systemA : comp.systemB;
        console.log(`      ${comp.systemA} vs ${comp.systemB}: ${winnerLabel} (${comp.confidence})`);
      }

      successCount++;
      console.log(`    ✓ Completed ${comparisons.length} comparisons\n`);
    } catch (error) {
      failCount++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`    ✗ Failed: ${errorMsg}\n`);
      // Append retry failure info to original error
      evaluationResult.results[fq.index].error = `Original: ${fq.error} | Retry failed: ${errorMsg}`;
    }
  }

  // Recalculate summary
  console.log('Recalculating summary statistics...');
  recalculateSummary(evaluationResult);

  // Generate output filename
  const originalBasename = basename(resultFilePath, '.json');
  const outputFilename = `${originalBasename}-fixed.json`;
  const outputPath = resultFilePath.replace(basename(resultFilePath), outputFilename);

  // Save
  await writeFile(outputPath, JSON.stringify(evaluationResult, null, 2), 'utf-8');

  // Display summary
  console.log('\n========================================');
  console.log('Rerun Complete!');
  console.log('========================================');
  console.log(`Questions processed: ${failedQuestions.length}`);
  console.log(`  Succeeded: ${successCount}`);
  console.log(`  Failed: ${failCount}`);
  console.log(`\nTotal comparisons now: ${evaluationResult.summary.totalComparisons}`);
  console.log(`Remaining failed: ${evaluationResult.summary.failedEvaluations}`);
  console.log(`\nSaved to: ${outputPath}`);

  // Show updated rankings
  if (evaluationResult.summary.eloRankings) {
    console.log('\nUpdated ELO Rankings:');
    for (const rating of evaluationResult.summary.eloRankings) {
      console.log(
        `  ${rating.system}: ${rating.rating.toFixed(1)} (${rating.record.wins}W-${rating.record.losses}L-${rating.record.ties}T)`
      );
    }
  } else if (evaluationResult.summary.bradleyTerryRankings) {
    console.log('\nUpdated Bradley-Terry Rankings:');
    for (const rating of evaluationResult.summary.bradleyTerryRankings) {
      console.log(`  ${rating.system}: ${rating.skill.toFixed(3)} (win prob: ${(rating.winProbability * 100).toFixed(1)}%)`);
    }
  }
  console.log('========================================');
}

main().catch((error) => {
  console.error('\nError:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
});
