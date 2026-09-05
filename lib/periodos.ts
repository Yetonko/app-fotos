import * as MediaLibrary from 'expo-media-library';

// Un periodo es un semestre natural: Ene-Jun o Jul-Dic de un año concreto.
// Se usan semestres fijos (no una ventana móvil desde "hoy") porque son más
// fáciles de reconocer para el usuario ("la primera mitad de 2023") y no
// cambian de límites según el día en que se abra la app.
export type Periodo = {
  id: string; // ej. '2026-H1'
  etiqueta: string; // ej. 'Ene - Jun 2026'
  desde: number; // timestamp (ms) del primer instante del periodo
  hasta: number; // timestamp (ms) del último instante del periodo
};

const MESES_INICIO_SEMESTRE = { 1: 0, 2: 6 } as const; // enero=0, julio=6 en Date

function limitesSemestre(anio: number, semestre: 1 | 2): { desde: number; hasta: number } {
  const mesInicio = MESES_INICIO_SEMESTRE[semestre];
  const desde = new Date(anio, mesInicio, 1, 0, 0, 0, 0).getTime();
  // Un mes por delante y un milisegundo atrás = último instante del semestre,
  // sin tener que calcular a mano cuántos días tiene el último mes.
  const hasta = new Date(anio, mesInicio + 6, 1, 0, 0, 0, 0).getTime() - 1;
  return { desde, hasta };
}

function etiquetaSemestre(anio: number, semestre: 1 | 2): string {
  return semestre === 1 ? `Ene - Jun ${anio}` : `Jul - Dic ${anio}`;
}

function semestreDe(fecha: number): { anio: number; semestre: 1 | 2 } {
  const d = new Date(fecha);
  return { anio: d.getFullYear(), semestre: d.getMonth() < 6 ? 1 : 2 };
}

// Genera la lista de periodos semestrales desde el más reciente (que
// contiene `ahora`) hacia atrás, hasta cubrir `fechaMasAntigua` inclusive.
// Devuelve el más reciente primero, igual que el resto de listas de la app.
export function generarPeriodos(fechaMasAntigua: number, ahora: number = Date.now()): Periodo[] {
  const fin = semestreDe(ahora);

  // Caso borde: si la fecha "más antigua" es en realidad posterior a
  // "ahora" (carrete vacío, o el reloj del dispositivo dando datos raros),
  // no hay nada que recorrer hacia atrás — devolvemos solo el semestre
  // actual en vez de arriesgarnos a un bucle que no encuentra su salida.
  if (fechaMasAntigua >= ahora) {
    const { desde, hasta } = limitesSemestre(fin.anio, fin.semestre);
    return [{ id: `${fin.anio}-H${fin.semestre}`, etiqueta: etiquetaSemestre(fin.anio, fin.semestre), desde, hasta }];
  }

  const inicio = semestreDe(fechaMasAntigua);

  const periodos: Periodo[] = [];
  let anio = fin.anio;
  let semestre = fin.semestre;

  // Segunda red de seguridad, por si algún caso borde no previsto hiciera
  // que el bucle no encontrara nunca el semestre de salida.
  const limiteIteraciones = 200; // 100 años de margen, de sobra
  let iteraciones = 0;

  while (iteraciones < limiteIteraciones) {
    const { desde, hasta } = limitesSemestre(anio, semestre);
    periodos.push({
      id: `${anio}-H${semestre}`,
      etiqueta: etiquetaSemestre(anio, semestre),
      desde,
      hasta,
    });

    if (anio === inicio.anio && semestre === inicio.semestre) break;

    if (semestre === 2) {
      semestre = 1;
    } else {
      semestre = 2;
      anio -= 1;
    }
    iteraciones++;
  }

  return periodos;
}

// Conteo barato: le pedimos a expo-media-library el total de fotos del
// rango sin descargar ninguna (first: 1 solo pide la primera para poder
// leer totalCount). Se usa para avisar antes de entrar a un periodo con
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
    first: 1,
  });
  return {
    total: resultado.totalCount,
    portadaUri: resultado.assets[0]?.uri ?? null,
  };
}
