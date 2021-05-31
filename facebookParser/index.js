// Imports
const fetch = require('node-fetch');
const EventSource = require('eventsource');
const fs = require('fs');
const util = require('util');
var colors = require('colors/safe');
const config = require('../config');
const dgram = require('dgram');
const redis = require("redis");
const redisPort = 6379;
const client = redis.createClient(redisPort);
client.get = util.promisify(client.get);
client.set = util.promisify(client.set);
process.env.TZ = 'America/Sao_Paulo';
var userID = '';
var accessToken = '';

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

/****************************** File Functions ********************************/

/* Description: Function to read the files to load old counters and restore the value of them from last connection*/

async function
load_current_status()
{
		var comments = null;
		var reactions = null;
		const live_video_id = await fetch_live_video_id();
		var last_live_video_id = await client.get("LiveID");
		debug(last_live_video_id);
		if(live_video_id == last_live_video_id) {
			log("Found comments for that live!");
			log("Found reacts for that live!");
		}
		else {
			log("Updating Live ID ");
			await client.set("LiveID", live_video_id);
			log("Reseting comments...")
			log("Reseting reacts...");
			await client.set("COMMENTS", 0);
			await client.set("WOW", 0);
			await client.set("HAHA", 0);
			await client.set("LOVE", 0);
			await client.set("LIKE", 0);
		}
		var like = await client.get("LIKE");
		var love = await client.get("LOVE");
		var haha = await client.get("HAHA");
		var wow  = await client.get("WOW");
		reactions = {
			like: like,
			love: love,
			haha: haha,
			wow: wow
		};
		comments = await client.get("COMMENTS");
		log("[LIKE:"+reactions.like+" LOVE:"+reactions.love+" HAHA:"+ reactions.haha+" WOW:"+reactions.wow +"]");
		log("Current comment count: " + comments);
}


/****************************** Main Functions ********************************/

/* Description: Function to find the live make the API request to endpoint /live_videos */
async function
fetch_live_video_id()
{
	// TODO: handle exceptions on requests
	var page_id = await get_page();
	log('Searching for Live Video \"' + config.title + '\" on page '
		+ page_id + '...');

	const url = 'https://graph.facebook.com/' + page_id +
		  '/live_videos?access_token=' + accessToken;
	const response = await fetch(url);
	const json = await response.json();
	const liveVideos = json.data;
	if (liveVideos.length > 0) {
		for (var i = 0; i < liveVideos.length; i++) {
			if (liveVideos[i].title == config.title) {
				log('Live Video found: ID == ' + liveVideos[i].id + ' STATUS == ' + liveVideos[i].status);
				return liveVideos[i].id;
			}
		}
	}
	else error('Live Video \"' + config.title + '\" not found!');
	return null;
}

/* Description: Function to update the counter in the comments file */
async function
update_comments()
{
	var comments = await client.get("COMMENTS");
	comments++;
	debug("Updating comments count on redis...");
	client.set("COMMENTS", comments)
	// Write to client
	debug("Sending comment count to client...");
	const message = Buffer.from('MSG ' + comments);
	const client_socket = dgram.createSocket('udp4');
	client_socket.send(message, config.port, config.host, (err) => {
		client_socket.close();
	});
	debug("comments w/ hashtag == " + comments);
}


/* Description: Function to update the counter of reactions in the reactions file /
/ Args: (JsonFile: Json with the number of each react in the moment of last request, Integer: value of counter to be saved) */
async function
update_reactions(json)
{
    var map = ['LIKE', 'LOVE', 'HAHA','WOW'];

    // Iterate over json sctructure to make the difference between the old counter ans new values
    map.forEach(async(x, i) => {
        if(typeof(json.reaction_stream[i]) != 'undefined' && json.reaction_stream[i].key == x) {
						var reaction_redis = await client.get(x);
            new_reaction = json.reaction_stream[i].value - reaction_redis;
						debug("reactions " + x + " == " + new_reaction);
            if (new_reaction > 0) {
                const message = Buffer.from(x + " " + new_reaction);
                const client_socket = dgram.createSocket('udp4');
                client_socket.send(message, config.port, config.host, (err) => {
                    client_socket.close();
                });
            }
        }
    });

    // Write file
    debug("Updating reactions count on redis...");
    // update the old counters
    map.forEach((x, i) => {
        if(typeof(json.reaction_stream[i]) != 'undefined' && json.reaction_stream[i].key == x) {
					client.set(x, json.reaction_stream[i].value);
					debug("Total " + x + " reactions == " + json.reaction_stream[i].value);
        }
    });
}

async function
get_page()
{
	userID = await client.get('userID');
	accessToken = await client.get('accessToken');
	var page_id = null;
	// TODO: handle exceptions on requests
	log('Searching for pages of user ' + userID);
	const url = 'https://graph.facebook.com/' + userID + '/accounts'+'?access_token=' + accessToken;
	const response = await fetch(url);
	const json = JSON.parse(await response.text()).data;
	for (var key in json){
		if(json[key].name == config.page_name){
			page_id = json[key].id;
			debug("Page found: " + json[key].id);
		}
	}
	return page_id;
}

/* Description: Function who gets the number of comments and the number of reactions */
/* in that function we use the endpoints /live_comments and /live_reaction to get only*/
/* the number of each reaction and the number of comments with the hashtag, that counters*/
/* are the only data we have to store. We only read the messages to find a hashtag.*/
/* Args: (Integer: value of counter of comments, Dictionary: list of counter for each reaction) */

async function
connect_to_facebook()
{
	var live_video_id = await client.get("LiveID");
	var accessToken = await client.get('accessToken');
	// Comments request
	const comment_url = 'https://streaming-graph.facebook.com/'
		+ live_video_id + '/live_comments?access_token=' + accessToken;
	const comment_stream = new EventSource(comment_url);
	comment_stream.onmessage = function logEvents(event) {
		var json = null;
		try {
			json = JSON.parse(event.data);
			debug(json);
		}
		catch {
			warning("Could not parse comment stream!");
		}
		// analisys of hashtag in message, if we have a gotcha, increment the counter
		if (json.message.includes(config.hashtag)) update_comments(); //precisa tratar concorrencia?
	};
	// Reactions request
	const reaction_url = 'https://streaming-graph.facebook.com/'
		+ live_video_id + '/live_reactions?access_token=' + accessToken;
	const reaction_stream = new EventSource(reaction_url);
	reaction_stream.onmessage = function logEvents(event) {
		var json = null;
		try {
			json = JSON.parse(event.data);
			debug(json);
		}
		catch {
			warning("Could not parse reactions stream!");
		}
		update_reactions(json);
	};
}

load_current_status();
connect_to_facebook();
