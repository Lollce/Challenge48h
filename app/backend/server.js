const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT 1 AS ok');
        res.json({ message: 'Parkshare API OK', db: result.rows });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erreur serveur');
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));