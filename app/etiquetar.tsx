import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import { EtiquetaModal } from '@/components/etiqueta-modal';
import { COLORES } from '@/constants/estilo';
import { guardarEnAlbumCarrusel } from '@/lib/album';
import { T } from '@/lib/i18n';
import { fechaConDia } from '@/lib/idioma';
import {
  etiquetaDeFoto,
  etiquetarFotos,
  inicializarEtiquetasFotos,
  nombresUsados,
} from '@/lib/etiquetas-fotos';

type Foto = { id: string; uri: string; creationTime: number };
type Dia = { clave: string; fecha: number; fotos: Foto[] };
// La lista va por filas (cabecera de día o fila de 4 fotos), para que solo
// se pinte lo que se ve aunque haya miles de fotos.
type Fila = { clave: string; dia: Dia; fotos: Foto[] | null };

const COLUMNAS = 4;
const HUECO = 4;
const LADO = Math.floor((Dimensions.get('window').width - 40 - HUECO * (COLUMNAS - 1)) / COLUMNAS);

// Tope de seguridad: una época normal tiene muchas menos.
const MAX_FOTOS = 3000;

function claveDia(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Etiquetar a mano: ella elige las fotos de una experiencia (o el día
// entero de un toque) y les pone nombre. No borra ni mueve nada.
export default function EtiquetarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { desde, hasta, etiqueta } = useLocalSearchParams<{
    desde?: string;
    hasta?: string;
    etiqueta?: string;
  }>();

  const [fotos, setFotos] = useState<Foto[] | null>(null);
  const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set());
  const guardandoRef = useRef(false);
  const [modal, setModal] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!desde || !hasta) {
      setFotos([]);
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        await inicializarEtiquetasFotos();
        const r = await MediaLibrary.getAssetsAsync({
          mediaType: 'photo',
          createdAfter: Number(desde),
          createdBefore: Number(hasta),
          first: MAX_FOTOS,
          sortBy: [[MediaLibrary.SortBy.creationTime, true]],
        });
        if (!cancelado) {
          setFotos(r.assets.map((a) => ({ id: a.id, uri: a.uri, creationTime: a.creationTime })));
        }
      } catch {
        if (!cancelado) setFotos([]);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [desde, hasta]);

  const dias: Dia[] = useMemo(() => {
    const mapa = new Map<string, Dia>();
    for (const f of fotos ?? []) {
      const k = claveDia(f.creationTime);
      if (!mapa.has(k)) mapa.set(k, { clave: k, fecha: f.creationTime, fotos: [] });
      mapa.get(k)!.fotos.push(f);
    }
    return [...mapa.values()];
  }, [fotos]);

  const filas: Fila[] = useMemo(() => {
    const r: Fila[] = [];
    for (const dia of dias) {
      r.push({ clave: `d-${dia.clave}`, dia, fotos: null });
      for (let i = 0; i < dia.fotos.length; i += COLUMNAS) {
        r.push({ clave: `f-${dia.clave}-${i}`, dia, fotos: dia.fotos.slice(i, i + COLUMNAS) });
      }
    }
    return r;
  }, [dias]);

  const alternar = (id: string) =>
    setSeleccion((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const alternarDia = (dia: Dia) => {
    setSeleccion((s) => {
      const todas = dia.fotos.every((f) => s.has(f.id));
      const n = new Set(s);
      for (const f of dia.fotos) {
        if (todas) n.delete(f.id);
        else n.add(f.id);
      }
      return n;
    });
  };

  const guardar = async (nombre: string) => {
    const limpio = nombre.trim();
    if (!limpio || seleccion.size === 0 || guardandoRef.current) return;
    guardandoRef.current = true;
    setGuardando(true);
    const ids = [...seleccion];
    try {
      await etiquetarFotos(ids, limpio);
      // Solo iPhone: un álbum solo guarda referencias (no ocupa espacio).
      // En Android copiaría las fotos, así que allí no se crea.
      let album = '';
      if (Platform.OS === 'ios') {
        const nombreAlbum = T.etiquetar.nombreAlbum(limpio);
        if (await guardarEnAlbumCarrusel(nombreAlbum, ids)) album = nombreAlbum;
      }
      setSeleccion(new Set());
      Alert.alert(T.comun.listo, T.etiquetar.hecho(ids.length, limpio, album));
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <BotonVolver onPress={() => router.back()} />
      <Text style={styles.titulo}>{T.etiquetar.titulo}</Text>
      <Text style={styles.subtitulo}>{T.etiquetar.subtitulo(etiqueta ?? '')}</Text>

      {fotos === null ? (
        <View style={styles.centro}>
          <ActivityIndicator color={COLORES.acento} />
        </View>
      ) : dias.length === 0 ? (
        <View style={styles.centro}>
          <Text style={styles.subtitulo}>{T.etiquetar.vacio}</Text>
        </View>
      ) : (
        <FlatList
          data={filas}
          keyExtractor={(f) => f.clave}
          extraData={seleccion}
          initialNumToRender={12}
          windowSize={7}
          contentContainerStyle={{ paddingBottom: seleccion.size > 0 ? 130 : 40 }}
          renderItem={({ item }) => {
            if (!item.fotos) {
              const todas = item.dia.fotos.every((f) => seleccion.has(f.id));
              return (
                <View style={styles.diaCabecera}>
                  <Text style={styles.diaTitulo}>
                    {`${fechaConDia(item.dia.fecha)} · ${T.comun.fotos(item.dia.fotos.length)}`}
                  </Text>
                  <Pressable onPress={() => alternarDia(item.dia)} hitSlop={8}>
                    <Text style={styles.diaAccion}>
                      {todas ? T.etiquetar.quitarDia : T.etiquetar.elegirDia}
                    </Text>
                  </Pressable>
                </View>
              );
            }
            return (
              <View style={styles.rejilla}>
                {item.fotos.map((f) => {
                  const elegida = seleccion.has(f.id);
                  const nombre = etiquetaDeFoto(f.id);
                  return (
                    <Pressable
                      key={f.id}
                      onPress={() => alternar(f.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: elegida }}
                    >
                      <Image source={{ uri: f.uri }} style={styles.miniatura} />
                      {nombre && !elegida && (
                        <View style={styles.chip}>
                          <Text style={styles.chipTexto} numberOfLines={1}>
                            {nombre}
                          </Text>
                        </View>
                      )}
                      {elegida && (
                        <View style={styles.elegida}>
                          <Text style={styles.elegidaTexto}>✓</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            );
          }}
        />
      )}

      {seleccion.size > 0 && (
        <View style={[styles.barraInferior, { paddingBottom: insets.bottom + 16 }]}>
          <Boton icono="pencil" onPress={() => setModal(true)} disabled={guardando}>
            {T.etiquetar.etiquetarN(seleccion.size)}
          </Boton>
        </View>
      )}

      <EtiquetaModal
        visible={modal}
        valorInicial=""
        etiquetaFecha={T.comun.fotos(seleccion.size)}
        titulo={T.etiquetar.modalTitulo}
        explicacion={T.etiquetar.modalExplicacion}
        sugerencias={modal ? nombresUsados() : []}
        onGuardar={guardar}
        onCerrar={() => setModal(false)}
      />
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
  },
  subtitulo: {
    fontSize: 15,
    color: COLORES.textoSecundario,
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 21,
  },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diaCabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 8,
    minHeight: 32,
  },
  diaTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORES.texto,
  },
  diaAccion: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORES.acentoTexto,
  },
  rejilla: {
    flexDirection: 'row',
    gap: HUECO,
    marginBottom: HUECO,
  },
  miniatura: {
    width: LADO,
    height: LADO,
    borderRadius: 6,
    backgroundColor: COLORES.borde,
  },
  chip: {
    position: 'absolute',
    left: 3,
    right: 3,
    bottom: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  chipTexto: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  elegida: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: COLORES.acentoTexto,
    backgroundColor: 'rgba(168,84,63,0.25)',
    alignItems: 'flex-end',
    padding: 4,
  },
  elegidaTexto: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    backgroundColor: COLORES.acentoTexto,
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
    textAlign: 'center',
    lineHeight: 22,
  },
  barraInferior: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: COLORES.fondo,
    borderTopWidth: 1,
    borderTopColor: COLORES.borde,
  },
});
