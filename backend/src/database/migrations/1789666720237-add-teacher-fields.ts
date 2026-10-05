import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTeacherFields1789666720237 implements MigrationInterface {
  name = 'AddTeacherFields1789666720237';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "position" character varying, ADD COLUMN IF NOT EXISTS "fullName" character varying;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "position", DROP COLUMN IF EXISTS "fullName";`,
    );
  }
}
