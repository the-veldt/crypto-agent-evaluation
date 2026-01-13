/**
 * Cache Loader
 *
 * Load and validate cached agent responses from disk
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import type { AgentSystemResult } from './types.js';
import type { EvalQuestion } from '../../../datasets/types/evalQuestion.js';

/**
 * Cache entry structure (matches cache-responses.ts)
 */
export interface CacheEntry {
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
 * Attempt to load a cached response for a specific system and question
 *
 * @param system - Agent system identifier (e.g., 'gpt-5-mini')
 * @param qid - Question ID
 * @param cacheDir - Cache directory path
 * @returns CacheEntry if found and valid, null otherwise
 */
export async function loadCachedResponse(
  system: string,
  qid: string,
  cacheDir: string
): Promise<CacheEntry | null> {
  const cachePath = join(cacheDir, system, `${qid}.json`);

  try {
    const content = await readFile(cachePath, 'utf-8');
    const entry: CacheEntry = JSON.parse(content);

    // Basic validation
    if (!entry.metadata || !entry.agentResult || !entry.question) {
      console.warn(`[Cache] Invalid cache entry structure: ${cachePath}`);
      return null;
    }

    if (entry.metadata.system !== system || entry.metadata.qid !== qid) {
      console.warn(`[Cache] Metadata mismatch in ${cachePath}`);
      return null;
    }

    return entry;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // Cache miss - this is expected and not an error
      return null;
    }

    // Other errors (parse errors, permission errors, etc.) - log but don't fail
    console.warn(`[Cache] Failed to load cache for ${system}/${qid}: ${error.message}`);
    return null;
  }
}

/**
 * Validate that a cache entry is compatible with current evaluation version
 *
 * @param entry - Cache entry to validate
 * @param expectedVersion - Expected evaluation version ('v1' or 'v2')
 * @returns true if compatible, false otherwise
 */
export function validateCacheVersion(
  entry: CacheEntry,
  expectedVersion: 'v1' | 'v2'
): boolean {
  if (entry.metadata.evaluationVersion !== expectedVersion) {
    console.warn(
      `[Cache] Version mismatch: cache is ${entry.metadata.evaluationVersion}, expected ${expectedVersion} (${entry.metadata.system}/${entry.metadata.qid})`
    );
    return false;
  }
  return true;
}

/**
 * Check if cache is enabled
 */
export function isCacheEnabled(config: { useCache?: boolean }): boolean {
  return config.useCache === true;
}

/**
 * Get cache directory with fallback to default
 */
export function getCacheDir(config: { cacheDir?: string }): string {
  return config.cacheDir || 'datasets/_results/agent/response_cache';
}
