import {
  getChannelInviteLink,
  getPublicUrlFromDirectPath,
} from '@waha/core/abc/session.abc';
import { WhatsappSessionWebJSCore } from '@waha/core/engines/webjs/session.webjs.core';
import {
  WebjsChannelMessage,
  WebjsClientPlus,
} from '@waha/plus/engines/webjs/WebjsClientPlus';
import {
  ChannelListResult,
  ChannelMessage,
  ChannelPublicInfo,
  ChannelSearchByText,
  ChannelSearchByView,
  PreviewChannelMessages,
} from '@waha/structures/channels.dto';
import {
  MessageButtonReply,
  MessageFileRequest,
  MessageImageRequest,
  MessageVideoRequest,
} from '@waha/structures/chatting.dto';
import { BinaryFile, RemoteFile } from '@waha/structures/files.dto';
import {
  BROADCAST_ID,
  ImageStatus,
  VideoStatus,
  VoiceStatus,
} from '@waha/structures/status.dto';
import { GroupChat, MessageMedia } from 'whatsapp-web.js';

import { WebJSAuthFactory } from './WebJSAuthFactory';

export class WhatsappSessionWebJSPlus extends WhatsappSessionWebJSCore {
  authFactory = new WebJSAuthFactory();
  whatsapp: WebjsClientPlus;

  protected getClassDirName() {
    return __dirname;
  }

  protected async buildClient() {
    const authStrategy = await this.authFactory.buildAuth(
      this.sessionStore,
      this.name,
      this.loggerBuilder,
    );
    const clientOptions = this.getClientOptions();
    clientOptions.authStrategy = authStrategy;
    this.addProxyConfig(clientOptions);
    return new WebjsClientPlus(clientOptions);
  }

  private async fileToMedia(file: BinaryFile | RemoteFile) {
    if ('url' in file) {
      const mediaOptions = { unsafeMime: true };
      const media = await MessageMedia.fromUrl(file.url, mediaOptions);
      media.mimetype = file.mimetype || media.mimetype;
      media.filename = file.filename || media.filename;
      return media;
    }
    return new MessageMedia(file.mimetype, file.data, file.filename);
  }

  /**
   * Profile methods
   */
  protected async setProfilePicture(
    file: BinaryFile | RemoteFile,
  ): Promise<boolean> {
    const media = await this.fileToMedia(file);
    return await this.whatsapp.setProfilePicture(media);
  }

  protected async deleteProfilePicture(): Promise<boolean> {
    return await this.whatsapp.deleteProfilePicture();
  }

  /**
   * Groups methods
   */
  protected async setGroupPicture(
    id: string,
    file: BinaryFile | RemoteFile,
  ): Promise<boolean> {
    const media = await this.fileToMedia(file);
    const groupChat = (await this.whatsapp.getChatById(id)) as GroupChat;
    return await groupChat.setPicture(media);
  }

  protected async deleteGroupPicture(id: string): Promise<boolean> {
    const groupChat = (await this.whatsapp.getChatById(id)) as GroupChat;
    return await groupChat.deletePicture();
  }

  /**
   * Send media methods
   */
  async sendFile(request: MessageFileRequest) {
    const media = await this.fileToMedia(request.file);
    let options = this.getMessageOptions(request);
    options = {
      ...options,
      sendMediaAsDocument: true,
      caption: request.caption,
    };
    return this.whatsapp.sendMessage(
      this.ensureSuffix(request.chatId),
      media,
      options,
    );
  }

  async sendImage(request: MessageImageRequest) {
    const media = await this.fileToMedia(request.file);
    let options = this.getMessageOptions(request);
    options = {
      ...options,
      caption: request.caption,
    };
    return this.whatsapp.sendMessage(
      this.ensureSuffix(request.chatId),
      media,
      options,
    );
  }

  async sendVoice(request) {
    const media = await this.fileToMedia(request.file);
    let options = this.getMessageOptions(request);
    options = {
      ...options,
      sendAudioAsVoice: true,
    };
    return this.whatsapp.sendMessage(
      this.ensureSuffix(request.chatId),
      media,
      options,
    );
  }

  async sendVideo(request: MessageVideoRequest) {
    const media = await this.fileToMedia(request.file);
    let options = this.getMessageOptions(request);
    options = {
      ...options,
      caption: request.caption,
    };
    return this.whatsapp.sendMessage(
      this.ensureSuffix(request.chatId),
      media,
      options,
    );
  }

