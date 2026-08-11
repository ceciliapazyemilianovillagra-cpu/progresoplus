CREATE TABLE usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  nombre text NOT NULL,
  password_hash text NOT NULL,
  creado timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE configuracion_usuario (
  usuario_id uuid PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  recordatorios_activos boolean NOT NULL DEFAULT false,
  canal_recordatorio text NOT NULL DEFAULT 'ninguno' CHECK (canal_recordatorio IN ('ninguno','zapier','telegram','whatsapp')),
  webhook_url text,
  zona_horaria text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  actualizado timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tareas ADD COLUMN IF NOT EXISTS usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS vencimiento timestamptz;
ALTER TABLE pesos ADD COLUMN IF NOT EXISTS usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE;
ALTER TABLE entrenamientos ADD COLUMN IF NOT EXISTS usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE;
ALTER TABLE habitos ADD COLUMN IF NOT EXISTS usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE;
ALTER TABLE diario ADD COLUMN IF NOT EXISTS usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS tareas_usuario_fecha_idx ON tareas(usuario_id, fecha);
CREATE INDEX IF NOT EXISTS tareas_vencimiento_idx ON tareas(vencimiento) WHERE hecha = false;
CREATE INDEX IF NOT EXISTS pesos_usuario_fecha_idx ON pesos(usuario_id, fecha);
CREATE INDEX IF NOT EXISTS entrenamientos_usuario_fecha_idx ON entrenamientos(usuario_id, fecha);
CREATE INDEX IF NOT EXISTS habitos_usuario_idx ON habitos(usuario_id);
CREATE INDEX IF NOT EXISTS diario_usuario_fecha_idx ON diario(usuario_id, fecha);
