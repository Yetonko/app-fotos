import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Pressable,
  View,
  Text,
  ScrollView,
  Alert,
  Share,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';

import { registrarSeleccion } from '@/lib/uso';
import { ZoomablePhotoModal } from '@/components/zoomable-photo-modal';
import {
  iniciarTorneo,
  grupoActual,
  elegirGanadora,
  totalElecciones,
  EstadoTorneo,
  FotoCandidata,
} from '@/lib/torneo';
import { obtenerGrupo, marcarGanadora } from '@/lib/gruposElegidos';
import { marcarRevisadoSiProcede } from '@/lib/revisados';
import { registrarMomento } from '@/lib/momentos';
import { guardarEnAlbumFavoritas } from '@/lib/album';
import { sumarEleccion, sumarLiberado } from '@/lib/progreso';
import { inicializarCoachmarks, coachmarkVisto, marcarCoachmarkVisto } from '@/lib/coachmarks';
import { obtenerNombreActividad, guardarNombreActividad, formatearFecha, formatearEtiqueta } from '@/lib/etiquetas';
import { EtiquetaModal } from '@/components/etiqueta-modal';
import { mejorarFoto, ResultadoMejora } from '@/lib/mejora';
import { BouncyPressable } from '@/components/bouncy-pressable';
import { Boton } from '@/components/boton';
import { BotonVolver } from '@/components/boton-volver';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { COLORES } from '@/constants/estilo';
import { T } from '@/lib/i18n';
import { calcularTamanoTotal, formatearTamano } from '@/lib/tamano';

// La papelera de 30 días de "Eliminados recientemente" es un comportamiento
// verificado de iOS. En Android varía según el fabricante y la app de
// galería, así que ahí evitamos prometer un número de días o un nombre de
// carpeta concretos.
const TEXTO_RECUPERACION =
  Platform.OS === 'ios'
    ? T.comun.recuperacionIos
    : T.comun.recuperacionAndroid;

