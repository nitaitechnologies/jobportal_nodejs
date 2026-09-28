import type {
  AuthenticatedAdmin,
  AuthenticatedCandidate,
  AuthenticatedEmployer,
  AuthenticatedIdentity,
} from './auth.types';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedIdentity;
      admin?: AuthenticatedAdmin;
      candidate?: AuthenticatedCandidate;
      employer?: AuthenticatedEmployer;
      /** Raw JSON body, set for webhook signature checks. */
      rawBody?: Buffer;
    }
  }
}

export {};
