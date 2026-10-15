import type { User } from '../../users/domain/user';

export type AuditActor = Pick<User, 'id'> &
  Partial<Pick<User, 'fullName' | 'firstName' | 'email'>>;
