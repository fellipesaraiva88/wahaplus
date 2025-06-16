import { BufferJSON } from '@adiwajshing/baileys/lib/Utils';
import {
  convertProtobufToPlainObject,
  replaceLongsWithNumber,
} from '@waha/core/engines/noweb/utils';
import { PsqlKVRepository } from '@waha/plus/storage/psql/PsqlKVRepository';

// PostgreSQL TEXT or JSONB columns do not allow null bytes (c-style strings)
const invalidCharsRegex = /\u0000/g;

export function sanitizeJsonUnicode(str: string): string {
  return str.replace(invalidCharsRegex, '');
}

/**
 * Key value repository with extra metadata
 * Add support for converting protobuf to plain object
 */
export class NOWEBPsqlKVRepository<Entity> extends PsqlKVRepository<Entity> {
  protected stringify(data: any): string {
    let value = JSON.stringify(data, BufferJSON.replacer);
    value = sanitizeJsonUnicode(value);
    return value;
  }

  protected parse(row: any): any {
    return JSON.parse(row.data, BufferJSON.reviver);
  }

  protected dump(entity: Entity) {
    const raw = convertProtobufToPlainObject(entity);
    replaceLongsWithNumber(raw);
    return super.dump(raw);
  }
}
