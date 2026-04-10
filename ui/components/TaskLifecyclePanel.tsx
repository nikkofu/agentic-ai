"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { MemoryPanel } from "./MemoryPanel";
import { ConversationPanel } from "./ConversationPanel";
import { ConversationListPanel } from "./ConversationListPanel";
import { AssistantProfilePanel } from "./AssistantProfilePanel";
import { ThreadWorkQueuePanel } from "./ThreadWorkQueuePanel";
import { ThreadDetailPanel } from "./ThreadDetailPanel";
import { ThreadFollowUpPanel } from "./ThreadFollowUpPanel";
import { CompanionshipPanel } from "./CompanionshipPanel";

type TaskLifecyclePanelProps = {
  taskId: string | null;
};

type InspectionResult = {
  taskId: string;
  graph: {
    status: string;
    nodes: Record<string, { state: string; role: string }>;
  } | null;
  runtimeInspector: {
    intent: {
      taskKind: string;
      executionMode: string;
      needsVerification: boolean;
    } | null;
    plannerPolicy: {
      recommendedTools: string[];
      requiredCapabilities: string[];
      verificationPolicy: string;
    } | null;
    finalDelivery: {
      family: string;
      status: string;
      finalResult: string;
      blockingReason: string;
      verificationCount: number;
      artifactCount: number;
      sourceCoverage: number;
      verifiedClaimCount: number;
      stepCount: number;
      lastSuccessfulStep: string;
      validationSummary: string;
      recoveryAttempts: number;
      runProofSummary: string;
      acceptanceDecision: string;
      verifierSummary: string;
      findingsCount: number;
      findingsPreview: string[];
      artifacts: Array<{
        path: string;
        exists: boolean;
        nonEmpty: boolean;
      }>;
      verificationPreview: string[];
      referencesPreview: string[];
    } | null;
    memory: {
      personal: { count: number; latest: string[] };
      project: { count: number; latest: string[] };
      task: { count: number; latest: string[] };
    };
    dream: {
      reflectionsCount: number;
      latestReflections: string[];
      recommendationsCount: number;
      latestRecommendations: string[];
    };
    plan: {
      nodeCount: number;
      latestJoinDecision: string;
      activeNodePath: string;
    } | null;
    conversation: {
      assistantId: string;
      threadId: string;
      threadStatus: string;
      channelType: string;
      externalUserId: string;
    } | null;
    explanation: string;
    actionHint: string;
  } | null;
  distributedSummary: {
    queuedNodes: number;
    activeJoinState: string | null;
    settledWorkerNodes: number;
  } | null;
  latestClose: {
    type: string;
    payload: Record<string, unknown>;
  } | null;
  latestAsync: {
    type: string;
    payload: Record<string, unknown>;
  } | null;
  latestAsyncNode: {
    type: string;
    payload: Record<string, unknown>;
  } | null;
  latestHumanAction: {
    type: string;
    payload: Record<string, unknown>;
  } | null;
  eventCount: number;
};

