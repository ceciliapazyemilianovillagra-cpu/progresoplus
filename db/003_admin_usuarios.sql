ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS usuario text;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol text NOT NULL DEFAULT 'user' CHECK (rol IN ('admin','user'));
UPDATE usuarios SET usuario=lower(split_part(email,'@',1)) WHERE usuario IS NULL;
ALTER TABLE usuarios ALTER COLUMN usuario SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_usuario_unique_idx ON usuarios (lower(usuario));
CREATE INDEX IF NOT EXISTS usuarios_rol_idx ON usuarios(rol);