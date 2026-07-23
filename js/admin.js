const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyiQGeLGs8zdt7wj16E7m6LtKqf5S_pNrjds7FF7HkjdSuAB6dZZJF3uJkSgSU_jp02Rw/exec';

const ESTADO_DISPLAY = { 'Pendiente':'Pendiente','Aprobado':'Solicitado','Solicitado':'Solicitado','Entregado':'Entregado','Rechazado':'Rechazado' };
const STATUS_COLORS  = { 'Pendiente':'pendiente','Aprobado':'solicitado','Solicitado':'solicitado','Entregado':'entregado','Rechazado':'rechazado' };

let pedidos   = [];
let articulos = [];
let usuarios  = {};
let currentUser = null;
const MUNICIPIO_LOGO_URL = '../img/logo-municipio.png';

async function apiCall(params) {
  const url = SCRIPT_URL + '?data=' + encodeURIComponent(JSON.stringify(params)) + '&t=' + Date.now();
  const resp = await fetch(url);
  return await resp.json();
}

async function init() {
  try {
    const r = await apiCall({ action:'get_usuarios' });
    if (r.ok) usuarios = r.usuarios;
  } catch(e) { showToast('Error conectando al servidor'); }
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
      document.getElementById('tab-btn-usuarios').style.display = isAdmin ? '' : 'none';
      document.getElementById('tab-btn-catalogo').style.display = isAdmin ? '' : 'none';
      document.getElementById('tab-btn-resumen').style.display  = isAdmin ? '' : 'none';
      document.getElementById('fil-dep-wrap').style.display     = isAdmin ? '' : 'none';
      showPage('admin');
      await recargar();
    } else { err.style.display = 'block'; }
  } catch(e) { err.textContent = 'Error de conexion.'; err.style.display = 'block'; }
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
  } catch(e) { showToast('Error al actualizar. Verificar conexion.'); }
}

function renderStats() {
  let data = pedidos;
  if (currentUser && currentUser.rol !== 'admin' && currentUser.dependencia)
    data = data.filter(p => p.dependencia === currentUser.dependencia);
  const total = data.length;
  const pend  = data.filter(p=>p.estado==='Pendiente').length;
  const soli  = data.filter(p=>p.estado==='Solicitado'||p.estado==='Aprobado').length;
  const entr  = data.filter(p=>p.estado==='Entregado').length;
  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card stat-total"><div class="stat-label">Total pedidos</div><div class="stat-val">${total}</div><div class="stat-sub">registrados</div></div>
    <div class="stat-card stat-pend"><div class="stat-label">Pendientes</div><div class="stat-val">${pend}</div><div class="stat-sub">por gestionar</div></div>
    <div class="stat-card stat-soli"><div class="stat-label">Solicitados</div><div class="stat-val">${soli}</div><div class="stat-sub">en proceso</div></div>
    <div class="stat-card stat-entr"><div class="stat-label">Entregados</div><div class="stat-val">${entr}</div><div class="stat-sub">completados</div></div>`;
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
  if (currentUser && currentUser.rol !== 'admin' && currentUser.dependencia)
    filtered = filtered.filter(p => p.dependencia === currentUser.dependencia);
  return filtered.filter(p => {
    if (sec && p.secretaria !== sec) return false;
    if (dep && p.dependencia !== dep) return false;
    const estadoNorm = (p.estado==='Aprobado') ? 'Solicitado' : p.estado;
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
    const estadoNorm = (p.estado==='Aprobado') ? 'Solicitado' : p.estado;
    const isEntregado = estadoNorm === 'Entregado';
    // Indicador de items con estado mixto
    const items = p.items || [];
    const itemsConEstado = items.filter(it => it.estadoItem);
    const itemsPend = items.filter(it => it.estadoItem === 'pendiente').length;
    const itemsTag = itemsConEstado.length > 0
      ? `<br><span style="font-size:10px;color:${itemsPend>0?'#D97706':'#059669'};font-weight:600">${itemsPend>0?itemsPend+' pend.':'✓ completo'}</span>`
      : '';
    return `
    <tr>
      <td style="color:var(--texto-sec);font-size:12px">${data.length-i}</td>
      <td style="white-space:nowrap"><strong>${p.fecha}</strong><br><span style="color:var(--texto-sec);font-size:12px">${p.hora}</span></td>
      <td><strong>${p.nombre}</strong>${p.email?`<br><span style="color:var(--texto-sec);font-size:12px">${p.email}</span>`:''}</td>
      <td style="font-size:12px">${p.secretaria}</td>
      <td style="font-size:12px">${p.area}</td>
      <td style="font-size:12px">${p.dependencia||'-'}</td>
      <td style="font-size:12px;max-width:200px;overflow:hidden">
        <strong>${items.length} art.</strong>${itemsTag}<br>
        <span style="color:var(--texto-sec)">${items.map(it=>it.articulo.split(' - ')[1]||it.articulo).join(', ').substring(0,45)}</span>
      </td>
      <td>
        <select class="status-select status-${STATUS_COLORS[p.estado]||'pendiente'}" onchange="changeStatus('${p.id}',this.value,this)" ${isEntregado?'disabled title="Bloqueado: entregado"':''}>
          <option ${estadoNorm==='Pendiente'?'selected':''}>Pendiente</option>
          <option ${estadoNorm==='Solicitado'?'selected':''}>Solicitado</option>
          <option ${estadoNorm==='Entregado'?'selected':''}>Entregado</option>
          <option ${estadoNorm==='Rechazado'?'selected':''}>Rechazado</option>
        </select>
      </td>
      <td style="white-space:nowrap">
        <button class="btn-secondary btn-sm" onclick="verDetalle('${p.id}')">Ver</button>
        <button class="btn-secondary btn-sm" style="margin-left:4px;background:#EFF6FF;color:#2563EB;border-color:#93C5FD" onclick="remitoEquipo('${p.id}')" title="Remito por equipo">Rem. Equipo</button>
        <button class="btn-secondary btn-danger btn-sm" style="margin-left:4px" onclick="deletePedido('${p.id}')">&#10005;</button>
      </td>
    </tr>`;
  }).join('');
}

async function changeStatus(id, newStatus, sel) {
  const pedido = pedidos.find(x=>String(x.id)===String(id));
  const estadoActual = pedido ? ((pedido.estado==='Aprobado')?'Solicitado':pedido.estado) : '';
  if (estadoActual === 'Entregado') {
    sel.value = 'Entregado'; sel.disabled = true;
    showToast('Este pedido ya fue entregado y no puede modificarse'); return;
  }
  try {
    await apiCall({ action:'update_estado', id, estado:newStatus });
    const p = pedido || pedidos.find(x=>String(x.id)===String(id));
    if (p) p.estado = newStatus;
    sel.className = `status-select status-${STATUS_COLORS[newStatus]||'pendiente'}`;
    if (newStatus==='Entregado') { sel.disabled=true; sel.title='Bloqueado: entregado'; }
    else { sel.disabled=false; sel.title=''; }
    renderStats();
    showToast('Estado actualizado: ' + newStatus);
  } catch(e) { showToast('Error al actualizar estado'); }
}

async function deletePedido(id) {
  if (!confirm('Eliminar este pedido?')) return;
  try {
    await apiCall({ action:'delete_pedido', id });
    pedidos = pedidos.filter(p=>String(p.id)!==String(id));
    renderTabla(); renderStats();
    showToast('Pedido eliminado');
  } catch(e) { showToast('Error al eliminar'); }
}

async function vaciarPedidos() {
  if (!confirm('Eliminar TODOS los pedidos? Esta accion no se puede deshacer.')) return;
  try {
    await apiCall({ action:'vaciar_pedidos' });
    pedidos=[]; renderTabla(); renderStats();
    showToast('Todos los pedidos eliminados');
  } catch(e) { showToast('Error al vaciar pedidos'); }
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
      <thead><tr><th>Articulo</th><th>Espec.</th><th>Empaque</th><th>Cant.</th><th>Estado item</th><th>Imagen</th></tr></thead>
      <tbody>${(p.items||[]).map(it=>{
        const esE = it.estadoItem === 'entregado';
        const esP = it.estadoItem === 'pendiente';
        const badge = esE ? '<span style="background:#D1FAE5;color:#065F46;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">Entregado</span>'
                    : esP ? '<span style="background:#FEF3C7;color:#92400E;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">Pendiente</span>'
                    : '-';
        return `<tr><td>${it.articulo}</td><td>${it.especificacion||'-'}</td><td>${it.empaque||'-'}</td><td style="text-align:center"><strong>${it.cantidad}</strong></td><td>${badge}</td><td>${it.foto?`<img src="${it.foto}" class="photo-thumb" onclick="showPhotoModal('${it.foto.replace(/'/g,"\\'")}')"/>`:'-'}</td></tr>`;
      }).join('')}</tbody>
    </table></div>`;
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
        'Estado articulo':item.estadoItem||'','Observaciones':p.observaciones||''
      });
    });
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [10,8,12,34,34,22,22,26,28,20,10,8,12,28].map(w=>({wch:w}));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
  const fecha = new Date().toLocaleDateString('es-AR',{month:'long',year:'numeric'}).replace(' ','_');
  XLSX.writeFile(wb, `Pedidos_Libreria_${fecha}.xlsx`);
  showToast('Excel descargado');
}

