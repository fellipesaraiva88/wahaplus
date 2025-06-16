import { sleep } from '@waha/utils/promiseTimeout';
import { SinglePeriodicJobRunner } from '@waha/utils/SinglePeriodicJobRunner';
import * as path from 'path';
import pino, { Logger } from 'pino';
import { AuthStrategy, Client, Events, Store } from 'whatsapp-web.js';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const prettyBytes = require('pretty-bytes');

/* Require Optional Dependencies */
let fs;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  fs = require('fs-extra');
} catch {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  fs = undefined;
}

async function isValidPath(path: string) {
  try {
    await fs.promises.access(path);
    return true;
  } catch {
    return false;
  }
}

async function getFilesizeInBytes(filename: string) {
  const stats = await fs.promises.lstat(filename).catch(() => null);
  if (!stats) {
    return;
  }
  return stats.size;
}

export interface Zipper {
  compress(path: string, archivePath: string): Promise<void>;

  uncompress(archivePath: string, path: string): Promise<void>;
}

/**
 * Remote-based authentication
 * @param {object} options - options
 * @param {object} options.store - Remote database store instance
 * @param {string} options.clientId - Client id to distinguish instances if you are using multiple, otherwise keep null if you are using only one instance
 * @param {string} options.dataPath - Change the default path for saving session files, default is: "./.wwebjs_auth/"
 * @param {number} options.backupSyncIntervalMs - Sets the time interval for periodic session backups. Accepts values starting from 60000ms {1 minute}
 */
export class RemoteAuth implements AuthStrategy {
  // Required Files & Dirs in WWebJS to restore session
  private REQUIRED_DIRS = ['Default', 'IndexedDB', 'Local Storage'];
  // Initial delay sync required for session to be stable enough to recover
  private INITIAL_DELAY_MS = 60000;

  private readonly clientId: string;
  private readonly dataPath: string;
  private readonly tempDir: string;
  private readonly store: Store;
  private readonly logger: Logger;

  private client: any;
  private userDataDir: string;
  private sessionName: string;
  private backupSyncRunner: SinglePeriodicJobRunner;
  private zipper: Zipper;

  constructor(
    { clientId, dataPath, store, backupSyncIntervalMs, logger, zipper } = {
      clientId: 'default',
      dataPath: undefined,
      store: null,
      backupSyncIntervalMs: 60000,
      zipper: undefined,
      logger: undefined,
    },
  ) {
    if (!fs)
      throw new Error(
        'Optional Dependencies [fs-extra] are required to use RemoteAuth. Make sure to run npm install correctly and remove the --no-optional flag',
      );

    const idRegex = /^[-_\w]+$/i;
    if (clientId && !idRegex.test(clientId)) {
      throw new Error(
        'Invalid clientId. Only alphanumeric characters, underscores and hyphens are allowed.',
      );
    }
    if (!backupSyncIntervalMs || backupSyncIntervalMs < 60000) {
      throw new Error(
        'Invalid backupSyncIntervalMs. Accepts values starting from 60000ms {1 minute}.',
      );
    }
    if (!store) throw new Error('Remote database store is required.');

    this.store = store;
    this.clientId = clientId;
    this.dataPath = path.resolve(dataPath || './.wwebjs_auth/');
    this.tempDir = `${this.dataPath}/wwebjs_temp_session_${this.clientId}`;
    this.zipper = zipper;
    this.logger = logger || pino({ name: RemoteAuth.name });
    this.backupSyncRunner = new SinglePeriodicJobRunner(
      'RemoteAuth Backup Sync',
      backupSyncIntervalMs,
      this.logger,
    );
  }

  get compressedSessionPath() {
    return `${this.sessionName}.zip`;
  }

  setup(client: Client) {
    this.client = client;
  }

  async afterBrowserInitialized() {
    return;
  }

  async onAuthenticationNeeded() {
    return {
      failed: false,
      restart: false,
      failureEventPayload: undefined,
    };
  }

  async getAuthEventPayload() {
    return;
  }

  async beforeBrowserInitialized() {
    const puppeteerOpts = this.client.options.puppeteer;
    const sessionDirName = this.clientId
      ? `RemoteAuth-${this.clientId}`
      : 'RemoteAuth';
    const dirPath = path.join(this.dataPath, sessionDirName);

    if (puppeteerOpts.userDataDir && puppeteerOpts.userDataDir !== dirPath) {
      throw new Error(
        'RemoteAuth is not compatible with a user-supplied userDataDir.',
      );
    }

    this.userDataDir = dirPath;
    this.logger.debug(`User data dir: ${this.userDataDir}`);
    this.sessionName = sessionDirName;
    this.logger.debug(`Session name: ${this.sessionName}`);

    await this.extractRemoteSession();
    await this.removeSingletonFiles(dirPath);

    this.client.options.puppeteer = {
      ...puppeteerOpts,
      userDataDir: dirPath,
    };
  }

