import { useEffect, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import * as MediaLibrary from 'expo-media-library';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { agruparPorTiempo, GrupoFotos } from '@/lib/agrupar';

export default function HomeScreen() {
  const [status, setStatus] = useState('Pidiendo permiso...');
  const [totalFotos, setTotalFotos] = useState<number | null>(null);
  const [grupos, setGrupos] = useState<GrupoFotos[]>([]);

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
      const soloRafagas = gruposCalculados.filter((g) => g.fotos.length > 1);

      setTotalFotos(resultado.totalCount);
      setGrupos(soloRafagas);
      setStatus('Listo');
    })();
  }, []);

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.titulo}>app-fotos</ThemedText>
      <ThemedText style={styles.status}>{status}</ThemedText>
      {totalFotos !== null && (
        <ThemedText type="subtitle" style={styles.subtitulo}>
          Analizadas las 200 mas recientes de {totalFotos} · {grupos.length} rafagas detectadas
        </ThemedText>
      )}
      <FlatList
        data={grupos}
        keyExtractor={(_, index) => `grupo-${index}`}
        style={styles.lista}
        renderItem={({ item, index }) => (
          <ThemedText style={styles.item}>
            Grupo {index + 1}: {item.fotos.length} fotos ({new Date(item.fotos[0].creationTime).toLocaleTimeString('es-ES')} - {new Date(item.fotos[item.fotos.length - 1].creationTime).toLocaleTimeString('es-ES')})
          </ThemedText>
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
});
