/**
 * Shipping carrier service router.
 * Detects carrier from container number prefix and delegates to the right provider.
 * Falls back to manual/mock data when API keys are not configured.
 */

import { track as maerskTrack, isConfigured as maerskConfigured } from './maersk.js';
import { track as hapagTrack, isConfigured as hapagConfigured } from './hapagLloyd.js';
import { track as cmaTrack, isConfigured as cmaConfigured } from './cmaCgm.js';
import { track as manualTrack } from './manual.js';

// Container number prefix → carrier key
const PREFIX_MAP = {
  MSKU: 'maersk',
  MAEU: 'maersk',
  MRKU: 'maersk',
  HLBU: 'hapag_lloyd',
  HLXU: 'hapag_lloyd',
  HLCU: 'hapag_lloyd',
  UACU: 'hapag_lloyd',
  CMAU: 'cma_cgm',
  CRXU: 'cma_cgm',
  CGMU: 'cma_cgm',
  MSCU: 'msc',
  MEDU: 'msc',
};

export function detectCarrier(containerNumber) {
  if (!containerNumber) return null;
  const prefix = containerNumber.toUpperCase().slice(0, 4);
  return PREFIX_MAP[prefix] || null;
}

export function getCarrierStatus() {
  return {
    maersk: { name: 'Maersk', configured: maerskConfigured() },
    hapag_lloyd: { name: 'Hapag-Lloyd', configured: hapagConfigured() },
    cma_cgm: { name: 'CMA CGM', configured: cmaConfigured() },
    msc: { name: 'MSC', configured: false, note: 'MSC API not publicly available' },
  };
}

/**
 * Track a container by number.
 * @param {string} containerNumber
 * @param {object} [orderData] - optional order row for manual fallback
 * @returns {Promise<{data: object, source: string}>}
 */
export async function trackContainer(containerNumber, orderData = null) {
  const carrier = detectCarrier(containerNumber);

  try {
    if (carrier === 'maersk' && maerskConfigured()) {
      const data = await maerskTrack(containerNumber);
      return { data, source: 'maersk_api' };
    }
    if (carrier === 'hapag_lloyd' && hapagConfigured()) {
      const data = await hapagTrack(containerNumber);
      return { data, source: 'hapag_lloyd_api' };
    }
    if (carrier === 'cma_cgm' && cmaConfigured()) {
      const data = await cmaTrack(containerNumber);
      return { data, source: 'cma_cgm_api' };
    }
  } catch (err) {
    console.error(`[shipping] ${carrier} API error for ${containerNumber}:`, err.message);
    // Fall through to manual
  }

  // Fallback: manual data stored on the order
  const data = manualTrack(containerNumber, orderData);
  return { data, source: 'manual' };
}
