const path = require('path');
const util = require('util');
const fs = require('fs');
const fetch = require('node-fetch');
const colors = require('colors/safe');
const config = require('../config');
const CronJob = require('cron').CronJob;
const redis = require("redis");
const redisPort = 6379;
const client = redis.createClient(redisPort);
client.get = util.promisify(client.get);
client.set = util.promisify(client.set);
const time = new Date();
process.env.TZ = 'America/Sao_Paulo';
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}



/***************************** Logging Functions ******************************/
function
log(str)
{
	if (config.log)
		console.log(colors.green(new Date().toISOString()) + ': ' + str);
}

function
debug(str)
{
	if (config.debug)
		console.log(colors.green(new Date().toISOString()) + ': ' + colors.blue(str));
}

function
warning(str)
{
	console.log(colors.green(new Date().toISOString()) + ': ' + colors.yellow(str));
}

function
error(str)
{
	console.log(colors.green(new Date().toISOString()) + ': ' + colors.red(str));
	process.exit(1);
}

/******************************* Web Functions ********************************/

async function
exchangeToken(userID)
{
	const oldToken = await client.get(userID);
	if (oldToken != null) {
		const url = config.exchange_endpoint + oldToken;
		const response = await fetch(url);
		if (response.status == 200) {
			const data = await response.json();
			const res = await client.set(userID, data.access_token);
			if (res == 'OK') debug('Token do usuário ' + userID + ' renovado!');
		}
		else warning('Não foi possível renovar o token do usuário ' + userID + ' na API!');
	}
	else warning('A chave ' + userID + ' não possui um valor no DB!');
}

async function
lookForPage(userID)
{
	const token = await client.get(userID);
	if (token != null) {
		const url = config.api_base_url + userID + '/accounts?access_token=' + token;
		const response = await fetch(url);
		if (response.status == 200) {
			const json = await response.json();
			for (var i in json.data) {
				if (json.data[i].name == config.page_name) {
					log('O usuário ' + userID + ' é dono da página procurada!');
					return true;
				}
			}
		}
		else warning('Não foi possível pegar a lista de páginas do usuário' + userID);
	}
	else warning('A chave ' + userID + ' não possui um valor no DB!');
	return false;
}

/****************************** Flag Functions ********************************/
async function
notifyFacebookParser()
{
	// Com a criação desse arquivo, o gerenciador PM2 reiniciará o serviço
	// facebookParser
	debug('Criando o arquivo flag na pasta do parser...');
	const filename = path.join(__dirname, '../' + config.parserModule + '/flag');
	try {
	  	fs.utimesSync(filename, time, time);
	} catch (err) {
	 	fs.closeSync(fs.openSync(filename, 'w'));
	}

}

/******************************* DB Functions *********************************/


var userIDs = [];

async function
renewAllKeys()
{
	client.keys('*', async function (err, keys) {
		if (err) return warning(err);
			if (config.ignored_keys.includes(keys[i])) continue;
		for(var i = 0, len = keys.length; i < len; i++) {
			// TODO: ignore
			log('Renovando o token do usuário ' + keys[i]);
			exchangeToken(keys[i]);
		}
	});
}

async function
checkForNewUserID()
{
	client.keys('*', async function (err, keys) {
		if (err) return warning(err);

		for (var i = 0, len = keys.length; i < len; i++) {
			if (config.ignored_keys.includes(keys[i])) continue;
			if (userIDs.includes(keys[i])) ;
			else {
				debug('Trocando o token do usuário ' + keys[i]);
				exchangeToken(keys[i]);
				userIDs.push(keys[i]);
			}
		}
	});
}

async function
updatesUserID()
{
	client.keys('*', async function (err, keys) {
		if (err) return warning(err);

		for (var i = 0, len = keys.length; i < len; i++) {
			if (config.ignored_keys.includes(keys[i])) continue;
			if (await lookForPage(keys[i]) == true) {
				var userID = keys[i];
				const token = await client.get(userID);
				var res = await client.set('userID', userID);
				if (res == 'OK') log('userID no redis == ' + userID);
				res = await client.set('accessToken', token);
				if (res == 'OK') log('accessToken no redis == ' + token);
			}
		}
		notifyFacebookParser();
	});
}

/********************************* Scheduler **********************************/

// Agendamento para renovas todas as keys todo dia às meia-noite
var job = new CronJob('00 00 12 * * 0-6', function() {
		log('Renovando todas os tokens...');
		renewAllKeys();
		updatesUserID();
	}, function () {
		log('Renovação de tokens terminou!');
	},
	true, /* Start the job right now */
	'America/Sao_Paulo' /* Time zone of this job. */
);

// Agendamento para procurar novas keys a cada 10s
var job = new CronJob('*/10 * * * * *', function() {
		debug('Procurando novas keys...');
		checkForNewUserID();
	}, function () {
		debug('Terminou');
	},
	true, /* Start the job right now */
	'America/Sao_Paulo' /* Time zone of this job. */
);

// ATENÇÃO
updatesUserID();