export function TaskLifecyclePanel({ taskId }: TaskLifecyclePanelProps) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [inspection, setInspection] = useState<InspectionResult | null>(null);
  const [conversationList, setConversationList] = useState<{
    assistants: Array<{
      assistantId: string;
      displayName: string;
      personaProfile?: string;
      channelConnectionState?: string;
    }>;
    threads: Array<{
      threadId: string;
      assistantId: string;
      assistantDisplayName?: string;
      status: string;
      activeTaskId?: string;
      latestHumanActionNodeId?: string;
      lastInteractionAt: string;
      latestEventDirection?: string;
      latestEventSummary?: string;
      latestEventAt?: string;
      recentEvents?: Array<{
        direction?: string;
        summary?: string;
        createdAt?: string;
      }>;
    }>;
  } | null>(null);
  const [threadFilter, setThreadFilter] = useState<"all" | "active" | "running" | "blocked" | "awaiting_user_input">("active");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedThread = inspection?.runtimeInspector?.conversation?.threadId
    ? conversationList?.threads.find((thread) => thread.threadId === inspection.runtimeInspector?.conversation?.threadId)
    : null;
  const selectedAssistant = selectedThread
    ? conversationList?.assistants.find((assistant) => assistant.assistantId === selectedThread.assistantId)
    : null;
  const companionshipSummary = inspection?.runtimeInspector?.conversation
    ? `这条会话仍然和 ${inspection.runtimeInspector.conversation.threadId} 保持连续，上一次任务的上下文还在，当前已经沉淀了 ${inspection.runtimeInspector.memory.task.count} 条任务记忆。`
    : "这位助手会在持续的 thread 里保留任务上下文，而不是把每次交流都当成新的开始。";
  const companionshipFollowUp = inspection?.runtimeInspector?.actionHint
    ? inspection.runtimeInspector.actionHint
    : selectedThread?.status === "task_completed"
      ? "适合在用户回到这个 thread 时继续跟进结果和后续动作。"
      : selectedThread?.status === "task_blocked" || selectedThread?.status === "awaiting_user_input"
        ? "这个 thread 仍然适合继续推进，用户回来时可以顺着当前状态接着走。"
        : "当前 thread 还在持续流动，适合保持轻量而稳定的跟进。";
  const companionshipPresence = inspection?.runtimeInspector?.memory
    ? `我会继续记住这个 thread 的节奏、上下文，以及最近的任务状态；当前项目记忆 ${inspection.runtimeInspector.memory.project.count} 条，个人记忆 ${inspection.runtimeInspector.memory.personal.count} 条。`
    : "我会继续保留这条会话的语境，让下一次对话不从空白开始。";

  useEffect(() => {
    startTransition(() => {
      void inspectConversations()
        .then((result) => {
          setConversationList(result);
        })
        .catch((cause) => {
          setError(cause instanceof Error ? cause.message : String(cause));
        });
    });
  }, []);

  useEffect(() => {
    if (!taskId) {
      setInspection(null);
      return;
    }

    startTransition(() => {
      void inspectTask(taskId)
        .then((result) => {
          setInspection(result);
          setError("");
        })
        .catch((cause) => {
          setError(cause instanceof Error ? cause.message : String(cause));
        });
    });
  }, [taskId]);

  return (
    <div className="border-b border-white/10 bg-neutral-950/80 px-4 py-3 text-sm text-white">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Start a new task from dashboard"
          className="min-w-[320px] flex-1 rounded border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-white/30"
        />
        <button
          type="button"
          disabled={isPending || draft.trim().length === 0}
          onClick={() => {
            startTransition(() => {
              void startTask(draft)
                .then((result) => {
                  setDraft("");
                  router.push(`/dashboard?taskId=${result.taskId}&token=valid-session`);
                })
                .catch((cause) => {
                  setError(cause instanceof Error ? cause.message : String(cause));
                });
            });
          }}
          className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
        >
          Start Task
        </button>
        <button
          type="button"
          disabled={!taskId || isPending}
          onClick={() => {
            if (!taskId) return;
            startTransition(() => {
              void inspectTask(taskId)
                .then((result) => {
                  setInspection(result);
                  setError("");
                })
                .catch((cause) => {
                  setError(cause instanceof Error ? cause.message : String(cause));
                });
            });
          }}
          className="rounded border border-white/10 px-3 py-2 font-medium text-white transition hover:bg-white/5 disabled:opacity-50"
        >
          Refresh
        </button>
        <button
          type="button"
          disabled={!taskId || isPending}
          onClick={() => {
            if (!taskId) return;
            startTransition(() => {
              void resumeTask(taskId)
                .then((result) => {
                  router.push(`/dashboard?taskId=${result.taskId}&token=valid-session`);
                })
                .catch((cause) => {
                  setError(cause instanceof Error ? cause.message : String(cause));
                });
            });
          }}
          className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
        >
          Resume
        </button>
        <button
          type="button"
          onClick={() => setThreadFilter((current) => current === "all" ? "active" : "all")}
          className="rounded border border-white/10 px-3 py-2 font-medium text-neutral-200 transition hover:bg-white/5"
        >
          {threadFilter === "all" ? "Active Threads Only" : "Show All Threads"}
        </button>
        <button
          type="button"
          onClick={() => setThreadFilter("running")}
          className="rounded border border-white/10 px-3 py-2 font-medium text-neutral-200 transition hover:bg-white/5"
        >
          Running
        </button>
        <button
          type="button"
          onClick={() => setThreadFilter("blocked")}
          className="rounded border border-white/10 px-3 py-2 font-medium text-neutral-200 transition hover:bg-white/5"
        >
          Blocked
        </button>
        <button
          type="button"
          onClick={() => setThreadFilter("awaiting_user_input")}
          className="rounded border border-white/10 px-3 py-2 font-medium text-neutral-200 transition hover:bg-white/5"
        >
          Awaiting Input
        </button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <InspectorCard title="Intent">
          <InspectorLine label="intent" value={inspection?.runtimeInspector?.intent ? `${inspection.runtimeInspector.intent.taskKind}/${inspection.runtimeInspector.intent.executionMode}` : ""} />
          <InspectorLine label="needs verification" value={inspection?.runtimeInspector?.intent ? String(inspection.runtimeInspector.intent.needsVerification) : ""} />
          <InspectorLine label="tools" value={inspection?.runtimeInspector?.plannerPolicy?.recommendedTools.join(", ") ?? ""} />
          <InspectorLine label="capabilities" value={inspection?.runtimeInspector?.plannerPolicy?.requiredCapabilities.join(", ") ?? ""} />
          <InspectorLine label="verification policy" value={inspection?.runtimeInspector?.plannerPolicy?.verificationPolicy ?? ""} />
        </InspectorCard>

        <InspectorCard title="Plan">
          <InspectorLine label="graph status" value={inspection?.graph?.status ?? ""} />
          <InspectorLine label="events" value={inspection ? String(inspection.eventCount) : ""} />
          <InspectorLine label="nodes" value={inspection?.graph ? String(Object.keys(inspection.graph.nodes).length) : ""} />
          <InspectorLine label="plan nodes" value={inspection?.runtimeInspector?.plan ? String(inspection.runtimeInspector.plan.nodeCount) : ""} />
          <InspectorLine label="active path" value={inspection?.runtimeInspector?.plan?.activeNodePath ?? ""} />
          <InspectorLine label="join decision" value={inspection?.runtimeInspector?.plan?.latestJoinDecision ?? ""} />
        </InspectorCard>

        <InspectorCard title="Delivery">
          <InspectorLine label="family" value={inspection?.runtimeInspector?.finalDelivery?.family ?? ""} />
          <InspectorLine label="status" value={inspection?.runtimeInspector?.finalDelivery?.status ?? ""} />
          <InspectorLine label="artifacts" value={inspection?.runtimeInspector?.finalDelivery ? String(inspection.runtimeInspector.finalDelivery.artifactCount) : ""} />
          <InspectorLine label="verification" value={inspection?.runtimeInspector?.finalDelivery ? String(inspection.runtimeInspector.finalDelivery.verificationCount) : ""} />
          <InspectorLine label="run proof" value={inspection?.runtimeInspector?.finalDelivery?.runProofSummary ?? ""} />
          <InspectorLine label="acceptance" value={inspection?.runtimeInspector?.finalDelivery?.acceptanceDecision ?? ""} />
          <InspectorLine label="verifier" value={inspection?.runtimeInspector?.finalDelivery?.verifierSummary ?? ""} />
          <InspectorLine label="findings" value={inspection?.runtimeInspector?.finalDelivery ? String(inspection.runtimeInspector.finalDelivery.findingsCount) : ""} />
          <InspectorLine label="blocking" value={inspection?.runtimeInspector?.finalDelivery?.blockingReason ?? ""} tone="danger" />
          <InspectorLine label="result" value={inspection?.runtimeInspector?.finalDelivery?.finalResult.slice(0, 80) ?? ""} />
          <InspectorLine
            label="verification preview"
            value={inspection?.runtimeInspector?.finalDelivery?.verificationPreview.join(", ") ?? ""}
          />
          <InspectorLine
            label="findings preview"
            value={inspection?.runtimeInspector?.finalDelivery?.findingsPreview.join(", ") ?? ""}
          />
          <InspectorLine
            label="artifact truth"
            value={
              inspection?.runtimeInspector?.finalDelivery?.artifacts
                .map((artifact) => `${artifact.path}:${artifact.exists ? (artifact.nonEmpty ? "ok" : "empty") : "missing"}`)
                .join(", ") ?? ""
            }
          />
          {inspection?.runtimeInspector?.finalDelivery?.family === "research_writing" ? (
            <>
              <InspectorLine label="source coverage" value={String(inspection.runtimeInspector.finalDelivery.sourceCoverage)} />
              <InspectorLine label="verified claims" value={String(inspection.runtimeInspector.finalDelivery.verifiedClaimCount)} />
              <InspectorLine
                label="references"
                value={inspection.runtimeInspector.finalDelivery.referencesPreview.join(", ")}
              />
            </>
          ) : null}
          {inspection?.runtimeInspector?.finalDelivery?.family === "browser_workflow" ? (
            <>
              <InspectorLine label="steps" value={String(inspection.runtimeInspector.finalDelivery.stepCount)} />
              <InspectorLine label="last successful step" value={inspection.runtimeInspector.finalDelivery.lastSuccessfulStep} />
              <InspectorLine label="validation" value={inspection.runtimeInspector.finalDelivery.validationSummary} />
              <InspectorLine label="recovery attempts" value={String(inspection.runtimeInspector.finalDelivery.recoveryAttempts)} />
            </>
          ) : null}
        </InspectorCard>

        <InspectorCard title="Runtime">
          <InspectorLine label="queued" value={inspection?.distributedSummary ? String(inspection.distributedSummary.queuedNodes) : ""} />
          <InspectorLine label="settled" value={inspection?.distributedSummary ? String(inspection.distributedSummary.settledWorkerNodes) : ""} />
          <InspectorLine label="distributed join" value={inspection?.distributedSummary?.activeJoinState ?? ""} />
          <InspectorLine label="last close" value={inspection?.latestClose ? String(inspection.latestClose.payload.state ?? "unknown") : ""} />
          <InspectorLine label="last async" value={inspection?.latestAsync ? (inspection.latestAsync.type === "AsyncTaskFailed" ? String(inspection.latestAsync.payload.error ?? "failed") : String(inspection.latestAsync.payload.final_state ?? "unknown")) : ""} />
          <InspectorLine label="owner" value={inspection?.latestAsyncNode?.payload.owner_id ? String(inspection.latestAsyncNode.payload.owner_id) : ""} />
          <InspectorLine label="dedupe" value={inspection?.latestAsyncNode?.payload.dedupe_key ? String(inspection.latestAsyncNode.payload.dedupe_key) : ""} />
        </InspectorCard>
      </div>

      <div className="mt-3">
      <AssistantProfilePanel
        assistants={conversationList?.assistants ?? []}
        threadCount={conversationList?.threads.length ?? 0}
        activeThreadCount={(conversationList?.threads ?? []).filter((thread) => Boolean(thread.activeTaskId) || thread.status === "task_running" || thread.status === "awaiting_user_input").length}
      />
      </div>

      <div className="mt-3">
      <ThreadWorkQueuePanel
        threads={conversationList?.threads ?? []}
        onInspectTask={(selectedTaskId) => {
          router.push(`/dashboard?taskId=${selectedTaskId}&token=valid-session`);
        }}
        onResumeTask={(selectedTaskId) => {
          startTransition(() => {
            void resumeTask(selectedTaskId)
              .then((result) => {
                router.push(`/dashboard?taskId=${result.taskId}&token=valid-session`);
              })
              .catch((cause) => {
                setError(cause instanceof Error ? cause.message : String(cause));
              });
          });
        }}
        onResolveHumanAction={(selectedTaskId, nodeId, action) => {
          startTransition(() => {
            void resolveHumanAction(
              selectedTaskId,
              nodeId,
              action,
              action === "approve"
                ? "approved from control center"
                : action === "reject"
                  ? "rejected from control center"
                  : "clarification requested from control center"
            )
              .then((result) => {
                router.push(`/dashboard?taskId=${result.taskId}&token=valid-session`);
              })
              .catch((cause) => {
                setError(cause instanceof Error ? cause.message : String(cause));
              });
          });
        }}
      />
      </div>

      <div className="mt-3">
        <ThreadDetailPanel
          detail={inspection ? {
            taskId: inspection.taskId,
            graphStatus: inspection.graph?.status ?? "",
            channelConnectionState: selectedAssistant?.channelConnectionState,
            latestEventSummary: selectedThread?.latestEventSummary,
            latestEventAt: selectedThread?.latestEventAt,
            verifierSummary: inspection.runtimeInspector?.finalDelivery?.verifierSummary ?? "",
            recentEvents: selectedThread?.recentEvents ?? [],
            conversation: inspection.runtimeInspector?.conversation ?? null,
            latestHumanAction: inspection.latestHumanAction ?? null,
            latestAsyncNode: inspection.latestAsyncNode ?? null
          } : null}
        />
      </div>

      <div className="mt-3">
        <ConversationListPanel
          data={conversationList}
          filter={threadFilter}
          onSelectTask={(selectedTaskId) => {
            router.push(`/dashboard?taskId=${selectedTaskId}&token=valid-session`);
          }}
          onResumeTask={(selectedTaskId) => {
            startTransition(() => {
              void resumeTask(selectedTaskId)
                .then((result) => {
                  router.push(`/dashboard?taskId=${result.taskId}&token=valid-session`);
                })
                .catch((cause) => {
                  setError(cause instanceof Error ? cause.message : String(cause));
                });
            });
          }}
        />
      </div>

      <div className="mt-3">
        <ThreadFollowUpPanel threads={conversationList?.threads ?? []} />
      </div>

      <div className="mt-3">
        <ConversationPanel inspection={inspection?.runtimeInspector?.conversation ?? null} />
      </div>

      <div className="mt-3">
        <CompanionshipPanel
          continuitySummary={companionshipSummary}
          followUpSuggestion={companionshipFollowUp}
          presenceNote={companionshipPresence}
        />
      </div>

      {inspection?.runtimeInspector ? (
        <div className="mt-3">
          <MemoryPanel
            inspection={{
              memory: inspection.runtimeInspector.memory,
              dream: inspection.runtimeInspector.dream
            }}
          />
        </div>
      ) : null}

      <div className="mt-3 flex flex-col gap-2 text-xs">
        {inspection?.runtimeInspector?.explanation ? (
          <div className="rounded border border-white/10 bg-black/40 px-3 py-2 text-neutral-200">
            <span className="font-semibold text-white">Explain:</span> {inspection.runtimeInspector.explanation}
          </div>
        ) : null}
        {inspection?.runtimeInspector?.actionHint ? (
          <div className="rounded border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-100">
            <span className="font-semibold">Next:</span> {inspection.runtimeInspector.actionHint}
          </div>
        ) : null}
        {error ? (
          <div className="rounded border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-rose-200">
            <span className="font-semibold">Error:</span> {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InspectorCard(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-white/10 bg-black/30 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">{props.title}</div>
      <div className="space-y-1">{props.children}</div>
    </div>
  );
}

function InspectorLine(props: { label: string; value: string; tone?: "default" | "danger" }) {
  if (!props.value) {
    return null;
  }

  const valueTone = props.tone === "danger" ? "text-rose-300" : "text-neutral-200";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">{props.label}</span>
      <span className={`font-mono text-[11px] break-all ${valueTone}`}>{props.value}</span>
    </div>
  );
}

async function startTask(input: string) {
  const response = await fetch("/api/tasks", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ input })
  });

  if (!response.ok) {
    throw new Error(`start_task_failed:${response.status}`);
  }

  return response.json() as Promise<{ taskId: string }>;
}

