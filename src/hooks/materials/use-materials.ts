/**
 * @module use-materials
 *
 * TanStack Query hooks for reading materials. Mutations live in
 * {@link useCreateMaterial}, {@link useUpdateMaterial}, and
 * {@link useDeleteMaterial}.
 *
 * None of the query hooks below spread a profile from `lib/query/options`;
 * they inherit the host `QueryClient`'s defaults (mirroring the
 * **standard** profile of `staleTime` 60 s / `gcTime` 5 min when the host
 * uses the recommended setup).
 */
import { useQuery } from '@tanstack/react-query';
import { materialsService } from '../../services/materials-service';
import { materialsKeys } from './material-keys';

/**
 * Fetches every material (unpaginated).
 *
 * @returns A TanStack `UseQueryResult` wrapping `Material[]`.
 */
export const useMaterials = () =>
  useQuery({
    queryKey: materialsKeys.lists(),
    queryFn: () => materialsService.getAll(),
  });

/**
 * Fetches a page of materials.
 *
 * @param pageNo - Zero-based page number. Defaults to `0`.
 * @param pageSize - Number of materials per page. Defaults to `10`.
 * @returns A TanStack `UseQueryResult` wrapping `Material[]` for the page.
 */
export const useMaterialsPaginated = (pageNo = 0, pageSize = 10) =>
  useQuery({
    queryKey: materialsKeys.paginated(pageNo, pageSize),
    queryFn: () => materialsService.getAllPaginated(pageNo, pageSize),
  });

/**
 * Searches materials by name. The query is disabled until `name` is a
 * non-empty string.
 *
 * @param name - Substring to match against material names.
 * @returns A TanStack `UseQueryResult` wrapping the matching `Material[]`.
 */
export const useMaterialSearch = (name: string) =>
  useQuery({
    queryKey: materialsKeys.search(name),
    queryFn: () => materialsService.search(name),
    enabled: name.length > 0,
  });

/**
 * Fetches a single material by ID. The query is disabled until `id` is
 * truthy.
 *
 * @param id - Surrogate ID of the material. Pass `0` (or any falsy value)
 *   to defer the query until the ID is available.
 * @returns A TanStack `UseQueryResult` wrapping a single `Material`.
 */
export const useMaterial = (id: number) =>
  useQuery({
    queryKey: materialsKeys.detail(id),
    queryFn: () => materialsService.getById(id),
    enabled: !!id,
  });

/**
 * Fetches a single material with its `currentStock` guaranteed non-null.
 * Backed by a separate endpoint and cache key from {@link useMaterial} so
 * the two views don't overwrite each other. The query is disabled until
 * `id` is truthy.
 *
 * @param id - Surrogate ID of the material.
 * @returns A TanStack `UseQueryResult` wrapping a single `MaterialStock`.
 */
export const useMaterialWithStock = (id: number) =>
  useQuery({
    queryKey: materialsKeys.stock(id),
    queryFn: () => materialsService.getWithStock(id),
    enabled: !!id,
  });

export { materialsKeys } from './material-keys';
