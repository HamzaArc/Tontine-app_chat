import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { authMiddleware } from './middleware/authMiddleware';
import { PrismaClient, Membership } from '@prisma/client';
import './cronJobs';
import helmet from 'helmet';
import morgan from 'morgan';
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN, // Set this in your environment variables
  tracesSampleRate: 1.0, // Adjust the sample rate as needed
});

dotenv.config();  // Loads variables from .env

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());
app.use(helmet());
app.use(morgan('combined'));

// Simple route to test
app.get('/', (req, res) => {
  res.send('Hello, Tontine World!');
});

// =============================================
// USER RELATED ENDPOINTS
// =============================================

// Create a new user
app.post('/users', async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;
    // For simplicity, storing plain text (testing only)
    // Optionally, normalize email here as well:
    const normalizedEmail = email.toLowerCase();

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password,
        name,
        phone,
      },
    });
    
    // Don't send the password back
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Get user by ID
app.get('/users/:userId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.userId, 10);
    
    // Check if the user is requesting their own profile
    const requesterId = (req as any).user.userId;
    if (userId !== requesterId) {
      res.status(403).json({ error: 'You can only view your own profile' });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        // Don't include password in the response
      },
    });
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Search users by email (for adding members)
app.get('/users', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.query;
    
    if (!email) {
      res.status(400).json({ error: 'Email query parameter is required' });
      return;
    }
    
    const user = await prisma.user.findFirst({
      where: {
        email: {
          contains: email.toString().toLowerCase(),
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });
    
    res.json(user || null);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Update user profile
app.put('/users/:userId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const { name, phone } = req.body;
    
    // Check if the user is updating their own profile
    const requesterId = (req as any).user.userId;
    if (userId !== requesterId) {
      res.status(403).json({ error: 'You can only update your own profile' });
      return;
    }
    
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        phone,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
    });
    
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Update user password
app.put('/users/:userId/password', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const { current_password, new_password } = req.body;
    
    // Check if the user is updating their own password
    const requesterId = (req as any).user.userId;
    if (userId !== requesterId) {
      res.status(403).json({ error: 'You can only update your own password' });
    }
    
    // Get the user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
    }
    
    // Check if current password matches
    // In a real app, you would use bcrypt to compare passwords
    if (!user || current_password !== user.password) {
      res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Update the password
    // In a real app, you would hash the new password with bcrypt
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        password: new_password,
      },
      select: {
        id: true,
      },
    });
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Delete user account
app.delete('/users/:userId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.userId, 10);
    
    // Check if the user is deleting their own account
    const requesterId = (req as any).user.userId;
    if (userId !== requesterId) {
      res.status(403).json({ error: 'You can only delete your own account' });
      return;
    }
    
    // Delete all associated data
    // This should be done in a transaction in a real application
    
    // Delete memberships and payments
    await prisma.membership.deleteMany({
      where: { userId },
    });
    
    await prisma.payment.deleteMany({
      where: { userId },
    });
    
    // Delete the user
    await prisma.user.delete({
      where: { id: userId },
    });
    
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Update user settings
app.put('/users/:userId/settings', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const { notifications_enabled } = req.body;
    
    // Check if the user is updating their own settings
    const requesterId = (req as any).user.userId;
    if (userId !== requesterId) {
      res.status(403).json({ error: 'You can only update your own settings' });
      return;
    }
    
    // In a complete app, you would store these settings in a user_settings table
    // For now, we'll just return a success message
    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// This endpoint lets a logged-in user update their push token in the DB
app.put(
  '/users/push-token',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user.userId; // user ID from JWT
      const { pushToken } = req.body;          // from the request body

      // Update the user record
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { pushToken },
      });

      res.json({ message: 'Push token updated', user: updatedUser });
    } catch (error) {
      console.error('Error updating push token:', error);
      res.status(500).json({ error: 'Failed to update push token' });
    }
  }
);

