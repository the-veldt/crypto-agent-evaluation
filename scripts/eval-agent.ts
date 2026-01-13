#!/usr/bin/env tsx

import { config } from 'dotenv';
import { runAgentEvaluation } from '../lib/evaluation/agent/runAgentEvaluation.js';
import { defaultAgentEvaluationConfigV2 } from '../lib/evaluation/agent/defaultConfig.js';
import type { AgentEvaluationConfigV2, EvaluationRunResultV2 } from '../lib/evaluation/agent/types.js';

// Load environment variables from .env.local
config({ path: '.env.local' });

/**
 * Allowed agent systems - add new models here
 * Note: Third-party systems (surf-quick, elfa-fast, elfa-expert, messari-assistant) can only be used with --use-cache
 */
const ALLOWED_SYSTEMS = ['gpt-5', 'gpt-5-mini', 'claude-4.5-sonnet', 'gemini-3-flash', 'droyd', 'droyd-casual', 'droyd-pro', 'surf-quick', 'elfa-fast', 'elfa-expert', 'messari-assistant'] as const;
type AllowedSystem = typeof ALLOWED_SYSTEMS[number];

/**
 * Config overrides type - allows partial nested objects
 */
type ConfigOverrides = Partial<Omit<AgentEvaluationConfigV2, 'standardAgentConfig' | 'droydAgentConfig'>> & {
  standardAgentConfig?: Partial<NonNullable<AgentEvaluationConfigV2['standardAgentConfig']>>;
  droydAgentConfig?: Partial<NonNullable<AgentEvaluationConfigV2['droydAgentConfig']>>;
};

/**
 * Parse command line arguments
 */
function parseArgs(): ConfigOverrides {
  const args = process.argv.slice(2);
  const overrides: ConfigOverrides = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }

    if (arg.startsWith('--')) {
      const value = args[i + 1];

      switch (arg) {
        case '--dataset':
          if (!value || value.startsWith('--')) {
            console.error('Error: --dataset requires a value');
            process.exit(1);
          }
          if (value === 'all') {
            overrides.datasets = 'all';
          } else if (value.includes(',')) {
            overrides.datasets = value.split(',').map((d) => d.trim());
          } else {
            overrides.datasets = value;
          }
          i++;
          break;

        case '--systems':
          if (!value || value.startsWith('--')) {
            console.error('Error: --systems requires a value');
            process.exit(1);
          }
          const systems = value
            .split(',')
            .map((s) => s.trim())
            .filter((s) => ALLOWED_SYSTEMS.includes(s as AllowedSystem)) as AllowedSystem[];

          if (systems.length === 0) {
            console.error(`Error: No valid systems found. Allowed: ${ALLOWED_SYSTEMS.join(', ')}`);
            process.exit(1);
          }
          overrides.agentSystems = systems;
          i++;
          break;

        case '--ranking-method':
          if (!value || value.startsWith('--')) {
            console.error('Error: --ranking-method requires a value');
            process.exit(1);
          }
          if (value !== 'elo' && value !== 'bradley-terry') {
            console.error(`Error: Invalid ranking method '${value}'. Use 'elo' or 'bradley-terry'`);
            process.exit(1);
          }
          overrides.rankingMethod = value;
          i++;
          break;

        case '--keep-raw':
          overrides.keepRawResponse = true;
          break;

        case '--max-steps':
          if (!value || value.startsWith('--')) {
            console.error('Error: --max-steps requires a value');
            process.exit(1);
          }
          const maxSteps = parseInt(value, 10);
          if (isNaN(maxSteps) || maxSteps <= 0) {
            console.error('Error: --max-steps must be a positive number');
            process.exit(1);
          }
          if (!overrides.standardAgentConfig) {
            overrides.standardAgentConfig = {};
          }
          overrides.standardAgentConfig.maxSteps = maxSteps;
          i++;
          break;

        case '--output-dir':
          if (!value || value.startsWith('--')) {
            console.error('Error: --output-dir requires a value');
            process.exit(1);
          }
          overrides.outputDir = value;
          i++;
          break;

        case '--test':
          overrides.useTestDatasets = true;
          break;

        case '--use-cache':
          overrides.useCache = true;
          break;

        case '--cache-dir':
          if (!value || value.startsWith('--')) {
            console.error('Error: --cache-dir requires a value');
            process.exit(1);
          }
          overrides.cacheDir = value;
          i++;
          break;

        default:
          console.error(`Error: Unknown option '${arg}'`);
          showHelp();
          process.exit(1);
      }
    }
  }

  return overrides;
}

