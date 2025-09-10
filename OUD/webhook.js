const express = require('express');
const exec = require('child_process').exec;

const app = express();
app.use(express.json());

const PORT = 3000; // Or any port you prefer

// Webhook endpoint to listen for pushes
app.post('/webhook', (req, res) => {
  console.log('Received a webhook request...');
  
  // Check if it's a push event
  if (req.body.ref === 'refs/heads/main') {
    console.log('Push to main detected. Pulling latest changes...');

    // Pull the latest changes from GitHub and restart the app
    exec('git pull origin main && pm2 restart the101game', (err, stdout, stderr) => {
      if (err) {
        console.error('Error executing commands:', err);
        res.status(500).send('Error executing Git pull or PM2 restart');
        return;
      }
      console.log(stdout);
      console.error(stderr);
      res.status(200).send('Server updated and restarted successfully');
    });
  } else {
    res.status(400).send('Not a push to the main branch');
  }
});

// Start the webhook listener server
app.listen(PORT, () => {
  console.log(`Webhook listener running on http://localhost:${PORT}`);
});

