import React, { useState, useEffect, useCallback } from 'react'
import { Copy, ArrowLeft, Check } from 'lucide-react'
import { supabase } from './supabase'

const SERIF = { fontFamily: "'Cormorant Garamond', serif" }
const SANS = { fontFamily: "'Lato', sans-serif" }

// ─── Shared UI ────────────────────────────────────────────────────────────────

function TopBar({ onBack }) {
  return (
    <div className="bg-white border-b border-[#e8e4dc] sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-6 py-4">
        {onBack ? (
          <button onClick={onBack} className="text-sm text-[#886c44] flex items-center gap-2 hover:text-[#6d5436]" style={SANS}>
            <ArrowLeft size={16} /> Back
          </button>
        ) : (
          <div>
            <h1 className="text-2xl font-light text-[#2c2418]" style={SERIF}>North Star House</h1>
            <p className="text-xs text-[#9e8b6f] font-light" style={SANS}>Volunteer Engagement Hub</p>
          </div>
        )}
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#faf8f4] flex items-center justify-center">
      <p className="text-[#9e8b6f] font-light text-sm" style={SANS}>Loading…</p>
    </div>
  )
}

function NotFound() {
  return (
    <div className="min-h-screen bg-[#faf8f4] flex flex-col items-center justify-center gap-4">
      <p className="text-2xl font-light text-[#2c2418]" style={SERIF}>Not found</p>
      <p className="text-sm text-[#9e8b6f] font-semibold" style={SANS}>This link may have been removed or is incorrect.</p>
    </div>
  )
}

function NameInput({ value, onChange, placeholder = 'Your name' }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full max-w-xs p-3 border border-[#d9cec2] rounded text-sm focus:outline-none focus:border-[#886c44] bg-white"
      style={SANS}
    />
  )
}

// ─── Volunteer: Event Page ─────────────────────────────────────────────────────

