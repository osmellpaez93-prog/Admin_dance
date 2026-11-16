// ================= CONFIG =================
const SUPABASE_URL = 'https://lhtfrzhwzphryjhgcqjw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxodGZyemh3enBocnlqaGdjcWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzOTU3NDksImV4cCI6MjA4Njk3MTc0OX0.1HSklzboeOSAnCip3V39LcYZIJWLMZzgWuCvy7qBl2I';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ================= ESTADO =================
let users = [], categorias = [], niveles = [], clases = [], sueltos = [], access = [], instructores = [], heroSlides = [];
let currentUserAccessing = null, pendingAccess = {};
const q = { usuarios: '', contenido: '', sueltos: '', instructores: '', hero: '' };
const sort = { usuarios: 'nombre', sueltos: 'orden', instructores: 'orden', hero: 'orden' };

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
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ================= TOASTS =================
function notify(text, type = 'info') {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${type === 'ok' ? I.ok : type === 'err' ? I.err : I.info}<span>${esc(text)}</span>`;
  box.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3200);
}

// ================= NAV / MODALES =================
function showTab(name) {
  document.querySelectorAll('.panel').forEach(p => p.hidden = true);
  document.getElementById(`tab-${name}`).hidden = false;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  if (name === 'contenido') renderContenido();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function openModal(id) { document.getElementById(id).classList.add('active'); document.body.classList.add('modal-open'); }
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
  if (!document.querySelector('.modal.active')) document.body.classList.remove('modal-open');
}
function showMsg(id, text, type) {
  const el = document.getElementById(id);
  el.textContent = text; el.className = `message ${type}`; el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 4000);
}

// ================= CARGA =================
async function loadData() {
  const btn = document.getElementById('btnRefresh');
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
    document.getElementById('statUsers').textContent = users.length;
    document.getElementById('statCategorias').textContent = categorias.length;
    document.getElementById('statClases').textContent = clases.length;
    document.getElementById('statSueltos').textContent = sueltos.length;
    document.getElementById('statInstructores').textContent = instructores.length;
    document.getElementById('statSlides').textContent = heroSlides.length;
    renderUsers(); renderSueltos(); renderInstructores(); renderHeroSlides(); renderContenido();
  } catch (err) {
    console.error(err); notify('No se pudieron cargar los datos. Revisa la conexión.', 'err');
  } finally {
    btn.classList.remove('spin');
    const boot = document.getElementById('boot');
    if (boot && !boot.classList.contains('hide')) { boot.classList.add('hide'); setTimeout(() => boot.remove(), 600); }
  }
}

// ================= USUARIOS =================
function renderUsers() {
  const term = q.usuarios.toLowerCase();
  let list = users.filter(u => !term || [u.name, u.access_code, u.phone].some(v => String(v || '').toLowerCase().includes(term)));
  const count = u => access.filter(a => a.user_id === u.id).length;
  if (sort.usuarios === 'nombre') list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  if (sort.usuarios === 'codigo') list.sort((a, b) => (a.access_code || '').localeCompare(b.access_code || ''));
  if (sort.usuarios === 'accesos') list.sort((a, b) => count(b) - count(a));
  document.getElementById('usersTable').innerHTML = list.length ? list.map(u => {
    const n = count(u);
    return `<article class="item">
      <span class="code-tag">${esc(u.access_code || '—')}</span>
      <div class="item-main"><h4>${esc(u.name || 'Sin nombre')}</h4>
        <div class="meta"><span class="meta-item">${I.phone}${esc(u.phone || '—')}</span>
        <span class="badge ${n > 0 ? 'badge-ok' : ''}">${n} nivel${n !== 1 ? 'es' : ''}</span></div>
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
  document.getElementById('editUserId').value = u.id;
  document.getElementById('editUserCode').value = u.access_code || '—';
  document.getElementById('editUserName').value = u.name || '';
  document.getElementById('editUserPhone').value = u.phone || '';
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
  document.getElementById('contenidoJerarquico').innerHTML = html || `<div class="empty"><b>Biblioteca vacía</b>Crea tu primera categoría para empezar.</div>`;
}
function toggleCat(id) { document.getElementById(id).classList.toggle('open'); }
function toggleNivel(id) { document.getElementById(id).classList.toggle('open'); }

