import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to add deprecation headers for legacy routes
 * Follows RFC 8594 (Sunset Header) and draft-ietf-httpapi-deprecation-header
 */
export function deprecationMiddleware(
  sunsetDate: string,
  newPath: string
) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Deprecation header (draft-ietf-httpapi-deprecation-header)
    res.setHeader('Deprecation', 'true');
    
    // Sunset header (RFC 8594) - when the API will be removed
    res.setHeader('Sunset', sunsetDate);
    
    // Link to the new API version
    const newUrl = `${req.protocol}://${req.get('host')}/api/v1${newPath || req.path}`;
    res.setHeader('Link', `<${newUrl}>; rel="successor-version"`);
    
    next();
  };
}

/**
 * Default deprecation for legacy routes
 * Sunset date: 6 months from now
 */
export function legacyRouteDeprecation(req: Request, res: Response, next: NextFunction) {
  const sunsetDate = new Date();
  sunsetDate.setMonth(sunsetDate.getMonth() + 6);
  
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', sunsetDate.toUTCString());
  res.setHeader('Link', `</api/v1${req.path}>; rel="successor-version"`);
  
  next();
}
