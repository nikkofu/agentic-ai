# Phase 16 Memory Productization And Dream Runtime Design

Date: 2026-04-09
Context: post-`v1.2.0` runtime platform with real-world delivery harness and verifier-enforced handoff

## Objective

Turn the current memory substrate into a productized, long-running memory system that can:

- persist useful knowledge across tasks and sessions
- distinguish different memory timescales and trust levels
- support automatic recording, retrieval, synchronization, updating, compression, and forgetting
- provide a safe but highly autonomous default mode
- add a `Dream` runtime that uses idle time for reflection, memory refinement, skill extraction, and self-improvement

Phase 16 is not only about “adding memory.” It is about making the runtime able to accumulate durable intelligence over time.

## Why Phase 16 Exists

After Phase 11-15, the project already has:

- task-scoped memory write-back
- retrieval substrate
- tree-wide join summaries
- runtime inspector
- real-world delivery harness
- verifier-enforced acceptance proof

What is still missing is a memory system that feels product-grade and agent-grade:

- users cannot yet clearly perceive three distinct memory layers
- memory is still more of a runtime primitive than a core product surface
- long-term preferences and project knowledge are not yet first-class managed artifacts
- there is no idle-time reflective loop that turns experience into stronger behavior

Phase 16 should bridge that gap.

## Product Goal

Make the system behave like a long-running agent with durable memory and controlled reflection:

1. it remembers the user
2. it remembers the project
3. it remembers the task
4. it can refine those memories over time
5. it can think during idle periods without taking unsafe external actions

## Scope

### In Scope

- three memory layers:
  - `personal`
  - `project`
  - `task`
- memory states:
  - `raw`
  - `curated`
  - `compressed`
- memory operations:
  - `record`
  - `retrieve`
  - `sync`
  - `update`
  - `compress`
  - `forget`
  - `promote`
  - `demote`
  - `reflect`
  - `evolve`
- default full-auto automation mode with configurable safety levels
- markdown-first memory storage with machine-readable indexes
- `Dream` runtime for idle-time reflection and self-improvement
- product surface for memory inspection

### Out Of Scope

- autonomous code changes triggered by Dream
- autonomous external task execution during idle periods
- autonomous outbound messaging
- autonomous PR creation
- unrestricted sensitive-memory mutation
- generalized cloud memory synchronization service

## Design Principles

1. Memory must be layered by timescale and trust level.
2. Raw memory should be easy to write; compressed memory should be expensive and deliberate.
3. The default experience should be highly agentic, but configurable for stricter environments.
4. Personal memory should be safer than task memory by default, even in full-auto mode.
5. Dream should improve the system through reflection, not through hidden external actions.
6. Memory should remain human-readable and inspectable.
7. Productized memory should amplify runtime quality, not flood prompts.

## Primary Architecture

Phase 16 introduces four connected layers:

### 1. Memory Layers

- `personal`
- `project`
- `task`

### 2. Memory States

- `raw`
- `curated`
- `compressed`

### 3. Memory Ops

- `record`
- `curate`
- `compress`
- `retrieve`
- `promote`
- `demote`
- `forget`
- `sync`
- `reflect`
- `evolve`

### 4. Dream Runtime

An idle-time runtime that:

- reads memory layers
- detects patterns
- compresses and reorganizes memory
- extracts skills and procedures
- proposes hypotheses and recommendations
- never performs unsafe external actions by default

## Memory Layers

### Personal Memory

Purpose:
- capture durable user preferences and working style

Examples:
- response style
- tool preference
- risk preference
- preferred communication patterns
- stable domain habits

Should not directly store:
- credentials
- transient emotions
- speculative personality assumptions

### Project Memory

Purpose:
- capture long-lived project facts and decisions

Examples:
- architecture decisions
- codebase conventions
- release lessons
- recurring failure patterns
- environment assumptions
- known pitfalls and repair paths

This is the highest-value layer for the current project.

### Task Memory

Purpose:
- capture execution-local context and reusable outcomes

