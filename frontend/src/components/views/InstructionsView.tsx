"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchCurrentInstructions,
  updateInstructions,
} from "../../services/aiInstructionsApi";
import { useWSClient } from "../../../contexts/WSClientContext";

type SystemEventPayload = {
  event?: string;
};

function getSystemEventName(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const eventName = (payload as SystemEventPayload).event;
  return typeof eventName === "string" ? eventName : null;
}

const SOP_TIPS = [
  {
    id: "SOP-001",
    title: "Эскалация VIP-клиентов",
    steps: [
      "Отметить диалог тегом VIP",
      "Сообщить руководителю смены",
      "Внести комментарий в CRM",
    ],
    updated: "09.05.2024",
  },
  {
    id: "SOP-014",
    title: "Ответы на претензии",
    steps: [
      "Представиться и подтвердить проблему",
      "Предложить компенсацию из списка",
      "Фиксировать решение в карточке",
    ],
    updated: "07.05.2024",
  },
];

export default function InstructionsView() {
  const { subscribe } = useWSClient();
  const isMountedRef = useRef(true);
  const [instructionsText, setInstructionsText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadInstructions = useCallback(async () => {
    if (!isMountedRef.current) {
      return false;
    }
    setIsLoading(true);
    setError(null);

    try {
      const instructions = await fetchCurrentInstructions();
      if (!isMountedRef.current) {
        return false;
      }
      setInstructionsText(instructions.text ?? "");
      return true;
    } catch (err) {
      if (!isMountedRef.current) {
        return false;
      }
      setError("Не удалось загрузить инструкции. Попробуйте ещё раз.");
      return false;
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadInstructions();
  }, [loadInstructions]);

  useEffect(() => {
    if (!showSuccess) {
      return undefined;
    }

    const timeout = setTimeout(() => setShowSuccess(false), 2500);
    return () => clearTimeout(timeout);
  }, [showSuccess]);

  useEffect(() => {
    if (!refreshMessage) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => setRefreshMessage(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [refreshMessage]);

  const handleSystemEvent = useCallback(
    (payload: unknown) => {
      const eventName = getSystemEventName(payload);
      if (eventName !== "instructions_updated") {
        return;
      }
      loadInstructions().then((success) => {
        if (success) {
          setRefreshMessage("Инструкции были обновлены другим администратором.");
        }
      });
    },
    [loadInstructions],
  );

  useEffect(() => {
    const unsubscribe = subscribe("system", handleSystemEvent);
    return () => {
      unsubscribe();
    };
  }, [handleSystemEvent, subscribe]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const updated = await updateInstructions(instructionsText);
      setInstructionsText(updated.text ?? "");
      setShowSuccess(true);
    } catch (err) {
      setError("Не удалось сохранить инструкции. Повторите попытку.");
    } finally {
      setIsSaving(false);
    }
  };

  const canEdit = !isLoading;

  return (
    <div className="instructions-view">
      <section className="instruction-card">
        <div className="instruction-header">
          <div>
            <div className="instruction-id">AI-INSTR</div>
            <h3>Рабочие инструкции для ассистента</h3>
          </div>
          <span className="text-muted">
            {isLoading ? "Загрузка..." : "Редактируйте текст и сохраняйте"}
          </span>
        </div>

        {refreshMessage && (
          <div className="refresh-banner" role="status">
            {refreshMessage}
          </div>
        )}

        {error && <p className="error-message">{error}</p>}

        {!isLoading && !error && !instructionsText.trim() && (
          <p className="text-muted">
            Инструкции пока не добавлены. Заполните поле ниже и сохраните.
          </p>
        )}

        {isLoading ? (
          <div className="instructions-placeholder text-muted">
            Загрузка текущих инструкций...
          </div>
        ) : (
          <textarea
            className="instructions-textarea"
            value={instructionsText}
            onChange={(event) => setInstructionsText(event.target.value)}
            placeholder="Опишите правила и тон общения для ассистента"
            rows={10}
            disabled={!canEdit || isSaving}
          />
        )}

        <div className="instruction-footer">
          <button
            type="button"
            className="primary-button"
            onClick={handleSave}
            disabled={!canEdit || isSaving}
          >
            {isSaving ? "Сохранение..." : "Сохранить"}
          </button>
          {showSuccess && <span className="success-indicator">Сохранено</span>}
        </div>
      </section>

      <div className="supplemental-tips">
        {SOP_TIPS.map((tip) => (
          <article key={tip.id} className="instruction-card">
            <div className="instruction-header">
              <div>
                <div className="instruction-id">{tip.id}</div>
                <h3>{tip.title}</h3>
              </div>
              <span className="text-muted">Обновлено {tip.updated}</span>
            </div>
            <ol>
              {tip.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <div className="instruction-footer">
              <button type="button" className="ghost-button">
                Скопировать текст
              </button>
              <button type="button" className="primary-button">
                Отправить оператору
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
