import prompts from "prompts";
import fs from "fs";
import path from "node:path";
import { installSkillPackage } from "./skillRegistry";

export type WizardOptions = {
  provider: "openrouter" | "generic";
  baseUrl?: string;
  enableDb: boolean;
  skills: string[];
};

export function generateConfigContent(options: WizardOptions) {
  let envContent = "";
  let yamlContent = `models:\n  default: "stepfun/step-3.5-flash:free"\n  fallback:\n    - "nvidia/nemotron-3-super-120b-a12b:free"\n    - "arcee-ai/trinity-large-preview:free"\n    - "z-ai/glm-4.5-air:free"\n    - "nvidia/nemotron-3-nano-30b-a3b:free"\n    - "minimax/minimax-m2.5:free"\n    - "openai/gpt-oss-120b:free"\n    - "qwen/qwen3-coder:free"\n    - "google/gemma-4-31b-it:free"\n    - "google/gemma-4-26b-a4b-it:free"\n`;
  
  if (options.provider === "generic" && options.baseUrl) {
    yamlContent += `  base_url: "${options.baseUrl}"\n  api_key_env: "OPENAI_API_KEY"\n`;
    envContent += "OPENAI_API_KEY=your_generic_api_key_here\n";
  } else {
    envContent += "OPENROUTER_API_KEY=your_openrouter_api_key_here\n";
  }

  yamlContent += `  by_agent_role:\n    planner: "openai/gpt-oss-120b:free"\n    researcher: "nvidia/nemotron-3-super-120b-a12b:free"\n    coder: "qwen/qwen3-coder:free"\n    writer: "minimax/minimax-m2.5:free"\n  embeddings:\n    default: "nvidia/llama-nemotron-embed-vl-1b-v2:free"\n\n`;
  yamlContent += `reasoner:\n  default: "medium"\n  by_agent_role:\n    planner: "high"\n    researcher: "high"\n    coder: "medium"\n    writer: "low"\n\n`;
  yamlContent += `scheduler:\n  default_policy: "bfs"\n  policy_overrides: {}\n  rate_limit:\n    requests_per_minute: 60\n    burst_capacity: 5\n\n`;
  yamlContent += `guardrails:\n  max_depth: 4\n  max_branch: 3\n  max_steps: 60\n  max_budget: 5.0\n\n`;
  yamlContent += `evaluator:\n  weights:\n    quality: 0.6\n    cost: 0.2\n    latency: 0.2\n\n`;
  yamlContent += `retry:\n  max_retries: 3\n  base_delay_ms: 1000\n\n`;
  yamlContent += `mcp_servers: {}\n`;

  return { envContent, yamlContent };
}

export async function runInitWizard() {
  console.log("Welcome to Agentic-AI! Let's set up your environment.");
  
  const response = await prompts([
    {
      type: 'select',
      name: 'provider',
      message: 'Choose your LLM Provider',
      choices: [
        { title: 'OpenRouter', value: 'openrouter' },
        { title: 'Generic OpenAI-Compatible (e.g. LM Studio, vLLM)', value: 'generic' }
      ]
    },
    {
      type: prev => prev === 'generic' ? 'text' : null,
      name: 'baseUrl',
      message: 'Enter the Base URL',
      initial: 'http://localhost:1234/v1'
    },
    {
      type: 'confirm',
      name: 'enableDb',
      message: 'Enable persistent database (SQLite)?',
      initial: true
    },
    {
      type: 'multiselect',
      name: 'skills',
      message: 'Pre-install which SKILLs?',
      choices: [
        { title: 'Code Reviewer', value: 'code-reviewer' }
      ]
    }
  ]);

  if (!response.provider) {
    console.log("Wizard cancelled.");
    return;
  }

  const { envContent, yamlContent } = generateConfigContent(response as WizardOptions);

  fs.writeFileSync(path.join(process.cwd(), ".env"), envContent);
  const configDir = path.join(process.cwd(), "config");
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir);
  fs.writeFileSync(path.join(configDir, "runtime.yaml"), yamlContent);

  if (response.enableDb) {
    console.log("SQLite database persistence is conceptually enabled.");
    // In a real scenario we might run prisma migrate here
  }

  if (response.skills && response.skills.length > 0) {
    for (const skill of response.skills) {
      console.log(`Installing skill: ${skill}...`);
      // We assume installSkillPackage is synchronous or handles its own errors
      try {
        installSkillPackage(skill);
      } catch (err) {
        console.error(`Failed to install skill ${skill}:`, err);
      }
    }
  }

  console.log("✨ Project initialized successfully!");
  console.log("Check .env and config/runtime.yaml to customize your setup.");
}
