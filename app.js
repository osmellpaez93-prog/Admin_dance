// ================= CONFIG =================
const SUPABASE_URL = 'https://lhtfrzhwzphryjhgcqjw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxodGZyemh3enBocnlqaGdjcWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzOTU3NDksImV4cCI6MjA4Njk3MTc0OX0.1HSklzboeOSAnCip3V39LcYZIJWLMZzgWuCvy7qBl2I';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ================= ESTADO =================
let users = [], categorias = [], niveles = [], clases = [], sueltos = [], access = [], instructores = [], heroSlides = [];
let currentUserAccessing = null, pendingAccess = {};
const q = { usuarios: '', contenido: '', sueltos: '', instructores: '', hero: '' };
const sort = { usuarios: 'nombre', sueltos: 'orden', instructores: 'orden', hero: 'orden' };

// ================= PRESENCIA =================
// Un alumno se considera "en línea" si su heartbeat tiene menos de 100 s.
const ONLINE_MS = 100_000;
const PRESENCE_REFRESH_MS = 30_000;

function presencia(u) {
  if (!u || !u.last_seen) return { cls: 'presence-off', txt: 'Nunca conectado', online: false };
  const diff = Date.now() - new Date(u.last_seen).getTime();
  if (Number.isNaN(diff)) return { cls: 'presence-off', txt: 'Sin datos', online: false };
  if (diff < ONLINE_MS) return { cls: 'presence-on', txt: 'En línea ahora', online: true };
  const min = Math.floor(diff / 60000);
  if (min < 1) return { cls: 'presence-recent', txt: 'Hace un momento', online: false };
  if (min < 60) return { cls: 'presence-recent', txt: `Hace ${min} min`, online: false };
  const h = Math.floor(min / 60);
  if (h < 24) return { cls: 'presence-recent', txt: `Hace ${h} h`, online: false };
  const d = new Date(u.last_seen);
  const fecha = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return { cls: 'presence-off', txt: `${fecha} · ${hora}`, online: false };
}

// ================= SUBIDA DE FOTOS =================
const HERO_BUCKET = 'hero';
const HERO_MAX_BYTES = 5 * 1024 * 1024;
const HERO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
let heroSessionPath = null;
let heroExistingPath = null;
let heroPreviewUrl = null;

