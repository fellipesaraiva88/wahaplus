import Knex from 'knex';

export interface ISQLEngine {
  /**
   * Run a query that does not return any data
   */
  run(query: Knex.QueryBuilder): Promise<void>;

  /**
   * Get a single row from the database
   */
  get(query: Knex.QueryBuilder): Promise<any | null>;

  /**
   * Get all rows from the database
   */
  all(query: Knex.QueryBuilder): Promise<any[]>;

  /**
   * Run a raw SQL query with bindings
   */
  raw(sql: string, bindings: any[]): Promise<void>;

  /**
   * Execute a raw SQL query
   */
  exec(sql: string): Promise<void>;
}
