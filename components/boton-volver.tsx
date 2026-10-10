import { Pressable, StyleSheet, Text } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { COLORES } from '@/constants/estilo';
import { T } from '@/lib/i18n';

type Props = {
  texto?: string;
  onPress: () => void;
  disabled?: boolean;
};

// Botón "Volver" con flecha, igual en todas las pantallas.
export function BotonVolver({ texto = T.comun.volver, onPress, disabled }: Props) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={10} style={styles.boton}>
      <IconSymbol name="chevron.left" size={24} color={COLORES.acentoOscuro} />
      <Text style={styles.texto}>{texto}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: 44,
  },
  texto: {
    color: COLORES.acentoOscuro,
    fontSize: 17,
    fontWeight: '600',
  },
});