// ══════════════════════════════════════════════
//  PDF REMITO COMUN (el que ya existia)
// ══════════════════════════════════════════════
function openEntregadosPrintDialog(entregados) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:1200;padding:16px';
    const pedidosConIndice = entregados.map((p,i)=>({...p,_idx:i}));
    const personas = [...new Set(pedidosConIndice.map(p=>(p.nombre||'Sin nombre').trim()))].sort((a,b)=>a.localeCompare(b));
    overlay.innerHTML = `
      <div style="width:100%;max-width:760px;background:#fff;border-radius:12px;border:1px solid #E5E7EB;box-shadow:0 12px 35px rgba(0,0,0,.2);">
        <div style="padding:16px 18px;border-bottom:1px solid #E5E7EB;display:flex;justify-content:space-between;align-items:center;">
          <h3 style="margin:0;font-size:17px;">Imprimir / PDF de entregados</h3>
          <button id="dlg-close" style="border:none;background:none;font-size:20px;cursor:pointer;">&times;</button>
        </div>
        <div style="padding:16px 18px;">
          <label style="display:block;font-size:12px;font-weight:700;margin-bottom:6px;color:#6B7280;">Buscar persona</label>
          <input id="dlg-persona-search" type="text" placeholder="Ej: Juan Perez" style="width:100%;padding:10px 12px;border:1.5px solid #E5E7EB;border-radius:8px;margin-bottom:12px;" />
          <label style="display:block;font-size:12px;font-weight:700;margin-bottom:6px;color:#6B7280;">Persona</label>
          <select id="dlg-persona" style="width:100%;padding:10px 12px;border:1.5px solid #E5E7EB;border-radius:8px;margin-bottom:12px;"><option value="">Todas</option></select>
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
      </div>`;
    const close = (result) => { overlay.remove(); resolve(result); };
    const personaSearchEl = overlay.querySelector('#dlg-persona-search');
    const personaSelectEl = overlay.querySelector('#dlg-persona');
    const pedidosListEl   = overlay.querySelector('#dlg-pedidos-list');
    function getVisiblePedidos() {
      const fn = (personaSearchEl.value||'').trim().toLowerCase();
      const ps = personaSelectEl.value;
      return pedidosConIndice.filter(p=>{
        const n=(p.nombre||'Sin nombre').trim();
        if(ps && n!==ps) return false;
        if(fn && !n.toLowerCase().includes(fn)) return false;
        return true;
      });
    }
    function renderPersonas() {
      const fn=(personaSearchEl.value||'').trim().toLowerCase();
      const opc=personas.filter(n=>!fn||n.toLowerCase().includes(fn)).map(n=>`<option value="${n.replace(/"/g,'&quot;')}">${n}</option>`).join('');
      const va=personaSelectEl.value;
      personaSelectEl.innerHTML=`<option value="">Todas</option>${opc}`;
      if(va&&[...personaSelectEl.options].some(o=>o.value===va)) personaSelectEl.value=va;
    }
    function renderPedidos() {
      const vis=getVisiblePedidos();
      if(!vis.length){pedidosListEl.innerHTML='<div style="font-size:12px;color:#6B7280;padding:8px;">No hay pedidos para ese filtro.</div>';return;}
      pedidosListEl.innerHTML=vis.map(p=>`
        <label style="display:flex;align-items:flex-start;gap:8px;padding:7px 4px;border-bottom:1px solid #E5E7EB;cursor:pointer;">
          <input type="checkbox" class="dlg-pedido-check" value="${p._idx}" />
          <span style="font-size:12px;line-height:1.35;"><strong>#${p.id||(p._idx+1)}</strong> - ${p.nombre||'Sin nombre'}<br/>
          <span style="color:#6B7280">${p.fecha} ${p.hora||''} - ${p.area||'-'} - ${p.dependencia||'-'}</span></span>
        </label>`).join('');
    }
    renderPersonas(); renderPedidos();
    overlay.addEventListener('click',ev=>{if(ev.target===overlay)close(null);});
    personaSearchEl.addEventListener('input',()=>{renderPersonas();renderPedidos();});
    personaSelectEl.addEventListener('change',renderPedidos);
    overlay.querySelector('#dlg-sel-all').addEventListener('click',()=>overlay.querySelectorAll('.dlg-pedido-check').forEach(c=>{c.checked=true;}));
    overlay.querySelector('#dlg-clear-all').addEventListener('click',()=>overlay.querySelectorAll('.dlg-pedido-check').forEach(c=>{c.checked=false;}));
    overlay.querySelector('#dlg-close').addEventListener('click',()=>close(null));
    overlay.querySelector('#dlg-cancel').addEventListener('click',()=>close(null));
    overlay.querySelector('#dlg-ok').addEventListener('click',()=>{
      const rn=overlay.querySelector('#dlg-recibe').value.trim();
      if(!rn){showToast('Debes indicar quien recibe');return;}
      const sel=[...overlay.querySelectorAll('.dlg-pedido-check:checked')].map(c=>parseInt(c.value,10)).filter(idx=>Number.isInteger(idx)&&idx>=0&&idx<entregados.length);
      if(!sel.length){showToast('Selecciona al menos un pedido');return;}
      close({pedidosParaImprimir:sel.map(idx=>entregados[idx]),recibeNombre:rn});
    });
    document.body.appendChild(overlay);
    personaSearchEl.focus();
    [personaSearchEl,overlay.querySelector('#dlg-recibe')].forEach(el=>{
      el.addEventListener('keydown',ev=>{if(ev.key==='Enter')overlay.querySelector('#dlg-ok').click();if(ev.key==='Escape')close(null);});
    });
  });
}

