import { FotoCandidata } from './torneo';

export type GrupoAlmacenado = {
  candidatas: FotoCandidata[];
  descartadas: FotoCandidata[];
  ganadora?: FotoCandidata;
  // Fecha (creationTime) de la primera foto del grupo. Se usa para
  // mostrar la etiqueta de anio/mes en seleccion.tsx sin tener que volver
  // a consultar el carrete. Opcional por retrocompatibilidad, aunque en
  // la practica siempre se informa desde index.tsx / periodo.tsx.
  creationTime?: number;
};

// Guarda en memoria, mientras la app está abierta, los datos de cada grupo de
// fotos: las candidatas que compiten en el torneo, las descartadas por
// nitidez, y (una vez elegida) la ganadora. No se guarda al cerrar la app -
// solo sirve para recordar el estado mientras navegas entre la lista de
// grupos y la pantalla de selección.
//
// Es importante que sea la app la que registre estos datos al calcular los
// grupos (en index.tsx), y que seleccion.tsx solo reciba un grupoId por
// parámetro de navegación - nunca las fotos en sí. Así un enlace externo
// (deep link) no puede colar fotos ni ids que no procedan de una consulta
// real al carrete hecha en esta sesión.
const gruposPorId = new Map<string, GrupoAlmacenado>();

export function registrarGrupo(
  grupoId: string,
  candidatas: FotoCandidata[],
  descartadas: FotoCandidata[],
  creationTime?: number
) {
  const actual = gruposPorId.get(grupoId);
  gruposPorId.set(grupoId, {
    candidatas,
    descartadas,
    ganadora: actual?.ganadora,
    creationTime: creationTime ?? actual?.creationTime,
  });
}

export function obtenerGrupo(grupoId: string): GrupoAlmacenado | undefined {
  return gruposPorId.get(grupoId);
}

export function marcarGanadora(grupoId: string, foto: FotoCandidata) {
  const actual = gruposPorId.get(grupoId);
  if (actual) {
    actual.ganadora = foto;
  }
}

export function obtenerGanadora(grupoId: string): FotoCandidata | undefined {
  return gruposPorId.get(grupoId)?.ganadora;
}
