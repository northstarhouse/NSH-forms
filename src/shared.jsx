export const FONT    = { fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }
export const DISPLAY = { fontFamily: "'Cardo', Georgia, serif" }
export const SERIF   = DISPLAY
export const SANS    = FONT
export const INPUT = "w-full p-3 border-2 border-[#d9cec2] rounded-lg text-base font-normal focus:outline-none focus:border-[#886c44] bg-white"

export const QUESTION_TYPES = [
  { value: 'short_text',      label: 'Short answer' },
  { value: 'long_text',       label: 'Paragraph' },
  { value: 'multiple_choice', label: 'Multiple choice' },
  { value: 'checkboxes',      label: 'Checkboxes' },
  { value: 'yes_no',          label: 'Yes / No' },
  { value: 'rating',          label: 'Rating (1–5)' },
  { value: 'date',            label: 'Date' },
]

export const slugify = str => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export const fmtDate = d => {
  if (!d) return null
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}
export const fmtDateShort = d => {
  if (!d) return ''
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
export const fmtTime = t => {
  if (!t) return null
  if (/[a-zA-Z–-]/.test(t.replace(/^\d{2}:\d{2}$/, ''))) return t
  const [h, min] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}${min ? ':' + String(min).padStart(2, '0') : ''} ${ampm}`
}

export const genId      = () => Math.random().toString(36).slice(2, 10)
export const mkQuestion = (type = 'short_text') => ({ id: genId(), type, label: '', required: false, options: ['', ''] })

// ─── Shared UI ─────────────────────────────────────────────────────────────────

import { ArrowLeft } from 'lucide-react'

export function TopBar({ onBack }) {
  return (
    <div className="bg-[#f5f0e7] border-b border-[#e0d5c0] sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-6 py-3 flex justify-between items-center">
        {onBack ? (
          <button onClick={onBack} className="flex items-center gap-2 text-[#886c44] font-bold text-sm hover:text-[#6d5436] transition" style={SANS}>
            <ArrowLeft size={16} /> Dashboard
          </button>
        ) : (
          <div />
        )}
        <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="North Star House" className="h-16 w-auto" />
      </div>
    </div>
  )
}

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#faf8f4] flex items-center justify-center">
      <p className="text-[#9e8b6f] font-bold text-base" style={SANS}>Loading…</p>
    </div>
  )
}

export function NotFound() {
  return (
    <div className="min-h-screen bg-[#faf8f4] flex flex-col items-center justify-center gap-3">
      <p className="text-3xl font-normal text-[#2c2418]" style={SERIF}>Not found</p>
      <p className="text-base text-[#9e8b6f] font-bold" style={SANS}>This link may have been removed or is incorrect.</p>
    </div>
  )
}
