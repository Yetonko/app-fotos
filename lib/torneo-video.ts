// Torneo de vídeos: cuando hay varios vídeos del mismo rato (el concierto,
// el cumple), ella elige el mejor con el mismo torneo que las fotos y
// decide qué hace con el resto.
//
// La pantalla (app/torneo-video.tsx) recibe los vídeos por aquí, en
// memoria, en vez de por la URL (pueden ser muchos).

export type VideoTorneo = {
  id: string;
  uri: string; // ph://… en iPhone: sirve para miniatura y para reproducir
  filename: string;
  creationTime: number;
  duracion: number;
  noMedible: boolean;
};

let videosPendientes: VideoTorneo[] = [];

export function prepararTorneoVideo(videos: VideoTorneo[]): void {
  videosPendientes = [...videos].sort((a, b) => a.creationTime - b.creationTime);
}

export function obtenerTorneoVideo(): VideoTorneo[] {
  return videosPendientes;
}

// Dos vídeos son "del mismo rato" si entre uno y el siguiente pasan como
// mucho estos minutos.
const MINUTOS_MISMO_RATO = 5;

// Agrupa los vídeos que se grabaron seguidos. Solo devuelve grupos de 2 o
// más (los sueltos no necesitan torneo). Del más reciente al más antiguo.
export function videosDelMismoRato<T extends { creationTime: number }>(videos: T[]): T[][] {
  const ordenados = [...videos].sort((a, b) => a.creationTime - b.creationTime);
  const grupos: T[][] = [];
  let actual: T[] = [];
  for (const v of ordenados) {
    const anterior = actual[actual.length - 1];
    if (anterior && v.creationTime - anterior.creationTime > MINUTOS_MISMO_RATO * 60 * 1000) {
      if (actual.length > 1) grupos.push(actual);
      actual = [];
    }
    actual.push(v);
  }
  if (actual.length > 1) grupos.push(actual);
  return grupos.reverse();
}
