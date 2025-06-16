import { INestApplication } from '@nestjs/common';

import { SwaggerConfiguratorCore } from '../core/SwaggerConfiguratorCore';
import { BasicAuthFunction } from './auth/basicAuth';
import { DashboardConfigServicePlus } from './config/DashboardConfigServicePlus';
import { SwaggerConfigServicePlus } from './config/SwaggerConfigServicePlus';

export class SwaggerConfiguratorPlus extends SwaggerConfiguratorCore {
  private config: SwaggerConfigServicePlus;

  constructor(protected app: INestApplication) {
    super(app);
    this.config = app.get(SwaggerConfigServicePlus);
  }

  get title() {
    return this.config.title || super.title;
  }

  get description() {
    return this.config.description || super.description;
  }

  get externalDocUrl() {
    return this.config.externalDocUrl || super.externalDocUrl;
  }

  configure(webhooks: any[]) {
    if (!this.config.enabled) {
      return;
    }

    const credentials = this.config.credentials;
    if (credentials) {
      this.setUpAuth(credentials);
    }
    super.configure(webhooks);
  }

  setUpAuth(credentials: [string, string]): void {
    const [username, password] = credentials;
    const dashboardConfig = this.app.get(DashboardConfigServicePlus);
    const authFunction = BasicAuthFunction(username, password, [
      '/api/',
      dashboardConfig.dashboardUri,
      '/health',
    ]);
    this.app.use(authFunction);
  }
}
