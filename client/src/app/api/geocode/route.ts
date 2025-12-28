/**
 * Geocode API Route
 * POST /api/geocode - Convert address to coordinates using Google Geocoding API
 */

import { handleGeocode } from '@/shared/api/geocoding/handlers/geocode';

export { handleGeocode as POST };
