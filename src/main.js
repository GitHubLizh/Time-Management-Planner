import { createClient } from '@supabase/supabase-js';
import './planner.js';
import { resolveSupabaseBase } from './endpoint.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  document.body.classList.add('auth-locked');
  document.querySelector('#authMessage').textContent = '请在 .env 中配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。';
  document.querySelectorAll('#authForm input, #authForm button, #authMode, #authOtp').forEach((element) => {
    element.disabled = true;
  });
} else {
  // 部署在站点域下时走同域代理（手机网络到不了 *.supabase.co），本地 dev 仍直连
  const base = resolveSupabaseBase(url);
  window.bootstrapPlanner(createClient(base, anonKey), { url: base, anonKey });
}
