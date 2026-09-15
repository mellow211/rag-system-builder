import React from 'react';
import { Metadata } from 'next';
import { FabricExplorer } from '@/components/fabric/FabricExplorer';

export const metadata: Metadata = {
  title: '지식 패브릭 (Knowledge Fabric) | RAG 지식 구축 플랫폼',
  description: '4대 도메인 온톨로지 카테고리 계층 구조, 지식 그래프 엔티티 및 근거 기반 관계 엣지 탐색',
};

export default function FabricPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <FabricExplorer />
    </div>
  );
}
