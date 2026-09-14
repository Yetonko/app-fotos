import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

// ── Pantalla de paywall ────────────────────────────
// Se recibe vía params:
//   modo: 'gracia' | 'bloqueado'
//   selecciones: número de selecciones usadas
//   diasRestantes: días que faltan para resetear el ciclo
//   mbLiberados: MB liberados este ciclo (opcional, 0 si no se tiene)

export default function Paywall() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    modo: 'gracia' | 'bloqueado';
    grupoId: string;
    selecciones: string;
    diasRestantes: string;
    mbLiberados: string;
  }>();

  const modo = params.modo ?? 'gracia';
  const selecciones = Number(params.selecciones ?? 20);
  const diasRestantes = Number(params.diasRestantes ?? 30);
  const mbLiberados = Number(params.mbLiberados ?? 0);
  const grupoId = params.grupoId ?? '';
  const esBloqueo = modo === 'bloqueado';

  // ── Compra (placeholder — se conecta mañana con expo-iap) ──
  async function comprarSuscripcion() {
    // TODO: llamar a expo-iap con 'fondly_unlimited_monthly'
    console.log('[Paywall] Compra suscripción — pendiente de conectar');
  }

  async function comprarPack() {
    // TODO: llamar a expo-iap con 'fondly_pack_50'
    console.log('[Paywall] Compra pack — pendiente de conectar');
  }

  async function restaurar() {
    // TODO: llamar a expo-iap restore
    console.log('[Paywall] Restaurar compras — pendiente de conectar');
  }

  function cerrar() {
    if (esBloqueo) {
      // En bloqueo real: vuelve a Home, no puede iniciar torneo
      router.replace('/');
    } else {
      // En gracia: cierra el paywall y deja continuar al torneo
      router.replace({ pathname: '/seleccion', params: { grupoId } });
    }
  }

  return (
    <View style={estilos.fondo}>
      {/* ── Celebración ── */}
      <Text style={estilos.emoji}>✨</Text>
      <Text style={estilos.titulo}>¡Gran mes!</Text>
      <Text style={estilos.subtitulo}>
        Has elegido tus {selecciones} mejores fotos
        {mbLiberados > 0 ? ` y liberado ${mbLiberados} MB` : ''}
      </Text>
      <Text style={estilos.ciclo}>
        Tu ciclo gratuito se renueva en {diasRestantes} día{diasRestantes !== 1 ? 's' : ''}
      </Text>

      {/* ── Opciones de compra ── */}
      <View style={estilos.tarjetaDestacada}>
        <View style={estilos.etiquetaPopular}>
          <Text style={estilos.textoEtiqueta}>Popular</Text>
        </View>
        <Text style={estilos.tituloOpcion}>Ilimitado</Text>
        <Text style={estilos.precio}>3,99 €/mes</Text>
        <Text style={estilos.descripcionOpcion}>Elige sin límites, todos los meses</Text>
        <Pressable style={estilos.botonPrincipal} onPress={comprarSuscripcion}>
          <Text style={estilos.textoBotonPrincipal}>Suscribirme</Text>
        </Pressable>
      </View>

      <View style={estilos.tarjetaSecundaria}>
        <Text style={estilos.tituloOpcion}>Pack de 50</Text>
        <Text style={estilos.precio}>2,99 €</Text>
        <Text style={estilos.descripcionOpcion}>50 selecciones extra, sin caducidad</Text>
        <Pressable style={estilos.botonSecundario} onPress={comprarPack}>
          <Text style={estilos.textoBotonSecundario}>Comprar pack</Text>
        </Pressable>
      </View>

      {/* ── Restaurar + cerrar ── */}
      <Pressable onPress={restaurar}>
        <Text style={estilos.enlace}>Restaurar compras</Text>
      </Pressable>

      <Pressable onPress={cerrar} style={estilos.botonCerrar}>
        <Text style={estilos.textoCerrar}>
          {esBloqueo ? 'Volver al inicio' : 'Ahora no'}
        </Text>
      </Pressable>
    </View>
  );
}

// ── Estilos ────────────────────────────────────────
const estilos = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: '#F5EFE3',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  titulo: {
    fontSize: 28,
    fontWeight: '700',
    color: '#3B2A28',
    marginBottom: 6,
  },
  subtitulo: {
    fontSize: 16,
    color: '#3B2A28',
    textAlign: 'center',
    marginBottom: 4,
  },
  ciclo: {
    fontSize: 13,
    color: '#8B7D6B',
    marginBottom: 28,
  },
  // ── Tarjeta suscripción (destacada) ──
  tarjetaDestacada: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#C9A94E',
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  etiquetaPopular: {
    position: 'absolute',
    top: -12,
    backgroundColor: '#C9A94E',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 10,
  },
  textoEtiqueta: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tituloOpcion: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3B2A28',
    marginTop: 4,
  },
  precio: {
    fontSize: 17,
    fontWeight: '600',
    color: '#3B2A28',
    marginTop: 2,
  },
  descripcionOpcion: {
    fontSize: 14,
    color: '#8B7D6B',
    marginTop: 4,
    marginBottom: 14,
  },
  botonPrincipal: {
    backgroundColor: '#3B2A28',
    borderRadius: 12,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  textoBotonPrincipal: {
    color: '#F5EFE3',
    fontSize: 16,
    fontWeight: '600',
  },
  // ── Tarjeta pack (secundaria) ──
  tarjetaSecundaria: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0D6C8',
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  botonSecundario: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#3B2A28',
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  textoBotonSecundario: {
    color: '#3B2A28',
    fontSize: 15,
    fontWeight: '600',
  },
  // ── Parte inferior ──
  enlace: {
    fontSize: 14,
    color: '#8B7D6B',
    textDecorationLine: 'underline',
    marginBottom: 16,
  },
  botonCerrar: {
    paddingVertical: 10,
  },
  textoCerrar: {
    fontSize: 15,
    color: '#8B7D6B',
  },
});
