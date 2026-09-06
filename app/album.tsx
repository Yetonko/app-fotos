import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlatList, StyleSheet, View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';

import { inicializarMomentos, obtenerMomentos } from '@/lib/momentos';
import { ZoomablePhotoModal } from '@/components/zoomable-photo-modal';

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

// Clave 'YYYY-MM' de un creationTime, para casar con la clave del álbum.
function claveMes(creationTime: number): string {
  const f = new Date(creationTime);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
}

type FotoAlbum = { id: string; uri: string; creationTime: number };

const ESPACIO = 4;
const NUM_COLUMNAS = 3;

export default function AlbumScreen() {
  const { clave, nombre } = useLocalSearchParams<{ clave?: string; nombre?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [fotos, setFotos] = useState<FotoAlbum[]>([]);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  // Se recalcula cada vez que la pantalla vuelve a tener el foco (no solo al
  // montar), por si se ha etiquetado un momento nuevo con este mismo nombre
  // mientras tanto.
  const cargar = useCallback(async () => {
    if (!clave) return;
    await inicializarMomentos();
    const momentos = obtenerMomentos();

    const coincidencias = momentos
      .filter((m) => claveMes(m.creationTime) === clave)
      .sort((a, b) => a.creationTime - b.creationTime)
      .map((m) => ({ id: m.ganadoraId, uri: m.ganadoraUri, creationTime: m.creationTime }));

    setFotos(coincidencias);
  }, [clave]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <Pressable style={styles.botonVolver} onPress={() => router.back()} hitSlop={8}>
        <Text style={styles.botonVolverTexto}>‹ Volver</Text>
      </Pressable>
      <Text style={styles.titulo}>{nombre ?? 'Álbum'}</Text>
      <Text style={styles.subtitulo}>
        {fotos.length} {fotos.length === 1 ? 'foto elegida' : 'fotos elegidas'}
      </Text>

      <FlatList
        data={fotos}
        keyExtractor={(item) => item.id}
        numColumns={NUM_COLUMNAS}
        contentContainerStyle={styles.lista}
        renderItem={({ item }) => (
          <Pressable style={styles.celda} onPress={() => setFotoAmpliada(item.uri)}>
            <Image source={{ uri: item.uri }} style={styles.miniatura} />
          </Pressable>
        )}
      />

      <ZoomablePhotoModal
        uri={fotoAmpliada}
        visible={!!fotoAmpliada}
        onClose={() => setFotoAmpliada(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // el paddingTop real lo ajusta insets en el componente
    flex: 1,
    backgroundColor: COLORES.fondo,
    paddingHorizontal: 16,
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
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitulo: {
    fontSize: 13,
    color: COLORES.textoSecundario,
    textAlign: 'center',
    marginBottom: 16,
  },
  lista: {
    paddingBottom: 40,
  },
  celda: {
    flex: 1 / NUM_COLUMNAS,
    aspectRatio: 1,
    margin: ESPACIO / 2,
  },
  miniatura: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: COLORES.superficie,
  },
});