function EventPage({ id }) {
  const [event, setEvent] = useState(null)
  const [responses, setResponses] = useState([])
  const [name, setName] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    const { data: ev, error: evErr } = await supabase.from('vol_events').select('*').eq('id', id).single()
    if (evErr) { setError(evErr.message); setLoading(false); return }
    const { data: res } = await supabase.from('vol_event_responses').select('*').eq('event_id', id).order('created_at')
    setEvent(ev)
    setResponses(res || [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchData()
    const channel = supabase
      .channel(`event-responses-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vol_event_responses', filter: `event_id=eq.${id}` },
        payload => setResponses(prev => [...prev, payload.new])
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [id, fetchData])

  const handleRSVP = async (response) => {
    if (!name.trim()) return
    const { error } = await supabase.from('vol_event_responses').insert({ event_id: id, name: name.trim(), response })
    if (!error) setSubmitted(true)
  }

  if (loading) return <LoadingScreen />
  if (error || !event) return <NotFound />

  const responseCounts = { yes: 0, maybe: 0, no: 0 }
  responses.forEach(r => { if (responseCounts[r.response] !== undefined) responseCounts[r.response]++ })

  return (
    <div className="min-h-screen bg-[#f0e6d8]" style={SANS}>
      <TopBar onBack={() => window.history.back()} />
      <div className="max-w-4xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-[#886c44] mb-4 font-light" style={SANS}>Event</p>
        <h1 className="text-5xl font-light mb-4 text-[#2c2418]" style={SERIF}>{event.title}</h1>
        {(event.date || event.time) && (
          <p className="text-base text-[#886c44] mb-3 font-semibold" style={SANS}>{event.date}{event.date && event.time ? ' at ' : ''}{event.time}</p>
        )}
        {event.description && (
          <p className="text-base text-[#2c2418] mb-12 leading-relaxed max-w-2xl font-light" style={SANS}>{event.description}</p>
        )}

        {submitted ? (
          <div className="flex items-center gap-3 py-6 mb-12">
            <Check size={20} className="text-[#886c44]" />
            <p className="text-base text-[#2c2418] font-light" style={SANS}>Thanks, {name}! Your response has been recorded.</p>
          </div>
        ) : (
          <div className="mb-12 space-y-4">
            <p className="text-sm text-[#9e8b6f] font-semibold" style={SANS}>Enter your name to RSVP</p>
            <NameInput value={name} onChange={setName} />
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => handleRSVP('yes')} disabled={!name.trim()} className="px-6 py-3 bg-[#886c44] text-white rounded text-sm font-light hover:bg-[#6d5436] transition disabled:opacity-40 disabled:cursor-not-allowed" style={SANS}>I'm Coming</button>
              <button onClick={() => handleRSVP('maybe')} disabled={!name.trim()} className="px-6 py-3 bg-white text-[#2c2418] border border-[#886c44] rounded text-sm font-light hover:bg-[#f0ede8] transition disabled:opacity-40 disabled:cursor-not-allowed" style={SANS}>Maybe</button>
              <button onClick={() => handleRSVP('no')} disabled={!name.trim()} className="px-6 py-3 bg-white text-[#2c2418] border border-[#886c44] rounded text-sm font-light hover:bg-[#f0ede8] transition disabled:opacity-40 disabled:cursor-not-allowed" style={SANS}>Can't Make It</button>
            </div>
          </div>
        )}

        {responses.length > 0 && (
          <div className="bg-white p-8 rounded border border-[#e8e4dc] max-w-xl">
            <div className="flex gap-6 mb-6">
              <span className="text-sm text-[#2c2418] font-light" style={SANS}><span className="text-[#886c44]">{responseCounts.yes}</span> coming</span>
              <span className="text-sm text-[#2c2418] font-light" style={SANS}><span className="text-[#886c44]">{responseCounts.maybe}</span> maybe</span>
              <span className="text-sm text-[#2c2418] font-light" style={SANS}><span className="text-[#886c44]">{responseCounts.no}</span> can't make it</span>
            </div>
            <h3 className="text-xl font-light text-[#2c2418] mb-4" style={SERIF}>Responses</h3>
            <div className="space-y-2">
              {responses.map(r => (
                <p key={r.id} className="text-sm text-[#2c2418] font-light" style={SANS}>
                  <span>{r.name}</span> <span className="text-[#9e8b6f]">— {r.response === 'yes' ? "Coming" : r.response === 'maybe' ? "Maybe" : "Can't make it"}</span>
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Volunteer: Poll Page ──────────────────────────────────────────────────────

function PollPage({ id }) {
  const [poll, setPoll] = useState(null)
  const [votes, setVotes] = useState([])
  const [name, setName] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const { data: p } = await supabase.from('vol_polls').select('*').eq('id', id).single()
    const { data: v } = await supabase.from('vol_poll_votes').select('*').eq('poll_id', id).order('created_at')
    setPoll(p)
    setVotes(v || [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchData()
    const channel = supabase
      .channel(`poll-votes-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vol_poll_votes', filter: `poll_id=eq.${id}` },
        payload => setVotes(prev => [...prev, payload.new])
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [id, fetchData])

  const handleVote = async (option) => {
    if (!name.trim()) return
    const { error } = await supabase.from('vol_poll_votes').insert({ poll_id: id, name: name.trim(), option })
    if (!error) setSubmitted(true)
  }

  if (loading) return <LoadingScreen />
  if (!poll) return <NotFound />

  const voteCounts = {}
  votes.forEach(v => { voteCounts[v.option] = (voteCounts[v.option] || 0) + 1 })
  const totalVotes = votes.length

  return (
    <div className="min-h-screen bg-[#f0e6d8]" style={SANS}>
      <TopBar onBack={() => window.history.back()} />
      <div className="max-w-4xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-[#886c44] mb-4 font-light" style={SANS}>Poll</p>
        <h1 className="text-4xl font-light mb-12 text-[#2c2418]" style={SERIF}>{poll.question}</h1>

        {submitted ? (
          <div className="flex items-center gap-3 py-6 mb-12">
            <Check size={20} className="text-[#886c44]" />
            <p className="text-base text-[#2c2418] font-light" style={SANS}>Thanks, {name}! Your vote has been recorded.</p>
          </div>
        ) : (
          <div className="mb-12 space-y-4">
            <p className="text-sm text-[#9e8b6f] font-semibold" style={SANS}>Enter your name to vote</p>
            <NameInput value={name} onChange={setName} />
            <div className="space-y-3 mt-4">
              {poll.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleVote(option)}
                  disabled={!name.trim()}
                  className="w-full max-w-md p-4 text-left bg-white border border-[#d9cec2] rounded hover:border-[#886c44] hover:bg-[#f5f0e8] text-[#2c2418] text-sm font-light transition disabled:opacity-40 disabled:cursor-not-allowed"
                  style={SANS}
                >
                  <div className="flex justify-between items-center">
                    <span>{option}</span>
                    {totalVotes > 0 && voteCounts[option] && (
                      <span className="text-[#9e8b6f] text-xs ml-4">{voteCounts[option]} vote{voteCounts[option] !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {votes.length > 0 && (
          <div className="bg-white p-8 rounded border border-[#e8e4dc] max-w-xl">
            <h3 className="text-xl font-light text-[#2c2418] mb-2" style={SERIF}>Results</h3>
            <p className="text-xs text-[#9e8b6f] mb-6 font-light" style={SANS}>{totalVotes} vote{totalVotes !== 1 ? 's' : ''} total</p>
            <div className="space-y-4 mb-8">
              {poll.options.map((option, idx) => {
                const count = voteCounts[option] || 0
                const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
                return (
                  <div key={idx}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[#2c2418] font-light" style={SANS}>{option}</span>
                      <span className="text-[#9e8b6f] font-light" style={SANS}>{count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-[#f0e6d8] rounded-full">
                      <div className="h-1.5 bg-[#886c44] rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <h4 className="text-sm font-light text-[#9e8b6f] mb-3" style={SANS}>All votes</h4>
            <div className="space-y-2">
              {votes.map(v => (
                <p key={v.id} className="text-sm text-[#2c2418] font-light" style={SANS}>
                  <span>{v.name}</span> <span className="text-[#9e8b6f]">— {v.option}</span>
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Volunteer: Shift Page ─────────────────────────────────────────────────────

function ShiftPage({ id }) {
  const [shift, setShift] = useState(null)
  const [signups, setSignups] = useState([])
  const [name, setName] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const { data: s } = await supabase.from('vol_shifts').select('*').eq('id', id).single()
    const { data: sg } = await supabase.from('vol_shift_signups').select('*').eq('shift_id', id).order('created_at')
    setShift(s)
    setSignups(sg || [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchData()
    const channel = supabase
      .channel(`shift-signups-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vol_shift_signups', filter: `shift_id=eq.${id}` },
        payload => setSignups(prev => [...prev, payload.new])
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [id, fetchData])

  const handleSignup = async () => {
    if (!name.trim()) return
    const { error } = await supabase.from('vol_shift_signups').insert({ shift_id: id, name: name.trim() })
    if (!error) setSubmitted(true)
  }

  if (loading) return <LoadingScreen />
  if (!shift) return <NotFound />

  const spotsLeft = shift.spots != null ? shift.spots - signups.length : null
  const full = spotsLeft !== null && spotsLeft <= 0

  return (
    <div className="min-h-screen bg-[#f0e6d8]" style={SANS}>
      <TopBar onBack={() => window.history.back()} />
      <div className="max-w-4xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-[#886c44] mb-4 font-light" style={SANS}>Volunteer Shift</p>
        <h1 className="text-4xl font-light mb-6 text-[#2c2418]" style={SERIF}>{shift.title}</h1>

        <div className="space-y-2 mb-10">
          {(shift.date || shift.time) && (
            <p className="text-base text-[#2c2418] font-light" style={SANS}>{shift.date}{shift.date && shift.time ? ' at ' : ''}{shift.time}</p>
          )}
          {shift.duration && <p className="text-sm text-[#9e8b6f] font-semibold" style={SANS}>Duration: {shift.duration}</p>}
          {shift.role && <p className="text-sm text-[#9e8b6f] font-semibold" style={SANS}>Role: {shift.role}</p>}
          {spotsLeft !== null && (
            <p className={`text-sm font-light ${full ? 'text-red-500' : 'text-[#886c44]'}`} style={SANS}>
              {full ? 'This shift is full' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} remaining`}
            </p>
          )}
        </div>

        {submitted ? (
          <div className="flex items-center gap-3 py-6 mb-12">
            <Check size={20} className="text-[#886c44]" />
            <p className="text-base text-[#2c2418] font-light" style={SANS}>Thanks, {name}! You're signed up.</p>
          </div>
        ) : !full ? (
          <div className="mb-12 space-y-4">
            <p className="text-sm text-[#9e8b6f] font-semibold" style={SANS}>Enter your name to sign up</p>
            <NameInput value={name} onChange={setName} />
            <button
              onClick={handleSignup}
              disabled={!name.trim()}
              className="px-6 py-3 bg-[#886c44] text-white rounded text-sm font-light hover:bg-[#6d5436] transition disabled:opacity-40 disabled:cursor-not-allowed"
              style={SANS}
            >
              Sign Up for This Shift
            </button>
          </div>
        ) : null}

        {signups.length > 0 && (
          <div className="bg-white p-8 rounded border border-[#e8e4dc] max-w-xl">
            <h3 className="text-xl font-light text-[#2c2418] mb-4" style={SERIF}>Signed Up ({signups.length})</h3>
            <div className="space-y-2">
              {signups.map(s => (
                <p key={s.id} className="text-sm text-[#2c2418] font-light" style={SANS}>{s.name}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Admin Dashboard ───────────────────────────────────────────────────────────

const INPUT_CLS = "w-full p-3 border border-[#d9cec2] rounded text-sm focus:outline-none focus:border-[#886c44] bg-white"

function AdminDashboard() {
  const [events, setEvents] = useState([])
  const [polls, setPolls] = useState([])
  const [shifts, setShifts] = useState([])
  const [copiedId, setCopiedId] = useState(null)
  const [active, setActive] = useState(null) // 'event' | 'poll' | 'shift' | null

  const [eventForm, setEventForm] = useState({ title: '', date: '', time: '', description: '' })
  const [pollForm, setPollForm] = useState({ question: '', options: ['', ''] })
  const [shiftForm, setShiftForm] = useState({ title: '', date: '', time: '', duration: '', role: '', spots: '' })

  const [saving, setSaving] = useState(null)

  const fetchAll = useCallback(async () => {
    const [{ data: ev }, { data: po }, { data: sh }] = await Promise.all([
      supabase.from('vol_events').select('*, vol_event_responses(count)').order('created_at', { ascending: false }),
      supabase.from('vol_polls').select('*, vol_poll_votes(count)').order('created_at', { ascending: false }),
      supabase.from('vol_shifts').select('*, vol_shift_signups(count)').order('created_at', { ascending: false }),
    ])
    setEvents(ev || [])
    setPolls(po || [])
    setShifts(sh || [])
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const createEvent = async () => {
    if (!eventForm.title.trim()) return
    setSaving('event')
    await supabase.from('vol_events').insert(eventForm)
    setEventForm({ title: '', date: '', time: '', description: '' })
    await fetchAll()
    setSaving(null)
  }

  const createPoll = async () => {
    if (!pollForm.question.trim()) return
    setSaving('poll')
    const options = pollForm.options.filter(o => o.trim())
    await supabase.from('vol_polls').insert({ question: pollForm.question, options })
    setPollForm({ question: '', options: ['', ''] })
    await fetchAll()
    setSaving(null)
  }

  const createShift = async () => {
    if (!shiftForm.title.trim()) return
    setSaving('shift')
    await supabase.from('vol_shifts').insert({ ...shiftForm, spots: shiftForm.spots ? Number(shiftForm.spots) : null })
    setShiftForm({ title: '', date: '', time: '', duration: '', role: '', spots: '' })
    await fetchAll()
    setSaving(null)
  }

  const deleteEvent = async (id) => {
    await supabase.from('vol_events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  const deletePoll = async (id) => {
    await supabase.from('vol_polls').delete().eq('id', id)
    setPolls(prev => prev.filter(p => p.id !== id))
  }

  const deleteShift = async (id) => {
    await supabase.from('vol_shifts').delete().eq('id', id)
    setShifts(prev => prev.filter(s => s.id !== id))
  }

  const copyLink = (type, id) => {
    const link = `${window.location.origin}${window.location.pathname}?view=${type}&id=${id}`
    navigator.clipboard.writeText(link)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const toggle = (key) => setActive(prev => prev === key ? null : key)
  const count = (item, key) => item[`vol_${key}`]?.[0]?.count ?? 0

  const TILES = [
    { key: 'event', label: 'Events', sub: `${events.length} created` },
    { key: 'poll',  label: 'Polls',  sub: `${polls.length} created` },
    { key: 'shift', label: 'Volunteer Shifts', sub: `${shifts.length} created` },
  ]

  return (
    <div className="min-h-screen bg-[#faf8f4] flex flex-col" style={SANS}>
      <TopBar />

      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-6 py-12">
        <h2 className="text-4xl font-light mb-1 text-[#2c2418]" style={SERIF}>Volunteer Hub</h2>
        <p className="text-sm text-[#9e8b6f] font-light mb-10" style={SANS}>Select a category to create or manage.</p>

        {/* Tile buttons */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {TILES.map(({ key, label, sub }) => (
            <button
              key={key}
              onClick={() => toggle(key)}
              className={`p-6 rounded border text-left transition ${
                active === key
                  ? 'bg-[#886c44] border-[#886c44] text-white'
                  : 'bg-white border-[#e8e4dc] text-[#2c2418] hover:border-[#886c44]'
              }`}
            >
              <p className="text-lg font-light mb-1" style={SERIF}>{label}</p>
              <p className={`text-xs font-light ${active === key ? 'text-[#f0e6d8]' : 'text-[#9e8b6f]'}`} style={SANS}>{sub}</p>
            </button>
          ))}
        </div>

        {/* ── Events panel ── */}
        {active === 'event' && (
          <div className="animate-in">
            <div className="bg-white p-8 rounded border border-[#e8e4dc] mb-4">
              <p className="text-xs uppercase tracking-widest text-[#9e8b6f] mb-5 font-light" style={SANS}>New Event</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <input placeholder="Event title" value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} className={`${INPUT_CLS} col-span-2`} style={SANS} />
                <input type="date" value={eventForm.date} onChange={e => setEventForm({ ...eventForm, date: e.target.value })} className={INPUT_CLS} style={SANS} />
                <input type="time" value={eventForm.time} onChange={e => setEventForm({ ...eventForm, time: e.target.value })} className={INPUT_CLS} style={SANS} />
              </div>
              <textarea placeholder="Description (optional)" value={eventForm.description} onChange={e => setEventForm({ ...eventForm, description: e.target.value })} className={`${INPUT_CLS} mb-4`} rows={2} style={SANS} />
              <button onClick={createEvent} disabled={saving === 'event'} className="px-6 py-3 bg-[#886c44] text-white rounded text-sm font-light hover:bg-[#6d5436] transition disabled:opacity-60" style={SANS}>
                {saving === 'event' ? 'Saving…' : 'Add Event'}
              </button>
            </div>
            <div className="space-y-2">
              {events.length === 0 && <p className="text-sm text-[#9e8b6f] font-light py-2" style={SANS}>No events yet.</p>}
              {events.map(e => (
                <AdminCard key={e.id} title={e.title} subtitle={[e.date, e.time].filter(Boolean).join(' at ')}
                  meta={`${count(e, 'event_responses')} response${count(e, 'event_responses') !== 1 ? 's' : ''}`}
                  copied={copiedId === e.id} onCopy={() => copyLink('event', e.id)} onDelete={() => deleteEvent(e.id)} />
              ))}
            </div>
          </div>
        )}

        {/* ── Polls panel ── */}
        {active === 'poll' && (
          <div className="animate-in">
            <div className="bg-white p-8 rounded border border-[#e8e4dc] mb-4">
              <p className="text-xs uppercase tracking-widest text-[#9e8b6f] mb-5 font-light" style={SANS}>New Poll</p>
              <input placeholder="Poll question" value={pollForm.question} onChange={e => setPollForm({ ...pollForm, question: e.target.value })} className={`${INPUT_CLS} mb-4`} style={SANS} />
              <div className="space-y-3 mb-3">
                {pollForm.options.map((opt, i) => (
                  <input key={i} placeholder={`Option ${i + 1}`} value={opt} onChange={e => { const o = [...pollForm.options]; o[i] = e.target.value; setPollForm({ ...pollForm, options: o }) }} className={INPUT_CLS} style={SANS} />
                ))}
              </div>
              <div className="flex items-center gap-4 mb-5">
                <button onClick={() => setPollForm({ ...pollForm, options: [...pollForm.options, ''] })} className="text-sm text-[#886c44] font-light hover:text-[#6d5436] transition" style={SANS}>+ Add option</button>
                {pollForm.options.length > 2 && (
                  <button onClick={() => setPollForm({ ...pollForm, options: pollForm.options.slice(0, -1) })} className="text-sm text-[#9e8b6f] font-light hover:text-[#2c2418] transition" style={SANS}>− Remove last</button>
                )}
              </div>
              <button onClick={createPoll} disabled={saving === 'poll'} className="px-6 py-3 bg-[#886c44] text-white rounded text-sm font-light hover:bg-[#6d5436] transition disabled:opacity-60" style={SANS}>
                {saving === 'poll' ? 'Saving…' : 'Create Poll'}
              </button>
            </div>
            <div className="space-y-2">
              {polls.length === 0 && <p className="text-sm text-[#9e8b6f] font-light py-2" style={SANS}>No polls yet.</p>}
              {polls.map(p => (
                <AdminCard key={p.id} title={p.question}
                  meta={`${count(p, 'poll_votes')} vote${count(p, 'poll_votes') !== 1 ? 's' : ''}`}
                  copied={copiedId === p.id} onCopy={() => copyLink('poll', p.id)} onDelete={() => deletePoll(p.id)} />
              ))}
            </div>
          </div>
        )}

        {/* ── Shifts panel ── */}
        {active === 'shift' && (
          <div className="animate-in">
            <div className="bg-white p-8 rounded border border-[#e8e4dc] mb-4">
              <p className="text-xs uppercase tracking-widest text-[#9e8b6f] mb-5 font-light" style={SANS}>New Shift</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <input placeholder="Shift title" value={shiftForm.title} onChange={e => setShiftForm({ ...shiftForm, title: e.target.value })} className={`${INPUT_CLS} col-span-2`} style={SANS} />
                <input type="date" value={shiftForm.date} onChange={e => setShiftForm({ ...shiftForm, date: e.target.value })} className={INPUT_CLS} style={SANS} />
                <input type="time" value={shiftForm.time} onChange={e => setShiftForm({ ...shiftForm, time: e.target.value })} className={INPUT_CLS} style={SANS} />
                <input placeholder="Duration (e.g. 2 hours)" value={shiftForm.duration} onChange={e => setShiftForm({ ...shiftForm, duration: e.target.value })} className={INPUT_CLS} style={SANS} />
                <input placeholder="Role (e.g. Docent)" value={shiftForm.role} onChange={e => setShiftForm({ ...shiftForm, role: e.target.value })} className={INPUT_CLS} style={SANS} />
                <input type="number" placeholder="Available spots" value={shiftForm.spots} onChange={e => setShiftForm({ ...shiftForm, spots: e.target.value })} className={`${INPUT_CLS} col-span-2`} style={SANS} />
              </div>
              <button onClick={createShift} disabled={saving === 'shift'} className="px-6 py-3 bg-[#886c44] text-white rounded text-sm font-light hover:bg-[#6d5436] transition disabled:opacity-60" style={SANS}>
                {saving === 'shift' ? 'Saving…' : 'Add Shift'}
              </button>
            </div>
            <div className="space-y-2">
              {shifts.length === 0 && <p className="text-sm text-[#9e8b6f] font-light py-2" style={SANS}>No shifts yet.</p>}
              {shifts.map(s => (
                <AdminCard key={s.id} title={s.title} subtitle={[s.date, s.time].filter(Boolean).join(' at ')}
                  meta={`${count(s, 'shift_signups')} signed up${s.spots ? ` of ${s.spots}` : ''}`}
                  copied={copiedId === s.id} onCopy={() => copyLink('shift', s.id)} onDelete={() => deleteShift(s.id)} />
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="bg-white border-t border-[#e8e4dc]">
        <div className="max-w-5xl mx-auto px-6 py-6 text-center">
          <p className="text-xs text-[#9e8b6f] font-light" style={SANS}>North Star House • Grass Valley, CA • (530) 273-4667</p>
        </div>
      </footer>
    </div>
  )
}

function AdminCard({ title, subtitle, meta, copied, onCopy, onDelete }) {
  return (
    <div className="flex justify-between items-center p-5 bg-white border border-[#e8e4dc] rounded hover:border-[#c9b48a] transition">
      <div className="flex-1 min-w-0 mr-4">
        <p className="font-light text-[#2c2418] truncate" style={{ ...SERIF, fontSize: '17px' }}>{title}</p>
        {subtitle && <p className="text-xs text-[#9e8b6f] font-semibold mt-0.5" style={SANS}>{subtitle}</p>}
        {meta && <p className="text-xs text-[#9e8b6f] font-semibold mt-1" style={SANS}>{meta}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={onCopy} className="flex items-center gap-1.5 px-3 py-2 rounded hover:bg-[#f0e6d8] transition text-xs font-light" style={{ ...SANS, color: copied ? '#886c44' : '#9e8b6f' }}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy link'}
        </button>
        <button onClick={onDelete} className="px-3 py-2 rounded hover:bg-[#f0e6d8] text-[#9e8b6f] hover:text-[#2c2418] text-xs font-light transition" style={SANS}>Delete</button>
      </div>
    </div>
  )
}

// ─── Router ────────────────────────────────────────────────────────────────────

export default function App() {
  const params = new URLSearchParams(window.location.search)
  const view = params.get('view')
  const id = params.get('id')

  if (view === 'event' && id) return <EventPage id={id} />
  if (view === 'poll' && id) return <PollPage id={id} />
  if (view === 'shift' && id) return <ShiftPage id={id} />
  return <AdminDashboard />
}
