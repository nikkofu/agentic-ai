import { describe, expect, it, vi } from "vitest";

import { createTaskExecutor } from "../../src/runtime/executor";
import { createTaskMemoryStore } from "../../src/runtime/memory";

describe("runtime executor", () => {
  it("executes a single-node task through injected runtime services", async () => {
    const eventBus = {
      publish: vi.fn(),
      subscribe: vi.fn()
    };
    const eventLogStore = {
      append: vi.fn(),
      getAll: vi.fn().mockReturnValue([
        {
          type: "Evaluated",
          payload: {
            decision: "stop",
            output_text: "ok",
            delivery: {
              status: "completed",
              final_result: "ok",
              artifacts: [],
              verification: ["source-a"],
              risks: [],
              next_actions: []
            }
          }
        }
      ])
    };
    const runtime = {
      run: vi.fn().mockResolvedValue({
        outputText: JSON.stringify({
          task_kind: "general",
          execution_mode: "single_node",
          roles: ["planner"],
          needs_verification: false,
          reason: "single step"
        })
      })
    };
    const orchestrator = {
      runSingleNodeContext: vi.fn().mockResolvedValue({
        finalState: "completed",
        stateTrace: ["pending", "running", "evaluating", "completed"],
        delivery: {
          status: "completed",
          final_result: "ok",
          artifacts: [],
          verification: ["source-a"],
          risks: [],
          next_actions: []
        }
      })
    };

    const executor = createTaskExecutor({
      config: {
        models: {
          default: "test-model",
          fallback: [],
          by_agent_role: {
            planner: "test-model",
            researcher: "test-model",
            coder: "test-model",
            writer: "test-model"
          },
          embeddings: { default: "embed-model" }
        },
        reasoner: {
          default: "medium",
          by_agent_role: {
            planner: "medium",
            researcher: "medium",
            coder: "medium",
            writer: "medium"
          }
        },
        scheduler: { default_policy: "bfs", policy_overrides: {} },
        guardrails: { max_depth: 4, max_branch: 3, max_steps: 60, max_budget: 5 },
        evaluator: { weights: { quality: 0.6, cost: 0.2, latency: 0.2 } },
        retry: { max_retries: 3, base_delay_ms: 1000 },
        mcp_servers: {}
      } as any,
      runtime: runtime as any,
      eventBus: eventBus as any,
      eventLogStore: eventLogStore as any,
      orchestrator: orchestrator as any,
      finalizeDelivery: vi.fn().mockImplementation(async ({ delivery }) => delivery),
      resolveModelRoute: vi.fn().mockReturnValue({
        model: "test-model",
        reasoner: "medium",
        apiKey: "test-key"
      }),
      taskIdFactory: () => "task-executor-1"
    });

    const result = await executor.execute({
      input: "build a plan"
    });

    expect(orchestrator.runSingleNodeContext).toHaveBeenCalledTimes(1);
    expect(orchestrator.runSingleNodeContext.mock.calls[0][0].context.node.role).toBe("planner");
    expect(result.taskId).toBe("task-executor-1");
    expect(result.finalState).toBe("completed");
    expect(result.delivery.final_result).toBe("ok");
  });

  it("enriches execution context with retrieval and memory provider outputs before orchestration", async () => {
    const eventBus = {
      publish: vi.fn(),
      subscribe: vi.fn()
    };
    const eventLogStore = {
      append: vi.fn(),
      getAll: vi.fn().mockReturnValue([
        {
          type: "Evaluated",
          payload: {
            decision: "stop",
            output_text: "ok",
            delivery: {
              status: "completed",
              final_result: "ok",
              artifacts: [],
              verification: ["source-a"],
              risks: [],
              next_actions: []
            }
          }
        }
      ])
    };
    const runtime = {
      run: vi.fn().mockResolvedValue({
        outputText: JSON.stringify({
          task_kind: "general",
          execution_mode: "single_node",
          roles: ["planner"],
          needs_verification: false,
          reason: "single step"
        })
      })
    };
    const orchestrator = {
      runSingleNodeContext: vi.fn().mockResolvedValue({
        finalState: "completed",
        stateTrace: ["pending", "running", "evaluating", "completed"],
        delivery: {
          status: "completed",
          final_result: "ok",
          artifacts: [],
          verification: ["source-a"],
          risks: [],
          next_actions: []
        }
      })
    };
    const retrievalProvider = {
      retrieve: vi.fn().mockResolvedValue([
        {
          sourceId: "rag://openclaw/readme",
          content: "OpenClaw project summary",
          relevance: 0.9
        }
      ])
    };
    const memoryStore = {
      loadWorkingMemory: vi.fn().mockResolvedValue(["prefer concise structure"]),
      loadMemoryRefs: vi.fn().mockResolvedValue(["mem://task/task-executor-2"])
    };

    const executor = createTaskExecutor({
      config: {
        models: {
          default: "test-model",
          fallback: [],
          by_agent_role: {
            planner: "test-model",
            researcher: "test-model",
            coder: "test-model",
            writer: "test-model"
          },
          embeddings: { default: "embed-model" }
        },
        reasoner: {
          default: "medium",
          by_agent_role: {
            planner: "medium",
            researcher: "medium",
            coder: "medium",
            writer: "medium"
          }
        },
        scheduler: { default_policy: "bfs", policy_overrides: {} },
        guardrails: { max_depth: 4, max_branch: 3, max_steps: 60, max_budget: 5 },
        evaluator: { weights: { quality: 0.6, cost: 0.2, latency: 0.2 } },
        retry: { max_retries: 3, base_delay_ms: 1000 },
        mcp_servers: {}
      } as any,
      runtime: runtime as any,
      eventBus: eventBus as any,
      eventLogStore: eventLogStore as any,
      orchestrator: orchestrator as any,
      finalizeDelivery: vi.fn().mockImplementation(async ({ delivery }) => delivery),
      resolveModelRoute: vi.fn().mockReturnValue({
        model: "test-model",
        reasoner: "medium",
        apiKey: "test-key"
      }),
      taskIdFactory: () => "task-executor-2",
      retrievalProvider: retrievalProvider as any,
      memoryStore: memoryStore as any
    });

    await executor.execute({
      input: "research OpenClaw"
    });

    expect(retrievalProvider.retrieve).toHaveBeenCalledTimes(1);
    expect(memoryStore.loadWorkingMemory).toHaveBeenCalledTimes(1);
    expect(memoryStore.loadMemoryRefs).toHaveBeenCalledTimes(1);
    expect(orchestrator.runSingleNodeContext.mock.calls[0][0].context.workingMemory).toEqual([
      "prefer concise structure"
    ]);
    expect(orchestrator.runSingleNodeContext.mock.calls[0][0].context.retrievalContext[0].sourceId).toBe(
      "rag://openclaw/readme"
    );
    expect(orchestrator.runSingleNodeContext.mock.calls[0][0].context.memoryRefs).toEqual([
      "mem://task/task-executor-2"
    ]);
  });

  it("writes completed node output back into task memory for later retrieval", async () => {
    const eventBus = {
      publish: vi.fn(),
      subscribe: vi.fn()
    };
    const eventLogStore = {
      append: vi.fn(),
      getAll: vi.fn().mockReturnValue([
        {
          type: "Evaluated",
          payload: {
            decision: "stop",
            output_text: "ok",
            delivery: {
              status: "completed",
              final_result: "OpenClaw research summary",
              artifacts: [],
              verification: ["source-a"],
              risks: [],
              next_actions: []
            }
          }
        }
      ])
    };
    const runtime = {
      run: vi.fn().mockResolvedValue({
        outputText: JSON.stringify({
          task_kind: "general",
          execution_mode: "single_node",
          roles: ["planner"],
          needs_verification: false,
          reason: "single step"
        })
      })
    };
    const orchestrator = {
      runSingleNodeContext: vi.fn().mockResolvedValue({
        finalState: "completed",
        stateTrace: ["pending", "running", "evaluating", "completed"],
        delivery: {
          status: "completed",
          final_result: "OpenClaw research summary",
          artifacts: [],
          verification: ["source-a"],
          risks: [],
          next_actions: []
        }
      })
    };
    const memoryStore = createTaskMemoryStore();

    const executor = createTaskExecutor({
      config: {
        models: {
          default: "test-model",
          fallback: [],
          by_agent_role: {
            planner: "test-model",
            researcher: "test-model",
            coder: "test-model",
            writer: "test-model"
          },
          embeddings: { default: "embed-model" }
        },
        reasoner: {
          default: "medium",
          by_agent_role: {
            planner: "medium",
            researcher: "medium",
            coder: "medium",
            writer: "medium"
          }
        },
        scheduler: { default_policy: "bfs", policy_overrides: {} },
        guardrails: { max_depth: 4, max_branch: 3, max_steps: 60, max_budget: 5 },
        evaluator: { weights: { quality: 0.6, cost: 0.2, latency: 0.2 } },
        retry: { max_retries: 3, base_delay_ms: 1000 },
        mcp_servers: {}
      } as any,
      runtime: runtime as any,
      eventBus: eventBus as any,
      eventLogStore: eventLogStore as any,
      orchestrator: orchestrator as any,
      finalizeDelivery: vi.fn().mockImplementation(async ({ delivery }) => delivery),
      resolveModelRoute: vi.fn().mockReturnValue({
        model: "test-model",
        reasoner: "medium",
        apiKey: "test-key"
      }),
      taskIdFactory: () => "task-executor-3",
      memoryStore
    });

    await executor.execute({
      input: "research OpenClaw"
    });

    const entries = await memoryStore.getTaskEntries("task-executor-3");
    expect(entries).toHaveLength(1);
    expect(entries[0].content).toBe("OpenClaw research summary");
    expect(entries[0].sourceId).toBe("mem://task-executor-3/node-root");
  });

  it("writes child node outputs and join summaries into task memory during tree execution", async () => {
    const eventBus = {
      publish: vi.fn(),
      subscribe: vi.fn()
    };
    const eventLogStore = {
      append: vi.fn(),
      getAll: vi.fn().mockReturnValue([
        {
          type: "Evaluated",
          payload: {
            decision: "stop",
            output_text: "writer draft",
            delivery: {
              status: "completed",
              final_result: "writer draft",
              artifacts: [],
              verification: ["source-a"],
              risks: [],
              next_actions: []
            }
          }
        }
      ])
    };
    const runtime = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          outputText: JSON.stringify({
            task_kind: "research_writing",
            execution_mode: "tree",
            roles: ["planner", "researcher", "writer"],
            needs_verification: true,
            reason: "staged work"
          })
        })
        .mockResolvedValueOnce({
          outputText: JSON.stringify({
            summary: "planner summary",
            recommended_tools: ["web_search"],
            required_capabilities: ["research", "writing"],
            verification_policy: "cite urls",
            spawn_children: [
              {
                id: "node-research",
                role: "researcher",
                input: "Research OpenClaw",
                depends_on: ["node-root"]
              },
              {
                id: "node-write",
                role: "writer",
                input: "Write article",
                depends_on: ["node-research"]
              }
            ]
          })
        })
    };
    const orchestrator = {
      runParallelContexts: vi
        .fn()
        .mockResolvedValueOnce({
          completedNodes: 1,
          joinDecision: "deliver",
          nodeResults: [
            {
              nodeId: "node-root",
              finalState: "completed",
              delivery: {
                status: "completed",
                final_result: "planner summary",
                artifacts: [],
                verification: [],
                risks: [],
                next_actions: []
              }
            }
          ]
        })
        .mockResolvedValueOnce({
          completedNodes: 1,
          joinDecision: "deliver",
          nodeResults: [
            {
              nodeId: "node-research",
              finalState: "completed",
              delivery: {
                status: "completed",
                final_result: "OpenClaw research notes",
                artifacts: [],
                verification: ["source-r"],
                risks: [],
                next_actions: []
              }
            }
          ]
        })
        .mockResolvedValueOnce({
          completedNodes: 1,
          joinDecision: "deliver",
          nodeResults: [
            {
              nodeId: "node-write",
              finalState: "completed",
              delivery: {
                status: "completed",
                final_result: "writer draft",
                artifacts: [],
                verification: ["source-w"],
                risks: [],
                next_actions: []
              }
            }
          ]
        })
    };
    const memoryStore = createTaskMemoryStore();

    const executor = createTaskExecutor({
      config: {
        models: {
          default: "test-model",
          fallback: [],
          by_agent_role: {
            planner: "test-model",
            researcher: "test-model",
            coder: "test-model",
            writer: "test-model"
          },
          embeddings: { default: "embed-model" }
        },
        reasoner: {
          default: "medium",
          by_agent_role: {
            planner: "medium",
            researcher: "medium",
            coder: "medium",
            writer: "medium"
          }
        },
        scheduler: { default_policy: "bfs", policy_overrides: {} },
        guardrails: { max_depth: 4, max_branch: 3, max_steps: 60, max_budget: 5 },
        evaluator: { weights: { quality: 0.6, cost: 0.2, latency: 0.2 } },
        retry: { max_retries: 3, base_delay_ms: 1000 },
        mcp_servers: {}
      } as any,
      runtime: runtime as any,
      eventBus: eventBus as any,
      eventLogStore: eventLogStore as any,
      orchestrator: orchestrator as any,
      finalizeDelivery: vi.fn().mockImplementation(async ({ delivery }) => delivery),
      resolveModelRoute: vi.fn().mockReturnValue({
        model: "test-model",
        reasoner: "medium",
        apiKey: "test-key"
      }),
      taskIdFactory: () => "task-executor-4",
      memoryStore
    });

    await executor.execute({
      input: "research OpenClaw and write article"
    });

    const entries = await memoryStore.getTaskEntries("task-executor-4");
    expect(entries.map((entry) => entry.sourceId)).toContain("mem://task-executor-4/node-research");
    expect(entries.map((entry) => entry.sourceId)).toContain("mem://task-executor-4/node-write");
    expect(entries.map((entry) => entry.sourceId)).toContain("mem://task-executor-4/join/tier-1");
  });

  it("aborts tree execution when the orchestrator returns a blocking join decision", async () => {
    const eventBus = {
      publish: vi.fn(),
      subscribe: vi.fn()
    };
    const eventLogStore = {
      append: vi.fn(),
      getAll: vi.fn().mockReturnValue([])
    };
    const runtime = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          outputText: JSON.stringify({
            task_kind: "research_writing",
            execution_mode: "tree",
            roles: ["planner", "researcher", "writer"],
            needs_verification: true,
            reason: "staged work"
          })
        })
        .mockResolvedValueOnce({
          outputText: JSON.stringify({
            summary: "planner summary",
            recommended_tools: ["web_search"],
            required_capabilities: ["research", "writing"],
            verification_policy: "cite urls",
            spawn_children: [
              {
                id: "node-research",
                role: "researcher",
                input: "Research OpenClaw",
                depends_on: ["node-root"]
              }
            ]
          })
        })
    };
    const orchestrator = {
      runParallelContexts: vi.fn().mockResolvedValue({
        completedNodes: 1,
        joinDecision: "block",
        nodeResults: [
          {
            nodeId: "node-root",
            finalState: "aborted",
            delivery: {
              status: "blocked",
              final_result: "",
              artifacts: [],
              verification: [],
              risks: [],
              blocking_reason: "join_blocked",
              next_actions: []
            }
          }
        ]
      })
    };

    const executor = createTaskExecutor({
      config: {
        models: {
          default: "test-model",
          fallback: [],
          by_agent_role: {
            planner: "test-model",
            researcher: "test-model",
            coder: "test-model",
            writer: "test-model"
          },
          embeddings: { default: "embed-model" }
        },
        reasoner: {
          default: "medium",
          by_agent_role: {
            planner: "medium",
            researcher: "medium",
            coder: "medium",
            writer: "medium"
          }
        },
        scheduler: { default_policy: "bfs", policy_overrides: {} },
        guardrails: { max_depth: 4, max_branch: 3, max_steps: 60, max_budget: 5 },
        evaluator: { weights: { quality: 0.6, cost: 0.2, latency: 0.2 } },
        retry: { max_retries: 3, base_delay_ms: 1000 },
        mcp_servers: {}
      } as any,
      runtime: runtime as any,
      eventBus: eventBus as any,
      eventLogStore: eventLogStore as any,
      orchestrator: orchestrator as any,
      finalizeDelivery: vi.fn().mockImplementation(async ({ delivery }) => delivery),
      resolveModelRoute: vi.fn().mockReturnValue({
        model: "test-model",
        reasoner: "medium",
        apiKey: "test-key"
      }),
      taskIdFactory: () => "task-executor-block-1"
    });

    const result = await executor.execute({
      input: "research OpenClaw and write article"
    });

    expect(result.finalState).toBe("aborted");
  });

  it("publishes task memory persistence events for replayable resume", async () => {
    const eventBus = {
      publish: vi.fn(),
      subscribe: vi.fn()
    };
    const eventLogStore = {
      append: vi.fn(),
      getAll: vi.fn().mockReturnValue([
        {
          type: "Evaluated",
          payload: {
            decision: "stop",
            output_text: "ok",
            delivery: {
              status: "completed",
              final_result: "Persist me",
              artifacts: [],
              verification: ["source-a"],
              risks: [],
              next_actions: []
            }
          }
        }
      ])
    };
    const runtime = {
      run: vi.fn().mockResolvedValue({
        outputText: JSON.stringify({
          task_kind: "general",
          execution_mode: "single_node",
          roles: ["planner"],
          needs_verification: false,
          reason: "single step"
        })
      })
    };
    const orchestrator = {
      runSingleNodeContext: vi.fn().mockResolvedValue({
        finalState: "completed",
        stateTrace: ["pending", "running", "evaluating", "completed"],
        delivery: {
          status: "completed",
          final_result: "Persist me",
          artifacts: [],
          verification: ["source-a"],
          risks: [],
          next_actions: []
        }
      })
    };
    const memoryStore = createTaskMemoryStore();

    const executor = createTaskExecutor({
      config: {
        models: {
          default: "test-model",
          fallback: [],
          by_agent_role: {
            planner: "test-model",
            researcher: "test-model",
            coder: "test-model",
            writer: "test-model"
          },
          embeddings: { default: "embed-model" }
        },
        reasoner: {
          default: "medium",
          by_agent_role: {
            planner: "medium",
            researcher: "medium",
            coder: "medium",
            writer: "medium"
          }
        },
        scheduler: { default_policy: "bfs", policy_overrides: {} },
        guardrails: { max_depth: 4, max_branch: 3, max_steps: 60, max_budget: 5 },
        evaluator: { weights: { quality: 0.6, cost: 0.2, latency: 0.2 } },
        retry: { max_retries: 3, base_delay_ms: 1000 },
        mcp_servers: {}
      } as any,
      runtime: runtime as any,
      eventBus: eventBus as any,
      eventLogStore: eventLogStore as any,
      orchestrator: orchestrator as any,
      finalizeDelivery: vi.fn().mockImplementation(async ({ delivery }) => delivery),
      resolveModelRoute: vi.fn().mockReturnValue({
        model: "test-model",
        reasoner: "medium",
        apiKey: "test-key"
      }),
      taskIdFactory: () => "task-executor-5",
      memoryStore
    });

    await executor.execute({
      input: "persist memory"
    });

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "TaskMemoryStored",
        payload: expect.objectContaining({
          task_id: "task-executor-5",
          source_id: "mem://task-executor-5/node-root",
          content: "Persist me"
        })
      })
    );
  });

  it("resumes a task through the executor and returns finalized delivery", async () => {
    const eventBus = {
      publish: vi.fn(),
      subscribe: vi.fn()
    };
    const persistedEvents = [
      {
        type: "ExecutionContextPrepared",
        payload: {
          task_id: "task-resume-1",
          node_id: "node-root",
          context: {
            task: "Resume this research task"
          }
        }
      },
      {
        type: "Evaluated",
        payload: {
          task_id: "task-resume-1",
          node_id: "node-root",
          decision: "stop",
          delivery: {
            status: "completed",
            final_result: "resumed output",
            artifacts: [],
            verification: ["source-a"],
            risks: [],
            next_actions: []
          }
        }
      }
    ];
    const taskStore = {
      getEvents: vi
        .fn()
        .mockResolvedValueOnce(persistedEvents)
        .mockResolvedValueOnce(persistedEvents)
    };
    const orchestrator = {
      resumeTask: vi.fn().mockResolvedValue({
        completedNodes: 1,
        status: "completed"
      })
    };

    const executor = createTaskExecutor({
      config: {
        models: {
          default: "test-model",
          fallback: [],
          by_agent_role: {
            planner: "test-model",
            researcher: "test-model",
            coder: "test-model",
            writer: "test-model"
          },
          embeddings: { default: "embed-model" }
        },
        reasoner: {
          default: "medium",
          by_agent_role: {
            planner: "medium",
            researcher: "medium",
            coder: "medium",
            writer: "medium"
          }
        },
        scheduler: { default_policy: "bfs", policy_overrides: {} },
        guardrails: { max_depth: 4, max_branch: 3, max_steps: 60, max_budget: 5 },
        evaluator: { weights: { quality: 0.6, cost: 0.2, latency: 0.2 } },
        retry: { max_retries: 3, base_delay_ms: 1000 },
        mcp_servers: {}
      } as any,
      eventBus: eventBus as any,
      eventLogStore: { getAll: vi.fn().mockReturnValue([]) } as any,
      orchestrator: orchestrator as any,
      taskStore: taskStore as any,
      finalizeDelivery: vi.fn().mockImplementation(async ({ delivery }) => delivery),
      resolveModelRoute: vi.fn().mockReturnValue({
        model: "test-model",
        reasoner: "medium",
        apiKey: "test-key"
      })
    });

    const result = await executor.resume({
      taskId: "task-resume-1"
    });

    expect(orchestrator.resumeTask).toHaveBeenCalledWith("task-resume-1", 2);
    expect(result.finalState).toBe("completed");
    expect(result.delivery.final_result).toBe("resumed output");
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "TaskClosed",
        payload: expect.objectContaining({
          task_id: "task-resume-1",
          resumed: true
        })
      })
    );
  });
});
