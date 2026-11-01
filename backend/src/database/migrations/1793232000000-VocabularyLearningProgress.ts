import { MigrationInterface, QueryRunner } from 'typeorm';

export class VocabularyLearningProgress1793232000000 implements MigrationInterface {
  name = 'VocabularyLearningProgress1793232000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "vocabulary_progress" (
        "userId" integer NOT NULL,
        "vocabularyId" integer NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'learning',
        "lastStudiedAt" timestamptz NOT NULL DEFAULT now(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vocabulary_progress" PRIMARY KEY ("userId", "vocabularyId"),
        CONSTRAINT "CHK_vocabulary_progress_status" CHECK ("status" IN ('learning', 'remembered', 'needs_review')),
        CONSTRAINT "FK_vocabulary_progress_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_vocabulary_progress_word" FOREIGN KEY ("vocabularyId") REFERENCES "vocabulary"("id") ON DELETE CASCADE
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "vocabulary_progress"');
  }
}
