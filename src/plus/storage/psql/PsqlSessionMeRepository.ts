import { ISessionMeRepository } from '@waha/core/storage/ISessionMeRepository';
import { SQLMeMigrations, SQLMeSchema } from '@waha/core/storage/sql/schemas';
import { PsqlKVRepository } from '@waha/plus/storage/psql/PsqlKVRepository';
import { PsqlStore } from '@waha/plus/storage/psql/PsqlStore';
import { MeInfo } from '@waha/structures/sessions.dto';

class SessionMeInfo {
  id: string;
  me?: MeInfo;
}

export class PsqlSessionMeRepository
  extends PsqlKVRepository<SessionMeInfo>
  implements ISessionMeRepository
{
  constructor(store: PsqlStore) {
    super(store.knex);
  }

  get schema() {
    return SQLMeSchema;
  }

  get migrations() {
    return SQLMeMigrations;
  }

  upsertMe(sessionName: string, me: MeInfo): Promise<void> {
    return this.upsertOne({ id: sessionName, me: me });
  }

  async getMe(sessionName: string): Promise<MeInfo | null> {
    const data = await this.getById(sessionName);
    return data?.me;
  }

  removeMe(sessionName: string): Promise<void> {
    return this.deleteById(sessionName);
  }

  protected async validateSchema() {
    // TODO: Implement
  }
}
