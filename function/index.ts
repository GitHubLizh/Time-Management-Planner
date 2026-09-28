/* 同域反向代理：让浏览器只需要能访问本站域名，由服务端转发到 Supabase。
   动机是实测事实：手机网络到不了 *.supabase.co（Failed to fetch），而本站 edge 运行时可达
   （探针返回 upstreamStatus 200）。将来做小程序也是这个形态（微信要求备案域名白名单）。

   安全边界（三条都是硬约束）：
   1. 上游地址只来自服务端 Secret，调用方无法指定目标 —— 避免变成带凭据的任意中继。
   2. 只放行 /auth/v1/* 与 /rest/v1/* 两个前缀，其余一律 404；请求体设上限。
   3. 只转发客户端本来就持有的 apikey(anon) 与用户 JWT，不注入任何服务端提权凭据，
      因此行级安全(RLS)仍由 Supabase 判定，代理不提权也不绕过。 */

const UPSTREAM = (Deno.env.get("PLANNER_UPSTREAM_URL") || "").replace(/\/+$/, "");
const ANON_KEY = Deno.env.get("PLANNER_ANON_KEY") || "";
const ALLOW_PREFIXES = ["/auth/v1/", "/rest/v1/"];
const MAX_BODY = 2 * 1024 * 1024; // 状态整份 JSON 远小于此，超限直接拒
const TIMEOUT_MS = 15000;

// 转发这些请求头；其余（含 Cookie、x-qoder-*、宿主相关头）一律丢弃
const FORWARD_REQ = ["authorization", "apikey", "content-type", "accept", "accept-profile",
  "content-profile", "prefer", "x-client-info", "range"];
// 回传这些响应头；上游的服务器信息不外泄
const FORWARD_RES = ["content-type", "content-range", "prefer", "x-supabase-api-version"];

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/* 逻辑入口是 /functions/v1/app/<后缀>，但网关会把名字段换成上游物理名，
   所以不能按 "app" 字符串定位 —— 剥掉前三段即可，逻辑名与物理名都成立。 */
function subPath(url: string) {
  const p = new URL(url).pathname;
  const m = p.match(/^\/functions\/v1\/[^/]+(\/.*)?$/);
  if (m) return m[1] || "/";
  return p.startsWith("/") ? p : "/" + p;
}

Deno.serve(async (req: Request) => {
  if (!UPSTREAM || !ANON_KEY) return json({ error: "service_not_configured" }, 503);

  const path = subPath(req.url);
  if (path === "/probe" || path === "/probe/") {
    // 保留探针：部署后用它判断"服务端是否可达上游"，不暴露上游地址与异常原文
    try {
      const r = await fetch(UPSTREAM + "/auth/v1/health", {
        headers: { apikey: ANON_KEY, Authorization: "Bearer " + ANON_KEY },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      return json({ ok: true, upstreamStatus: r.status }, 200);
    } catch (e) {
      const name = (e && (e as Error).name) || "unknown";
      return json({ ok: false, error: "upstream_unreachable", kind: name === "AbortError" ? "timeout" : "connect" }, 502);
    }
  }
  if (!ALLOW_PREFIXES.some(pre => path.startsWith(pre))) {
    // 回显解析出的子路径（来自调用方自己的 URL），路径规则出错时可一次请求定位
    return json({ error: "not_found", path }, 404);
  }

  const headers: Record<string, string> = {};
  for (const k of FORWARD_REQ) {
    const v = req.headers.get(k);
    if (v) headers[k] = v;
  }
  // 客户端没带 apikey 时补 anon key（浏览器里 supabase-js 本来就会带，这里只为容错）
  if (!headers.apikey) { headers.apikey = ANON_KEY; }

  let body: ArrayBuffer | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const len = Number(req.headers.get("content-length") || 0);
    if (len > MAX_BODY) return json({ error: "payload_too_large" }, 413);
    const buf = await req.arrayBuffer();
    if (buf.byteLength > MAX_BODY) return json({ error: "payload_too_large" }, 413);
    if (buf.byteLength) body = buf;
  }

  const query = new URL(req.url).search;
  try {
    const up = await fetch(UPSTREAM + path + query, {
      method: req.method, headers, body, redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const out = new Headers();
    for (const k of FORWARD_RES) {
      const v = up.headers.get(k);
      if (v) out.set(k, v);
    }
    out.set("cache-control", "no-store");
    return new Response(up.body, { status: up.status, statusText: up.statusText, headers: out });
  } catch (e) {
    const name = (e && (e as Error).name) || "unknown";
    return json({ error: name === "AbortError" ? "upstream_timeout" : "upstream_unreachable" }, 502);
  }
});
