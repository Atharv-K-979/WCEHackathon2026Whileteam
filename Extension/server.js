const express = require('express');
const app = express();
app.use(express.static('.'));
app.listen(5500, () => console.log('Serving on port 5500'));
