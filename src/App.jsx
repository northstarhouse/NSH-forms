import React, { useState, useEffect, useCallback } from 'react'
import { Copy, ArrowLeft, Check, Plus, X, Calendar, MapPin, Clock } from 'lucide-react'
import { supabase } from './supabase'

const FONT    = { fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }
const SERIF   = FONT
const SANS    = FONT
const DISPLAY = { fontFamily: "'Cardo', Georgia, serif" }
const INPUT = "w-full p-3 border-2 border-[#d9cec2] rounded-lg text-base font-normal focus:outline-none focus:border-[#886c44] bg-white"

const QUESTION_TYPES = [
  { value: 'short_text',      label: 'Short answer' },
  { value: 'long_text',       label: 'Paragraph' },
  { value: 'multiple_choice', label: 'Multiple choice' },
  { value: 'checkboxes',      label: 'Checkboxes' },
  { value: 'yes_no',          label: 'Yes / No' },
  { value: 'rating',          label: 'Rating (1–5)' },
  { value: 'date',            label: 'Date' },
]

const slugify = str => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const fmtDate = d => {
  if (!d) return null
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}
const fmtTime = t => {
  if (!t) return null
  if (/[a-zA-Z–-]/.test(t.replace(/^\d{2}:\d{2}$/, ''))) return t
  const [h, min] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}${min ? ':' + String(min).padStart(2, '0') : ''} ${ampm}`
}

const genId      = () => Math.random().toString(36).slice(2, 10)
const mkQuestion = (type = 'short_text') => ({ id: genId(), type, label: '', required: false, options: ['', ''] })

// ─── Shared UI ─────────────────────────────────────────────────────────────────

function EventTopBar() {
  return (
    <div className="bg-[#f5f0e7] border-b border-[#e0d5c0]" style={FONT}>
      <div className="px-6 sm:px-12 lg:px-20 xl:px-28 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full border border-[#8a7355] flex items-center justify-center flex-shrink-0">
            <span className="text-[#8a7355] text-sm leading-none">★</span>
          </div>
          <div>
            <p className="text-sm font-bold text-[#2c2418] leading-tight">The North Star House</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#a08060]">Historic Landmark &amp; Event Venue</p>
          </div>
        </div>
        <p className="text-sm text-[#a08060] font-medium hidden sm:block">Grass Valley, California</p>
      </div>
    </div>
  )
}

function TopBar({ onBack }) {
  return (
    <div className="bg-white border-b-2 border-[#e8e4dc] sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-6 py-5">
        {onBack ? (
          <button onClick={onBack} className="text-base text-[#886c44] flex items-center gap-2 hover:text-[#6d5436] font-bold" style={SANS}>
            <ArrowLeft size={18} /> Back
          </button>
        ) : (
          <div>
            <h1 className="text-2xl font-bold text-[#2c2418]">North Star House</h1>
            <p className="text-xs text-[#886c44] font-semibold tracking-widest uppercase mt-0.5">Volunteer Engagement Hub</p>
          </div>
        )}
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#faf8f4] flex items-center justify-center">
      <p className="text-[#9e8b6f] font-bold text-base" style={SANS}>Loading…</p>
    </div>
  )
}

function NotFound() {
  return (
    <div className="min-h-screen bg-[#faf8f4] flex flex-col items-center justify-center gap-3">
      <p className="text-3xl font-normal text-[#2c2418]" style={SERIF}>Not found</p>
      <p className="text-base text-[#9e8b6f] font-bold" style={SANS}>This link may have been removed or is incorrect.</p>
    </div>
  )
}

// ─── Form: Question input renderer ────────────────────────────────────────────

function QuestionInput({ question: q, value, onChange }) {
  switch (q.type) {
    case 'short_text':
      return <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} placeholder="Your answer" className={INPUT} style={SANS} />

    case 'long_text':
      return <textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder="Your answer" className={INPUT} rows={4} style={SANS} />

    case 'multiple_choice':
      return (
        <div className="space-y-2">
          {(q.options || []).map((opt, i) => (
            <button key={i} type="button" onClick={() => onChange(opt)}
              className={`w-full max-w-lg p-4 text-left border-2 rounded-xl text-base font-bold transition ${value === opt ? 'border-[#886c44] bg-[#f5f0e8] text-[#2c2418]' : 'border-[#d9cec2] bg-white text-[#2c2418] hover:border-[#886c44]'}`}
              style={SANS}>{opt}</button>
          ))}
        </div>
      )

    case 'checkboxes': {
      const arr = Array.isArray(value) ? value : []
      return (
        <div className="space-y-2">
          {(q.options || []).map((opt, i) => {
            const checked = arr.includes(opt)
            return (
              <button key={i} type="button"
                onClick={() => onChange(checked ? arr.filter(v => v !== opt) : [...arr, opt])}
                className={`w-full max-w-lg p-4 text-left border-2 rounded-xl text-base font-bold transition flex items-center gap-3 ${checked ? 'border-[#886c44] bg-[#f5f0e8] text-[#2c2418]' : 'border-[#d9cec2] bg-white text-[#2c2418] hover:border-[#886c44]'}`}
                style={SANS}>
                <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center ${checked ? 'bg-[#886c44] border-[#886c44]' : 'border-[#d9cec2]'}`}>
                  {checked && <Check size={12} className="text-white" />}
                </div>
                {opt}
              </button>
            )
          })}
        </div>
      )
    }

    case 'yes_no':
      return (
        <div className="flex gap-3">
          {['Yes', 'No'].map(opt => (
            <button key={opt} type="button" onClick={() => onChange(opt)}
              className={`px-8 py-4 rounded-xl text-base font-bold border-2 transition ${value === opt ? 'bg-[#886c44] border-[#886c44] text-white' : 'bg-white border-[#d9cec2] text-[#2c2418] hover:border-[#886c44]'}`}
              style={SANS}>{opt}</button>
          ))}
        </div>
      )

    case 'rating':
      return (
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} type="button" onClick={() => onChange(String(n))}
              className={`w-14 h-14 rounded-xl border-2 text-base font-bold transition ${String(n) === value ? 'bg-[#886c44] border-[#886c44] text-white' : 'bg-white border-[#d9cec2] text-[#2c2418] hover:border-[#886c44]'}`}
              style={SANS}>{n}</button>
          ))}
          <span className="self-center text-sm font-bold text-[#9e8b6f] ml-1">1 = poor · 5 = excellent</span>
        </div>
      )

    case 'date':
      return <input type="date" value={value || ''} onChange={e => onChange(e.target.value)} className={INPUT} style={SANS} />

    default:
      return null
  }
}

// ─── Form: Results summary ─────────────────────────────────────────────────────

