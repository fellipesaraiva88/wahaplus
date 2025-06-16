import { SqlKVRepository } from '@waha/core/storage/sql/SqlKVRepository';
import { PsqlJsonQuery } from '@waha/plus/storage/psql/PsqlJsonQuery';
import { PsqlKnexEngine } from '@waha/plus/storage/psql/PsqlKnexEngine';
import Knex from 'knex';

export class PsqlKVRepository<Entity> extends SqlKVRepository<Entity> {
  protected knex: Knex.Knex;
  protected jsonQuery = new PsqlJsonQuery();

  constructor(knex: Knex.Knex) {
    const engine = new PsqlKnexEngine(knex);
    super(engine, knex);
  }
}
