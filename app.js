// CONFIGURACIÓN
const SUPABASE_URL = 'https://lhtfrzhwzphryjhgcqjw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxodGZyemh3enBocnlqaGdjcWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzOTU3NDksImV4cCI6MjA4Njk3MTc0OX0.1HSklzboeOSAnCip3V39LcYZIJWLMZzgWuCvy7qBl2I';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// VARIABLES GLOBALES
let users = [], categorias = [], niveles = [], clases = [], sueltos = [], access = [];
let currentUserAccessing = null;
let pendingAccess = {};

// INICIALIZACIÓN
loadData();

// NAVEGACIÓN
function showTab(name) {
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${name}`).style.display = 'block';
    event.target.classList.add('active');
    if (name === 'contenido') renderContenido();
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function showMsg(id, text, type) {
    const el = document.getElementById(id);
    el.textContent = text;
    el.className = `message ${type}`;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 3000);
}

// CARGAR DATOS (Actualizado para ordenar categorías por 'orden')
async function loadData() {
    try {
        const [u, cat, n, c, s, a] = await Promise.all([
            db.from('users').select('*').order('created_at', { ascending: false }),
            db.from('categorias').select('*').order('orden', { ascending: true }), // ✅ ORDENADO POR 'orden'
            db.from('niveles').select('*').order('orden'),
            db.from('clases').select('*').order('orden'),
            db.from('videos_sueltos').select('*').order('orden'),
            db.from('user_access').select('*')
        ]);
        
        users = u.data || [];
        categorias = cat.data || [];
        niveles = n.data || [];
        clases = c.data || [];
        sueltos = s.data || [];
        access = a.data || [];

        document.getElementById('statUsers').textContent = users.length;
        document.getElementById('statCategorias').textContent = categorias.length;
        document.getElementById('statClases').textContent = clases.length;
        document.getElementById('statSueltos').textContent = sueltos.length;

        renderUsers();
        renderSueltos();
        
        const tabContenido = document.getElementById('tab-contenido');
        if (tabContenido && tabContenido.style.display !== 'none') {
            renderContenido();
        }
    } catch (err) { 
        console.error('Error cargando datos:', err); 
    }
}

// ========== USUARIOS ==========
function renderUsers() {
    document.getElementById('usersTable').innerHTML = users.map(u => {
        const count = access.filter(a => a.user_id === u.id).length;
        return `<tr>
            <td><strong style="color:#f59e0b">${u.access_code||'-'}</strong></td>
            <td>${u.name||'-'}</td>
            <td>${u.phone||'-'}</td>
            <td><span style="color:${count>0?'#10b981':'#999'}">${count} nivel${count!==1?'es':''}</span></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="manageAccess('${u.id}')">🔑 Accesos</button>
                <button class="btn btn-sm btn-warning" onclick="editUser('${u.id}')">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="del('users','${u.id}')">🗑️</button>
            </td>
        </tr>`;
    }).join('');
}

function editUser(id) {
    const u = users.find(x => x.id === id);
    if (!u) return;
    document.getElementById('editUserId').value = u.id;
    document.getElementById('editUserCode').value = u.access_code || '-';
    document.getElementById('editUserName').value = u.name || '';
    document.getElementById('editUserPhone').value = u.phone || '';
    openModal('modalEditUser');
}

document.getElementById('formEditUser').addEventListener('submit', async e => {
    e.preventDefault();
    const { error } = await db.from('users').update({ 
        name: document.getElementById('editUserName').value,
        phone: document.getElementById('editUserPhone').value
    }).eq('id', document.getElementById('editUserId').value);
    if (error) alert('Error: ' + error.message);
    else { closeModal('modalEditUser'); loadData(); }
});

document.getElementById('newUserForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('newUserName').value.trim();
    const phone = document.getElementById('newUserPhone').value.trim();
    if (!name || !phone) return;

    let code, exists = true;
    while (exists) {
        code = 'SM' + Math.floor(10000 + Math.random() * 90000);
        const {data} = await db.from('users').select('id').eq('access_code', code).single();
        if (!data) exists = false;
    }

    const {error} = await db.from('users').insert([{name, phone, access_code: code}]);
    if (error) showMsg('newUserMsg', error.message, 'error');
    else {
        showMsg('newUserMsg', `✅ Código: ${code}`, 'success');
        document.getElementById('newUserForm').reset();
        loadData();
    }
});

// ========== CONTENIDO JERÁRQUICO ==========
function renderContenido() {
    let html = '';
    
    categorias.forEach(cat => {
        const nivelesCat = niveles.filter(n => n.categoria_id === cat.id);
        const totalClases = nivelesCat.reduce((sum, n) => sum + clases.filter(c => c.nivel_id === n.id).length, 0);
        
        html += `<div class="categoria-block">
            <div class="categoria-header" onclick="toggleCat('cat-${cat.id}')">
                <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                    <h3>🎯 ${cat.nombre}</h3>
                    <button class="btn btn-sm btn-warning" onclick="event.stopPropagation(); editCategoria('${cat.id}')" title="Editar">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); delCategoria('${cat.id}')" title="Eliminar">🗑️</button>
                </div>
                <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                    <span style="color:white;">${nivelesCat.length} niveles • ${totalClases} clases</span>
                    <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); openModalNivel('${cat.id}')" title="Agregar Nivel">+ Nivel</button>
                </div>
            </div>
            <div class="categoria-body" id="cat-${cat.id}" style="display:none;">`;
        
        nivelesCat.forEach(nivel => {
            const nivelClases = clases.filter(c => c.nivel_id === nivel.id).sort((a,b) => (a.orden||1) - (b.orden||1));
            
            html += `<div class="nivel-item">
                <div class="nivel-header" onclick="toggleNivel('nivel-${nivel.id}')">
                    <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                        <h4>📊 ${nivel.nombre}</h4>
                        <button class="btn btn-sm btn-warning" onclick="event.stopPropagation(); editNivel('${nivel.id}')" title="Editar">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); delNivel('${nivel.id}')" title="Eliminar">🗑️</button>
                    </div>
                    <span>${nivelClases.length} videos</span>
                </div>
                <div class="nivel-body" id="nivel-${nivel.id}" style="display:none;">
                    ${nivelClases.length ? nivelClases.map(v => `
                        <div class="video-item">
                            <div class="video-item-info">
                                <strong>${v.titulo||'Sin título'}</strong>
                                <small>${v.video_url?.substring(0,60)||'-'}...</small>
                            </div>
                            <div class="video-item-actions">
                                <button class="btn btn-sm btn-warning" onclick="editVideo('${v.id}')">✏️</button>
                                <button class="btn btn-sm btn-danger" onclick="delVideo('${v.id}')">🗑️</button>
                            </div>
                        </div>
                    `).join('') : '<p style="color:#999;text-align:center;padding:1rem;">Sin videos en este nivel</p>'}
                    <button class="add-video-btn" onclick="addVideo('${nivel.id}')">+ Agregar Video a este nivel</button>
                </div>
            </div>`;
        });
        html += `</div></div>`;
    });

    document.getElementById('contenidoJerarquico').innerHTML = html || '<p style="color:#999;text-align:center;padding:2rem;">No hay categorías. Clic en "+ Nueva Categoría" para comenzar.</p>';
}

function toggleCat(id) {
    const el = document.getElementById(id);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}
function toggleNivel(id) {
    const el = document.getElementById(id);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// ========== CATEGORÍAS (CORREGIDO) ==========
function openModalCategoria() {
    document.getElementById('categoriaModalTitle').textContent = 'Nueva Categoría';
    document.getElementById('categoriaId').value = '';
    document.getElementById('categoriaNombre').value = '';
    document.getElementById('categoriaDesc').value = '';
    document.getElementById('categoriaThumbnail').value = '';
    document.getElementById('categoriaOrden').value = '0'; // ✅ Agregado
    openModal('modalCategoria');
}

function editCategoria(id) {
    const cat = categorias.find(c => c.id === id);
    if (!cat) return;
    document.getElementById('categoriaModalTitle').textContent = 'Editar Categoría';
    document.getElementById('categoriaId').value = cat.id;
    document.getElementById('categoriaNombre').value = cat.nombre || '';
    document.getElementById('categoriaDesc').value = cat.descripcion || '';
    document.getElementById('categoriaThumbnail').value = cat.thumbnail_url || '';
    document.getElementById('categoriaOrden').value = cat.orden || 0; // ✅ Agregado
    openModal('modalCategoria');
}

document.getElementById('formCategoria').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('categoriaId').value;
    
    // ✅ AQUÍ ESTABA EL ERROR: Faltaban thumbnail_url y orden en el objeto data
    const data = {
        nombre: document.getElementById('categoriaNombre').value.trim(),
        descripcion: document.getElementById('categoriaDesc').value.trim(),
        thumbnail_url: document.getElementById('categoriaThumbnail').value.trim(),
        orden: parseInt(document.getElementById('categoriaOrden').value) || 0
    };
    
    let error;
    if (id) {
        const r = await db.from('categorias').update(data).eq('id', id);
        error = r.error;
    } else {
        const r = await db.from('categorias').insert([data]);
        error = r.error;
    }
    
    if (error) alert('Error: ' + error.message);
    else { closeModal('modalCategoria'); loadData(); }
});

async function delCategoria(id) {
    if (!confirm('¿Eliminar esta categoría? Se eliminarán también todos sus niveles y clases.')) return;
    const { error } = await db.from('categorias').delete().eq('id', id);
    if (error) alert('Error: ' + error.message);
    else loadData();
}

// ========== NIVELES ==========
function openModalNivel(categoriaId) {
    document.getElementById('nivelModalTitle').textContent = 'Nuevo Nivel';
    document.getElementById('nivelId').value = '';
    document.getElementById('nivelCategoriaId').value = categoriaId;
    document.getElementById('nivelNombre').value = '';
    document.getElementById('nivelDesc').value = '';
    document.getElementById('nivelOrden').value = '1';
    openModal('modalNivel');
}

function editNivel(id) {
    const nivel = niveles.find(n => n.id === id);
    if (!nivel) return;
    document.getElementById('nivelModalTitle').textContent = 'Editar Nivel';
    document.getElementById('nivelId').value = nivel.id;
    document.getElementById('nivelCategoriaId').value = nivel.categoria_id || '';
    document.getElementById('nivelNombre').value = nivel.nombre || '';
    document.getElementById('nivelDesc').value = nivel.descripcion || '';
    document.getElementById('nivelOrden').value = nivel.orden || 1;
    openModal('modalNivel');
}

document.getElementById('formNivel').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('nivelId').value;
    const data = {
        nombre: document.getElementById('nivelNombre').value.trim(),
        descripcion: document.getElementById('nivelDesc').value.trim(),
        categoria_id: document.getElementById('nivelCategoriaId').value,
        orden: parseInt(document.getElementById('nivelOrden').value) || 1
    };
    
    let error;
    if (id) {
        const r = await db.from('niveles').update(data).eq('id', id);
        error = r.error;
    } else {
        const r = await db.from('niveles').insert([data]);
        error = r.error;
    }
    
    if (error) alert('Error: ' + error.message);
    else { closeModal('modalNivel'); loadData(); }
});

async function delNivel(id) {
    if (!confirm('¿Eliminar este nivel? Se eliminarán también todas sus clases.')) return;
    const { error } = await db.from('niveles').delete().eq('id', id);
    if (error) alert('Error: ' + error.message);
    else loadData();
}

// ========== VIDEOS POR NIVEL ==========
function addVideo(nivelId) {
    document.getElementById('videoModalTitle').textContent = 'Agregar Video';
    document.getElementById('videoId').value = '';
    document.getElementById('videoNivelId').value = nivelId;
    document.getElementById('videoTitulo').value = '';
    document.getElementById('videoDesc').value = '';
    document.getElementById('videoUrl').value = '';
    document.getElementById('videoThumb').value = '';
    document.getElementById('videoOrden').value = '1';
    openModal('modalVideo');
}

function editVideo(id) {
    const v = clases.find(x => x.id === id);
    if (!v) return;
    document.getElementById('videoModalTitle').textContent = 'Editar Video';
    document.getElementById('videoId').value = v.id;
    document.getElementById('videoNivelId').value = v.nivel_id || '';
    document.getElementById('videoTitulo').value = v.titulo || '';
    document.getElementById('videoDesc').value = v.descripcion || '';
    document.getElementById('videoUrl').value = v.video_url || '';
    document.getElementById('videoThumb').value = v.thumbnail_url || '';
    document.getElementById('videoOrden').value = v.orden || 1;
    openModal('modalVideo');
}

document.getElementById('formVideo').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('videoId').value;
    const data = {
        titulo: document.getElementById('videoTitulo').value,
        descripcion: document.getElementById('videoDesc').value,
        video_url: document.getElementById('videoUrl').value,
        thumbnail_url: document.getElementById('videoThumb').value,
        nivel_id: document.getElementById('videoNivelId').value,
        orden: parseInt(document.getElementById('videoOrden').value) || 1
    };
    
    let error;
    if (id) {
        const r = await db.from('clases').update(data).eq('id', id);
        error = r.error;
    } else {
        const r = await db.from('clases').insert([data]);
        error = r.error;
    }
    
    if (error) alert('Error: ' + error.message);
    else { closeModal('modalVideo'); loadData(); }
});

async function delVideo(id) {
    if (!confirm('¿Eliminar?')) return;
    const { error } = await db.from('clases').delete().eq('id', id);
    if (error) alert('Error: ' + error.message);
    else loadData();
}

// ========== VIDEOS SUELTOS ==========
function renderSueltos() {
    document.getElementById('sueltosTable').innerHTML = sueltos.map(s => `
        <tr>
            <td>${s.titulo||'-'}</td>
            <td>${s.video_url?.substring(0,40)||'-'}...</td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="editSuelto('${s.id}')">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="del('videos_sueltos','${s.id}')">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function openModalSuelto() {
    document.getElementById('sueltoModalTitle').textContent = 'Nuevo Video Suelto';
    document.getElementById('sueltoId').value = '';
    document.getElementById('sueltoTitulo').value = '';
    document.getElementById('sueltoDesc').value = '';
    document.getElementById('sueltoVideo').value = '';
    document.getElementById('sueltoThumb').value = '';
    document.getElementById('sueltoOrden').value = '1';
    
    // Llenar el select de categorías
    const selectCat = document.getElementById('sueltoCategoria');
    selectCat.innerHTML = '<option value="">-- Selecciona un estilo --</option>';
    categorias.forEach(cat => {
        selectCat.innerHTML += `<option value="${cat.id}">${cat.nombre}</option>`;
    });
    
    openModal('modalSuelto');
}

