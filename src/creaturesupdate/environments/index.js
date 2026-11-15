// The two environments. createEnvironment('aquatic') or createEnvironment('safari').
import { createAquatic } from './aquatic.js';
import { createSafari } from './safari.js';

export const ENVIRONMENTS = { aquatic: createAquatic, safari: createSafari };

export function createEnvironment(kind = 'aquatic', options) {
  return (ENVIRONMENTS[kind] || createAquatic)(options);
}
