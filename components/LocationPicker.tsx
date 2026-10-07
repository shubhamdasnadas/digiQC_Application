'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Loader2, Key, Check, X, XCircle, MapPin } from 'lucide-react';
import tzlookup from 'tz-lookup';

const DEFAULT_CENTER = { lat: 21.1702, lng: 72.8311 }; // Surat / Mumbai region
const MAX_FIT_ZOOM = 20;

// Old IANA names that geocoders don't recognise
const TZ_CITY_ALIASES: Record<string, string> = {
  Calcutta: 'Kolkata',
  Saigon: 'Ho Chi Minh City',
  Katmandu: 'Kathmandu',
  Rangoon: 'Yangon',
  Kiev: 'Kyiv',
};

export type LocationValue = {
  address: string;
  radius: number;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
};

export function tzLabel(tz: string) {
  if (tz === 'Asia/Calcutta' || tz === 'Asia/Kolkata') {
    return 'Asia/Calcutta (GMT+05:30)';
  }
  try {
    const offset =
      new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
    return `${tz} (${offset === 'GMT' ? 'GMT+00:00' : offset})`;
  } catch {
    return tz;
  }
}

export function getTimezonesList() {
  const common = [
    'Asia/Calcutta',
    'Asia/Dubai',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'America/New_York',
    'America/Chicago',
    'America/Los_Angeles',
    'Australia/Sydney',
    'UTC',
  ];
  const list: string[] =
    typeof Intl !== 'undefined' && (Intl as any).supportedValuesOf
      ? (Intl as any).supportedValuesOf('timeZone')
      : common;
  const set = new Set(['Asia/Calcutta', ...common, ...list]);
  return [...set].map((tz) => ({ value: tz, label: tzLabel(tz) }));
}

interface LocationPickerProps {
  apiKey?: string;
  token?: string;
  lat?: number | null;
  lng?: number | null;
  initialLat?: number | null;
  initialLng?: number | null;
  radius?: number;
  timezone?: string;
  address?: string;
  showInputs?: boolean;
  onLocationSelect?: (lat: number, lng: number, address: string, timezone?: string) => void;
  onAddressChange?: (address: string) => void;
  onTimezoneChange?: (timezone: string) => void;
  onRadiusChange?: (radius: number) => void;
  onChange?: (v: LocationValue) => void;
}

let mapsLoaderPromise: Promise<any> | null = null;

