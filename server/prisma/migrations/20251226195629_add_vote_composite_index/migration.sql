-- CreateIndex
CREATE INDEX "vote_event_id_venue_id_idx" ON "vote"("event_id", "venue_id");