function editSuelto(id) {
    const s = sueltos.find(x => x.id === id);
    if (!s) return;
    document.getElementById('sueltoModalTitle').textContent = 'Editar Video Suelto';
    document.getElementById('sueltoId').value = s.id;
    document.getElementById('sueltoTitulo').value = s.titulo || '';
    document.getElementById('sueltoDesc').value = s.descripcion || '';
    document.getElementById('sueltoVideo').value = s.video_url || '';
    document.getElementById('sueltoThumb').value = s.thumbnail_url || '';
    document.getElementById('sueltoOrden').value = s.orden || 1;
    
    // Llenar y seleccionar la categoría
    const selectCat = document.getElementById('sueltoCategoria');
    selectCat.innerHTML = '<option value="">-- Selecciona un estilo --</option>';
    categorias.forEach(cat => {
        selectCat.innerHTML += `<option value="${cat.id}">${cat.nombre}</option>`;
    });
    selectCat.value = s.categoria_id || '';
    
    openModal('modalSuelto');
}

document.getElementById('formSuelto').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('sueltoId').value;
    const data = {
        titulo: document.getElementById('sueltoTitulo').value,
        descripcion: document.getElementById('sueltoDesc').value,
        video_url: document.getElementById('sueltoVideo').value,
        thumbnail_url: document.getElementById('sueltoThumb').value,
        categoria_id: document.getElementById('sueltoCategoria').value || null, // ✅ NUEVO
        orden: parseInt(document.getElementById('sueltoOrden').value) || 1
    };
    
    let error;
    if (id) {
        const r = await db.from('videos_sueltos').update(data).eq('id', id);
        error = r.error;
    } else {
        const r = await db.from('videos_sueltos').insert([data]);
        error = r.error;
    }
    
    if (error) alert('Error: ' + error.message);
    else { closeModal('modalSuelto'); document.getElementById('formSuelto').reset(); loadData(); }
});

