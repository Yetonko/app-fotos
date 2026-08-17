// Gestiona un torneo por eliminación 1 contra 1 entre las fotos candidatas de un grupo.
// El objetivo: a partir de N fotos, llegar a 1 sola ganadora mediante comparaciones por parejas.

export type FotoCandidata = {
  id: string;
  uri: string;
};

export type EstadoTorneo = {
  rondaActual: FotoCandidata[];   // fotos que compiten en la ronda actual
  siguienteRonda: FotoCandidata[]; // ganadoras acumuladas, esperando la próxima ronda
  indiceParejaActual: number;      // qué pareja de la ronda actual toca comparar ahora
  ganadora: FotoCandidata | null;  // solo tiene valor cuando el torneo ha terminado
};

// Crea el estado inicial del torneo a partir de las candidatas de un grupo.
export function iniciarTorneo(candidatas: FotoCandidata[]): EstadoTorneo {
  if (candidatas.length === 0) {
    throw new Error('No se puede iniciar un torneo sin candidatas');
  }

  if (candidatas.length === 1) {
    return {
      rondaActual: [],
      siguienteRonda: [],
      indiceParejaActual: 0,
      ganadora: candidatas[0],
    };
  }

  return {
    rondaActual: candidatas,
    siguienteRonda: [],
    indiceParejaActual: 0,
    ganadora: null,
  };
}

// Devuelve la pareja de fotos que toca comparar ahora mismo.
export function parejaActual(estado: EstadoTorneo): [FotoCandidata, FotoCandidata] | null {
  if (estado.ganadora) return null;

  const i = estado.indiceParejaActual * 2;
  if (i + 1 >= estado.rondaActual.length) return null;

  return [estado.rondaActual[i], estado.rondaActual[i + 1]];
}

// Aplica la elección del usuario y devuelve el nuevo estado del torneo.
export function elegirGanadora(estado: EstadoTorneo, foto: FotoCandidata): EstadoTorneo {
  const nuevaSiguienteRonda = [...estado.siguienteRonda, foto];
  const nuevoIndice = estado.indiceParejaActual + 1;

  const hayMasParejasEnRonda = (nuevoIndice * 2 + 1) < estado.rondaActual.length;

  if (hayMasParejasEnRonda) {
    return {
      ...estado,
      siguienteRonda: nuevaSiguienteRonda,
      indiceParejaActual: nuevoIndice,
    };
  }

  const fotoSuelta =
    estado.rondaActual.length % 2 !== 0
      ? estado.rondaActual[estado.rondaActual.length - 1]
      : null;

  const siguienteRondaCompleta = fotoSuelta
    ? [...nuevaSiguienteRonda, fotoSuelta]
    : nuevaSiguienteRonda;

  if (siguienteRondaCompleta.length === 1) {
    return {
      rondaActual: [],
      siguienteRonda: [],
      indiceParejaActual: 0,
      ganadora: siguienteRondaCompleta[0],
    };
  }

  return {
    rondaActual: siguienteRondaCompleta,
    siguienteRonda: [],
    indiceParejaActual: 0,
    ganadora: null,
  };
}