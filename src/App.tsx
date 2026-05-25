import { useState, useEffect } from 'react'

// ─── TYPES ───────────────────────────────────────────────────────────────────

type ReviewStatus = 'Ausstehend' | 'Beantwortet' | 'Abgelehnt'

interface Review {
  id: number
  name: string
  initials: string
  stars: number
  text: string
  date: string
  status: ReviewStatus
  photoUrl?: string
}

// ─── DATA ────────────────────────────────────────────────────────────────────

const INITIAL_REVIEWS: Review[] = [
  { id: 1, name: 'Sandra L.', initials: 'SA', stars: 3, date: '24. Mai 2026', status: 'Ausstehend', text: 'Toller Ort für ein romantisches Dinner. Die Dekoration ist wunderschön und das Essen schmeckt hervorragend. Nur die Wartezeit auf den Nachtisch war etwas lang. Gerne wieder!' },
  { id: 2, name: 'Klaus H.', initials: 'KL', stars: 5, date: '24. Mai 2026', status: 'Ausstehend', text: 'Ein Abend der Extraklasse! Von der Vorspeise bis zum Dessert war alles perfekt. Das Rinderfilet war das Beste, das ich je gegessen habe. Das Personal ist zuvorkommend und professionell.' },
  { id: 3, name: 'Anna W.', initials: 'AN', stars: 1, date: '24. Mai 2026', status: 'Ausstehend', text: 'Schreckliche Erfahrung. Wir warteten über eine Stunde auf unser Essen, das dann noch falsch war. Als wir reklamierten, wurde das Personal unhöflich. Wir kommen nie wieder.' },
  { id: 4, name: 'Stefan B.', initials: 'ST', stars: 2, date: '24. Mai 2026', status: 'Ausstehend', text: 'Leider enttäuschend. Das Essen kam kalt an und der Service war desinteressiert. Für den Preis hätten wir mehr erwartet. Schade, denn die Lage ist wirklich toll.' },
  { id: 5, name: 'Julia M.', initials: 'JU', stars: 3, date: '24. Mai 2026', status: 'Ausstehend', text: 'Das Essen war in Ordnung, aber nichts Besonderes. Wir mussten lange auf unsere Bestellung warten. Der Preis-Leistungs-Verhältnis könnte besser sein.' },
  { id: 6, name: 'Michael K.', initials: 'MI', stars: 4, date: '23. Mai 2026', status: 'Ausstehend', text: 'Sehr schönes Restaurant mit toller Atmosphäre. Das Essen war lecker und frisch. Der Service könnte etwas aufmerksamer sein, aber insgesamt ein gelungener Abend.' },
  { id: 7, name: 'Lisa T.', initials: 'LI', stars: 5, date: '22. Mai 2026', status: 'Ausstehend', text: 'Absolut fantastisch! Jedes Gericht war ein Kunstwerk. Der Chef ist offensichtlich sehr talentiert. Wir werden definitiv wiederkommen und Freunde mitbringen!' },
]

// ─── APP ─────────────────────────────────────────────────────────────────────

