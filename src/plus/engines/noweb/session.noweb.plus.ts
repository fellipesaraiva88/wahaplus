import {
  extractImageThumb,
  getStream,
  prepareWAMessageMedia,
} from '@adiwajshing/baileys';
import {
  MediaGenerationOptions,
  NewsletterFetchedUpdate,
} from '@adiwajshing/baileys/lib/Types';
import { UnprocessableEntityException } from '@nestjs/common';
import { WhatsappSessionNoWebCore } from '@waha/core/engines/noweb/session.noweb.core';
import { toJID } from '@waha/core/utils/jids';
import { parseBool, sortObjectByValues } from '@waha/helpers';
import { NowebStorageFactoryPlus } from '@waha/plus/engines/noweb/store/NowebStorageFactoryPlus';
import {
  Channel,
  ChannelListResult,
  ChannelMessage,
  ChannelSearchByText,
  ChannelSearchByView,
  CreateChannelRequest,
  PreviewChannelMessages,
} from '@waha/structures/channels.dto';
import {
  MessageFileRequest,
  MessageImageRequest,
  MessageLinkCustomPreviewRequest,
  MessageVideoRequest,
  MessageVoiceRequest,
} from '@waha/structures/chatting.dto';
import { BinaryFile, FileType, RemoteFile } from '@waha/structures/files.dto';
import {
  ImageStatus,
  VideoStatus,
  VoiceStatus,
} from '@waha/structures/status.dto';
import axios from 'axios';
import axiosRetry from 'axios-retry';

import { NowebClient } from './NowebClient';
import { NowebAuthFactoryPlus } from './store/NowebAuthFactoryPlus';

axiosRetry(axios, { retries: 3 });

export class WhatsappSessionNoWebPlus extends WhatsappSessionNoWebCore {
  authFactory = new NowebAuthFactoryPlus();
  storageFactory = new NowebStorageFactoryPlus();

  protected async uploadMedia(
    file: RemoteFile | BinaryFile,
    type: any,
  ): Promise<any> {
    if (!file) {
      return;
    }
    if (!('url' in file || 'data' in file)) {
      return;
    }
    const message: any = this.fileToMessage(file, type);
    const options: MediaGenerationOptions = {
      logger: this.engineLogger,
      upload: this.sock.waUploadToServer,
    };
    const { imageMessage } = await prepareWAMessageMedia(message, options);
    return imageMessage;
  }

  get client(): NowebClient {
    return new NowebClient(this.sock);
  }

  private async fetch(url: string): Promise<Buffer> {
    // fetch url using axios
    return axios.get(url, { responseType: 'arraybuffer' }).then((res) => {
      return Buffer.from(res.data);
    });
  }

  protected fileToMessage(
    file: RemoteFile | BinaryFile,
    type: any,
    caption = '',
  ) {
    if (!('url' in file || 'data' in file)) {
      throw new UnprocessableEntityException(
        'Either file.url or file.data must be specified.',
      );
    }

    if ('url' in file) {
      return {
        [type]: { url: file.url },
        caption: caption,
        mimetype: file.mimetype,
        fileName: file.filename,
        ptt: type === 'audio',
      };
    } else if ('data' in file) {
      return {
        [type]: Buffer.from(file.data, 'base64'),
        mimetype: file.mimetype,
        caption: caption,
        fileName: file.filename,
        ptt: type === 'audio',
      };
    }
  }

  private async fileToBuffer(file: FileType): Promise<Buffer> {
    let content: Buffer;
    if ('data' in file) {
      content = Buffer.from(file.data, 'base64');
    } else if ('url' in file) {
      content = await this.fetch(file.url);
    } else {
      throw new UnprocessableEntityException(
        'Either file.url or file.data must be specified.',
      );
    }
    return content;
  }

  /**
   * Profile methods
   */
  protected async setProfilePicture(
    file: BinaryFile | RemoteFile,
  ): Promise<boolean> {
    const content: Buffer = await this.fileToBuffer(file);
    const me = this.getSessionMeInfo();
    await this.sock.updateProfilePicture(me.id, content);
    return true;
  }

  protected async deleteProfilePicture(): Promise<boolean> {
    const me = this.getSessionMeInfo();
    await this.sock.removeProfilePicture(me.id);
    return true;
  }

  /**
   * Groups methods
   */
  protected async setGroupPicture(
    id: string,
    file: BinaryFile | RemoteFile,
  ): Promise<boolean> {
    const content: Buffer = await this.fileToBuffer(file);
    await this.sock.updateProfilePicture(id, content);
    return true;
  }

  protected async deleteGroupPicture(id: string): Promise<boolean> {
    await this.sock.removeProfilePicture(id);
    return true;
  }

  /**
   * Send media methods
   */

  async sendImage(request: MessageImageRequest) {
    const message: any = this.fileToMessage(
      request.file,
      'image',
      request.caption,
    );
    const options = await this.getMessageOptions(request);
    const chatId = toJID(this.ensureSuffix(request.chatId));
    return this.sock.sendMessage(chatId, message, options);
  }

  async sendFile(request: MessageFileRequest) {
    const message: any = this.fileToMessage(
      request.file,
      'document',
      request.caption,
    );
    const chatId = toJID(this.ensureSuffix(request.chatId));
    const options = await this.getMessageOptions(request);
    return this.sock.sendMessage(chatId, message, options);
  }

  async sendVoice(request: MessageVoiceRequest) {
    const message: any = this.fileToMessage(request.file, 'audio');
    const chatId = toJID(this.ensureSuffix(request.chatId));
    const options = await this.getMessageOptions(request);
    return this.sock.sendMessage(chatId, message, options);
  }