Examples:
- node outputs
- tool summaries
- verifier findings
- resume checkpoints
- join summaries
- artifact summaries

This is the most naturally full-auto layer.

## Memory States

### Raw

Characteristics:
- append-friendly
- automatically written
- high volume
- low trust

Used for:
- immediate capture
- recovery
- later curation

### Curated

Characteristics:
- filtered and normalized
- medium trust
- reusable
- suitable for selective retrieval

Used for:
- project knowledge
- stable user preferences
- reusable task conclusions

### Compressed

Characteristics:
- dense summaries
- high-value prompt injection candidates
- low redundancy
- long-lived

Used for:
- frozen memory injection
- low-token durable context
- fast startup context

## Promotion Rules

### Raw -> Curated

Promote when:
- repeated or corroborated
- produced during successful execution
- useful beyond one tool call
- passes safety filters
- worth reusing

### Curated -> Compressed

Promote when:
- entries are stable
- redundancy is high
- token efficiency matters
- content is broadly useful

### Curated -> Demoted / Forgotten

Demote when:
- superseded by new facts
- no longer applicable
- contradicted by verified evidence

## Storage Model

Phase 16 should use repo-visible and user-private storage together.

### Repo-Visible Project / Task Memory

```text
memory/
  project/
    raw/
    curated/
    compressed/
  task/
    <taskId>/
      raw/
      curated/
      compressed/
  dream/
    reflections/
    hypotheses/
    skills/
    recommendations/
  index/
    project-index.json
    task-index.json
    dream-index.json
```

### User-Private Personal Memory

```text
~/.agentic-ai/memory/
  personal/
    raw/
    curated/
    compressed/
```

Rationale:
- personal memory should avoid accidental git inclusion
- project/task memory should remain inspectable and team-visible
- dream outputs should be explicit and auditable

## File Format

Use markdown with frontmatter as the primary format, plus JSON indexes.

Example:

```md
---
id: proj-arch-0001
layer: project
state: curated
kind: architecture_decision
confidence: high
source_refs:
  - docs/superpowers/specs/2026-04-09-phase15-qa-verifier-harness-design.md
updated_at: 2026-04-09T12:00:00Z
tags:
  - runtime
  - verifier
---

# QA / Verifier Harness is now mandatory

Phase 15 introduced acceptance-proof-gated handoff...
```

Indexes should support fast lookup without replacing markdown readability.

## Configuration Model

Phase 16 should add a dedicated memory and dream configuration surface.

Example:

```yaml
memory:
  enabled: true
  automation: full_auto

  personal:
    enabled: true
    storage: user_home
    auto_record: true
    auto_curate: true
    auto_compress: true
    sensitivity_filter: strict

  project:
    enabled: true
    storage: repo
    auto_record: true
    auto_curate: true
    auto_compress: true
    sync_to_repo: true

  task:
    enabled: true
    storage: repo
    auto_record: true
    auto_curate: true
    auto_compress: true
    retain_days: 30

  retrieval:
    inject_personal_compressed: true
    inject_project_compressed: true
    inject_task_curated: true
    max_items_per_layer: 5

dream:
  enabled: true
  mode: background
  idle_threshold_minutes: 20
  auto_reflect: true
  auto_compress_memory: true
  auto_generate_skills: true
  auto_reorder_backlog: true
  auto_generate_hypotheses: true

  allow_external_actions: false
  allow_code_changes: false
  allow_network_execution: false
  allow_message_sending: false
```

Default mode should be highly autonomous, but these controls must allow safer deployments.

## Automation Policy

The user explicitly wants a default full-auto experience.

Recommended defaults:

- `task.raw`: auto
- `task.curated`: auto
- `task.compressed`: auto
- `project.raw`: auto
- `project.curated`: auto
- `project.compressed`: auto, but more conservative
- `personal.raw`: auto
- `personal.curated`: auto, but with stronger sensitivity filters
- `personal.compressed`: auto, but with high confidence threshold

## Retrieval And Injection Strategy

Do not inject all memory into the prompt.

Recommended injection policy:

- `personal/compressed`
  - frequent injection
  - stable user preference and style context
