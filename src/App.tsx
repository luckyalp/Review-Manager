import { useState, useEffect, useRef } from 'react'
import { Home, MessageSquare, BarChart2, User, Star, Clock, CheckCircle, XCircle, Percent } from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'

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

// ─── VARIANT LABELS (stabile Kategorien für Analytics) ───────────────────────

const VARIANT_LABELS: Record<string, string> = {
  '1': 'Ruhig & direkt',
  '2': 'Menschlich & nah',
  '3': 'Kurz & beiläufig',
  'recovery': 'Deeskalierend',
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const formatDate = (raw: string) => {
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─── SUPABASE ────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://xbgohbljmuoijgocrkka.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiZ29oYmxqbXVvaWpnb2Nya2thIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2OTAwMjUsImV4cCI6MjA5NTI2NjAyNX0.CNpNc3uyxnfKfse9G_26XIaCBPhBpPPESuC4jm9WbGU'
)


// ─── APP ─────────────────────────────────────────────────────────────────────

function App() {
  const [page, setPage] = useState('dashboard')
  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null)
  const [onboardingData, setOnboardingData] = useState({
    businessName: '', restaurantType: '',
    salutation: 'Sie', restaurantAtmosphere: '', contactEmail: '',
  })

  // ── Auth State ──
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [showAuth, setShowAuth] = useState<false | 'login' | 'register'>(false)

  // Auth-Listener: einmal beim Mount, reagiert auf Login/Logout/OAuth-Callback
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Onboarding-Check: nur wenn eingeloggt
  useEffect(() => {
    if (!user) return
    const checkOnboarding = async () => {
      try {
        const { data } = await supabase
          .from('settings').select('value').eq('key', 'restaurant_profile').single()
        if (data?.value?.businessName) { setOnboardingStep(0); return }
      } catch { /* ignore */ }
      try {
        const local = localStorage.getItem('reviewManagerSettings')
        if (local) {
          const parsed = JSON.parse(local)
          if (parsed?.businessName) { setOnboardingStep(0); return }
        }
      } catch { /* ignore */ }
      setOnboardingStep(1)
    }
    checkOnboarding()
  }, [user])

  // Bewertungen laden: nur wenn eingeloggt
  useEffect(() => {
    if (!user) return
    const mapRow = (row: any): Review => ({
      id: row.id,
      name: row.reviewer_name,
      initials: row.reviewer_name
        ? row.reviewer_name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
        : '??',
      stars: row.stars,
      text: row.review_text,
      date: row.review_date,
      status: row.status as ReviewStatus,
    })
    const loadReviews = async () => {
      try {
        const { data, error } = await supabase
          .from('reviews')
          .select('*')
          .order('created_at', { ascending: false })
        if (data && !error) {
          setReviews(data.map(mapRow))
        } else {
          setReviews(INITIAL_REVIEWS)
        }
      } catch {
        setReviews(INITIAL_REVIEWS)
      }
      setReviewsLoading(false)
    }
    loadReviews()
  }, [user])

  const navigate = (id: string) => { setPage(id); setSelectedReview(null) }
  const openReview = (review: Review) => { setSelectedReview(review); setPage('reviews') }

  // URL-Parameter: direkt zur Bewertung springen wenn ?edit=true
  useEffect(() => {
    if (!user || reviewsLoading || reviews.length === 0) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('edit') === 'true') {
      const reviewId = params.get('reviewId')
      if (reviewId) {
        const match = reviews.find(r =>
          encodeURIComponent(r.name + '_' + r.stars) === reviewId ||
          (r.name + '_' + r.stars) === reviewId
        )
        if (match) {
          setSelectedReview(match)
          setPage('reviews')
          window.history.replaceState({}, '', window.location.pathname)
        }
      }
    }
  }, [user, reviewsLoading, reviews])

  // URL-Parameter: direkt zur Bewertung springen wenn ?edit=true
  useEffect(() => {
    if (!user || reviewsLoading || reviews.length === 0) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('edit') === 'true') {
      const reviewId = params.get('reviewId')
      if (reviewId) {
        const match = reviews.find(r =>
          encodeURIComponent(r.name + '_' + r.stars) === reviewId ||
          (r.name + '_' + r.stars) === reviewId
        )
        if (match) {
          setSelectedReview(match)
          setPage('reviews')
          window.history.replaceState({}, '', window.location.pathname)
        }
      }
    }
  }, [user, reviewsLoading, reviews])

  const updateReviewStatus = async (id: number, status: ReviewStatus) => {
    setReviews(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    try {
      await supabase.from('reviews').update({ status }).eq('id', id)
    } catch (e) {
      console.warn('Supabase update failed', e)
    }
  }

  const deleteReview = async (id: number) => {
    setReviews(prev => prev.filter(r => r.id !== id))
    try {
      await supabase.from('reviews').delete().eq('id', id)
    } catch (e) {
      console.warn('Supabase delete failed', e)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setOnboardingStep(null)
    setReviews([])
    setPage('dashboard')
    setShowAuth(false)
    localStorage.removeItem('reviewManagerSettings')
  }

  const stats = {
    total: reviews.length,
    avg: reviews.length ? (reviews.reduce((s, r) => s + r.stars, 0) / reviews.length).toFixed(1) : '–',
    pending: reviews.filter(r => r.status === 'Ausstehend').length,
    answered: reviews.filter(r => r.status === 'Beantwortet').length,
  }

  // ── Render-Logik ──

  // 1. Auth lädt noch
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Plus Jakarta Sans", -apple-system, sans-serif' }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap'); @keyframes ob-spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(15,76,92,0.3)', borderTopColor: '#0f4c5c', borderRadius: '50%', animation: 'ob-spin 0.8s linear infinite' }} />
      </div>
    )
  }

  // 2. Nicht eingeloggt → Willkommens-Screen oder Auth-Screen
  if (!user) {
    if (!showAuth) {
      return (
        <WelcomeScreen
          onLogin={() => setShowAuth('login')}
          onRegister={() => setShowAuth('register')}
        />
      )
    }
    return <AuthScreen initialMode={showAuth} />
  }

  // 3. Eingeloggt, Onboarding-Check läuft noch
  if (onboardingStep === null) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Plus Jakarta Sans", -apple-system, sans-serif' }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap'); @keyframes ob-spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(15,76,92,0.3)', borderTopColor: '#0f4c5c', borderRadius: '50%', animation: 'ob-spin 0.8s linear infinite' }} />
      </div>
    )
  }

  // 4. Eingeloggt, Onboarding noch nicht abgeschlossen
  if (onboardingStep > 0) {
    const handleFinish = async () => {
      const fullSettings = {
        businessName: onboardingData.businessName,
        restaurantType: onboardingData.restaurantType,
        priceRange: '',
        salutation: onboardingData.salutation,
        uniqueSellingPoints: '',
        restaurantAtmosphere: onboardingData.restaurantAtmosphere,
        contactEmail: onboardingData.contactEmail,
        notificationEmail: onboardingData.contactEmail,
        description: '', cuisineType: '', dietaryOptions: '', openingHours: '',
        hasReservation: false, hasDelivery: false, hasTakeaway: false,
        hasParking: false, isWheelchairAccessible: false,
        responseSignature: '', responseLanguage: 'Deutsch',
      }
      localStorage.setItem('reviewManagerSettings', JSON.stringify(fullSettings))
      try {
        await supabase.from('settings').upsert(
          { key: 'restaurant_profile', value: fullSettings, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
      } catch (e) { console.warn('Supabase save failed', e) }
      setOnboardingStep(0)
    }
    return (
      <Onboarding
        step={onboardingStep}
        data={onboardingData}
        onDataChange={(key, val) => setOnboardingData(prev => ({ ...prev, [key]: val }))}
        onNext={() => setOnboardingStep(s => (s ?? 1) + 1)}
        onBack={() => setOnboardingStep(s => Math.max(1, (s ?? 1) - 1))}
        onFinish={handleFinish}
      />
    )
  }

  return (
    <div style={{ minHeight: '100vh', fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f3f4f6' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .main-pad { padding: 20px 16px 88px; }
        .grid4 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .grid2 { display: grid; grid-template-columns: 1fr; gap: 16px; }
        .grid-dashboard { display: grid; grid-template-columns: 1fr; gap: 16px; }
        .grid2i { display: grid; grid-template-columns: 1fr; gap: 12px; }
        .grid3i { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .review-actions { flex-wrap: wrap; }
        .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; z-index: 200; background: #fff; border-top: 1px solid #e5e7eb; display: flex; padding-bottom: env(safe-area-inset-bottom); }
        .bottom-nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 10px 0; cursor: pointer; border: none; background: transparent; color: #9ca3af; font-size: 11px; font-weight: 500; font-family: inherit; transition: color 0.15s; -webkit-tap-highlight-color: transparent; }
        .bottom-nav-item.active { color: #0f4c5c; }
        @media (min-width: 640px) {
          .main-pad { padding: 28px 40px 100px; }
          .grid4 { grid-template-columns: repeat(4,1fr); gap: 14px; }
          .grid2 { grid-template-columns: 1fr 1fr; }
          .grid-dashboard { grid-template-columns: 2fr 1fr; }
          .grid2i { grid-template-columns: 1fr 1fr; }
          .grid3i { grid-template-columns: 1fr 1fr 1fr; }
        }
        @media (min-width: 1024px) {
          .main-pad { padding: 32px 80px 100px; }
        }
      `}</style>

      {/* Main */}
      <div>
        <div className="main-pad">
          {reviewsLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '14px', color: '#6b7280' }}>
              <div style={{ fontSize: '28px' }}>⏳</div>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>Bewertungen werden geladen…</div>
            </div>
          ) : (
            <>
              {page === 'dashboard' && <Dashboard stats={stats} reviews={reviews} openReview={openReview} />}
              {page === 'reviews' && !selectedReview && <Reviews reviews={reviews} onStatusChange={updateReviewStatus} onDelete={deleteReview} openReview={openReview} />}
              {page === 'reviews' && selectedReview && <ReviewDetail review={selectedReview} onStatusChange={updateReviewStatus} onBack={() => setSelectedReview(null)} />}
              {page === 'analytics' && <Analytics reviews={reviews} />}
              {page === 'settings' && <Settings onLogout={handleLogout} />}
            </>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button className={`bottom-nav-item${page === 'dashboard' ? ' active' : ''}`} onClick={() => navigate('dashboard')}>
          <Home size={22} strokeWidth={1.8} />
          Home
        </button>
        <button className={`bottom-nav-item${page === 'reviews' ? ' active' : ''}`} onClick={() => navigate('reviews')}>
          <MessageSquare size={22} strokeWidth={1.8} />
          Bewertungen
        </button>
        <button className={`bottom-nav-item${page === 'analytics' ? ' active' : ''}`} onClick={() => navigate('analytics')}>
          <BarChart2 size={22} strokeWidth={1.8} />
          Insights
        </button>
        <button className={`bottom-nav-item${page === 'settings' ? ' active' : ''}`} onClick={() => navigate('settings')}>
          <User size={22} strokeWidth={1.8} />
          Profil
        </button>
      </nav>
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

function Dashboard({ stats, reviews, openReview }: { stats: any, reviews: Review[], openReview: (r: Review) => void }) {
  const [testRunning, setTestRunning] = useState(false)
  const [testDone, setTestDone] = useState(false)
  const [testError, setTestError] = useState('')

  const recent = reviews.filter(r => r.status === 'Ausstehend')

  const distrib = [5,4,3,2,1].map(s => ({
    stars: s,
    count: reviews.filter(r => r.stars === s).length,
    pct: reviews.length ? Math.round(reviews.filter(r => r.stars === s).length / reviews.length * 100) : 0,
    color: '#F0B100',
  }))

  const runTest = async () => {
    setTestRunning(true)
    setTestError('')
    setTestDone(false)

    const settings = JSON.parse(localStorage.getItem('reviewManagerSettings') || '{}')
    const email = settings.notificationEmail

    if (!email) {
      setTestError('Bitte zuerst eine Benachrichtigungs-E-Mail in den Einstellungen hinterlegen und speichern!')
      setTestRunning(false)
      return
    }

    const testReview = {
      reviewerName: 'Maria Testmann',
      stars: 4,
      reviewText: 'Das Essen war wirklich ausgezeichnet und die Atmosphäre sehr gemütlich. Der Service war aufmerksam und freundlich. Nur die Wartezeit beim Nachtisch war etwas lang. Wir kommen gerne wieder!',
    }

    try {
      // Schritt 1: Echte KI-Antworten generieren
      const repliesRes = await fetch('/api/generate-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review: testReview, settings }),
      })
      const repliesData = await repliesRes.json()

      if (!repliesData.success || !repliesData.answers) {
        setTestError('KI-Generierung fehlgeschlagen: ' + (repliesData.error || 'Unbekannter Fehler'))
        setTestRunning(false)
        return
      }

      // Schritt 2: Test-E-Mail mit echten Antworten senden
      const emailRes = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...testReview,
          answers: repliesData.answers,
          to: email,
          restaurantName: settings.businessName || 'Ihr Restaurant',
          isTest: true,
          salutation: settings.salutation || 'Sie',
          contactEmail: settings.contactEmail || '',
        }),
      })
      const emailData = await emailRes.json()

      if (!emailRes.ok) {
        setTestError('E-Mail-Versand fehlgeschlagen: ' + (emailData.error || 'Unbekannter Fehler'))
        setTestRunning(false)
        return
      }

      setTestDone(true)
    } catch (err) {
      setTestError('Verbindungsfehler: ' + String(err))
    }

    setTestRunning(false)
  }

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
          { label: 'Bewertungen gesamt', value: stats.total, Icon: MessageSquare },
          { label: 'Ø Bewertung', value: stats.avg, Icon: Star },
          { label: 'Ausstehend', value: stats.pending, Icon: Clock },
          { label: 'Beantwortet', value: stats.answered, Icon: CheckCircle },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: '12px', padding: '18px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>{s.label}</div>
              <s.Icon size={18} strokeWidth={1.8} color="#0f4c5c" />
            </div>
            <div style={{ fontSize: '28px', fontWeight: '600', color: '#111827' }}>{s.value}</div>
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
          <span style={{ fontSize: '13px', color: '#6b7280' }}>🕐 Sync läuft stündlich automatisch</span>
        </div>
      </div>

      {/* System Test */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px dashed #d1d5db', padding: '16px 18px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>🧪</span>
          <div>
            <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '3px', color: '#111827' }}>System-Test</div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>Erstellt eine realistische Test-Bewertung, generiert 3 KI-Antworten und sendet (falls konfiguriert) eine Test-E-Mail.</div>
            {testError && <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '6px' }}>⚠️ {testError}</div>}
            {testDone && <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '6px' }}>✅ Test-E-Mail wurde erfolgreich gesendet!</div>}
          </div>
        </div>
        <button onClick={runTest} disabled={testRunning}
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
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>{formatDate(r.date)}</div>
                    <StatusBadge status={r.status} />
                  </div>
                </div>
                <Stars n={r.stars} />
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px', lineHeight: '1.5' }}>{r.text.length > 100 ? r.text.slice(0, 100) + '…' : r.text}</div>
                <button onClick={() => openReview(r)} style={{ marginTop: '10px', padding: '6px 14px', background: '#0f4c5c', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit', color: '#fff' }}>
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
                <div style={{ width: '36px', fontSize: '13px', color: '#6b7280', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px' }}>
                  <span>{row.stars}</span><span>☆</span>
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

function Reviews({ reviews, onStatusChange, onDelete, openReview }: { reviews: Review[], onStatusChange: (id: number, s: ReviewStatus) => void, onDelete: (id: number) => void, openReview: (r: Review) => void }) {
  const [openAI, setOpenAI] = useState<number | null>(null)
  const [selected, setSelected] = useState<{[key: number]: number}>({})
  const [filterStatus, setFilterStatus] = useState('alle')
  const [filterStars, setFilterStars] = useState('alle')
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [aiLoading, setAiLoading] = useState<number | null>(null)
  const [aiAnswers, setAiAnswers] = useState<{[key: number]: {label: string, text: string}[]}>({})

  const sendAnswer = async (review: Review) => {
    const text = aiAnswers[review.id]?.[selected[review.id]]?.text
    try {
      await supabase.from('reviews').update({ selected_answer: text ?? null }).eq('id', review.id)
    } catch (e) { console.warn('Supabase save failed', e) }
    onStatusChange(review.id, 'Beantwortet')
    setOpenAI(null)
  }

  const settings = JSON.parse(localStorage.getItem('reviewManagerSettings') || '{}')

  const generateReplies = async (review: Review) => {
    setAiLoading(review.id)
    setOpenAI(review.id)
    try {
      const response = await fetch('/api/generate-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review: { reviewerName: review.name, stars: review.stars, reviewText: review.text },
          settings,
        })
      })
      const data = await response.json()
      if (data.success && data.answers) {
        setAiAnswers(prev => ({ ...prev, [review.id]: data.answers }))
      } else {
        setAiAnswers(prev => ({ ...prev, [review.id]: [{ label: 'Fehler', text: 'Antworten konnten nicht geladen werden. Bitte nochmal versuchen.' }] }))
      }
    } catch {
      setAiAnswers(prev => ({ ...prev, [review.id]: [{ label: 'Fehler', text: 'Antworten konnten nicht geladen werden. Bitte nochmal versuchen.' }] }))
    }
    setAiLoading(null)
  }

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
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px', cursor: 'pointer' }} onClick={() => openReview(review)}>
            <Avatar name={review.name} initials={review.initials} photoUrl={review.photoUrl} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '16px', color: '#111827' }}>{review.name}</div>
                  <div style={{ marginTop: '3px' }}><Stars n={review.stars} /></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>{formatDate(review.date)}</div>
                  <StatusBadge status={review.status} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '16px', color: '#374151', lineHeight: '1.6', marginBottom: '14px', cursor: 'pointer' }} onClick={() => openReview(review)}>{review.text}</div>

          {/* Actions */}
          <div className="review-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

            {/* Antworten generieren — nur wenn noch nicht beantwortet */}
            {review.status !== 'Beantwortet' && (
              <button
                onClick={() => generateReplies(review)}
                style={{ padding: '7px 14px', background: '#0f4c5c', color: '#fff', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {aiLoading === review.id ? '⏳ KI generiert...' : openAI === review.id ? '✨ Ausblenden' : '✨ Antworten generieren'}
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
                style={{ padding: '7px 14px', background: review.status === 'Abgelehnt' ? '#f3f4f6' : '#fff', border: `1px solid ${review.status === 'Abgelehnt' ? '#e5e7eb' : '#d1d5db'}`, borderRadius: '7px', cursor: review.status === 'Abgelehnt' ? 'default' : 'pointer', fontSize: '13px', fontFamily: 'inherit', color: review.status === 'Abgelehnt' ? '#9ca3af' : '#6b7280', display: 'flex', alignItems: 'center', gap: '5px' }}>
                {review.status === 'Abgelehnt' ? '✕ Abgelehnt' : '✕ Ablehnen'}
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
              {aiLoading === review.id ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280', fontSize: '14px' }}>
                  ✨ KI generiert Antworten basierend auf Ihrem Restaurantprofil...
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '10px' }}>
                    {(aiAnswers[review.id]?.length ?? 0)} KI-Antwortvorschläge — bitte auswählen:
                  </div>
                  {(aiAnswers[review.id] || []).map((a, i) => (
                    <div key={i} onClick={() => setSelected({...selected, [review.id]: i})}
                      style={{ padding: '12px', borderRadius: '8px', border: `1.5px solid ${selected[review.id] === i ? '#0f4c5c' : '#e5e7eb'}`, background: selected[review.id] === i ? '#f0f7f8' : '#fff', cursor: 'pointer', marginBottom: '8px', fontSize: '13px', lineHeight: '1.6' }}>
                      <div style={{ fontWeight: '600', fontSize: '12px', marginBottom: '4px', color: '#0f4c5c' }}>{a.label}</div>
                      {a.text}
                    </div>
                  ))}
                  {selected[review.id] !== undefined && (
                    <button onClick={() => sendAnswer(review)}
                      style={{ padding: '8px 18px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', fontWeight: '500' }}>
                      ✅ Ausgewählte Antwort senden
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── REVIEW DETAIL STYLES ────────────────────────────────────────────────────

const rdStyles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400&display=swap');

  .rd2-root {
    --rd2-petrol: #0f4c5c;
    --rd2-petrol-mid: #155e75;
    --rd2-petrol-subtle: rgba(15,76,92,0.06);
    --rd2-teal: #0e7490;
    --rd2-teal-subtle: rgba(14,116,144,0.07);
    --rd2-border: #e5e0db;
    --rd2-border-hover: #c9c2ba;
    --rd2-text: #111827;
    --rd2-text-sec: #374151;
    --rd2-text-muted: #6b7280;
    --rd2-text-faint: #9ca3af;
    --rd2-surface: #ffffff;
    --rd2-bg: #f5f3f0;
    --rd2-success: #15803d;
    --rd2-sand: #c8a97e;
    --rd2-shadow-xs: 0 1px 2px rgba(0,0,0,0.04);
    --rd2-shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
    -webkit-font-smoothing: antialiased;
    font-family: 'DM Sans', sans-serif;
  }
  .rd2-back-btn { display: inline-flex; align-items: center; gap: 6px; background: var(--rd2-surface); border: 1px solid var(--rd2-border); padding: 7px 15px; border-radius: 10px; font-size: 12.5px; font-weight: 500; cursor: pointer; color: var(--rd2-text-muted); font-family: 'DM Sans', sans-serif; box-shadow: var(--rd2-shadow-xs); transition: border-color 0.15s, color 0.15s, transform 0.1s; margin-bottom: 20px; }
  .rd2-back-btn:hover { border-color: var(--rd2-border-hover); color: var(--rd2-text-sec); }
  .rd2-back-btn:active { transform: scale(0.97); }
  .rd2-review-card { background: var(--rd2-surface); border-radius: 18px; border: 1px solid var(--rd2-border); padding: 20px 22px; margin-bottom: 20px; box-shadow: var(--rd2-shadow-sm); }
  .rd2-reviewer-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
  .rd2-reviewer-left { display: flex; align-items: center; gap: 13px; }
  .rd2-reviewer-right { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0; }
  .rd2-reviewer-name { font-weight: 600; font-size: 15px; color: var(--rd2-text); margin-bottom: 3px; }
  .rd2-review-date { font-size: 11px; color: var(--rd2-text-faint); font-family: 'DM Mono', monospace; }
  .rd2-review-text { font-size: 14.5px; color: var(--rd2-text-sec); line-height: 1.7; }
  .rd2-section-label { font-size: 11px; font-weight: 600; color: var(--rd2-text-faint); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; }
  .rd2-answers { display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px; }
  .rd2-answer-card { background: var(--rd2-surface); border: 1.5px solid var(--rd2-border); border-radius: 14px; cursor: pointer; transition: border-color 0.18s, box-shadow 0.18s; box-shadow: var(--rd2-shadow-xs); }
  .rd2-answer-card:hover { border-color: var(--rd2-border-hover); }
  .rd2-answer-card.rd2-selected { border-color: var(--rd2-petrol); box-shadow: 0 0 0 3px var(--rd2-petrol-subtle); cursor: default; }
  .rd2-answer-card.rd2-recovery { border-left: 2.5px solid var(--rd2-teal); }
  .rd2-answer-card.rd2-recovery:hover { border-color: var(--rd2-teal); border-left-color: var(--rd2-teal); }
  .rd2-answer-card.rd2-recovery.rd2-selected { border-color: var(--rd2-teal); border-left-color: var(--rd2-teal); box-shadow: 0 0 0 3px var(--rd2-teal-subtle); }
  .rd2-answer-top { display: flex; align-items: flex-start; gap: 12px; padding: 14px 15px 11px; }
  .rd2-answer-indicator { width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid var(--rd2-border); flex-shrink: 0; margin-top: 1px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; background: white; }
  .rd2-answer-card.rd2-selected .rd2-answer-indicator { background: var(--rd2-petrol); border-color: var(--rd2-petrol); }
  .rd2-answer-card.rd2-recovery.rd2-selected .rd2-answer-indicator { background: var(--rd2-teal); border-color: var(--rd2-teal); }
  .rd2-check-icon { display: none; color: white; font-size: 11px; font-weight: 700; }
  .rd2-answer-card.rd2-selected .rd2-check-icon { display: block; }
  .rd2-answer-style { font-size: 10px; font-weight: 600; color: var(--rd2-text-faint); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 5px; }
  .rd2-answer-card.rd2-selected .rd2-answer-style { color: var(--rd2-petrol); }
  .rd2-answer-card.rd2-recovery.rd2-selected .rd2-answer-style { color: var(--rd2-teal); }
  .rd2-answer-textarea { font-size: 14px; color: var(--rd2-text-sec); line-height: 1.6; width: 100%; border: none; outline: none; background: transparent; font-family: 'DM Sans', sans-serif; resize: none; cursor: pointer; overflow: hidden; padding: 0; margin: 0; }
  .rd2-answer-textarea:focus { cursor: text; color: var(--rd2-text); }
  .rd2-answer-card.rd2-selected .rd2-answer-textarea { cursor: text; }
  .rd2-edit-hint { display: none; padding: 0 15px 11px 47px; font-size: 11px; color: var(--rd2-sand); font-style: italic; line-height: 1.4; }
  .rd2-answer-card.rd2-selected .rd2-edit-hint { display: block; }
  .rd2-recovery-note { font-size: 11px; color: var(--rd2-teal); margin-bottom: 4px; line-height: 1.4; opacity: 0.85; }
  .rd2-recovery-separator { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .rd2-recovery-separator-line { flex: 1; height: 1px; background: var(--rd2-border); }
  .rd2-recovery-separator-label { font-size: 10px; font-weight: 600; color: var(--rd2-teal); text-transform: uppercase; letter-spacing: 0.08em; white-space: nowrap; }
  .rd2-send-bar { display: flex; justify-content: space-between; align-items: center; padding: 13px 17px; background: var(--rd2-surface); border: 1.5px solid var(--rd2-border); border-radius: 14px; }
  .rd2-send-info { font-size: 13px; color: var(--rd2-text-faint); }
  .rd2-send-btn { background: var(--rd2-petrol); color: white; border: none; border-radius: 40px; padding: 9px 22px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: background 0.2s, opacity 0.2s, transform 0.1s; opacity: 0.35; pointer-events: none; flex-shrink: 0; }
  .rd2-send-btn.rd2-active { opacity: 1; pointer-events: all; }
  .rd2-send-btn.rd2-active:hover { background: var(--rd2-petrol-mid); transform: scale(0.98); }
  .rd2-state-box { padding: 48px 32px; text-align: center; }
  .rd2-state-icon { font-size: 32px; margin-bottom: 14px; }
  .rd2-state-title { font-weight: 600; font-size: 16px; color: var(--rd2-text); margin-bottom: 7px; }
  .rd2-state-desc { font-size: 13.5px; color: var(--rd2-text-muted); margin-bottom: 24px; line-height: 1.6; max-width: 340px; margin-left: auto; margin-right: auto; }
  .rd2-gen-btn { display: inline-flex; align-items: center; gap: 7px; padding: 10px 26px; background: var(--rd2-petrol); color: #fff; border: none; border-radius: 40px; cursor: pointer; font-size: 13.5px; font-family: 'DM Sans', sans-serif; font-weight: 600; box-shadow: 0 2px 8px rgba(15,76,92,0.22); transition: background 0.18s, transform 0.1s; }
  .rd2-gen-btn:hover { background: var(--rd2-petrol-mid); transform: translateY(-1px); }
  .rd2-toast { position: fixed; bottom: 72px; left: 50%; transform: translateX(-50%) translateY(16px); background: var(--rd2-success); color: white; padding: 10px 24px; border-radius: 40px; font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif; opacity: 0; transition: opacity 0.25s, transform 0.25s; pointer-events: none; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
  .rd2-toast.rd2-toast-show { opacity: 1; transform: translateX(-50%) translateY(0); }
`

// ─── REVIEW DETAIL ───────────────────────────────────────────────────────────

function ReviewDetail({ review, onStatusChange, onBack }: { review: Review, onStatusChange: (id: number, s: ReviewStatus) => void, onBack: () => void }) {
  const [aiLoading, setAiLoading] = useState(false)
  const [answers, setAnswers] = useState<{label: string, text: string, isRecovery?: boolean}[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showToast, setShowToast] = useState(false)
  const textareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({})
  const settings = JSON.parse(localStorage.getItem('reviewManagerSettings') || '{}')

  useEffect(() => {
    const id = 'rd2-styles'
    let tag = document.getElementById(id) as HTMLStyleElement | null
    if (!tag) { tag = document.createElement('style'); tag.id = id; document.head.appendChild(tag) }
    tag.textContent = rdStyles
  }, [])

  const autoResize = (el: HTMLTextAreaElement) => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }

  useEffect(() => { Object.values(textareaRefs.current).forEach(el => { if (el) autoResize(el) }) }, [answers])

  const handleSelect = (idx: number) => {
    if (selectedId === idx) { setSelectedId(null); return }
    setSelectedId(idx)
    setTimeout(() => { const el = textareaRefs.current[idx]; if (el) autoResize(el) }, 0)
  }

  const handleTextChange = (idx: number, value: string) => {
    setAnswers(prev => prev.map((a, i) => i === idx ? { ...a, text: value } : a))
    const el = textareaRefs.current[idx]; if (el) autoResize(el)
  }

  const sendAnswer = async () => {
    const text = selectedId !== null ? answers[selectedId]?.text : null
    const label = selectedId !== null ? answers[selectedId]?.label : null
    const isRecovery = selectedId !== null ? !!answers[selectedId]?.isRecovery : false
    const variantIndex = selectedId !== null ? (isRecovery ? 'recovery' : String(selectedId + 1)) : null
    try {
      await supabase.from('reviews').update({
        selected_answer: text ?? null,
        selected_variant_label: label ?? null,
        selected_variant_index: variantIndex ?? null,
      }).eq('id', review.id)
    } catch (e) { console.warn('Supabase save failed', e) }
    onStatusChange(review.id, 'Beantwortet')
    setShowToast(true)
    setTimeout(() => { setShowToast(false); onBack() }, 1500)
  }

  const generateReplies = async () => {
    setAiLoading(true)
    try {
      const response = await fetch('/api/generate-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review: { reviewerName: review.name, stars: review.stars, reviewText: review.text }, settings })
      })
      const data = await response.json()
      if (data.success && data.answers) {
        setAnswers(data.answers)
      } else {
        setAnswers([{ label: 'Fehler', text: 'Antworten konnten nicht geladen werden. Bitte nochmal versuchen.' }])
      }
    } catch {
      setAnswers([{ label: 'Fehler', text: 'Antworten konnten nicht geladen werden. Bitte nochmal versuchen.' }])
    }
    setAiLoading(false)
  }

  const normalAnswers = answers.filter(a => !a.isRecovery)
  const recoveryAnswer = answers.find(a => a.isRecovery)
  const recoveryIdx = answers.findIndex(a => a.isRecovery)

  const renderCard = (answer: {label: string, text: string, isRecovery?: boolean}, idx: number) => {
    const isSelected = selectedId === idx
    const isRecovery = !!answer.isRecovery
    return (
      <div key={idx} className={`rd2-answer-card${isRecovery ? ' rd2-recovery' : ''}${isSelected ? ' rd2-selected' : ''}`} onClick={() => handleSelect(idx)}>
        <div className="rd2-answer-top">
          <div className="rd2-answer-indicator"><span className="rd2-check-icon">✓</span></div>
          <div style={{ flex: 1 }}>
            {isRecovery && <div className="rd2-recovery-note">Fokus auf Vertrauen und Deeskalation.</div>}
            <div className="rd2-answer-style">{answer.label}</div>
            <textarea
              ref={el => { textareaRefs.current[idx] = el }}
              className="rd2-answer-textarea"
              rows={3}
              readOnly={!isSelected}
              value={answer.text}
              onChange={e => handleTextChange(idx, e.target.value)}
              onClick={e => { if (isSelected) e.stopPropagation() }}
            />
          </div>
        </div>
        <div className="rd2-edit-hint">Direkt im Text anpassen, falls gewünscht.</div>
      </div>
    )
  }

  return (
    <div className="rd2-root">
      <button onClick={onBack} className="rd2-back-btn">← Zurück</button>
      <div className="rd2-review-card">
        <div className="rd2-reviewer-row">
          <div className="rd2-reviewer-left">
            <Avatar name={review.name} initials={review.initials} photoUrl={review.photoUrl} size={44} />
            <div>
              <div className="rd2-reviewer-name">{review.name}</div>
              <Stars n={review.stars} />
            </div>
          </div>
          <div className="rd2-reviewer-right">
            <span className="rd2-review-date">{formatDate(review.date)}</span>
            <StatusBadge status={review.status} />
          </div>
        </div>
        <div className="rd2-review-text">{review.text}</div>
      </div>

      {review.status !== 'Beantwortet' && (
        <>
          {answers.length === 0 && !aiLoading && (
            <div className="rd2-state-box">
              <div className="rd2-state-icon">✨</div>
              <div className="rd2-state-title">Noch keine Antworten generiert</div>
              <div className="rd2-state-desc">Klicken Sie auf „KI-Antworten generieren", um passende Antwortmöglichkeiten zu erstellen.</div>
              <button onClick={generateReplies} className="rd2-gen-btn">✨ KI-Antworten generieren</button>
            </div>
          )}
          {aiLoading && (
            <div className="rd2-state-box">
              <div className="rd2-state-icon">⏳</div>
              <div className="rd2-state-title">KI generiert Antworten…</div>
            </div>
          )}
          {answers.length > 0 && (
            <>
              <div className="rd2-section-label">Antwort wählen — oder nach Auswahl anpassen</div>
              <div className="rd2-answers">
                {normalAnswers.map((a) => renderCard(a, answers.indexOf(a)))}
              </div>
              {recoveryAnswer && recoveryIdx !== -1 && (
                <>
                  <div className="rd2-recovery-separator">
                    <div className="rd2-recovery-separator-line" />
                    <span className="rd2-recovery-separator-label">Empfohlen bei 1–2 Sternen</span>
                    <div className="rd2-recovery-separator-line" />
                  </div>
                  <div className="rd2-answers">
                    {renderCard(recoveryAnswer, recoveryIdx)}
                  </div>
                </>
              )}
              <div className="rd2-send-bar">
                <span className="rd2-send-info">{selectedId !== null ? 'Bereit zum Senden' : 'Erst eine Antwort auswählen'}</span>
                <button className={`rd2-send-btn${selectedId !== null ? ' rd2-active' : ''}`} onClick={selectedId !== null ? sendAnswer : undefined}>Antwort senden</button>
              </div>
            </>
          )}
        </>
      )}
      <div className={`rd2-toast${showToast ? ' rd2-toast-show' : ''}`}>✓ Antwort wurde gesendet</div>
    </div>
  )
}


// ─── ANALYSE ─────────────────────────────────────────────────────────────────

function Analytics({ reviews }: { reviews: Review[] }) {
  const [aiStarted, setAiStarted] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiDone, setAiDone] = useState(false)
  const [variantStats, setVariantStats] = useState<{label: string, index: string, count: number}[]>([])

  // Varianten-Daten aus Supabase laden
  useEffect(() => {
    const loadVariantStats = async () => {
      try {
        const { data } = await supabase
          .from('reviews')
          .select('selected_variant_label, selected_variant_index')
          .eq('status', 'Beantwortet')
          .not('selected_variant_index', 'is', null)
        if (!data) return
        const counts: Record<string, { label: string, index: string, count: number }> = {}
        data.forEach((row: any) => {
          const key = row.selected_variant_index
          if (!key) return
          if (!counts[key]) counts[key] = { label: VARIANT_LABELS[key] || key, index: key, count: 0 }
          counts[key].count++
        })
        const order = ['1', '2', '3', 'recovery']
        const sorted = order.filter(k => counts[k]).map(k => counts[k])
        setVariantStats(sorted)
      } catch (e) { console.warn('Variant stats failed', e) }
    }
    loadVariantStats()
  }, [reviews])

  const answered = reviews.filter(r => r.status === 'Beantwortet').length
  const pending = reviews.filter(r => r.status === 'Ausstehend').length
  const rejected = reviews.filter(r => r.status === 'Abgelehnt').length
  const total = reviews.length
  const rate = total ? Math.round(answered / total * 100) : 0
  const avg = total ? (reviews.reduce((s, r) => s + r.stars, 0) / total).toFixed(1) : '–'

  const positiveThemen = [
    { thema: 'Essen & Qualität', anzahl: 12 },
    { thema: 'Atmosphäre & Ambiente', anzahl: 8 },
    { thema: 'Freundlicher Service', anzahl: 6 },
    { thema: 'Sauberkeit', anzahl: 4 },
  ]
  const negativThemen = [
    { thema: 'Wartezeit', anzahl: 5 },
    { thema: 'Lautstärke', anzahl: 2 },
    { thema: 'Portionsgröße', anzahl: 1 },
  ]

  const startAI = () => { setAiStarted(true); setAiLoading(true); setTimeout(() => { setAiLoading(false); setAiDone(true) }, 3000) }

  // Donut SVG helper
  const DonutChart = ({ segments, size = 120 }: { segments: { value: number, color: string, label: string }[], size?: number }) => {
    const total = segments.reduce((s, seg) => s + seg.value, 0)
    if (total === 0) return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={size/2 - 8} fill="none" stroke="#f3f4f6" strokeWidth="16" />
      </svg>
    )
    const r = size / 2 - 8
    const cx = size / 2, cy = size / 2
    const circumference = 2 * Math.PI * r
    let offset = 0
    const paths = segments.map((seg, i) => {
      const pct = seg.value / total
      const dash = pct * circumference
      const gap = circumference - dash
      const rotation = offset * 360 - 90
      offset += pct
      return (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none"
          stroke={seg.color} strokeWidth="16"
          strokeDasharray={`${dash} ${gap}`}
          strokeDashoffset={0}
          transform={`rotate(${rotation} ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      )
    })
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth="16" />
        {paths}
      </svg>
    )
  }

  // Sparkline for trend (last 7 days simulated from reviews)
  const [trendDays, setTrendDays] = useState<7 | 14 | 30>(30)

  const getTrendData = (days: number) => {
    const now = new Date()
    const points: { date: string, count: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
      const dayReviews = reviews.filter(r => {
        const rd = new Date(r.date)
        return rd.toDateString() === d.toDateString()
      })
      points.push({ date: dateStr, count: dayReviews.length })
    }
    return points
  }

  const trendPoints = getTrendData(trendDays)
  const hasRealData = trendPoints.some(p => p.count > 0)
  const displayPoints = hasRealData ? trendPoints : trendPoints.map((p, i) => ({ ...p, count: [2,0,1,3,0,2,1,0,3,2,1,0,2,3,1,0,2,1,3,0,2,1,0,3,2,1,0,2,3,1][i % 30] }))

  const statusSegments = [
    { value: answered, color: '#0f4c5c', label: 'Beantwortet' },
    { value: pending, color: '#fbbf24', label: 'Ausstehend' },
    { value: rejected, color: '#e5e7eb', label: 'Abgelehnt' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '30px', fontWeight: '600', marginBottom: '4px', color: '#111827' }}>Analyse</h1>
          <p style={{ color: '#6b7280', fontSize: '16px' }}>Statistiken & KI-Auswertung Ihrer Bewertungen.</p>
        </div>
        <button onClick={startAI} style={{ padding: '9px 18px', background: '#0f4c5c', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit', fontWeight: '500' }}>
          ✨ KI-Analyse starten
        </button>
      </div>

      {/* 5 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Ø Bewertung', value: avg, sub: `${total} Bewertungen`, Icon: Star },
          { label: 'Beantwortet', value: answered, sub: `von ${total} gesamt`, Icon: CheckCircle },
          { label: 'Antwortquote', value: `${rate}%`, sub: rate >= 80 ? '🟢 Gut' : rate >= 50 ? '🟡 Mittel' : '🔴 Niedrig', Icon: Percent },
          { label: 'Ausstehend', value: pending, sub: 'noch offen', Icon: Clock },
          { label: 'Abgelehnt', value: rejected, sub: 'nicht beantwortet', Icon: XCircle },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>{s.label}</div>
              <s.Icon size={16} strokeWidth={1.8} color="#0f4c5c" />
            </div>
            <div style={{ fontSize: '26px', fontWeight: '600', color: '#111827', marginBottom: '3px' }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Varianten-Auswahl */}
      {variantStats.length > 0 && (() => {
        const total = variantStats.reduce((s, v) => s + v.count, 0)
        const variantColors: Record<string, string> = { '1': '#0f4c5c', '2': '#155e75', '3': '#1e7a8c', 'recovery': '#0e7490' }
        const variantNames = VARIANT_LABELS
        return (
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '15px', color: '#111827' }}>Welche Variante wird gewählt?</div>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Basierend auf {total} gesendeten Antworten</div>
              </div>
            </div>
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {variantStats.map(v => {
                const pct = total ? Math.round(v.count / total * 100) : 0
                const color = variantColors[v.index] || '#0f4c5c'
                const name = variantNames[v.index] || v.index
                return (
                  <div key={v.index}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>{name}</span>

                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>{v.count}×</span>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151', minWidth: '36px', textAlign: 'right' }}>{pct}%</span>
                      </div>
                    </div>
                    <div style={{ height: '6px', background: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pct + '%', background: color, borderRadius: '3px', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Trend + Donuts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '20px' }}>

        {/* Line Chart */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>Bewertungen im Zeitverlauf</div>
            <select value={trendDays} onChange={e => setTrendDays(Number(e.target.value) as 7|14|30)}
              style={{ fontSize: '12px', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>
              <option value={7}>Letzte 7 Tage</option>
              <option value={14}>Letzte 14 Tage</option>
              <option value={30}>Letzte 30 Tage</option>
            </select>
          </div>
          {(() => {
            const W = 300, H = 120, padL = 28, padB = 24, padR = 8, padT = 8
            const innerW = W - padL - padR
            const innerH = H - padT - padB
            const step = innerW / (displayPoints.length - 1)
            const maxCount = Math.max(...displayPoints.map(p => p.count), 1)
            const yTicks = maxCount <= 5 ? [0,1,2,3,4,5].filter(v => v <= maxCount + 1) : [0, Math.round(maxCount/4), Math.round(maxCount/2), Math.round(maxCount*3/4), maxCount]
            const minY = 0, maxY = Math.max(maxCount, 1)
            const toX = (i: number) => padL + i * step
            const toY = (v: number) => padT + innerH - ((v - minY) / (maxY - minY)) * innerH
            const linePath = displayPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.count).toFixed(1)}`).join(' ')
            const areaPath = linePath + ` L${toX(displayPoints.length-1).toFixed(1)},${(padT+innerH).toFixed(1)} L${padL},${(padT+innerH).toFixed(1)} Z`
            const labelStep = trendDays === 7 ? 1 : trendDays === 14 ? 2 : 5
            return (
              <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f4c5c" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#0f4c5c" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Y-axis labels */}
                {yTicks.map(v => (
                  <g key={v}>
                    <line x1={padL} y1={toY(v)} x2={W-padR} y2={toY(v)} stroke="#f3f4f6" strokeWidth="1" />
                    <text x={padL-4} y={toY(v)+4} textAnchor="end" fontSize="9" fill="#9ca3af">{v}</text>
                  </g>
                ))}
                {/* X-axis labels */}
                {displayPoints.map((p, i) => i % labelStep === 0 && (
                  <text key={i} x={toX(i)} y={H-4} textAnchor="middle" fontSize="9" fill="#9ca3af">{p.date}</text>
                ))}
                {/* Area */}
                <path d={areaPath} fill="url(#lineGrad)" />
                {/* Line */}
                <path d={linePath} fill="none" stroke="#0f4c5c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                {/* Dots */}
                {displayPoints.map((p, i) => p.count > 0 && (
                  <circle key={i} cx={toX(i)} cy={toY(p.count)} r="2.5" fill="#0f4c5c" />
                ))}
              </svg>
            )
          })()}
        </div>
                {/* Donut: Varianten */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontWeight: '600', fontSize: '14px', color: '#111827', marginBottom: '12px' }}>Gewählte Variante</div>
          {(() => {
            const variantColors: Record<string, string> = { '1': '#0f4c5c', '2': '#155e75', '3': '#1e7a8c', 'recovery': '#0e7490' }
            const order = ['1','2','3','recovery']
            const vtotal = variantStats.reduce((s, v) => s + v.count, 0)
            const vSegments = variantStats.length > 0
              ? variantStats.map(v => ({ value: v.count, color: variantColors[v.index] || '#0f4c5c', label: VARIANT_LABELS[v.index] || v.index }))
              : order.map(k => ({ value: 0, color: variantColors[k], label: VARIANT_LABELS[k] }))
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <DonutChart segments={vSegments} size={100} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  {vSegments.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', color: '#374151', flex: 1 }}>{s.label}</span>
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>{vtotal > 0 ? (variantStats.find(v => VARIANT_LABELS[v.index] === s.label)?.count ?? 0) : 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>

        {/* Donut 2: Status */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontWeight: '600', fontSize: '14px', color: '#111827', marginBottom: '12px' }}>Antwortstatus</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <DonutChart segments={statusSegments} size={100} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              {statusSegments.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '11px', color: '#374151', flex: 1 }}>{s.label}</span>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>{[answered, pending, rejected][i]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Positive & Negative Themen */}
      <div className="grid2i" style={{ marginBottom: '16px' }}>
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '15px', color: '#111827' }}>👍 Häufig positiv erwähnt</div>
          <div style={{ padding: '14px 18px' }}>
            {positiveThemen.map(t => (
              <div key={t.thema} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: '14px', color: '#374151' }}>{t.thema}</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#166534', background: '#f0fdf4', padding: '2px 8px', borderRadius: '12px' }}>{t.anzahl}×</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '15px', color: '#111827' }}>👎 Häufig negativ erwähnt</div>
          <div style={{ padding: '14px 18px' }}>
            {negativThemen.map(t => (
              <div key={t.thema} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: '14px', color: '#374151' }}>{t.thema}</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#991b1b', background: '#fef2f2', padding: '2px 8px', borderRadius: '12px' }}>{t.anzahl}×</span>
              </div>
            ))}
          </div>
        </div>
      </div>



      {/* KI Analyse Box */}
      <div style={{ background: '#fff', borderRadius: '12px', border: aiDone ? '1px solid #86efac' : '1px dashed #d1d5db', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        {!aiStarted && (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>✨</div>
            <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '6px', color: '#111827' }}>KI-Analyse noch nicht gestartet</div>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>Klicken Sie auf "KI-Analyse starten" — Claude wertet alle Bewertungen aus und liefert konkrete Handlungsempfehlungen.</div>
            <button onClick={startAI} style={{ padding: '9px 20px', background: '#0f4c5c', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit', fontWeight: '500', color: '#fff' }}>✨ Jetzt analysieren</button>
          </div>
        )}
        {aiLoading && (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
            <div style={{ fontWeight: '600', fontSize: '16px', color: '#111827' }}>KI analysiert Ihre Bewertungen...</div>
          </div>
        )}
        {aiDone && (
          <div>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '16px' }}>✨ KI-Analyse Ergebnis</div>
            <div style={{ padding: '18px' }}>
              <div style={{ background: '#f0f7f8', border: '1px solid #a5c8d0', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#0f4c5c', marginBottom: '6px' }}>WICHTIGSTE ERKENNTNIS</div>
                <div style={{ fontSize: '14px', color: '#0f3340', lineHeight: '1.6' }}>Ihre Gäste loben besonders das Essen und die Atmosphäre. Häufigster Kritikpunkt ist die Wartezeit beim Service.</div>
              </div>
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontWeight: '600', color: '#92400e', marginBottom: '8px', fontSize: '14px' }}>💡 Handlungsempfehlungen</div>
                <div style={{ fontSize: '14px', color: '#78350f', lineHeight: '1.8' }}>
                  1. Wartezeiten durch optimierte Abläufe reduzieren<br />
                  2. Reservierungssystem einführen um Stoßzeiten zu verteilen<br />
                  3. Aktiv auf 3-Sterne-Bewertungen antworten und um Feedback bitten
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


// ─── EINSTELLUNGEN ────────────────────────────────────────────────────────────

function Settings({ onLogout }: { onLogout: () => void }) {
  const [form, setForm] = useState({
    businessName: '', description: '', restaurantType: '', cuisineType: '',
    priceRange: '', dietaryOptions: '', openingHours: '',
    hasReservation: false, hasDelivery: false, hasTakeaway: false,
    hasParking: false, isWheelchairAccessible: false,
    restaurantAtmosphere: '',
    uniqueSellingPoints: '', responseSignature: '', responseLanguage: 'Deutsch',
    salutation: 'Sie',
    notificationEmail: '', contactEmail: '',
  })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveTimer, setSaveTimer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [cuisineSonstiges, setCuisineSonstiges] = useState(false)
  const [dietarySonstigesChecked, setDietarySonstigesChecked] = useState(false)

  const CUISINE_OPTIONS_LIST = ['Deutsch', 'Österreichisch', 'Italienisch', 'Türkisch & Orientalisch', 'Asiatisch & Japanisch & Chinesisch', 'Griechisch & Mediterran', 'Indisch', 'Mexikanisch & Lateinamerikanisch', 'Amerikanisch & Burger', 'Französisch', 'International & Fusion', 'Vegetarisch & Vegan fokussiert']
  const DIETARY_LIST = ['Vegetarisch', 'Vegan', 'Glutenfrei', 'Halal', 'Kosher', 'Laktosefrei']

  // Einstellungen laden — nur bekannte Felder übernehmen (ignoriert entfernte Felder aus Supabase/localStorage)
  useEffect(() => {
    const merge = (source: any, base: typeof form) =>
      (Object.keys(base) as Array<keyof typeof base>).reduce((acc, key) => {
        (acc as any)[key] = source[key] !== undefined ? source[key] : base[key]
        return acc
      }, { ...base })

    const loadData = async () => {
      try {
        const { data } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'restaurant_profile')
          .single()
        if (data?.value) {
          const merged = merge(data.value, form)
          setForm(merged)
          localStorage.setItem('reviewManagerSettings', JSON.stringify(merged))
        } else {
          const local = localStorage.getItem('reviewManagerSettings')
          if (local) setForm(prev => merge(JSON.parse(local), prev))
        }
      } catch {
        const local = localStorage.getItem('reviewManagerSettings')
        if (local) setForm(prev => merge(JSON.parse(local), prev))
      }
      setLoading(false)
    }
    loadData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-Save nach 1.5 Sekunden
  useEffect(() => {
    if (loading) return
    if (saveTimer) clearTimeout(saveTimer)
    const timer = setTimeout(async () => {
      setSaving(true)
      localStorage.setItem('reviewManagerSettings', JSON.stringify(form))
      try {
        await supabase.from('settings').upsert(
          { key: 'restaurant_profile', value: form, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
      } catch (e) { console.warn('Supabase save failed', e) }
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }, 1500)
    setSaveTimer(timer)
    return () => clearTimeout(timer)
  }, [form])

  // Sonstiges-States nach Laden initialisieren
  useEffect(() => {
    if (!loading) {
      setCuisineSonstiges(form.cuisineType !== '' && !CUISINE_OPTIONS_LIST.includes(form.cuisineType))
      const arr = form.dietaryOptions ? form.dietaryOptions.split(',').map(s => s.trim()).filter(Boolean) : []
      setDietarySonstigesChecked(arr.some(d => !DIETARY_LIST.includes(d)))
    }
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (k: string, v: any) => { setForm(p => ({ ...p, [k]: v })) }
  const save = async () => {
    setSaving(true)
    localStorage.setItem('reviewManagerSettings', JSON.stringify(form))
    try {
      await supabase.from('settings').upsert(
        { key: 'restaurant_profile', value: form, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
    } catch (e) { console.warn('Supabase save failed', e) }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', marginTop: '4px', boxSizing: 'border-box', background: '#f9fafb', fontFamily: 'inherit' }
  const lbl: React.CSSProperties = { fontSize: '13px', fontWeight: '500', display: 'block', color: '#374151' }
  const card: React.CSSProperties = { background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }
  const cardH: React.CSSProperties = { padding: '14px 18px', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '16px', color: '#111827' }
  const cardB: React.CSSProperties = { padding: '18px' }
  const hint: React.CSSProperties = { fontSize: '11px', color: '#9ca3af', marginTop: '4px' }

  const Toggle = ({ k }: { k: string }) => (
    <div onClick={() => update(k, !(form as any)[k])} style={{ width: '38px', height: '22px', borderRadius: '11px', background: (form as any)[k] ? '#0f4c5c' : '#d1d5db', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
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
          <div>
            <label style={lbl}>Küche / Küchenrichtung</label>
            <select style={inp}
              value={cuisineSonstiges ? 'Sonstiges' : form.cuisineType}
              onChange={e => {
                if (e.target.value === 'Sonstiges') { setCuisineSonstiges(true); update('cuisineType', '') }
                else { setCuisineSonstiges(false); update('cuisineType', e.target.value) }
              }}>
              <option value="">Küchenrichtung auswählen</option>
              {CUISINE_OPTIONS_LIST.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="Sonstiges">Sonstiges</option>
            </select>
            {cuisineSonstiges && (
              <input style={{ ...inp, marginTop: '6px' }} placeholder="Eigene Küchenrichtung eingeben…"
                value={form.cuisineType} onChange={e => update('cuisineType', e.target.value)} />
            )}
          </div>
          <div><label style={lbl}>Preisklasse</label>
            <select style={inp} value={form.priceRange} onChange={e => update('priceRange', e.target.value)}>
              <option value="">Preisklasse auswählen</option>
              <option value="€">€ — Günstig</option><option value="€€">€€ — Mittel</option>
              <option value="€€€">€€€ — Gehoben</option><option value="€€€€">€€€€ — Fine Dining</option>
            </select>
          </div>
        </div>
      </div></div>

      <div style={card}><div style={cardH}>📧 Kontakt für Gäste</div><div style={cardB}>
        <label style={lbl}>Kontakt-E-Mail für Gäste</label>
        <input style={{ ...inp, marginTop: '6px' }} type="email" placeholder="z. B. kontakt@meinrestaurant.de" value={form.contactEmail} onChange={e => update('contactEmail', e.target.value)} />
        <div style={hint}>Wird bei 1-2 Sterne Bewertungen in der Recovery-Antwort angezeigt.</div>
        {!form.contactEmail && (
          <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#92400e', marginTop: '8px' }}>
            ⚠️ Ohne diese E-Mail kann die <strong>Recovery-Antwort</strong> bei 1-2 Sterne Bewertungen nicht verwendet werden.
          </div>
        )}
      </div></div>

      <div style={card}><div style={cardH}>⭐ Speisekarte & Angebot</div><div style={cardB}>
        <div style={{ marginBottom: '16px' }}>
          <label style={lbl}>Ernährungsoptionen</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginTop: '10px' }}>
            {DIETARY_LIST.map(opt => {
              const items = form.dietaryOptions ? form.dietaryOptions.split(',').map(s => s.trim()).filter(Boolean) : []
              return (
                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#374151', userSelect: 'none' }}>
                  <input type="checkbox" checked={items.includes(opt)}
                    onChange={e => {
                      const cur = form.dietaryOptions ? form.dietaryOptions.split(',').map(s => s.trim()).filter(Boolean) : []
                      update('dietaryOptions', (e.target.checked ? [...cur, opt] : cur.filter(i => i !== opt)).join(', '))
                    }}
                    style={{ width: 16, height: 16, accentColor: '#0f4c5c', cursor: 'pointer', flexShrink: 0 }} />
                  {opt}
                </label>
              )
            })}
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#374151', userSelect: 'none' }}>
              <input type="checkbox" checked={dietarySonstigesChecked}
                onChange={e => {
                  setDietarySonstigesChecked(e.target.checked)
                  if (!e.target.checked) {
                    const cur = form.dietaryOptions ? form.dietaryOptions.split(',').map(s => s.trim()).filter(Boolean) : []
                    update('dietaryOptions', cur.filter(d => DIETARY_LIST.includes(d)).join(', '))
                  }
                }}
                style={{ width: 16, height: 16, accentColor: '#0f4c5c', cursor: 'pointer', flexShrink: 0 }} />
              Sonstiges
            </label>
            {dietarySonstigesChecked && (
              <input style={{ ...inp, marginTop: '2px' }} placeholder="z. B. Rohkost, Jain-Vegetarisch…"
                value={(() => {
                  const arr = form.dietaryOptions ? form.dietaryOptions.split(',').map(s => s.trim()).filter(Boolean) : []
                  return arr.filter(d => !DIETARY_LIST.includes(d)).join(', ')
                })()}
                onChange={e => {
                  const predefined = form.dietaryOptions ? form.dietaryOptions.split(',').map(s => s.trim()).filter(Boolean).filter(d => DIETARY_LIST.includes(d)) : []
                  update('dietaryOptions', [...predefined, ...(e.target.value.trim() ? [e.target.value] : [])].join(', '))
                }} />
            )}
          </div>
        </div>
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

      <div style={card}><div style={cardH}>✨ Atmosphäre & Stil</div><div style={cardB}>
        <label style={lbl}>Atmosphäre</label>
        <select style={inp} value={form.restaurantAtmosphere} onChange={e => update('restaurantAtmosphere', e.target.value)}>
          <option value="">Atmosphäre auswählen</option>
          <option value="Modern & urban">Modern & urban</option>
          <option value="Gemütlich & familiär">Gemütlich & familiär</option>
          <option value="Rustikal & bodenständig">Rustikal & bodenständig</option>
          <option value="Elegant & hochwertig">Elegant & hochwertig</option>
          <option value="Lebhaft & gesellig">Lebhaft & gesellig</option>
          <option value="Traditionell & heimelig">Traditionell & heimelig</option>
        </select>
      </div></div>

      <div style={card}><div style={cardH}>🎨 Marke & Tonalität</div><div style={cardB}>
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', paddingBottom: '16px' }}>
        {saved && <span style={{ color: '#22c55e', fontSize: '14px', fontWeight: '500', transition: 'opacity 0.3s' }}>✅ Automatisch gespeichert</span>}
        {saving && !saved && <span style={{ color: '#9ca3af', fontSize: '14px' }}>💾 Speichert...</span>}
        <button onClick={save} style={{ padding: '10px 28px', background: '#0f4c5c', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontFamily: 'inherit', fontWeight: '500' }}>Profil speichern</button>
      </div>

      {/* Account / Abmelden */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '40px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '16px', color: '#111827' }}>👤 Konto</div>
        <div style={{ padding: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>Eingeloggt als</div>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827', marginTop: '2px' }}>
              <AccountEmail />
            </div>
          </div>
          <button
            onClick={onLogout}
            style={{ padding: '8px 18px', background: '#fff', border: '1px solid #fca5a5', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', color: '#ef4444', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
            🚪 Abmelden
          </button>
        </div>
      </div>
    </div>
  )
}

function AccountEmail() {
  const [email, setEmail] = useState('')
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''))
  }, [])
  return <span>{email || '–'}</span>
}

// ─── WELCOME SCREEN ──────────────────────────────────────────────────────────

function WelcomeScreen({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#0f172a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        .wlc-btn-primary:hover { background: #0d3d4a !important; }
        .wlc-btn-secondary:hover { background: rgba(255,255,255,0.08) !important; }
      `}</style>

      <div style={{ width: '100%', maxWidth: '420px', textAlign: 'center' }}>

        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '18px',
            background: 'linear-gradient(135deg, #0f4c5c, #155e75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(15,76,92,0.4)',
          }}>
            <span style={{ fontSize: '30px' }}>⭐</span>
          </div>
        </div>

        {/* Titel */}
        <div style={{ fontSize: '32px', fontWeight: '700', color: '#fff', marginBottom: '10px', lineHeight: '1.2' }}>
          Willkommen bei<br />ReviewManager
        </div>
        <div style={{ fontSize: '16px', color: '#94a3b8', marginBottom: '48px', lineHeight: '1.7' }}>
          KI-Antworten auf Google-Bewertungen —<br />schnell, persönlich, in Ihrem Stil.
        </div>

        {/* Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '48px' }}>
          {[
            { icon: '✨', text: 'KI generiert 3 Antwortvorschläge pro Bewertung' },
            { icon: '📊', text: 'Übersicht & Analyse aller Google-Bewertungen' },
            { icon: '📧', text: 'Automatische E-Mail bei neuen Bewertungen' },
          ].map(f => (
            <div key={f.text} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              background: 'rgba(255,255,255,0.05)', borderRadius: '12px',
              padding: '12px 16px', textAlign: 'left',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>{f.icon}</span>
              <span style={{ fontSize: '14px', color: '#cbd5e1', fontWeight: '500' }}>{f.text}</span>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onRegister}
            className="wlc-btn-primary"
            style={{
              flex: 1, padding: '14px', borderRadius: '12px', border: 'none',
              background: '#0f4c5c', color: '#fff', fontSize: '15px',
              fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
          >
            Registrieren
          </button>
          <button
            onClick={onLogin}
            className="wlc-btn-secondary"
            style={{
              flex: 1, padding: '14px', borderRadius: '12px',
              border: '1.5px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.04)', color: '#e2e8f0',
              fontSize: '15px', fontWeight: '600', cursor: 'pointer',
              fontFamily: 'inherit', transition: 'background 0.15s',
            }}
          >
            Anmelden
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── AUTH SCREEN ─────────────────────────────────────────────────────────────

function AuthScreen({ initialMode = 'login' }: { initialMode?: 'login' | 'register' }) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message === 'Invalid login credentials'
        ? 'E-Mail oder Passwort ist falsch.'
        : error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message === 'User already registered'
          ? 'Diese E-Mail ist bereits registriert. Bitte einloggen.'
          : error.message)
      } else {
        setSuccess('Registrierung erfolgreich! Bitte bestätigen Sie Ihre E-Mail-Adresse.')
      }
    }
    setLoading(false)
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: '10px',
    border: '1.5px solid #d1d5db', fontSize: '15px', fontFamily: 'inherit',
    background: '#f9fafb', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0f172a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        @keyframes ob-spin { to { transform: rotate(360deg) } }
        .auth-inp:focus { border-color: #0f4c5c !important; background: #fff !important; }
        .auth-google:hover { background: #f9fafb !important; }
        .auth-tab-active { border-bottom: 2.5px solid #0f4c5c; color: #0f4c5c; font-weight: 600; }
        .auth-tab { color: #9ca3af; border-bottom: 2.5px solid transparent; font-weight: 500; }
      `}</style>

      <div style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '420px', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>

        {/* Logo + Titel */}
        <div style={{ padding: '36px 32px 0', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <img src="/favicon.svg" alt="Logo" style={{ width: 48, height: 48 }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>ReviewManager</div>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>KI-Antworten für Google-Bewertungen</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', margin: '24px 32px 0', gap: '0' }}>
          {(['login', 'register'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }}
              className={mode === m ? 'auth-tab-active' : 'auth-tab'}
              style={{ flex: 1, padding: '10px 0', fontSize: '14px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
              {m === 'login' ? 'Anmelden' : 'Registrieren'}
            </button>
          ))}
        </div>

        <div style={{ padding: '28px 32px 36px' }}>

          {/* Google Button */}
          <button onClick={handleGoogle} disabled={googleLoading} className="auth-google"
            style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', background: '#fff', fontSize: '14px', fontFamily: 'inherit', fontWeight: '600', color: '#374151', cursor: googleLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '20px', transition: 'background 0.15s' }}>
            {googleLoading ? (
              <div style={{ width: 18, height: 18, border: '2px solid #e5e7eb', borderTopColor: '#0f4c5c', borderRadius: '50%', animation: 'ob-spin 0.7s linear infinite' }} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.6-8 19.6-20 0-1.3-.1-2.7-.4-4z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.2 0-9.6-2.9-11.3-7H6.3C9.7 39.7 16.3 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C41.1 35.3 44 30 44 24c0-1.3-.1-2.7-.4-4z" />
              </svg>
            )}
            Mit Google {mode === 'login' ? 'anmelden' : 'registrieren'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
            <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '500' }}>oder</span>
            <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
          </div>

          {/* E-Mail / Passwort Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '5px' }}>E-Mail</label>
              <input className="auth-inp" style={inp} type="email" required autoComplete="email"
                placeholder="name@restaurant.de" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '5px' }}>Passwort</label>
              <input className="auth-inp" style={inp} type="password" required autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                placeholder={mode === 'register' ? 'Mindestens 6 Zeichen' : '••••••••'} value={password} onChange={e => setPassword(e.target.value)} />
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#dc2626', marginBottom: '16px' }}>
                ⚠️ {error}
              </div>
            )}
            {success && (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#16a34a', marginBottom: '16px' }}>
                ✅ {success}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: loading ? '#e5e7eb' : '#0f4c5c', color: loading ? '#9ca3af' : '#fff', fontSize: '15px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.15s' }}>
              {loading && <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'ob-spin 0.7s linear infinite' }} />}
              {mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '18px', fontSize: '13px', color: '#9ca3af' }}>
            {mode === 'login' ? 'Noch kein Konto?' : 'Bereits registriert?'}{' '}
            <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setSuccess('') }}
              style={{ background: 'none', border: 'none', color: '#0f4c5c', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', padding: 0 }}>
              {mode === 'login' ? 'Registrieren' : 'Anmelden'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── ONBOARDING ──────────────────────────────────────────────────────────────

interface OnboardingData {
  businessName: string
  restaurantType: string
  salutation: string
  restaurantAtmosphere: string
  contactEmail: string
}

function ObStepHeader({ n, label, title, subtitle }: { n: number; label: string; title: string; subtitle: string }) {
  return (
    <div>
      <div style={{ fontSize: '11px', fontWeight: '600', color: '#0f4c5c', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
        Schritt {n} · {label}
      </div>
      <div style={{ fontSize: '21px', fontWeight: '700', color: '#111827', marginBottom: '6px', lineHeight: '1.3' }}>
        {title}
      </div>
      <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>{subtitle}</div>
    </div>
  )
}

function ObActions({ onNext, canContinue, optional = false }: { onNext: () => void; canContinue: boolean; optional?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: optional ? 'space-between' : 'flex-end' }}>
      {optional && (
        <button
          onClick={onNext}
          style={{ fontSize: '13px', color: '#9ca3af', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontWeight: '500' }}
          onMouseOver={e => { (e.currentTarget as HTMLElement).style.color = '#374151' }}
          onMouseOut={e => { (e.currentTarget as HTMLElement).style.color = '#9ca3af' }}
        >
          Überspringen
        </button>
      )}
      <button
        onClick={onNext}
        disabled={!canContinue}
        style={{
          padding: '11px 24px', borderRadius: '10px', border: 'none', fontFamily: 'inherit',
          background: canContinue ? '#0f4c5c' : '#e5e7eb',
          color: canContinue ? '#fff' : '#9ca3af',
          fontSize: '14px', fontWeight: '600', cursor: canContinue ? 'pointer' : 'not-allowed',
          transition: 'all 0.15s',
        }}
      >
        Weiter →
      </button>
    </div>
  )
}

function Onboarding({ step, data, onDataChange, onNext, onBack, onFinish }: {
  step: number
  data: OnboardingData
  onDataChange: (key: string, val: string) => void
  onNext: () => void
  onBack: () => void
  onFinish: () => Promise<void>
}) {
  const [saving, setSaving] = useState(false)

  const handleFinish = async () => {
    setSaving(true)
    await onFinish()
    setSaving(false)
  }

  const chip = (selected: boolean): React.CSSProperties => ({
    padding: '10px 18px', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit',
    border: selected ? '2px solid #0f4c5c' : '1.5px solid #e5e7eb',
    background: selected ? '#f0f7f8' : '#fff',
    color: selected ? '#0d3d4a' : '#374151',
    fontWeight: selected ? '600' : '500',
    fontSize: '14px', transition: 'all 0.15s',
  })

  const inp: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: '10px',
    border: '1.5px solid #d1d5db', fontSize: '15px', fontFamily: 'inherit',
    background: '#f9fafb', marginTop: '20px', marginBottom: '28px', outline: 'none',
  }

  const canContinue = (): boolean => {
    if (step === 2) return data.businessName.trim().length > 0
    if (step === 3) return data.restaurantType !== ''
    if (step === 4) return data.salutation !== ''
    if (step === 6) return data.contactEmail.includes('@') && data.contactEmail.includes('.')
    return true
  }

  const progress = step === 7 ? 1 : step <= 1 ? 0 : (step - 1) / 5

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0f172a', zIndex: 1000, padding: '16px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        @keyframes ob-spin { to { transform: rotate(360deg) } }
        .ob-chip:hover { border-color: #7ab8c4 !important; background: #f5f3ff !important; }
      `}</style>

      <div style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '460px', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
        {/* Fortschrittsbalken */}
        <div style={{ height: '4px', background: '#e5e7eb' }}>
          <div style={{
            height: '100%', background: 'linear-gradient(90deg, #0f4c5c, #155e75)',
            width: `${progress * 100}%`, transition: 'width 0.4s ease',
            borderRadius: progress < 1 ? '0 4px 4px 0' : '0',
          }} />
        </div>

        {/* Zurück-Button & Schritt-Zähler */}
        {step > 1 && step < 7 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px 0' }}>
            <button
              onClick={onBack}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af', fontSize: '13px', fontWeight: '500', fontFamily: 'inherit', padding: 0 }}
              onMouseOver={e => { (e.currentTarget as HTMLElement).style.color = '#374151' }}
              onMouseOut={e => { (e.currentTarget as HTMLElement).style.color = '#9ca3af' }}
            >
              ← Zurück
            </button>
            <span style={{ fontSize: '12px', color: '#d1d5db', fontWeight: '500' }}>{step - 1} / 5</span>
          </div>
        )}

        <div style={{ padding: step > 1 && step < 7 ? '22px 32px 32px' : '40px 32px 36px' }}>

          {/* Screen 1: Willkommen */}
          {step === 1 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <img src="/favicon.svg" alt="Logo" style={{ width: 56, height: 56 }} />
              </div>
              <div style={{ fontSize: '26px', fontWeight: '700', color: '#111827', marginBottom: '10px', lineHeight: '1.3' }}>
                Willkommen bei<br />ReviewManager
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '36px', lineHeight: '1.7' }}>
                Smarte KI-Antworten auf Google-Bewertungen —<br />schnell, persönlich, in deinem Stil.
              </div>
              <button
                onClick={onNext}
                style={{ width: '100%', padding: '14px', borderRadius: '12px', background: '#0f4c5c', color: '#fff', border: 'none', fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Loslegen →
              </button>
            </div>
          )}

          {/* Screen 2: Restaurantname */}
          {step === 2 && (
            <div>
              <ObStepHeader n={1} label="Name" title="Wie heißt euer Restaurant?" subtitle="So spricht die KI euer Restaurant in allen Antworten an." />
              <input
                autoFocus type="text" placeholder="z.B. Trattoria da Marco"
                value={data.businessName} onChange={e => onDataChange('businessName', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && canContinue() && onNext()}
                style={inp}
                onFocus={e => { e.currentTarget.style.borderColor = '#0f4c5c' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#d1d5db' }}
              />
              <ObActions onNext={onNext} canContinue={canContinue()} />
            </div>
          )}

          {/* Screen 3: Restaurant-Typ */}
          {step === 3 && (
            <div>
              <ObStepHeader n={2} label="Typ" title="Was seid ihr?" subtitle="Hilft der KI, die passende Tonalität zu wählen." />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '20px', marginBottom: '28px' }}>
                {['Restaurant', 'Café', 'Bar / Weinbar', 'Bistro', 'Imbiss / Foodtruck', 'Bäckerei / Konditorei', 'Hotel / Hotelrestaurant', 'Gasthof / Pension', 'Catering', 'Kantine', 'Sonstiges'].map(t => (
                  <button key={t} className="ob-chip" onClick={() => onDataChange('restaurantType', t)} style={chip(data.restaurantType === t)}>{t}</button>
                ))}
              </div>
              <ObActions onNext={onNext} canContinue={canContinue()} optional />
            </div>
          )}

          {/* Screen 4: Anredeform */}
          {step === 4 && (
            <div>
              <ObStepHeader n={3} label="Anrede" title="Wie redet ihr eure Gäste an?" subtitle="Gilt für alle KI-generierten Antworten." />
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px', marginBottom: '28px' }}>
                {[
                  { val: 'Du', emoji: '👋', sub: 'locker & modern' },
                  { val: 'Sie', emoji: '🤝', sub: 'formell & professionell' },
                ].map(s => (
                  <button key={s.val} className="ob-chip" onClick={() => onDataChange('salutation', s.val)}
                    style={{ ...chip(data.salutation === s.val), flex: 1, padding: '18px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '26px' }}>{s.emoji}</span>
                    <span style={{ fontSize: '16px', fontWeight: '700' }}>{s.val}</span>
                    <span style={{ fontSize: '12px', fontWeight: '400', color: data.salutation === s.val ? '#1e7a8c' : '#9ca3af' }}>{s.sub}</span>
                  </button>
                ))}
              </div>
              <ObActions onNext={onNext} canContinue={canContinue()} optional />
            </div>
          )}

          {/* Screen 5: Atmosphäre & Stil */}
          {step === 5 && (
            <div>
              <ObStepHeader n={4} label="Atmosphäre" title="Wie würdet ihr eure Atmosphäre beschreiben?" subtitle="Hilft der KI, den richtigen Ton und Stil in den Antworten zu treffen." />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '20px', marginBottom: '28px' }}>
                {[
                  'Modern & urban',
                  'Gemütlich & familiär',
                  'Rustikal & bodenständig',
                  'Elegant & hochwertig',
                  'Lebhaft & gesellig',
                  'Traditionell & heimelig',
                ].map(a => (
                  <button key={a} className="ob-chip" onClick={() => onDataChange('restaurantAtmosphere', a)} style={chip(data.restaurantAtmosphere === a)}>{a}</button>
                ))}
              </div>
              <ObActions onNext={onNext} canContinue={data.restaurantAtmosphere !== ''} optional />
            </div>
          )}

          {/* Screen 6: Kontakt-E-Mail */}
          {step === 6 && (
            <div>
              <ObStepHeader n={5} label="E-Mail" title="Kontakt-E-Mail für Gäste" subtitle="Wird in Recovery-Antworten bei negativen Bewertungen eingebettet." />
              <input
                autoFocus type="email" placeholder="kontakt@euer-restaurant.de"
                value={data.contactEmail} onChange={e => onDataChange('contactEmail', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && canContinue() && onNext()}
                style={inp}
                onFocus={e => { e.currentTarget.style.borderColor = '#0f4c5c' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#d1d5db' }}
              />
              <ObActions onNext={onNext} canContinue={canContinue()} optional />
            </div>
          )}

          {/* Screen 7: Fertig */}
          {step === 7 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '52px', marginBottom: '16px', lineHeight: '1' }}>🎉</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '10px' }}>
                Alles bereit!
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '32px', lineHeight: '1.7' }}>
                <strong style={{ color: '#111827' }}>{data.businessName || 'Euer Profil'}</strong> ist eingerichtet.<br />
                Die KI kennt jetzt euren Stil.
              </div>
              <button
                onClick={handleFinish} disabled={saving}
                style={{
                  width: '100%', padding: '14px', borderRadius: '12px',
                  background: saving ? '#e5e7eb' : '#0f4c5c',
                  color: saving ? '#9ca3af' : '#fff', border: 'none',
                  fontSize: '15px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                {saving && <div style={{ width: 16, height: 16, border: '2.5px solid rgba(0,0,0,0.15)', borderTopColor: '#9ca3af', borderRadius: '50%', animation: 'ob-spin 0.8s linear infinite' }} />}
                Dashboard öffnen
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export default App
