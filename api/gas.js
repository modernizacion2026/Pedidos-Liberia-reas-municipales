// api/gas.js — proxy entre la web y Google Apps Script
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  }

  const { GAS_URL, GAS_KEY } = process.env;
  if (!GAS_URL || !GAS_KEY) {
    return res.status(500).json({ ok: false, error: 'Falta configurar el servidor' });
  }

  let params = req.body;
  if (typeof params === 'string') {
    try { params = JSON.parse(params); } catch { params = {}; }
  }
  params = params || {};

  // La clave la pone el servidor; el navegador nunca la ve
  const body = JSON.stringify({ ...params, key: GAS_KEY });

  let ultimoError = 'Sin respuesta del servidor';
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const r = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
        redirect: 'follow'
      });
      const texto = await r.text();
      try {
        const data = JSON.parse(texto);
        return res.status(200).json(data);
      } catch {
        ultimoError = 'Respuesta inválida de Google';
      }
    } catch (e) {
      ultimoError = String(e.message || e);
    }
    await new Promise(ok => setTimeout(ok, 500 * intento));
  }
  return res.status(502).json({ ok: false, error: ultimoError });
};
