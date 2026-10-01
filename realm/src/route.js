// 把 /realm?zone=xxx 的 WebSocket 请求转发给对应地图的房间（每张地图一个 Durable Object）
import { NET_ZONES } from '../../js/protocol.js';

export function routeRealm(request, ns) {
  const url = new URL(request.url);
  if (url.pathname !== '/realm') return null;
  if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
  const zone = url.searchParams.get('zone');
  if (!NET_ZONES.includes(zone)) return new Response('Unknown zone', { status: 400 });
  return ns.get(ns.idFromName('zone:' + zone)).fetch(request);
}
