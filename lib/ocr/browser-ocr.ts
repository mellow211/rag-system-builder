'use client';

export interface OcrProgress {
  currentPage: number;
  totalPages: number;
  stage: 'initializing' | 'rendering' | 'recognizing' | 'completed' | 'error';
  percent: number; // 0 ~ 100
  statusMessage: string;
  previewText?: string;
}

export interface OcrPageResult {
  pageNumber: number;
  text: string;
}

export interface OcrResult {
  pages: OcrPageResult[];
  totalText: string;
  totalPages: number;
}

/**
 * 브라우저 클라이언트 환경에서 PDF를 캔버스로 렌더링 후 Tesseract.js로 한글/영문 OCR을 수행합니다.
 * Vercel 서버리스 타임아웃(10초)을 완전히 우회하며 100% 무료로 동작합니다.
 */
export async function runBrowserOcr(
  fileOrBuffer: Blob | ArrayBuffer,
  onProgress?: (progress: OcrProgress) => void,
  abortSignal?: AbortSignal
): Promise<OcrResult> {
  const arrayBuffer =
    fileOrBuffer instanceof ArrayBuffer
      ? fileOrBuffer
      : await fileOrBuffer.arrayBuffer();

  onProgress?.({
    currentPage: 0,
    totalPages: 0,
    stage: 'initializing',
    percent: 5,
    statusMessage: 'PDF 문서 및 OCR 엔진(Tesseract.js) 초기화 중...',
  });

  // 1. unpdf의 getDocumentProxy를 통해 PDF 로드
  const { getDocumentProxy } = await import('unpdf');
  const uint8Array = new Uint8Array(arrayBuffer);
  const doc = await getDocumentProxy(uint8Array);
  const totalPages = doc.numPages;

  if (totalPages === 0) {
    throw new Error('PDF 문서에 페이지가 존재하지 않습니다.');
  }

  // 2. Tesseract Worker 초기화 (한글 + 영문)
  onProgress?.({
    currentPage: 0,
    totalPages,
    stage: 'initializing',
    percent: 10,
    statusMessage: '한글/영문 OCR 언어 모델 로딩 중...',
  });

  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['kor', 'eng']);

  const pages: OcrPageResult[] = [];

  try {
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (abortSignal?.aborted) {
        throw new Error('사용자에 의해 OCR 처리가 취소되었습니다.');
      }

      const basePercent = 10 + Math.floor(((pageNum - 1) / totalPages) * 85);

      onProgress?.({
        currentPage: pageNum,
        totalPages,
        stage: 'rendering',
        percent: basePercent,
        statusMessage: `${pageNum}/${totalPages} 페이지 고화질 렌더링 중...`,
      });

      // 3. 페이지를 고해상도 캔버스(scale 1.8)로 렌더링
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.8 });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('브라우저 Canvas 2D 컨텍스트를 생성할 수 없습니다.');
      }

      // 흰색 배경 채우기
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await (page.render as any)({ canvasContext: ctx, viewport, canvas }).promise;

      onProgress?.({
        currentPage: pageNum,
        totalPages,
        stage: 'recognizing',
        percent: basePercent + Math.floor(85 / totalPages / 2),
        statusMessage: `${pageNum}/${totalPages} 페이지 한글/영문 텍스트 광학 인식 중...`,
      });

      // 4. Tesseract OCR 인식 실행
      const { data } = await worker.recognize(canvas);
      const extractedText = (data.text || '').trim();

      pages.push({
        pageNumber: pageNum,
        text: extractedText,
      });

      onProgress?.({
        currentPage: pageNum,
        totalPages,
        stage: 'recognizing',
        percent: 10 + Math.floor((pageNum / totalPages) * 85),
        statusMessage: `${pageNum}/${totalPages} 페이지 인식 완료 (${extractedText.length}자 추출)`,
        previewText: extractedText.slice(0, 120),
      });
    }

    const totalText = pages.map((p) => p.text).join('\n\n');

    onProgress?.({
      currentPage: totalPages,
      totalPages,
      stage: 'completed',
      percent: 100,
      statusMessage: `전체 ${totalPages}페이지 OCR 완료 (총 ${totalText.length}자 추출)`,
      previewText: totalText.slice(0, 200),
    });

    return {
      pages,
      totalText,
      totalPages,
    };
  } finally {
    // 워커 메모리 해제
    await worker.terminate();
  }
}
