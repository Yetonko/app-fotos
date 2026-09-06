import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Animated, FlatList, StyleSheet, View, Text, Pressable, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import { Image } from 'expo-image';

import { detectarRafagas, GrupoDetectado } from '@/lib/escaneo';
import { registrarGrupo } from '@/lib/gruposElegidos';
import { inicializarRevisados, esRevisado, marcarRevisado } from '@/lib/revisados';
import {
  inicializarEtiquetas,
  obtenerNombreActividad,
  guardarNombreActividad,
  formatearEtiqueta,
  formatearFecha,
} from '@/lib/etiquetas';
import { EtiquetaModal } from '@/components/etiqueta-modal';
import { BouncyPressable } from '@/components/bouncy-pressable';

// Misma paleta que el resto de pantallas.
const COLORES = {
  fondo: '#F5EFE3',
  superficie: '#FFFFFF',
  borde: '#EAE2D0',
  acento: '#D98C7A',
  acentoSuave: '#F4DCD3',
  acentoOscuro: '#3B2A28',
  texto: '#2B2420',
  textoSecundario: '#8C8171',
};

type CandidataConUri = { id: string; uri: string };
type GrupoConCandidatas = GrupoDetectado & { candidatas: CandidataConUri[] };

// Mismo texto que en seleccion.tsx / index.tsx.
const TEXTO_RECUPERACION =
  Platform.OS === 'ios'
    ? 'Podrás recuperarlas desde "Eliminados recientemente" durante 30 días si cambias de opinión.'
    : 'Podrás recuperarlas desde Eliminados recientemente si cambias de opinión.';

const FRASES_ESCANEO = [
  'Mirando tus fotos con cariño…',
  'Agrupando lo que va junto…',
  'Reviviendo esta época…',
  'Casi está…',
];

