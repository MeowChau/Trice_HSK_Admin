import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudentCode1789666720236 implements MigrationInterface {
  name = 'AddStudentCode1789666720236';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "studentCode" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "studentCode"`);
  }
}
