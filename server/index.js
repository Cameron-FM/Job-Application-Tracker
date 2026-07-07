const path = require('path');
const fs = require('fs');
const express = require('express');
require('./db'); // ensures schema exists before any route runs

const app = express();
app.use(express.json());

app.use('/api/companies', require('./routes/companies'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/dashboard', require('./routes/dashboard'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built client (npm start); in dev, Vite serves the client itself.
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// better-sqlite3 is synchronous, so route errors land here.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 3400;
app.listen(PORT, () => console.log(`Job tracker running at http://localhost:${PORT}`));
