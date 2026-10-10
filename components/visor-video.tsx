import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { T } from '@/lib/i18n';
import { direccionParaVer, limpiarExportaciones } from '@/lib/videos';

type Props = {
  // Id del vídeo del carrete que se quiere ver, o null para cerrar.
  videoId: string | null;
  onClose: () => void;
};

// Visor a pantalla completa para ver un vídeo antes de decidir. Usa el
// reproductor del propio iPhone (con sus controles de siempre).
export function VisorVideo({ videoId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [direccion, setDireccion] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setDireccion(null);
    setError(false);
    if (!videoId) return;
    let cancelado = false;
    direccionParaVer(videoId)
      .then((d) => {
        if (cancelado) return;
        if (d) setDireccion(d);
        else setError(true);
      })
      .catch(() => {
        if (!cancelado) setError(true);
      });
    return () => {
      cancelado = true;
    };
  }, [videoId]);

  const player = useVideoPlayer(direccion, (p) => {
    p.loop = true;
    p.play();
  });

  // Si el reproductor no puede con el fichero, mensaje en vez de negro.
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'error') setError(true);
    });
    return () => sub.remove();
  }, [player]);

  // Al cerrar, fuera las copias que haya hecho el iPhone para reproducirlo.
  useEffect(() => () => void limpiarExportaciones(), []);

  return (
    <Modal visible={!!videoId} animationType="fade" onRequestClose={onClose}>
      <View style={styles.fondo}>
        {direccion && !error ? (
          <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />
        ) : (
          <View style={styles.centro}>
            {error ? (
              <Text style={styles.texto}>{T.videos.errorVer}</Text>
            ) : (
              <>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={styles.texto}>{T.videos.cargandoVideo}</Text>
              </>
            )}
          </View>
        )}
        <Pressable
          onPress={onClose}
          style={[styles.cerrar, { top: insets.top + 8 }]}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={T.videos.cerrar}
        >
          <IconSymbol name="xmark" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: '#000000',
  },
  video: {
    flex: 1,
  },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  texto: {
    color: '#FFFFFF',
    fontSize: 15,
    textAlign: 'center',
  },
  cerrar: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
