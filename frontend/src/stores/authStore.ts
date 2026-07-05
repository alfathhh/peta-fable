import { create } from 'zustand';
import type { User } from '../types';

const STORAGE_KEY = 'peta-auth';

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

function load(): { token: string | null; user: User | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as { token: string; user: User };
  } catch {
    /* abaikan */
  }
  return { token: null, user: null };
}

export const useAuthStore = create<AuthState>((set) => ({
  ...load(),
  setAuth: (token, user) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ token: null, user: null });
  },
}));
