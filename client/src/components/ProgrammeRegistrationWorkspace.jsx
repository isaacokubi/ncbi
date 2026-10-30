import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, RefreshCw, Search, Download } from 'lucide-react';

const API = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
async function request(path, token, options = {}) {
  const response = await fetch(API + path, { ...options, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'The request could not be completed.');
  return body;
}
const fmt = value => value ? new Intl.DateTimeFormat('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';

export default function ProgrammeRegistrationWorkspace({ token, onError, onSuccess }) {
  const [registrations, setRegistrations] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [eventId, setEventId] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await request('/operations/event?limit=100', token);
      const availableEvents = result.records || [];
      setEvents(availableEvents);
      const batches = [];
      // Limit concurrent branch/programme lookups so large calendars do not
      // overwhelm the API or MongoDB when this workspace first opens.
      for (let offset = 0; offset < availableEvents.length; offset += 10) {
        const group = await Promise.allSettled(availableEvents.slice(offset, offset + 10).map(async event => {
          const response = await request('/operations/events/' + event._id + '/registrations', token);
          return (response.registrations || []).map(registration => ({ ...registration, eventTitle: event.title, eventDate: event.startAt, eventOrganisation: event.organisation?.name || '—', eventId: event._id }));
        }));
        batches.push(...group);
      }
      const combined = batches.filter(x => x.status === 'fulfilled').flatMap(x => x.value);
      setRegistrations(combined.sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
      const failures = batches.filter(x => x.status === 'rejected');
      if (failures.length) onError('Some programme registration lists could not be loaded. Check your access to each programme and refresh.');
    } catch (error) { onError(error.message); }
    finally { setLoading(false); }
  }, [token, onError]);
  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => registrations.filter(item => {
    const text = [item.data?.attendeeName, item.data?.email, item.eventTitle, item.eventOrganisation, item.data?.notes].join(' ').toLowerCase();
    return (!status || item.status === status) && (!eventId || item.eventId === eventId) && text.includes(query.toLowerCase());
  }), [registrations, status, eventId, query]);
  const counts = useMemo(() => registrations.reduce((all, item) => { all[item.status] = (all[item.status] || 0) + 1; return all; }, {}), [registrations]);
  const changeStatus = async (item, nextStatus) => {
    setBusyId(item._id);
    try { await request('/operations/event-registrations/' + item._id + '/status', token, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) }); onSuccess('Participant registration updated.'); await refresh(); }
    catch (error) { onError(error.message); }
    finally { setBusyId(''); }
  };
  const exportCsv = () => {
    const quote = value => {
      let text = String(value ?? '');
      if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"','""') + '"';
    };
    const rows = [['Programme','Church / branch','Participant','Email','Registration date','Status','Notes'], ...filtered.map(x => [x.eventTitle,x.eventOrganisation,x.data?.attendeeName,x.data?.email,x.createdAt,x.status,x.data?.notes])];
    const csv = rows.map(row => row.map(quote).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'ncbi-programme-registrations.csv'; link.click(); URL.revokeObjectURL(url);
  };

  return <section className="programme-registration-workspace">
    <div className="programme-intro panel"><div className="communications-icon"><CalendarDays size={22}/></div><div><span className="eyebrow">PROGRAMME PARTICIPATION</span><h2>One register for every church programme.</h2><p>Review member registrations, confirm attendance places, manage waiting lists and export participant records. Registrations are linked to the programme that received them.</p></div><button type="button" className="secondary-button" onClick={exportCsv} disabled={!filtered.length}><Download size={16}/> Export CSV</button></div>
    <div className="communications-stats">
      <article className="panel"><span>Total registrations</span><strong>{registrations.length}</strong><small>Across loaded programmes</small></article>
      <article className="panel"><span>Awaiting confirmation</span><strong>{counts.pending || 0}</strong><small>New participant requests</small></article>
      <article className="panel"><span>Confirmed</span><strong>{counts.confirmed || 0}</strong><small>Places accepted</small></article>
      <article className="panel"><span>Waitlisted</span><strong>{counts.waitlisted || 0}</strong><small>Awaiting available capacity</small></article>
    </div>
    <div className="panel communications-list">
      <div className="panel-heading"><div><span className="eyebrow">PARTICIPANT REGISTER</span><h3>Programme registrations</h3><p>Filter by programme, participant or registration status. Participant email addresses are visible only to authorised church administrators.</p></div><button className="refresh-button" type="button" onClick={refresh} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''}/> Refresh workspace</button></div>
      <div className="toolbar"><div className="table-search"><Search size={16}/><input aria-label="Search registrations" placeholder="Search participant or programme…" value={query} onChange={e => setQuery(e.target.value)}/></div><div className="toolbar-right"><select aria-label="Filter by programme" value={eventId} onChange={e => setEventId(e.target.value)}><option value="">All programmes</option>{events.map(event => <option key={event._id} value={event._id}>{event.title}</option>)}</select><select aria-label="Filter registration status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{['pending','confirmed','waitlisted','cancelled'].map(x => <option key={x} value={x}>{x}</option>)}</select></div></div>
      <div className="table-wrap"><table><thead><tr><th>Participant</th><th>Programme</th><th>Church unit</th><th>Registered</th><th>Status</th><th>Manage registration</th></tr></thead><tbody>
        {filtered.map(item => <tr key={item._id}><td><b>{item.data?.attendeeName || 'Participant'}</b><small className="cell-sub">{item.data?.email || 'No email on record'}{item.data?.notes ? ' · ' + item.data.notes : ''}</small></td><td><b>{item.eventTitle}</b><small className="cell-sub">{fmt(item.eventDate)}</small></td><td>{item.eventOrganisation}</td><td>{fmt(item.data?.registeredAt || item.createdAt)}</td><td><span className={'status-pill ' + item.status}>{item.status}</span></td><td><select className="inline-select" aria-label={'Update status for ' + (item.data?.attendeeName || 'participant')} disabled={busyId === item._id} value={item.status} onChange={e => changeStatus(item, e.target.value)}>{['pending','confirmed','waitlisted','cancelled'].map(x => <option key={x} value={x}>{x}</option>)}</select></td></tr>)}
        {!loading && !filtered.length && <tr><td colSpan="6" className="empty-cell">{query || status || eventId ? 'No registrations match these filters. Adjust the programme, search or status.' : events.length ? 'No participants have registered for the available programmes yet. Publish a programme with registration enabled to start receiving registrations.' : 'No programmes are available in your authorised church scope. Create an event under Events & Programmes first.'}</td></tr>}
      </tbody></table></div>
      <div className="table-footer"><span>{loading ? 'Loading programme registrations…' : 'Showing ' + filtered.length + ' of ' + registrations.length + ' registrations'}</span></div>
    </div>
  </section>;
}
