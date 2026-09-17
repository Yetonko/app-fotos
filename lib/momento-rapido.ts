import * as MediaLibrary from 'expo-media-library';

// El "modo momento" es un flujo rápido, aparte del torneo: en vez de
// agrupar ráfagas y comparar, trae sin más las fotos recientes de una
// ventana de tiempo corta (lo que acabas de hacer en el concierto, la
// playa, el cumple) para elegir varias y publicarlas al instante. No usa
// hashing ni agrupación: aquí no se compara, solo se elige y se descarta.
//
// OJO: no confundir con lib/momentos.ts, que es otra cosa (registro
// persistente de las fotos ganadoras del torneo, para la pestaña Álbumes).

// Ventanas de tiempo que ofrece el selector rápido de la pantalla.
export type VentanaMomento = '5min' | '1h' | 'hoy';

export type FotoMomento = { id: string; uri: string; creationTime: number };

// Traduce la ventana elegida a un timestamp "desde" (ms). Para 'hoy'
// usamos el inicio del día natural del dispositivo, no "hace 24 horas",
// porque encaja mejor con cómo piensa la gente ("las de hoy").
function inicioDeVentana(ventana: VentanaMomento, ahora: number): number {
  if (ventana === '5min') return ahora - 5 * 60 * 1000;
  if (ventana === '1h') return ahora - 60 * 60 * 1000;
  // 'hoy': desde las 00:00 locales de hoy.
  const d = new Date(ahora);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Trae las fotos de la ventana pedida, más recientes primero. `first: 60`
// es un tope de seguridad: en 5 min o 1 h es de sobra, y para 'hoy' evita
// cargar cientos de miniaturas de golpe (el modo momento es para elegir
// unas pocas, no para revisar el día entero).
export async function fotosDeVentana(
  ventana: VentanaMomento,
  ahora: number = Date.now()
): Promise<FotoMomento[]> {
  const desde = inicioDeVentana(ventana, ahora);

  const resultado = await MediaLibrary.getAssetsAsync({
    mediaType: 'photo',
    createdAfter: desde,
    createdBefore: ahora,
    sortBy: [[MediaLibrary.SortBy.creationTime, false]], // más recientes primero
    first: 60,
  });

  return resultado.assets.map((a) => ({
    id: a.id,
    uri: a.uri,
    creationTime: a.creationTime,
  }));
}

// Ordena un conjunto de fotos por tiempo ascendente (las más antiguas
// primero). Se usa justo antes de compartir un carrusel, para entregar las
// fotos a iOS en orden cronológico — que es lo máximo que podemos
// garantizar desde nuestro lado (Instagram luego puede reordenar, eso ya
// no lo controla ninguna app).
export function ordenarPorTiempo(fotos: FotoMomento[]): FotoMomento[] {
  return [...fotos].sort((a, b) => a.creationTime - b.creationTime);
}
