// Simple WebSocket notification service for new bids and monitor status/errors
// This is a minimal in-memory implementation for dev/testing

import { WebSocketServer, WebSocket } from 'ws';

// Map: auctionId-lotId => Set of WebSocket clients
const wsClients = new Map<string, Set<WebSocket>>();

export function getWsKey(auctionId: number, lotId: number) {
  return `${auctionId}-${lotId}`;
}

export function setupWebSocketServer(server: any) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket, req) => {
    // Parse auctionId and lotId from query string
    const url = new URL(req.url, 'http://localhost');
    const auctionId = url.searchParams.get('auctionId');
    const lotId = url.searchParams.get('lotId');
    if (!auctionId || !lotId) {
      ws.close();
      return;
    }
    const key = getWsKey(Number(auctionId), Number(lotId));
    if (!wsClients.has(key)) wsClients.set(key, new Set());
    wsClients.get(key)!.add(ws);

    ws.on('close', () => {
      wsClients.get(key)?.delete(ws);
      if (wsClients.get(key)?.size === 0) wsClients.delete(key);
    });
  });
}

export function wsNotifyBid(auctionId: number, lotId: number, bid: any) {
  const key = getWsKey(auctionId, lotId);
  const clients = wsClients.get(key);
  if (!clients) return;
  const msg = JSON.stringify({ type: 'bid', bid });
  for (const ws of clients) {
    ws.send(msg);
  }
}

export function wsNotifyStatus(auctionId: number, lotId: number, status: string, error?: any) {
  const key = getWsKey(auctionId, lotId);
  const clients = wsClients.get(key);
  if (!clients) return;
  const msg = JSON.stringify({ type: 'status', status, error });
  for (const ws of clients) {
    ws.send(msg);
  }
}
