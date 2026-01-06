/**
 * Agent Result Formatter
 *
 * Formats agent execution results into readable strings for LLM evaluation
 */

import type { AgentSystemResult, AgentStep, ToolCall } from './types';

/**
 * Format agent steps into a readable trace
 */
function formatSteps(steps: AgentStep[]): string {
  if (steps.length === 0) {
    return 'No steps recorded (agent execution failed or returned no trace)';
  }

  return steps
    .map((step) => {
      const parts: string[] = [`**Step ${step.stepNumber}:**`];

      if (step.text) {
        parts.push(step.text);
      } else {
        parts.push('(tool calls only, no text output)');
      }

      if (step.toolCalls && step.toolCalls.length > 0) {
        const toolNames = step.toolCalls.map((tc) => tc.toolName).join(', ');
        parts.push(`\n*Tools called: ${toolNames}*`);
      }

      if (step.usage) {
        parts.push(`\n*Tokens: ${step.usage.totalTokens}*`);
      }

      if (step.finishReason) {
        parts.push(`\n*Finish reason: ${step.finishReason}*`);
      }

      return parts.join('\n');
    })
    .join('\n\n---\n\n');
}

/**
 * Format tool calls into readable list
 */
function formatToolCalls(toolCalls: ToolCall[]): string {
  if (toolCalls.length === 0) {
    return 'No tool calls (agent may be opaque or completed without using tools)';
  }

  return toolCalls
    .map((tc, index) => {
      const parts: string[] = [`**${index + 1}. ${tc.toolName}**`];

      parts.push(`\nParameters:\n\`\`\`json\n${JSON.stringify(tc.parameters, null, 2)}\n\`\`\``);

      if (tc.result) {
        const resultPreview =
          typeof tc.result === 'string'
            ? tc.result.substring(0, 200)
            : JSON.stringify(tc.result).substring(0, 200);
        parts.push(`\nResult: ${resultPreview}${resultPreview.length >= 200 ? '...' : ''}`);
      }

      if (tc.error) {
        parts.push(`\n**Error:** ${tc.error}`);
      }

      if (tc.executionTimeMs !== undefined) {
        parts.push(`\nExecution time: ${tc.executionTimeMs.toFixed(2)}ms`);
      }

      return parts.join('\n');
    })
    .join('\n\n');
}

/**
 * Format complete agent result for LLM evaluation
 */
export function formatAgentResultForEvaluation(
  agentResult: AgentSystemResult,
  query: string
): string {
  const sections: string[] = [];

  // Header
  sections.push(`# Agent Evaluation`);
  sections.push(`**Agent System:** ${agentResult.system}`);
  sections.push(`**Query:** "${query}"`);
  sections.push('');

  // Error handling
  if (agentResult.error) {
    sections.push(`**ERROR:** ${agentResult.error}`);
    sections.push('');
    return sections.join('\n');
  }

  // Agent execution trace
  sections.push(`## Agent Execution Trace\n`);
  sections.push(formatSteps(agentResult.steps));
  sections.push('');

  // Tool calls
  sections.push(`## Tool Calls\n`);
  sections.push(formatToolCalls(agentResult.toolCalls));
  sections.push('');

  // Final answer
  sections.push(`## Final Answer\n`);
  sections.push(agentResult.finalAnswer || '(no final answer provided)');
  sections.push('');

  // Execution metadata
  sections.push(`## Execution Metadata\n`);
  sections.push(`- **Total Steps:** ${agentResult.stepCount}`);
  sections.push(`- **Execution Time:** ${agentResult.executionTimeMs.toFixed(2)}ms`);

  if (agentResult.totalTokens !== undefined) {
    sections.push(`- **Total Tokens:** ${agentResult.totalTokens}`);
  }

  return sections.join('\n');
}
