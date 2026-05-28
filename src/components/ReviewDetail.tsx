import { useState, useRef, useEffect } from "react";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400&display=swap');

  .rd-root {
    --petrol: #0f4c5c;
    --petrol-mid: #155e75;
    --petrol-light: #1e7a8c;
    --teal: #0e7490;
    --teal-light: #cffafe;
    --teal-muted: #a5f3fc;
    --sand: #c8a97e;
    --bg: #f7f5f2;
    --text: #1a1a1a;
    --text-muted: #6b7280;
    --border: #e2ddd8;
    --success: #16a34a;

    font-family: 'DM Sans', sans-serif;
    background: var(--bg);
    min-height: 100vh;
    padding: 28px 24px 80px;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-sizing: border-box;
  }

  .rd-root *,
  .rd-root *::before,
  .rd-root *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .rd-header {
    width: 100%;
    max-width: 620px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .rd-header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .rd-header-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--petrol);
    flex-shrink: 0;
  }

  .rd-header-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--petrol);
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .rd-back-btn {
    background: transparent;
    border: 1px solid var(--border);
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    color: var(--text-muted);
  }

  .rd-back-btn:hover {
    border-color: var(--text-muted);
    color: var(--text);
  }

  .rd-review-card {
    width: 100%;
    max-width: 620px;
    background: white;
    border-radius: 16px;
    border: 1px solid var(--border);
    padding: 20px;
    margin-bottom: 24px;
  }

  .rd-reviewer-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .rd-reviewer-name {
    font-weight: 600;
    font-size: 15px;
    color: var(--text);
  }

  .rd-stars {
    color: #ef4444;
    font-size: 14px;
    letter-spacing: 1px;
  }

  .rd-review-text {
    font-size: 14px;
    color: #374151;
    line-height: 1.6;
  }

  .rd-review-meta {
    margin-top: 10px;
    font-size: 11px;
    color: var(--text-muted);
    font-family: 'DM Mono', monospace;
  }

  .rd-section-label {
    width: 100%;
    max-width: 620px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 12px;
  }

  .rd-answers {
    width: 100%;
    max-width: 620px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 20px;
  }

  .rd-answer-card {
    background: white;
    border: 1.5px solid var(--border);
    border-radius: 16px;
    cursor: pointer;
    transition: border-color 0.2s ease;
  }

  .rd-answer-card:hover {
    border-color: var(--petrol-light);
  }

  .rd-answer-card.selected {
    border-color: var(--petrol);
    box-shadow: 0 0 0 3px rgba(15, 76, 92, 0.07);
    cursor: default;
  }

  .rd-answer-card.recovery {
    border-left: 2.5px solid var(--teal);
  }

  .rd-answer-card.recovery:hover {
    border-color: var(--teal);
    border-left-color: var(--teal);
  }

  .rd-answer-card.recovery.selected {
    border-color: var(--teal);
    border-left-color: var(--teal);
    box-shadow: 0 0 0 3px rgba(14, 116, 144, 0.07);
  }

  .rd-answer-top {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 15px 16px 12px 16px;
  }

  .rd-answer-indicator {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1.5px solid var(--border);
    flex-shrink: 0;
    margin-top: 1px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    background: white;
  }

  .rd-answer-card.selected .rd-answer-indicator {
    background: var(--petrol);
    border-color: var(--petrol);
  }

  .rd-answer-card.recovery.selected .rd-answer-indicator {
    background: var(--teal);
    border-color: var(--teal);
  }

  .rd-check-icon {
    display: none;
    color: white;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
  }

  .rd-answer-card.selected .rd-check-icon {
    display: block;
  }

  .rd-answer-style {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-bottom: 5px;
  }

  .rd-answer-card.selected .rd-answer-style {
    color: var(--petrol);
  }

  .rd-answer-card.recovery.selected .rd-answer-style {
    color: var(--teal);
  }

  .rd-answer-textarea {
    font-size: 14px;
    color: #374151;
    line-height: 1.6;
    width: 100%;
    border: none;
    outline: none;
    background: transparent;
    font-family: 'DM Sans', sans-serif;
    resize: none;
    cursor: pointer;
    overflow: hidden;
    padding: 0;
    margin: 0;
  }

  .rd-answer-textarea:focus {
    cursor: text;
    color: var(--text);
  }

  .rd-answer-card.selected .rd-answer-textarea {
    cursor: text;
  }

  .rd-edit-hint {
    display: none;
    padding: 0 16px 11px 48px;
    font-size: 11px;
    color: var(--sand);
    font-style: italic;
    line-height: 1.4;
  }

  .rd-answer-card.selected .rd-edit-hint {
    display: block;
  }

  .rd-recovery-note {
    font-size: 11px;
    color: var(--teal);
    margin-bottom: 5px;
    line-height: 1.4;
    opacity: 0.85;
  }

  .rd-recovery-separator {
    width: 100%;
    max-width: 620px;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  .rd-recovery-separator-line {
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  .rd-recovery-separator-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--teal);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    white-space: nowrap;
  }

  .rd-send-bar {
    width: 100%;
    max-width: 620px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 13px 18px;
    background: white;
    border: 1.5px solid var(--border);
    border-radius: 16px;
  }

  .rd-send-info {
    font-size: 13px;
    color: var(--text-muted);
  }

  .rd-send-btn {
    background: var(--petrol);
    color: white;
    border: none;
    border-radius: 40px;
    padding: 9px 24px;
    font-size: 13px;
    font-weight: 600;
    font-family: 'DM Sans', sans-serif;
    cursor: pointer;
    transition: background 0.2s ease, opacity 0.2s ease, transform 0.1s ease;
    opacity: 0.35;
    pointer-events: none;
    flex-shrink: 0;
  }

  .rd-send-btn.active {
    opacity: 1;
    pointer-events: all;
  }

  .rd-send-btn.active:hover {
    background: var(--petrol-mid);
    transform: scale(0.98);
  }

  .rd-send-btn.active:active {
    transform: scale(0.96);
  }

  .rd-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%) translateY(16px);
    background: var(--success);
    color: white;
    padding: 10px 24px;
    border-radius: 40px;
    font-size: 13px;
    font-weight: 500;
    font-family: 'DM Sans', sans-serif;
    opacity: 0;
    transition: opacity 0.25s ease, transform 0.25s ease;
    pointer-events: none;
    white-space: nowrap;
  }

  .rd-toast.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

  @media (max-width: 680px) {
    .rd-root { padding: 20px 14px 80px; }
    .rd-review-card { padding: 16px; }
    .rd-answer-top { padding: 13px 14px 10px 14px; gap: 10px; }
    .rd-edit-hint { padding: 0 14px 10px 44px; }
    .rd-send-bar { padding: 11px 14px; }
    .rd-send-btn { padding: 8px 20px; }
    .rd-toast { white-space: normal; text-align: center; padding: 9px 18px; bottom: 16px; }
  }
