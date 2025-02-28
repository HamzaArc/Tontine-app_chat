import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();  // Loads variables from .env

const app = express();
app.use(cors());
app.use(express.json());

// Simple route to test
app.get('/', (req, res) => {
  res.send('Hello, Tontine World!');
});

// Use PORT from .env if provided, else default to 4000
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
