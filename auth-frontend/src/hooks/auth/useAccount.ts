import { useMutation } from "@tanstack/react-query";
import {
  verifyEmailApi,
  resendEmailVerificationApi,
  forgotPasswordApi,
  resetPasswordApi,
  changePasswordApi,
} from "@/lib/auth.api";

export const useVerifyEmail = () =>
  useMutation({
    mutationFn: async (token: string) => {
      const res = await verifyEmailApi(token);
      return res.data;
    },
  });

export const useResendVerification = () =>
  useMutation({
    mutationFn: async () => {
      const res = await resendEmailVerificationApi();
      return res.data;
    },
  });

export const useForgotPassword = () =>
  useMutation({
    mutationFn: async (email: string) => {
      const res = await forgotPasswordApi(email);
      return res.data;
    },
  });

export const useResetPassword = () =>
  useMutation({
    mutationFn: async (data: { token: string; password: string }) => {
      const res = await resetPasswordApi(data.token, data.password);
      return res.data;
    },
  });

export const useChangePassword = () =>
  useMutation({
    mutationFn: async (data: { oldPassword: string; newPassword: string }) => {
      const res = await changePasswordApi(data);
      return res.data;
    },
  });