- `project/compressed`
  - frequent injection
  - project conventions and architecture facts
- `task/curated`
  - task-relevant injection
  - execution-local continuity
- `task/raw`
  - not injected by default
  - used for restore and retrieval
- `dream/*`
  - not injected into ordinary execution prompts by default
  - only used for planner, verifier, reflection, or recommendation flows

This preserves context quality while still making memory useful.

## Dream Runtime

### Purpose

Use idle time to improve the agent without hidden external side effects.

### Allowed By Default

- memory compression
- experience distillation
- skill and workflow extraction
- backlog reprioritization suggestions
- research summary generation
- hypothesis generation
- deep reflection notes

### Forbidden By Default

- code changes
- external task execution
- sending messages
- creating PRs
- mutating sensitive memory without passing filters

### Dream Outputs

Dream should produce four main artifact types:

- `memory/dream/reflections/`
- `memory/dream/hypotheses/`
- `memory/dream/skills/`
- `memory/dream/recommendations/`

Dream is not “background execution.” It is “background thinking.”

## Memory Operations

### Record

Write new raw memory entries from:
- runtime events
- accepted deliveries
- verifier findings
- task summaries
- explicit user preferences

### Curate

Promote raw entries into reusable knowledge when rules and signals justify it.

### Compress

Create low-token summaries from curated memory.

### Retrieve

Query by:
- layer
- state
- tags
- source refs
- semantic relevance

### Sync

Synchronize:
- repo-level memory indexes
- personal local memory
- task memory and summaries

### Forget

Support:
- soft archival
- confidence demotion
- superseded-memory removal

### Reflect

Dream analyzes:
- repeated failures
- repeated successes
- overlong workflows
- verification patterns
- recurring recovery situations

### Evolve

Turn reflections into:
- reusable skills
- policy recommendations
- workflow suggestions
- memory reshaping

## Product Surface

Phase 16 should extend the inspector with:

- memory layer summaries
- last promoted memories
- compression status
- dream status
- dream outputs preview
- memory confidence / freshness

Potential new views:
- `Personal Memory`
- `Project Memory`
- `Task Memory`
- `Dream Console`

The user should be able to see:
- what the agent remembers
- why it remembers it
- how trustworthy it is
- when it was last updated

## Safety Model

### Sensitive Personal Memory

Must be filtered before durable storage.

At minimum:
- redact credential-like content
- block prompt-injection attempts
- block hidden Unicode tricks
- avoid storing unstable personality inference

### Project Safety

Project memory can be more permissive, but:
- still needs poisoning protection
- still must allow demotion and correction

### Dream Safety

Dream must never silently act outside the memory boundary unless the user explicitly enables it.

## Testing Strategy

Phase 16 should be proof-driven.

Must cover:

### Memory Engine Proofs

- raw -> curated promotion
- curated -> compressed promotion
- personal/project/task separation
- retrieval by layer/state
- sync behavior

### Dream Proofs

- idle reflection produces reflection artifacts
- repeated failures produce recommendations
- repeated successful procedures produce skill drafts
- forbidden actions are not executed in default mode

### Product Proofs

- inspector shows memory layer state
- inspector shows dream outputs preview
- user-facing explanation for memory freshness and compression

## Recommended Implementation Order

1. shared memory contracts and directory model
2. personal / project / task memory engine
3. retrieval + injection + compression pipeline
4. dream runtime
5. product surface + verification + docs

## Risks

- memory becomes noisy instead of useful
- personal memory stores unstable or sensitive content
- compression loses too much precision
- dream becomes “fake autonomy” instead of genuine reflection value
- prompt injection or poisoned memory degrades the agent over time

## Success Criteria

Phase 16 is successful when:

- the system has first-class personal, project, and task memory
- memory is product-visible, not hidden substrate only
- memory can be recorded, retrieved, synchronized, updated, compressed, and forgotten
- the default mode is highly autonomous but still bounded by configuration
- dream can improve the system during idle time without unsafe external actions
- the runtime demonstrably gets more contextually capable over time