function App() {
  const [page, setPage] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS)

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'reviews', label: 'Bewertungen', icon: '💬' },
    { id: 'analytics', label: 'Analyse', icon: '📈' },
    { id: 'settings', label: 'Einstellungen', icon: '⚙️' },
  ]

  const navigate = (id: string) => { setPage(id); setMenuOpen(false) }

  const updateReviewStatus = (id: number, status: ReviewStatus) => {
    setReviews(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  const deleteReview = (id: number) => {
    setReviews(prev => prev.filter(r => r.id !== id))
  }

  const stats = {
    total: reviews.length,
    avg: reviews.length ? (reviews.reduce((s, r) => s + r.stars, 0) / reviews.length).toFixed(1) : '–',
    pending: reviews.filter(r => r.status === 'Ausstehend').length,
    answered: reviews.filter(r => r.status === 'Beantwortet').length,
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f3f4f6' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .sidebar { width: 255px; background: #0f172a; color: #fff; display: flex; flex-direction: column; flex-shrink: 0; }
        .mobile-header { display: none; position: fixed; top: 0; left: 0; right: 0; z-index: 200; background: #0f172a; height: 56px; align-items: center; padding: 0 16px; gap: 12px; }
        .mobile-dropdown { display: none; }
        .main-pad { padding: 28px 130px; }
        .grid4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .grid-dashboard { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
        .grid2i { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .grid3i { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
        .nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 8px; cursor: pointer; margin-bottom: 2px; font-size: 16px; transition: all 0.15s; }
        .nav-item:hover { background: rgba(255,255,255,0.06); }
        @media (max-width: 768px) {
          .sidebar { display: none !important; }
          .mobile-header { display: flex !important; }
          .mobile-dropdown.open { display: block !important; position: fixed; top: 56px; left: 0; right: 0; z-index: 199; background: #0f172a; padding: 8px; }
          .main-pad { padding: 72px 16px 16px; }
          .grid4 { grid-template-columns: 1fr 1fr !important; }
          .grid2 { grid-template-columns: 1fr !important; }
          .grid-dashboard { grid-template-columns: 1fr !important; }
          .grid2i { grid-template-columns: 1fr !important; }
          .grid3i { grid-template-columns: 1fr 1fr !important; }
          .review-actions { flex-wrap: wrap; }
        }
      `}</style>

      {/* Sidebar Desktop */}
      <div className="sidebar">
        <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #1e293b' }}>
          <div style={{ background: '#4f46e5', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>🏪</div>
          <span style={{ fontWeight: '600', fontSize: '15px' }}>ReviewMonitor</span>
        </div>
        <nav style={{ padding: '12px 8px', flex: 1 }}>
          {navItems.map(item => (
            <div key={item.id} className="nav-item" onClick={() => navigate(item.id)}
              style={{ background: page === item.id ? '#4f46e5' : 'transparent', color: page === item.id ? '#fff' : '#94a3b8', fontWeight: page === item.id ? '500' : '400' }}>
              <span>{item.icon}</span><span>{item.label}</span>
            </div>
          ))}
        </nav>
        <div style={{ padding: '12px 8px', borderTop: '1px solid #1e293b' }}>
          <button style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', borderRadius: '8px', border: '1px solid #1e293b', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>
            🔄 Bewertungen synchronisieren
          </button>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="mobile-header">
        <div style={{ background: '#4f46e5', borderRadius: '8px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🏪</div>
        <span style={{ color: '#fff', fontWeight: '600', fontSize: '15px', flex: 1 }}>ReviewMonitor</span>
        <div onClick={() => setMenuOpen(!menuOpen)} style={{ color: '#fff', fontSize: '22px', cursor: 'pointer', padding: '4px' }}>{menuOpen ? '✕' : '☰'}</div>
      </div>

      {/* Mobile Dropdown */}
      <div className={`mobile-dropdown${menuOpen ? ' open' : ''}`}>
        {navItems.map(item => (
          <div key={item.id} className="nav-item" onClick={() => navigate(item.id)}
            style={{ background: page === item.id ? '#4f46e5' : 'transparent', color: page === item.id ? '#fff' : '#94a3b8' }}>
            <span>{item.icon}</span><span>{item.label}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid #1e293b', marginTop: '8px', paddingTop: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', color: '#94a3b8', fontSize: '16px' }}>🔄 Bewertungen synchronisieren</div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="main-pad">
          {page === 'dashboard' && <Dashboard stats={stats} reviews={reviews} navigate={navigate} />}
          {page === 'reviews' && <Reviews reviews={reviews} onStatusChange={updateReviewStatus} onDelete={deleteReview} />}
          {page === 'analytics' && <Analytics reviews={reviews} />}
          {page === 'settings' && <Settings />}
        </div>
      </div>
    </div>
  )
}

// ─── AVATAR ──────────────────────────────────────────────────────────────────

function Avatar({ name, initials, photoUrl, size = 40 }: { name: string, initials: string, photoUrl?: string, size?: number }) {
  if (photoUrl) return <img src={photoUrl} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', fontSize: size * 0.35, fontWeight: '600', flexShrink: 0 }}>
      {initials}
    </div>
  )
}

// ─── STARS ───────────────────────────────────────────────────────────────────

function Stars({ n, size = 18 }: { n: number, size?: number }) {
  return (
    <span style={{ fontSize: size, letterSpacing: '2px' }}>
      <span style={{ color: '#F0B100' }}>{'★'.repeat(n)}</span>
      <span style={{ color: '#d1d5db' }}>{'☆'.repeat(5 - n)}</span>
    </span>
  )
}

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReviewStatus }) {
  const cfg = {
    'Ausstehend': { bg: '#fef3c7', color: '#92400e' },
    'Beantwortet': { bg: '#dcfce7', color: '#166534' },
    'Abgelehnt': { bg: '#fee2e2', color: '#991b1b' },
  }[status]
  return <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '20px', background: cfg.bg, color: cfg.color, fontWeight: '500', whiteSpace: 'nowrap' }}>{status}</span>
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

function Dashboard({ stats, reviews, navigate }: { stats: any, reviews: Review[], navigate: (p: string) => void }) {
  const [testRunning, setTestRunning] = useState(false)
  const [testDone, setTestDone] = useState(false)

  const recent = reviews.slice(0, 3)

  const distrib = [5,4,3,2,1].map(s => ({
    stars: s,
    count: reviews.filter(r => r.stars === s).length,
    pct: reviews.length ? Math.round(reviews.filter(r => r.stars === s).length / reviews.length * 100) : 0,
    color: '#F0B100',
  }))

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '30px', fontWeight: '600', marginBottom: '4px', color: '#111827' }}>Dashboard</h1>
          <p style={{ color: '#6b7280', fontSize: '16px' }}>Übersicht Ihrer Google-Unternehmensbewertungen.</p>
        </div>
        <button style={{ padding: '8px 16px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px', color: '#374151', fontWeight: '500' }}>
          🔄 Jetzt synchronisieren
        </button>
      </div>

      {/* Stats */}
      <div className="grid4" style={{ marginBottom: '16px' }}>
        {[
          { label: 'Bewertungen gesamt', value: stats.total, icon: '💬', color: '#111827' },
          { label: 'Ø Bewertung', value: stats.avg, icon: '⭐', color: '#111827' },
          { label: 'Ausstehend', value: stats.pending, icon: '📋', color: '#111827' },
          { label: 'Beantwortet', value: stats.answered, icon: '📊', color: '#111827' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: '12px', padding: '18px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>{s.label}</div>
              <span style={{ fontSize: '18px' }}>{s.icon}</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: '600', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Sync Status */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '14px 18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>Automatischer Sync aktiv</span>
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>(stündlich)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>🕐 Nächster Sync: in etwa 1 Stunde</span>
        </div>
      </div>

      {/* System Test */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px dashed #d1d5db', padding: '16px 18px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>🧪</span>
          <div>
            <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '3px', color: '#111827' }}>System-Test</div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>Erstellt eine realistische Test-Bewertung, generiert 3 KI-Antworten und sendet (falls konfiguriert) eine Test-E-Mail.</div>
          </div>
        </div>
        <button onClick={() => { setTestRunning(true); setTimeout(() => { setTestRunning(false); setTestDone(true) }, 2500) }}
          disabled={testRunning}
          style={{ padding: '8px 18px', background: testDone ? '#dcfce7' : '#fff', border: `1px solid ${testDone ? '#86efac' : '#d1d5db'}`, borderRadius: '8px', cursor: testRunning ? 'default' : 'pointer', fontSize: '13px', fontFamily: 'inherit', color: testDone ? '#166534' : '#374151', fontWeight: '500', whiteSpace: 'nowrap' }}>
          {testRunning ? '⏳ Läuft...' : testDone ? '✅ Erfolgreich' : '🧪 Test starten'}
        </button>
      </div>

      {/* Reviews + Distribution */}
      <div className="grid-dashboard">
        {/* Aktuelle Bewertungen */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ fontWeight: '600', fontSize: '16px', color: '#111827' }}>Aktuelle Bewertungen</div>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Neueste Bewertungen Ihrer Kunden</div>
          </div>
          <div style={{ padding: '12px' }}>
            {recent.map(r => (
              <div key={r.id} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #f3f4f6', marginBottom: '8px', background: '#fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Avatar name={r.name} initials={r.initials} photoUrl={r.photoUrl} size={36} />
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '13px', color: '#111827' }}>{r.name}</div>
                      <Stars n={r.stars} size={12} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>{r.date}</div>
                    <StatusBadge status={r.status} />
                  </div>
                </div>
                <Stars n={r.stars} />
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px', lineHeight: '1.5' }}>{r.text.length > 100 ? r.text.slice(0, 100) + '…' : r.text}</div>
                <button onClick={() => navigate('reviews')} style={{ marginTop: '10px', padding: '6px 14px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit', color: '#374151' }}>
                  Ansehen & Antworten
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Bewertungsverteilung */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden', alignSelf: 'start' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ fontWeight: '600', fontSize: '16px', color: '#111827' }}>Bewertungsverteilung</div>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Verteilung aller Bewertungen</div>
          </div>
          <div style={{ padding: '18px' }}>
            {distrib.map(row => (
              <div key={row.stars} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{ width: '28px', fontSize: '16px', color: '#6b7280', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '2px' }}>
                  {row.stars} <span style={{ fontSize: '13px' }}>☆</span>
                </div>
                <div style={{ flex: 1, height: '10px', background: '#f3f4f6', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${row.pct}%`, background: row.color, borderRadius: '5px', transition: 'width 0.3s' }} />
                </div>
                <div style={{ width: '36px', fontSize: '13px', color: '#374151', textAlign: 'right', flexShrink: 0 }}>{row.pct}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── BEWERTUNGEN ─────────────────────────────────────────────────────────────

const AI_RESPONSES = [
  { label: '💬 Herzlich & persönlich', text: (name: string) => `Liebe/r ${name}, vielen herzlichen Dank für Ihre Bewertung! Es freut uns sehr zu hören, dass Sie bei uns waren. Wir heißen Sie jederzeit wieder herzlich willkommen!` },
  { label: '👔 Professionell & freundlich', text: (name: string) => `Vielen Dank für Ihr Feedback, ${name}! Wir freuen uns über Ihre Rückmeldung und nehmen uns Ihre Anmerkungen zu Herzen. Es ist unser Ziel, jedem Gast ein angenehmes Erlebnis zu bieten. Wir freuen uns auf Ihren nächsten Besuch.` },
  { label: '⚡ Kurz & direkt', text: (_: string) => `Vielen Dank für die Bewertung! Ihr Feedback ist uns wichtig. Wir freuen uns auf Ihren nächsten Besuch.` },
]

function Reviews({ reviews, onStatusChange, onDelete }: { reviews: Review[], onStatusChange: (id: number, s: ReviewStatus) => void, onDelete: (id: number) => void }) {
  const [openAI, setOpenAI] = useState<number | null>(null)
  const [selected, setSelected] = useState<{[key: number]: number}>({})
  const [filterStatus, setFilterStatus] = useState('alle')
  const [filterStars, setFilterStars] = useState('alle')
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  const filtered = reviews.filter(r => {
    if (filterStatus === 'ausstehend' && r.status !== 'Ausstehend') return false
    if (filterStatus === 'beantwortet' && r.status !== 'Beantwortet') return false
    if (filterStatus === 'abgelehnt' && r.status !== 'Abgelehnt') return false
    if (filterStars !== 'alle' && r.stars !== parseInt(filterStars)) return false
    return true
  })

  const sel: React.CSSProperties = { padding: '7px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '30px', fontWeight: '600', marginBottom: '4px', color: '#111827' }}>Bewertungen</h1>
        <p style={{ color: '#6b7280', fontSize: '16px' }}>Verwalten und beantworten Sie alle Kundenbewertungen.</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <select style={sel} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="alle">Alle Status</option>
            <option value="ausstehend">Ausstehend</option>
            <option value="beantwortet">Beantwortet</option>
            <option value="abgelehnt">Abgelehnt</option>
          </select>
          <select style={sel} value={filterStars} onChange={e => setFilterStars(e.target.value)}>
            <option value="alle">Alle Sterne</option>
            <option value="5">5 Sterne</option>
            <option value="4">4 Sterne</option>
            <option value="3">3 Sterne</option>
            <option value="2">2 Sterne</option>
            <option value="1">1 Stern</option>
          </select>
        </div>
        <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>{filtered.length} Bewertungen</span>
      </div>

      {filtered.map(review => (
        <div key={review.id} style={{ background: '#fff', borderRadius: '12px', padding: '18px', border: '1px solid #e5e7eb', marginBottom: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', opacity: review.status === 'Abgelehnt' ? 0.65 : 1 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
            <Avatar name={review.name} initials={review.initials} photoUrl={review.photoUrl} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '16px', color: '#111827' }}>{review.name}</div>
                  <div style={{ marginTop: '3px' }}><Stars n={review.stars} /></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>{review.date}</div>
                  <StatusBadge status={review.status} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '16px', color: '#374151', lineHeight: '1.6', marginBottom: '14px' }}>{review.text}</div>

          {/* Ausgewählte Antwort Box — grün wie Replit */}
          {review.status === 'Beantwortet' && selected[review.id] !== undefined && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#166534', marginBottom: '6px' }}>Ausgewählte Antwort:</div>
              <div style={{ fontSize: '13px', color: '#166534', lineHeight: '1.6' }}>{AI_RESPONSES[selected[review.id]].text(review.name.split(' ')[0])}</div>
            </div>
          )}

          {/* Actions */}
          <div className="review-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setOpenAI(openAI === review.id ? null : review.id)}
              style={{ padding: '7px 14px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', color: '#374151', fontWeight: '500' }}>
              Details anzeigen
            </button>

            {/* Antworten generieren — nur wenn noch nicht beantwortet */}
            {review.status !== 'Beantwortet' && (
              <button
                onClick={() => setOpenAI(openAI === review.id ? null : review.id)}
                style={{ padding: '7px 14px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ✨ Antworten generieren
              </button>
            )}

            {/* Antwort ausgewählt Badge */}
            {review.status === 'Beantwortet' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', fontSize: '13px', fontWeight: '500' }}>
                ✅ Antwort ausgewählt
              </div>
            )}

            {review.status !== 'Beantwortet' && (
              <button
                onClick={() => onStatusChange(review.id, 'Abgelehnt')}
                disabled={review.status === 'Abgelehnt'}
                style={{ padding: '7px 14px', background: 'transparent', border: 'none', borderRadius: '7px', cursor: review.status === 'Abgelehnt' ? 'default' : 'pointer', fontSize: '13px', fontFamily: 'inherit', color: review.status === 'Abgelehnt' ? '#9ca3af' : '#6b7280', display: 'flex', alignItems: 'center', gap: '5px' }}>
                ⊗ Ablehnen
              </button>
            )}

            <div style={{ flex: 1 }} />
            {confirmDelete === review.id ? (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#ef4444' }}>Wirklich löschen?</span>
                <button onClick={() => { onDelete(review.id); setConfirmDelete(null) }} style={{ padding: '5px 10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>Ja</button>
                <button onClick={() => setConfirmDelete(null)} style={{ padding: '5px 10px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>Nein</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(review.id)} style={{ padding: '7px 10px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#9ca3af' }} title="Löschen">🗑️</button>
            )}
          </div>

          {/* AI Responses */}
          {openAI === review.id && review.status !== 'Beantwortet' && (
            <div style={{ marginTop: '14px', padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '10px' }}>3 KI-Antwortvorschläge — bitte auswählen:</div>
              {AI_RESPONSES.map((a, i) => (
                <div key={i} onClick={() => setSelected({...selected, [review.id]: i})}
                  style={{ padding: '12px', borderRadius: '8px', border: `1.5px solid ${selected[review.id] === i ? '#4f46e5' : '#e5e7eb'}`, background: selected[review.id] === i ? '#eef2ff' : '#fff', cursor: 'pointer', marginBottom: '8px', fontSize: '13px', lineHeight: '1.6' }}>
                  <div style={{ fontWeight: '600', fontSize: '12px', marginBottom: '4px', color: '#4f46e5' }}>{a.label}</div>
                  {a.text(review.name.split(' ')[0])}
                </div>
              ))}
              {selected[review.id] !== undefined && (
                <button onClick={() => { onStatusChange(review.id, 'Beantwortet'); setOpenAI(null) }}
                  style={{ padding: '8px 18px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', fontWeight: '500' }}>
                  ✅ Ausgewählte Antwort senden
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── ANALYSE ─────────────────────────────────────────────────────────────────

function Analytics({ reviews }: { reviews: Review[] }) {
  const [aiStarted, setAiStarted] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiDone, setAiDone] = useState(false)

  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.stars, 0) / reviews.length).toFixed(1) : '–'
  const answered = reviews.filter(r => r.status === 'Beantwortet').length
  const pending = reviews.filter(r => r.status === 'Ausstehend').length
  const rate = reviews.length ? Math.round(answered / reviews.length * 100) : 0

  const distrib = [5,4,3,2,1].map(s => ({
    stars: s, count: reviews.filter(r => r.stars === s).length,
    pct: reviews.length ? Math.round(reviews.filter(r => r.stars === s).length / reviews.length * 100) : 0,
    color: '#F0B100',
  }))

  const startAI = () => { setAiStarted(true); setAiLoading(true); setTimeout(() => { setAiLoading(false); setAiDone(true) }, 3000) }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '30px', fontWeight: '600', marginBottom: '4px', color: '#111827' }}>Analyse</h1>
          <p style={{ color: '#6b7280', fontSize: '16px' }}>Statistiken & KI-Auswertung Ihrer Bewertungen.</p>
        </div>
        <button onClick={startAI} style={{ padding: '9px 18px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', fontWeight: '500' }}>
          ✨ KI-Analyse starten
        </button>
      </div>

      <div className="grid4" style={{ marginBottom: '20px' }}>
        {[
          { label: 'Ø Bewertung', value: avg, sub: 'von 5 Sternen', color: '#111827', icon: '⭐' },
          { label: 'Bewertungen gesamt', value: reviews.length, sub: '', color: '#111827', icon: '💬' },
          { label: 'Antwortrate', value: `${rate}%`, sub: `${answered} beantwortet`, color: '#111827', icon: '✅' },
          { label: 'Ausstehend', value: pending, sub: 'Warten auf Antwort', color: '#F0B100', icon: '⏳' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: '12px', padding: '18px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>{s.label}</div><span>{s.icon}</span>
            </div>
            <div style={{ fontSize: '26px', fontWeight: '600', color: s.color }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '3px' }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid2" style={{ marginBottom: '20px' }}>
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '16px' }}>Sternverteilung</div>
          <div style={{ padding: '16px 18px' }}>
            {distrib.map(row => (
              <div key={row.stars} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{ width: '28px', fontSize: '16px', color: '#6b7280', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <span style={{ display: 'inline-block', width: '10px', textAlign: 'right' }}>{row.stars}</span>
                  <span style={{ fontSize: '13px' }}>☆</span>
                </div>
                <div style={{ flex: 1, height: '10px', background: '#f3f4f6', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${row.pct}%`, background: row.color, borderRadius: '5px' }} />
                </div>
                <div style={{ width: '20px', fontSize: '13px', color: '#374151', textAlign: 'right' }}>{row.count}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '16px' }}>Bewertungstrend (6 Monate)</div>
          <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'flex-end', gap: '8px', height: '140px' }}>
            {[{ m: 'Dez', v: 3 },{ m: 'Jan', v: 5 },{ m: 'Feb', v: 4 },{ m: 'Mär', v: 7 },{ m: 'Apr', v: 6 },{ m: 'Mai', v: 9 }].map(d => (
              <div key={d.m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '100%', background: '#4f46e5', borderRadius: '4px 4px 0 0', height: `${d.v * 10}px`, opacity: 0.85 }} />
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>{d.m}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', border: aiDone ? '1px solid #86efac' : '1px dashed #d1d5db', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        {!aiStarted && (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>✨</div>
            <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '6px', color: '#111827' }}>KI-Analyse noch nicht gestartet</div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>Klicken Sie auf "KI-Analyse starten" — Claude wertet alle Bewertungen aus und liefert konkrete Handlungsempfehlungen.</div>
            <button onClick={startAI} style={{ padding: '9px 20px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', fontWeight: '500' }}>✨ Jetzt analysieren</button>
          </div>
        )}
        {aiLoading && <div style={{ padding: '48px', textAlign: 'center' }}><div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div><div style={{ fontWeight: '600', fontSize: '15px', color: '#111827' }}>KI analysiert Ihre Bewertungen...</div></div>}
        {aiDone && (
          <div>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '16px' }}>✨ KI-Analyse Ergebnis</div>
            <div style={{ padding: '18px' }}>
              <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#4f46e5', marginBottom: '6px' }}>WICHTIGSTE ERKENNTNIS</div>
                <div style={{ fontSize: '16px', color: '#1e1b4b', lineHeight: '1.6' }}>Ihre Gäste loben besonders das Essen und die Atmosphäre. Häufigster Kritikpunkt ist die Wartezeit beim Service.</div>
              </div>
              <div className="grid2i" style={{ marginBottom: '16px' }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ fontWeight: '600', color: '#166534', marginBottom: '8px', fontSize: '13px' }}>👍 Was Gäste loben</div>
                  <div style={{ fontSize: '13px', color: '#166534', lineHeight: '1.8' }}>• Essen & Qualität<br />• Atmosphäre<br />• Freundlicher Service</div>
                </div>
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ fontWeight: '600', color: '#991b1b', marginBottom: '8px', fontSize: '13px' }}>👎 Verbesserungspotenzial</div>
                  <div style={{ fontSize: '13px', color: '#991b1b', lineHeight: '1.8' }}>• Wartezeit<br />• Service-Aufmerksamkeit</div>
                </div>
              </div>
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontWeight: '600', color: '#92400e', marginBottom: '8px', fontSize: '13px' }}>💡 Handlungsempfehlungen</div>
                <div style={{ fontSize: '13px', color: '#78350f', lineHeight: '1.8' }}>1. Wartezeiten durch optimierte Abläufe reduzieren<br />2. Reservierungssystem einführen<br />3. Aktiv auf 3-Sterne-Bewertungen antworten</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── EINSTELLUNGEN ────────────────────────────────────────────────────────────

function Settings() {
  const [form, setForm] = useState({
    businessName: '', description: '', restaurantType: '', cuisineType: '',
    priceRange: '', seatingCapacity: '', foundedYear: '', targetAudience: '',
    phone: '', website: '', address: '', city: '',
    signatureDishes: '', dietaryOptions: '', openingHours: '',
    hasReservation: false, hasDelivery: false, hasTakeaway: false,
    hasParking: false, isWheelchairAccessible: false,
    uniqueSellingPoints: '', brandValues: '', preferredPhrases: '',
    avoidPhrases: '', responseSignature: '', responseLanguage: 'Deutsch',
    salutation: 'Sie', autoGenerate: false,
    googleAccountId: '', googleLocationId: '', notificationEmail: '',
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const d = localStorage.getItem('reviewManagerSettings')
    if (d) setForm(JSON.parse(d))
  }, [])

  const update = (k: string, v: any) => { setForm(p => ({ ...p, [k]: v })); setSaved(false) }
  const save = () => { localStorage.setItem('reviewManagerSettings', JSON.stringify(form)); setSaved(true) }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', marginTop: '4px', boxSizing: 'border-box', background: '#f9fafb', fontFamily: 'inherit' }
  const lbl: React.CSSProperties = { fontSize: '13px', fontWeight: '500', display: 'block', color: '#374151' }
  const card: React.CSSProperties = { background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }
  const cardH: React.CSSProperties = { padding: '14px 18px', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '16px', color: '#111827' }
  const cardB: React.CSSProperties = { padding: '18px' }
  const hint: React.CSSProperties = { fontSize: '11px', color: '#9ca3af', marginTop: '4px' }

  const Toggle = ({ k }: { k: string }) => (
    <div onClick={() => update(k, !(form as any)[k])} style={{ width: '38px', height: '22px', borderRadius: '11px', background: (form as any)[k] ? '#4f46e5' : '#d1d5db', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: '4px', left: (form as any)[k] ? '20px' : '4px', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
    </div>
  )

  return (
    <div>
      <h1 style={{ fontSize: '30px', fontWeight: '600', marginBottom: '4px', color: '#111827' }}>Restaurantprofil</h1>
      <p style={{ color: '#6b7280', marginBottom: '24px', fontSize: '16px' }}>Alle Informationen fließen direkt in die KI-Antwortgenerierung ein.</p>

      <div style={card}><div style={cardH}>🏢 Basisinformationen</div><div style={cardB}>
        <div style={{ marginBottom: '12px' }}><label style={lbl}>Restaurantname *</label><input style={inp} placeholder="z. B. Trattoria Bella Italia" value={form.businessName} onChange={e => update('businessName', e.target.value)} /></div>
        <div><label style={lbl}>Beschreibung</label><textarea style={{ ...inp, height: '80px', resize: 'none' }} placeholder="Beschreiben Sie Ihr Restaurant kurz..." value={form.description} onChange={e => update('description', e.target.value)} /><div style={hint}>Wird als Kontext für jede KI-generierte Antwort verwendet.</div></div>
      </div></div>

      <div style={card}><div style={cardH}>🍽️ Restaurant-Identität</div><div style={cardB}>
        <div className="grid2i">
          <div><label style={lbl}>Restaurant-Typ</label>
            <select style={inp} value={form.restaurantType} onChange={e => update('restaurantType', e.target.value)}>
              <option value="">Typ auswählen</option>
              <option value="restaurant">Restaurant</option><option value="cafe">Café</option><option value="bistro">Bistro</option>
              <option value="bar">Bar / Weinbar</option><option value="foodtruck">Foodtruck</option>
              <option value="imbiss">Imbiss / Schnellimbiss</option><option value="baeckerei">Bäckerei / Konditorei</option>
              <option value="hotel-restaurant">Hotelrestaurant</option><option value="catering">Catering</option><option value="sonstiges">Sonstiges</option>
            </select>
          </div>
          <div><label style={lbl}>Küche / Küchenrichtung</label><input style={inp} placeholder="z. B. Italienisch, Asiatisch..." value={form.cuisineType} onChange={e => update('cuisineType', e.target.value)} /></div>
          <div><label style={lbl}>Preisklasse</label>
            <select style={inp} value={form.priceRange} onChange={e => update('priceRange', e.target.value)}>
              <option value="">Preisklasse auswählen</option>
              <option value="€">€ — Günstig</option><option value="€€">€€ — Mittel</option>
              <option value="€€€">€€€ — Gehoben</option><option value="€€€€">€€€€ — Fine Dining</option>
            </select>
          </div>
          <div><label style={lbl}>Sitzplätze</label><input style={inp} placeholder="z. B. 60 innen, 30 außen" value={form.seatingCapacity} onChange={e => update('seatingCapacity', e.target.value)} /></div>
          <div><label style={lbl}>Gründungsjahr</label><input style={inp} placeholder="z. B. 1998" value={form.foundedYear} onChange={e => update('foundedYear', e.target.value)} /></div>
          <div><label style={lbl}>Zielgruppe</label><input style={inp} placeholder="z. B. Familien, Paare..." value={form.targetAudience} onChange={e => update('targetAudience', e.target.value)} /></div>
        </div>
      </div></div>

      <div style={card}><div style={cardH}>📍 Kontakt & Standort</div><div style={cardB}>
        <div className="grid2i">
          <div><label style={lbl}>Straße & Hausnummer</label><input style={inp} placeholder="z. B. Hauptstraße 12" value={form.address} onChange={e => update('address', e.target.value)} /></div>
          <div><label style={lbl}>PLZ & Stadt</label><input style={inp} placeholder="z. B. 80331 München" value={form.city} onChange={e => update('city', e.target.value)} /></div>
          <div><label style={lbl}>Telefon</label><input style={inp} placeholder="z. B. +49 89 12345678" value={form.phone} onChange={e => update('phone', e.target.value)} /></div>
          <div><label style={lbl}>Website</label><input style={inp} placeholder="z. B. https://www.meinrestaurant.de" value={form.website} onChange={e => update('website', e.target.value)} /></div>
        </div>
      </div></div>

      <div style={card}><div style={cardH}>⭐ Speisekarte & Angebot</div><div style={cardB}>
        <div style={{ marginBottom: '12px' }}><label style={lbl}>Signature-Gerichte / Spezialitäten</label><textarea style={{ ...inp, height: '60px', resize: 'none' }} placeholder="z. B. Hausgemachte Tagliatelle, Neapolitanische Pizza..." value={form.signatureDishes} onChange={e => update('signatureDishes', e.target.value)} /></div>
        <div style={{ marginBottom: '12px' }}><label style={lbl}>Ernährungsoptionen</label><input style={inp} placeholder="z. B. Vegetarisch, Vegan, Glutenfrei..." value={form.dietaryOptions} onChange={e => update('dietaryOptions', e.target.value)} /><div style={hint}>Kommagetrennt angeben.</div></div>
        <div style={{ marginBottom: '14px' }}><label style={lbl}>Öffnungszeiten</label><textarea style={{ ...inp, height: '70px', resize: 'none' }} placeholder={'Mo–Fr: 11:30–15:00 & 18:00–23:00\nSa–So: 12:00–23:00'} value={form.openingHours} onChange={e => update('openingHours', e.target.value)} /></div>
        <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '10px', color: '#374151' }}>Service-Optionen</div>
        <div className="grid2i">
          {[{ k: 'hasReservation', l: 'Tischreservierung' },{ k: 'hasDelivery', l: 'Lieferservice' },{ k: 'hasTakeaway', l: 'Zum Mitnehmen' },{ k: 'hasParking', l: 'Parkplätze vorhanden' },{ k: 'isWheelchairAccessible', l: 'Rollstuhlgerecht' }].map(item => (
            <div key={item.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <span style={{ fontSize: '13px', color: '#374151' }}>{item.l}</span><Toggle k={item.k} />
            </div>
          ))}
        </div>
      </div></div>

      <div style={card}><div style={cardH}>🎨 Marke & Tonalität</div><div style={cardB}>
        <div style={{ marginBottom: '12px' }}><label style={lbl}>Was macht Ihr Restaurant besonders?</label><textarea style={{ ...inp, height: '60px', resize: 'none' }} value={form.uniqueSellingPoints} onChange={e => update('uniqueSellingPoints', e.target.value)} /></div>
        <div style={{ marginBottom: '12px' }}><label style={lbl}>Markenwerte</label><textarea style={{ ...inp, height: '60px', resize: 'none' }} value={form.brandValues} onChange={e => update('brandValues', e.target.value)} /></div>
        <div className="grid2i" style={{ marginBottom: '12px' }}>
          <div><label style={lbl}>Bevorzugte Formulierungen</label><textarea style={{ ...inp, height: '70px', resize: 'none' }} value={form.preferredPhrases} onChange={e => update('preferredPhrases', e.target.value)} /></div>
          <div><label style={lbl}>Zu vermeidende Formulierungen</label><textarea style={{ ...inp, height: '70px', resize: 'none' }} value={form.avoidPhrases} onChange={e => update('avoidPhrases', e.target.value)} /></div>
        </div>
        <div className="grid3i">
          <div><label style={lbl}>Antwort-Signatur</label><input style={inp} placeholder="z. B. Das Team der Trattoria" value={form.responseSignature} onChange={e => update('responseSignature', e.target.value)} /></div>
          <div><label style={lbl}>Antwortsprache</label>
            <select style={inp} value={form.responseLanguage} onChange={e => update('responseLanguage', e.target.value)}>
              <option value="Deutsch">Deutsch</option><option value="Englisch">Englisch</option>
              <option value="Sprache des Bewerters">Sprache des Bewerters</option><option value="Deutsch und Englisch">Deutsch & Englisch</option>
            </select>
          </div>
          <div><label style={lbl}>Anredeform</label>
            <select style={inp} value={form.salutation} onChange={e => update('salutation', e.target.value)}>
              <option value="Sie">Sie (förmlich)</option><option value="Du">Du (persönlich)</option>
            </select>
          </div>
        </div>
      </div></div>

      <div style={card}><div style={cardH}>🤖 KI-Antworteinstellungen</div><div style={cardB}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          <div><div style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>Antworten automatisch generieren</div><div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>KI-Antworten automatisch erstellen, wenn neue Bewertungen synchronisiert werden.</div></div>
          <Toggle k="autoGenerate" />
        </div>
      </div></div>

      <div style={card}><div style={cardH}>🔗 Google Business Profile</div><div style={cardB}>
        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '14px' }}>Verbinden Sie Ihr Google-Konto, um Bewertungen automatisch zu synchronisieren.</div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '500', flexShrink: 0, marginTop: '1px' }}>1</div>
          <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>Google Dienstkonto-Schlüssel hinterlegen</div>
            <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#92400e' }}>⚠️ Fügen Sie das Secret <code style={{ background: '#fde68a', padding: '1px 4px', borderRadius: '3px' }}>GOOGLE_SERVICE_ACCOUNT_KEY</code> in den Replit Secrets ein.</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '500', flexShrink: 0, marginTop: '1px' }}>2</div>
          <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>Konto-ID und Standort-ID eingeben</div>
            <div className="grid2i">
              <div><label style={lbl}>Google Account-ID</label><input style={inp} placeholder="z. B. 123456789012345" value={form.googleAccountId} onChange={e => update('googleAccountId', e.target.value)} /></div>
              <div><label style={lbl}>Standort-ID</label><input style={inp} placeholder="z. B. 9876543210987654" value={form.googleLocationId} onChange={e => update('googleLocationId', e.target.value)} /></div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '500', flexShrink: 0, marginTop: '1px' }}>3</div>
          <div><div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>Verbindung testen</div>
            <button style={{ padding: '8px 16px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', color: '#374151' }}>📡 Verbindung testen</button>
            <div style={{ ...hint, marginTop: '6px' }}>Speichern Sie zuerst die Einstellungen.</div>
          </div>
        </div>
      </div></div>

      <div style={card}><div style={cardH}>🔔 Benachrichtigungen</div><div style={cardB}>
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#0c4a6e', marginBottom: '14px' }}>
          📧 Sobald eine neue Bewertung synchronisiert wird, erhalten Sie automatisch eine E-Mail mit 3 fertigen KI-Antworten.
        </div>
        <label style={lbl}>Benachrichtigungs-E-Mail</label>
        <input style={inp} type="email" placeholder="z. B. inhaber@meinrestaurant.de" value={form.notificationEmail} onChange={e => update('notificationEmail', e.target.value)} />
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#92400e', marginTop: '10px' }}>
          ⚠️ E-Mail-Dienst nicht konfiguriert. Registrieren Sie sich auf <strong>resend.com</strong> und fügen Sie <code style={{ background: '#fde68a', padding: '1px 4px', borderRadius: '3px' }}>RESEND_API_KEY</code> hinzu.
        </div>
      </div></div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', paddingBottom: '40px' }}>
        {saved && <span style={{ color: '#22c55e', fontSize: '16px', fontWeight: '500' }}>✅ Gespeichert!</span>}
        <button onClick={save} style={{ padding: '10px 28px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontFamily: 'inherit', fontWeight: '500' }}>Profil speichern</button>
      </div>
    </div>
  )
}

export default App
