import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import type { EvaluationRunResult } from '../evaluation/agent/types';

/**
 * Load all agent evaluation results from the results directory
 */
export async function loadAgentResults(): Promise<(EvaluationRunResult & { filename: string })[]> {
  const resultsDir = 'datasets/_results/agent';

  try {
    const files = await readdir(resultsDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json') && f.startsWith('agent-eval-'));

    const results: (EvaluationRunResult & { filename: string })[] = [];

    for (const file of jsonFiles) {
      try {
        const filePath = join(resultsDir, file);
        const content = await readFile(filePath, 'utf-8');
        const result: EvaluationRunResult = JSON.parse(content);
        // Add filename to the result for easy access in UI
        results.push({ ...result, filename: file });
      } catch (error) {
        console.error(`Error loading result file ${file}:`, error);
      }
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return results;
  } catch (error) {
    console.error('Error loading agent results:', error);
    return [];
  }
}

/**
 * Load a specific agent evaluation result by filename
 */
export async function loadAgentResult(filename: string): Promise<EvaluationRunResult | null> {
  const resultsDir = 'datasets/_results/agent';
  const filePath = join(resultsDir, filename);

  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading result file ${filename}:`, error);
    return null;
  }
}
