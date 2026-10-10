// Gestiona un torneo por eliminación entre las fotos candidatas de un grupo.
// El objetivo: a partir de N fotos, llegar a 1 sola ganadora con el menor
// número de toques razonable.
//
// Reglas de cada ronda:
// - Si el torneo empezó con muchas fotos (UMBRAL_GRUPOS_DE_4 o más), las
//   primeras RONDAS_CON_GRUPOS rondas se juegan en grupos de 3-4 fotos
//   (eliges tu favorita de cada grupo), mientras queden más de
//   MAX_FOTOS_PARA_DUELOS fotos.
// - El resto de rondas son duelos 1 contra 1. Si sobra una foto impar,
//   pasa directamente a la siguiente ronda.

export type FotoCandidata = {
  id: string;
  uri: string;
  // Opcional: solo se rellena para poder mostrar el valor en pantallas de
  // depuración (__DEV__) mientras calibramos el umbral de nitidez.
  nitidez?: number;
};

export type EstadoTorneo = {
  gruposRonda: FotoCandidata[][];     // grupos (de 2 a 4 fotos) de la ronda actual
  exenta: FotoCandidata | null;       // foto impar que pasa sola a la siguiente ronda
  siguienteRonda: FotoCandidata[];    // ganadoras acumuladas en esta ronda
  indiceGrupoActual: number;          // qué grupo de la ronda actual toca ahora
  numeroRonda: number;                // 0 = primera ronda
  empezoConMuchas: boolean;           // fijado al iniciar: activa los grupos de 4
  eleccionesHechas: number;           // toques de "elegir" válidos hasta ahora
  ganadora: FotoCandidata | null;     // solo tiene valor cuando el torneo ha terminado
};

const UMBRAL_GRUPOS_DE_4 = 10;
const RONDAS_CON_GRUPOS = 2;
const MAX_FOTOS_PARA_DUELOS = 6;

function rondaEnGrupos(empezoConMuchas: boolean, numeroRonda: number, numFotos: number): boolean {
  return empezoConMuchas && numeroRonda < RONDAS_CON_GRUPOS && numFotos > MAX_FOTOS_PARA_DUELOS;
}

// Reparte las fotos de una ronda en grupos. En rondas de grupos se hacen
// tantos grupos como hagan falta para que ninguno pase de 4, repartiendo
// lo más igualado posible (p. ej. 10 → 4+3+3): así nadie pasa gratis y no
// quedan grupos de 1 o 2 sueltos.
function formarRonda(
  fotos: FotoCandidata[],
  empezoConMuchas: boolean,
  numeroRonda: number
): { grupos: FotoCandidata[][]; exenta: FotoCandidata | null } {
  if (rondaEnGrupos(empezoConMuchas, numeroRonda, fotos.length)) {
    const numGrupos = Math.ceil(fotos.length / 4);
    const base = Math.floor(fotos.length / numGrupos);
    const conUnaMas = fotos.length % numGrupos;
    const grupos: FotoCandidata[][] = [];
    let inicio = 0;
    for (let g = 0; g < numGrupos; g++) {
      const tamano = base + (g < conUnaMas ? 1 : 0);
      grupos.push(fotos.slice(inicio, inicio + tamano));
      inicio += tamano;
    }
    return { grupos, exenta: null };
  }

  const grupos: FotoCandidata[][] = [];
  for (let i = 0; i + 1 < fotos.length; i += 2) {
    grupos.push([fotos[i], fotos[i + 1]]);
  }
  const exenta = fotos.length % 2 !== 0 ? fotos[fotos.length - 1] : null;
  return { grupos, exenta };
}

function estadoDeRonda(
  fotos: FotoCandidata[],
  empezoConMuchas: boolean,
  numeroRonda: number,
  eleccionesHechas: number
): EstadoTorneo {
  if (fotos.length === 1) {
    return {
      gruposRonda: [],
      exenta: null,
      siguienteRonda: [],
      indiceGrupoActual: 0,
      numeroRonda,
      empezoConMuchas,
      eleccionesHechas,
      ganadora: fotos[0],
    };
  }
  const { grupos, exenta } = formarRonda(fotos, empezoConMuchas, numeroRonda);
  return {
    gruposRonda: grupos,
    exenta,
    siguienteRonda: [],
    indiceGrupoActual: 0,
    numeroRonda,
    empezoConMuchas,
    eleccionesHechas,
    ganadora: null,
  };
}

// Crea el estado inicial del torneo a partir de las candidatas de un grupo.
export function iniciarTorneo(candidatas: FotoCandidata[]): EstadoTorneo {
  if (candidatas.length === 0) {
    throw new Error('No se puede iniciar un torneo sin candidatas');
  }
  return estadoDeRonda(candidatas, candidatas.length >= UMBRAL_GRUPOS_DE_4, 0, 0);
}

// Cuántas veces tendrá que elegir la usuaria en total, para la barra de
// progreso. Sigue exactamente las mismas reglas que formarRonda.
export function totalElecciones(numCandidatas: number): number {
  const empezoConMuchas = numCandidatas >= UMBRAL_GRUPOS_DE_4;
  let quedan = numCandidatas;
  let ronda = 0;
  let total = 0;
  while (quedan > 1) {
    if (rondaEnGrupos(empezoConMuchas, ronda, quedan)) {
      quedan = Math.ceil(quedan / 4);
      total += quedan;
    } else {
      total += Math.floor(quedan / 2);
      quedan = Math.ceil(quedan / 2);
    }
    ronda++;
  }
  return total;
}

// Devuelve las fotos (de 2 a 4) entre las que toca elegir ahora mismo.
export function grupoActual(estado: EstadoTorneo): FotoCandidata[] | null {
  if (estado.ganadora) return null;
  return estado.gruposRonda[estado.indiceGrupoActual] ?? null;
}

// Aplica la elección del usuario y devuelve el nuevo estado del torneo.
export function elegirGanadora(estado: EstadoTorneo, foto: FotoCandidata): EstadoTorneo {
  // Solo vale una foto del grupo que se está mostrando: protege contra un
  // toque tardío sobre una foto de un grupo que ya se ha resuelto.
  const grupo = grupoActual(estado);
  if (!grupo || !grupo.some((f) => f.id === foto.id)) return estado;

  const nuevaSiguienteRonda = [...estado.siguienteRonda, foto];
  const nuevoIndice = estado.indiceGrupoActual + 1;

  if (nuevoIndice < estado.gruposRonda.length) {
    return {
      ...estado,
      siguienteRonda: nuevaSiguienteRonda,
      indiceGrupoActual: nuevoIndice,
      eleccionesHechas: estado.eleccionesHechas + 1,
    };
  }

  const siguienteRondaCompleta = estado.exenta
    ? [...nuevaSiguienteRonda, estado.exenta]
    : nuevaSiguienteRonda;

  return estadoDeRonda(
    siguienteRondaCompleta,
    estado.empezoConMuchas,
    estado.numeroRonda + 1,
    estado.eleccionesHechas + 1
  );
}
