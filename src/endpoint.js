/* 决定"浏览器该把 Supabase 请求发到哪"。
   实测事实：手机网络到不了 *.supabase.co，但本站 edge 运行时可达，所以部署态走同域代理；
   本地 dev 没有函数运行时，仍直连，否则开发环境会全线报错。
   两端共用这一份，避免桌面与移动各自判断导致行为分叉。

   逃生阀：URL 上加 ?direct=1 强制直连（排查代理问题时用），偏好记在 sessionStorage。 */
const PROXY_SUFFIX = "/functions/v1/app";
const PROXY_HOSTS = /\.qoder\.zone$/i;

export function resolveSupabaseBase(directUrl) {
  const host = location.hostname;
  let forceDirect = false;
  try {
    if (/[?&]direct=1/.test(location.search)) sessionStorage.setItem("planner.direct", "1");
    forceDirect = sessionStorage.getItem("planner.direct") === "1";
  } catch (e) { }
  if (forceDirect) return directUrl;
  return PROXY_HOSTS.test(host) ? location.origin + PROXY_SUFFIX : directUrl;
}
