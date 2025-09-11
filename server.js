const express = require('express');
const app = express();
const port = 8080;

app.use(express.static('public'));  // Zorg ervoor dat alle statische bestanden worden bediend

app.get('/', (req, res) => {
  res.sendFile('/var/www/html/index.html');  // Zorg ervoor dat dit het juiste pad is
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
