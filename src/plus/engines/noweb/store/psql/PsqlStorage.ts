import { IChatRepository } from '@waha/core/engines/noweb/store/IChatRepository';
import { IContactRepository } from '@waha/core/engines/noweb/store/IContactRepository';
import { IGroupRepository } from '@waha/core/engines/noweb/store/IGroupRepository';
import { ILabelAssociationRepository } from '@waha/core/engines/noweb/store/ILabelAssociationsRepository';
import { ILabelsRepository } from '@waha/core/engines/noweb/store/ILabelsRepository';
import { IMessagesRepository } from '@waha/core/engines/noweb/store/IMessagesRepository';
import { INowebLidPNRepository } from '@waha/core/engines/noweb/store/INowebLidPNRepository';
import { INowebStorage } from '@waha/core/engines/noweb/store/INowebStorage';
import { Migrations } from '@waha/core/engines/noweb/store/schemas';
import { PsqlChatRepository } from '@waha/plus/engines/noweb/store/psql/PsqlChatRepository';
import { PsqlContactRepository } from '@waha/plus/engines/noweb/store/psql/PsqlContactRepository';
import { PsqlGroupRepository } from '@waha/plus/engines/noweb/store/psql/PsqlGroupRepository';
import { PsqlLidPNRepository } from '@waha/plus/engines/noweb/store/psql/PsqLidPNRepository';
import { PsqlLabelAssociationsRepository } from '@waha/plus/engines/noweb/store/psql/PsqlLabelAssociationsRepository';
import { PsqlLabelsRepository } from '@waha/plus/engines/noweb/store/psql/PsqlLabelsRepository';
import { PsqlMessagesRepository } from '@waha/plus/engines/noweb/store/psql/PsqlMessagesRepository';
import Knex from 'knex';

export class PsqlStorage extends INowebStorage {
  constructor(private knex: Knex.Knex) {
    super();
  }

  async init() {
    await this.migrate();
  }

  private migrate() {
    return this.migration0001init();
  }

  private async migration0001init() {
    for (const migration of Migrations) {
      await this.knex.raw(migration);
    }
  }

  async close() {
    return this.knex.destroy();
  }

  getContactsRepository(): IContactRepository {
    return new PsqlContactRepository(this.knex);
  }

  getChatRepository(): IChatRepository {
    return new PsqlChatRepository(this.knex);
  }

  getGroupRepository(): IGroupRepository {
    return new PsqlGroupRepository(this.knex);
  }

  getMessagesRepository(): IMessagesRepository {
    return new PsqlMessagesRepository(this.knex);
  }

  getLabelsRepository(): ILabelsRepository {
    return new PsqlLabelsRepository(this.knex);
  }

  getLabelAssociationRepository(): ILabelAssociationRepository {
    return new PsqlLabelAssociationsRepository(this.knex);
  }

  getLidPNRepository(): INowebLidPNRepository {
    return new PsqlLidPNRepository(this.knex);
  }
}
