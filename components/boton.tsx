import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { BouncyPressable } from '@/components/bouncy-pressable';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { COLORES } from '@/constants/estilo';

type IconSymbolName = React.ComponentProps<typeof IconSymbol>['name'];

type Props = {
  variante?: 'principal' | 'secundario' | 'peligro' | 'texto';
  compacto?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  icono?: IconSymbolName;
  style?: StyleProp<ViewStyle>;
  children: string;
};

// Botón único de la app: mismas medidas y colores en todas las pantallas.
export function Boton({
  variante = 'principal',
  compacto = false,
  disabled,
  onPress,
  icono,
  style,
  children,
}: Props) {
  const esTexto = variante === 'texto';
  const colorTexto =
    variante === 'principal' || variante === 'peligro'
      ? '#FFFFFF'
      : variante === 'secundario'
        ? COLORES.acentoOscuro
        : COLORES.textoSecundario;
  const nombreIcono = icono ?? (variante === 'peligro' ? 'trash' : undefined);

  return (
    <BouncyPressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.base,
        compacto && styles.baseCompacto,
        variante === 'principal' && styles.principal,
        variante === 'secundario' && styles.secundario,
        variante === 'peligro' && styles.peligro,
        esTexto && styles.texto,
        disabled && styles.deshabilitado,
        style,
      ]}
    >
      <View style={styles.fila}>
        {nombreIcono && <IconSymbol name={nombreIcono} size={20} color={colorTexto} />}
        <Text
          style={[
            styles.etiqueta,
            compacto && styles.etiquetaCompacta,
            esTexto && styles.etiquetaTexto,
            { color: colorTexto },
          ]}
        >
          {children}
        </Text>
      </View>
    </BouncyPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 26,
    alignSelf: 'stretch',
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseCompacto: {
    minHeight: 44,
    borderRadius: 22,
  },
  principal: { backgroundColor: COLORES.acentoOscuro },
  secundario: { backgroundColor: COLORES.acentoSuave },
  peligro: { backgroundColor: COLORES.peligro },
  texto: { backgroundColor: 'transparent', minHeight: 44 },
  deshabilitado: { opacity: 0.5 },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  etiqueta: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  etiquetaCompacta: { fontSize: 15 },
  etiquetaTexto: { fontSize: 15 },
});
