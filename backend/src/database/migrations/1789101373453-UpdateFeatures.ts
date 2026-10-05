import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateFeatures1789101373453 implements MigrationInterface {
  name = 'UpdateFeatures1789101373453';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "exam_section" ("id" SERIAL NOT NULL, "examId" integer NOT NULL, "title" character varying NOT NULL, "order" integer NOT NULL, CONSTRAINT "PK_de061ef85e1dac90d5620f33634" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "exam_section_question" ("sectionId" integer NOT NULL, "questionId" integer NOT NULL, "order" integer NOT NULL, CONSTRAINT "PK_cd415585cc30de3d44e3ce3d2ec" PRIMARY KEY ("sectionId", "questionId"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."question_skill_enum" AS ENUM('LISTENING', 'READING', 'WRITING', 'SPEAKING')`,
    );
    await queryRunner.query(
      `CREATE TABLE "practice_set" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "topic" character varying NOT NULL, "skill" "public"."question_skill_enum" NOT NULL, "hskLevel" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_496e2968c345b177d564726a0c9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "practice_set_question" ("practiceSetId" integer NOT NULL, "questionId" integer NOT NULL, "order" integer NOT NULL, CONSTRAINT "PK_8530278d9fc6a2b6ccd4944bfa7" PRIMARY KEY ("practiceSetId", "questionId"))`,
    );
    await queryRunner.query(`ALTER TABLE "user" ADD "currentHskLevel" integer`);
    await queryRunner.query(`ALTER TABLE "user" ADD "targetHskLevel" integer`);
    await queryRunner.query(`ALTER TABLE "user" ADD "dailyStudyTime" integer`);
    await queryRunner.query(
      `ALTER TYPE "public"."question_type_enum" RENAME TO "question_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."question_type_enum" AS ENUM('MULTIPLE_CHOICE', 'TRUE_FALSE', 'MATCHING', 'FILL_IN_BLANK', 'SHORT_ANSWER', 'ESSAY')`,
    );
    await queryRunner.query(
      `ALTER TABLE "question" ALTER COLUMN "type" TYPE "public"."question_type_enum" USING "type"::"text"::"public"."question_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."question_type_enum_old"`);
    await queryRunner.query(`ALTER TABLE "question" DROP COLUMN "skill"`);

    await queryRunner.query(
      `ALTER TABLE "question" ADD "skill" "public"."question_skill_enum" NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "exam_section" ADD CONSTRAINT "FK_020b698fc35424607f878ca3caa" FOREIGN KEY ("examId") REFERENCES "exam"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "exam_section_question" ADD CONSTRAINT "FK_9c410e28aaff4b27dd7101c901a" FOREIGN KEY ("sectionId") REFERENCES "exam_section"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "exam_section_question" ADD CONSTRAINT "FK_1d56d9e32a8b96a22dffb542ca5" FOREIGN KEY ("questionId") REFERENCES "question"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "practice_set_question" ADD CONSTRAINT "FK_8333768271e71a800ae8b33aec0" FOREIGN KEY ("practiceSetId") REFERENCES "practice_set"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "practice_set_question" ADD CONSTRAINT "FK_5f6cd17bba45726aa1ed96f1469" FOREIGN KEY ("questionId") REFERENCES "question"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "practice_set_question" DROP CONSTRAINT "FK_5f6cd17bba45726aa1ed96f1469"`,
    );
    await queryRunner.query(
      `ALTER TABLE "practice_set_question" DROP CONSTRAINT "FK_8333768271e71a800ae8b33aec0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exam_section_question" DROP CONSTRAINT "FK_1d56d9e32a8b96a22dffb542ca5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exam_section_question" DROP CONSTRAINT "FK_9c410e28aaff4b27dd7101c901a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exam_section" DROP CONSTRAINT "FK_020b698fc35424607f878ca3caa"`,
    );
    await queryRunner.query(`ALTER TABLE "question" DROP COLUMN "skill"`);
    await queryRunner.query(`DROP TYPE "public"."question_skill_enum"`);
    await queryRunner.query(
      `ALTER TABLE "question" ADD "skill" character varying NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."question_type_enum_old" AS ENUM('LISTENING_TF', 'LISTENING_MCQ', 'LISTENING_MATCH', 'READING_TF', 'READING_MCQ', 'READING_FILL')`,
    );
    await queryRunner.query(
      `ALTER TABLE "question" ALTER COLUMN "type" TYPE "public"."question_type_enum_old" USING "type"::"text"::"public"."question_type_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."question_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."question_type_enum_old" RENAME TO "question_type_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "dailyStudyTime"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "targetHskLevel"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "currentHskLevel"`);
    await queryRunner.query(`DROP TABLE "practice_set_question"`);
    await queryRunner.query(`DROP TABLE "practice_set"`);
    await queryRunner.query(`DROP TYPE "public"."question_skill_enum"`);
    await queryRunner.query(`DROP TABLE "exam_section_question"`);
    await queryRunner.query(`DROP TABLE "exam_section"`);
  }
}
