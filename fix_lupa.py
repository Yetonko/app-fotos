path = 'app/seleccion.tsx'
with open(path) as f:
    content = f.read()

old_jsx = """                        <Pressable key={foto.id} onPress={() => alternarExtra(foto.id)}>
                          <View
                            style={[
                              styles.miniaturaExtraContenedor,
                              seleccionada && styles.miniaturaExtraContenedorActiva,
                            ]}
                          >
                            <Image source={{ uri: foto.uri }} style={styles.miniaturaExtra} />
                            {seleccionada && (
                              <View style={styles.miniaturaExtraCheck}>
                                <Text style={styles.miniaturaExtraCheckTexto}>✓</Text>
                              </View>
                            )}
                          </View>
                        </Pressable>"""

new_jsx = """                        <Pressable key={foto.id} onPress={() => alternarExtra(foto.id)}>
                          <View
                            style={[
                              styles.miniaturaExtraContenedor,
                              seleccionada && styles.miniaturaExtraContenedorActiva,
                            ]}
                          >
                            <Image source={{ uri: foto.uri }} style={styles.miniaturaExtra} />
                            {seleccionada && (
                              <View style={styles.miniaturaExtraCheck}>
                                <Text style={styles.miniaturaExtraCheckTexto}>✓</Text>
                              </View>
                            )}
                            <Pressable
                              style={styles.miniaturaExtraLupa}
                              onPress={() => setFotoAmpliada(foto.uri)}
                              hitSlop={8}
                            >
                              <Text style={styles.miniaturaExtraLupaTexto}>🔍</Text>
                            </Pressable>
                          </View>
                        </Pressable>"""

old_style = """  miniaturaExtra: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },"""

new_style = """  miniaturaExtra: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  miniaturaExtraLupa: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniaturaExtraLupaTexto: {
    fontSize: 11,
  },"""

if old_jsx not in content:
    raise SystemExit("No se encontró el bloque JSX esperado - revisa el archivo manualmente.")
if old_style not in content:
    raise SystemExit("No se encontró el estilo miniaturaExtra esperado - revisa el archivo manualmente.")

content = content.replace(old_jsx, new_jsx, 1)
content = content.replace(old_style, new_style, 1)

with open(path, 'w') as f:
    f.write(content)

print("Cambio aplicado correctamente.")
