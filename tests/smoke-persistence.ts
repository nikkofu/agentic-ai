import { runTask } from "../src/cli/runTask";
import { PrismaClient } from "@prisma/client";

async function smoke() {
  console.log("🚀 Starting Persistence Smoke Test...");
  
  const result = await runTask({
    input: "smoke test persistence",
    verbose: true,
    generate: async (req) => {
      console.log(`[Mock LLM] Called for model: ${req.model}`);
      return {
        outputText: "Persistence is working!",
        raw: { id: "mock", choices: [], model: req.model }
      };
    }
  });

  console.log("✅ Task Finished with state:", result.finalState);
  console.log("Waiting for DB to settle...");
  await new Promise(resolve => setTimeout(resolve, 2000));

  const prisma = new PrismaClient();
  const graph = await prisma.taskGraph.findUnique({ where: { task_id: result.taskId } });
  const eventCount = await prisma.runtimeEvent.count({ where: { task_id: result.taskId } });
  
  console.log(`📊 Database Check for taskId: ${result.taskId}`);
  console.log(` - TaskGraph Record: ${graph ? "FOUND" : "MISSING"}`);
  console.log(` - RuntimeEvents Saved: ${eventCount}`);

  await prisma.$disconnect();

  if (graph && eventCount > 0) {
    console.log("\n✨ PERSISTENCE SMOKE TEST PASSED!");
    process.exit(0);
  } else {
    console.error("\n❌ PERSISTENCE SMOKE TEST FAILED: Data not found in DB");
    process.exit(1);
  }
}

smoke().catch(err => {
  console.error(err);
  process.exit(1);
});
