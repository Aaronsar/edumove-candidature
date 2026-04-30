// Vercel Serverless Function — Notification email "candidature UEM complétée"
// POST /api/notify-uem-complete
// Envoyé à Jessica Simi (Universidad Europea) lorsqu'un admin Edumove
// passe le suivi de remplissage d'un étudiant au statut "vert" (complet).
const { setCorsHeaders, handlePreflight, verifyApiKey, safeError, escapeHtml } = require('./_shared');

const UEM_RECIPIENTS = [
  { email: 'jessica.simi@universidadeuropea.es', name: 'Jessica Simi' }
];

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);
  if (handlePreflight(req, res)) return;
  if (!verifyApiKey(req)) return safeError(res, 401, 'Unauthorized');

  const { nom, prenom } = req.body || {};
  if (!nom && !prenom) return safeError(res, 400, 'Missing student name');

  const brevoApiKey = process.env.BREVO_API_KEY;
  if (!brevoApiKey) return safeError(res, 500, 'Email service not configured');

  const fullName = [prenom, nom].filter(Boolean).join(' ').trim() || 'Étudiant·e';
  const safeName = escapeHtml(fullName);

  const subject = `Candidature complétée — ${fullName}`;
  const intro = `Bonjour Jessica,<br/><br/>L'équipe Edumove vous informe que la page de candidature de l'étudiant·e <strong>${safeName}</strong> vient d'être <strong>complétée à 100&nbsp;%</strong>.`;

  const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>body{font-family:'Poppins',Arial,sans-serif;background:#f5f6fb;margin:0;padding:0}.wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(27,29,58,.1)}.header{background:#1b1d3a;padding:24px 32px;display:flex;align-items:center;gap:12px}.badge{background:#16a34a;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:.05em}.body{padding:32px}.intro{font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 20px}.msg-box{background:#f0fdf4;border-left:3px solid #16a34a;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px}.msg-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#15803d;margin-bottom:6px}.msg-text{font-size:15px;color:#1b1d3a;font-weight:600}.footer{background:#f5f6fb;padding:18px 32px;font-size:11px;color:#9ca3af;text-align:center;border-top:1px solid #e2e4f0}</style></head><body>
<div class="wrap"><div class="header"><img src="https://edumove.fr/wp-content/uploads/2025/12/EDUMOVE-LOGO-2-1.svg" width="150" alt="Edumove" style="display:block;height:auto"/><div class="badge">✅ Complété</div></div>
<div class="body"><p class="intro">${intro}</p>
<div class="msg-box"><div class="msg-label">Étudiant·e</div><div class="msg-text">${safeName}</div></div>
<p style="font-size:13px;color:#4b5563;line-height:1.6;margin:0;">Vous pouvez désormais procéder à l'examen du dossier de votre côté. L'équipe Edumove reste à votre disposition pour toute question.</p>
<p style="font-size:13px;color:#4b5563;line-height:1.6;margin-top:18px;">Bien cordialement,<br/>L'équipe Edumove</p></div>
<div class="footer">Notification automatique — Plateforme Edumove · candidature.edumove.fr</div></div></body></html>`;

  const payload = {
    sender: { name: 'Edumove Admissions', email: 'admissions@edumove.fr' },
    to: UEM_RECIPIENTS,
    replyTo: { email: 'admissions@edumove.fr', name: 'Edumove Admissions' },
    subject,
    htmlContent
  };

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': brevoApiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const txt = await response.text().catch(() => '');
      console.error('notify-uem-complete brevo error:', response.status, txt);
      return safeError(res, 502, 'Email send failed');
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('notify-uem-complete failed:', err.message);
    return safeError(res, 500, 'Email send failed');
  }
};
