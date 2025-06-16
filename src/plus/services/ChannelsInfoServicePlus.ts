import { Injectable } from '@nestjs/common';
import { ChannelsInfoServiceCore } from '@waha/core/services/ChannelsInfoServiceCore';
import { CategoriesByValue } from '@waha/plus/services/channels.categories';
import { CountriesByCode } from '@waha/plus/services/channels.countries';
import { ViewsByValue } from '@waha/plus/services/channels.views';
import {
  ChannelCategory,
  ChannelCountry,
  ChannelView,
} from '@waha/structures/channels.dto';

const COUNTRIES: ChannelCountry[] = Object.entries(CountriesByCode).map(
  ([key, value]) => ({ code: key, name: value }),
);

const CATEGORIES: ChannelCategory[] = Object.entries(CategoriesByValue).map(
  ([key, value]) => ({ value: key, name: value }),
);

const VIEWS: ChannelView[] = Object.entries(ViewsByValue).map(
  ([key, value]) => ({ value: key, name: value }),
);

@Injectable()
export class ChannelsInfoServicePlus extends ChannelsInfoServiceCore {
  async getCountries(): Promise<ChannelCountry[]> {
    return COUNTRIES;
  }

  async getCategories(): Promise<ChannelCategory[]> {
    return CATEGORIES;
  }

  async getViews(): Promise<ChannelView[]> {
    return VIEWS;
  }
}
