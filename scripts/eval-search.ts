#!/usr/bin/env tsx

import { config } from 'dotenv';
import { runSearchEvaluation } from '../lib/evaluation/search/runSearchEvaluation.js';
import { defaultSearchEvaluationConfig } from '../lib/evaluation/search/defaultConfig.js';
import type { SearchEvaluationConfig } from '../lib/evaluation/search/types.js';

// Load environment variables from .env.local
config({ path: '.env.local' });

/**
 * Parse command line arguments
 */
function parseArgs(): Partial<SearchEvaluationConfig> {
  const args = process.argv.slice(2);
  const overrides: Partial<SearchEvaluationConfig> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }

    if (arg === '--test') {
      overrides.useTestDatasets = true;
      continue;
    }

    if (arg === '--keep-contents') {
      overrides.keepFormattedContents = true;
      continue;
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
              .map((f) => `datasets/search/${f.trim()}.json`);
          } else {
            // Single dataset
            overrides.datasets = `datasets/search/${value}.json`;
          }
          i++;
          break;

        case '--system':
          if (value === 'both') {
            overrides.searchSystems = ['droyd', 'exa'];
          } else if (value === 'droyd' || value === 'exa') {
            overrides.searchSystems = [value];
          } else {
            console.error(`Invalid system: ${value}. Use 'droyd', 'exa', or 'both'`);
            process.exit(1);
          }
          i++;
          break;

        case '--limit':
          const limit = parseInt(value, 10);
          if (isNaN(limit)) {
            console.error(`Invalid limit: ${value}`);
            process.exit(1);
          }
          overrides.droydConfig = { ...overrides.droydConfig, limit };
          overrides.exaConfig = { ...overrides.exaConfig, numResults: limit };
          i++;
          break;

        case '--days-back':
          const daysBack = parseInt(value, 10);
          if (isNaN(daysBack)) {
            console.error(`Invalid days-back: ${value}`);
            process.exit(1);
          }
          overrides.droydConfig = { ...overrides.droydConfig, daysBack };
          i++;
          break;

        case '--output-dir':
          overrides.outputDir = value;
          i++;
          break;

        case '--droyd-mode':
          if (value !== 'recent' && value !== 'semantic') {
            console.error(`Invalid droyd-mode: ${value}. Use 'recent' or 'semantic'`);
            process.exit(1);
          }
          overrides.droydConfig = {
            ...overrides.droydConfig,
            searchMode: value,
          };
          i++;
          break;

        case '--exa-max-chars':
          const maxChars = parseInt(value, 10);
          if (isNaN(maxChars)) {
            console.error(`Invalid exa-max-chars: ${value}`);
            process.exit(1);
          }
          overrides.exaConfig = { ...overrides.exaConfig, maxCharacters: maxChars };
          i++;
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
Usage: npm run eval:search -- [options]

Options:
  --test                   Use test datasets (datasets/search/test/)
  --keep-contents          Keep formattedSearchContents in output (default: stripped)
  --dataset <name>         Dataset file(s):
                             - Single: assetDiscovery
                             - Multiple: file1,file2,file3
                             - All: all (default: all)
  --system <type>          Search system(s): droyd, exa, or both (default: both)
  --limit <number>         Max results per search (default: 10)
  --days-back <number>     Search last N days (default: 30)
  --output-dir <path>      Results output directory (default: datasets/_results/search)
  --droyd-mode <mode>      Droyd search mode: recent or semantic (default: semantic)
  --exa-max-chars <num>    Max characters for Exa text (default: 2000)
  --help, -h               Show this help message

Examples:
  npm run eval:search
  npm run eval:search -- --test
  npm run eval:search -- --dataset all
  npm run eval:search -- --dataset assetDiscovery
  npm run eval:search -- --dataset assetDiscovery,otherDataset
  npm run eval:search -- --system droyd --limit 5
`);
}

/**
 * Display configuration banner
 */
function displayBanner(config: SearchEvaluationConfig): void {
  console.log('========================================');
  console.log(`Search Evaluation Runner${config.useTestDatasets ? ' (TEST MODE)' : ''}`);
  console.log('========================================');
  console.log('Configuration:');
  console.log(`  Systems: ${config.searchSystems.join(', ')}`);
  console.log(`  Datasets: ${typeof config.datasets === 'string' ? config.datasets : config.datasets.join(', ')}${config.useTestDatasets ? ' (test)' : ''}`);
  console.log(`  Judge Model: ${config.judgeModel}`);
  console.log(`  Output: ${config.outputDir}`);

  if (config.searchSystems.includes('droyd') && config.droydConfig) {
    console.log(
      `  Droyd Config: ${config.droydConfig.searchMode} mode, limit=${config.droydConfig.limit}, daysBack=${config.droydConfig.daysBack}`
    );
  }

  if (config.searchSystems.includes('exa') && config.exaConfig) {
    console.log(
      `  Exa Config: numResults=${config.exaConfig.numResults}, maxChars=${config.exaConfig.maxCharacters}`
    );
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
    `  Successful Evaluations: ${result.summary.successfulEvaluations}/${result.summary.totalQuestions * result.config.searchSystems.length}`
  );
  console.log(`  Failed Evaluations: ${result.summary.failedEvaluations}`);

  console.log('\nAverage Scores:');
  for (const [system, scores] of Object.entries(result.summary.averageScores)) {
    const avgTokens = result.summary.averageTokenCount?.[system] || 'N/A';
    console.log(`  ${system}: (avg tokens: ${avgTokens})`);
    console.log(`    Overall: ${(scores as any).overall.toFixed(1)}/10`);
    console.log(`    Query Relevance: ${(scores as any).queryRelevance.toFixed(1)}/10`);
    console.log(`    Quality: ${(scores as any).quality.toFixed(1)}/10`);
    console.log(
      `    Information Density: ${(scores as any).informationDensity.toFixed(1)}/10`
    );
    console.log(`    Completeness: ${(scores as any).completeness.toFixed(1)}/10`);
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
    const config: SearchEvaluationConfig = {
      ...defaultSearchEvaluationConfig,
      ...overrides,
      droydConfig: {
        ...defaultSearchEvaluationConfig.droydConfig,
        ...overrides.droydConfig,
      },
      exaConfig: {
        ...defaultSearchEvaluationConfig.exaConfig,
        ...overrides.exaConfig,
      },
    };

    // Display configuration
    displayBanner(config);

    // Run evaluation
    const result = await runSearchEvaluation(config);

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
