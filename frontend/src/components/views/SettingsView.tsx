"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteKnowledgeFile,
  fetchKnowledgeFiles,
  uploadKnowledgeFile,
  type KnowledgeFile,
} from "../../../services/knowledgeApi";
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

type NotificationChannel = "email" | "telegram" | "webhook";

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  email: "Email",
  telegram: "Telegram",
  webhook: "Webhook",
};

export default function SettingsView() {
  const { subscribe } = useWSClient();
  const [notifications, setNotifications] = useState<Record<NotificationChannel, boolean>>({
    email: true,
    telegram: true,
    webhook: false,
  });
  const [autoAssign, setAutoAssign] = useState(true);
  const [slaMinutes, setSlaMinutes] = useState(15);
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [isFilesLoading, setIsFilesLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    setIsFilesLoading(true);
    setFilesError(null);
    try {
      const knowledgeFiles = await fetchKnowledgeFiles();
      setFiles(knowledgeFiles);
      return true;
    } catch (error) {
      console.error("Failed to fetch knowledge files", error);
      setFilesError("Не удалось загрузить список файлов. Попробуйте позже.");
      return false;
    } finally {
      setIsFilesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

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
      if (eventName !== "knowledge_updated") {
        return;
      }
      loadFiles().then((success) => {
        if (success) {
          setRefreshMessage("Список файлов обновлён другим администратором.");
        }
      });
    },
    [loadFiles],
  );

  useEffect(() => {
    const unsubscribe = subscribe("events/system", handleSystemEvent);
    return () => {
      unsubscribe();
    };
  }, [handleSystemEvent, subscribe]);

  const formatFileSize = (sizeBytes: number) => {
    const formatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
    if (sizeBytes >= 1024 * 1024) {
      return `${formatter.format(sizeBytes / (1024 * 1024))} МБ`;
    }
    if (sizeBytes >= 1024) {
      return `${formatter.format(sizeBytes / 1024)} КБ`;
    }
    return `${sizeBytes} Б`;
  };

  const handleUpload = async () => {
    if (!selectedFile || isUploading) {
      return;
    }

    setIsUploading(true);
    setUploadStatus("uploading");
    setUploadError(null);
    try {
      await uploadKnowledgeFile(selectedFile);
      setUploadStatus("success");
      setSelectedFile(null);
      await loadFiles();
    } catch (error) {
      console.error("Failed to upload knowledge file", error);
      setUploadError("Ошибка при загрузке файла. Попробуйте снова.");
      setUploadStatus("error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (fileId: number) => {
    try {
      await deleteKnowledgeFile(fileId);
      await loadFiles();
    } catch (error) {
      console.error("Failed to delete knowledge file", error);
      setFilesError("Не удалось удалить файл. Попробуйте позже.");
    }
  };

  const handleDownload = (file: KnowledgeFile) => {
    window.open(`/api/knowledge/files/${file.id}/download`, "_blank");
  };

  return (
    <div className="settings-view">
      <section className="settings-card">
        <header>
          <h3>База знаний</h3>
          <p>Загружайте документы и обновляйте базу для ассистента.</p>
        </header>

        {refreshMessage && (
          <div className="refresh-banner" role="status">
            {refreshMessage}
          </div>
        )}

        <div className="field">
          <span>Файл</span>
          <input
            type="file"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            disabled={isUploading}
          />
        </div>
        <button type="button" className="primary-button" disabled={!selectedFile || isUploading} onClick={handleUpload}>
          {isUploading ? "Загружаем..." : "Загрузить"}
        </button>
        {uploadStatus === "uploading" && <p className="text-muted">Файл отправляется, подождите...</p>}
        {uploadStatus === "success" && <p className="text-muted">Файл успешно загружен.</p>}
        {uploadStatus === "error" && uploadError && <p className="text-muted">{uploadError}</p>}

        <div className="knowledge-files">
          {isFilesLoading && <p className="text-muted">Загружаем список файлов...</p>}
          {!isFilesLoading && filesError && <p className="text-muted">{filesError}</p>}
          {!isFilesLoading && !filesError && files.length === 0 && (
            <p className="text-muted">Файлы ещё не загружены.</p>
          )}
          {!isFilesLoading && !filesError && files.length > 0 && (
            <ul>
              {files.map((file) => (
                <li key={file.id} className="knowledge-file-item">
                  <div>
                    <strong>{file.filename_original}</strong>
                    <div className="text-muted">
                      {formatFileSize(file.size_bytes)} · {file.total_chunks} чанков ·{" "}
                      {new Date(file.created_at).toLocaleString("ru-RU", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </div>
                  </div>
                  <div className="knowledge-file-actions">
                    <button type="button" className="ghost-button" onClick={() => handleDownload(file)}>
                      Скачать
                    </button>
                    <button type="button" className="ghost-button" onClick={() => handleDelete(file.id)}>
                      Удалить
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="settings-card">
        <header>
          <h3>Уведомления</h3>
          <p>Настройте каналы, куда прилетают алерты об эскалациях.</p>
        </header>
        <div className="settings-grid">
          {(Object.keys(CHANNEL_LABEL) as NotificationChannel[]).map((channel) => (
            <label key={channel} className="checkbox-field">
              <input
                type="checkbox"
                checked={notifications[channel]}
                onChange={(event) =>
                  setNotifications((prev) => ({
                    ...prev,
                    [channel]: event.target.checked,
                  }))
                }
              />
              <span>{CHANNEL_LABEL[channel]}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings-card">
        <header>
          <h3>Маршрутизация обращений</h3>
          <p>Правила распределения новых диалогов по очередям.</p>
        </header>
        <label className="switch-field">
          <span>Назначать автоматически по загруженности</span>
          <input type="checkbox" checked={autoAssign} onChange={(event) => setAutoAssign(event.target.checked)} />
        </label>
        <label className="field">
          <span>Максимальное время SLA, мин</span>
          <input
            type="number"
            min={5}
            max={60}
            value={slaMinutes}
            onChange={(event) => setSlaMinutes(Number(event.target.value))}
          />
        </label>
        <button type="button" className="primary-button">
          Сохранить
        </button>
      </section>

      <section className="settings-card">
        <header>
          <h3>Интеграции</h3>
          <p>Подключите CRM и BI системы для расширенной аналитики.</p>
        </header>
        <div className="integrations">
          <article>
            <h4>Bitrix24</h4>
            <p>Синхронизация сделок и автоматическое создание задач.</p>
            <button type="button" className="ghost-button">
              Подключить
            </button>
          </article>
          <article>
            <h4>Power BI</h4>
            <p>Экспорт KPI по очередям в реальном времени.</p>
            <button type="button" className="ghost-button">
              Настроить
            </button>
          </article>
        </div>
      </section>
    </div>
  );
}
