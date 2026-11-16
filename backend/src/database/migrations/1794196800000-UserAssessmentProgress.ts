import { MigrationInterface, QueryRunner } from 'typeorm';
export class UserAssessmentProgress1794196800000 implements MigrationInterface {
  name = 'UserAssessmentProgress1794196800000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(
      'ALTER TABLE "user" ADD COLUMN "assessmentProgress" jsonb NULL',
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE "user" DROP COLUMN "assessmentProgress"');
  }
}
