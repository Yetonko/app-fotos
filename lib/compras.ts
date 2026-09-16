import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

// Clave pública de RevenueCat para iOS (empieza por 'appl_'). Se obtiene en
// app.revenuecat.com → Project → API Keys. Es pública (va en el bundle de la
// app), no es un secreto: no da acceso a nada sensible por sí sola.
const CLAVE_REVENUECAT_IOS = 'appl_GwUYHtrYwyaDsVKrqEzuoUhrapF';

// IDs exactos dados de alta en App Store Connect y en RevenueCat. Se
// centralizan aquí para que ningún otro archivo tenga que repetirlos.
export const ID_SUSCRIPCION = 'fondly_unlimited_monthly';
export const ID_PACK = 'fondly_pack50';
// Entitlement de RevenueCat que marca a un usuario como premium (ligado
// solo a la suscripción; el pack no otorga entitlement, se gestiona como
// créditos consumibles en lib/uso.ts).
export const ENTITLEMENT_PREMIUM = 'com_mariopalomar_fondly_pro';

// Se llama una única vez, lo antes posible al arrancar la app (en el
// _layout.tsx raíz). Sin esto, cualquier llamada a Purchases fallará.
export function inicializarCompras(): void {
  if (Platform.OS !== 'ios') {
    // De momento solo configuramos iOS; Android se añadiría con su propia
    // clave cuando/si se lance en esa plataforma.
    return;
  }
  Purchases.configure({ apiKey: CLAVE_REVENUECAT_IOS });
}

// Consulta a RevenueCat si el usuario tiene la suscripción activa ahora
// mismo. Se apoya en el caché local del SDK, así que es rápida y no
// requiere red la mayoría de las veces.
export async function esPremium(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return Boolean(customerInfo.entitlements.active[ENTITLEMENT_PREMIUM]);
  } catch {
    // Si falla la consulta (sin red, etc.), tratamos como no-premium en
    // vez de bloquear la app o asumir acceso que no se puede confirmar.
    return false;
  }
}
