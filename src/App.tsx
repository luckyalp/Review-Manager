import { useState, useEffect, useRef } from 'react'
import { Home, MessageSquare, BarChart2, User, Star, Clock, CheckCircle, Percent } from 'lucide-react'
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
  googleReviewId?: string
  selectedAnswer?: string
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
  const [engine, setEngine] = useState<'v2' | 'v1' | 'v3' | 'v4' | 'v5'>(() => {
    return (localStorage.getItem('rezpondEngine') as 'v2' | 'v1' | 'v3' | 'v4' | 'v5') || 'v5'
  })
  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [reviewsInitialFilter, setReviewsInitialFilter] = useState<string>('alle')
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
          .from('settings').select('value').eq('key', 'restaurant_profile').eq('user_id', user.id).single()
        if (data?.value?.businessName) { setOnboardingStep(0); return }
      } catch { /* ignore */ }
      try {
        const local = localStorage.getItem('rezpondSettings')
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
      text: (() => {
        const t: string = row.review_text ?? ''
        // Google schickt manchmal "(Translated by Google) ... (Original) ..." — nur Original behalten
        const match = t.match(/\(Original\)\s*(.+)$/s)
        return match ? match[1].trim() : t
      })(),
      date: row.review_date,
      status: row.status as ReviewStatus,
      googleReviewId: row.google_review_id ?? undefined,
      selectedAnswer: row.selected_answer ?? undefined,
    })
    const loadReviews = async () => {
      try {
        const { data, error } = await supabase
          .from('reviews')
          .select('*')
          .eq('user_id', user.id)
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

  const navigate = (id: string) => { setPage(id); setSelectedReview(null); setReviewsInitialFilter('alle') }
  const addManualReview = (r: Review) => { setReviews(prev => [r, ...prev]) }
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
    localStorage.removeItem('rezpondSettings')
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
      localStorage.setItem('rezpondSettings', JSON.stringify(fullSettings))
      try {
        await supabase.from('settings').upsert(
          { key: 'restaurant_profile', user_id: user?.id, value: fullSettings, updated_at: new Date().toISOString() },
          { onConflict: 'key,user_id' }
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
    <div style={{ minHeight: '100vh', fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f7f5f2' }}>
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
              {page === 'dashboard' && <Dashboard stats={stats} reviews={reviews} openReview={openReview} onAddReview={addManualReview} userId={user?.id} onNavigateReviews={(filter?: string) => { setReviewsInitialFilter(filter || 'alle'); setPage('reviews'); setSelectedReview(null) }} engine={engine} />}
              {page === 'reviews' && !selectedReview && <Reviews reviews={reviews} onStatusChange={updateReviewStatus} onDelete={deleteReview} openReview={openReview} initialFilterStars={reviewsInitialFilter} />}
              {page === 'reviews' && selectedReview && <ReviewDetail review={selectedReview} onStatusChange={updateReviewStatus} onBack={() => setSelectedReview(null)} onNavigateSettings={() => { setSelectedReview(null); setPage('settings') }} engine={engine} />}
              {page === 'analytics' && <Analytics reviews={reviews} userId={user?.id} />}
              {page === 'settings' && <Settings onLogout={handleLogout} userId={user?.id} engine={engine} onEngineChange={(e) => { setEngine(e); localStorage.setItem('rezpondEngine', e) }} />}
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

function Dashboard({ stats, reviews, openReview, onAddReview, onNavigateReviews, userId, engine }: { stats: any, reviews: Review[], openReview: (r: Review) => void, onAddReview: (r: Review) => void, onNavigateReviews: (filter?: string) => void, userId?: string, engine: 'v2' | 'v1' | 'v3' | 'v4' | 'v5' }) {
  const [testRunning, setTestRunning] = useState(false)
  const [testDone, setTestDone] = useState(false)
  const [testError, setTestError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem('rezpondWelcomeDismissed'))
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null)
  const [lastSync, setLastSync] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    const checkGoogleToken = async () => {
      try {
        const { data } = await supabase
          .from('google_tokens')
          .select('updated_at')
          .eq('user_id', userId)
          .single()
        if (data) {
          setGoogleConnected(true)
          setLastSync(data.updated_at)
        } else {
          setGoogleConnected(false)
        }
      } catch {
        setGoogleConnected(false)
      }
    }
    checkGoogleToken()
  }, [userId])

  const dismissWelcome = () => {
    localStorage.setItem('rezpondWelcomeDismissed', '1')
    setShowWelcome(false)
  }
  const [newName, setNewName] = useState('')
  const [newStars, setNewStars] = useState(5)
  const [newText, setNewText] = useState('')

  const handleAddReview = () => {
    if (!newText.trim()) return
    const r: Review = {
      id: Date.now(),
      name: newName.trim() || 'Unbekannter Gast',
      initials: newName.trim()
        ? newName.trim().split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
        : 'UG',
      stars: newStars,
      text: newText.trim(),
      date: new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }),
      status: 'Ausstehend',
    }
    onAddReview(r)
    openReview(r)
    setShowAddForm(false)
    setNewName('')
    setNewStars(5)
    setNewText('')
  }

  const recent = reviews.filter(r => r.status === 'Ausstehend')

  // Morning-Card Berechnungen
  const pendingCount = reviews.filter(r => r.status === 'Ausstehend').length
  const newNegativeCount = reviews.filter(r => r.stars <= 2 && r.status === 'Ausstehend').length
  const today = new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
  const todayCount = reviews.filter(r => formatDate(r.date) === today).length

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

    const settings = JSON.parse(localStorage.getItem('rezpondSettings') || '{}')
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
      const _endpoint = engine === 'v1' ? '/api/generate-replies' : engine === 'v3' ? '/api/generate-replies-v3' : engine === 'v4' ? '/api/generate-replies-v4' : engine === 'v5' ? '/api/generate-replies-v5' : '/api/generate-replies-v2'
      const repliesRes = await fetch(_endpoint, {
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '30px', fontWeight: '600', marginBottom: '4px', color: '#111827' }}>Dashboard</h1>
          <p style={{ color: '#6b7280', fontSize: '16px' }}>Übersicht Ihrer Google-Unternehmensbewertungen.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setShowAddForm(true)} style={{ padding: '8px 16px', background: '#0f4c5c', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', fontWeight: '500' }}>
            ✏️ Bewertung hinzufügen
          </button>
        </div>
      </div>

      {/* ── MORNING CARD — Assistent, nicht Statistik ── */}
      {reviews.length > 0 && (() => {
        // Einzige Botschaft berechnen — Priorität: negativ > ausstehend > alles gut
        const msg = newNegativeCount > 0
          ? {
              headline: newNegativeCount === 1
                ? 'Eine negative Bewertung braucht deine Aufmerksamkeit.'
                : `${newNegativeCount} negative Bewertungen brauchen deine Aufmerksamkeit.`,
              sub: 'Negative Bewertungen ohne Antwort schaden dem Eindruck — je früher, desto besser.',
              btnLabel: newNegativeCount === 1 ? '1 negative Bewertung öffnen →' : `${newNegativeCount} negative Bewertungen öffnen →`,
              urgent: true,
            }
          : pendingCount > 0
          ? {
              headline: pendingCount === 1
                ? 'Eine Bewertung wartet noch auf eine Antwort.'
                : `${pendingCount} Bewertungen warten noch auf eine Antwort.`,
              sub: 'Kein dringender Handlungsbedarf — aber es lohnt sich, sie heute noch zu beantworten.',
              btnLabel: 'Bewertungen öffnen →',
              urgent: false,
            }
          : {
              headline: 'Alles beantwortet — gut gemacht.',
              sub: todayCount > 0
                ? `${todayCount === 1 ? 'Eine neue Bewertung' : `${todayCount} neue Bewertungen`} heute eingegangen.`
                : 'Aktuell gibt es nichts zu tun.',
              btnLabel: null,
              urgent: false,
            }

        return (
          <div style={{
            background: 'linear-gradient(135deg, #0f4c5c 0%, #155e75 100%)',
            borderRadius: '16px',
            padding: '20px 22px',
            marginBottom: '16px',
            boxShadow: '0 4px 16px rgba(15,76,92,0.25)',
          }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: "#ffffff", textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
              {(() => { const h = new Date().getHours(); return h < 12 ? 'Guten Morgen 👋' : h < 18 ? 'Guten Nachmittag 👋' : h < 22 ? 'Guten Abend 👋' : 'Gute Nacht 🌙' })()}
            </div>
            <div style={{ fontSize: '17px', fontWeight: '600', color: msg.urgent ? '#fca5a5' : '#e8f4f7', lineHeight: '1.4', marginBottom: '8px' }}>
              {msg.headline}
            </div>
            <div style={{ fontSize: '13px', color: "#ffffffcc", lineHeight: '1.6', marginBottom: msg.btnLabel ? '16px' : '0' }}>
              {msg.sub}
            </div>
            {msg.btnLabel && (
              <button
                onClick={() => onNavigateReviews(msg.urgent ? 'negativ' : 'alle')}
                style={{
                  padding: '10px 18px', borderRadius: '9px',
                  background: msg.urgent ? '#dc2626' : '#1e7a8c',
                  border: 'none', cursor: 'pointer',
                  fontSize: '13px', fontWeight: '600', color: '#ffffff',
                  fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px',
                }}
              >
                {msg.btnLabel}
              </button>
            )}
          </div>
        )
      })()}

      {/* Willkommens-Hinweis — nur beim ersten Login */}
      {showWelcome && (
        <div style={{ background: 'linear-gradient(135deg, #f0f7f8, #e8f4f6)', border: '1px solid #a5c8d0', borderRadius: '14px', padding: '16px 20px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '14px', boxShadow: '0 2px 8px rgba(15,76,92,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
          <span style={{ fontSize: '22px', flexShrink: 0, marginTop: '1px' }}>👋</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '600', fontSize: '15px', color: '#0f4c5c', marginBottom: '5px' }}>Herzlich willkommen bei Rezpond!</div>
            <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>
              Sobald Google verbunden ist, zieht Rezpond automatisch deine letzten <strong>90 unbeantworteten Bewertungen</strong> rein — ohne E-Mail-Flut.
              Neue Bewertungen kommen danach <strong>stündlich</strong> rein.
            </div>
          </div>
          <button onClick={dismissWelcome} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '18px', padding: '0 4px', lineHeight: 1, flexShrink: 0 }} title="Schließen">×</button>
        </div>
      )}

      {/* Bewertung manuell hinzufügen */}
      {showAddForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
          <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '440px', padding: '28px', boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>Bewertung hinzufügen</div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '22px' }}>Google-Bewertung einfügen — KI generiert sofort 3 Antworten.</div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '5px' }}>Name des Gastes (optional)</label>
              <input type="text" placeholder="z. B. Maria K." value={newName} onChange={e => setNewName(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #d1d5db', fontSize: '14px', fontFamily: 'inherit', outline: 'none', background: '#f9fafb', boxSizing: 'border-box' as const }}
                onFocus={e => { e.currentTarget.style.borderColor = '#0f4c5c' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#d1d5db' }}
              />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '8px' }}>Sternebewertung</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setNewStars(n)} style={{ fontSize: '26px', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: n <= newStars ? '#f59e0b' : '#d1d5db', transition: 'color 0.15s', lineHeight: 1 }}>★</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '22px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '5px' }}>Bewertungstext *</label>
              <textarea placeholder="Bewertungstext hier einfügen…" value={newText} onChange={e => setNewText(e.target.value)} rows={4}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #d1d5db', fontSize: '14px', fontFamily: 'inherit', outline: 'none', background: '#f9fafb', resize: 'none' as const, boxSizing: 'border-box' as const }}
                onFocus={e => { e.currentTarget.style.borderColor = '#0f4c5c' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#d1d5db' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowAddForm(false); setNewName(''); setNewStars(5); setNewText('') }}
                style={{ padding: '10px 20px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit', color: '#374151', fontWeight: '500' }}>
                Abbrechen
              </button>
              <button onClick={handleAddReview} disabled={!newText.trim()}
                style={{ padding: '10px 22px', background: newText.trim() ? '#0f4c5c' : '#e5e7eb', border: 'none', borderRadius: '10px', cursor: newText.trim() ? 'pointer' : 'not-allowed', fontSize: '14px', fontFamily: 'inherit', color: newText.trim() ? '#fff' : '#9ca3af', fontWeight: '600' }}>
                ✨ Antworten generieren →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats — 4 KPIs */}
      <div className="grid4" style={{ marginBottom: '16px' }}>
        {[
          { label: 'Ø Bewertung', value: stats.avg, Icon: Star },
          { label: 'Beantwortet', value: stats.answered, Icon: CheckCircle },
          { label: 'Gesamt', value: stats.total, Icon: MessageSquare },
          { label: 'Ausstehend', value: stats.pending, Icon: Clock },
        ].map((s) => (
          <div key={s.label} style={{
            background: '#fff', borderRadius: '12px', padding: '18px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>{s.label}</div>
              <s.Icon size={18} strokeWidth={1.8} color="#0f4c5c" />
            </div>
            <div style={{ fontSize: '28px', fontWeight: '600', color: '#111827' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Sync Status — Banner-Style */}
      <div style={{ background: googleConnected ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)' : 'linear-gradient(135deg, #f0f7f8, #e8f4f6)', border: `1px solid ${googleConnected ? '#86efac' : '#a5c8d0'}`, borderRadius: '14px', padding: '14px 18px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', boxShadow: '0 2px 8px rgba(15,76,92,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: googleConnected ? '#22c55e' : '#a5c8d0', flexShrink: 0 }} />
          <div>
            {googleConnected === null && (
              <div style={{ fontSize: '13px', color: '#6b7280' }}>Verbindungsstatus wird geprüft...</div>
            )}
            {googleConnected === true && (
              <>
                <div style={{ fontSize: '13px', color: '#166534', fontWeight: '600' }}>✅ Google verbunden — Bewertungen werden automatisch synchronisiert</div>
                {lastSync && <div style={{ fontSize: '12px', color: '#4a8fa0', marginTop: '2px' }}>Letzter Sync: {new Date(lastSync).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr</div>}
              </>
            )}
            {googleConnected === false && (
              <>
                <div style={{ fontSize: '13px', color: '#0f4c5c', fontWeight: '600' }}>Google Sync: Noch nicht verbunden</div>
                <div style={{ fontSize: '12px', color: '#4a8fa0', marginTop: '2px' }}>Bewertungen können bis dahin manuell hinzugefügt werden.</div>
              </>
            )}
          </div>
        </div>
        {googleConnected === false && (
          <button
            onClick={() => { window.location.href = `/api/google-auth?userId=${userId}` }}
            style={{ background: '#0f4c5c', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit' }}
          >
            Mit Google verbinden
          </button>
        )}
        {googleConnected === true && (
          <button
            onClick={() => { window.location.href = `/api/google-auth?userId=${userId}` }}
            style={{ background: 'transparent', color: '#4a8fa0', border: '1px solid #a5c8d0', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit' }}
          >
            Neu verbinden
          </button>
        )}
      </div>

      {/* Reviews + Distribution */}
      <div className="grid-dashboard">
        {/* Aktuelle Bewertungen */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ fontWeight: '600', fontSize: '16px', color: '#111827' }}>Aktuelle Bewertungen</div>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Neueste Bewertungen Ihrer Kunden</div>
          </div>
          <div style={{ padding: '12px' }}>
            {recent.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                Keine offenen Bewertungen — alles beantwortet 🎉
              </div>
            ) : recent.map(r => (
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
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button onClick={() => openReview(r)} style={{ padding: '6px 14px', background: '#0f4c5c', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit', color: '#fff' }}>
                    ✨ Antworten generieren
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bewertungsverteilung */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden', alignSelf: 'start' }}>
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
                <div style={{ flex: 1, height: '10px', background: '#f7f5f2', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${row.pct}%`, background: row.color, borderRadius: '5px', transition: 'width 0.3s' }} />
                </div>
                <div style={{ width: '36px', fontSize: '13px', color: '#374151', textAlign: 'right', flexShrink: 0 }}>{row.pct}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Test-E-Mail — nur für Admins */}
      {(userId === '6ae1a7a5-72c9-4b75-88d5-042a703b5b54' || userId === '81df2fe7-aab5-4527-b512-fa58eb9ee55f') && (
      <div style={{ background: 'linear-gradient(135deg, #f0f7f8, #e8f4f6)', borderRadius: '12px', border: '1px solid #a5c8d0', padding: '18px 20px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', boxShadow: '0 2px 8px rgba(15,76,92,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <span style={{ fontSize: '22px' }}>📧</span>
          <div>
            <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '3px', color: '#0f4c5c' }}>Test-E-Mail senden</div>
            <div style={{ fontSize: '13px', color: '#374151' }}>Schickt dir eine echte E-Mail — so siehst du auf dem Handy wie eine Bewertungs-Benachrichtigung aussieht.</div>
            {testError && <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '6px' }}>⚠️ {testError}</div>}
            {testDone && <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '6px' }}>✅ Test-E-Mail wurde gesendet!</div>}
          </div>
        </div>
        <button onClick={runTest} disabled={testRunning}
          style={{ padding: '9px 20px', background: testDone ? '#dcfce7' : '#0f4c5c', border: `1px solid ${testDone ? '#86efac' : '#0f4c5c'}`, borderRadius: '8px', cursor: testRunning ? 'default' : 'pointer', fontSize: '13px', fontFamily: 'inherit', color: testDone ? '#166534' : '#fff', fontWeight: '600', whiteSpace: 'nowrap' }}>
          {testRunning ? '⏳ Wird gesendet...' : testDone ? '✅ Gesendet' : '📧 Test-E-Mail senden'}
        </button>
      </div>
      )}
    </div>
  )
}

// ─── BEWERTUNGEN ─────────────────────────────────────────────────────────────

function Reviews({ reviews, onStatusChange, onDelete, openReview, initialFilterStars = 'alle' }: { reviews: Review[], onStatusChange: (id: number, s: ReviewStatus) => void, onDelete: (id: number) => void, openReview: (r: Review) => void, initialFilterStars?: string }) {
  const [filterStatus, setFilterStatus] = useState('alle')
  const [filterStars, setFilterStars] = useState(initialFilterStars)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const filtered = reviews.filter(r => {
    if (filterStatus === 'ausstehend' && r.status !== 'Ausstehend') return false
    if (filterStatus === 'beantwortet' && r.status !== 'Beantwortet') return false
    if (filterStatus === 'abgelehnt' && r.status !== 'Abgelehnt') return false
    if (filterStars === 'negativ' && r.stars > 2) return false
    if (filterStars !== 'alle' && filterStars !== 'negativ' && r.stars !== parseInt(filterStars)) return false
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
            
          </select>
          <select style={sel} value={filterStars} onChange={e => setFilterStars(e.target.value)}>
            <option value="alle">Alle Sterne</option>
            <option value="negativ">1–2 Sterne (negativ)</option>
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
        <div key={review.id} style={{ background: '#fff', borderRadius: '12px', padding: '18px', border: '1px solid #e5e7eb', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)', opacity: review.status === 'Abgelehnt' ? 0.65 : 1 }}>

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

            {/* Antworten generieren — führt direkt auf Einzelseite */}
            {review.status !== 'Beantwortet' && (
              <button
                onClick={() => openReview(review)}
                style={{ padding: '7px 14px', background: '#0f4c5c', color: '#fff', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ✨ Antworten generieren
              </button>
            )}

            {/* Antwort ausgewählt Badge + gesendeter Text */}
            {review.status === 'Beantwortet' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', fontSize: '13px', fontWeight: '500' }}>
                  ✅ Gesendet
                </div>
                {review.selectedAnswer && (
                  <div style={{ fontSize: '14px', color: '#374151', background: '#f3f4f6', borderRadius: '6px', padding: '10px 14px', lineHeight: '1.6', fontStyle: 'italic', borderLeft: '3px solid #0f4c5c' }}>
                    „{review.selectedAnswer}"
                  </div>
                )}
              </div>
            )}

            {review.status !== 'Beantwortet' && (
              <button
                onClick={() => onStatusChange(review.id, 'Abgelehnt')}
                style={{ display: 'none' }}>
                {''}
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
  .rd2-gen-btn { display: inline-flex; align-items: center; gap: 7px; padding: 10px 26px; background: var(--rd2-petrol); color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 13.5px; font-family: 'DM Sans', sans-serif; font-weight: 600; box-shadow: 0 2px 8px rgba(15,76,92,0.22); transition: background 0.18s, transform 0.1s; }
  .rd2-gen-btn:hover { background: var(--rd2-petrol-mid); transform: translateY(-1px); }
  .rd2-toast { position: fixed; bottom: 72px; left: 50%; transform: translateX(-50%) translateY(16px); background: var(--rd2-success); color: white; padding: 10px 24px; border-radius: 40px; font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif; opacity: 0; transition: opacity 0.25s, transform 0.25s; pointer-events: none; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
  .rd2-toast.rd2-toast-show { opacity: 1; transform: translateX(-50%) translateY(0); }
`

// ─── REVIEW DETAIL ───────────────────────────────────────────────────────────

function ReviewDetail({ review, onStatusChange, onBack, onNavigateSettings, engine }: { review: Review, onStatusChange: (id: number, s: ReviewStatus) => void, onBack: () => void, onNavigateSettings: () => void, engine: 'v2' | 'v1' | 'v3' | 'v4' | 'v5' }) {
  const [aiLoading, setAiLoading] = useState(false)
  const [answers, setAnswers] = useState<{label: string, text: string, isRecovery?: boolean}[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showToast, setShowToast] = useState(false)
  const [missingContext, setMissingContext] = useState<string | null>(null)
  const [categoryQuestion, setCategoryQuestion] = useState<{ question: string; category: string } | null>(null)
  const [categoryAnswer, setCategoryAnswer] = useState('')
  const [categoryAnswerSaving, setCategoryAnswerSaving] = useState(false)
  const textareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({})
  const settings = JSON.parse(localStorage.getItem('rezpondSettings') || '{}')

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

    // Zu Google posten wenn echte google_review_id vorhanden
    if (review.googleReviewId && text) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await fetch('/api/post-reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              googleReviewId: review.googleReviewId,
              answerText: text,
            }),
          })
        }
      } catch (e) { console.warn('Google Post fehlgeschlagen:', e) }
    }

    onStatusChange(review.id, 'Beantwortet')
    setShowToast(true)
    setTimeout(() => { setShowToast(false); onBack() }, 1500)
  }

  const saveCategoryAnswer = async () => {
    if (!categoryQuestion || !categoryAnswer.trim()) return
    setCategoryAnswerSaving(true)
    const updated = {
      ...settings,
      categoryProfile: {
        ...(settings.categoryProfile || {}),
        [categoryQuestion.category]: categoryAnswer.trim(),
      }
    }
    localStorage.setItem('rezpondSettings', JSON.stringify(updated))
    // Auch in Supabase speichern
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('settings').upsert(
          { key: 'restaurant_profile', user_id: user.id, value: updated, updated_at: new Date().toISOString() },
          { onConflict: 'key,user_id' }
        )
      }
    } catch (e) { console.warn('Supabase save failed', e) }
    setCategoryQuestion(null)
    setCategoryAnswer('')
    setCategoryAnswerSaving(false)
    // Neu generieren mit den neuen Infos
    generateReplies(false)
  }

  const generateReplies = async (force = false) => {
    setAiLoading(true)
    setMissingContext(null)
    setCategoryQuestion(null)
    try {
      const currentSettings = JSON.parse(localStorage.getItem('rezpondSettings') || '{}')
      const _endpoint = engine === 'v1' ? '/api/generate-replies' : engine === 'v3' ? '/api/generate-replies-v3' : engine === 'v4' ? '/api/generate-replies-v4' : engine === 'v5' ? '/api/generate-replies-v5' : '/api/generate-replies-v2'
      const response = await fetch(_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review: { reviewerName: review.name, stars: review.stars, reviewText: review.text }, settings: currentSettings, force })
      })
      const data = await response.json()
      if (data.missingContext && data.isCategoryQuestion) {
        setCategoryQuestion({ question: data.missingInfo, category: data.category })
      } else if (data.missingContext) {
        setMissingContext(data.missingInfo || 'Fehlende Informationen im Restaurantprofil')
      } else if (data.success && data.answers) {
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
            {isRecovery && <div className="rd2-recovery-note">Für echte Probleme — nicht für Policy-Beschwerden.</div>}
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
          {answers.length === 0 && !aiLoading && !missingContext && (
            <div className="rd2-state-box">
              <div className="rd2-state-icon">✨</div>
              <div className="rd2-state-title">Noch keine Antworten generiert</div>
              <div className="rd2-state-desc">Klick auf „Antworten generieren", um passende Antwortmöglichkeiten zu erstellen.</div>
              <button onClick={() => generateReplies()} className="rd2-gen-btn">✨ Antworten generieren</button>
            </div>
          )}
          {aiLoading && (
            <div className="rd2-state-box">
              <div className="rd2-state-icon">⏳</div>
              <div className="rd2-state-title">Gleich fertig — ich denke mir was aus…</div>
            </div>
          )}
          {categoryQuestion && !aiLoading && (
            <div className="rd2-state-box" style={{borderLeft: '4px solid #6366f1', background: '#f5f3ff'}}>
              <div className="rd2-state-icon">💬</div>
              <div className="rd2-state-title" style={{color: '#3730a3'}}>Kurze Frage, einmalig</div>
              <div className="rd2-state-desc" style={{color: '#4338ca', marginBottom: '12px'}}>
                {categoryQuestion.question}
              </div>
              <textarea
                value={categoryAnswer}
                onChange={e => setCategoryAnswer(e.target.value)}
                placeholder="Deine Antwort..."
                rows={3}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                  borderRadius: '8px', border: '1px solid #a5b4fc', fontSize: '14px',
                  fontFamily: 'inherit', resize: 'vertical', marginBottom: '8px',
                  background: '#fff', color: '#1e1b4b',
                }}
              />
              <button
                onClick={saveCategoryAnswer}
                disabled={!categoryAnswer.trim() || categoryAnswerSaving}
                className="rd2-gen-btn"
                style={{background: '#6366f1', marginTop: '4px'}}
              >
                {categoryAnswerSaving ? 'Speichert...' : 'Antworten & Generieren'}
              </button>
              <button
                onClick={() => { setCategoryQuestion(null); generateReplies(true) }}
                className="rd2-gen-btn"
                style={{background: '#6b7280', marginTop: '4px'}}
              >
                Überspringen & trotzdem generieren
              </button>
            </div>
          )}
          {missingContext && !aiLoading && (
            <div className="rd2-state-box" style={{borderLeft: '4px solid #d97706', background: '#fffbeb'}}>
              <div className="rd2-state-icon">🤔</div>
              <div className="rd2-state-title" style={{color: '#92400e'}}>Kurz eine Frage, bevor ich antworte...</div>
              <div className="rd2-state-desc" style={{color: '#78350f'}}>
                Diese Bewertung enthält einen konkreten Vorwurf — und ich möchte keine Antwort erfinden, die vielleicht nicht stimmt. Was mir fehlt: <strong>{missingContext}</strong>
                <br/><br/>
                Wenn du das kurz in deinem Profil ergänzt, kann ich beim nächsten Mal direkt eine passende Antwort liefern. Oder du sagst mir: "Generier trotzdem" — dann mach ich das Beste draus.
              </div>
              <button
                onClick={() => { setMissingContext(null); onNavigateSettings() }}
                className="rd2-gen-btn"
                style={{background: '#d97706', marginTop: '8px'}}
              >
                → Profil ergänzen
              </button>
              <button
                onClick={() => { setMissingContext(null); generateReplies(true) }}
                className="rd2-gen-btn"
                style={{background: '#6b7280', marginTop: '4px'}}
              >
                Trotzdem generieren
              </button>
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
                    <span className="rd2-recovery-separator-label">Nur wenn wirklich etwas schiefgelaufen ist</span>
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

function Analytics({ reviews, userId }: { reviews: Review[], userId?: string }) {
  const [aiStarted, setAiStarted] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiDone, setAiDone] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [zeitraum, setZeitraum] = useState<'30' | '90' | 'all'>('30')
  const [positiveThemenAI, setPositiveThemenAI] = useState<string[]>([])
  const [negativThemenAI, setNegativThemenAI] = useState<string[]>([])
  const [empfehlungen, setEmpfehlungen] = useState<string[]>([])
  const [variantStats, setVariantStats] = useState<{label: string, index: string, count: number}[]>([])
  const [ratingBreakdown, setRatingBreakdown] = useState<Record<number, Record<string, number>>>({})

  // Themen-Karten automatisch laden wenn Bewertungen vorhanden
  useEffect(() => {
    if (reviews.length === 0) return
    const loadThemen = async () => {
      try {
        const response = await fetch('/api/analyze-reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reviews: reviews.map(r => ({ stars: r.stars, text: r.text })),
            language: 'Deutsch',
          }),
        })
        const data = await response.json()
        if (data.success) {
          setPositiveThemenAI(data.positiv || [])
          setNegativThemenAI(data.negativ || [])
        }
      } catch (e) { console.warn('Themen-Analyse fehlgeschlagen', e) }
    }
    loadThemen()
  }, [reviews])

  // Varianten-Daten aus Supabase laden
  useEffect(() => {
    const loadVariantStats = async () => {
      try {
        const { data } = await supabase
          .from('reviews')
          .select('selected_variant_index, stars')
          .eq('status', 'Beantwortet')
          .eq('user_id', userId)
          .not('selected_variant_index', 'is', null)
        if (!data) return
        const counts: Record<string, { label: string, index: string, count: number }> = {}
        const breakdown: Record<number, Record<string, number>> = {}
        data.forEach((row: any) => {
          const key = row.selected_variant_index
          if (!key) return
          // overall counts
          if (!counts[key]) counts[key] = { label: VARIANT_LABELS[key] || key, index: key, count: 0 }
          counts[key].count++
          // per-rating breakdown
          const stars = row.stars as number
          if (stars) {
            if (!breakdown[stars]) breakdown[stars] = {}
            breakdown[stars][key] = (breakdown[stars][key] || 0) + 1
          }
        })
        const order = ['1', '2', '3', 'recovery']
        const sorted = order.filter(k => counts[k]).map(k => counts[k])
        setVariantStats(sorted)
        setRatingBreakdown(breakdown)
      } catch (e) { console.warn('Variant stats failed', e) }
    }
    loadVariantStats()
  }, [reviews])

  const answered = reviews.filter(r => r.status === 'Beantwortet').length
  const pending = reviews.filter(r => r.status === 'Ausstehend').length
  const total = reviews.length
  const rate = total ? Math.round(answered / total * 100) : 0
  const avg = total ? (reviews.reduce((s, r) => s + r.stars, 0) / total).toFixed(1) : '–'

  const startAI = async () => {
    setAiStarted(true)
    setAiLoading(true)
    setAiDone(false)
    setAiError(null)

    // Bewertungen nach Zeitraum filtern
    const now = new Date()
    const filtered = reviews.filter(r => {
      if (zeitraum === 'all') return true
      const days = zeitraum === '30' ? 30 : 90
      const cutoff = new Date(now)
      cutoff.setDate(cutoff.getDate() - days)
      const rd = new Date(r.date)
      return rd >= cutoff
    })

    if (filtered.length === 0) {
      setAiError('Keine Bewertungen im gewählten Zeitraum.')
      setAiLoading(false)
      return
    }

    try {
      const response = await fetch('/api/analyze-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviews: filtered.map(r => ({ stars: r.stars, text: r.text })),
          language: 'Deutsch',
        }),
      })
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Unbekannter Fehler')
      setPositiveThemenAI(data.positiv || [])
      setNegativThemenAI(data.negativ || [])
      setEmpfehlungen(data.empfehlungen || [])
      setAiDone(true)
    } catch (e) {
      setAiError('Analyse fehlgeschlagen. Bitte nochmal versuchen.')
    } finally {
      setAiLoading(false)
    }
  }

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
  const displayPoints = trendPoints

  const statusSegments = [
    { value: answered, color: '#0f4c5c', label: 'Beantwortet' },
    { value: pending, color: '#fbbf24', label: 'Ausstehend' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '30px', fontWeight: '600', marginBottom: '4px', color: '#111827' }}>Insights</h1>
          <p style={{ color: '#6b7280', fontSize: '16px' }}>Auswertung & KI-Analyse Ihrer Bewertungen.</p>
        </div>
      </div>

      {/* 5 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Ø Bewertung', value: avg, sub: `${total} Bewertungen`, Icon: Star },
          { label: 'Beantwortet', value: answered, sub: `von ${total} gesamt`, Icon: CheckCircle },
          { label: 'Antwortquote', value: `${rate}%`, sub: rate >= 80 ? '🟢 Gut' : rate >= 50 ? '🟡 Mittel' : '🔴 Niedrig', Icon: Percent },
          { label: 'Ausstehend', value: pending, sub: 'noch offen', Icon: Clock },

        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>{s.label}</div>
              <s.Icon size={16} strokeWidth={1.8} color="#0f4c5c" />
            </div>
            <div style={{ fontSize: '26px', fontWeight: '600', color: '#111827', marginBottom: '3px' }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Rating-Aufschlüsselung */}
      {Object.keys(ratingBreakdown).length > 0 && (() => {
        const variantColors: Record<string, string> = { '1': '#0f4c5c', '2': '#155e75', '3': '#1e7a8c', 'recovery': '#0e7490' }
        const order = ['1', '2', '3', 'recovery']
        const presentVariants = order.filter(k => variantStats.some(v => v.index === k))
        const starRows = [5,4,3,2,1].filter(s => ratingBreakdown[s])
        return (
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: '600', fontSize: '15px', color: '#111827' }}>Welche Variante bei welchem Rating?</div>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Aufschlüsselung nach Sternzahl</div>
            </div>
            <div style={{ padding: '0 18px 16px' }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '60px ' + presentVariants.map(() => '1fr').join(' '), gap: '8px', padding: '10px 0 6px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}></div>
                {presentVariants.map(k => (
                  <div key={k} style={{ fontSize: '11px', fontWeight: '600', color: variantColors[k], textAlign: 'center' }}>
                    {VARIANT_LABELS[k]?.split(' & ')[0] || k}
                  </div>
                ))}
              </div>
              {/* Rows */}
              {starRows.map(stars => {
                const row = ratingBreakdown[stars]
                const rowTotal = Object.values(row).reduce((s, n) => s + n, 0)
                return (
                  <div key={stars} style={{ display: 'grid', gridTemplateColumns: '60px ' + presentVariants.map(() => '1fr').join(' '), gap: '8px', padding: '8px 0', borderBottom: '1px solid #f9fafb', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', color: '#374151', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <span style={{ fontWeight: '600' }}>{stars}</span>
                      <span style={{ color: '#fbbf24', fontSize: '12px' }}>★</span>
                    </div>
                    {presentVariants.map(k => {
                      const count = row[k] || 0
                      const pct = rowTotal ? Math.round(count / rowTotal * 100) : 0
                      const isMax = count > 0 && count === Math.max(...presentVariants.map(v => row[v] || 0))
                      return (
                        <div key={k} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '13px', fontWeight: isMax ? '700' : '400', color: isMax ? variantColors[k] : '#9ca3af' }}>
                            {count > 0 ? `${pct}%` : '—'}
                          </div>
                          {count > 0 && <div style={{ fontSize: '10px', color: '#d1d5db' }}>{count}×</div>}
                        </div>
                      )
                    })}
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
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
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
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
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
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ fontWeight: '600', fontSize: '14px', color: '#111827', marginBottom: '12px' }}>Antwortstatus</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <DonutChart segments={statusSegments} size={100} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              {statusSegments.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '11px', color: '#374151', flex: 1 }}>{s.label}</span>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Positive & Negative Themen */}
      <div className="grid2i" style={{ marginBottom: '16px' }}>
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '15px', color: '#111827' }}>👍 Häufig positiv erwähnt</div>
          <div style={{ padding: '14px 18px' }}>
            {positiveThemenAI.length === 0
              ? <div style={{ fontSize: '14px', color: '#9ca3af', padding: '8px 0' }}>Noch keine Daten — KI-Analyse starten um Themen zu sehen.</div>
              : positiveThemenAI.map((t, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: '14px', color: '#374151' }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '15px', color: '#111827' }}>👎 Häufig negativ erwähnt</div>
          <div style={{ padding: '14px 18px' }}>
            {negativThemenAI.length === 0
              ? <div style={{ fontSize: '14px', color: '#9ca3af', padding: '8px 0' }}>Noch keine Daten — KI-Analyse starten um Themen zu sehen.</div>
              : negativThemenAI.map((t, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: '14px', color: '#374151' }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>



      {/* Sternverteilung + Bewertungstrend */}
      <div className="grid2i" style={{ marginBottom: '20px' }}>
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '15px', color: '#111827' }}>Sternverteilung</div>
          <div style={{ padding: '16px 18px' }}>
            {[5,4,3,2,1].map(stars => {
              const count = reviews.filter(r => r.stars === stars).length
              const pct = total ? Math.round(count / total * 100) : 0
              return (
                <div key={stars} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ width: '36px', fontSize: '13px', color: '#6b7280', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px' }}>
                    <span>{stars}</span><span style={{ color: '#fbbf24' }}>★</span>
                  </div>
                  <div style={{ flex: 1, height: '10px', background: '#f7f5f2', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: '#fbbf24', borderRadius: '5px' }} />
                  </div>
                  <div style={{ width: '24px', fontSize: '13px', color: '#374151', textAlign: 'right', flexShrink: 0 }}>{count}</div>
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '15px', color: '#111827' }}>Bewertungstrend (6 Monate)</div>
          <div style={{ padding: '16px 18px' }}>
            {(() => {
              const months: { m: string, count: number }[] = []
              for (let i = 5; i >= 0; i--) {
                const d = new Date()
                d.setDate(1)
                d.setMonth(d.getMonth() - i)
                const label = d.toLocaleDateString('de-DE', { month: 'short' })
                const y = d.getFullYear(), mo = d.getMonth()
                const count = reviews.filter(r => {
                  const rd = new Date(r.date)
                  return rd.getFullYear() === y && rd.getMonth() === mo
                }).length
                months.push({ m: label, count })
              }
              const maxVal = Math.max(...months.map(m => m.count), 1)
              return (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px' }}>
                  {months.map(d => (
                    <div key={d.m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '2px' }}>{d.count > 0 ? d.count : ''}</div>
                      <div style={{ width: '100%', background: '#0f4c5c', borderRadius: '4px 4px 0 0', height: `${Math.max((d.count / maxVal) * 88, d.count > 0 ? 4 : 0)}px`, opacity: 0.85 }} />
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>{d.m}</div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {/* KI Analyse Box */}
      <div style={{ background: '#fff', borderRadius: '12px', border: aiDone ? '1px solid #86efac' : '1px dashed #d1d5db', boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        {!aiStarted && (
          <div style={{ padding: '40px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>✨</div>
            <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '6px', color: '#111827' }}>KI-Analyse noch nicht gestartet</div>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px', maxWidth: '420px', margin: '0 auto 24px' }}>Zeitraum wählen und Analyse starten — Gemini wertet alle Bewertungen aus und liefert konkrete Handlungsempfehlungen.</div>
            <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', background: '#f7f5f2', border: '1px solid #e2ddd8', borderRadius: '10px', padding: '6px 6px 6px 12px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap' }}>Zeitraum:</span>
              <select
                value={zeitraum}
                onChange={e => setZeitraum(e.target.value as '30' | '90' | 'all')}
                style={{ padding: '7px 10px', border: '1px solid #e2ddd8', borderRadius: '7px', fontSize: '14px', fontFamily: 'inherit', background: '#fff', color: '#111827', cursor: 'pointer' }}
              >
                <option value="30">Letzte 30 Tage</option>
                <option value="90">Letzte 90 Tage</option>
                <option value="all">Alle Bewertungen</option>
              </select>
              <button onClick={startAI} disabled={aiLoading} style={{ padding: '8px 16px', background: '#0f4c5c', color: '#fff', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit', fontWeight: '500', whiteSpace: 'nowrap' }}>
                ✨ Analyse starten
              </button>
            </div>
          </div>
        )}
        {aiLoading && (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
            <div style={{ fontWeight: '600', fontSize: '16px', color: '#111827' }}>KI analysiert Ihre Bewertungen...</div>
            <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>Das dauert meist 5–10 Sekunden.</div>
          </div>
        )}
        {aiError && !aiLoading && (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', color: '#991b1b' }}>⚠️ {aiError}</div>
          </div>
        )}
        {aiDone && !aiLoading && (
          <div>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #e5e7eb', fontWeight: '600', fontSize: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <span>✨ KI-Analyse Ergebnis</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  value={zeitraum}
                  onChange={e => setZeitraum(e.target.value as '30' | '90' | 'all')}
                  style={{ padding: '6px 10px', border: '1px solid #e2ddd8', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', background: '#fff', color: '#111827', cursor: 'pointer' }}
                >
                  <option value="30">Letzte 30 Tage</option>
                  <option value="90">Letzte 90 Tage</option>
                  <option value="all">Alle Bewertungen</option>
                </select>
                <button onClick={startAI} disabled={aiLoading} style={{ padding: '6px 14px', background: '#0f4c5c', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', fontWeight: '500' }}>
                  {aiLoading ? '⏳' : '↺ Neu starten'}
                </button>
              </div>
            </div>
            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {empfehlungen.length > 0 && (
                <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#92400e', marginBottom: '10px' }}>💡 HANDLUNGSEMPFEHLUNGEN</div>
                  {empfehlungen.map((e, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: i < empfehlungen.length - 1 ? '10px' : '0' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#92400e', flexShrink: 0 }}>{i + 1}.</span>
                      <span style={{ fontSize: '14px', color: '#78350f', lineHeight: '1.6' }}>{e}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


// ─── EINSTELLUNGEN ────────────────────────────────────────────────────────────

function Settings({ onLogout, userId, engine, onEngineChange }: { onLogout: () => void, userId?: string, engine: 'v2' | 'v1' | 'v3' | 'v4' | 'v5', onEngineChange: (e: 'v2' | 'v1' | 'v3' | 'v4' | 'v5') => void }) {
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
          .eq('user_id', userId)
          .single()
        if (data?.value) {
          const merged = merge(data.value, form)
          setForm(merged)
          localStorage.setItem('rezpondSettings', JSON.stringify(merged))
        } else {
          const local = localStorage.getItem('rezpondSettings')
          if (local) setForm(prev => merge(JSON.parse(local), prev))
        }
      } catch {
        const local = localStorage.getItem('rezpondSettings')
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
      localStorage.setItem('rezpondSettings', JSON.stringify(form))
      try {
        await supabase.from('settings').upsert(
          { key: 'restaurant_profile', user_id: userId, value: form, updated_at: new Date().toISOString() },
          { onConflict: 'key,user_id' }
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

  const update = (k: string, v: any) => {
    setForm(p => {
      const next = { ...p, [k]: v }
      localStorage.setItem('rezpondSettings', JSON.stringify(next))
      return next
    })
  }
  const save = async () => {
    setSaving(true)
    localStorage.setItem('rezpondSettings', JSON.stringify(form))
    try {
      await supabase.from('settings').upsert(
        { key: 'restaurant_profile', user_id: userId, value: form, updated_at: new Date().toISOString() },
        { onConflict: 'key,user_id' }
      )
    } catch (e) { console.warn('Supabase save failed', e) }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', marginTop: '4px', boxSizing: 'border-box', background: '#f9fafb', fontFamily: 'inherit' }
  const lbl: React.CSSProperties = { fontSize: '13px', fontWeight: '500', display: 'block', color: '#374151' }
  const card: React.CSSProperties = { background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }
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
        <div>
          <label style={lbl}>Hausregeln & Profil</label>
          <textarea
            style={{ ...inp, height: '180px', resize: 'vertical' }}
            placeholder="Klicke auf 'Vorlage einfügen' um loszulegen…"
            value={form.description}
            onChange={e => update('description', e.target.value)}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
            <div style={hint}>Die KI nutzt diese Infos bei jeder Antwort.</div>
            {!form.description && (
              <button
                type="button"
                onClick={() => update('description', "HAUSREGELN:\nWas Gäste manchmal kritisieren — erkläre kurz warum.\n- z.B. Reservierungen nur telefonisch, keine Online-Buchung\n- z.B. Wartezeiten am Wochenende sind normal, kein Fast-Food-Betrieb\n\nBESONDERHEITEN:\nWas uns auszeichnet — für positive Antworten nutzbar.\n- z.B. Frische Zutaten vom Wochenmarkt\n- z.B. Hausgemachte Desserts, täglich neu\n\nNICHT SAGEN:\nBetriebsspezifische Verbote.\n- z.B. Nie versprechen, dass Wartezeiten kürzer werden\n- z.B. Nie den Gast um eine neue Bewertung bitten")}
                style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', color: '#374151', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
              >
                📋 Vorlage einfügen
              </button>
            )}
          </div>
        </div>
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
          📧 Sobald eine neue Bewertung synchronisiert wird, erhältst du automatisch eine E-Mail mit 3 fertigen KI-Antworten.
        </div>
        <label style={lbl}>Benachrichtigungs-E-Mail</label>
        <input style={inp} type="email" placeholder="z. B. inhaber@meinrestaurant.de" value={form.notificationEmail} onChange={e => update('notificationEmail', e.target.value)} />
        {form.notificationEmail
          ? <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#166534', marginTop: '10px' }}>
              ✅ Benachrichtigungen werden an diese Adresse gesendet.
            </div>
          : <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#6b7280', marginTop: '10px' }}>
              Bitte E-Mail-Adresse eintragen um Benachrichtigungen zu erhalten.
            </div>
        }
      </div></div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', paddingBottom: '16px' }}>
        {saved && <span style={{ color: '#22c55e', fontSize: '14px', fontWeight: '500', transition: 'opacity 0.3s' }}>✅ Automatisch gespeichert</span>}
        {saving && !saved && <span style={{ color: '#9ca3af', fontSize: '14px' }}>💾 Speichert...</span>}
        <button onClick={save} style={{ padding: '10px 28px', background: '#0f4c5c', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontFamily: 'inherit', fontWeight: '500' }}>Profil speichern</button>
      </div>

      {/* Account / Abmelden */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '40px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
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

      {/* Engine Toggle — nur für Admin sichtbar */}
      {(userId === '6ae1a7a5-72c9-4b75-88d5-042a703b5b54' || userId === '81df2fe7-aab5-4527-b512-fa58eb9ee55f') && (
        <div style={{ background: '#f9fafb', borderRadius: '12px', border: '1px dashed #d1d5db', marginBottom: '40px', padding: '16px 18px' }}>
          <div style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600', letterSpacing: '0.05em', marginBottom: '10px' }}>🧪 ENGINE TEST</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {([
              { key: 'v5', label: 'v5 (aktiv)' },
              { key: 'v4', label: 'v4' },
              { key: 'v2', label: 'v2' },
              { key: 'v1', label: 'v1 (alt)' },
              { key: 'v3', label: 'v3' },
            ] as { key: 'v2' | 'v1' | 'v3' | 'v4' | 'v5', label: string }[]).map(opt => (
              <button
                key={opt.key}
                onClick={() => onEngineChange(opt.key)}
                style={{
                  padding: '8px 16px',
                  background: engine === opt.key ? '#0f4c5c' : '#e5e7eb',
                  color: engine === opt.key ? '#fff' : '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  fontWeight: '500',
                }}>
                {opt.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '10px' }}>
            Aktiv: <strong style={{ color: '#0f4c5c' }}>
              {engine === 'v1' ? 'generate-replies (alt)' : engine === 'v3' ? 'generate-replies-v3' : engine === 'v4' ? 'generate-replies-v4' : engine === 'v5' ? 'generate-replies-v5 (aktiv)' : 'generate-replies-v2'}
            </strong>
          </div>
        </div>
      )}
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
      minHeight: '100vh',
      background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(15,76,92,0.35) 0%, transparent 70%), #0b1523',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        .wlc-btn-primary { transition: all 0.18s !important; }
        .wlc-btn-primary:hover { background: #155e75 !important; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(15,76,92,0.4) !important; }
        .wlc-btn-secondary { transition: all 0.18s !important; }
        .wlc-btn-secondary:hover { background: rgba(255,255,255,0.1) !important; border-color: rgba(255,255,255,0.4) !important; }
        .wlc-feature:hover { background: rgba(15,76,92,0.25) !important; border-color: rgba(30,122,140,0.5) !important; }
      `}</style>

      <div style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>

        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
          <div style={{
            width: 68, height: 68, borderRadius: '20px',
            background: 'linear-gradient(135deg, #0f4c5c, #1e7a8c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 1px rgba(30,122,140,0.4), 0 8px 32px rgba(15,76,92,0.5)',
          }}>
            <span style={{ fontSize: '32px' }}>⭐</span>
          </div>
        </div>

        {/* Titel */}
        <div style={{ fontSize: '34px', fontWeight: '700', color: '#ffffff', marginBottom: '8px', lineHeight: '1.15', letterSpacing: '-0.5px' }}>
          Rezpond
        </div>
        <div style={{ fontSize: '15px', color: '#7da8b8', marginBottom: '40px', lineHeight: '1.6', fontWeight: '400' }}>
          KI-Antworten auf Google-Bewertungen —<br />schnell, persönlich, in deinem Stil.
        </div>

        {/* Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '40px', textAlign: 'left' }}>
          {[
            { icon: '✨', text: '3 KI-Antworten pro Bewertung', sub: 'Verschiedene Tonalitäten, direkt anpassbar' },
            { icon: '🎯', text: 'Recovery bei 1–2 Sternen', sub: 'Eigene Strategie für negative Bewertungen' },
            { icon: '📊', text: 'Auswertung & Trends', sub: 'Sieh auf einen Blick was Gäste sagen' },
          ].map(f => (
            <div key={f.text} className="wlc-feature" style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              background: 'rgba(15,76,92,0.15)', borderRadius: '12px',
              padding: '13px 16px',
              border: '1px solid rgba(30,122,140,0.25)',
              cursor: 'default', transition: 'all 0.18s',
            }}>
              <span style={{ fontSize: '22px', flexShrink: 0, width: 28, textAlign: 'center' }}>{f.icon}</span>
              <div>
                <div style={{ fontSize: '14px', color: '#e2e8f0', fontWeight: '600', marginBottom: '2px' }}>{f.text}</div>
                <div style={{ fontSize: '12px', color: '#64899a', fontWeight: '400' }}>{f.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={onRegister}
            className="wlc-btn-primary"
            style={{
              width: '100%', padding: '15px', borderRadius: '12px', border: 'none',
              background: '#0f4c5c', color: '#fff', fontSize: '15px',
              fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 16px rgba(15,76,92,0.35)',
            }}
          >
            Kostenlos starten →
          </button>
          <button
            onClick={onLogin}
            className="wlc-btn-secondary"
            style={{
              width: '100%', padding: '13px', borderRadius: '12px',
              border: '1.5px solid rgba(255,255,255,0.15)',
              background: 'transparent', color: '#94a3b8',
              fontSize: '14px', fontWeight: '500', cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Bereits registriert? Anmelden
          </button>
        </div>

        <div style={{ marginTop: '24px', fontSize: '12px', color: '#3d5a66' }}>
          Keine Kreditkarte erforderlich
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
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)

  const handleForgot = async () => {
    if (!forgotEmail.includes('@')) return
    setForgotLoading(true)
    await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: window.location.origin,
    })
    setForgotLoading(false)
    setForgotSuccess(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setAlreadyRegistered(false)
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message === 'Invalid login credentials'
        ? 'E-Mail oder Passwort ist falsch.'
        : error.message)
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        if (error.message === 'User already registered') {
          setAlreadyRegistered(true)
        } else {
          setError(error.message)
        }
      } else if (data.user?.identities && data.user.identities.length === 0) {
        // Supabase gibt bei bereits registrierter E-Mail einen User zurück,
        // aber ohne Identities — das ist das zuverlässigste Erkennungsmerkmal
        setAlreadyRegistered(true)
      } else if (data.user) {
        setSuccess('Fast geschafft! Wir haben dir einen Bestätigungslink geschickt — bitte schau in dein Postfach.')
      } else {
        setAlreadyRegistered(true)
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
            <div style={{ width: 48, height: 48, borderRadius: '14px', background: 'linear-gradient(135deg, #0f4c5c, #155e75)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(15,76,92,0.3)' }}>
              <span style={{ fontSize: '22px' }}>⭐</span>
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>Rezpond</div>
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

          {/* Google Hinweis */}
          <div style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', marginTop: '-12px', marginBottom: '20px', lineHeight: '1.5' }}>
            Bitte melde dich mit dem Google-Account an,<br />mit dem dein Unternehmen bei Google verwaltet wird.
          </div>

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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>Passwort</label>
                {mode === 'login' && (
                  <button type="button" onClick={() => { setShowForgot(true); setForgotEmail(email); setForgotSuccess(false) }}
                    style={{ background: 'none', border: 'none', color: '#0f4c5c', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                    Passwort vergessen?
                  </button>
                )}
              </div>
              <input className="auth-inp" style={inp} type="password" required autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                placeholder={mode === 'register' ? 'Mindestens 6 Zeichen' : '••••••••'} value={password} onChange={e => setPassword(e.target.value)} />
            </div>

            {alreadyRegistered && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#dc2626', marginBottom: '16px' }}>
                ⚠️ Diese E-Mail ist bereits registriert.{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(''); setSuccess(''); setAlreadyRegistered(false) }}
                  style={{ background: 'none', border: 'none', color: '#0f4c5c', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', padding: 0, textDecoration: 'underline' }}
                >
                  Jetzt anmelden →
                </button>
              </div>
            )}
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

      {/* Passwort vergessen Overlay */}
      {showForgot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '380px', padding: '32px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            {forgotSuccess ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>📬</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>E-Mail verschickt!</div>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px', lineHeight: '1.6' }}>
                  Schau in dein Postfach — der Reset-Link ist unterwegs.
                </div>
                <button onClick={() => setShowForgot(false)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: '#0f4c5c', color: '#fff', fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Zurück zum Login
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#111827', marginBottom: '6px' }}>Passwort zurücksetzen</div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px', lineHeight: '1.5' }}>
                  Gib deine E-Mail ein — wir schicken dir einen Link zum Zurücksetzen.
                </div>
                <input
                  type="email" placeholder="name@restaurant.de"
                  value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleForgot()}
                  style={{ ...inp, marginBottom: '16px' }}
                  autoFocus
                />
                <button onClick={handleForgot} disabled={forgotLoading || !forgotEmail.includes('@')}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: forgotLoading || !forgotEmail.includes('@') ? '#e5e7eb' : '#0f4c5c', color: forgotLoading || !forgotEmail.includes('@') ? '#9ca3af' : '#fff', fontSize: '15px', fontWeight: '600', cursor: forgotLoading || !forgotEmail.includes('@') ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
                  {forgotLoading && <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'ob-spin 0.7s linear infinite' }} />}
                  Reset-Link senden
                </button>
                <button onClick={() => setShowForgot(false)}
                  style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1.5px solid #e5e7eb', background: 'transparent', color: '#6b7280', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Abbrechen
                </button>
              </>
            )}
          </div>
        </div>
      )}
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
        .ob-chip:hover { border-color: #7ab8c4 !important; background: #f0f7f8 !important; }
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
                <div style={{ width: 56, height: 56, borderRadius: '16px', background: 'linear-gradient(135deg, #0f4c5c, #155e75)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(15,76,92,0.35)' }}>
                  <span style={{ fontSize: '28px' }}>⭐</span>
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: '700', color: '#111827', marginBottom: '10px', lineHeight: '1.3' }}>
                Willkommen bei<br />Rezpond
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
// deploy trigger
