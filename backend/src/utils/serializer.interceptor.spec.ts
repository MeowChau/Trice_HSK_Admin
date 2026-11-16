import { firstValueFrom, of } from 'rxjs';
import { ExecutionContext } from '@nestjs/common';
import { ResolvePromisesInterceptor } from './serializer.interceptor';
describe('ResolvePromisesInterceptor', () => {
  it('should resolve nested service promises while retaining dates and nulls', async () => {
    const date = new Date();
    const result = await firstValueFrom(
      new ResolvePromisesInterceptor().intercept({} as ExecutionContext, {
        handle: () =>
          of({ items: [Promise.resolve({ count: 3 }), null], date }),
      }),
    );
    expect(result).toEqual({ items: [{ count: 3 }, null], date });
  });
});
