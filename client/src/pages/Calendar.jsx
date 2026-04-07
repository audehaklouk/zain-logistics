import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, X, Trash2, Edit2,
  CalendarDays, LayoutGrid, Columns2, AlignLeft,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';

// ── Constants ──────────────────────────────────────────────────────────
const DAY_LABELS   = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const MONTH_NAMES  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const PRESET_COLORS = ['#22c55e','#3b82f6','#8b5cf6','#f97316','#ec4899','#14b8a6','#ef4444'];

const TYPE_META = {
  payment:  { label: 'Payment',  bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-300',    dot: '#ef4444' },
  delivery: { label: 'Delivery', bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300',   dot: '#3b82f6' },
  claim:    { label: 'Claim',    bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', dot: '#f97316' },
  order:    { label: 'Order',    bg: 'bg-gray-100',   text: 'text-gray-600',   border: 'border-gray-300',   dot: '#9ca3af' },
  manual:   { label: 'Event',    bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300',  dot: '#22c55e' },
};

// ── Date helpers ───────────────────────────────────────────────────────
function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fromISO(s) { return new Date(s + 'T00:00:00'); }
function todayISO() { return toISO(new Date()); }

// Saturday-start week bounds for a given date
function weekBounds(date) {
  const d = new Date(date); d.setHours(0,0,0,0);
  const offset = (d.getDay() + 1) % 7; // Sat=0
  const sat = new Date(d); sat.setDate(d.getDate() - offset);
  const fri = new Date(sat); fri.setDate(sat.getDate() + 6);
  return { start: toISO(sat), end: toISO(fri) };
}

// 7 ISO dates for the week containing `date`
function weekDays(date) {
  const { start } = weekBounds(date);
  const s = fromISO(start);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(s); d.setDate(s.getDate() + i);
    return toISO(d);
  });
}

// 42-cell month grid (6 weeks, Sat-start)
function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 1) % 7;
  const start = new Date(first); start.setDate(1 - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i);
    return { iso: toISO(d), d, inMonth: d.getMonth() === month };
  });
}

function addDays(iso, n) {
  const d = fromISO(iso); d.setDate(d.getDate() + n);
  return toISO(d);
}

