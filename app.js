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

// FUNCIONES DE NAVEGACIÓN
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

// CARGAR DATOS
async function loadData() {
    try {
        const [u, cat, n, c, s, a] = await Promise.all([
            db.from('users').select('*').order('created_at', { ascending: false }),
            db.from('categorias').select('*').order('nombre'),
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
    } catch (err) { console.error('Error:', err); }
}

// RENDER USUARIOS
function renderUsers() {
    document.getElementById('usersTable').innerHTML = users.map(u => {
        const count = access.filter(a => a.user_id === u.id).length;
        return `<tr>
            <td><strong style="color:#f59e0b">${u.access_code||'-'}</strong></td>
            <td>${u.name||'-'}</td>
            <td>${u.phone||'-'}</td>
            <td><span style="color:${count>0?'#10b981':'#999'}">${count} nivel${count!==1?'es':''}</span></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="manageAccess('${u.id}')"> Accesos</button>
                <button class="btn btn-sm btn-warning" onclick="editUser('${u.id}')">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="del('users','${u.id}')">🗑️</button>
            </td>
        </tr>`;
    }).join('');
}

// RENDER CONTENIDO JERÁRQUICO
function renderContenido() {
    let html = '';
    
    categorias.forEach(cat => {
        const nivelesCat = niveles.filter(n => n.categoria_id === cat.id);
        if (nivelesCat.length === 0) return; // Saltar categorías vacías

        const totalClases = nivelesCat.reduce((sum, n) => sum + clases.filter(c => c.nivel_id === n.id).length, 0);
        
        html += `<div class="categoria-block">
            <div class="categoria-header" onclick="toggleCat('cat-${cat.id}')">
                <h3>🎯 ${cat.nombre}</h3>
                <span>${nivelesCat.length} niveles • ${totalClases} clases</span>
            </div>
            <div class="categoria-body" id="cat-${cat.id}" style="display:none;">`;
        
        nivelesCat.forEach(nivel => {
            const nivelClases = clases.filter(c => c.nivel_id === nivel.id).sort((a,b) => (a.orden||1) - (b.orden||1));
            
            html += `<div class="nivel-item">
                <div class="nivel-header" onclick="toggleNivel('nivel-${nivel.id}')">
                    <h4>📊 ${nivel.nombre}</h4>
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
                                <button class="btn btn-sm btn-danger" onclick="delVideo('${v.id}')">️</button>
                            </div>
                        </div>
                    `).join('') : '<p style="color:#999;text-align:center;">Sin videos</p>'}
                    <button class="add-video-btn" onclick="addVideo('${nivel.id}')">+ Agregar Video</button>
                </div>
            </div>`;
        });
        html += `</div></div>`;
    });

    document.getElementById('contenidoJerarquico').innerHTML = html || '<p style="color:#999;text-align:center;">Sin contenido</p>';
}

function toggleCat(id) {
    const el = document.getElementById(id);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}
function toggleNivel(id) {
    const el = document.getElementById(id);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// RENDER SUELTOS
function renderSueltos() {
    document.getElementById('sueltosTable').innerHTML = sueltos.map(s => `
        <tr>
            <td>${s.titulo||'-'}</td>
            <td>${s.video_url?.substring(0,40)||'-'}...</td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="editSuelto('${s.id}')">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="del('videos_sueltos','${s.id}')">️</button>
            </td>
        </tr>
    `).join('');
}

// EDITAR USUARIO
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

// GESTIÓN DE VIDEOS POR NIVEL
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

// VIDEOS SUELTOS
function editSuelto(id) {
    const s = sueltos.find(x => x.id === id);
    if (!s) return;
    document.getElementById('sueltoId').value = s.id;
    document.getElementById('sueltoTitulo').value = s.titulo || '';
    document.getElementById('sueltoDesc').value = s.descripcion || '';
    document.getElementById('sueltoVideo').value = s.video_url || '';
    document.getElementById('sueltoThumb').value = s.thumbnail_url || '';
    document.getElementById('sueltoOrden').value = s.orden || 1;
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

// NUEVO USUARIO
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

// GESTIÓN DE ACCESOS
async function manageAccess(uid) {
    const u = users.find(x => x.id === uid);
    if (!u) return;
    currentUserAccessing = uid;
    pendingAccess = {};
    
    document.getElementById('accesosTitle').textContent = `Accesos: ${u.name}`;
    document.getElementById('accesosInfo').innerHTML = `
        <p><strong>Código:</strong> ${u.access_code}</p>
        <p style="color:#f59e0b;margin-top:0.5rem">Marca los niveles y luego clic en "Guardar"</p>
    `;
    
    const userAccess = access.filter(a => a.user_id === uid).map(a => a.nivel_id);
    
    let html = '';
    categorias.forEach(cat => {
        const nivelesCat = niveles.filter(n => n.categoria_id === cat.id);
        if (nivelesCat.length === 0) return;

        html += `<div class="categoria-acceso">
            <h4>🎯 ${cat.nombre}</h4>
            <div class="niveles-grid">`;
        
        nivelesCat.forEach(nivel => {
            const hasAccess = userAccess.includes(nivel.id);
            const count = clases.filter(c => c.nivel_id === nivel.id).length;
            
            html += `<div class="nivel-checkbox">
                <input type="checkbox" id="access-${nivel.id}" ${hasAccess?'checked':''} 
                       onchange="togglePendingAccess('${nivel.id}', this.checked)">
                <label for="access-${nivel.id}">
                    <strong>${nivel.nombre}</strong>
                    <span class="count">${count} videos</span>
                </label>
            </div>`;
        });
        
        html += `</div></div>`;
    });
    
    document.getElementById('accesosPorCategoria').innerHTML = html || '<p style="color:#999">Sin niveles disponibles</p>';
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

// ELIMINAR
async function del(table, id) {
    if (!confirm('¿Eliminar?')) return;
    const { error } = await db.from(table).delete().eq('id', id);
    if (error) alert('Error: ' + error.message);
    else loadData();
}

// CERRAR MODALES
document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => {
    if (e.target === m) m.classList.remove('active');
}));