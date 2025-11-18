const INSTRUCTIONS = [
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
  return (
    <div className="instructions-view">
      {INSTRUCTIONS.map((instruction) => (
        <article key={instruction.id} className="instruction-card">
          <div className="instruction-header">
            <div>
              <div className="instruction-id">{instruction.id}</div>
              <h3>{instruction.title}</h3>
            </div>
            <span className="text-muted">Обновлено {instruction.updated}</span>
          </div>
          <ol>
            {instruction.steps.map((step) => (
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
  );
}
