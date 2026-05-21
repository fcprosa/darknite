import { useCallback, useEffect, useState } from "react";
import * as Location from "expo-location";

export interface Coords {
  latitude: number;
  longitude: number;
}

export function useLocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<Location.PermissionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const requestPermission = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermissionStatus(status);

    if (status === Location.PermissionStatus.GRANTED) {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    }

    setLoading(false);
    return status;
  }, []);

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  return {
    coords,
    permissionStatus,
    requestPermission,
    loading,
  };
}
