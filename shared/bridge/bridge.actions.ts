export const ACTIONS = {
  LocationGetCurrentPosition: 'location.getCurrentPosition',
  ShareText: 'share.text',
  SharePayload: 'share.payload',
  ShareImage: 'share.image',
  SharePoster: 'share.poster',
  GeocodeSearch: 'geocode.search',
  NavigationMap: 'navigation.map',
  MapOpenWaypointNavigation: 'map.openWaypointNavigation',
  ObservationReminderSchedule: 'observation.reminder.schedule',
} as const;

export type BridgeAction = typeof ACTIONS[keyof typeof ACTIONS];

export type BridgeRequestEnvelope<TAction extends BridgeAction, TPayload extends object> = {
  protocolVersion?: string;
  version?: string;
  channel?: 'bridge.request';
  requestId: string;
  action: TAction;
  payload: TPayload;
};

export type BridgeResponseEnvelope<TData extends object> = {
  protocolVersion?: string;
  requestId: string;
  ok: true;
  data: TData;
};

export interface LocationGetCurrentPositionRequest extends BridgeRequestEnvelope<typeof ACTIONS.LocationGetCurrentPosition, {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}> {}

export interface LocationGetCurrentPositionResponse extends BridgeResponseEnvelope<{
  coords: {
    latitude: number;
    longitude: number;
  };
  latitude: number;
  longitude: number;
}> {}

export interface ShareTextRequest extends BridgeRequestEnvelope<typeof ACTIONS.ShareText, {
  title?: string;
  text: string;
}> {}

export interface ShareTextResponse extends BridgeResponseEnvelope<{
  accepted: boolean;
}> {}

export interface SharePayloadRequest extends BridgeRequestEnvelope<typeof ACTIONS.SharePayload, {
  title?: string;
  text?: string;
  message?: string;
}> {}

export interface SharePayloadResponse extends BridgeResponseEnvelope<{
  accepted: boolean;
}> {}

export interface ShareImageRequest extends BridgeRequestEnvelope<typeof ACTIONS.ShareImage, {
  title?: string;
  dataUrl: string;
  filename?: string;
}> {}

export interface ShareImageResponse extends BridgeResponseEnvelope<{
  accepted: boolean;
}> {}

export interface SharePosterRequest extends BridgeRequestEnvelope<typeof ACTIONS.SharePoster, {
  base64Png?: string;
  title?: string;
  text?: string;
}> {}

export interface SharePosterResponse extends BridgeResponseEnvelope<{
  accepted: boolean;
}> {}

export interface GeocodeSearchRequest extends BridgeRequestEnvelope<typeof ACTIONS.GeocodeSearch, {
  query: string;
}> {}

export interface GeocodeSearchResponse extends BridgeResponseEnvelope<{
  results: Array<{
    latitude: number;
    longitude: number;
    name: string;
  }>;
}> {}

export interface NavigationMapRequest extends BridgeRequestEnvelope<typeof ACTIONS.NavigationMap, {
  latitude: number;
  longitude: number;
  label?: string;
}> {}

export interface NavigationMapResponse extends BridgeResponseEnvelope<{
  opened: boolean;
}> {}

export interface MapOpenWaypointNavigationRequest extends BridgeRequestEnvelope<typeof ACTIONS.MapOpenWaypointNavigation, {
  name: string;
  lat: number;
  lng: number;
}> {}

export interface MapOpenWaypointNavigationResponse extends BridgeResponseEnvelope<{
  opened: boolean;
}> {}

export interface ObservationReminderScheduleRequest extends BridgeRequestEnvelope<typeof ACTIONS.ObservationReminderSchedule, {
  reminderId: string;
  title?: string;
  body?: string;
  fireAt: string;
  timezone?: string;
  location?: {
    name?: string;
    latitude?: number;
    longitude?: number;
  };
}> {}

export interface ObservationReminderScheduleResponse extends BridgeResponseEnvelope<{
  scheduled: boolean;
  reminderId: string;
  fireAt: string;
  transport: string;
}> {}
