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

// ─── Roster parsing + templates ────────────────────────────────────────────────

// Parses pasted lines like "Jane Smith - jane@example.com" (email optional) into { name, email }
export function parseRoster(text) {
  return (text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const m = line.match(/^(.+?)\s*[-–—]\s*(\S+@\S+)$/)
      return m ? { name: m[1].trim(), email: m[2].trim() } : { name: line, email: '' }
    })
}

// Expands a question template into one cloned copy of its questions per roster person,
// tagging each clone with { section, sectionEmail } so it renders/groups under that person.
export function fieldsFromRoster(template, people) {
  const out = []
  people.forEach(p => {
    ;(template.questions || []).forEach(q => {
      out.push({ ...q, id: genId(), section: p.name, sectionEmail: p.email || undefined })
    })
  })
  return out
}

// Groups a flat fields array into consecutive runs sharing the same `section` (e.g. volunteer name).
// Fields with no section each become their own single-field group.
export function groupFieldsBySection(fields) {
  const groups = []
  ;(fields || []).forEach(f => {
    const last = groups[groups.length - 1]
    if (f.section && last && last.section === f.section) last.fields.push(f)
    else groups.push({ section: f.section || null, fields: [f] })
  })
  return groups
}

// Cleans + trims a raw editor fields array before saving to Supabase.
// A field of type 'group' bundles several sub-questions ("parts") that are answered
// together and stored as one field with a nested { partId: value } answer — it's still
// "one question" in the list, just made of several parts. Regular fields are unchanged.
export function normalizeFields(fields) {
  return (fields || [])
    .filter(q => q.type === 'group' ? (q.parts || []).some(p => p.label.trim()) : q.label.trim())
    .map(({ id, type, label, required, options, section, sectionEmail, parts }) => {
      const base = { id, type, label: (label || '').trim(), required: !!required }
      if (section) base.section = section
      if (section && sectionEmail) base.sectionEmail = sectionEmail
      if (type === 'group') {
        base.parts = (parts || [])
          .filter(p => p.label.trim())
          .map(({ id, type, label, required, options }) => ({
            id, type, label: label.trim(), required: !!required,
            ...(['multiple_choice', 'checkboxes'].includes(type) && { options: (options || []).filter(o => o.trim()) })
          }))
      } else if (['multiple_choice', 'checkboxes'].includes(type)) {
        base.options = (options || []).filter(o => o.trim())
      }
      return base
    })
}

// ─── Shared UI ─────────────────────────────────────────────────────────────────

import { ArrowLeft } from 'lucide-react'

// Matches the gold band at the top of every branded Portal notification email
// (buildBoardNotificationEmailHtml) — the same visual anchor whether someone's
// looking at the email or clicking through to the form it links to.
export function GoldBar() {
  return <div className="h-3.5 bg-[#886c44]" />
}

export function TopBar({ onBack }) {
  return (
    <div className="sticky top-0 z-10">
      <GoldBar />
      <div className="bg-[#f5f0e7] border-b border-[#e0d5c0]">
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
    </div>
  )
}

// Matches the 3-link footer at the bottom of every branded Portal notification
// email (Portal / Volunteer Hub / Website) so a form reached from that email
// feels like a continuation of it, not a different site.
export function Footer() {
  const links = [
    { label: 'Portal', url: 'https://northstarhouse.github.io/Portal/' },
    { label: 'Volunteer Hub', url: 'https://northstarhouse.github.io/volunteerhub/' },
    { label: 'Website', url: 'https://thenorthstarhouse.org' },
  ]
  return (
    <div className="border-t border-[#e0d5c0] mt-16">
      <div className="max-w-4xl mx-auto flex divide-x divide-[#e0d5c0]">
        {links.map(l => (
          <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
            className="flex-1 text-center py-4 text-sm font-bold text-[#886c44] hover:text-[#6d5436] transition" style={SANS}>
            {l.label}
          </a>
        ))}
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
