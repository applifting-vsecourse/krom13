-- AlterTable
ALTER TABLE "quack" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "rootId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "quack_parentId_idx" ON "quack"("parentId");

-- CreateIndex
CREATE INDEX "quack_rootId_createdAt_idx" ON "quack"("rootId", "createdAt");

-- AddForeignKey
ALTER TABLE "quack" ADD CONSTRAINT "quack_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "quack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quack" ADD CONSTRAINT "quack_rootId_fkey" FOREIGN KEY ("rootId") REFERENCES "quack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A row is either live (has an author) or hollow (nothing of the quack is left).
-- Added NOT VALID, then validated, so the table is not locked for a full scan.
ALTER TABLE "quack" ADD CONSTRAINT "quack_live_or_hollow" CHECK (
  ("deletedAt" IS NULL AND "userId" IS NOT NULL)
  OR ("deletedAt" IS NOT NULL AND "userId" IS NULL AND "text" = '' AND "mood" IS NULL)
) NOT VALID;
ALTER TABLE "quack" VALIDATE CONSTRAINT "quack_live_or_hollow";

-- A reply has both links, a top-level quack has neither.
ALTER TABLE "quack" ADD CONSTRAINT "quack_reply_links" CHECK (("parentId" IS NULL) = ("rootId" IS NULL)) NOT VALID;
ALTER TABLE "quack" VALIDATE CONSTRAINT "quack_reply_links";
