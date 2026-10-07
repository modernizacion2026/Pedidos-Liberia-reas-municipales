const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxa-BQmxuqNwUYyOAGCbiazN-CzYA20n0nvzGbEZ6dLxvYJH2IoIBsxCnubYrqWukjo/exec';

const ESTADO_DISPLAY = { 
  'Pendiente': 'Pendiente', 
  'Preparado': 'Preparado', 
  'Aprobado': 'Solicitado', 
  'Solicitado': 'Solicitado', 
  'Entregado': 'Entregado', 
  'Rechazado': 'Rechazado' 
};

const STATUS_COLORS  = { 
  'Pendiente': 'pendiente', 
  'Preparado': 'preparado', 
  'Aprobado': 'solicitado', 
  'Solicitado': 'solicitado', 
  'Entregado': 'entregado', 
  'Rechazado': 'rechazado' 
};

let pedidos   = [];
let articulos = [];
let usuarios  = {};
let currentUser = null;
const MUNICIPIO_LOGO_URL = '../img/logo-municipio.png';

async function apiCall(params) {
  const resp = await fetch(SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(params)
  });
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
      document.getElementById('fil-dep-wrap').style.display      = isAdmin ? '' : 'none';
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
  const pend  = data.filter(p => p.estado === 'Pendiente').length;
  const prep  = data.filter(p => p.estado === 'Preparado').length;
  const soli  = data.filter(p => p.estado === 'Solicitado' || p.estado === 'Aprobado').length;
  const entr  = data.filter(p => p.estado === 'Entregado').length;

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card stat-total"><div class="stat-label">Total pedidos</div><div class="stat-val">${total}</div><div class="stat-sub">registrados</div></div>
    <div class="stat-card stat-pend"><div class="stat-label">Pendientes</div><div class="stat-val">${pend}</div><div class="stat-sub">por gestionar</div></div>
    <div class="stat-card stat-prep"><div class="stat-label">Preparados</div><div class="stat-val">${prep}</div><div class="stat-sub">listos en pañol</div></div>
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
          <option ${estadoNorm==='Preparado'?'selected':''}>Preparado</option>
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
        return `<tr><td>${it.articulo}</td><td>${it.especificacion\vert{}\vert{}'-'}</td><td>${it.empaque||'-'}</td><td style="text-align:center"><strong>${it.cantidad}</strong></td><td>${badge}</td><td>${it.foto?`<img src="${it.foto}" class="photo-thumb" onclick="showPhotoModal('${it.foto.replace(/'/g,"\\'")}')"/>`:'-'}</td></tr>`;
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

function printEntregadosPDF() {
  const entregados = getFiltered().filter(p=>{ const en=(p.estado==='Aprobado')?'Solicitado':p.estado; return en==='Entregado'; });
  if (!entregados.length) { showToast('No hay pedidos entregados para imprimir'); return; }
}

function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 3000);
}