// ================= ENCUADRE =================
const crop = { x: 50, y: 35, z: 1, pointers: new Map(), pinchDist: 0, pinchZ: 1, dragging: false, lastX: 0, lastY: 0 };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ================= ICONOS =================
const I = {
  edit: '<svg viewBox="0 0 24 24"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>',
  key: '<svg viewBox="0 0 24 24"><path d="m21 2-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  chev: '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>',
  phone: '<svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
  link: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
  ok: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
  err: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
};
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ================= TOASTS =================
function notify(text, type = 'info') {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${type === 'ok' ? I.ok : type === 'err' ? I.err : I.info}<span>${esc(text)}</span>`;
  box.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3200);
}

// ================= NAV / MODALES =================
function showTab(name) {
  document.querySelectorAll('.panel').forEach(p => p.hidden = true);
  $(`tab-${name}`).hidden = false;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  if (name === 'contenido') renderContenido();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function openModal(id) { $(id).classList.add('active'); document.body.classList.add('modal-open'); }
function closeModal(id) {
  $(id).classList.remove('active');
  if (!document.querySelector('.modal.active')) document.body.classList.remove('modal-open');
}
function showMsg(id, text, type) {
  const el = $(id);
  el.textContent = text; el.className = `message ${type}`; el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 4000);
}

// ================= CARGA =================
async function loadData() {
  const btn = $('btnRefresh');
  btn.classList.add('spin');
  try {
    const [u, cat, n, c, s, a, inst, h] = await Promise.all([
      db.from('users').select('*').order('created_at', { ascending: false }),
      db.from('categorias').select('*').order('orden'),
      db.from('niveles').select('*').order('orden'),
      db.from('clases').select('*').order('orden'),
      db.from('videos_sueltos').select('*').order('orden'),
      db.from('user_access').select('*'),
      db.from('instructores').select('*').order('orden'),
      db.from('hero_slides').select('*').order('orden')
    ]);
    const fail = [u, cat, n, c, s, a, inst, h].find(r => r.error);
    if (fail) throw fail.error;
    users = u.data || []; categorias = cat.data || []; niveles = n.data || []; clases = c.data || [];
    sueltos = s.data || []; access = a.data || []; instructores = inst.data || []; heroSlides = h.data || [];
    $('statUsers').textContent = users.length;
    $('statCategorias').textContent = categorias.length;
    $('statClases').textContent = clases.length;
    $('statSueltos').textContent = sueltos.length;
    $('statInstructores').textContent = instructores.length;
    $('statSlides').textContent = heroSlides.length;
    renderUsers(); renderSueltos(); renderInstructores(); renderHeroSlides(); renderContenido();
  } catch (err) {
    console.error(err); notify('No se pudieron cargar los datos. Revisa la conexión.', 'err');
  } finally {
    btn.classList.remove('spin');
    const boot = $('boot');
    if (boot && !boot.classList.contains('hide')) { boot.classList.add('hide'); setTimeout(() => boot.remove(), 600); }
  }
}

// Refresco silencioso solo de presencia: no toca acordeones ni modales abiertos.
async function refreshPresence() {
  if (document.visibilityState !== 'visible') return;
  try {
    const [u, a] = await Promise.all([
      db.from('users').select('*').order('created_at', { ascending: false }),
      db.from('user_access').select('*')
    ]);
    if (u.error || a.error) return;
    users = u.data || [];
    access = a.data || [];
    $('statUsers').textContent = users.length;
    renderUsers();
  } catch { /* silencio: la presencia es informativa */ }
}

// ================= USUARIOS =================
function renderUsers() {
  const term = q.usuarios.toLowerCase();
  let list = users.filter(u => !term || [u.name, u.access_code, u.phone].some(v => String(v || '').toLowerCase().includes(term)));
  const count = u => access.filter(a => a.user_id === u.id).length;
  const ts = u => (u.last_seen ? new Date(u.last_seen).getTime() : 0);
  if (sort.usuarios === 'nombre') list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  if (sort.usuarios === 'codigo') list.sort((a, b) => (a.access_code || '').localeCompare(b.access_code || ''));
  if (sort.usuarios === 'accesos') list.sort((a, b) => count(b) - count(a));
  if (sort.usuarios === 'recientes') list.sort((a, b) => ts(b) - ts(a));

  const online = users.filter(u => presencia(u).online).length;
  const chip = $('onlineCount');
  chip.className = `presence ${online > 0 ? 'presence-on' : 'presence-off'}`;
  chip.innerHTML = `<span class="presence-dot"></span>${online} en línea`;

  $('usersTable').innerHTML = list.length ? list.map(u => {
    const n = count(u);
    const p = presencia(u);
    return `<article class="item">
      <span class="code-tag">${esc(u.access_code || '—')}</span>
      <div class="item-main"><h4>${esc(u.name || 'Sin nombre')}</h4>
        <div class="meta"><span class="meta-item">${I.phone}${esc(u.phone || '—')}</span>
        <span class="badge ${n > 0 ? 'badge-ok' : ''}">${n} nivel${n !== 1 ? 'es' : ''}</span>
        <span class="presence ${p.cls}" title="Última conexión"><span class="presence-dot"></span>${esc(p.txt)}</span></div>
      </div>
      <div class="item-actions">
        <button class="btn btn-ghost btn-sm" onclick="manageAccess('${u.id}')" title="Accesos">${I.key}<span class="hide-m">Accesos</span></button>
        <button class="btn btn-ghost btn-sm" onclick="editUser('${u.id}')" title="Editar">${I.edit}</button>
        <button class="btn btn-danger btn-sm" onclick="del('users','${u.id}')" title="Eliminar">${I.trash}</button>
      </div></article>`;
  }).join('') : `<div class="empty"><b>Sin resultados</b>No hay alumnos que coincidan con la búsqueda.</div>`;
}
function editUser(id) {
  const u = users.find(x => x.id === id); if (!u) return;
  $('editUserId').value = u.id;
  $('editUserCode').value = u.access_code || '—';
  $('editUserName').value = u.name || '';
  $('editUserPhone').value = u.phone || '';
  $('editUserPresence').value = presencia(u).txt;
  openModal('modalEditUser');
}

// ================= CONTENIDO =================
function renderContenido() {
  const term = q.contenido.toLowerCase();
  const match = cat => {
    if (!term) return true;
    if ((cat.nombre || '').toLowerCase().includes(term)) return true;
    const ns = niveles.filter(n => n.categoria_id === cat.id);
    return ns.some(n => (n.nombre || '').toLowerCase().includes(term) || clases.some(c => c.nivel_id === n.id && (c.titulo || '').toLowerCase().includes(term)));
  };
  const cats = categorias.filter(match);
  const html = cats.map(cat => {
    const ns = niveles.filter(n => n.categoria_id === cat.id).sort((a, b) => (a.orden || 0) - (b.orden || 0));
    const total = ns.reduce((s, n) => s + clases.filter(c => c.nivel_id === n.id).length, 0);
    const maestros = instructores.filter(i => (cat.instructor_ids || []).includes(i.id)).map(i => i.nombre).join(', ') || 'Sin maestros';
    const abierto = term ? ' open' : '';
    return `<div class="acc${abierto}" id="cat-${cat.id}">
      <div class="acc-head-row">
        <button class="acc-head" onclick="toggleCat('cat-${cat.id}')">
          <span class="acc-chev">${I.chev}</span>
          <span class="acc-titles"><span class="acc-title">${esc(cat.nombre)}</span><span class="acc-sub">👨‍🏫 ${esc(maestros)}</span></span>
          <span class="acc-meta">${ns.length} niv · ${total} clases</span>
        </button>
        <div class="acc-tools">
          <button class="btn btn-ghost btn-sm" onclick="editCategoria('${cat.id}')" title="Editar">${I.edit}</button>
          <button class="btn btn-danger btn-sm" onclick="delCategoria('${cat.id}')" title="Eliminar">${I.trash}</button>
          <button class="btn btn-primary btn-sm" onclick="openModalNivel('${cat.id}')" title="Añadir nivel">${I.plus}</button>
        </div>
      </div>
      <div class="acc-body"><div class="acc-inner"><div class="acc-pad">
        ${ns.map(nivel => {
          const vs = clases.filter(c => c.nivel_id === nivel.id).sort((a, b) => (a.orden || 0) - (b.orden || 0));
          const nAbierto = term ? ' open' : '';
          return `<div class="acc${nAbierto}" id="nivel-${nivel.id}">
            <div class="acc-head-row">
              <button class="acc-head" onclick="toggleNivel('nivel-${nivel.id}')">
                <span class="acc-chev">${I.chev}</span>
                <span class="acc-titles"><span class="acc-title">${esc(nivel.nombre)}</span></span>
                <span class="acc-meta">${vs.length} videos</span>
              </button>
              <div class="acc-tools">
                <button class="btn btn-ghost btn-sm" onclick="editNivel('${nivel.id}')" title="Editar">${I.edit}</button>
                <button class="btn btn-danger btn-sm" onclick="delNivel('${nivel.id}')" title="Eliminar">${I.trash}</button>
              </div>
            </div>
            <div class="acc-body"><div class="acc-inner"><div class="acc-pad">
              ${vs.length ? vs.map(v => `<div class="vid-row">
                <div class="vid-info"><strong>${esc(v.titulo || 'Sin título')}</strong>
                  <small><span class="badge badge-amber">${esc(v.tipo_video || 'youtube')}</span><span class="mono">${esc((v.video_url || '').slice(0, 46))}</span></small>
                </div>
                <div class="vid-tools">
                  <button class="btn btn-ghost btn-sm" onclick="editVideo('${v.id}')" title="Editar">${I.edit}</button>
                  <button class="btn btn-danger btn-sm" onclick="delVideo('${v.id}')" title="Eliminar">${I.trash}</button>
                </div></div>`).join('') : '<div class="empty" style="padding:16px">Sin videos en este nivel</div>'}
              <button class="add-video" onclick="addVideo('${nivel.id}')">${I.plus}Añadir clase a este nivel</button>
            </div></div></div>
          </div>`;
        }).join('') || '<div class="empty" style="padding:16px">Sin niveles todavía</div>'}
      </div></div></div>
    </div>`;
  }).join('');
  $('contenidoJerarquico').innerHTML = html || `<div class="empty"><b>Biblioteca vacía</b>Crea tu primera categoría para empezar.</div>`;
}
function toggleCat(id) { $(id).classList.toggle('open'); }
function toggleNivel(id) { $(id).classList.toggle('open'); }

// ================= CATEGORÍAS =================
function renderInstructorCheckboxes(selected = []) {
  const box = $('categoriaInstructoresCheckboxes');
  box.innerHTML = instructores.length ? instructores.map(i =>
    `<label class="check ${selected.includes(i.id) ? 'on' : ''}"><input type="checkbox" class="instructor-checkbox" value="${i.id}" ${selected.includes(i.id) ? 'checked' : ''} onchange="this.parentElement.classList.toggle('on',this.checked)">${esc(i.nombre)}</label>`
  ).join('') : '<span class="none">Aún no hay maestros creados.</span>';
}
function openModalCategoria() {
  $('categoriaModalTitle').textContent = 'Nueva categoría';
  $('categoriaId').value = '';
  $('categoriaNombre').value = '';
  $('categoriaDesc').value = '';
  $('categoriaThumbnail').value = '';
  $('categoriaOrden').value = '0';
  renderInstructorCheckboxes([]);
  openModal('modalCategoria');
}
function editCategoria(id) {
  const c = categorias.find(x => x.id === id); if (!c) return;
  $('categoriaModalTitle').textContent = 'Editar categoría';
  $('categoriaId').value = c.id;
  $('categoriaNombre').value = c.nombre || '';
  $('categoriaDesc').value = c.descripcion || '';
  $('categoriaThumbnail').value = c.thumbnail_url || '';
  $('categoriaOrden').value = c.orden || 0;
  renderInstructorCheckboxes(c.instructor_ids || []);
  openModal('modalCategoria');
}
async function delCategoria(id) {
  if (!confirm('¿Eliminar esta categoría? Sus niveles y clases quedarán huérfanos.')) return;
  const { error } = await db.from('categorias').delete().eq('id', id);
  error ? notify(error.message, 'err') : (notify('Categoría eliminada', 'ok'), loadData());
}

// ================= NIVELES =================
function openModalNivel(catId) {
  $('nivelModalTitle').textContent = 'Nuevo nivel';
  $('nivelId').value = '';
  $('nivelCategoriaId').value = catId;
  $('nivelNombre').value = '';
  $('nivelDesc').value = '';
  $('nivelOrden').value = '1';
  openModal('modalNivel');
}
function editNivel(id) {
  const n = niveles.find(x => x.id === id); if (!n) return;
  $('nivelModalTitle').textContent = 'Editar nivel';
  $('nivelId').value = n.id;
  $('nivelCategoriaId').value = n.categoria_id || '';
  $('nivelNombre').value = n.nombre || '';
  $('nivelDesc').value = n.descripcion || '';
  $('nivelOrden').value = n.orden || 1;
  openModal('modalNivel');
}
async function delNivel(id) {
  if (!confirm('¿Eliminar este nivel y sus clases?')) return;
  const { error } = await db.from('niveles').delete().eq('id', id);
  error ? notify(error.message, 'err') : (notify('Nivel eliminado', 'ok'), loadData());
}

// ================= CLASES =================
function addVideo(nivelId) {
  $('videoModalTitle').textContent = 'Nueva clase';
  $('videoId').value = '';
  $('videoNivelId').value = nivelId;
  ['videoTitulo', 'videoDesc', 'videoUrl', 'videoThumb'].forEach(id => $(id).value = '');
  $('videoOrden').value = '1';
  $('videoTipo').value = 'youtube';
  openModal('modalVideo');
}
function editVideo(id) {
  const v = clases.find(x => x.id === id); if (!v) return;
  $('videoModalTitle').textContent = 'Editar clase';
  $('videoId').value = v.id;
  $('videoNivelId').value = v.nivel_id || '';
  $('videoTitulo').value = v.titulo || '';
  $('videoDesc').value = v.descripcion || '';
  $('videoUrl').value = v.video_url || '';
  $('videoThumb').value = v.thumbnail_url || '';
  $('videoOrden').value = v.orden || 1;
  $('videoTipo').value = v.tipo_video || 'youtube';
  openModal('modalVideo');
}
async function delVideo(id) {
  if (!confirm('¿Eliminar esta clase?')) return;
  const { error } = await db.from('clases').delete().eq('id', id);
  error ? notify(error.message, 'err') : (notify('Clase eliminada', 'ok'), loadData());
}

// ================= SUELTOS =================
function renderSueltos() {
  const term = q.sueltos.toLowerCase();
  let list = sueltos.filter(s => {
    const cat = categorias.find(c => c.id === s.categoria_id);
    return !term || [s.titulo, cat?.nombre].some(v => String(v || '').toLowerCase().includes(term));
  });
  if (sort.sueltos === 'orden') list.sort((a, b) => (a.orden || 0) - (b.orden || 0));
  if (sort.sueltos === 'titulo') list.sort((a, b) => (a.titulo || '').localeCompare(b.titulo || ''));
  $('sueltosTable').innerHTML = list.length ? list.map(s => {
    const cat = categorias.find(c => c.id === s.categoria_id);
    return `<article class="item"><div class="item-main"><h4>${esc(s.titulo || '—')}</h4>
      <div class="meta"><span class="badge badge-amber">${esc(cat ? cat.nombre : 'Sin estilo')}</span>
      <span class="badge badge-info">${esc(s.tipo_video || 'youtube')}</span>
      <span class="mono">${esc((s.video_url || '').slice(0, 40))}</span></div></div>
      <div class="item-actions">
        <button class="btn btn-ghost btn-sm" onclick="editSuelto('${s.id}')">${I.edit}</button>
        <button class="btn btn-danger btn-sm" onclick="del('videos_sueltos','${s.id}')">${I.trash}</button>
      </div></article>`;
  }).join('') : `<div class="empty"><b>Sin videos sueltos</b>Añade contenido gratuito para todos.</div>`;
}
function fillSueltoCats(val = '') {
  const sel = $('sueltoCategoria');
  sel.innerHTML = '<option value="">— Selecciona —</option>' + categorias.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
  sel.value = val;
}
function openModalSuelto() {
  $('sueltoModalTitle').textContent = 'Nuevo video suelto';
  $('sueltoId').value = '';
  ['sueltoTitulo', 'sueltoDesc', 'sueltoVideo', 'sueltoThumb'].forEach(id => $(id).value = '');
  $('sueltoOrden').value = '1';
  $('sueltoTipo').value = 'youtube';
  fillSueltoCats('');
  openModal('modalSuelto');
}
function editSuelto(id) {
  const s = sueltos.find(x => x.id === id); if (!s) return;
  $('sueltoModalTitle').textContent = 'Editar video suelto';
  $('sueltoId').value = s.id;
  $('sueltoTitulo').value = s.titulo || '';
  $('sueltoDesc').value = s.descripcion || '';
  $('sueltoVideo').value = s.video_url || '';
  $('sueltoThumb').value = s.thumbnail_url || '';
  $('sueltoOrden').value = s.orden || 1;
  $('sueltoTipo').value = s.tipo_video || 'youtube';
  fillSueltoCats(s.categoria_id || '');
  openModal('modalSuelto');
}

// ================= INSTRUCTORES =================
function renderInstructores() {
  const term = q.instructores.toLowerCase();
  let list = instructores.filter(i => !term || [i.nombre, i.especialidad].some(v => String(v || '').toLowerCase().includes(term)));
  if (sort.instructores === 'orden') list.sort((a, b) => (a.orden || 0) - (b.orden || 0));
  if (sort.instructores === 'nombre') list.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  $('instructoresTable').innerHTML = list.length ? list.map(i =>
    `<article class="item"><div class="item-main"><h4>${esc(i.nombre)}</h4>
      <div class="meta"><span class="badge badge-mag">${esc(i.especialidad || 'Baile')}</span>
      ${i.instagram ? `<a class="meta-item" href="${esc(i.instagram)}" target="_blank" rel="noopener" style="color:var(--info)">${I.link}Instagram</a>` : ''}</div></div>
      <div class="item-actions">
        <button class="btn btn-ghost btn-sm" onclick="editInstructor('${i.id}')">${I.edit}</button>
        <button class="btn btn-danger btn-sm" onclick="del('instructores','${i.id}')">${I.trash}</button>
      </div></article>`
  ).join('') : `<div class="empty"><b>Sin maestros</b>Registra al equipo de la escuela.</div>`;
}
function openModalInstructor() {
  $('instructorModalTitle').textContent = 'Nuevo maestro';
  $('instructorId').value = '';
  ['instructorNombre', 'instructorEspecialidad', 'instructorImagen', 'instructorInstagram', 'instructorBio'].forEach(id => $(id).value = '');
  $('instructorOrden').value = '0';
  openModal('modalInstructor');
}
function editInstructor(id) {
  const i = instructores.find(x => x.id === id); if (!i) return;
  $('instructorModalTitle').textContent = 'Editar maestro';
  $('instructorId').value = i.id;
  $('instructorNombre').value = i.nombre || '';
  $('instructorEspecialidad').value = i.especialidad || '';
  $('instructorImagen').value = i.imagen || '';
  $('instructorInstagram').value = i.instagram || '';
  $('instructorBio').value = i.bio || '';
  $('instructorOrden').value = i.orden || 0;
  openModal('modalInstructor');
}

// ================= HERO =================
function renderHeroSlides() {
  const term = q.hero.toLowerCase();
  let list = heroSlides.filter(s => !term || [s.titulo, s.badge].some(v => String(v || '').toLowerCase().includes(term)));
  if (sort.hero === 'orden') list.sort((a, b) => (a.orden || 0) - (b.orden || 0));
  if (sort.hero === 'titulo') list.sort((a, b) => (a.titulo || '').localeCompare(b.titulo || ''));
  $('heroTable').innerHTML = list.length ? list.map(s =>
    `<article class="item"><div class="item-main"><h4>${esc(s.titulo || '—')}</h4>
      <div class="meta"><span class="badge badge-info">${s.tipo_medio === 'video' ? 'Vídeo' : 'Imagen'}</span>
      ${s.badge ? `<span class="badge badge-amber">${esc(s.badge)}</span>` : ''}
      <span class="meta-item"><span class="dot ${s.activo ? 'dot-on' : 'dot-off'}"></span>${s.activo ? 'Publicado' : 'Oculto'}</span>
      ${(s.zoom || 1) > 1.01 ? `<span class="badge badge-mag">${Number(s.zoom).toFixed(1)}×</span>` : ''}
      <span class="badge">#${s.orden || 1}</span></div></div>
      <div class="item-actions">
        <button class="btn btn-ghost btn-sm" onclick="editHero('${s.id}')">${I.edit}</button>
        <button class="btn btn-danger btn-sm" onclick="del('hero_slides','${s.id}')">${I.trash}</button>
      </div></article>`
  ).join('') : `<div class="empty"><b>Sin slides</b>Crea promos y novedades para la home.</div>`;
}
function openModalHero() {
  $('heroModalTitle').textContent = 'Nuevo slide';
  $('heroId').value = '';
  ['heroTitulo', 'heroSubtitulo', 'heroBadge', 'heroDesc', 'heroImagen', 'heroVideo', 'heroBotonTexto', 'heroBotonUrl'].forEach(id => $(id).value = '');
  $('heroTipo').value = 'imagen';
  $('heroOrden').value = '1';
  $('heroActivo').value = 'true';
  heroResetUpload();
  cropLoad(null);
  cropSetSource('');
  openModal('modalHero');
}
function editHero(id) {
  const s = heroSlides.find(x => x.id === id); if (!s) return;
  $('heroModalTitle').textContent = 'Editar slide';
  $('heroId').value = s.id;
  $('heroTitulo').value = s.titulo || '';
  $('heroSubtitulo').value = s.subtitulo || '';
  $('heroBadge').value = s.badge || '';
  $('heroDesc').value = s.descripcion || '';
  $('heroTipo').value = s.tipo_medio || 'imagen';
  $('heroImagen').value = s.imagen_url || '';
  $('heroVideo').value = s.video_url || '';
  $('heroBotonTexto').value = s.boton_texto || '';
  $('heroBotonUrl').value = s.boton_url || '';
  $('heroOrden').value = s.orden || 1;
  $('heroActivo').value = String(s.activo !== false);
  heroResetUpload();
  cropLoad(s);
  if (s.imagen_url) {
    heroExistingPath = heroPathFromUrl(s.imagen_url);
    heroPreviewFromUrl(s.imagen_url, (s.imagen_url.split('/').pop() || 'foto').slice(0, 40), 'Publicada');
    cropSetSource(s.imagen_url);
  } else {
    cropSetSource('');
  }
  openModal('modalHero');
}

// ================= SUBIDA: UI =================
function heroClearPreview() {
  if (heroPreviewUrl) { URL.revokeObjectURL(heroPreviewUrl); heroPreviewUrl = null; }
  $('heroPreview').hidden = true;
  $('heroPreviewImg').removeAttribute('src');
}
function heroShowProgress(on, pct = 0, text = '') {
  $('heroProgress').hidden = !on;
  if (on) { $('heroProgressBar').style.width = pct + '%'; $('heroProgressText').textContent = text; }
}
function heroShowError(msg) {
  const el = $('heroUploadError');
  if (msg) { el.textContent = msg; el.hidden = false; } else { el.hidden = true; el.textContent = ''; }
}
function heroResetUpload() {
  heroSessionPath = null;
  heroExistingPath = null;
  $('heroFile').value = '';
  heroClearPreview();
  heroShowProgress(false);
  heroShowError('');
  $('heroDrop').hidden = false;
}
function heroPreviewFromUrl(url, label, sizeText) {
  heroClearPreview();
  $('heroPreviewImg').src = url;
  $('heroPreviewName').textContent = label;
  $('heroPreviewSize').textContent = sizeText;
  $('heroPreview').hidden = false;
  $('heroDrop').hidden = true;
}
function heroPathFromUrl(url) {
  const marker = `/storage/v1/object/public/${HERO_BUCKET}/`;
  const i = String(url || '').indexOf(marker);
  return i >= 0 ? decodeURIComponent(String(url).slice(i + marker.length)) : null;
}

// ================= SUBIDA: PROCESO =================
function optimizeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const MAX = 1920;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo procesar la imagen.')), 'image/webp', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Archivo de imagen no válido.')); };
    img.src = url;
  });
}
function parseStorageError(xhr) {
  try { const j = JSON.parse(xhr.responseText); return j.message || j.error || `Error ${xhr.status}`; }
  catch { return `Error ${xhr.status} al subir la foto.`; }
}
function uploadToStorage(path, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${HERO_BUCKET}/${encoded}`);
    xhr.setRequestHeader('apikey', SUPABASE_KEY);
    xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_KEY}`);
    xhr.setRequestHeader('Content-Type', blob.type || 'image/webp');
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error(parseStorageError(xhr)));
    xhr.onerror = () => reject(new Error('Sin conexión con el almacenamiento.'));
    xhr.send(blob);
  });
}
async function handleHeroFile(file) {
  if (!file) return;
  heroShowError('');
  if (!HERO_TYPES.includes(file.type)) { heroShowError('Formato no admitido. Usa JPG, PNG o WebP.'); return; }
  if (file.size > HERO_MAX_BYTES) { heroShowError(`La foto pesa ${(file.size / 1048576).toFixed(1)} MB. El máximo es 5 MB.`); return; }
  $('heroDrop').hidden = true;
  heroShowProgress(true, 12, 'Optimizando imagen…');
  try {
    const blob = await optimizeImage(file);
    const ext = (blob.type.split('/')[1] || 'webp').replace('jpeg', 'jpg');
    const path = `slides/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    heroShowProgress(true, 30, 'Subiendo… 0%');
    await uploadToStorage(path, blob, p => heroShowProgress(true, 30 + Math.round(p * 0.65), `Subiendo… ${p}%`));
    const { data } = db.storage.from(HERO_BUCKET).getPublicUrl(path);
    const previous = heroSessionPath || heroExistingPath;
    heroSessionPath = path;
    heroExistingPath = null;
    if (previous && previous !== path) db.storage.from(HERO_BUCKET).remove([previous]).catch(() => {});
    $('heroImagen').value = data.publicUrl;
    heroPreviewUrl = URL.createObjectURL(blob);
    heroPreviewFromUrl(heroPreviewUrl, path.split('/').pop(), `${Math.max(1, Math.round(blob.size / 1024))} KB · optimizada`);
    cropSetSource(heroPreviewUrl);
    heroShowProgress(true, 100, 'Foto lista');
    setTimeout(() => heroShowProgress(false), 900);
    notify('Foto subida. Arrástrala en el encuadre para colocarla.', 'ok');
  } catch (err) {
    heroShowProgress(false);
    $('heroDrop').hidden = false;
    heroShowError(err.message || 'No se pudo subir la foto.');
    notify(err.message || 'Error al subir la foto', 'err');
  }
}
async function removeHeroPhoto() {
  if (heroSessionPath) {
    await db.storage.from(HERO_BUCKET).remove([heroSessionPath]).catch(() => {});
    heroSessionPath = null;
  }
  heroExistingPath = null;
  $('heroImagen').value = '';
  $('heroFile').value = '';
  heroClearPreview();
  heroShowError('');
  heroShowProgress(false);
  $('heroDrop').hidden = false;
  cropSetSource('');
  notify('Foto quitada del slide', 'info');
}

