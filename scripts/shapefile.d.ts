declare module 'shapefile' {
  import type { Geometry } from 'geojson';
  export interface Source { read(): Promise<{ done: boolean; value: { type: 'Feature'; properties: Record<string, unknown>; geometry: Geometry } }> }
  export function open(shp: ArrayBuffer, dbf?: ArrayBuffer): Promise<Source>;
}
