/**
 * ELO Rating System Implementation
 *
 * Calculates ELO ratings from pairwise comparisons using the standard
 * chess ELO algorithm. Initial rating: 1500, K-factor: 32.
 */

import type { PairwiseComparison, EloRating } from '../types';

/** Initial ELO rating for all systems */
const INITIAL_RATING = 1500;

/** K-factor determines how much ratings change per game */
const K_FACTOR = 32;

/**
 * Calculate expected score for player A vs player B
 * Returns probability of A winning (0-1)
 */
function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Update ELO rating based on a single game result
 *
 * @param currentRating - Current rating
 * @param expectedScore - Expected probability of winning (0-1)
 * @param actualScore - Actual result: 1.0 = win, 0.5 = tie, 0.0 = loss
 * @param kFactor - K-factor (default: 32)
 * @returns Updated rating
 */
function updateRating(
  currentRating: number,
  expectedScore: number,
  actualScore: number,
  kFactor: number = K_FACTOR
): number {
  return currentRating + kFactor * (actualScore - expectedScore);
}

/**
 * Convert comparison winner to scores
 * @returns Score for system A and system B
 */
function comparisonToScores(comparison: PairwiseComparison): {
  scoreA: number;
  scoreB: number;
} {
  if (comparison.winner === 'tie') {
    return { scoreA: 0.5, scoreB: 0.5 };
  }
  if (comparison.winner === 'A') {
    return { scoreA: 1.0, scoreB: 0.0 };
  }
  return { scoreA: 0.0, scoreB: 1.0 };
}

/**
 * Calculate ELO ratings from a sequence of pairwise comparisons
 *
 * All systems start at initial rating (1500). Ratings are updated
 * sequentially for each comparison.
 *
 * @param comparisons - Array of pairwise comparisons
 * @param systems - List of system identifiers
 * @returns Array of ELO ratings sorted by rating (highest first)
 */
export function calculateEloRatings(
  comparisons: PairwiseComparison[],
  systems: string[]
): EloRating[] {
  // Initialize ratings for all systems
  const ratings = new Map<string, EloRating>(
    systems.map((system) => [
      system,
      {
        system,
        rating: INITIAL_RATING,
        gamesPlayed: 0,
        record: { wins: 0, losses: 0, ties: 0 },
      },
    ])
  );

  // Process each comparison in order
  for (const comparison of comparisons) {
    const ratingA = ratings.get(comparison.systemA);
    const ratingB = ratings.get(comparison.systemB);

    if (!ratingA || !ratingB) {
      console.warn(
        `Skipping comparison: system ${comparison.systemA} or ${comparison.systemB} not found`
      );
      continue;
    }

    // Calculate expected scores
    const expectedA = expectedScore(ratingA.rating, ratingB.rating);
    const expectedB = 1 - expectedA;

    // Get actual scores from comparison
    const { scoreA, scoreB } = comparisonToScores(comparison);

    // Update ratings
    ratingA.rating = updateRating(ratingA.rating, expectedA, scoreA);
    ratingB.rating = updateRating(ratingB.rating, expectedB, scoreB);

    // Update games played
    ratingA.gamesPlayed++;
    ratingB.gamesPlayed++;

    // Update win/loss/tie records
    if (comparison.winner === 'A') {
      ratingA.record.wins++;
      ratingB.record.losses++;
    } else if (comparison.winner === 'B') {
      ratingB.record.wins++;
      ratingA.record.losses++;
    } else {
      ratingA.record.ties++;
      ratingB.record.ties++;
    }
  }

  // Return sorted by rating (highest first)
  return Array.from(ratings.values()).sort((a, b) => b.rating - a.rating);
}

/**
 * Calculate dimensional ELO ratings for a specific dimension
 *
 * @param comparisons - Array of pairwise comparisons
 * @param systems - List of system identifiers
 * @param dimension - Which dimension to calculate ratings for
 * @returns Map of system to dimensional rating
 */
export function calculateDimensionalEloRatings(
  comparisons: PairwiseComparison[],
  systems: string[],
  dimension: 'taskCompletion' | 'answerQuality' | 'reasoningQuality' | 'efficiency'
): Map<string, number> {
  // Initialize ratings
  const ratings = new Map<string, number>(systems.map((system) => [system, INITIAL_RATING]));

  // Process each comparison using dimensional winner
  for (const comparison of comparisons) {
    const ratingA = ratings.get(comparison.systemA);
    const ratingB = ratings.get(comparison.systemB);

    if (ratingA === undefined || ratingB === undefined) continue;

    // Skip comparisons without dimensional data
    if (!comparison.dimensions) continue;

    const dimComparison = comparison.dimensions[dimension];
    const expectedA = expectedScore(ratingA, ratingB);
    const expectedB = 1 - expectedA;

    let scoreA: number, scoreB: number;
    if (dimComparison.winner === 'tie') {
      scoreA = scoreB = 0.5;
    } else if (dimComparison.winner === 'A') {
      scoreA = 1.0;
      scoreB = 0.0;
    } else {
      scoreA = 0.0;
      scoreB = 1.0;
    }

    ratings.set(comparison.systemA, updateRating(ratingA, expectedA, scoreA));
    ratings.set(comparison.systemB, updateRating(ratingB, expectedB, scoreB));
  }

  return ratings;
}

/**
 * Add dimensional ratings to ELO ratings
 *
 * Calculates ELO for each dimension and adds dimensionalRatings field
 *
 * @param ratings - Base ELO ratings
 * @param comparisons - Array of pairwise comparisons
 * @returns Ratings enriched with dimensional ratings
 */
export function enrichWithDimensionalRatings(
  ratings: EloRating[],
  comparisons: PairwiseComparison[]
): EloRating[] {
  const systems = ratings.map((r) => r.system);

  const taskCompletionRatings = calculateDimensionalEloRatings(
    comparisons,
    systems,
    'taskCompletion'
  );
  const answerQualityRatings = calculateDimensionalEloRatings(
    comparisons,
    systems,
    'answerQuality'
  );
  const reasoningQualityRatings = calculateDimensionalEloRatings(
    comparisons,
    systems,
    'reasoningQuality'
  );
  const efficiencyRatings = calculateDimensionalEloRatings(comparisons, systems, 'efficiency');

  return ratings.map((rating) => ({
    ...rating,
    dimensionalRatings: {
      taskCompletion: taskCompletionRatings.get(rating.system) || INITIAL_RATING,
      answerQuality: answerQualityRatings.get(rating.system) || INITIAL_RATING,
      reasoningQuality: reasoningQualityRatings.get(rating.system) || INITIAL_RATING,
      efficiency: efficiencyRatings.get(rating.system) || INITIAL_RATING,
    },
  }));
}
