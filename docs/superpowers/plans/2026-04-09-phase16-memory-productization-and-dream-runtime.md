# Phase 16 Memory Productization And Dream Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build first-class personal, project, and task memory plus a safe Dream runtime that records, curates, compresses, retrieves, and reflects on memory across sessions.

**Architecture:** Add a markdown-first memory system on top of the existing runtime kernel using three layers (`personal`, `project`, `task`) and three states (`raw`, `curated`, `compressed`). Route runtime writes and retrieval through a shared memory engine, then layer an idle-time Dream runtime on top for reflection, summarization, skill draft extraction, and recommendations without autonomous external side effects.

**Tech Stack:** TypeScript, Node.js filesystem APIs, existing runtime executor/orchestrator/taskLifecycle, Vitest, YAML config, Next.js dashboard UI.

---

## File Structure

### New Runtime Files

- Create: `src/runtime/memoryContracts.ts`
  - Shared types for memory layers, states, entries, indexes, Dream outputs, and config.
- Create: `src/runtime/memoryPaths.ts`
  - Resolve repo-level and user-home memory directories and file locations.
- Create: `src/runtime/memoryMarkdown.ts`
  - Read/write markdown memory entries with frontmatter.
- Create: `src/runtime/memoryIndex.ts`
  - Maintain JSON indexes for project/task/dream memory.
- Create: `src/runtime/memoryEngine.ts`
  - High-level record/curate/compress/retrieve/promote/demote/forget/sync operations.
- Create: `src/runtime/memoryInjection.ts`
  - Layer-aware retrieval and prompt-injection selection.
- Create: `src/runtime/dreamRuntime.ts`
  - Idle-time reflection pipeline and Dream artifact generation.

### Existing Runtime Files To Modify

- Modify: `src/types/runtime.ts`
  - Add Phase 16 `memory` and `dream` config surface.
- Modify: `src/runtime/executor.ts`
  - Route task execution writes through the new memory engine.
- Modify: `src/runtime/taskLifecycle.ts`
  - Extend inspector with memory summaries and Dream status/output previews.
- Modify: `src/runtime/runtimeServices.ts`
  - Construct and wire memory engine + Dream runtime services.
- Modify: `src/runtime/memory.ts`
  - Keep compatibility shims or forward existing retrieval/memory provider logic into the new engine.
- Modify: `src/prompt/promptComposer.ts`
  - Consume memory injection output instead of ad hoc memory payload assembly.
- Modify: `src/cli/runTask.ts`
  - Surface config path / Dream-safe defaults if needed, but keep CLI thin.

### New UI Files

- Create: `ui/components/MemoryPanel.tsx`
  - Render personal/project/task memory summaries and Dream previews.

### Existing UI Files To Modify

- Modify: `ui/components/TaskLifecyclePanel.tsx`
  - Add memory and Dream sections.
- Modify: `ui/types/events.ts`
  - Add typed event payloads for memory and Dream events if exposed to UI.
- Modify: `ui/hooks/eventStreamState.ts`
  - Add explanation/status mapping for Dream and memory freshness if needed.

### Tests To Add

- Create: `tests/unit/memoryContracts.test.ts`
- Create: `tests/unit/memoryMarkdown.test.ts`
- Create: `tests/unit/memoryIndex.test.ts`
- Create: `tests/unit/memoryEngine.test.ts`
- Create: `tests/unit/memoryInjection.test.ts`
- Create: `tests/unit/dreamRuntime.test.ts`
- Create: `tests/integration/phase16-memory-productization.test.ts`
- Create: `tests/integration/phase16-dream-runtime.test.ts`
- Create: `tests/unit/ui-memory-panel.test.ts`

### Docs To Modify

- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Create: `docs/phase-handoff-playbook/2026-04-09-phase16-memory-productization-and-dream-runtime-handoff.md`
- Create: `diary/2026-04-09-v1.3.0.md`

## Task 1: Shared Memory Contracts And Directory Model

**Files:**
- Create: `src/runtime/memoryContracts.ts`
- Create: `src/runtime/memoryPaths.ts`
- Modify: `src/types/runtime.ts`
- Test: `tests/unit/memoryContracts.test.ts`

- [ ] **Step 1: Write the failing contract tests**

```ts
import { describe, expect, it } from "vitest";
import {
  normalizeMemoryLayer,
  normalizeMemoryState,
  defaultMemoryConfig,
  resolveMemoryRoot
} from "../../src/runtime/memoryContracts";

describe("memory contracts", () => {
  it("normalizes memory layers and states", () => {
    expect(normalizeMemoryLayer("project")).toBe("project");
    expect(normalizeMemoryLayer("bad")).toBeNull();
    expect(normalizeMemoryState("compressed")).toBe("compressed");
    expect(normalizeMemoryState("bad")).toBeNull();
  });

  it("provides full-auto defaults", () => {
    expect(defaultMemoryConfig().automation).toBe("full_auto");
    expect(defaultMemoryConfig().dream.enabled).toBe(true);
  });

  it("resolves project and personal roots", () => {
    const roots = resolveMemoryRoot("/repo", "/home/user");
    expect(roots.projectRoot).toContain("/repo/memory/project");
    expect(roots.personalRoot).toContain("/home/user/.agentic-ai/memory/personal");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/memoryContracts.test.ts`
