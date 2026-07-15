'use client';

/**
 * hooks/attendance-settings/use-attendance-settings-page.ts
 *
 * Page-state orchestrator for `/attendance/settings`. Combines the data
 * query/mutation hooks for shifts and attendance profiles with all of the
 * dialog/form state the settings UI needs in one place, so the page itself
 * stays purely presentational.
 *
 * Named explicitly with the `-page` suffix to distinguish it from the
 * data-fetching hooks in `use-attendance-settings.ts` (queries) and
 * `use-attendance-settings-mutations.ts`.
 */

import { useState } from 'react';
import type { ShiftTiming } from '../../types/shift-timing';
import type { AttendanceProfile } from '../../types/attendance';
import { useAttendanceProfiles } from './use-attendance-settings';
import {
  useCreateAttendanceProfile,
  useUpdateAttendanceProfile,
  useDeleteAttendanceProfile,
} from './use-attendance-settings-mutations';
import {
  useShifts,
  useCreateShift,
  useUpdateShift,
  useDeleteShift,
} from '../../hooks/shift-timing';
import { useProjects } from '@tornotron/echno-core/project/hooks';
import { logger } from '../../lib/logger';

// ─── Blank form defaults ──────────────────────────────────────────────────────

export const blankShift: Omit<ShiftTiming, 'id'> = {
  shiftName: '',
  startTime: '09:00',
  endTime: '18:00',
  lunchBreakStart: '13:00',
  lunchBreakEnd: '14:00',
  gracePeriodMinutes: 15,
  minimumWorkHours: 8,
  halfDayWorkHours: 4,
  overtimeThreshold: 9,
};

export const blankProfile: Omit<AttendanceProfile, 'id'> = {
  settingName: '',
  checkInOutCycles: 2,
  photoRequiredOnCheckIn: true,
  photoRequiredOnCheckOut: false,
  geolocationRequired: true,
  geofenceRadiusMeters: 100,
  movementTrackingEnabled: true,
  movementPhotoRequired: false,
  movementGeolocationRequired: false,
  autoMarkAbsentAfterHours: 4,
  allowSelfRegularization: true,
  regularizationApprovalRequired: true,
  maxRegularizationDaysPerMonth: 3,
  isActive: true,
};

// ─── Helper ───────────────────────────────────────────────────────────────────

