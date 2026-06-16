// Vercel Serverless Function — Notification email "Nouveau message dans votre espace candidat"
// POST /api/bulk-message-notify
// Body: { recipients: [{ email, prenom, nom? }] }
const { setCorsHeaders, handlePreflight, verifyApiKey, safeError, isValidEmail, capitalize } = require('./_shared');

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);
  if (handlePreflight(req, res)) return;
  if (!verifyApiKey(req)) return safeError(res, 401, 'Unauthorized');

  const { recipients } = req.body || {};
  if (!Array.isArray(recipients) || !recipients.length) return safeError(res, 400, 'Missing recipients');
  if (recipients.length > 100) return safeError(res, 400, 'Max 100 recipients per batch');

  const brevoApiKey = process.env.BREVO_API_KEY;
  if (!brevoApiKey) return safeError(res, 500, 'Email service not configured');

  const siteUrl = process.env.SITE_URL || 'https://candidature.edumove.fr';
  const results = { sent: 0, failed: 0 };

  for (const r of recipients) {
    if (!r || !r.email || !isValidEmail(r.email)) { results.failed++; continue; }
    const prenom = capitalize(r.prenom);

    const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>body{font-family:'Poppins',Arial,sans-serif;background:#f5f6fb;margin:0;padding:0}.wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(27,29,58,.1)}.header{background:#1b1d3a;padding:24px 32px}.body{padding:32px}.text{font-size:14px;color:#4b5563;line-height:1.7}.btn{display:inline-block;background:#ec680a;color:#fff!important;text-decoration:none!important;padding:13px 28px;border-radius:10px;font-size:14px;font-weight:600}.footer{background:#f5f6fb;padding:18px 32px;font-size:11px;color:#9ca3af;text-align:center;border-top:1px solid #e2e4f0}</style></head><body>
<div class="wrap">
  <div class="header"><img src="https://edumove.fr/wp-content/uploads/2025/12/EDUMOVE-LOGO-2-1.svg" width="150" alt="Edumove" style="display:block;height:auto"/></div>
  <div class="body">
    <div class="text">
      <p style="font-size:16px;font-weight:600;color:#1b1d3a;margin-top:0;">Bonjour ${prenom},</p>
      <p>Vous avez <strong>un nouveau message</strong> de l'équipe Edumove dans votre espace candidat.</p>
      <p>Connectez-vous pour le consulter et y répondre.</p>
    </div>
    <div style="margin-top:28px;text-align:center;">
      <a href="${siteUrl}" class="btn">Voir mon message</a>
    </div>
  </div>
  <div class="footer">Edumove Admissions · candidature.edumove.fr</div>
</div>
</body></html>`;

    const emailBody = {
      sender: { name: 'Edumove Admissions', email: 'admissions@edumove.fr' },
      to: [{ email: r.email, name: prenom }],
      subject: 'Nouveau message dans votre espace candidat',
      htmlContent
    };

    try {
      const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': brevoApiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(emailBody)
      });
      if (resp.ok) { results.sent++; }
      else {
        const errText = await resp.text();
        console.error('Brevo bulk-message-notify error:', errText);
        results.failed++;
      }
    } catch (err) {
      console.error('bulk-message-notify failed:', err.message);
      results.failed++;
    }
  }

  return res.status(200).json({ ok: true, results });
};