// Login handler
export const loginHandler: RequestHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', { email, password }); // Debug: log input

    // Normalize the email to lowercase (optional)
    const normalizedEmail = email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    console.log('User from DB:', user); // Debug: log user object

    if (!user) {
      console.log('User not found for email:', normalizedEmail);
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Since we're using plain text for now:
    if (password !== user.password) {
      console.log('Password mismatch. Input:', password, 'Stored:', user.password);
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    );
    console.log('Login successful for user:', user.id);
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
    return;
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Login failed' });
    return;
  }
};

// Then use the handler:
app.post('/auth/login', loginHandler);

// =============================================
// GROUP RELATED ENDPOINTS
// =============================================

// Create a new group
app.post('/groups', authMiddleware, async (req, res) => {
  const { name, description, contribution, frequency, maxMembers } = req.body;
  const userId = (req as any).user.userId;

  try {
    // Create the group
    const newGroup = await prisma.group.create({
      data: {
        name,
        description,
        contribution: contribution ? parseFloat(contribution) : null,
        frequency,
        maxMembers: maxMembers ? parseInt(maxMembers, 10) : null,
      },
    });

    // Add the creator as an admin member
    await prisma.membership.create({
      data: {
        userId: userId,
        groupId: newGroup.id,
        role: 'admin',
      },
    });

    res.status(201).json(newGroup);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Get all groups the user is a member of
app.get('/groups', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    
    // Find all groups where the user is a member
    const memberships = await prisma.membership.findMany({
      where: { userId },
      include: { group: true },
    });
    
    // Extract just the groups
    const groups = memberships.map(membership => membership.group);
    
    res.json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// Get a specific group by ID
app.get('/groups/:groupId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = parseInt(req.params.groupId, 10);
    
    // Check if the user is a member of this group
    const userId = (req as any).user.userId;
    const membership = await prisma.membership.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
      },
    });
    
    if (!membership) {
      res.status(403).json({ error: 'You are not a member of this group' });
      return;
    }
    
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });
    
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    
    res.json(group);
  } catch (error) {
    console.error('Error fetching group:', error);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// Update a group
app.put('/groups/:groupId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = parseInt(req.params.groupId, 10);
    const { name, description, contribution, frequency, maxMembers } = req.body;
    
    // Check if the user is an admin of this group
    const userId = (req as any).user.userId;
    const membership = await prisma.membership.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
      },
    });
    
    if (!membership || membership.role !== 'admin') {
      res.status(403).json({ error: 'Only group admins can update the group' });
      return;
    }
    
    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data: {
        name,
        description,
        contribution: contribution ? parseFloat(contribution) : null,
        frequency,
        maxMembers: maxMembers ? parseInt(maxMembers, 10) : null,
      },
    });
    
    res.json(updatedGroup);
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// Delete a group
app.delete('/groups/:groupId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = parseInt(req.params.groupId, 10);
    
    // Check if the user is an admin of this group
    const userId = (req as any).user.userId;
    const membership = await prisma.membership.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
      },
    });
    
    if (!membership || membership.role !== 'admin') {
      res.status(403).json({ error: 'Only group admins can delete the group' });
      return;
    }
    
    // Delete all associated data in order (cycles, payments, memberships, then group)
    // This should be done in a transaction in a real application
    
    // Get all cycles for this group
    const cycles = await prisma.cycle.findMany({
      where: { groupId },
      select: { id: true },
    });
    
    // Delete payments for each cycle
    for (const cycle of cycles) {
      await prisma.payment.deleteMany({
        where: { cycleId: cycle.id },
      });
    }
    
    // Delete all cycles
    await prisma.cycle.deleteMany({
      where: { groupId },
    });
    
    // Delete all memberships
    await prisma.membership.deleteMany({
      where: { groupId },
    });
    
    // Delete the group
    await prisma.group.delete({
      where: { id: groupId },
    });
    
    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// =============================================
// MEMBERSHIP RELATED ENDPOINTS
// =============================================

