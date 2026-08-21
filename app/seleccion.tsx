import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Pressable, View, Text, ScrollView, Alert, Share } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';

import { ZoomablePhotoModal } from '@/components/zoomable-photo-modal';
import {
  iniciarTorneo,
  parejaActual,
  elegirGanadora,
  EstadoTorneo,
  FotoCandidata,
} from '@/lib/torneo';
import { marcarGanadora } from '@/lib/gruposElegidos';
import { mejorarFoto, ResultadoMejora } from '@/lib/mejora';

// --- Sistema de diseño (mismos valores que app/(tabs)/index.tsx) --------
const COLORES = {
  fondo: '#F5EFE3',
  superficie: '#FFFFFF',
  borde: '#EAE2D0',
  acento: '#D98C7A',
  acentoSuave: '#F4DCD3',
  acentoOscuro: '#3B2A28',
  texto: '#2B2420',
  textoSecundario: '#8C8171',
  peligro: '#C15C4E',
};
// -------------------------------------------------------------------------

const MAX_EXTRAS = 2;

// Datos de prueba: se usan solo si se entra a esta pantalla sin pasar
// candidatas reales por parámetro.
const CANDIDATAS_PRUEBA: FotoCandidata[] = [
  { id: '1', uri: 'https://picsum.photos/seed/foto1/400/400' },
  { id: '2', uri: 'https://picsum.photos/seed/foto2/400/400' },
  { id: '3', uri: 'https://picsum.photos/seed/foto3/400/400' },
];

function parsearFotos(param: string | string[] | undefined): FotoCandidata[] {
  if (!param) return [];
  const valor = Array.isArray(param) ? param[0] : param;
  try {
    const parseadas = JSON.parse(valor) as FotoCandidata[];
    return Array.isArray(parseadas) ? parseadas : [];
  } catch {
    return [];
  }
}

function obtenerCandidatasIniciales(candidatasParam: string | string[] | undefined): FotoCandidata[] {
  const parseadas = parsearFotos(candidatasParam);
  return parseadas.length > 0 ? parseadas : CANDIDATAS_PRUEBA;
}

// Suma el tamaño en disco de un conjunto de fotos, para poder decirle al
// usuario cuánto espacio ha liberado al borrar. Si alguna foto falla al
// consultarse (por ejemplo, en modo prueba con uris de picsum), simplemente
// no cuenta para el total en vez de romper todo el cálculo.
async function calcularTamanoTotal(fotos: FotoCandidata[]): Promise<number> {
  let total = 0;
  for (const foto of fotos) {
    try {
      const info = await MediaLibrary.getAssetInfoAsync(foto.id);
      const uriLocal = info.localUri ?? info.uri;
      const datos = await FileSystem.getInfoAsync(uriLocal, { size: true });
      if (datos.exists && typeof datos.size === 'number') {
        total += datos.size;
      }
    } catch {
      // Sin tamaño disponible para esta foto: no se cuenta, pero seguimos.
    }
  }
  return total;
}

