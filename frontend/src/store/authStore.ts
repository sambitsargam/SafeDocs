import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, WalletConnection } from '@shared/types';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  wallet: WalletConnection | null;
  loading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (user: User, wallet: WalletConnection) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      // State
      isAuthenticated: false,
      user: null,
      wallet: null,
      loading: false,
      error: null,

      // Actions
      login: (user: User, wallet: WalletConnection) =>
        set({
          isAuthenticated: true,
          user,
          wallet,
          error: null,
        }),

      logout: () =>
        set({
          isAuthenticated: false,
          user: null,
          wallet: null,
          error: null,
        }),

      updateUser: (userData: Partial<User>) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),

      setLoading: (loading: boolean) => set({ loading }),

      setError: (error: string | null) => set({ error }),

      clearError: () => set({ error: null }),
    }),
    {
      name: 'safedocs-auth',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        wallet: state.wallet,
      }),
    }
  )
);