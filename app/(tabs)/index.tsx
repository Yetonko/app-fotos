import { useEffect, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import * as MediaLibrary from 'expo-media-library';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type FotoInfo = {
  id: string;
  fecha: string;
};

export default function HomeScreen() {
  const [status, setStatus] = useState('Pidiendo permiso...');
  const [totalFotos, setTotalFotos] = useState<number | null>(null);
  const [fotos, setFotos] = useState<FotoInfo[]>([]);

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
        first: 15,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });

      const fotosConFecha = resultado.assets.map((asset) => ({
        id: asset.id,
        fecha: new Date(asset.creationTime).toLocaleString('es-ES'),
      }));

      setTotalFotos(resultado.totalCount);
      setFotos(fotosConFecha);
      setStatus('Listo');
    })();
  }, []);

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.titulo}>app-fotos</ThemedText>
      <ThemedText style={styles.status}>{status}</ThemedText>
      {totalFotos !== null && (
        <ThemedText type="subtitle" style={styles.subtitulo}>
          Total: {totalFotos} fotos · Mostrando las 15 mas recientes
        </ThemedText>
      )}
      <FlatList
        data={fotos}
        keyExtractor={(item) => item.id}
        style={styles.lista}
        renderItem={({ item }) => (
          <ThemedText style={styles.item}>{item.fecha}</ThemedText>
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
