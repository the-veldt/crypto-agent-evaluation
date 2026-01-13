#!/usr/bin/env tsx

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, basename } from 'path';
import type {
  EvaluationRunResult,
  EvaluationRunResultV2,
  AgentSystemResult,
} from '../lib/evaluation/agent/types.js';
import type { EvalQuestion } from '../datasets/types/evalQuestion.js';

/**
 * Configuration for caching agent responses
 */
interface CacheResponsesConfig {
  resultFilePath: string;
  systems?: string[];
  outputDir: string;
  verbose: boolean;
}

/**
 * A single cache entry for one system's response to one question
 */
interface CacheEntry {
  metadata: {
    cachedAt: string;
    sourceFile: string;
    runId: string;
    system: string;
    qid: string;
    evaluationVersion: 'v1' | 'v2';
  };
  question: EvalQuestion & { dataset: string };
  agentResult: AgentSystemResult;
  config: {
    judgeModel: string;
    rankingMethod?: 'elo' | 'bradley-terry';
    standardAgentConfig?: any;
    droydAgentConfig?: any;
  };
}

/**
 * Statistics about the caching operation
 */
interface CacheStatistics {
  totalQuestions: number;
  totalCacheFiles: number;
  systemCounts: Record<string, number>;
  warnings: string[];
  errors: string[];
}

/**
 * Parse command line arguments
 */
function parseArgs(): CacheResponsesConfig {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }

  const config: CacheResponsesConfig = {
    resultFilePath: args[0],
    outputDir: 'datasets/_results/agent/response_cache',
    verbose: false,
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }

    if (arg.startsWith('--')) {
      const value = args[i + 1];

      switch (arg) {
        case '--systems':
          if (!value || value.startsWith('--')) {
            console.error('Error: --systems requires a value');
            process.exit(1);
          }
          config.systems = value.split(',').map((s) => s.trim());
          i++;
          break;

        case '--output-dir':
          if (!value || value.startsWith('--')) {
            console.error('Error: --output-dir requires a value');
            process.exit(1);
          }
          config.outputDir = value;
          i++;
          break;

        case '--verbose':
          config.verbose = true;
          break;

        default:
          console.error(`Error: Unknown option '${arg}'`);
          showHelp();
          process.exit(1);
      }
    }
  }

  return config;
}

/**
 * Show help message
 */
function showHelp(): void {
  console.log(`
Usage: npm run cache:responses -- <result-file> [options]

Cache Agent Responses

Extract agent responses from evaluation result files and save them to a cache
structure for reuse in future evaluations.

Arguments:
  <result-file>                 Path to evaluation result file (required)

Options:
  --systems <list>              Comma-separated systems to cache
                                  (default: all systems in result file)

  --output-dir <path>           Cache directory path
                                  (default: datasets/_results/agent/response_cache)

  --verbose                     Enable verbose logging

  --help, -h                    Show this help message

Cache Structure:
  The cache will be organized by system and question ID:

  response_cache/
  ├── gpt-5-mini/
  │   ├── 3kC5nP2v.json
  │   └── ...
  ├── droyd-casual/
  │   └── ...
  └── ...

Examples:
  # Cache all systems from a result file
  npm run cache:responses -- datasets/_results/agent/agent-eval-...-v2.json

  # Cache specific systems only
  npm run cache:responses -- results.json --systems gpt-5-mini,droyd-casual

  # Use custom output directory
  npm run cache:responses -- results.json --output-dir custom/cache

  # Verbose mode for debugging
  npm run cache:responses -- results.json --verbose
`);
}

/**
 * Load and validate result file
 */
