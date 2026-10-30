import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Plus, RefreshCw, Search, Pencil, Archive, Send, Eye, X } from 'lucide-react';

const API = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
async function request(path, token, options = {}) {
  const response = await fetch(API + path, { ...options, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'The request could not be completed.');
  return body;
}
const dateText = value => value ? new Intl.DateTimeFormat('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';
const blank = () => ({ title: '', message: '', category: 'general', audience: 'congregation', status: 'draft', visibility: 'organisation', startAt: '' });

export default function AnnouncementWorkspace({ token, onError, onSuccess }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [editor, setEditor] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank());
  const [preview, setPreview] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { const result = await request('/operations/announcement?limit=100', token); setItems(result.records || []); }
    catch (error) { onError(error.message); }
    finally { setLoading(false); }
  }, [token, onError]);
  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => items.filter(item => {
    const matchesStatus = !status || item.status === status;
    const text = [item.title, item.reference, item.data?.message, item.data?.category, item.organisation?.name].join(' ').toLowerCase();
    return matchesStatus && text.includes(query.toLowerCase());
  }), [items, query, status]);
  const counts = useMemo(() => items.reduce((all, item) => { all[item.status] = (all[item.status] || 0) + 1; return all; }, {}), [items]);
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const openNew = () => { setEditing(null); setForm(blank()); setEditor(true); setPreview(null); };
  const openEdit = item => {
    setEditing(item);
    setForm({ title: item.title || '', message: item.data?.message || '', category: item.data?.category || 'general', audience: item.data?.audience || 'congregation', status: item.status || 'draft', visibility: item.visibility || 'organisation', startAt: item.startAt ? new Date(item.startAt).toISOString().slice(0, 16) : '' });
    setEditor(true); setPreview(null);
  };
  const save = async event => {
    event.preventDefault(); setBusy(true);
    try {
      const data = { message: form.message.trim(), category: form.category, audience: form.audience };
      if (!data.message) throw new Error('Write the announcement before saving.');
      if (form.visibility === 'public' && !['public','congregation'].includes(form.audience)) throw new Error('A notice intended only for leaders or members cannot be published on the public website. Choose a church-workspace visibility instead.');
      if (form.status === 'active' && form.visibility === 'public' && !window.confirm('Publish this announcement on the public NCBI website now?')) { setBusy(false); return; }
      const payload = { title: form.title.trim(), status: form.status, visibility: form.visibility, startAt: form.startAt || undefined, data };
      await request('/operations/announcement' + (editing ? '/' + editing._id : ''), token, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setEditor(false); setEditing(null); onSuccess(editing ? 'Announcement updated.' : 'Announcement saved.'); await refresh();
    } catch (error) { onError(error.message); }
    finally { setBusy(false); }
  };
  const archive = async item => {
    if (!window.confirm('Archive this announcement? It will no longer appear in active notices.')) return;
    try { await request('/operations/announcement/' + item._id, token, { method: 'DELETE' }); onSuccess('Announcement archived.'); await refresh(); }
    catch (error) { onError(error.message); }
  };
  const publish = async item => {
    if (!['public','congregation'].includes(item.data?.audience || 'congregation')) { onError('This notice is intended for an internal audience and cannot be published publicly.'); return; }
    if (!window.confirm('Publish this announcement on the public NCBI website?')) return;
    try { await request('/operations/announcement/' + item._id, token, { method: 'PATCH', body: JSON.stringify({ status: 'active', visibility: 'public' }) }); onSuccess('Announcement published.'); await refresh(); }
    catch (error) { onError(error.message); }
  };

  return <section className="communications-workspace">
    <div className="communications-intro panel">
      <div className="communications-icon"><Bell size={22}/></div>
      <div><span className="eyebrow">CHURCH COMMUNICATIONS</span><h2>Reach the right congregation with the right notice.</h2><p>Create internal notices or publish approved announcements to the public NCBI website. Drafts remain private until you publish them.</p></div>
      <button className="gold-button" type="button" onClick={openNew}><Plus size={16}/> Publish a news announcement</button>
    </div>
    <div className="communications-stats">
      <article className="panel"><span>Total notices</span><strong>{items.length}</strong><small>Across your authorised church units</small></article>
      <article className="panel"><span>Published</span><strong>{counts.active || 0}</strong><small>Visible to the selected audience</small></article>
      <article className="panel"><span>Drafts</span><strong>{counts.draft || 0}</strong><small>Not yet published</small></article>
      <article className="panel"><span>Awaiting review</span><strong>{counts.pending || 0}</strong><small>Notices not yet active</small></article>
    </div>
    {editor && <form className="panel communications-editor" onSubmit={save}>
      <div className="panel-heading"><div><span className="eyebrow">{editing ? 'EDIT NOTICE' : 'NEW NOTICE'}</span><h3>{editing ? 'Update announcement' : 'Prepare an announcement'}</h3><p>Public announcements are displayed on the NCBI website as soon as they are published.</p></div><button type="button" className="icon-button" onClick={() => setEditor(false)} aria-label="Close editor"><X size={18}/></button></div>
      <div className="form-grid">
        <label className="field"><span>Announcement title *</span><input required maxLength="180" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Annual church conference"/></label>
        <label className="field"><span>Notice category</span><select value={form.category} onChange={e => set('category', e.target.value)}>{['general','service_update','event','leadership','community','urgent','media_release'].map(x => <option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></label>
        <label className="field"><span>Intended audience</span><select value={form.audience} onChange={e => set('audience', e.target.value)}>{['congregation','leaders','members','visitors','public'].map(x => <option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></label>
        <label className="field"><span>Publication status</span><select value={form.status} onChange={e => { set('status', e.target.value); if (e.target.value !== 'active') set('visibility', 'organisation'); }}><option value="draft">Save as draft</option><option value="pending">Submit for review</option><option value="active">Publish now</option></select></label>
        <label className="field"><span>Visibility</span><select value={form.visibility} onChange={e => set('visibility', e.target.value)}><option value="organisation">Church workspace only</option><option value="public">Public NCBI website</option><option value="team">Assigned team</option></select></label>
        <label className="field"><span>Notice date (optional)</span><input type="datetime-local" value={form.startAt} onChange={e => set('startAt', e.target.value)}/></label>
        <label className="field communications-message"><span>Announcement message *</span><textarea required rows="6" maxLength="5000" value={form.message} onChange={e => set('message', e.target.value)} placeholder="Write the full announcement. Include dates, venue, instructions and contact details where appropriate."/></label>
      </div>
      <div className="editor-actions"><button type="button" className="secondary-button" onClick={() => setEditor(false)}>Cancel</button><button type="submit" className="gold-button" disabled={busy}>{busy ? 'Saving…' : (form.status === 'active' ? 'Publish announcement' : form.status === 'pending' ? 'Submit for review' : 'Save draft')}</button></div>
    </form>}
    {preview && <div className="panel announcement-preview"><div className="panel-heading"><div><span className="eyebrow">NOTICE PREVIEW</span><h3>{preview.title}</h3></div><button type="button" className="secondary-button" onClick={() => setPreview(null)}>Close preview</button></div><p>{preview.data?.message}</p></div>}
    <div className="panel communications-list">
      <div className="panel-heading"><div><span className="eyebrow">NOTICE REGISTER</span><h3>Church communications and notices</h3><p>Search, review, edit and publish notices within your permitted organisation scope.</p></div><button className="refresh-button" type="button" onClick={refresh} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''}/> Refresh workspace</button></div>
      <div className="toolbar"><div className="table-search"><Search size={16}/><input aria-label="Search notices" placeholder="Search title, message or church…" value={query} onChange={e => setQuery(e.target.value)}/></div><div className="toolbar-right"><select aria-label="Filter notice status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{['draft','pending','active','scheduled','in_progress','completed','cancelled','closed'].map(x => <option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></div></div>
      <div className="table-wrap"><table><thead><tr><th>Announcement</th><th>Audience</th><th>Church unit</th><th>Status</th><th>Last updated</th><th>Actions</th></tr></thead><tbody>
        {filtered.map(item => <tr key={item._id}><td><b>{item.title}</b><small className="cell-sub">{(item.data?.message || '').slice(0, 105)}{(item.data?.message || '').length > 105 ? '…' : ''}</small></td><td>{(item.data?.audience || 'congregation').replaceAll('_',' ')}</td><td>{item.organisation?.name || '—'}</td><td><span className={'status-pill ' + item.status}>{item.status}</span></td><td>{dateText(item.updatedAt || item.createdAt)}</td><td><div className="row-actions"><button className="row-action" type="button" onClick={() => setPreview(item)}><Eye size={14}/> Preview</button><button className="row-action" type="button" onClick={() => openEdit(item)}><Pencil size={14}/> Edit</button>{item.status !== 'active' && ['public','congregation'].includes(item.data?.audience || 'congregation') && <button className="row-action approve" type="button" onClick={() => publish(item)}><Send size={14}/> Publish</button>}<button className="row-action reject" type="button" onClick={() => archive(item)}><Archive size={14}/> Archive</button></div></td></tr>)}
        {!loading && !filtered.length && <tr><td colSpan="6" className="empty-cell">{query || status ? 'No notices match these filters. Clear the search or status filter.' : 'No announcements have been created in this church workspace yet. Use “Publish a news announcement” to prepare the first notice.'}</td></tr>}
      </tbody></table></div>
      <div className="table-footer"><span>{loading ? 'Loading notices…' : 'Showing ' + filtered.length + ' of ' + items.length + ' notices'}</span></div>
    </div>
  </section>;
}
