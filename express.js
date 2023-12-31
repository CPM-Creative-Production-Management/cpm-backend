const express = require('express')
const app = express()
const { createServer } = require('node:http');
const { Server } = require("socket.io");
require('dotenv').config()

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
    }
});

module.exports = { app, server, io }