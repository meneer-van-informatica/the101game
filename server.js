// Importeren van vereiste modules
const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;  // Gebruik 3000 of een andere poort

// Serve statische bestanden (bijvoorbeeld index.html)
app.use(express.static(path.join(__dirname, 'public')));  // Zorg ervoor dat je de juiste map hebt

// Default route die index.html serveert
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));  // Verwijst naar index.html
});

// Andere dynamische routes kunnen hier toegevoegd worden
app.get('/about', (req, res) => {
  res.send('<h1>About the 101 Game</h1><p>Welcome to the game</p>');
});

// Start de server
app.listen(port, () => {
  console.log(`Server draait op http://localhost:${port}`);
});