export default function PeriodoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { desde, hasta, etiqueta, id } = useLocalSearchParams<{
    desde?: string;
    hasta?: string;
    etiqueta?: string;
    id?: string;
  }>();

  const [status, setStatus] = useState('Buscando fotos de este periodo...');
  const latidoCorazon = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (status === '¡Listo!') return;
    const bucle = Animated.loop(
      Animated.sequence([
        Animated.timing(latidoCorazon, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(latidoCorazon, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    bucle.start();
    return () => bucle.stop();
  }, [status, latidoCorazon]);
  useEffect(() => {
    if (status === '¡Listo!') return;
    const iv = setInterval(() => setFraseEscaneo((f) => (f + 1) % FRASES_ESCANEO.length), 2200);
    return () => clearInterval(iv);
  }, [status]);
  // Pila de hasta 3 uris para la escena de escaneo (igual que en la Home).
  const [pilaEscaneo, setPilaEscaneo] = useState<string[]>([]);
  const [progresoEscaneo, setProgresoEscaneo] = useState(0);
  const [fraseEscaneo, setFraseEscaneo] = useState(0);
  const [grupos, setGrupos] = useState<GrupoConCandidatas[]>([]);
  // Se incrementa al volver de seleccion.tsx, para reflejar los grupos que
  // se hayan marcado como revisados mientras tanto.
  const [tick, setTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, [])
  );

  // Id del grupo cuyo modal de etiqueta esta abierto ahora mismo, o null.
  const [grupoEditando, setGrupoEditando] = useState<string | null>(null);

  useEffect(() => {
    if (!desde || !hasta) return;

    (async () => {
      await inicializarRevisados();
      await inicializarEtiquetas();

      const desdeMs = Number(desde);
      const hastaMs = Number(hasta);

      // Sin filtro de nitidez a propósito: en un periodo antiguo el objetivo
      // es limpiar duplicados, no elegir la foto perfecta para publicar, así
      // que todas las fotos del grupo pasan a ser candidatas directamente
      // (misma decisión que ya tomamos para simplificar Home).
      const assets = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        createdAfter: desdeMs,
        createdBefore: hastaMs,
        first: 5000,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });

      setStatus('Agrupando fotos parecidas...');
      await new Promise((resolve) => setTimeout(resolve, 400));

      const resultado: GrupoConCandidatas[] = [];

      await detectarRafagas(assets.assets, {
        onProgreso: (indice, total, primeraFotoUri) => {
          setProgresoEscaneo(total > 0 ? (indice + 1) / total : 0);
          if (primeraFotoUri) {
            setPilaEscaneo((pila) =>
              [primeraFotoUri, ...pila.filter((u) => u !== primeraFotoUri)].slice(0, 3)
            );
          }
        },
        onGrupo: (grupo) => {
          const candidatas: CandidataConUri[] = grupo.fotosConUri.map((foto) => ({
            id: foto.id,
            uri: foto.uri,
          }));

          registrarGrupo(grupo.grupoId, candidatas, [], grupo.fotos[0]?.creationTime);

          resultado.push({ ...grupo, candidatas });
        },
      });

      setGrupos(resultado);
      setPilaEscaneo([]);
      setStatus('¡Listo!');
    })();
  }, [desde, hasta]);

  // Si no hay grupos, o todos los grupos de este periodo ya estan
  // revisados, se marca el periodo entero como revisado (mismo mecanismo
  // que en Home, reutilizando marcarRevisado con el id del periodo).
  useEffect(() => {
    if (status !== '¡Listo!' || !id) return;
    const todosRevisados = grupos.length === 0 || grupos.every((g) => esRevisado(g.grupoId));
    if (todosRevisados) {
      marcarRevisado(id);
    }
  }, [grupos, tick, id, status]);

  // No revisados primero, revisados al final (mismo criterio que en Home).
  const gruposOrdenados = [...grupos].sort((a, b) => {
    const aRevisado = esRevisado(a.grupoId);
    const bRevisado = esRevisado(b.grupoId);
    if (aRevisado === bRevisado) return 0;
    return aRevisado ? 1 : -1;
  });

  const guardarEtiquetaGrupo = async (nombre: string) => {
    if (!grupoEditando) return;
    await guardarNombreActividad(grupoEditando, nombre);
    setTick((t) => t + 1);
  };

  // Borra el grupo entero (todas sus fotos, sin elegir ninguna). Mismo
  // criterio que en index.tsx: para fotos-recordatorio donde ninguna
  // merece quedarse.
  const descartarGrupoCompleto = (item: GrupoConCandidatas) => {
    const idsTodo = item.candidatas.map((c) => c.id);
    Alert.alert(
      'Borrar todas las fotos',
      `Se ${idsTodo.length === 1 ? 'borrará' : 'borrarán'} ${idsTodo.length} ${idsTodo.length === 1 ? 'foto' : 'fotos'} de este momento, sin elegir ninguna. ${TEXTO_RECUPERACION}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar todas',
          style: 'destructive',
          onPress: async () => {
            try {
              const borradoOk = await MediaLibrary.deleteAssetsAsync(idsTodo);
              if (!borradoOk) {
                Alert.alert(
                  'No se ha borrado nada',
                  'Cancelaste la confirmación del sistema. Tus fotos siguen en el carrete.'
                );
                return;
              }
              setGrupos((actuales) => actuales.filter((g) => g.grupoId !== item.grupoId));
            } catch {
              Alert.alert(
                'No hemos podido eliminar las fotos.',
                'Revisa los permisos e inténtalo de nuevo.'
              );
            }
          },
        },
      ]
    );
  };

  const grupoEditandoData = grupos.find((g) => g.grupoId === grupoEditando);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <Pressable style={styles.botonVolver} onPress={() => router.back()} hitSlop={8}>
        <Text style={styles.botonVolverTexto}>‹ Volver</Text>
      </Pressable>
      <Text style={styles.titulo}>{etiqueta ?? 'Periodo'}</Text>

      {status !== '¡Listo!' && (
        <View style={styles.centrado}>
          {pilaEscaneo.length > 0 && (
            <View style={styles.pilaContenedor}>
              {pilaEscaneo[2] && (
                <View style={[styles.polaroidMarco, styles.polaroidDetras2]}>
                  <Image source={{ uri: pilaEscaneo[2] }} style={styles.polaroidFoto} />
                </View>
              )}
              {pilaEscaneo[1] && (
                <View style={[styles.polaroidMarco, styles.polaroidDetras1]}>
                  <Image source={{ uri: pilaEscaneo[1] }} style={styles.polaroidFoto} />
                </View>
              )}
              <View style={styles.polaroidMarco}>
                <Image source={{ uri: pilaEscaneo[0] }} style={styles.polaroidFoto} />
                <Animated.View
                  style={[
                    styles.corazonSello,
                    { transform: [{ scale: latidoCorazon }, { rotate: '10deg' }] },
                  ]}
                >
                  <Text style={styles.corazonSelloTexto}>♥</Text>
                </Animated.View>
              </View>
            </View>
          )}
          <Text style={styles.fraseEscaneo}>{FRASES_ESCANEO[fraseEscaneo]}</Text>
          <View style={styles.barraProgreso}>
            <View
              style={[styles.barraProgresoRelleno, { width: `${Math.round(progresoEscaneo * 100)}%` }]}
            />
          </View>
        </View>
      )}

      {status === '¡Listo!' && grupos.length === 0 && (
        <View style={styles.centrado}>
          <Text style={styles.emoji}>✨</Text>
          <Text style={styles.textoVacio}>
            No hemos encontrado fotos casi iguales en este periodo.
          </Text>
        </View>
      )}

      {status === '¡Listo!' && grupos.length > 0 && (
        <FlatList
          data={gruposOrdenados}
          keyExtractor={(item) => item.grupoId}
          style={styles.lista}
          extraData={tick}
          renderItem={({ item, index }) => {
            const portada = item.candidatas[0]?.uri;
            const revisado = esRevisado(item.grupoId);
            return (
              <View style={[styles.tarjeta, revisado && styles.tarjetaRevisada]}>
                {portada && (
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: '/seleccion', params: { grupoId: item.grupoId } })
                    }
                  >
                    <Image source={{ uri: portada }} style={styles.portada} />
                  </Pressable>
                )}
                <View style={styles.tarjetaCuerpo}>
                  <Text style={styles.tarjetaTitulo}>
                    Momento {index + 1} · {item.fotos.length} fotos casi iguales
                    {revisado ? '  ·  Revisado ✓' : ''}
                  </Text>
                  <Pressable onPress={() => setGrupoEditando(item.grupoId)} hitSlop={6}>
                    <Text style={styles.tarjetaEtiqueta}>
                      {formatearEtiqueta(item.grupoId, item.fotos[0].creationTime)} ✏️
                    </Text>
                  </Pressable>
                  <BouncyPressable
                    style={styles.boton}
                    onPress={() =>
                      router.push({ pathname: '/seleccion', params: { grupoId: item.grupoId } })
                    }
                  >
                    <Text style={styles.textoBoton}>Elegir la mejor foto ✨</Text>
                  </BouncyPressable>

                  {!revisado && (
                    <Pressable
                      style={styles.botonDescartarGrupo}
                      onPress={() => descartarGrupoCompleto(item)}
                      hitSlop={6}
                    >
                      <Text style={styles.textoDescartarGrupo}>🗑 No quiero ninguna de estas</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      <EtiquetaModal
        visible={grupoEditando !== null}
        valorInicial={grupoEditando ? obtenerNombreActividad(grupoEditando) ?? '' : ''}
        etiquetaFecha={
          grupoEditandoData ? formatearFecha(grupoEditandoData.fotos[0].creationTime) : ''
        }
        onGuardar={guardarEtiquetaGrupo}
        onCerrar={() => setGrupoEditando(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // paddingTop lo aporta insets.top en el render
    flex: 1,
    backgroundColor: COLORES.fondo,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  botonVolver: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingRight: 12,
    marginBottom: 4,
  },
  botonVolverTexto: {
    fontSize: 17,
    color: COLORES.acento,
    fontWeight: '600',
  },
  titulo: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORES.texto,
    marginBottom: 16,
    textAlign: 'center',
  },
  centrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORES.texto,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  pilaContenedor: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  polaroidMarco: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 22,
    borderRadius: 16,
    transform: [{ rotate: '-2deg' }],
    shadowColor: '#3B2A28',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 6,
  },
  polaroidDetras1: {
    position: 'absolute',
    opacity: 0.7,
    transform: [{ rotate: '-9deg' }, { translateX: -14 }, { translateY: 4 }],
    shadowOpacity: 0.1,
    elevation: 2,
  },
  polaroidDetras2: {
    position: 'absolute',
    opacity: 0.45,
    transform: [{ rotate: '8deg' }, { translateX: 16 }, { translateY: 10 }],
    shadowOpacity: 0.08,
    elevation: 1,
  },
  polaroidFoto: {
    width: 200,
    height: 200,
    borderRadius: 12,
    backgroundColor: COLORES.borde,
  },
  corazonSello: {
    position: 'absolute',
    top: -14,
    right: -14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORES.acento,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: '#D85A30',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  corazonSelloTexto: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 24,
  },
  fraseEscaneo: {
    textAlign: 'center',
    color: COLORES.acentoOscuro,
    fontSize: 17,
    fontStyle: 'italic',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginTop: 24,
    marginBottom: 16,
  },
  barraProgreso: {
    width: 150,
    height: 10,
    borderRadius: 999,
    backgroundColor: COLORES.borde,
    overflow: 'hidden',
  },
  barraProgresoRelleno: {
    height: 10,
    borderRadius: 999,
    backgroundColor: COLORES.acento,
  },
  emoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  textoVacio: {
    fontSize: 15,
    color: COLORES.textoSecundario,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  lista: {
    flex: 1,
  },
  tarjeta: {
    backgroundColor: COLORES.superficie,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORES.borde,
    overflow: 'hidden',
    marginBottom: 16,
  },
  tarjetaRevisada: {
    opacity: 0.55,
  },
  portada: {
    width: '100%',
    height: 180,
  },
  tarjetaCuerpo: {
    padding: 14,
  },
  tarjetaTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORES.texto,
    marginBottom: 10,
  },
  tarjetaEtiqueta: {
    alignSelf: 'flex-start',
    color: COLORES.acentoOscuro,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: COLORES.acentoSuave,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  boton: {
    backgroundColor: COLORES.acento,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  textoBoton: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  botonDescartarGrupo: {
    alignSelf: 'center',
    marginTop: 10,
    paddingVertical: 4,
  },
  textoDescartarGrupo: {
    color: COLORES.textoSecundario,
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
