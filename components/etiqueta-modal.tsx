import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORES } from '@/constants/estilo';
import { Boton } from '@/components/boton';
import { T } from '@/lib/i18n';


type Props = {
  visible: boolean;
  valorInicial: string;
  etiquetaFecha: string;
  onGuardar: (nombre: string) => void;
  onCerrar: () => void;
};

// Modal sencillo (Modal + TextInput, sin gesture-handler) para escribir o
// editar el nombre de actividad de un grupo. Mismo patron sin gestos que
// ya usa ZoomablePhotoModal, para evitar el crash conocido de
// react-native-gesture-handler dentro de modales en Expo Go.
export function EtiquetaModal({ visible, valorInicial, etiquetaFecha, onGuardar, onCerrar }: Props) {
  const [texto, setTexto] = useState(valorInicial);

  // Al abrir el modal (o cambiar de grupo), sincroniza el texto con el
  // nombre ya guardado para ese grupo, para no arrastrar el valor del
  // grupo anterior que se hubiera editado antes.
  useEffect(() => {
    if (visible) {
      setTexto(valorInicial);
    }
  }, [visible, valorInicial]);

  const guardar = () => {
    onGuardar(texto);
    onCerrar();
  };

  const quitar = () => {
    onGuardar('');
    onCerrar();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <View style={styles.fondo}>
        <View style={styles.tarjeta}>
          <Text style={styles.etiquetaFecha}>{etiquetaFecha}</Text>
          <Text style={styles.titulo}>{T.etiqueta.titulo}</Text>
          <TextInput
            style={styles.input}
            value={texto}
            onChangeText={setTexto}
            placeholder={T.etiqueta.ejemplo}
            placeholderTextColor={COLORES.textoSecundario}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={guardar}
          />

          <Boton style={styles.botonGuardar} onPress={guardar}>
            {T.etiqueta.guardar}
          </Boton>

          {valorInicial.length > 0 && (
            <Pressable style={styles.botonQuitar} onPress={quitar}>
              <Text style={styles.textoBotonQuitar}>{T.etiqueta.quitar}</Text>
            </Pressable>
          )}

          <Pressable style={styles.botonCancelar} onPress={onCerrar}>
            <Text style={styles.textoBotonCancelar}>{T.comun.cancelar}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  tarjeta: {
    width: '100%',
    backgroundColor: COLORES.superficie,
    borderRadius: 20,
    padding: 20,
  },
  etiquetaFecha: {
    color: COLORES.textoSecundario,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  titulo: {
    color: COLORES.texto,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORES.texto,
    marginBottom: 16,
  },
  botonGuardar: {
    marginBottom: 8,
  },
  botonQuitar: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  textoBotonQuitar: {
    color: COLORES.acentoTexto,
    fontWeight: '600',
    fontSize: 13,
  },
  botonCancelar: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  textoBotonCancelar: {
    color: COLORES.textoSecundario,
    fontWeight: '600',
    fontSize: 13,
  },
});
