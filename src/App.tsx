import { useState, useEffect } from 'react'

function App() {
  const [page, setPage] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)

  const navItems = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'reviews', label: '💬 Bewertungen' },
    { id: 'analytics', label: '📈 Analyse' },
    { id: 'settings', label: '⚙️ Einstellungen' },
  ]

  const navigate = (id: string) => {
    setPage(id)
    setMenuOpen(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>

      {/* Top Navigation Bar */}
      <div style={{ background: '#1e1e2e', color: '#fff', padding: '0 16px', display: 'flex', alignItems: 'center', height: '56px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontWeight: '600', fontSize: '16px', flex: 1 }}>🏪 ReviewMonitor</div>
        
        {/* Desktop Nav */}
        <nav style={{ display: 'flex', gap: '4px' }} className="desktop-nav">
          {navItems.map(item => (
            <div
              key={item.id}
              onClick={() => navigate(item.id)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                background: page === item.id ? '#4f46e5' : 'transparent',
                color: page === item.id ? '#fff' : '#aaa',
              }}
            >
              {item.label}
            </div>
          ))}
        </nav>

        {/* Mobile Hamburger */}
        <div
          onClick={() => setMenuOpen(!menuOpen)}
          className="mobile-menu-btn"
          style={{ cursor: 'pointer', fontSize: '22px', display: 'none' }}
        >
          {menuOpen ? '✕' : '☰'}
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {menuOpen && (
        <div style={{ background: '#1e1e2e', padding: '8px', position: 'sticky', top: '56px', zIndex: 99 }} className="mobile-menu">
          {navItems.map(item => (
            <div
              key={item.id}
              onClick={() => navigate(item.id)}
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                background: page === item.id ? '#4f46e5' : 'transparent',
                color: page === item.id ? '#fff' : '#aaa',
                marginBottom: '4px',
              }}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div style={{ padding: '24px 16px', maxWidth: '800px', margin: '0 auto' }}>
        {page === 'dashboard' && <Dashboard />}
        {page === 'reviews' && <Reviews />}
        {page === 'analytics' && <Analytics />}
        {page === 'settings' && <Settings />}
      </div>
    </div>
  )
}

function Dashboard() {
  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: '600', marginBottom: '4px' }}>Dashboard</h1>
      <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>Übersicht Ihrer Google-Unternehmensbewertungen.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Bewertungen gesamt', value: '24', color: '#4f46e5' },
          { label: 'Ø Bewertung', value: '4.2 ★', color: '#eab308' },
          { label: 'Ausstehend', value: '7', color: '#f59e0b' },
          { label: 'Beantwortet', value: '17', color: '#22c55e' },
        ].map(stat => (
          <div key={stat.label} style={{ background: '#fff', borderRadius: '10px', padding: '16px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>{stat.label}</div>
            <div style={{ fontSize: '22px', fontWeight: '600', color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: '10px', padding: '16px', border: '1px solid #e5e7eb' }}>
        <h2 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '14px' }}>Aktuelle Bewertungen</h2>
        {[
          { name: 'Maria Klein', stars: '★★★★★', text: 'Fantastisches Restaurant! Das Essen war außergewöhnlich.', status: 'Ausstehend' },
          { name: 'Thomas Müller', stars: '★★★★☆', text: 'Sehr gutes Essen, aber die Wartezeit war etwas lang.', status: 'Beantwortet' },
          { name: 'Anna Weber', stars: '★★★☆☆', text: 'Mittelmäßig. Der Service könnte freundlicher sein.', status: 'Ausstehend' },
        ].map(review => (
          <div key={review.name} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px', flexWrap: 'wrap', gap: '6px' }}>
              <strong style={{ fontSize: '14px' }}>{review.name}</strong>
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: review.status === 'Ausstehend' ? '#fef3c7' : '#dcfce7', color: review.status === 'Ausstehend' ? '#92400e' : '#166534' }}>{review.status}</span>
            </div>
            <div style={{ color: '#eab308', marginBottom: '4px', fontSize: '13px' }}>{review.stars}</div>
            <div style={{ fontSize: '13px', color: '#666' }}>{review.text}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Reviews() {
  const [openAI, setOpenAI] = useState<number | null>(null)
  const [selected, setSelected] = useState<{[key: number]: number}>({})

  const reviews = [
    { id: 1, name: 'Maria Klein', stars: '★★★★★', text: 'Fantastisches Restaurant! Das Essen war außergewöhnlich.', status: 'Ausstehend' },
    { id: 2, name: 'Thomas Müller', stars: '★★★★☆', text: 'Sehr gutes Essen, aber die Wartezeit war etwas lang.', status: 'Beantwortet' },
    { id: 3, name: 'Anna Weber', stars: '★★★☆☆', text: 'Mittelmäßig. Der Service könnte freundlicher sein.', status: 'Ausstehend' },
  ]

  const aiAntworten = [
    'Vielen herzlichen Dank für Ihre tolle Bewertung! Es freut uns sehr, dass Sie bei uns eine schöne Zeit hatten. Wir freuen uns auf Ihren nächsten Besuch!',
    'Danke für Ihr wertvolles Feedback! Ihr Lob motiviert unser gesamtes Team. Wir heißen Sie jederzeit wieder willkommen!',
    'Liebe Gäste, wir danken Ihnen für diese begeisterte Rückmeldung! Es ist unser Ziel, jedem Gast ein unvergessliches Erlebnis zu bieten.',
  ]

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: '600', marginBottom: '4px' }}>Bewertungen</h1>
      <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>Verwalten und beantworten Sie alle Kundenbewertungen.</p>

      {reviews.map(review => (
        <div key={review.id} style={{ background: '#fff', borderRadius: '10px', padding: '16px', border: '1px solid #e5e7eb', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
            <strong style={{ fontSize: '14px' }}>{review.name}</strong>
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: review.status === 'Ausstehend' ? '#fef3c7' : '#dcfce7', color: review.status === 'Ausstehend' ? '#92400e' : '#166534' }}>{review.status}</span>
          </div>
          <div style={{ color: '#eab308', marginBottom: '6px', fontSize: '13px' }}>{review.stars}</div>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>{review.text}</div>

          <button
            onClick={() => setOpenAI(openAI === review.id ? null : review.id)}
            style={{ padding: '8px 16px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', width: '100%' }}
          >
            ✨ Antworten generieren
          </button>

          {openAI === review.id && (
            <div style={{ marginTop: '12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#166534', marginBottom: '8px' }}>3 KI-Antwortvorschläge – bitte auswählen:</div>
              {aiAntworten.map((antwort, i) => (
                <div
                  key={i}
                  onClick={() => setSelected({...selected, [review.id]: i})}
                  style={{ padding: '10px', borderRadius: '6px', border: `1px solid ${selected[review.id] === i ? '#4f46e5' : '#e5e7eb'}`, background: selected[review.id] === i ? '#eef2ff' : '#fff', cursor: 'pointer', marginBottom: '6px', fontSize: '13px', lineHeight: '1.5' }}
                >
                  {antwort}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function Analytics() {
  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: '600', marginBottom: '4px' }}>Analyse</h1>
      <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>Statistiken & KI-Auswertung Ihrer Bewertungen.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
        {[
          { label: 'Ø Bewertung', value: '4.2', color: '#22c55e' },
          { label: 'Gesamt', value: '24', color: '#111827' },
          { label: 'Antwortrate', value: '71%', color: '#22c55e' },
          { label: 'Ausstehend', value: '7', color: '#f59e0b' },
        ].map(stat => (
          <div key={stat.label} style={{ background: '#fff', borderRadius: '10px', padding: '16px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>{stat.label}</div>
            <div style={{ fontSize: '22px', fontWeight: '600', color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: '#4f46e5', marginBottom: '6px' }}>WICHTIGSTE ERKENNTNIS</div>
        <div style={{ fontSize: '14px' }}>Ihre Gäste loben besonders das Essen und die Atmosphäre. Häufigster Kritikpunkt ist die Wartezeit.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontWeight: '600', color: '#166534', marginBottom: '10px', fontSize: '14px' }}>👍 Was Gäste loben</div>
          <div style={{ fontSize: '13px', color: '#166534', lineHeight: '1.8' }}>• Essen & Qualität (14×)<br />• Atmosphäre (8×)<br />• Freundlicher Service (6×)</div>
        </div>
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontWeight: '600', color: '#991b1b', marginBottom: '10px', fontSize: '14px' }}>👎 Verbesserungspotenzial</div>
          <div style={{ fontSize: '13px', color: '#991b1b', lineHeight: '1.8' }}>• Wartezeit (5×)<br />• Lautstärke (2×)</div>
        </div>
      </div>
    </div>
  )
}

function Settings() {
  const [form, setForm] = useState({
    businessName: '',
    description: '',
    restaurantType: '',
    cuisineType: '',
    priceRange: '',
    seatingCapacity: '',
    foundedYear: '',
    targetAudience: '',
    phone: '',
    website: '',
    address: '',
    city: '',
    signatureDishes: '',
    dietaryOptions: '',
    openingHours: '',
    hasReservation: false,
    hasDelivery: false,
    hasTakeaway: false,
    hasParking: false,
    isWheelchairAccessible: false,
    uniqueSellingPoints: '',
    brandValues: '',
    preferredPhrases: '',
    avoidPhrases: '',
    responseSignature: '',
    responseLanguage: 'Deutsch',
    responseStyle: 'professional',
    autoGenerate: false,
    googleAccountId: '',
    googleLocationId: '',
    notificationEmail: '',
  })

  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const savedData = localStorage.getItem('reviewManagerSettings')
    if (savedData) setForm(JSON.parse(savedData))
  }, [])

  const update = (key: string, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const save = () => {
    localStorage.setItem('reviewManagerSettings', JSON.stringify(form))
    setSaved(true)
  }

  const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', marginTop: '4px', boxSizing: 'border-box' as const }
  const labelStyle = { fontSize: '13px', fontWeight: '500' as const, display: 'block' as const }
  const cardStyle = { background: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', marginBottom: '16px', overflow: 'hidden' as const }
  const cardHeaderStyle = { padding: '14px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: '600' as const, fontSize: '14px' }
  const cardBodyStyle = { padding: '16px' }

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: '600', marginBottom: '4px' }}>Restaurantprofil</h1>
      <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>Alle Informationen fließen direkt in die KI-Antwortgenerierung ein.</p>

      <div style={cardStyle}>
        <div style={cardHeaderStyle}>🏢 Basisinformationen</div>
        <div style={cardBodyStyle}>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Restaurantname *</label>
            <input style={inputStyle} placeholder="z. B. Trattoria Bella Italia" value={form.businessName} onChange={e => update('businessName', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Beschreibung</label>
            <textarea style={{ ...inputStyle, height: '80px', resize: 'none' }} placeholder="Beschreiben Sie Ihr Restaurant kurz..." value={form.description} onChange={e => update('description', e.target.value)} />
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={cardHeaderStyle}>🍽️ Restaurant-Identität</div>
        <div style={cardBodyStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Restaurant-Typ</label>
              <select style={inputStyle} value={form.restaurantType} onChange={e => update('restaurantType', e.target.value)}>
                <option value="">Typ auswählen</option>
                <option value="restaurant">Restaurant</option>
                <option value="cafe">Café</option>
                <option value="bistro">Bistro</option>
                <option value="bar">Bar / Weinbar</option>
                <option value="foodtruck">Foodtruck</option>
                <option value="imbiss">Imbiss / Schnellimbiss</option>
                <option value="baeckerei">Bäckerei / Konditorei</option>
                <option value="hotel-restaurant">Hotelrestaurant</option>
                <option value="catering">Catering</option>
                <option value="sonstiges">Sonstiges</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Küche</label>
              <input style={inputStyle} placeholder="z. B. Italienisch..." value={form.cuisineType} onChange={e => update('cuisineType', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Preisklasse</label>
              <select style={inputStyle} value={form.priceRange} onChange={e => update('priceRange', e.target.value)}>
                <option value="">Auswählen</option>
                <option value="€">€ — Günstig</option>
                <option value="€€">€€ — Mittel</option>
                <option value="€€€">€€€ — Gehoben</option>
                <option value="€€€€">€€€€ — Fine Dining</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Sitzplätze</label>
              <input style={inputStyle} placeholder="z. B. 60 innen" value={form.seatingCapacity} onChange={e => update('seatingCapacity', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Gründungsjahr</label>
              <input style={inputStyle} placeholder="z. B. 1998" value={form.foundedYear} onChange={e => update('foundedYear', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Zielgruppe</label>
              <input style={inputStyle} placeholder="z. B. Familien..." value={form.targetAudience} onChange={e => update('targetAudience', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={cardHeaderStyle}>📍 Kontakt & Standort</div>
        <div style={cardBodyStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={labelStyle}>Straße & Hausnummer</label><input style={inputStyle} placeholder="z. B. Hauptstraße 12" value={form.address} onChange={e => update('address', e.target.value)} /></div>
            <div><label style={labelStyle}>PLZ & Stadt</label><input style={inputStyle} placeholder="z. B. 80331 München" value={form.city} onChange={e => update('city', e.target.value)} /></div>
            <div><label style={labelStyle}>Telefon</label><input style={inputStyle} placeholder="z. B. +49 89 123456" value={form.phone} onChange={e => update('phone', e.target.value)} /></div>
            <div><label style={labelStyle}>Website</label><input style={inputStyle} placeholder="z. B. https://..." value={form.website} onChange={e => update('website', e.target.value)} /></div>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={cardHeaderStyle}>⭐ Speisekarte & Angebot</div>
        <div style={cardBodyStyle}>
          <div style={{ marginBottom: '12px' }}><label style={labelStyle}>Signature-Gerichte</label><textarea style={{ ...inputStyle, height: '60px', resize: 'none' }} placeholder="z. B. Pizza Margherita..." value={form.signatureDishes} onChange={e => update('signatureDishes', e.target.value)} /></div>
          <div style={{ marginBottom: '12px' }}><label style={labelStyle}>Ernährungsoptionen</label><input style={inputStyle} placeholder="z. B. Vegetarisch, Vegan..." value={form.dietaryOptions} onChange={e => update('dietaryOptions', e.target.value)} /></div>
          <div style={{ marginBottom: '14px' }}><label style={labelStyle}>Öffnungszeiten</label><textarea style={{ ...inputStyle, height: '70px', resize: 'none' }} placeholder="Mo–Fr: 11:30–23:00" value={form.openingHours} onChange={e => update('openingHours', e.target.value)} /></div>
          <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '10px' }}>Service-Optionen</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { key: 'hasReservation', label: 'Tischreservierung' },
              { key: 'hasDelivery', label: 'Lieferservice' },
              { key: 'hasTakeaway', label: 'Zum Mitnehmen' },
              { key: 'hasParking', label: 'Parkplätze' },
              { key: 'isWheelchairAccessible', label: 'Rollstuhlgerecht' },
            ].map(item => (
              <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                <span style={{ fontSize: '13px' }}>{item.label}</span>
                <div onClick={() => update(item.key, !(form as any)[item.key])} style={{ width: '36px', height: '20px', borderRadius: '10px', background: (form as any)[item.key] ? '#4f46e5' : '#d1d5db', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: '3px', left: (form as any)[item.key] ? '19px' : '3px', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={cardHeaderStyle}>🎨 Marke & Tonalität</div>
        <div style={cardBodyStyle}>
          <div style={{ marginBottom: '12px' }}><label style={labelStyle}>Was macht Ihr Restaurant besonders?</label><textarea style={{ ...inputStyle, height: '60px', resize: 'none' }} value={form.uniqueSellingPoints} onChange={e => update('uniqueSellingPoints', e.target.value)} /></div>
          <div style={{ marginBottom: '12px' }}><label style={labelStyle}>Markenwerte</label><textarea style={{ ...inputStyle, height: '60px', resize: 'none' }} value={form.brandValues} onChange={e => update('brandValues', e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div><label style={labelStyle}>Bevorzugte Formulierungen</label><textarea style={{ ...inputStyle, height: '70px', resize: 'none' }} value={form.preferredPhrases} onChange={e => update('preferredPhrases', e.target.value)} /></div>
            <div><label style={labelStyle}>Zu vermeidende Formulierungen</label><textarea style={{ ...inputStyle, height: '70px', resize: 'none' }} value={form.avoidPhrases} onChange={e => update('avoidPhrases', e.target.value)} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={labelStyle}>Antwort-Signatur</label><input style={inputStyle} placeholder="z. B. Das Team der Trattoria" value={form.responseSignature} onChange={e => update('responseSignature', e.target.value)} /></div>
            <div>
              <label style={labelStyle}>Antwortsprache</label>
              <select style={inputStyle} value={form.responseLanguage} onChange={e => update('responseLanguage', e.target.value)}>
                <option value="Deutsch">Deutsch</option>
                <option value="Englisch">Englisch</option>
                <option value="Sprache des Bewerters">Sprache des Bewerters</option>
                <option value="Deutsch und Englisch">Deutsch & Englisch</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={cardHeaderStyle}>🤖 KI-Antworteinstellungen</div>
        <div style={cardBodyStyle}>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Antwortstil</label>
            <select style={inputStyle} value={form.responseStyle} onChange={e => update('responseStyle', e.target.value)}>
              <option value="professional">Professionell — förmlich und höflich</option>
              <option value="friendly">Freundlich — warm und zugänglich</option>
              <option value="concise">Prägnant — kurz und auf den Punkt</option>
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500' }}>Antworten automatisch generieren</div>
              <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>KI-Antworten automatisch bei neuen Bewertungen erstellen</div>
            </div>
            <div onClick={() => update('autoGenerate', !form.autoGenerate)} style={{ width: '36px', height: '20px', borderRadius: '10px', background: form.autoGenerate ? '#4f46e5' : '#d1d5db', position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: '3px', left: form.autoGenerate ? '19px' : '3px', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </div>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={cardHeaderStyle}>🔗 Google Business Profile</div>
        <div style={cardBodyStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={labelStyle}>Google Account-ID</label><input style={inputStyle} placeholder="z. B. 123456789" value={form.googleAccountId} onChange={e => update('googleAccountId', e.target.value)} /></div>
            <div><label style={labelStyle}>Standort-ID</label><input style={inputStyle} placeholder="z. B. 987654321" value={form.googleLocationId} onChange={e => update('googleLocationId', e.target.value)} /></div>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={cardHeaderStyle}>🔔 Benachrichtigungen</div>
        <div style={cardBodyStyle}>
          <label style={labelStyle}>Benachrichtigungs-E-Mail</label>
          <input style={inputStyle} type="email" placeholder="z. B. inhaber@meinrestaurant.de" value={form.notificationEmail} onChange={e => update('notificationEmail', e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', paddingBottom: '40px' }}>
        {saved && <span style={{ color: '#22c55e', fontSize: '14px' }}>✅ Gespeichert!</span>}
        <button onClick={save} style={{ padding: '10px 28px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
          Profil speichern
        </button>
      </div>
    </div>
  )
}

export default App