/* 从壳源码里反推它 import 了 core 的哪些符号，生成可直接挂进 vm 全局的种子对象。
   关键点：认别名（`deleteTask as deleteTaskData`），否则壳在 vm 里会调到 undefined。
   _recur_test.js 与 _golden_render.mjs 共用这一份，避免两边的符号表各自漂移。 */
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function seedFromCoreImports(src){
  const map={};
  const bind=(name,mod,key)=>{
    /* 用访问器而不是取值：ESM 的导出是 live binding，壳里 `state` 会被 core 的 setState
       重新赋值，直接 map[name]=mod[key] 会把它冻结成拷贝时的 undefined。 */
    Object.defineProperty(map,name,{get:()=>mod[key],enumerable:true,configurable:true});
  };
  // 组内不允许出现 } 或引号：否则 [\s\S]*? 会越过前一条 import 把两条吞成一组
  const re=/import\s*\{([^}"']*)\}\s*from\s*"(\.\/core\/[^"]+)";/g;
  for(const m of src.matchAll(re)){
    const resolved=path.resolve("src",m[2].slice(2));
    const mod=await import(pathToFileURL(resolved).href);
    /* 整个模块的导出都按原名挂上：测试还会直接调用壳没引用的 core 函数
       （例如 occursOn、bulkToggleDone），只挂壳引用的名字会漏。 */
    for(const k of Object.keys(mod))if(!(k in map))bind(k,mod,k);
    for(const raw of m[1].split(",")){
      const spec=raw.trim();
      if(!spec)continue;
      const [orig,alias]=spec.split(/\s+as\s+/).map(s=>s.trim());
      if(!(orig in mod))throw new Error(`core 里没有导出 ${orig}（来自 ${m[2]}）`);
      if(alias)bind(alias,mod,orig); // 壳里的别名调用点也要能解析
    }
  }
  return map;
}
