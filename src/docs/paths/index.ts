import type { OpenAPIV3 } from 'openapi-types';
import { adminPaths } from './admin';
import { candidatePaths } from './candidate';
import { employerPaths } from './employer';
import { publicAndAuthPaths } from './publicAuth';
import { sharedPaths } from './shared';
import { mergePaths } from '../helpers';

export function buildPaths(): OpenAPIV3.PathsObject {
  return mergePaths(
    publicAndAuthPaths,
    candidatePaths,
    employerPaths,
    sharedPaths,
    adminPaths,
  );
}
