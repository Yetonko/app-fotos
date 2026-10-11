import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { T } from '@/lib/i18n';

type Props = {
  // Dirección del vídeo tal como la da la fototeca (ph://… en iPhone).
  // OJO: no usar localUri, el reproductor no tiene permiso para leerla.
  uri: string;
  onClose: () => void;
};

// Visor a pantalla completa para ver un vídeo antes de decidir, con sonido
// y los controles de siempre del iPhone. Nunca sale de Fondly.
export function VisorVideo({ uri, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');

  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });

  useEffect(() => {
    if (player.status === 'readyToPlay') setEstado('listo');
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') setEstado('listo');
      if (status === 'error') setEstado('error');
    });
    return () => sub.remove();
  }, [player]);

  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.fondo}>
        {estado !== 'error' && (
          <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />
        )}
        {estado !== 'listo' && (
          <View style={[StyleSheet.absoluteFill, styles.centro]} pointerEvents="none">
            {estado === 'error' ? (
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
