import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateGameFields1789112647187 implements MigrationInterface {
  name = 'UpdateGameFields1789112647187';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "question" ADD "isGameQuestion" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "question" DROP COLUMN "isGameQuestion"`,
    );
  }
}
