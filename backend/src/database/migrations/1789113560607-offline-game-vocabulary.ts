import { MigrationInterface, QueryRunner } from 'typeorm';

export class OfflineGameVocabulary1789113560607 implements MigrationInterface {
  name = 'OfflineGameVocabulary1789113560607';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "vocabulary" ("id" SERIAL NOT NULL, "hanzi" character varying NOT NULL, "pinyin" character varying NOT NULL, "meaning" character varying NOT NULL, "hskLevel" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_65dbd74f76cee79778299a2a21b" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "vocabulary"`);
  }
}