// ================= CATEGORÍAS =================
function renderInstructorCheckboxes(selected = []) {
  const box = document.getElementById('categoriaInstructoresCheckboxes');
  box.innerHTML = instructores.length ? instructores.map(i =>
    `<label class="check ${selected.includes(i.id) ? 'on' : ''}"><input type="checkbox" class="instructor-checkbox" value="${i.id}" ${selected.includes(i.id) ? 'checked' : ''} onchange="this.parentElement.classList.toggle('on',this.checked)">${esc(i.nombre)}</label>`
  ).join('') : '<span class="none">Aún no hay maestros creados.</span>';
}
function openModalCategoria() {
  document.getElementById('categoriaModalTitle').textContent = 'Nueva categoría';
  document.getElementById('categoriaId').value = '';
  document.getElementById('categoriaNombre').value = '';
  document.getElementById('categoriaDesc').value = '';
  document.getElementById('categoriaThumbnail').value = '';
  document.getElementById('categoriaOrden').value = '0';
  renderInstructorCheckboxes([]);
  openModal('modalCategoria');
}
function editCategoria(id) {
  const c = categorias.find(x => x.id === id); if (!c) return;
  document.getElementById('categoriaModalTitle').textContent = 'Editar categoría';
  document.getElementById('categoriaId').value = c.id;
  document.getElementById('categoriaNombre').value = c.nombre || '';
  document.getElementById('categoriaDesc').value = c.descripcion || '';
  document.getElementById('categoriaThumbnail').value = c.thumbnail_url || '';
  document.getElementById('categoriaOrden').value = c.orden || 0;
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
  document.getElementById('nivelModalTitle').textContent = 'Nuevo nivel';
  document.getElementById('nivelId').value = '';
  document.getElementById('nivelCategoriaId').value = catId;
  document.getElementById('nivelNombre').value = '';
  document.getElementById('nivelDesc').value = '';
  document.getElementById('nivelOrden').value = '1';
  openModal('modalNivel');
}
function editNivel(id) {
  const n = niveles.find(x => x.id === id); if (!n) return;
  document.getElementById('nivelModalTitle').textContent = 'Editar nivel';
  document.getElementById('nivelId').value = n.id;
  document.getElementById('nivelCategoriaId').value = n.categoria_id || '';
  document.getElementById('nivelNombre').value = n.nombre || '';
  document.getElementById('nivelDesc').value = n.descripcion || '';
  document.getElementById('nivelOrden').value = n.orden || 1;
  openModal('modalNivel');
}
async function delNivel(id) {
  if (!confirm('¿Eliminar este nivel y sus clases?')) return;
  const { error } = await db.from('niveles').delete().eq('id', id);
  error ? notify(error.message, 'err') : (notify('Nivel eliminado', 'ok'), loadData());
}

