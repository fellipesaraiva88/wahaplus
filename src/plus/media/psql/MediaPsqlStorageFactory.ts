import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { EngineConfigService } from '@waha/core/config/EngineConfigService';
import { MediaStorageFactory } from '@waha/core/media/MediaStorageFactory';
import { MediaPsqlStorage } from '@waha/plus/media/psql/MediaPsqlStorage';
import { MediaPsqlStorageConfig } from '@waha/plus/media/psql/MediaPsqlStorageConfig';
import { parsePsql } from '@waha/plus/storage/psql/PsqlConnectionConfig';
import { PsqlStore } from '@waha/plus/storage/psql/PsqlStore';
import { getEngineName, VERSION } from '@waha/version';
import { Logger } from 'pino';

@Injectable()
export class MediaPsqlStorageFactory
  implements MediaStorageFactory, OnApplicationShutdown
{
  private readonly store: PsqlStore;
  private readonly filesURL: string;

  constructor(
    psqlConfig: MediaPsqlStorageConfig,
    private engineConfigService: EngineConfigService,
  ) {
    const config = parsePsql(psqlConfig.databaseUrl);
    const engine = getEngineName();
    config.application_name = `WAHA(${engine}) ${VERSION.version} - Media`;
    const engineName = this.engineConfigService.getDefaultEngineName();
    this.store = new PsqlStore(config, engineName);
    this.filesURL = psqlConfig.filesURL;
  }

  async build(
    name: string,
    logger: Logger,
    init: boolean = true,
  ): Promise<MediaPsqlStorage> {
    if (init && name !== 'all') {
      await this.store.init(name);
    }

    let knex;
    if (name === 'all') {
      knex = this.store.knex;
    } else {
      const suffix = init ? 'Session' : 'Fetch';
      knex = this.store.buildSessionKnex(name, suffix);
    }
    return new MediaPsqlStorage(knex, this.filesURL, logger);
  }

  async onApplicationShutdown(signal?: string) {
    await this.store.close();
  }
}