Expected: FAIL with missing module and missing exports.

- [ ] **Step 3: Write minimal contracts and path helpers**

Implement:
- `MemoryLayer`
- `MemoryState`
- `MemoryEntryFrontmatter`
- `DreamConfig`
- `defaultMemoryConfig()`
- `normalizeMemoryLayer()`
- `normalizeMemoryState()`
- `resolveMemoryRoot()`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/memoryContracts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/runtime/memoryContracts.ts src/runtime/memoryPaths.ts src/types/runtime.ts tests/unit/memoryContracts.test.ts
git commit -m "phase16: add memory contracts and path model"
```

## Task 2: Markdown Memory Storage And Indexing

**Files:**
- Create: `src/runtime/memoryMarkdown.ts`
- Create: `src/runtime/memoryIndex.ts`
- Test: `tests/unit/memoryMarkdown.test.ts`
- Test: `tests/unit/memoryIndex.test.ts`

- [ ] **Step 1: Write the failing markdown storage test**

```ts
import { describe, expect, it } from "vitest";
import { parseMemoryMarkdown, serializeMemoryMarkdown } from "../../src/runtime/memoryMarkdown";

describe("memory markdown", () => {
  it("round-trips frontmatter and body", () => {
    const text = serializeMemoryMarkdown({
      frontmatter: {
        id: "proj-1",
        layer: "project",
        state: "curated",
        kind: "architecture_decision",
        confidence: "high",
        tags: ["runtime"]
      },
      body: "# Title\n\nContent"
    });

    const parsed = parseMemoryMarkdown(text);
    expect(parsed.frontmatter.id).toBe("proj-1");
    expect(parsed.body).toContain("Content");
  });
});
```

- [ ] **Step 2: Write the failing index test**

```ts
import { describe, expect, it } from "vitest";
import { createMemoryIndex } from "../../src/runtime/memoryIndex";

