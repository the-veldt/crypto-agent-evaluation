const DROYD_API_BASE_URL = 'https://api.droyd.ai';

export type AgentType = 'research' | 'trading' | 'agent';

export interface DroydTaskOptions {
  taskInstructions: string;
  agentType?: AgentType;
  userId?: string;
}

// Response type for research/trading agents
export interface DroydTaskStructuredResponse {
  success: boolean;
  data: {
    task_title: string;
    result_summary: string[];
    document_id: string;
    totalUsage?: {
      totalTokens: number;
    };
  };
  user_id: number;
  agent_id: number;
}

// Response type for agent/chat/data agents
export interface DroydTaskTextResponse {
  success: boolean;
  data: {
    text: string;
    _output?: string;
    finishReason: string;
    totalUsage?: {
      totalTokens: number;
    };
  };
  user_id: number;
  agent_id: number;
}

export type DroydTaskResponse = DroydTaskStructuredResponse | DroydTaskTextResponse;

/**
 * Executes an AI agent task using Droyd API
 * @param options - Task options including instructions, agent type, and configuration
 * @returns Task execution results (structured or text-based depending on agent type)
 */
export async function droydTask(options: DroydTaskOptions): Promise<DroydTaskResponse> {
  const apiKey = process.env.DROYD_API_KEY;

  if (!apiKey) {
    throw new Error('DROYD_API_KEY environment variable is not set');
  }

  const {
    taskInstructions,
    agentType = 'agent',
    userId = process.env.DROYD_USER_ID, // Use provided userId or fall back to env var
  } = options;

  // Validate task instructions
  if (!taskInstructions || taskInstructions.trim().length === 0) {
    throw new Error('taskInstructions is required and cannot be empty');
  }

  try {
    const requestBody: any = {
      task_instructions: taskInstructions,
      agent_type: agentType,
    };


    const response = await fetch(`${DROYD_API_BASE_URL}/api/v1/agent/task`, {
      method: 'POST',
      headers: {
        'x-droyd-api-key': apiKey,
        'x-droyd-user-id': userId ?? "",
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Droyd API error (${response.status}): ${errorData.error || response.statusText}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error(
      `Droyd task execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
