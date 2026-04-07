-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RuntimeEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "task_id" TEXT NOT NULL,
    "node_id" TEXT,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "ts" BIGINT NOT NULL
);
INSERT INTO "new_RuntimeEvent" ("id", "node_id", "payload", "task_id", "ts", "type") SELECT "id", "node_id", "payload", "task_id", "ts", "type" FROM "RuntimeEvent";
DROP TABLE "RuntimeEvent";
ALTER TABLE "new_RuntimeEvent" RENAME TO "RuntimeEvent";
CREATE INDEX "RuntimeEvent_task_id_idx" ON "RuntimeEvent"("task_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
