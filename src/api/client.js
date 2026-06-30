import axios from "axios";
import { useAuthStore } from "../store/authStore";

const BACKEND_URL = import.meta.env.VITE_APP_API_URL;

const axiosInstance = axios.create({
    baseURL: `${BACKEND_URL}/api`,
    timeout: 5000,
});

export const apiClient = axios.create({
    baseURL: `${BACKEND_URL}/api`,
    timeout: 5000,
    headers: { "Content-Type": "application/json" },
});

export const refreshAccessToken = async () => {
    const { refreshToken, login } = useAuthStore.getState();

    if (!refreshToken) {
        throw new Error("리프레시 토큰 없음");
    }

    const response = await axiosInstance.post("/auth/refresh", {
        refresh_token: refreshToken,
    });

    const { access_token } = response.data;

    login({
        accessToken: access_token,
        refreshToken,
        accessTokenExpiresIn: 60 * 60,
        keepLogin: !!localStorage.getItem("accessToken"),
    });

    return access_token;
};

apiClient.interceptors.request.use(async (config) => {
    const { accessToken, expireTime, refreshToken } = useAuthStore.getState();

    if (accessToken) {
        const isExpired = expireTime && Date.now() >= expireTime - 60000;

        if (isExpired && refreshToken) {
            try {
                const newToken = await refreshAccessToken();
                config.headers.Authorization = `Bearer ${newToken}`;
            } catch (e) {
                useAuthStore.getState().logout();
                window.location.href = "/login?error=session_expired";
                return Promise.reject(e);
            }
        } else {
            config.headers.Authorization = `Bearer ${accessToken}`;
        }
    }

    return config;
});

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const newToken = await refreshAccessToken();
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return apiClient(originalRequest);
            } catch (e) {
                useAuthStore.getState().logout();
                window.location.href = "/login?error=session_expired";
                return Promise.reject(e);
            }
        }

        return Promise.reject(error);
    }
);