  async sendVideo(request: MessageVideoRequest) {
    const message: any = this.fileToMessage(
      request.file,
      'video',
      request.caption,
    );
    const chatId = toJID(this.ensureSuffix(request.chatId));
    const options = await this.getMessageOptions(request);
    message.ptv = parseBool(request.asNote);
    return this.sock.sendMessage(chatId, message, options);
  }

  async sendLinkCustomPreview(
    request: MessageLinkCustomPreviewRequest,
  ): Promise<any> {
    const chatId = toJID(this.ensureSuffix(request.chatId));
    const options = await this.getMessageOptions(request);
    const preview = request.preview;
    const urlInfo = {
      'matched-text': preview.url,
      title: preview.title,
      description: preview.description,
      jpegThumbnail: null,
      highQualityThumbnail: null,
    };

    if (request.preview.image) {
      const content: Buffer = await this.fileToBuffer(request.preview.image);
      if (!request.linkPreviewHighQuality) {
        // generate built-in thumbnail
        const thumbnail = await extractImageThumb(content, 192);
        urlInfo.jpegThumbnail = thumbnail.buffer;
      } else {
        // upload HQ thumbnail
        const { imageMessage } = await prepareWAMessageMedia(
          { image: content },
          {
            upload: this.sock.waUploadToServer,
            mediaTypeOverride: 'thumbnail-link',
            options: { timeout: 10_000 },
          },
        );
        urlInfo.jpegThumbnail = imageMessage?.jpegThumbnail
          ? Buffer.from(imageMessage.jpegThumbnail)
          : undefined;
        urlInfo.highQualityThumbnail = imageMessage;
      }
    }

    const message = {
      text: request.text,
      linkPreview: urlInfo,
    };
    return this.sock.sendMessage(chatId, message, options);
  }

  /**
   * Status methods
   */
  public async sendImageStatus(status: ImageStatus) {
    const message: any = this.fileToMessage(
      status.file,
      'image',
      status.caption,
    );
    const jids = await this.prepareJidsForStatus(status.contacts);
    if (!status.id) {
      this.upsertMeInJIDs(jids);
    }
    const messageId = this.prepareMessageIdForStatus(status);
    const options = {
      messageId: messageId,
    };
    return await this.sendStatusMessage(
      message,
      options,
      jids,
      status.contacts?.length,
    );
  }

  public async sendVoiceStatus(status: VoiceStatus) {
    const message: any = this.fileToMessage(status.file, 'audio');
    const jids = await this.prepareJidsForStatus(status.contacts);
    if (!status.id) {
      this.upsertMeInJIDs(jids);
    }
    const messageId = this.prepareMessageIdForStatus(status);
    const options = {
      backgroundColor: status.backgroundColor,
      messageId: messageId,
    };
    return await this.sendStatusMessage(
      message,
      options,
      jids,
      status.contacts?.length,
    );
  }

  public async sendVideoStatus(status: VideoStatus) {
    const message: any = this.fileToMessage(
      status.file,
      'video',
      status.caption,
    );
    const jids = await this.prepareJidsForStatus(status.contacts);
    if (!status.id) {
      this.upsertMeInJIDs(jids);
    }
    const messageId = this.prepareMessageIdForStatus(status);
    const options = {
      statusJidList: jids,
      messageId: messageId,
    };
    return await this.sendStatusMessage(
      message,
      options,
      jids,
      status.contacts?.length,
    );
  }

  /**
   * Channels methods
   */
  public async previewChannelMessages(
    inviteCode: string,
    query: PreviewChannelMessages,
  ): Promise<ChannelMessage[]> {
    const downloadMedia = query.downloadMedia;
    const updates = await this.sock.newsletterFetchMessages(
      'invite',
      inviteCode,
      query.limit,
      null,
    );
    const promises = [];
    for (const update of updates) {
      promises.push(
        this.NewsletterFetchedUpdateToChannelMessage(update, downloadMedia),
      );
    }
    let result = await Promise.all(promises);
    result = result.filter(Boolean);
    return result;
  }

  private async NewsletterFetchedUpdateToChannelMessage(
    update: NewsletterFetchedUpdate,
    downloadMedia: boolean,
  ): Promise<ChannelMessage> {
    let reactions: any = Object.fromEntries(
      update.reactions.map(({ code, count }) => [code, count]),
    );
    reactions = sortObjectByValues(reactions) || {};
    const message = await this.processIncomingMessage(
      update.message,
      downloadMedia,
    );
    return {
      message: message,
      reactions: reactions,
      viewCount: update.views,
    };
  }

  /**
   * Channels Search methods
   */
  public async searchChannelsByView(
    query: ChannelSearchByView,
  ): Promise<ChannelListResult> {
    const response = await this.client.searchChannelsByView(query);
    const channels: Channel[] = response.newsletters.map(
      this.toChannel.bind(this),
    );
    return {
      page: response.page,
      channels: channels,
    };
  }

  public async searchChannelsByText(
    query: ChannelSearchByText,
  ): Promise<ChannelListResult> {
    const response = await this.client.searchChannelsByText(query);
    const channels: Channel[] = response.newsletters.map(
      this.toChannel.bind(this),
    );
    return {
      page: response.page,
      channels: channels,
    };
  }

  public async channelsCreateChannel(request: CreateChannelRequest) {
    const channel = await super.channelsCreateChannel(request);

    if (request.picture) {
      let file = request.picture;
      let picture: any;
      // @ts-ignore
      if (file.url) {
        file = file as RemoteFile;
        picture = await getStream({ url: file.url });
        // @ts-ignore
      } else if (file.data) {
        file = file as BinaryFile;
        picture = Buffer.from(file.data, 'base64');
      }
      await this.sock.newsletterUpdatePicture(channel.id, picture);
    }
    return channel;
  }
}
