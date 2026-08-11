CREATE TABLE comidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  tipo text NOT NULL DEFAULT 'comida',
  alimentos jsonb NOT NULL DEFAULT '[]'::jsonb,
  calorias integer NOT NULL DEFAULT 0 CHECK (calorias >= 0),
  proteinas numeric(7,1) NOT NULL DEFAULT 0,
  carbohidratos numeric(7,1) NOT NULL DEFAULT 0,
  grasas numeric(7,1) NOT NULL DEFAULT 0,
  nota text NOT NULL DEFAULT '',
  creado timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comidas_usuario_fecha_idx ON comidas(usuario_id,fecha DESC);