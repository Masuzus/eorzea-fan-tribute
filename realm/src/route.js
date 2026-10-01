// 把 /realm?zone=xxx 的 WebSocket 请求转发给对应的房间（Durable Object）：
// 城镇与野外各一个房间；副本每个实例一个房间；任务搜索器一个排队房间
import { NET_ZONES, INST_RE } from '../../js/protocol.js';

export function routeRealm(request, ns) {
  const url = new URL(request.url);
  if (url.pathname !== '/realm') return null;
  if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
  const zone = url.searchParams.get('zone');
  let name;
  if (NET_ZONES.includes(zone)) name = 'zone:' + zone;
  else if (zone === 'queue') name = 'queue';
  else if (zone === 'dungeon' && INST_RE.test(url.searchParams.get('inst') || '')) name = 'duty:' + url.searchParams.get('inst');
  else return new Response('Unknown zone', { status: 400 });
  return ns.get(ns.idFromName(name)).fetch(request);
}
