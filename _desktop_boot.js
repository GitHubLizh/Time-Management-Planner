/* 桌面版的免登录探针入口：用一份假 Supabase client 把 planner.js 起来，
   只为在浏览器里驱动真实的弹窗/渲染链路，不读也不写任何真实数据。
   配套页是仓库根的 _desktop_frame.html（index.html 去掉分流 shim、把 import 换成这一份）。
   与 _mobile_frame.html 同一性质：验证工具，不是产品代码。 */
import "/src/planner.js";

const user = { id: "probe", email: "probe@example.com" };

/* 链式查询一律回空行：decideInitialSource 于是落到"本机缓存或空白"，
   upsert/insert 收下来当成功，saveRemote 走完整时序但不出网。 */
function fakeTable() {
  const t = {
    select() { return t; },
    eq() { return t; },
    order() { return t; },
    maybeSingle: async () => ({ data: null, error: null }),
    upsert: async () => ({ error: null }),
    insert: async () => ({ error: null }),
    update: () => t,
    delete: () => t,
    then: (res) => res({ data: [], error: null }), // 被 await 时回空数组
  };
  return t;
}

const client = {
  from: () => fakeTable(),
  auth: {
    getSession: async () => ({ data: { session: { user, access_token: "probe-token" } }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() { } } } }),
    signOut: async () => ({ error: null }),
    signInWithPassword: async () => ({ data: null, error: { message: "探针不允许真登录" } }),
  },
};

window.bootstrapPlanner(client, { url: "http://probe.invalid", anonKey: "probe" });
