import { NextResponse } from "next/server";

import { createRuntimeServices } from "../../../../src/runtime/runtimeServices";

export async function POST(request: Request) {
  const body = await request.json();
  const services = await createRuntimeServices();

  try {
    const result = await services.taskLifecycle.startTask({
      input: String(body.input ?? ""),
      workflow: body.workflow
    });
    return NextResponse.json(result);
  } finally {
    await services.close();
  }
}
