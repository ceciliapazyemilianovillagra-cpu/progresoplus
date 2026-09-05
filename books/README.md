# Libros para el módulo Motivación

Cada libro es un archivo `.json` en esta carpeta, con esta forma:

```json
{
  "titulo": "Nombre del libro",
  "autor": "Nombre del autor",
  "capitulos": [
    { "titulo": "Capítulo 1: ...", "texto": "Texto completo del capítulo acá..." },
    { "titulo": "Capítulo 2: ...", "texto": "Texto completo del capítulo acá..." }
  ]
}
```

- `titulo` y `autor` son opcionales pero recomendados (se muestran en la app).
- Cada entrada de `capitulos` es un fragmento independiente que se puede sortear al azar. No hace falta que sea un "capítulo" formal del libro — puede ser una página, una sección, lo que tenga sentido como lectura de una sentada.
- El nombre del archivo (ej. `el-monje-que-vendio-su-ferrari.json`) no importa, solo que termine en `.json`.

## Ejemplo

Ver `ejemplo.json` en esta misma carpeta.
