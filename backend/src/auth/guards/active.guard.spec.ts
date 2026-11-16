import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { ActiveGuard } from './active.guard';
describe('ActiveGuard', () => {
  const guard = new ActiveGuard();
  it.each([undefined, { id: 1 }, { id: 1, status: { id: 2 } }])(
    'rejects missing, stale or pending credentials %j',
    (user) => {
      expect(() =>
        guard.canActivate(new ExecutionContextHost([{ user }])),
      ).toThrow();
    },
  );
  it('should allow an approved account', () => {
    expect(
      guard.canActivate(
        new ExecutionContextHost([{ user: { id: 1, status: { id: 1 } } }]),
      ),
    ).toBe(true);
  });
});