async function printEntregadosPDF() {
  const entregados = getFiltered().filter(p=>{ const en=(p.estado==='Aprobado')?'Solicitado':p.estado; return en==='Entregado'; });
  if (!entregados.length) { showToast('No hay pedidos entregados para imprimir'); return; }
  let selection = null;
  try { selection = await openEntregadosPrintDialog(entregados); } catch(e) { return; }
  if (!selection) return;
  const { pedidosParaImprimir, recibeNombre } = selection;
  const generado=new Date().toLocaleString('es-AR');
  const fechaFirma=new Date().toLocaleDateString('es-AR');
  const filas=pedidosParaImprimir.map((p,i)=>{
    const items=(p.items||[]).map(it=>`${it.articulo} (${it.cantidad})`).join(', ');
    return `<tr><td>${i+1}</td><td>${p.fecha} ${p.hora||''}</td><td>${p.nombre||'-'}</td><td>${p.secretaria||'-'}</td><td>${p.area||'-'}</td><td>${p.dependencia||'-'}</td><td>${items||'-'}</td></tr>`;
  }).join('');
  const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>Pedidos Entregados</title>
    <style>@page{size:A4 portrait;margin:14mm 12mm 16mm 12mm;}body{font-family:Arial,sans-serif;margin:24px;color:#111827;}.head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px;}.brand{display:flex;align-items:center;gap:12px;}.brand img{width:64px;height:64px;object-fit:contain;}.brand-fallback{width:64px;height:64px;border-radius:10px;background:#D4532B;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;}h1{font-size:18px;margin:0;}.sub{margin:2px 0 0;font-size:12px;color:#6B7280;}p{margin:0 0 10px;font-size:12px;color:#6B7280;}table{width:100%;border-collapse:collapse;font-size:11px;}th,td{border:1px solid #D1D5DB;padding:6px 8px;text-align:left;vertical-align:top;}th{background:#F3F4F6;font-size:10px;text-transform:uppercase;letter-spacing:.04em;}.firma-wrap{margin-top:38px;display:flex;justify-content:flex-end;}.firma{width:320px;font-size:12px;text-align:center;}.firma-line{border-top:1px solid #111827;margin:34px 0 8px;}@media print{body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}thead{display:table-header-group;}tr{page-break-inside:avoid;break-inside:avoid;}}</style>
    </head><body>
    <div class="head"><div class="brand"><img src="${MUNICIPIO_LOGO_URL}" alt="Logo" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"/><div class="brand-fallback" style="display:none;">JM</div><div><h1>Municipalidad de Jesus Maria</h1><div class="sub">${pedidosParaImprimir.length===1?'Pedido entregado':'Listado de pedidos entregados'}</div></div></div></div>
    <p>Generado: ${generado} - Total pedidos: ${pedidosParaImprimir.length}</p>
    <table><thead><tr><th>#</th><th>Fecha / Hora</th><th>Solicitante</th><th>Secretaria</th><th>Area</th><th>Dependencia</th><th>Articulos</th></tr></thead><tbody>${filas}</tbody></table>
    <div class="firma-wrap"><div class="firma"><div class="firma-line"></div><div><strong>Firma de quien recibe</strong></div><div>${recibeNombre}</div><div>Fecha: ${fechaFirma}</div></div></div>
    </body></html>`;
  const w=window.open('','_blank');
  if(!w){showToast('Navegador bloqueo la ventana');return;}
  w.document.open(); w.document.write(html); w.document.close(); w.focus(); w.print();
}

// ══════════════════════════════════════════════
//  CSS COMPARTIDO REMITOS NUEVOS
// ══════════════════════════════════════════════
const REMITO_CSS = `
  @page{size:A4 portrait;margin:14mm 12mm 18mm 12mm;}
  *{box-sizing:border-box;}
  body{font-family:Arial,sans-serif;color:#111827;font-size:12px;margin:0;padding:16px;}
  .head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;border-bottom:2px solid #D4532B;padding-bottom:10px;}
  .brand{display:flex;align-items:center;gap:12px;}
  .brand-logo{width:52px;height:52px;border-radius:10px;background:#D4532B;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;flex-shrink:0;}
  .brand-logo img{width:52px;height:52px;object-fit:contain;border-radius:10px;}
  h1{font-size:16px;margin:0 0 2px;}.sub{font-size:11px;color:#6B7280;margin:0;}
  .remito-tipo{font-size:11px;font-weight:700;color:#fff;background:#D4532B;padding:4px 12px;border-radius:20px;white-space:nowrap;}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;margin:10px 0;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:10px 14px;}
  .meta-item{font-size:11px;}.meta-item .lbl{color:#6B7280;font-weight:700;text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:2px;}
  .meta-item .val{font-weight:600;color:#111827;}
  table{width:100%;border-collapse:collapse;font-size:11px;margin-top:10px;}
  th{background:#F3F4F6;padding:7px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#374151;border:1px solid #D1D5DB;}
  td{padding:7px 8px;border:1px solid #D1D5DB;vertical-align:middle;}
  tr:nth-child(even) td{background:#F9FAFB;}
  .badge-e{display:inline-block;background:#D1FAE5;color:#065F46;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;}
  .badge-p{display:inline-block;background:#FEF3C7;color:#92400E;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;}
  .firmas{display:flex;gap:24px;margin-top:32px;}
  .firma-bloque{flex:1;text-align:center;font-size:11px;}
  .firma-linea{border-top:1px solid #374151;margin:28px 0 6px;}
  .firma-nombre{font-weight:700;}.firma-cargo{color:#6B7280;font-size:10px;}
  .pendientes-nota{margin-top:14px;background:#FFFBEB;border:1px solid #FCD34D;border-radius:6px;padding:8px 12px;font-size:11px;color:#92400E;}
  .totales-bar{display:flex;gap:16px;margin:10px 0 4px;font-size:11px;}
  .tot-item{background:#F3F4F6;border:1px solid #E5E7EB;border-radius:6px;padding:5px 12px;}
  .art-nombre{font-weight:600;}.art-codigo{color:#6B7280;font-size:10px;}
  @media print{body{padding:0;}-webkit-print-color-adjust:exact;print-color-adjust:exact;}
`;

function _logoHtml() {
  return `<div class="brand-logo"><img src="${MUNICIPIO_LOGO_URL}" alt="JM" onerror="this.parentElement.innerHTML='JM'"/></div>`;
}
function _abrirVentana(html) {
  const w=window.open('','_blank');
  if(!w){showToast('El navegador bloqueo la ventana. Permite pop-ups para este sitio.');return;}
  w.document.open(); w.document.write(html); w.document.close(); w.focus();
  setTimeout(()=>w.print(),600);
}

// ══════════════════════════════════════════════
//  REMITO 1: POR EQUIPO (desde fila de Pedidos)
// ══════════════════════════════════════════════
function remitoEquipo(pedidoId) {
  const p = pedidos.find(x=>String(x.id)===String(pedidoId));
  if (!p) { showToast('Pedido no encontrado'); return; }
  // cantEntregada: cuanto se entrega de ese articulo (el resto queda pendiente automaticamente)
  let itemsState = (p.items||[]).map(it=>({...it, estadoItem: it.estadoItem||'entregado',
    cantEntregada: it.cantEntregada!=null ? it.cantEntregada : (it.estadoItem==='pendiente' ? 0 : it.cantidad)}));

  const overlay = document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1200;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)';
  overlay.innerHTML = `
    <div style="background:white;border-radius:14px;width:100%;max-width:580px;max-height:88vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.2)">
      <div style="padding:16px 20px;border-bottom:1px solid #E5E7EB;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:16px;font-weight:800">Remito por equipo</div>
          <div style="font-size:12px;color:#6B7280;margin-top:2px">${p.nombre} &middot; ${p.area} &middot; ${p.dependencia||'-'}</div>
        </div>
        <button id="re-close" style="border:none;background:none;font-size:22px;cursor:pointer;color:#6B7280">&times;</button>
      </div>
      <div style="padding:16px 20px;">
        <p style="font-size:12px;color:#6B7280;margin:0 0 12px">Marca el estado de cada articulo. Los pendientes apareceran destacados en el remito.</p>
        <div style="display:flex;gap:8px;margin-bottom:10px;">
          <button id="re-all-e" class="btn-secondary btn-sm">&#10003; Todos entregados</button>
          <button id="re-all-p" class="btn-secondary btn-sm">&#9711; Todos pendientes</button>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#F9FAFB">
            <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #E5E7EB;font-size:11px;color:#6B7280;text-transform:uppercase">Articulo</th>
            <th style="padding:8px 10px;text-align:center;border-bottom:2px solid #E5E7EB;font-size:11px;color:#6B7280;width:60px">Cant.</th>
           <th style="padding:8px 10px;text-align:center;border-bottom:2px solid #E5E7EB;font-size:11px;color:#6B7280;width:90px">Entregado</th>
            <th style="padding:8px 10px;text-align:center;border-bottom:2px solid #E5E7EB;font-size:11px;color:#6B7280;width:90px">Pendiente</th>
          </tr></thead>
          <tbody id="re-items-body"></tbody>
        </table>
        <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px">Quien entrega</label>
            <input id="re-entrega" type="text" placeholder="Nombre y apellido" style="width:100%;padding:9px 12px;border:1.5px solid #E5E7EB;border-radius:8px;font-size:13px;"/>
          </div>
          <div>
            <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px">Quien recibe</label>
            <input id="re-recibe" type="text" placeholder="Nombre y apellido" style="width:100%;padding:9px 12px;border:1.5px solid #E5E7EB;border-radius:8px;font-size:13px;" value="${p.nombre}"/>
          </div>
        </div>
      </div>
      <div style="padding:14px 20px;border-top:1px solid #E5E7EB;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
        <button id="re-cancel" class="btn-secondary">Cancelar</button>
        <button id="re-guardar" class="btn-secondary btn-success btn-sm" style="padding:9px 18px">Guardar estados</button>
        <button id="re-pdf" class="btn-primary" style="width:auto;margin:0;padding:9px 20px">Generar PDF</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  function renderItemsDialog() {
    document.getElementById('re-items-body').innerHTML = itemsState.map((it,i)=>{
      const partes=(it.articulo||'').split(' - ');
      const nombre=partes.slice(1).join(' - ')||it.articulo;
      const codigo=partes[0]||'';
      const cantEnt=it.cantEntregada!=null?it.cantEntregada:it.cantidad;
      const cantPend=it.cantidad-cantEnt;
      return `<tr style="border-bottom:1px solid #F3F4F6">
        <td style="padding:8px 10px"><div style="font-weight:600;font-size:13px">${nombre}</div><div style="font-size:11px;color:#9CA3AF">${codigo}</div></td>
        <td style="padding:8px 10px;text-align:center;font-weight:700">${it.cantidad}</td>
        <td style="padding:8px 10px;text-align:center">
          <input type="number" data-idx="${i}" class="re-item-cant" min="0" max="${it.cantidad}" value="${cantEnt}"
            style="width:60px;padding:5px 6px;border:1.5px solid #E5E7EB;border-radius:6px;text-align:center;font-weight:700;color:#059669"/>
        </td>
        <td style="padding:8px 10px;text-align:center;font-weight:700;color:${cantPend>0?'#D97706':'#9CA3AF'}">${cantPend}</td>
      </tr>`;
    }).join('');
    // al cambiar la cantidad entregada, se recalcula pendiente y el estadoItem (entregado/parcial/pendiente)
    overlay.querySelectorAll('.re-item-cant').forEach(inp=>{
      inp.addEventListener('change',()=>{
        const idx=parseInt(inp.dataset.idx);
        const max=itemsState[idx].cantidad;
        let val=parseInt(inp.value);
        if(isNaN(val)||val<0) val=0;
        if(val>max) val=max;
        itemsState[idx].cantEntregada=val;
        itemsState[idx].estadoItem = val>=max ? 'entregado' : (val<=0 ? 'pendiente' : 'parcial');
        renderItemsDialog();
      });
    });
  }
  renderItemsDialog();

 overlay.querySelector('#re-all-e').onclick=()=>{itemsState=itemsState.map(it=>({...it,estadoItem:'entregado',cantEntregada:it.cantidad}));renderItemsDialog();};
  overlay.querySelector('#re-all-p').onclick=()=>{itemsState=itemsState.map(it=>({...it,estadoItem:'pendiente',cantEntregada:0}));renderItemsDialog();};
  const cerrar=()=>overlay.remove();
  overlay.querySelector('#re-close').onclick=cerrar;
  overlay.querySelector('#re-cancel').onclick=cerrar;
  overlay.querySelector('#re-guardar').onclick=async()=>{
    try {
      const todosE=itemsState.every(it=>it.estadoItem==='entregado');
      const autoEstado=todosE?'Entregado':p.estado;
      await apiCall({action:'update_items',id:p.id,items:JSON.stringify(itemsState),autoEstado});
      const pl=pedidos.find(x=>String(x.id)===String(p.id));
      if(pl){pl.items=itemsState;if(todosE)pl.estado='Entregado';}
      renderTabla();renderStats();
      showToast('Estados guardados');
    } catch(e){showToast('Error al guardar estados');}
  };

  overlay.querySelector('#re-pdf').onclick=()=>{
    const entrega=overlay.querySelector('#re-entrega').value.trim();
    const recibe=overlay.querySelector('#re-recibe').value.trim();
    if(!entrega){showToast('Ingresa quien entrega');return;}
    if(!recibe){showToast('Ingresa quien recibe');return;}
    cerrar();
    _pdfEquipo(p,itemsState,recibe,entrega);
  };
}

function _pdfEquipo(p,items,recibe,entrega) {
  const generado=new Date().toLocaleString('es-AR');
  const fechaHoy=new Date().toLocaleDateString('es-AR');
  const estadoNorm=(p.estado==='Aprobado')?'Solicitado':p.estado;
 const entregados=items.filter(it=>(it.cantEntregada!=null?it.cantEntregada:it.cantidad)>0);
  const pendientes=items.filter(it=>{const ce=it.cantEntregada!=null?it.cantEntregada:it.cantidad;return (it.cantidad-ce)>0;});
  const filas=items.map((it,i)=>{
    const partes=(it.articulo||'').split(' - ');
    const nombre=partes.slice(1).join(' - ')||it.articulo;
    const codigo=partes[0]||'';
    const cantEnt=it.cantEntregada!=null?it.cantEntregada:it.cantidad;
    const cantPend=it.cantidad-cantEnt;
    return `<tr><td style="text-align:center;color:#6B7280;font-size:11px">${i+1}</td>
      <td class="art-codigo">${codigo}</td>
      <td><span class="art-nombre">${nombre}</span>${it.especificacion?`<br><span style="font-size:10px;color:#6B7280">${it.especificacion}</span>`:''}</td>
      <td style="text-align:center;font-weight:700">${it.cantidad}</td>
      <td style="text-align:center">${it.empaque||'-'}</td>
      <td style="text-align:center;font-weight:700;color:#059669">${cantEnt}</td>
      <td style="text-align:center;font-weight:700;color:${cantPend>0?'#D97706':'#9CA3AF'}">${cantPend}</td></tr>`;
  }).join('');
 const notaPend=pendientes.length>0?`<div class="pendientes-nota"><strong>&#9888; Articulos con cantidad pendiente (${pendientes.length}):</strong>${pendientes.map(it=>{const n=(it.articulo||'').split(' - ').slice(1).join(' - ')||it.articulo;const ce=it.cantEntregada!=null?it.cantEntregada:it.cantidad;return `<br>&bull; ${n} (pendiente: ${it.cantidad-ce} de ${it.cantidad})`;}).join('')}</div>`:'';
  const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>Remito - ${p.nombre}</title><style>${REMITO_CSS}</style></head><body>
    <div class="head"><div class="brand">${_logoHtml()}<div><h1>Municipalidad de Jesus Maria</h1><p class="sub">Remito de entrega de articulos de libreria</p></div></div><span class="remito-tipo">Remito por equipo</span></div>
    <div class="meta-grid">
      <div class="meta-item"><span class="lbl">Solicitante</span><span class="val">${p.nombre}</span></div>
      <div class="meta-item"><span class="lbl">Fecha</span><span class="val">${fechaHoy}</span></div>
      <div class="meta-item"><span class="lbl">Secretaria</span><span class="val">${p.secretaria}</span></div>
      <div class="meta-item"><span class="lbl">Area / Equipo</span><span class="val">${p.area}</span></div>
      <div class="meta-item"><span class="lbl">Dependencia</span><span class="val">${p.dependencia||'-'}</span></div>
      <div class="meta-item"><span class="lbl">Estado pedido</span><span class="val">${estadoNorm}</span></div>
    </div>
    <div class="totales-bar">
      <div class="tot-item">Total: <strong>${items.length}</strong></div>
      <div class="tot-item">Entregados: <strong style="color:#059669">${entregados.length}</strong></div>
      <div class="tot-item">Pendientes: <strong style="color:#D97706">${pendientes.length}</strong></div>
    </div>
   <table><thead><tr><th style="width:4%">#</th><th style="width:12%">Codigo</th><th style="width:32%">Articulo</th><th style="width:7%;text-align:center">Cant.</th><th style="width:9%">Empaque</th><th style="width:11%;text-align:center">Entregado</th><th style="width:11%;text-align:center">Pendiente</th></tr></thead><tbody>${filas}</tbody></table>
    ${notaPend}
    <div class="firmas">
      <div class="firma-bloque"><div class="firma-linea"></div><div class="firma-nombre">${entrega}</div><div class="firma-cargo">Firma de quien entrega</div><div style="color:#6B7280;font-size:10px;margin-top:2px">Libreria Municipal</div></div>
      <div class="firma-bloque"><div class="firma-linea"></div><div class="firma-nombre">${recibe}</div><div class="firma-cargo">Firma de quien recibe</div><div style="color:#6B7280;font-size:10px;margin-top:2px">${p.area} &middot; ${p.dependencia||''}</div></div>
    </div>
    <p style="font-size:10px;color:#9CA3AF;margin-top:16px;text-align:center">Generado: ${generado} &middot; Municipalidad de Jesus Maria</p>
  </body></html>`;
  _abrirVentana(html);
}

// ══════════════════════════════════════════════
//  REMITO 2: POR DEPENDENCIA (desde Pedidos)
//  Agrupa todos los articulos de la dependencia
//  filtrada actualmente en la tabla
// ══════════════════════════════════════════════
function remitoDepDialog() {
  // Toma los pedidos filtrados actuales y agrupa por articulo
  const data = getFiltered();
  if (!data.length) { showToast('No hay pedidos en el filtro actual'); return; }

  // Agrupar articulos
  const mapa = {};
  data.forEach(p=>{
   (p.items||[]).forEach(item=>{
      const key=item.articulo;
      if(!mapa[key]) mapa[key]={articulo:key,cantidad:0,solicitantes:[],estadoRemito:'entregado'};
      mapa[key].cantidad+=parseInt(item.cantidad)||1;
      const label=p.nombre+(p.area?' ('+p.area+')':'');
      if(!mapa[key].solicitantes.includes(label)) mapa[key].solicitantes.push(label);
    });
  });
  let artState=Object.values(mapa).sort((a,b)=>a.articulo.localeCompare(b.articulo));
  // por defecto, se entrega la cantidad total (el usuario puede ajustar)
  artState=artState.map(r=>({...r,cantEntregada:r.cantidad}));
  if(!artState.length){showToast('No hay articulos en los pedidos filtrados');return;}

  // Dependencia actual del filtro
  const depActual=document.getElementById('fil-dep')?.value||'(segun filtro actual)';

  const overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1200;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)';
  overlay.innerHTML=`
    <div style="background:white;border-radius:14px;width:100%;max-width:640px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.2)">
      <div style="padding:16px 20px;border-bottom:1px solid #E5E7EB;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:16px;font-weight:800">Remito por dependencia</div>
          <div style="font-size:12px;color:#6B7280;margin-top:2px">${depActual||'Todas'} &middot; ${artState.length} articulos &middot; ${data.length} pedidos</div>
        </div>
        <button id="rd-close" style="border:none;background:none;font-size:22px;cursor:pointer;color:#6B7280">&times;</button>
      </div>
      <div style="padding:16px 20px;">
        <p style="font-size:12px;color:#6B7280;margin:0 0 12px">Marca el estado de cada articulo antes de generar el remito.</p>
        <div style="display:flex;gap:8px;margin-bottom:10px;">
          <button id="rd-all-e" class="btn-secondary btn-sm">&#10003; Todos entregados</button>
          <button id="rd-all-p" class="btn-secondary btn-sm">&#9711; Todos pendientes</button>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#F9FAFB">
            <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #E5E7EB;font-size:11px;color:#6B7280;text-transform:uppercase">Articulo</th>
            <th style="padding:7px 10px;text-align:center;border-bottom:2px solid #E5E7EB;font-size:11px;color:#6B7280;width:55px">Cant.</th>
            <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #E5E7EB;font-size:11px;color:#6B7280">Solicitado por</th>
           <th style="padding:7px 10px;text-align:center;border-bottom:2px solid #E5E7EB;font-size:11px;color:#6B7280;width:85px">Entregado</th>
            <th style="padding:7px 10px;text-align:center;border-bottom:2px solid #E5E7EB;font-size:11px;color:#6B7280;width:85px">Pendiente</th>
          </tr></thead>
          <tbody id="rd-art-body"></tbody>
        </table>
        <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px">Quien entrega</label>
            <input id="rd-entrega" type="text" placeholder="Nombre y apellido" style="width:100%;padding:9px 12px;border:1.5px solid #E5E7EB;border-radius:8px;font-size:13px;"/>
          </div>
          <div>
            <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px">Quien recibe (dependencia)</label>
            <input id="rd-recibe" type="text" placeholder="Nombre y apellido" style="width:100%;padding:9px 12px;border:1.5px solid #E5E7EB;border-radius:8px;font-size:13px;"/>
          </div>
        </div>
      </div>
      <div style="padding:14px 20px;border-top:1px solid #E5E7EB;display:flex;gap:8px;justify-content:flex-end;">
        <button id="rd-cancel" class="btn-secondary">Cancelar</button>
        <button id="rd-pdf" class="btn-primary" style="width:auto;margin:0;padding:9px 20px">Generar PDF</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

 function renderArtDialog() {
    document.getElementById('rd-art-body').innerHTML=artState.map((r,i)=>{
      const partes=(r.articulo||'').split(' - ');
      const nombre=partes.slice(1).join(' - ')||r.articulo;
      const codigo=partes[0]||'';
      const cantEnt=r.cantEntregada!=null?r.cantEntregada:r.cantidad;
      const cantPend=r.cantidad-cantEnt;
      return `<tr style="border-bottom:1px solid #F3F4F6">
        <td style="padding:7px 10px"><div style="font-weight:600">${nombre}</div><div style="font-size:10px;color:#9CA3AF">${codigo}</div></td>
        <td style="padding:7px 10px;text-align:center;font-weight:700">${r.cantidad}</td>
        <td style="padding:7px 10px;font-size:11px;color:#6B7280">${(r.solicitantes||[]).join(', ')}</td>
        <td style="padding:7px 10px;text-align:center">
          <input type="number" data-idx="${i}" class="rd-art-cant" min="0" max="${r.cantidad}" value="${cantEnt}"
            style="width:58px;padding:4px 6px;border:1.5px solid #E5E7EB;border-radius:6px;text-align:center;font-weight:700;color:#059669"/>
        </td>
        <td style="padding:7px 10px;text-align:center;font-weight:700;color:${cantPend>0?'#D97706':'#9CA3AF'}">${cantPend}</td>
      </tr>`;
    }).join('');
    // al cambiar la cantidad entregada, se recalcula pendiente y estadoRemito
    overlay.querySelectorAll('.rd-art-cant').forEach(inp=>{
      inp.addEventListener('change',()=>{
        const idx=parseInt(inp.dataset.idx);
        const max=artState[idx].cantidad;
        let val=parseInt(inp.value);
        if(isNaN(val)||val<0) val=0;
        if(val>max) val=max;
        artState[idx].cantEntregada=val;
        artState[idx].estadoRemito = val>=max ? 'entregado' : (val<=0 ? 'pendiente' : 'parcial');
        renderArtDialog();
      });
    });
  }
  renderArtDialog();

 overlay.querySelector('#rd-all-e').onclick=()=>{artState=artState.map(r=>({...r,estadoRemito:'entregado',cantEntregada:r.cantidad}));renderArtDialog();};
  overlay.querySelector('#rd-all-p').onclick=()=>{artState=artState.map(r=>({...r,estadoRemito:'pendiente',cantEntregada:0}));renderArtDialog();};
  const cerrar=()=>overlay.remove();
  overlay.querySelector('#rd-close').onclick=cerrar;
  overlay.querySelector('#rd-cancel').onclick=cerrar;
  overlay.querySelector('#rd-pdf').onclick=()=>{
    const entrega=overlay.querySelector('#rd-entrega').value.trim();
    const recibe=overlay.querySelector('#rd-recibe').value.trim();
    if(!entrega){showToast('Ingresa quien entrega');return;}
    if(!recibe){showToast('Ingresa quien recibe en la dependencia');return;}
    cerrar();
    _pdfDependencia(artState,depActual||'Todas',entrega,recibe,data.length);
  };
}

function _pdfDependencia(artState,dependencia,entrega,recibe,totalPedidos) {
  const generado=new Date().toLocaleString('es-AR');
  const fechaHoy=new Date().toLocaleDateString('es-AR');
  const entregados=artState.filter(r=>(r.cantEntregada!=null?r.cantEntregada:r.cantidad)>0);
  const pendientes=artState.filter(r=>{const ce=r.cantEntregada!=null?r.cantEntregada:r.cantidad;return (r.cantidad-ce)>0;});
  const filas=artState.map((r,i)=>{
    const partes=(r.articulo||'').split(' - ');
    const nombre=partes.slice(1).join(' - ')||r.articulo;
    const codigo=partes[0]||'';
    const cantEnt=r.cantEntregada!=null?r.cantEntregada:r.cantidad;
    const cantPend=r.cantidad-cantEnt;
    return `<tr><td style="text-align:center;color:#6B7280;font-size:11px">${i+1}</td>
      <td class="art-codigo">${codigo}</td>
      <td><span class="art-nombre">${nombre}</span></td>
      <td style="text-align:center;font-weight:700">${r.cantidad}</td>
      <td style="font-size:10px;color:#6B7280">${(r.solicitantes||[]).join(', ')}</td>
      <td style="text-align:center;font-weight:700;color:#059669">${cantEnt}</td>
      <td style="text-align:center;font-weight:700;color:${cantPend>0?'#D97706':'#9CA3AF'}">${cantPend}</td></tr>`;
  }).join('');
  const notaPend=pendientes.length>0?`<div class="pendientes-nota"><strong>&#9888; Articulos con cantidad pendiente (${pendientes.length}):</strong>${pendientes.map(r=>{const n=(r.articulo||'').split(' - ').slice(1).join(' - ')||r.articulo;const ce=r.cantEntregada!=null?r.cantEntregada:r.cantidad;return `<br>&bull; ${n} (pendiente: ${r.cantidad-ce} de ${r.cantidad}) &mdash; ${(r.solicitantes||[]).join(', ')}`;}).join('')}</div>`:'';
  const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>Remito Dependencia - ${dependencia}</title><style>${REMITO_CSS}</style></head><body>
    <div class="head"><div class="brand">${_logoHtml()}<div><h1>Municipalidad de Jesus Maria</h1><p class="sub">Remito de entrega de articulos de libreria</p></div></div><span class="remito-tipo">Remito por dependencia</span></div>
    <div class="meta-grid">
      <div class="meta-item"><span class="lbl">Dependencia</span><span class="val">${dependencia}</span></div>
      <div class="meta-item"><span class="lbl">Fecha</span><span class="val">${fechaHoy}</span></div>
      <div class="meta-item"><span class="lbl">Pedidos incluidos</span><span class="val">${totalPedidos}</span></div>
      <div class="meta-item"><span class="lbl">Articulos distintos</span><span class="val">${artState.length}</span></div>
    </div>
    <div class="totales-bar">
      <div class="tot-item">Total: <strong>${artState.length}</strong></div>
      <div class="tot-item">Entregados: <strong style="color:#059669">${entregados.length}</strong></div>
      <div class="tot-item">Pendientes: <strong style="color:#D97706">${pendientes.length}</strong></div>
    </div>
    <table><thead><tr><th style="width:4%">#</th><th style="width:11%">Codigo</th><th style="width:26%">Articulo</th><th style="width:7%;text-align:center">Cant.</th><th style="width:24%">Solicitado por</th><th style="width:11%;text-align:center">Entregado</th><th style="width:11%;text-align:center">Pendiente</th></tr></thead><tbody>${filas}</tbody></table>
    ${notaPend}
    <div class="firmas">
      <div class="firma-bloque"><div class="firma-linea"></div><div class="firma-nombre">${entrega}</div><div class="firma-cargo">Firma de quien entrega</div><div style="color:#6B7280;font-size:10px;margin-top:2px">Libreria Municipal</div></div>
      <div class="firma-bloque"><div class="firma-linea"></div><div class="firma-nombre">${recibe}</div><div class="firma-cargo">Firma de quien recibe</div><div style="color:#6B7280;font-size:10px;margin-top:2px">${dependencia}</div></div>
    </div>
    <p style="font-size:10px;color:#9CA3AF;margin-top:16px;text-align:center">Generado: ${generado} &middot; Municipalidad de Jesus Maria</p>
  </body></html>`;
  _abrirVentana(html);
}

// ══════════════════════════════════════════════
//  RESUMEN UNIFICADO
// ══════════════════════════════════════════════
function getResumenData() {
  const depFil      = document.getElementById('res-dep').value;
  const estadoFil   = document.getElementById('res-estado').value;
  const busArticulo = document.getElementById('res-buscar').value.toLowerCase().trim();
  const resNombreEl = document.getElementById('res-nombre');
  const busNombre   = resNombreEl ? resNombreEl.value.toLowerCase().trim() : '';
  const resFechaDesde = document.getElementById('res-fecha-desde') ? document.getElementById('res-fecha-desde').value : '';
  const resFechaHasta = document.getElementById('res-fecha-hasta') ? document.getElementById('res-fecha-hasta').value : '';

  let pedidosFil = pedidos.filter(p=>{
    if(depFil && p.dependencia!==depFil) return false;
    const estadoNorm=(p.estado==='Aprobado')?'Solicitado':p.estado;
    if(estadoFil===''){if(estadoNorm!=='Pendiente'&&estadoNorm!=='Solicitado') return false;}
    else{if(estadoNorm!==estadoFil) return false;}
    if(busNombre){
      const n=(p.nombre||'').toLowerCase();
      const a=(p.area||'').toLowerCase();
      const d=(p.dependencia||'').toLowerCase();
      if(!n.includes(busNombre)&&!a.includes(busNombre)&&!d.includes(busNombre)) return false;
    }
    if(resFechaDesde||resFechaHasta){
      const partes=(p.fecha||'').split('/');
      if(partes.length===3){
        const fd=new Date(partes[2],partes[1]-1,partes[0]);
        if(resFechaDesde&&fd<new Date(resFechaDesde)) return false;
        if(resFechaHasta&&fd>new Date(resFechaHasta)) return false;
      }
    }
    return true;
  });

  const mapa={};
  pedidosFil.forEach(p=>{
    (p.items||[]).forEach(item=>{
      const key=item.articulo;
      if(!mapa[key]) mapa[key]={articulo:key,cantidad:0,pedidos:0,solicitantes:[]};
      mapa[key].cantidad+=parseInt(item.cantidad)||1;
      mapa[key].pedidos+=1;
      const label=p.nombre+(p.area?' ('+p.area+')':'');
      if(!mapa[key].solicitantes.includes(label)) mapa[key].solicitantes.push(label);
    });
  });
  let rows=Object.values(mapa).sort((a,b)=>a.articulo.localeCompare(b.articulo));
  if(busArticulo) rows=rows.filter(r=>r.articulo.toLowerCase().includes(busArticulo));
  //return{rows,totalPedidos:pedidosFil.length};
  return { rows, totalPedidos: pedidosFil.length, pedidosFil };
}

function renderResumen() {
  const{rows,totalPedidos}=getResumenData();
  const tbody=document.getElementById('resumen-body');
  const bar=document.getElementById('resumen-summary-bar');
  bar.innerHTML=`<span class="resumen-info"><strong>${rows.length}</strong> articulos distintos &middot; provenientes de <strong>${totalPedidos}</strong> pedidos</span>`;
  if(!rows.length){tbody.innerHTML=`<tr><td colspan="6" class="resumen-empty">No hay articulos que coincidan con los filtros.</td></tr>`;return;}
  tbody.innerHTML=rows.map((r,i)=>{
    const partes=r.articulo.split(' - ');
    const codigo=partes[0]||'';
    const nombre=partes.slice(1).join(' - ')||r.articulo;
    return `<tr>
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
  document.getElementById('res-dep').selectedIndex=0;
  document.getElementById('res-estado').selectedIndex=0;
  document.getElementById('res-buscar').value='';
  const rn=document.getElementById('res-nombre'); if(rn) rn.value='';
  const rd=document.getElementById('res-fecha-desde'); if(rd) rd.value='';
  const rh=document.getElementById('res-fecha-hasta'); if(rh) rh.value='';
  renderResumen();
}

/*function exportResumenExcel() {
  const{rows,totalPedidos}=getResumenData();
  if(!rows.length){showToast('No hay articulos para exportar');return;}
  const data=rows.map((r,i)=>{
    const partes=r.articulo.split(' - ');
    return{'N°':i+1,'Codigo':partes[0]||'','Articulo':partes.slice(1).join(' - ')||r.articulo,'Cantidad total':r.cantidad,'N° pedidos':r.pedidos,'Solicitado por':r.solicitantes.join(' | ')};
  });
  const ws=XLSX.utils.json_to_sheet(data);
  ws['!cols']=[5,14,40,14,10,50].map(w=>({wch:w}));
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Pedido Unificado');
  const fecha=new Date().toLocaleDateString('es-AR',{month:'long',year:'numeric'}).replace(' ','_');
  XLSX.writeFile(wb,`Pedido_Unificado_${fecha}.xlsx`);
  showToast('Excel del pedido unificado descargado');
}*/
function exportResumenExcel() {
  const { rows, totalPedidos, pedidosFil } = getResumenData();
  if (!rows.length) { showToast('No hay articulos para exportar'); return; }

  // Una fila por cada ítem de cada pedido filtrado (detalle completo)
  const data = [];
  let n = 1;
  pedidosFil.forEach(p => {
    const estadoNorm = (p.estado === 'Aprobado') ? 'Solicitado' : p.estado;
    (p.items || []).forEach(item => {
      const partes = item.articulo.split(' - ');
      data.push({
        'N°':            n++,
        'Area':          p.area          || '',
        'Solicitante':   p.nombre        || '',
        'Codigo':        partes[0]       || '',
        'Articulo':      partes.slice(1).join(' - ') || item.articulo,
        'Especificacion':item.especificacion || '',
        'Empaque':       item.empaque    || '',
        'Cantidad':      item.cantidad,
       
      });
    });
  });

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [5,10,8,12,22,32,24,22,14,36,22,12,10,28].map(w=>({wch:w}));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedido Unificado');
  const fecha = new Date().toLocaleDateString('es-AR',{month:'long',year:'numeric'}).replace(' ','_');
  XLSX.writeFile(wb, `Pedido_Unificado_${fecha}.xlsx`);
  showToast('Excel detallado descargado (' + data.length + ' items)');
}

// ══════════════════════════════════════════════
//  CATALOGO
// ══════════════════════════════════════════════
function renderCatalogo() {
  document.getElementById('catalogo-grid').innerHTML=articulos.map((a,i)=>`
    <div class="cat-item"><span>${a}</span>
      <button class="btn-icon" onclick="removeArt(${i})" title="Eliminar" style="font-size:14px;flex-shrink:0">&#10005;</button>
    </div>`).join('')||'<p style="color:var(--texto-sec);font-size:13px">No hay articulos en el catalogo.</p>';
}
async function addArt() {
  const inp=document.getElementById('nuevo-art');
  const val=inp.value.trim();
  if(!val) return;
  if(articulos.includes(val)){showToast('Ya existe ese articulo');return;}
  articulos.push(val);
  await apiCall({action:'set_catalogo',catalogo:JSON.stringify(articulos)});
  renderCatalogo(); inp.value='';
  showToast('Articulo agregado');
}
async function removeArt(idx) {
  if(!confirm(`Eliminar "${articulos[idx]}" del catalogo?`)) return;
  articulos.splice(idx,1);
  await apiCall({action:'set_catalogo',catalogo:JSON.stringify(articulos)});
  renderCatalogo();
  showToast('Articulo eliminado');
}

// ══════════════════════════════════════════════
//  USUARIOS
// ══════════════════════════════════════════════
async function renderUsuarios() {
  try{const r=await apiCall({action:'get_usuarios'});if(r.ok)usuarios=r.usuarios;}catch(e){}
  document.getElementById('usuarios-grid').innerHTML=Object.entries(usuarios).map(([user,u])=>`
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
function depClass(dep){
  if(!dep) return 'todas';
  if(dep.toLowerCase().includes('edificio')) return 'edificio';
  if(dep.toLowerCase().includes('obrador'))  return 'obrador';
  if(dep.toLowerCase().includes('almafuerte')) return 'almafuerte';
  return 'todas';
}
async function guardarNuevoUsuario() {
  const nombre=document.getElementById('nu-nombre').value.trim();
  const user=document.getElementById('nu-user').value.trim().toLowerCase().replace(/\s/g,'');
  const pass=document.getElementById('nu-pass').value.trim();
  const rol=document.getElementById('nu-rol').value;
  const dep=document.getElementById('nu-dep').value;
  if(!nombre||!user||!pass){showToast('Completa todos los campos');return;}
  if(rol==='receptor'&&!dep){showToast('Selecciona una dependencia para el receptor');return;}
  if(usuarios[user]){showToast('Ya existe ese usuario');return;}
  usuarios[user]={nombre,pass,rol,dependencia:dep};
  await apiCall({action:'set_usuarios',usuarios:JSON.stringify(usuarios)});
  renderUsuarios();
  ['nu-nombre','nu-user','nu-pass'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('nu-rol').selectedIndex=0;
  document.getElementById('nu-dep').selectedIndex=0;
  document.getElementById('new-user-section').style.display='none';
  showToast('Usuario creado: '+user);
}
async function eliminarUsuario(user) {
  if(!confirm(`Eliminar al usuario "${usuarios[user].nombre}"?`)) return;
  delete usuarios[user];
  await apiCall({action:'set_usuarios',usuarios:JSON.stringify(usuarios)});
  renderUsuarios();
  showToast('Usuario eliminado');
}

function showToast(msg){const t=document.getElementById('toast');document.getElementById('toast-msg').textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3000);}
function showPhotoModal(src){const div=document.createElement('div');div.className='photo-modal';div.onclick=function(){div.remove();};div.innerHTML=`<img src="${src}"/>`;document.body.appendChild(div);}

init();
