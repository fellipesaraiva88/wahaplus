import { ISQLEngine } from '@waha/core/storage/sql/ISQLEngine';
import { Database } from 'better-sqlite3';
import { Knex } from 'knex';

export class Sqlite3Engine implements ISQLEngine {
  constructor(protected db: Database) {}

  async all(query: Knex.QueryBuilder): Promise<any[]> {
    const sql = query.toSQL().sql;
    const bind = query.toSQL().bindings;
    return this.db.prepare(sql).all(bind);
  }

  async get(query: Knex.QueryBuilder): Promise<any | null> {
    const sql = query.toSQL().sql;
    const bind = query.toSQL().bindings;
    const row: any = this.db.prepare(sql).get(bind);
    if (!row) {
      return null;
    }
    return row;
  }

  async run(query: Knex.QueryBuilder): Promise<void> {
    const sql = query.toSQL().sql;
    const bind = query.toSQL().bindings;
    this.db.prepare(sql).run(bind);
    return;
  }

  async raw(sql: string, bindings: any[]) {
    this.db.prepare(sql).run(bindings);
  }

  async exec(sql): Promise<void> {
    this.db.exec(sql);
  }
}
