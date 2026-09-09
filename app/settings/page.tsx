import React from 'react';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { Database, ShieldCheck, KeyRound, Cpu, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
  const supabaseClientConfigured = isSupabaseConfigured();
  const supabaseAdminConfigured = isSupabaseAdminConfigured();
  const embeddingProvider = process.env.EMBEDDING_PROVIDER || 'mock';
  const hasEmbeddingKey = !!process.env.EMBEDDING_API_KEY && process.env.EMBEDDING_API_KEY.length > 5;
  const hasReplicateToken = !!process.env.REPLICATE_API_TOKEN && process.env.REPLICATE_API_TOKEN.length > 5;

  const envItems = [
    {
      name: 'NEXT_PUBLIC_SUPABASE_URL',
      desc: 'Supabase 프로젝트 기본 REST/DB 엔드포인트 URL',
      configured: supabaseClientConfigured,
      exposure: 'Public (Client-side 안전)',
    },
    {
      name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      desc: 'Supabase 익명 공개 API 키',
      configured: supabaseClientConfigured,
      exposure: 'Public (Client-side 안전)',
    },
    {
      name: 'SUPABASE_SERVICE_ROLE_KEY',
      desc: 'Supabase 백엔드 관리자 전용 시크릿 키 (Storage & DB 인덱싱 권한)',
      configured: supabaseAdminConfigured,
      exposure: 'Private (서버 전용, 절대 Client 미노출)',
    },
    {
      name: `EMBEDDING_PROVIDER (${embeddingProvider})`,
      desc: '임베딩 프로바이더 (openai / gemini / mock)',
      configured: embeddingProvider === 'mock' || hasEmbeddingKey,
      exposure: embeddingProvider === 'mock' ? 'Mock Test Mode' : 'Private (서버 전용)',
    },
    {
      name: 'REPLICATE_API_TOKEN',
      desc: 'Replicate AI 토큰 (datalab-to/marker 논문·문서 OCR 연동용, replicate.com/account/api-tokens)',
      configured: hasReplicateToken,
      exposure: 'Private (서버 전용, 절대 Client 미노출)',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">시스템 연동 및 환경 설정</h1>
        <p className="text-xs text-slate-500 mt-1">
          Supabase 데이터베이스, 스토리지 및 임베딩 어댑터의 환경변수 연결 상태를 확인합니다.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-200 overflow-hidden">
        <div className="p-5 bg-slate-50/50">
          <h2 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-slate-600" />
            핵심 환경변수 연결 점검
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            보안 원칙에 따라 시크릿 키의 원문은 브라우저에 노출되지 않으며 설정 여부만 검증합니다.
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {envItems.map((item, idx) => (
            <div key={idx} className="p-4 flex items-center justify-between gap-4">
              <div>
                <div className="font-mono text-xs font-semibold text-slate-800">
                  {item.name}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{item.exposure}</div>
              </div>
              <div className="shrink-0">
                {item.configured ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    연결됨
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    설정 필요
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <h2 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
          <Database className="w-4 h-4 text-sky-600" />
          데이터베이스 마이그레이션 안내
        </h2>
        <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
          <p>
            Supabase 대시보드의 <strong>SQL Editor</strong>에서 다음 파일의 내용을 실행하면 필수 테이블, 인덱스, pgvector 확장 및 4대 도메인 시드 데이터가 자동 구성됩니다:
          </p>
          <div className="p-3 bg-slate-900 text-slate-200 rounded-lg font-mono text-xs overflow-x-auto">
            supabase/migrations/001_initial_schema.sql
          </div>
        </div>
      </div>
    </div>
  );
}
