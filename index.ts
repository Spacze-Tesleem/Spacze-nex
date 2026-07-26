// Shared types between API and Web

export type AgentStatus = 'QUEUED' | 'RUNNING' | 'WAITING_FOR_USER' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type LogType = 'STDOUT' | 'STDERR' | 'TOOL_CALL' | 'TOOL_RESULT' | 'REASONING' | 'ERROR';
export type Plan = 'FREE' | 'PRO' | 'TEAM';

export interface Agent {
  id: string;
  userId: string;
  status: AgentStatus;
  taskDescription: string;
  branch?: string;
  result?: string;
  prUrl?: string;
  iterations: number;
  maxIterations: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface AgentLog {
  id: string;
  agentId: string;
  type: LogType;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface User {
  id: string;
  githubId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  plan: Plan;
}

// WebSocket event types
export type WsEvent =
  | { type: 'agent:log'; agentId: string; log: AgentLog }
  | { type: 'agent:status'; agentId: string; status: AgentStatus }
  | { type: 'agent:completed'; agentId: string; result: string };
