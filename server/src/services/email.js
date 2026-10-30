const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export function accountActionUrl(parameter, token) {
  const base = String(process.env.APP_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!base || !/^https:\/\//i.test(base)) {
    const error = new Error('Account email is not configured. Please contact the NCBI administrator.');
    error.status = 503;
    throw error;
  }
  return base + '/?' + encodeURIComponent(parameter) + '=' + encodeURIComponent(token);
}

export async function sendAccountEmail({ to, subject, text, html }) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.EMAIL_FROM || '').trim();
  if (!apiKey || !from) {
    const error = new Error('Email delivery is not configured. Please contact the NCBI administrator.');
    error.status = 503;
    throw error;
  }
  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text, html })
  });
  if (!response.ok) {
    const error = new Error('Email delivery is temporarily unavailable. Please try again later.');
    error.status = 503;
    throw error;
  }
}
