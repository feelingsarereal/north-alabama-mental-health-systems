import { Link } from 'react-router-dom';
import { D, useData } from '@/lib/data';
import RegionMap from '@/components/maps/RegionMap';

export default function MapRegion() {
  const layers = useData(D.layers);
  const map = useData(D.mapRegion);
  const locations = useData(D.locations);
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8">
      <h1 className="text-3xl sm:text-4xl">The fifteen counties</h1>
      <p className="mt-2 max-w-3xl text-[15px]">The catchment of the Huntsville crisis center: Madison and Cullman (the core, outlined in orange) and the thirteen counties of the ring, with the rest of Alabama in grey. Choose a layer, hover or focus a county for its value beside Alabama's, click it for every layer, and switch on the service areas and the service locations the report names. Every value is as its publisher released it; see <Link to="/map/sources">the map sources</Link>. For Madison and Cullman below the county line, see <Link to="/map/tracts">the tract map</Link>.</p>
      <div className="mt-6">{!layers || !map || !locations ? <p className="bx-muted" role="status">Loading the map…</p> : <RegionMap layers={layers} map={map} locations={locations} defaultLayer="pct_poverty" />}</div>
    </div>
  );
}
