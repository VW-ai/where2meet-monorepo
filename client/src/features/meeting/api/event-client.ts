/**
 * Event API Client Facade
 * Meeting feature's interface to event-related backend APIs.
 */

import { eventsApi } from '@/lib/api/events';

export const eventClient = {
  create: eventsApi.create,
  get: eventsApi.get,
  update: eventsApi.update,
  delete: eventsApi.delete,
  publish: eventsApi.publish,
  unpublish: eventsApi.unpublish,
  getMe: eventsApi.getMe,
};