  /**
   * Find in direction Singleton* files and try to remove it
   * Fix for SingletonLock and other files
   */
  private async removeSingletonFiles(dir: string) {
    const files = await fs.promises.readdir(dir);
    for (const file of files) {
      if (file.startsWith('Singleton')) {
        const filePath = path.join(dir, file);
        try {
          await fs.promises.rm(filePath, {
            maxRetries: 4,
            recursive: true,
            force: true,
          });
        } catch (err) {
          this.logger.error(err, `Error deleting: ${filePath}`);
        }
      }
    }
  }

  async logout() {
    await this.disconnect();
    await this.destroy();
  }

  async destroy() {
    this.backupSyncRunner.stop();
    // @ts-ignore
    if (this.store.close) {
      // @ts-ignore
      await this.store.close();
    }
  }

  async disconnect() {
    await this.deleteRemoteSession();
    await this.deleteLocalSession();
  }

  async afterAuthReady() {
    const sessionExists = await this.store.sessionExists({
      session: this.sessionName,
    });
    if (!sessionExists) {
      /* Initial delay sync required for session to be stable enough to recover */
      await sleep(this.INITIAL_DELAY_MS);
      await this.storeRemoteSession();
      this.client.emit(Events.REMOTE_SESSION_SAVED);
    }

    this.backupSyncRunner.start(async () => {
      await this.storeRemoteSession();
    });
  }

  async storeRemoteSession() {
    const pathExists = await isValidPath(this.userDataDir);
    if (!pathExists) {
      this.logger.warn(
        'User data dir does not exist. Skipping session backup.',
      );
      return;
    }

    await this.compressSession();
    await this.store.save({ session: this.sessionName });
    await this.removePathSilently(this.compressedSessionPath);
    await this.removePathSilently(this.tempDir);
  }

  async extractRemoteSession() {
    await this.removePathSilently(this.userDataDir);

    const sessionExists = await this.store.sessionExists({
      session: this.sessionName,
    });
    if (!sessionExists) {
      fs.mkdirSync(this.userDataDir, { recursive: true });
      return;
    }

    await this.store.extract({
      session: this.sessionName,
      path: this.compressedSessionPath,
    });
    await this.removePathSilently(this.userDataDir);
    await this.unCompressSession();
    await this.removePathSilently(this.compressedSessionPath);
  }

  private async deleteRemoteSession() {
    const sessionExists = await this.store.sessionExists({
      session: this.sessionName,
    });
    if (sessionExists) await this.store.delete({ session: this.sessionName });
  }

  private async deleteLocalSession() {
    await this.removePathSilently(this.userDataDir);
  }

  async compressSession() {
    await fs.copy(this.userDataDir, this.tempDir).catch((err) => {
      this.logger.error(err, 'Error copying user data dir');
    });
    await this.deleteMetadata();

    this.logger.debug('Compressing session...');
    await this.zipper.compress(this.tempDir, this.compressedSessionPath);
    this.logger.debug('Session compressed.');

    const zipSize = await getFilesizeInBytes(this.compressedSessionPath);
    this.logger.debug(`Session archive size: ${prettyBytes(zipSize)}`);
  }

  async unCompressSession() {
    const zipSize = await getFilesizeInBytes(this.compressedSessionPath);
    this.logger.debug(`Restored Session archive size: ${prettyBytes(zipSize)}`);

    this.logger.debug('Uncompressing session...');
    await this.zipper.uncompress(this.compressedSessionPath, this.userDataDir);
    this.logger.debug('Session uncompressed.');
  }

  async deleteMetadata() {
    const sessionDirs = [this.tempDir, path.join(this.tempDir, 'Default')];
    for (const dir of sessionDirs) {
      const sessionFiles = await fs.promises.readdir(dir);
      for (const element of sessionFiles) {
        if (this.REQUIRED_DIRS.includes(element)) {
          continue;
        }
        const dirElement = path.join(dir, element);
        await this.removePathSilently(dirElement);
      }
    }
  }

  private async removePathSilently(path: string) {
    const exists = await isValidPath(path);
    if (!exists) {
      return;
    }

    try {
      await fs.promises.rm(path, {
        maxRetries: 4,
        recursive: true,
        force: true,
      });
    } catch (err) {
      this.logger.error(err, `Error deleting: ${path}`);
    }
  }
}