async function loadResultFile(path: string): Promise<EvaluationRunResultV2 | EvaluationRunResult> {
  try {
    const content = await readFile(path, 'utf-8');
    const result = JSON.parse(content);

    // Validate required fields
    if (!result.runId || !result.results || !result.config) {
      throw new Error('Invalid result file: missing required fields (runId, results, config)');
    }

    if (!Array.isArray(result.results) || result.results.length === 0) {
      throw new Error('Invalid result file: results array is empty');
    }

    return result;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Result file not found: ${path}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in result file: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Detect evaluation version (V1 or V2)
 */
function detectVersion(result: any): 'v1' | 'v2' {
  // V2 has pairwiseComparisons, V1 has evaluations
  if (result.results.length > 0) {
    const firstResult = result.results[0];
    if ('pairwiseComparisons' in firstResult) {
      return 'v2';
    }
  }
  return 'v1';
}

/**
 * Extract unique systems from result file
 */
function extractUniqueSystems(result: EvaluationRunResultV2 | EvaluationRunResult): string[] {
  const systemsSet = new Set<string>();

  for (const questionResult of result.results) {
    if (questionResult.agentResults) {
      for (const agentResult of questionResult.agentResults) {
        systemsSet.add(agentResult.system);
      }
    }
  }

  return Array.from(systemsSet).sort();
}

/**
 * Validate requested systems exist in result file
 */
function validateSystems(
  requestedSystems: string[],
  availableSystems: string[]
): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const system of requestedSystems) {
    if (availableSystems.includes(system)) {
      valid.push(system);
    } else {
      invalid.push(system);
    }
  }

  return { valid, invalid };
}

/**
 * Extract cache entries from result file
 */
async function extractCacheEntries(
  result: EvaluationRunResultV2 | EvaluationRunResult,
  systems: string[],
  config: CacheResponsesConfig
): Promise<CacheEntry[]> {
  const entries: CacheEntry[] = [];
  const version = detectVersion(result);
  const sourceFile = basename(config.resultFilePath);

  for (const questionResult of result.results) {
    const question = questionResult.question;
    const dataset = questionResult.dataset;

    // Filter agent results to selected systems
    const filteredResults = questionResult.agentResults.filter((ar) => systems.includes(ar.system));

    for (const agentResult of filteredResults) {
      const entry: CacheEntry = {
        metadata: {
          cachedAt: new Date().toISOString(),
          sourceFile,
          runId: result.runId,
          system: agentResult.system,
          qid: question.qid,
          evaluationVersion: version,
        },
        question: {
          ...question,
          dataset,
        },
        agentResult: {
          ...agentResult,
        },
        config: {
          judgeModel: result.judgeModel,
          rankingMethod: (result.config as any).rankingMethod,
          standardAgentConfig: result.config.standardAgentConfig,
          droydAgentConfig: result.config.droydAgentConfig,
        },
      };

      entries.push(entry);

      if (config.verbose) {
        console.log(`  Extracted: ${agentResult.system}/${question.qid}`);
      }
    }
  }

  return entries;
}

/**
 * Create directory structure for cache
 */
async function createDirectories(entries: CacheEntry[], outputDir: string, verbose: boolean): Promise<void> {
  // Ensure base output directory exists
  await mkdir(outputDir, { recursive: true });

  // Get unique systems
  const systems = Array.from(new Set(entries.map((e) => e.metadata.system))).sort();

  // Create subdirectory for each system
  for (const system of systems) {
    const systemDir = join(outputDir, system);
    await mkdir(systemDir, { recursive: true });

    if (verbose) {
      console.log(`  Created directory: ${systemDir}`);
    }
  }
}

/**
 * Write cache files
 */
async function writeCacheFiles(
  entries: CacheEntry[],
  outputDir: string,
  verbose: boolean
): Promise<string[]> {
  const errors: string[] = [];

  for (const entry of entries) {
    const filePath = join(outputDir, entry.metadata.system, `${entry.metadata.qid}.json`);

    try {
      await writeFile(filePath, JSON.stringify(entry, null, 2), 'utf-8');

      if (verbose) {
        console.log(`  ✓ Wrote: ${entry.metadata.system}/${entry.metadata.qid}.json`);
      }
    } catch (error: any) {
      const errorMsg = `Failed to write ${filePath}: ${error.message}`;
      errors.push(errorMsg);
      console.error(`  ✗ ${errorMsg}`);
    }
  }

  return errors;
}

