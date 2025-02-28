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
  

// Use PORT from .env if provided, else default to 4000
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
