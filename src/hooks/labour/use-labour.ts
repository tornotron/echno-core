import { useQuery } from '@tanstack/react-query';
import { labourService } from '../../services/labour-service';
import { labourKeys } from './labour-keys';
import { standardQueryOptions } from '../../lib/query/options';

export const useLabour = () =>
  useQuery({
    ...standardQueryOptions,
    queryKey: labourKeys.lists(),
    queryFn: () => labourService.getAll(),
  });

export const useLabourById = (id: number) =>
  useQuery({
    ...standardQueryOptions,
    queryKey: labourKeys.detail(id),
    queryFn: () => labourService.getById(id),
    enabled: Number.isFinite(id) && id > 0,
  });
