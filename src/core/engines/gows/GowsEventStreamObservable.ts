import * as grpc from '@grpc/grpc-js';
import { messages } from '@waha/core/engines/gows/grpc/gows';
import { EnginePayload } from '@waha/structures/webhooks.dto';
import { sleep } from '@waha/utils/promiseTimeout';
import { Logger } from 'pino';
import { Observable } from 'rxjs';

/**
 * Observable that listens to a gRPC stream and emits EnginePayload objects.
 * Pass a factory function that returns a client and a stream.
 */
export class GowsEventStreamObservable extends Observable<EnginePayload> {
  _client: grpc.Client;
  CLIENT_CLOSE_TIMEOUT = 1_000;

  constructor(
    private logger: Logger,
    factory: () => {
      client: grpc.Client;
      stream: grpc.ClientReadableStream<messages.EventJson>;
    },
  ) {
    super((subscriber) => {
      this.logger.debug('Creating grpc client and stream...');
      const { client, stream } = factory();
      this._client = client;

      stream.on('data', (raw) => {
        const obj = raw.toObject();
        obj.data = JSON.parse(obj.data);
        subscriber?.next(obj);
      });

      stream.on('end', (...args) => {
        this.logger.debug('Stream ended', args);
        subscriber?.complete();
        subscriber = null;
      });

      stream.on('error', async (err: any) => {
        const CLIENT_CANCELLED_CODE = grpc.status.CANCELLED;
        if (err.code === CLIENT_CANCELLED_CODE) {
          this.logger.debug('Stream cancelled by client');
          return;
        }
        this.logger.error(err, 'Stream error');
        // Give some time to node event loop to process the error
        await sleep(100);
        subscriber?.error(err);
        subscriber = null;
      });

      return async () => {
        this.logger.debug('Closing stream client...');
        client.close();
        await sleep(this.CLIENT_CLOSE_TIMEOUT);
        this.logger.debug('Stream client closed');

        this.logger.debug('Cancelling stream...');
        stream.cancel();
        this.logger.debug('Stream cancelled');
      };
    });
  }

  get client(): Omit<grpc.Client, 'close'> {
    return this._client;
  }
}
