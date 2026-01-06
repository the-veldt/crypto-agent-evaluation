#!/usr/bin/env tsx

import { readFile, writeFile } from 'fs/promises';
import { basename } from 'path';
import type { EvaluationRunResult } from '../lib/evaluation/agent/types.js';

function showHelp(): void {
  console.log(`
Usage: npm run strip:raw -- <result-file>

Arguments:
  <result-file>          Path to evaluation result JSON file

Options:
  --help, -h             Show this help message

Examples:
  npm run strip:raw -- datasets/_results/agent/agent-eval-assetDiscovery-2026-01-06T02-19-16.json
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(args.includes('--help') || args.includes('-h') ? 0 : 1);
  }

  const resultFilePath = args[0];

  console.log('========================================');
  console.log('Strip Raw Response');
  console.log('========================================');
  console.log(`Input file: ${resultFilePath}`);
  console.log('========================================\n');

  // Load result file
  const resultContent = await readFile(resultFilePath, 'utf-8');
  const evaluationResult: EvaluationRunResult = JSON.parse(resultContent);

  console.log(`Loaded evaluation with ${evaluationResult.results.length} questions`);

  // Count raw responses before stripping
  let totalRawResponses = 0;
  for (const questionResult of evaluationResult.results) {
    for (const agentResult of questionResult.agentResults) {
      if (agentResult.rawResponse) {
        totalRawResponses++;
      }
    }
  }

  console.log(`Found ${totalRawResponses} raw responses to strip`);

  // Strip raw responses
  const strippedResult: EvaluationRunResult = {
    ...evaluationResult,
    results: evaluationResult.results.map(questionResult => ({
      ...questionResult,
      agentResults: questionResult.agentResults.map(agentResult => {
        const { rawResponse, ...rest } = agentResult;
        return rest;
      }),
    })),
  };

  // Generate output filename
  const originalBasename = basename(resultFilePath, '.json');
  const outputFilename = `${originalBasename}-stripped.json`;
  const outputPath = resultFilePath.replace(basename(resultFilePath), outputFilename);

  // Save
  await writeFile(outputPath, JSON.stringify(strippedResult, null, 2), 'utf-8');

  // Calculate size reduction
  const originalSize = Buffer.byteLength(resultContent, 'utf-8');
  const strippedSize = Buffer.byteLength(JSON.stringify(strippedResult, null, 2), 'utf-8');
  const reductionPercent = ((originalSize - strippedSize) / originalSize * 100).toFixed(1);

  console.log('\n========================================');
  console.log('Stripping Complete!');
  console.log('========================================');
  console.log(`Saved to: ${outputPath}`);
  console.log(`\nSize Reduction:`);
  console.log(`  Original: ${(originalSize / 1024).toFixed(1)} KB`);
  console.log(`  Stripped: ${(strippedSize / 1024).toFixed(1)} KB`);
  console.log(`  Reduction: ${reductionPercent}%`);
  console.log('========================================');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('\nError:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  });
}
