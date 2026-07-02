-- CreateIndex
CREATE INDEX "rooms_isDefaultTable_status_idx" ON "rooms"("isDefaultTable", "status");

-- CreateIndex
CREATE INDEX "rooms_status_idx" ON "rooms"("status");
