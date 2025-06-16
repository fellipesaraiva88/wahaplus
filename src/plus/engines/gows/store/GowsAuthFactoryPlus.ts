import { DataStore } from '@waha/core/abc/DataStore';
import { GowsAuth } from '@waha/core/engines/gows/store/GowsAuth';
import { GowsAuthFactoryCore } from '@waha/core/engines/gows/store/GowsAuthFactoryCore';
import { GowsAuthSimple } from '@waha/core/engines/gows/store/GowsAuthSimple';
import { PsqlStore } from '@waha/plus/storage/psql/PsqlStore';

export class GowsAuthFactoryPlus extends GowsAuthFactoryCore {
  buildAuth(store: DataStore, name: string): Promise<GowsAuth> {
    if (store instanceof PsqlStore) return this.buildPsql(store, name);
    return super.buildAuth(store, name);
  }

  async buildPsql(store: PsqlStore, name: string): Promise<GowsAuth> {
    await store.init(name);
    const connection = store.getSessionDbURL(name);
    return new GowsAuthSimple(connection, 'postgres');
  }
}