// Create a new membership (add a member to a group)
app.post('/memberships', async (req, res) => {
  const { userId, groupId, role } = req.body;

  try {
    const membership = await prisma.membership.create({
      data: {
        userId: parseInt(userId, 10),
        groupId: parseInt(groupId, 10),
        role: role || 'member',
      },
    });
    res.status(201).json(membership);
  } catch (error) {
    console.error('Error creating membership:', error);
    res.status(500).json({ error: 'Failed to create membership' });
  }
});

// Get memberships (filter by userId or groupId)
app.get('/memberships', async (req, res) => {
  const { userId, groupId } = req.query;

  try {
    let whereClause: any = {};

    if (userId) {
      whereClause.userId = parseInt(userId as string, 10);
    }
    if (groupId) {
      whereClause.groupId = parseInt(groupId as string, 10);
    }

    const memberships = await prisma.membership.findMany({
      where: whereClause,
      include: {
        user: true,
        group: true,
      },
    });
    res.json(memberships);
  } catch (error) {
    console.error('Error fetching memberships:', error);
    res.status(500).json({ error: 'Failed to fetch memberships' });
  }
});

// Update a membership (change role)
app.put('/memberships/:membershipId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const membershipId = parseInt(req.params.membershipId, 10);
    const { role } = req.body;
    
    // Validate role
    if (role !== 'admin' && role !== 'member') {
      res.status(400).json({ error: 'Invalid role. Must be "admin" or "member"' });
      return;
    }
    
    // Get the membership
    const membership = await prisma.membership.findUnique({
      where: { id: membershipId },
      include: { group: true },
    });
    
    if (!membership) {
      res.status(404).json({ error: 'Membership not found' });
      return;
    }
    
    // Check if the user is an admin of this group
    const userId = (req as any).user.userId;
    const userMembership = await prisma.membership.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId: membership.groupId,
        },
      },
    });
    
    if (!userMembership || userMembership.role !== 'admin') {
      res.status(403).json({ error: 'Only group admins can update membership roles' });
      return;
    }
    
    // Update the membership
    const updatedMembership = await prisma.membership.update({
      where: { id: membershipId },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        group: true,
      },
    });
    
    res.json(updatedMembership);
  } catch (error) {
    console.error('Error updating membership:', error);
    res.status(500).json({ error: 'Failed to update membership' });
  }
});

// Remove a member from a group
app.delete('/memberships/:membershipId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const membershipId = parseInt(req.params.membershipId, 10);
    
    // Get the membership
    const membership = await prisma.membership.findUnique({
      where: { id: membershipId },
      include: { group: true },
    });
    
    if (!membership) {
      res.status(404).json({ error: 'Membership not found' });
      return;
    }
    
    // Check if the user is an admin of this group or the member themselves
    const userId = (req as any).user.userId;
    const isOwnMembership = membership.userId === userId;
    
    if (!isOwnMembership) {
      const userMembership = await prisma.membership.findUnique({
        where: {
          userId_groupId: {
            userId,
            groupId: membership.groupId,
          },
        },
      });
      
      if (!userMembership || userMembership.role !== 'admin') {
        res.status(403).json({ error: 'Only group admins can remove other members' });
        return;
      }
    }
    
    // Delete any payments associated with this member
    await prisma.payment.deleteMany({
      where: {
        userId: membership.userId,
        cycle: {
          groupId: membership.groupId,
        },
      },
    });
    
    // Delete the membership
    await prisma.membership.delete({
      where: { id: membershipId },
    });
    
    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// =============================================
// CYCLE RELATED ENDPOINTS
// =============================================

// Create a cycle for a group
app.post(
  '/groups/:groupId/cycles',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { groupId } = req.params;
      const { cycleIndex, startDate, endDate, recipientUserId, status } = req.body;
      const groupIdNum = parseInt(groupId, 10);

      // 1) Check if the logged-in user is an admin in this group
      const userId = (req as any).user.userId;

      // Attempt to find the membership record for this (user, group)
      const membership: Membership | null = await prisma.membership.findUnique({
        where: {
          userId_groupId: {
            userId,
            groupId: groupIdNum,
          },
        },
      });

      // If no membership record or the role isn't 'admin', deny access
      if (!membership) {
        res.status(403).json({ error: 'You are not a member of this group.' });
        return; 
      }
      if (membership.role !== 'admin') {
        res.status(403).json({ error: 'Only admins can create cycles.' });
        return; 
      }

      // 2) Create the cycle
      const newCycle = await prisma.cycle.create({
        data: {
          groupId: groupIdNum,
          cycleIndex: Number(cycleIndex),
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          recipientUserId: recipientUserId ? Number(recipientUserId) : null,
          status: status || 'active',
        },
      });

      // 3) Retrieve all memberships for that group
      const memberships = await prisma.membership.findMany({
        where: { groupId: groupIdNum },
      });

      // 4) Retrieve the group to check its default contribution
      const theGroup = await prisma.group.findUnique({
        where: { id: groupIdNum },
      });
      const groupContribution = theGroup?.contribution || 100;

      // 5) Create Payment records for each membership in that group
      const paymentsData = memberships.map((member) => ({
        cycleId: newCycle.id,
        userId: member.userId,
        amount: groupContribution,
      }));

      await prisma.payment.createMany({
        data: paymentsData,
      });

      // 6) Return success
      res.status(201).json({
        cycle: newCycle,
        message: 'Cycle and payment records created successfully.',
      });
    } catch (error) {
      console.error('Error creating cycle:', error);
      res.status(500).json({ error: 'Failed to create cycle' });
    }
  }
);

