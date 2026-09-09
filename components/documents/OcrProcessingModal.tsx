'use client';

import React from 'react';
import { ScanLine, Loader2, XCircle, CheckCircle2, FileText, Sparkles, Cpu } from 'lucide-react';

export interface OcrModalProgress {
  stage: 'preparing' | 'processing' | 'chunking' | 'completed' | 'error';
  percent: number; // 0 ~ 100
  statusMessage: string;
  previewText?: string;
  chunksCount?: number;
}

interface OcrProcessingModalProps {
  isOpen: boolean;
  documentTitle: string;
  progress: OcrModalProgress | null;
  onCancel?: () => void;
  isCompleted?: boolean;
}

export const OcrProcessingModal: React.FC<OcrProcessingModalProps> = ({
  isOpen,
  documentTitle,
  progress,
  onCancel,
  isCompleted = false,
}) => {
  if (!isOpen) return null;

  const percent = progress?.percent || 0;
  const statusMessage = progress?.statusMessage || 'Replicate AI OCR 엔진 준비 중...';
  const previewText = progress?.previewText;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600 shrink-0">
              {isCompleted ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <ScanLine className="w-5 h-5 animate-pulse text-violet-600" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">
                  {isCompleted ? 'AI 문서 OCR 인덱싱 완료' : 'Replicate AI 문서 OCR (Marker) 실행 중'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-700">
                  Marker AI
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs sm:max-w-sm">
                {documentTitle}
              </p>
            </div>
          </div>

          {!isCompleted && onCancel && (
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
              title="취소"
            >
              <XCircle className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-700 flex items-center gap-1.5">
                {!isCompleted && <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-600" />}
                {statusMessage}
              </span>
              <span className="text-violet-700 font-mono">{percent}%</span>
            </div>

            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
              <div
                className="h-full bg-linear-to-r from-violet-500 to-indigo-600 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>

            <div className="flex justify-between text-[11px] text-slate-400">
              <span>엔진: datalab-to/marker (GPU 고속 변환)</span>
              <span>다단/표/수식/아웃라인 폰트 복원</span>
            </div>
          </div>

          {/* Live Text Preview */}
          {previewText && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>추출된 구조화 Markdown 본문 미리보기</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 font-mono leading-relaxed line-clamp-3 select-none">
                {previewText}
              </div>
            </div>
          )}

          {/* Notice Box */}
          <div className="p-3.5 bg-violet-50/70 rounded-xl border border-violet-200/80 flex items-start gap-2.5 text-xs text-violet-900 leading-relaxed">
            <Cpu className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
            <div>
              <strong>Replicate Cloud AI 연동</strong>: GPT-4o 대비 5배 이상 저렴한 전문 문서 AI 파서로 본문 텍스트를 마크다운 구조로 복원한 뒤, 슬라이딩 윈도우 청크 및 1536차원 벡터로 자동 인덱싱합니다.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
          {!isCompleted ? (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-all"
            >
              닫기
            </button>
          ) : (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-xs transition-all"
            >
              확인
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