export function getCycleLabel(cycles: number): string {
  const labels: Record<number, string> = {
    1: '1 — Check-in / Check-out',
    2: '2 — Full day with lunch break',
    3: '3 — Two-break day',
    4: '4 — Multi-cycle',
  };
  return labels[cycles] ?? `${cycles} cycles`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAttendanceSettingsPage() {
  const [activeTab, setActiveTab] = useState<'shifts' | 'profiles'>('profiles');

  // ── Server data ───────────────────────────────────────────────────────────
  const {
    data: shifts = [],
    isLoading: shiftsLoading,
    error: shiftsError,
  } = useShifts();

  const {
    data: profiles = [],
    isLoading: profilesLoading,
    error: profilesError,
  } = useAttendanceProfiles();

  const { data: projects = [], isLoading: projectsLoading } = useProjects();

  const createShiftMutation = useCreateShift();
  const updateShiftMutation = useUpdateShift();
  const deleteShiftMutation = useDeleteShift();

  const createProfileMutation = useCreateAttendanceProfile();
  const updateProfileMutation = useUpdateAttendanceProfile();
  const deleteProfileMutation = useDeleteAttendanceProfile();

  // ── Shift dialog state ────────────────────────────────────────────────────
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftTiming | null>(null);
  const [shiftForm, setShiftForm] =
    useState<Omit<ShiftTiming, 'id'>>(blankShift);

  // ── Profile dialog state ──────────────────────────────────────────────────
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] =
    useState<AttendanceProfile | null>(null);
  const [profileForm, setProfileForm] =
    useState<Omit<AttendanceProfile, 'id'>>(blankProfile);

  // ── Delete dialog state ───────────────────────────────────────────────────
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'shift' | 'profile';
    id: number;
    name: string;
  } | null>(null);

  // ── Shift handlers ────────────────────────────────────────────────────────

  function openNewShift() {
    setEditingShift(null);
    setShiftForm(blankShift);
    setShiftDialogOpen(true);
  }

  function openEditShift(shift: ShiftTiming) {
    setEditingShift(shift);
    const { id: _id, ...rest } = shift;
    void _id;
    setShiftForm(rest);
    setShiftDialogOpen(true);
  }

  function saveShift() {
    if (!shiftForm.shiftName.trim()) {
      logger.error('Shift name is required');
      return;
    }
    if (editingShift?.id === undefined) {
      createShiftMutation.mutate(shiftForm, {
        onError: () => logger.error('Failed to create shift'),
      });
    } else {
      updateShiftMutation.mutate(
        { id: editingShift.id, dto: shiftForm },
        {
          onSuccess: () => {
            logger.info('Shift updated', {
              description: shiftForm.shiftName,
            });
            setShiftDialogOpen(false);
          },
          onError: () => logger.error('Failed to update shift'),
        }
      );
    }
  }

  function duplicateShift(shift: ShiftTiming) {
    const { id: _id, ...rest } = shift;
    void _id;
    createShiftMutation.mutate(
      { ...rest, shiftName: `${shift.shiftName} (Copy)` },
      {
        onSuccess: () => logger.info('Shift duplicated'),
        onError: () => logger.error('Failed to duplicate shift'),
      }
    );
  }

  // ── Profile handlers ──────────────────────────────────────────────────────

  function openNewProfile() {
    setEditingProfile(null);
    setProfileForm(blankProfile);
    setProfileDialogOpen(true);
  }

  function openEditProfile(profile: AttendanceProfile) {
    setEditingProfile(profile);
    const { id: _id, ...rest } = profile;
    void _id;
    setProfileForm(rest);
    setProfileDialogOpen(true);
  }

  function saveProfile() {
    if (!profileForm.settingName.trim()) {
      logger.error('Profile name is required');
      return;
    }
    const { isActive: _isActive, ...dto } = profileForm;
    void _isActive;

    if (editingProfile) {
      updateProfileMutation.mutate(
        { id: editingProfile.id, dto },
        {
          onSuccess: () => {
            logger.info('Profile updated', {
              description: profileForm.settingName,
            });
            setProfileDialogOpen(false);
          },
          onError: () => logger.error('Failed to update profile'),
        }
      );
    } else {
      createProfileMutation.mutate(dto, {
        onSuccess: () => {
          logger.info('Profile created', {
            description: profileForm.settingName,
          });
          setProfileDialogOpen(false);
        },
        onError: () => logger.error('Failed to create profile'),
      });
    }
  }

  // ── Delete handler ────────────────────────────────────────────────────────

  function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'shift') {
      deleteShiftMutation.mutate(deleteTarget.id, {
        onSuccess: () => {
          logger.info('Shift deleted', { description: deleteTarget.name });
          setDeleteDialogOpen(false);
          setDeleteTarget(null);
        },
        onError: () => logger.error('Failed to delete shift'),
      });
    } else {
      deleteProfileMutation.mutate(deleteTarget.id, {
        onSuccess: () => {
          logger.info('Profile deleted', { description: deleteTarget.name });
          setDeleteDialogOpen(false);
          setDeleteTarget(null);
        },
        onError: () => logger.error('Failed to delete profile'),
      });
    }
  }

  const isSaving =
    createShiftMutation.isPending ||
    updateShiftMutation.isPending ||
    createProfileMutation.isPending ||
    updateProfileMutation.isPending;

  const isDeleting =
    deleteShiftMutation.isPending || deleteProfileMutation.isPending;

  return {
    activeTab,
    setActiveTab,
    // Loading / error states
    shiftsLoading,
    profilesLoading,
    projectsLoading,
    shiftsError,
    profilesError,
    isSaving,
    isDeleting,
    // Shift
    shifts,
    shiftDialogOpen,
    setShiftDialogOpen,
    editingShift,
    shiftForm,
    setShiftForm,
    openNewShift,
    openEditShift,
    saveShift,
    duplicateShift,
    // Projects
    projects,
    // Profile
    profiles,
    profileDialogOpen,
    setProfileDialogOpen,
    editingProfile,
    profileForm,
    setProfileForm,
    openNewProfile,
    openEditProfile,
    saveProfile,
    // Delete
    deleteDialogOpen,
    setDeleteDialogOpen,
    deleteTarget,
    setDeleteTarget,
    confirmDelete,
  };
}
