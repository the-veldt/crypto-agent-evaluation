/**
 * Search Result Pairwise Comparison
 *
 * Performs blinded pairwise comparisons between search results
 * with randomized presentation order to prevent position bias.
 */

import { generateText, Output, LanguageModel } from 'ai';
import { z } from 'zod';
import type { SearchSystemResult, SearchPairwiseComparison } from './types';
import { formatSearchResultsForEvaluation } from './searchResultFormatter';

/**
 * Zod schema for simplified pairwise comparison (output-only evaluation)
 */
const searchPairwiseComparisonSchema = z.object({
  overall_winner: z.enum(['response1', 'response2', 'tie']).describe(
    'Which search results provided superior overall quality'
  ),
  overall_confidence: z.enum(['high', 'medium', 'low']).describe(
    'Confidence in the assessment'
  ),
  overall_reasoning: z.string().describe(
    'Comprehensive explanation for the decision (3-4 sentences)'
  ),
  key_differentiators: z.array(z.string()).describe(
    'Key factors that distinguished the better search results (2-4 specific points)'
  ),
});

/**
 * Parameters for search pairwise comparison
 */
export interface SearchPairwiseCompareParams {
  model: LanguageModel;
  question: string;
  systemAResult: SearchSystemResult;
  systemBResult: SearchSystemResult;
  systemAName: string;
  systemBName: string;
}

/**
 * Format search result for blinded comparison
 * Omits system name and presents information in standardized format
 */
function formatSearchForComparison(
  result: SearchSystemResult,
  query: string
): string {
  if (result.error) {
    return `**ERROR:** ${result.error}\n\nThis search failed to execute successfully.`;
  }

  // Use the existing formatter but strip the system name header
  const fullFormat = formatSearchResultsForEvaluation(result, query);

  // Remove the first line which contains the system name
  const lines = fullFormat.split('\n');
  const startIndex = lines.findIndex(line => line.startsWith('Query:'));

  if (startIndex > 0) {
    return lines.slice(startIndex).join('\n');
  }

  return fullFormat;
}

/**
 * Perform blinded pairwise comparison between two search results
 *
 * Randomizes presentation order (Response 1 vs Response 2) to prevent position bias.
 * Returns comparison with winner mapped back to original systems (A vs B).
 *
 * @param params - Comparison parameters
 * @returns Pairwise comparison result
 */
export async function pairwiseCompareSearchResults({
  model,
  question,
  systemAResult,
  systemBResult,
  systemAName,
  systemBName,
}: SearchPairwiseCompareParams): Promise<SearchPairwiseComparison> {
  // Randomize which system is shown as Response 1 vs Response 2
  const showAFirst = Math.random() < 0.5;
  const response1System: 'A' | 'B' = showAFirst ? 'A' : 'B';
  const response1Result = showAFirst ? systemAResult : systemBResult;
  const response2Result = showAFirst ? systemBResult : systemAResult;

  // Format both responses for blinded comparison
  const response1Text = formatSearchForComparison(response1Result, question);
  const response2Text = formatSearchForComparison(response2Result, question);

  const prompt = `You are an expert evaluator assessing search result quality for crypto industry professionals.

**Current Date:** ${new Date().toISOString()}

**Search Query:** ${question}

---

**Search Results 1:**
${response1Text}

---

**Search Results 2:**
${response2Text}

---

## Evaluation Instructions

Compare these two search result sets based on **overall quality** for answering the query.

### Quality Assessment Criteria:

1. **Query Relevance**
   - How well do the results match the user's information need?
   - Are the results directly relevant to the query intent?
   - Are off-topic or tangential results minimized?

2. **Result Quality & Completeness**
   - Do the results provide comprehensive coverage of the topic?
   - Is important information included rather than missing?

3. **Information Density**
   - What proportion of the content is useful vs filler/noise?
   - Are the results concise yet informative?
   - Is token efficiency good (high signal-to-noise ratio)?

4. **Freshness & Timeliness**
   - For time-sensitive queries, are results appropriately recent?
   - Is outdated information avoided when freshness matters? 
   - For example, a query about recent trends, should heavily favor recent results over outdated ones (+3 months old).

5. **Professional Value**
   - Would these results be useful to an industry professional?
   - Do they provide actionable insights and specific details?
   - Is the information depth appropriate for professional decision-making?

## Critical Principles:

- **Quality over quantity**: Better to have 5 highly relevant, high-quality results than 15 mediocre ones
- **Relevance is paramount**: Results must actually address the query, not just contain related keywords
- **Assess the content**: Evaluate the actual information provided, not just metadata
- **Source depth over brand recognition**: Favor niche, primary sources with genuine expertise (project docs, research papers, specialized crypto publications, onchain analysts, etc.) over generic coverage from mainstream outlets (Forbes, Business Insider, etc.). A deep-dive from a domain expert is more valuable than surface-level reporting from a large publication.


## Output Requirements:

Provide:
- **Winner**: response1, response2, or tie
- **Confidence**:
  - high = clear, significant difference in quality
  - medium = noticeable difference but not overwhelming
  - low = very similar quality, marginal differences
- **Overall reasoning**: 3-4 sentences explaining your assessment, focusing on the key quality differences observed
- **Key differentiators**: 2-4 specific, concrete factors that distinguished the superior results (be specific with examples)

**Note on ties**: If both result sets are genuinely equivalent in quality and relevance, assign a tie. Don't force a winner when quality is truly comparable.`;

  const { output } = await generateText({
    model,
    output: Output.object({ schema: searchPairwiseComparisonSchema }),
    prompt,
  });

  // Map response1/response2 back to A/B based on randomization
  const mapWinner = (winner: 'response1' | 'response2' | 'tie'): 'A' | 'B' | 'tie' => {
    if (winner === 'tie') return 'tie';
    if (winner === 'response1') return response1System;
    return response1System === 'A' ? 'B' : 'A';
  };

  // Return comparison (questionId will be set by caller)
  return {
    questionId: '',
    systemA: systemAName,
    systemB: systemBName,
    winner: mapWinner(output.overall_winner),
    confidence: output.overall_confidence,
    response1System,
    reasoning: output.overall_reasoning,
    keyDifferentiators: output.key_differentiators,
    timestamp: new Date().toISOString(),
  };
}
