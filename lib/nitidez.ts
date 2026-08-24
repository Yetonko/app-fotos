import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import { toByteArray } from 'base64-js';
import jpeg from 'jpeg-js';

// Tamaño al que se reduce la foto antes de medir su nitidez. A 64px el
// propio redimensionado ya difuminaba tanto la imagen que enmascaraba el
// desenfoque real (composiciones con mucho contraste puntuaban más alto que
// fotos nítidas con fondo liso). A 300px queda margen para que el filtro
// Laplaciano detecte desenfoque de verdad, sin ser tan grande como para
// notarse en el tiempo de análisis.
const TAMANO_NITIDEZ = 300;

// Umbral orientativo de partida — hay que recalibrarlo con fotos reales del
// carrete ahora que cambia la resolución de análisis (los valores ya no son
// comparables con los de la versión a 64px).
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