import type { Source } from '../types';
import { mtgtop8 } from './mtgtop8';

/** Registry of supported result sites. Add new adapters here. */
export const sources: Record<string, Source> = {
  [mtgtop8.id]: mtgtop8,
};

export const DEFAULT_SOURCE = mtgtop8.id;

export function getSource(id: string | null | undefined): Source | undefined {
  return sources[id ?? DEFAULT_SOURCE];
}
