function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function getLoginErrorMessage(status: number, payload: unknown): string {
  if (status === 429) {
    return "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng chờ một phút rồi thử lại.";
  }
  if (status >= 500) {
    return "Máy chủ đang gặp lỗi. Vui lòng thử lại sau.";
  }

  const errors = asRecord(asRecord(payload)?.errors);
  if (errors?.status === "accountNotActive") {
    return "Tài khoản chưa được duyệt hoặc đã bị khóa. Vui lòng liên hệ quản trị viên.";
  }
  if (typeof errors?.email === "string" && errors.email.startsWith("needLoginViaProvider:")) {
    return "Tài khoản này sử dụng đăng nhập qua dịch vụ khác. Vui lòng dùng phương thức đã đăng ký.";
  }

  const credentialErrors = new Set([
    "incorrectEmailOrPassword",
    "incorrectPassword",
    "notFound",
  ]);
  if ([errors?.email, errors?.password].some(
    (value) => typeof value === "string" && credentialErrors.has(value),
  ) || status === 401) {
    return "Email hoặc mật khẩu không đúng.";
  }
  if (status === 400 || status === 422) {
    return "Thông tin đăng nhập chưa hợp lệ. Vui lòng kiểm tra email và mật khẩu.";
  }
  return "Không thể đăng nhập lúc này. Vui lòng thử lại.";
}
