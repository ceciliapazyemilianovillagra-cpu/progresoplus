'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type RecordItem = { id: string; title?: string; content?: string; details?: string; status?: string; date?: string; dueDate?: string; category?: string };
type Section = 'inicio' | 'tareas' | 'tablero' | 'salud' | 'fe' | 'notas' | 'perfil';

const sections: { id: Section; label: string; icon: string; table?: string }[] = [
  { id: 'inicio', label: 'Inicio', icon: 'IN' },
  { id: 'tareas', label: 'Tareas', icon: 'TA', table: 'tasks' },
  { id: 'tablero', label: 'Tablero', icon: 'TB' },
  { id: 'salud', label: 'Salud', icon: 'SA', table: 'health' },
  { id: 'fe', label: 'Fe', icon: 'FE', table: 'faith' },
  { id: 'notas', label: 'Notas', icon: 'NO', table: 'notes' },
  { id: 'perfil', label: 'Perfil', icon: 'PE' }
];

const details: Record<Section, { title: string; description: string; empty: string }> = {
  inicio: { title: 'Tu espacio', description: 'Un lugar claro para organizar lo importante.', empty: '' },
  tareas: { title: 'Tareas', description: 'Todo lo que hay que hacer, en un solo lugar.', empty: 'Todavia no hay tareas.' },
  tablero: { title: 'Tablero', description: 'Una mirada rapida a la semana.', empty: '' },
  salud: { title: 'Salud', description: 'Consultas, controles y recordatorios de bienestar.', empty: 'No hay registros de salud todavia.' },
  fe: { title: 'Fe', description: 'Intenciones, reflexiones y momentos para agradecer.', empty: 'Todavia no hay registros.' },
  notas: { title: 'Notas', description: 'Ideas y recordatorios importantes.', empty: 'No hay notas todavia.' },
  perfil: { title: 'Perfil', description: 'Personaliza tu espacio.', empty: '' }
};

async function api(payload: object) {
  const response = await fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return response.json();
}

export default function Home() {
  const [section, setSection] = useState<Section>('inicio');
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const active = sections.find(item => item.id === section)!;
  const today = useMemo(() => new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()), []);

  useEffect(() => {
    if (!active.table) { setRecords([]); return; }
    setLoading(true); setMessage('');
    api({ action: 'list', table: active.table })
      .then(result => result.ok ? setRecords(result.data || []) : setMessage(result.error || 'No se pudieron cargar los datos.'))
      .catch(() => setMessage('No se pudo conectar con la planilla.'))
      .finally(() => setLoading(false));
  }, [active.table]);

  async function addRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active.table) return;
    const form = new FormData(event.currentTarget);
    const data = { title: String(form.get('title') || ''), details: String(form.get('details') || ''), content: String(form.get('details') || ''), status: active.table === 'tasks' ? 'pendiente' : '', date: String(form.get('date') || ''), dueDate: String(form.get('date') || '') };
    const result = await api({ action: 'create', table: active.table, data });
    if (result.ok) { setRecords(previous => [result.data, ...previous]); setShowForm(false); }
    else setMessage(result.error || 'No se pudo guardar.');
  }

  async function removeRecord(id: string) {
    if (!active.table) return;
    const result = await api({ action: 'delete', table: active.table, id });
    if (result.ok) setRecords(previous => previous.filter(item => item.id !== id));
    else setMessage(result.error || 'No se pudo eliminar.');
  }

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><span>P+</span> PROGRESO+</div>
      <p className="tagline">Tu espacio personal</p>
      <nav>{sections.map(item => <button key={item.id} className={section === item.id ? 'nav active' : 'nav'} onClick={() => { setSection(item.id); setShowForm(false); }}><span>{item.icon}</span>{item.label}</button>)}</nav>
      <div className="family-card"><span className="avatar">E</span><div><strong>Emiliano</strong><small>Mi espacio</small></div></div>
    </aside>
    <section className="content">
      <header><div><p className="date">{today}</p><h1>{section === 'inicio' ? 'Hola, Emiliano' : details[section].title}</h1><p>{details[section].description}</p></div>{active.table && <button className="primary" onClick={() => setShowForm(true)}>Agregar</button>}</header>
      {section === 'inicio' && <HomeOverview setSection={setSection} />}
      {section === 'tablero' && <Board />}
      {section === 'perfil' && <Profile />}
      {active.table && <>
        {showForm && <form className="entry-form" onSubmit={addRecord}><input name="title" required placeholder="TÃ­tulo" autoFocus /><input name="date" type="date" /><textarea name="details" placeholder="Detalle opcional" /><div><button type="button" className="secondary" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary">Guardar</button></div></form>}
        {message && <p className="notice">{message}</p>}
        {loading ? <p className="muted">Cargando...</p> : records.length === 0 ? <div className="empty"><span>P+</span><h2>{details[section].empty}</h2><p>Cuando agregues algo, aparecera aqui.</p></div> : <div className="records">{records.map(record => <article key={record.id} className="record"><div><h2>{record.title || 'Sin titulo'}</h2><p>{record.details || record.content}</p>{(record.date || record.dueDate) && <small>{record.date || record.dueDate}</small>}</div><button aria-label="Eliminar" onClick={() => removeRecord(record.id)}>x</button></article>)}</div>}
      </>}
    </section>
  </main>;
}

function HomeOverview({ setSection }: { setSection: (section: Section) => void }) {
  return <div className="dashboard">
    <div className="search"><span>Buscar en PROGRESO+</span><b>CTRL</b></div>
    <section className="spotlight"><small>ACTUALIZACION</small><p>Tu progreso crecio un <strong>40%</strong> esta semana.</p><button onClick={() => setSection('tablero')}>Ver tablero</button></section>
    <div className="stats"><article><small>Metas activas</small><strong>12</strong><em>+ 25% esta semana</em></article><article><small>Tareas listas</small><strong>82%</strong><em>+ 7% esta semana</em></article></div>
    <section className="progress-card"><div><h2>Progreso semanal</h2><p>Tu avance por area</p></div><div className="ring"><span>68<small>%</small></span></div></section>
    <section className="activity"><div className="section-title"><h2>Actividad reciente</h2><button onClick={() => setSection('notas')}>Ver todo</button></div><div className="activity-row"><span className="activity-icon">OK</span><div><strong>Revision de objetivos</strong><small>Hoy, 10:30</small></div><b>Completado</b></div><div className="activity-row"><span className="activity-icon orange">NT</span><div><strong>Nota personal</strong><small>Ayer, 18:40</small></div><b className="pending">Pendiente</b></div></section>
  </div>;
}
function Board() { return <div className="board"><article><span>TA</span><h2>Tareas</h2><p>Organiza tus pendientes.</p></article><article><span>SA</span><h2>Bienestar</h2><p>Tene a mano fechas importantes.</p></article><article><span>ME</span><h2>Momentos</h2><p>Guarda lo que queres recordar.</p></article></div>; }
function Profile() { return <div className="profile"><span className="big-avatar">E</span><h2>Emiliano</h2><p>Tu perfil esta listo. Proximamente podras personalizar mas detalles.</p></div>; }

