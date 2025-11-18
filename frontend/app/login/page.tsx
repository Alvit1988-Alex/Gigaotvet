"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../../contexts/AuthContext";
import { createLoginIntent, pollLoginStatus } from "../../services/authApi";
import type { LoginIntentResponse, LoginStatus } from "../../types/auth";

const POLL_INTERVAL_MS = 3000;

type FlowState = "idle" | LoginStatus;

type StatusDescriptor = {
  title: string;
  description: string;
};

const STATUS_MAP: Record<FlowState, StatusDescriptor> = {
  idle: {
    title: "Готовы начать",
    description: "Создайте QR-код и подтвердите вход в приложении Telegram.",
  },
  pending: {
    title: "Ждём подтверждения",
    description: "Отсканируйте QR-код в приложении Telegram или откройте ссылку на другом устройстве.",
  },
  success: {
    title: "Авторизация подтверждена",
    description: "Мы сохранили профиль администратора и перенаправляем вас в панель.",
  },
  rejected: {
    title: "В доступе отказано",
    description: "Аккаунт не был подтверждён. Попробуйте повторить попытку или используйте другой профиль.",
  },
  expired: {
    title: "QR-код устарел",
    description: "Срок действия токена истёк. Сгенерируйте новый QR-код, чтобы продолжить.",
  },
};

function buildQrUrl(loginUrl: string | null): string | null {
  if (!loginUrl) {
    return null;
  }
  const encoded = encodeURIComponent(loginUrl);
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encoded}`;
}

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser, isAuthenticated } = useAuth();
  const [intent, setIntent] = useState<LoginIntentResponse | null>(null);
  const [status, setStatus] = useState<FlowState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingIntent, setIsGeneratingIntent] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  const startLoginIntent = useCallback(async () => {
    setError(null);
    setIsPolling(false);
    setIntent(null);
    setStatus("pending");
    setIsGeneratingIntent(true);
    try {
      const nextIntent = await createLoginIntent();
      setIntent(nextIntent);
      setIsPolling(true);
    } catch (err) {
      console.error(err);
      setStatus("idle");
      setError("Не удалось создать запрос на авторизацию. Попробуйте ещё раз.");
    } finally {
      setIsGeneratingIntent(false);
    }
  }, []);

  useEffect(() => {
    if (!intent?.token || !isPolling) {
      return undefined;
    }
    let isCancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const result = await pollLoginStatus(intent.token);
        if (isCancelled) {
          return;
        }

        if (result.status === "pending") {
          timeout = setTimeout(poll, POLL_INTERVAL_MS);
          return;
        }

        setStatus(result.status);
        setIsPolling(false);

        if (result.status === "success") {
          setError(null);
          try {
            await refreshUser();
          } catch (refreshError) {
            console.error("Не удалось обновить профиль", refreshError);
          }
          router.replace("/");
          return;
        }

        if (result.status === "rejected") {
          setError("Аккаунт не был подтверждён. Попробуйте снова.");
        } else if (result.status === "expired") {
          setError("Срок действия токена истёк. Сгенерируйте новый QR-код.");
        }
      } catch (err) {
        if (isCancelled) {
          return;
        }
        console.error(err);
        setError("Не удалось проверить статус. Повторяем попытку…");
        timeout = setTimeout(poll, POLL_INTERVAL_MS * 2);
      }
    };

    poll();

    return () => {
      isCancelled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [intent?.token, isPolling, refreshUser, router]);

  const expiresLabel = useMemo(() => {
    if (!intent?.expires_at) {
      return null;
    }
    const date = new Date(intent.expires_at);
    return `QR истекает ${date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
  }, [intent?.expires_at]);

  const qrCode = useMemo(() => buildQrUrl(intent?.login_url ?? null), [intent?.login_url]);

  const descriptor = STATUS_MAP[status];
  const canRetry = status === "expired" || status === "rejected";

  const handlePrimaryAction = useCallback(async () => {
    if (!intent) {
      await startLoginIntent();
      return;
    }

    if (intent.login_url) {
      window.open(intent.login_url, "_blank", "noopener,noreferrer");
    }
  }, [intent, startLoginIntent]);

  const primaryButtonLabel = intent ? "Открыть в Telegram" : "Авторизоваться через Telegram";
  const primaryButtonDisabled = isGeneratingIntent || status === "success";

  const secondaryButtonLabel = canRetry
    ? "Попробовать снова"
    : intent
      ? "Обновить QR-код"
      : "Сгенерировать QR";

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__content">
          <p className="muted-text">Вход в панель</p>
          <h1>Авторизуйтесь через Telegram</h1>
          <p>{descriptor.description}</p>
          {error && <p className="error-text">{error}</p>}
          <div className="login-actions">
            <button
              type="button"
              className="primary-button"
              onClick={handlePrimaryAction}
              disabled={primaryButtonDisabled}
            >
              {primaryButtonLabel}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={startLoginIntent}
              disabled={isGeneratingIntent || status === "pending"}
            >
              {secondaryButtonLabel}
            </button>
          </div>
          <div className="login-meta">
            <p className="status-label">{descriptor.title}</p>
            {expiresLabel && <p>{expiresLabel}</p>}
            {intent?.login_url && (
              <p>
                Или откройте ссылку:
                <br />
                <a href={intent.login_url} target="_blank" rel="noreferrer">
                  {intent.login_url}
                </a>
              </p>
            )}
          </div>
        </div>
        <div className="qr-preview">
          <p className="muted-text">Сканируйте в Telegram</p>
          {qrCode ? (
            <Image
              src={qrCode}
              alt="QR для авторизации"
              width={280}
              height={280}
              className="qr-image"
              priority
            />
          ) : (
            <div className="qr-placeholder">
              <p>QR будет доступен после генерации токена авторизации.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
