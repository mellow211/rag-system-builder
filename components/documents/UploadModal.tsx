'use client';

import React, { useState, useRef } from 'react';
import { DomainType, DocumentType, DOMAIN_CONFIGS } from '@/types/rag';
import { formatBytes } from '@/lib/utils';
import { X, Upload, FileText, CheckCircle2, AlertCircle, Loader2, ScanLine, Sparkles } from 'lucide-react';
import { runBrowserOcr, OcrProgress } from '@/lib/ocr/browser-ocr';
import { OcrProcessingModal } from '@/components/documents/OcrProcessingModal';

interface UploadModalProps {
  currentDomain: DomainType;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  currentDomain,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [domain, setDomain] = useState<DomainType>(currentDomain);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState('');
  const [publisher, setPublisher] = useState('');
  const [publishedAt, setPublishedAt] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('가이드라인');
  const [sourceUrl, setSourceUrl] = useState('');
  const [keywords, setKeywords] = useState('');
  const [description, setDescription] = useState('');

  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusStep, setStatusStep] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // OCR 연계 상태
  const [scannedDocId, setScannedDocId] = useState<string | null>(null);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  if (!isOpen) return null;

  const allowedExtensions = ['.pdf', '.txt', '.md', '.markdown'];
  const maxFileSize = 50 * 1024 * 1024; // 50MB

  const handleFileSelect = (selectedFile: File) => {
    setErrorMessage(null);
    const ext = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      setErrorMessage('지원하지 않는 파일 형식입니다. (PDF, TXT, MD 파일만 업로드 가능)');
      return;
    }
    if (selectedFile.size > maxFileSize) {
      setErrorMessage(`파일 크기는 최대 50MB를 초과할 수 없습니다. (현재: ${formatBytes(selectedFile.size)})`);
      return;
    }
    setFile(selectedFile);
    if (!title) {
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
      setTitle(baseName);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!file) {
      setErrorMessage('업로드할 파일을 선택해 주세요.');
      return;
    }
    if (!title.trim()) {
      setErrorMessage('문서 제목을 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const keywordsList = keywords
        ? keywords.split(',').map((k) => k.trim()).filter(Boolean)
        : [];

      // 1단계: Signed Upload URL 발급 요청 (메타데이터 선등록)
      setStatusStep('업로드 준비 중 (Vercel 용량 제한 우회)...');
      const prepRes = await fetch('/api/documents/prepare-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          fileSize: file.size,
          fileType: file.type || 'application/octet-stream',
          title: title.trim(),
          domain,
          source,
          publisher,
          publishedAt,
          documentType,
          sourceUrl,
          keywords: keywordsList,
          description,
        }),
      });

      const prepText = await prepRes.text();
      let prepData: any;
      try {
        prepData = JSON.parse(prepText);
      } catch {
        if (prepRes.status === 413) {
          throw new Error('요청 크기가 한도를 초과했습니다 (413 Payload Too Large).');
        }
        throw new Error(`서버 응답 오류 (${prepRes.status}): ${prepText.slice(0, 100)}`);
      }

      if (!prepRes.ok) {
        throw new Error(prepData.error || '업로드 준비에 실패했습니다.');
      }

      const { documentId, signedUrl } = prepData;

      // 2단계: Supabase Storage로 다이렉트 바이너리 업로드 (Vercel 4.5MB 제한 우회)
      if (signedUrl) {
        setStatusStep(`스토리지로 파일 직접 전송 중 (${formatBytes(file.size)})...`);
        const uploadRes = await fetch(signedUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: file,
        });

        if (!uploadRes.ok) {
          const upErr = await uploadRes.text();
          throw new Error(`스토리지 직접 업로드 실패 (${uploadRes.status}): ${upErr.slice(0, 100)}`);
        }
      }

      // 3단계: 텍스트 추출, 청킹 및 임베딩 인덱싱 실행
      setStatusStep('텍스트 추출, 청킹 및 pgvector 인덱싱 중...');
      const processRes = await fetch(`/api/documents/${documentId}/process`, {
        method: 'POST',
      });

      const processText = await processRes.text();
      let processData: any;
      try {
        processData = JSON.parse(processText);
      } catch {
        throw new Error(`인덱싱 응답 오류 (${processRes.status})`);
      }

      if (!processRes.ok) {
        if (processData?.error?.includes('스캔 이미지') || processData?.error?.includes('윤곽선')) {
          setScannedDocId(documentId);
        }
        throw new Error(processData.error || '문서 인덱싱 처리에 실패했습니다.');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '업로드 중 오류가 발생했습니다.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
      setStatusStep(null);
    }
  };

  const handleTriggerOcrFromModal = async () => {
    if (!file || !scannedDocId) return;
    setIsOcrModalOpen(true);
    setErrorMessage(null);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const ocrResult = await runBrowserOcr(
        file,
        (progress) => setOcrProgress(progress),
        abortController.signal
      );

      setOcrProgress({
        currentPage: ocrResult.totalPages,
        totalPages: ocrResult.totalPages,
        stage: 'completed',
        percent: 95,
        statusMessage: '추출된 텍스트 단락 청킹 및 pgvector 임베딩 저장 중...',
      });

      const ingestRes = await fetch(`/api/documents/${scannedDocId}/ocr-ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: ocrResult.pages }),
      });

      const ingestData = await ingestRes.json();
      if (!ingestRes.ok) {
        throw new Error(ingestData.error || 'OCR 텍스트 저장 및 인덱싱 실패');
      }

      setOcrProgress({
        currentPage: ocrResult.totalPages,
        totalPages: ocrResult.totalPages,
        stage: 'completed',
        percent: 100,
        statusMessage: `인덱싱 완료! 총 ${ingestData.chunksCount}개 청크가 성공적으로 생성되었습니다.`,
      });

      setTimeout(() => {
        setIsOcrModalOpen(false);
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: unknown) {
      if (!abortController.signal.aborted) {
        setErrorMessage(err instanceof Error ? err.message : 'OCR 처리 중 오류가 발생했습니다.');
      }
      setIsOcrModalOpen(false);
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleCancelOcr = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsOcrModalOpen(false);
  };

  const docTypes: DocumentType[] = ['논문', '가이드라인', '공공기관 자료', '내부 문서', '기타'];
  const domainList: DomainType[] = ['health', 'yangsaeng', 'circadian', 'korean-medicine'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* 모달 헤더 */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              신규 건강지식 자료 등록
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              스토리지 다이렉트 업로드를 통해 대용량 PDF/문서도 빠르게 인덱싱합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 모달 폼 바디 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-3 shadow-xs">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">
                  {errorMessage}
                </div>
              </div>
              {scannedDocId && file && (
                <div className="pt-2.5 border-t border-rose-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80 p-3 rounded-lg border border-rose-100">
                  <span className="text-[11px] text-slate-700 leading-normal">
                    💡 브라우저 내장 OCR 엔진으로 본문 텍스트를 자동 인식하여 등록을 완료할 수 있습니다.
                  </span>
                  <button
                    type="button"
                    onClick={handleTriggerOcrFromModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0 cursor-pointer"
                  >
                    <ScanLine className="w-3.5 h-3.5" />
                    ⚡ 바로 OCR로 등록하기
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 진행 상태 배너 */}
          {statusStep && (
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-800 flex items-center gap-2.5 animate-pulse">
              <Loader2 className="w-4 h-4 text-sky-600 animate-spin shrink-0" />
              <span className="font-semibold">{statusStep}</span>
            </div>
          )}

          {/* 1. 파일 선택 드롭존 (필수) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              원문 파일 선택 <span className="text-rose-500">*</span>
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/50'
                  : file
                  ? 'border-emerald-300 bg-emerald-50/30'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.markdown"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />

              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold text-slate-900 truncate max-w-sm">
                      {file.name}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {formatBytes(file.size)} • 클릭하여 파일 변경 (최대 50MB)
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-semibold text-slate-800">
                    파일을 드래그하여 놓거나 클릭하여 선택하세요
                  </div>
                  <div className="text-[11px] text-slate-400">
                    지원 포맷: PDF, TXT, Markdown (다이렉트 스토리지 업로드 지원)
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. 필수 기본 정보 (분야 및 제목) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                지식 분야 (도메인) <span className="text-rose-500">*</span>
              </label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value as DomainType)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                {domainList.map((d) => (
                  <option key={d} value={d}>
                    {DOMAIN_CONFIGS[d].name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                자료 유형 <span className="text-slate-400 font-normal">(선택)</span>
              </label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {docTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              문서 제목 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 2024 고령자 만성질환 관리 임상 가이드라인"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 3. 선택 메타데이터 필드 (출처, 발행기관, 발행일, URL) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                출처 (학술지/서적 등)
              </label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="예: 대한노인의학회지"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                발행기관
              </label>
              <input
                type="text"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                placeholder="예: 질병관리청"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                발행일
              </label>
              <input
                type="date"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                원문 URL (출처 링크)
              </label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                키워드 (쉼표 구분)
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="예: 고령자, 수면, 식이요법, 만성질환"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              자료 설명 / 요약
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="문서의 주요 내용 및 RAG 검색 시 참조할 배경 정보를 간략히 입력하세요."
              className="w-full text-xs p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 모달 푸터 버튼 */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {statusStep || '저장 및 인덱싱 중...'}
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  등록 및 인덱싱
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* OCR 실행 모달 */}
      <OcrProcessingModal
        isOpen={isOcrModalOpen}
        documentTitle={file ? file.name : title}
        progress={ocrProgress}
        onCancel={handleCancelOcr}
        isCompleted={ocrProgress?.percent === 100}
      />
    </div>
  );
};
