ALTER TABLE habitos ADD COLUMN IF NOT EXISTS frecuencia text NOT NULL DEFAULT 'diario' CHECK (frecuencia IN ('diario','semanal','mensual'));
ALTER TABLE habitos ADD COLUMN IF NOT EXISTS dia_semana smallint CHECK (dia_semana BETWEEN 0 AND 6);
ALTER TABLE habitos ADD COLUMN IF NOT EXISTS dia_mes smallint CHECK (dia_mes BETWEEN 1 AND 31);
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS alerta boolean NOT NULL DEFAULT false;
ALTER TABLE entrenamientos ADD COLUMN IF NOT EXISTS fecha_hasta date;
ALTER TABLE entrenamientos ADD COLUMN IF NOT EXISTS detalle text NOT NULL DEFAULT '';
