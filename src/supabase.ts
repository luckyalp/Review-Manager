import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// Einstellungen laden
export async function loadSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'restaurant_profile')
    .single()

  if (error || !data) return null
  return data.value
}

// Einstellungen speichern
export async function saveSettings(settings: any) {
  const { error } = await supabase
    .from('settings')
    .upsert({
      key: 'restaurant_profile',
      value: settings,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' })

  return !error
}

// Bewertung speichern
export async function saveReview(review: any) {
  const { data, error } = await supabase
    .from('reviews')
    .upsert({
      google_review_id: review.id?.toString(),
      reviewer_name: review.name,
      stars: review.stars,
      review_text: review.text,
      review_date: new Date().toISOString(),
      status: review.status || 'Ausstehend',
    }, { onConflict: 'google_review_id' })
    .select()

  if (error) return null
  return data
}

// Bewertung als beantwortet markieren
export async function markAsAnswered(reviewId: string, selectedAnswer: string) {
  const { error } = await supabase
    .from('reviews')
    .update({
      status: 'Beantwortet',
      selected_answer: selectedAnswer,
      answered_at: new Date().toISOString()
    })
    .eq('google_review_id', reviewId)

  return !error
}

// Alle Bewertungen laden
export async function loadReviews() {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return null
  return data
}