// ================= ENCUADRE: RENDER =================
function cropMetrics() {
  const vp = $('cropViewport'), img = $('cropImg');
  const r = vp.getBoundingClientRect();
  const nw = img.naturalWidth || 1, nh = img.naturalHeight || 1;
  const cover = Math.max(r.width / nw, r.height / nh);
  return { vw: r.width, vh: r.height, iw: nw * cover * crop.z, ih: nh * cover * crop.z };
}
function cropRender() {
  const img = $('cropImg');
  img.style.objectPosition = `${crop.x}% ${crop.y}%`;
  img.style.transform = `scale(${crop.z})`;
  img.style.transformOrigin = `${crop.x}% ${crop.y}%`;
  $('cropZoom').value = String(crop.z);
  $('cropRead').textContent = `X ${Math.round(crop.x)}% · Y ${Math.round(crop.y)}% · ${crop.z.toFixed(1)}×`;
  $('heroFocoX').value = String(Math.round(crop.x));
  $('heroFocoY').value = String(Math.round(crop.y));
  $('heroZoom').value = crop.z.toFixed(2);
}
function cropSetSource(url) {
  const field = $('cropField');
  if (!url) { field.hidden = true; return; }
  field.hidden = false;
  const img = $('cropImg');
  if (img.getAttribute('src') !== url) img.src = url;
  $('cropViewport').classList.remove('used');
  cropRender();
  cropNote();
}
function cropLoad(s) {
  crop.x = clamp(Number(s?.foco_x ?? 50) || 50, 0, 100);
  crop.y = clamp(Number(s?.foco_y ?? 35) || 35, 0, 100);
  crop.z = clamp(parseFloat(s?.zoom ?? 1) || 1, 1, 4);
  cropRender();
}
function cropReset() { crop.x = 50; crop.y = 35; crop.z = 1; cropRender(); }
function cropNote() {
  const esYoutube = /youtube\.com|youtu\.be/i.test($('heroVideo').value.trim());
  $('cropNote').hidden = !($('heroTipo').value === 'video' && esYoutube);
}

