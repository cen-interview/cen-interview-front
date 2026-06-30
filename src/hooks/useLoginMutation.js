import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { apiClient } from "../api/client.js";

export const useLoginMutation = () => {
    const navigate = useNavigate();

    const login = useAuthStore((state) => state.login);
    const setUser = useAuthStore((state) => state.setUser);

    return useMutation({
        // 로그인 API 호출
        mutationFn: async (loginData) => {
            const response = await apiClient.post("/auth/login", loginData);
            return response.data;
        },

        // 로그인 성공 시 실행
        onSuccess: async (data) => {
            // accessToken, refreshToken 등을 Zustand store에 저장
            login(data);

            try {
                // 로그인 직후 내 정보 조회
                const userResponse = await apiClient.get("/users/me");

                // 응답 구조가 { data: {...} } 이거나 {...} 인 경우 모두 대응
                setUser(userResponse.data.data ?? userResponse.data);
            } catch (userError) {
                console.error("유저 정보를 불러오는데 실패했습니다:", userError);
            }

            navigate("/");
        },

        // 로그인 실패 시 실행
        onError: (error) => {
            const errorMessage =
                error.response?.data?.detail ||
                error.response?.data?.message ||
                "로그인에 실패했습니다.";

            console.error("🚨 로그인 에러 발생:", errorMessage);
        },
    });
};