import { useEffect, useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';

type Props = {
  uri: string; // ph://… en iPhone (nunca localUri)
  style?: StyleProp<ViewStyle>;
  // Para pararlo mientras otro vídeo se ve a pantalla completa.
  pausado?: boolean;
};

// Un vídeo que se repite en bucle, en silencio y sin controles, para
// comparar de un vistazo en el torneo. Mientras carga se ve su miniatura.
export function ClipEnBucle({ uri, style, pausado = false }: Props) {
  const [listo, setListo] = useState(false);
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.loop = true;
    p.play();
  });

  useEffect(() => {
    if (player.status === 'readyToPlay') setListo(true);
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') setListo(true);
    });
    return () => sub.remove();
  }, [player]);

  useEffect(() => {
    if (pausado) player.pause();
    else player.play();
  }, [pausado, player]);

  return (
    <View style={[styles.contenedor, style]}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <VideoView
        player={player}
        style={[StyleSheet.absoluteFill, { opacity: listo ? 1 : 0 }]}
        nativeControls={false}
        contentFit="cover"
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
});