function fmtShort(iso) {
  const d = fromISO(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function fmtLong(iso) {
  const d = fromISO(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function fmtWeekRange(iso) {
  const days = weekDays(iso);
  const s = fromISO(days[0]);
  const e = fromISO(days[6]);
  if (s.getMonth() === e.getMonth())
    return `${s.toLocaleString('en-GB',{month:'long',year:'numeric'})}`;
  return `${s.toLocaleString('en-GB',{month:'short'})} – ${e.toLocaleString('en-GB',{month:'short',year:'numeric'})}`;
}

// ── Event chip (compact) ───────────────────────────────────────────────
function EventChip({ ev, onClick }) {
  const meta = TYPE_META[ev.type] || TYPE_META.manual;
  const dotColor = ev.color || meta.dot;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium truncate ${meta.bg} ${meta.text} hover:brightness-95 transition-all`}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
      <span className="truncate">{ev.title}</span>
    </button>
  );
}

// ── Event card (full detail) ───────────────────────────────────────────
function EventCard({ ev, onEdit, onDelete }) {
  const meta = TYPE_META[ev.type] || TYPE_META.manual;
  const dotColor = ev.color || meta.dot;
  return (
    <div className={`rounded-lg border p-3 ${meta.bg} ${meta.border} group`}>
      <div className="flex items-start gap-2.5">
        <span className="mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-[10px] font-semibold uppercase tracking-wide ${meta.text} opacity-70`}>{meta.label}</span>
          </div>
          <p className={`text-sm font-semibold ${meta.text}`}>{ev.title}</p>
          {ev.detail && <p className="text-xs text-gray-500 mt-0.5">{ev.detail}</p>}
        </div>
        <div className="flex gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {ev.order_id && !ev.is_manual && (
            <Link to={`/orders/${ev.order_id}`}
              className="p-1.5 rounded hover:bg-white/60 text-gray-400 hover:text-primary transition-colors text-sm font-bold leading-none">
              →
            </Link>
          )}
          {ev.type === 'claim' && ev.source_id && (
            <Link to="/claims"
              className="p-1.5 rounded hover:bg-white/60 text-gray-400 hover:text-primary transition-colors text-sm font-bold leading-none">
              →
            </Link>
          )}
          {ev.is_manual && (
            <>
              <button onClick={() => onEdit(ev)} className="p-1.5 rounded hover:bg-white/60 text-gray-400 hover:text-primary transition-colors">
                <Edit2 className="w-3 h-3" />
              </button>
              <button onClick={() => onDelete(ev.id)} className="p-1.5 rounded hover:bg-white/60 text-gray-400 hover:text-red-500 transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Manual Event Form ─────────────────────────────────────────────────
function EventForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { title:'', description:'', event_date: todayISO(), color:'#22c55e' });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Title is required');
    setLoading(true);
    try { await onSave(form); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{initial?.id ? 'Edit Event' : 'New Event'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)}
              className="input-field" placeholder="Event title" autoFocus required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input type="date" value={form.event_date} onChange={e => set('event_date', e.target.value)}
              className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
            <input value={form.description} onChange={e => set('description', e.target.value)}
              className="input-field" placeholder="Optional notes" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button key={c} type="button" onClick={() => set('color', c)}
                  className={`w-7 h-7 rounded-full border-[3px] transition-transform hover:scale-110 ${form.color === c ? 'border-gray-700 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary text-sm">
              {loading ? 'Saving…' : initial?.id ? 'Update' : 'Add Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── MONTHLY VIEW ──────────────────────────────────────────────────────
function MonthView({ year, month, eventsByDate, today, selectedDay, onSelectDay, onEditEvent, onDeleteEvent }) {
  const grid = buildMonthGrid(year, month);
  const MAX = 3;
  return (
    <div className="flex-1 card !p-0 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/60">
        {DAY_LABELS.map(d => (
          <div key={d} className="py-2.5 text-center text-xs font-semibold text-gray-400 uppercase tracking-widest">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 divide-x divide-gray-100">
        {grid.map(({ iso, d, inMonth }, idx) => {
          const events = eventsByDate[iso] || [];
          const isToday = iso === today;
          const isSel = iso === selectedDay;
          const shown = events.slice(0, MAX);
          const extra = events.length - MAX;
          const isLastRow = idx >= 35;
          return (
            <div
              key={iso}
              onClick={() => onSelectDay(iso)}
              className={`min-h-[100px] p-1.5 border-b border-gray-100 cursor-pointer transition-colors group
                ${!inMonth ? 'bg-gray-50/40' : 'bg-white hover:bg-blue-50/30'}
                ${isSel ? 'ring-2 ring-inset ring-primary/40 bg-primary/5' : ''}
                ${isLastRow ? 'border-b-0' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold transition-colors
                  ${isToday ? 'bg-primary text-white' : isSel ? 'bg-primary/10 text-primary' : inMonth ? 'text-gray-700 group-hover:bg-gray-100' : 'text-gray-300'}`}>
                  {d.getDate()}
                </span>
              </div>
              <div className="space-y-0.5">
                {shown.map((ev, i) => (
                  <EventChip key={i} ev={ev} onClick={e => { e.stopPropagation(); onSelectDay(iso); }} />
                ))}
                {extra > 0 && (
                  <p className="text-[10px] text-gray-400 pl-1 font-medium">+{extra} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── WEEKLY VIEW ───────────────────────────────────────────────────────
function WeekView({ anchorDate, eventsByDate, today, onSwitchToDay, onEditEvent, onDeleteEvent }) {
  const days = weekDays(anchorDate);
  return (
    <div className="flex-1 card !p-0 overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/60">
        {days.map((iso, i) => {
          const d = fromISO(iso);
          const isToday = iso === today;
          return (
            <button key={iso} onClick={() => onSwitchToDay(iso)}
              className={`py-3 text-center transition-colors hover:bg-gray-100/60 ${isToday ? 'bg-primary/5' : ''}`}>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">{DAY_LABELS[i]}</p>
              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold mt-0.5 transition-colors
                ${isToday ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-200'}`}>
                {d.getDate()}
              </span>
              <p className="text-[10px] text-gray-400 mt-0.5">{d.toLocaleString('en-GB',{month:'short'})}</p>
            </button>
          );
        })}
      </div>

      {/* Events grid */}
      <div className="grid grid-cols-7 divide-x divide-gray-100 min-h-[420px]">
        {days.map((iso, i) => {
          const events = eventsByDate[iso] || [];
          const isToday = iso === today;
          return (
            <div key={iso} className={`p-2 space-y-1.5 ${isToday ? 'bg-primary/[0.03]' : ''}`}>
              {events.length === 0 && (
                <div className="h-full flex items-center justify-center">
                  <span className="text-xs text-gray-200">—</span>
                </div>
              )}
              {events.map((ev, j) => {
                const meta = TYPE_META[ev.type] || TYPE_META.manual;
                return (
                  <div key={j} className={`rounded-lg p-2 ${meta.bg} ${meta.text} group cursor-default`}>
                    <div className="flex items-start gap-1.5">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color || meta.dot }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold leading-tight truncate">{ev.title}</p>
                        {ev.detail && <p className="text-[10px] text-gray-500 mt-0.5 truncate">{ev.detail}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(ev.order_id || ev.type === 'claim') && !ev.is_manual && (
                        <Link to={ev.order_id ? `/orders/${ev.order_id}` : '/claims'}
                          className="text-[10px] font-medium text-gray-500 hover:text-primary underline">View</Link>
                      )}
                      {ev.is_manual && (
                        <>
                          <button onClick={() => onEditEvent(ev)} className="text-[10px] font-medium text-gray-500 hover:text-primary">Edit</button>
                          <button onClick={() => onDeleteEvent(ev.id)} className="text-[10px] font-medium text-gray-500 hover:text-red-500">Delete</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── DAILY VIEW ────────────────────────────────────────────────────────
function DayView({ iso, eventsByDate, onEditEvent, onDeleteEvent, onAddEvent }) {
  const events = eventsByDate[iso] || [];
  const grouped = {};
  for (const ev of events) {
    const t = ev.type || 'manual';
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(ev);
  }
  const priority = ['payment','delivery','claim','order','manual'];

  return (
    <div className="flex-1 card space-y-4">
      {/* Day detail header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">
            {fromISO(iso).toLocaleDateString('en-GB', { weekday: 'long' })}
          </p>
          <h2 className="text-xl font-bold text-gray-900">
            {fromISO(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">{events.length} event{events.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => onAddEvent(iso)} className="btn-primary text-sm flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add Event
        </button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No events on this day</p>
          <button onClick={() => onAddEvent(iso)} className="mt-2 text-xs text-primary hover:underline">
            Add an event
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {priority.filter(t => grouped[t]?.length).map(type => {
            const meta = TYPE_META[type] || TYPE_META.manual;
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: meta.dot }} />
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{meta.label}s</h3>
                  <span className="text-xs text-gray-300">({grouped[type].length})</span>
                </div>
                <div className="space-y-2 pl-4">
                  {grouped[type].map((ev, i) => (
                    <EventCard key={i} ev={ev} onEdit={onEditEvent} onDelete={onDeleteEvent} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── MAIN CALENDAR PAGE ────────────────────────────────────────────────
export default function Calendar() {
  const [view, setView]           = useState('month');        // 'month' | 'week' | 'day'
  const [currentDate, setCurrentDate] = useState(todayISO()); // anchor ISO
  const [eventsByDate, setEventsByDate] = useState({});
  const [loading, setLoading]     = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);       // month-view selection
  const [showForm, setShowForm]   = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formDate, setFormDate]   = useState(todayISO());
  const today = todayISO();

  // Compute fetch range from view + currentDate
  const getFetchRange = useCallback(() => {
    if (view === 'day') return { start: currentDate, end: currentDate };
    if (view === 'week') return weekBounds(currentDate);
    // month — use 42-cell grid bounds
    const d = fromISO(currentDate);
    const grid = buildMonthGrid(d.getFullYear(), d.getMonth());
    return { start: grid[0].iso, end: grid[grid.length - 1].iso };
  }, [view, currentDate]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const { start, end } = getFetchRange();
    try {
      const res = await api.get('/calendar', { params: { start, end } });
      const map = {};
      for (const ev of res.data) {
        if (!map[ev.date]) map[ev.date] = [];
        map[ev.date].push(ev);
      }
      setEventsByDate(map);
    } catch { toast.error('Failed to load calendar'); }
    finally { setLoading(false); }
  }, [getFetchRange]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // ── Navigation ────────────────────────────────────────────────────
  const navigate = (dir) => {
    const d = fromISO(currentDate);
    if (view === 'day') {
      d.setDate(d.getDate() + dir);
      setCurrentDate(toISO(d));
    } else if (view === 'week') {
      d.setDate(d.getDate() + dir * 7);
      setCurrentDate(toISO(d));
    } else {
      d.setMonth(d.getMonth() + dir);
      setCurrentDate(toISO(d));
    }
    setSelectedDay(null);
  };

  const goToday = () => { setCurrentDate(today); setSelectedDay(null); };

  // ── Heading label ─────────────────────────────────────────────────
  const headingLabel = () => {
    const d = fromISO(currentDate);
    if (view === 'day')   return fmtLong(currentDate);
    if (view === 'week')  return fmtWeekRange(currentDate);
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  };

  // ── Event CRUD ────────────────────────────────────────────────────
  const handleSaveEvent = async (data) => {
    try {
      if (editingEvent?.source_id) {
        await api.put(`/calendar/events/${editingEvent.source_id}`, data);
        toast.success('Event updated');
      } else {
        await api.post('/calendar/events', data);
        toast.success('Event added');
      }
      setShowForm(false); setEditingEvent(null);
      fetchEvents();
    } catch { toast.error('Failed to save'); throw new Error(); }
  };

  const handleDeleteEvent = async (id) => {
    if (!confirm('Delete this event?')) return;
    try {
      await api.delete(`/calendar/events/${id}`);
      toast.success('Deleted');
      fetchEvents();
    } catch { toast.error('Failed'); }
  };

  const openAddEvent = (date) => {
    setFormDate(date || currentDate);
    setEditingEvent(null);
    setShowForm(true);
  };

  const openEditEvent = (ev) => {
    setEditingEvent(ev);
    setShowForm(true);
  };

  // In month view, clicking a day selects it; clicking again or pressing a day in week view switches to day view
  const handleSelectDay = (iso) => {
    if (view === 'month') {
      setSelectedDay(prev => prev === iso ? null : iso);
    }
  };

  const switchToDay = (iso) => {
    setCurrentDate(iso);
    setView('day');
    setSelectedDay(null);
  };

  // Determine the current month/year from currentDate for month view
  const anchorD   = fromISO(currentDate);
  const curYear   = anchorD.getFullYear();
  const curMonth  = anchorD.getMonth();

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          {/* Prev / Today / Next */}
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <button onClick={goToday} className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-700">
            Today
          </button>
          <button onClick={() => navigate(1)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>

          {/* Heading */}
          <h2 className="text-base font-bold text-gray-900 ml-1 truncate max-w-[260px]">{headingLabel()}</h2>
        </div>

        <div className="flex items-center gap-2">
          {/* View switcher */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {[
              { key: 'month', icon: LayoutGrid,   label: 'Month' },
              { key: 'week',  icon: Columns2,      label: 'Week'  },
              { key: 'day',   icon: AlignLeft,     label: 'Day'   },
            ].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => { setView(key); setSelectedDay(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 font-medium transition-colors ${
                  view === key ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <button onClick={() => openAddEvent(selectedDay || today)}
            className="btn-primary text-sm flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add Event
          </button>
        </div>
      </div>

      {/* ── Legend ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(TYPE_META).map(([type, meta]) => (
          <div key={type} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.dot }} />
            {meta.label}
          </div>
        ))}
      </div>

      {/* ── Views ────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : (
        <div className={`flex gap-4 ${view === 'month' && selectedDay ? 'items-start' : ''}`}>
          {/* Main view */}
          <div className="flex-1 min-w-0">
            {view === 'month' && (
              <MonthView
                year={curYear} month={curMonth}
                eventsByDate={eventsByDate}
                today={today} selectedDay={selectedDay}
                onSelectDay={handleSelectDay}
                onEditEvent={openEditEvent}
                onDeleteEvent={handleDeleteEvent}
              />
            )}
            {view === 'week' && (
              <WeekView
                anchorDate={currentDate}
                eventsByDate={eventsByDate}
                today={today}
                onSwitchToDay={switchToDay}
                onEditEvent={openEditEvent}
                onDeleteEvent={handleDeleteEvent}
              />
            )}
            {view === 'day' && (
              <DayView
                iso={currentDate}
                eventsByDate={eventsByDate}
                onEditEvent={openEditEvent}
                onDeleteEvent={handleDeleteEvent}
                onAddEvent={openAddEvent}
              />
            )}
          </div>

          {/* Month-view day panel */}
          {view === 'month' && selectedDay && (
            <div className="w-72 flex-shrink-0">
              <div className="card !p-0 overflow-hidden">
                {/* Panel header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                  <div>
                    <p className="text-[11px] text-gray-400 uppercase tracking-wide">
                      {fromISO(selectedDay).toLocaleDateString('en-GB', { weekday: 'long' })}
                    </p>
                    <p className="text-sm font-bold text-gray-900">{fmtShort(selectedDay)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => switchToDay(selectedDay)}
                      className="text-xs text-primary hover:underline font-medium px-1">Day view</button>
                    <button onClick={() => openAddEvent(selectedDay)}
                      className="p-1.5 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-primary">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setSelectedDay(null)} className="p-1.5 rounded hover:bg-gray-100">
                      <X className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  </div>
                </div>
                {/* Panel events */}
                <div className="p-3 space-y-1.5 max-h-80 overflow-y-auto">
                  {(eventsByDate[selectedDay] || []).length === 0 ? (
                    <div className="text-center py-6 text-gray-400">
                      <p className="text-sm">No events</p>
                      <button onClick={() => openAddEvent(selectedDay)} className="mt-1 text-xs text-primary hover:underline">Add one</button>
                    </div>
                  ) : (eventsByDate[selectedDay] || []).map((ev, i) => (
                    <EventCard key={i} ev={ev} onEdit={openEditEvent} onDelete={handleDeleteEvent} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Event Form Modal ──────────────────────────────────────── */}
      {showForm && (
        <EventForm
          initial={editingEvent
            ? { id: editingEvent.source_id, title: editingEvent.title, description: editingEvent.detail || '', event_date: editingEvent.date, color: editingEvent.color || '#22c55e' }
            : { title: '', description: '', event_date: formDate, color: '#22c55e' }
          }
          onSave={handleSaveEvent}
          onClose={() => { setShowForm(false); setEditingEvent(null); }}
        />
      )}
    </div>
  );
}
