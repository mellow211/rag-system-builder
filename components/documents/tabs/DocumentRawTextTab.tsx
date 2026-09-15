'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Download, Copy, Check, Loader2, AlertCircle } from 'lucide-react';

interface DocumentRawTextTabProps {
  documentId: string;
}

export const DocumentRawTextTab: React.FC<DocumentRawTextTabProps> = ({ documentId }) => {
  const [text, setText] = useState<string>('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const loadRaw = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/documents/${documentId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '원문 정보를 가져오지 못했습니다.');

        if (isMounted) {
          setDownloadUrl(data.downloadUrl || null);
          setFilename(data.document?.filename || 'document');

          // 청크 프리뷰에서 원문 텍스트 복원
          const chunkRes = await fetch(`/api/documents/${documentId}/chunk`);
          const chunkData = await chunkRes.json();
          if (chunkData?.v1?.chunks) {
            const full = chunkData.v1.chunks.map((c: any) => c.content).join('\n\n---\n\n');
            setText(full);
          } else if (chunkData?.v2?.chunks) {
            const full = chunkData.v2.chunks.map((c: any) => c.content).join('\n\n---\n\n');
            setText(full);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : '원문 조회 실패');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadRaw();
    return () => {
      isMounted = false;
    };
  }, [documentId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto mb-2" />
        <p className="text-xs text-slate-500">원문 텍스트를 불러오는 중입니다...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-slate-600" />
          <h3 className="text-sm font-bold text-slate-900">추출된 원문 텍스트</h3>
          <span className="text-xs text-slate-400">({text.length.toLocaleString()}자)</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {isCopied ? '복사됨' : '원문 복사'}
          </button>

          {downloadUrl && (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={filename}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              원본 파일 다운로드
            </a>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 max-h-[600px] overflow-y-auto">
        <pre className="text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
          {text || '추출된 텍스트가 없습니다. 상단 [Replicate AI OCR]을 실행해 보세요.'}
        </pre>
      </div>
    </div>
  );
};
