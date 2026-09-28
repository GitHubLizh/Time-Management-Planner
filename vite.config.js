import { resolve } from "node:path";

/* 两个入口：index.html 是桌面壳，mobile.html 是移动壳。
   它们共用 src/core（无 DOM 的业务层），但互不加载对方的视图代码——
   手机上不应该下载并解析 1300 行桌面模板。 */
export default {
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        mobile: resolve(import.meta.dirname, "mobile.html"),
      },
    },
  },
};
