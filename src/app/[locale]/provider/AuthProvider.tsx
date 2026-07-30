/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, { useState, createContext, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useJwt } from "react-jwt";
import { useI18n } from "@/components/i18n/ClientI18nProvider";

type UserType = { id?: string; userId?: string };

type AuthContextType = {
  userId: string | null;
  token: string | null;
  email: string | null;
  setAuthToken: (token: string | null, email?: string | null) => void;
  loading: boolean;
};

const TOKEN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

/**
 * Mirror the session token into a cookie so `src/proxy.ts` can gate /admin.
 * Not HttpOnly by necessity — the client writes it — which is why it is only
 * ever treated as a hint. Every admin API route independently verifies the JWT
 * and re-checks the ADMIN role against the database.
 */
function writeTokenCookie(token: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `token=${encodeURIComponent(token)}; Path=/; Max-Age=${TOKEN_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

function clearTokenCookie() {
  document.cookie = "token=; Path=/; Max-Age=0; SameSite=Lax";
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const { locale } = useI18n();

  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { decodedToken, reEvaluateToken } = useJwt<UserType>(token || "");

  /* ---------- INITIAL HYDRATION ---------- */
  // localStorage is unavailable during SSR, so the stored session can only be
  // read here, after mount.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const storedToken = localStorage.getItem("token");
    const storedUserId = localStorage.getItem("userId");
    const storedEmail = localStorage.getItem("email");

    if (storedToken) {
      setToken(storedToken);
      reEvaluateToken(storedToken);
      // Re-issue the cookie: it expires sooner than the stored token, and
      // sessions created before this existed have none at all.
      writeTokenCookie(storedToken);
    }

    if (storedUserId) setUserId(storedUserId);
    if (storedEmail) setEmail(storedEmail);

    setLoading(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  /* ---------- DECODE JWT ---------- */
  useEffect(() => {
    if (!token || !decodedToken) return;

    // react-jwt decodes asynchronously, so the id only exists after a later
    // render — it can't be derived inline during this one.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUserId(decodedToken.id || decodedToken.userId || null);
  }, [token, decodedToken]);

  /* ---------- GLOBAL AUTH SYNC ---------- */
  useEffect(() => {
    const handler = () => {
      const newToken = localStorage.getItem("token");
      const newUserId = localStorage.getItem("userId");
      const newEmail = localStorage.getItem("email");

      if (newToken) {
        setToken(newToken);
        reEvaluateToken(newToken);
      } else {
        setToken(null);
        setUserId(null);
        setEmail(null);
      }

      setUserId(newUserId || null);
      setEmail(newEmail || null);
    };

    window.addEventListener("auth-changed", handler);
    return () => window.removeEventListener("auth-changed", handler);
  }, []);

  /* ---------- SINGLE SOURCE OF TRUTH ---------- */
  const setAuthToken = (newToken: string | null, newEmail?: string | null) => {
    if (newToken) {
      localStorage.setItem("token", newToken);
      // The cookie exists purely so middleware can see the session — it runs on
      // the edge and cannot read localStorage. The API still authenticates off
      // the Authorization header, never this cookie.
      writeTokenCookie(newToken);
      setToken(newToken);
      reEvaluateToken(newToken);

      if (newEmail) {
        localStorage.setItem("email", newEmail);
        setEmail(newEmail);
      }

      window.dispatchEvent(new Event("auth-changed"));
      return;
    }

    // logout
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("email");
    clearTokenCookie();

    setToken(null);
    setUserId(null);
    setEmail(null);

    window.dispatchEvent(new Event("auth-changed"));
    router.push(`/${locale}`);
  };

  return (
    <AuthContext.Provider
      value={{
        userId,
        token,
        email,
        setAuthToken,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
