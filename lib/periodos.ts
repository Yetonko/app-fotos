import * as MediaLibrary from 'expo-media-library';
import { nombreMesCorto, nombreMesLargo } from './idioma';

// Un periodo es un trimestre natural: Ene-Mar, Abr-Jun, Jul-Sep u Oct-Dic de
// un año concreto. Se usan trimestres fijos (no una ventana móvil desde
// "hoy") porque son más fáciles de reconocer para el usuario ("el primer
// trimestre de 2026") y no cambian de límites según el día en que se abra
// la app. Antes eran semestres; se pasó a trimestres para que cada periodo
// tenga menos fotos y no se haga eterno de revisar.
//
// Si un trimestre tiene demasiadas fotos (más de UMBRAL_DIVIDIR_EN_MESES),
// se parte en sus meses: así ningún periodo se hace eterno de revisar.
export type Periodo = {
  id: string; // ej. '2026-Q1', o '2026-M01' si es un mes
  etiqueta: string; // ej. 'Ene - Mar 2026', o 'Enero 2026'
  desde: number; // timestamp (ms) del primer instante del periodo
  hasta: number; // timestamp (ms) del último instante del periodo
  // Solo en meses: id del trimestre del que salen. Sirve para respetar lo
  // que ya se hubiera revisado cuando ese trimestre aún no se partía.
  trimestreId?: string;
};

export const UMBRAL_DIVIDIR_EN_MESES = 300;

const MESES_INICIO_TRIMESTRE = { 1: 0, 2: 3, 3: 6, 4: 9 } as const; // ene=0, abr=3, jul=6, oct=9 en Date
type Trimestre = 1 | 2 | 3 | 4;

function limitesTrimestre(anio: number, trimestre: Trimestre): { desde: number; hasta: number } {
  const mesInicio = MESES_INICIO_TRIMESTRE[trimestre];
  const desde = new Date(anio, mesInicio, 1, 0, 0, 0, 0).getTime();
  // Un mes (x3) por delante y un milisegundo atrás = último instante del
  // trimestre, sin tener que calcular a mano cuántos días tiene el último mes.
  const hasta = new Date(anio, mesInicio + 3, 1, 0, 0, 0, 0).getTime() - 1;
  return { desde, hasta };
}

function etiquetaTrimestre(anio: number, trimestre: Trimestre): string {
  const inicio = MESES_INICIO_TRIMESTRE[trimestre];
  return `${nombreMesCorto(inicio)} - ${nombreMesCorto(inicio + 2)} ${anio}`;
}

function trimestreDe(fecha: number): { anio: number; trimestre: Trimestre } {
  const d = new Date(fecha);
  const trimestre = (Math.floor(d.getMonth() / 3) + 1) as Trimestre;
  return { anio: d.getFullYear(), trimestre };
}

// Genera la lista de periodos trimestrales desde el más reciente (que
// contiene `ahora`) hacia atrás, hasta cubrir `fechaMasAntigua` inclusive.
// Devuelve el más reciente primero, igual que el resto de listas de la app.
export function generarPeriodos(fechaMasAntigua: number, ahora: number = Date.now()): Periodo[] {
  const fin = trimestreDe(ahora);

  // Caso borde: si la fecha "más antigua" es en realidad posterior a
  // "ahora" (carrete vacío, o el reloj del dispositivo dando datos raros),
  // no hay nada que recorrer hacia atrás — devolvemos solo el trimestre
  // actual en vez de arriesgarnos a un bucle que no encuentra su salida.
  if (fechaMasAntigua >= ahora) {
    const { desde, hasta } = limitesTrimestre(fin.anio, fin.trimestre);
    return [{ id: `${fin.anio}-Q${fin.trimestre}`, etiqueta: etiquetaTrimestre(fin.anio, fin.trimestre), desde, hasta }];
  }

  const inicio = trimestreDe(fechaMasAntigua);

  const periodos: Periodo[] = [];
  let anio = fin.anio;
  let trimestre = fin.trimestre;

  // Segunda red de seguridad, por si algún caso borde no previsto hiciera
  // que el bucle no encontrara nunca el trimestre de salida.
  const limiteIteraciones = 400; // 100 años de margen, de sobra (4 trimestres/año)
  let iteraciones = 0;

  while (iteraciones < limiteIteraciones) {
    const { desde, hasta } = limitesTrimestre(anio, trimestre);
    periodos.push({
      id: `${anio}-Q${trimestre}`,
      etiqueta: etiquetaTrimestre(anio, trimestre),
      desde,
      hasta,
    });

    if (anio === inicio.anio && trimestre === inicio.trimestre) break;

    if (trimestre === 1) {
      trimestre = 4;
      anio -= 1;
    } else {
      trimestre = (trimestre - 1) as Trimestre;
    }
    iteraciones++;
  }

  return periodos;
}

// Conteo barato: le pedimos a expo-media-library el total de fotos del
// rango sin descargar ninguna (solo pide unas pocas para poder leer
// totalCount y elegir portada). Se usa para avisar antes de entrar a un periodo con
// muchas fotos, sin tener que analizarlas todas primero.
export type ConteoPeriodo = {
  total: number;
  // Uri de la primera foto del periodo, para usarla de portada. Sale de la
  // misma consulta que el conteo (first:1 ya la trae), así que no cuesta
  // ninguna llamada extra. Puede ser null si el periodo no tiene fotos.
  portadaUri: string | null;
};

export async function contarFotosEnPeriodo(periodo: Periodo): Promise<ConteoPeriodo> {
  const resultado = await MediaLibrary.getAssetsAsync({
    mediaType: 'photo',
    createdAfter: periodo.desde,
    createdBefore: periodo.hasta,
    // Unas pocas, para poder saltarse las capturas de pantalla al elegir
    // portada (sigue sin descargar ninguna foto).
    first: 10,
  });
  const portada =
    resultado.assets.find((a) => !a.mediaSubtypes?.includes('screenshot')) ?? resultado.assets[0];
  return {
    total: resultado.totalCount,
    portadaUri: portada?.uri ?? null,
  };
}

// Parte un trimestre en sus tres meses, del más reciente al más antiguo
// (mismo orden que generarPeriodos).
export function mesesDeTrimestre(trimestre: Periodo): Periodo[] {
  const inicio = new Date(trimestre.desde);
  const anio = inicio.getFullYear();
  const primerMes = inicio.getMonth();
  const meses: Periodo[] = [];
  for (let m = primerMes + 2; m >= primerMes; m--) {
    const desde = new Date(anio, m, 1, 0, 0, 0, 0).getTime();
    const hasta = new Date(anio, m + 1, 1, 0, 0, 0, 0).getTime() - 1;
    meses.push({
      id: `${anio}-M${String(m + 1).padStart(2, '0')}`,
      etiqueta: `${nombreMesLargo(m)} ${anio}`,
      desde,
      hasta,
      trimestreId: trimestre.id,
    });
  }
  return meses;
}
