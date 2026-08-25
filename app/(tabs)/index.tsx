import { useCallback, useEffect, useState } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { FlatList, StyleSheet, Pressable, View, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { GrupoFotos } from '@/lib/agrupar';
import { detectarRafagas } from '@/lib/escaneo';
import { obtenerGanadora, registrarGrupo } from '@/lib/gruposElegidos';
import { inicializarRevisados, esRevisado } from '@/lib/revisados';
import {
  inicializarEtiquetas,
  obtenerNombreActividad,
  guardarNombreActividad,
  formatearEtiqueta,
  formatearFecha,
} from '@/lib/etiquetas';
import { EtiquetaModal } from '@/components/etiqueta-modal';
import { CLAVE_ONBOARDING_VISTO } from '@/lib/onboarding';
import { BouncyPressable } from '@/components/bouncy-pressable';
import { Image } from 'expo-image';

// --- Sistema de diseño (paleta cálida, suavizada hacia coral-rosado) -----
// Centralizado aquí para reutilizar los mismos valores en seleccion.tsx.
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
// -------------------------------------------------------------------------

// Igual que en bienvenida.tsx: "iPhone" en iOS, "móvil" en cualquier otro
// caso (Android), sin necesidad de ninguna librería nueva.
const DISPOSITIVO = Platform.OS === 'ios' ? 'iPhone' : 'móvil';

type CandidataConUri = { id: string; uri: string; nitidez?: number };

type GrupoConDistancias = GrupoFotos & {
  distancias: number[];
  candidatas: CandidataConUri[];
  descartadas: CandidataConUri[];
  grupoId: string;
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState('Preparando tu selección...');
  const [totalFotos, setTotalFotos] = useState<number | null>(null);
  const [grupos, setGrupos] = useState<GrupoConDistancias[]>([]);
  // Uri de la primera foto del grupo que se está analizando ahora mismo,
  // para mostrarla en la pantalla de carga y que el usuario vea que algo
  // está pasando de verdad, no solo un texto fijo.
  const [previewEscaneo, setPreviewEscaneo] = useState<string | null>(null);
  // Se incrementa cada vez que la pantalla vuelve a tener el foco, para forzar
  // un re-render y reflejar las ganadoras marcadas en gruposElegidos.ts.
  const [tick, setTick] = useState(0);
  // Id del grupo cuyo modal de etiqueta esta abierto ahora mismo, o null
  // si no hay ninguno abierto.
  const [grupoEditando, setGrupoEditando] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, [])
  );

  useEffect(() => {
    (async () => {
      let yaVioOnboarding = true;
      try {
        yaVioOnboarding = (await AsyncStorage.getItem(CLAVE_ONBOARDING_VISTO)) === 'true';
      } catch {
        // Si falla la lectura, asumimos que ya lo vio para no dejar a
        // alguien atrapado en el onboarding por un fallo de almacenamiento.
      }
      if (!yaVioOnboarding) {
        router.replace('/bienvenida');
        return;
      }

      await inicializarRevisados();
      await inicializarEtiquetas();

      const { status: permisoStatus } = await MediaLibrary.requestPermissionsAsync();

      if (permisoStatus !== 'granted') {
        setStatus('No hemos podido acceder a tus fotos. Revisa los permisos en Ajustes.');
        return;
      }

      setStatus('Revisando tus fotos...');

      const resultado = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        first: 200,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });

      setTotalFotos(resultado.totalCount);
      setStatus('Agrupando fotos parecidas...');
      // Pausa corta a propósito: agrupar por tiempo ya ha terminado dentro
      // de detectarRafagas (es prácticamente instantáneo), pero sin esto React agruparía este cambio de estado
      // con el siguiente y el usuario nunca llegaría a ver esta fase.
      await new Promise((resolve) => setTimeout(resolve, 400));

      const gruposConDistancias: GrupoConDistancias[] = [];

      await detectarRafagas(resultado.assets, {
        onProgreso: (indice, total, primeraFotoUri) => {
          setStatus(`Revisando grupo ${indice + 1} de ${total}...`);
          setPreviewEscaneo(primeraFotoUri || null);
        },
        onGrupo: async (grupo) => {
          const candidatas: CandidataConUri[] = grupo.fotosConUri.map((foto) => ({
            id: foto.id,
            uri: foto.uri,
          }));

          registrarGrupo(grupo.grupoId, candidatas, [], grupo.fotos[0]?.creationTime);

          const { fotosConUri, ...grupoBase } = grupo;
          gruposConDistancias.push({
            ...grupoBase,
            candidatas,
            descartadas: [],
          });
        },
      });

      setGrupos(gruposConDistancias);
      setPreviewEscaneo(null);
      setStatus('¡Listo!');
    })();
  }, []);

  const seleccionarGrupo = (grupoId: string) => {
    router.push({
      pathname: '/seleccion',
      params: { grupoId },
    });
  };

  const guardarEtiquetaGrupo = async (nombre: string) => {
    if (!grupoEditando) return;
    await guardarNombreActividad(grupoEditando, nombre);
    setTick((t) => t + 1);
  };

  // No revisados primero, revisados al final (con su orden relativo
  // intacto en cada bloque, ya que Array.sort es estable).
  const gruposOrdenados = [...grupos].sort((a, b) => {
    const aRevisado = esRevisado(a.grupoId);
    const bRevisado = esRevisado(b.grupoId);
    if (aRevisado === bRevisado) return 0;
    return aRevisado ? 1 : -1;
  });

  const grupoEditandoData = grupos.find((g) => g.grupoId === grupoEditando);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      <Text style={styles.titulo}>Fondly</Text>
      <Text style={styles.insigniaPrivacidad}>🔒 100% en tu {DISPOSITIVO}</Text>

      {__DEV__ && (
        <Pressable
          style={styles.botonDevReset}
          onPress={async () => {
            await AsyncStorage.removeItem(CLAVE_ONBOARDING_VISTO);
            router.replace('/bienvenida');
          }}
        >
          <Text style={styles.textoDevReset}>🛠 Ver onboarding de nuevo (solo dev)</Text>
        </Pressable>
      )}

      {status !== '¡Listo!' && (
        <View style={styles.escaneoContenedor}>
          <Image
            source={require('@/assets/images/escaneo-ilustracion.png')}
            style={styles.escaneoIlustracion}
            contentFit="contain"
          />
          <Text style={styles.status}>{status}</Text>
          {previewEscaneo && (
            <Image source={{ uri: previewEscaneo }} style={styles.escaneoPreview} />
          )}
        </View>
      )}
      {status === '¡Listo!' && totalFotos !== null && (
        <Text style={styles.subtitulo}>
          Hemos revisado tus {totalFotos} fotos más recientes y encontrado {grupos.length} grupos de fotos casi iguales
        </Text>
      )}

      {status === '¡Listo!' && (
        <FlatList
        data={gruposOrdenados}
        keyExtractor={(item) => item.grupoId}
        style={styles.lista}
        extraData={tick}
        renderItem={({ item, index }) => {
          const ganadora = obtenerGanadora(item.grupoId);
          const portada = ganadora?.uri ?? item.candidatas[0]?.uri;
          const revisado = esRevisado(item.grupoId);

          return (
            <View style={[styles.tarjeta, revisado && styles.tarjetaRevisada]}>
              {portada ? (
                <View style={styles.portadaContenedor}>
                  <Image source={{ uri: portada }} style={styles.portada} />
                  {ganadora && (
                    <View style={styles.insignia}>
                      <Text style={styles.insigniaTexto}>✓</Text>
                    </View>
                  )}
                </View>
              ) : null}

              <View style={styles.tarjetaCuerpo}>
                <Text style={styles.tarjetaTitulo}>
                  Grupo {index + 1} · {item.fotos.length} fotos casi iguales
                  {revisado ? '  ·  Revisado ✓' : ''}
                </Text>

                <Pressable onPress={() => setGrupoEditando(item.grupoId)} hitSlop={6}>
                  <Text style={styles.tarjetaEtiqueta}>
                    {formatearEtiqueta(item.grupoId, item.fotos[0].creationTime)} ✏️
                  </Text>
                </Pressable>

                {item.candidatas.length > 0 && (
                  <BouncyPressable
                    style={ganadora ? styles.botonSecundario : styles.botonGrupo}
                    onPress={() => seleccionarGrupo(item.grupoId)}
                  >
                    <Text style={ganadora ? styles.textoBotonSecundario : styles.textoBotonGrupo}>
                      {ganadora
                        ? 'Volver a elegir'
                        : item.candidatas.length === 1
                        ? 'Revisar y limpiar ✨'
                        : 'Elegir la mejor foto ✨'}
                    </Text>
                  </BouncyPressable>
                )}
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          <BouncyPressable
            style={styles.tarjetaExplorar}
            onPress={() => router.push('/explore')}
          >
            <Text style={styles.textoExplorar}>📅 Revisar fotos más antiguas</Text>
            <Text style={styles.subtextoExplorar}>
              Limpia también las ráfagas de otros periodos
            </Text>
          </BouncyPressable>
        }
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
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: COLORES.fondo,
  },
  titulo: {
    textAlign: 'center',
    marginBottom: 8,
    color: COLORES.texto,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  insigniaPrivacidad: {
    alignSelf: 'center',
    marginBottom: 14,
    color: COLORES.acentoOscuro,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
    backgroundColor: COLORES.acentoSuave,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
  },
  botonDevReset: {
    alignSelf: 'center',
    marginBottom: 10,
  },
  textoDevReset: {
    color: COLORES.textoSecundario,
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  status: {
    textAlign: 'center',
    marginBottom: 16,
    color: COLORES.texto,
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: 10,
  },
  escaneoContenedor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 12,
    marginBottom: 16,
  },
  escaneoIlustracion: {
    width: 230,
    height: 230,
    marginBottom: 4,
  },
  escaneoPreview: {
    width: 220,
    height: 220,
    borderRadius: 20,
    backgroundColor: COLORES.superficie,
    marginTop: 12,
  },
  subtitulo: {
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
    color: COLORES.textoSecundario,
    fontSize: 14,
    fontWeight: '600',
  },
  lista: {
    flex: 1,
  },

  // --- Tarjeta de grupo (estilo VSCO/Instagram: portada + badge + info) ---
  tarjeta: {
    backgroundColor: COLORES.superficie,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORES.borde,
    marginBottom: 16,
    overflow: 'hidden',
  },
  tarjetaRevisada: {
    opacity: 0.55,
  },
  portadaContenedor: {
    position: 'relative',
  },
  portada: {
    width: '100%',
    height: 220,
  },
  insignia: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: COLORES.acento,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insigniaTexto: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  tarjetaCuerpo: {
    padding: 14,
  },
  tarjetaTitulo: {
    color: COLORES.texto,
    fontSize: 15,
    fontWeight: '600',
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

  botonGrupo: {
    backgroundColor: COLORES.acento,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    alignSelf: 'flex-start',
  },
  botonSecundario: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignSelf: 'flex-start',
  },
  textoBotonGrupo: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  textoBotonSecundario: {
    color: COLORES.acento,
    fontWeight: '600',
    fontSize: 13,
  },
  tarjetaExplorar: {
    backgroundColor: COLORES.acentoSuave,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORES.acento,
    borderStyle: 'dashed',
    padding: 20,
    marginTop: 4,
    marginBottom: 24,
    alignItems: 'center',
  },
  textoExplorar: {
    color: COLORES.acentoOscuro,
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtextoExplorar: {
    color: COLORES.textoSecundario,
    fontSize: 13,
    textAlign: 'center',
  },
});
