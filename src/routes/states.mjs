import express from 'express';
import { 
  upsertStateResults, 
  researchState, 
  getState, 
  getStateSources, 
  listStates 
} from '../controllers/statesController.mjs';

const router = express.Router();

// Middleware to require bearer token for protected routes
function requireBearerToken(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Bearer token required',
      message: 'Please provide a valid bearer token in the Authorization header'
    });
  }

  const token = authHeader.substring(7);
  
  // Simple token validation (same as existing middleware)
  if (!token || token.length < 10) {
    return res.status(401).json({ 
      error: 'Invalid bearer token',
      message: 'The provided bearer token is invalid or malformed'
    });
  }

  next();
}

// Routes
router.put('/:code', requireBearerToken, upsertStateResults);
router.post('/:code/research', requireBearerToken, researchState);
router.get('/:code', getState);
router.get('/:code/sources', getStateSources);
router.get('/', listStates);

export default router;