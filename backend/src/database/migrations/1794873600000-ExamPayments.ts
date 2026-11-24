import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExamPayments1794873600000 implements MigrationInterface {
  name = 'ExamPayments1794873600000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE "exam_payment" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "examId" integer REFERENCES "exam"("id") ON DELETE SET NULL,
      "examTitle" text NOT NULL, "hskLevel" integer NOT NULL,
      "orderCode" bigint NOT NULL UNIQUE,
      "amount" integer NOT NULL CHECK ("amount" > 0),
      "currency" varchar(3) NOT NULL DEFAULT 'VND' CHECK ("currency" = 'VND'),
      "status" varchar(12) NOT NULL DEFAULT 'creating' CHECK ("status" IN ('creating','pending','paid','cancelled','expired')),
      "paymentLinkId" varchar(100) UNIQUE, "checkoutUrl" text,
      "expiresAt" timestamptz NOT NULL, "paidAt" timestamptz, "checkedAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
      CHECK ("orderCode" > 0 AND "orderCode" <= 9007199254740991),
      CHECK ("hskLevel" BETWEEN 1 AND 9),
      CHECK ("status" <> 'paid' OR "paidAt" IS NOT NULL)
    )`);
    await runner.query(
      `CREATE UNIQUE INDEX "UQ_exam_payment_open" ON "exam_payment" ("userId", "examId") WHERE "status" IN ('creating','pending')`,
    );
    await runner.query(
      'CREATE INDEX "IDX_exam_payment_user_created" ON "exam_payment" ("userId", "createdAt")',
    );
    await runner.query(`CREATE TABLE "exam_purchase" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "examId" integer NOT NULL REFERENCES "exam"("id") ON DELETE CASCADE,
      "paymentId" uuid NOT NULL REFERENCES "exam_payment"("id") ON DELETE RESTRICT,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_exam_purchase_user_exam" UNIQUE ("userId", "examId")
    )`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE "exam_purchase"');
    await runner.query('DROP TABLE "exam_payment"');
  }
}
