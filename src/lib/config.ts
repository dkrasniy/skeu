export const authConfig = {
  // Set to true to require login for protected routes, false to allow access without login
  requireLogin: false,
  
  // List of paths that should always require authentication regardless of requireLogin setting
  protectedPaths: ['/protected'],
  
  // List of paths that should never require authentication
  publicPaths: ['/auth', '/login', '/api'],
} 