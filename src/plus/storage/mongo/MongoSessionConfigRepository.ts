import { SessionConfig } from '@waha/structures/sessions.dto';
import { Collection, Db } from 'mongodb';

import { ISessionConfigRepository } from '../../../core/storage/ISessionConfigRepository';
import { MongoStore } from './MongoStore';

class SessionConfigWithName extends SessionConfig {
  name: string;
}

export class MongoSessionConfigRepository extends ISessionConfigRepository {
  private collection: Collection<SessionConfigWithName>;

  constructor(store: MongoStore) {
    super();
    this.collection = store.getMainDb().collection('sessions');
  }

  async exists(sessionName: string): Promise<boolean> {
    return !!(await this.collection.findOne({ name: sessionName }));
  }

  async saveConfig(sessionName: string, config: SessionConfig): Promise<void> {
    await this.collection.replaceOne(
      { name: sessionName },
      { ...config, name: sessionName },
      { upsert: true },
    );
  }

  async getConfig(sessionName: string): Promise<SessionConfig> {
    const result = await this.collection.findOne({
      name: sessionName,
    });
    if (!result) {
      return null;
    }
    delete result._id;
    delete result.name;
    return result;
  }

  async deleteConfig(sessionName: string): Promise<void> {
    await this.collection.deleteOne({ name: sessionName });
  }

  private async getAllWithName(): Promise<SessionConfigWithName[]> {
    return await this.collection.find().toArray();
  }

  async getAllConfigs(): Promise<string[]> {
    const sessions = await this.getAllWithName();
    return sessions.map((session) => session.name);
  }

  async init() {
    return;
  }
}
