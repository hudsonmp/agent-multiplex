export type AgentId = "claude" | "gemini";

export const AGENTS: Record<AgentId, { command: string; args: string[]; envKey: string }> = {
  claude: { command: "claude", args: [], envKey: "ANTHROPIC_API_KEY" },
  gemini: { command: "gemini", args: [], envKey: "GEMINI_API_KEY" },
};

export const AGENT_IDS: AgentId[] = ["claude", "gemini"];
