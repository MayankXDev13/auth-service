import {
  getCurrentUserApi,
  loginUserApi,
  logoutUserApi,
  refreshTokenApi,
  registerUserApi,
} from "@/lib/auth.api";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";

export const useCurrentUser = () => {
  const setUser = useAuthStore((s) => s.setUser);
  const clearUser = useAuthStore((s) => s.clearUser);

  return useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const res = await getCurrentUserApi();
      return res.data.data;
    },
    retry: false,
    onSuccess: (user) => {
      setUser(user);
    },
    onError: () => {
      clearUser();
    },
  });
};

export const useLogin = () => {
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await loginUserApi(data);
      return res.data.data;
    },
    onSuccess: (user) => {
      setUser(user);
    },
  });
};

export const useRegister = () =>
  useMutation({
    mutationFn: async (data: {
      username: string;
      email: string;
      password: string;
    }) => {
      const res = await registerUserApi(data);
      return res.data.data;
    },
  });

export const useLogout = () => {
  const clearUser = useAuthStore((s) => s.clearUser);

  return useMutation({
    mutationFn: async () => {
      const res = await logoutUserApi();
      return res.data;
    },
    onSuccess: () => {
      clearUser();
    },
  });
};

export const useRefreshToken = () =>
  useMutation({
    mutationFn: async () => {
      const res = await refreshTokenApi();
      return res.data;
    },
  });