export default function SeleccionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { grupoId } = useLocalSearchParams<{ grupoId?: string }>();

  // El grupo (candidatas + descartadas) solo puede venir del store en
  // memoria, que lo registra la pantalla de inicio a partir de una consulta
  // real al carrete en esta sesión. Nunca se aceptan fotos ni ids llegados
  // por parámetros de navegación: así un deep link no puede colar una
  // pantalla de borrado con datos que no corresponden a lo que se ve.
  const grupo = grupoId ? obtenerGrupo(grupoId) : undefined;

  const candidatasOriginales = useRef(grupo?.candidatas ?? []).current;
  const descartadasPorNitidez = useRef(grupo?.descartadas ?? []).current;
  const totalComparaciones = Math.max(totalElecciones(candidatasOriginales.length), 1);

  const [estado, setEstado] = useState<EstadoTorneo>(() => iniciarTorneo(candidatasOriginales));
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);
  // Foto ampliada dentro del duelo: guarda el id (no la uri) para poder
  // calcular el índice inicial dentro del grupo actual y permitir
  // deslizar entre sus fotos sin salir del zoom.
  const [duelAmpliadoId, setDuelAmpliadoId] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [mejorando, setMejorando] = useState(false);
  const [fotoMejorada, setFotoMejorada] = useState<ResultadoMejora | null>(null);
  // ids de las fotos "descartadas" que el usuario decide quedarse además de
  // la ganadora, antes de borrar el resto de la ráfaga.
  const [extrasSeleccionadas, setExtrasSeleccionadas] = useState<string[]>([]);
  // true cuando la ganadora ya se ha copiado al álbum "Fondly · Favoritas",
  // para mostrar la confirmación discreta bajo la foto.
  const [guardadaEnAlbum, setGuardadaEnAlbum] = useState(false);
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
  // Tras el torneo hay dos pasos, cada uno con una sola decisión:
  // 'foto' celebra y comparte la elegida; 'otras' decide qué hacer con el
  // resto de la ráfaga (el único sitio donde se borran las no elegidas).
  const [paso, setPaso] = useState<'foto' | 'otras'>('foto');
  // true en cuanto un borrado ha ido bien: a partir de ahí no se ofrece
  // ningún otro borrado en esta pantalla (las fotos de `resto` ya no son
  // fiables y la pantalla se va a cerrar).
  const [borradoHecho, setBorradoHecho] = useState(false);

  // Se carga una vez al entrar a la pantalla; el tick fuerza un re-render
  // cuando termina de cargar, para que coachmarkVisto() ya lea del cache
  // en vez de asumir "no visto" por defecto.
  const [tickCoachmarks, setTickCoachmarks] = useState(0);
  useEffect(() => {
    inicializarCoachmarks().then(() => setTickCoachmarks((t) => t + 1));
  }, []);

  const grupoTorneo = grupoActual(estado);
  const { width: anchoPantalla } = useWindowDimensions();

  const elegir = (foto: FotoCandidata) => {
    // Un toque simple pendiente (que iba a abrir el visor) ya no tiene
    // sentido: el grupo va a cambiar.
    Object.values(toqueTimeoutRef.current).forEach((t) => t && clearTimeout(t));
    toqueTimeoutRef.current = {};
    setDuelAmpliadoId(null);
    setEstado((estadoAnterior) => elegirGanadora(estadoAnterior, foto));
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
        setDuelAmpliadoId(foto.id);
        toqueTimeoutRef.current[foto.id] = null;
      }, 300);
    }
  };

  useEffect(() => {
    if (estado.ganadora && grupoId) {
      marcarGanadora(grupoId, estado.ganadora);
      registrarSeleccion();
      const numExtras = candidatasOriginales.length - 1 + descartadasPorNitidez.length;
      marcarRevisadoSiProcede(grupoId, numExtras);
      if (grupo?.creationTime) {
        registrarMomento(grupoId, estado.ganadora, grupo.creationTime);
      }
      guardarEnAlbumFavoritas(estado.ganadora.id).then(setGuardadaEnAlbum);
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
    calcularTamanoTotal(fotosABorrarAhora.map((f) => f.id)).then((total) => {
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
        Alert.alert(T.comun.errorCompartir, T.comun.intentaloDeNuevo);
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
      Alert.alert(T.seleccion.errorMejorar, T.seleccion.pruebaDeNuevo);
    } finally {
      setMejorando(false);
    }
  };

  const guardarMejora = async () => {
    if (!fotoMejorada) return;
    try {
      await MediaLibrary.createAssetAsync(fotoMejorada.uri);
      Alert.alert(T.seleccion.guardadaTitulo, T.seleccion.guardadaTexto);
      setFotoMejorada(null);
    } catch {
      Alert.alert(T.seleccion.errorGuardarMejora, T.comun.intentaloDeNuevo);
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
    if (idsABorrar.length === 0 || borrando || borradoHecho) return;
    Alert.alert(
      T.seleccion.borrarFotosTitulo,
      T.seleccion.borrarFotosTexto(idsABorrar.length, TEXTO_RECUPERACION),
      [
        { text: T.comun.cancelar, style: 'cancel' },
        {
          text: T.comun.borrar,
          style: 'destructive',
          onPress: async () => {
            setBorrando(true);
            try {
              const fotosABorrar = resto.filter((f) => idsABorrar.includes(f.id));
              const tamanoLiberado = await calcularTamanoTotal(fotosABorrar.map((f) => f.id));
              const borradoOk = await MediaLibrary.deleteAssetsAsync(idsABorrar);
              if (!borradoOk) {
                Alert.alert(
                  T.comun.borrarTodo.nadaBorradoTitulo,
                  T.comun.borrarTodo.nadaBorradoTexto
                );
                return;
              }
              setBorradoHecho(true);
              // Las fotos ya están borradas: si falla solo el contador de
              // progreso, no hay que decirle que el borrado ha fallado.
              await sumarEleccion(tamanoLiberado).catch(() => {});
              const tamanoTexto = formatearTamano(tamanoLiberado);
              Alert.alert(
                T.comun.listo,
                tamanoTexto
                  ? T.seleccion.hasLiberado(tamanoTexto)
                  : T.seleccion.borradasNoElegidas,
                [{ text: T.comun.volverAMisFotos, onPress: () => router.back() }]
              );
            } catch {
              Alert.alert(
                T.comun.borrarTodo.errorTitulo,
                T.comun.borrarTodo.errorTexto
              );
            } finally {
              setBorrando(false);
            }
          },
        },
      ]
    );
  };

  // Borra TODAS las fotos del grupo, incluida la ganadora: para casos de
  // fotos-recordatorio (ej. un ticket, una pizarra) donde, tras ver la
  // "elegida", el usuario se da cuenta de que en realidad no quiere
  // quedarse con ninguna. A diferencia de confirmarYBorrarFotos (que
  // siempre respeta la ganadora), aquí se borra todo sin excepción.
  const borrarGrupoCompleto = () => {
    if (!estado.ganadora || borrando || borradoHecho) return;
    const todasLasFotos = [...candidatasOriginales, ...descartadasPorNitidez];
    const idsTodo = todasLasFotos.map((f) => f.id);
    Alert.alert(
      T.comun.borrarTodo.titulo,
      T.seleccion.borrarTodoTexto(idsTodo.length, TEXTO_RECUPERACION),
      [
        { text: T.comun.cancelar, style: 'cancel' },
        {
          text: T.comun.borrarTodo.boton,
          style: 'destructive',
          onPress: async () => {
            setBorrando(true);
            try {
              const tamanoLiberado = await calcularTamanoTotal(idsTodo);
              const borradoOk = await MediaLibrary.deleteAssetsAsync(idsTodo);
              if (!borradoOk) {
                Alert.alert(
                  T.comun.borrarTodo.nadaBorradoTitulo,
                  T.comun.borrarTodo.nadaBorradoTexto
                );
                return;
              }
              setBorradoHecho(true);
              await sumarLiberado(tamanoLiberado).catch(() => {});
              const tamanoTexto = formatearTamano(tamanoLiberado);
              Alert.alert(
                T.comun.listo,
                tamanoTexto
                  ? T.seleccion.hasLiberado(tamanoTexto)
                  : T.seleccion.borradasTodas,
                [{ text: T.comun.volverAMisFotos, onPress: () => router.back() }]
              );
            } catch {
              Alert.alert(
                T.comun.borrarTodo.errorTitulo,
                T.comun.borrarTodo.errorTexto
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

  // Lo que no es la acción principal del paso 'foto' vive aquí, lejos del
  // botón de compartir para no tocarlo sin querer.
  const abrirMasOpciones = () => {
    if (borrando || borradoHecho) return;
    Alert.alert(T.seleccion.masOpciones, undefined, [
      { text: T.seleccion.darBrillo, onPress: retocar },
      { text: T.seleccion.ningunaBorrarTambien, style: 'destructive', onPress: borrarGrupoCompleto },
      { text: T.comun.cancelar, style: 'cancel' },
    ]);
  };

  // No hay grupo válido en el store: o el grupoId no existe (deep link con
  // un id inventado), o la app se ha reiniciado y el store en memoria se ha
  // vaciado. En ningún caso se rellena con datos de prueba: se avisa y se
  // vuelve a la lista de ráfagas.
  if (!grupo || candidatasOriginales.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.avisoContenedor}>
          <Text style={styles.titulo}>{T.seleccion.noEncontrado}</Text>
          <Text style={styles.pista}>{T.seleccion.noEncontradoTexto}</Text>
          <Boton onPress={() => router.replace('/')}>{T.comun.volverAMisFotos}</Boton>
        </View>
      </View>
    );
  }

  if (estado.ganadora) {
    // Lo que se borraría ahora mismo en el paso 'otras': todo el resto menos
    // las que ha marcado para guardar. Es la misma lista que usa
    // guardarExtrasYBorrarResto, así el número del botón y el del aviso de
    // confirmación siempre coinciden.
    const numABorrar = resto.filter((f) => !extrasSeleccionadas.includes(f.id)).length;

    return (
      <View style={styles.container}>
        {paso === 'foto' ? (
          <ScrollView contentContainerStyle={[styles.scrollContenido, { paddingTop: insets.top + 12 }]}>
            <Text style={styles.titulo}>{T.seleccion.laElegida}</Text>
            <Pressable onPress={() => setMostrarEtiquetaModal(true)} hitSlop={6}>
              <View style={styles.etiquetaPill}>
                <Text style={styles.etiquetaPillTexto}>
                  {grupo.creationTime ? formatearEtiqueta(grupoId!, grupo.creationTime) : ''}
                </Text>
                <IconSymbol name="pencil" size={14} color={COLORES.acentoOscuro} />
              </View>
            </Pressable>
            <Pressable onPress={() => setFotoAmpliada(estado.ganadora!.uri)}>
              <View style={styles.fotoGanadoraContenedor}>
                <Image source={{ uri: estado.ganadora.uri }} style={styles.fotoGanadora} />
                <View style={styles.coronaInsignia}>
                  <Text style={styles.coronaTexto}>👑</Text>
                </View>
              </View>
            </Pressable>

            {guardadaEnAlbum && (
              <Text style={styles.avisoGuardada}>{T.seleccion.guardadaEnAlbum}</Text>
            )}

            {mejorando && <Text style={styles.notaMejora}>{T.seleccion.mejorando}</Text>}

            {fotoMejorada && (
              <View style={styles.previewContenedor}>
                <Text style={styles.previewEtiqueta}>{T.seleccion.versionMejorada}</Text>
                <Pressable onPress={() => setFotoAmpliada(fotoMejorada.uri)}>
                  <Image source={{ uri: fotoMejorada.uri }} style={styles.previewImagen} />
                </Pressable>
                <View style={styles.previewAcciones}>
                  <Boton onPress={guardarMejora}>{T.seleccion.guardarEnCarrete}</Boton>
                  <Boton variante="texto" onPress={descartarMejora}>
                    {T.comun.descartar}
                  </Boton>
                </View>
              </View>
            )}

            <View style={styles.accionesContenedor}>
              <Boton onPress={compartir}>{T.seleccion.compartir}</Boton>

              {resto.length > 0 ? (
                <Boton variante="secundario" onPress={() => setPaso('otras')}>
                  {T.seleccion.seguirConOtras(resto.length)}
                </Boton>
              ) : (
                <Boton variante="secundario" onPress={() => router.back()}>
                  {T.comun.volverAMisFotos}
                </Boton>
              )}
            </View>

            <Boton variante="texto" onPress={abrirMasOpciones} disabled={borrando || mejorando}>
              {T.seleccion.masOpciones}
            </Boton>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={[styles.scrollContenido, { paddingTop: insets.top + 12 }]}>
            <View style={styles.botonSalirTorneo}>
              <BotonVolver
                texto={T.seleccion.volverAMiFoto}
                onPress={() => setPaso('foto')}
                disabled={borrando}
              />
            </View>

            <Text style={styles.titulo}>{T.seleccion.otrasTitulo(resto.length)}</Text>
            <Text style={styles.pista}>{T.seleccion.otrasSubtitulo}</Text>
            <Text
              style={[
                styles.pistaZoomExtras,
                !coachmarkVisto('extras_lupa') && styles.pistaZoomExtrasDestacada,
              ]}
            >
              {T.seleccion.pistaLupa}
            </Text>

            <View style={styles.extrasFilaMiniaturas}>
              {resto.map((foto) => {
                const seleccionada = extrasSeleccionadas.includes(foto.id);
                const esBorrosa = idsBorrosas.has(foto.id);
                return (
                  <Pressable
                    key={foto.id}
                    onPress={() => alternarExtra(foto.id)}
                    disabled={borrando}
                  >
                    <View
                      style={[
                        styles.miniaturaExtraContenedor,
                        seleccionada && styles.miniaturaExtraContenedorActiva,
                      ]}
                    >
                      <Image source={{ uri: foto.uri }} style={styles.miniaturaExtra} />
                      {esBorrosa && (
                        <View style={styles.miniaturaExtraBorrosa}>
                          <Text style={styles.miniaturaExtraBorrosaTexto}>{T.seleccion.borrosa}</Text>
                        </View>
                      )}

                      {/* Corazón (no ✓) para que se lea como "me la quedo",
                          igual que el corazón del torneo. */}
                      {seleccionada && (
                        <View style={styles.miniaturaExtraCheck}>
                          <Text style={styles.miniaturaExtraCheckTexto}>♥</Text>
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
                        <IconSymbol name="magnifyingglass" size={16} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {!borradoHecho && (numABorrar === 0 || tamanoALiberar !== 0) && (
              <Text style={styles.contadorEspacio}>
                {numABorrar === 0
                  ? T.seleccion.sinEspacioALiberar
                  : tamanoALiberar === null
                  ? T.seleccion.calculandoEspacio
                  : T.seleccion.vasALiberar(formatearTamano(tamanoALiberar))}
              </Text>
            )}

            <View style={styles.accionesContenedor}>
              {borradoHecho ? (
                <Boton onPress={() => router.back()}>{T.comun.volverAMisFotos}</Boton>
              ) : numABorrar > 0 ? (
                <>
                  <Text style={styles.textoSeguridad}>{TEXTO_RECUPERACION}</Text>
                  <Boton
                    variante="peligro"
                    onPress={guardarExtrasYBorrarResto}
                    disabled={borrando}
                  >
                    {borrando ? T.seleccion.eliminando : T.seleccion.borrarN(numABorrar)}
                  </Boton>
                  <Boton variante="secundario" onPress={() => router.back()} disabled={borrando}>
                    {T.seleccion.quedarmelasTodas}
                  </Boton>
                </>
              ) : (
                <Boton onPress={() => router.back()}>{T.seleccion.quedarmelasTodas}</Boton>
              )}
            </View>
          </ScrollView>
        )}
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

  if (!grupoTorneo) {
    return (
      <View style={styles.container}>
        <Text style={styles.titulo}>{T.seleccion.cargando}</Text>
      </View>
    );
  }

  // Duelo (2 fotos): una al lado de la otra con "vs". Grupo (3-4 fotos, solo
  // en las primeras rondas de torneos largos): cuadrícula de 2 columnas
  // con fotos algo más bajas para que quepan sin desplazarse.
  const esDuelo = grupoTorneo.length === 2;
  const anchoFotoGrupo = Math.min(170, Math.floor((anchoPantalla - 40 - 12) / 2));
  const estiloFotoGrupo = { width: anchoFotoGrupo, height: Math.round(anchoFotoGrupo * 1.1), borderRadius: 16 };

  const renderFotoTorneo = (foto: FotoCandidata) => (
    <View key={foto.id} style={[styles.opcion, !esDuelo && styles.opcionGrupo]}>
      <Pressable onPress={() => manejarToqueFoto(foto)}>
        <View style={styles.fotoDueloContenedor}>
          <Image
            source={{ uri: foto.uri }}
            style={esDuelo ? styles.fotoDuelo : estiloFotoGrupo}
            transition={200}
          />
          {corazonAnimado === foto.id && (
            <View style={styles.corazonFlotanteContenedor} pointerEvents="none">
              <Text style={styles.corazonFlotante}>❤️</Text>
            </View>
          )}
          <BouncyPressable style={styles.botonCorazon} onPress={() => elegir(foto)}>
            <Text style={styles.textoCorazon}>♥</Text>
          </BouncyPressable>
        </View>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContenido, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Salir del torneo sin elegir: no se pierde nada ni gasta una
            selección gratis (solo se cuenta al elegir ganadora). */}
        <View style={styles.botonSalirTorneo}>
          <BotonVolver onPress={() => router.back()} />
        </View>
        <View style={styles.progresoContenedor}>
          {Array.from({ length: totalComparaciones }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.progresoPunto,
                i === estado.eleccionesHechas && styles.progresoPuntoActivo,
              ]}
            />
          ))}
        </View>
        <Text style={styles.titulo}>{T.seleccion.cualPrefieres}</Text>
        <Text style={styles.pista}>
          {esDuelo ? T.seleccion.pista : T.seleccion.pistaGrupo(grupoTorneo.length)}
        </Text>
        <Text
          style={[
            styles.pistaZoom,
            !coachmarkVisto('torneo_doble_tap') && styles.pistaZoomDestacada,
          ]}
        >
          {T.seleccion.pistaGestos}
        </Text>

        {esDuelo ? (
          <View style={styles.duelo}>
            {renderFotoTorneo(grupoTorneo[0])}
            <View style={styles.vsPill}>
              <Text style={styles.vsTexto}>{T.seleccion.vs}</Text>
            </View>
            {renderFotoTorneo(grupoTorneo[1])}
          </View>
        ) : (
          <View style={styles.cuadriculaGrupo}>{grupoTorneo.map(renderFotoTorneo)}</View>
        )}
      </ScrollView>

      <ZoomablePhotoModal
        fotos={grupoTorneo}
        indiceInicial={Math.max(0, grupoTorneo.findIndex((f) => f.id === duelAmpliadoId))}
        visible={!!duelAmpliadoId}
        onClose={() => setDuelAmpliadoId(null)}
        onElegir={(foto) => {
          marcarCoachmarkVisto('torneo_doble_tap');
          elegir(foto);
        }}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: COLORES.acentoSuave,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 16,
    overflow: 'hidden',
  },
  etiquetaPillTexto: {
    color: COLORES.acentoOscuro,
    fontSize: 14,
    fontWeight: '700',
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
    fontSize: 13,
    textAlign: 'center',
  },
  pistaZoomExtras: {
    marginTop: 4,
    marginBottom: 20,
    color: COLORES.textoSecundario,
    fontSize: 13,
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
  botonSalirTorneo: {
    alignSelf: 'flex-start',
    marginBottom: 8,
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
  opcionGrupo: {
    marginBottom: 4,
  },
  cuadriculaGrupo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 12,
  },
  duelo: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  fotoDueloContenedor: {
    position: 'relative',
    marginBottom: 22,
  },
  fotoDuelo: {
    width: 158,
    height: 210,
    borderRadius: 18,
  },
  vsPill: {
    backgroundColor: COLORES.acentoSuave,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 30,
  },
  vsTexto: {
    color: COLORES.acentoTexto,
    fontSize: 13,
    fontWeight: '700',
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
    position: 'absolute',
    bottom: -13,
    left: '50%',
    marginLeft: -26,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORES.superficie,
    borderWidth: 1,
    borderColor: COLORES.acento,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B2A28',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  textoCorazon: {
    fontSize: 24,
    color: COLORES.acentoTexto,
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
    fontSize: 13,
    fontWeight: '600',
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
  notaMejora: {
    textAlign: 'center',
    color: COLORES.textoSecundario,
    fontSize: 13,
    marginBottom: 16,
  },
  avisoGuardada: {
    color: COLORES.acentoTexto,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  textoSeguridad: {
    color: COLORES.texto,
    fontSize: 13,
    textAlign: 'center',
  },

  // --- Selector de "quédate con alguna más" ---
  extrasFilaMiniaturas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
    marginBottom: 14,
  },
  miniaturaExtraContenedor: {
    position: 'relative',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  miniaturaExtraContenedorActiva: {
    borderColor: COLORES.acento,
  },
  miniaturaExtra: {
    width: 96,
    height: 96,
    borderRadius: 10,
  },
  miniaturaExtraLupa: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 13,
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
    fontSize: 13,
    fontWeight: '700',
  },
  miniaturaExtraCheck: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORES.acento,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniaturaExtraCheckTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
