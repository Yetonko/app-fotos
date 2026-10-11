import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import { Image } from 'expo-image';

import { Boton } from '@/components/boton';
import { BotonVolver } from '@/components/boton-volver';
import { ClipEnBucle } from '@/components/clip-en-bucle';
import { VisorVideo } from '@/components/visor-video';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { COLORES } from '@/constants/estilo';
import { T } from '@/lib/i18n';
import { sumarLiberado } from '@/lib/progreso';
import { fechaConDia } from '@/lib/idioma';
import { formatearTamano } from '@/lib/tamano';
import {
  elegirGanadora,
  grupoActual,
  iniciarTorneo,
  totalElecciones,
  EstadoTorneo,
  FotoCandidata,
} from '@/lib/torneo';
import { obtenerTorneoVideo, VideoTorneo } from '@/lib/torneo-video';
import {
  borrarCopiaCompartida,
  formatearDuracion,
  invalidarEstimacionesVideo,
  prepararVideoParaCompartir,
  tamanosAproximados,
} from '@/lib/videos';

// "sáb 12 jul · 22:41", para reconocer cada vídeo del rato.
function horaConDia(t: number): string {
  const d = new Date(t);
  return `${fechaConDia(t)} · ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Mismo texto que en seleccion.tsx / periodo.tsx.
const TEXTO_RECUPERACION =
  Platform.OS === 'ios' ? T.comun.recuperacionIos : T.comun.recuperacionAndroid;

// Torneo de vídeos del mismo rato: elegir el mejor (paso 'torneo'),
// editarlo o publicarlo (paso 'ganador') y decidir qué pasa con los otros
// (paso 'otros'). Mismo recorrido que el torneo de fotos.
export default function TorneoVideoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Los vídeos se fijan al entrar: si cambian fuera, este torneo no cambia.
  const [videos] = useState<VideoTorneo[]>(() => obtenerTorneoVideo());
  const porId = new Map(videos.map((v) => [v.id, v]));
  const [estado, setEstado] = useState<EstadoTorneo>(() =>
    iniciarTorneo(videos.map((v) => ({ id: v.id, uri: v.uri })))
  );
  const [paso, setPaso] = useState<'torneo' | 'ganador' | 'otros'>('torneo');
  const [viendoUri, setViendoUri] = useState<string | null>(null);

  // Paso 'otros': los que ella marca para borrar. Por defecto ninguno: los
  // vídeos de un mismo rato no son copias (pueden ser canciones distintas).
  const [marcados, setMarcados] = useState<string[]>([]);
  const [tamanos, setTamanos] = useState<Record<string, number> | null>(null);
  // Ids medidos de verdad (el resto es estimación): solo esos suman al
  // contador de espacio liberado.
  const [medidos, setMedidos] = useState<Set<string>>(new Set());
  const [borrando, setBorrando] = useState(false);
  const borrandoRef = useRef(false);
  const avisoAbiertoRef = useRef(false);
  const [preparando, setPreparando] = useState(false);
  const preparandoRef = useRef(false);

  const ganadora = estado.ganadora ? porId.get(estado.ganadora.id) ?? null : null;
  const otros = ganadora ? videos.filter((v) => v.id !== ganadora.id) : [];

  // Con un solo vídeo no hay nada que comparar: directo al ganador.
  useEffect(() => {
    if (videos.length === 1 && !estado.ganadora) {
      setEstado((e) => ({ ...e, ganadora: { id: videos[0].id, uri: videos[0].uri } }));
      setPaso('ganador');
    }
  }, [videos, estado.ganadora]);

  // Cuánto ocupan los otros, para decir cuánto espacio se liberará.
  useEffect(() => {
    if (!ganadora) return;
    let cancelado = false;
    tamanosAproximados(otros).then((r) => {
      if (cancelado) return;
      setTamanos(r.porId);
      setMedidos(new Set(otros.filter((v) => !v.noMedible && v.id in r.porId).map((v) => v.id)));
    });
    return () => {
      cancelado = true;
    };
    // Solo cuando hay ganador (la lista de otros sale de ahí).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ganadora?.id]);

  // En cuanto hay ganador, se pasa a su pantalla.
  useEffect(() => {
    if (estado.ganadora && paso === 'torneo') setPaso('ganador');
  }, [estado.ganadora, paso]);

  if (videos.length === 0) {
    return (
      <View style={[styles.container, styles.centro, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.texto}>{T.torneoVideo.sinVideos}</Text>
        <Boton variante="secundario" onPress={() => router.back()}>
          {T.comun.volver}
        </Boton>
      </View>
    );
  }

  const elegir = (candidata: FotoCandidata) => {
    setEstado((e) => elegirGanadora(e, candidata));
  };

  const editarOPublicar = async () => {
    if (!ganadora || preparandoRef.current) return;
    preparandoRef.current = true;
    setPreparando(true);
    let url: string | null = null;
    try {
      url = await prepararVideoParaCompartir(ganadora);
      await Share.share({ url });
    } catch {
      Alert.alert(T.comun.errorCompartir, T.comun.intentaloDeNuevo);
    } finally {
      if (url) await borrarCopiaCompartida(url);
      preparandoRef.current = false;
      setPreparando(false);
    }
  };

  // Lo que se borraría: SOLO los otros que ha marcado. Nunca el ganador.
  const aBorrar = otros.filter((v) => marcados.includes(v.id));
  const tamanoABorrar = tamanos ? aBorrar.reduce((s, v) => s + (tamanos[v.id] ?? 0), 0) : 0;

  const alternarMarcado = (id: string) => {
    if (borrando) return;
    setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  };

  const confirmarYBorrar = () => {
    if (aBorrar.length === 0 || tamanos === null || borrandoRef.current || avisoAbiertoRef.current)
      return;
    avisoAbiertoRef.current = true;
    const ids = aBorrar.map((v) => v.id);
    const tamanoTexto = formatearTamano(tamanoABorrar); // estimación, "unos X"
    const liberado = aBorrar.reduce(
      (s, v) => s + (medidos.has(v.id) ? tamanos?.[v.id] ?? 0 : 0),
      0
    );
    Alert.alert(
      T.videos.borrarTitulo(ids.length),
      T.torneoVideo.borrarTexto(ids.length, tamanoTexto, TEXTO_RECUPERACION),
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
              const borradoOk = await MediaLibrary.deleteAssetsAsync(ids);
              if (!borradoOk) {
                Alert.alert(T.videos.nadaBorradoTitulo, T.videos.nadaBorradoTexto);
                return;
              }
              invalidarEstimacionesVideo();
              await sumarLiberado(liberado).catch(() => {});
              Alert.alert(
                T.comun.listo,
                tamanoTexto ? T.seleccion.hasLiberado(tamanoTexto) : T.videos.borrados(ids.length),
                [{ text: T.comun.volver, onPress: () => router.back() }]
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

  const visor = viendoUri ? <VisorVideo uri={viendoUri} onClose={() => setViendoUri(null)} /> : null;

  // ── Paso 1: el torneo ──
  if (paso === 'torneo' || !ganadora) {
    const grupo = grupoActual(estado) ?? [];
    const total = Math.max(totalElecciones(videos.length), 1);
    const enCuadricula = grupo.length > 2;
    return (
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <BotonVolver texto={T.torneoVideo.salir} onPress={() => router.back()} />
        <Text style={styles.titulo}>{T.torneoVideo.tituloTorneo}</Text>
        <Text style={styles.pista}>{T.torneoVideo.pista}</Text>
        <Text style={styles.progreso}>
          {T.torneoVideo.progreso(Math.min(estado.eleccionesHechas + 1, total), total)}
        </Text>

        <View style={[styles.duelo, enCuadricula && styles.cuadricula]}>
          {grupo.map((c) => {
            const v = porId.get(c.id);
            return (
              <View key={c.id} style={enCuadricula ? styles.celdaCuadricula : styles.celdaDuelo}>
                <Pressable
                  style={styles.clipPulsable}
                  onPress={() => setViendoUri(c.uri)}
                  accessibilityRole="button"
                  accessibilityLabel={T.videos.verVideo}
                >
                  <ClipEnBucle uri={c.uri} style={styles.clip} pausado={!!viendoUri} />
                  {v && (
                    <View style={styles.insignia}>
                      <IconSymbol name="play.fill" size={12} color="#FFFFFF" />
                      <Text style={styles.insigniaTexto}>{formatearDuracion(v.duracion)}</Text>
                    </View>
                  )}
                </Pressable>
                <Boton compacto icono="heart.fill" onPress={() => elegir(c)}>
                  {T.torneoVideo.esteMeGusta}
                </Boton>
              </View>
            );
          })}
        </View>
        {visor}
      </View>
    );
  }

  // ── Paso 2: el ganador ──
  if (paso === 'ganador') {
    return (
      <ScrollView
        style={styles.fondo}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
      >
        <Text style={styles.titulo}>{T.torneoVideo.tituloGanador}</Text>
        <Pressable
          onPress={() => setViendoUri(ganadora.uri)}
          accessibilityRole="button"
          accessibilityLabel={T.videos.verVideo}
        >
          <ClipEnBucle uri={ganadora.uri} style={styles.clipGanador} pausado={!!viendoUri} />
          <View style={styles.insignia}>
            <IconSymbol name="play.fill" size={12} color="#FFFFFF" />
            <Text style={styles.insigniaTexto}>{T.torneoVideo.verConSonido}</Text>
          </View>
        </Pressable>

        <View style={styles.acciones}>
          <Boton onPress={editarOPublicar} disabled={preparando}>
            {preparando ? T.momento.preparando : T.torneoVideo.editarOPublicar}
          </Boton>
          {Platform.OS === 'ios' && <Text style={styles.nota}>{T.torneoVideo.notaEditar}</Text>}
          {otros.length > 0 ? (
            <Boton variante="secundario" onPress={() => setPaso('otros')}>
              {T.torneoVideo.siguienteOtros(otros.length)}
            </Boton>
          ) : (
            <Boton variante="secundario" onPress={() => router.back()}>
              {T.comun.volver}
            </Boton>
          )}
        </View>
        {visor}
      </ScrollView>
    );
  }

  // ── Paso 3: los otros ──
  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <BotonVolver
        texto={T.torneoVideo.volverAlGanador}
        onPress={() => setPaso('ganador')}
        disabled={borrando}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 200 }}>
        <Text style={styles.titulo}>{T.torneoVideo.tituloOtros(otros.length)}</Text>
        <Text style={styles.pista}>{T.torneoVideo.pistaOtros}</Text>
        {otros.map((v) => {
          const marcado = marcados.includes(v.id);
          const t = tamanos?.[v.id];
          return (
            <View key={v.id} style={[styles.fila, marcado && styles.filaMarcada]}>
              <Pressable
                onPress={() => setViendoUri(v.uri)}
                accessibilityRole="button"
                accessibilityLabel={T.videos.verVideo}
              >
                <Image source={{ uri: v.uri }} style={styles.miniatura} />
                <View style={styles.play}>
                  <IconSymbol name="play.fill" size={16} color="#FFFFFF" />
                </View>
              </Pressable>
              <View style={styles.filaTextos}>
                <Text style={styles.filaTitulo}>
                  {t
                    ? `${formatearDuracion(v.duracion)} · ${formatearTamano(t)}`
                    : formatearDuracion(v.duracion)}
                </Text>
                <Text style={styles.filaEstado}>{horaConDia(v.creationTime)}</Text>
              </View>
              <Pressable
                onPress={() => alternarMarcado(v.id)}
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
        })}
      </ScrollView>

      <View style={[styles.barraInferior, { paddingBottom: insets.bottom + 16 }]}>
        {aBorrar.length > 0 ? (
          <>
            {tamanos === null ? (
              <ActivityIndicator size="small" color={COLORES.acento} />
            ) : tamanoABorrar > 0 ? (
              <Text style={styles.liberaras}>
                {T.torneoVideo.liberaras(formatearTamano(tamanoABorrar))}
              </Text>
            ) : null}
            <Text style={styles.recuperacion}>{TEXTO_RECUPERACION}</Text>
            <Boton
              variante="peligro"
              onPress={confirmarYBorrar}
              disabled={borrando || tamanos === null}
            >
              {T.videos.borrarN(aBorrar.length)}
            </Boton>
            <Boton variante="texto" onPress={() => router.back()} disabled={borrando}>
              {T.torneoVideo.quedarmelosTodos}
            </Boton>
          </>
        ) : (
          <Boton variante="secundario" onPress={() => router.back()}>
            {T.torneoVideo.quedarmelosTodos}
          </Boton>
        )}
      </View>
      {visor}
    </View>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },
  container: {
    flex: 1,
    backgroundColor: COLORES.fondo,
    paddingHorizontal: 20,
  },
  centro: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORES.texto,
    marginTop: 4,
  },
  pista: {
    fontSize: 15,
    color: COLORES.textoSecundario,
    marginTop: 4,
    lineHeight: 21,
  },
  progreso: {
    fontSize: 13,
    color: COLORES.textoSecundario,
    marginTop: 8,
    marginBottom: 10,
  },
  texto: {
    fontSize: 15,
    color: COLORES.textoSecundario,
    textAlign: 'center',
  },
  duelo: {
    flex: 1,
    gap: 12,
    paddingBottom: 24,
  },
  cuadricula: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  celdaDuelo: {
    flex: 1,
    gap: 8,
  },
  celdaCuadricula: {
    width: '47%',
    flexGrow: 1,
    gap: 8,
  },
  clipPulsable: {
    flex: 1,
    minHeight: 140,
  },
  clip: {
    flex: 1,
    borderRadius: 16,
  },
  clipGanador: {
    width: '100%',
    aspectRatio: 9 / 14,
    borderRadius: 20,
  },
  insignia: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  insigniaTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  acciones: {
    gap: 12,
  },
  nota: {
    fontSize: 13,
    color: COLORES.textoSecundario,
    textAlign: 'center',
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
    marginTop: 10,
  },
  miniatura: {
    width: 64,
    height: 84,
    borderRadius: 10,
    backgroundColor: COLORES.borde,
  },
  play: {
    position: 'absolute',
    top: 28,
    left: 18,
    width: 28,
    height: 28,
    borderRadius: 14,
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
  filaEstado: {
    fontSize: 13,
    color: COLORES.textoSecundario,
  },
  filaMarcada: {
    borderColor: COLORES.peligro,
    backgroundColor: COLORES.peligroSuave,
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
    gap: 8,
    backgroundColor: COLORES.fondo,
    borderTopWidth: 1,
    borderTopColor: COLORES.borde,
  },
  liberaras: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORES.acentoOscuro,
    textAlign: 'center',
  },
  recuperacion: {
    fontSize: 13,
    color: COLORES.textoSecundario,
    textAlign: 'center',
  },
});
