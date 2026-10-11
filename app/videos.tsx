import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import { Image } from 'expo-image';

import { Boton } from '@/components/boton';
import { BotonVolver } from '@/components/boton-volver';
import { VisorVideo } from '@/components/visor-video';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { COLORES } from '@/constants/estilo';
import { T } from '@/lib/i18n';
import { fechaConDia } from '@/lib/idioma';
import { sumarLiberado } from '@/lib/progreso';
import { formatearTamano } from '@/lib/tamano';
import { prepararTorneoVideo, videosDelMismoRato } from '@/lib/torneo-video';
import {
  DURACION_SIN_QUERER,
  formatearDuracion,
  invalidarEstimacionesVideo,
  pesoRelativo,
  tamanoDeVideo,
  VideoCarrete,
  videosDeRango,
} from '@/lib/videos';

// Mismo texto que en seleccion.tsx / periodo.tsx.
const TEXTO_RECUPERACION =
  Platform.OS === 'ios' ? T.comun.recuperacionIos : T.comun.recuperacionAndroid;

// Cuántos vídeos se miden de verdad (los primeros de la lista, que son los
// que más ocupan). El resto se ordena igual, solo sin cifra.
const MAX_MEDIDOS = 40;

// Vídeos de una época, los que más ocupan primero, para hacer sitio.
export default function VideosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { desde, hasta, etiqueta } = useLocalSearchParams<{
    desde?: string;
    hasta?: string;
    etiqueta?: string;
  }>();

  const [videos, setVideos] = useState<VideoCarrete[] | null>(null);
  const [errorCarga, setErrorCarga] = useState(false);
  const [tamanos, setTamanos] = useState<Record<string, number | null>>({});
  const [marcados, setMarcados] = useState<string[]>([]);
  const [viendoUri, setViendoUri] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  // Guarda inmediata contra un doble toque mientras se mide y se borra.
  const borrandoRef = useRef(false);
  // Y contra abrir dos avisos de borrar seguidos.
  const avisoAbiertoRef = useRef(false);

  // Al volver del torneo de vídeos (donde puede haber borrado), se recarga.
  const [recarga, setRecarga] = useState(0);
  const primeraVez = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (primeraVez.current) {
        primeraVez.current = false;
        return;
      }
      setRecarga((n) => n + 1);
    }, [])
  );

  useEffect(() => {
    if (!desde || !hasta) {
      setErrorCarga(true);
      setVideos([]);
      return;
    }
    let cancelado = false;
    videosDeRango(Number(desde), Number(hasta))
      .then((lista) => {
        if (cancelado) return;
        // Orden fijo desde el principio (por duración y resolución) para que
        // la lista no salte mientras llegan las cifras.
        setVideos([...lista].sort((a, b) => pesoRelativo(b) - pesoRelativo(a)));
      })
      .catch(() => {
        if (cancelado) return;
        setErrorCarga(true);
        setVideos([]);
      });
    return () => {
      cancelado = true;
    };
  }, [desde, hasta, recarga]);

  // Mide de uno en uno, en segundo plano, los que encabezan la lista.
  const hayVideos = videos !== null && videos.length > 0;
  useEffect(() => {
    if (!videos || videos.length === 0) return;
    let cancelado = false;
    (async () => {
      for (const v of videos.slice(0, MAX_MEDIDOS)) {
        if (cancelado) return;
        if (v.id in tamanos) continue;
        const t = await tamanoDeVideo(v);
        if (cancelado) return;
        setTamanos((actual) => ({ ...actual, [v.id]: t }));
      }
    })();
    return () => {
      cancelado = true;
    };
    // Solo al cargar la lista; tras borrar no hace falta volver a medir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayVideos]);

  const lista = videos ?? [];
  const sinQuerer = lista.filter((v) => v.duracion > 0 && v.duracion < DURACION_SIN_QUERER);
  const sinQuererPorMarcar = sinQuerer.filter((v) => !marcados.includes(v.id));
  // Lo que se borraría: SOLO lo marcado que sigue en la lista.
  const idsABorrar = lista.filter((v) => marcados.includes(v.id)).map((v) => v.id);

  // Vídeos grabados seguidos: se ofrece un torneo para quedarse con el mejor.
  // (sin los que ya ha marcado para borrar).
  const grupos = videosDelMismoRato(lista.filter((v) => !marcados.includes(v.id)));
  const abrirTorneo = (grupo: VideoCarrete[]) => {
    if (borrando) return;
    prepararTorneoVideo(grupo);
    router.push('/torneo-video');
  };

  const alternar = (id: string) => {
    if (borrando) return;
    setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  };

  const marcarSinQuerer = () => {
    if (borrando) return;
    setMarcados((m) => [...m, ...sinQuererPorMarcar.map((v) => v.id)]);
  };

  const confirmarYBorrar = () => {
    if (idsABorrar.length === 0 || borrandoRef.current || avisoAbiertoRef.current) return;
    avisoAbiertoRef.current = true;
    const ids = [...idsABorrar];
    Alert.alert(
      T.videos.borrarTitulo(ids.length),
      T.videos.borrarTexto(ids.length, TEXTO_RECUPERACION),
      [
        {
          text: T.comun.cancelar,
          style: 'cancel',
          onPress: () => {
            avisoAbiertoRef.current = false;
          },
        },
        {
          text: T.comun.borrar,
          style: 'destructive',
          onPress: async () => {
            avisoAbiertoRef.current = false;
            if (borrandoRef.current) return;
            borrandoRef.current = true;
            setBorrando(true);
            try {
              // Cuenta lo ya medido (después de borrar no se puede medir).
              // Los que no se midieron no suman: mejor quedarse corto.
              const liberado = ids.reduce((suma, id) => suma + (tamanos[id] ?? 0), 0);
              const borradoOk = await MediaLibrary.deleteAssetsAsync(ids);
              if (!borradoOk) {
                Alert.alert(T.videos.nadaBorradoTitulo, T.videos.nadaBorradoTexto);
                return;
              }
              // Épocas y la caja de vídeos tienen que volver a contar.
              invalidarEstimacionesVideo();
              setVideos((actuales) => (actuales ?? []).filter((v) => !ids.includes(v.id)));
              setMarcados((m) => m.filter((id) => !ids.includes(id)));
              await sumarLiberado(liberado).catch(() => {});
              const tamanoTexto = formatearTamano(liberado);
              Alert.alert(
                T.comun.listo,
                tamanoTexto ? T.seleccion.hasLiberado(tamanoTexto) : T.videos.borrados(ids.length)
              );
            } catch {
              Alert.alert(T.videos.nadaBorradoTitulo, T.videos.errorBorrarTexto);
            } finally {
              borrandoRef.current = false;
              setBorrando(false);
            }
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          avisoAbiertoRef.current = false;
        },
      }
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <BotonVolver onPress={() => router.back()} disabled={borrando} />
      <Text style={styles.titulo}>{T.videos.titulo(etiqueta ?? '')}</Text>

      {videos === null ? (
        <View style={styles.centro}>
          <ActivityIndicator color={COLORES.acento} />
        </View>
      ) : lista.length === 0 ? (
        <View style={styles.centro}>
          <Text style={styles.textoVacio}>{errorCarga ? T.videos.errorCarga : T.videos.vacio}</Text>
        </View>
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(v) => v.id}
          extraData={[marcados, tamanos]}
          contentContainerStyle={{ paddingBottom: idsABorrar.length > 0 ? 190 : 40 }}
          ListHeaderComponent={
            <View style={styles.cabecera}>
              <Text style={styles.subtitulo}>{T.videos.subtitulo}</Text>
              {grupos.length > 0 && (
                <View style={styles.cajaGrupos}>
                  <Text style={styles.cajaGruposTitulo}>{T.torneoVideo.tituloRepetidos}</Text>
                  {grupos.map((g) => (
                    <Pressable
                      key={g[0].id}
                      onPress={() => abrirTorneo(g)}
                      style={styles.grupoFila}
                      accessibilityRole="button"
                    >
                      <Image source={{ uri: g[0].uri }} style={styles.grupoMiniatura} />
                      <View style={styles.filaTextos}>
                        <Text style={styles.grupoTitulo}>
                          {T.torneoVideo.grupoEpoca(g.length, fechaConDia(g[0].creationTime))}
                        </Text>
                        <Text style={styles.filaFecha}>{T.torneoVideo.elegirElMejor}</Text>
                      </View>
                      <IconSymbol name="chevron.right" size={20} color={COLORES.textoSecundario} />
                    </Pressable>
                  ))}
                </View>
              )}
              {sinQuererPorMarcar.length > 0 && (
                <View style={styles.cajaSinQuerer}>
                  <Text style={styles.cajaSinQuererTexto}>
                    {T.videos.sinQuerer(sinQuererPorMarcar.length)}
                  </Text>
                  <Boton variante="secundario" compacto onPress={marcarSinQuerer} disabled={borrando}>
                    {T.videos.marcarSinQuerer}
                  </Boton>
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const marcado = marcados.includes(item.id);
            const tamano = tamanos[item.id];
            const tamanoTexto = tamano ? formatearTamano(tamano) : '';
            return (
              <View style={[styles.fila, marcado && styles.filaMarcada]}>
                <Pressable
                  onPress={() => setViendoUri(item.uri)}
                  accessibilityRole="button"
                  accessibilityLabel={T.videos.verVideo}
                >
                  <Image source={{ uri: item.uri }} style={styles.miniatura} />
                  <View style={styles.play}>
                    <IconSymbol name="play.fill" size={18} color="#FFFFFF" />
                  </View>
                </Pressable>
                <View style={styles.filaTextos}>
                  <Text style={styles.filaTitulo}>
                    {tamanoTexto
                      ? `${formatearDuracion(item.duracion)} · ${tamanoTexto}`
                      : formatearDuracion(item.duracion)}
                  </Text>
                  <Text style={styles.filaFecha}>{fechaConDia(item.creationTime)}</Text>
                </View>
                <Pressable
                  onPress={() => alternar(item.id)}
                  hitSlop={8}
                  style={[styles.marca, marcado && styles.marcaActiva]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: marcado }}
                  accessibilityLabel={T.videos.marcarParaBorrar}
                >
                  <IconSymbol
                    name={marcado ? 'checkmark' : 'trash'}
                    size={18}
                    color={marcado ? '#FFFFFF' : COLORES.textoSecundario}
                  />
                  <Text style={[styles.marcaTexto, marcado && styles.marcaTextoActiva]}>
                    {marcado ? T.videos.marcado : T.videos.marcar}
                  </Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}

      {idsABorrar.length > 0 && (
        <View style={[styles.barraInferior, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.recuperacion}>{TEXTO_RECUPERACION}</Text>
          <Boton variante="peligro" onPress={confirmarYBorrar} disabled={borrando}>
            {T.videos.borrarN(idsABorrar.length)}
          </Boton>
        </View>
      )}

      {viendoUri && <VisorVideo uri={viendoUri} onClose={() => setViendoUri(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORES.fondo,
    paddingHorizontal: 20,
  },
  titulo: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORES.texto,
    marginTop: 4,
    marginBottom: 4,
  },
  cabecera: {
    gap: 14,
    marginBottom: 14,
  },
  subtitulo: {
    fontSize: 15,
    color: COLORES.textoSecundario,
  },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  textoVacio: {
    fontSize: 15,
    color: COLORES.textoSecundario,
    textAlign: 'center',
  },
  cajaGrupos: {
    backgroundColor: COLORES.acentoSuave,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  cajaGruposTitulo: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORES.acentoOscuro,
  },
  grupoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  grupoMiniatura: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: COLORES.borde,
  },
  grupoTitulo: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORES.acentoOscuro,
  },
  cajaSinQuerer: {
    backgroundColor: COLORES.superficie,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  cajaSinQuererTexto: {
    fontSize: 15,
    color: COLORES.texto,
    lineHeight: 21,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORES.superficie,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORES.borde,
    padding: 10,
    marginBottom: 10,
  },
  filaMarcada: {
    borderColor: COLORES.peligro,
    backgroundColor: COLORES.peligroSuave,
  },
  miniatura: {
    width: 72,
    height: 96,
    borderRadius: 10,
    backgroundColor: COLORES.borde,
  },
  play: {
    position: 'absolute',
    top: 33,
    left: 21,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filaTextos: {
    flex: 1,
    gap: 4,
  },
  filaTitulo: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORES.texto,
  },
  filaFecha: {
    fontSize: 13,
    color: COLORES.textoSecundario,
  },
  marca: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 64,
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORES.borde,
  },
  marcaActiva: {
    borderColor: COLORES.peligro,
    backgroundColor: COLORES.peligro,
  },
  marcaTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORES.textoSecundario,
  },
  marcaTextoActiva: {
    color: '#FFFFFF',
  },
  barraInferior: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 10,
    backgroundColor: COLORES.fondo,
    borderTopWidth: 1,
    borderTopColor: COLORES.borde,
  },
  recuperacion: {
    fontSize: 13,
    color: COLORES.textoSecundario,
    textAlign: 'center',
  },
});
