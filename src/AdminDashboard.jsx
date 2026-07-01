import { useState, useEffect, useCallback } from 'react'
import { Copy, ArrowLeft, ArrowUp, ArrowDown, Check, Plus, X, Calendar, MapPin } from 'lucide-react'
import { supabase } from './supabase'
import {
  FONT, DISPLAY, SERIF, SANS, INPUT, QUESTION_TYPES,
  slugify, fmtDateShort, genId, mkQuestion,
  TopBar, LoadingScreen, NotFound,
} from './shared.jsx'

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

function QuestionEditor({ question: q, index, onUpdate, onRemove, canRemove, onDuplicate, onMoveUp, onMoveDown, canMoveUp, canMoveDown }) {
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

        <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-0.5">
          <button onClick={onMoveUp} disabled={!canMoveUp} title="Move up"
            className="p-1 text-[#9e8b6f] hover:text-[#2c2418] transition disabled:opacity-25">
            <ArrowUp size={15} />
          </button>
          <button onClick={onMoveDown} disabled={!canMoveDown} title="Move down"
            className="p-1 text-[#9e8b6f] hover:text-[#2c2418] transition disabled:opacity-25">
            <ArrowDown size={15} />
          </button>
          <button onClick={onDuplicate} title="Duplicate"
            className="p-1 text-[#9e8b6f] hover:text-[#886c44] transition">
            <Copy size={15} />
          </button>
          {canRemove && (
            <button onClick={onRemove} title="Remove"
              className="p-1 text-[#9e8b6f] hover:text-red-500 transition">
              <X size={15} />
            </button>
          )}
        </div>
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
  const [editOptions, setEditOptions] = useState([])
  const [editSlots, setEditSlots] = useState([])

  useEffect(() => {
    async function load() {
      const { data: ev } = await supabase.from('vol_events').select('*').eq('id', id).single()
      if (!ev) { setLoading(false); return }
      setEvent(ev)
      setEditForm({ title: ev.title, date: ev.date || '', time: ev.time || '', description: ev.description || '' })
      setEditOptions(ev.options?.length ? [...ev.options] : ['', ''])
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
    const { error: evErr } = await supabase.from('vol_events').update({
      title: editForm.title.trim(),
      date: editForm.date || null,
      time: editForm.time || null,
      description: editForm.description.trim() || null,
      options: event.event_type === 'rsvp' ? editOptions.filter(o => o.trim()) : [],
    }).eq('id', id)
    if (evErr) { alert('Save failed: ' + evErr.message); setSaving(false); return }
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
  const opts = event.options?.length ? event.options : []
  const tally = {}
  opts.forEach(o => { tally[o] = 0 })
  responses.forEach(r => { if (tally[r.response] !== undefined) tally[r.response]++ })

  const dateStr = event.date ? new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : null

  return (
    <div className="min-h-screen bg-[#f5f0e7]" style={FONT}>
      {/* Top bar */}
      <div className="bg-[#f5f0e7] border-b border-[#e0d5c0]">
        <div className="max-w-4xl mx-auto px-6 py-3 flex justify-between items-center">
          <button onClick={onBack} className="flex items-center gap-2 text-[#886c44] font-bold text-sm hover:text-[#6d5436] transition">
            <ArrowLeft size={16} /> Dashboard
          </button>
          <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="North Star House" className="h-16 w-auto" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pt-10 pb-14">
        {/* Event header */}
        {editing ? (
          <div className="bg-white rounded-2xl px-8 py-8 mb-6">
            <p className="text-xs uppercase tracking-widest text-[#9e8b6f] font-bold mb-5">Edit Event</p>
            <div className="space-y-4 mb-6">
              <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} placeholder="Event title" className={INPUT} style={SANS} />
              <div className="grid grid-cols-2 gap-4">
                <input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} className={INPUT} style={SANS} />
                <input type="text" placeholder="e.g. 9:00 AM – 5:00 PM" value={editForm.time} onChange={e => setEditForm({ ...editForm, time: e.target.value })} className={INPUT} style={SANS} />
              </div>
              <textarea placeholder="Description (optional)" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className={INPUT} rows={2} style={SANS} />
            </div>
            {!isShift && (
              <div className="mb-6">
                <p className="text-sm font-bold text-[#2c2418] uppercase tracking-wide mb-3">RSVP Options</p>
                <div className="space-y-2 mb-2">
                  {editOptions.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <input value={opt} onChange={e => { const o = [...editOptions]; o[i] = e.target.value; setEditOptions(o) }}
                        placeholder={`Option ${i + 1}`} className={INPUT} style={SANS} />
                      {editOptions.length > 2 && (
                        <button onClick={() => setEditOptions(editOptions.filter((_, j) => j !== i))}
                          className="p-2 text-[#9e8b6f] hover:text-red-500 transition"><X size={16} /></button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={() => setEditOptions([...editOptions, ''])}
                  className="flex items-center gap-2 text-sm font-bold text-[#886c44] hover:text-[#6d5436] transition">
                  <Plus size={14} /> Add Option
                </button>
              </div>
            )}
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
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#886c44] mb-4">
              {isShift ? 'Volunteer Sign-Up' : 'RSVP Event'}
            </p>
            <div className="flex items-start justify-between gap-6 mb-5">
              <h1 className="text-4xl sm:text-5xl font-bold text-[#1e1a14] leading-tight" style={DISPLAY}>{event.title}</h1>
              <button onClick={() => setEditing(true)}
                className="flex-shrink-0 mt-2 px-4 py-2 border-2 border-[#886c44] text-[#886c44] rounded-lg text-sm font-bold hover:bg-[#886c44] hover:text-white transition">
                Edit
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-7 gap-y-2 mb-4">
              {(dateStr || event.time) && (
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-[#886c44] flex-shrink-0" />
                  <span className="text-sm font-medium text-[#2c2418]">{dateStr}{dateStr && event.time ? ' · ' : ''}{event.time}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-[#886c44] flex-shrink-0" />
                <span className="text-sm font-medium text-[#2c2418]">The North Star House</span>
              </div>
            </div>
            {event.description && <p className="text-base text-[#5a4a35] leading-relaxed">{event.description}</p>}
          </div>
        )}

        {/* RSVP responses */}
        {!isShift && (
          <div className="bg-white rounded-2xl px-8 py-8">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-2xl font-bold text-[#1e1a14]" style={DISPLAY}>RSVPs</h2>
              <p className="text-sm text-[#a08060]">{responses.length} response{responses.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="border-t border-[#e0d5c0] mb-6" />
            {responses.length === 0 ? (
              <p className="text-sm text-[#a08060]">No RSVPs yet.</p>
            ) : (
              <>
                {opts.length > 0 && (
                  <div className="flex flex-wrap gap-8 mb-6">
                    {opts.map(o => (
                      <div key={o}>
                        <p className="text-3xl font-bold text-[#1e1a14]" style={DISPLAY}>{tally[o] ?? 0}</p>
                        <p className="text-xs font-semibold text-[#a08060] uppercase tracking-wide mt-1">{o}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-3">
                  {responses.map(r => (
                    <div key={r.id} className="flex items-baseline justify-between">
                      <p className="text-base font-medium text-[#2c2418]">{r.name}</p>
                      <span className="text-sm text-[#886c44] font-semibold">{r.response}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Shift signups */}
        {isShift && (
          <div className="bg-white rounded-2xl px-8 py-8">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-2xl font-bold text-[#1e1a14]" style={DISPLAY}>Signups</h2>
            </div>
            <div className="border-t border-[#e0d5c0] mb-6" />
            {slots.length === 0 && <p className="text-sm text-[#a08060]">No time slots yet.</p>}
            <div className="space-y-8">
              {slots.map(slot => {
                const su = signups[slot.id] || []
                return (
                  <div key={slot.id}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="text-lg font-bold text-[#1e1a14]" style={DISPLAY}>{slot.time_label}</p>
                        {slot.duration && <p className="text-sm text-[#5a4a35] mt-0.5">{slot.duration}</p>}
                      </div>
                      <p className="text-sm font-semibold text-[#a08060] flex-shrink-0 pt-1">
                        {su.length}{slot.spots ? `/${slot.spots}` : ''} signed up
                      </p>
                    </div>
                    {su.length === 0
                      ? <p className="text-sm text-[#a08060]">No signups yet.</p>
                      : <div className="space-y-2">{su.map(s => (
                          <p key={s.id} className="text-base font-medium text-[#2c2418]">{s.name}</p>
                        ))}</div>
                    }
                    <div className="border-t border-[#e8e0d0] mt-6" />
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
    const { error } = await supabase.from('vol_polls').update({ question: editPoll.question.trim(), options: opts }).eq('id', id)
    if (error) { alert('Save failed: ' + error.message); setSaving(false); return }
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
    <div className="min-h-screen bg-[#f5f0e7] flex flex-col" style={SANS}>
      <TopBar onBack={onBack} />
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">

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
    const { error } = await supabase.from('nsh_forms').update({ title: editMeta.title.trim(), description: editMeta.description.trim() || null, fields }).eq('id', id)
    if (error) { alert('Save failed: ' + error.message); setSaving(false); return }
    const { data: fo } = await supabase.from('nsh_forms').select('*').eq('id', id).single()
    setForm(fo)
    setEditFields(fo.fields || [])
    setSaving(false)
    setEditing(false)
  }

  if (loading) return <LoadingScreen />
  if (!form)   return <NotFound />

  return (
    <div className="min-h-screen bg-[#f5f0e7] flex flex-col" style={SANS}>
      <TopBar onBack={onBack} />
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">

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
                  canRemove={editFields.length > 1}
                  onDuplicate={() => { const qs = [...editFields]; qs.splice(i + 1, 0, { ...qs[i], id: genId() }); setEditFields(qs) }}
                  onMoveUp={() => { const qs = [...editFields]; [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]]; setEditFields(qs) }}
                  onMoveDown={() => { const qs = [...editFields]; [qs[i], qs[i + 1]] = [qs[i + 1], qs[i]]; setEditFields(qs) }}
                  canMoveUp={i > 0} canMoveDown={i < editFields.length - 1} />
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
  const [saving, setSaving] = useState(null)
  const [detailView, setDetailView] = useState(null)

  // Shared event fields
  const [eventForm, setEventForm] = useState({ title: '', date: '', time: '', description: '' })
  const [rsvpOptions, setRsvpOptions] = useState(['', ''])
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

  const createEvent = async (type) => {
    if (!eventForm.title.trim()) return
    setSaving('event')
    const options = type === 'rsvp' ? rsvpOptions.filter(o => o.trim()) : []
    const { data: ev } = await supabase.from('vol_events').insert({ ...eventForm, event_type: type, options }).select().single()
    if (ev && type === 'shift') {
      const validSlots = slots.filter(s => s.time_label.trim())
      if (validSlots.length > 0) {
        await supabase.from('vol_shift_slots').insert(
          validSlots.map((s, i) => ({
            event_id: ev.id, time_label: s.time_label, duration: s.duration || null,
            role: null, spots: s.spots ? Number(s.spots) : null, sort_order: i
          }))
        )
      }
    }
    setEventForm({ title: '', date: '', time: '', description: '' })
    setRsvpOptions(['', ''])
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
    await supabase.from('nsh_forms').insert({ title: formMeta.title.trim(), description: formMeta.description.trim() || null, fields })
    setFormMeta({ title: '', description: '' })
    setFormQuestions([mkQuestion()])
    await fetchAll(); setSaving(null)
  }

  const deleteEvent = async (id) => { await supabase.from('vol_events').delete().eq('id', id); setEvents(prev => prev.filter(e => e.id !== id)) }
  const deletePoll  = async (id) => { await supabase.from('vol_polls').delete().eq('id', id);  setPolls(prev => prev.filter(p => p.id !== id)) }
  const deleteForm  = async (id) => { await supabase.from('nsh_forms').delete().eq('id', id);  setForms(prev => prev.filter(f => f.id !== id)) }

  const copyLink = (type, id, title) => {
    const idParam = (type === 'event' && title) ? `${slugify(title)}__${id}` : id
    const link = `${window.location.origin}${window.location.pathname}?view=${type}&id=${idParam}`
    navigator.clipboard.writeText(link)
    setCopiedId(id); setTimeout(() => setCopiedId(null), 2000)
  }

  const updateSlot     = (i, field, val) => { const s = [...slots];         s[i] = { ...s[i], [field]: val }; setSlots(s) }
  const updateQuestion = (i, updated)     => { const qs = [...formQuestions]; qs[i] = updated; setFormQuestions(qs) }

  const rsvpEvents  = events.filter(e => e.event_type === 'rsvp')
  const shiftEvents = events.filter(e => e.event_type === 'shift')

  if (detailView?.type === 'event') return <EventDetail id={detailView.id} onBack={() => { setDetailView(null); fetchAll() }} />
  if (detailView?.type === 'poll')  return <PollDetail  id={detailView.id} onBack={() => { setDetailView(null); fetchAll() }} />
  if (detailView?.type === 'form')  return <FormDetail  id={detailView.id} onBack={() => { setDetailView(null); fetchAll() }} />

  const tile = (key, label, sub) => (
    <button key={key} onClick={() => setActive(prev => prev === key ? null : key)}
      className={`py-3.5 px-4 rounded-xl border-2 text-left transition w-full ${active === key ? 'bg-[#886c44] border-[#886c44]' : 'bg-white border-[#e8e4dc] hover:border-[#886c44]'}`}>
      <p className={`text-sm font-bold leading-snug ${active === key ? 'text-white' : 'text-[#2c2418]'}`} style={SERIF}>{label}</p>
      {sub && <p className={`text-xs font-semibold mt-0.5 ${active === key ? 'text-[#f0e6d8]' : 'text-[#886c44]'}`}>{sub}</p>}
    </button>
  )

  return (
    <div className="min-h-screen bg-[#f5f0e7] flex flex-col" style={SANS}>
      <TopBar />
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        <h2 className="text-5xl font-normal mb-10 text-[#2c2418]" style={SERIF}>Forms & Outreach</h2>

        {/* ── Create ── */}
        <p className="text-xs font-bold uppercase tracking-widest text-[#9e8b6f] mb-3">Create</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {tile('rsvp-create',  'RSVP Event')}
          {tile('shift-create', 'Volunteer Shifts')}
          {tile('form-create',  'Form')}
          {tile('poll-create',  'Poll')}
        </div>

        {/* ── View & Manage ── */}
        <p className="text-xs font-bold uppercase tracking-widest text-[#9e8b6f] mb-3">View & Manage</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {tile('rsvp-view',  'RSVP Events',              `${rsvpEvents.length} created`)}
          {tile('shift-view', 'Volunteer Shifts',         `${shiftEvents.length} created`)}
          {tile('form-view',  'Forms',                    `${forms.length} created`)}
          {tile('poll-view',  'Polls',                    `${polls.length} created`)}
        </div>

        {/* ── Create RSVP Event ── */}
        {active === 'rsvp-create' && (
          <div className="bg-white p-8 rounded-xl border-2 border-[#e8e4dc] mb-4">
            <p className="text-xs uppercase tracking-widest text-[#9e8b6f] font-bold mb-5">New RSVP Event</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <input placeholder="Event title" value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} className={`${INPUT} col-span-2`} style={SANS} />
              <input type="date" value={eventForm.date} onChange={e => setEventForm({ ...eventForm, date: e.target.value })} className={INPUT} style={SANS} />
              <input type="text" placeholder="e.g. 9:00 AM – 5:00 PM" value={eventForm.time} onChange={e => setEventForm({ ...eventForm, time: e.target.value })} className={INPUT} style={SANS} />
            </div>
            <textarea placeholder="Description (optional)" value={eventForm.description} onChange={e => setEventForm({ ...eventForm, description: e.target.value })} className={`${INPUT} mb-6`} rows={2} style={SANS} />
            <div className="mb-6">
              <p className="text-sm font-bold text-[#2c2418] uppercase tracking-wide mb-3">RSVP Options</p>
              <div className="space-y-2 mb-2">
                {rsvpOptions.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={opt} onChange={e => { const o = [...rsvpOptions]; o[i] = e.target.value; setRsvpOptions(o) }} placeholder={`Option ${i + 1}`} className={INPUT} style={SANS} />
                    {rsvpOptions.length > 2 && (
                      <button onClick={() => setRsvpOptions(rsvpOptions.filter((_, j) => j !== i))} className="p-2 text-[#9e8b6f] hover:text-red-500 transition"><X size={16} /></button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => setRsvpOptions([...rsvpOptions, ''])} className="flex items-center gap-2 text-sm font-bold text-[#886c44] hover:text-[#6d5436] transition">
                <Plus size={14} /> Add Option
              </button>
            </div>
            <button onClick={() => createEvent('rsvp')} disabled={saving === 'event'} className="px-6 py-3 bg-[#886c44] text-white rounded-xl text-base font-bold hover:bg-[#6d5436] transition disabled:opacity-60">
              {saving === 'event' ? 'Saving…' : 'Create RSVP Event'}
            </button>
          </div>
        )}

        {/* ── Create Shift Sign-up ── */}
        {active === 'shift-create' && (
          <div className="bg-white p-8 rounded-xl border-2 border-[#e8e4dc] mb-4">
            <p className="text-xs uppercase tracking-widest text-[#9e8b6f] font-bold mb-5">New Volunteer Shift Sign-up</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <input placeholder="Event title" value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} className={`${INPUT} col-span-2`} style={SANS} />
              <input type="date" value={eventForm.date} onChange={e => setEventForm({ ...eventForm, date: e.target.value })} className={INPUT} style={SANS} />
              <input type="text" placeholder="e.g. 9:00 AM – 5:00 PM" value={eventForm.time} onChange={e => setEventForm({ ...eventForm, time: e.target.value })} className={INPUT} style={SANS} />
            </div>
            <textarea placeholder="Description (optional)" value={eventForm.description} onChange={e => setEventForm({ ...eventForm, description: e.target.value })} className={`${INPUT} mb-6`} rows={2} style={SANS} />
            <div className="mb-6">
              <p className="text-sm font-bold text-[#2c2418] uppercase tracking-wide mb-3">Time Slots</p>
              <div className="space-y-3 mb-3">
                {slots.map((slot, i) => (
                  <SlotCard key={i} slot={slot} index={i} total={slots.length}
                    onChange={(field, val) => updateSlot(i, field, val)}
                    onRemove={() => setSlots(slots.filter((_, idx) => idx !== i))} />
                ))}
              </div>
              <button onClick={() => setSlots([...slots, { time_label: '', duration: '', spots: '' }])} className="flex items-center gap-2 text-base text-[#886c44] font-bold hover:text-[#6d5436] transition">
                <Plus size={16} /> Add time slot
              </button>
            </div>
            <button onClick={() => createEvent('shift')} disabled={saving === 'event'} className="px-6 py-3 bg-[#886c44] text-white rounded-xl text-base font-bold hover:bg-[#6d5436] transition disabled:opacity-60">
              {saving === 'event' ? 'Saving…' : 'Create Shift Sign-up'}
            </button>
          </div>
        )}

        {/* ── Create Form ── */}
        {active === 'form-create' && (
          <div className="bg-white p-8 rounded-xl border-2 border-[#e8e4dc] mb-4">
            <p className="text-xs uppercase tracking-widest text-[#9e8b6f] font-bold mb-5">New Form</p>
            <div className="space-y-4 mb-6">
              <input placeholder="Form title" value={formMeta.title} onChange={e => setFormMeta({ ...formMeta, title: e.target.value })} className={INPUT} style={SANS} />
              <textarea placeholder="Description (optional)" value={formMeta.description} onChange={e => setFormMeta({ ...formMeta, description: e.target.value })} className={INPUT} rows={2} style={SANS} />
            </div>
            <p className="text-sm font-bold text-[#2c2418] uppercase tracking-wide mb-3">Questions</p>
            <div className="space-y-3 mb-4">
              {formQuestions.map((q, i) => (
                <QuestionEditor key={q.id} question={q} index={i}
                  onUpdate={updated => updateQuestion(i, updated)}
                  onRemove={() => setFormQuestions(formQuestions.filter((_, idx) => idx !== i))}
                  canRemove={formQuestions.length > 1}
                  onDuplicate={() => { const qs = [...formQuestions]; qs.splice(i + 1, 0, { ...qs[i], id: genId() }); setFormQuestions(qs) }}
                  onMoveUp={() => { const qs = [...formQuestions]; [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]]; setFormQuestions(qs) }}
                  onMoveDown={() => { const qs = [...formQuestions]; [qs[i], qs[i + 1]] = [qs[i + 1], qs[i]]; setFormQuestions(qs) }}
                  canMoveUp={i > 0} canMoveDown={i < formQuestions.length - 1} />
              ))}
            </div>
            <button onClick={() => setFormQuestions([...formQuestions, mkQuestion()])} className="flex items-center gap-2 text-base text-[#886c44] font-bold hover:text-[#6d5436] transition mb-6">
              <Plus size={16} /> Add question
            </button>
            <button onClick={createForm} disabled={saving === 'form'} className="px-6 py-3 bg-[#886c44] text-white rounded-xl text-base font-bold hover:bg-[#6d5436] transition disabled:opacity-60">
              {saving === 'form' ? 'Saving…' : 'Create Form'}
            </button>
          </div>
        )}

        {/* ── Create Poll ── */}
        {active === 'poll-create' && (
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
        )}

        {/* ── View RSVP Events ── */}
        {active === 'rsvp-view' && (
          <div className="space-y-2">
            {rsvpEvents.length === 0 && <p className="text-base text-[#9e8b6f] font-bold py-2">No RSVP events yet.</p>}
            {rsvpEvents.map(e => {
              const n = e.vol_event_responses?.[0]?.count ?? 0
              return <AdminCard key={e.id} title={e.title} subtitle={fmtDateShort(e.date)} meta={`${n} response${n !== 1 ? 's' : ''}`}
                copied={copiedId === e.id} onCopy={() => copyLink('event', e.id, e.title)} onDelete={() => deleteEvent(e.id)}
                onClick={() => setDetailView({ type: 'event', id: e.id })} />
            })}
          </div>
        )}

        {/* ── View Shift Sign-ups ── */}
        {active === 'shift-view' && (
          <div className="space-y-2">
            {shiftEvents.length === 0 && <p className="text-base text-[#9e8b6f] font-bold py-2">No shift sign-ups yet.</p>}
            {shiftEvents.map(e => {
              const n = e.vol_shift_slots?.[0]?.count ?? 0
              return <AdminCard key={e.id} title={e.title} subtitle={fmtDateShort(e.date)} meta={`${n} time slot${n !== 1 ? 's' : ''}`}
                copied={copiedId === e.id} onCopy={() => copyLink('event', e.id, e.title)} onDelete={() => deleteEvent(e.id)}
                onClick={() => setDetailView({ type: 'event', id: e.id })} />
            })}
          </div>
        )}

        {/* ── View Forms ── */}
        {active === 'form-view' && (
          <div className="space-y-2">
            {forms.length === 0 && <p className="text-base text-[#9e8b6f] font-bold py-2">No forms yet.</p>}
            {forms.map(f => {
              const q = f.fields?.length ?? 0; const r = f.nsh_form_responses?.[0]?.count ?? 0
              return <AdminCard key={f.id} title={f.title} meta={`${q} question${q !== 1 ? 's' : ''} · ${r} response${r !== 1 ? 's' : ''}`}
                copied={copiedId === f.id} onCopy={() => copyLink('form', f.id)} onDelete={() => deleteForm(f.id)}
                onClick={() => setDetailView({ type: 'form', id: f.id })} />
            })}
          </div>
        )}

        {/* ── View Polls ── */}
        {active === 'poll-view' && (
          <div className="space-y-2">
            {polls.length === 0 && <p className="text-base text-[#9e8b6f] font-bold py-2">No polls yet.</p>}
            {polls.map(p => {
              const n = p.vol_poll_votes?.[0]?.count ?? 0
              return <AdminCard key={p.id} title={p.question} meta={`${n} vote${n !== 1 ? 's' : ''}`}
                copied={copiedId === p.id} onCopy={() => copyLink('poll', p.id)} onDelete={() => deletePoll(p.id)}
                onClick={() => setDetailView({ type: 'poll', id: p.id })} />
            })}
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
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-normal text-[#2c2418] truncate text-lg" style={SERIF}>{title}</p>
          {subtitle && <p className="text-sm text-[#9e8b6f] font-bold flex-shrink-0">{subtitle}</p>}
        </div>
        {meta && <p className="text-sm text-[#886c44] font-bold mt-0.5">{meta}</p>}
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

export default AdminDashboard
