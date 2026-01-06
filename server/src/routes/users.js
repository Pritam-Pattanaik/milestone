const express = require('express');
const bcrypt = require('bcrypt');
const { body, query, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/v1/users
 * Get all users (Admin only)
 */
router.get('/',
    authenticate,
    authorize('ADMIN'),
    [
        query('role').optional().isIn(['EMPLOYEE', 'MANAGER', 'ADMIN']),
        query('department').optional(),
        query('isActive').optional().isBoolean()
    ],
    asyncHandler(async (req, res) => {
        const { role, department, isActive } = req.query;

        const where = {};
        if (role) where.role = role;
        if (department) where.department = department;
        if (isActive !== undefined) where.isActive = isActive === 'true';

        const users = await prisma.user.findMany({
            where,
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                department: true,
                avatar: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        standups: true,
                        blockers: true
                    }
                }
            },
            orderBy: [
                { role: 'asc' },
                { name: 'asc' }
            ]
        });

        // Get departments for filtering
        const departments = await prisma.user.groupBy({
            by: ['department'],
            _count: { id: true }
        });

        res.json({
            success: true,
            data: {
                users,
                departments: departments.map(d => ({
                    name: d.department,
                    count: d._count.id
                })),
                total: users.length
            }
        });
    })
);

/**
 * GET /api/v1/users/:id
 * Get single user (Admin only)
 */
router.get('/:id',
    authenticate,
    authorize('ADMIN'),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                department: true,
                avatar: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        standups: true,
                        blockers: true,
                        attendance: true
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'User not found'
                }
            });
        }

        res.json({
            success: true,
            data: { user }
        });
    })
);

/**
 * POST /api/v1/users
 * Create new user (Admin only)
 */
router.post('/',
    authenticate,
    authorize('ADMIN'),
    [
        body('email').isEmail().withMessage('Valid email is required'),
        body('password')
            .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and number'),
        body('name').isLength({ min: 2, max: 100 }).withMessage('Name is required (2-100 characters)'),
        body('role').isIn(['EMPLOYEE', 'MANAGER', 'ADMIN']).withMessage('Valid role is required'),
        body('department').notEmpty().withMessage('Department is required')
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid input',
                    details: errors.array()
                }
            });
        }

        const { email, password, name, role, department } = req.body;

        // Check if email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: {
                    code: 'DUPLICATE_EMAIL',
                    message: 'A user with this email already exists'
                }
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                password: hashedPassword,
                name,
                role,
                department
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                department: true,
                isActive: true,
                createdAt: true
            }
        });

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: { user }
        });
    })
);

/**
 * PUT /api/v1/users/:id
 * Update user (Admin only)
 */
router.put('/:id',
    authenticate,
    authorize('ADMIN'),
    [
        body('email').optional().isEmail().withMessage('Valid email is required'),
        body('name').optional().isLength({ min: 2, max: 100 }),
        body('role').optional().isIn(['EMPLOYEE', 'MANAGER', 'ADMIN']),
        body('department').optional().notEmpty(),
        body('isActive').optional().isBoolean(),
        body('password').optional().isLength({ min: 8 })
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid input',
                    details: errors.array()
                }
            });
        }

        const { id } = req.params;
        const { email, name, role, department, isActive, password } = req.body;

        // Check user exists
        const existingUser = await prisma.user.findUnique({
            where: { id }
        });

        if (!existingUser) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'User not found'
                }
            });
        }

        // Check email uniqueness if changing
        if (email && email.toLowerCase() !== existingUser.email) {
            const emailExists = await prisma.user.findUnique({
                where: { email: email.toLowerCase() }
            });
            if (emailExists) {
                return res.status(409).json({
                    success: false,
                    error: {
                        code: 'DUPLICATE_EMAIL',
                        message: 'A user with this email already exists'
                    }
                });
            }
        }

        // Build update data
        const updateData = {};
        if (email) updateData.email = email.toLowerCase();
        if (name) updateData.name = name;
        if (role) updateData.role = role;
        if (department) updateData.department = department;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (password) updateData.password = await bcrypt.hash(password, 12);

        const user = await prisma.user.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                department: true,
                isActive: true,
                updatedAt: true
            }
        });

        res.json({
            success: true,
            message: 'User updated successfully',
            data: { user }
        });
    })
);

/**
 * DELETE /api/v1/users/:id
 * Deactivate user (Admin only) - Soft delete
 */
router.delete('/:id',
    authenticate,
    authorize('ADMIN'),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        // Can't delete yourself
        if (id === req.user.id) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'SELF_DELETE',
                    message: 'You cannot deactivate your own account'
                }
            });
        }

        const user = await prisma.user.findUnique({
            where: { id }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'User not found'
                }
            });
        }

        // Soft delete (deactivate)
        await prisma.user.update({
            where: { id },
            data: { isActive: false }
        });

        res.json({
            success: true,
            message: 'User deactivated successfully'
        });
    })
);

/**
 * POST /api/v1/users/:id/reactivate
 * Reactivate a deactivated user (Admin only)
 */
router.post('/:id/reactivate',
    authenticate,
    authorize('ADMIN'),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        const user = await prisma.user.findUnique({
            where: { id }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'User not found'
                }
            });
        }

        if (user.isActive) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'ALREADY_ACTIVE',
                    message: 'User is already active'
                }
            });
        }

        await prisma.user.update({
            where: { id },
            data: { isActive: true }
        });

        res.json({
            success: true,
            message: 'User reactivated successfully'
        });
    })
);

module.exports = router;
