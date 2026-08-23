path = 'app/seleccion.tsx'
with open(path) as f:
    content = f.read()

old_jsx = """                  <Text style={styles.pistaZoom}>Toca 🔍 en cada foto para ampliarla antes de decidir</Text>"""
new_jsx = """                  <Text style={styles.pistaZoomExtras}>Toca 🔍 en cada foto para ampliarla antes de decidir</Text>"""

old_style = """  pistaZoom: {
    marginTop: -14,
    marginBottom: 20,
    color: COLORES.textoSecundario,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',"""

if old_jsx not in content:
    raise SystemExit("No se encontró el bloque JSX esperado - revisa el archivo manualmente.")
if old_style not in content:
    raise SystemExit("No se encontró el estilo pistaZoom esperado - revisa el archivo manualmente.")

content = content.replace(old_jsx, new_jsx, 1)

# Insertamos el nuevo estilo justo después del cierre de pistaZoom, duplicando
# sus propiedades pero con margen positivo en vez de negativo.
marker = old_style
idx = content.index(marker)
end_of_block = content.index("},", idx) + len("},")
nuevo_bloque = content[idx:end_of_block]
estilo_nuevo = nuevo_bloque.replace(
    "pistaZoom: {\n    marginTop: -14,",
    "pistaZoomExtras: {\n    marginTop: 4,"
)
content = content[:end_of_block] + "\n" + estilo_nuevo + content[end_of_block:]

with open(path, 'w') as f:
    f.write(content)

print("Cambio aplicado correctamente.")
