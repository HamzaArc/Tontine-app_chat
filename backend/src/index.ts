import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from './middleware/authMiddleware';


dotenv.config();  // Loads variables from .env

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Simple route to test
app.get('/', (req, res) => {
  res.send('Hello, Tontine World!');
});

app.post('/users', async (req, res) => {
    try {
      const { email, password, name } = req.body;
      // Hash the password with a salt (e.g., 10 rounds)
      const hashedPassword = await bcrypt.hash(password, 10);
  
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
        },
      });
  
      res.status(201).json(user);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

app.post('/groups', authMiddleware, async (req, res) => {
    const { name, contribution, frequency } = req.body;
  
    try {
      const newGroup = await prisma.group.create({
        data: {
          name,
          contribution: contribution ? parseFloat(contribution) : null,
          frequency,
        },
      });
      res.status(201).json(newGroup);
    } catch (error) {
      console.error('Error creating group:', error);
      res.status(500).json({ error: 'Failed to create group' });
    }
  }); 

  app.post('/groups', authMiddleware, async (req, res) => {
    try {
      const groups = await prisma.group.findMany();
      res.json(groups);
    } catch (error) {
      console.error('Error fetching groups:', error);
      res.status(500).json({ error: 'Failed to fetch groups' });
    }
  });

  app.post('/memberships', async (req, res) => {
    const { userId, groupId } = req.body;
  
    try {
      const membership = await prisma.membership.create({
        data: {
          userId: parseInt(userId, 10),
          groupId: parseInt(groupId, 10),
        },
      });
      res.status(201).json(membership);
    } catch (error) {
      console.error('Error creating membership:', error);
      res.status(500).json({ error: 'Failed to create membership' });
    }
  });
 
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
    
  app.post('/users', async (req, res) => {
    try {
      const { email, password, name } = req.body;
  
      // In a real app, you'd hash the password before storing.
      // For now, store plain text to keep it simple.
      const user = await prisma.user.create({
        data: {
          email,
          password,
          name,
        },
      });
  
      res.status(201).json(user);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  });
  
  // Create a separate function typed as RequestHandler
  
  export const loginHandler: RequestHandler = async (req, res, next) => {
    try {
      const { email, password } = req.body;
  
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        // Send 401 response and then return void
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }
  
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }
  
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET as string,
        { expiresIn: '1d' }
      );
  
      // Send the token in JSON
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      });
      return; // function ends, returning void
    } catch (error) {
      // Send a 500 error, then return
      res.status(500).json({ error: 'Login failed' });
      return;
    }
  };
  
  // Then use the handler:
  app.post('/auth/login', loginHandler);


  app.post(
    '/groups/:groupId/cycles',
    authMiddleware,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { groupId } = req.params;
        const { cycleIndex, startDate, endDate } = req.body;
        const groupIdNum = parseInt(groupId, 10);
  
        // 1) Create the cycle
        const newCycle = await prisma.cycle.create({
          data: {
            groupId: groupIdNum,
            cycleIndex: Number(cycleIndex),
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
          },
        });
  
        // 2) Retrieve all memberships for that group
        const memberships = await prisma.membership.findMany({
          where: { groupId: groupIdNum },
        });
  
        // 3) Retrieve the group to check its default contribution if you want
        const theGroup = await prisma.group.findUnique({
          where: { id: groupIdNum },
        });
        const groupContribution = theGroup?.contribution || 100;
  
        // 4) Create Payment records for each membership in that group
        const paymentsData = memberships.map((member) => ({
          cycleId: newCycle.id,
          userId: member.userId,
          amount: groupContribution,
        }));
  
        await prisma.payment.createMany({
          data: paymentsData,
        });
  
        // Send response (do not return the res object)
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
  
  
  // -----------------------------------------------
  // 8.4.2: GET ALL CYCLES FOR A GROUP
  // -----------------------------------------------
  app.get(
    '/groups/:groupId/cycles',
    authMiddleware,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const groupIdNum = parseInt(req.params.groupId, 10);
  
        // Optional: check user membership or admin privileges
        // const userId = (req as any).user.userId;
  
        const cycles = await prisma.cycle.findMany({
          where: { groupId: groupIdNum },
          orderBy: { cycleIndex: 'asc' },
        });
  
        // Simply send the response without returning it
        res.json(cycles);
      } catch (error) {
        console.error('Error fetching cycles:', error);
        res.status(500).json({ error: 'Failed to fetch cycles' });
      }
    }
  );
  
  
  // -----------------------------------------------
  // 8.4.3: MARK A PAYMENT AS PAID
  // -----------------------------------------------
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
        //   res.status(403).json({ error: 'Cannot mark someone else’s payment' });
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
    
  // -----------------------------------------------
  // 8.4.4: GET ALL PAYMENTS FOR A CYCLE
  // -----------------------------------------------
  app.get(
    '/cycles/:cycleId/payments',
    authMiddleware,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const cycleIdNum = parseInt(req.params.cycleId, 10);
  
        const payments = await prisma.payment.findMany({
          where: { cycleId: cycleIdNum },
          include: {
            user: true,  // fetch user info
            cycle: true, // fetch cycle info
          },
        });
  
        // Simply send the response without returning it
        res.json(payments);
      } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ error: 'Failed to fetch payments' });
      }
    }
  );
  

// Use PORT from .env if provided, else default to 4000
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
