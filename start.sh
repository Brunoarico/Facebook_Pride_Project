echo "Moved workspace to bruno_carneiro..."
pm2 stop all
pm2 del all
echo "Triggering fuser to close port"
sudo fuser -k 80/tcp
pm2 start /home/bruno_carneiro/pride/tokenFetcher/server.js --name "tokenFetcher"
pm2 start /home/bruno_carneiro/pride/tokenManager/index.js --name "tokenManager" --watch /home/bruno_carneiro/pride/config.js
echo "Aguardando 3 segundos para início do tokenManager..."
sleep 3
pm2 start /home/bruno_carneiro/pride/facebookParser/index.js --name "facebookParser" --watch /home/bruno_carneiro/pride/facebookParser
