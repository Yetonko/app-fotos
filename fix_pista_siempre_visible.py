#!/usr/bin/env python3
import pathlib
import sys

ruta = pathlib.Path("app/seleccion.tsx")

if not ruta.exists():
    print(f"No se encuentra {ruta}. Ejecuta este script desde la raiz del repo.")
    sys.exit(1)

contenido = ruta.read_text(encoding="utf-8")
original = contenido

viejo = """        {comparacionActual === 1 && (
          <Text style={styles.pistaZoom}>Toca dos veces para elegir · toca una vez para ampliar</Text>
        )}"""

nuevo = """        <Text style={styles.pistaZoom}>Toca dos veces para elegir · toca una vez para ampliar</Text>"""

if nuevo in contenido:
    print("Ya estaba aplicado, no se duplica.")
elif viejo not in contenido:
    print("No se encontro el texto esperado. Abortando sin guardar cambios.")
    sys.exit(1)
else:
    contenido = contenido.replace(viejo, nuevo, 1)

if contenido == original:
    print("No se aplico ningun cambio (todo estaba ya hecho).")
else:
    ruta.write_text(contenido, encoding="utf-8")
    print("app/seleccion.tsx actualizado correctamente.")
