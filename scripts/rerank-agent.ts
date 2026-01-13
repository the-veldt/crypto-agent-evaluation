#!/usr/bin/env tsx

import { config } from 'dotenv';
import { readFile, writeFile } from 'fs/promises';
import { basename } from 'path';
import { modelMap } from '../lib/agents/agentFactory/models.js';
import { rerankEvaluationResults } from '../lib/evaluation/agent/rerankAgentResultsV1.js';
import type { EvaluationRunResult } from '../lib/evaluation/agent/types.js';

config({ path: '.env.local' });

function showHelp(): void {
  console.log(`
Usage: npm run rerank:agent -- <result-file> [options]

Arguments:
  <result-file>          Path to evaluation result JSON file

Options:
  --judge <model>        Judge model to use (default: claude-4.5-sonnet)
  --help, -h             Show this help message

Examples:
  npm run rerank:agent -- datasets/_results/agent/agent-eval-assetDiscovery-2026-01-06T02-19-16.json
  npm run rerank:agent -- datasets/_results/agent/agent-eval-all-2026-01-06.json --judge claude-opus-4
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
  let judgeModelName = 'claude-4.5-sonnet';

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--judge') {
      judgeModelName = args[i + 1];
      i++;
    }
  }

  // Display banner
  console.log('========================================');
  console.log('Agent Evaluation Reranker');
  console.log('========================================');
  console.log(`Input file: ${resultFilePath}`);
  console.log(`Judge model: ${judgeModelName}`);
  console.log('========================================\n');

  // Load result file
  const resultContent = await readFile(resultFilePath, 'utf-8');
  const evaluationResult: EvaluationRunResult = JSON.parse(resultContent);

  console.log(`Loaded evaluation with ${evaluationResult.results.length} questions`);
  console.log(`Original systems: ${evaluationResult.config.agentSystems.join(', ')}`);

  // Get judge model
  const modelInfo = modelMap[judgeModelName as keyof typeof modelMap];
  if (!modelInfo) {
    throw new Error(`Unknown model: ${judgeModelName}`);
  }
  const judgeModel = modelInfo.model;

  // Rerank
  const rerankedResult = await rerankEvaluationResults({
    evaluationResult,
    judgeModel,
  });

  // Generate output filename
  const originalBasename = basename(resultFilePath, '.json');
  const outputFilename = `${originalBasename}-reranked.json`;
  const outputPath = resultFilePath.replace(basename(resultFilePath), outputFilename);

  // Save
  await writeFile(outputPath, JSON.stringify(rerankedResult, null, 2), 'utf-8');

  // Display summary
  console.log('\n========================================');
  console.log('Reranking Complete!');
  console.log('========================================');
  console.log(`Saved to: ${outputPath}`);
  console.log('\nScore Changes:');

  for (const system of evaluationResult.config.agentSystems) {
    const originalScore = evaluationResult.summary.averageScores[system]?.overall || 0;
    const newScore = rerankedResult.summary.averageScores[system]?.overall || 0;
    const delta = newScore - originalScore;
    const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';

    console.log(
      `  ${system}: ${originalScore.toFixed(1)} ${arrow} ${newScore.toFixed(1)} (${delta > 0 ? '+' : ''}${delta.toFixed(1)})`
    );
  }
  console.log('========================================');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('\nError:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  });
}
