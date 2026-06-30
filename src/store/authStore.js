import { create } from "zustand";

// localStorage 또는 sessionStorage에서 값 조회
const getAuthItem = (key) => {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
};

// 저장된 user 정보 안전하게 파싱
const getStoredUser = () => {
    const user = getAuthItem("user");

    if (!user) {
        return null;
    }

    try {
        return JSON.parse(user);
    } catch {
        localStorage.removeItem("user");
        sessionStorage.removeItem("user");
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
        const { accessToken, refreshToken, accessTokenExpiresIn, keepLogin } = data;

        const storage = keepLogin ? localStorage : sessionStorage;
        const oppositeStorage = keepLogin ? sessionStorage : localStorage;

        // 반대 저장소에 남아있는 기존 로그인 정보 삭제
        oppositeStorage.removeItem("accessToken");
        oppositeStorage.removeItem("refreshToken");
        oppositeStorage.removeItem("expireTime");
        oppositeStorage.removeItem("user");

        // accessTokenExpiresIn은 초 단위 기준
        // 혹시 ms 단위가 들어와도 처리 가능하게 방어
        const expiresIn = Number(accessTokenExpiresIn);

        const expireTime =
            Date.now() + (expiresIn < 100000 ? expiresIn * 1000 : expiresIn);

        storage.setItem("accessToken", accessToken);
        storage.setItem("refreshToken", refreshToken);
        storage.setItem("expireTime", String(expireTime));

        set({
            accessToken,
            refreshToken,
            expireTime,
        });
    },

    // 유저 정보 저장
    setUser: (userData) => {
        const storage = localStorage.getItem("accessToken")
            ? localStorage
            : sessionStorage;

        storage.setItem("user", JSON.stringify(userData));

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

        sessionStorage.removeItem("accessToken");
        sessionStorage.removeItem("refreshToken");
        sessionStorage.removeItem("expireTime");
        sessionStorage.removeItem("user");

        set({
            accessToken: null,
            refreshToken: null,
            expireTime: null,
            user: null,
        });
    },
}));