var express = require('express'),
https = require('https'),
fs = require('fs');
var WebSocket = require("ws");
var bodyParser = require('body-parser');
const SonoffConfigurer = require('./SonoffConfigurer');
const SonoffDevice = require('./SonoffDevice');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));


var mqtt = require('mqtt');


var PORT = process.env.PORT || 443;
var HOST = process.env.HOST || '192.168.254.17';
const WS_PORT = 40079;



var appWs = express();
var expressWs = require('express-ws')(appWs);

appWs.use(bodyParser.json());




appWs.use(function (req, res, next) {
  console.log(req.path, req.method, req.body);
  next();
});





appWs.ws('/', function(ws, req) {
  ws.on('open', function() {
    console.log("knock knock");
  });
  ws.on('message', function(msg) {
    console.log(msg);

  });
});

var options = {
  key  : fs.readFileSync('ssl/key.pem'),
  ca   : fs.readFileSync('ssl/csr.pem'),
  cert : fs.readFileSync('ssl/cert.pem')
}





const server = https.createServer(options);



const wss = new WebSocket.Server({ server });


server.listen(WS_PORT, function listening () {
  //
  // If the `rejectUnauthorized` option is not `false`, the server certificate
  // is verified against a list of well-known CAs. An 'error' event is emitted
  // if verification fails.
  //
  // The certificate used in this example is self-signed so `rejectUnauthorized`
  // is set to `false`.
  //

  console.log(`Websocket server is running on wss://localhost:${server.address().port}, creating `)

  var app = express();
  app.use(bodyParser.json());
  app.use(function (req, res, next) {
    console.log(req.path, req.method, req.body);
    next();
  });

  app.post('/dispatch/device', function(req, res) {

    var response = {
      "error":  0,
      "reason": "ok",
      "IP":     HOST,
      "port":   server.address().port
    };
    console.log(`Received a dispatch request from ${req.connection.remoteAddress}, reply:`, response);
    res.json(response);
  });

  app.post('/add_device', function (req, res) {
    new SonoffConfigurer().init(HOST, PORT, config).then(function (err, result) {
      res.send(result);

    });

  });


  https.createServer({
    key: fs.readFileSync('ssl/key.pem'),
    cert: fs.readFileSync('ssl/cert.pem')
  }, app).listen(PORT);


});



wss.on('connection', function connection (ws, request) {
  console.log("REQ | new websocket request on : ", request.url, " from ", request.connection.remoteAddress);
  const device = new SonoffDevice(ws, {wsApiKey: config.wsApiKey});
  ws.on("close", function() {
    device.close()
  });


});







https.createServer({
  key: fs.readFileSync('ssl/key.pem'),
  cert: fs.readFileSync('ssl/cert.pem')
}, appWs).listen(PORT+1);