// ================= ACCESOS =================
async function manageAccess(uid) {
  await loadData();
  const u = users.find(x => x.id === uid); if (!u) return;
  currentUserAccessing = uid; pendingAccess = {};
  $('accesosTitle').textContent = `Accesos · ${u.name}`;
  $('accesosInfo').innerHTML = `Código del alumno: <strong>${esc(u.access_code)}</strong> · ${esc(presencia(u).txt)}`;
  const tiene = access.filter(a => a.user_id === uid).map(a => a.nivel_id);
  $('accesosPorCategoria').innerHTML = categorias.map(cat => {
    const ns = niveles.filter(n => n.categoria_id === cat.id);
    if (!ns.length) return '';
    return `<div class="access-group"><h4>${esc(cat.nombre)}</h4><div class="access-chips">
      ${ns.map(n => `<label class="access-chip ${tiene.includes(n.id) ? 'on' : ''}">
        <input type="checkbox" ${tiene.includes(n.id) ? 'checked' : ''} onchange="pendingAccess['${n.id}']=this.checked;this.parentElement.classList.toggle('on',this.checked)">
        ${esc(n.nombre)}</label>`).join('')}
    </div></div>`;
  }).join('') || '<div class="empty">No hay niveles creados</div>';
  openModal('modalAccesos');
}
async function saveAllAccess() {
  if (!currentUserAccessing) return;
  const tiene = access.filter(a => a.user_id === currentUserAccessing).map(a => a.nivel_id);
  const add = [], remove = [];
  Object.keys(pendingAccess).forEach(id => {
    if (pendingAccess[id] && !tiene.includes(id)) add.push(id);
    else if (!pendingAccess[id] && tiene.includes(id)) remove.push(id);
  });
  let error = null;
  if (add.length) { const r = await db.from('user_access').insert(add.map(nivel_id => ({ user_id: currentUserAccessing, nivel_id }))); error = r.error; }
  if (!error && remove.length) { for (const id of remove) { const r = await db.from('user_access').delete().eq('user_id', currentUserAccessing).eq('nivel_id', id); if (r.error) { error = r.error; break; } } }
  if (error) notify(error.message, 'err');
  else { notify('Accesos actualizados', 'ok'); closeModal('modalAccesos'); loadData(); }
}

