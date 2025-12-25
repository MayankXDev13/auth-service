import { create } from "zustand";

type User = {
  id: string;
  email: string;
  username?: string;
  role: "user" | "admin";
};

type AuthState = {
  user: User | null;
  loading: boolean;
  setUser: (user: User) => void;
  clearUser: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) =>
    set({
      user,
      loading: false,
    }),
  clearUser: () =>
    set({
      user: null,
      loading: false,
    }),
}));