// ================= CLASES =================
function addVideo(nivelId) {
  document.getElementById('videoModalTitle').textContent = 'Nueva clase';
  document.getElementById('videoId').value = '';
  document.getElementById('videoNivelId').value = nivelId;
  ['videoTitulo', 'videoDesc', 'videoUrl', 'videoThumb'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('videoOrden').value = '1';
  document.getElementById('videoTipo').value = 'youtube';
  openModal('modalVideo');
}
function editVideo(id) {
  const v = clases.find(x => x.id === id); if (!v) return;
  document.getElementById('videoModalTitle').textContent = 'Editar clase';
  document.getElementById('videoId').value = v.id;
  document.getElementById('videoNivelId').value = v.nivel_id || '';
  document.getElementById('videoTitulo').value = v.titulo || '';
  document.getElementById('videoDesc').value = v.descripcion || '';
  document.getElementById('videoUrl').value = v.video_url || '';
  document.getElementById('videoThumb').value = v.thumbnail_url || '';
  document.getElementById('videoOrden').value = v.orden || 1;
  document.getElementById('videoTipo').value = v.tipo_video || 'youtube';
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
  document.getElementById('sueltosTable').innerHTML = list.length ? list.map(s => {
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
  const sel = document.getElementById('sueltoCategoria');
  sel.innerHTML = '<option value="">— Selecciona —</option>' + categorias.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
  sel.value = val;
}
function openModalSuelto() {
  document.getElementById('sueltoModalTitle').textContent = 'Nuevo video suelto';
  document.getElementById('sueltoId').value = '';
  ['sueltoTitulo', 'sueltoDesc', 'sueltoVideo', 'sueltoThumb'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('sueltoOrden').value = '1';
  document.getElementById('sueltoTipo').value = 'youtube';
  fillSueltoCats('');
  openModal('modalSuelto');
}
function editSuelto(id) {
  const s = sueltos.find(x => x.id === id); if (!s) return;
  document.getElementById('sueltoModalTitle').textContent = 'Editar video suelto';
  document.getElementById('sueltoId').value = s.id;
  document.getElementById('sueltoTitulo').value = s.titulo || '';
  document.getElementById('sueltoDesc').value = s.descripcion || '';
  document.getElementById('sueltoVideo').value = s.video_url || '';
  document.getElementById('sueltoThumb').value = s.thumbnail_url || '';
  document.getElementById('sueltoOrden').value = s.orden || 1;
  document.getElementById('sueltoTipo').value = s.tipo_video || 'youtube';
  fillSueltoCats(s.categoria_id || '');
  openModal('modalSuelto');
}

// ================= INSTRUCTORES =================
function renderInstructores() {
  const term = q.instructores.toLowerCase();
  let list = instructores.filter(i => !term || [i.nombre, i.especialidad].some(v => String(v || '').toLowerCase().includes(term)));
  if (sort.instructores === 'orden') list.sort((a, b) => (a.orden || 0) - (b.orden || 0));
  if (sort.instructores === 'nombre') list.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  document.getElementById('instructoresTable').innerHTML = list.length ? list.map(i =>
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
  document.getElementById('instructorModalTitle').textContent = 'Nuevo maestro';
  document.getElementById('instructorId').value = '';
  ['instructorNombre', 'instructorEspecialidad', 'instructorImagen', 'instructorInstagram', 'instructorBio'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('instructorOrden').value = '0';
  openModal('modalInstructor');
}
function editInstructor(id) {
  const i = instructores.find(x => x.id === id); if (!i) return;
  document.getElementById('instructorModalTitle').textContent = 'Editar maestro';
  document.getElementById('instructorId').value = i.id;
  document.getElementById('instructorNombre').value = i.nombre || '';
  document.getElementById('instructorEspecialidad').value = i.especialidad || '';
  document.getElementById('instructorImagen').value = i.imagen || '';
  document.getElementById('instructorInstagram').value = i.instagram || '';
  document.getElementById('instructorBio').value = i.bio || '';
  document.getElementById('instructorOrden').value = i.orden || 0;
  openModal('modalInstructor');
}

// ================= HERO =================
function renderHeroSlides() {
  const term = q.hero.toLowerCase();
  let list = heroSlides.filter(s => !term || [s.titulo, s.badge].some(v => String(v || '').toLowerCase().includes(term)));
  if (sort.hero === 'orden') list.sort((a, b) => (a.orden || 0) - (b.orden || 0));
  if (sort.hero === 'titulo') list.sort((a, b) => (a.titulo || '').localeCompare(b.titulo || ''));
  document.getElementById('heroTable').innerHTML = list.length ? list.map(s =>
    `<article class="item"><div class="item-main"><h4>${esc(s.titulo || '—')}</h4>
      <div class="meta"><span class="badge badge-info">${s.tipo_medio === 'video' ? 'Vídeo' : 'Imagen'}</span>
      ${s.badge ? `<span class="badge badge-amber">${esc(s.badge)}</span>` : ''}
      <span class="meta-item"><span class="dot ${s.activo ? 'dot-on' : 'dot-off'}"></span>${s.activo ? 'Publicado' : 'Oculto'}</span>
      <span class="badge">#${s.orden || 1}</span></div></div>
      <div class="item-actions">
        <button class="btn btn-ghost btn-sm" onclick="editHero('${s.id}')">${I.edit}</button>
        <button class="btn btn-danger btn-sm" onclick="del('hero_slides','${s.id}')">${I.trash}</button>
      </div></article>`
  ).join('') : `<div class="empty"><b>Sin slides</b>Crea promos y novedades para la home.</div>`;
}
function openModalHero() {
  document.getElementById('heroModalTitle').textContent = 'Nuevo slide';
  document.getElementById('heroId').value = '';
  ['heroTitulo', 'heroSubtitulo', 'heroBadge', 'heroDesc', 'heroImagen', 'heroVideo', 'heroBotonTexto', 'heroBotonUrl'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('heroTipo').value = 'imagen';
  document.getElementById('heroOrden').value = '1';
  document.getElementById('heroActivo').value = 'true';
  openModal('modalHero');
}
function editHero(id) {
  const s = heroSlides.find(x => x.id === id); if (!s) return;
  document.getElementById('heroModalTitle').textContent = 'Editar slide';
  document.getElementById('heroId').value = s.id;
  document.getElementById('heroTitulo').value = s.titulo || '';
  document.getElementById('heroSubtitulo').value = s.subtitulo || '';
  document.getElementById('heroBadge').value = s.badge || '';
  document.getElementById('heroDesc').value = s.descripcion || '';
  document.getElementById('heroTipo').value = s.tipo_medio || 'imagen';
  document.getElementById('heroImagen').value = s.imagen_url || '';
  document.getElementById('heroVideo').value = s.video_url || '';
  document.getElementById('heroBotonTexto').value = s.boton_texto || '';
  document.getElementById('heroBotonUrl').value = s.boton_url || '';
  document.getElementById('heroOrden').value = s.orden || 1;
  document.getElementById('heroActivo').value = String(s.activo !== false);
  openModal('modalHero');
}

// ================= ACCESOS =================
async function manageAccess(uid) {
  await loadData();
  const u = users.find(x => x.id === uid); if (!u) return;
  currentUserAccessing = uid; pendingAccess = {};
  document.getElementById('accesosTitle').textContent = `Accesos · ${u.name}`;
  document.getElementById('accesosInfo').innerHTML = `Código del alumno: <strong>${esc(u.access_code)}</strong>`;
  const tiene = access.filter(a => a.user_id === uid).map(a => a.nivel_id);
  document.getElementById('accesosPorCategoria').innerHTML = categorias.map(cat => {
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
document.getElementById('formEditUser').addEventListener('submit', e => {
  e.preventDefault();
  save('users', document.getElementById('editUserId').value, {
    name: document.getElementById('editUserName').value.trim(),
    phone: document.getElementById('editUserPhone').value.trim()
  }, 'modalEditUser');
});
document.getElementById('newUserForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('newUserName').value.trim();
  const phone = document.getElementById('newUserPhone').value.trim();
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
    document.getElementById('codeValue').textContent = code;
    document.getElementById('codeBox').hidden = false;
    document.getElementById('newUserForm').reset();
    notify(`Alumno creado · ${code}`, 'ok');
    loadData();
  }
});
document.getElementById('btnCopyCode').addEventListener('click', async () => {
  const code = document.getElementById('codeValue').textContent;
  try { await navigator.clipboard.writeText(code); notify('Código copiado al portapapeles', 'ok'); }
  catch {
    const t = document.createElement('textarea'); t.value = code; document.body.appendChild(t);
    t.select(); document.execCommand('copy'); t.remove(); notify('Código copiado', 'ok');
  }
});
document.getElementById('formCategoria').addEventListener('submit', e => {
  e.preventDefault();
  save('categorias', document.getElementById('categoriaId').value, {
    nombre: document.getElementById('categoriaNombre').value.trim(),
    descripcion: document.getElementById('categoriaDesc').value.trim(),
    thumbnail_url: document.getElementById('categoriaThumbnail').value.trim(),
    orden: parseInt(document.getElementById('categoriaOrden').value) || 0,
    instructor_ids: Array.from(document.querySelectorAll('.instructor-checkbox:checked')).map(c => c.value)
  }, 'modalCategoria');
});
document.getElementById('formNivel').addEventListener('submit', e => {
  e.preventDefault();
  save('niveles', document.getElementById('nivelId').value, {
    nombre: document.getElementById('nivelNombre').value.trim(),
    descripcion: document.getElementById('nivelDesc').value.trim(),
    categoria_id: document.getElementById('nivelCategoriaId').value,
    orden: parseInt(document.getElementById('nivelOrden').value) || 1
  }, 'modalNivel');
});
document.getElementById('formVideo').addEventListener('submit', e => {
  e.preventDefault();
  save('clases', document.getElementById('videoId').value, {
    titulo: document.getElementById('videoTitulo').value.trim(),
    descripcion: document.getElementById('videoDesc').value.trim(),
    video_url: document.getElementById('videoUrl').value.trim(),
    thumbnail_url: document.getElementById('videoThumb').value.trim(),
    nivel_id: document.getElementById('videoNivelId').value,
    orden: parseInt(document.getElementById('videoOrden').value) || 1,
    tipo_video: document.getElementById('videoTipo').value
  }, 'modalVideo');
});
document.getElementById('formSuelto').addEventListener('submit', e => {
  e.preventDefault();
  save('videos_sueltos', document.getElementById('sueltoId').value, {
    titulo: document.getElementById('sueltoTitulo').value.trim(),
    descripcion: document.getElementById('sueltoDesc').value.trim(),
    video_url: document.getElementById('sueltoVideo').value.trim(),
    thumbnail_url: document.getElementById('sueltoThumb').value.trim(),
    categoria_id: document.getElementById('sueltoCategoria').value || null,
    orden: parseInt(document.getElementById('sueltoOrden').value) || 1,
    tipo_video: document.getElementById('sueltoTipo').value
  }, 'modalSuelto');
});
document.getElementById('formInstructor').addEventListener('submit', e => {
  e.preventDefault();
  save('instructores', document.getElementById('instructorId').value, {
    nombre: document.getElementById('instructorNombre').value.trim(),
    especialidad: document.getElementById('instructorEspecialidad').value.trim(),
    imagen: document.getElementById('instructorImagen').value.trim(),
    instagram: document.getElementById('instructorInstagram').value.trim(),
    bio: document.getElementById('instructorBio').value.trim(),
    orden: parseInt(document.getElementById('instructorOrden').value) || 0
  }, 'modalInstructor');
});
document.getElementById('formHero').addEventListener('submit', e => {
  e.preventDefault();
  save('hero_slides', document.getElementById('heroId').value, {
    titulo: document.getElementById('heroTitulo').value.trim(),
    subtitulo: document.getElementById('heroSubtitulo').value.trim(),
    badge: document.getElementById('heroBadge').value.trim(),
    descripcion: document.getElementById('heroDesc').value.trim(),
    tipo_medio: document.getElementById('heroTipo').value,
    imagen_url: document.getElementById('heroImagen').value.trim(),
    video_url: document.getElementById('heroVideo').value.trim(),
    boton_texto: document.getElementById('heroBotonTexto').value.trim(),
    boton_url: document.getElementById('heroBotonUrl').value.trim(),
    orden: parseInt(document.getElementById('heroOrden').value) || 1,
    activo: document.getElementById('heroActivo').value === 'true'
  }, 'modalHero');
});

// ================= BUSCADORES / ORDEN / INIT =================
[['qUsuarios', 'usuarios', renderUsers], ['qContenido', 'contenido', renderContenido], ['qSueltos', 'sueltos', renderSueltos], ['qInstructores', 'instructores', renderInstructores], ['qHero', 'hero', renderHeroSlides]]
  .forEach(([id, key, fn]) => document.getElementById(id).addEventListener('input', e => { q[key] = e.target.value; fn(); }));
[['sortUsuarios', 'usuarios', renderUsers], ['sortSueltos', 'sueltos', renderSueltos], ['sortInstructores', 'instructores', renderInstructores], ['sortHero', 'hero', renderHeroSlides]]
  .forEach(([id, key, fn]) => document.getElementById(id).addEventListener('change', e => { sort[key] = e.target.value; fn(); }));

document.getElementById('btnRefresh').addEventListener('click', () => { loadData(); notify('Datos recargados', 'info'); });
document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); }));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { const open = document.querySelectorAll('.modal.active'); if (open.length) closeModal(open[open.length - 1].id); }
});

loadData();