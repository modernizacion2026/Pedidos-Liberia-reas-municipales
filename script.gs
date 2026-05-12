// ============================================================
//  PEDIDOS LIBRERIA - Municipalidad de Jesus Maria
//  Google Apps Script  (pegar en script.google.com)
//  ACTUALIZADO: incluye dependencia receptora y foto por articulo
// ============================================================

var HOJA_PEDIDOS   = "Pedidos";
var HOJA_CATALOGO  = "Catalogo";
var HOJA_USUARIOS  = "Usuarios";

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var hp = ss.getSheetByName(HOJA_PEDIDOS);
  if (!hp) {
    hp = ss.insertSheet(HOJA_PEDIDOS);
    hp.appendRow(["id","fecha","hora","secretaria","area","nombre","email","observaciones","items_json","estado","dependencia"]);
    hp.getRange(1,1,1,11).setFontWeight("bold").setBackground("#D4532B").setFontColor("white");
    hp.setFrozenRows(1);
  }

  var hc = ss.getSheetByName(HOJA_CATALOGO);
  if (!hc) {
    hc = ss.insertSheet(HOJA_CATALOGO);
    hc.appendRow(["articulo"]);
    hc.getRange(1,1,1,1).setFontWeight("bold").setBackground("#D4532B").setFontColor("white");
  }

  var hu = ss.getSheetByName(HOJA_USUARIOS);
  if (!hu) {
    hu = ss.insertSheet(HOJA_USUARIOS);
    hu.appendRow(["usuario","pass","nombre","rol","dependencia"]);
    hu.getRange(1,1,1,5).setFontWeight("bold").setBackground("#D4532B").setFontColor("white");
    hu.appendRow(["admin","admin123","Administrador","admin",""]);
    hu.appendRow(["libreria","lib2024","Libreria","receptor","Edificio Centro"]);
  }

  SpreadsheetApp.getUi().alert("Estructura creada correctamente. Ya podes usar el sistema.");
}

// ── Puntos de entrada del Web App ──────────────────────────
function doPost(e) { return handleRequest(e); }
function doGet(e)  { return handleRequest(e); }

function handleRequest(e) {
  try {
    var params = {};
    if (e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      params = e.parameter;
    }

    var action = params.action || "";
    if (!action) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, status: "Servidor funcionando" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var result;
    if      (action === "guardar_pedido")  result = guardarPedido(params);
    else if (action === "get_pedidos")     result = getPedidos();
    else if (action === "update_estado")   result = updateEstado(params);
    else if (action === "delete_pedido")   result = deletePedido(params);
    else if (action === "vaciar_pedidos")  result = vaciarPedidos();
    else if (action === "get_catalogo")    result = getCatalogo();
    else if (action === "set_catalogo")    result = setCatalogo(params);
    else if (action === "get_usuarios")    result = getUsuarios();
    else if (action === "set_usuarios")    result = setUsuarios(params);
    else if (action === "login")           result = doLogin(params);
    else                                   result = { ok: false, error: "Accion desconocida" };

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Funciones de negocio ────────────────────────────────────

function doLogin(p) {
  var hu = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_USUARIOS);
  if (!hu) return { ok: false, error: "Sin hoja usuarios" };
  var rows = hu.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === p.usuario && rows[i][1] === p.pass) {
      return { ok: true, nombre: rows[i][2], rol: rows[i][3], dependencia: rows[i][4] || "" };
    }
  }
  return { ok: false, error: "Usuario o contrasena incorrectos" };
}

function guardarPedido(p) {
  var hp = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_PEDIDOS);
  if (!hp) return { ok: false, error: "Sin hoja pedidos" };
  var id = Date.now();
  hp.appendRow([id, p.fecha||"", p.hora||"", p.secretaria||"", p.area||"",
    p.nombre||"", p.email||"", p.observaciones||"",
    typeof p.items==="string" ? p.items : JSON.stringify(p.items||[]),
    "Pendiente", p.dependencia||""]);
  return { ok: true, id: id };
}

function getPedidos() {
  var hp = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_PEDIDOS);
  if (!hp) return { ok: false, pedidos: [] };
  var rows = hp.getDataRange().getValues();
  var pedidos = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    var items = [];
    try { items = JSON.parse(r[8]); } catch(e) {}
    pedidos.unshift({ id:r[0], fecha:r[1], hora:r[2], secretaria:r[3], area:r[4],
      nombre:r[5], email:r[6], observaciones:r[7], items:items,
      estado:r[9]||"Pendiente", dependencia:r[10]||"" });
  }
  return { ok: true, pedidos: pedidos };
}

function updateEstado(p) {
  var hp = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_PEDIDOS);
  if (!hp) return { ok: false };
  var rows = hp.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(p.id)) {
      hp.getRange(i+1, 10).setValue(p.estado);
      return { ok: true };
    }
  }
  return { ok: false, error: "Pedido no encontrado" };
}

function deletePedido(p) {
  var hp = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_PEDIDOS);
  if (!hp) return { ok: false };
  var rows = hp.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(p.id)) {
      hp.deleteRow(i+1);
      return { ok: true };
    }
  }
  return { ok: false, error: "Pedido no encontrado" };
}

function vaciarPedidos() {
  var hp = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_PEDIDOS);
  if (!hp) return { ok: false };
  var lastRow = hp.getLastRow();
  if (lastRow > 1) hp.deleteRows(2, lastRow - 1);
  return { ok: true };
}

function getCatalogo() {
  var hc = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_CATALOGO);
  if (!hc || hc.getLastRow() < 2) return { ok: true, catalogo: [] };
  var rows = hc.getRange(2, 1, hc.getLastRow()-1, 1).getValues();
  var cat = rows.map(function(r){ return r[0]; }).filter(function(v){ return !!v; });
  return { ok: true, catalogo: cat };
}

function setCatalogo(p) {
  var hc = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_CATALOGO);
  if (!hc) return { ok: false };
  if (hc.getLastRow() > 1) hc.deleteRows(2, hc.getLastRow()-1);
  var cat = typeof p.catalogo==="string" ? JSON.parse(p.catalogo) : (p.catalogo||[]);
  cat.forEach(function(art){ hc.appendRow([art]); });
  return { ok: true };
}

function getUsuarios() {
  var hu = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_USUARIOS);
  if (!hu) return { ok: false, usuarios: {} };
  var rows = hu.getDataRange().getValues();
  var us = {};
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0]) us[rows[i][0]] = { pass:rows[i][1], nombre:rows[i][2], rol:rows[i][3], dependencia:rows[i][4]||"" };
  }
  return { ok: true, usuarios: us };
}

function setUsuarios(p) {
  var hu = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_USUARIOS);
  if (!hu) return { ok: false };
  if (hu.getLastRow() > 1) hu.deleteRows(2, hu.getLastRow()-1);
  var us = typeof p.usuarios==="string" ? JSON.parse(p.usuarios) : (p.usuarios||{});
  Object.keys(us).forEach(function(key){
    hu.appendRow([key, us[key].pass, us[key].nombre, us[key].rol, us[key].dependencia||""]);
  });
  return { ok: true };
}
