-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TaskNode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "node_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "parent_node_id" TEXT,
    "role" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "attempt" INTEGER NOT NULL,
    "input_summary" TEXT NOT NULL,
    "output_summary" TEXT
);
INSERT INTO "new_TaskNode" ("attempt", "depth", "id", "input_summary", "node_id", "output_summary", "parent_node_id", "role", "state", "task_id") SELECT "attempt", "depth", "id", "input_summary", "node_id", "output_summary", "parent_node_id", "role", "state", "task_id" FROM "TaskNode";
DROP TABLE "TaskNode";
ALTER TABLE "new_TaskNode" RENAME TO "TaskNode";
CREATE UNIQUE INDEX "TaskNode_task_id_node_id_key" ON "TaskNode"("task_id", "node_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
