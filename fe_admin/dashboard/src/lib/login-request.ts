/** Bound both the HTTP request and its response body, so sign-in cannot hang. */
export async function requestLogin(
  apiBaseUrl: string,
  email: string,
  password: string,
  timeoutMs = 20_000,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${apiBaseUrl}/auth/email/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
      signal: controller.signal,
    });
    let data: unknown = null;
    try {
      data = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
    }
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        "Máy chủ phản hồi quá lâu. Vui lòng kiểm tra kết nối và thử đăng nhập lại.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** An auth boundary needs a fresh document request carrying the new cookie. */
export function redirectAfterLogin(): void {
  window.location.replace("/");
}
