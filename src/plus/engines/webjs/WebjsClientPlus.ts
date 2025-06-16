import { WebjsClientCore } from '@waha/core/engines/webjs/WebjsClientCore';
import { Message } from 'whatsapp-web.js';
import { Message as MessageInstance } from 'whatsapp-web.js/src/structures';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LoadWAHAPlus } = require('./_WAHAPlus.js');

export interface WebjsChannelMessage {
  message: Message;
  reactions: ChannelMessageReaction[];
  viewCount: number;
}
class ChannelMessageReaction {
  reaction: string;
  count: number;
}

interface _Id {
  id: string;
  fromMe: boolean;
  remote: string;
  _serialized: string;
}

/**
 *     "parentMsgKey": {
 *         "fromMe": false,
 *         "remote": "111111111111111111@newsletter",
 *         "id": "AAAAAAAAAAAAAAAAAAAA",
 *         "_serialized": "false_111111111111111111@newsletter_AAAAAAAAAAAAAAAAAAAA"
 *     },
 *     "serverTimestamp": 1738536731,
 *     "emojiCountMap": {emoji=>count}
 */
interface _NewsletterReaction {
  parentMsgKey: _Id;
  serverTimestamp: number;
  emojiCountMap: any;
}

interface _GetNewsletterPreviewDataResponse {
  ids: any[];
  newsletterMetadata: any;
  newsletterMessages: any[];
  newsletterReactions: _NewsletterReaction[];
  timestamp: number;
}

function extractReactionsByMessageKey(
  newsletterReactions: _NewsletterReaction[],
): Map<string, ChannelMessageReaction[]> {
  const reactions = new Map();
  for (const reaction of newsletterReactions) {
    const key = reaction.parentMsgKey._serialized;
    const emojiCountMap = reaction.emojiCountMap;
    const reactionList: ChannelMessageReaction[] = [];
    for (const emoji in emojiCountMap) {
      reactionList.push({
        reaction: emoji,
        count: emojiCountMap[emoji],
      });
    }
    reactions.set(key, reactionList);
  }
  return reactions;
}

export class WebjsClientPlus extends WebjsClientCore {
  async injectWaha(): Promise<void> {
    await super.injectWaha();
    await this.pupPage.evaluate(LoadWAHAPlus);
  }

  /**
   * Channels methods
   */
  async channelFetchMessageByInvite(
    inviteCode: string,
    limit: number,
  ): Promise<WebjsChannelMessage[]> {
    const response: _GetNewsletterPreviewDataResponse =
      await this.pupPage.evaluate(
        async (code, limit) => {
          // Overwrite limit
          window['WAHA'].WAWebNewsletterGatingUtils = () => limit;

          const result = await window[
            'WAHA'
          ].WAWebNewsletterPreviewJob.getNewsletterPreviewData(code, 'guest');
          for (const newsletterReaction of result.newsletterReactions) {
            // puppeter doesn't support Map,
            // so we need to convert it to object
            newsletterReaction.emojiCountMap = Object.fromEntries(
              newsletterReaction.emojiCountMap,
            );
          }

          // Fetch one more time to save in database so we can fetch media later
          await window[
            'WAHA'
          ].WAWebLoadNewsletterPreviewChatAction.loadNewsletterPreviewChat(
            code,
          );
          return result;
        },
        inviteCode,
        limit,
      );
    const messageInstances = response.newsletterMessages
      .filter((msg) => msg.type != 'revoked')
      .map((msg) => {
        return new MessageInstance(this, msg);
      });
    const reactions = extractReactionsByMessageKey(
      response.newsletterReactions,
    );

    const messages: WebjsChannelMessage[] = messageInstances.map((msg) => {
      return {
        message: msg,
        reactions: reactions.get(msg.id._serialized) || [],
        viewCount: msg.rawData.viewCount,
      };
    });
    return messages;
  }

  /**
   * Channels Search methods
   */
  async searchChannelsView(params: any): Promise<any> {
    const newsletters: any = await this.pupPage.evaluate(async (params) => {
      return await window[
        'WAHA'
      ].WAWebNewsletterDirectorySearchJob.getNewsletterDirectoryList(params);
    }, params);
    return newsletters;
  }

  async searchChannelsText(params: any): Promise<any> {
    const newsletters: any = await this.pupPage.evaluate(async (params) => {
      return await window[
        'WAHA'
      ].WAWebNewsletterDirectorySearchJob.getNewsletterDirectorySearchResults(
        params,
      );
    }, params);
    return newsletters;
  }
}
