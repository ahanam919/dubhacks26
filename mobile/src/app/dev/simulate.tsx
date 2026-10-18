import GeofenceMap from '../../components/GeofenceMap';
import { API_URL } from '../../lib/config';

// Simulated location: drag a pin next to a chain and get the same suggestion a real
// geofence would trigger. Stands in for real geofencing, which is unreliable in a
// crowded hall. Calls the same server endpoint (/geofence/check).
export default function SimulateScreen() {
  return <GeofenceMap apiBaseUrl={API_URL} />;
}