/**
 * Calculate cache statistics
 */
function calculateStatistics(entries: CacheEntry[]): CacheStatistics {
  const systemCounts: Record<string, number> = {};

  for (const entry of entries) {
    const system = entry.metadata.system;
    systemCounts[system] = (systemCounts[system] || 0) + 1;
  }

  // Count unique questions
  const uniqueQuestions = new Set(entries.map((e) => e.metadata.qid));

  return {
    totalQuestions: uniqueQuestions.size,
    totalCacheFiles: entries.length,
    systemCounts,
    warnings: [],
    errors: [],
  };
}

/**
 * Display banner
 */
function displayBanner(config: CacheResponsesConfig): void {
  console.log('========================================');
  console.log('Cache Agent Responses');
  console.log('========================================');
  console.log(`Input: ${config.resultFilePath}`);
  console.log(`Systems: ${config.systems ? config.systems.join(', ') : 'all'}`);
  console.log(`Output: ${config.outputDir}`);
  console.log('========================================\n');
}

/**
 * Display summary
 */
function displaySummary(
  stats: CacheStatistics,
  outputDir: string,
  warnings: string[],
  errors: string[]
): void {
  console.log('\n========================================');
  console.log('Caching Complete!');
  console.log('========================================');
  console.log('Cache Statistics:');
  console.log(`  Total Questions: ${stats.totalQuestions}`);
  console.log(`  Total Cache Files: ${stats.totalCacheFiles}`);
  console.log('\n  Files by System:');
  for (const [system, count] of Object.entries(stats.systemCounts).sort()) {
    console.log(`    ${system}: ${count} files`);
  }
  console.log(`\n  Output Directory: ${outputDir}`);

  if (warnings.length > 0) {
    console.log('\n  Warnings:');
    for (const warning of warnings) {
      console.log(`    ⚠ ${warning}`);
    }
  }

  if (errors.length > 0) {
    console.log('\n  Errors:');
    for (const error of errors) {
      console.log(`    ✗ ${error}`);
    }
  }

  console.log('========================================');
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    const config = parseArgs();
    displayBanner(config);

    // Load result file
    console.log('Loading result file...');
    const result = await loadResultFile(config.resultFilePath);
    const version = detectVersion(result);
    console.log(`✓ Loaded ${result.results.length} questions from ${result.runId} (${version})`);

    // Determine systems to cache
    const availableSystems = extractUniqueSystems(result);
    let systemsToCache: string[] = availableSystems;
    const warnings: string[] = [];

    if (config.systems && config.systems.length > 0) {
      const { valid, invalid } = validateSystems(config.systems, availableSystems);

      if (invalid.length > 0) {
        warnings.push(`Systems not found in result file: ${invalid.join(', ')}`);
        console.log(`⚠ Warning: ${warnings[warnings.length - 1]}`);
      }

      if (valid.length === 0) {
        throw new Error('No valid systems found to cache');
      }

      systemsToCache = valid;
    }

    console.log(`\nSystems to cache: ${systemsToCache.join(', ')}\n`);

    // Extract cache entries
    console.log('Extracting cache entries...');
    const entries = await extractCacheEntries(result, systemsToCache, config);
    console.log(`✓ Extracted ${entries.length} cache entries`);

    // Create directories
    console.log('\nCreating cache directories...');
    await createDirectories(entries, config.outputDir, config.verbose);
    console.log('✓ Created directories');

    // Write cache files
    console.log('\nWriting cache files...');
    const writeErrors = await writeCacheFiles(entries, config.outputDir, config.verbose);
    console.log(`✓ Wrote ${entries.length - writeErrors.length}/${entries.length} cache files`);

    // Display summary
    const stats = calculateStatistics(entries);
    displaySummary(stats, config.outputDir, warnings, writeErrors);

    if (writeErrors.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : 'Unknown error');
    console.error('\nRun with --help for usage information');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
