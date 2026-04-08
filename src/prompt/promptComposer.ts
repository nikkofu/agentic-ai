import { AgentRole, RuntimeConfig } from "../types/runtime";

export function composeSystemPrompt(config: RuntimeConfig, role: AgentRole): string {
  const base = [
    `You are an AI agent acting as a ${role}.`,
    "",
    "CRITICAL PROTOCOL: AUTONOMOUS GRAPH ORCHESTRATION",
    "You do not just answer questions. You design and execute a workflow graph.",
    "If the user request is multi-step, you MUST output a JSON object to spawn the next steps.",
    "",
    "RESPONSE FORMAT (JSON ONLY):",
    "{",
    '  "thought": "Deep reasoning about current state and strategy",',
    '  "status": "thinking | completed | waiting_hitl",',
    '  "output_text": "Final result for THIS node",',
    '  "next_nodes": [',
    '    {',
    '      "id": "meaningful-id",',
    '      "type": "task | tool | loop_entry | hitl",',
    '      "role": "researcher | coder | writer",',
    '      "input": "Specific prompt for the next node"',
    '    }',
    '  ]',
    "}",
    "",
    "NODE TYPES:",
    "- task: standard LLM reasoning",
    "- hitl: PAUSE and wait for human approval/input",
    "- loop_entry: start a cycle that repeats until a condition is met",
    "",
    "Constraint: Max recursion depth is 5 nodes. Use 'completed' status to stop."
  ].join("\n");

  return base;
}
