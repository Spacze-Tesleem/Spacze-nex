import Anthropic from '@anthropic-ai/sdk';
import { SandboxInstance } from './sandbox';
import { agentTools, getToolByName } from './tools';
import { config } from '../config';

export interface ReasoningOptions {
  taskDescription: string;
  repoContext: string; // file tree summary
  maxIterations: number;
  onLog: (type: string, content: string) => void;
}

export interface ReasoningResult {
  success: boolean;
  summary: string;
  iterations: number;
}

const anthropic = new Anthropic({ apiKey: config.ai.anthropicKey });

const SYSTEM_PROMPT = `You are Spacze Agent, an autonomous software engineering agent.
You are working inside a sandboxed environment with access to a cloned Git repository.
Your job is to complete the task described by the user by reading, understanding, and modifying the codebase.

Rules:
- Always read relevant files before making changes
- Make minimal, focused changes
- Run tests after making changes if a test command exists
- Commit your work with clear commit messages
- If you're unsure about something, read more code before guessing
- Never modify files outside the repository
- If a task is impossible or unclear, explain why and stop

Available tools allow you to: read/write/edit files, run commands, search code, list files, view diffs, and make git commits.`;

export async function runReasoningLoop(
  sandbox: SandboxInstance,
  options: ReasoningOptions
): Promise<ReasoningResult> {
  const { taskDescription, repoContext, maxIterations, onLog } = options;

  // Build tool definitions for Claude
  const tools: Anthropic.Tool[] = agentTools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: {
      type: 'object' as const,
      properties: Object.fromEntries(
        Object.entries((t.parameters as any).shape).map(([key, schema]: [string, any]) => [
          key,
          { type: 'string', description: schema.description },
        ])
      ),
      required: Object.keys((t.parameters as any).shape).filter(
        key => !(t.parameters as any).shape[key].isOptional()
      ),
    },
  }));

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `## Task\n${taskDescription}\n\n## Repository Structure\n\`\`\`\n${repoContext}\n\`\`\`\n\nComplete this task. Start by reading the relevant files to understand the codebase, then make the necessary changes.`,
    },
  ];

  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;
    onLog('REASONING', `Iteration ${iterations}/${maxIterations}`);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    // Process response
    const assistantContent = response.content;
    messages.push({ role: 'assistant', content: assistantContent });

    // Check if agent is done (no tool use)
    if (response.stop_reason === 'end_turn') {
      const textBlocks = assistantContent.filter(b => b.type === 'text');
      const summary = textBlocks.map(b => (b as any).text).join('\n');
      onLog('REASONING', `Agent completed: ${summary}`);
      return { success: true, summary, iterations };
    }

    // Execute tool calls
    const toolUseBlocks = assistantContent.filter(b => b.type === 'tool_use');
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of toolUseBlocks) {
      if (block.type !== 'tool_use') continue;

      const tool = getToolByName(block.name);
      if (!tool) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: `Error: Unknown tool "${block.name}"`,
          is_error: true,
        });
        continue;
      }

      onLog('TOOL_CALL', `${block.name}(${JSON.stringify(block.input)})`);

      try {
        const result = await tool.execute(sandbox, block.input);
        onLog('TOOL_RESULT', result.slice(0, 500));
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        });
      } catch (error: any) {
        const errMsg = `Error: ${error.message}`;
        onLog('ERROR', errMsg);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: errMsg,
          is_error: true,
        });
      }
    }

    messages.push({ role: 'user', content: toolResults });
  }

  onLog('ERROR', 'Max iterations reached');
  return { success: false, summary: 'Agent reached maximum iterations without completing.', iterations };
}
