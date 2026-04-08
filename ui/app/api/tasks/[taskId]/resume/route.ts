import { NextResponse } from "next/server";

import { createRuntimeServices } from "../../../../../../src/runtime/runtimeServices";

type Params = {
  params: Promise<{ taskId: string }>;
};

export async function POST(_: Request, context: Params) {
  const { taskId } = await context.params;
  const services = await createRuntimeServices();

  try {
    const result = await services.taskLifecycle.resumeTask({ taskId });
    return NextResponse.json(result);
  } finally {
    await services.close();
  }
}
