import { describe, expect, test } from 'bun:test';
import { parseAttendanceProfile } from './attendance-profile';

const valid = {
  id: 7,
  settingName: 'Default',
  checkInOutCycles: 1,
  photoRequiredOnCheckIn: true,
  photoRequiredOnCheckOut: false,
  geolocationRequired: true,
  geofenceRadiusMeters: 100,
  movementTrackingEnabled: false,
  movementPhotoRequired: false,
  movementGeolocationRequired: false,
  autoMarkAbsentAfterHours: 4,
  allowSelfRegularization: true,
  regularizationApprovalRequired: true,
  maxRegularizationDaysPerMonth: 3,
  isActive: true,
};

describe('parseAttendanceProfile boundary validation', () => {
  test('parses a valid profile and carries fields through', () => {
    const profile = parseAttendanceProfile(valid);
    expect(profile.id).toBe(7);
    expect(profile.settingName).toBe('Default');
    expect(profile.geofenceRadiusMeters).toBe(100);
  });

  test('rejects a non-positive id', () => {
    expect(() => parseAttendanceProfile({ ...valid, id: -1 })).toThrow();
  });

  test('rejects a missing required rule field', () => {
    const { checkInOutCycles, ...rest } = valid;
    void checkInOutCycles;
    expect(() => parseAttendanceProfile(rest)).toThrow();
  });
});
