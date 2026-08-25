import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const COLORES = {
  fondo: '#F5EFE3',
  superficie: '#FFFFFF',
  borde: '#EAE2D0',
  acento: '#D98C7A',
  acentoOscuro: '#3B2A28',
  texto: '#2B2420',
  textoSecundario: '#8C8171',
};

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
          <Text style={styles.titulo}>Nombre de la actividad</Text>
          <TextInput
            style={styles.input}
            value={texto}
            onChangeText={setTexto}
            placeholder="Ej. Benasque ski"
            placeholderTextColor={COLORES.textoSecundario}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={guardar}
          />

          <Pressable style={styles.botonGuardar} onPress={guardar}>
            <Text style={styles.textoBotonGuardar}>Guardar</Text>
          </Pressable>

          {valorInicial.length > 0 && (
            <Pressable style={styles.botonQuitar} onPress={quitar}>
              <Text style={styles.textoBotonQuitar}>Quitar etiqueta</Text>
            </Pressable>
          )}

          <Pressable style={styles.botonCancelar} onPress={onCerrar}>
            <Text style={styles.textoBotonCancelar}>Cancelar</Text>
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
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
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
    backgroundColor: COLORES.acentoOscuro,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 8,
  },
  textoBotonGuardar: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  botonQuitar: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  textoBotonQuitar: {
    color: COLORES.acento,
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
