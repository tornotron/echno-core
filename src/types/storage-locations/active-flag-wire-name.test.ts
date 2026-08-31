/**
 * Why a storage location could never be deactivated, and where the fault actually was.
 *
 * The client sent the flag as `active` on both create and update. Create worked and update did
 * not, and the cause was a Lombok naming split in the backend rather than anything on this side.
 * `StorageLocationCreationDto` declared a primitive `boolean isActive`, so Lombok generated
 * `isActive()`/`setActive()` and Jackson published the wire key `active`. `StorageLocationUpdateDto`
 * declared a wrapper `Boolean isActive`, so the accessors were `getIsActive()`/`setIsActive()` and
 * the published key was `isActive`. One field, two names, and the client happened to match the
 * create one.
 *
 * So every attempt to deactivate a location bound to nothing and was dropped, and the request still
 * answered 200. Fixing only this side would have left the trap in place for the next caller, which
 * is why the backend settled both DTOs on `isActive` first (echno-backend#627), keeping a
 * `@JsonAlias("active")` on each so a published core still sending the old spelling keeps working.
 * This is the middle step: the client moves to the canonical name, and the aliases come out once no
 * published core sends the old one.
 *
 * The TypeScript property stays `active` deliberately. The response DTO still serialises the flag
 * as `active`, so `StorageLocation.active` is the read name, and renaming only the request property
 * would force callers to rename a field while round-tripping one shape into the other. Only the
 * wire key differs, the same way `issueType` maps to `type`.
 */
import { describe, expect, test } from 'bun:test';

import { createStorageLocationToJson } from './storage-location-create';
import { updateStorageLocationToJson } from './storage-location-update';
import { StorageLocationType } from './storage-location';

const base = {
  locationName: 'Block A site store',
  locationType: StorageLocationType.PROJECT_SITE,
};

describe('the active flag travels as isActive', () => {
  test('create sends isActive and never active', () => {
    const body = createStorageLocationToJson({ ...base, active: false });

    expect(body.isActive).toBe(false);
    expect(Object.hasOwn(body, 'active')).toBe(false);
  });

  test('create still defaults the flag to true when the caller omits it', () => {
    // The default is load-bearing on the other side too: the backend's creation DTO was a
    // primitive, so an omitted key arrived as false and quietly deactivated the location. That is
    // fixed there, but this client has always sent an explicit value and continues to.
    const body = createStorageLocationToJson({ ...base });

    expect(body.isActive).toBe(true);
  });

  test('update sends isActive, which is the one that never landed', () => {
    const body = updateStorageLocationToJson({ ...base, active: false });

    expect(body.isActive).toBe(false);
    expect(Object.hasOwn(body, 'active')).toBe(false);
  });

  test('update still forwards an absent flag as undefined rather than false', () => {
    // Sending false here would deactivate a location on any edit that did not mention the flag,
    // which is a worse bug than the one being fixed.
    const body = updateStorageLocationToJson({ ...base });

    expect(body.isActive).toBeUndefined();
  });

  test('the rest of the payload is unchanged by the rename', () => {
    // The key was renamed inside an object literal, the edit most likely to disturb a neighbour.
    const body = updateStorageLocationToJson({
      ...base,
      projectId: 12,
      capacity: 5000,
      active: true,
    });

    expect(body.locationName).toBe('Block A site store');
    expect(body.projectId).toBe(12);
    expect(body.capacity).toBe(5000);
  });
});
