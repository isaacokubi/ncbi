import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowUpRight, Bell, BookOpen, CalendarDays, Church, CircleDollarSign, ClipboardList, FileBarChart, HeartHandshake, LayoutDashboard, LogOut, Menu, Network, Search, ShieldCheck, Users, Wallet, RefreshCw } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const API = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API;
const navigation = [
  { title: 'OVERVIEW', items: [{ label: 'Executive dashboard', icon: LayoutDashboard }, { label: 'Organisation structure', icon: Network }] },
  { title: 'CHURCH MANAGEMENT', items: [{ label: 'Branches', icon: Church }, { label: 'Membership', icon: Users }, { label: 'Visitors & follow-up', icon: HeartHandshake }, { label: 'Attendance', icon: ClipboardList }, { label: 'Departments & ministries', icon: BookOpen }] },
  { title: 'MINISTRY & OPERATIONS', items: [{ label: 'Events & programmes', icon: CalendarDays }, { label: 'Pastoral care', icon: HeartHandshake }, { label: 'Evangelism & missions', icon: Activity }] },
  { title: 'STEWARDSHIP', items: [{ label: 'Finance & accounting', icon: Wallet }, { label: 'Reports & analytics', icon: FileBarChart }] }
];

async function request(path, token, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(body.message || `Request failed (${response.status})`); error.status = response.status; throw error; }
  return body;
}
const number = value => new Intl.NumberFormat('en-KE').format(Number(value || 0));
const dateLabel = value => value ? new Intl.DateTimeFormat('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Date not set';
const moneyLabel = groups => {
  if (!Array.isArray(groups) || !groups.length) return 'KES 0';
  return groups.map(item => `${item._id || 'KES'} ${number(item.total)}`).join(' · ');
};

function Login({ onLogin, busy, error }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return <main className="auth-screen"><section className="auth-card">
    <div className="auth-brand"><div className="brand-mark"><Church size={25}/></div><div><strong>NCBI</strong><span>NEW CHURCH BELIEVERS INTERNATIONAL</span></div></div>
    <div className="auth-intro"><div className="eyebrow">ONE CHURCH. ONE VISION.</div><h1>Church leadership, connected.</h1><p>Sign in to your authorised NCBI management workspace.</p></div>
    <form onSubmit={event => { event.preventDefault(); onLogin(email, password); }}>
      <label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@church.org"/>
      <label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password"/>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="auth-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'}</button>
    </form>
    <small className="auth-foot">Access is monitored and limited by your assigned church role.</small>
  </section></main>;
}

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('ncbi_access_token') || '');
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [organisations, setOrganisations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pageError, setPageError] = useState('');
  const [active, setActive] = useState('Executive dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState(false);
  const [dark, setDark] = useState(false);

  const loadWorkspace = useCallback(async accessToken => {
    setPageError('');
    const [dashboard, workspace] = await Promise.all([
      request('/dashboard/summary', accessToken),
      request('/workspace/organisations', accessToken)
    ]);
    setSummary(dashboard);
    setOrganisations(workspace.organisations || []);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('ncbi_access_token');
    setToken(''); setUser(null); setSummary(null); setOrganisations([]); setError(''); setPageError('');
  }, []);

  useEffect(() => {
    let alive = true;
    if (!token) { setLoading(false); return () => { alive = false; }; }
    setLoading(true);
    request('/auth/me', token).then(async data => {
      if (!alive) return;
      setUser(data.user);
      await loadWorkspace(token);
    }).catch(err => {
      if (!alive) return; if (err.status === 401) logout(); else setPageError(err.message || 'Unable to load your workspace.');
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token, loadWorkspace, logout]);

  const login = async (email, password) => {
    setBusy(true); setError('');
    try {
      const result = await request('/auth/login', '', { method: 'POST', body: JSON.stringify({ email, password }) });
      sessionStorage.setItem('ncbi_access_token', result.token);
      setUser(result.user); setToken(result.token);
      await loadWorkspace(result.token);
    } catch (err) { setError(err.message || 'Unable to sign in. Please try again.'); }
    finally { setBusy(false); setLoading(false); }
  };

  const filtered = useMemo(() => navigation.map(group => ({ ...group, items: group.items.filter(item => item.label.toLowerCase().includes(query.toLowerCase())) })).filter(group => group.items.length), [query]);
  const metrics = summary?.metrics || {};
  const orgName = user?.organisation?.name || 'Your organisation';
  const currencyIncome = moneyLabel(metrics.confirmedIncomeThisMonth);
  const currentDate = new Intl.DateTimeFormat('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  if (loading) return <div className="loading-screen"><div className="loading-mark"><Church size={27}/></div><b>NCBI Management System</b><span>Securing your workspace…</span></div>;
  if (!token || !user) return <Login onLogin={login} busy={busy} error={error}/>;

  return <div className={dark ? 'app dark' : 'app'}>
    <aside className={collapsed ? 'sidebar collapsed' : 'sidebar'}>
      <div className="brand"><div className="brand-mark"><Church size={23}/></div>{!collapsed && <div><strong>NCBI</strong><span>A CALL TO SERVE</span></div>}<button className="icon-button collapse" onClick={() => setCollapsed(!collapsed)} aria-label="Toggle sidebar"><Menu size={18}/></button></div>
      {!collapsed && <div className="workspace-switch"><div className="workspace-avatar">NC</div><div><b>{orgName}</b><small>{user.role.replaceAll('_', ' ')}</small></div></div>}
      {!collapsed && <div className="searchbox"><Search size={16}/><input placeholder="Search navigation" value={query} onChange={event => setQuery(event.target.value)}/></div>}
      <nav>{filtered.map(group => <section key={group.title}><small className="nav-heading">{!collapsed ? group.title : ''}</small>{group.items.map(item => <button key={item.label} title={item.label} className={active === item.label ? 'nav-item selected' : 'nav-item'} onClick={() => setActive(item.label)}><item.icon size={18}/>{!collapsed && <span>{item.label}</span>}</button>)}</section>)}</nav>
      <div className="sidebar-bottom"><button className="nav-item" onClick={() => setDark(!dark)}><ShieldCheck size={18}/>{!collapsed && <span>{dark ? 'Light appearance' : 'Dark appearance'}</span>}</button><button className="nav-item logout-link" onClick={logout}><LogOut size={18}/>{!collapsed && <span>Sign out</span>}</button>{!collapsed && <div className="profile"><div className="profile-avatar">{user.fullName.split(' ').map(part => part[0]).slice(0,2).join('').toUpperCase()}</div><div><b>{user.fullName}</b><small>{user.email}</small></div></div>}</div>
    </aside>
    <main className="main">
      <header className="topbar"><div><span className="crumb">NCBI /</span> <b>{active}</b></div><div className="top-actions"><span className="period-label">{currentDate.toUpperCase()}</span><button className="icon-button notification" onClick={() => setNotice(!notice)} aria-label="Notifications"><Bell size={19}/></button><button className="top-user" onClick={logout} title="Sign out"><span className="top-avatar">{user.fullName.split(' ').map(part => part[0]).slice(0,2).join('').toUpperCase()}</span><LogOut size={15}/></button></div>{notice && <div className="notification-pop"><b>Notifications</b><p>There are no notification records available yet.</p></div>}</header>
      <div className="content">
        {active === 'Executive dashboard' ? <>
          <div className="welcome"><div><div className="eyebrow">{currentDate.toUpperCase()} <span>•</span> {orgName.toUpperCase()}</div><h1>Welcome, {user.fullName.split(' ')[0]}</h1><p>Your authorised view of NCBI people, stewardship and ministry activity.</p></div><button className="gold-button" onClick={() => setActive('Organisation structure')}><Network size={16}/> View organisation</button></div>
          <div className="scope-bar"><ShieldCheck size={16}/><span>Authorised scope</span><b>{orgName}</b><span className="scope-dot">•</span><span>{number(summary?.scope)} organisation units accessible</span><button onClick={() => setActive('Organisation structure')}>View structure <ArrowUpRight size={14}/></button></div>
          {pageError && <div className="page-error" role="alert">{pageError} <button onClick={() => loadWorkspace(token).catch(() => {})}><RefreshCw size={14}/> Retry</button></div>}
          <div className="section-title"><div><h2>Church at a glance</h2><p>Live indicators from the NCBI database · current month</p></div><button className="refresh-button" onClick={() => loadWorkspace(token).catch(() => {})}><RefreshCw size={14}/> Refresh data</button></div>
          <div className="stats-grid">
            <article className="stat-card"><div className="stat-top"><span>Active branches</span><div className="stat-icon"><Church size={19}/></div></div><strong>{number(metrics.branches)}</strong><small>Within your authorised scope</small></article>
            <article className="stat-card"><div className="stat-top"><span>Registered members</span><div className="stat-icon"><Users size={19}/></div></div><strong>{number(metrics.members)}</strong><small>Members, workers and ministers</small></article>
            <article className="stat-card"><div className="stat-top"><span>Visitors</span><div className="stat-icon"><HeartHandshake size={19}/></div></div><strong>{number(metrics.visitors)}</strong><small>Recorded as visitors</small></article>
            <article className="stat-card"><div className="stat-top"><span>Attendance records</span><div className="stat-icon"><Activity size={19}/></div></div><strong>{number(metrics.attendanceRecordsThisMonth)}</strong><small>Check-ins recorded this month</small></article>
            <article className="stat-card"><div className="stat-top"><span>Confirmed income</span><div className="stat-icon"><CircleDollarSign size={19}/></div></div><strong className="money-value">{currencyIncome}</strong><small>Confirmed transactions this month</small></article>
            <article className="stat-card"><div className="stat-top"><span>Confirmed expenses</span><div className="stat-icon"><Wallet size={19}/></div></div><strong className="money-value">{moneyLabel(metrics.confirmedExpensesThisMonth)}</strong><small>Confirmed transactions this month</small></article>
            <article className="stat-card"><div className="stat-top"><span>Pending approvals</span><div className="stat-icon"><ClipboardList size={19}/></div></div><strong>{number(metrics.pendingApprovals)}</strong><small>Records awaiting action</small></article>
            <article className="stat-card"><div className="stat-top"><span>Organisation units</span><div className="stat-icon"><Network size={19}/></div></div><strong>{number(summary?.scope)}</strong><small>Accessible units including this level</small></article>
          </div>
          <div className="bottom-grid live-grid">
            <article className="panel"><div className="panel-heading"><div><h3>Upcoming programmes</h3><p>Scheduled events in your authorised scope</p></div><button className="text-button" onClick={() => setActive('Events & programmes')}>Open events <ArrowUpRight size={14}/></button></div>
              {(summary?.upcomingEvents || []).length ? summary.upcomingEvents.map(event => <div className="event-row" key={event._id}><div className="date-tile"><CalendarDays size={18}/></div><div><b>{event.title}</b><small>{dateLabel(event.startAt)} · {event.organisation?.name || 'Organisation'}</small></div></div>) : <div className="empty-state">No upcoming events have been recorded in this scope.</div>}
            </article>
            <article className="panel"><div className="panel-heading"><div><h3>Organisation directory</h3><p>Units you are authorised to view</p></div><span className="count-badge">{organisations.length}</span></div>
              <div className="org-list">{organisations.slice(0,6).map(org => <div className="org-row" key={org._id}><span className="org-dot"/><div><b>{org.name}</b><small>{org.level} · {org.code}</small></div><span className={'status-pill ' + org.status}>{org.status}</span></div>)}</div>
              {organisations.length > 6 && <small className="muted-note">Showing 6 of {organisations.length} authorised units.</small>}
            </article>
          </div>
          <footer><b>NCBI</b> · ONE CHURCH. ONE VISION. ONE CONNECTED MANAGEMENT SYSTEM. <span>Live data · v0.2.0</span></footer>
        </> : <section className="module-placeholder panel"><div className="stat-icon"><Network size={22}/></div><div className="eyebrow">NCBI WORKSPACE</div><h1>{active}</h1><p>This module is included in the platform navigation. Its full data-entry and management screens are being connected in the next implementation milestone. No sample records are being presented as live church data.</p><button className="gold-button" onClick={() => setActive('Executive dashboard')}>Return to live dashboard</button></section>}
      </div>
    </main>
  </div>;
}
export default App;
