import { useMutation } from "@tanstack/react-query";
import { assignRoleApi } from "@/lib/auth.api";

export const useAssignRole = () =>
  useMutation({
    mutationFn: async (data: {
      userId: string;
      role: string;
    }) => {
      const res = await assignRoleApi(data.userId, data.role);
      return res.data;
    },
  });
