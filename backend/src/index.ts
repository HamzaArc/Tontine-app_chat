import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();


dotenv.config();  // Loads variables from .env

const app = express();
app.use(cors());
app.use(express.json());

// Simple route to test
app.get('/', (req, res) => {
  res.send('Hello, Tontine World!');
});

app.get('/users', async (req, res) => {
    try {
      const users = await prisma.user.findMany();
      res.json(users);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Something went wrong' });
    }
  });

app.post('/groups', async (req, res) => {
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

  app.get('/groups', async (req, res) => {
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
  

// Use PORT from .env if provided, else default to 4000
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
