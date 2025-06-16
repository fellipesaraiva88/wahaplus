import { jidDecode, WAProto } from '@adiwajshing/baileys';
import { BufferJSON, initAuthCreds } from '@adiwajshing/baileys/lib/Utils';
import { Collection, Db, Document } from 'mongodb';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const AsyncLock = require('async-lock');

function mongoKey(id: string) {
  // Replace . to -
  return id.replace(/\./g, '-');
}

export class NoWebMongoDbAuth {
  private collection: Collection;
  private document: Document;
  private creds: any;

  private db: Db;
  private lock: any;

  constructor(db: Db) {
    this.db = db;
    this.collection = this.db.collection('auth');
    this.lock = new AsyncLock({
      maxPending: Infinity,
      maxExecutionTime: 60_000,
    });
  }

  async init() {
    this.document = await this.lock.acquire('auth', async () => {
      return await this.upsertDocument();
    });
  }

  upsertDocument() {
    return this.collection.findOneAndUpdate(
      // @ts-ignore
      { _id: this.session },
      {
        $setOnInsert: {},
      },
      {
        returnDocument: 'after',
        upsert: true,
      },
    );
  }

  async writeData(data, field: string) {
    return this.lock.acquire('auth', async () => {
      return await this._writeData(data, field);
    });
  }

  async _writeData(data, field: string) {
    const key = mongoKey(field);
    this.document = await this.collection.findOneAndUpdate(
      // @ts-ignore
      { _id: this.session },
      {
        $set: {
          [key]: JSON.parse(JSON.stringify(data, BufferJSON.replacer)),
        },
      },
      { returnDocument: 'after' },
    );
  }

  readData(field: string) {
    const key = mongoKey(field);
    try {
      const data = JSON.stringify(this.document[key]);
      if (data === 'null' || data === 'undefined') return null;
      if (!data) return null;

      return JSON.parse(data, BufferJSON.reviver);
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  async removeData(field: string) {
    const key = mongoKey(field);
    try {
      this.document = await this.collection.findOneAndUpdate(
        // @ts-ignore
        { _id: this.session },
        {
          $unset: {
            [key]: '',
          },
        },
        { returnDocument: 'after' },
      );
    } catch (_a) {
      console.error(_a);
    }
  }

  isMyMainSession(id: string) {
    // Decode the jid
    const { user: meId } = jidDecode(this.creds?.me?.id);
    return id == `${meId}.0`;
  }

  methods() {
    const creds = this.readData('creds');
    // @ts-ignore:next-line
    this.creds = creds || (0, initAuthCreds)();
    return {
      state: {
        creds: this.creds,
        keys: {
          get: async (type, ids) => {
            const data = {};
            await Promise.all(
              ids.map(async (id) => {
                // Always reset my session and setup new session
                if (type === 'session' && this.isMyMainSession(id)) {
                  return;
                }
                let value = await this.readData(`${type}-${id}`);
                if (type === 'app-state-sync-key' && value) {
                  value = WAProto.Message.AppStateSyncKeyData.fromObject(value);
                }
                data[id] = value;
              }),
            );
            return data;
          },
          set: async (data) => {
            const tasks = [];
            for (const category of Object.keys(data)) {
              for (const id of Object.keys(data[category])) {
                const value = data[category][id];
                const key = `${category}-${id}`;
                const hasValue = !!value || value?.length === 0;
                if (hasValue) {
                  tasks.push(this.writeData(value, key));
                } else {
                  // Do not remove any keys for now
                  // Avoid removing pre-keys
                  // tasks.push(this.removeData(key));
                }
              }
            }
            await Promise.all(tasks);
          },
        },
      },
      saveCreds: () => {
        return this.writeData(this.creds, 'creds');
      },
      close: async () => {
        return;
      },
    };
  }
}