function formatearTamano(bytes: number): string {
  if (bytes <= 0) return '';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function SeleccionScreen() {
  const router = useRouter();
  const { candidatas: candidatasParam, descartadas: descartadasParam, grupoId } = useLocalSearchParams<{
    candidatas?: string;
    descartadas?: string;
    grupoId?: string;
  }>();

  const candidatasOriginales = useRef(obtenerCandidatasIniciales(candidatasParam)).current;
  const descartadasPorNitidez = useRef(parsearFotos(descartadasParam)).current;
  const totalComparaciones = Math.max(candidatasOriginales.length - 1, 1);

  const [estado, setEstado] = useState<EstadoTorneo>(() => iniciarTorneo(candidatasOriginales));
  const [comparacionActual, setComparacionActual] = useState(1);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [mejorando, setMejorando] = useState(false);
  const [fotoMejorada, setFotoMejorada] = useState<ResultadoMejora | null>(null);
  // ids de las fotos "descartadas" que el usuario decide quedarse además de
  // la ganadora (hasta MAX_EXTRAS), antes de borrar el resto de la ráfaga.
  const [extrasSeleccionadas, setExtrasSeleccionadas] = useState<string[]>([]);

  const pareja = parejaActual(estado);

  const elegir = (foto: FotoCandidata) => {
    setEstado((estadoAnterior) => elegirGanadora(estadoAnterior, foto));
    setComparacionActual((n) => Math.min(n + 1, totalComparaciones));
  };

  useEffect(() => {
    if (estado.ganadora && grupoId) {
      marcarGanadora(grupoId, estado.ganadora);
    }
  }, [estado.ganadora, grupoId]);

  // Todo lo que no es la ganadora: las que perdieron el torneo + las
  // descartadas de entrada por estar borrosas.
  const resto = estado.ganadora
    ? [
        ...candidatasOriginales.filter((c) => c.id !== estado.ganadora!.id),
        ...descartadasPorNitidez,
      ]
    : [];

  const alternarExtra = (id: string) => {
    setExtrasSeleccionadas((actual) => {
      if (actual.includes(id)) {
        return actual.filter((x) => x !== id);
      }
      if (actual.length >= MAX_EXTRAS) {
        return actual;
      }
      return [...actual, id];
    });
  };

  const compartir = async () => {
    if (!estado.ganadora) return;
    try {
      const info = await MediaLibrary.getAssetInfoAsync(estado.ganadora.id);
      await Share.share({ url: info.localUri ?? estado.ganadora.uri });
    } catch {
      try {
        await Share.share({ url: estado.ganadora.uri });
      } catch {
        Alert.alert('No se pudo compartir', 'Inténtalo de nuevo en unos segundos.');
      }
    }
  };

  const retocar = async () => {
    if (!estado.ganadora) return;
    setMejorando(true);
    try {
      const resultado = await mejorarFoto(estado.ganadora.id);
      setFotoMejorada(resultado);
    } catch (error) {
      console.error('Error al mejorar la foto:', error);
      Alert.alert('Esto no ha funcionado', 'Prueba de nuevo, o hazlo con una foto real de tu carrete.');
    } finally {
      setMejorando(false);
    }
  };

  const guardarMejora = async () => {
    if (!fotoMejorada) return;
    try {
      await MediaLibrary.createAssetAsync(fotoMejorada.uri);
      Alert.alert('¡Guardada!', 'La nueva versión ya está en tu carrete.');
      setFotoMejorada(null);
    } catch {
      Alert.alert('No se pudo guardar', 'Inténtalo de nuevo.');
    }
  };

  const descartarMejora = () => {
    if (fotoMejorada) {
      FileSystem.deleteAsync(fotoMejorada.uri, { idempotent: true }).catch(() => {});
    }
    setFotoMejorada(null);
  };

  // Borra un conjunto de fotos de esta ráfaga, calculando antes cuánto
  // espacio se va a liberar para poder decírselo al usuario al terminar.
  const confirmarYBorrarFotos = (idsABorrar: string[]) => {
    if (idsABorrar.length === 0) return;
    Alert.alert(
      'Borrar fotos',
      `Se ${idsABorrar.length === 1 ? 'borrará' : 'borrarán'} ${idsABorrar.length} ${idsABorrar.length === 1 ? 'foto' : 'fotos'} de esta ráfaga. No podrás recuperarlas después.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            setBorrando(true);
            try {
              const fotosABorrar = resto.filter((f) => idsABorrar.includes(f.id));
              const tamanoLiberado = await calcularTamanoTotal(fotosABorrar);
              await MediaLibrary.deleteAssetsAsync(idsABorrar);
              setExtrasSeleccionadas([]);
              const tamanoTexto = formatearTamano(tamanoLiberado);
              Alert.alert(
                '¡Listo!',
                tamanoTexto
                  ? `Has liberado ${tamanoTexto} de espacio.`
                  : 'Se han borrado las fotos que no elegiste.'
              );
            } catch {
              Alert.alert(
                'No se pudo borrar',
                'Puede que estés en modo prueba o que hayas cancelado el aviso de iOS.'
              );
            } finally {
              setBorrando(false);
            }
          },
        },
      ]
    );
  };

  const borrarResto = () => {
    confirmarYBorrarFotos(resto.map((f) => f.id));
  };

  const guardarExtrasYBorrarResto = () => {
    const idsABorrar = resto.filter((f) => !extrasSeleccionadas.includes(f.id)).map((f) => f.id);
    confirmarYBorrarFotos(idsABorrar);
  };

  if (estado.ganadora) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContenido}>
          <Text style={styles.titulo}>¡Esta es la elegida! ✨</Text>
          <Pressable onPress={() => setFotoAmpliada(estado.ganadora!.uri)}>
            <View style={styles.fotoGanadoraContenedor}>
              <Image source={{ uri: estado.ganadora.uri }} style={styles.fotoGanadora} />
              <View style={styles.coronaInsignia}>
                <Text style={styles.coronaTexto}>👑</Text>
              </View>
            </View>
          </Pressable>

          {fotoMejorada && (
            <View style={styles.previewContenedor}>
              <Text style={styles.previewEtiqueta}>Con un toque extra ✨</Text>
              <Pressable onPress={() => setFotoAmpliada(fotoMejorada.uri)}>
                <Image source={{ uri: fotoMejorada.uri }} style={styles.previewImagen} />
              </Pressable>
              <View style={styles.previewAcciones}>
                <Pressable style={styles.botonGuardarMejora} onPress={guardarMejora}>
                  <Text style={styles.textoBotonAccion}>Guardar en el carrete</Text>
                </Pressable>
                <Pressable style={styles.botonDescartarMejora} onPress={descartarMejora}>
                  <Text style={styles.textoBotonVolver}>Descartar</Text>
                </Pressable>
              </View>
            </View>
          )}

          <View style={styles.accionesContenedor}>
            <Pressable style={styles.botonAccion} onPress={compartir}>
              <Text style={styles.textoBotonAccion}>Compartir / Publicar</Text>
            </Pressable>

            <Pressable
              style={styles.botonAccionSecundaria}
              onPress={retocar}
              disabled={mejorando}
            >
              <Text style={styles.textoBotonAccionSecundaria}>
                {mejorando ? 'Dándole un toque...' : 'Dar un toque de brillo ✨'}
              </Text>
            </Pressable>

            {resto.length > 0 && (
              <Pressable
                style={styles.botonPeligro}
                onPress={borrarResto}
                disabled={borrando}
              >
                <Text style={styles.textoBotonPeligro}>
                  {borrando ? 'Borrando...' : `Borrar las demás (${resto.length})`}
                </Text>
              </Pressable>
            )}
          </View>

          {resto.length >= 2 && (
            <View style={styles.extrasContenedor}>
              <Text style={styles.previewEtiqueta}>¿Alguna más de esta ráfaga?</Text>
              <Text style={styles.extrasSubtitulo}>
                Puedes quedarte con hasta {MAX_EXTRAS} más además de la elegida.
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
                <Pressable
                  style={styles.botonGuardarExtras}
                  onPress={guardarExtrasYBorrarResto}
                  disabled={borrando}
                >
                  <Text style={styles.textoBotonAccion}>
                    {borrando
                      ? 'Borrando...'
                      : `Guardar ${extrasSeleccionadas.length} más y borrar el resto`}
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          <Pressable style={styles.botonVolver} onPress={() => router.back()}>
            <Text style={styles.textoBotonVolver}>Volver a mis fotos</Text>
          </Pressable>
        </ScrollView>
        <ZoomablePhotoModal
          uri={fotoAmpliada}
          visible={!!fotoAmpliada}
          onClose={() => setFotoAmpliada(null)}
        />
      </View>
    );
  }

  if (!pareja) {
    return (
      <View style={styles.container}>
        <Text style={styles.titulo}>Un momento...</Text>
      </View>
    );
  }

  const [fotoA, fotoB] = pareja;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContenido}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.contador}>
          Foto {comparacionActual} de {totalComparaciones}
        </Text>
        <Text style={styles.titulo}>¿Cuál prefieres?</Text>
        <Text style={styles.pista}>Toca el corazón de la que más te guste</Text>

        <View style={styles.opcion}>
          <Pressable onPress={() => setFotoAmpliada(fotoA.uri)}>
            <Image source={{ uri: fotoA.uri }} style={styles.foto} />
          </Pressable>
          <Pressable style={styles.botonCorazon} onPress={() => elegir(fotoA)}>
            <Text style={styles.textoCorazon}>♥</Text>
          </Pressable>
        </View>

        <View style={styles.opcion}>
          <Pressable onPress={() => setFotoAmpliada(fotoB.uri)}>
            <Image source={{ uri: fotoB.uri }} style={styles.foto} />
          </Pressable>
          <Pressable style={styles.botonCorazon} onPress={() => elegir(fotoB)}>
            <Text style={styles.textoCorazon}>♥</Text>
          </Pressable>
        </View>
      </ScrollView>

      <ZoomablePhotoModal
        uri={fotoAmpliada}
        visible={!!fotoAmpliada}
        onClose={() => setFotoAmpliada(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },
  scrollContenido: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 60,
    alignItems: 'center',
    flexGrow: 1,
  },
  contador: {
    color: COLORES.textoSecundario,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  titulo: {
    marginBottom: 8,
    textAlign: 'center',
    color: COLORES.texto,
    fontSize: 24,
    fontWeight: '700',
  },
  pista: {
    marginBottom: 20,
    color: COLORES.textoSecundario,
    fontSize: 13,
  },
  opcion: {
    alignItems: 'center',
    marginBottom: 24,
  },
  foto: {
    width: 250,
    height: 250,
    borderRadius: 16,
    marginBottom: 14,
  },
  botonCorazon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORES.superficie,
    borderWidth: 1,
    borderColor: COLORES.acento,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoCorazon: {
    fontSize: 24,
    color: COLORES.acento,
  },

  fotoGanadoraContenedor: {
    position: 'relative',
    marginBottom: 24,
  },
  fotoGanadora: {
    width: 280,
    height: 280,
    borderRadius: 16,
  },
  coronaInsignia: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORES.acento,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coronaTexto: {
    fontSize: 20,
  },

  previewContenedor: {
    width: '100%',
    backgroundColor: COLORES.superficie,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    alignItems: 'center',
  },
  previewEtiqueta: {
    color: COLORES.textoSecundario,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  previewImagen: {
    width: 240,
    height: 240,
    borderRadius: 12,
    marginBottom: 12,
  },
  previewAcciones: {
    width: '100%',
    gap: 8,
  },
  botonGuardarMejora: {
    backgroundColor: COLORES.acentoOscuro,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
  },
  botonDescartarMejora: {
    paddingVertical: 8,
    alignItems: 'center',
  },

  accionesContenedor: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  botonAccion: {
    backgroundColor: COLORES.acentoOscuro,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  textoBotonAccion: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  botonAccionSecundaria: {
    backgroundColor: COLORES.superficie,
    borderWidth: 1,
    borderColor: COLORES.acento,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  textoBotonAccionSecundaria: {
    color: COLORES.acento,
    fontWeight: '600',
    fontSize: 15,
  },
  botonPeligro: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORES.peligro,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  textoBotonPeligro: {
    color: COLORES.peligro,
    fontWeight: '600',
    fontSize: 15,
  },

  // --- Selector de "quédate con alguna más" ---
  extrasContenedor: {
    width: '100%',
    backgroundColor: COLORES.superficie,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  extrasSubtitulo: {
    color: COLORES.textoSecundario,
    fontSize: 13,
    marginBottom: 4,
    marginTop: -6,
  },
  extrasFilaMiniaturas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
    marginBottom: 14,
  },
  miniaturaExtraContenedor: {
    position: 'relative',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  miniaturaExtraContenedorActiva: {
    borderColor: COLORES.acento,
  },
  miniaturaExtra: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  miniaturaExtraCheck: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORES.acento,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniaturaExtraCheckTexto: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  botonGuardarExtras: {
    backgroundColor: COLORES.acentoOscuro,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
  },

  botonVolver: {
    paddingVertical: 8,
  },
  textoBotonVolver: {
    color: COLORES.textoSecundario,
    fontWeight: '600',
    fontSize: 14,
  },
});
