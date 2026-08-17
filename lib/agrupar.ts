export type Foto = {
  id: string;
  creationTime: number;
};

export type GrupoFotos = {
  fotos: Foto[];
};

const UMBRAL_MS = 5000;

export function agruparPorTiempo(fotos: Foto[]): GrupoFotos[] {
  if (fotos.length === 0) return [];

  const ordenadas = [...fotos].sort((a, b) => a.creationTime - b.creationTime);

  const grupos: GrupoFotos[] = [];
  let grupoActual: Foto[] = [ordenadas[0]];

  for (let i = 1; i < ordenadas.length; i++) {
    const anterior = ordenadas[i - 1];
    const actual = ordenadas[i];
    const diferencia = actual.creationTime - anterior.creationTime;

    if (diferencia <= UMBRAL_MS) {
      grupoActual.push(actual);
    } else {
      grupos.push({ fotos: grupoActual });
      grupoActual = [actual];
    }
  }

  grupos.push({ fotos: grupoActual });

  return grupos;
}
