import {
  // common
  Module,
} from '@nestjs/common';

import { UsersController } from './users.controller';
import { AdminUsersController } from './admin-users.controller';
import { MeController } from './me.controller';

import { UsersService } from './users.service';
import { DocumentUserPersistenceModule } from './infrastructure/persistence/document/document-persistence.module';
import { RelationalUserPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { DatabaseConfig } from '../database/config/database-config.type';
import databaseConfig from '../database/config/database.config';
import { FilesModule } from '../files/files.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { SessionModule } from '../session/session.module';

// <database-block>
const infrastructurePersistenceModule = (databaseConfig() as DatabaseConfig)
  .isDocumentDatabase
  ? DocumentUserPersistenceModule
  : RelationalUserPersistenceModule;
// </database-block>

@Module({
  imports: [
    // import modules, etc.
    infrastructurePersistenceModule,
    FilesModule,
    AuditLogsModule,
    SessionModule,
  ],
  controllers: [UsersController, AdminUsersController, MeController],
  providers: [UsersService],
  exports: [UsersService, infrastructurePersistenceModule],
})
export class UsersModule {}
