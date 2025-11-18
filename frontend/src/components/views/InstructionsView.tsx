"use client";

import { useEffect, useState } from "react";
import {
  fetchCurrentInstructions,
  updateInstructions,
} from "../../services/aiInstructionsApi";

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
  const [instructionsText, setInstructionsText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadInstructions() {
      setIsLoading(true);
      setError(null);

      try {
        const instructions = await fetchCurrentInstructions();
        if (!isMounted) return;
        setInstructionsText(instructions.text ?? "");
      } catch (err) {
        if (!isMounted) return;
        setError("Не удалось загрузить инструкции. Попробуйте ещё раз.");
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    }

    loadInstructions();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!showSuccess) {
      return undefined;
    }

    const timeout = setTimeout(() => setShowSuccess(false), 2500);
    return () => clearTimeout(timeout);
  }, [showSuccess]);

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