  async sendButtonsReply(request: MessageButtonReply) {
    const options = this.getMessageOptions(request);
    const extra: any = {
      type: 'buttons_response',
      kind: 'buttonsResponse',
      buttonsResponse: {
        selectedButtonId: request.selectedButtonID,
        selectedDisplayText: request.selectedDisplayText,
        type: 1,
      },
      viewMode: 'VISIBLE',
    };
    options.extra = extra;
    return this.whatsapp.sendMessage(
      this.ensureSuffix(request.chatId),
      request.selectedDisplayText,
      options,
    );
  }

  /**
   * Status methods
   */
  public async sendImageStatus(status: ImageStatus) {
    this.checkStatusRequest(status);
    const media = await this.fileToMedia(status.file);
    const options = {
      caption: status.caption,
    };
    return this.whatsapp.sendMessage(BROADCAST_ID, media, options);
  }

  public async sendVoiceStatus(status: VoiceStatus) {
    this.checkStatusRequest(status);
    const media = await this.fileToMedia(status.file);
    const options = {
      sendAudioAsVoice: true,
    };
    return this.whatsapp.sendMessage(BROADCAST_ID, media, options);
  }

  public async sendVideoStatus(status: VideoStatus) {
    this.checkStatusRequest(status);
    const media = await this.fileToMedia(status.file);
    const options = {
      caption: status.caption,
    };
    return this.whatsapp.sendMessage(BROADCAST_ID, media, options);
  }

  /**
   * Channels methods
   */
  public async previewChannelMessages(
    inviteCode: string,
    query: PreviewChannelMessages,
  ): Promise<ChannelMessage[]> {
    const channelMessages = await this.whatsapp.channelFetchMessageByInvite(
      inviteCode,
      query.limit,
    );
    const promises = [];
    for (const msg of channelMessages) {
      promises.push(
        this.WebjsChannelMessageToChannelMessage(msg, query.downloadMedia),
      );
    }
    return await Promise.all(promises);
  }

  private async WebjsChannelMessageToChannelMessage(
    channelMessage: WebjsChannelMessage,
    downloadMedia: boolean,
  ): Promise<ChannelMessage> {
    const message = await this.processIncomingMessage(
      channelMessage.message,
      downloadMedia,
    );
    const reactions = {};
    for (const reaction of channelMessage.reactions.sort((x) => -x.count)) {
      reactions[reaction.reaction] = reaction.count;
    }

    return {
      message: message,
      reactions: reactions,
      viewCount: channelMessage.viewCount,
    };
  }

  /**
   * Channels Search methods
   */
  public async searchChannelsByView(
    query: ChannelSearchByView,
  ): Promise<ChannelListResult> {
    const params = {
      view: query.view || 'TRENDING',
      countryCodes: query.countries,
      cursorToken: query.startCursor,
      categories: query.categories,
      limit: query.limit,
    };
    const data = await this.whatsapp.searchChannelsView(params);
    return this.channelsRawDataToResponse(data);
  }

  public async searchChannelsByText(
    query: ChannelSearchByText,
  ): Promise<ChannelListResult> {
    const params = {
      searchText: query.text,
      cursorToken: query.startCursor,
      categories: query.categories,
      limit: query.limit,
    };
    const data = await this.whatsapp.searchChannelsText(params);
    return this.channelsRawDataToResponse(data);
  }

  private channelsRawDataToResponse(data: any): ChannelListResult {
    const pageInfo = data.pageInfo;
    const newsletters = data.newsletters;
    return {
      page: {
        startCursor: pageInfo.startCursor,
        endCursor: pageInfo.endCursor,
        hasNextPage: pageInfo.hasNextPage,
        hasPreviousPage: pageInfo.hasPreviousPage,
      },
      channels: newsletters.map(NewsletterMetadataToChannel),
    };
  }
}

function NewsletterMetadataToChannel(data: any): ChannelPublicInfo {
  const pictureDirectPath =
    data.newsletterPictureMetadataMixin.picture?.[0]
      .queryPictureDirectPathOrEmptyResponseMixinGroup?.value?.directPath;
  const pictureUrl = getPublicUrlFromDirectPath(pictureDirectPath);
  return {
    id: data.idJid,
    name: data.newsletterNameMetadataMixin.nameElementValue,
    picture: pictureUrl,
    description:
      data.newsletterDescriptionMetadataMixin
        .descriptionQueryDescriptionResponseMixin.elementValue,
    invite: getChannelInviteLink(
      data.newsletterInviteLinkMetadataMixin.inviteCode,
    ),
    subscribersCount: Number(
      data.newsletterSubscribersMetadataMixin.subscribersCount,
    ),
    verified:
      data.newsletterVerificationMetadataMixin.verificationState === 'verified',
  };
}