function FormSummary({ form, responses }) {
  if (!responses.length) return null
  const total = responses.length

  return (
    <div className="bg-white p-8 rounded-xl border-2 border-[#e8e4dc] max-w-2xl">
      <h3 className="text-2xl font-normal text-[#2c2418] mb-1" style={SERIF}>Responses so far</h3>
      <p className="text-sm text-[#9e8b6f] font-bold mb-8">{total} response{total !== 1 ? 's' : ''} total</p>

      {(form.fields || []).map(q => {
        const vals = responses
          .map(r => r.answers?.[q.id])
          .filter(v => v !== undefined && v !== '' && v !== null && !(Array.isArray(v) && v.length === 0))
        if (!vals.length) return null

        if (q.type === 'short_text' || q.type === 'long_text') {
          return (
            <div key={q.id} className="mb-8 pb-8 border-b border-[#e8e4dc] last:border-0 last:mb-0 last:pb-0">
              <p className="text-base font-bold text-[#2c2418] mb-3">{q.label}</p>
              <div className="space-y-2">
                {vals.map((v, i) => <p key={i} className="text-base text-[#2c2418] p-3 bg-[#faf8f4] rounded-lg">{v}</p>)}
              </div>
            </div>
          )
        }

        if (q.type === 'multiple_choice' || q.type === 'yes_no') {
          const opts = q.type === 'yes_no' ? ['Yes', 'No'] : (q.options || [])
          const counts = {}
          opts.forEach(o => { counts[o] = 0 })
          vals.forEach(v => { if (counts[v] !== undefined) counts[v]++ })
          return (
            <div key={q.id} className="mb-8 pb-8 border-b border-[#e8e4dc] last:border-0 last:mb-0 last:pb-0">
              <p className="text-base font-bold text-[#2c2418] mb-4">{q.label}</p>
              <div className="space-y-3">
                {opts.map((opt, i) => {
                  const c = counts[opt] || 0
                  const pct = vals.length > 0 ? Math.round((c / vals.length) * 100) : 0
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-bold text-[#2c2418]">{opt}</span>
                        <span className="font-bold text-[#886c44]">{c} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-[#f0e6d8] rounded-full">
                        <div className="h-2 bg-[#886c44] rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        }

        if (q.type === 'checkboxes') {
          const opts = q.options || []
          const counts = {}; opts.forEach(o => { counts[o] = 0 })
          vals.forEach(arr => { if (Array.isArray(arr)) arr.forEach(a => { if (counts[a] !== undefined) counts[a]++ }) })
          return (
            <div key={q.id} className="mb-8 pb-8 border-b border-[#e8e4dc] last:border-0 last:mb-0 last:pb-0">
              <p className="text-base font-bold text-[#2c2418] mb-4">{q.label}</p>
              <div className="space-y-3">
                {opts.map((opt, i) => {
                  const c = counts[opt] || 0
                  const pct = vals.length > 0 ? Math.round((c / vals.length) * 100) : 0
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-bold text-[#2c2418]">{opt}</span>
                        <span className="font-bold text-[#886c44]">{c} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-[#f0e6d8] rounded-full">
                        <div className="h-2 bg-[#886c44] rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        }

        if (q.type === 'rating') {
          const nums = vals.map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 5)
          const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : '—'
          const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
          nums.forEach(n => { dist[n] = (dist[n] || 0) + 1 })
          return (
            <div key={q.id} className="mb-8 pb-8 border-b border-[#e8e4dc] last:border-0 last:mb-0 last:pb-0">
              <p className="text-base font-bold text-[#2c2418] mb-2">{q.label}</p>
              <p className="text-4xl font-bold text-[#886c44] mb-5">{avg}<span className="text-base font-bold text-[#9e8b6f]"> / 5</span></p>
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map(star => {
                  const c = dist[star] || 0
                  const pct = nums.length ? Math.round((c / nums.length) * 100) : 0
                  return (
                    <div key={star} className="flex items-center gap-3">
                      <span className="text-sm font-bold text-[#2c2418] w-3">{star}</span>
                      <div className="flex-1 h-2 bg-[#f0e6d8] rounded-full">
                        <div className="h-2 bg-[#886c44] rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-sm font-bold text-[#886c44] w-6 text-right">{c}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        }

        if (q.type === 'date') {
          return (
            <div key={q.id} className="mb-8 pb-8 border-b border-[#e8e4dc] last:border-0 last:mb-0 last:pb-0">
              <p className="text-base font-bold text-[#2c2418] mb-3">{q.label}</p>
              <div className="space-y-1">
                {vals.map((v, i) => <p key={i} className="text-base font-bold text-[#886c44]">{v}</p>)}
              </div>
            </div>
          )
        }

        return null
      })}
    </div>
  )
}

// ─── Volunteer: Form Page ──────────────────────────────────────────────────────

function FormPage({ id }) {
  const [form, setForm]             = useState(null)
  const [answers, setAnswers]       = useState({})
  const [submitted, setSubmitted]   = useState(false)
  const [responses, setResponses]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors]         = useState({})

  useEffect(() => {
    const load = async () => {
      const { data: f } = await supabase.from('nsh_forms').select('*').eq('id', id).single()
      if (!f) { setLoading(false); return }
      setForm(f)
      const init = {}
      ;(f.fields || []).forEach(q => { init[q.id] = q.type === 'checkboxes' ? [] : '' })
      setAnswers(init)
      setLoading(false)
    }
    load()
  }, [id])

  const handleSubmit = async () => {
    const errs = {}
    ;(form.fields || []).forEach(q => {
      if (!q.required) return
      const v = answers[q.id]
      if (Array.isArray(v) ? v.length === 0 : !String(v ?? '').trim()) errs[q.id] = true
    })
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setSubmitting(true)
    await supabase.from('nsh_form_responses').insert({ form_id: id, answers })
    const { data: res } = await supabase.from('nsh_form_responses').select('answers').eq('form_id', id)
    setResponses(res || [])
    setSubmitting(false)
    setSubmitted(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) return <LoadingScreen />
  if (!form)   return <NotFound />

  return (
    <div className="min-h-screen bg-[#f0e6d8]" style={SANS}>
      <TopBar onBack={() => window.history.back()} />
      <div className="max-w-3xl mx-auto px-6 py-14">

        <p className="text-sm uppercase tracking-widest text-[#886c44] font-bold mb-3">Form</p>
        <h1 className="text-5xl font-normal mb-4 text-[#2c2418] leading-tight" style={SERIF}>{form.title}</h1>
        {form.description && (
          <p className="text-lg text-[#2c2418] mb-10 leading-relaxed max-w-2xl">{form.description}</p>
        )}

        {submitted ? (
          <>
            <div className="flex items-center gap-3 py-5 px-6 mb-10 bg-white rounded-xl border-2 border-[#886c44]">
              <Check size={22} className="text-[#886c44] flex-shrink-0" />
              <p className="text-lg text-[#2c2418] font-bold">Your response has been recorded. Thank you!</p>
            </div>
            <FormSummary form={form} responses={responses} />
          </>
        ) : (
          <div className="space-y-6">
            {(form.fields || []).map((q, i) => (
              <div key={q.id} className={`bg-white p-7 rounded-xl border-2 transition ${errors[q.id] ? 'border-red-400' : 'border-[#e8e4dc]'}`}>
                <p className="text-lg text-[#2c2418] font-bold mb-1">
                  {i + 1}. {q.label}
                  {q.required && <span className="text-red-500 ml-1">*</span>}
                </p>
                {errors[q.id] && <p className="text-sm text-red-500 font-bold mb-2">Required.</p>}
                <div className="mt-4">
                  <QuestionInput
                    question={q}
                    value={answers[q.id]}
                    onChange={v => {
                      setAnswers(a => ({ ...a, [q.id]: v }))
                      setErrors(e => ({ ...e, [q.id]: false }))
                    }}
                  />
                </div>
              </div>
            ))}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-8 py-4 bg-[#886c44] text-white rounded-xl text-base font-bold hover:bg-[#6d5436] transition disabled:opacity-60">
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Volunteer: Event Page ─────────────────────────────────────────────────────

function EventPage({ id }) {
  const [event, setEvent]     = useState(null)
  const [responses, setResponses] = useState([])
  const [slots, setSlots]     = useState([])
  const [signups, setSignups] = useState({})
  const [name, setName]           = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [signedSlot, setSignedSlot]   = useState(null)
  const [expandedSlot, setExpandedSlot] = useState(null)
  const [slotName, setSlotName]       = useState('')
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const { data: ev } = await supabase.from('vol_events').select('*').eq('id', id).single()
    if (!ev) { setLoading(false); return }
    setEvent(ev)

    if (ev.event_type === 'rsvp') {
      const { data: res } = await supabase.from('vol_event_responses').select('*').eq('event_id', id).order('created_at')
      setResponses(res || [])
    } else {
      const { data: sl } = await supabase.from('vol_shift_slots').select('*').eq('event_id', id).order('sort_order')
      setSlots(sl || [])
      if (sl?.length) {
        const { data: sg } = await supabase.from('vol_slot_signups').select('*').in('slot_id', sl.map(s => s.id)).order('created_at')
        const grouped = {}
        sl.forEach(s => { grouped[s.id] = [] })
        ;(sg || []).forEach(s => { if (grouped[s.slot_id]) grouped[s.slot_id].push(s) })
        setSignups(grouped)
      }
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchData()
    const ch = supabase.channel(`event-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vol_event_responses', filter: `event_id=eq.${id}` },
        p => setResponses(prev => [...prev, p.new]))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vol_slot_signups' },
        p => setSignups(prev => ({
          ...prev,
          [p.new.slot_id]: [...(prev[p.new.slot_id] || []), p.new]
        })))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [id, fetchData])

  const handleRSVP = async (response) => {
    if (!name.trim()) return
    await supabase.from('vol_event_responses').insert({ event_id: id, name: name.trim(), response })
    setSubmitted(true)
  }

  const handleShiftSignup = async (slotId) => {
    if (!slotName.trim()) return
    const slot = slots.find(s => s.id === slotId)
    const current = signups[slotId] || []
    if (slot?.spots && current.length >= slot.spots) return
    const { error } = await supabase.from('vol_slot_signups').insert({ slot_id: slotId, name: slotName.trim() })
    if (!error) {
      setSignedSlot(slotId)
      setExpandedSlot(null)
      setSlotName('')
    }
  }

  if (loading) return <LoadingScreen />
  if (!event) return <NotFound />

  const isShift = event.event_type === 'shift'
  const counts = { yes: 0, plus1: 0, no: 0 }
  responses.forEach(r => { if (counts[r.response] !== undefined) counts[r.response]++ })

  const dateStr = fmtDate(event.date)
  const timeStr = fmtTime(event.time)

  return (
    <div className="min-h-screen bg-[#f5f0e7]" style={FONT}>

      {/* ── Top bar with logo ── */}
      <div className="bg-[#f5f0e7] border-b border-[#e0d5c0]">
        <div className="max-w-4xl mx-auto px-6 py-3 flex justify-end">
          <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="North Star House" className="h-24 w-auto" />
        </div>
      </div>

      {/* ── Event header ── */}
      <div className="max-w-4xl mx-auto px-6 pt-10 pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#886c44] mb-5">
          {isShift ? 'Volunteer Sign-Up' : 'Event'}
        </p>

        <h1 className="text-4xl sm:text-5xl font-bold text-[#1e1a14] leading-tight mb-7" style={DISPLAY}>
          {event.title}
        </h1>

        <div className="flex flex-wrap items-center gap-x-7 gap-y-2 mb-6">
          {(dateStr || event.time) && (
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-[#886c44] flex-shrink-0" />
              <span className="text-sm font-medium text-[#2c2418]">
                {dateStr}{dateStr && event.time ? ' · ' : ''}{event.time}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-[#886c44] flex-shrink-0" />
            <span className="text-sm font-medium text-[#2c2418]">The North Star House</span>
          </div>
        </div>

        {event.description && (
          <p className="text-base text-[#5a4a35] leading-relaxed max-w-xl">{event.description}</p>
        )}
      </div>

      {/* ── Body ── */}
      <div className="max-w-4xl mx-auto px-6 pb-14">

        {/* RSVP */}
        {!isShift && (
          <div className="bg-white rounded-2xl px-8 py-8">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-2xl font-bold text-[#1e1a14]" style={DISPLAY}>RSVP</h2>
              <p className="text-sm text-[#a08060] hidden sm:block">Let us know if you can make it</p>
            </div>
            <div className="border-t border-[#e0d5c0] mb-8" />

            {submitted ? (
              <div className="flex items-center gap-3 py-5 px-6 bg-[#f5f0e7] rounded-xl">
                <Check size={18} className="text-[#886c44] flex-shrink-0" />
                <p className="text-base font-semibold text-[#2c2418]">Thanks, {name}! Your RSVP was recorded.</p>
              </div>
            ) : (
              <div className="space-y-5 max-w-md">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-[#a08060] mb-2">Your Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Full name" autoFocus
                    className="w-full px-4 py-3 border border-[#ddd4c0] rounded-lg text-base bg-[#faf7f2] focus:outline-none focus:border-[#886c44]" />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => handleRSVP('yes')} disabled={!name.trim()}
                    className="flex-1 py-3 bg-[#886c44] text-white rounded-lg text-sm font-semibold hover:bg-[#6d5436] transition disabled:opacity-40">Attending</button>
                  <button onClick={() => handleRSVP('plus1')} disabled={!name.trim()}
                    className="flex-1 py-3 border-2 border-[#886c44] text-[#886c44] rounded-lg text-sm font-semibold hover:bg-[#f5f0e7] transition disabled:opacity-40 bg-white">Attending +1</button>
                  <button onClick={() => handleRSVP('no')} disabled={!name.trim()}
                    className="flex-1 py-3 border-2 border-[#e0d5c0] text-[#a08060] rounded-lg text-sm font-semibold hover:bg-[#f5f0e7] transition disabled:opacity-40 bg-white">Can't Make It</button>
                </div>
              </div>
            )}

            {responses.length > 0 && (
              <>
                <div className="border-t border-[#e0d5c0] mt-8 mb-6" />
                <div className="flex gap-8 mb-6">
                  {[['yes', 'Attending', counts.yes], ['plus1', '+1', counts.plus1], ['no', "Can't Make It", counts.no]].map(([k, l, c]) => (
                    <div key={k}>
                      <p className="text-3xl font-bold text-[#1e1a14]" style={DISPLAY}>{c}</p>
                      <p className="text-xs font-semibold text-[#a08060] uppercase tracking-wide mt-1">{l}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  {responses.map(r => (
                    <div key={r.id} className="flex items-baseline justify-between">
                      <p className="text-base font-medium text-[#2c2418]">{r.name}</p>
                      <span className="text-sm text-[#886c44] font-semibold">
                        {r.response === 'plus1' ? 'Attending +1' : r.response === 'yes' ? 'Attending' : "Can't Make It"}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Shift slots */}
        {isShift && (
          <div className="bg-white rounded-2xl px-8 py-8">
            {slots.length === 0 && (
              <p className="text-sm text-[#a08060]">No time slots added yet.</p>
            )}
            {slots.length > 0 && (
              <>
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-2xl font-bold text-[#1e1a14]" style={DISPLAY}>Available Shifts</h2>
                  <p className="text-sm text-[#a08060] hidden sm:block">Choose a role that fits your schedule</p>
                </div>
                <div className="border-t border-[#e0d5c0] mb-8" />
              </>
            )}

            <div className="space-y-8">
              {slots.map(slot => {
                const slotSignups = signups[slot.id] || []
                const spotsLeft   = slot.spots != null ? slot.spots - slotSignups.length : null
                const isFull      = spotsLeft !== null && spotsLeft <= 0
                const didSignUp   = signedSlot === slot.id
                const isExpanded  = expandedSlot === slot.id

                return (
                  <div key={slot.id} className={isFull && !didSignUp ? 'opacity-50' : ''}>
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex-1 min-w-0">
                        <p className="text-lg font-bold text-[#1e1a14] mb-1" style={DISPLAY}>
                          {slot.time_label}
                        </p>
                        {slot.duration && (
                          <p className="text-sm text-[#5a4a35] leading-relaxed mb-2">{slot.duration}</p>
                        )}
                        {spotsLeft !== null && !isFull && (
                          <p className="text-sm text-[#a08060]">{spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} open</p>
                        )}
                      </div>

                      <div className="flex-shrink-0 pt-1">
                        {didSignUp ? (
                          <div className="flex items-center gap-1.5 text-[#886c44]">
                            <Check size={15} /><span className="text-sm font-semibold">Signed up</span>
                          </div>
                        ) : isFull ? (
                          <span className="text-xs font-bold uppercase tracking-widest text-[#b0a090]">Filled</span>
                        ) : isExpanded ? (
                          <button onClick={() => { setExpandedSlot(null); setSlotName('') }}
                            className="text-sm font-medium text-[#a08060] hover:text-[#5a4a35] transition">Cancel</button>
                        ) : (
                          <button onClick={() => { setExpandedSlot(slot.id); setSlotName('') }}
                            className="px-5 py-2.5 bg-[#886c44] text-white rounded-lg text-sm font-semibold hover:bg-[#6d5436] transition whitespace-nowrap">
                            Sign Up
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 flex gap-2 max-w-md">
                        <input type="text" value={slotName} onChange={e => setSlotName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleShiftSignup(slot.id)}
                          placeholder="Your full name" autoFocus
                          className="flex-1 px-4 py-2.5 border border-[#ddd4c0] rounded-lg text-sm bg-white focus:outline-none focus:border-[#886c44]" />
                        <button onClick={() => handleShiftSignup(slot.id)} disabled={!slotName.trim()}
                          className="px-5 py-2.5 bg-[#886c44] text-white rounded-lg text-sm font-semibold hover:bg-[#6d5436] transition disabled:opacity-40">
                          Confirm
                        </button>
                      </div>
                    )}

                    <div className="border-t border-[#e8e0d0] mt-8" />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Volunteer: Poll Page ──────────────────────────────────────────────────────

function PollPage({ id }) {
  const [poll, setPoll]   = useState(null)
  const [votes, setVotes] = useState([])
  const [name, setName]   = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading]     = useState(true)

  const fetchData = useCallback(async () => {
    const { data: p } = await supabase.from('vol_polls').select('*').eq('id', id).single()
    const { data: v } = await supabase.from('vol_poll_votes').select('*').eq('poll_id', id).order('created_at')
    setPoll(p); setVotes(v || []); setLoading(false)
  }, [id])

  useEffect(() => {
    fetchData()
    const ch = supabase.channel(`poll-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vol_poll_votes', filter: `poll_id=eq.${id}` },
        p => setVotes(prev => [...prev, p.new]))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [id, fetchData])

  const handleVote = async (option) => {
    if (!name.trim()) return
    await supabase.from('vol_poll_votes').insert({ poll_id: id, name: name.trim(), option })
    setSubmitted(true)
  }

  if (loading) return <LoadingScreen />
  if (!poll)   return <NotFound />

  const voteCounts = {}
  votes.forEach(v => { voteCounts[v.option] = (voteCounts[v.option] || 0) + 1 })
  const total = votes.length

  return (
    <div className="min-h-screen bg-[#f0e6d8]" style={SANS}>
      <TopBar onBack={() => window.history.back()} />
      <div className="max-w-3xl mx-auto px-6 py-14">
        <p className="text-sm uppercase tracking-widest text-[#886c44] font-bold mb-3">Poll</p>
        <h1 className="text-5xl font-normal mb-10 text-[#2c2418] leading-tight" style={SERIF}>{poll.question}</h1>

        {submitted ? (
          <div className="flex items-center gap-3 py-5 px-6 mb-10 bg-white rounded-xl border-2 border-[#886c44]">
            <Check size={22} className="text-[#886c44] flex-shrink-0" />
            <p className="text-lg text-[#2c2418] font-bold">Thanks, {name}! Your vote has been recorded.</p>
          </div>
        ) : (
          <div className="mb-12 space-y-4">
            <p className="text-base text-[#2c2418] font-bold">Enter your name, then click your choice:</p>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className={`${INPUT} max-w-sm`} style={SANS} />
            <div className="space-y-3 pt-1">
              {poll.options.map((option, idx) => (
                <button key={idx} onClick={() => handleVote(option)} disabled={!name.trim()}
                  className="w-full max-w-lg p-5 text-left bg-white border-2 border-[#d9cec2] rounded-xl hover:border-[#886c44] hover:bg-[#f5f0e8] text-[#2c2418] text-base font-bold transition disabled:opacity-40"
                  style={SANS}>
                  <div className="flex justify-between items-center">
                    <span>{option}</span>
                    {total > 0 && voteCounts[option] && <span className="text-[#886c44] font-bold ml-4">{voteCounts[option]}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {votes.length > 0 && (
          <div className="bg-white p-8 rounded-xl border-2 border-[#e8e4dc] max-w-lg">
            <h3 className="text-2xl font-normal text-[#2c2418] mb-1" style={SERIF}>Results</h3>
            <p className="text-sm text-[#9e8b6f] font-bold mb-6">{total} vote{total !== 1 ? 's' : ''} total</p>
            <div className="space-y-4 mb-8">
              {poll.options.map((option, idx) => {
                const c = voteCounts[option] || 0
                const pct = total > 0 ? Math.round((c / total) * 100) : 0
                return (
                  <div key={idx}>
                    <div className="flex justify-between text-base mb-1">
                      <span className="text-[#2c2418] font-bold">{option}</span>
                      <span className="text-[#886c44] font-bold">{c} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-[#f0e6d8] rounded-full">
                      <div className="h-2 bg-[#886c44] rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-sm font-bold text-[#9e8b6f] mb-3 uppercase tracking-wide">All votes</p>
            <div className="space-y-2">
              {votes.map(v => (
                <p key={v.id} className="text-base text-[#2c2418] font-normal">
                  {v.name} <span className="text-[#886c44] font-bold">— {v.option}</span>
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Admin: Slot card (reused in create + edit) ────────────────────────────────

function SlotCard({ slot, index, total, onChange, onRemove }) {
  return (
    <div className="bg-[#faf8f4] border-2 border-[#e8e4dc] rounded-xl p-4">
      <div className="flex justify-between items-center mb-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[#9e8b6f]">Slot {index + 1}</p>
        {total > 1 && (
          <button onClick={onRemove} className="text-[#9e8b6f] hover:text-red-500 transition">
            <X size={16} />
          </button>
        )}
      </div>
      <input
        placeholder="Slot name (e.g. 9am – 11am · Kitchen Help)"
        value={slot.time_label || ''}
        onChange={e => onChange('time_label', e.target.value)}
        className={`${INPUT} mb-3`}
        style={SANS}
      />
      <input
        placeholder="Description (optional)"
        value={slot.duration || ''}
        onChange={e => onChange('duration', e.target.value)}
        className={`${INPUT} mb-3`}
        style={SANS}
      />
      <input
        type="number"
        placeholder="Max spots (optional)"
        value={slot.spots || ''}
        onChange={e => onChange('spots', e.target.value)}
        className={INPUT}
        style={SANS}
      />
    </div>
  )
}

// ─── Admin: Question editor row ────────────────────────────────────────────────

function QuestionEditor({ question: q, index, onUpdate, onRemove, canRemove }) {
  const hasOptions = ['multiple_choice', 'checkboxes'].includes(q.type)
  return (
    <div className="bg-[#faf8f4] border-2 border-[#e8e4dc] rounded-xl p-5">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-3">
          <div className="flex gap-3 flex-wrap">
            <select
              value={q.type}
              onChange={e => onUpdate({ ...q, type: e.target.value })}
              className="p-3 border-2 border-[#d9cec2] rounded-lg text-sm font-bold focus:outline-none focus:border-[#886c44] bg-white text-[#2c2418] flex-shrink-0"
              style={SANS}>
              {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input
              placeholder={`Question ${index + 1}`}
              value={q.label}
              onChange={e => onUpdate({ ...q, label: e.target.value })}
              className={`${INPUT} flex-1 min-w-[180px]`}
              style={SANS}
            />
          </div>

          {hasOptions && (
            <div className="space-y-2 ml-1">
              {(q.options || []).map((opt, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={e => { const o = [...q.options]; o[i] = e.target.value; onUpdate({ ...q, options: o }) }}
                    className={`${INPUT} flex-1`}
                    style={SANS}
                  />
                  {q.options.length > 2 && (
                    <button onClick={() => onUpdate({ ...q, options: q.options.filter((_, idx) => idx !== i) })}
                      className="text-[#9e8b6f] hover:text-red-500 transition flex-shrink-0">
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => onUpdate({ ...q, options: [...(q.options || []), ''] })}
                className="flex items-center gap-1 text-sm text-[#886c44] font-bold hover:text-[#6d5436] transition">
                <Plus size={14} /> Add option
              </button>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={q.required}
              onChange={e => onUpdate({ ...q, required: e.target.checked })}
              className="w-4 h-4 accent-[#886c44]"
            />
            <span className="text-sm font-bold text-[#9e8b6f]">Required</span>
          </label>
        </div>

        {canRemove && (
          <button onClick={onRemove} className="text-[#9e8b6f] hover:text-red-500 transition flex-shrink-0 mt-1">
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Admin: Event detail + edit ────────────────────────────────────────────────

function EventDetail({ id, onBack }) {
  const [event,     setEvent]     = useState(null)
  const [slots,     setSlots]     = useState([])
  const [responses, setResponses] = useState([])
  const [signups,   setSignups]   = useState({})
  const [loading,   setLoading]   = useState(true)
  const [editing,   setEditing]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [editForm,  setEditForm]  = useState({ title: '', date: '', time: '', description: '' })
  const [editSlots, setEditSlots] = useState([])

  useEffect(() => {
    async function load() {
      const { data: ev } = await supabase.from('vol_events').select('*').eq('id', id).single()
      if (!ev) { setLoading(false); return }
      setEvent(ev)
      setEditForm({ title: ev.title, date: ev.date || '', time: ev.time || '', description: ev.description || '' })
      if (ev.event_type === 'rsvp') {
        const { data: res } = await supabase.from('vol_event_responses').select('*').eq('event_id', id).order('created_at')
        setResponses(res || [])
      } else {
        const { data: sl } = await supabase.from('vol_shift_slots').select('*').eq('event_id', id).order('sort_order')
        const slotList = sl || []
        setSlots(slotList)
        setEditSlots(slotList.map(s => ({ ...s })))
        if (slotList.length) {
          const { data: sg } = await supabase.from('vol_slot_signups').select('*').in('slot_id', slotList.map(s => s.id)).order('created_at')
          const grouped = {}
          slotList.forEach(s => { grouped[s.id] = [] })
          ;(sg || []).forEach(s => { if (grouped[s.slot_id]) grouped[s.slot_id].push(s) })
          setSignups(grouped)
        }
      }
      setLoading(false)
    }
    load()
  }, [id])

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('vol_events').update({
      title: editForm.title.trim(),
      date: editForm.date || null,
      time: editForm.time || null,
      description: editForm.description.trim() || null,
    }).eq('id', id)
    if (event.event_type === 'shift') {
      const valid = editSlots.filter(s => s.time_label?.trim())
      const originalIds = slots.map(s => s.id)
      const keptIds = valid.filter(s => s.id).map(s => s.id)

      // Delete slots that were removed (preserves their signups cascade only for truly removed)
      const toDelete = originalIds.filter(oid => !keptIds.includes(oid))
      if (toDelete.length) await supabase.from('vol_shift_slots').delete().in('id', toDelete)

      // Update existing slots in place (preserves signups)
      for (const [i, s] of valid.filter(s => s.id).entries()) {
        await supabase.from('vol_shift_slots').update({
          time_label: s.time_label, duration: s.duration || null, role: null,
          spots: s.spots ? Number(s.spots) : null, sort_order: valid.indexOf(s)
        }).eq('id', s.id)
      }

      // Insert brand-new slots
      const newSlots = valid.filter(s => !s.id)
      if (newSlots.length) {
        await supabase.from('vol_shift_slots').insert(
          newSlots.map((s, i) => ({ event_id: id, time_label: s.time_label, duration: s.duration || null, role: null, spots: s.spots ? Number(s.spots) : null, sort_order: valid.indexOf(s) }))
        )
      }

      const { data: sl } = await supabase.from('vol_shift_slots').select('*').eq('event_id', id).order('sort_order')
      const slotList = sl || []
      setSlots(slotList)
      setEditSlots(slotList.map(s => ({ ...s })))

      if (slotList.length) {
        const { data: sg } = await supabase.from('vol_slot_signups').select('*').in('slot_id', slotList.map(s => s.id)).order('created_at')
        const grouped = {}
        slotList.forEach(s => { grouped[s.id] = [] })
        ;(sg || []).forEach(s => { if (grouped[s.slot_id]) grouped[s.slot_id].push(s) })
        setSignups(grouped)
      }
    }
    const { data: ev } = await supabase.from('vol_events').select('*').eq('id', id).single()
    setEvent(ev)
    setSaving(false)
    setEditing(false)
  }

  if (loading) return <LoadingScreen />
  if (!event)  return <NotFound />

  const isShift = event.event_type === 'shift'
  const rsvpCounts = { yes: 0, plus1: 0, no: 0 }
  responses.forEach(r => { if (rsvpCounts[r.response] !== undefined) rsvpCounts[r.response]++ })

  return (
    <div className="min-h-screen bg-[#faf8f4] flex flex-col" style={SANS}>
      <TopBar />
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        <button onClick={onBack} className="flex items-center gap-2 text-[#886c44] font-bold text-sm mb-8 hover:text-[#6d5436] transition">
          <ArrowLeft size={16} /> Back to dashboard
        </button>

        {editing ? (
          <div className="bg-white p-8 rounded-xl border-2 border-[#e8e4dc] mb-6">
            <p className="text-xs uppercase tracking-widest text-[#9e8b6f] font-bold mb-5">Edit Event</p>
            <div className="space-y-4 mb-6">
              <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} placeholder="Event title" className={INPUT} style={SANS} />
              <div className="grid grid-cols-2 gap-4">
                <input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} className={INPUT} style={SANS} />
                <input type="text" placeholder="e.g. 9:00 AM – 5:00 PM" value={editForm.time} onChange={e => setEditForm({ ...editForm, time: e.target.value })} className={INPUT} style={SANS} />
              </div>
              <textarea placeholder="Description (optional)" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className={INPUT} rows={2} style={SANS} />
            </div>
            {isShift && (
              <div className="mb-6">
                <p className="text-sm font-bold text-[#2c2418] uppercase tracking-wide mb-3">Time Slots</p>
                <div className="space-y-3 mb-3">
                  {editSlots.map((slot, i) => (
                    <SlotCard key={i} slot={slot} index={i} total={editSlots.length}
                      onChange={(field, val) => { const s = [...editSlots]; s[i] = { ...s[i], [field]: val }; setEditSlots(s) }}
                      onRemove={() => setEditSlots(editSlots.filter((_, idx) => idx !== i))} />
                  ))}
                </div>
                <button onClick={() => setEditSlots([...editSlots, { time_label: '', duration: '', spots: '' }])}
                  className="flex items-center gap-2 text-sm text-[#886c44] font-bold hover:text-[#6d5436] transition">
                  <Plus size={14} /> Add time slot
                </button>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving} className="px-6 py-3 bg-[#886c44] text-white rounded-xl text-sm font-bold hover:bg-[#6d5436] transition disabled:opacity-60">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button onClick={() => { setEditing(false); setEditForm({ title: event.title, date: event.date || '', time: event.time || '', description: event.description || '' }); setEditSlots(slots.map(s => ({ ...s }))) }}
                className="px-6 py-3 rounded-xl text-sm font-bold text-[#9e8b6f] hover:bg-[#f0e6d8] transition">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#886c44] font-bold mb-2">{isShift ? 'Shift Sign-up' : 'RSVP Event'}</p>
              <h2 className="text-4xl font-normal text-[#2c2418] mb-2" style={SERIF}>{event.title}</h2>
              {(event.date || event.time) && <p className="text-base text-[#886c44] font-bold mb-2">{event.date}{event.date && event.time ? ' · ' : ''}{event.time}</p>}
              {event.description && <p className="text-base text-[#2c2418]">{event.description}</p>}
            </div>
            <button onClick={() => setEditing(true)}
              className="ml-6 mt-1 px-4 py-2 border-2 border-[#886c44] text-[#886c44] rounded-lg text-sm font-bold hover:bg-[#886c44] hover:text-white transition flex-shrink-0">
              Edit
            </button>
          </div>
        )}

        {!isShift && (
          <div className="bg-white p-8 rounded-xl border-2 border-[#e8e4dc]">
            <p className="text-xs uppercase tracking-widest text-[#9e8b6f] font-bold mb-5">RSVPs ({responses.length})</p>
            {responses.length === 0 ? (
              <p className="text-[#9e8b6f] font-bold">No RSVPs yet.</p>
            ) : (
              <>
                <div className="flex gap-8 mb-6">
                  {[['yes', 'Yes'], ['plus1', '+1'], ['no', 'No']].map(([key, label]) => (
                    <div key={key} className="text-center">
                      <p className="text-3xl font-normal text-[#2c2418]" style={SERIF}>{rsvpCounts[key]}</p>
                      <p className="text-xs font-bold text-[#886c44] uppercase tracking-wide">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  {responses.map(r => (
                    <div key={r.id} className="flex justify-between items-center py-2 border-b border-[#e8e4dc] last:border-0">
                      <p className="text-base text-[#2c2418] font-bold">{r.name}</p>
                      <p className="text-sm text-[#886c44] font-bold capitalize">{r.response === 'plus1' ? '+1' : r.response}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {isShift && (
          <div className="space-y-4">
            {slots.length === 0 && <p className="text-[#9e8b6f] font-bold">No time slots yet.</p>}
            {slots.map(slot => {
              const su = signups[slot.id] || []
              return (
                <div key={slot.id} className="bg-white p-6 rounded-xl border-2 border-[#e8e4dc]">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-lg font-bold text-[#2c2418]">{slot.time_label}</p>
                      {slot.duration && <p className="text-sm text-[#886c44] font-medium">{slot.duration}</p>}
                    </div>
                    <p className="text-sm font-bold text-[#9e8b6f]">{su.length}{slot.spots ? `/${slot.spots}` : ''} signed up</p>
                  </div>
                  {su.length === 0
                    ? <p className="text-sm text-[#9e8b6f] font-bold">No signups yet.</p>
                    : <div className="space-y-1">{su.map(s => <p key={s.id} className="text-base text-[#2c2418]">{s.name}</p>)}</div>
                  }
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Admin: Poll detail + edit ──────────────────────────────────────────────────

function PollDetail({ id, onBack }) {
  const [poll,    setPoll]    = useState(null)
  const [votes,   setVotes]   = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [editPoll, setEditPoll] = useState({ question: '', options: [] })

  useEffect(() => {
    async function load() {
      const { data: po } = await supabase.from('vol_polls').select('*').eq('id', id).single()
      if (!po) { setLoading(false); return }
      setPoll(po)
      setEditPoll({ question: po.question, options: [...po.options] })
      const { data: vt } = await supabase.from('vol_poll_votes').select('*').eq('poll_id', id).order('created_at')
      setVotes(vt || [])
      setLoading(false)
    }
    load()
  }, [id])

  const handleSave = async () => {
    setSaving(true)
    const opts = editPoll.options.filter(o => o.trim())
    await supabase.from('vol_polls').update({ question: editPoll.question.trim(), options: opts }).eq('id', id)
    const { data: po } = await supabase.from('vol_polls').select('*').eq('id', id).single()
    setPoll(po)
    setSaving(false)
    setEditing(false)
  }

  if (loading) return <LoadingScreen />
  if (!poll)   return <NotFound />

  const total  = votes.length
  const counts = {}
  poll.options.forEach(o => { counts[o] = 0 })
  votes.forEach(v => { if (counts[v.option] !== undefined) counts[v.option]++ })

  return (
    <div className="min-h-screen bg-[#faf8f4] flex flex-col" style={SANS}>
      <TopBar />
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        <button onClick={onBack} className="flex items-center gap-2 text-[#886c44] font-bold text-sm mb-8 hover:text-[#6d5436] transition">
          <ArrowLeft size={16} /> Back to dashboard
        </button>

        {editing ? (
          <div className="bg-white p-8 rounded-xl border-2 border-[#e8e4dc] mb-6">
            <p className="text-xs uppercase tracking-widest text-[#9e8b6f] font-bold mb-5">Edit Poll</p>
            <input value={editPoll.question} onChange={e => setEditPoll({ ...editPoll, question: e.target.value })} placeholder="Poll question" className={`${INPUT} mb-4`} style={SANS} />
            <div className="space-y-3 mb-3">
              {editPoll.options.map((opt, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input placeholder={`Option ${i + 1}`} value={opt}
                    onChange={e => { const o = [...editPoll.options]; o[i] = e.target.value; setEditPoll({ ...editPoll, options: o }) }}
                    className={`${INPUT} flex-1`} style={SANS} />
                  {editPoll.options.length > 2 && (
                    <button onClick={() => setEditPoll({ ...editPoll, options: editPoll.options.filter((_, idx) => idx !== i) })}
                      className="text-[#9e8b6f] hover:text-red-500 transition flex-shrink-0"><X size={16} /></button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setEditPoll({ ...editPoll, options: [...editPoll.options, ''] })}
              className="flex items-center gap-1 text-sm text-[#886c44] font-bold hover:text-[#6d5436] transition mb-6">
              <Plus size={14} /> Add option
            </button>
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving} className="px-6 py-3 bg-[#886c44] text-white rounded-xl text-sm font-bold hover:bg-[#6d5436] transition disabled:opacity-60">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button onClick={() => { setEditing(false); setEditPoll({ question: poll.question, options: [...poll.options] }) }}
                className="px-6 py-3 rounded-xl text-sm font-bold text-[#9e8b6f] hover:bg-[#f0e6d8] transition">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#886c44] font-bold mb-2">Poll</p>
              <h2 className="text-4xl font-normal text-[#2c2418]" style={SERIF}>{poll.question}</h2>
            </div>
            <button onClick={() => setEditing(true)}
              className="ml-6 mt-1 px-4 py-2 border-2 border-[#886c44] text-[#886c44] rounded-lg text-sm font-bold hover:bg-[#886c44] hover:text-white transition flex-shrink-0">
              Edit
            </button>
          </div>
        )}

        <div className="bg-white p-8 rounded-xl border-2 border-[#e8e4dc] mb-4">
          <p className="text-xs uppercase tracking-widest text-[#9e8b6f] font-bold mb-5">Results — {total} vote{total !== 1 ? 's' : ''}</p>
          {total === 0 ? <p className="text-[#9e8b6f] font-bold">No votes yet.</p> : (
            <div className="space-y-4">
              {poll.options.map((opt, i) => {
                const c = counts[opt] || 0
                const pct = total > 0 ? Math.round((c / total) * 100) : 0
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[#2c2418] font-bold">{opt}</span>
                      <span className="text-[#886c44] font-bold">{c} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-[#f0e6d8] rounded-full">
                      <div className="h-2 bg-[#886c44] rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {votes.length > 0 && (
          <div className="bg-white p-8 rounded-xl border-2 border-[#e8e4dc]">
            <p className="text-xs uppercase tracking-widest text-[#9e8b6f] font-bold mb-4">All Votes</p>
            <div className="space-y-1">
              {votes.map(v => (
                <div key={v.id} className="flex justify-between items-center py-2 border-b border-[#e8e4dc] last:border-0">
                  <p className="text-base text-[#2c2418] font-bold">{v.name}</p>
                  <p className="text-sm text-[#886c44] font-bold">{v.option}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Admin: Form detail + edit ──────────────────────────────────────────────────

function FormDetail({ id, onBack }) {
  const [form,      setForm]      = useState(null)
  const [responses, setResponses] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [editing,   setEditing]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [editMeta,  setEditMeta]  = useState({ title: '', description: '' })
  const [editFields, setEditFields] = useState([])

  useEffect(() => {
    async function load() {
      const { data: fo } = await supabase.from('nsh_forms').select('*').eq('id', id).single()
      if (!fo) { setLoading(false); return }
      setForm(fo)
      setEditMeta({ title: fo.title, description: fo.description || '' })
      setEditFields(fo.fields || [])
      const { data: res } = await supabase.from('nsh_form_responses').select('*').eq('form_id', id).order('created_at', { ascending: false })
      setResponses(res || [])
      setLoading(false)
    }
    load()
  }, [id])

  const handleSave = async () => {
    setSaving(true)
    const fields = editFields
      .filter(q => q.label.trim())
      .map(({ id, type, label, required, options }) => ({
        id, type, label: label.trim(), required,
        ...((['multiple_choice', 'checkboxes'].includes(type)) && { options: (options || []).filter(o => o.trim()) })
      }))
    await supabase.from('nsh_forms').update({ title: editMeta.title.trim(), description: editMeta.description.trim() || null, fields }).eq('id', id)
    const { data: fo } = await supabase.from('nsh_forms').select('*').eq('id', id).single()
    setForm(fo)
    setEditFields(fo.fields || [])
    setSaving(false)
    setEditing(false)
  }

  if (loading) return <LoadingScreen />
  if (!form)   return <NotFound />

  return (
    <div className="min-h-screen bg-[#faf8f4] flex flex-col" style={SANS}>
      <TopBar />
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        <button onClick={onBack} className="flex items-center gap-2 text-[#886c44] font-bold text-sm mb-8 hover:text-[#6d5436] transition">
          <ArrowLeft size={16} /> Back to dashboard
        </button>

        {editing ? (
          <div className="bg-white p-8 rounded-xl border-2 border-[#e8e4dc] mb-6">
            <p className="text-xs uppercase tracking-widest text-[#9e8b6f] font-bold mb-5">Edit Form</p>
            <div className="space-y-4 mb-6">
              <input value={editMeta.title} onChange={e => setEditMeta({ ...editMeta, title: e.target.value })} placeholder="Form title" className={INPUT} style={SANS} />
              <textarea placeholder="Description (optional)" value={editMeta.description} onChange={e => setEditMeta({ ...editMeta, description: e.target.value })} className={INPUT} rows={2} style={SANS} />
            </div>
            <p className="text-sm font-bold text-[#2c2418] uppercase tracking-wide mb-3">Questions</p>
            <div className="space-y-3 mb-4">
              {editFields.map((q, i) => (
                <QuestionEditor key={q.id} question={q} index={i}
                  onUpdate={updated => { const qs = [...editFields]; qs[i] = updated; setEditFields(qs) }}
                  onRemove={() => setEditFields(editFields.filter((_, idx) => idx !== i))}
                  canRemove={editFields.length > 1} />
              ))}
            </div>
            <button onClick={() => setEditFields([...editFields, mkQuestion()])}
              className="flex items-center gap-2 text-sm text-[#886c44] font-bold hover:text-[#6d5436] transition mb-6">
              <Plus size={14} /> Add question
            </button>
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving} className="px-6 py-3 bg-[#886c44] text-white rounded-xl text-sm font-bold hover:bg-[#6d5436] transition disabled:opacity-60">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button onClick={() => { setEditing(false); setEditMeta({ title: form.title, description: form.description || '' }); setEditFields(form.fields || []) }}
                className="px-6 py-3 rounded-xl text-sm font-bold text-[#9e8b6f] hover:bg-[#f0e6d8] transition">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#886c44] font-bold mb-2">Form</p>
              <h2 className="text-4xl font-normal text-[#2c2418] mb-1" style={SERIF}>{form.title}</h2>
              {form.description && <p className="text-base text-[#2c2418] mt-1">{form.description}</p>}
              <p className="text-sm text-[#886c44] font-bold mt-2">
                {form.fields?.length ?? 0} question{(form.fields?.length ?? 0) !== 1 ? 's' : ''} · {responses.length} response{responses.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button onClick={() => setEditing(true)}
              className="ml-6 mt-1 px-4 py-2 border-2 border-[#886c44] text-[#886c44] rounded-lg text-sm font-bold hover:bg-[#886c44] hover:text-white transition flex-shrink-0">
              Edit
            </button>
          </div>
        )}

        {!editing && responses.length > 0 && (
          <div className="bg-white p-8 rounded-xl border-2 border-[#e8e4dc]">
            <p className="text-xs uppercase tracking-widest text-[#9e8b6f] font-bold mb-5">Responses</p>
            <div className="space-y-6">
              {responses.map(r => (
                <div key={r.id} className="pb-6 border-b border-[#e8e4dc] last:border-0 last:pb-0">
                  <p className="text-xs text-[#9e8b6f] font-bold mb-3">
                    {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                  <div className="space-y-3">
                    {(form.fields || []).map(field => {
                      const ans = r.answers?.[field.id]
                      if (ans === undefined || ans === null || ans === '') return null
                      return (
                        <div key={field.id}>
                          <p className="text-xs font-bold text-[#9e8b6f] uppercase tracking-wide mb-0.5">{field.label}</p>
                          <p className="text-base text-[#2c2418]">{Array.isArray(ans) ? ans.join(', ') : String(ans)}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!editing && responses.length === 0 && (
          <div className="bg-white p-8 rounded-xl border-2 border-[#e8e4dc]">
            <p className="text-[#9e8b6f] font-bold">No responses yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Admin Dashboard ───────────────────────────────────────────────────────────

function AdminDashboard() {
  const [events, setEvents] = useState([])
  const [polls, setPolls]   = useState([])
  const [forms, setForms]   = useState([])
  const [copiedId, setCopiedId] = useState(null)
  const [active, setActive] = useState(null)
  const [saving,     setSaving]     = useState(null)
  const [detailView, setDetailView] = useState(null)

  // Event form
  const [eventType, setEventType] = useState('rsvp')
  const [eventForm, setEventForm] = useState({ title: '', date: '', time: '', description: '' })
  const [slots, setSlots] = useState([{ time_label: '', duration: '', spots: '' }])

  // Poll form
  const [pollForm, setPollForm] = useState({ question: '', options: ['', ''] })

  // Form builder
  const [formMeta, setFormMeta]           = useState({ title: '', description: '' })
  const [formQuestions, setFormQuestions] = useState([mkQuestion()])

  const fetchAll = useCallback(async () => {
    const [{ data: ev }, { data: po }, { data: fo }] = await Promise.all([
      supabase.from('vol_events').select('*, vol_event_responses(count), vol_shift_slots(count)').order('created_at', { ascending: false }),
      supabase.from('vol_polls').select('*, vol_poll_votes(count)').order('created_at', { ascending: false }),
      supabase.from('nsh_forms').select('*, nsh_form_responses(count)').order('created_at', { ascending: false }),
    ])
    setEvents(ev || []); setPolls(po || []); setForms(fo || [])
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const createEvent = async () => {
    if (!eventForm.title.trim()) return
    setSaving('event')
    const { data: ev } = await supabase.from('vol_events').insert({ ...eventForm, event_type: eventType }).select().single()
    if (ev && eventType === 'shift') {
      const validSlots = slots.filter(s => s.time_label.trim())
      if (validSlots.length > 0) {
        await supabase.from('vol_shift_slots').insert(
          validSlots.map((s, i) => ({
            event_id: ev.id,
            time_label: s.time_label,
            duration: s.duration || null,
            role: null,
            spots: s.spots ? Number(s.spots) : null,
            sort_order: i
          }))
        )
      }
    }
    setEventForm({ title: '', date: '', time: '', description: '' })
    setSlots([{ time_label: '', duration: '', spots: '' }])
    await fetchAll(); setSaving(null)
  }

  const createPoll = async () => {
    if (!pollForm.question.trim()) return
    setSaving('poll')
    await supabase.from('vol_polls').insert({ question: pollForm.question, options: pollForm.options.filter(o => o.trim()) })
    setPollForm({ question: '', options: ['', ''] })
    await fetchAll(); setSaving(null)
  }

  const createForm = async () => {
    if (!formMeta.title.trim()) return
    setSaving('form')
    const fields = formQuestions
      .filter(q => q.label.trim())
      .map(({ id, type, label, required, options }) => ({
        id, type, label: label.trim(), required,
        ...((['multiple_choice', 'checkboxes'].includes(type)) && { options: (options || []).filter(o => o.trim()) })
      }))
    await supabase.from('nsh_forms').insert({
      title: formMeta.title.trim(),
      description: formMeta.description.trim() || null,
      fields
    })
    setFormMeta({ title: '', description: '' })
    setFormQuestions([mkQuestion()])
    await fetchAll(); setSaving(null)
  }

  const deleteEvent = async (id) => {
    await supabase.from('vol_events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
  }
  const deletePoll = async (id) => {
    await supabase.from('vol_polls').delete().eq('id', id)
    setPolls(prev => prev.filter(p => p.id !== id))
  }
  const deleteForm = async (id) => {
    await supabase.from('nsh_forms').delete().eq('id', id)
    setForms(prev => prev.filter(f => f.id !== id))
  }

  const copyLink = (type, id, title) => {
    const idParam = (type === 'event' && title) ? `${slugify(title)}__${id}` : id
    const link = `${window.location.origin}${window.location.pathname}?view=${type}&id=${idParam}`
    navigator.clipboard.writeText(link)
    setCopiedId(id); setTimeout(() => setCopiedId(null), 2000)
  }

  const updateSlot = (i, field, val) => {
    const s = [...slots]; s[i] = { ...s[i], [field]: val }; setSlots(s)
  }

  const updateQuestion = (i, updated) => {
    const qs = [...formQuestions]; qs[i] = updated; setFormQuestions(qs)
  }

  const TILES = [
    { key: 'event', label: 'Events', sub: `${events.length} created` },
    { key: 'poll',  label: 'Polls',  sub: `${polls.length} created` },
    { key: 'form',  label: 'Forms',  sub: `${forms.length} created` },
  ]

  const eventMeta = (e) => {
    if (e.event_type === 'shift') {
      const n = e.vol_shift_slots?.[0]?.count ?? 0
      return `Shift sign-up · ${n} time slot${n !== 1 ? 's' : ''}`
    }
    const n = e.vol_event_responses?.[0]?.count ?? 0
    return `RSVP · ${n} response${n !== 1 ? 's' : ''}`
  }

  if (detailView?.type === 'event') return <EventDetail id={detailView.id} onBack={() => { setDetailView(null); fetchAll() }} />
  if (detailView?.type === 'poll')  return <PollDetail  id={detailView.id} onBack={() => { setDetailView(null); fetchAll() }} />
  if (detailView?.type === 'form')  return <FormDetail  id={detailView.id} onBack={() => { setDetailView(null); fetchAll() }} />

  return (
    <div className="min-h-screen bg-[#faf8f4] flex flex-col" style={SANS}>
      <TopBar />
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        <h2 className="text-5xl font-normal mb-2 text-[#2c2418]" style={SERIF}>Volunteer Hub</h2>

        {/* Tiles */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {TILES.map(({ key, label, sub }) => (
            <button key={key} onClick={() => setActive(prev => prev === key ? null : key)}
              className={`p-8 rounded-xl border-2 text-left transition ${active === key ? 'bg-[#886c44] border-[#886c44]' : 'bg-white border-[#e8e4dc] hover:border-[#886c44]'}`}>
              <p className="text-2xl font-normal mb-1" style={{ ...SERIF, color: active === key ? 'white' : '#2c2418' }}>{label}</p>
              <p className={`text-sm font-bold ${active === key ? 'text-[#f0e6d8]' : 'text-[#886c44]'}`}>{sub}</p>
            </button>
          ))}
        </div>

        {/* ── Events panel ── */}
        {active === 'event' && (
          <div>
            <div className="bg-white p-8 rounded-xl border-2 border-[#e8e4dc] mb-4">
              <p className="text-xs uppercase tracking-widest text-[#9e8b6f] font-bold mb-5">New Event</p>
              <div className="flex gap-3 mb-6">
                <button onClick={() => setEventType('rsvp')}
                  className={`px-5 py-2.5 rounded-lg border-2 text-sm font-bold transition ${eventType === 'rsvp' ? 'bg-[#886c44] border-[#886c44] text-white' : 'bg-white border-[#d9cec2] text-[#2c2418] hover:border-[#886c44]'}`}>
                  RSVP Event
                </button>
                <button onClick={() => setEventType('shift')}
                  className={`px-5 py-2.5 rounded-lg border-2 text-sm font-bold transition ${eventType === 'shift' ? 'bg-[#886c44] border-[#886c44] text-white' : 'bg-white border-[#d9cec2] text-[#2c2418] hover:border-[#886c44]'}`}>
                  Shift Sign-up
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <input placeholder="Event title" value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} className={`${INPUT} col-span-2`} style={SANS} />
                <input type="date" value={eventForm.date} onChange={e => setEventForm({ ...eventForm, date: e.target.value })} className={INPUT} style={SANS} />
                <input type="text" placeholder="e.g. 9:00 AM – 5:00 PM" value={eventForm.time} onChange={e => setEventForm({ ...eventForm, time: e.target.value })} className={INPUT} style={SANS} />
              </div>
              <textarea placeholder="Description (optional)" value={eventForm.description} onChange={e => setEventForm({ ...eventForm, description: e.target.value })} className={`${INPUT} mb-6`} rows={2} style={SANS} />
              {eventType === 'shift' && (
                <div className="mb-6">
                  <p className="text-sm font-bold text-[#2c2418] uppercase tracking-wide mb-3">Time Slots</p>
                  <div className="space-y-3 mb-3">
                    {slots.map((slot, i) => (
                      <SlotCard
                        key={i}
                        slot={slot}
                        index={i}
                        total={slots.length}
                        onChange={(field, val) => updateSlot(i, field, val)}
                        onRemove={() => setSlots(slots.filter((_, idx) => idx !== i))}
                      />
                    ))}
                  </div>
                  <button onClick={() => setSlots([...slots, { time_label: '', duration: '', spots: '' }])}
                    className="flex items-center gap-2 text-base text-[#886c44] font-bold hover:text-[#6d5436] transition">
                    <Plus size={16} /> Add time slot
                  </button>
                </div>
              )}
              <button onClick={createEvent} disabled={saving === 'event'} className="px-6 py-3 bg-[#886c44] text-white rounded-xl text-base font-bold hover:bg-[#6d5436] transition disabled:opacity-60">
                {saving === 'event' ? 'Saving…' : eventType === 'shift' ? 'Create Signup Sheet' : 'Create Event'}
              </button>
            </div>
            <div className="space-y-2">
              {events.length === 0 && <p className="text-base text-[#9e8b6f] font-bold py-2">No events yet.</p>}
              {events.map(e => (
                <AdminCard key={e.id} title={e.title} subtitle={e.date || ''} meta={eventMeta(e)}
                  copied={copiedId === e.id} onCopy={() => copyLink('event', e.id, e.title)} onDelete={() => deleteEvent(e.id)}
                  onClick={() => setDetailView({ type: 'event', id: e.id })} />
              ))}
            </div>
          </div>
        )}

        {/* ── Polls panel ── */}
        {active === 'poll' && (
          <div>
            <div className="bg-white p-8 rounded-xl border-2 border-[#e8e4dc] mb-4">
              <p className="text-xs uppercase tracking-widest text-[#9e8b6f] font-bold mb-5">New Poll</p>
              <input placeholder="Poll question" value={pollForm.question} onChange={e => setPollForm({ ...pollForm, question: e.target.value })} className={`${INPUT} mb-4`} style={SANS} />
              <div className="space-y-3 mb-3">
                {pollForm.options.map((opt, i) => (
                  <input key={i} placeholder={`Option ${i + 1}`} value={opt}
                    onChange={e => { const o = [...pollForm.options]; o[i] = e.target.value; setPollForm({ ...pollForm, options: o }) }}
                    className={INPUT} style={SANS} />
                ))}
              </div>
              <div className="flex gap-4 mb-6">
                <button onClick={() => setPollForm({ ...pollForm, options: [...pollForm.options, ''] })} className="text-base text-[#886c44] font-bold hover:text-[#6d5436] transition">+ Add option</button>
                {pollForm.options.length > 2 && (
                  <button onClick={() => setPollForm({ ...pollForm, options: pollForm.options.slice(0, -1) })} className="text-base text-[#9e8b6f] font-bold hover:text-[#2c2418] transition">− Remove last</button>
                )}
              </div>
              <button onClick={createPoll} disabled={saving === 'poll'} className="px-6 py-3 bg-[#886c44] text-white rounded-xl text-base font-bold hover:bg-[#6d5436] transition disabled:opacity-60">
                {saving === 'poll' ? 'Saving…' : 'Create Poll'}
              </button>
            </div>
            <div className="space-y-2">
              {polls.length === 0 && <p className="text-base text-[#9e8b6f] font-bold py-2">No polls yet.</p>}
              {polls.map(p => (
                <AdminCard key={p.id} title={p.question}
                  meta={`${p.vol_poll_votes?.[0]?.count ?? 0} vote${(p.vol_poll_votes?.[0]?.count ?? 0) !== 1 ? 's' : ''}`}
                  copied={copiedId === p.id} onCopy={() => copyLink('poll', p.id)} onDelete={() => deletePoll(p.id)}
                  onClick={() => setDetailView({ type: 'poll', id: p.id })} />
              ))}
            </div>
          </div>
        )}

        {/* ── Forms panel ── */}
        {active === 'form' && (
          <div>
            <div className="bg-white p-8 rounded-xl border-2 border-[#e8e4dc] mb-4">
              <p className="text-xs uppercase tracking-widest text-[#9e8b6f] font-bold mb-5">New Form</p>

              <div className="space-y-4 mb-6">
                <input
                  placeholder="Form title"
                  value={formMeta.title}
                  onChange={e => setFormMeta({ ...formMeta, title: e.target.value })}
                  className={INPUT} style={SANS}
                />
                <textarea
                  placeholder="Description (optional)"
                  value={formMeta.description}
                  onChange={e => setFormMeta({ ...formMeta, description: e.target.value })}
                  className={INPUT} rows={2} style={SANS}
                />
              </div>

              <p className="text-sm font-bold text-[#2c2418] uppercase tracking-wide mb-3">Questions</p>
              <div className="space-y-3 mb-4">
                {formQuestions.map((q, i) => (
                  <QuestionEditor
                    key={q.id}
                    question={q}
                    index={i}
                    onUpdate={updated => updateQuestion(i, updated)}
                    onRemove={() => setFormQuestions(formQuestions.filter((_, idx) => idx !== i))}
                    canRemove={formQuestions.length > 1}
                  />
                ))}
              </div>

              <div className="flex gap-4 mb-6">
                <button
                  onClick={() => setFormQuestions([...formQuestions, mkQuestion()])}
                  className="flex items-center gap-2 text-base text-[#886c44] font-bold hover:text-[#6d5436] transition">
                  <Plus size={16} /> Add question
                </button>
              </div>

              <button
                onClick={createForm}
                disabled={saving === 'form'}
                className="px-6 py-3 bg-[#886c44] text-white rounded-xl text-base font-bold hover:bg-[#6d5436] transition disabled:opacity-60">
                {saving === 'form' ? 'Saving…' : 'Create Form'}
              </button>
            </div>

            <div className="space-y-2">
              {forms.length === 0 && <p className="text-base text-[#9e8b6f] font-bold py-2">No forms yet.</p>}
              {forms.map(f => (
                <AdminCard
                  key={f.id}
                  title={f.title}
                  meta={`${f.fields?.length ?? 0} question${(f.fields?.length ?? 0) !== 1 ? 's' : ''} · ${f.nsh_form_responses?.[0]?.count ?? 0} response${(f.nsh_form_responses?.[0]?.count ?? 0) !== 1 ? 's' : ''}`}
                  copied={copiedId === f.id}
                  onCopy={() => copyLink('form', f.id)}
                  onDelete={() => deleteForm(f.id)}
                  onClick={() => setDetailView({ type: 'form', id: f.id })}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="bg-white border-t-2 border-[#e8e4dc]">
        <div className="max-w-5xl mx-auto px-6 py-6 text-center">
          <p className="text-sm text-[#9e8b6f] font-bold">North Star House • Grass Valley, CA</p>
        </div>
      </footer>
    </div>
  )
}

function AdminCard({ title, subtitle, meta, copied, onCopy, onDelete, onClick }) {
  return (
    <div className="flex justify-between items-center bg-white border-2 border-[#e8e4dc] rounded-xl hover:border-[#886c44] transition overflow-hidden">
      <button onClick={onClick} className="flex-1 min-w-0 text-left px-5 py-4 hover:bg-[#faf8f4] transition">
        <p className="font-normal text-[#2c2418] truncate text-lg" style={SERIF}>{title}</p>
        {subtitle && <p className="text-sm text-[#9e8b6f] font-bold mt-0.5">{subtitle}</p>}
        {meta    && <p className="text-sm text-[#886c44] font-bold mt-0.5">{meta}</p>}
      </button>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={onCopy} className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-[#f0e6d8] transition text-sm font-bold" style={{ color: copied ? '#886c44' : '#9e8b6f' }}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? 'Copied!' : 'Copy link'}
        </button>
        <button onClick={onDelete} className="px-3 py-2 rounded-lg hover:bg-[#f0e6d8] text-[#9e8b6f] hover:text-[#2c2418] text-sm font-bold transition">Delete</button>
      </div>
    </div>
  )
}

// ─── Router ────────────────────────────────────────────────────────────────────

export default function App() {
  const params = new URLSearchParams(window.location.search)
  const view = params.get('view')
  const rawId = params.get('id')
  const id   = rawId?.includes('__') ? rawId.split('__').pop() : rawId

  if (view === 'event' && id) return <EventPage id={id} />
  if (view === 'poll'  && id) return <PollPage id={id} />
  if (view === 'form'  && id) return <FormPage id={id} />
  return <AdminDashboard />
}
