const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Authentication middleware - Validates JWT access token
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'AUTH_REQUIRED',
                    message: 'Authentication required. Please provide a valid token.'
                }
            });
        }

        const token = authHeader.split(' ')[1];

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Fetch user to ensure they still exist and are active
            const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    department: true,
                    isActive: true
                }
            });

            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'USER_NOT_FOUND',
                        message: 'User no longer exists.'
                    }
                });
            }

            if (!user.isActive) {
                return res.status(403).json({
                    success: false,
                    error: {
                        code: 'USER_INACTIVE',
                        message: 'Your account has been deactivated. Please contact an administrator.'
                    }
                });
            }

            // Attach user to request object
            req.user = user;
            next();
        } catch (jwtError) {
            if (jwtError.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'TOKEN_EXPIRED',
                        message: 'Your session has expired. Please refresh your token.'
                    }
                });
            }

            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_TOKEN',
                    message: 'Invalid authentication token.'
                }
            });
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'SERVER_ERROR',
                message: 'An error occurred during authentication.'
            }
        });
    }
};

/**
 * Role-based access control middleware
 * @param  {...string} allowedRoles - Roles that can access the route
 */
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'AUTH_REQUIRED',
                    message: 'Authentication required.'
                }
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
                }
            });
        }

        next();
    };
};

/**
 * Optional authentication - Attaches user if token is valid, but doesn't block
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.split(' ')[1];

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    department: true,
                    isActive: true
                }
            });

            if (user && user.isActive) {
                req.user = user;
            }
        } catch {
            // Token invalid, continue without user
        }

        next();
    } catch (error) {
        next();
    }
};

/**
 * Role hierarchy check - Manager can do employee things, Admin can do all
 */
const roleHierarchy = {
    EMPLOYEE: 1,
    MANAGER: 2,
    ADMIN: 3
};

const hasMinimumRole = (requiredRole) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'AUTH_REQUIRED',
                    message: 'Authentication required.'
                }
            });
        }

        const userRoleLevel = roleHierarchy[req.user.role] || 0;
        const requiredLevel = roleHierarchy[requiredRole] || 0;

        if (userRoleLevel < requiredLevel) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: `Access denied. Minimum required role: ${requiredRole}`
                }
            });
        }

        next();
    };
};

module.exports = {
    authenticate,
    authorize,
    optionalAuth,
    hasMinimumRole
};