/**
 * Show help message
 */
function showHelp(): void {
  console.log(`
Usage: npm run eval:agent -- [options]

Agent Evaluation V2 - Pairwise Comparison Framework

This evaluation framework uses pairwise comparisons instead of absolute scoring.
Each pair of agents is compared directly with blinded, randomized presentation
order to prevent position bias. Rankings are calculated using ELO ratings or
the Bradley-Terry model with statistical confidence intervals.

Options:
  --dataset <name>              Dataset file(s) to evaluate:
                                  - Single: assetDiscovery
                                  - Multiple (comma-separated): file1,file2,file3
                                  - All files: all (default)

  --systems <systems>           Comma-separated agent systems to test:
                                  ${ALLOWED_SYSTEMS.join(', ')}
                                  (default: gpt-5-mini,gemini-3-flash,droyd)

  --ranking-method <method>     Ranking algorithm to use:
                                  - elo: ELO rating system (default)
                                    Intuitive ratings similar to chess, starting at 1500
                                  - bradley-terry: Bradley-Terry model
                                    Statistical model with confidence intervals

  --keep-raw                    Keep rawResponse data in output files
                                  (default: strip for 96% smaller files)

  --max-steps <number>          Maximum steps for standard agents (default: 10)

  --output-dir <path>           Results output directory
                                  (default: datasets/_results/agent)

  --test                        Use test datasets for faster iteration
                                  (loads from datasets/agent/test/)

  --use-cache                   Load cached agent responses when available
                                  (default: false - execute all agents fresh)

  --cache-dir <path>            Directory containing cached responses
                                  (default: datasets/_results/agent/response_cache)

  --help, -h                    Show this help message

Evaluation Method:
  V2 uses pairwise comparisons for overall output quality (no dimensional breakdowns):
  - Each pair of agents is compared directly (blinded, randomized order)
  - Judge evaluates overall response quality based on:
    * Completeness & Relevance
    * Analytical Depth & Rigor
    * Information Quality (accuracy, specificity, actionability)
    * Professional Value
  - Focus on final output only, not process or efficiency
  - Rankings calculated using ELO ratings or Bradley-Terry model
  - N agents = N*(N-1)/2 comparisons per question

  Key Principle: Quality over quantity - a response with 5 well-analyzed findings
  beats 10 superficial results

Examples:
  # Run with default settings (ELO rankings, all datasets)
  npm run eval:agent

  # Use Bradley-Terry model with confidence intervals
  npm run eval:agent -- --ranking-method bradley-terry

  # Test mode with specific systems
  npm run eval:agent -- --test --systems gpt-5,droyd

  # Keep raw responses (larger file size but preserves all data)
  npm run eval:agent -- --keep-raw

  # Multiple datasets with custom output directory
  npm run eval:agent -- --dataset assetDiscovery,trendAnalysis --output-dir results/custom

  # Run V1 evaluation (absolute scoring)
  npm run eval:agent:v1
`);
}

/**
 * Display configuration banner
 */
function displayBanner(config: AgentEvaluationConfigV2): void {
  console.log('========================================');
  console.log('Agent Evaluation Runner V2');
  console.log('Pairwise Comparison Framework');
  console.log('========================================');
  console.log('Configuration:');
  console.log(`  Agent Systems: ${config.agentSystems.join(', ')}`);
  console.log(
    `  Datasets: ${typeof config.datasets === 'string' ? config.datasets : config.datasets.join(', ')}`
  );
  console.log(`  Ranking Method: ${config.rankingMethod.toUpperCase()}`);
  console.log(`  Judge Model: ${config.judgeModel}`);
  console.log(`  Strip Raw Response: ${!config.keepRawResponse}`);
  console.log(`  Output: ${config.outputDir}`);

  const numSystems = config.agentSystems.length;
  const comparisonsPerQuestion = (numSystems * (numSystems - 1)) / 2;
  console.log(`  Comparisons per question: ${comparisonsPerQuestion}`);

  if (config.useCache) {
    console.log(`  Cache: ENABLED (${config.cacheDir || 'datasets/_results/agent/response_cache'})`);
  }

  if (config.useTestDatasets) {
    console.log(`  Mode: TEST`);
  }

  console.log('========================================\n');
}

