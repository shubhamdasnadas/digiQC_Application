'use client';

import { useEffect, useRef, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';

interface LocationPickerProps {
  apiKey: string;
  initialLat?: number | null;
  initialLng?: number | null;
  onLocationSelect: (lat: number, lng: number, address: string) => void;
}

function MapClickHandler({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) onSelect(e.latLng.lat(), e.latLng.lng());
    });
    return () => listener.remove();
  }, [map, onSelect]);
  return null;
}

function MapController({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    map.setCenter({ lat, lng });
    map.setZoom(15);
  }, [map, lat, lng]);
  return null;
}

function PlacesAutocomplete({
  onSelect,
}: {
  onSelect: (lat: number, lng: number, address: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const placesLib = useMapsLibrary('places');
  const [autocomplete, setAutocomplete] =
    useState<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;
    const ac = new placesLib.Autocomplete(inputRef.current, {
      fields: ['geometry', 'formatted_address', 'name'],
    });
    setAutocomplete(ac);
  }, [placesLib]);

  useEffect(() => {
    if (!autocomplete) return;
    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.geometry?.location) {
        onSelect(
          place.geometry.location.lat(),
          place.geometry.location.lng(),
          place.formatted_address ?? place.name ?? ''
        );
      }
    });
    return () => listener.remove();
  }, [autocomplete, onSelect]);

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder="Enter an address"
      className="input"
    />
  );
}

export default function LocationPicker({
  apiKey,
  initialLat,
  initialLng,
  onLocationSelect,
}: LocationPickerProps) {
  const [lat, setLat] = useState<number>(initialLat ?? 19.076); // Mumbai default
  const [lng, setLng] = useState<number>(initialLng ?? 72.8777);
  const [zoom, setZoom] = useState<number>(initialLat ? 15 : 5);

  const handleSelect = (newLat: number, newLng: number, address: string = '') => {
    setLat(newLat);
    setLng(newLng);
    setZoom(15);
    onLocationSelect(newLat, newLng, address);
  };

  if (!apiKey) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
        Set <code className="font-mono">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in your
        <code className="font-mono"> .env.local</code> to enable the map picker. Lat/lng
        can still be entered manually below.
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <div className="space-y-2">
        <PlacesAutocomplete onSelect={handleSelect} />
        <div className="relative h-64 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
          <Map
            mapId="digiqc-project-picker"
            style={{ width: '100%', height: '100%' }}
            defaultCenter={{ lat, lng }}
            defaultZoom={zoom}
            gestureHandling="greedy"
            disableDefaultUI
          >
            <AdvancedMarker position={{ lat, lng }} />
            <MapClickHandler
              onSelect={(newLat, newLng) => handleSelect(newLat, newLng)}
            />
            <MapController lat={lat} lng={lng} />
          </Map>

          {/* Custom zoom controls (top-right) */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(z + 1, 20))}
              className="w-8 h-8 rounded-lg bg-white dark:bg-gray-800 shadow border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(z - 1, 1))}
              className="w-8 h-8 rounded-lg bg-white dark:bg-gray-800 shadow border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              aria-label="Zoom out"
            >
              −
            </button>
          </div>
        </div>
        <p className="text-[11px] text-gray-400">Click the map to drop a pin or search by address.</p>
      </div>
    </APIProvider>
  );
}
