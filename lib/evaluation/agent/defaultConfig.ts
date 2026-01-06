import type { AgentEvaluationConfig } from './types';

/**
 * Default configuration for agent evaluations
 */
export const defaultAgentEvaluationConfig: AgentEvaluationConfig = {
  agentSystems: ['gpt-5-mini', 'gemini-3-flash', 'droyd'], // gpt-5, gemini-3-flash, droyd
  datasets: 'all', // Load all dataset files from datasets/agent/
  judgeModel: 'gemini-3-flash', // prefered: claude-4.5-sonnet | cheap: gemini-3-flash
  outputDir: 'datasets/_results/agent',
  standardAgentConfig: {
    tools: ['webSearch'],
    maxSteps: 10,
    instructions:`Role: crypto research assistant

        Tools: 'webSearch'

        Utilize web search capabilities to find accurate, current information about crypto projects, trends, and markets.

        Your objective is to be a user's crypto research assistant.
        `
    },
  droydAgentConfig: {
    agentType: 'agent',
  },
};
