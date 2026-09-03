import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Pressable, View, Text, ScrollView, Alert, Share, Platform } from 'react-native';
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
import { obtenerGrupo, marcarGanadora } from '@/lib/gruposElegidos';
import { marcarRevisadoSiProcede } from '@/lib/revisados';
import { registrarMomento } from '@/lib/momentos';
import { inicializarCoachmarks, coachmarkVisto, marcarCoachmarkVisto } from '@/lib/coachmarks';
import { obtenerNombreActividad, guardarNombreActividad, formatearFecha, formatearEtiqueta } from '@/lib/etiquetas';
import { EtiquetaModal } from '@/components/etiqueta-modal';
import { mejorarFoto, ResultadoMejora } from '@/lib/mejora';
import { BouncyPressable } from '@/components/bouncy-pressable';

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
  peligroSuave: '#F3DCD6',
};
// -------------------------------------------------------------------------

// Suma el tamaño en disco de un conjunto de fotos, para poder decirle al
// usuario cuánto espacio ha liberado al borrar. Si alguna foto falla al
// consultarse, simplemente no cuenta para el total en vez de romper todo
// el cálculo.
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

// La papelera de 30 días de "Eliminados recientemente" es un comportamiento
// verificado de iOS. En Android varía según el fabricante y la app de
// galería, así que ahí evitamos prometer un número de días o un nombre de
// carpeta concretos.
const TEXTO_RECUPERACION =
  Platform.OS === 'ios'
    ? 'Podrás recuperarlas desde "Eliminados recientemente" durante 30 días si cambias de opinión.'
    : 'Podrás recuperarlas desde Eliminados recientemente si cambias de opinión.';

