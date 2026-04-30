// Vercel Serverless Function — Notification email équipe Edumove
// POST /api/notify-admin-activity
// Déclenché à chaque action étudiante (upload de doc, modification d'info,
// soumission/édition de candidature, choix d'universités).
const { setCorsHeaders, handlePreflight, verifyApiKey, safeError, escapeHtml, isValidEmail } = require('./_shared');

const ADMIN_RECIPIENT = { email: 'admissions@edumove.fr', name: 'Equipe Edumove' };

// Libellés affichés pour chaque type d'événement
const EVENT_LABELS = {
  doc_upload:            { badge: '📎 Document', title: 'Nouveau document envoyé' },
  doc_upload_uni:        { badge: '📎 Document fac', title: 'Nouveau document université envoyé' },
  profile_update:        { badge: '👤 Profil', title: 'Profil mis à jour' },
  candidature_submit:    { badge: '📝 Candidature', title: 'Nouvelle candidature soumise' },
  candidature_edit:      { badge: '✏️ Candidature', title: 'Candidature modifiée' },
  uni_selections_update: { badge: '🏛️ Choix universités', title: 'Choix d\'universités confirmés' }
};

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);
  if (handlePreflight(req, res)) return;
  if (!verifyApiKey(req)) return safeError(res, 401, 'Unauthorized');

  const { candidatureId, prenom, nom, email, eventType, detail } = req.body || {};
  if (!eventType || !EVENT_LABELS[eventType]) return safeError(res, 400, 'Invalid eventType');

  const brevoApiKey = process.env.BREVO_API_KEY;
  if (!brevoApiKey) return safeError(res, 500, 'Email service not configured');

  const meta = EVENT_LABELS[eventType];
  const fullName = [prenom, nom].filter(Boolean).join(' ').trim() || 'Étudiant·e';
  const safeName = escapeHtml(fullName);
  const safeEmail = email && isValidEmail(email) ? email : '';
  const safeDetail = detail ? escapeHtml(String(detail)) : '';

  const siteUrl = process.env.SITE_URL || 'https://candidature.edumove.fr';
  const adminLink = candidatureId ? `${siteUrl}/admin.html?cid=${encodeURIComponent(candidatureId)}` : `${siteUrl}/admin.html`;

  const subject = `[Activité étudiant] ${meta.title} — ${fullName}`;
  const intro = `<strong>${safeName}</strong>${safeEmail ? ' (' + escapeHtml(safeEmail) + ')' : ''} vient d'effectuer une action sur son espace candidature.`;

  const detailRow = safeDetail
    ? `<div class="msg-box"><div class="msg-label">Détail</div><div class="msg-text">${safeDetail}</div></div>`
    : '';

  const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>body{font-family:'Poppins',Arial,sans-serif;background:#f5f6fb;margin:0;padding:0}.wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(27,29,58,.1)}.header{background:#1b1d3a;padding:24px 32px;display:flex;align-items:center;gap:12px}.badge{background:#615ca5;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:.05em}.body{padding:32px}.title{font-size:18px;font-weight:700;color:#1b1d3a;margin:0 0 6px}.intro{font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 20px}.msg-box{background:#f5f6fb;border-left:3px solid #615ca5;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:22px}.msg-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:6px}.msg-text{font-size:14px;color:#1b1d3a;line-height:1.5}.footer{background:#f5f6fb;padding:18px 32px;font-size:11px;color:#9ca3af;text-align:center;border-top:1px solid #e2e4f0}</style></head><body>
<div class="wrap"><div class="header"><img src="https://edumove.fr/wp-content/uploads/2025/12/EDUMOVE-LOGO-2-1.svg" width="150" alt="Edumove" style="display:block;height:auto"/><div class="badge">${meta.badge}</div></div>
<div class="body">
<p class="title">${escapeHtml(meta.title)}</p>
<p class="intro">${intro}</p>
<div class="msg-box"><div class="msg-label">Étudiant·e</div><div class="msg-text">${safeName}${safeEmail ? '<br/><span style="color:#64748b;font-size:12px;">' + escapeHtml(safeEmail) + '</span>' : ''}</div></div>
${detailRow}
<a href="${adminLink}" style="display:block;background:#ec680a;color:#fff!important;text-decoration:none!important;text-align:center;padding:13px 24px;border-radius:10px;font-size:14px;font-weight:600;font-family:'Poppins',Arial,sans-serif">Ouvrir le dossier dans l'admin</a></div>
<div class="footer">Notification automatique — Plateforme Edumove · candidature.edumove.fr</div></div></body></html>`;

  const payload = {
    sender: { name: 'Edumove Admissions', email: 'admissions@edumove.fr' },
    to: [ADMIN_RECIPIENT],
    subject,
    htmlContent
  };
  if (safeEmail) payload.replyTo = { email: safeEmail, name: fullName };

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': brevoApiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const txt = await response.text().catch(() => '');
      console.error('notify-admin-activity brevo error:', response.status, txt);
      return safeError(res, 502, 'Email send failed');
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('notify-admin-activity failed:', err.message);
    return safeError(res, 500, 'Email send failed');
  }
};
