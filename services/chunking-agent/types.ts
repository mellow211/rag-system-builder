import { ChunkProposal, ChunkingSession } from '@/types/rag';

export interface ChunkingAgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  toolCall?: {
    toolName: string;
    params: Record<string, unknown>;
    result?: Record<string, unknown>;
  };
}

export interface DocumentSectionNode {
  title: string;
  level: number;
  sectionPath: string[];
  pageStart: number;
  pageEnd: number;
  tokenCount: number;
  childCount: number;
  children: DocumentSectionNode[];
  proposals?: ChunkProposal[];
}

export interface ChunkPlanSummary {
  documentId: string;
  totalProposals: number;
  totalTokens: number;
  avgTokens: number;
  statusCounts: {
    proposed: number;
    edited: number;
    approved: number;
    rejected: number;
  };
  sectionsCount: number;
}
