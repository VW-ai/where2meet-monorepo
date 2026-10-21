-- CreateTable
CREATE TABLE "meeting_visit" (
    "id" UUID NOT NULL,
    "event_id" VARCHAR(64) NOT NULL,
    "participant_id" UUID,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_search" (
    "id" UUID NOT NULL,
    "event_id" VARCHAR(64) NOT NULL,
    "participant_id" UUID,
    "query" VARCHAR(255) NOT NULL,
    "result_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venue_search_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meeting_visit_event_id_idx" ON "meeting_visit"("event_id");

-- CreateIndex
CREATE INDEX "meeting_visit_started_at_idx" ON "meeting_visit"("started_at");

-- CreateIndex
CREATE INDEX "venue_search_event_id_idx" ON "venue_search"("event_id");

-- CreateIndex
CREATE INDEX "venue_search_created_at_idx" ON "venue_search"("created_at");

-- AddForeignKey
ALTER TABLE "meeting_visit" ADD CONSTRAINT "meeting_visit_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_visit" ADD CONSTRAINT "meeting_visit_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_search" ADD CONSTRAINT "venue_search_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_search" ADD CONSTRAINT "venue_search_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The internal usage panel reads these tables through the read-only control_usage role.
-- Only production has that role, so the grant is skipped wherever it does not exist.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'control_usage') THEN
    GRANT SELECT ON "meeting_visit", "venue_search" TO control_usage;
  END IF;
END $$;
