import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserVerificationAndStudentCode1791533519004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "user" ADD "emailVerifiedAt" TIMESTAMP',
    );
    // Fails on duplicate legacy codes rather than renumbering existing students.
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_user_student_code" ON "user" ("studentCode")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "UQ_user_student_code"');
    await queryRunner.query('ALTER TABLE "user" DROP COLUMN "emailVerifiedAt"');
  }
}
