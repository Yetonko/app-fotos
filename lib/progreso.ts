import AsyncStorage from '@react-native-async-storage/async-storage';

import { invalidarEstimaciones } from './tamano';
import { invalidarEstimacionesVideo } from './videos';

const CLAVE_PROGRESO = 'progreso_diario';
const CLAVE_LIBERADO_TOTAL = 'bytes_liberados_total';

// El marcador que se muestra en la Home: cuántas fotos ha elegido el usuario
// hoy y cuántos bytes ha liberado hoy. Es deliberadamente un contador de
// GANANCIA: solo sube, se reinicia cada día, y nunca refleja lo que queda
// pendiente (eso espantaría a quien tiene el carrete lleno).
export type ProgresoDiario = {
  fecha: string; // 'YYYY-MM-DD' del día al que corresponde el marcador
  elegidas: number;
  bytesLiberados: number;
};

// Devuelve la fecha de hoy como 'YYYY-MM-DD' en horario local, para poder
// comparar si el marcador guardado es de hoy o de un día anterior.
function hoyISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function vacioDeHoy(): ProgresoDiario {
  return { fecha: hoyISO(), elegidas: 0, bytesLiberados: 0 };
}

// Cache en memoria para lectura síncrona desde el render, igual que en
// revisados.ts. Se rellena con inicializarProgreso().
let cache: ProgresoDiario | null = null;

async function cargarCache(): Promise<ProgresoDiario> {
  if (cache) return cache;
  try {
    const guardado = await AsyncStorage.getItem(CLAVE_PROGRESO);
    const parseado: ProgresoDiario | null = guardado ? JSON.parse(guardado) : null;
    // Si lo guardado es de otro día (o no hay nada), empezamos de cero hoy.
    cache = parseado && parseado.fecha === hoyISO() ? parseado : vacioDeHoy();
  } catch {
    cache = vacioDeHoy();
  }
  return cache;
}

// Se llama una vez al arrancar la Home, antes de pintar, para que
// obtenerProgresoHoy() ya tenga datos disponibles de forma síncrona.
export async function inicializarProgreso(): Promise<void> {
  await cargarCache();
}

// Lectura síncrona. Si el marcador en cache es de un día anterior, devuelve
// uno vacío de hoy (sin escribir todavía; la escritura ocurre al sumar).
// Asume que inicializarProgreso() ya se llamó; si no, devuelve vacío de hoy.
export function obtenerProgresoHoy(): ProgresoDiario {
  if (cache && cache.fecha === hoyISO()) return cache;
  return vacioDeHoy();
}

async function persistir(): Promise<void> {
  try {
    await AsyncStorage.setItem(CLAVE_PROGRESO, JSON.stringify(cache));
  } catch {
    // Si falla el guardado, el marcador sigue vivo en memoria esta sesión;
    // no rompemos el flujo del usuario por esto.
  }
}

// Suma al marcador de hoy una foto elegida y los bytes liberados con ella
// (los bytes pueden ser 0 si el usuario no borró nada, y sigue contando la
// elección). Si el marcador en cache era de ayer, se reinicia a hoy antes
// de sumar, para que nunca se arrastre el número de un día a otro.
// Total de espacio liberado con Fondly desde siempre (todas las pantallas
// que borran). Solo sube; se enseña como recompensa en Épocas.
let liberadoTotal: number | null = null;

export async function obtenerLiberadoTotal(): Promise<number> {
  if (liberadoTotal !== null) return liberadoTotal;
  try {
    liberadoTotal = Number(await AsyncStorage.getItem(CLAVE_LIBERADO_TOTAL)) || 0;
  } catch {
    liberadoTotal = 0;
  }
  return liberadoTotal;
}

// Las sumas van en fila, una detrás de otra: dos borrados casi a la vez no
// se pisan el contador.
let cola: Promise<void> = Promise.resolve();

export function sumarLiberado(bytes: number): Promise<void> {
  const tarea = cola.then(() => sumarLiberadoAhora(bytes));
  cola = tarea.catch(() => {});
  return tarea;
}

async function sumarLiberadoAhora(bytes: number): Promise<void> {
  if (bytes <= 0) return;
  invalidarEstimaciones();
  invalidarEstimacionesVideo();
  liberadoTotal = (await obtenerLiberadoTotal()) + bytes;
  try {
    await AsyncStorage.setItem(CLAVE_LIBERADO_TOTAL, String(liberadoTotal));
  } catch {
    // Se mantiene en memoria esta sesión.
  }
  // También al marcador de hoy de Inicio, venga de donde venga el borrado.
  const actual = await cargarCache();
  const base = actual.fecha === hoyISO() ? actual : vacioDeHoy();
  cache = { ...base, bytesLiberados: base.bytesLiberados + bytes };
  await persistir();
}

export async function sumarEleccion(bytesLiberados: number): Promise<void> {
  await sumarLiberado(bytesLiberados);
  const actual = await cargarCache();
  const base = actual.fecha === hoyISO() ? actual : vacioDeHoy();
  cache = { ...base, elegidas: base.elegidas + 1 };
  await persistir();
}
