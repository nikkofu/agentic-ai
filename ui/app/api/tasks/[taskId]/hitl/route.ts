import { NextResponse } from "next/server";

import { createRuntimeServices } from "../../../../../../src/runtime/runtimeServices";

type Params = {
  params: Promise<{ taskId: string }>;
};

export async function POST(request: Request, context: Params) {
  const { taskId } = await context.params;
  const body = await request.json() as { nodeId?: string; action?: "approve" | "reject" | "clarify"; feedback?: string };

  if (!body.nodeId || !body.feedback) {
    return NextResponse.json({ error: "nodeId_and_feedback_required" }, { status: 400 });
  }

  const services = await createRuntimeServices();

  try {
    const result = await services.taskLifecycle.resolveHumanAction({
      taskId,
      nodeId: body.nodeId,
      action: body.action,
      feedback: body.feedback
    });
    return NextResponse.json(result);
  } finally {
    await services.close();
  }
}
