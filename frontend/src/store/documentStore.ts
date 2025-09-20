import { create } from 'zustand';
import { Document, DocumentStatus, PaginatedResponse, PaginationInput } from '@shared/types';

interface DocumentState {
  documents: Document[];
  currentDocument: Document | null;
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  } | null;
}

interface DocumentActions {
  setDocuments: (documents: Document[]) => void;
  addDocument: (document: Document) => void;
  updateDocument: (id: string, updates: Partial<Document>) => void;
  removeDocument: (id: string) => void;
  setCurrentDocument: (document: Document | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setPagination: (pagination: PaginatedResponse<Document>['pagination']) => void;
  resetStore: () => void;
}

const initialState: DocumentState = {
  documents: [],
  currentDocument: null,
  loading: false,
  error: null,
  pagination: null,
};

export const useDocumentStore = create<DocumentState & DocumentActions>(
  (set, get) => ({
    ...initialState,

    setDocuments: (documents: Document[]) =>
      set({ documents, error: null }),

    addDocument: (document: Document) =>
      set((state) => ({
        documents: [document, ...state.documents],
      })),

    updateDocument: (id: string, updates: Partial<Document>) =>
      set((state) => ({
        documents: state.documents.map((doc) =>
          doc.id === id ? { ...doc, ...updates } : doc
        ),
        currentDocument:
          state.currentDocument?.id === id
            ? { ...state.currentDocument, ...updates }
            : state.currentDocument,
      })),

    removeDocument: (id: string) =>
      set((state) => ({
        documents: state.documents.filter((doc) => doc.id !== id),
        currentDocument:
          state.currentDocument?.id === id ? null : state.currentDocument,
      })),

    setCurrentDocument: (document: Document | null) =>
      set({ currentDocument: document }),

    setLoading: (loading: boolean) => set({ loading }),

    setError: (error: string | null) => set({ error }),

    clearError: () => set({ error: null }),

    setPagination: (pagination) => set({ pagination }),

    resetStore: () => set(initialState),
  })
);