export default function SeleccionScreen() {
  const router = useRouter();
  const { grupoId } = useLocalSearchParams<{ grupoId?: string }>();

  // El grupo (candidatas + descartadas) solo puede venir del store en
  // memoria, que lo registra la pantalla de inicio a partir de una consulta
  // real al carrete en esta sesión. Nunca se aceptan fotos ni ids llegados
  // por parámetros de navegación: así un deep link no puede colar una
  // pantalla de borrado con datos que no corresponden a lo que se ve.
  const grupo = grupoId ? obtenerGrupo(grupoId) : undefined;

  const candidatasOriginales = useRef(grupo?.candidatas ?? []).current;
  const descartadasPorNitidez = useRef(grupo?.descartadas ?? []).current;
  const totalComparaciones = Math.max(candidatasOriginales.length - 1, 1);

  const [estado, setEstado] = useState<EstadoTorneo>(() => iniciarTorneo(candidatasOriginales));
  const [comparacionActual, setComparacionActual] = useState(1);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [mejorando, setMejorando] = useState(false);
  const [fotoMejorada, setFotoMejorada] = useState<ResultadoMejora | null>(null);
  // ids de las fotos "descartadas" que el usuario decide quedarse además de
  // la ganadora, antes de borrar el resto de la ráfaga.
  const [extrasSeleccionadas, setExtrasSeleccionadas] = useState<string[]>([]);
  // Tamaño en bytes que se liberaría borrando lo que no se ha marcado para
  // conservar. null mientras se está calculando (o todavía no hay ganadora).
  const [tamanoALiberar, setTamanoALiberar] = useState<number | null>(null);
  // Se abre automaticamente la primera vez que se termina el torneo de un
  // grupo sin nombre de actividad puesto todavia.
  const [mostrarEtiquetaModal, setMostrarEtiquetaModal] = useState(false);
  // Se incrementa tras guardar el nombre de actividad, para refrescar el
  // texto del pill (se calcula desde una cache en memoria, no desde estado
  // de React, asi que necesita un disparador propio para re-renderizar).
  const [tickEtiqueta, setTickEtiqueta] = useState(0);

  // Se carga una vez al entrar a la pantalla; el tick fuerza un re-render
  // cuando termina de cargar, para que coachmarkVisto() ya lea del cache
  // en vez de asumir "no visto" por defecto.
  const [tickCoachmarks, setTickCoachmarks] = useState(0);
  useEffect(() => {
    inicializarCoachmarks().then(() => setTickCoachmarks((t) => t + 1));
  }, []);

  const pareja = parejaActual(estado);

  const elegir = (foto: FotoCandidata) => {
    setEstado((estadoAnterior) => elegirGanadora(estadoAnterior, foto));
    setComparacionActual((n) => Math.min(n + 1, totalComparaciones));
  };

  // Deteccion de doble toque sin depender de react-native-gesture-handler:
  // si el segundo toque llega dentro de 300ms del primero, cuenta como
  // "elegir"; si no llega, el primer toque se resuelve como "ampliar" tras
  // ese mismo margen de tiempo.
  const ultimoToqueRef = useRef<Record<string, number>>({});
  const toqueTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  const [corazonAnimado, setCorazonAnimado] = useState<string | null>(null);

  const manejarToqueFoto = (foto: FotoCandidata) => {
    const ahora = Date.now();
    const anterior = ultimoToqueRef.current[foto.id] ?? 0;

    if (ahora - anterior < 300) {
      const pendiente = toqueTimeoutRef.current[foto.id];
      if (pendiente) {
        clearTimeout(pendiente);
        toqueTimeoutRef.current[foto.id] = null;
      }
      ultimoToqueRef.current[foto.id] = 0;
      setCorazonAnimado(foto.id);
      setTimeout(() => setCorazonAnimado(null), 500);
      marcarCoachmarkVisto('torneo_doble_tap');
      elegir(foto);
    } else {
      ultimoToqueRef.current[foto.id] = ahora;
      toqueTimeoutRef.current[foto.id] = setTimeout(() => {
        setFotoAmpliada(foto.uri);
        toqueTimeoutRef.current[foto.id] = null;
      }, 300);
    }
  };

  useEffect(() => {
    if (estado.ganadora && grupoId) {
      marcarGanadora(grupoId, estado.ganadora);
      const numExtras = candidatasOriginales.length - 1 + descartadasPorNitidez.length;
      marcarRevisadoSiProcede(grupoId, numExtras);
      if (grupo?.creationTime) {
        registrarMomento(grupoId, estado.ganadora, grupo.creationTime);
      }
      Alert.alert('¡Ya tienes tu foto! ¿La publicamos?', undefined, [
        { text: 'Ahora no', style: 'cancel' },
        { text: 'Publicar', onPress: compartir },
      ]);
    }
  }, [estado.ganadora, grupoId]);

  // Recalcula en vivo cuánto espacio se liberaría con la selección actual:
  // se dispara nada más elegir ganadora, y cada vez que el usuario marca o
  // desmarca una foto extra para conservar. Un flag "cancelado" evita que
  // una respuesta antigua (de un cálculo anterior más lento) sobrescriba el
  // resultado de un cálculo más reciente si el usuario toca varias veces
  // seguidas.
  useEffect(() => {
    if (!estado.ganadora) {
      setTamanoALiberar(null);
      return;
    }

    const restoActual = [
      ...candidatasOriginales.filter((c) => c.id !== estado.ganadora!.id),
      ...descartadasPorNitidez,
    ];
    const fotosABorrarAhora = restoActual.filter((f) => !extrasSeleccionadas.includes(f.id));

    if (fotosABorrarAhora.length === 0) {
      setTamanoALiberar(0);
      return;
    }

    let cancelado = false;
    setTamanoALiberar(null);
    calcularTamanoTotal(fotosABorrarAhora).then((total) => {
      if (!cancelado) {
        setTamanoALiberar(total);
      }
    });

    return () => {
      cancelado = true;
    };
  }, [estado.ganadora, extrasSeleccionadas]);

  // Todo lo que no es la ganadora: las que perdieron el torneo + las
  // descartadas de entrada por estar borrosas.
  const resto = estado.ganadora
    ? [
        ...candidatasOriginales.filter((c) => c.id !== estado.ganadora!.id),
        ...descartadasPorNitidez,
      ]
    : [];

  // Ids de las fotos que se descartaron de entrada por estar borrosas, para
  // poder distinguirlas visualmente de las que perdieron el torneo.
  const idsBorrosas = new Set(descartadasPorNitidez.map((f) => f.id));

  const alternarExtra = (id: string) => {
    setExtrasSeleccionadas((actual) => {
      if (actual.includes(id)) {
        return actual.filter((x) => x !== id);
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
        Alert.alert('No hemos podido abrir las opciones para compartir.', 'Inténtalo de nuevo.');
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
      Alert.alert('No hemos podido mejorar esta foto.', 'Prueba de nuevo.');
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
      Alert.alert('No hemos podido guardar la versión mejorada.', 'Inténtalo de nuevo.');
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
      `Se ${idsABorrar.length === 1 ? 'borrará' : 'borrarán'} ${idsABorrar.length} ${idsABorrar.length === 1 ? 'foto' : 'fotos'} de esta ráfaga. ${TEXTO_RECUPERACION}`,
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
              const borradoOk = await MediaLibrary.deleteAssetsAsync(idsABorrar);
              if (!borradoOk) {
                Alert.alert(
                  'No se ha borrado nada',
                  'Cancelaste la confirmación del sistema. Tus fotos siguen en el carrete.'
                );
                return;
              }
              setExtrasSeleccionadas([]);
              const tamanoTexto = formatearTamano(tamanoLiberado);
              Alert.alert(
                '¡Listo!',
                tamanoTexto
                  ? `Has liberado ${tamanoTexto} de espacio.`
                  : 'Se han borrado las fotos que no elegiste.',
                [{ text: 'Volver a mis fotos', onPress: () => router.back() }]
              );
            } catch {
              Alert.alert(
                'No hemos podido eliminar las fotos.',
                'Revisa los permisos e inténtalo de nuevo.'
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

  // Borra TODAS las fotos del grupo, incluida la ganadora: para casos de
  // fotos-recordatorio (ej. un ticket, una pizarra) donde, tras ver la
  // "elegida", el usuario se da cuenta de que en realidad no quiere
  // quedarse con ninguna. A diferencia de confirmarYBorrarFotos (que
  // siempre respeta la ganadora), aquí se borra todo sin excepción.
  const borrarGrupoCompleto = () => {
    if (!estado.ganadora) return;
    const todasLasFotos = [...candidatasOriginales, ...descartadasPorNitidez];
    const idsTodo = todasLasFotos.map((f) => f.id);
    Alert.alert(
      'Borrar todas las fotos',
      `Se ${idsTodo.length === 1 ? 'borrará' : 'borrarán'} ${idsTodo.length} ${idsTodo.length === 1 ? 'foto' : 'fotos'} de esta ráfaga, incluida la que elegiste. ${TEXTO_RECUPERACION}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar todas',
          style: 'destructive',
          onPress: async () => {
            setBorrando(true);
            try {
              const tamanoLiberado = await calcularTamanoTotal(todasLasFotos);
              const borradoOk = await MediaLibrary.deleteAssetsAsync(idsTodo);
              if (!borradoOk) {
                Alert.alert(
                  'No se ha borrado nada',
                  'Cancelaste la confirmación del sistema. Tus fotos siguen en el carrete.'
                );
                return;
              }
              const tamanoTexto = formatearTamano(tamanoLiberado);
              Alert.alert(
                '¡Listo!',
                tamanoTexto
                  ? `Has liberado ${tamanoTexto} de espacio.`
                  : 'Se han borrado todas las fotos de esta ráfaga.',
                [{ text: 'Volver a mis fotos', onPress: () => router.back() }]
              );
            } catch {
              Alert.alert(
                'No hemos podido eliminar las fotos.',
                'Revisa los permisos e inténtalo de nuevo.'
              );
            } finally {
              setBorrando(false);
            }
          },
        },
      ]
    );
  };

  const guardarExtrasYBorrarResto = () => {
    const idsABorrar = resto.filter((f) => !extrasSeleccionadas.includes(f.id)).map((f) => f.id);
    confirmarYBorrarFotos(idsABorrar);
  };

  // No hay grupo válido en el store: o el grupoId no existe (deep link con
  // un id inventado), o la app se ha reiniciado y el store en memoria se ha
  // vaciado. En ningún caso se rellena con datos de prueba: se avisa y se
  // vuelve a la lista de ráfagas.
  if (!grupo || candidatasOriginales.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.avisoContenedor}>
          <Text style={styles.titulo}>No encontramos esta ráfaga</Text>
          <Text style={styles.pista}>
            Puede que la app se haya reiniciado. Vuelve a la lista y ábrela de nuevo.
          </Text>
          <BouncyPressable style={styles.botonAccion} onPress={() => router.replace('/')}>
            <Text style={styles.textoBotonAccion}>Volver a mis fotos</Text>
          </BouncyPressable>
        </View>
      </View>
    );
  }

  if (estado.ganadora) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContenido}>
          <Text style={styles.titulo}>¡Esta es la elegida! ✨</Text>
          <Pressable onPress={() => setMostrarEtiquetaModal(true)} hitSlop={6}>
            <Text style={styles.etiquetaPill}>
              {grupo.creationTime ? formatearEtiqueta(grupoId!, grupo.creationTime) : ''} ✏️
            </Text>
          </Pressable>
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
              <Text style={styles.previewEtiqueta}>Versión mejorada</Text>
              <Pressable onPress={() => setFotoAmpliada(fotoMejorada.uri)}>
                <Image source={{ uri: fotoMejorada.uri }} style={styles.previewImagen} />
              </Pressable>
              <View style={styles.previewAcciones}>
                <BouncyPressable style={styles.botonGuardarMejora} onPress={guardarMejora}>
                  <Text style={styles.textoBotonAccion}>Guardar en el carrete</Text>
                </BouncyPressable>
                <Pressable style={styles.botonDescartarMejora} onPress={descartarMejora}>
                  <Text style={styles.textoBotonVolver}>Descartar</Text>
                </Pressable>
              </View>
            </View>
          )}

          <View style={styles.accionesContenedor}>
            <BouncyPressable style={styles.botonAccion} onPress={compartir}>
              <Text style={styles.textoBotonAccion}>Compartir / Publicar</Text>
            </BouncyPressable>

            <BouncyPressable
              style={styles.botonBrillo}
              onPress={retocar}
              disabled={mejorando}
            >
              <Text style={styles.textoBotonBrillo}>
                {mejorando ? 'Mejorando la luz y el contraste...' : 'Dar un toque de brillo ✨'}
              </Text>
            </BouncyPressable>
            {mejorando && (
              <Text style={styles.notaMejora}>Estamos preparando una versión mejorada.</Text>
            )}

            <BouncyPressable
              style={styles.botonDescartarTodoBoton}
              onPress={borrarGrupoCompleto}
              disabled={borrando}
            >
              <Text style={styles.textoDescartarTodoBoton}>
                No quiero ninguna, borrar también esta foto
              </Text>
            </BouncyPressable>
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
                  <Text
                    style={[
                      styles.pistaZoomExtras,
                      !coachmarkVisto('extras_lupa') && styles.pistaZoomExtrasDestacada,
                    ]}
                  >
                    Toca 🔍 en cada foto para ampliarla antes de decidir
                  </Text>

                  <View style={styles.extrasFilaMiniaturas}>
                    {resto.map((foto) => {
                      const seleccionada = extrasSeleccionadas.includes(foto.id);
                      const esBorrosa = idsBorrosas.has(foto.id);
                      return (
                        <Pressable key={foto.id} onPress={() => alternarExtra(foto.id)}>
                          <View
                            style={[
                              styles.miniaturaExtraContenedor,
                              seleccionada && styles.miniaturaExtraContenedorActiva,
                            ]}
                          >
                            <Image source={{ uri: foto.uri }} style={styles.miniaturaExtra} />
                            {esBorrosa && (
                              <View style={styles.miniaturaExtraBorrosa}>
                                <Text style={styles.miniaturaExtraBorrosaTexto}>Borrosa</Text>
                              </View>
                            )}
                            {__DEV__ && foto.nitidez !== undefined && (
                              <View style={styles.miniaturaExtraDebug}>
                                <Text style={styles.miniaturaExtraDebugTexto}>
                                  {Math.round(foto.nitidez)}
                                </Text>
                              </View>
                            )}
                            {seleccionada && (
                              <View style={styles.miniaturaExtraCheck}>
                                <Text style={styles.miniaturaExtraCheckTexto}>✓</Text>
                              </View>
                            )}
                            <Pressable
                              style={styles.miniaturaExtraLupa}
                              onPress={() => {
                                marcarCoachmarkVisto('extras_lupa');
                                setFotoAmpliada(foto.uri);
                              }}
                              hitSlop={8}
                            >
                              <Text style={styles.miniaturaExtraLupaTexto}>🔍</Text>
                            </Pressable>
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
        <EtiquetaModal
          visible={mostrarEtiquetaModal}
          valorInicial={grupoId ? obtenerNombreActividad(grupoId) ?? '' : ''}
          etiquetaFecha={grupo.creationTime ? formatearFecha(grupo.creationTime) : ''}
          onGuardar={async (nombre) => {
            if (grupoId) {
              await guardarNombreActividad(grupoId, nombre);
              setTickEtiqueta((t) => t + 1);
            }
          }}
          onCerrar={() => setMostrarEtiquetaModal(false)}
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
        <View style={styles.progresoContenedor}>
          {Array.from({ length: totalComparaciones }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.progresoPunto,
                i === comparacionActual - 1 && styles.progresoPuntoActivo,
              ]}
            />
          ))}
        </View>
        <Text style={styles.titulo}>¿Cuál prefieres?</Text>
        <Text style={styles.pista}>Elige la que mejor representa el momento.</Text>
        <Text
          style={[
            styles.pistaZoom,
            !coachmarkVisto('torneo_doble_tap') && styles.pistaZoomDestacada,
          ]}
        >
          Toca dos veces para elegir · toca una vez para ampliar
        </Text>

        <View style={styles.duelo}>
          <View style={styles.opcion}>
            <Pressable onPress={() => manejarToqueFoto(fotoA)}>
              <View style={styles.fotoDueloContenedor}>
                <Image source={{ uri: fotoA.uri }} style={styles.fotoDuelo} transition={200} />
                {corazonAnimado === fotoA.id && (
                  <View style={styles.corazonFlotanteContenedor} pointerEvents="none">
                    <Text style={styles.corazonFlotante}>❤️</Text>
                  </View>
                )}
              </View>
            </Pressable>
            <BouncyPressable style={styles.botonCorazon} onPress={() => elegir(fotoA)}>
              <Text style={styles.textoCorazon}>♥</Text>
            </BouncyPressable>
          </View>

          <View style={styles.opcion}>
            <Pressable onPress={() => manejarToqueFoto(fotoB)}>
              <View style={styles.fotoDueloContenedor}>
                <Image source={{ uri: fotoB.uri }} style={styles.fotoDuelo} transition={200} />
                {corazonAnimado === fotoB.id && (
                  <View style={styles.corazonFlotanteContenedor} pointerEvents="none">
                    <Text style={styles.corazonFlotante}>❤️</Text>
                  </View>
                )}
              </View>
            </Pressable>
            <BouncyPressable style={styles.botonCorazon} onPress={() => elegir(fotoB)}>
              <Text style={styles.textoCorazon}>♥</Text>
            </BouncyPressable>
          </View>
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
  avisoContenedor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
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
  etiquetaPill: {
    alignSelf: 'center',
    color: COLORES.acentoOscuro,
    fontSize: 14,
    fontWeight: '700',
    backgroundColor: COLORES.acentoSuave,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 16,
    overflow: 'hidden',
  },
  pista: {
    marginBottom: 20,
    color: COLORES.textoSecundario,
    fontSize: 13,
    textAlign: 'center',
  },
  pistaZoom: {
    marginTop: -14,
    marginBottom: 20,
    color: COLORES.textoSecundario,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  pistaZoomExtras: {
    marginTop: 4,
    marginBottom: 20,
    color: COLORES.textoSecundario,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  // Version destacada de pistaZoom / pistaZoomExtras: se aplica encima del
  // estilo base (mismo Text, misma posicion) solo mientras el usuario no
  // haya hecho el gesto real todavia, para llamar mas la atencion que el
  // texto gris discreto de siempre.
  pistaZoomDestacada: {
    color: COLORES.acentoOscuro,
    fontStyle: 'normal',
    fontWeight: '700',
    fontSize: 13,
    backgroundColor: COLORES.acentoSuave,
    borderWidth: 1,
    borderColor: COLORES.acento,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  pistaZoomExtrasDestacada: {
    color: COLORES.acentoOscuro,
    fontStyle: 'normal',
    fontWeight: '700',
    fontSize: 13,
    backgroundColor: COLORES.acentoSuave,
    borderWidth: 1,
    borderColor: COLORES.acento,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  opcion: {
    alignItems: 'center',
    marginBottom: 24,
  },
  progresoContenedor: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 14,
  },
  progresoPunto: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORES.borde,
  },
  progresoPuntoActivo: {
    backgroundColor: COLORES.acento,
    width: 20,
  },
  duelo: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  fotoDueloContenedor: {
    position: 'relative',
    marginBottom: 14,
  },
  fotoDuelo: {
    width: 160,
    height: 160,
    borderRadius: 16,
  },
  corazonFlotanteContenedor: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corazonFlotante: {
    fontSize: 64,
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
  contadorEspacio: {
    textAlign: 'center',
    color: COLORES.acentoOscuro,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
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
  botonBrillo: {
    backgroundColor: COLORES.acentoSuave,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
    marginTop: 4,
  },
  textoBotonBrillo: {
    color: COLORES.acentoOscuro,
    fontWeight: '600',
    fontSize: 15,
  },
  notaMejora: {
    textAlign: 'center',
    color: COLORES.textoSecundario,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: -4,
  },
  botonDescartarTodoBoton: {
    backgroundColor: COLORES.peligroSuave,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
    marginTop: 10,
  },
  textoDescartarTodoBoton: {
    color: COLORES.peligro,
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
  },
  miniaturaExtraBorrosa: {
    position: 'absolute',
    top: -6,
    left: -6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(59,42,40,0.85)',
  },
  miniaturaExtraBorrosaTexto: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
  miniaturaExtraDebug: {
    position: 'absolute',
    bottom: -6,
    left: -6,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  miniaturaExtraDebugTexto: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
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
