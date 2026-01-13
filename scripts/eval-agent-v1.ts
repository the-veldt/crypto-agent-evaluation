#!/usr/bin/env tsx

import { config } from 'dotenv';
import { runAgentEvaluation } from '../lib/evaluation/agent/runAgentEvaluationV1.js';
import { defaultAgentEvaluationConfig } from '../lib/evaluation/agent/defaultConfig.js';
import type { AgentEvaluationConfig } from '../lib/evaluation/agent/types.js';

// Load environment variables from .env.local
config({ path: '.env.local' });

/**
 * Allowed agent systems - add new models here
 */
const ALLOWED_SYSTEMS = ['gpt-5', 'gpt-5-mini', 'claude-4.5-sonnet', 'gemini-3-flash', 'droyd', 'droyd-casual', 'droyd-pro'] as const;
type AllowedSystem = typeof ALLOWED_SYSTEMS[number];

/**
 * Config overrides type - allows partial nested objects
 */
type ConfigOverrides = Partial<Omit<AgentEvaluationConfig, 'standardAgentConfig' | 'droydAgentConfig'>> & {
  standardAgentConfig?: Partial<NonNullable<AgentEvaluationConfig['standardAgentConfig']>>;
  droydAgentConfig?: Partial<NonNullable<AgentEvaluationConfig['droydAgentConfig']>>;
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
          if (value === 'all') {
            overrides.datasets = 'all';
          } else if (value.includes(',')) {
            // Multiple datasets: --dataset file1,file2,file3
            overrides.datasets = value
              .split(',')
              .map((f) => `datasets/agent/${f.trim()}.json`);
          } else {
            // Single dataset
            overrides.datasets = `datasets/agent/${value}.json`;
          }
          i++;
          break;

        case '--systems':
          const systems = value
            .split(',')
            .map((s) => s.trim())
            .filter((s): s is AllowedSystem => ALLOWED_SYSTEMS.includes(s as AllowedSystem));

          if (systems.length === 0) {
            console.error(
              `Invalid systems: ${value}. Use comma-separated list of: ${ALLOWED_SYSTEMS.join(', ')}`
            );
            process.exit(1);
          }

          overrides.agentSystems = systems;
          i++;
          break;

        case '--max-steps':
          const maxSteps = parseInt(value, 10);
          if (isNaN(maxSteps)) {
            console.error(`Invalid max-steps: ${value}`);
            process.exit(1);
          }
          overrides.standardAgentConfig = {
            ...overrides.standardAgentConfig,
            maxSteps,
          };
          i++;
          break;

        case '--output-dir':
          overrides.outputDir = value;
          i++;
          break;

        case '--test':
          overrides.useTestDatasets = true;
          // Don't increment i since --test has no value
          break;

        default:
          console.error(`Unknown option: ${arg}`);
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

Options:
  --dataset <name>         Dataset file(s):
                             - Single: assetDiscovery
                             - Multiple: file1,file2,file3
                             - All: all (default: all)
  --systems <systems>      Comma-separated agent systems to test:
                             ${ALLOWED_SYSTEMS.join(', ')}
                             (default: ${ALLOWED_SYSTEMS.join(',')})
  --max-steps <number>     Max steps for standard agents (default: 10)
  --output-dir <path>      Results output directory (default: datasets/_results/agent)
  --test                   Use test datasets (datasets/agent/test/) for faster iteration
  --help, -h               Show this help message

Examples:
  npm run eval:agent
  npm run eval:agent -- --test
  npm run eval:agent -- --dataset all
  npm run eval:agent -- --dataset assetDiscovery
  npm run eval:agent -- --dataset assetDiscovery,otherDataset
  npm run eval:agent -- --systems gpt-5,droyd --max-steps 5
  npm run eval:agent -- --test --systems droyd
`);
}

/**
 * Display configuration banner
 */
function displayBanner(config: AgentEvaluationConfig): void {
  console.log('========================================');
  console.log('Agent Evaluation Runner');
  console.log('========================================');
  console.log('Configuration:');
  console.log(`  Agent Systems: ${config.agentSystems.join(', ')}`);
  console.log(
    `  Datasets: ${typeof config.datasets === 'string' ? config.datasets : config.datasets.join(', ')}`
  );
  console.log(`  Judge Model: ${config.judgeModel}`);
  console.log(`  Output: ${config.outputDir}`);
  if (config.useTestDatasets) {
    console.log(`  Mode: TEST (using datasets/agent/test/)`);
  }

  if (config.standardAgentConfig) {
    console.log(
      `  Standard Agent Config: tools=${config.standardAgentConfig.tools.join(',')}, maxSteps=${config.standardAgentConfig.maxSteps}`
    );
  }

  if (config.droydAgentConfig) {
    console.log(`  Droyd Agent Type: ${config.droydAgentConfig.agentType}`);
  }

  console.log('========================================\n');
}

/**
 * Display summary after evaluation
 */
function displaySummary(result: any): void {
  console.log('========================================');
  console.log('Evaluation Complete!');
  console.log('========================================');
  console.log('Summary:');
  console.log(`  Total Questions: ${result.summary.totalQuestions}`);
  console.log(
    `  Successful Evaluations: ${result.summary.successfulEvaluations}/${result.summary.totalQuestions * result.config.agentSystems.length}`
  );
  console.log(`  Failed Evaluations: ${result.summary.failedEvaluations}`);

  console.log('\nAverage Scores:');
  for (const [system, scores] of Object.entries(result.summary.averageScores)) {
    console.log(`  ${system}:`);
    console.log(`    Overall: ${(scores as any).overall.toFixed(1)}/10`);
    console.log(`    Task Completion: ${(scores as any).taskCompletion.toFixed(1)}/10`);
    console.log(`    Answer Quality: ${(scores as any).answerQuality.toFixed(1)}/10`);
    console.log(`    Reasoning Quality: ${(scores as any).reasoningQuality.toFixed(1)}/10`);
    console.log(`    Efficiency: ${(scores as any).efficiency.toFixed(1)}/10`);
  }

  console.log('\nAverage Execution Metrics:');
  for (const [system, time] of Object.entries(result.summary.averageExecutionTime)) {
    const steps = result.summary.averageSteps[system];
    console.log(
      `  ${system}: ${(time as number / 1000).toFixed(1)}s, ${(steps as number).toFixed(1)} steps`
    );
  }

  console.log(`\nResults saved to: ${result.outputPath}`);
  console.log('========================================');
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    // Parse CLI arguments
    const overrides = parseArgs();

    // Merge with defaults
    const config: AgentEvaluationConfig = {
      ...defaultAgentEvaluationConfig,
      ...overrides,
      standardAgentConfig: {
        ...defaultAgentEvaluationConfig.standardAgentConfig,
        ...overrides.standardAgentConfig,
      } as AgentEvaluationConfig['standardAgentConfig'],
      droydAgentConfig: {
        ...defaultAgentEvaluationConfig.droydAgentConfig,
        ...overrides.droydAgentConfig,
      },
    };

    // Display configuration
    displayBanner(config);

    // Run evaluation
    const result = await runAgentEvaluation(config);

    // Display summary
    displaySummary(result);
  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
