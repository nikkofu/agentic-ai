export const MEMORY_LAYERS = ["personal", "project", "task"] as const;
export type MemoryLayer = (typeof MEMORY_LAYERS)[number];

export const MEMORY_STATES = ["raw", "curated", "compressed"] as const;
export type MemoryState = (typeof MEMORY_STATES)[number];

export const MEMORY_ENTRY_STATUSES = ["active", "stale", "superseded", "archived", "forgotten"] as const;
export type MemoryEntryStatus = (typeof MEMORY_ENTRY_STATUSES)[number];

export const MEMORY_CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export type MemoryConfidence = (typeof MEMORY_CONFIDENCE_LEVELS)[number];

export type MemoryAutomationMode = "full_auto" | "assisted" | "manual";

export type MemoryLayerConfig = {
  enabled: boolean;
  storage: "repo" | "user_home";
  auto_record: boolean;
  auto_curate: boolean;
  auto_compress: boolean;
  sensitivity_filter?: "strict" | "balanced" | "off";
  sync_to_repo?: boolean;
  retain_days?: number;
};

export type MemoryRetrievalConfig = {
  inject_personal_compressed: boolean;
  inject_project_compressed: boolean;
  inject_task_curated: boolean;
  max_items_per_layer: number;
};

export type MemoryEvolutionConfig = {
  auto_promote_task_to_project: boolean;
  auto_generate_skill_candidates: boolean;
  min_reuse_count_for_project_promotion: number;
  max_stale_days: number;
};

export type MemoryConfig = {
  enabled: boolean;
  automation: MemoryAutomationMode;
  personal: MemoryLayerConfig;
  project: MemoryLayerConfig;
  task: MemoryLayerConfig;
  retrieval: MemoryRetrievalConfig;
  evolution: MemoryEvolutionConfig;
};

export type DreamConfig = {
  enabled: boolean;
  mode: "background" | "manual";
  idle_threshold_minutes: number;
  auto_reflect: boolean;
  auto_compress_memory: boolean;
  auto_generate_skills: boolean;
  auto_reorder_backlog: boolean;
  auto_generate_hypotheses: boolean;
  allow_external_actions: boolean;
  allow_code_changes: boolean;
  allow_network_execution: boolean;
  allow_message_sending: boolean;
};

export function normalizeMemoryLayer(value: unknown): MemoryLayer | null {
  return typeof value === "string" && (MEMORY_LAYERS as readonly string[]).includes(value)
    ? (value as MemoryLayer)
    : null;
}

export function normalizeMemoryState(value: unknown): MemoryState | null {
  return typeof value === "string" && (MEMORY_STATES as readonly string[]).includes(value)
    ? (value as MemoryState)
    : null;
}

export function normalizeMemoryEntryStatus(value: unknown): MemoryEntryStatus | null {
  return typeof value === "string" && (MEMORY_ENTRY_STATUSES as readonly string[]).includes(value)
    ? (value as MemoryEntryStatus)
    : null;
}

export function normalizeMemoryConfidence(value: unknown): MemoryConfidence | null {
  return typeof value === "string" && (MEMORY_CONFIDENCE_LEVELS as readonly string[]).includes(value)
    ? (value as MemoryConfidence)
    : null;
}

export function defaultMemoryEntryStatus(): MemoryEntryStatus {
  return "active";
}

export function defaultMemoryConfidence(): MemoryConfidence {
  return "medium";
}

export function defaultMemoryConfig(): MemoryConfig & { dream: DreamConfig } {
  return {
    enabled: true,
    automation: "full_auto",
    personal: {
      enabled: true,
      storage: "user_home",
      auto_record: true,
      auto_curate: true,
      auto_compress: true,
      sensitivity_filter: "strict"
    },
    project: {
      enabled: true,
      storage: "repo",
      auto_record: true,
      auto_curate: true,
      auto_compress: true,
      sync_to_repo: true
    },
    task: {
      enabled: true,
      storage: "repo",
      auto_record: true,
      auto_curate: true,
      auto_compress: true,
      retain_days: 30
    },
    retrieval: {
      inject_personal_compressed: true,
      inject_project_compressed: true,
      inject_task_curated: true,
      max_items_per_layer: 5
    },
    evolution: {
      auto_promote_task_to_project: true,
      auto_generate_skill_candidates: true,
      min_reuse_count_for_project_promotion: 1,
      max_stale_days: 30
    },
    dream: {
      enabled: true,
      mode: "background",
      idle_threshold_minutes: 20,
      auto_reflect: true,
      auto_compress_memory: true,
      auto_generate_skills: true,
      auto_reorder_backlog: true,
      auto_generate_hypotheses: true,
      allow_external_actions: false,
      allow_code_changes: false,
      allow_network_execution: false,
      allow_message_sending: false
    }
  };
}