// ================= GENÉRICO =================
async function del(table, id) {
  if (!confirm('¿Eliminar este registro? Esta acción no se puede deshacer.')) return;
  const { error } = await db.from(table).delete().eq('id', id);
  error ? notify(error.message, 'err') : (notify('Registro eliminado', 'ok'), loadData());
}
async function save(table, id, data, modalId) {
  const r = id ? await db.from(table).update(data).eq('id', id) : await db.from(table).insert([data]);
  if (r.error) notify(r.error.message, 'err');
  else { closeModal(modalId); notify(id ? 'Cambios guardados' : 'Creado correctamente', 'ok'); loadData(); }
}

// ================= FORMULARIOS =================
$('formEditUser').addEventListener('submit', e => {
  e.preventDefault();
  save('users', $('editUserId').value, {
    name: $('editUserName').value.trim(),
    phone: $('editUserPhone').value.trim()
  }, 'modalEditUser');
});
$('newUserForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('newUserName').value.trim();
  const phone = $('newUserPhone').value.trim();
  if (!name || !phone) return;
  let code, exists = true;
  while (exists) {
    code = 'SM' + Math.floor(10000 + Math.random() * 90000);
    const { data } = await db.from('users').select('id').eq('access_code', code).maybeSingle();
    if (!data) exists = false;
  }
  const { error } = await db.from('users').insert([{ name, phone, access_code: code }]);
  if (error) showMsg('newUserMsg', error.message, 'error');
  else {
    $('codeValue').textContent = code;
    $('codeBox').hidden = false;
    $('newUserForm').reset();
    notify(`Alumno creado · ${code}`, 'ok');
    loadData();
  }
});
$('btnCopyCode').addEventListener('click', async () => {
  const code = $('codeValue').textContent;
  try { await navigator.clipboard.writeText(code); notify('Código copiado al portapapeles', 'ok'); }
  catch {
    const t = document.createElement('textarea'); t.value = code; document.body.appendChild(t);
    t.select(); document.execCommand('copy'); t.remove(); notify('Código copiado', 'ok');
  }
});
$('formCategoria').addEventListener('submit', e => {
  e.preventDefault();
  save('categorias', $('categoriaId').value, {
    nombre: $('categoriaNombre').value.trim(),
    descripcion: $('categoriaDesc').value.trim(),
    thumbnail_url: $('categoriaThumbnail').value.trim(),
    orden: parseInt($('categoriaOrden').value) || 0,
    instructor_ids: Array.from(document.querySelectorAll('.instructor-checkbox:checked')).map(c => c.value)
  }, 'modalCategoria');
});
$('formNivel').addEventListener('submit', e => {
  e.preventDefault();
  save('niveles', $('nivelId').value, {
    nombre: $('nivelNombre').value.trim(),
    descripcion: $('nivelDesc').value.trim(),
    categoria_id: $('nivelCategoriaId').value,
    orden: parseInt($('nivelOrden').value) || 1
  }, 'modalNivel');
});
$('formVideo').addEventListener('submit', e => {
  e.preventDefault();
  save('clases', $('videoId').value, {
    titulo: $('videoTitulo').value.trim(),
    descripcion: $('videoDesc').value.trim(),
    video_url: $('videoUrl').value.trim(),
    thumbnail_url: $('videoThumb').value.trim(),
    nivel_id: $('videoNivelId').value,
    orden: parseInt($('videoOrden').value) || 1,
    tipo_video: $('videoTipo').value
  }, 'modalVideo');
});
$('formSuelto').addEventListener('submit', e => {
  e.preventDefault();
  save('videos_sueltos', $('sueltoId').value, {
    titulo: $('sueltoTitulo').value.trim(),
    descripcion: $('sueltoDesc').value.trim(),
    video_url: $('sueltoVideo').value.trim(),
    thumbnail_url: $('sueltoThumb').value.trim(),
    categoria_id: $('sueltoCategoria').value || null,
    orden: parseInt($('sueltoOrden').value) || 1,
    tipo_video: $('sueltoTipo').value
  }, 'modalSuelto');
});
$('formInstructor').addEventListener('submit', e => {
  e.preventDefault();
  save('instructores', $('instructorId').value, {
    nombre: $('instructorNombre').value.trim(),
    especialidad: $('instructorEspecialidad').value.trim(),
    imagen: $('instructorImagen').value.trim(),
    instagram: $('instructorInstagram').value.trim(),
    bio: $('instructorBio').value.trim(),
    orden: parseInt($('instructorOrden').value) || 0
  }, 'modalInstructor');
});
$('formHero').addEventListener('submit', e => {
  e.preventDefault();
  save('hero_slides', $('heroId').value, {
    titulo: $('heroTitulo').value.trim(),
    subtitulo: $('heroSubtitulo').value.trim(),
    badge: $('heroBadge').value.trim(),
    descripcion: $('heroDesc').value.trim(),
    tipo_medio: $('heroTipo').value,
    imagen_url: $('heroImagen').value.trim(),
    video_url: $('heroVideo').value.trim(),
    boton_texto: $('heroBotonTexto').value.trim(),
    boton_url: $('heroBotonUrl').value.trim(),
    orden: parseInt($('heroOrden').value) || 1,
    activo: $('heroActivo').value === 'true',
    foco_x: clamp(parseInt($('heroFocoX').value) || 50, 0, 100),
    foco_y: clamp(parseInt($('heroFocoY').value) || 35, 0, 100),
    zoom: clamp(parseFloat($('heroZoom').value) || 1, 1, 4)
  }, 'modalHero');
});

