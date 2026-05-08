import { ACTIONS, type BridgeAction } from '../shared/bridge/bridge.actions';

describe('桥接动作常量完整性', () => {
  test('动作名称稳定且没有重复值', () => {
    expect(ACTIONS).toEqual({
      LocationGetCurrentPosition: 'location.getCurrentPosition',
      ShareText: 'share.text',
      SharePayload: 'share.payload',
      ShareImage: 'share.image',
      SharePoster: 'share.poster',
      GeocodeSearch: 'geocode.search',
      NavigationMap: 'navigation.map',
      MapOpenWaypointNavigation: 'map.openWaypointNavigation',
      ObservationReminderSchedule: 'observation.reminder.schedule',
    });
    const values = Object.values(ACTIONS);
    expect(new Set(values).size).toBe(values.length);
    const action: BridgeAction = ACTIONS.SharePoster;
    expect(action).toBe('share.poster');
  });
});
