import { Document } from 'bson';
import { MongoClient } from 'mongodb';

import { DataStore } from '../../../core/abc/DataStore';

export class MongoStore extends DataStore {
  private mongo: MongoClient;
  private engine: string;

  constructor(mongo: MongoClient, engine: string) {
    super();
    if (!mongo)
      throw new Error(
        'A valid MongoClient instance is required for MongoStore.',
      );
    this.mongo = mongo;
    this.engine = engine.toLowerCase();
  }

  protected getMainDbName() {
    return `waha_${this.engine.toLowerCase()}`;
  }

  protected getSessionDbName(name: string) {
    const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, '_');
    return `${this.getMainDbName()}_${slug}`;
  }

  getMainDb() {
    return this.mongo.db(this.getMainDbName());
  }

  getSessionDb(name: string) {
    return this.mongo.db(this.getSessionDbName(name));
  }

  command(command: Document) {
    return this.mongo.db().admin().command(command);
  }

  async init(sessionName?: string): Promise<void> {
    if (!sessionName) {
      const collection = this.getMainDb().collection('sessions');
      await collection.createIndex({ name: 1 }, { unique: true });
    }
  }

  async close() {
    await this.mongo?.close();
  }
}
