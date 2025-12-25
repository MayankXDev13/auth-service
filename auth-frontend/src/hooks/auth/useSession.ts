import { useQuery } from "@tanstack/react-query";
import { getCurrentUserApi } from "@/lib/auth.api";
import { setAccessToken } from "@/lib/token";

export const useSession = () => {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const res = await getCurrentUserApi();

     
      if (res.data?.accessToken) {
        setAccessToken(res.data.accessToken);
      }

      return res.data.user;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
};
