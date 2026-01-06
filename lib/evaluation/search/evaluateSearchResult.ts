import { generateText, Output, LanguageModel } from 'ai';
import { z } from 'zod';

const searchEvaluationSchema = z.object({
  overall_score: z.number().describe('Overall quality score from 0-10'),

  query_relevance_score: z.number().describe(
    'How relevant the search contents are to the evaluation question (0-10)'
  ),
  query_relevance_reasoning: z.string().describe(
    'Explanation of why this relevance score was given'
  ),

  search_contents_quality_score: z.number().describe(
    'Overall quality of the search contents - accuracy, clarity, usefulness (0-10)'
  ),
  search_contents_quality_reasoning: z.string().describe(
    'Explanation of the quality assessment'
  ),

  relevant_information_density_score: z.number().describe(
    'How much of the search contents is directly relevant vs filler/noise (0-10). Higher score means less wasted tokens.'
  ),
  relevant_information_density_reasoning: z.string().describe(
    'Explanation of information density - what portion is relevant vs irrelevant'
  ),

  completeness_score: z.number().describe(
    'Whether the search contents sufficiently answer the query (0-10)'
  ),
  completeness_reasoning: z.string().describe(
    'What is missing or what is well covered'
  ),

  key_strengths: z.array(z.string()).describe(
    'Key strengths of the search result'
  ),

  key_weaknesses: z.array(z.string()).describe(
    'Key weaknesses or areas for improvement'
  ),

  overall_assessment: z.string().describe(
    'Overall summary assessment of the search result quality'
  ),
});

export type SearchEvaluation = z.infer<typeof searchEvaluationSchema>;

export interface EvaluateSearchResultParams {
  model: LanguageModel;
  evalQuestion: string;
  searchContents: string;
}

export async function evaluateSearchResult({
  model,
  evalQuestion,
  searchContents,
}: EvaluateSearchResultParams): Promise<SearchEvaluation> {
  const { output } = await generateText({
    model,
    output: Output.object({
      schema: searchEvaluationSchema,
    }),
    prompt: `You are evaluating the quality of search results for a given query.

**Evaluation Query:** ${evalQuestion}

**Search Contents to Evaluate:**
${searchContents}

---

Please evaluate the search contents based on the following criteria:

1. **Query Relevance** (0-10): How well do the search contents match what the query is asking for?

2. **Search Contents Quality** (0-10): Are the contents accurate, clear, well-structured, and useful?

3. **Relevant Information Density** (0-10): What percentage of the search contents is directly relevant to answering the query? Higher scores mean less filler, redundancy, or off-topic information. This measures token efficiency.

4. **Completeness** (0-10): Does the search result provide a complete answer to the query, or is critical information missing?

5. **Overall Score** (0-10): Taking all factors into account, what is the overall quality?

For each score, provide clear reasoning. Identify key strengths and weaknesses, and give an overall assessment.

Be objective and critical in your evaluation. A perfect 10 should be rare and reserved for exceptional results.`,
  });

  return output;
}
