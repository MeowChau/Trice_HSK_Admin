"use client";
import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import { API_BASE_URL, saveSession } from "@/lib/api";
import type { Session } from "@/lib/api";
import { getLoginErrorMessage } from "@/lib/login-error";
import { redirectAfterLogin, requestLogin } from "@/lib/login-request";
import Link from "next/link";
import React, { useState } from "react";

export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;
    // Read the actual fields too: password managers may autofill inputs without
    // updating React state before the user submits the form.
    const fields = new FormData(e.currentTarget);
    const enteredEmail = String(fields.get("email") ?? email);
    const enteredPassword = String(fields.get("password") ?? password);
    setError("");
    setIsLoading(true);

    try {
      const { ok, status, data } = await requestLogin(
        API_BASE_URL,
        enteredEmail,
        enteredPassword,
      );

      if (!ok) {
        throw new Error(getLoginErrorMessage(status, data));
      }
      if (
        typeof data !== "object" ||
        data === null ||
        !("token" in data) ||
        typeof data.token !== "string" ||
        !data.token
      ) {
        throw new Error(
          "Máy chủ trả về phiên đăng nhập không hợp lệ. Vui lòng thử lại.",
        );
      }

      // Keeps the access token, the refresh token and the expiry together so
      // `apiFetch` can renew the session without a new login.
      saveSession(data as Session);

      // A prefetched unauthenticated dashboard can contain a redirect to sign-in.
      // Start a fresh document request after the session cookie has been saved.
      redirectAfterLogin();
    } catch (err: unknown) {
      setError(
        err instanceof TypeError
          ? "Không kết nối được máy chủ. Vui lòng kiểm tra kết nối và thử lại."
          : err instanceof Error
            ? err.message
            : "Không thể đăng nhập. Vui lòng thử lại.",
      );
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full">
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Đăng nhập
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Nhập email và mật khẩu của bạn để tiếp tục!
            </p>
          </div>
          <div>
            {error && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-lg bg-error-50 text-error-500 text-sm"
              >
                {error}
              </div>
            )}
            <form onSubmit={handleLogin}>
              <div className="space-y-6">
                <div>
                  <Label htmlFor="signin-email">
                    Email <span className="text-error-500">*</span>{" "}
                  </Label>
                  <Input
                    id="signin-email"
                    name="email"
                    autoComplete="username"
                    required
                    placeholder="emailcuaban@gmail.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="signin-password">
                    Mật khẩu <span className="text-error-500">*</span>{" "}
                  </Label>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      name="password"
                      autoComplete="current-password"
                      required
                      type={showPassword ? "text" : "password"}
                      placeholder="Nhập mật khẩu"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <span
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                    >
                      {showPassword ? (
                        <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                      ) : (
                        <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={isChecked} onChange={setIsChecked} />
                    <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                      Duy trì đăng nhập
                    </span>
                  </div>
                  <Link
                    href="/reset-password"
                    className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
                  >
                    Quên mật khẩu?
                  </Link>
                </div>
                <div>
                  <Button
                    type="submit"
                    className="w-full"
                    size="sm"
                    disabled={isLoading}
                  >
                    {isLoading ? "Đang xử lý..." : "Đăng nhập"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