// ================= BUSCADORES / ORDEN =================
[['qUsuarios', 'usuarios', renderUsers], ['qContenido', 'contenido', renderContenido], ['qSueltos', 'sueltos', renderSueltos], ['qInstructores', 'instructores', renderInstructores], ['qHero', 'hero', renderHeroSlides]]
  .forEach(([id, key, fn]) => $(id).addEventListener('input', e => { q[key] = e.target.value; fn(); }));
[['sortUsuarios', 'usuarios', renderUsers], ['sortSueltos', 'sueltos', renderSueltos], ['sortInstructores', 'instructores', renderInstructores], ['sortHero', 'hero', renderHeroSlides]]
  .forEach(([id, key, fn]) => $(id).addEventListener('change', e => { sort[key] = e.target.value; fn(); }));

// ================= SUBIDA: EVENTOS =================
const heroDrop = $('heroDrop'), heroFile = $('heroFile');
heroDrop.addEventListener('click', () => heroFile.click());
heroDrop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); heroFile.click(); } });
['dragenter', 'dragover'].forEach(ev => heroDrop.addEventListener(ev, e => { e.preventDefault(); heroDrop.classList.add('drag'); }));
['dragleave', 'drop'].forEach(ev => heroDrop.addEventListener(ev, e => { e.preventDefault(); heroDrop.classList.remove('drag'); }));
heroDrop.addEventListener('drop', e => handleHeroFile(e.dataTransfer.files && e.dataTransfer.files[0]));
heroFile.addEventListener('change', () => { handleHeroFile(heroFile.files[0]); heroFile.value = ''; });
$('heroChange').addEventListener('click', () => heroFile.click());
$('heroRemove').addEventListener('click', removeHeroPhoto);

