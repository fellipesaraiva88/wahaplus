import { DataStore } from '@waha/core/abc/DataStore';
import { INowebStorage } from '@waha/core/engines/noweb/store/INowebStorage';
import { NowebStorageFactoryCore } from '@waha/core/engines/noweb/store/NowebStorageFactoryCore';
import { MongoStorage } from '@waha/plus/engines/noweb/store/mongodb/MongoStorage';
import { PsqlStorage } from '@waha/plus/engines/noweb/store/psql/PsqlStorage';
import { MongoStore } from '@waha/plus/storage/mongo/MongoStore';
import { PsqlStore } from '@waha/plus/storage/psql/PsqlStore';

export class NowebStorageFactoryPlus extends NowebStorageFactoryCore {
  createStorage(store: DataStore, name: string): INowebStorage {
    if (store instanceof MongoStore) {
      return this.buildStorageMongo(store, name);
    }
    if (store instanceof PsqlStore) {
      return this.buildPsql(store, name);
    }
    return super.createStorage(store, name);
  }

  private buildStorageMongo(store: MongoStore, name: string) {
    const db = store.getSessionDb(name);
    return new MongoStorage(db);
  }

  private buildPsql(store: PsqlStore, name: string) {
    const knex = store.buildSessionKnex(name, 'Session/Storage');
    return new PsqlStorage(knex);
  }
}
