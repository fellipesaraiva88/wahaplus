import { WebSocketGateway } from '@nestjs/websockets';
import { WebsocketGatewayCore } from '@waha/core/api/websocket.gateway.core';
import { WebSocketAuth } from '@waha/plus/auth/WebSocketAuth';

@WebSocketGateway({
  path: '/ws',
  cors: true,
  verifyClient: new WebSocketAuth().verifyClient,
})
export class WebsocketGatewayPlus extends WebsocketGatewayCore {}
