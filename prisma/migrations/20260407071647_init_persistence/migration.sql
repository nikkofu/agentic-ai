-- CreateTable
CREATE TABLE "TaskGraph" (
    "task_id" TEXT NOT NULL PRIMARY KEY,
    "root_node_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TaskNode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "node_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "parent_node_id" TEXT,
    "role" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "attempt" INTEGER NOT NULL,
    "input_summary" TEXT NOT NULL,
    "output_summary" TEXT,
    CONSTRAINT "TaskNode_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "TaskGraph" ("task_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuntimeEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "task_id" TEXT NOT NULL,
    "node_id" TEXT,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "ts" BIGINT NOT NULL,
    CONSTRAINT "RuntimeEvent_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "TaskGraph" ("task_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskNode_task_id_node_id_key" ON "TaskNode"("task_id", "node_id");

-- CreateIndex
CREATE INDEX "RuntimeEvent_task_id_idx" ON "RuntimeEvent"("task_id");
