import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import { toByteArray } from 'base64-js';
import jpeg from 'jpeg-js';

const TAMANO_NITIDEZ = 64;

// Umbral orientativo de partida — hay que calibrarlo con fotos reales del carrete.
// Por debajo de este valor, la foto se considera borrosa.
export const UMBRAL_BORROSA = 1200;

export async function calcularNitidez(assetId: string): Promise<number> {
  const info = await MediaLibrary.getAssetInfoAsync(assetId);
  const uriLocal = info.localUri ?? info.uri;

  const manipulado = await ImageManipulator.manipulateAsync(
    uriLocal,
    [{ resize: { width: TAMANO_NITIDEZ, height: TAMANO_NITIDEZ } }],
    { base64: true, compress: 1, format: ImageManipulator.SaveFormat.JPEG }
  );

  const bytes = toByteArray(manipulado.base64!);
  const decodificado = jpeg.decode(bytes, { useTArray: true });
  const { width: ancho, height: alto, data } = decodificado;

  const grises = new Float32Array(ancho * alto);
  for (let i = 0; i < grises.length; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    grises[i] = (r + g + b) / 3;
  }

  const laplaciano: number[] = [];
  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      const idx = y * ancho + x;
      const valor =
        -4 * grises[idx] +
        grises[idx - 1] +
        grises[idx + 1] +
        grises[idx - ancho] +
        grises[idx + ancho];
      laplaciano.push(valor);
    }
  }

  const media = laplaciano.reduce((a, b) => a + b, 0) / laplaciano.length;
  const varianza =
    laplaciano.reduce((suma, v) => suma + (v - media) ** 2, 0) / laplaciano.length;

  return varianza;
}

export function esBorrosa(nitidez: number, umbral: number = UMBRAL_BORROSA): boolean {
  return nitidez < umbral;
}