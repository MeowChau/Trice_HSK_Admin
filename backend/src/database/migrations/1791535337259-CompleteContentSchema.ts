import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm';

export class CompleteContentSchema1791535337259 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'vocabulary',
      new TableColumn({
        name: 'topic',
        type: 'character varying',
        isNullable: true,
      }),
    );
    await queryRunner.addColumn(
      'practice_set',
      new TableColumn({
        name: 'audioUrl',
        type: 'character varying',
        isNullable: true,
      }),
    );
    await queryRunner.addColumn(
      'exam_section',
      new TableColumn({
        name: 'audioUrl',
        type: 'character varying',
        isNullable: true,
      }),
    );
    await queryRunner.createTable(
      new Table({
        name: 'audit_log',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'userId', type: 'integer', isNullable: true },
          { name: 'userName', type: 'character varying', isNullable: true },
          { name: 'userEmail', type: 'character varying', isNullable: true },
          { name: 'userRole', type: 'character varying', isNullable: true },
          { name: 'action', type: 'character varying' },
          { name: 'entityType', type: 'character varying' },
          { name: 'entityId', type: 'character varying' },
          { name: 'summary', type: 'text' },
          { name: 'oldData', type: 'jsonb', isNullable: true },
          { name: 'newData', type: 'jsonb', isNullable: true },
          { name: 'changedFields', type: 'jsonb', isNullable: true },
          { name: 'ipAddress', type: 'character varying', isNullable: true },
          { name: 'userAgent', type: 'text', isNullable: true },
          {
            name: 'createdAt',
            type: 'timestamp with time zone',
            default: 'now()',
          },
        ],
        indices: ['userId', 'action', 'entityType', 'createdAt'].map(
          (column) => ({ columnNames: [column] }),
        ),
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('audit_log');
    await queryRunner.dropColumn('exam_section', 'audioUrl');
    await queryRunner.dropColumn('practice_set', 'audioUrl');
    await queryRunner.dropColumn('vocabulary', 'topic');
  }
}
