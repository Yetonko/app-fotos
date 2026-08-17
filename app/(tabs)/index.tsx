import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, Pressable } from 'react-native';
import * as MediaLibrary from 'expo-media-library';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { agruparPorTiempo, GrupoFotos } from '@/lib/agrupar';
import { calcularHash, distanciaHamming } from '@/lib/hash';
import { calcularNitidez, esBorrosa } from '@/lib/nitidez';
import { Image } from 'expo-image';

type GrupoConDistancias = GrupoFotos & {
  distancias: number[];
  candidatas: { id: string; nitidez: number }[];
  descartadas: { id: string; nitidez: number }[];
};
type ResultadoNitidez = {
  id: string;
  uri: string;
  nitidez: number;
};

async function calibrarNitidez(
  fotos: { id: string; uri: string }[]
): Promise<ResultadoNitidez[]> {
  const muestra = fotos.slice(0, 25);
  const resultados: ResultadoNitidez[] = [];
  for (const foto of muestra) {
    const nitidez = await calcularNitidez(foto.id);
    resultados.push({ id: foto.id, uri: foto.uri, nitidez });
  }
  return resultados;
}

export default function HomeScreen() {
  const router = useRouter();
  const [status, setStatus] = useState('Pidiendo permiso...');
  const [totalFotos, setTotalFotos] = useState<number | null>(null);
  const [grupos, setGrupos] = useState<GrupoConDistancias[]>([]);
  const [resultadosNitidez, setResultadosNitidez] = useState<ResultadoNitidez[]>([]);

  useEffect(() => {
    (async () => {
      const { status: permisoStatus } = await MediaLibrary.requestPermissionsAsync();

      if (permisoStatus !== 'granted') {
        setStatus('Permiso denegado. No podemos acceder al carrete.');
        return;
      }

      setStatus('Permiso concedido. Leyendo carrete...');

      const resultado = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        first: 200,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });

      const fotos = resultado.assets.map((asset) => ({
        id: asset.id,
        creationTime: asset.creationTime,
      }));
      const gruposCalculados = agruparPorTiempo(fotos);

      const fotosConUri = resultado.assets.map((asset) => ({
        id: asset.id,
        uri: asset.uri,
      }));
      const resultadosCalibracion = await calibrarNitidez(fotosConUri);
      setResultadosNitidez(resultadosCalibracion);
      const soloRafagas = gruposCalculados.filter((g) => g.fotos.length > 1);

      setTotalFotos(resultado.totalCount);
      setStatus(`Calculando huellas visuales de ${soloRafagas.length} rafagas...`);

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

       const candidatas: { id: string; nitidez: number }[] = [];
        const descartadasDetalle: { id: string; nitidez: number }[] = [];
        for (const foto of grupo.fotos) {
          const nitidez = await calcularNitidez(foto.id);
          if (esBorrosa(nitidez)) {
            descartadasDetalle.push({ id: foto.id, nitidez });
          } else {
            candidatas.push({ id: foto.id, nitidez });
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
      setStatus('Listo');
    })();
  }, []);

  return (
    <ThemedView style={styles.container}>
<ThemedText type="title" style={styles.titulo}>app-fotos</ThemedText>
      <Pressable style={styles.botonPrueba} onPress={() => router.push('/seleccion')}>
        <ThemedText style={styles.textoBotonPrueba}>Probar selección (torneo)</ThemedText>
      </Pressable>
      <ThemedText style={styles.status}>{status}</ThemedText>
      {totalFotos !== null && (
        <ThemedText type="subtitle" style={styles.subtitulo}>
          Analizadas las 200 mas recientes de {totalFotos} · {grupos.length} rafagas
        </ThemedText>
      )}
      <FlatList
        data={grupos}
        keyExtractor={(_, index) => `grupo-${index}`}
        style={styles.lista}
        renderItem={({ item, index }) => (
        <ThemedText style={styles.item}>
            Grupo {index + 1}: {item.fotos.length} fotos · distancias: {item.distancias.join(', ')} · {item.candidatas.length} candidatas{'\n'}
            Nitidez candidatas: {item.candidatas.map((c) => c.nitidez.toFixed(0)).join(', ') || 'ninguna'}{'\n'}
            Nitidez descartadas: {item.descartadas.map((d) => d.nitidez.toFixed(0)).join(', ') || 'ninguna'}
          </ThemedText>
        )}
      />
      <ThemedText type="subtitle" style={styles.subtitulo}>
        Calibración de nitidez
      </ThemedText>
      <FlatList
        data={resultadosNitidez}
        keyExtractor={(item) => item.id}
        style={styles.lista}
        renderItem={({ item }) => (
          <ThemedView style={styles.filaNitidez}>
            <Image source={{ uri: item.uri }} style={styles.miniatura} />
            <ThemedText style={styles.item}>
              {item.nitidez.toFixed(0)}
            </ThemedText>
          </ThemedView>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  titulo: {
    textAlign: 'center',
    marginBottom: 8,
  },
  status: {
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitulo: {
    textAlign: 'center',
    marginBottom: 16,
  },
  lista: {
    flex: 1,
  },
  item: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
    filaNitidez: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  miniatura: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
botonPrueba: {
    backgroundColor: '#3478F6',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'center',
    marginBottom: 16,
  },
  textoBotonPrueba: {
    color: 'white',
    fontWeight: '600',
  },
});