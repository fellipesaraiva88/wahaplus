import { BufferJSON } from '@adiwajshing/baileys/lib/Utils';
import {
  SqlAuthMigrations,
  SqlAuthSchema,
} from '@waha/plus/engines/noweb/store/psql/schemas';
import { PsqlKVRepository } from '@waha/plus/storage/psql/PsqlKVRepository';
import Knex from 'knex';

class AuthData {
  id: string;
  data: any;
}

export class PsqlNowebAuthRepository extends PsqlKVRepository<AuthData> {
  constructor(knex: Knex.Knex) {
    super(knex);
  }

  get schema() {
    return SqlAuthSchema;
  }

  get migrations() {
    return SqlAuthMigrations;
  }

  saveCreds(data) {
    return this.saveCategory('creds', '', data);
  }

  getCreds() {
    return this.getCategory('creds', '');
  }

  private getDbId(category: string, id: string) {
    return id ? `${category}-${id}` : category;
  }

  async saveCategory(category: string, id: string, data) {
    const dbId = this.getDbId(category, id);
    await this.upsertOne({ id: dbId, data: data });
  }

  async getCategory(category: string, id: string): Promise<any> {
    const dbId = this.getDbId(category, id);
    const data = await this.getById(dbId);
    return data?.data;
  }

  /**
   * JSON helpers
   */
  protected stringify(data: any): string {
    return JSON.stringify(data, BufferJSON.replacer);
  }

  protected parse(row: any) {
    return JSON.parse(row.data, BufferJSON.reviver);
  }
}
