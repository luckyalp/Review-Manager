import { useState, useRef, useEffect } from "react";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=DM+Mono:wght@400&display=swap');

  .rd-root {
    --petrol: #0f4c5c;
    --petrol-mid: #155e75;
    --petrol-light: #1e7a8c;
    --petrol-subtle: rgba(15, 76, 92, 0.06);
    --teal: #0e7490;
    --teal-subtle: rgba(14, 116, 144, 0.06);
    --sand: #b8966a;
    --bg: #f5f3f0;
    --surface: #ffffff;
    --surface-raised: #fdfcfb;
    --text: #111827;
    --text-secondary: #374151;
    --text-muted: #6b7280;
    --text-faint: #9ca3af;
    --border: #e5e0db;
    --border-hover: #c9c2ba;
    --success: #15803d;
    --success-bg: #f0fdf4;
    --radius-sm: 10px;
    --radius-md: 14px;
    --radius-lg: 18px;
    --shadow-xs: 0 1px 2px rgba(0,0,0,0.04);
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04);

    font-family: 'DM Sans', sans-serif;
    background: var(--bg);
    min-height: 100vh;
    padding: 36px 24px 100px;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-sizing: border-box;
    -webkit-font-smoothing: antialiased;
  }

  .rd-root *,
  .rd-root *::before,
  .rd-root *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  /* ── Header ── */
  .rd-header {
    width: 100%;
    max-width: 640px;
    margin-bottom: 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .rd-header-left {
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .rd-header-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--petrol);
    flex-shrink: 0;
    opacity: 0.7;
  }

  .rd-header-label {
    font-size: 10.5px;
    font-weight: 600;
    color: var(--petrol);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    opacity: 0.85;
  }

  .rd-back-btn {
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 6px 14px;
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    color: var(--text-muted);
    font-family: 'DM Sans', sans-serif;
    box-shadow: var(--shadow-xs);
    transition: border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
    letter-spacing: 0.01em;
  }

  .rd-back-btn:hover {
    border-color: var(--border-hover);
    color: var(--text-secondary);
    box-shadow: var(--shadow-sm);
  }

  .rd-back-btn:active {
    transform: scale(0.98);
    box-shadow: var(--shadow-xs);
  }

  /* ── Review Card ── */
  .rd-review-card {
    width: 100%;
    max-width: 640px;
    background: var(--surface);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    padding: 22px 24px;
    margin-bottom: 28px;
    box-shadow: var(--shadow-sm);
  }

  .rd-reviewer-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .rd-reviewer-name {
    font-weight: 600;
    font-size: 15px;
    color: var(--text);
    letter-spacing: -0.01em;
  }

  .rd-stars {
    color: #f87171;
    font-size: 13px;
    letter-spacing: 1.5px;
    opacity: 0.9;
  }

  .rd-review-text {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.65;
    font-weight: 400;
  }

  .rd-review-meta {
    margin-top: 14px;
    font-size: 10.5px;
    color: var(--text-faint);
    font-family: 'DM Mono', monospace;
    letter-spacing: 0.02em;
  }

  /* ── Section Label ── */
  .rd-section-label {
    width: 100%;
    max-width: 640px;
    font-size: 10px;
    font-weight: 600;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 14px;
  }

  /* ── Answer List ── */
  .rd-answers {
    width: 100%;
    max-width: 640px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 24px;
  }

  /* ── Answer Card ── */
  .rd-answer-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.12s ease;
    box-shadow: var(--shadow-xs);
  }

  .rd-answer-card:hover {
    border-color: var(--border-hover);
    box-shadow: var(--shadow-sm);
    transform: translateY(-1px);
  }

  .rd-answer-card.selected {
    border-color: var(--petrol);
    background: var(--surface-raised);
    box-shadow: 0 0 0 3px var(--petrol-subtle), var(--shadow-sm);
    cursor: default;
    transform: none;
  }

  /* Recovery card */
  .rd-answer-card.recovery {
    border-left: 3px solid var(--teal);
  }

  .rd-answer-card.recovery:hover {
    border-color: rgba(14, 116, 144, 0.4);
    border-left-color: var(--teal);
    box-shadow: var(--shadow-sm);
    transform: translateY(-1px);
  }

  .rd-answer-card.recovery.selected {
    border-color: var(--teal);
    border-left-color: var(--teal);
    background: var(--surface-raised);
    box-shadow: 0 0 0 3px var(--teal-subtle), var(--shadow-sm);
    transform: none;
  }

  /* ── Answer Inner Layout ── */
  .rd-answer-top {
    display: flex;
    align-items: flex-start;
    gap: 13px;
    padding: 16px 18px 13px 18px;
  }

  .rd-answer-indicator {
    width: 19px;
    height: 19px;
    border-radius: 50%;
    border: 1.5px solid var(--border-hover);
    flex-shrink: 0;
    margin-top: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
    background: var(--surface);
  }

  .rd-answer-card:hover .rd-answer-indicator {
    border-color: var(--petrol-light);
  }

  .rd-answer-card.recovery:hover .rd-answer-indicator {
    border-color: var(--teal);
  }

  .rd-answer-card.selected .rd-answer-indicator {
    background: var(--petrol);
    border-color: var(--petrol);
    box-shadow: 0 0 0 3px var(--petrol-subtle);
  }

  .rd-answer-card.recovery.selected .rd-answer-indicator {
    background: var(--teal);
    border-color: var(--teal);
    box-shadow: 0 0 0 3px var(--teal-subtle);
  }

  .rd-check-icon {
    display: none;
    color: white;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
  }

  .rd-answer-card.selected .rd-check-icon {
    display: block;
  }

  /* ── Style Badge ── */
  .rd-answer-style {
    display: inline-block;
    font-size: 9.5px;
    font-weight: 600;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.09em;
    margin-bottom: 7px;
    background: var(--bg);
    padding: 2px 7px;
    border-radius: 4px;
    border: 1px solid var(--border);
    transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
  }

  .rd-answer-card.selected .rd-answer-style {
    color: var(--petrol);
    background: var(--petrol-subtle);
    border-color: rgba(15, 76, 92, 0.15);
  }

  .rd-answer-card.recovery.selected .rd-answer-style {
    color: var(--teal);
    background: var(--teal-subtle);
    border-color: rgba(14, 116, 144, 0.15);
  }

  /* ── Textarea ── */
  .rd-answer-textarea {
    font-size: 13.5px;
    color: var(--text-secondary);
    line-height: 1.65;
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
    font-weight: 400;
    transition: color 0.15s ease;
  }

  .rd-answer-textarea:focus {
    cursor: text;
    color: var(--text);
  }

  .rd-answer-card.selected .rd-answer-textarea {
    cursor: text;
    color: var(--text-secondary);
  }

  /* ── Edit Hint ── */
  .rd-edit-hint {
    display: none;
    padding: 0 18px 13px 50px;
    font-size: 11px;
    color: var(--sand);
    font-style: italic;
    line-height: 1.45;
    font-weight: 400;
    opacity: 0.85;
  }

  .rd-answer-card.selected .rd-edit-hint {
    display: block;
  }

  /* ── Recovery Note ── */
  .rd-recovery-note {
    font-size: 11px;
    color: var(--teal);
    margin-bottom: 6px;
    line-height: 1.45;
    opacity: 0.8;
    font-weight: 400;
  }

  /* ── Recovery Separator ── */
  .rd-recovery-separator {
    width: 100%;
    max-width: 640px;
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
    margin-top: 4px;
  }

  .rd-recovery-separator-line {
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  .rd-recovery-separator-label {
    font-size: 9.5px;
    font-weight: 600;
    color: var(--teal);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    white-space: nowrap;
    opacity: 0.75;
    background: var(--teal-subtle);
    padding: 3px 9px;
    border-radius: 20px;
    border: 1px solid rgba(14, 116, 144, 0.15);
  }

  /* ── Send Bar ── */
  .rd-send-bar {
    width: 100%;
    max-width: 640px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 14px 20px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
  }

  .rd-send-info {
    font-size: 12.5px;
    color: var(--text-faint);
    font-weight: 400;
    letter-spacing: 0.01em;
    transition: color 0.2s ease;
  }

  .rd-send-bar:has(.rd-send-btn.active) .rd-send-info {
    color: var(--text-muted);
  }

  /* ── Send Button ── */
  .rd-send-btn {
    background: var(--petrol);
    color: white;
    border: none;
    border-radius: 40px;
    padding: 9px 26px;
    font-size: 12.5px;
    font-weight: 600;
    font-family: 'DM Sans', sans-serif;
    cursor: pointer;
    transition: background 0.18s ease, opacity 0.2s ease, transform 0.1s ease, box-shadow 0.18s ease;
    opacity: 0.28;
    pointer-events: none;
    flex-shrink: 0;
    letter-spacing: 0.01em;
  }

  .rd-send-btn.active {
    opacity: 1;
    pointer-events: all;
    box-shadow: 0 2px 8px rgba(15, 76, 92, 0.25), 0 1px 2px rgba(15, 76, 92, 0.15);
  }

  .rd-send-btn.active:hover {
    background: var(--petrol-mid);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(15, 76, 92, 0.3), 0 1px 3px rgba(15, 76, 92, 0.15);
  }

  .rd-send-btn.active:active {
    transform: scale(0.97);
    box-shadow: 0 1px 4px rgba(15, 76, 92, 0.2);
  }

  /* ── Toast ── */
  .rd-toast {
    position: fixed;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%) translateY(12px);
    background: var(--success);
    color: white;
    padding: 10px 22px;
    border-radius: 40px;
    font-size: 12.5px;
    font-weight: 500;
    font-family: 'DM Sans', sans-serif;
    opacity: 0;
    transition: opacity 0.22s ease, transform 0.22s ease;
    pointer-events: none;
    white-space: nowrap;
    box-shadow: 0 4px 16px rgba(21, 128, 61, 0.25), 0 1px 4px rgba(0,0,0,0.08);
    letter-spacing: 0.01em;
  }

  .rd-toast.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

  @media (max-width: 680px) {
    .rd-root { padding: 24px 16px 100px; }
    .rd-header { margin-bottom: 22px; }
    .rd-review-card { padding: 18px 18px; }
    .rd-answer-top { padding: 14px 16px 11px 16px; gap: 11px; }
    .rd-edit-hint { padding: 0 16px 11px 47px; }
    .rd-send-bar { padding: 12px 16px; }
    .rd-send-btn { padding: 8px 22px; }
    .rd-toast { white-space: normal; text-align: center; padding: 10px 18px; bottom: 20px; }
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

  // 1. Einstellungen dynamisch aus dem LocalStorage laden
  const settings = JSON.parse(localStorage.getItem('reviewManagerSettings') || '{}');
  const contactEmail = settings.contactEmail || 'kontakt@henrys-sandbar.de';
  const chosenStyle = settings.aiStyle || 'Standard';

  // 2. Antwortoptionen generieren, die die geladenen Einstellungen einbeziehen
  const initialAnswers: AnswerOption[] = [
    {
      id: 1,
      style: `Warm & persönlich ${chosenStyle !== 'Standard' ? `(${chosenStyle})` : ''}`,
      text: `Hallo ${firstName}, das tut uns von Herzen leid. Eine Stunde warten, dann das falsche Gericht — und beim Reklamieren keine Hilfe. Das entspricht nicht unserem Anspruch. Wir haben das intern besprochen. Melde dich gerne bei uns unter: ${contactEmail} — Das Team von Henry's Sandbar`,
    },
    {
      id: 2,
      style: "Ruhig & sachlich",
      text: `Das entspricht nicht unserem Anspruch. Wartezeit, falsches Gericht, unfreundliche Reaktion — das ist dreifach schiefgelaufen. Wir haben die Abläufe intern überprüft. Bitte kontaktieren Sie uns für eine Klärung unter: ${contactEmail} — Das Team von Henry's Sandbar`,
    },
    {
      id: 3,
      style: "Atmosphärisch & Stilvoll",
      text: `${firstName}, dieser Abend war nicht das, wofür Henry's Sandbar steht. Lange warten, dann das Falsche — und als du dich gemeldet hast, kam keine Hilfe. Das wiegt schwer. Unser Fokus liegt auf einer stimmigen Atmosphäre, die hier leider gefehlt hat. Wenn du möchtest, sind wir erreichbar: ${contactEmail} — Das Team von Henry's Sandbar`,
    },
    {
      id: 4,
      style: "Deeskalierend",
      text: `${firstName}, diese Erfahrung tut uns leid — und wir verstehen, dass ein solcher Abend nachwirkt. Wir möchten das nicht einfach übergehen. Wenn du möchtest, melde dich direkt bei uns: ${contactEmail}. Wir nehmen uns die Zeit. — Das Team von Henry's Sandbar`,
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