// Cloudflare Pages Function：游戏页面同域名下的 /realm 入口，转发到 eorzea-realm Worker 中的房间
import { routeRealm } from '../realm/src/route.js';

export const onRequest = ({ request, env }) => routeRealm(request, env.REALM) || new Response('Not found', { status: 404 });