function loadGoogleMaps(apiKey: string): Promise<any> {
  if (typeof window === 'undefined') return Promise.resolve();
  const w = window as any;
  if (w.google?.maps?.Map) return Promise.resolve(w.google.maps);

  if (mapsLoaderPromise) return mapsLoaderPromise;

  if (!apiKey) {
    return Promise.reject(
      new Error('Google Maps API Key is required. Click the key icon (🔑) on the map to configure.')
    );
  }

  mapsLoaderPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('gmaps-script');
    if (existing) existing.remove();

    const cbName = `__initGMap_${Math.random().toString(36).substring(2, 9)}`;
    w[cbName] = () => {
      delete w[cbName];
      resolve(w.google?.maps);
    };

    const s = document.createElement('script');
    s.id = 'gmaps-script';
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&v=weekly&loading=async&libraries=places,marker,geocoding&callback=${cbName}`;
    s.async = true;
    s.onerror = () => {
      delete w[cbName];
      s.remove();
      mapsLoaderPromise = null;
      reject(new Error('Failed to load Google Maps. Please check your API key and permissions.'));
    };
    document.head.appendChild(s);
  });

  return mapsLoaderPromise;
}

const canonicalTz = (tz: string) => {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions().timeZone;
  } catch {
    return tz;
  }
};

export default function LocationPicker({
  apiKey: propApiKey,
  lat: propLat,
  lng: propLng,
  initialLat,
  initialLng,
  radius: propRadius,
  timezone: propTimezone,
  address: propAddress,
  showInputs = false,
  onLocationSelect,
  onAddressChange,
  onTimezoneChange,
  onRadiusChange,
  onChange,
}: LocationPickerProps) {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any | null>(null);
  const markerRef = useRef<any | null>(null);
  const circleRef = useRef<any | null>(null);
  const geocoderRef = useRef<any | null>(null);
  const placesLibRef = useRef<any | null>(null);
  const sessionTokenRef = useRef<any | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Manual API Key State (stored in localStorage with fallback to .env)
  const [apiKey, setApiKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('GOOGLE_MAPS_API_KEY');
      if (saved) return saved;
    }
    return propApiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  });
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState(apiKey);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Search input and suggestions state
  const [searchInput, setSearchInput] = useState(propAddress || '');
  const [suggestions, setSuggestions] = useState<
    Array<{
      place_id?: string;
      description: string;
      mainText: string;
      secondaryText?: string;
      placePrediction?: any;
    }>
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);

  // Component state
  const [radius, setRadius] = useState<number>(propRadius !== undefined ? propRadius : 0);
  const radiusRef = useRef(radius);
  radiusRef.current = radius;

  const [timezone, setTimezone] = useState<string>(propTimezone || 'Asia/Calcutta');
  const [address, setAddress] = useState<string>(propAddress || '');
  const [lat, setLat] = useState<number | null>(
    propLat !== undefined && propLat !== null
      ? propLat
      : initialLat !== undefined && initialLat !== null
      ? initialLat
      : null
  );
  const [lng, setLng] = useState<number | null>(
    propLng !== undefined && propLng !== null
      ? propLng
      : initialLng !== undefined && initialLng !== null
      ? initialLng
      : null
  );

  // Timezones list
  const timezones = useMemo(() => getTimezonesList(), []);

  // Sync with prop changes
  useEffect(() => {
    const envOrProp = propApiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    if (envOrProp && !apiKey) {
      setApiKey(envOrProp);
      setKeyInput(envOrProp);
    }
  }, [propApiKey]);

  useEffect(() => {
    if (propRadius !== undefined && propRadius !== radius) {
      setRadius(propRadius);
    }
  }, [propRadius]);

  useEffect(() => {
    if (propAddress !== undefined && propAddress !== address) {
      setAddress(propAddress);
      setSearchInput(propAddress);
    }
  }, [propAddress]);

  useEffect(() => {
    if (propLat !== undefined && propLat !== lat) setLat(propLat);
    if (propLng !== undefined && propLng !== lng) setLng(propLng);
  }, [propLat, propLng]);

  // Zoom the map to the circle (or a close zoom if no radius yet)
  const focusCircle = useCallback(() => {
    const map = mapRef.current;
    const circle = circleRef.current;
    const gmaps = (window as any).google?.maps;
    if (!map || !circle || !gmaps) return;

    if (radiusRef.current > 0) {
      const bounds = circle.getBounds();
      if (bounds) {
        map.fitBounds(bounds, 20);
        gmaps.event.addListenerOnce(map, 'idle', () => {
          if ((map.getZoom() ?? 0) > MAX_FIT_ZOOM) map.setZoom(MAX_FIT_ZOOM);
        });
      }
    } else {
      const center = circle.getCenter();
      if (center) {
        map.setCenter(center);
        map.setZoom(Math.max(map.getZoom() ?? 0, 16));
      }
    }
  }, []);

  // Put marker + circle at a point (from search, click, drag or timezone)
  const setPoint = useCallback(
    async (
      latitude: number,
      longitude: number,
      opts: { address?: string; reverse?: boolean; keepTimezone?: boolean } = {}
    ) => {
      const map = mapRef.current;
      const gmaps = (window as any).google?.maps;
      if (!map || !gmaps) return;
      const pos = { lat: latitude, lng: longitude };

      if (!markerRef.current) {
        const MarkerClass = gmaps.Marker;
        markerRef.current = new MarkerClass({
          map,
          position: pos,
          draggable: true,
          icon: {
            path: 'M12 0C5.37 0 0 5.37 0 12C0 21 12 34 12 34C12 34 24 21 24 12C24 5.37 18.63 0 12 0Z',
            fillColor: '#c1121f',
            fillOpacity: 1,
            strokeWeight: 1.5,
            strokeColor: '#780000',
            scale: 1.1,
            anchor: new gmaps.Point(12, 34),
          },
        });
        markerRef.current.addListener('dragend', () => {
          const p = markerRef.current!.getPosition()!;
          setPoint(p.lat(), p.lng(), { reverse: true });
        });
      } else {
        markerRef.current.setPosition(pos);
      }

      if (!circleRef.current) {
        circleRef.current = new gmaps.Circle({
          map,
          center: pos,
          radius: radiusRef.current,
          strokeColor: '#c1121f',
          strokeWeight: 2,
          fillColor: '#c1121f',
          fillOpacity: 0.2,
        });
      } else {
        circleRef.current.setCenter(pos);
        circleRef.current.setRadius(radiusRef.current);
      }

      setLat(latitude);
      setLng(longitude);

      let detectedTz = timezone;
      if (!opts.keepTimezone) {
        try {
          detectedTz = tzlookup(latitude, longitude);
          setTimezone(detectedTz);
          if (onTimezoneChange) onTimezoneChange(detectedTz);
        } catch {}
      }
      focusCircle();

      let addr = opts.address;
      if (!addr && opts.reverse && geocoderRef.current) {
        try {
          const { results } = await geocoderRef.current.geocode({ location: pos });
          addr = results?.[0]?.formatted_address;
        } catch {}
      }

      if (addr) {
        setAddress(addr);
        setSearchInput(addr);
        if (onAddressChange) onAddressChange(addr);
      }

      if (onLocationSelect) {
        onLocationSelect(latitude, longitude, addr || '', detectedTz);
      }

      onChange?.({
        address: addr || address,
        radius: radiusRef.current,
        timezone: detectedTz,
        latitude,
        longitude,
      });
    },
    [focusCircle, onAddressChange, onLocationSelect, onTimezoneChange, onChange, address, timezone]
  );

  // Timezone Geocode Handler -> move map when timezone selected
  const handleTimezoneGeocode = useCallback(
    async (tz: string) => {
      setTimezone(tz);

      // Already inside this timezone? Leave the map alone.
      if (lat != null && lng != null) {
        try {
          if (canonicalTz(tzlookup(lat, lng)) === canonicalTz(tz)) return;
        } catch {}
      }
      if (tz === 'UTC' || tz.startsWith('Etc/') || !geocoderRef.current) return;

      const last = tz.split('/').pop()!.replace(/_/g, ' ');
      const city = TZ_CITY_ALIASES[last] ?? last;
      try {
        const { results } = await geocoderRef.current.geocode({ address: city });
        const r = results?.[0];
        if (!r || !r.geometry?.location) return;
        setPoint(r.geometry.location.lat(), r.geometry.location.lng(), {
          address: r.formatted_address,
          keepTimezone: true,
        });
      } catch (err) {
        console.error('Timezone geocode failed', err);
      }
    },
    [lat, lng, setPoint]
  );

  // Handle prop timezone change
  useEffect(() => {
    if (propTimezone && propTimezone !== timezone) {
      setTimezone(propTimezone);
      if (mapLoaded && geocoderRef.current) {
        handleTimezoneGeocode(propTimezone);
      }
    }
  }, [propTimezone, mapLoaded, handleTimezoneGeocode]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize Google Maps & Places API (New)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoadError(null);
        await loadGoogleMaps(apiKey);

        const w = window as any;
        if (!w.google?.maps) {
          throw new Error('Google Maps SDK failed to load.');
        }

        const gmaps = w.google.maps;
        let placesLib = gmaps.places;
        let geocodingLib = gmaps;

        if (gmaps.importLibrary) {
          try {
            await gmaps.importLibrary('maps');
            await gmaps.importLibrary('marker');
            geocodingLib = (await gmaps.importLibrary('geocoding')) || gmaps;
            placesLib = (await gmaps.importLibrary('places')) || gmaps.places;
          } catch (libErr) {
            console.warn('Google Maps importLibrary warning:', libErr);
          }
        }

        placesLibRef.current = placesLib || gmaps.places;

        if (placesLibRef.current?.AutocompleteSessionToken) {
          sessionTokenRef.current = new placesLibRef.current.AutocompleteSessionToken();
        }

        if (cancelled || !mapDiv.current || mapRef.current) return;

        const initialCenter =
          lat != null && lng != null ? { lat, lng } : DEFAULT_CENTER;

        const ControlPosition = gmaps.ControlPosition || {
          TOP_LEFT: 1,
          TOP_CENTER: 2,
          TOP_RIGHT: 3,
          LEFT_CENTER: 4,
          LEFT_TOP: 5,
          LEFT_BOTTOM: 6,
          RIGHT_TOP: 7,
          RIGHT_CENTER: 8,
          RIGHT_BOTTOM: 9,
          BOTTOM_LEFT: 10,
          BOTTOM_CENTER: 11,
          BOTTOM_RIGHT: 12,
        };

        const map = new gmaps.Map(mapDiv.current, {
          center: initialCenter,
          zoom: 13,
          maxZoom: 21,
          mapTypeControl: true, // Map / Satellite toggle
          mapTypeControlOptions: {
            position: ControlPosition.TOP_RIGHT ?? 3,
          },
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          zoomControlOptions: {
            position: ControlPosition.RIGHT_BOTTOM ?? 9,
          },
        });
        mapRef.current = map;
        geocoderRef.current = new (geocodingLib.Geocoder || gmaps.Geocoder)();

        // Map Click Listener -> set point
        map.addListener('click', (e: any) => {
          if (e.latLng) {
            setPoint(e.latLng.lat(), e.latLng.lng(), { reverse: true });
          }
        });

        // If initial lat/lng provided, place point
        if (lat != null && lng != null) {
          setPoint(lat, lng, { address: propAddress || '' });
        }

        setMapLoaded(true);
      } catch (err) {
        console.error('Failed to initialize Google Maps:', err);
        setLoadError((err as Error).message || 'Failed to load Google Maps.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiKey]); // re-run if manual apiKey changes

  // Radius changed -> resize circle
  useEffect(() => {
    const r = Number(radius) || 0;
    radiusRef.current = r;
    circleRef.current?.setRadius(r);
    if (r > 0 && mapRef.current) {
      focusCircle();
    }
  }, [radius, focusCircle]);

  // Handle typing search with Places API (New) AutocompleteSuggestion
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchInput(val);
    setAddress(val);
    if (onAddressChange) onAddressChange(val);

    if (!val.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const placesLib = placesLibRef.current || (window as any).google?.maps?.places;
      if (placesLib?.AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
        if (!sessionTokenRef.current && placesLib.AutocompleteSessionToken) {
          sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
        }
        const response = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: val,
          sessionToken: sessionTokenRef.current,
        });

        if (response?.suggestions && response.suggestions.length > 0) {
          const list = response.suggestions.map((s: any) => {
            const pred = s.placePrediction;
            return {
              place_id: pred?.placeId,
              description: pred?.text?.text || '',
              mainText: pred?.structuredFormat?.mainText?.text || pred?.text?.text || '',
              secondaryText: pred?.structuredFormat?.secondaryText?.text || '',
              placePrediction: pred,
            };
          });
          setSuggestions(list);
          setShowSuggestions(true);
          return;
        }
      }

      // Fallback geocoder if predictions are empty or Places (New) is not returned
      if (geocoderRef.current && val.length >= 2) {
        const { results } = await geocoderRef.current.geocode({ address: val });
        if (results && results.length > 0) {
          const list = results.slice(0, 5).map((r: any) => ({
            place_id: r.place_id,
            description: r.formatted_address,
            mainText: r.address_components?.[0]?.long_name || r.formatted_address.split(',')[0],
            secondaryText: r.formatted_address,
          }));
          setSuggestions(list);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      }
    } catch (err) {
      console.warn('Places autocomplete suggestion error:', err);
    }
  };

  // Select suggestion using Places API (New) toPlace() or Geocoder
  const handleSelectSuggestion = async (s: {
    place_id?: string;
    description: string;
    placePrediction?: any;
  }) => {
    setSearchInput(s.description);
    setAddress(s.description);
    setShowSuggestions(false);
    if (onAddressChange) onAddressChange(s.description);

    setSearching(true);
    try {
      if (s.placePrediction?.toPlace) {
        const place = s.placePrediction.toPlace();
        await place.fetchFields({ fields: ['location', 'formattedAddress', 'displayName'] });
        const placesLib = placesLibRef.current || (window as any).google?.maps?.places;
        if (placesLib?.AutocompleteSessionToken) {
          sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
        }
        if (place.location) {
          const placeLat = place.location.lat();
          const placeLng = place.location.lng();
          const placeAddr = place.formattedAddress || place.displayName || s.description;
          setPoint(placeLat, placeLng, { address: placeAddr });
        }
      } else if (geocoderRef.current && s.place_id) {
        const { results } = await geocoderRef.current.geocode({ placeId: s.place_id });
        if (results && results[0]?.geometry?.location) {
          const loc = results[0].geometry.location;
          setPoint(loc.lat(), loc.lng(), { address: results[0].formatted_address || s.description });
        }
      }
    } catch (e) {
      console.error('Place selection failed:', e);
    } finally {
      setSearching(false);
    }
  };

  // Forward geocode when user presses Enter or clicks Search button
  const handleSearchSubmit = async () => {
    const query = searchInput || address;
    if (!query || !query.trim() || !geocoderRef.current) return;
    setShowSuggestions(false);
    setSearching(true);
    try {
      const { results } = await geocoderRef.current.geocode({ address: query });
      if (results && results[0] && results[0].geometry?.location) {
        const loc = results[0].geometry.location;
        setPoint(loc.lat(), loc.lng(), { address: results[0].formatted_address });
      } else {
        alert('Could not locate the specified address.');
      }
    } catch (e) {
      console.error('Geocode search failed:', e);
    } finally {
      setSearching(false);
    }
  };

  // Save manual Google Maps Token
  const handleSaveKey = () => {
    const trimmed = keyInput.trim();
    setApiKey(trimmed);
    mapsLoaderPromise = null;
    if (typeof window !== 'undefined') {
      localStorage.setItem('GOOGLE_MAPS_API_KEY', trimmed);
    }
    setShowKeyModal(false);
    // Reload map
    if (mapRef.current) {
      mapRef.current = null;
      setMapLoaded(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Optional Top Form Inputs (Radius and TimeZone) if showInputs is true */}
      {showInputs && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              <span className="text-red-500 font-bold mr-1">*</span>Radius (m)
            </label>
            <div className="relative">
              <input
                type="number"
                min={1}
                className="input pr-8 focus:border-red-400 focus:ring-red-400 text-sm font-medium"
                placeholder="Enter Radius"
                value={radius || ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setRadius(val);
                  if (onRadiusChange) onRadiusChange(val);
                }}
              />
              {radius > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setRadius(0);
                    if (onRadiusChange) onRadiusChange(0);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <XCircle size={14} />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              <span className="text-red-500 font-bold mr-1">*</span>TimeZone
            </label>
            <select
              className="input text-sm font-medium"
              value={timezone}
              onChange={(e) => {
                const tz = e.target.value;
                setTimezone(tz);
                if (onTimezoneChange) onTimezoneChange(tz);
                handleTimezoneGeocode(tz);
              }}
            >
              {timezones.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Map Container Box with Floating Address Bar & Key Configuration Button */}
      <div className="relative w-full h-[380px] sm:h-[440px] md:h-[480px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm bg-gray-100 dark:bg-gray-800">
        {/* Loading state indicator */}
        {!mapLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 z-20">
            {loadError ? (
              <div className="p-4 text-center max-w-sm space-y-2">
                <p className="text-red-500 font-medium">{loadError}</p>
                <button
                  type="button"
                  onClick={() => setShowKeyModal(true)}
                  className="btn-primary text-xs py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white"
                >
                  <Key size={13} className="mr-1 inline" />
                  Enter Google Maps Key
                </button>
              </div>
            ) : (
              <>
                <Loader2 size={20} className="animate-spin text-red-600" />
                <span>Loading Google Maps…</span>
              </>
            )}
          </div>
        )}

        {/* Floating Address Search Bar on the top-left of the map */}
        <div
          ref={searchContainerRef}
          className="absolute top-3.5 left-3.5 z-20 w-[calc(100%-230px)] max-w-2xl min-w-[260px]"
        >
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 flex items-center px-3.5 py-2 transition-all">
            <input
              type="text"
              value={searchInput}
              placeholder="Search site address, landmark or area..."
              className="w-full bg-transparent text-xs sm:text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none font-normal"
              onChange={handleInputChange}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearchSubmit();
                }
              }}
            />
            {searching ? (
              <Loader2 size={16} className="text-red-500 animate-spin shrink-0 ml-2" />
            ) : (
              <button
                type="button"
                onClick={handleSearchSubmit}
                className="text-gray-400 hover:text-red-600 transition-colors shrink-0 ml-2"
                title="Search address"
              >
                <Search size={16} />
              </button>
            )}
          </div>

          {/* Autocomplete Predictions Dropdown matching Google Places UI (Image #21) */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="mt-1 bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 max-h-64 overflow-y-auto z-30 divide-y divide-gray-100 dark:divide-gray-800">
              {suggestions.map((s, idx) => (
                <button
                  key={s.place_id || idx}
                  type="button"
                  onClick={() => handleSelectSuggestion(s)}
                  className="w-full text-left px-3.5 py-2 hover:bg-gray-100 dark:hover:bg-gray-800/80 transition-colors flex items-center gap-2.5 text-xs text-gray-800 dark:text-gray-200"
                >
                  <MapPin size={15} className="text-gray-400 shrink-0" />
                  <div className="flex items-baseline gap-1.5 truncate">
                    <span className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm">
                      {s.mainText}
                    </span>
                    {s.secondaryText && (
                      <span className="text-gray-500 dark:text-gray-400 text-[11px] sm:text-xs truncate font-normal">
                        {s.secondaryText}
                      </span>
                    )}
                  </div>
                </button>
              ))}
              <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-950/60 flex justify-end items-center">
                <span className="text-[10px] text-gray-400">
                  powered by <span className="font-semibold text-gray-600 dark:text-gray-300">Google</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Manual Google Maps API Key Button (Top-Right next to Map/Satellite controls) */}
        <div className="absolute top-3.5 right-3.5 z-10">
          <button
            type="button"
            onClick={() => {
              setKeyInput(apiKey);
              setShowKeyModal(true);
            }}
            className="p-2 bg-white dark:bg-gray-900 text-gray-600 hover:text-red-600 dark:text-gray-300 dark:hover:text-red-400 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 transition-colors"
            title="Configure Google Maps API Key"
          >
            <Key size={15} />
          </button>
        </div>

        {/* The Google Map Container */}
        <div ref={mapDiv} className="w-full h-full" />
      </div>

      {/* Manual Key Configuration Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-5 w-full max-w-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key size={16} className="text-red-600" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Google Maps API Key
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              Enter your Google Maps API Key (with Maps JavaScript API, Places API (New), and Geocoding API enabled).
            </p>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                API Key
              </label>
              <input
                type="text"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="input text-xs w-full font-mono"
                autoFocus
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="btn-secondary flex-1 text-xs py-1.5 justify-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveKey}
                className="btn-primary flex-1 text-xs py-1.5 justify-center bg-red-600 hover:bg-red-700 text-white"
              >
                <Check size={13} className="mr-1" />
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
