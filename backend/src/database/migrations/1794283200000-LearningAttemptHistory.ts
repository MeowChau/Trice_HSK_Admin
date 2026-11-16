import { MigrationInterface, QueryRunner } from 'typeorm';

export class LearningAttemptHistory1794283200000 implements MigrationInterface {
  name = 'LearningAttemptHistory1794283200000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE "learning_attempt_history" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" integer NOT NULL,
        "clientAttemptId" varchar(100) NOT NULL,
        "kind" varchar(10) NOT NULL,
        "sourceId" integer NOT NULL,
        "title" text NOT NULL,
        "hskLevel" integer NOT NULL,
        "skills" text[] NOT NULL,
        "status" varchar(12) NOT NULL DEFAULT 'draft',
        "requestHash" varchar(64),
        "sourceVersion" varchar(64) NOT NULL,
        "snapshot" jsonb NOT NULL,
        "result" jsonb,
        "summary" jsonb,
        "pendingSpeechRequests" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "durationSeconds" integer,
        "startedAt" timestamptz,
        "submittedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_learning_attempt_history" PRIMARY KEY ("id"),
        CONSTRAINT "FK_learning_attempt_history_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_learning_attempt_history_kind" CHECK ("kind" IN ('exam', 'set')),
        CONSTRAINT "CHK_learning_attempt_history_status" CHECK ("status" IN ('draft', 'submitted')),
        CONSTRAINT "CHK_learning_attempt_history_source" CHECK ("sourceId" > 0 AND "hskLevel" BETWEEN 1 AND 9),
        CONSTRAINT "CHK_learning_attempt_history_duration" CHECK ("durationSeconds" IS NULL OR "durationSeconds" BETWEEN 0 AND 604800),
        CONSTRAINT "CHK_learning_attempt_history_submitted" CHECK ("status" <> 'submitted' OR ("submittedAt" IS NOT NULL AND "result" IS NOT NULL AND "summary" IS NOT NULL AND "requestHash" IS NOT NULL))
      )
    `);
    await runner.query(
      'CREATE UNIQUE INDEX "UQ_learning_attempt_history_user_client" ON "learning_attempt_history" ("userId", "clientAttemptId")',
    );
    await runner.query(
      'CREATE INDEX "IDX_learning_attempt_history_user_submitted" ON "learning_attempt_history" ("userId", "submittedAt", "id")',
    );
    await runner.query(
      'CREATE INDEX "IDX_learning_attempt_history_user_source" ON "learning_attempt_history" ("userId", "kind", "sourceId", "submittedAt")',
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE "learning_attempt_history"');
  }
}
