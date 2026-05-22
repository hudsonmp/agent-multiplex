export type AgentId = "claude" | "gemini";

export const AGENTS: Record<AgentId, { command: string; args: string[] }> = {
  claude: { command: "claude", args: [] },
  gemini: { command: "gemini", args: [] },
};

export const AGENT_IDS: AgentId[] = ["claude", "gemini"];
