// ════════════════════════════════════════════════
//  CONFIGURACION  ← PEGAR TU URL AQUI
// ════════════════════════════════════════════════
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyiQGeLGs8zdt7wj16E7m6LtKqf5S_pNrjds7FF7HkjdSuAB6dZZJF3uJkSgSU_jp02Rw/exec';

// ════════════════════════════════════════════════
// "Aprobado" en datos viejos se muestra como "Solicitado" para retrocompatibilidad
const ESTADO_DISPLAY = { 'Pendiente':'Pendiente', 'Aprobado':'Solicitado', 'Solicitado':'Solicitado', 'Entregado':'Entregado', 'Rechazado':'Rechazado' };
const STATUS_COLORS  = { 'Pendiente':'pendiente', 'Aprobado':'solicitado', 'Solicitado':'solicitado', 'Entregado':'entregado', 'Rechazado':'rechazado' };

let pedidos   = [];
let articulos = [];
let usuarios  = {};
let currentUser = null;
const MUNICIPIO_LOGO_URL = '../img/logo-municipio.png';

// ── CAMBIO CORS: GET con params en URL ──
async function apiCall(params) {
  const url = SCRIPT_URL + '?data=' + encodeURIComponent(JSON.stringify(params)) + '&t=' + Date.now();
  const resp = await fetch(url);
  return await resp.json();
}

async function init() {
  try {
    const r = await apiCall({ action:'get_usuarios' });
    if (r.ok) usuarios = r.usuarios;
  } catch(e) {
    showToast('Error conectando al servidor');
  }
}

async function doLogin() {
  const u = document.getElementById('login-user').value.trim().toLowerCase();
  const p = document.getElementById('login-pass').value;
  const err = document.getElementById('login-error');
  try {
    const r = await apiCall({ action:'login', usuario:u, pass:p });
    if (r.ok) {
      currentUser = { user:u, nombre:r.nombre, rol:r.rol, dependencia:r.dependencia||'' };
      err.style.display = 'none';
      document.getElementById('admin-user-badge').textContent = r.nombre;
      const isAdmin = r.rol === 'admin';
      document.getElementById('tab-btn-usuarios').style.display  = isAdmin ? '' : 'none';
      document.getElementById('tab-btn-catalogo').style.display  = isAdmin ? '' : 'none';
      document.getElementById('tab-btn-resumen').style.display   = isAdmin ? '' : 'none';
      document.getElementById('fil-dep-wrap').style.display      = isAdmin ? '' : 'none';
      showPage('admin');
      await recargar();
    } else {
      err.style.display = 'block';
    }
  } catch(e) {
    err.textContent = 'Error de conexion. Verifica el servidor.';
    err.style.display = 'block';
  }
}

function doLogout() {
  currentUser = null;
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  showPage('login');
}

function showPage(id) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
}

function showAdminTab(id, btn) {
  document.querySelectorAll('.admin-subpage').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.admin-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('atab-'+id).classList.add('active');
  btn.classList.add('active');
  if (id==='catalogo') renderCatalogo();
  if (id==='usuarios') renderUsuarios();
  if (id==='resumen')  renderResumen();
}

async function recargar() {
  try {
    const rp = await apiCall({ action:'get_pedidos' });
    pedidos = rp.ok ? rp.pedidos : [];
    const rc = await apiCall({ action:'get_catalogo' });
    articulos = (rc.ok && rc.catalogo.length) ? rc.catalogo : [];
    renderTabla();
    renderStats();
    document.getElementById('last-update').textContent = 'Ultima actualizacion: ' + new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    showToast('Pedidos actualizados (' + pedidos.length + ')');
  } catch(e) {
    showToast('Error al actualizar. Verificar conexion.');
  }
}