// Get all cycles for a group
app.get(
  '/groups/:groupId/cycles',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const groupIdNum = parseInt(req.params.groupId, 10);

      // Optional: check user membership
      const userId = (req as any).user.userId;
      const membership = await prisma.membership.findUnique({
        where: {
          userId_groupId: {
            userId,
            groupId: groupIdNum,
          },
        },
      });

      if (!membership) {
        res.status(403).json({ error: 'You are not a member of this group' });
        return;
      }

      const cycles = await prisma.cycle.findMany({
        where: { groupId: groupIdNum },
        orderBy: { cycleIndex: 'asc' },
        include: {
          recipient: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      res.json(cycles);
    } catch (error) {
      console.error('Error fetching cycles:', error);
      res.status(500).json({ error: 'Failed to fetch cycles' });
    }
  }
);

// Get a specific cycle by ID
app.get('/cycles/:cycleId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const cycleId = parseInt(req.params.cycleId, 10);
    
    const cycle = await prisma.cycle.findUnique({
      where: { id: cycleId },
      include: {
        group: true,
        recipient: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    
    if (!cycle) {
      res.status(404).json({ error: 'Cycle not found' });
      return;
    }
    
    // Check if the user is a member of this group
    const userId = (req as any).user.userId;
    const membership = await prisma.membership.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId: cycle.groupId,
        },
      },
    });
    
    if (!membership) {
      res.status(403).json({ error: 'You are not a member of this group' });
      return;
    }
    
    res.json(cycle);
  } catch (error) {
    console.error('Error fetching cycle:', error);
    res.status(500).json({ error: 'Failed to fetch cycle' });
  }
});

// Update a cycle (e.g., assign recipient, change status)
app.put('/cycles/:cycleId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const cycleId = parseInt(req.params.cycleId, 10);
    const { recipientUserId, status } = req.body;
    
    // Get the cycle
    const cycle = await prisma.cycle.findUnique({
      where: { id: cycleId },
      include: { group: true },
    });
    
    if (!cycle) {
      res.status(404).json({ error: 'Cycle not found' });
      return;
    }
    
    // Check if the user is an admin of this group
    const userId = (req as any).user.userId;
    const membership = await prisma.membership.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId: cycle.groupId,
        },
      },
    });
    
    if (!membership || membership.role !== 'admin') {
      res.status(403).json({ error: 'Only group admins can update cycles' });
      return;
    }
    
    // If assigning a recipient, check if they are a member of the group
    if (recipientUserId) {
      const recipientMembership = await prisma.membership.findUnique({
        where: {
          userId_groupId: {
            userId: parseInt(recipientUserId.toString(), 10),
            groupId: cycle.groupId,
          },
        },
      });
      
      if (!recipientMembership) {
        res.status(400).json({ error: 'Recipient must be a member of the group' });
        return;
      }
    }
    
    // Update the cycle
    const updatedCycle = await prisma.cycle.update({
      where: { id: cycleId },
      data: {
        recipientUserId: recipientUserId ? parseInt(recipientUserId.toString(), 10) : null,
        status: status || undefined,
      },
      include: {
        group: true,
        recipient: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    
    res.json(updatedCycle);
  } catch (error) {
    console.error('Error updating cycle:', error);
    res.status(500).json({ error: 'Failed to update cycle' });
  }
});

