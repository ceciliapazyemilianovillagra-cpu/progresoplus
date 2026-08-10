'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type RecordItem = { id: string; title?: string; content?: string; details?: string; status?: string; date?: string; dueDate?: string; category?: string };
type Section = 'inicio' | 'tareas' | 'tablero' | 'salud' | 'fe' | 'notas' | 'perfil';

const sections: { id: Section; label: string; icon: string; table?: string }[] = [
  { id: 'inicio', label: 'Inicio', icon: 'âŒ‚' },
  { id: 'tareas', label: 'Tareas', icon: 'âœ“', table: 'tasks' },
  { id: 'tablero', label: 'Tablero', icon: 'â–¦' },
  { id: 'salud', label: 'Salud', icon: 'â™¥', table: 'health' },
  { id: 'fe', label: 'Fe', icon: 'âœ¦', table: 'faith' },
  { id: 'notas', label: 'Notas', icon: 'âœŽ', table: 'notes' },
  { id: 'perfil', label: 'Perfil', icon: 'â˜º' }
];

const details: Record<Section, { title: string; description: string; empty: string }> = {
  inicio: { title: 'Tu espacio familiar', description: 'Un lugar tranquilo para organizar lo importante.', empty: '' },
  tareas: { title: 'Tareas familiares', description: 'Lo que hay que hacer, en un solo lugar.', empty: 'TodavÃ­a no hay tareas.' },
  tablero: { title: 'Tablero familiar', description: 'Una mirada rÃ¡pida a la semana.', empty: '' },
  salud: { title: 'Salud', description: 'Consultas, controles y recordatorios de bienestar.', empty: 'No hay registros de salud todavÃ­a.' },
  fe: { title: 'Fe', description: 'Intenciones, reflexiones y momentos para agradecer.', empty: 'TodavÃ­a no hay registros.' },
  notas: { title: 'Notas', description: 'Ideas y recordatorios para la familia.', empty: 'No hay notas todavÃ­a.' },
  perfil: { title: 'Perfil familiar', description: 'PersonalizÃ¡ tu espacio familiar.', empty: '' }
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
      <div className="brand"><span>âœ¦</span> FamiliHub</div>
      <p className="tagline">Tu espacio familiar</p>
      <nav>{sections.map(item => <button key={item.id} className={section === item.id ? 'nav active' : 'nav'} onClick={() => { setSection(item.id); setShowForm(false); }}><span>{item.icon}</span>{item.label}</button>)}</nav>
      <div className="family-card"><span className="avatar">E</span><div><strong>Emiliano</strong><small>Familia</small></div></div>
    </aside>
    <section className="content">
      <header><div><p className="date">{today}</p><h1>{section === 'inicio' ? 'Hola, Emiliano ðŸ‘‹' : details[section].title}</h1><p>{details[section].description}</p></div>{active.table && <button className="primary" onClick={() => setShowForm(true)}>+ Agregar</button>}</header>
      {section === 'inicio' && <HomeOverview setSection={setSection} />}
      {section === 'tablero' && <Board />}
      {section === 'perfil' && <Profile />}
      {active.table && <>
        {showForm && <form className="entry-form" onSubmit={addRecord}><input name="title" required placeholder="TÃ­tulo" autoFocus /><input name="date" type="date" /><textarea name="details" placeholder="Detalle opcional" /><div><button type="button" className="secondary" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary">Guardar</button></div></form>}
        {message && <p className="notice">{message}</p>}
        {loading ? <p className="muted">Cargandoâ€¦</p> : records.length === 0 ? <div className="empty"><span>âœ¦</span><h2>{details[section].empty}</h2><p>Cuando agregues algo, aparecerÃ¡ acÃ¡.</p></div> : <div className="records">{records.map(record => <article key={record.id} className="record"><div><h2>{record.title || 'Sin tÃ­tulo'}</h2><p>{record.details || record.content}</p>{(record.date || record.dueDate) && <small>{record.date || record.dueDate}</small>}</div><button aria-label="Eliminar" onClick={() => removeRecord(record.id)}>Ã—</button></article>)}</div>}
      </>}
    </section>
  </main>;
}

function HomeOverview({ setSection }: { setSection: (section: Section) => void }) {
  return <div className="home-grid"><div className="welcome"><span>âœ¦</span><h2>Todo lo importante, mÃ¡s cerca</h2><p>OrganizÃ¡ tareas, notas y recordatorios sin perder de vista lo que une a tu familia.</p></div><div className="quick"><h2>Accesos rÃ¡pidos</h2>{sections.filter(item => ['tareas','salud','fe','notas'].includes(item.id)).map(item => <button key={item.id} onClick={() => setSection(item.id)}><span>{item.icon}</span>{item.label}<b>â€º</b></button>)}</div></div>;
}
function Board() { return <div className="board"><article><span>âœ“</span><h2>Tareas</h2><p>OrganizÃ¡ las pendientes de la familia.</p></article><article><span>â™¥</span><h2>Bienestar</h2><p>TenÃ© a mano las fechas importantes.</p></article><article><span>âœ¦</span><h2>Momentos</h2><p>GuardÃ¡ aquello que quieren recordar.</p></article></div>; }
function Profile() { return <div className="profile"><span className="big-avatar">E</span><h2>Emiliano</h2><p>Tu perfil familiar estÃ¡ listo. PrÃ³ximamente podrÃ¡s invitar a mÃ¡s integrantes.</p></div>; }

