# Use an official Node.js runtime as the base image
FROM node:18

# Set the working directory in the container
WORKDIR /app

# Copy the package.json and package-lock.json to the working directory
COPY package*.json ./

# Install the app dependencies
RUN npm install --production

# Copy the rest of the application source code to the working directory
COPY . .

# Expose the port that the app runs on
EXPOSE 3012

# Define the command to run your app
CMD ["npm", "start"]