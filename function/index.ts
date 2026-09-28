/* 探针函数（方案 B 的 B1/B3 步）：唯一目的是回答"站点的 edge 运行时能不能出网到 Supabase"。
   这个前提不成立，反代方案就直接作废，所以先花最小代价验证它，再动两端的代码。

   安全边界：
   - 上游地址只来自服务端 Secret，绝不接受调用方传入的目标（避免变成带凭据的任意中继）。
   - 只认一个固定路径，其余一律 404；只接受 GET，探针不写任何状态。
   - 响应只回状态与是否可达，不回显 Secret、不回显上游异常原文。 */

const UPSTREAM = (Deno.env.get("PLANNER_UPSTREAM_URL") || "").replace(/\/+$/, "");
const ANON_KEY = Deno.env.get("PLANNER_ANON_KEY") || "";

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

Deno.serve(async (req: Request) => {
  // 网关会把逻辑名 app 换成上游名并保留后缀，所以只匹配后缀，不假设完整路径
  const path = new URL(req.url).pathname;
  if (!/\/probe\/?$/.test(path)) return json({ error: "not_found" }, 404);
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  if (!UPSTREAM || !ANON_KEY) return json({ ok: false, error: "service_not_configured" }, 503);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(UPSTREAM + "/auth/v1/health", {
      method: "GET",
      headers: { apikey: ANON_KEY, Authorization: "Bearer " + ANON_KEY },
      signal: controller.signal,
    });
    return json({ ok: true, upstreamStatus: res.status }, 200);
  } catch (e) {
    // 只报失败类别：AbortError=超时，其他=连接层失败。不带上游异常原文，避免泄露内部信息。
    const name = (e && (e as Error).name) || "unknown";
    return json({ ok: false, error: "upstream_unreachable", kind: name === "AbortError" ? "timeout" : "connect" }, 502);
  } finally {
    clearTimeout(timer);
  }
});
