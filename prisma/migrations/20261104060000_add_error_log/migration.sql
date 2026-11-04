-- Three-day log of what went wrong for visitors and staff (src/server/errorLog.ts).
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT '',
    "path" TEXT NOT NULL DEFAULT '',
    "status" INTEGER,
    "message" TEXT NOT NULL DEFAULT '',
    "userEmail" TEXT,
    "details" JSONB,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt");
