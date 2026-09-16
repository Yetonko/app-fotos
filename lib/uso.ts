import AsyncStorage from '@react-native-async-storage/async-storage';
import { esPremium } from '@/lib/compras';

// ── Configuración ──────────────────────────────────
const CLAVE_USO = 'fondly_uso_ciclo';
const LIMITE_GRATIS = 20;
const SELECCIONES_GRACIA = 2; // 2 extras antes del bloqueo real
const DURACION_CICLO_MS = 30 * 24 * 60 * 60 * 1000; // 30 días en ms

// ── Tipos ──────────────────────────────────────────
// 'libre'    → puede seleccionar sin aviso
// 'gracia'   → puede seleccionar, pero se muestra el paywall como sugerencia
// 'bloqueado' → no puede seleccionar, paywall obligatorio
export type EstadoUso = 'libre' | 'gracia' | 'bloqueado';

interface DatosUso {
  cicloInicio: number;        // timestamp de inicio del ciclo actual
  seleccionesEnCiclo: number; // cuántas selecciones lleva en este ciclo
  creditosExtra: number;      // selecciones compradas (pack), sin caducidad:
                               // no se resetean al cambiar de ciclo
}

// ── Leer o crear datos ─────────────────────────────
async function obtenerDatos(): Promise<DatosUso> {
  const raw = await AsyncStorage.getItem(CLAVE_USO);

  // Primera vez: crear ciclo nuevo
  if (!raw) {
    const nuevo: DatosUso = { cicloInicio: Date.now(), seleccionesEnCiclo: 0, creditosExtra: 0 };
    await AsyncStorage.setItem(CLAVE_USO, JSON.stringify(nuevo));
    return nuevo;
  }

  const datos: DatosUso = JSON.parse(raw);
  // Compatibilidad con datos guardados antes de añadir creditosExtra.
  if (datos.creditosExtra === undefined) {
    datos.creditosExtra = 0;
  }

  // Si han pasado 30 días, resetear ciclo automáticamente. Los créditos
  // comprados NO se resetean: el paywall los anuncia como "sin caducidad".
  if (Date.now() - datos.cicloInicio >= DURACION_CICLO_MS) {
    const nuevo: DatosUso = {
      cicloInicio: Date.now(),
      seleccionesEnCiclo: 0,
      creditosExtra: datos.creditosExtra,
    };
    await AsyncStorage.setItem(CLAVE_USO, JSON.stringify(nuevo));
    return nuevo;
  }

  return datos;
}

// ── Consultar estado actual ────────────────────────
export async function estadoUso(): Promise<{
  estado: EstadoUso;
  seleccionesUsadas: number;
  diasRestantesCiclo: number;
}> {
  const datos = await obtenerDatos();

  const diasRestantes = Math.ceil(
    (DURACION_CICLO_MS - (Date.now() - datos.cicloInicio)) / (24 * 60 * 60 * 1000)
  );

  // Suscripción activa: acceso libre, no se mira el contador.
  if (await esPremium()) {
    return { estado: 'libre', seleccionesUsadas: datos.seleccionesEnCiclo, diasRestantesCiclo: diasRestantes };
  }

  // Tiene créditos comprados (pack) pendientes de usar: acceso libre
  // hasta agotarlos, sin mostrar el paywall todavía.
  if (datos.creditosExtra > 0) {
    return { estado: 'libre', seleccionesUsadas: datos.seleccionesEnCiclo, diasRestantesCiclo: diasRestantes };
  }

  let estado: EstadoUso;
  if (datos.seleccionesEnCiclo < LIMITE_GRATIS) {
    estado = 'libre';
  } else if (datos.seleccionesEnCiclo < LIMITE_GRATIS + SELECCIONES_GRACIA) {
    estado = 'gracia';
  } else {
    estado = 'bloqueado';
  }

  return { estado, seleccionesUsadas: datos.seleccionesEnCiclo, diasRestantesCiclo: diasRestantes };
}

// ── Registrar una selección (llamar tras cada torneo ganado) ──
// Orden de consumo: primero la cuota gratuita del ciclo; si ya se agotó,
// se gastan créditos comprados (pack) si los hay; si tampoco, se sigue
// contando hacia gracia/bloqueado como antes.
export async function registrarSeleccion(): Promise<void> {
  const datos = await obtenerDatos();

  if (datos.seleccionesEnCiclo < LIMITE_GRATIS) {
    datos.seleccionesEnCiclo += 1;
  } else if (datos.creditosExtra > 0) {
    datos.creditosExtra -= 1;
  } else {
    datos.seleccionesEnCiclo += 1;
  }

  await AsyncStorage.setItem(CLAVE_USO, JSON.stringify(datos));
}

// ── Añadir créditos comprados (llamar tras confirmar la compra del pack) ──
export async function anadirCreditosPack(cantidad: number): Promise<void> {
  const datos = await obtenerDatos();
  datos.creditosExtra += cantidad;
  await AsyncStorage.setItem(CLAVE_USO, JSON.stringify(datos));
}
