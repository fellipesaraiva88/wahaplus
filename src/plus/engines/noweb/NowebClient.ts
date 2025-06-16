import makeWASocket, {
  BinaryNode,
  getBinaryNodeChild,
  QueryIds,
} from '@adiwajshing/baileys';
import { toNewsletterMetadata } from '@adiwajshing/baileys/lib/Socket/newsletter';
import { NewsletterMetadata } from '@adiwajshing/baileys/lib/Types';
import {
  ChannelPagination,
  ChannelSearchByText,
  ChannelSearchByView,
} from '@waha/structures/channels.dto';

enum NewsletterMexQueryIds {
  NEWSLETTERS_DIRECTORY_LIST = '6190824427689257',
  NEWSLETTERS_DIRECTORY_SEARCH = '6802402206520139',
}

enum NewsletterXWAPaths {
  NEWSLETTERS_DIRECTORY_LIST = 'xwa2_newsletters_directory_list',
  NEWSLETTERS_DIRECTORY_SEARCH = 'xwa2_newsletters_directory_search',
}

/**
 * NowebClient - wrapper around baileys to have more methods
 */

export interface NewsletterSearchResponse {
  page: ChannelPagination;
  newsletters: NewsletterMetadata[];
}

export class NowebClient {
  constructor(private sock: ReturnType<typeof makeWASocket>) {}

  async searchChannelsByView(
    query: ChannelSearchByView,
  ): Promise<NewsletterSearchResponse> {
    const variables = {
      input: {
        view: query.view,
        filters: {
          country_codes: query.countries,
          categories: query.categories,
        },
        limit: query.limit,
        start_cursor: query.startCursor,
      },
    };
    const queryId =
      NewsletterMexQueryIds.NEWSLETTERS_DIRECTORY_LIST as unknown as QueryIds;
    const path = NewsletterXWAPaths.NEWSLETTERS_DIRECTORY_LIST;
    const response = await this.sock.newsletterWMexQuery(
      undefined,
      queryId,
      variables,
    );
    return parseNewsletterSearchNode(response, path);
  }

  async searchChannelsByText(
    query: ChannelSearchByText,
  ): Promise<NewsletterSearchResponse> {
    const variables = {
      input: {
        search_text: query.text,
        categories: query.categories,
        limit: query.limit,
        start_cursor: query.startCursor,
      },
    };
    const queryId =
      NewsletterMexQueryIds.NEWSLETTERS_DIRECTORY_SEARCH as unknown as QueryIds;
    const path = NewsletterXWAPaths.NEWSLETTERS_DIRECTORY_SEARCH;
    const response = await this.sock.newsletterWMexQuery(
      undefined,
      queryId,
      variables,
    );
    return parseNewsletterSearchNode(response, path);
  }
}

function parseNewsletterSearchNode(
  node: BinaryNode,
  path: string,
): NewsletterSearchResponse {
  const result = getBinaryNodeChild(node, 'result')?.content?.toString();
  if (!result) {
    throw new Error('Invalid node - no result');
  }

  const content: any = JSON.parse(result);
  if (content.errors) {
    throw new Error(`Error 'content' received from server: ${result}`);
  }
  const data = content.data;
  if (!data) {
    throw new Error('Invalid node - no path');
  }
  const response = data[path];
  if (!response) {
    throw new Error(`Invalid node - no path '${path}' found`);
  }
  const pageInfo = response.page_info;
  const page: ChannelPagination = {
    startCursor: pageInfo.startCursor,
    endCursor: pageInfo.endCursor,
    hasNextPage: pageInfo.hasNextPage,
    hasPreviousPage: pageInfo.hasPreviousPage,
  };
  const newsletterResult: any[] = response.result;
  const newsletters = newsletterResult.map(toNewsletterMetadata);

  return {
    page: page,
    newsletters: newsletters,
  };
}