function renderStats() {
  let data = pedidos;
  if (currentUser && currentUser.rol !== 'admin' && currentUser.dependencia) {
    data = data.filter(p => p.dependencia === currentUser.dependencia);
  }
  const total = data.length;
  const pend  = data.filter(p=>p.estado==='Pendiente').length;
  const soli  = data.filter(p=>p.estado==='Solicitado'||p.estado==='Aprobado').length;
  const entr  = data.filter(p=>p.estado==='Entregado').length;
  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card stat-total"><div class="stat-label">Total pedidos</div><div class="stat-val">${total}</div><div class="stat-sub">registrados</div></div>
    <div class="stat-card stat-pend"><div class="stat-label">Pendientes</div><div class="stat-val">${pend}</div><div class="stat-sub">por gestionar</div></div>
    <div class="stat-card stat-soli"><div class="stat-label">Solicitados</div><div class="stat-val">${soli}</div><div class="stat-sub">en proceso</div></div>
    <div class="stat-card stat-entr"><div class="stat-label">Entregados</div><div class="stat-val">${entr}</div><div class="stat-sub">completados</div></div>
  `;
}

function limpiarFiltros() {
  ['fil-sec','fil-dep','fil-estado','fil-fecha-desde','fil-fecha-hasta','fil-buscar'].forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    el.tagName==='SELECT'?el.selectedIndex=0:el.value='';
  });
  renderTabla();
}

function getFiltered() {
  const sec   = document.getElementById('fil-sec').value;
  const dep   = document.getElementById('fil-dep') ? document.getElementById('fil-dep').value : '';
  const est   = document.getElementById('fil-estado').value;
  const desde = document.getElementById('fil-fecha-desde').value;
  const hasta = document.getElementById('fil-fecha-hasta').value;
  const bus   = document.getElementById('fil-buscar').value.toLowerCase();
  let filtered = pedidos;
  if (currentUser && currentUser.rol !== 'admin' && currentUser.dependencia) {
    filtered = filtered.filter(p => p.dependencia === currentUser.dependencia);
  }
  return filtered.filter(p => {
    if (sec && p.secretaria !== sec) return false;
    if (dep && p.dependencia !== dep) return false;
    // Normalizar: "Aprobado" viejo = "Solicitado"
    const estadoNorm = (p.estado === 'Aprobado') ? 'Solicitado' : p.estado;
    if (est && estadoNorm !== est) return false;
    if (bus && !(
      p.nombre.toLowerCase().includes(bus) ||
      p.area.toLowerCase().includes(bus) ||
      p.secretaria.toLowerCase().includes(bus) ||
      (p.dependencia||'').toLowerCase().includes(bus)
    )) return false;
    if (desde || hasta) {
      const partes = p.fecha.split('/');
      if (partes.length===3) {
        const fd = new Date(partes[2],partes[1]-1,partes[0]);
        if (desde && fd < new Date(desde)) return false;
        if (hasta && fd > new Date(hasta)) return false;
      }
    }
    return true;
  });
}

function renderTabla() {
  const data = getFiltered();
  const tbody = document.getElementById('tabla-body');
  if (!data.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="9">No hay pedidos que coincidan con los filtros.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map((p,i) => {
    const estadoNorm = (p.estado === 'Aprobado') ? 'Solicitado' : p.estado;
    const isEntregado = estadoNorm === 'Entregado';
    return `
    <tr>
      <td style="color:var(--texto-sec);font-size:12px">${data.length-i}</td>
      <td style="white-space:nowrap"><strong>${p.fecha}</strong><br><span style="color:var(--texto-sec);font-size:12px">${p.hora}</span></td>
      <td><strong>${p.nombre}</strong>${p.email?`<br><span style="color:var(--texto-sec);font-size:12px">${p.email}</span>`:''}</td>
      <td style="font-size:12px">${p.secretaria}</td>
      <td style="font-size:12px">${p.area}</td>
      <td style="font-size:12px">${p.dependencia||'-'}</td>
      <td style="font-size:12px;max-width:200px;overflow:hidden">
        <strong>${p.items?p.items.length:0} art.</strong><br>
        <span style="color:var(--texto-sec)">${p.items?p.items.map(it=>it.articulo.split(' - ')[1]||it.articulo).join(', ').substring(0,45):''}</span>
      </td>
      <td>
        <select class="status-select status-${STATUS_COLORS[p.estado]||'pendiente'}" onchange="changeStatus('${p.id}',this.value,this)" ${isEntregado ? 'disabled title="Estado bloqueado: pedido entregado"' : ''}>
          <option ${estadoNorm==='Pendiente'?'selected':''}>Pendiente</option>
          <option ${estadoNorm==='Solicitado'?'selected':''}>Solicitado</option>
          <option ${estadoNorm==='Entregado'?'selected':''}>Entregado</option>
          <option ${estadoNorm==='Rechazado'?'selected':''}>Rechazado</option>
        </select>
      </td>
      <td style="white-space:nowrap">
        <button class="btn-secondary btn-sm" onclick="verDetalle('${p.id}')">Ver</button>
        <button class="btn-secondary btn-danger btn-sm" style="margin-left:4px" onclick="deletePedido('${p.id}')">&#10005;</button>
      </td>
    </tr>`;
  }).join('');
}

async function changeStatus(id, newStatus, sel) {
  const pedido = pedidos.find(x=>String(x.id)===String(id));
  const estadoActual = pedido ? ((pedido.estado === 'Aprobado') ? 'Solicitado' : pedido.estado) : '';
  if (estadoActual === 'Entregado') {
    sel.value = 'Entregado';
    sel.disabled = true;
    showToast('Este pedido ya fue entregado y no puede modificarse');
    return;
  }
  try {
    await apiCall({ action:'update_estado', id, estado:newStatus });
    const p = pedido || pedidos.find(x=>String(x.id)===String(id));
    if (p) p.estado = newStatus;
    sel.className = `status-select status-${STATUS_COLORS[newStatus]||'pendiente'}`;
    if (newStatus === 'Entregado') {
      sel.disabled = true;
      sel.title = 'Estado bloqueado: pedido entregado';
    } else {
      sel.disabled = false;
      sel.title = '';
    }
    renderStats();
    showToast('Estado actualizado: ' + newStatus);
  } catch(e) {
    showToast('Error al actualizar estado');
  }
}

async function deletePedido(id) {
  if (!confirm('Eliminar este pedido?')) return;
  try {
    await apiCall({ action:'delete_pedido', id });
    pedidos = pedidos.filter(p=>String(p.id)!==String(id));
    renderTabla(); renderStats();
    showToast('Pedido eliminado');
  } catch(e) {
    showToast('Error al eliminar');
  }
}

async function vaciarPedidos() {
  if (!confirm('Eliminar TODOS los pedidos? Esta accion no se puede deshacer.')) return;
  try {
    await apiCall({ action:'vaciar_pedidos' });
    pedidos = []; renderTabla(); renderStats();
    showToast('Todos los pedidos eliminados');
  } catch(e) {
    showToast('Error al vaciar pedidos');
  }
}

function verDetalle(id) {
  const p = pedidos.find(x=>String(x.id)===String(id));
  if (!p) return;
  const estadoNorm = (p.estado==='Aprobado') ? 'Solicitado' : p.estado;
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-row"><span class="lbl">Fecha:</span> ${p.fecha} ${p.hora}</div>
    <div class="modal-row"><span class="lbl">Solicitante:</span> ${p.nombre}</div>
    ${p.email?`<div class="modal-row"><span class="lbl">Email:</span> ${p.email}</div>`:''}
    <div class="modal-row"><span class="lbl">Secretaria:</span> ${p.secretaria}</div>
    <div class="modal-row"><span class="lbl">Area:</span> ${p.area}</div>
    <div class="modal-row"><span class="lbl">Dependencia:</span> ${p.dependencia||'-'}</div>
    <div class="modal-row"><span class="lbl">Estado:</span> <span class="status-badge status-${STATUS_COLORS[p.estado]||'pendiente'}">${estadoNorm}</span></div>
    ${p.observaciones?`<div class="modal-row"><span class="lbl">Observaciones:</span> <em>${p.observaciones}</em></div>`:''}
    <div class="items-detail"><table>
      <thead><tr><th>Articulo</th><th>Especificacion</th><th>Empaque</th><th>Cantidad</th></tr>Imagen</th></tr></thead>
      <tbody>${(p.items||[]).map(it=>`<tr><td>${it.articulo}</td><td>${it.especificacion||'-'}</td><td>${it.empaque||'-'}</td><td style="text-align:center"><strong>${it.cantidad}</strong></td><td>${it.foto?`<img src="${it.foto}" class="photo-thumb" onclick="showPhotoModal('${it.foto.replace(/'/g,"\\'")}')"/>`:'-'}</td></tr>`).join('')}</tbody>
    </table></div>
  `;
  document.getElementById('modal-overlay').classList.add('open');
}
function closeModal(){ document.getElementById('modal-overlay').classList.remove('open'); }

