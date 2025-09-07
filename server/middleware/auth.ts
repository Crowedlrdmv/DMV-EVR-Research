import { Request, Response, NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
  isAuthenticated?: boolean;
}

export function requireBearerToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Bearer token required',
      message: 'Please provide a valid bearer token in the Authorization header'
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  // In a real application, you would validate the token against a database or JWT secret
  // For this implementation, we'll accept any non-empty token
  if (!token || token.length < 10) {
    return res.status(401).json({ 
      error: 'Invalid bearer token',
      message: 'The provided bearer token is invalid or malformed'
    });
  }

  req.isAuthenticated = true;
  next();
}

export function optionalBearerToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    req.isAuthenticated = !!(token && token.length >= 10);
  } else {
    req.isAuthenticated = false;
  }
  
  next();
}
