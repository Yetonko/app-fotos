import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import * as MediaLibrary from 'expo-media-library';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function HomeScreen() {
  const [status, setStatus] = useState('Pidiendo permiso...');
  const [totalFotos, setTotalFotos] = useState<number | null>(null);

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
        first: 1,
      });

      setTotalFotos(resultado.totalCount);
      setStatus('Listo');
    })();
  }, []);

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">app-fotos</ThemedText>
      <ThemedText style={styles.status}>{status}</ThemedText>
      {totalFotos !== null && (
        <ThemedText type="subtitle">
          Tienes {totalFotos} fotos en el carrete
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  status: {
    textAlign: 'center',
  },
});
