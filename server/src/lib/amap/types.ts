/**
 * AMap Web Service API response types (internal).
 *
 * AMap returns almost every value as a string. v3 endpoints return an empty
 * array instead of a missing string, hence AmapText.
 * @see https://lbs.amap.com/api/webservice/summary
 * @module lib/amap/types
 */

/** A v3 string field, which is [] when AMap has no value. */
export type AmapText = string | [];

/** Fields present on every AMap response. */
export interface AmapEnvelope {
  status: string;
  info: string;
  infocode?: string;
}

// ============================================================================
// Geocoding (v3)
// ============================================================================

export interface AmapGeocode {
  formatted_address?: AmapText;
  province?: AmapText;
  city?: AmapText;
  district?: AmapText;
  citycode?: AmapText;
  location: AmapText;
  /** Match precision, e.g. "门址", "兴趣点", "市". */
  level?: AmapText;
}

export interface AmapGeocodeResponse extends AmapEnvelope {
  geocodes?: AmapGeocode[];
}

export interface AmapRegeoResponse extends AmapEnvelope {
  regeocode?: {
    formatted_address?: AmapText;
    addressComponent?: {
      province?: AmapText;
      city?: AmapText;
      citycode?: AmapText;
      district?: AmapText;
    };
  };
}

// ============================================================================
// Input tips (v3)
// ============================================================================

export interface AmapTip {
  id: AmapText;
  name: string;
  district: AmapText;
  address: AmapText;
  location: AmapText;
}

export interface AmapInputTipsResponse extends AmapEnvelope {
  tips?: AmapTip[];
}

// ============================================================================
// POI search 2.0 (v5)
// ============================================================================

export interface AmapPoi {
  id: string;
  name: string;
  location: string;
  type?: string;
  typecode?: string;
  pname?: string;
  cityname?: string;
  adname?: string;
  address?: string;
  business?: {
    rating?: string;
    /** Average spend per person in CNY. */
    cost?: string;
    tel?: string;
    opentime_week?: string;
  };
  photos?: { title?: AmapText; url?: string }[];
}

export interface AmapPoiResponse extends AmapEnvelope {
  pois?: AmapPoi[];
}

// ============================================================================
// Route planning 2.0 (v5)
// ============================================================================

/** v5 transit wraps polylines in an object; other modes return a string. */
export type AmapPolyline = string | { polyline?: string };

export interface AmapStep {
  polyline?: AmapPolyline;
  cost?: { duration?: string };
}

export interface AmapPath {
  distance: string;
  cost?: { duration?: string };
  steps?: AmapStep[];
}

export interface AmapPathRouteResponse extends AmapEnvelope {
  route?: { paths?: AmapPath[] };
}

export interface AmapStop {
  location?: AmapText;
}

export interface AmapTransitSegment {
  walking?: { steps?: AmapStep[] };
  bus?: { buslines?: { polyline?: AmapPolyline }[] };
  railway?: { departure_stop?: AmapStop; arrival_stop?: AmapStop };
}

export interface AmapTransit {
  distance: string;
  cost?: { duration?: string };
  segments?: AmapTransitSegment[];
}

export interface AmapTransitRouteResponse extends AmapEnvelope {
  route?: { transits?: AmapTransit[] };
}
