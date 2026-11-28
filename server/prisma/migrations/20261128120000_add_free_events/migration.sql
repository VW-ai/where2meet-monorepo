-- CreateTable
CREATE TABLE "free_event" (
    "id" UUID NOT NULL,
    "source" VARCHAR(32) NOT NULL,
    "source_id" VARCHAR(128) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "venue_name" VARCHAR(255),
    "place_id" VARCHAR(255),
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "kind" VARCHAR(20) NOT NULL,
    "url" VARCHAR(1024) NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'live',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "free_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "free_event_kind_starts_at_idx" ON "free_event"("kind", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "free_event_source_source_id_key" ON "free_event"("source", "source_id");


-- The API and the ingest job share these spellings, so the database refuses any other.
ALTER TABLE "free_event" ADD CONSTRAINT "free_event_kind_check" CHECK ("kind" IN ('free-food', 'hackathon', 'free-talk'));
ALTER TABLE "free_event" ADD CONSTRAINT "free_event_status_check" CHECK ("status" IN ('live', 'hidden'));