function exportExcel() {
  const data = getFiltered();
  if (!data.length) { showToast('No hay pedidos para exportar'); return; }
  const rows = [];
  data.forEach(p=>{
    const estadoNorm = (p.estado==='Aprobado') ? 'Solicitado' : p.estado;
    (p.items||[]).forEach(item=>{
      rows.push({
        'Fecha':p.fecha,'Hora':p.hora,'Estado':estadoNorm,
        'Secretaria':p.secretaria,'Area':p.area,'Dependencia':p.dependencia||'',
        'Solicitante':p.nombre,'Email':p.email||'',
        'Articulo':item.articulo,'Especificacion':item.especificacion||'',
        'Empaque':item.empaque||'','Cantidad':item.cantidad,
        'Observaciones':p.observaciones||''
      });
    });
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [10,8,12,34,34,22,22,26,28,20,10,28].map(w=>({wch:w}));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
  const fecha = new Date().toLocaleDateString('es-AR',{month:'long',year:'numeric'}).replace(' ','_');
  XLSX.writeFile(wb, `Pedidos_Libreria_${fecha}.xlsx`);
  showToast('Excel descargado');
}

function openEntregadosPrintDialog(entregados) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.45)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '1200';
    overlay.style.padding = '16px';

    const pedidosConIndice = entregados.map((p, i) => ({ ...p, _idx: i }));
    const personas = [...new Set(pedidosConIndice.map(p => (p.nombre || 'Sin nombre').trim()))]
      .sort((a, b) => a.localeCompare(b));

    overlay.innerHTML = `
      <div style="width:100%;max-width:760px;background:#fff;border-radius:12px;border:1px solid #E5E7EB;box-shadow:0 12px 35px rgba(0,0,0,.2);">
        <div style="padding:16px 18px;border-bottom:1px solid #E5E7EB;display:flex;justify-content:space-between;align-items:center;">
          <h3 style="margin:0;font-size:17px;">Imprimir / PDF de entregados</h3>
          <button id="dlg-close" style="border:none;background:none;font-size:20px;cursor:pointer;line-height:1;">&times;</button>
        </div>
        <div style="padding:16px 18px;">
          <label style="display:block;font-size:12px;font-weight:700;margin-bottom:6px;color:#6B7280;">Buscar persona</label>
          <input id="dlg-persona-search" type="text" placeholder="Ej: Juan Perez" style="width:100%;padding:10px 12px;border:1.5px solid #E5E7EB;border-radius:8px;margin-bottom:12px;" />
          <label style="display:block;font-size:12px;font-weight:700;margin-bottom:6px;color:#6B7280;">Persona</label>
          <select id="dlg-persona" style="width:100%;padding:10px 12px;border:1.5px solid #E5E7EB;border-radius:8px;margin-bottom:12px;">
            <option value="">Todas</option>
          </select>
          <div style="display:flex;gap:8px;margin-bottom:10px;">
            <button id="dlg-sel-all" class="btn-secondary btn-sm" type="button">Seleccionar visibles</button>
            <button id="dlg-clear-all" class="btn-secondary btn-sm" type="button">Limpiar seleccion</button>
          </div>
          <div id="dlg-pedidos-list" style="max-height:230px;overflow:auto;border:1px solid #E5E7EB;border-radius:8px;padding:8px 10px;margin-bottom:12px;background:#FAFAFA;"></div>
          <label style="display:block;font-size:12px;font-weight:700;margin-bottom:6px;color:#6B7280;">Nombre y apellido de quien recibe</label>
          <input id="dlg-recibe" type="text" placeholder="Ej: Juan Perez" style="width:100%;padding:10px 12px;border:1.5px solid #E5E7EB;border-radius:8px;" />
        </div>
        <div style="padding:14px 18px;border-top:1px solid #E5E7EB;display:flex;gap:8px;justify-content:flex-end;">
          <button id="dlg-cancel" class="btn-secondary">Cancelar</button>
          <button id="dlg-ok" class="btn-primary" style="width:auto;margin-top:0;">Generar PDF</button>
        </div>
      </div>
    `;

    const close = (result) => {
      overlay.remove();
      resolve(result);
    };

    const personaSearchEl = overlay.querySelector('#dlg-persona-search');
    const personaSelectEl = overlay.querySelector('#dlg-persona');
    const pedidosListEl = overlay.querySelector('#dlg-pedidos-list');

    function getVisiblePedidos() {
      const filtroNombre = (personaSearchEl.value || '').trim().toLowerCase();
      const personaSeleccionada = personaSelectEl.value;
      return pedidosConIndice.filter((p) => {
        const nombre = (p.nombre || 'Sin nombre').trim();
        if (personaSeleccionada && nombre !== personaSeleccionada) return false;
        if (filtroNombre && !nombre.toLowerCase().includes(filtroNombre)) return false;
        return true;
      });
    }

    function renderPersonas() {
      const filtroNombre = (personaSearchEl.value || '').trim().toLowerCase();
      const opciones = personas
        .filter(nombre => !filtroNombre || nombre.toLowerCase().includes(filtroNombre))
        .map(nombre => `<option value="${nombre.replace(/"/g, '&quot;')}">${nombre}</option>`)
        .join('');
      const valorActual = personaSelectEl.value;
      personaSelectEl.innerHTML = `<option value="">Todas</option>${opciones}`;
      if (valorActual && [...personaSelectEl.options].some(o => o.value === valorActual)) {
        personaSelectEl.value = valorActual;
      }
    }

    function renderPedidos() {
      const visibles = getVisiblePedidos();
      if (!visibles.length) {
        pedidosListEl.innerHTML = '<div style="font-size:12px;color:#6B7280;padding:8px;">No hay pedidos para ese filtro.</div>';
        return;
      }
      pedidosListEl.innerHTML = visibles.map((p) => {
        const numero = p.id || (p._idx + 1);
        return `
          <label style="display:flex;align-items:flex-start;gap:8px;padding:7px 4px;border-bottom:1px solid #E5E7EB;cursor:pointer;">
            <input type="checkbox" class="dlg-pedido-check" value="${p._idx}" />
            <span style="font-size:12px;line-height:1.35;">
              <strong>#${numero}</strong> - ${(p.nombre || 'Sin nombre')}<br />
              <span style="color:#6B7280">${p.fecha} ${p.hora || ''} - ${(p.area || '-')} - ${(p.dependencia || '-')}</span>
            </span>
          </label>
        `;
      }).join('');
    }

    renderPersonas();
    renderPedidos();

    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) close(null);
    });
    personaSearchEl.addEventListener('input', () => {
      renderPersonas();
      renderPedidos();
    });
    personaSelectEl.addEventListener('change', renderPedidos);
    overlay.querySelector('#dlg-sel-all').addEventListener('click', () => {
      overlay.querySelectorAll('.dlg-pedido-check').forEach(chk => { chk.checked = true; });
    });
    overlay.querySelector('#dlg-clear-all').addEventListener('click', () => {
      overlay.querySelectorAll('.dlg-pedido-check').forEach(chk => { chk.checked = false; });
    });
    overlay.querySelector('#dlg-close').addEventListener('click', () => close(null));
    overlay.querySelector('#dlg-cancel').addEventListener('click', () => close(null));
    overlay.querySelector('#dlg-ok').addEventListener('click', () => {
      const recibeNombre = overlay.querySelector('#dlg-recibe').value.trim();
      if (!recibeNombre) {
        showToast('Debes indicar quien recibe para generar el PDF');
        return;
      }
      const seleccionados = [...overlay.querySelectorAll('.dlg-pedido-check:checked')]
        .map(chk => parseInt(chk.value, 10))
        .filter(idx => Number.isInteger(idx) && idx >= 0 && idx < entregados.length);
      if (!seleccionados.length) {
        showToast('Selecciona al menos un pedido para imprimir');
        return;
      }
      const pedidosParaImprimir = seleccionados.map(idx => entregados[idx]);
      close({ pedidosParaImprimir, recibeNombre });
    });

    document.body.appendChild(overlay);
    const inputRecibe = overlay.querySelector('#dlg-recibe');
    personaSearchEl.focus();
    [personaSearchEl, inputRecibe].forEach((el) => {
      el.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') overlay.querySelector('#dlg-ok').click();
        if (ev.key === 'Escape') close(null);
      });
    });
  });
}

