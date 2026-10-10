import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, Alert, Share, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';

import { fotosDeVentana, ordenarPorTiempo, VentanaMomento, FotoMomento } from '@/lib/momento-rapido';
import { guardarEnAlbumFavoritas } from '@/lib/album';
import { ZoomablePhotoModal } from '@/components/zoomable-photo-modal';
import { VisorVideo } from '@/components/visor-video';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  borrarCopiaCompartida,
  formatearDuracion,
  prepararVideoParaCompartir,
} from '@/lib/videos';
import { Boton } from '@/components/boton';
import { COLORES } from '@/constants/estilo';
import { T } from '@/lib/i18n';


const VENTANAS: { clave: VentanaMomento; etiqueta: string }[] = [
  { clave: '5min', etiqueta: T.momento.ventana5min },
  { clave: '1h', etiqueta: T.momento.ventana1h },
  { clave: 'hoy', etiqueta: T.momento.ventanaHoy },
];

type FaseMomento = 'seleccion' | 'confirmacion';

export default function MomentoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [ventana, setVentana] = useState<VentanaMomento>('1h');
  const [fotos, setFotos] = useState<FotoMomento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fase, setFase] = useState<FaseMomento>('seleccion');

  // Ids marcadas para publicar y descartadas. Lo que no está en ninguno de
  // los dos conjuntos es "no tocado": se queda en el carrete y seguirá su
  // curso normal (torneo, etc.). El modo momento NO marca revisados ni
  // registra ganadoras: no cruza con los otros sistemas.
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [descartadas, setDescartadas] = useState<string[]>([]);

  const [ampliadaId, setAmpliadaId] = useState<string | null>(null);
  const [viendoVideoId, setViendoVideoId] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);
  // Guarda inmediata contra el doble toque en Publicar (copiar un vídeo
  // tarda y el botón tarda un instante en desactivarse).
  const publicandoRef = useRef(false);
  // Fotos ya copiadas al álbum Fondly en esta visita: si cierra el compartir
  // y vuelve a publicar, no se copian otra vez (cada copia duplica la foto).
  const guardadasEnAlbumRef = useRef(new Set<string>());

  // Carga las fotos cada vez que cambia la ventana elegida.
  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    fotosDeVentana(ventana)
      .then((res) => {
        if (!cancelado) setFotos(res);
      })
      .catch(() => {
        if (!cancelado) setFotos([]);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [ventana]);

  const alternarMarcada = (id: string) => {
    setDescartadas((d) => d.filter((x) => x !== id)); // marcar quita el descarte
    setMarcadas((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  };

  const alternarDescartada = (id: string) => {
    setMarcadas((m) => m.filter((x) => x !== id)); // descartar quita la marca
    setDescartadas((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  };

  // Fotos que se ven en la cuadrícula: las de la ventana que no se han
  // descartado (las descartadas desaparecen de la vista, pero NO se borran).
  const visibles = fotos.filter((f) => !descartadas.includes(f.id));

  const fotosMarcadas = fotos.filter((f) => marcadas.includes(f.id));
  const fotosDescartadas = fotos.filter((f) => descartadas.includes(f.id));
  // El visor de fotos solo pasa por fotos; los vídeos se abren en el suyo.
  const fotosVisibles = visibles.filter((f) => !f.esVideo);

  // "3 fotos", "1 vídeo", "2 fotos y 1 vídeo"
  const describir = (lista: FotoMomento[]) => {
    const nv = lista.filter((f) => f.esVideo).length;
    return T.comun.fotosYVideos(lista.length - nv, nv);
  };

  const abrir = (foto: FotoMomento) => {
    if (foto.esVideo) setViendoVideoId(foto.id);
    else setAmpliadaId(foto.id);
  };

  // ── Publicar: guarda las marcadas en el álbum Fondly y abre el compartir
  //    de la primera. Con varias, iOS no garantiza el carrusel, así que la
  //    vía fiable es dejarlas juntas en el álbum y que ella las añada. ──
  // Abre el compartir de una foto. Devuelve false si ella cierra el menú
  // sin compartir (iOS lo indica; en Android no se sabe y se da por hecho).
  const compartirFoto = async (foto: FotoMomento): Promise<boolean> => {
    if (foto.esVideo) {
      const url = await prepararVideoParaCompartir(foto);
      try {
        const resultado = await Share.share({ url });
        return resultado.action !== Share.dismissedAction;
      } finally {
        // La copia temporal ya no hace falta: fuera, para no ocupar espacio.
        await borrarCopiaCompartida(url);
      }
    }
    const info = await MediaLibrary.getAssetInfoAsync(foto.id);
    const resultado = await Share.share({ url: info.localUri ?? foto.uri });
    return resultado.action !== Share.dismissedAction;
  };

  // Solo tras compartir de verdad: si hay descartadas, ofrecer borrarlas
  // (opcional). Si cerró el menú sin compartir, se queda donde estaba.
  const trasCompartir = (compartido: boolean) => {
    if (!compartido) return;
    if (fotosDescartadas.length > 0) {
      ofrecerBorrarDescartadas();
    } else {
      router.back();
    }
  };

  const publicar = async () => {
    if (fotosMarcadas.length === 0 || publicandoRef.current) return;
    publicandoRef.current = true;
    setPublicando(true);
    try {
      const ordenadas = ordenarPorTiempo(fotosMarcadas);

      if (ordenadas.length === 1) {
        // Una sola: compartir directo, como en el torneo.
        trasCompartir(await compartirFoto(ordenadas[0]));
      } else {
        // Varias: guardarlas todas en el álbum Fondly, avisar de que están
        // juntas allí y, solo cuando cierre el aviso, abrir el compartir de
        // la primera (un aviso y el menú de compartir a la vez se pisan).
        for (const foto of ordenadas) {
          if (guardadasEnAlbumRef.current.has(foto.id)) continue;
          const ok = await guardarEnAlbumFavoritas(foto.id);
          if (!ok) throw new Error('No se pudo guardar en el álbum');
          guardadasEnAlbumRef.current.add(foto.id);
        }
        Alert.alert(T.momento.listasTitulo, T.momento.listasTexto(describir(ordenadas)), [
          {
            text: T.momento.entendido,
            onPress: async () => {
              // Copiar un vídeo para compartirlo puede tardar unos segundos.
              if (publicandoRef.current) return;
              publicandoRef.current = true;
              setPublicando(true);
              try {
                trasCompartir(await compartirFoto(ordenadas[0]));
              } catch {
                Alert.alert(T.comun.errorCompartir, T.comun.intentaloDeNuevo);
              } finally {
                publicandoRef.current = false;
                setPublicando(false);
              }
            },
          },
        ]);
      }
    } catch {
      Alert.alert(T.comun.errorCompartir, T.comun.intentaloDeNuevo);
    } finally {
      publicandoRef.current = false;
      setPublicando(false);
    }
  };

  // Borrado SIEMPRE opcional y con confirmación, nunca automático.
  const ofrecerBorrarDescartadas = () => {
    Alert.alert(
      T.momento.borrarDescartadasTitulo,
      T.momento.borrarDescartadasTexto(describir(fotosDescartadas)),
      [
        { text: T.momento.noDejarlas, style: 'cancel', onPress: () => router.back() },
        {
          text: T.momento.borrar,
          style: 'destructive',
          onPress: async () => {
            try {
              const borradoOk = await MediaLibrary.deleteAssetsAsync(
                fotosDescartadas.map((f) => f.id)
              );
              if (!borradoOk) {
                // Canceló el aviso del sistema: no se ha borrado nada.
                Alert.alert(
                  T.comun.borrarTodo.nadaBorradoTitulo,
                  T.comun.borrarTodo.nadaBorradoTexto
                );
                return;
              }
            } catch {
              Alert.alert(T.comun.borrarTodo.errorTitulo, T.comun.borrarTodo.errorTexto);
              return;
            }
            router.back();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      {/* ── Cabecera ── */}
      <View style={styles.cabecera}>
        <Text style={styles.titulo}>{T.momento.titulo}</Text>
        <Text style={styles.subtitulo}>{T.momento.subtitulo}</Text>
      </View>

      {/* ── Selector de ventana ── */}
      <View style={styles.selectorVentana}>
        {VENTANAS.map((v) => (
          <Pressable
            key={v.clave}
            onPress={() => setVentana(v.clave)}
            style={[styles.chipVentana, ventana === v.clave && styles.chipVentanaActivo]}
          >
            <Text
              style={[
                styles.chipVentanaTexto,
                ventana === v.clave && styles.chipVentanaTextoActivo,
              ]}
            >
              {v.etiqueta}
            </Text>
          </Pressable>
        ))}
      </View>

      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator color={COLORES.acento} />
        </View>
      ) : visibles.length === 0 ? (
        <View style={styles.centro}>
          <Text style={styles.vacioTexto}>{T.momento.vacio}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {visibles.map((foto) => {
            const marcada = marcadas.includes(foto.id);
            return (
              <View key={foto.id} style={styles.celda}>
                <Pressable onPress={() => abrir(foto)}>
                  <Image source={{ uri: foto.uri }} style={styles.miniatura} />
                  {foto.esVideo && (
                    <View style={styles.insigniaVideo}>
                      <IconSymbol name="play.fill" size={12} color="#FFFFFF" />
                      <Text style={styles.insigniaVideoTexto}>
                        {formatearDuracion(foto.duracion)}
                      </Text>
                    </View>
                  )}
                </Pressable>

                {marcada && (
                  <View style={styles.marcaCheck}>
                    <Text style={styles.marcaCheckTexto}>✓</Text>
                  </View>
                )}

                {/* Botones de acción sobre cada foto */}
                <View style={styles.accionesFoto}>
                  <Pressable
                    onPress={() => alternarMarcada(foto.id)}
                    style={[styles.botonMini, marcada && styles.botonMiniActivo]}
                    hitSlop={6}
                  >
                    <Text style={[styles.botonMiniTexto, marcada && styles.botonMiniTextoActivo]}>
                      {marcada ? T.momento.quitar : T.momento.publicar}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => alternarDescartada(foto.id)}
                    style={styles.botonMiniDescartar}
                    hitSlop={6}
                  >
                    <Text style={styles.botonMiniDescartarTexto}>{T.momento.descartar}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── Barra inferior de publicar ── */}
      {marcadas.length > 0 && (
        <View style={styles.barraInferior}>
          <Boton onPress={publicar} disabled={publicando}>
            {publicando ? T.momento.preparando : T.momento.publicarN(describir(fotosMarcadas))}
          </Boton>
        </View>
      )}

      {/* ── Visor ampliado (reutiliza el modal navegable con swipe) ── */}
      <ZoomablePhotoModal
        fotos={fotosVisibles.map((f) => ({ id: f.id, uri: f.uri }))}
        indiceInicial={Math.max(0, fotosVisibles.findIndex((f) => f.id === ampliadaId))}
        visible={!!ampliadaId}
        onClose={() => setAmpliadaId(null)}
        onElegir={(foto) => alternarMarcada(foto.id)}
      />

      {viendoVideoId && (
        <VisorVideo videoId={viendoVideoId} onClose={() => setViendoVideoId(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },
  cabecera: {
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  titulo: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORES.texto,
    textAlign: 'left',
  },
  subtitulo: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORES.acentoTexto,
    textAlign: 'left',
    marginTop: 4,
  },
  selectorVentana: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  chipVentana: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORES.borde,
  },
  chipVentanaActivo: {
    backgroundColor: COLORES.acentoOscuro,
    borderColor: COLORES.acentoOscuro,
  },
  chipVentanaTexto: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORES.textoSecundario,
  },
  chipVentanaTextoActivo: {
    color: '#FFFFFF',
  },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  vacioTexto: {
    textAlign: 'center',
    color: COLORES.textoSecundario,
    fontSize: 15,
    lineHeight: 22,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  celda: {
    position: 'relative',
    width: '47%',
  },
  miniatura: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    backgroundColor: COLORES.borde,
  },
  insigniaVideo: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  insigniaVideoTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  marcaCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORES.acento,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcaCheckTexto: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  accionesFoto: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  botonMini: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORES.acentoOscuro,
    alignItems: 'center',
  },
  botonMiniActivo: {
    backgroundColor: COLORES.acentoOscuro,
  },
  botonMiniTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORES.acentoOscuro,
  },
  botonMiniTextoActivo: {
    color: '#FFFFFF',
  },
  botonMiniDescartar: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  botonMiniDescartarTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORES.textoSecundario,
  },
  barraInferior: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 34,
    backgroundColor: COLORES.fondo,
    borderTopWidth: 1,
    borderTopColor: COLORES.borde,
  },
});
