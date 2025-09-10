const express = require('express');
const path = require('path');
const exec = require('child_process').exec;
const app = express();
const port = 3000;  // Or any port you prefer

// Serve the website files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Webhook listener for GitHub push event
app.post('/webhook', (req, res) => {
  // Ensure the request is a push to the 'main' branch
  if (req.body.ref === 'refs/heads/main') {
    console.log('Received a push to main branch. Pulling latest changes...');
    
    // Pull the latest changes from GitHub
    exec('git pull origin main', (err, stdout, stderr) => {
      if (err) {
        console.error('Error during git pull:', err);
        return res.status(500).send('Error during git pull');
      }

      console.log(stdout);

      // Restart the server using PM2 after the pull
      exec('pm2 restart the101game', (err, stdout, stderr) => {
        if (err) {
          console.error('Error restarting server:', err);
          return res.status(500).send('Error restarting server');
        }

        console.log(stdout);
        return res.status(200).send('Server updated and restarted successfully!');
      });
    });
  } else {
    return res.status(400).send('Not a push to the main branch');
  }
});

// Server running
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// Optionally handle errors globally
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

