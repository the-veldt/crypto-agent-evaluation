/**
 * Bradley-Terry Model Implementation
 *
 * Calculates skill parameters and win probabilities from pairwise comparisons
 * using the MM (Minorization-Maximization) algorithm. Provides statistical
 * confidence intervals based on Fisher information.
 */

import type { PairwiseComparison, BradleyTerryRating } from '../types';

/** Maximum iterations for convergence */
const MAX_ITERATIONS = 100;

/** Convergence threshold for skill parameter changes */
const CONVERGENCE_THRESHOLD = 0.0001;

/**
 * Calculate Bradley-Terry ratings using iterative MM algorithm
 *
 * The Bradley-Terry model estimates skill parameters (in log-scale) for each system.
 * Skills are relative and centered around 0. Higher skill = higher win probability.
 *
 * @param comparisons - Array of pairwise comparisons
 * @param systems - List of system identifiers
 * @returns Array of Bradley-Terry ratings sorted by skill (highest first)
 */
export function calculateBradleyTerryRatings(
  comparisons: PairwiseComparison[],
  systems: string[]
): BradleyTerryRating[] {
  const n = systems.length;
  const systemIndex = new Map(systems.map((s, i) => [s, i]));

  // Initialize skill parameters (log-scale) to 0
  let skills = new Array(n).fill(0);

  // Build win/loss matrix
  const wins = Array(n)
    .fill(0)
    .map(() => new Array(n).fill(0));
  const games = Array(n)
    .fill(0)
    .map(() => new Array(n).fill(0));

  for (const comparison of comparisons) {
    const i = systemIndex.get(comparison.systemA);
    const j = systemIndex.get(comparison.systemB);

    if (i === undefined || j === undefined) continue;

    if (comparison.winner === 'A') {
      wins[i][j] += 1;
      games[i][j] += 1;
      games[j][i] += 1;
    } else if (comparison.winner === 'B') {
      wins[j][i] += 1;
      games[i][j] += 1;
      games[j][i] += 1;
    } else {
      // Tie counts as 0.5 wins for each
      wins[i][j] += 0.5;
      wins[j][i] += 0.5;
      games[i][j] += 1;
      games[j][i] += 1;
    }
  }

  // Iterative MM algorithm to estimate skills
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const newSkills = [...skills];
    let maxChange = 0;

    for (let i = 0; i < n; i++) {
      let numerator = 0;
      let denominator = 0;

      for (let j = 0; j < n; j++) {
        if (i === j) continue;

        const totalGames = games[i][j];
        if (totalGames === 0) continue;

        numerator += wins[i][j];
        denominator += totalGames / (Math.exp(skills[i]) + Math.exp(skills[j]));
      }

      if (denominator > 0) {
        newSkills[i] = Math.log(numerator / denominator);
        maxChange = Math.max(maxChange, Math.abs(newSkills[i] - skills[i]));
      }
    }

    skills = newSkills;

    // Check for convergence
    if (maxChange < CONVERGENCE_THRESHOLD) {
      console.log(`Bradley-Terry converged after ${iter + 1} iterations`);
      break;
    }
  }

  // Normalize skills (center around 0)
  const meanSkill = skills.reduce((a, b) => a + b, 0) / n;
  skills = skills.map((s) => s - meanSkill);

  // Calculate confidence intervals using Fisher information
  const standardErrors = calculateStandardErrors(skills, games, n);

  // Create ratings
  const ratings: BradleyTerryRating[] = systems.map((system, i) => {
    const gamesPlayed = games[i].reduce((a, b) => a + b, 0);
    const winProb = Math.exp(skills[i]) / (1 + Math.exp(skills[i]));
    const se = standardErrors[i];

    return {
      system,
      skill: skills[i],
      winProbability: winProb,
      confidenceInterval: {
        lower: skills[i] - 1.96 * se,
        upper: skills[i] - 1.96 * se,
      },
      standardError: se,
      gamesPlayed,
    };
  });

  // Sort by skill (highest first)
  return ratings.sort((a, b) => b.skill - a.skill);
}

/**
 * Calculate standard errors for skill estimates
 * Uses Fisher information approximation based on number of games
 *
 * @param skills - Current skill estimates
 * @param games - Games played matrix
 * @param n - Number of systems
 * @returns Array of standard errors
 */
function calculateStandardErrors(skills: number[], games: number[][], n: number): number[] {
  const standardErrors = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    let information = 0;

    for (let j = 0; j < n; j++) {
      if (i === j) continue;

      const totalGames = games[i][j];
      if (totalGames === 0) continue;

      const pi = Math.exp(skills[i]);
      const pj = Math.exp(skills[j]);
      const denominator = (pi + pj) * (pi + pj);

      information += (totalGames * pi * pj) / denominator;
    }

    standardErrors[i] = information > 0 ? 1 / Math.sqrt(information) : Infinity;
  }

  return standardErrors;
}

/**
 * Calculate dimensional Bradley-Terry ratings for a specific dimension
 *
 * @param comparisons - Array of pairwise comparisons
 * @param systems - List of system identifiers
 * @param dimension - Which dimension to calculate ratings for
 * @returns Map of system to dimensional skill
 */
export function calculateDimensionalBradleyTerryRatings(
  comparisons: PairwiseComparison[],
  systems: string[],
  dimension: 'taskCompletion' | 'answerQuality' | 'reasoningQuality' | 'efficiency'
): Map<string, number> {
  // Create filtered comparisons for this dimension (skip comparisons without dimensional data)
  const dimensionalComparisons: PairwiseComparison[] = comparisons
    .filter((c) => c.dimensions !== undefined)
    .map((c) => ({
      ...c,
      winner: c.dimensions![dimension].winner,
    }));

  const ratings = calculateBradleyTerryRatings(dimensionalComparisons, systems);
  return new Map(ratings.map((r) => [r.system, r.skill]));
}

/**
 * Add dimensional skills to Bradley-Terry ratings
 *
 * Calculates Bradley-Terry for each dimension and adds dimensionalSkills field
 *
 * @param ratings - Base Bradley-Terry ratings
 * @param comparisons - Array of pairwise comparisons
 * @returns Ratings enriched with dimensional skills
 */
export function enrichWithDimensionalSkills(
  ratings: BradleyTerryRating[],
  comparisons: PairwiseComparison[]
): BradleyTerryRating[] {
  const systems = ratings.map((r) => r.system);

  const taskCompletionSkills = calculateDimensionalBradleyTerryRatings(
    comparisons,
    systems,
    'taskCompletion'
  );
  const answerQualitySkills = calculateDimensionalBradleyTerryRatings(
    comparisons,
    systems,
    'answerQuality'
  );
  const reasoningQualitySkills = calculateDimensionalBradleyTerryRatings(
    comparisons,
    systems,
    'reasoningQuality'
  );
  const efficiencySkills = calculateDimensionalBradleyTerryRatings(
    comparisons,
    systems,
    'efficiency'
  );

  return ratings.map((rating) => ({
    ...rating,
    dimensionalSkills: {
      taskCompletion: taskCompletionSkills.get(rating.system) || 0,
      answerQuality: answerQualitySkills.get(rating.system) || 0,
      reasoningQuality: reasoningQualitySkills.get(rating.system) || 0,
      efficiency: efficiencySkills.get(rating.system) || 0,
    },
  }));
}