/**
 * Display evaluation summary
 */
function displaySummary(result: EvaluationRunResultV2): void {
  console.log('========================================');
  console.log('Evaluation Complete!');
  console.log('========================================');
  console.log('Summary:');
  console.log(`  Total Questions: ${result.summary.totalQuestions}`);
  console.log(
    `  Successful Evaluations: ${result.summary.successfulEvaluations}/${result.summary.totalQuestions}`
  );
  console.log(`  Total Comparisons: ${result.summary.totalComparisons}`);
  console.log(`  Failed Evaluations: ${result.summary.failedEvaluations}`);

  console.log(`\n${result.config.rankingMethod.toUpperCase()} Rankings:`);

  if (result.summary.eloRankings) {
    for (const [idx, rating] of result.summary.eloRankings.entries()) {
      console.log(
        `  ${idx + 1}. ${rating.system}: ${rating.rating.toFixed(1)} (${rating.record.wins}W-${rating.record.losses}L-${rating.record.ties}T, ${rating.gamesPlayed} games)`
      );
    }
  } else if (result.summary.bradleyTerryRankings) {
    for (const [idx, rating] of result.summary.bradleyTerryRankings.entries()) {
      console.log(
        `  ${idx + 1}. ${rating.system}: skill=${rating.skill.toFixed(3)}, win_prob=${(rating.winProbability * 100).toFixed(1)}%, CI=[${rating.confidenceInterval.lower.toFixed(3)}, ${rating.confidenceInterval.upper.toFixed(3)}]`
      );
    }
  }

  console.log('\nHead-to-Head Win Rates:');
  const winRateEntries = Object.entries(result.summary.winRateMatrix);
  if (winRateEntries.length > 0) {
    for (const [pair, data] of winRateEntries) {
      console.log(
        `  ${data.system1} vs ${data.system2}: ${(data.system1WinRate * 100).toFixed(1)}% (${data.system1Wins}-${data.system2Wins}-${data.ties})`
      );
    }
  } else {
    console.log('  (No comparisons available)');
  }

  console.log('\nExecution Metrics:');
  for (const [system, time] of Object.entries(result.summary.averageExecutionTime)) {
    const steps = result.summary.averageSteps[system];
    console.log(`  ${system}: ${(time / 1000).toFixed(1)}s avg, ${steps.toFixed(1)} steps avg`);
  }

  // Display cache statistics if available
  if (result.summary.cacheStatistics) {
    const stats = result.summary.cacheStatistics;
    console.log('\nCache Statistics:');
    console.log(`  Hits: ${stats.hits}`);
    console.log(`  Misses: ${stats.misses}`);
    console.log(`  Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
  }

  console.log(`\nResults saved to: ${result.outputPath}`);
  console.log('========================================');
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    const overrides = parseArgs();

    // Merge with defaults
    const config: AgentEvaluationConfigV2 = {
      ...defaultAgentEvaluationConfigV2,
      ...overrides,
      standardAgentConfig: {
        ...defaultAgentEvaluationConfigV2.standardAgentConfig,
        ...overrides.standardAgentConfig,
      } as AgentEvaluationConfigV2['standardAgentConfig'],
      droydAgentConfig: {
        ...defaultAgentEvaluationConfigV2.droydAgentConfig,
        ...overrides.droydAgentConfig,
      },
    };

    displayBanner(config);

    const result = await runAgentEvaluation(config);

    displaySummary(result);
  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : 'Unknown error');
    console.error('\nRun with --help for usage information');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
