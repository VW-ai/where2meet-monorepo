-- CreateTable
CREATE TABLE "event" (
    "id" VARCHAR(64) NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "meeting_time" TIMESTAMP(3),
    "organizer_token_hash" VARCHAR(64) NOT NULL,
    "published_venue_id" VARCHAR(255),
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participant" (
    "id" UUID NOT NULL,
    "event_id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "formatted_address" VARCHAR(255),
    "lat" DECIMAL(10,7) NOT NULL,
    "lng" DECIMAL(10,7) NOT NULL,
    "fuzzy_location" BOOLEAN NOT NULL DEFAULT false,
    "color" VARCHAR(20) NOT NULL,
    "token_hash" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue" (
    "id" VARCHAR(255) NOT NULL,
    "event_id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "address" VARCHAR(255),
    "lat" DECIMAL(10,7) NOT NULL,
    "lng" DECIMAL(10,7) NOT NULL,
    "category" VARCHAR(50),
    "rating" DECIMAL(2,1),
    "price_level" SMALLINT,
    "photo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venue_pkey" PRIMARY KEY ("id","event_id")
);

-- CreateTable
CREATE TABLE "vote" (
    "id" UUID NOT NULL,
    "event_id" VARCHAR(64) NOT NULL,
    "participant_id" UUID NOT NULL,
    "venue_id" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_organizer_token_hash_key" ON "event"("organizer_token_hash");

-- CreateIndex
CREATE INDEX "event_created_at_idx" ON "event"("created_at");

-- CreateIndex
CREATE INDEX "participant_event_id_idx" ON "participant"("event_id");

-- CreateIndex
CREATE INDEX "venue_event_id_idx" ON "venue"("event_id");

-- CreateIndex
CREATE INDEX "vote_event_id_idx" ON "vote"("event_id");

-- CreateIndex
CREATE INDEX "vote_participant_id_idx" ON "vote"("participant_id");

-- CreateIndex
CREATE INDEX "vote_venue_id_idx" ON "vote"("venue_id");

-- CreateIndex
CREATE UNIQUE INDEX "vote_event_id_participant_id_venue_id_key" ON "vote"("event_id", "participant_id", "venue_id");

-- AddForeignKey
ALTER TABLE "participant" ADD CONSTRAINT "participant_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue" ADD CONSTRAINT "venue_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote" ADD CONSTRAINT "vote_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote" ADD CONSTRAINT "vote_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote" ADD CONSTRAINT "vote_venue_id_event_id_fkey" FOREIGN KEY ("venue_id", "event_id") REFERENCES "venue"("id", "event_id") ON DELETE CASCADE ON UPDATE CASCADE;
