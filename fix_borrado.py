path = 'app/seleccion.tsx'
with open(path) as f:
    content = f.read()

old_jsx = """          <View style={styles.accionesContenedor}>
            {resto.length > 0 && (
              <Text style={styles.contadorEspacio}>
                {tamanoALiberar === null
                  ? 'Calculando espacio a liberar...'
                  : tamanoALiberar > 0
                  ? `🗑 Vas a liberar ${formatearTamano(tamanoALiberar)}`
                  : 'No vas a liberar espacio (te quedas con todas)'}
              </Text>
            )}

            <BouncyPressable style={styles.botonAccion} onPress={compartir}>
              <Text style={styles.textoBotonAccion}>Compartir / Publicar</Text>
            </BouncyPressable>

            <BouncyPressable
              style={styles.botonAccionSecundaria}
              onPress={retocar}
              disabled={mejorando}
            >
              <Text style={styles.textoBotonAccionSecundaria}>
                {mejorando ? 'Mejorando la luz y el contraste...' : 'Dar un toque de brillo ✨'}
              </Text>
            </BouncyPressable>
            {mejorando && (
              <Text style={styles.notaMejora}>Estamos preparando una versión mejorada.</Text>
            )}

            {resto.length > 0 && (
              <BouncyPressable
                style={styles.botonPeligro}
                onPress={borrarResto}
                disabled={borrando}
              >
                <Text style={styles.textoBotonPeligro}>
                  {borrando ? 'Eliminando fotos...' : `Borrar las demás (${resto.length})`}
                </Text>
              </BouncyPressable>
            )}
          </View>

          {resto.length >= 2 && (
            <View style={styles.extrasContenedor}>
              <Text style={styles.previewEtiqueta}>¿Alguna más de esta ráfaga?</Text>
              <Text style={styles.extrasSubtitulo}>
                Elige las que quieras conservar además de la elegida.
              </Text>

              <View style={styles.extrasFilaMiniaturas}>
                {resto.map((foto) => {
                  const seleccionada = extrasSeleccionadas.includes(foto.id);
                  return (
                    <Pressable key={foto.id} onPress={() => alternarExtra(foto.id)}>
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
                    </Pressable>
                  );
                })}
              </View>

              {extrasSeleccionadas.length > 0 && (
                <BouncyPressable
                  style={styles.botonGuardarExtras}
                  onPress={guardarExtrasYBorrarResto}
                  disabled={borrando}
                >
                  <Text style={styles.textoBotonAccion}>
                    {borrando
                      ? 'Eliminando fotos...'
                      : `Guardar ${extrasSeleccionadas.length} más y borrar el resto`}
                  </Text>
                </BouncyPressable>
              )}
            </View>
          )}"""

new_jsx = """          <View style={styles.accionesContenedor}>
            <BouncyPressable style={styles.botonAccion} onPress={compartir}>
              <Text style={styles.textoBotonAccion}>Compartir / Publicar</Text>
            </BouncyPressable>

            <BouncyPressable
              style={styles.botonAccionSecundaria}
              onPress={retocar}
              disabled={mejorando}
            >
              <Text style={styles.textoBotonAccionSecundaria}>
                {mejorando ? 'Mejorando la luz y el contraste...' : 'Dar un toque de brillo ✨'}
              </Text>
            </BouncyPressable>
            {mejorando && (
              <Text style={styles.notaMejora}>Estamos preparando una versión mejorada.</Text>
            )}
          </View>

          {resto.length > 0 && (
            <View style={styles.extrasContenedor}>
              <Text style={styles.contadorEspacio}>
                {tamanoALiberar === null
                  ? 'Calculando espacio a liberar...'
                  : tamanoALiberar > 0
                  ? `🗑 Vas a liberar ${formatearTamano(tamanoALiberar)}`
                  : 'No vas a liberar espacio (te quedas con todas)'}
              </Text>

              {resto.length >= 2 && (
                <>
                  <Text style={styles.previewEtiqueta}>¿Alguna más de esta ráfaga?</Text>
                  <Text style={styles.extrasSubtitulo}>
                    Elige las que quieras conservar además de la elegida.
                  </Text>

                  <View style={styles.extrasFilaMiniaturas}>
                    {resto.map((foto) => {
                      const seleccionada = extrasSeleccionadas.includes(foto.id);
                      return (
                        <Pressable key={foto.id} onPress={() => alternarExtra(foto.id)}>
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
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              {extrasSeleccionadas.length > 0 && (
                <BouncyPressable
                  style={styles.botonGuardarExtras}
                  onPress={guardarExtrasYBorrarResto}
                  disabled={borrando}
                >
                  <Text style={styles.textoBotonAccion}>
                    {borrando
                      ? 'Eliminando fotos...'
                      : `Guardar ${extrasSeleccionadas.length} más y borrar el resto`}
                  </Text>
                </BouncyPressable>
              )}

              <BouncyPressable
                style={styles.botonPeligro}
                onPress={borrarResto}
                disabled={borrando}
              >
                <Text style={styles.textoBotonPeligro}>
                  {borrando ? 'Eliminando fotos...' : `Borrar las demás (${resto.length})`}
                </Text>
              </BouncyPressable>
            </View>
          )}"""

old_style = """  contadorEspacio: {
    textAlign: 'center',
    color: COLORES.acentoOscuro,
    fontSize: 14,
    fontWeight: '600',
  },"""

new_style = """  contadorEspacio: {
    textAlign: 'center',
    color: COLORES.acentoOscuro,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },"""

if old_jsx not in content:
    raise SystemExit("No se encontró el bloque JSX esperado - revisa el archivo manualmente.")
if old_style not in content:
    raise SystemExit("No se encontró el estilo contadorEspacio esperado - revisa el archivo manualmente.")

content = content.replace(old_jsx, new_jsx, 1)
content = content.replace(old_style, new_style, 1)

with open(path, 'w') as f:
    f.write(content)

print("Cambio aplicado correctamente.")
