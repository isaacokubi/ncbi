import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Camera, CameraOff, Copy, QrCode, ShieldCheck } from 'lucide-react';

const API = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
async function request(path, token, body) {
  const response = await fetch(API + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}
function localDateTime() {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function QrAttendancePanel({ token, user, members, organisations }) {
  const [activityName, setActivityName] = useState('Sunday Service');
  const [category, setCategory] = useState('sunday_service');
  const [heldAt, setHeldAt] = useState(localDateTime);
  const [organisation, setOrganisation] = useState(user.organisation?._id || user.organisation || '');
  const [session, setSession] = useState(null);
  const [qrToken, setQrToken] = useState('');
  const [qrImage, setQrImage] = useState('');
  const [member, setMember] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);

  const stopCamera = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  };
  useEffect(() => {
    let active = true;
    if (!session?.token) { setQrImage(''); return undefined; }
    QRCode.toDataURL(session.token, { errorCorrectionLevel: 'M', margin: 2, width: 320, color: { dark: '#220031', light: '#FFFFFF' } })
      .then(value => { if (active) setQrImage(value); })
      .catch(() => { if (active) setQrImage(''); });
    return () => { active = false; };
  }, [session?.token]);

  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  const startCamera = async () => {
    setError(''); setMessage('');
    if (!('BarcodeDetector' in window)) {
      setError('QR camera scanning is not supported by this browser. Paste the signed QR token below instead.');
      return;
    }
    try {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      if (!videoRef.current) return stopCamera();
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraActive(true);
      const scan = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes[0]?.rawValue) {
            setQrToken(codes[0].rawValue);
            setMessage('QR session captured. Select the attendee and submit check-in.');
            stopCamera();
            return;
          }
        } catch { /* Wait for the next video frame. */ }
        frameRef.current = requestAnimationFrame(scan);
      };
      frameRef.current = requestAnimationFrame(scan);
    } catch (e) {
      stopCamera();
      setError(e.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access or paste the QR token.' : 'Could not start the camera. Use the manual token field instead.');
    }
  };

  const createSession = async e => {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const result = await request('/operations/attendance/qr-session', token, { activityName, category, heldAt: new Date(heldAt).toISOString(), organisation: organisation || undefined });
      setSession(result); setQrToken(result.token);
      setMessage('Signed attendance QR created. Display or print it for this service. It expires in ten minutes, so create a fresh code when it expires.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const checkIn = async e => {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const result = await request('/operations/attendance/qr-checkin', token, { token: qrToken.trim(), member });
      setMessage(result.alreadyCheckedIn ? 'This member was already checked in for this service. No duplicate was created.' : 'Attendance check-in recorded successfully.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const canIssue = ['super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor','branch_admin','department_leader'].includes(user.role);
  return <section className="panel qr-attendance-panel">
    <div className="panel-heading"><div><h3><QrCode size={17}/> QR attendance check-in</h3><p>Short-lived signed sessions with server-side organisation and role checks</p></div><span className="status-pill active"><ShieldCheck size={13}/> Protected</span></div>
    {canIssue && <form className="qr-session-form" onSubmit={createSession}>
      <label>Service / activity<input required maxLength="80" value={activityName} onChange={e=>setActivityName(e.target.value)}/></label>
      <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>{['sunday_service','midweek_service','prayer','bible_study','department','conference','outreach','other'].map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></label>
      <label>Service date & time<input required type="datetime-local" value={heldAt} onChange={e=>setHeldAt(e.target.value)}/></label>
      <label>Branch / organisation<select value={organisation} onChange={e=>setOrganisation(e.target.value)}>{organisations.map(o=><option key={o._id} value={o._id}>{o.name}</option>)}</select></label>
      <button className="gold-button" disabled={busy}>{busy?'Creating…':'Create signed QR session'}</button>
    </form>}
    {session && <div className="qr-session-result"><b>Session ready · expires in 10 minutes</b><small>{session.activityName} · {new Date(session.heldAt).toLocaleString()}</small>{qrImage ? <div className="qr-image-wrap"><img className="qr-image" src={qrImage} alt="Signed NCBI attendance QR code"/><div className="qr-image-actions"><button type="button" className="secondary-button" onClick={()=>{const w=window.open('','_blank');if(!w)return;w.document.write('<!doctype html><title>NCBI attendance QR</title><style>body{font-family:Arial;text-align:center;padding:24px}img{width:320px;max-width:90vw}p{font-size:14px}</style><h2>NCBI · Attendance</h2><img src="'+qrImage+'" alt="Attendance QR"><p>'+new Date(session.heldAt).toLocaleString()+'</p><script>window.onload=()=>window.print()<\/script>');w.document.close();}}><QrCode size={14}/> Print QR</button><button type="button" className="secondary-button" onClick={()=>navigator.clipboard?.writeText(session.token)}><Copy size={14}/> Copy secure token</button></div></div> : <small>Generating QR image…</small>}<small>Keep this QR code within the church service. Anyone holding it can submit check-ins until it expires.</small></div>}
    <div className="qr-scanner">
      <div><b>Scan an attendee QR code</b><p>Use a camera-enabled HTTPS browser, or paste the signed token. Select the attendee before submitting.</p></div>
      <video ref={videoRef} className={cameraActive?'qr-video active':'qr-video'} muted playsInline/>
      <div className="qr-actions"><button type="button" className="secondary-button" onClick={cameraActive?stopCamera:startCamera}>{cameraActive?<CameraOff size={15}/>:<Camera size={15}/>} {cameraActive?'Stop camera':'Start camera scanner'}</button><label>Attendee<select required value={member} onChange={e=>setMember(e.target.value)}><option value="">Select member</option>{members.filter(m=>['member','worker','minister','new_believer'].includes(m.status)).map(m=><option key={m._id} value={m._id}>{m.firstName} {m.lastName} · {m.membershipNumber||m._id}</option>)}</select></label></div>
      <form className="qr-submit-form" onSubmit={checkIn}><label>Signed QR token<input required value={qrToken} onChange={e=>setQrToken(e.target.value)} placeholder="Scan a QR code or paste its signed token"/></label><button className="gold-button" disabled={busy||!qrToken.trim()||!member}>{busy?'Submitting…':'Record check-in'}</button></form>
    </div>
    {error&&<div className="form-error" role="alert">{error}</div>}{message&&<div className="qr-message" role="status">{message}</div>}
  </section>;
}
