import { MigrationInterface, QueryRunner } from 'typeorm';

export class TriceHskEntities1789094517039 implements MigrationInterface {
  name = 'TriceHskEntities1789094517039';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "study_session_log" ("id" SERIAL NOT NULL, "studyDate" date NOT NULL, "durationInSeconds" integer NOT NULL, "module" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, CONSTRAINT "PK_1c90cb081edb4be51cb737e6329" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "exam" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "description" character varying, "hskLevel" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_56071ab3a94aeac01f1b5ab74aa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "exam_question" ("examId" integer NOT NULL, "questionId" integer NOT NULL, "order" integer NOT NULL, CONSTRAINT "PK_8b3d3cb0e01b8be78cfb513dc27" PRIMARY KEY ("examId", "questionId"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."question_type_enum" AS ENUM('LISTENING_TF', 'LISTENING_MCQ', 'LISTENING_MATCH', 'READING_TF', 'READING_MCQ', 'READING_FILL')`,
    );
    await queryRunner.query(
      `CREATE TABLE "question" ("id" SERIAL NOT NULL, "type" "public"."question_type_enum" NOT NULL, "skill" character varying NOT NULL, "difficulty" integer NOT NULL, "hskLevel" integer NOT NULL, "payload" jsonb NOT NULL, "correctAnswer" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_21e5786aa0ea704ae185a79b2d5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "offline_game_history" ("id" SERIAL NOT NULL, "score" integer NOT NULL, "playedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, CONSTRAINT "PK_c3189e870fe824ef5a7dc57b96a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "username" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "UQ_78a916df40e02a9deb1c4b75edb" UNIQUE ("username")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "level" integer NOT NULL DEFAULT '1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "currentExp" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "avatarFrame" character varying`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_78a916df40e02a9deb1c4b75ed" ON "user" ("username") `,
    );
    await queryRunner.query(
      `ALTER TABLE "study_session_log" ADD CONSTRAINT "FK_4525308fce9bf070caf09519a85" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "exam_question" ADD CONSTRAINT "FK_63d8bcbf00bf0267ba18888c893" FOREIGN KEY ("examId") REFERENCES "exam"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "exam_question" ADD CONSTRAINT "FK_380938c6e5cef64cf3fbb7264cb" FOREIGN KEY ("questionId") REFERENCES "question"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "offline_game_history" ADD CONSTRAINT "FK_646cb5d52e73ab3bdc59aa90c88" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "offline_game_history" DROP CONSTRAINT "FK_646cb5d52e73ab3bdc59aa90c88"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exam_question" DROP CONSTRAINT "FK_380938c6e5cef64cf3fbb7264cb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exam_question" DROP CONSTRAINT "FK_63d8bcbf00bf0267ba18888c893"`,
    );
    await queryRunner.query(
      `ALTER TABLE "study_session_log" DROP CONSTRAINT "FK_4525308fce9bf070caf09519a85"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_78a916df40e02a9deb1c4b75ed"`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "avatarFrame"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "currentExp"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "level"`);
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "UQ_78a916df40e02a9deb1c4b75edb"`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "username"`);
    await queryRunner.query(`DROP TABLE "offline_game_history"`);
    await queryRunner.query(`DROP TABLE "question"`);
    await queryRunner.query(`DROP TYPE "public"."question_type_enum"`);
    await queryRunner.query(`DROP TABLE "exam_question"`);
    await queryRunner.query(`DROP TABLE "exam"`);
    await queryRunner.query(`DROP TABLE "study_session_log"`);
  }
}
