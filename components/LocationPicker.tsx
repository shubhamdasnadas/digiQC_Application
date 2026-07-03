'use client';

import { useEffect, useRef, useState } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';

interface LocationPickerProps {
  apiKey: string;
  initialLat?: number | null;
  initialLng?: number | null;
  onLocationSelect: (lat: number, lng: number, address: string) => void;
}

function MapClickHandler({
  onSelect,
}: {
  onSelect: (lat: number, lng: number) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const listener = map.addListener('click', (e: any) => {
      if (e.latLng) {
        onSelect(e.latLng.lat(), e.latLng.lng());
      }
    });

    return () => listener.remove();
  }, [map, onSelect]);

  return null;
}

function MapController({
  lat,
  lng,
  zoom,
}: {
  lat: number;
  lng: number;
  zoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    map.setCenter({ lat, lng });
    map.setZoom(zoom);
  }, [map, lat, lng, zoom]);

  return null;
}

function PlacesAutocomplete({
  onSelect,
}: {
  onSelect: (lat: number, lng: number, address: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const placesLib = useMapsLibrary('places');

  const [autocomplete, setAutocomplete] = useState<any>(null);

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;

    const ac = new (placesLib as any).Autocomplete(inputRef.current, {
      fields: ['geometry', 'formatted_address', 'name'],
    });

    setAutocomplete(ac);
  }, [placesLib]);

  useEffect(() => {
    if (!autocomplete) return;

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();

      if (!place.geometry?.location) return;

      onSelect(
        place.geometry.location.lat(),
        place.geometry.location.lng(),
        place.formatted_address ?? place.name ?? ''
      );
    });

    return () => listener.remove();
  }, [autocomplete, onSelect]);

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder="Search location..."
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
    />
  );
}

export default function LocationPicker({
  apiKey,
  initialLat,
  initialLng,
  onLocationSelect,
}: LocationPickerProps) {
  const [lat, setLat] = useState(initialLat ?? 19.076);
  const [lng, setLng] = useState(initialLng ?? 72.8777);
  const [zoom, setZoom] = useState(initialLat ? 15 : 5);

  const handleSelect = (
    newLat: number,
    newLng: number,
    address: string = ''
  ) => {
    setLat(newLat);
    setLng(newLng);
    setZoom(15);

    onLocationSelect(newLat, newLng, address);
  };

  if (!apiKey) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
        Set{' '}
        <code className="font-mono">
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        </code>{' '}
        in your <code className="font-mono">.env.local</code> to enable the
        map picker.
      </div>
    );
  }

  return (
    <>
    </>
    // <APIProvider apiKey={apiKey}>
    //   <div className="space-y-3">
    //     <PlacesAutocomplete onSelect={handleSelect} />

    //     <div className="relative h-64 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
    //       <Map
    //         mapId="digiqc-project-picker"
    //         style={{ width: '100%', height: '100%' }}
    //         center={{ lat, lng }}
    //         zoom={zoom}
    //         gestureHandling="greedy"
    //         disableDefaultUI
    //       >
    //         <AdvancedMarker position={{ lat, lng }} />

    //         <MapClickHandler
    //           onSelect={(newLat, newLng) =>
    //             handleSelect(newLat, newLng)
    //           }
    //         />

    //         <MapController
    //           lat={lat}
    //           lng={lng}
    //           zoom={zoom}
    //         />
    //       </Map>

    //       <div className="absolute right-2 top-2 z-10 flex flex-col gap-2">
    //         <button
    //           type="button"
    //           onClick={() => setZoom((z) => Math.min(z + 1, 20))}
    //           className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white shadow hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
    //         >
    //           +
    //         </button>

    //         <button
    //           type="button"
    //           onClick={() => setZoom((z) => Math.max(z - 1, 1))}
    //           className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white shadow hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
    //         >
    //           −
    //         </button>
    //       </div>
    //     </div>

    //     <p className="text-xs text-gray-500 dark:text-gray-400">
    //       Click anywhere on the map to drop a pin or search by address above.
    //     </p>
    //   </div>
    // </APIProvider>
  );
}