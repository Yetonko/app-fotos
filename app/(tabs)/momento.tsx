import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, Alert, Share, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';

import { fotosDeVentana, ordenarPorTiempo, VentanaMomento, FotoMomento } from '@/lib/momento-rapido';
import { guardarEnAlbumFavoritas } from '@/lib/album';
import { ZoomablePhotoModal } from '@/components/zoomable-photo-modal';
import { BouncyPressable } from '@/components/bouncy-pressable';

// --- Sistema de diseño (mismos valores que el resto de pantallas) --------
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

const VENTANAS: { clave: VentanaMomento; etiqueta: string }[] = [
  { clave: '5min', etiqueta: 'Últimos 5 min' },
  { clave: '1h', etiqueta: 'Última hora' },
  { clave: 'hoy', etiqueta: 'Hoy' },
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
  const [publicando, setPublicando] = useState(false);

  // Carga las fotos cada vez que cambia la ventana elegida.
  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    fotosDeVentana(ventana).then((res) => {
      if (!cancelado) {
        setFotos(res);
        setCargando(false);
      }
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

  // ── Publicar: guarda las marcadas en el álbum Fondly y abre el compartir
  //    de la primera. Con varias, iOS no garantiza el carrusel, así que la
  //    vía fiable es dejarlas juntas en el álbum y que ella las añada. ──
  const publicar = async () => {
    if (fotosMarcadas.length === 0) return;
    setPublicando(true);
    try {
      const ordenadas = ordenarPorTiempo(fotosMarcadas);

      if (ordenadas.length === 1) {
        // Una sola: compartir directo, como en el torneo.
        const info = await MediaLibrary.getAssetInfoAsync(ordenadas[0].id);
        await Share.share({ url: info.localUri ?? ordenadas[0].uri });
      } else {
        // Varias: guardarlas todas en el álbum Fondly y abrir el compartir
        // de la primera, avisando de que están juntas en el álbum.
        for (const foto of ordenadas) {
          await guardarEnAlbumFavoritas(foto.id);
        }
        Alert.alert(
          '¡Tus fotos están listas!',
          `Hemos guardado tus ${ordenadas.length} fotos juntas en tu álbum "Fondly · Favoritas". Ábrelo desde Instagram para publicarlas como carrusel.`,
          [{ text: 'Entendido' }]
        );
        const info = await MediaLibrary.getAssetInfoAsync(ordenadas[0].id);
        await Share.share({ url: info.localUri ?? ordenadas[0].uri });
      }

      // Tras compartir, si hay descartadas, ofrecer borrarlas (opcional).
      if (fotosDescartadas.length > 0) {
        ofrecerBorrarDescartadas();
      } else {
        router.back();
      }
    } catch {
      Alert.alert('No hemos podido abrir las opciones para compartir.', 'Inténtalo de nuevo.');
    } finally {
      setPublicando(false);
    }
  };

  // Borrado SIEMPRE opcional y con confirmación, nunca automático.
  const ofrecerBorrarDescartadas = () => {
    Alert.alert(
      '¿Borrar las descartadas?',
      `Descartaste ${fotosDescartadas.length} ${fotosDescartadas.length === 1 ? 'foto' : 'fotos'}. ¿Quieres borrarlas del carrete para hacer sitio? Podrás recuperarlas 30 días desde Fotos.`,
      [
        { text: 'No, dejarlas', style: 'cancel', onPress: () => router.back() },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            try {
              await MediaLibrary.deleteAssetsAsync(fotosDescartadas.map((f) => f.id));
            } catch {
              // Si falla el borrado, no bloqueamos la salida.
            }
            router.back();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {/* ── Cabecera ── */}
      <View style={styles.cabecera}>
        <Text style={styles.titulo}>⚡ Momento</Text>
        <Text style={styles.subtitulo}>Súbelo antes de que se acabe</Text>
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
          <Text style={styles.vacioTexto}>
            No hay fotos en este rango. Prueba a ampliar la ventana de tiempo.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {visibles.map((foto) => {
            const marcada = marcadas.includes(foto.id);
            return (
              <View key={foto.id} style={styles.celda}>
                <Pressable onPress={() => setAmpliadaId(foto.id)}>
                  <Image source={{ uri: foto.uri }} style={styles.miniatura} />
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
                      {marcada ? 'Quitar' : 'Publicar'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => alternarDescartada(foto.id)}
                    style={styles.botonMiniDescartar}
                    hitSlop={6}
                  >
                    <Text style={styles.botonMiniDescartarTexto}>Descartar</Text>
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
          <BouncyPressable style={styles.botonPublicar} onPress={publicar} disabled={publicando}>
            <Text style={styles.botonPublicarTexto}>
              {publicando
                ? 'Preparando...'
                : `Publicar ${marcadas.length} ${marcadas.length === 1 ? 'foto' : 'fotos'}`}
            </Text>
          </BouncyPressable>
        </View>
      )}

      {/* ── Visor ampliado (reutiliza el modal navegable con swipe) ── */}
      <ZoomablePhotoModal
        fotos={visibles.map((f) => ({ id: f.id, uri: f.uri }))}
        indiceInicial={Math.max(0, visibles.findIndex((f) => f.id === ampliadaId))}
        visible={!!ampliadaId}
        onClose={() => setAmpliadaId(null)}
        onElegir={(foto) => alternarMarcada(foto.id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },
  cabecera: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  titulo: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORES.texto,
    textAlign: 'center',
  },
  subtitulo: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORES.acento,
    textAlign: 'center',
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
  botonPublicar: {
    backgroundColor: COLORES.acentoOscuro,
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
  },
  botonPublicarTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
