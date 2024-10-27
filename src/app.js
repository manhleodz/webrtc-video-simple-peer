const fs = require('fs')
const path = require('path')
const express = require('express')
const app = express()
const http = require('http')
const https = require('https')
const httpolyglot = require('httpolyglot')

//////// CONFIGURATION ///////////

const options = {
    key: fs.readFileSync(path.join(__dirname, 'keys', 'agent2-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'keys', 'agent2-cert.pem'))
}

const port = process.env.PORT || 3333;

////////////////////////////

require('./routes')(app);

const httpsServer = httpolyglot.createServer(options, app);
const io = require('socket.io')(httpsServer);
require('./socketController')(io);


httpsServer.listen(port, () => {
    console.log(`listening on port ${port}`)
})