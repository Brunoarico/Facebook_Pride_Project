var config = {};

config.title = 'Teste 1';             	   // live video's title
config.hashtag = '#juntxstestando';        // hashtag to be analised
config.comments_path = './comments';       // file where we store the number of comments (only an integer)
config.reactions_path = './reactions';     // file where we store the number of reacts (a json file)
config.host = '172.30.73.90';     // host which will receive the counting
config.port = 6674;					   // host port
config.page_name = 'Teste';
config.app_id = '2972699973018793';
config.app_secret = '91a0e35ffb8337b1cd7baa5422fe7f13';
config.api_version = 'v10.0';
config.exchange_endpoint = 'https://graph.facebook.com/' + config.api_version + '\
/oauth/access_token?\
grant_type=fb_exchange_token&\
client_id=' + config.app_id + '&\
client_secret=' + config.app_secret+ '&\
fb_exchange_token=';
config.api_base_url = 'https://graph.facebook.com/' + config.api_version + '/';
config.debug = true;
config.log = true;
config.ignored_keys = ['accessToken', 'userID', 'LIKE', 'WOW', 'HAHA', 'LOVE', 'COMMENTS', 'LiveID'];

config.parserModule = 'facebookParser';
config.fetcherModule = 'tokenFetcher';
config.managerModule = 'tokenManager';

module.exports = config;                   // export config to other file
