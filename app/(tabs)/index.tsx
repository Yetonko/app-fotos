import { useCallback, useEffect, useState } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { FlatList, StyleSheet, Pressable, View, Text } from 'react-native';
import * as MediaLibrary from 'expo-media-library';

import { agruparPorTiempo, GrupoFotos } from '@/lib/agrupar';
import { calcularHash, distanciaHamming } from '@/lib/hash';
import { calcularNitidez, esBorrosa } from '@/lib/nitidez';
import { obtenerGanadora } from '@/lib/gruposElegidos';
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

type CandidataConUri = { id: string; uri: string; nitidez: number };

type GrupoConDistancias = GrupoFotos & {
  distancias: number[];
  candidatas: CandidataConUri[];
  descartadas: CandidataConUri[];
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
      setStatus(`Organizando ${soloRafagas.length} ráfagas...`);

      const gruposConDistancias: GrupoConDistancias[] = [];

     for (const grupo of soloRafagas) {
        const hashes: string[] = [];
        for (const foto of grupo.fotos) {
          const hash = await calcularHash(foto.id);
          hashes.push(hash);
        }

        const distancias: number[] = [];
        for (let i = 1; i < hashes.length; i++) {
          distancias.push(distanciaHamming(hashes[i - 1], hashes[i]));
        }

       const candidatas: CandidataConUri[] = [];
        const descartadasDetalle: CandidataConUri[] = [];
        for (const foto of grupo.fotos) {
          const nitidez = await calcularNitidez(foto.id);
          const uri = uriPorId.get(foto.id) ?? '';
          if (esBorrosa(nitidez)) {
            descartadasDetalle.push({ id: foto.id, uri, nitidez });
          } else {
            candidatas.push({ id: foto.id, uri, nitidez });
          }
        }

        // Salvaguarda: si el filtro descartó todas, rescatamos la de mayor nitidez
        // para que el usuario siempre tenga al menos una opción entre la que elegir.
        if (candidatas.length === 0 && descartadasDetalle.length > 0) {
          descartadasDetalle.sort((a, b) => b.nitidez - a.nitidez);
          const rescatada = descartadasDetalle.shift()!;
          candidatas.push(rescatada);
        }

       gruposConDistancias.push({ ...grupo, distancias, candidatas, descartadas: descartadasDetalle });
      }

      setGrupos(gruposConDistancias);
      setStatus('¡Listo!');
    })();
  }, []);

  const seleccionarGrupo = (grupo: GrupoConDistancias, grupoId: string) => {
    const candidatasParaTorneo = grupo.candidatas.map((c) => ({ id: c.id, uri: c.uri }));
    // Pasamos también las descartadas (borrosas) para que, si el usuario decide
    // "Borrar las demás" al final, se limpie la ráfaga completa y no solo las
    // que compitieron en el torneo.
    const descartadasParaTorneo = grupo.descartadas.map((d) => ({ id: d.id, uri: d.uri }));
    router.push({
      pathname: '/seleccion',
      params: {
        candidatas: JSON.stringify(candidatasParaTorneo),
        descartadas: JSON.stringify(descartadasParaTorneo),
        grupoId,
      },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Fondly</Text>

      <Text style={styles.status}>{status}</Text>
      {totalFotos !== null && (
        <Text style={styles.subtitulo}>
          Hemos revisado tus {totalFotos} fotos más recientes y encontrado {grupos.length} ráfagas
        </Text>
      )}

      <FlatList
        data={grupos}
        keyExtractor={(_, index) => `grupo-${index}`}
        style={styles.lista}
        extraData={tick}
        renderItem={({ item, index }) => {
          const grupoId = String(index);
          const ganadora = obtenerGanadora(grupoId);
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
                  Ráfaga {index + 1} · {item.fotos.length} fotos
                </Text>

                {item.candidatas.length > 1 && (
                  <Pressable
                    style={ganadora ? styles.botonSecundario : styles.botonGrupo}
                    onPress={() => seleccionarGrupo(item, grupoId)}
                  >
                    <Text style={ganadora ? styles.textoBotonSecundario : styles.textoBotonGrupo}>
                      {ganadora ? 'Volver a elegir' : 'Elegir la mejor foto ✨'}
                    </Text>
                  </Pressable>
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
  status: {
    textAlign: 'center',
    marginBottom: 4,
    color: COLORES.textoSecundario,
    fontSize: 13,
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

  // --- Tarjeta de ráfaga (estilo VSCO/Instagram: portada + badge + info) ---
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
