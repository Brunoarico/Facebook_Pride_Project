const express = require('express');
const app = express();
const path = require('path');
const redis = require("redis");
const colors = require('colors/safe');
const bodyParser = require('body-parser');
const redisPort = 6379;
const client = redis.createClient(redisPort);
process.env.TZ = 'America/Sao_Paulo';

/***************************** Logging Functions ******************************/
function
log(str)
{
    console.log(colors.green(new Date().toISOString()) + ': ' + str);
}

function
warning(str)
{
    console.log(colors.green(new Date().toISOString()) + ': ' + colors.yellow(str));
}

/****************************** Main Functions ********************************/

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));

var jsonParser = bodyParser.json();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/index.html'));
});

app.post('/', jsonParser, function (req, res) {
    var userID = req.body.userID;
    var accessToken = req.body.accessToken;
    // Salva o token no Redis
    client.set(userID, accessToken, (err, reply) => {
    	if (err) warning(err);
    	else log('userID ' + userID + ' salvo no DB!');
	});
});

module.exports = app;
