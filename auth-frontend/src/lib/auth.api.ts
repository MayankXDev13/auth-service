import { api } from "./axios";

export const registerUserApi = (data: {
  username: string;
  email: string;
  password: string;
}) => api.post("/users/auth/register", data);

export const loginUserApi = (data: { email: string; password: string }) =>
  api.post("/users/auth/login", data);

export const logoutUserApi = () => api.post("/users/auth/logout");

export const refreshTokenApi = () => api.post("/users/auth/refresh-token");

export const verifyEmailApi = (token: string) =>
  api.post(`/users/auth/verify-email/${token}`);

export const resendEmailVerificationApi = () =>
  api.post("/auth/resend-email-verification");

export const forgotPasswordApi = (email: string) =>
  api.post("/auth/forgot-password", { email });

export const resetPasswordApi = (token: string, password: string) =>
  api.post(`/auth/reset-password/${token}`, { password });

export const changePasswordApi = (data: {
  oldPassword: string;
  newPassword: string;
}) => api.post("/auth/change-password", data);

export const getCurrentUserApi = () => api.get("/auth/current-user");

export const assignRoleApi = (userId: string, role: string) =>
  api.post(`/auth/assign-role/${userId}`, { role });
