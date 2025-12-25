import {
  getCurrentUserApi,
  loginUserApi,
  logoutUserApi,
  refreshTokenApi,
  registerUserApi,
} from "@/lib/auth.api";
import { useMutation, useQuery } from "@tanstack/react-query";

export const useCurrentUser = () => {
  useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const res = await getCurrentUserApi();
      return res.data;
    },
    retry: false,
  });
};

export const useLogin = () => {
  useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await loginUserApi(data);
      return res.data;
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
      return res.data;
    },
  });

export const useLogout = () =>
  useMutation({
    mutationFn: async () => {
      const res = await logoutUserApi();
      return res.data;
    },
  });

export const useRefreshToken = () =>
  useMutation({
    mutationFn: async () => {
      const res = await refreshTokenApi();
      return res.data;
    },
  });