`;

interface AnswerOption {
  id: number;
  style: string;
  text: string;
  isRecovery?: boolean;
}

interface ReviewDetailProps {
  review: {
    id: number;
    name: string;
    stars: number;
    text: string;
    date: string;
    status: string;
  };
  onStatusChange: (id: number, status: 'Ausstehend' | 'Beantwortet' | 'Abgelehnt') => void;
  onBack: () => void;
}

export default function ReviewDetail({ review, onStatusChange, onBack }: ReviewDetailProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showToast, setShowToast] = useState(false);
  const textareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});

  const firstName = review.name.split(' ')[0];

  const initialAnswers: AnswerOption[] = [
    {
      id: 1,
      style: "Warm & persönlich",
      text: `Hallo ${firstName}, das tut uns von Herzen leid. Eine Stunde warten, dann das falsche Gericht — und beim Reklamieren keine Hilfe. Das entspricht nicht unserem Anspruch. Wir haben das intern besprochen. Melde dich gerne bei uns: kontakt@henrys-sandbar.de — Das Team von Henry's Sandbar`,
    },
    {
      id: 2,
      style: "Ruhig & sachlich",
      text: `Das entspricht nicht unserem Anspruch. Wartezeit, falsches Gericht, unfreundliche Reaktion — das ist dreifach schiefgelaufen. Wir haben die Abläufe intern überprüft. Kontakt: kontakt@henrys-sandbar.de — Das Team von Henry's Sandbar`,
    },
    {
      id: 3,
      style: "Atmosphärisch",
      text: `${firstName}, dieser Abend war nicht das, wofür Henry's Sandbar steht. Lange warten, dann das Falsche — und als du dich gemeldet hast, kam keine Hilfe. Das wiegt schwer. Wenn du möchtest, sind wir da: kontakt@henrys-sandbar.de — Das Team von Henry's Sandbar`,
    },
    {
      id: 4,
      style: "Deeskalierend",
      text: `${firstName}, diese Erfahrung tut uns leid — und wir verstehen, dass ein solcher Abend nachwirkt. Wir möchten das nicht einfach übergehen. Wenn du möchtest, melde dich direkt bei uns: kontakt@henrys-sandbar.de. Wir nehmen uns die Zeit. — Das Team von Henry's Sandbar`,
      isRecovery: true,
    },
  ];

  const [answers, setAnswers] = useState<AnswerOption[]>(initialAnswers);

  useEffect(() => {
    setAnswers(initialAnswers);
    setSelectedId(null);
  }, [review]);

  useEffect(() => {
    const id = "review-detail-styles";
    if (!document.getElementById(id)) {
      const tag = document.createElement("style");
      tag.id = id;
      tag.textContent = styles;
      document.head.appendChild(tag);
    }
  }, []);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  useEffect(() => {
    Object.values(textareaRefs.current).forEach((el) => {
      if (el) autoResize(el);
    });
  }, [answers]);

  const handleSelect = (id: number) => {
    if (selectedId === id) {
      setSelectedId(null);
    } else {
      setSelectedId(id);
      setTimeout(() => {
        const el = textareaRefs.current[id];
        if (el) autoResize(el);
      }, 0);
    }
  };

  const handleTextChange = (id: number, value: string) => {
    setAnswers((prev) =>
      prev.map((a) => (a.id === id ? { ...a, text: value } : a))
    );
    const el = textareaRefs.current[id];
    if (el) autoResize(el);
  };

  const handleSend = () => {
    setShowToast(true);
    onStatusChange(review.id, 'Beantwortet');
    setSelectedId(null);
    setTimeout(() => {
      setShowToast(false);
      onBack();
    }, 2000);
  };

  const normalAnswers = answers.filter((a) => !a.isRecovery);
  const recoveryAnswer = answers.find((a) => a.isRecovery);

  const renderCard = (answer: AnswerOption) => {
    const isSelected = selectedId === answer.id;
    const isRecovery = !!answer.isRecovery;
    return (
      <div
        key={answer.id}
        className={`rd-answer-card${isRecovery ? " recovery" : ""}${isSelected ? " selected" : ""}`}
        onClick={() => handleSelect(answer.id)}
      >
        <div className="rd-answer-top">
          <div className="rd-answer-indicator">
            <span className="rd-check-icon">✓</span>
          </div>
          <div style={{ flex: 1 }}>
            {isRecovery && (
              <div className="rd-recovery-note">
                Fokus auf Vertrauen und Deeskalation.
              </div>
            )}
            <div className="rd-answer-style">{answer.style}</div>
            <textarea
              ref={(el) => { textareaRefs.current[answer.id] = el; }}
              className="rd-answer-textarea"
              rows={3}
              readOnly={!isSelected}
              value={answer.text}
              onChange={(e) => handleTextChange(answer.id, e.target.value)}
              onClick={(e) => isSelected && e.stopPropagation()}
            />
          </div>
        </div>
        <div className="rd-edit-hint">Direkt im Text anpassen, falls gewünscht.</div>
      </div>
    );
  };

  return (
    <div className="rd-root">
      <div className="rd-header">
        <div className="rd-header-left">
          <div className="rd-header-dot" />
          <span className="rd-header-label">Bewertung Details</span>
        </div>
        <button className="rd-back-btn" onClick={onBack}>← Zurück</button>
      </div>

      <div className="rd-review-card">
        <div className="rd-reviewer-row">
          <span className="rd-reviewer-name">{review.name}</span>
          <span className="rd-stars">{'★'.repeat(review.stars)}{'☆'.repeat(5 - review.stars)}</span>
        </div>
        <div className="rd-review-text">{review.text}</div>
        <div className="rd-review-meta">Google · {review.date} · {review.stars} {review.stars === 1 ? 'Stern' : 'Sterne'}</div>
      </div>

      <div className="rd-section-label">Antwort wählen — oder nach Auswahl anpassen</div>

      <div className="rd-answers">
        {normalAnswers.map(renderCard)}
      </div>

      {review.stars <= 2 && recoveryAnswer && (
        <>
          <div className="rd-recovery-separator">
            <div className="rd-recovery-separator-line" />
            <span className="rd-recovery-separator-label">Empfohlen bei 1–2 Sternen</span>
            <div className="rd-recovery-separator-line" />
          </div>
          <div className="rd-answers">
            {renderCard(recoveryAnswer)}
          </div>
        </>
      )}

      <div className="rd-send-bar">
        <span className="rd-send-info">
          {selectedId !== null ? "Bereit zum Senden" : "Erst eine Antwort auswählen"}
        </span>
        <button
          className={`rd-send-btn${selectedId !== null ? " active" : ""}`}
          onClick={selectedId !== null ? handleSend : undefined}
        >
          Antwort senden
        </button>
      </div>

      <div className={`rd-toast${showToast ? " show" : ""}`}>
        ✓ Antwort wurde gesendet
      </div>
    </div>
  );
}