async function inspectTask(taskId: string) {
  const response = await fetch(`/api/tasks/${taskId}`);
  if (!response.ok) {
    throw new Error(`inspect_task_failed:${response.status}`);
  }
  return response.json() as Promise<InspectionResult>;
}

async function inspectConversations() {
  const response = await fetch("/api/conversations");
  if (!response.ok) {
    throw new Error(`inspect_conversations_failed:${response.status}`);
  }
  return response.json() as Promise<{
    assistants: Array<{
      assistantId: string;
      displayName: string;
      personaProfile?: string;
      channelConnectionState?: string;
    }>;
    threads: Array<{
      threadId: string;
      assistantId: string;
      assistantDisplayName?: string;
      status: string;
      activeTaskId?: string;
      latestHumanActionNodeId?: string;
      lastInteractionAt: string;
      latestEventDirection?: string;
      latestEventSummary?: string;
      latestEventAt?: string;
      recentEvents?: Array<{
        direction?: string;
        summary?: string;
        createdAt?: string;
      }>;
    }>;
  }>;
}

async function resumeTask(taskId: string) {
  const response = await fetch(`/api/tasks/${taskId}/resume`, {
    method: "POST"
  });
  if (!response.ok) {
    throw new Error(`resume_task_failed:${response.status}`);
  }
  return response.json() as Promise<{ taskId: string }>;
}

async function resolveHumanAction(taskId: string, nodeId: string, action: "approve" | "reject" | "clarify", feedback: string) {
  const response = await fetch(`/api/tasks/${taskId}/hitl`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ nodeId, action, feedback })
  });
  if (!response.ok) {
    throw new Error(`resolve_human_action_failed:${response.status}`);
  }
  return response.json() as Promise<{ taskId: string; nodeId: string; action: "approve" | "reject" | "clarify"; resolved: boolean }>;
}
