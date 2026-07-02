// Sammelt Testfaelle fuer die Antwort-Qualitaets-Baseline: echte Bewertungen
// aus Supabase (gemischt ueber alle Sterne-Stufen) plus die 7 bestehenden
// synthetischen Grenzfaelle. Schreibt eine feste JSON-Datei, damit jeder
// Baseline-Lauf exakt dieselben Faelle verwendet.
//
// Ausfuehren: npm run baseline:collect

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'
import { testCases, type TestCase } from './synthetic-cases.ts'
import { manualRealCases } from './manual-real-cases.ts'

try {
  process.loadEnvFile('.env.local')
} catch {
  console.warn('Kein .env.local gefunden — nutze bereits gesetzte Umgebungsvariablen.')
}

const REAL_CASES_PER_RATING = 3

interface ReviewRow {
  review_text: string
  stars: number
  reviewer_name: string | null
  user_id: string
}

async function loadRestaurantSettings(supabase: ReturnType<typeof createClient>, userId: string): Promise<Record<string, unknown> | undefined> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'restaurant_profile')
    .eq('user_id', userId)
    .single()
  return data?.value
}

async function collectRealCases(): Promise<TestCase[]> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('review_text, stars, reviewer_name, user_id')
    .not('review_text', 'is', null)
    .neq('review_text', '')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw new Error(`Supabase-Fehler beim Laden der Bewertungen: ${error.message}`)
  if (!reviews || reviews.length === 0) {
    console.warn('Keine echten Bewertungen mit Text gefunden — Baseline nutzt nur synthetische Fälle.')
    return []
  }

  const byRating = new Map<number, ReviewRow[]>()
  for (const r of reviews as ReviewRow[]) {
    const bucket = byRating.get(r.stars) || []
    if (bucket.length < REAL_CASES_PER_RATING) {
      bucket.push(r)
      byRating.set(r.stars, bucket)
    }
  }

  const settingsCache = new Map<string, Record<string, unknown> | undefined>()
  const cases: TestCase[] = []
  for (const [rating, bucket] of byRating) {
    for (const r of bucket) {
      if (!settingsCache.has(r.user_id)) {
        settingsCache.set(r.user_id, await loadRestaurantSettings(supabase, r.user_id))
      }
      cases.push({
        name: `Echt: ${rating} Sterne — ${r.reviewer_name || 'Anonym'}`,
        review: {
          reviewText: r.review_text,
          stars: r.stars,
          reviewerName: r.reviewer_name || 'Anonym',
        },
        settings: settingsCache.get(r.user_id),
      })
    }
  }
  return cases
}

async function run() {
  let dbCases: TestCase[] = []
  try {
    dbCases = await collectRealCases()
  } catch (err) {
    console.warn(`Supabase-Abfrage fehlgeschlagen, überspringe echte Bewertungen aus der Datenbank: ${err instanceof Error ? err.message : String(err)}`)
  }

  const syntheticCases: TestCase[] = testCases.map(tc => ({
    name: `Synthetisch: ${tc.name}`,
    review: tc.review,
    settings: tc.settings,
    ownerVoice: tc.ownerVoice,
  }))

  const allCases = [...dbCases, ...manualRealCases, ...syntheticCases]
  writeFileSync('scripts/baseline-cases.json', JSON.stringify(allCases, null, 2))
  console.log(`${allCases.length} Testfälle geschrieben nach scripts/baseline-cases.json (${dbCases.length} echt aus DB, ${manualRealCases.length} echt manuell, ${syntheticCases.length} synthetisch).`)
}

run()
