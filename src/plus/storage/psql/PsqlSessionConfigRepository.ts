import { ISessionConfigRepository } from '@waha/core/storage/ISessionConfigRepository';
import {
  SQLSessionConfigMigrations,
  SQLSessionConfigSchema,
} from '@waha/core/storage/sql/schemas';
import { PsqlKVRepository } from '@waha/plus/storage/psql/PsqlKVRepository';
import { PsqlStore } from '@waha/plus/storage/psql/PsqlStore';
import { SessionConfig } from '@waha/structures/sessions.dto';

class SessionConfigInfo {
  id: string;
  config?: SessionConfig;
}

export class PsqlSessionConfigRepository
  extends PsqlKVRepository<SessionConfigInfo>
  implements ISessionConfigRepository
{
  constructor(store: PsqlStore) {
    super(store.knex);
  }

  get schema() {
    return SQLSessionConfigSchema;
  }

  get migrations() {
    return SQLSessionConfigMigrations;
  }

  saveConfig(sessionName: string, config: SessionConfig): Promise<void> {
    return this.upsertOne({ id: sessionName, config: config });
  }

  async getConfig(sessionName: string): Promise<SessionConfig | null> {
    const data = await this.getById(sessionName);
    return data?.config ?? null;
  }

  async exists(sessionName: string): Promise<boolean> {
    const data = await this.getById(sessionName);
    return data !== null;
  }

  async deleteConfig(sessionName: string): Promise<void> {
    return this.deleteById(sessionName);
  }

  async getAllConfigs(): Promise<string[]> {
    const configs = await this.getAll();
    return configs.map((config) => config.id);
  }

  protected async validateSchema() {
    // TODO: Implement
  }
}
