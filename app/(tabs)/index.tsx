import { useCallback, useEffect, useState } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { FlatList, StyleSheet, Pressable, View, Text, Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { agruparPorTiempo, GrupoFotos } from '@/lib/agrupar';
import { calcularHash, distanciaHamming } from '@/lib/hash';
import { calcularNitidez, esBorrosa } from '@/lib/nitidez';
import { obtenerGanadora, registrarGrupo } from '@/lib/gruposElegidos';
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

type CandidataConUri = { id: string; uri: string; nitidez: number };

type GrupoConDistancias = GrupoFotos & {
  distancias: number[];
  candidatas: CandidataConUri[];
  descartadas: CandidataConUri[];
  grupoId: string;
};

export default function HomeScreen() {
  const router = useRouter();
  const [status, setStatus] = useState('Preparando todo...');
  const [totalFotos, setTotalFotos] = useState<number | null>(null);
  const [grupos, setGrupos] = useState<GrupoConDistancias[]>([]);
  // Se incrementa cada vez que la pantalla vuelve a tener el foco, para forzar
  // un re-render y reflejar las ganadoras marcadas en gruposElegidos.ts.
  const [tick, setTick] = useState(0);

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

      const { status: permisoStatus } = await MediaLibrary.requestPermissionsAsync();

      if (permisoStatus !== 'granted') {
        setStatus('No hemos podido acceder a tus fotos. Revisa los permisos en Ajustes.');
        return;
      }

      setStatus('Buscando tus fotos...');

      const resultado = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        first: 200,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });

      // Mapa id -> uri para poder recuperar el uri de cada foto más adelante,
      // ya que agruparPorTiempo solo trabaja con id y creationTime.
      const uriPorId = new Map(resultado.assets.map((asset) => [asset.id, asset.uri]));

      const fotos = resultado.assets.map((asset) => ({
        id: asset.id,
        creationTime: asset.creationTime,
      }));
      const gruposCalculados = agruparPorTiempo(fotos);

      const soloRafagas = gruposCalculados.filter((g) => g.fotos.length > 1);

      setTotalFotos(resultado.totalCount);
      setStatus('Agrupando fotos parecidas...');
      // Pausa corta a propósito: agruparPorTiempo ya ha terminado (es
      // instantáneo), pero sin esto React agruparía este cambio de estado
      // con el siguiente y el usuario nunca llegaría a ver esta fase.
      await new Promise((resolve) => setTimeout(resolve, 400));
      setStatus(`Comparando ${soloRafagas.length} grupos de fotos...`);

      const gruposConDistancias: GrupoConDistancias[] = [];

      for (const grupo of soloRafagas) {
        // Se calculan los hashes de todas las fotos del grupo a la vez
        // (en vez de una por una) para aprovechar que el móvil puede
        // decodificar varias imágenes en paralelo.
        const hashes = await Promise.all(
          grupo.fotos.map((foto) => calcularHash(foto.id))
        );

        const distancias: number[] = [];
        for (let i = 1; i < hashes.length; i++) {
          distancias.push(distanciaHamming(hashes[i - 1], hashes[i]));
        }

        // Igual con la nitidez: se lanzan todas las fotos del grupo a la vez.
        const resultadosNitidez = await Promise.all(
          grupo.fotos.map(async (foto) => {
            const nitidez = await calcularNitidez(foto.id);
            const uri = uriPorId.get(foto.id) ?? '';
            return { id: foto.id, uri, nitidez };
          })
        );

        const candidatas: CandidataConUri[] = [];
        const descartadasDetalle: CandidataConUri[] = [];
        for (const fotoConNitidez of resultadosNitidez) {
          if (esBorrosa(fotoConNitidez.nitidez)) {
            descartadasDetalle.push(fotoConNitidez);
          } else {
            candidatas.push(fotoConNitidez);
          }
        }

        // Salvaguarda: si el filtro descartó todas, rescatamos la de mayor nitidez
        // para que el usuario siempre tenga al menos una opción entre la que elegir.
        if (candidatas.length === 0 && descartadasDetalle.length > 0) {
          descartadasDetalle.sort((a, b) => b.nitidez - a.nitidez);
          const rescatada = descartadasDetalle.shift()!;
          candidatas.push(rescatada);
        }

        // El id de la primera foto de la ráfaga (ordenadas por fecha) es un
        // identificador estable del grupo: a diferencia del índice en el
        // array, no cambia si la lista se recalcula en otra apertura de la
        // pantalla. Solo debería colisionar si dos ráfagas empiezan por la
        // misma foto exacta, lo cual no ocurre.
        const grupoId = grupo.fotos[0].id;

        registrarGrupo(
          grupoId,
          candidatas.map((c) => ({ id: c.id, uri: c.uri })),
          descartadasDetalle.map((d) => ({ id: d.id, uri: d.uri }))
        );

        gruposConDistancias.push({
          ...grupo,
          distancias,
          candidatas,
          descartadas: descartadasDetalle,
          grupoId,
        });
      }

      setGrupos(gruposConDistancias);
      setStatus('¡Listo!');
    })();
  }, []);

  const seleccionarGrupo = (grupoId: string) => {
    router.push({
      pathname: '/seleccion',
      params: { grupoId },
    });
  };

  return (
    <View style={styles.container}>
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

      {status !== '¡Listo!' && <Text style={styles.status}>{status}</Text>}
      {status === '¡Listo!' && totalFotos !== null && (
        <Text style={styles.subtitulo}>
          Hemos revisado tus {totalFotos} fotos más recientes y encontrado {grupos.length} grupos de fotos casi iguales
        </Text>
      )}

      <FlatList
        data={grupos}
        keyExtractor={(item) => item.grupoId}
        style={styles.lista}
        extraData={tick}
        renderItem={({ item, index }) => {
          const ganadora = obtenerGanadora(item.grupoId);
          const portada = ganadora?.uri ?? item.candidatas[0]?.uri;

          return (
            <View style={styles.tarjeta}>
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
                </Text>

                {item.candidatas.length > 1 && (
                  <BouncyPressable
                    style={ganadora ? styles.botonSecundario : styles.botonGrupo}
                    onPress={() => seleccionarGrupo(item.grupoId)}
                  >
                    <Text style={ganadora ? styles.textoBotonSecundario : styles.textoBotonGrupo}>
                      {ganadora ? 'Volver a elegir' : 'Elegir la mejor foto ✨'}
                    </Text>
                  </BouncyPressable>
                )}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
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
    textAlign: 'center',
    marginBottom: 10,
    color: COLORES.textoSecundario,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
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
    marginTop: 20,
    color: COLORES.texto,
    fontSize: 19,
    fontWeight: '700',
    paddingHorizontal: 10,
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
});
