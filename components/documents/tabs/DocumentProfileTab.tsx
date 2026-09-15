'use client';

import React, { useState, useEffect } from 'react';
import { DocumentProfile, DomainType, DOMAIN_CONFIGS } from '@/types/rag';
import { DomainBadge } from '@/components/ui/DomainBadge';
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Edit3,
  Save,
  Tag,
  BookOpen,
  Activity,
  HeartPulse,
  Users,
  Layers,
  FileText,
  AlertCircle,
  Plus,
  X,
  Share2,
  FolderTree,
} from 'lucide-react';

interface DocumentProfileTabProps {
  documentId: string;
  domain: DomainType;
  initialProfile?: DocumentProfile | null;
  onProfileApproved?: (approvedProfile: DocumentProfile) => void;
}

export const DocumentProfileTab: React.FC<DocumentProfileTabProps> = ({
  documentId,
  domain,
  initialProfile,
  onProfileApproved,
}) => {
  const [profile, setProfile] = useState<DocumentProfile | null>(initialProfile || null);
  const [isLoading, setIsLoading] = useState<boolean>(!initialProfile);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 편집용 로컬 상태
  const [editForm, setEditForm] = useState<DocumentProfile | null>(null);
  const [newTopic, setNewTopic] = useState('');
  const [newConcept, setNewConcept] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newKeyword, setNewKeyword] = useState('');

  // 프로파일 로드
  const fetchProfile = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/profile`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '프로파일 로드 실패');
      }
      setProfile(data.profile);
      setEditForm(data.profile);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : '프로파일 조회 중 오류 발생',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!initialProfile) {
      fetchProfile();
    } else {
      setProfile(initialProfile);
      setEditForm(initialProfile);
    }
  }, [documentId]);

  // 재분석 실행
  const handleReanalyze = async () => {
    if (!confirm('문서를 LLM으로 재분석하시겠습니까? 기존 수동 수정 내용은 덮어씌워질 수 있습니다.')) return;

    setIsAnalyzing(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/profile/analyze`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '재분석 실패');
      }
      setProfile(data.profile);
      setEditForm(data.profile);
      setIsEditing(false);
      setFeedback({
        type: 'success',
        message: '✨ LLM Document Profile 재분석이 완료되었습니다.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : '재분석 중 오류 발생',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 편집 저장
  const handleSaveEdit = async () => {
    if (!editForm) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileData: editForm, approve: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '수정 저장 실패');
      }
      setProfile(data.profile);
      setIsEditing(false);
      setFeedback({
        type: 'success',
        message: 'Document Profile이 성공적으로 수정되었습니다.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : '저장 중 오류 발생',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 프로파일 확정/승인
  const handleApprove = async () => {
    if (!profile) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileData: isEditing && editForm ? editForm : profile,
          approve: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '프로파일 확정 실패');
      }
      setProfile(data.profile);
      setIsEditing(false);
      setFeedback({
        type: 'success',
        message: '🎉 Document Profile이 최종 확정되었습니다! 이제 청킹 에이전트와 대화를 시작할 수 있습니다.',
      });
      if (onProfileApproved) {
        onProfileApproved(data.profile);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : '확정 처리 오류',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 태그 추가/삭제 헬퍼
  const addTag = (field: 'topics' | 'concepts' | 'categories' | 'keywords', value: string, setter: (v: string) => void) => {
    if (!editForm || !value.trim()) return;
    const current = (editForm[field] || []) as string[];
    if (!current.includes(value.trim())) {
      setEditForm({ ...editForm, [field]: [...current, value.trim()] });
    }
    setter('');
  };

  const removeTag = (field: 'topics' | 'concepts' | 'categories' | 'keywords', itemToRemove: string) => {
    if (!editForm) return;
    const current = (editForm[field] || []) as string[];
    setEditForm({ ...editForm, [field]: current.filter((i) => i !== itemToRemove) });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
        <h3 className="text-base font-bold text-slate-800">문서 인텔리전스 분석을 불러오는 중...</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          문서의 텍스트 구조, 핵심 개념, 질환, 지표 및 요약 정보를 생성하고 있습니다.
        </p>
      </div>
    );
  }

  if (!profile && !editForm) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
        <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
        <h3 className="text-base font-bold text-slate-800">Document Profile이 아직 생성되지 않았습니다.</h3>
        <p className="text-xs text-slate-500">지금 분석을 시작하여 문서의 핵심 개념과 구조를 추출해 보세요.</p>
        <button
          onClick={handleReanalyze}
          disabled={isAnalyzing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          {isAnalyzing ? '분석 실행 중...' : '문서 인텔리전스 분석 시작'}
        </button>
      </div>
    );
  }

  const current = isEditing ? editForm! : profile!;
  const isApproved = current.status === 'APPROVED';

  return (
    <div className="space-y-6">
      {/* 1. 상단 컨트롤 바 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Document Intelligence</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                isApproved
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : current.status === 'EDITED'
                  ? 'bg-sky-100 text-sky-800 border border-sky-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {isApproved ? '✅ 확정됨 (Approved)' : current.status === 'EDITED' ? '✏️ 수정됨 (Edited)' : '💡 제안됨 (Proposed)'}
            </span>
            <span className="text-xs text-slate-400 font-mono">버전: {current.profile_version || 'v1'}</span>
            <span className="text-xs text-slate-400">모델: {current.llm_model || '기본 LLM'}</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            문서 분석 및 지식 프로파일 (Document Profile)
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  setEditForm(profile);
                  setIsEditing(false);
                }}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? '저장 중...' : '수정사항 저장'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-500" />
              프로파일 직접 수정
            </button>
          )}

          <button
            onClick={handleReanalyze}
            disabled={isAnalyzing || isSaving}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
            {isAnalyzing ? '재분석 중...' : 'AI 재분석'}
          </button>

          <button
            onClick={handleApprove}
            disabled={isSaving || isApproved}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer ${
              isApproved
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isApproved ? '프로파일 확정 완료' : '확정 및 승인'}
          </button>
        </div>
      </div>

      {/* 피드백 배너 */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2.5 transition-all shadow-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-rose-50 text-rose-900 border border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="font-medium">{feedback.message}</span>
        </div>
      )}

      {/* 2. 요약 카드 (한 줄 요약 & 종합 요약) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                한 줄 핵심 요약 (Summary Short)
              </span>
              {isEditing ? (
                <input
                  type="text"
                  value={current.summary_short}
                  onChange={(e) => setEditForm({ ...current, summary_short: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-semibold text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              ) : (
                <p className="text-sm font-bold text-slate-900 leading-snug">{current.summary_short}</p>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                종합 학술 요약 (Summary Full)
              </span>
              {isEditing ? (
                <textarea
                  rows={4}
                  value={current.summary_full}
                  onChange={(e) => setEditForm({ ...current, summary_full: e.target.value })}
                  className="w-full px-3 py-2 text-xs leading-relaxed text-slate-700 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              ) : (
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{current.summary_full}</p>
              )}
            </div>
          </div>

          {/* 주요 주제 및 핵심 개념 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            {/* 주요 주제 (Topics) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-600" />
                  주요 주제 (Topics)
                </span>
                <span className="text-[11px] text-slate-400">{current.topics?.length || 0}개</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(current.topics || []).map((topic, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200"
                  >
                    <span>{topic}</span>
                    {isEditing && (
                      <button
                        onClick={() => removeTag('topics', topic)}
                        className="text-indigo-400 hover:text-indigo-700 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {isEditing && (
                <div className="flex items-center gap-1.5 mt-2">
                  <input
                    type="text"
                    placeholder="새 주제 추가..."
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTag('topics', newTopic, setNewTopic)}
                    className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:outline-hidden"
                  />
                  <button
                    onClick={() => addTag('topics', newTopic, setNewTopic)}
                    className="p-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* 핵심 개념 (Concepts) */}
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-sky-600" />
                  핵심 개념 (Concepts - Graph Node 후보)
                </span>
                <span className="text-[11px] text-slate-400">{current.concepts?.length || 0}개</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(current.concepts || []).map((concept, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200"
                  >
                    <span>{concept}</span>
                    {isEditing && (
                      <button
                        onClick={() => removeTag('concepts', concept)}
                        className="text-sky-400 hover:text-sky-700 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {isEditing && (
                <div className="flex items-center gap-1.5 mt-2">
                  <input
                    type="text"
                    placeholder="새 개념 추가..."
                    value={newConcept}
                    onChange={(e) => setNewConcept(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTag('concepts', newConcept, setNewConcept)}
                    className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:outline-hidden"
                  />
                  <button
                    onClick={() => addTag('concepts', newConcept, setNewConcept)}
                    className="p-1 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* 추천 계층형 카테고리 (Categories) */}
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FolderTree className="w-3.5 h-3.5 text-amber-600" />
                  추천 카테고리 (Categories)
                </span>
                <span className="text-[11px] text-slate-400">{current.categories?.length || 0}개</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(current.categories || []).map((cat, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200"
                  >
                    <span>{cat}</span>
                    {isEditing && (
                      <button
                        onClick={() => removeTag('categories', cat)}
                        className="text-amber-400 hover:text-amber-700 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {isEditing && (
                <div className="flex items-center gap-1.5 mt-2">
                  <input
                    type="text"
                    placeholder="카테고리 추가 (예: 일주기리듬 > 수면)..."
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTag('categories', newCategory, setNewCategory)}
                    className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:outline-hidden w-64"
                  />
                  <button
                    onClick={() => addTag('categories', newCategory, setNewCategory)}
                    className="p-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 우측 사이드 패널: 속성, 대상, 지표 */}
        <div className="space-y-6">
          {/* 도메인 및 메타데이터 정보 카드 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">문서 분류 메타데이터</h4>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">분야 (Domain)</span>
                <DomainBadge domain={current.domain} size="sm" />
              </div>

              <div>
                <span className="text-slate-400 block mb-1">문서 유형 (Type)</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
                  {current.document_type || '가이드라인'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-1 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  대상 집단 (Target Population)
                </span>
                <div className="flex flex-wrap gap-1">
                  {(current.target_population || []).map((t, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {current.diseases && current.diseases.length > 0 && (
                <div>
                  <span className="text-slate-400 block mb-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-rose-500" />
                    관련 질환 (Diseases)
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {current.diseases.map((d, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-[11px] font-medium border border-rose-100">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {current.health_metrics && current.health_metrics.length > 0 && (
                <div>
                  <span className="text-slate-400 block mb-1 flex items-center gap-1">
                    <Activity className="w-3 h-3 text-emerald-500" />
                    건강 평가 지표 (Metrics)
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {current.health_metrics.map((m, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-medium border border-emerald-100">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {current.lifestyle_factors && current.lifestyle_factors.length > 0 && (
                <div>
                  <span className="text-slate-400 block mb-1 flex items-center gap-1">
                    <HeartPulse className="w-3 h-3 text-purple-500" />
                    생활습관 중재 (Lifestyle)
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {current.lifestyle_factors.map((l, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-[11px] font-medium border border-purple-100">
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 교차 분야 연결 (Cross-Domain Knowledge Fabric Hint) */}
          {current.cross_domain_connections && current.cross_domain_connections.length > 0 && (
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-sky-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  타 분야 연계 지식 (Knowledge Fabric)
                </h4>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                이 문서의 개념이 4대 분야 지식 패브릭에서 다음과 같이 교차 연결될 수 있습니다:
              </p>
              <div className="space-y-2 pt-1">
                {current.cross_domain_connections.map((conn, i) => {
                  const targetConf = DOMAIN_CONFIGS[conn.domain];
                  return (
                    <div key={i} className="bg-white/10 p-2.5 rounded-xl text-xs space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-white/20 text-white">
                          {targetConf?.shortName || conn.domain}
                        </span>
                        <span className="font-bold text-sky-300">{conn.concept}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-tight">{conn.rationale}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 파싱된 섹션 구조 목차 */}
          {current.structure && current.structure.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 text-xs">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                문서 구조 및 목차 ({current.structure.length}개 섹션)
              </h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {current.structure.map((sec, i) => (
                  <div key={i} className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-semibold text-slate-800 block">{sec.title}</span>
                    {sec.subsections && sec.subsections.length > 0 && (
                      <div className="pl-3 mt-1 space-y-0.5 text-[11px] text-slate-500">
                        {sec.subsections.map((sub, j) => (
                          <div key={j}>• {sub}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
