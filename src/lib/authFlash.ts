export type AuthFlashTone = "success" | "error" | "info";

type AuthFlashMessage = {
  message: string;
  tone: AuthFlashTone;
};

const AUTH_FLASH_KEY = "auth_flash_message_v1";

export function setAuthFlash(message: string, tone: AuthFlashTone = "success"): void {
  if (typeof window === "undefined") return;
  const payload: AuthFlashMessage = { message, tone };
  sessionStorage.setItem(AUTH_FLASH_KEY, JSON.stringify(payload));
}

export function consumeAuthFlash(): AuthFlashMessage | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(AUTH_FLASH_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(AUTH_FLASH_KEY);
  try {
    const parsed = JSON.parse(raw) as Partial<AuthFlashMessage>;
    const message = typeof parsed.message === "string" ? parsed.message.trim() : "";
    const tone: AuthFlashTone =
      parsed.tone === "error" || parsed.tone === "info" || parsed.tone === "success" ? parsed.tone : "success";
    if (!message) return null;
    return { message, tone };
  } catch {
    return null;
  }
}
