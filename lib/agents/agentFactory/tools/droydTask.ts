import { tool, zodSchema } from 'ai';
import { z } from 'zod';
import { droydTask } from '@/lib/utils/droydTask';

/**
 * Tool for executing AI agent tasks using Droyd API
 */
export const droydTaskTool = tool({
  description: 'Execute an AI agent task for crypto research, trading analysis, or data exploration. The agent can analyze trends, create reports, perform market analysis, and answer complex questions about crypto projects and ecosystems.',
  inputSchema: zodSchema(z.object({
    taskInstructions: z.string().min(1).describe('Task description for the agent to execute (be specific and detailed for better results)'),
    agentType: z.enum(['research', 'trading', 'agent']).optional().describe('Agent type: "research" for content analysis and reports, "trading" for market analysis, "agent" for general tasks (default: agent)'),
  })),
  execute: async (params) => {
    try {
      const response = await droydTask({
        taskInstructions: params.taskInstructions,
        agentType: params.agentType,
      });

      // Handle structured response (research/trading agents)
      if ('data' in response && response.data && 'task_title' in response.data) {
        return {
          success: true,
          taskTitle: response.data.task_title,
          resultSummary: response.data.result_summary,
          documentId: response.data.document_id,
          userId: response.user_id,
          agentId: response.agent_id,
          message: `Task completed: ${response.data.task_title}`,
        };
      }

      // Handle text response (agent/chat/data agents)
      if ('data' in response && response.data && 'text' in response.data) {
        return {
          success: true,
          text: response.data.text,
          finishReason: response.data.finishReason,
          userId: response.user_id,
          agentId: response.agent_id,
          message: 'Task completed successfully',
        };
      }

      return {
        success: true,
        data: response,
        message: 'Task completed successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to execute Droyd agent task',
      };
    }
  },
});