// Delete a cycle
app.delete('/cycles/:cycleId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const cycleId = parseInt(req.params.cycleId, 10);
    
    // Get the cycle
    const cycle = await prisma.cycle.findUnique({
      where: { id: cycleId },
      include: { group: true },
    });
    
    if (!cycle) {
      res.status(404).json({ error: 'Cycle not found' });
      return;
    }
    
    // Check if the user is an admin of this group
    const userId = (req as any).user.userId;
    const membership = await prisma.membership.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId: cycle.groupId,
        },
      },
    });
    
    if (!membership || membership.role !== 'admin') {
      res.status(403).json({ error: 'Only group admins can delete cycles' });
      return;
    }
    
    // Delete all payments for this cycle
    await prisma.payment.deleteMany({
      where: { cycleId },
    });
    
    // Delete the cycle
    await prisma.cycle.delete({
      where: { id: cycleId },
    });
    
    res.json({ message: 'Cycle deleted successfully' });
  } catch (error) {
    console.error('Error deleting cycle:', error);
    res.status(500).json({ error: 'Failed to delete cycle' });
  }
});

// =============================================
// PAYMENT RELATED ENDPOINTS
// =============================================

// Mark a payment as paid
app.put(
  '/payments/:paymentId/pay',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const paymentIdNum = parseInt(req.params.paymentId, 10);

      // Optional: verify the payment belongs to the authenticated user
      // const userId = (req as any).user.userId;
      // const paymentRecord = await prisma.payment.findUnique({ where: { id: paymentIdNum } });
      // if (paymentRecord?.userId !== userId) {
      //   res.status(403).json({ error: 'Cannot mark someone else's payment' });
      //   return;
      // }

      const updatedPayment = await prisma.payment.update({
        where: { id: paymentIdNum },
        data: {
          paid: true,
          paidAt: new Date(),
        },
      });

      res.json(updatedPayment);
    } catch (error) {
      console.error('Error marking payment as paid:', error);
      res.status(500).json({ error: 'Failed to mark payment as paid' });
    }
  }
);

// Get all payments for a cycle
app.get(
  '/cycles/:cycleId/payments',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const cycleIdNum = parseInt(req.params.cycleId, 10);

      // Get the cycle to check the group
      const cycle = await prisma.cycle.findUnique({
        where: { id: cycleIdNum },
        select: { groupId: true },
      });

      if (!cycle) {
        res.status(404).json({ error: 'Cycle not found' });
        return;
      }

      // Check if the user is a member of this group
      const userId = (req as any).user.userId;
      const membership = await prisma.membership.findUnique({
        where: {
          userId_groupId: {
            userId,
            groupId: cycle.groupId,
          },
        },
      });

      if (!membership) {
        res.status(403).json({ error: 'You are not a member of this group' });
        return;
      }

      const payments = await prisma.payment.findMany({
        where: { cycleId: cycleIdNum },
        include: {
          user: true,  // fetch user info
          cycle: true, // fetch cycle info
        },
      });

      res.json(payments);
    } catch (error) {
      console.error('Error fetching payments:', error);
      res.status(500).json({ error: 'Failed to fetch payments' });
    }
  }
);

// Error handler for Sentry
app.use((err: Error, req: Request, res: Response, next: Function) => {
  Sentry.captureException(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ message: "Server is running!" });
});

// Use PORT from .env if provided, else default to 3000
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;