// ================= ENCUADRE: EVENTOS =================
const cropVp = $('cropViewport');
$('cropImg').addEventListener('load', cropRender);
cropVp.addEventListener('pointerdown', e => {
  cropVp.setPointerCapture(e.pointerId);
  crop.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (crop.pointers.size === 1) {
    crop.dragging = true; crop.lastX = e.clientX; crop.lastY = e.clientY;
    cropVp.classList.add('grabbing', 'used');
  } else if (crop.pointers.size === 2) {
    const [a, b] = [...crop.pointers.values()];
    crop.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    crop.pinchZ = crop.z;
    crop.dragging = false;
  }
});
cropVp.addEventListener('pointermove', e => {
  if (!crop.pointers.has(e.pointerId)) return;
  crop.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (crop.pointers.size === 2) {
    const [a, b] = [...crop.pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (crop.pinchDist > 0) { crop.z = clamp(crop.pinchZ * (d / crop.pinchDist), 1, 4); cropRender(); }
    return;
  }
  if (!crop.dragging) return;
  const dx = e.clientX - crop.lastX, dy = e.clientY - crop.lastY;
  crop.lastX = e.clientX; crop.lastY = e.clientY;
  const m = cropMetrics();
  if (m.iw > m.vw + 0.5) crop.x = clamp(crop.x - dx * 100 / (m.iw - m.vw), 0, 100);
  if (m.ih > m.vh + 0.5) crop.y = clamp(crop.y - dy * 100 / (m.ih - m.vh), 0, 100);
  cropRender();
});
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => cropVp.addEventListener(ev, e => {
  crop.pointers.delete(e.pointerId);
  if (crop.pointers.size < 2) crop.pinchDist = 0;
  if (crop.pointers.size === 0) { crop.dragging = false; cropVp.classList.remove('grabbing'); }
}));
cropVp.addEventListener('wheel', e => {
  e.preventDefault();
  crop.z = clamp(crop.z * (e.deltaY < 0 ? 1.12 : 0.9), 1, 4);
  cropVp.classList.add('used');
  cropRender();
}, { passive: false });
cropVp.addEventListener('keydown', e => {
  const step = e.shiftKey ? 6 : 2;
  if (e.key === 'ArrowLeft') { crop.x = clamp(crop.x - step, 0, 100); }
  else if (e.key === 'ArrowRight') { crop.x = clamp(crop.x + step, 0, 100); }
  else if (e.key === 'ArrowUp') { crop.y = clamp(crop.y - step, 0, 100); }
  else if (e.key === 'ArrowDown') { crop.y = clamp(crop.y + step, 0, 100); }
  else if (e.key === '+' || e.key === '=') { crop.z = clamp(crop.z + 0.1, 1, 4); }
  else if (e.key === '-' || e.key === '_') { crop.z = clamp(crop.z - 0.1, 1, 4); }
  else if (e.key === '0') { cropReset(); }
  else return;
  e.preventDefault();
  cropVp.classList.add('used');
  cropRender();
});
$('cropZoom').addEventListener('input', e => { crop.z = clamp(parseFloat(e.target.value) || 1, 1, 4); cropVp.classList.add('used'); cropRender(); });
$('cropReset').addEventListener('click', () => { cropReset(); notify('Encuadre restablecido', 'info'); });
$('cropGridBtn').addEventListener('click', e => {
  const grid = $('cropGrid');
  grid.hidden = !grid.hidden;
  e.currentTarget.setAttribute('aria-pressed', String(!grid.hidden));
});
document.querySelectorAll('.crop-aspects .crop-chip').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.crop-aspects .crop-chip').forEach(b => b.classList.toggle('on', b === btn));
  cropVp.classList.toggle('tall', btn.dataset.aspect === 'tall');
  requestAnimationFrame(cropRender);
}));
document.querySelectorAll('.crop-presets .crop-chip').forEach(btn => btn.addEventListener('click', () => {
  crop.y = clamp(Number(btn.dataset.y) || 50, 0, 100);
  cropVp.classList.add('used');
  cropRender();
}));
$('heroTipo').addEventListener('change', cropNote);
$('heroVideo').addEventListener('input', cropNote);
$('heroImagen').addEventListener('input', e => cropSetSource(e.target.value.trim()));
window.addEventListener('resize', () => { if (!$('cropField').hidden) cropRender(); });

// ================= INIT =================
$('btnRefresh').addEventListener('click', () => { loadData(); notify('Datos recargados', 'info'); });
document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); }));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { const open = document.querySelectorAll('.modal.active'); if (open.length) closeModal(open[open.length - 1].id); }
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshPresence(); });
window.setInterval(refreshPresence, PRESENCE_REFRESH_MS);

loadData();