// ========== ACCESOS ==========
async function manageAccess(uid) {
    await loadData();
    
    const u = users.find(x => x.id === uid);
    if (!u) return;
    
    currentUserAccessing = uid;
    pendingAccess = {};
    
    document.getElementById('accesosTitle').textContent = `Accesos: ${u.name}`;
    document.getElementById('accesosInfo').innerHTML = `
        <div style="background: linear-gradient(135deg, #f59e0b22, #dc262622); border: 2px solid #f59e0b; border-radius: 12px; padding: 1.2rem; margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 200px;">
                    <div style="margin-bottom: 0.5rem;">
                        <span style="color: #999; font-size: 0.85rem;">👤 USUARIO</span>
                        <div style="color: white; font-size: 1.3rem; font-weight: bold;">${u.name}</div>
                    </div>
                    <div>
                        <span style="color: #999; font-size: 0.85rem;">📱 TELÉFONO</span>
                        <div style="color: white; font-size: 1rem;">${u.phone || '-'}</div>
                    </div>
                </div>
                <div style="background: #000; border: 2px dashed #f59e0b; border-radius: 8px; padding: 1rem 1.5rem; text-align: center;">
                    <div style="color: #999; font-size: 0.75rem; letter-spacing: 0.1em;">CÓDIGO DE ACCESO</div>
                    <div style="color: #f59e0b; font-size: 1.8rem; font-weight: bold; font-family: monospace; letter-spacing: 0.15em;">${u.access_code}</div>
                </div>
            </div>
        </div>
        <p style="color:#f59e0b; font-size: 0.9rem;">⬇️ Marca los niveles a los que tendrá acceso este usuario</p>
    `;
    
    const userAccess = access.filter(a => a.user_id === uid).map(a => a.nivel_id);
    
    let html = '';
    let totalAsignados = 0;
    
    categorias.forEach(cat => {
        const nivelesCat = niveles.filter(n => n.categoria_id === cat.id);
        if (nivelesCat.length === 0) return;

        html += `<div class="categoria-acceso">
            <h4>🎯 ${cat.nombre}</h4>
            <div class="niveles-grid">`;
        
        nivelesCat.forEach(nivel => {
            const hasAccess = userAccess.includes(nivel.id);
            if (hasAccess) totalAsignados++;
            const count = clases.filter(c => c.nivel_id === nivel.id).length;
            
            html += `<div class="nivel-checkbox">
                <input type="checkbox" id="access-${nivel.id}" ${hasAccess?'checked':''} 
                       onchange="togglePendingAccess('${nivel.id}', this.checked)">
                <label for="access-${nivel.id}">
                    <strong>${nivel.nombre}</strong>
                    <span class="count">${count} video${count !== 1 ? 's' : ''}</span>
                </label>
            </div>`;
        });
        
        html += `</div></div>`;
    });
    
    const resumen = `<div style="background: #2a2a2a; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
        <div>
            <span style="color: #999; font-size: 0.85rem;">NIVELES ASIGNADOS:</span>
            <span style="color: #10b981; font-weight: bold; font-size: 1.2rem; margin-left: 0.5rem;">${totalAsignados}</span>
        </div>
        <div style="color: #999; font-size: 0.85rem;">
            Total disponibles: ${niveles.length}
        </div>
    </div>`;
    
    document.getElementById('accesosPorCategoria').innerHTML = resumen + html || '<p style="color:#999">No hay niveles disponibles</p>';
    openModal('modalAccesos');
}

