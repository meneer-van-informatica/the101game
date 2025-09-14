// Importing required modules
const http = require('http');

// Create the server
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello, World from The 101 Game!');
});

// Define the port
const PORT = 3000;

// Server listens on all interfaces (0.0.0.0) on port 3000
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
});

