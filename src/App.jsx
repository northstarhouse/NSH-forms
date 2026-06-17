import React, { useState, useEffect, useCallback } from 'react'
import { Copy, ArrowLeft, Check, Plus, X } from 'lucide-react'
import { supabase } from './supabase'

const SERIF = { fontFamily: "'Cormorant Garamond', serif" }
const SANS  = { fontFamily: "'Lato', sans-serif" }
const INPUT = "w-full p-3 border-2 border-[#d9cec2] rounded-lg text-base font-normal focus:outline-none focus:border-[#886c44] bg-white"

// ─── Shared UI ────────────────────────────────────────────────────────────────

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
            <h1 className="text-3xl font-normal text-[#2c2418]" style={SERIF}>North Star House</h1>
            <p className="text-sm text-[#886c44] font-bold tracking-wide uppercase" style={SANS}>Volunteer Engagement Hub</p>
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

// ─── Volunteer: Event Page (handles both RSVP and shift) ──────────────────────

function EventPage({ id }) {
  const [event, setEvent]     = useState(null)
  const [responses, setResponses] = useState([])
  const [slots, setSlots]     = useState([])
  const [signups, setSignups] = useState({})   // slotId → [signup]
  const [name, setName]       = useState('')
  const [submitted, setSubmitted] = useState(false)  // rsvp
  const [signedSlot, setSignedSlot] = useState(null) // shift slot id
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
    if (!name.trim()) return
    const slot = slots.find(s => s.id === slotId)
    const current = signups[slotId] || []
    if (slot?.spots && current.length >= slot.spots) return
    const { error } = await supabase.from('vol_slot_signups').insert({ slot_id: slotId, name: name.trim() })
    if (!error) setSignedSlot(slotId)
  }

  if (loading) return <LoadingScreen />
  if (!event) return <NotFound />

  const isShift = event.event_type === 'shift'
  const counts = { yes: 0, maybe: 0, no: 0 }
  responses.forEach(r => { if (counts[r.response] !== undefined) counts[r.response]++ })

  return (
    <div className="min-h-screen bg-[#f0e6d8]" style={SANS}>
      <TopBar onBack={() => window.history.back()} />
      <div className="max-w-3xl mx-auto px-6 py-14">

        {/* Header */}
        <p className="text-sm uppercase tracking-widest text-[#886c44] font-bold mb-3">
          {isShift ? 'Volunteer Sign-Up' : 'Event'}
        </p>
        <h1 className="text-6xl font-normal mb-4 text-[#2c2418] leading-tight" style={SERIF}>{event.title}</h1>
        {(event.date || event.time) && (
          <p className="text-xl text-[#886c44] font-bold mb-3">
            {event.date}{event.date && event.time ? ' at ' : ''}{event.time}
          </p>
        )}
        {event.description && (
          <p className="text-lg text-[#2c2418] font-normal mb-10 leading-relaxed max-w-2xl">{event.description}</p>
        )}

        {/* ── RSVP mode ── */}
        {!isShift && (
          <>
            {submitted ? (
              <div className="flex items-center gap-3 py-5 px-6 mb-10 bg-white rounded-xl border-2 border-[#886c44]">
                <Check size={22} className="text-[#886c44] flex-shrink-0" />
                <p className="text-lg text-[#2c2418] font-bold">Thanks, {name}! Your response has been recorded.</p>
              </div>
            ) : (
              <div className="mb-12 space-y-4">
                <p className="text-base text-[#2c2418] font-bold">Enter your name to RSVP:</p>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className={`${INPUT} max-w-sm`} style={SANS} />
                <div className="flex gap-3 flex-wrap pt-1">
                  <button onClick={() => handleRSVP('yes')} disabled={!name.trim()} className="px-8 py-4 bg-[#886c44] text-white rounded-xl text-base font-bold hover:bg-[#6d5436] transition disabled:opacity-40">I'm Coming</button>
                  <button onClick={() => handleRSVP('maybe')} disabled={!name.trim()} className="px-8 py-4 bg-white text-[#2c2418] border-2 border-[#886c44] rounded-xl text-base font-bold hover:bg-[#f0ede8] transition disabled:opacity-40">Maybe</button>
                  <button onClick={() => handleRSVP('no')} disabled={!name.trim()} className="px-8 py-4 bg-white text-[#2c2418] border-2 border-[#886c44] rounded-xl text-base font-bold hover:bg-[#f0ede8] transition disabled:opacity-40">Can't Make It</button>
                </div>
              </div>
            )}
            {responses.length > 0 && (
              <div className="bg-white p-8 rounded-xl border-2 border-[#e8e4dc] max-w-lg">
                <div className="flex gap-8 mb-6 pb-6 border-b-2 border-[#e8e4dc]">
                  <div className="text-center"><p className="text-3xl font-bold text-[#886c44]">{counts.yes}</p><p className="text-sm font-bold text-[#2c2418] uppercase tracking-wide">Coming</p></div>
                  <div className="text-center"><p className="text-3xl font-bold text-[#9e8b6f]">{counts.maybe}</p><p className="text-sm font-bold text-[#2c2418] uppercase tracking-wide">Maybe</p></div>
                  <div className="text-center"><p className="text-3xl font-bold text-[#9e8b6f]">{counts.no}</p><p className="text-sm font-bold text-[#2c2418] uppercase tracking-wide">Can't Make It</p></div>
                </div>
                <div className="space-y-2">
                  {responses.map(r => (
                    <p key={r.id} className="text-base text-[#2c2418] font-normal">
                      {r.name} <span className="text-[#886c44] font-bold">— {r.response === 'yes' ? 'Coming' : r.response === 'maybe' ? 'Maybe' : "Can't make it"}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Shift mode ── */}
        {isShift && (
          <>
            <div className="bg-white rounded-xl border-2 border-[#e8e4dc] p-6 mb-6 max-w-lg">
              <p className="text-base font-bold text-[#2c2418] mb-3">Your name</p>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name to sign up for a shift" className={INPUT} style={SANS} />
            </div>

            <div className="space-y-4">
              {slots.map(slot => {
                const slotSignups = signups[slot.id] || []
                const spotsLeft = slot.spots != null ? slot.spots - slotSignups.length : null
                const isFull = spotsLeft !== null && spotsLeft <= 0
                const didSignUp = signedSlot === slot.id

                return (
                  <div key={slot.id} className={`bg-white rounded-xl border-2 p-6 transition ${isFull ? 'border-[#d9cec2] opacity-60' : 'border-[#e8e4dc] hover:border-[#886c44]'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {slot.time_label && <p className="text-2xl font-normal text-[#2c2418] mb-2" style={SERIF}>{slot.time_label}</p>}
                        <div className="flex flex-wrap gap-3 mb-2">
                          {slot.duration && <span className="text-base font-bold text-[#886c44]">{slot.duration}</span>}
                          {slot.role     && <span className="text-base font-bold text-[#886c44]">{slot.role}</span>}
                        </div>
                        {spotsLeft !== null && (
                          <p className={`text-sm font-bold ${isFull ? 'text-red-500' : 'text-[#9e8b6f]'}`}>
                            {isFull ? 'Full' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} remaining`}
                          </p>
                        )}
                        {slotSignups.length > 0 && (
                          <p className="text-sm text-[#9e8b6f] font-semibold mt-1">
                            Signed up: {slotSignups.map(s => s.name).join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0 pt-1">
                        {didSignUp ? (
                          <div className="flex items-center gap-2 text-[#886c44]">
                            <Check size={20} />
                            <span className="text-base font-bold">Signed up!</span>
                          </div>
                        ) : (
                          <button onClick={() => handleShiftSignup(slot.id)} disabled={!name.trim() || isFull}
                            className="px-6 py-3 bg-[#886c44] text-white rounded-xl text-base font-bold hover:bg-[#6d5436] transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
                            {isFull ? 'Full' : 'Sign Up'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              {slots.length === 0 && (
                <p className="text-base text-[#9e8b6f] font-bold">No time slots have been added yet.</p>
              )}
            </div>
          </>
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

// ─── Admin Dashboard ───────────────────────────────────────────────────────────

function AdminDashboard() {
  const [events, setEvents] = useState([])
  const [polls, setPolls]   = useState([])
  const [copiedId, setCopiedId] = useState(null)
  const [active, setActive] = useState(null)  // 'event' | 'poll' | null
  const [saving, setSaving] = useState(null)

  // Event form
  const [eventType, setEventType] = useState('rsvp')  // 'rsvp' | 'shift'
  const [eventForm, setEventForm] = useState({ title: '', date: '', time: '', description: '' })
  const [slots, setSlots] = useState([{ time_label: '', duration: '', role: '', spots: '' }])

  // Poll form
  const [pollForm, setPollForm] = useState({ question: '', options: ['', ''] })

  const fetchAll = useCallback(async () => {
    const [{ data: ev }, { data: po }] = await Promise.all([
      supabase.from('vol_events').select('*, vol_event_responses(count), vol_shift_slots(count)').order('created_at', { ascending: false }),
      supabase.from('vol_polls').select('*, vol_poll_votes(count)').order('created_at', { ascending: false }),
    ])
    setEvents(ev || []); setPolls(po || [])
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
            duration: s.duration,
            role: s.role,
            spots: s.spots ? Number(s.spots) : null,
            sort_order: i
          }))
        )
      }
    }
    setEventForm({ title: '', date: '', time: '', description: '' })
    setSlots([{ time_label: '', duration: '', role: '', spots: '' }])
    await fetchAll(); setSaving(null)
  }

  const createPoll = async () => {
    if (!pollForm.question.trim()) return
    setSaving('poll')
    await supabase.from('vol_polls').insert({ question: pollForm.question, options: pollForm.options.filter(o => o.trim()) })
    setPollForm({ question: '', options: ['', ''] })
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

  const copyLink = (type, id) => {
    const link = `${window.location.origin}${window.location.pathname}?view=${type}&id=${id}`
    navigator.clipboard.writeText(link)
    setCopiedId(id); setTimeout(() => setCopiedId(null), 2000)
  }

  const updateSlot = (i, field, val) => {
    const s = [...slots]; s[i] = { ...s[i], [field]: val }; setSlots(s)
  }

  const TILES = [
    { key: 'event', label: 'Events', sub: `${events.length} created` },
    { key: 'poll',  label: 'Polls',  sub: `${polls.length} created` },
  ]

  const eventMeta = (e) => {
    if (e.event_type === 'shift') {
      const n = e.vol_shift_slots?.[0]?.count ?? 0
      return `Shift sign-up · ${n} time slot${n !== 1 ? 's' : ''}`
    }
    const n = e.vol_event_responses?.[0]?.count ?? 0
    return `RSVP · ${n} response${n !== 1 ? 's' : ''}`
  }

  return (
    <div className="min-h-screen bg-[#faf8f4] flex flex-col" style={SANS}>
      <TopBar />
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        <h2 className="text-5xl font-normal mb-2 text-[#2c2418]" style={SERIF}>Volunteer Hub</h2>
        <p className="text-base text-[#9e8b6f] font-bold mb-10">Select a category to create or manage.</p>

        {/* Tiles */}
        <div className="grid grid-cols-2 gap-4 mb-8">
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

              {/* Type toggle */}
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

              {/* Common fields */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <input placeholder="Event title" value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} className={`${INPUT} col-span-2`} style={SANS} />
                <input type="date" value={eventForm.date} onChange={e => setEventForm({ ...eventForm, date: e.target.value })} className={INPUT} style={SANS} />
                {eventType === 'rsvp' && <input type="time" value={eventForm.time} onChange={e => setEventForm({ ...eventForm, time: e.target.value })} className={INPUT} style={SANS} />}
              </div>
              <textarea placeholder="Description (optional)" value={eventForm.description} onChange={e => setEventForm({ ...eventForm, description: e.target.value })} className={`${INPUT} mb-6`} rows={2} style={SANS} />

              {/* Shift-only: slot builder */}
              {eventType === 'shift' && (
                <div className="mb-6">
                  <p className="text-sm font-bold text-[#2c2418] uppercase tracking-wide mb-3">Time Slots</p>
                  <div className="space-y-3 mb-3">
                    {slots.map((slot, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-center">
                        <input placeholder="Time (e.g. 9am – 11am)" value={slot.time_label} onChange={e => updateSlot(i, 'time_label', e.target.value)} className={`${INPUT} col-span-4`} style={SANS} />
                        <input placeholder="Duration" value={slot.duration} onChange={e => updateSlot(i, 'duration', e.target.value)} className={`${INPUT} col-span-3`} style={SANS} />
                        <input placeholder="Role" value={slot.role} onChange={e => updateSlot(i, 'role', e.target.value)} className={`${INPUT} col-span-3`} style={SANS} />
                        <input type="number" placeholder="Spots" value={slot.spots} onChange={e => updateSlot(i, 'spots', e.target.value)} className={`${INPUT} col-span-1`} style={SANS} />
                        {slots.length > 1 && (
                          <button onClick={() => setSlots(slots.filter((_, idx) => idx !== i))} className="col-span-1 flex justify-center text-[#9e8b6f] hover:text-red-500 transition">
                            <X size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setSlots([...slots, { time_label: '', duration: '', role: '', spots: '' }])}
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
                <AdminCard key={e.id} title={e.title} subtitle={e.date || ''}
                  meta={eventMeta(e)}
                  copied={copiedId === e.id} onCopy={() => copyLink('event', e.id)} onDelete={() => deleteEvent(e.id)} />
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
                  copied={copiedId === p.id} onCopy={() => copyLink('poll', p.id)} onDelete={() => deletePoll(p.id)} />
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="bg-white border-t-2 border-[#e8e4dc]">
        <div className="max-w-5xl mx-auto px-6 py-6 text-center">
          <p className="text-sm text-[#9e8b6f] font-bold">North Star House • Grass Valley, CA • (530) 273-4667</p>
        </div>
      </footer>
    </div>
  )
}

function AdminCard({ title, subtitle, meta, copied, onCopy, onDelete }) {
  return (
    <div className="flex justify-between items-center p-5 bg-white border-2 border-[#e8e4dc] rounded-xl hover:border-[#886c44] transition">
      <div className="flex-1 min-w-0 mr-4">
        <p className="font-normal text-[#2c2418] truncate text-lg" style={SERIF}>{title}</p>
        {subtitle && <p className="text-sm text-[#9e8b6f] font-bold mt-0.5">{subtitle}</p>}
        {meta    && <p className="text-sm text-[#886c44] font-bold mt-0.5">{meta}</p>}
      </div>
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
  const id   = params.get('id')

  if (view === 'event' && id) return <EventPage id={id} />
  if (view === 'poll'  && id) return <PollPage id={id} />
  return <AdminDashboard />
}
