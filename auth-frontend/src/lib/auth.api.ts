import { api } from "./axios";

export const registerUserApi = (data: {
  username: string;
  email: string;
  password: string;
}) => api.post("/users/register", data);

export const loginUserApi = (data: { email: string; password: string }) =>
  api.post("/users/login", data);

export const logoutUserApi = () => api.post("/users/logout");

export const refreshTokenApi = () => api.post("/users/refresh-token");

export const verifyEmailApi = (token: string) =>
  api.post(`/users/verify-email/${token}`);

export const resendEmailVerificationApi = () =>
  api.post("/users/resend-email-verification");

export const forgotPasswordApi = (email: string) =>
  api.post("/users/forgot-password", { email });

export const resetPasswordApi = (token: string, password: string) =>
  api.post(`/users/reset-password/${token}`, { password });

export const changePasswordApi = (data: {
  oldPassword: string;
  newPassword: string;
}) => api.post("/users/change-password", data);

export const getCurrentUserApi = () => api.get("/users/current-user");

export const assignRoleApi = (userId: string, role: string) =>
  api.post(`/users/assign-role/${userId}`, { role });
