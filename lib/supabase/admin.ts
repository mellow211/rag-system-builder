import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-service-key';

export const isSupabaseAdminConfigured = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return (
    !!url &&
    !url.includes('placeholder') &&
    !!key &&
    !key.includes('placeholder')
  );
};

// 서버 사이드 전용 관리자 클라이언트 (Service Role Key)
export const getSupabaseAdmin = () => {
  if (typeof window !== 'undefined') {
    throw new Error('보안 경고: supabaseAdmin은 서버 환경에서만 호출되어야 합니다.');
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-service-key';
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};