function togglePendingAccess(nivelId, checked) {
    pendingAccess[nivelId] = checked;
}

async function saveAllAccess() {
    if (!currentUserAccessing) return;
    
    const userAccess = access.filter(a => a.user_id === currentUserAccessing).map(a => a.nivel_id);
    
    const toAdd = [];
    const toRemove = [];
    
    Object.keys(pendingAccess).forEach(nivelId => {
        if (pendingAccess[nivelId] && !userAccess.includes(nivelId)) {
            toAdd.push(nivelId);
        } else if (!pendingAccess[nivelId] && userAccess.includes(nivelId)) {
            toRemove.push(nivelId);
        }
    });
    
    let error = null;
    if (toAdd.length > 0) {
        const inserts = toAdd.map(nivelId => ({ user_id: currentUserAccessing, nivel_id: nivelId }));
        const r = await db.from('user_access').insert(inserts);
        if (r.error) error = r.error;
    }
    
    if (toRemove.length > 0 && !error) {
        for (const nivelId of toRemove) {
            const r = await db.from('user_access').delete().eq('user_id', currentUserAccessing).eq('nivel_id', nivelId);
            if (r.error) { error = r.error; break; }
        }
    }
    
    if (error) {
        alert('Error al guardar: ' + error.message);
    } else {
        alert(`✅ Accesos actualizados\nAgregados: ${toAdd.length}\nRemovidos: ${toRemove.length}`);
        closeModal('modalAccesos');
        loadData();
    }
}

// ========== ELIMINAR GENÉRICO ==========
async function del(table, id) {
    if (!confirm('¿Eliminar?')) return;
    const { error } = await db.from(table).delete().eq('id', id);
    if (error) alert('Error: ' + error.message);
    else loadData();
}

// CERRAR MODALES AL CLIC FUERA
document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => {
    if (e.target === m) m.classList.remove('active');
}));