/**
 * Deep route module — admin flows (role assignment).
 * Previously part of god-router `routes/auth/user.routes.ts:83` under `/assign-role/:userId`.
 * Now: isolated, owns `assignRoleSchema` validation and `verifyJWT` guard; future RBAC middleware can be added here without touching auth/profile.
 */
import { Router } from 'express';
import { assignRole } from '../../controllers/auth/admin.controller';
import { verifyJWT } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { assignRoleSchema } from '../../validators/auth.validator';

const router = Router();

router.post('/assign-role/:userId', verifyJWT, validate(assignRoleSchema), assignRole);

export default router;
