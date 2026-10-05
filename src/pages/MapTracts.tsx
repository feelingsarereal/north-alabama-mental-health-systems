import { Link } from 'react-router-dom';
import { D, useData } from '@/lib/data';
import TractMap from '@/components/maps/TractMap';

export default function MapTracts() {
  const layers = useData(D.layers);
  const map = useData(D.mapTracts);
  const locations = useData(D.locations);
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8">
      <h1 className="text-3xl sm:text-4xl">Census tracts of Madison and Cullman</h1>
      <p className="mt-2 max-w-3xl text-[15px]">The 117 census tracts of the two core counties, each county in its own frame. Survey estimates from the American Community Survey come with their margins of error; modeled estimates from CDC PLACES are labelled as modeled. Neither set of values is used in the report's text. See <Link to="/map/sources">the map sources</Link>, or <Link to="/map/region">the fifteen counties</Link>.</p>
      <div className="mt-6">{!layers || !map || !locations ? <p className="bx-muted" role="status">Loading the map…</p> : <TractMap layers={layers} map={map} locations={locations} defaultLayer="pct_poverty" />}</div>
    </div>
  );
}
