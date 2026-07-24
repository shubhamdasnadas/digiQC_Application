import { Router } from 'express';
import authRoutes from './routes/auth';
import projectsRoutes from './routes/projects';
import teamsRoutes from './routes/teams';
import checklistsRoutes from './routes/checklists';
import organizationsRoutes from './routes/organizations';
import dashboardRoutes from './routes/dashboard';

const apiRouter = Router();

// Mount Backend API Sub-routers
apiRouter.use('/auth', authRoutes);
apiRouter.use('/projects', projectsRoutes);
apiRouter.use('/teams', teamsRoutes);
apiRouter.use('/checklists', checklistsRoutes);
apiRouter.use('/organizations', organizationsRoutes);
apiRouter.use('/dashboard', dashboardRoutes);

export default apiRouter;
