// ============================================================
// Cloudflare Worker — Yahoo Finance CORS Proxy
// 部署方式：登入 Cloudflare Dashboard → Workers & Pages → Create Worker → 貼上此內容 → Deploy
// 部署後取得 URL（如 https://yahoo-proxy.你的帳號.workers.dev），填入 js/config.js
// ============================================================

export default {
  async fetch(request) {
    // 只處理 GET 請求
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get('url');

    if (!target) {
      return new Response('Missing "url" query parameter', { status: 400 });
    }

    // 安全限制：只允許轉發 Yahoo Finance 的請求，防止被濫用成通用代理
    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return new Response('Invalid URL', { status: 400 });
    }

    if (!targetUrl.hostname.endsWith('yahoo.com')) {
      return new Response('Forbidden: only yahoo.com is allowed', { status: 403 });
    }

    try {
      const res = await fetch(target, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      const body = await res.text();

      return new Response(body, {
        status: res.status,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Cache-Control': 'no-store',
        },
      });
    } catch (err) {
      return new Response(`Proxy fetch failed: ${err.message}`, { status: 502 });
    }
  },
};
