import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { Check, Calendar, MapPin } from 'lucide-react'
import { supabase } from './supabase'
import { FONT, DISPLAY, SERIF, SANS, INPUT, fmtDate, fmtTime, TopBar, LoadingScreen, NotFound } from './shared.jsx'

const AdminDashboard = lazy(() => import('./AdminDashboard.jsx'))


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
                <div className="flex flex-wrap gap-3">
                  {(event.options?.length ? event.options : ['Attending', 'Attending +1', "Can't Make It"]).map(opt => (
                    <button key={opt} onClick={() => handleRSVP(opt)} disabled={!name.trim()}
                      className="flex-1 min-w-[120px] py-3 px-4 bg-[#886c44] text-white rounded-lg text-sm font-semibold hover:bg-[#6d5436] transition disabled:opacity-40">
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
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
                      <div className="flex-1 min-w-0 max-w-[65%]">
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
    const [{ data: p }, { data: v }] = await Promise.all([
      supabase.from('vol_polls').select('*').eq('id', id).single(),
      supabase.from('vol_poll_votes').select('*').eq('poll_id', id).order('created_at'),
    ])
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


// ─── Router ────────────────────────────────────────────────────────────────────

export default function App() {
  const params = new URLSearchParams(window.location.search)
  const view = params.get('view')
  const rawId = params.get('id')
  const id   = rawId?.includes('__') ? rawId.split('__').pop() : rawId

  if (view === 'event' && id) return <EventPage id={id} />
  if (view === 'poll'  && id) return <PollPage id={id} />
  if (view === 'form'  && id) return <FormPage id={id} />
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AdminDashboard />
    </Suspense>
  )
}