async function printEntregadosPDF() {
  const entregados = getFiltered().filter(p => {
    const estadoNorm = (p.estado === 'Aprobado') ? 'Solicitado' : p.estado;
    return estadoNorm === 'Entregado';
  });

  if (!entregados.length) {
    showToast('No hay pedidos entregados para imprimir');
    return;
  }

  let selection = null;
  try {
    selection = await openEntregadosPrintDialog(entregados);
  } catch (e) {
    showToast('No se pudo abrir el selector de pedidos');
    return;
  }
  if (!selection) return;
  const { pedidosParaImprimir, recibeNombre } = selection;

  const generado = new Date().toLocaleString('es-AR');
  const fechaFirma = new Date().toLocaleDateString('es-AR');
  const filas = pedidosParaImprimir.map((p, i) => {
    const items = (p.items || []).map(it => `${it.articulo} (${it.cantidad})`).join(', ');
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${p.fecha} ${p.hora || ''}</td>
        <td>${p.nombre || '-'}</td>
        <td>${p.secretaria || '-'}</td>
        <td>${p.area || '-'}</td>
        <td>${p.dependencia || '-'}</td>
        <td>${items || '-'}</td>
      </tr>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>Pedidos Entregados</title>
      <style>
        @page { size: A4 portrait; margin: 14mm 12mm 16mm 12mm; }
        body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
        .head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
        .brand { display: flex; align-items: center; gap: 12px; }
        .brand img { width: 64px; height: 64px; object-fit: contain; }
        .brand-fallback { width: 64px; height: 64px; border-radius: 10px; background: #D4532B; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; }
        h1 { font-size: 18px; margin: 0; }
        .sub { margin: 2px 0 0; font-size: 12px; color: #6B7280; }
        p { margin: 0 0 10px; font-size: 12px; color: #6B7280; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #D1D5DB; padding: 6px 8px; text-align: left; vertical-align: top; }
        th { background: #F3F4F6; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
        .firma-wrap { margin-top: 38px; display: flex; justify-content: flex-end; }
        .firma { width: 320px; font-size: 12px; text-align: center; }
        .firma-line { border-top: 1px solid #111827; margin: 34px 0 8px; }
        .avoid-break { page-break-inside: avoid; break-inside: avoid; }
        @media print {
          body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tr { page-break-inside: avoid; break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="head">
        <div class="brand">
          <img src="${MUNICIPIO_LOGO_URL}" alt="Logo Municipalidad" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
          <div class="brand-fallback" style="display:none;">JM</div>
          <div>
            <h1>Municipalidad de Jesus Maria</h1>
            <div class="sub">${pedidosParaImprimir.length === 1 ? 'Pedido entregado' : 'Listado de pedidos entregados'}</div>
          </div>
        </div>
      </div>
      <p>Generado: ${generado} - Total pedidos: ${pedidosParaImprimir.length}</p>
      <table class="avoid-break">
        <thead>
          <tr>
            <th>#</th>
            <th>Fecha / Hora</th>
            <th>Solicitante</th>
            <th>Secretaria</th>
            <th>Area</th>
            <th>Dependencia</th>
            <th>Articulos</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
      <div class="firma-wrap avoid-break">
        <div class="firma">
          <div class="firma-line"></div>
          <div><strong>Firma de quien recibe</strong></div>
          <div>${recibeNombre}</div>
          <div>Fecha: ${fechaFirma}</div>
        </div>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showToast('El navegador bloqueo la ventana de impresion');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

// ══════════════════════════════════════════════════
//  RESUMEN UNIFICADO
// ══════════════════════════════════════════════════
function getResumenData() {
  const depFil    = document.getElementById('res-dep').value;
  const estadoFil = document.getElementById('res-estado').value;  // '' = ambos, o 'Pendiente'/'Solicitado'
  const busFil    = document.getElementById('res-buscar').value.toLowerCase().trim();
const busFilnombre    = document.getElementById('res-buscar').value.toLowerCase().trim();
  // Filtrar pedidos por dependencia y estado
  let pedidosFil = pedidos.filter(p => {
    if (depFil && p.dependencia !== depFil) return false;
    const estadoNorm = (p.estado==='Aprobado') ? 'Solicitado' : p.estado;
    if (estadoFil === '') {
      // Pendiente O Solicitado
      if (estadoNorm !== 'Pendiente' && estadoNorm !== 'Solicitado') return false;
    } else {
      if (estadoNorm !== estadoFil) return false;
    }
     if (busFilnombre) {
      const nombreMatch = (p.nombre || '').toLowerCase().includes(busFil);
      const areaMatch   = (p.dependencia || '').toLowerCase().includes(busFil);
      if (!nombreMatch && !areaMatch) return false;
    }
    return true;
  });

  // Agrupar articulos
  const mapa = {}; // clave: articulo string
  pedidosFil.forEach(p => {
    (p.items||[]).forEach(item => {
      const key = item.articulo;
      if (!mapa[key]) {
        mapa[key] = { articulo: key, cantidad: 0, pedidos: 0, solicitantes: [] };
      }
      mapa[key].cantidad += parseInt(item.cantidad) || 1;
      mapa[key].pedidos  += 1;
      const label = p.nombre + (p.area ? ' (' + p.area + ')' : '');
      if (!mapa[key].solicitantes.includes(label)) mapa[key].solicitantes.push(label);
    });
  });

  let rows = Object.values(mapa).sort((a,b) => a.articulo.localeCompare(b.articulo));

  // Filtro de busqueda por articulo
  if (busFil) rows = rows.filter(r => r.articulo.toLowerCase().includes(busFil));

  return { rows, totalPedidos: pedidosFil.length };
}

function renderResumen() {
  const { rows, totalPedidos } = getResumenData();
  const tbody = document.getElementById('resumen-body');
  const bar   = document.getElementById('resumen-summary-bar');

  bar.innerHTML = `<span class="resumen-info">
    <strong>${rows.length}</strong> articulos distintos &middot;
    provenientes de <strong>${totalPedidos}</strong> pedidos
  </span>`;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="resumen-empty">No hay articulos que coincidan con los filtros seleccionados.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((r, i) => {
    const partes = r.articulo.split(' - ');
    const codigo = partes[0] || '';
    const nombre = partes.slice(1).join(' - ') || r.articulo;
    return `
      <tr>
        <td style="color:var(--texto-sec);font-size:12px;font-weight:600">${i+1}</td>
        <td><span class="codigo-art">${codigo}</span></td>
        <td><span class="nombre-art">${nombre}</span></td>
        <td style="text-align:center"><span class="cant-badge">${r.cantidad}</span></td>
        <td style="font-size:12px;color:var(--texto-sec)">${r.pedidos} pedido${r.pedidos!==1?'s':''}</td>
        <td><div class="solicitantes-list">${r.solicitantes.join('<br>')}</div></td>
      </tr>`;
  }).join('');
}

function limpiarFiltrosResumen() {
  document.getElementById('res-dep').selectedIndex = 0;
  document.getElementById('res-estado').selectedIndex = 0;
  document.getElementById('res-buscar').value = '';
  renderResumen();
}

function exportResumenExcel() {
  const { rows, totalPedidos } = getResumenData();
  if (!rows.length) { showToast('No hay articulos para exportar'); return; }
  const data = rows.map((r,i) => {
    const partes = r.articulo.split(' - ');
    return {
      'N°': i+1,
      'Codigo': partes[0]||'',
      'Articulo': partes.slice(1).join(' - ')||r.articulo,
      'Cantidad total': r.cantidad,
      'N° pedidos': r.pedidos,
      'Solicitado por': r.solicitantes.join(' | ')
    };
  });
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [5,14,40,14,10,50].map(w=>({wch:w}));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedido Unificado');
  const fecha = new Date().toLocaleDateString('es-AR',{month:'long',year:'numeric'}).replace(' ','_');
  XLSX.writeFile(wb, `Pedido_Unificado_${fecha}.xlsx`);
  showToast('Excel del pedido unificado descargado');
}

// ══════════════════════════════════════════════════
//  CATALOGO
// ══════════════════════════════════════════════════
function renderCatalogo() {
  document.getElementById('catalogo-grid').innerHTML = articulos.map((a,i)=>`
    <div class="cat-item"><span>${a}</span>
      <button class="btn-icon" onclick="removeArt(${i})" title="Eliminar" style="font-size:14px;flex-shrink:0">&#10005;</button>
    </div>`).join('') || '<p style="color:var(--texto-sec);font-size:13px">No hay articulos en el catalogo.</p>';
}

async function addArt() {
  const inp = document.getElementById('nuevo-art');
  const val = inp.value.trim();
  if (!val) return;
  if (articulos.includes(val)) { showToast('Ya existe ese articulo'); return; }
  articulos.push(val);
  await apiCall({ action:'set_catalogo', catalogo:JSON.stringify(articulos) });
  renderCatalogo(); inp.value = '';
  showToast('Articulo agregado');
}

async function removeArt(idx) {
  if (!confirm(`Eliminar "${articulos[idx]}" del catalogo?`)) return;
  articulos.splice(idx,1);
  await apiCall({ action:'set_catalogo', catalogo:JSON.stringify(articulos) });
  renderCatalogo();
  showToast('Articulo eliminado');
}

// ══════════════════════════════════════════════════
//  USUARIOS
// ══════════════════════════════════════════════════
async function renderUsuarios() {
  try {
    const r = await apiCall({ action:'get_usuarios' });
    if (r.ok) usuarios = r.usuarios;
  } catch(e) {}
  document.getElementById('usuarios-grid').innerHTML = Object.entries(usuarios).map(([user,u])=>`
    <div class="user-card">
      <div class="user-info">
        <div class="user-nombre">${u.nombre}</div>
        <div class="user-meta">Usuario: <strong>${user}</strong> &middot; Contrasena: <code>${u.pass}</code></div>
        <span class="user-role role-${u.rol}">${u.rol==='admin'?'Administrador':'Receptor'}</span>
        ${u.dependencia?`<span class="dep-badge dep-${depClass(u.dependencia)}">${u.dependencia}</span>`:u.rol==='admin'?'<span class="dep-badge dep-todas">Todas</span>':''}
      </div>
      ${user!==currentUser.user?`<button class="btn-icon" onclick="eliminarUsuario('${user}')" title="Eliminar" style="color:var(--rojo);font-size:18px">&#10005;</button>`:'<span style="font-size:11px;color:var(--texto-sec)">(vos)</span>'}
    </div>`).join('');
}

function depClass(dep) {
  if (!dep) return 'todas';
  if (dep.toLowerCase().includes('edificio')) return 'edificio';
  if (dep.toLowerCase().includes('obrador'))  return 'obrador';
  if (dep.toLowerCase().includes('almafuerte')) return 'almafuerte';
  return 'todas';
}

async function guardarNuevoUsuario() {
  const nombre = document.getElementById('nu-nombre').value.trim();
  const user   = document.getElementById('nu-user').value.trim().toLowerCase().replace(/\s/g,'');
  const pass   = document.getElementById('nu-pass').value.trim();
  const rol    = document.getElementById('nu-rol').value;
  const dep    = document.getElementById('nu-dep').value;
  if (!nombre||!user||!pass) { showToast('Completa todos los campos'); return; }
  if (rol==='receptor' && !dep) { showToast('Selecciona una dependencia para el receptor'); return; }
  if (usuarios[user]) { showToast('Ya existe ese usuario'); return; }
  usuarios[user] = { nombre, pass, rol, dependencia:dep };
  await apiCall({ action:'set_usuarios', usuarios:JSON.stringify(usuarios) });
  renderUsuarios();
  ['nu-nombre','nu-user','nu-pass'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('nu-rol').selectedIndex = 0;
  document.getElementById('nu-dep').selectedIndex = 0;
  document.getElementById('new-user-section').style.display='none';
  showToast('Usuario creado: '+user);
}

async function eliminarUsuario(user) {
  if (!confirm(`Eliminar al usuario "${usuarios[user].nombre}"?`)) return;
  delete usuarios[user];
  await apiCall({ action:'set_usuarios', usuarios:JSON.stringify(usuarios) });
  renderUsuarios();
  showToast('Usuario eliminado');
}


function showToast(msg){ const t=document.getElementById('toast'); document.getElementById('toast-msg').textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3000); }

function showPhotoModal(src) {
  const div = document.createElement('div');
  div.className = 'photo-modal';
  div.onclick = function(){ div.remove(); };
  div.innerHTML = `<img src="${src}" />`;
  document.body.appendChild(div);
}

init();

