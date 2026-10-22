import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpAwardsAndGameSessions1792195200000 implements MigrationInterface {
  name = 'ExpAwardsAndGameSessions1792195200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "exp_award" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" integer NOT NULL,
        "source" varchar(32) NOT NULL,
        "sourceId" varchar(128) NOT NULL,
        "amount" integer NOT NULL,
        "metadata" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_exp_award" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_exp_award_user_source" UNIQUE ("userId", "source", "sourceId"),
        CONSTRAINT "CHK_exp_award_amount" CHECK ("amount" >= 0),
        CONSTRAINT "FK_exp_award_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "game_session" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userIds" integer[] NOT NULL,
        "hskLevel" integer NOT NULL,
        "state" jsonb NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'waiting',
        "deadline" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "completedAt" timestamptz,
        CONSTRAINT "PK_game_session" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_game_session_status_deadline" ON "game_session" ("status", "deadline")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "game_session"');
    await queryRunner.query('DROP TABLE "exp_award"');
  }
}
