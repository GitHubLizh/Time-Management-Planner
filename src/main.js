import { createClient } from '@supabase/supabase-js';
import './planner.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  document.body.classList.add('auth-locked');
  document.querySelector('#authMessage').textContent = '请在 .env 中配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。';
  document.querySelectorAll('#authForm input, #authForm button, #authMode, #authOtp').forEach((element) => {
    element.disabled = true;
  });
} else {
  window.bootstrapPlanner(createClient(url, anonKey));
}
