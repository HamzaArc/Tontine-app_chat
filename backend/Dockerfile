FROM node:18-alpine

# Create and set the working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your application code
COPY . .

# Expose the port your backend uses (change 4000 if needed)
EXPOSE 4000

# Run your application (adjust the start script as needed)
CMD ["npm", "run", "start"]
