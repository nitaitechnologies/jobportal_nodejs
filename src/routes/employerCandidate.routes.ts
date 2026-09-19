import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware';
import { requireEmployer } from '../middlewares/employerAuth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { employerCandidateService } from '../services/employerCandidate.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants';

const querySchema = z.object({
  q: z.string().trim().max(80).optional(),
  skill: z.string().trim().max(80).optional(),
  location: z.string().trim().max(120).optional(),
  experienceMin: z.coerce.number().min(0).max(60).optional(),
  experienceMax: z.coerce.number().min(0).max(60).optional(),
  availableBy: z.string().trim().optional(),
  jobId: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const employerCandidateRouter = Router();

employerCandidateRouter.use(authenticate, requireRole('employer'), requireEmployer);

employerCandidateRouter.get('/', async (req, res, next) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError('Invalid candidate search', HTTP_STATUS.BAD_REQUEST);
    }
    if (parsed.data.availableBy && Number.isNaN(new Date(parsed.data.availableBy).getTime())) {
      throw new AppError('availableBy must be a date', HTTP_STATUS.BAD_REQUEST);
    }
    if (!req.employer) throw new AppError('Employer access required', HTTP_STATUS.FORBIDDEN);
    const data = await employerCandidateService.list(req.employer, parsed.data);
    sendSuccess(res, data, 'Candidates fetched successfully');
  } catch (error) {
    next(error);
  }
});

employerCandidateRouter.get('/:id', async (req, res, next) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : undefined;
    if (!req.employer) throw new AppError('Employer access required', HTTP_STATUS.FORBIDDEN);
    const data = await employerCandidateService.getById(req.employer, id, jobId);
    sendSuccess(res, data, 'Candidate fetched successfully');
  } catch (error) {
    next(error);
  }
});

export default employerCandidateRouter;
