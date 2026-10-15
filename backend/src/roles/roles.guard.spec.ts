import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

@Roles(1)
class ExampleController {
  @Roles(3)
  teacherAction() {}
  adminAction() {}
}

function context(handler: () => void, roleId?: number): ExecutionContext {
  return new ExecutionContextHost(
    [{ user: roleId ? { role: { id: roleId } } : undefined }],
    ExampleController,
    handler,
  );
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());
  it('should allow a handler role to override the controller role', () => {
    expect(
      guard.canActivate(context(ExampleController.prototype.teacherAction, 3)),
    ).toBe(true);
    expect(
      guard.canActivate(context(ExampleController.prototype.teacherAction, 1)),
    ).toBe(false);
  });
  it('should apply controller roles when the handler has none', () => {
    expect(
      guard.canActivate(context(ExampleController.prototype.adminAction, 1)),
    ).toBe(true);
    expect(
      guard.canActivate(context(ExampleController.prototype.adminAction, 2)),
    ).toBe(false);
  });
  it('should reject missing identities for restricted actions', () => {
    expect(
      guard.canActivate(context(ExampleController.prototype.adminAction)),
    ).toBe(false);
  });
});
