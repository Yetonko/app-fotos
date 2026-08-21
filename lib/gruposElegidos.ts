import { FotoCandidata } from './torneo';

// Guarda en memoria, mientras la app está abierta, qué foto ganó en cada
// grupo. No se guarda al cerrar la app - solo sirve para recordar el estado
// mientras navegas entre la lista de grupos y la pantalla de selección.
const ganadorasPorGrupo = new Map<string, FotoCandidata>();

export function marcarGanadora(grupoId: string, foto: FotoCandidata) {
  ganadorasPorGrupo.set(grupoId, foto);
}

export function obtenerGanadora(grupoId: string): FotoCandidata | undefined {
  return ganadorasPorGrupo.get(grupoId);
}
