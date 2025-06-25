const express = require('express');
const app = express();
app.use(express.json());

const userRoutes = require('./routes/users');
const gsRoutes = require('./routes/gs');
const snipRoutes = require('./routes/snip');

app.use('/api/users', userRoutes);
app.use('/api/gs', gsRoutes);
app.use('/api/snip', snipRoutes);

app.listen(3000, () => console.log('Server running'));