describe("memory index", () => {
  it("stores and updates entries by id", () => {
    const index = createMemoryIndex();
    index.upsert({ id: "proj-1", layer: "project", state: "curated", path: "memory/project/curated/proj-1.md" });
    expect(index.get("proj-1")?.path).toContain("proj-1.md");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/unit/memoryMarkdown.test.ts tests/unit/memoryIndex.test.ts`
Expected: FAIL with missing modules or exports.

- [ ] **Step 4: Implement markdown serialization and JSON index helpers**

Implement:
- markdown frontmatter parse/serialize
- memory index upsert/remove/list/save/load
- DRY helpers for state/layer keyed indexes

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/memoryMarkdown.test.ts tests/unit/memoryIndex.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/runtime/memoryMarkdown.ts src/runtime/memoryIndex.ts tests/unit/memoryMarkdown.test.ts tests/unit/memoryIndex.test.ts
git commit -m "phase16: add markdown memory storage and indexing"
```

## Task 3: Memory Engine For Personal / Project / Task Layers

**Files:**
- Create: `src/runtime/memoryEngine.ts`
- Modify: `src/runtime/memory.ts`
- Modify: `src/runtime/executor.ts`
- Test: `tests/unit/memoryEngine.test.ts`
- Test: `tests/integration/phase16-memory-productization.test.ts`

- [ ] **Step 1: Write the failing engine unit tests**

```ts
import { describe, expect, it } from "vitest";
import { createMemoryEngine } from "../../src/runtime/memoryEngine";

describe("memory engine", () => {
  it("records task memory into raw state", async () => {
    const engine = createMemoryEngine({ repoRoot: process.cwd(), userHome: "/tmp/phase16-user" });
    const entry = await engine.record({
      layer: "task",
      state: "raw",
      taskId: "task-1",
      kind: "node_summary",
      body: "node output"
    });

    expect(entry.layer).toBe("task");
    expect(entry.state).toBe("raw");
  });

  it("promotes raw memory to curated memory", async () => {
    const engine = createMemoryEngine({ repoRoot: process.cwd(), userHome: "/tmp/phase16-user" });
    const entry = await engine.record({
      layer: "project",
      state: "raw",
      kind: "known_issue",
      body: "retry with lower concurrency"
    });

    const promoted = await engine.promote({ id: entry.id, toState: "curated" });
    expect(promoted.state).toBe("curated");
  });
});
```

- [ ] **Step 2: Write the failing integration test**

```ts
import { describe, expect, it, vi } from "vitest";
import { createTaskExecutor } from "../../src/runtime/executor";

describe("phase16 memory productization", () => {
  it("writes task memory and project memory summaries during execution", async () => {
    const executor = createTaskExecutor(/* existing test scaffold */);
    await executor.execute({ input: "research and write summary" });
    // assert memory engine received task/project writes
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/unit/memoryEngine.test.ts tests/integration/phase16-memory-productization.test.ts`
Expected: FAIL with missing engine wiring.

- [ ] **Step 4: Implement memory engine**

Implement:
- `record`
- `retrieve`
- `promote`
- `demote`
- `forget`
- `sync`
- `compress`
- repo/user-home path routing by layer
- executor write-through integration for task/project memory

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/memoryEngine.test.ts tests/integration/phase16-memory-productization.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/runtime/memoryEngine.ts src/runtime/memory.ts src/runtime/executor.ts tests/unit/memoryEngine.test.ts tests/integration/phase16-memory-productization.test.ts
git commit -m "phase16: add layered memory engine"
```

## Task 4: Retrieval, Injection, And Compression Pipeline

**Files:**
- Create: `src/runtime/memoryInjection.ts`
- Modify: `src/prompt/promptComposer.ts`
- Test: `tests/unit/memoryInjection.test.ts`
- Test: `tests/integration/phase16-memory-productization.test.ts`

- [ ] **Step 1: Write the failing injection tests**

```ts
import { describe, expect, it } from "vitest";
import { buildMemoryInjectionSet } from "../../src/runtime/memoryInjection";

describe("memory injection", () => {
  it("injects compressed personal and project memory before task raw memory", () => {
    const injected = buildMemoryInjectionSet({
      personalCompressed: [{ id: "p1", body: "Prefers concise responses." }],
      projectCompressed: [{ id: "proj1", body: "Use verifier acceptance proof." }],
      taskCurated: [{ id: "t1", body: "Latest join summary." }],
      taskRaw: [{ id: "traw", body: "verbose raw detail" }]
    });

    expect(injected.personal.length).toBe(1);
    expect(injected.project.length).toBe(1);
    expect(injected.task.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/memoryInjection.test.ts`
Expected: FAIL with missing module.

- [ ] **Step 3: Implement injection ordering and compression selection**

Implement:
- layer-aware retrieval selection
- per-layer item caps
- exclusion of task raw by default
- prompt payload mapping for personal/project/task compressed/curated

- [ ] **Step 4: Update prompt composer to consume injection output**

Minimal implementation:
- render memory sections explicitly
- keep prompt payload structured and bounded

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/memoryInjection.test.ts tests/integration/phase16-memory-productization.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/runtime/memoryInjection.ts src/prompt/promptComposer.ts tests/unit/memoryInjection.test.ts tests/integration/phase16-memory-productization.test.ts
git commit -m "phase16: add memory injection and compression pipeline"
```

## Task 5: Dream Runtime

**Files:**
- Create: `src/runtime/dreamRuntime.ts`
- Modify: `src/runtime/runtimeServices.ts`
- Test: `tests/unit/dreamRuntime.test.ts`
- Test: `tests/integration/phase16-dream-runtime.test.ts`

- [ ] **Step 1: Write the failing Dream unit test**

```ts
import { describe, expect, it } from "vitest";
import { createDreamRuntime } from "../../src/runtime/dreamRuntime";

describe("dream runtime", () => {
  it("creates reflection artifacts without external actions", async () => {
    const dream = createDreamRuntime(/* deps */);
    const result = await dream.runIdleCycle({
      idleMinutes: 30,
      taskFailures: ["browser_outcome_not_reached"],
      memoryEntries: []
    });

    expect(result.reflections.length).toBeGreaterThan(0);
    expect(result.externalActionsAttempted).toBe(0);
  });
});
```

- [ ] **Step 2: Write the failing Dream integration test**

```ts
import { describe, expect, it } from "vitest";

describe("phase16 dream runtime", () => {
  it("writes dream recommendations and skill drafts during idle reflection", async () => {
    // build service with memory engine, simulate repeated failures, assert dream artifacts exist
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/unit/dreamRuntime.test.ts tests/integration/phase16-dream-runtime.test.ts`
Expected: FAIL with missing runtime and artifacts.

- [ ] **Step 4: Implement Dream runtime**

Implement:
- idle threshold check
- memory compression pass
- reflection generation
- hypothesis generation
- skill draft generation
- recommendation generation
- explicit counters showing no external actions taken in default mode

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/dreamRuntime.test.ts tests/integration/phase16-dream-runtime.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/runtime/dreamRuntime.ts src/runtime/runtimeServices.ts tests/unit/dreamRuntime.test.ts tests/integration/phase16-dream-runtime.test.ts
git commit -m "phase16: add dream runtime"
```

## Task 6: Product Surface For Memory And Dream

**Files:**
- Create: `ui/components/MemoryPanel.tsx`
- Modify: `src/runtime/taskLifecycle.ts`
- Modify: `ui/components/TaskLifecyclePanel.tsx`
- Modify: `ui/hooks/eventStreamState.ts`
- Test: `tests/unit/taskLifecycle.test.ts`
- Test: `tests/unit/ui-memory-panel.test.ts`

- [ ] **Step 1: Write the failing inspector test**

```ts
import { describe, expect, it } from "vitest";
import { summarizeRuntimeInspector } from "../../src/runtime/taskLifecycle";

describe("memory inspector", () => {
  it("exposes memory layer summaries and dream preview", () => {
    const inspector = summarizeRuntimeInspector(/* build task inspection input */);
    expect(inspector.memory.personal.count).toBeDefined();
    expect(inspector.memory.project.count).toBeDefined();
    expect(inspector.dream.reflectionsCount).toBeDefined();
  });
});
```

- [ ] **Step 2: Write the failing UI panel test**

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryPanel } from "../../ui/components/MemoryPanel";

it("renders personal, project, task, and dream sections", () => {
  render(<MemoryPanel inspection={mockInspection} />);
  expect(screen.getByText("Personal Memory")).toBeInTheDocument();
  expect(screen.getByText("Project Memory")).toBeInTheDocument();
  expect(screen.getByText("Task Memory")).toBeInTheDocument();
  expect(screen.getByText("Dream")).toBeInTheDocument();
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/unit/taskLifecycle.test.ts tests/unit/ui-memory-panel.test.ts`
Expected: FAIL with missing panel or inspector fields.

- [ ] **Step 4: Implement memory product surface**

Implement:
- inspector summaries for personal/project/task/dream
- `MemoryPanel`
- Dream output preview
- freshness/compression indicators
- integrate into lifecycle panel

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/taskLifecycle.test.ts tests/unit/ui-memory-panel.test.ts`
Expected: PASS

- [ ] **Step 6: Run UI type-check**

Run: `cd ui && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/runtime/taskLifecycle.ts ui/components/MemoryPanel.tsx ui/components/TaskLifecyclePanel.tsx ui/hooks/eventStreamState.ts tests/unit/taskLifecycle.test.ts tests/unit/ui-memory-panel.test.ts
git commit -m "phase16: add memory and dream product surface"
```

## Task 7: Release-Grade Verification And Documentation

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Create: `docs/phase-handoff-playbook/2026-04-09-phase16-memory-productization-and-dream-runtime-handoff.md`
- Create: `diary/2026-04-09-v1.3.0.md`

- [ ] **Step 1: Update README and changelog**

Add:
- Phase 16 summary
- memory layer overview
- Dream runtime overview
- release notes

- [ ] **Step 2: Write handoff and diary**

Create:
- handoff file with verification evidence and next steps
- personal release diary entry

- [ ] **Step 3: Run focused Phase 16 verification**

Run:

```bash
npx vitest run tests/unit/memoryContracts.test.ts tests/unit/memoryMarkdown.test.ts tests/unit/memoryIndex.test.ts tests/unit/memoryEngine.test.ts tests/unit/memoryInjection.test.ts tests/unit/dreamRuntime.test.ts tests/unit/taskLifecycle.test.ts tests/unit/ui-memory-panel.test.ts tests/integration/phase16-memory-productization.test.ts tests/integration/phase16-dream-runtime.test.ts
cd ui && npx tsc --noEmit
```

Expected:
- all listed tests PASS
- UI type check PASS

- [ ] **Step 4: Commit**

```bash
git add README.md CHANGELOG.md docs/phase-handoff-playbook/2026-04-09-phase16-memory-productization-and-dream-runtime-handoff.md diary/2026-04-09-v1.3.0.md
git commit -m "phase16: finalize memory productization release docs"
```

## Recommended Execution Notes

- Keep each task narrowly scoped; do not blend Dream runtime behavior into memory engine storage work.
- Preserve compatibility with the existing Phase 14/15 delivery and verifier flows.
- Prefer markdown-first storage and lightweight JSON indexes over introducing a database redesign.
- Do not let Dream perform external actions in Phase 16 default mode.
- Use repo-safe temporary directories in tests; avoid cross-test shared filenames.

## Success Criteria

Phase 16 is complete when:

- `personal`, `project`, and `task` memory are first-class and configurable
- memory can be recorded, retrieved, promoted, compressed, and forgotten
- prompt injection uses bounded, layer-aware memory selection
- Dream can produce reflections, hypotheses, recommendations, and skill drafts in idle mode
- no default Dream path performs code changes or external task execution
- memory and Dream state are visible in the product surface
- the focused Phase 16 suite and UI type checks pass
