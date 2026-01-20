/**
 * Search Rankings Module
 *
 * Provides ELO and Bradley-Terry ranking calculations for search pairwise comparisons.
 * Wraps the generic ranking functions from the agent evaluation module.
 */

import {
  calculateEloRatings as agentCalculateEloRatings,
  calculateBradleyTerryRatings as agentCalculateBradleyTerryRatings,
} from '../agent/rankings';
import type { PairwiseComparison } from '../agent/types';
import type { SearchPairwiseComparison, EloRating, BradleyTerryRating } from './types';

/**
 * Convert SearchPairwiseComparison to PairwiseComparison for ranking calculations.
 * The ranking functions only need systemA, systemB, and winner fields.
 */
function toAgentComparison(comparison: SearchPairwiseComparison): PairwiseComparison {
  return {
    questionId: comparison.questionId,
    systemA: comparison.systemA,
    systemB: comparison.systemB,
    winner: comparison.winner,
    confidence: comparison.confidence,
    response1System: comparison.response1System,
    reasoning: comparison.reasoning,
    keyDifferentiators: comparison.keyDifferentiators,
    timestamp: comparison.timestamp,
  };
}

/**
 * Calculate ELO ratings from search pairwise comparisons
 *
 * @param comparisons - Array of search pairwise comparisons
 * @param systems - List of system identifiers
 * @returns Array of ELO ratings sorted by rating (highest first)
 */
export function calculateEloRatings(
  comparisons: SearchPairwiseComparison[],
  systems: string[]
): EloRating[] {
  const agentComparisons = comparisons.map(toAgentComparison);
  const ratings = agentCalculateEloRatings(agentComparisons, systems);

  // Convert to search EloRating type (strip dimensional ratings if present)
  return ratings.map((r) => ({
    system: r.system,
    rating: r.rating,
    gamesPlayed: r.gamesPlayed,
    record: r.record,
  }));
}

/**
 * Calculate Bradley-Terry ratings from search pairwise comparisons
 *
 * @param comparisons - Array of search pairwise comparisons
 * @param systems - List of system identifiers
 * @returns Array of Bradley-Terry ratings sorted by skill (highest first)
 */
export function calculateBradleyTerryRatings(
  comparisons: SearchPairwiseComparison[],
  systems: string[]
): BradleyTerryRating[] {
  const agentComparisons = comparisons.map(toAgentComparison);
  const ratings = agentCalculateBradleyTerryRatings(agentComparisons, systems);

  // Convert to search BradleyTerryRating type (strip dimensional skills if present)
  return ratings.map((r) => ({
    system: r.system,
    skill: r.skill,
    winProbability: r.winProbability,
    confidenceInterval: r.confidenceInterval,
    standardError: r.standardError,
    gamesPlayed: r.gamesPlayed,
  }));
}
