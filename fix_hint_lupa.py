path = 'app/seleccion.tsx'
with open(path) as f:
    content = f.read()

old_jsx = """                  <Text style={styles.previewEtiqueta}>¿Alguna más de esta ráfaga?</Text>
                  <Text style={styles.extrasSubtitulo}>
                    Elige las que quieras conservar además de la elegida.
                  </Text>

                  <View style={styles.extrasFilaMiniaturas}>"""

new_jsx = """                  <Text style={styles.previewEtiqueta}>¿Alguna más de esta ráfaga?</Text>
                  <Text style={styles.extrasSubtitulo}>
                    Elige las que quieras conservar además de la elegida.
                  </Text>
                  <Text style={styles.pistaZoom}>Toca 🔍 en cada foto para ampliarla antes de decidir</Text>

                  <View style={styles.extrasFilaMiniaturas}>"""

if old_jsx not in content:
    raise SystemExit("No se encontró el bloque JSX esperado - revisa el archivo manualmente.")

content = content.replace(old_jsx, new_jsx, 1)

with open(path, 'w') as f:
    f.write(content)

print("Cambio aplicado correctamente.")
