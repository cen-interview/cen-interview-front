import { create } from "zustand";

// localStorage 또는 sessionStorage에서 값 조회
const getAuthItem = (key) => {
    return localStorage.getItem(key);
};

// 저장된 user 정보 안전하게 파싱
const getStoredUser = () => {
    const user = localStorage.getItem("user");

    if (!user) {
        return null;
    }

    try {
        return JSON.parse(user);
    } catch {
        localStorage.removeItem("user");
        return null;
    }
};

export const useAuthStore = create((set) => ({
    // 초기 상태
    accessToken: getAuthItem("accessToken"),
    refreshToken: getAuthItem("refreshToken"),
    expireTime: getAuthItem("expireTime")
        ? Number(getAuthItem("expireTime"))
        : null,
    user: getStoredUser(),

    // 로그인 처리
    login: (data) => {
        const accessToken = data.accessToken ?? data.access_token;
        const refreshToken = data.refreshToken ?? data.refresh_token;
        const accessTokenExpiresIn =
            data.accessTokenExpiresIn ?? data.access_token_expires_in ?? 60 * 60;

        const expiresIn = Number(accessTokenExpiresIn);

        const expireTime =
            Date.now() + (expiresIn < 100000 ? expiresIn * 1000 : expiresIn);

        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("refreshToken", refreshToken);
        localStorage.setItem("expireTime", String(expireTime));

        set({
            accessToken,
            refreshToken,
            expireTime,
        });
    },

    // 유저 정보 저장
    setUser: (userData) => {
        localStorage.setItem("user", JSON.stringify(userData));

        set({
            user: userData,
        });
    },

    // 로그아웃 처리
    logout: () => {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("expireTime");
        localStorage.removeItem("user");

        set({
            accessToken: null,
            refreshToken: null,
            expireTime: null,
            user: null,
        });
    },
}));