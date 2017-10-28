var express = require('express'),
https = require('https'),
fs = require('fs');
var WebSocket = require("ws");
var bodyParser = require('body-parser');
const SonoffConfigurer = require('./SonoffConfigurer');
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

  var client  = mqtt.connect('mqtt://localhost');
  var deviceid = '';
  var className = '';
  ws.on('message', function message (msg) {
    var data = JSON.parse(msg);
    console.log('REQ | WS | DEV | %s', JSON.stringify(data));
    var response = {
      "error" : 0,
      "apikey" : config.wsApiKey
    };
    if(data.action == 'register') {
      deviceid = data.deviceid;
      const topic =  `sonoff/${deviceid}/action/#`
      console.log('subscribe messages from ', topic)
      client.subscribe(topic, {qos: 2});
    }
    if(data.action == 'date') {
      response.date = new Date().toISOString();
    }
    if(data.action == 'query') {
      response.params = 0;
    }
    if(data.action == 'update') {
      if(data.params.switches && className == 'HEATER') {
        const state = JSON.stringify(data.params.switches.map(function (s) { return s["switch"] == "on" ? 1 : 0;}));
        console.log("state is : ", state);
        // JS lacks of pattern matching.
        switch (state) {
          case "[0,0,0,0]":
          client.publish(`sonoff/${data.deviceid}/state`, "CONFORT")
          break;
          case "[1,0,0,0]":
          client.publish(`sonoff/${data.deviceid}/state`, "OFF")
          break;
          case "[0,1,0,0]":
          client.publish(`sonoff/${data.deviceid}/state`, "HORS_GEL")
          break;
          case "[1,1,0,0]":
          client.publish(`sonoff/${data.deviceid}/state`, "ECO")
          break;
          default:

        }
      } else {
        Object.keys(data.params).forEach(function(sensor) {
          client.publish(`sonoff/${data.deviceid}/${sensor}`, JSON.stringify(data.params[sensor]))
        });
      }
    }

    response.deviceid = deviceid;

    const jsonResponse = JSON.stringify(response)
    console.log('RES | WS | ', jsonResponse)
    ws.send(jsonResponse);
  });

  client.on('message', function (topic, message) {
    var response = {
      "error" : 0,
      "deviceid": deviceid,
      "apikey" : config.wsApiKey
    };

    if(/class$/.exec(topic)) {
      className = JSON.parse(message);
    }


    if(/switches$/.exec(topic)) {
      response.action = "update";
      response.userAgent = "app";
      // this is a string, sonoff parser is picky about this.
      response.sequence = "" + new Date().getTime();
      response.ts = 0;
      response.params = {};
      response.params.switches = [];
      var switches = JSON.parse(message);
      if(Array.isArray(switches)) {
        switches.forEach(function (switchObj) {
          // again, outlet is an int, sonoff parser is picky about it.
          response.params.switches.push({switch:switchObj["switch"], outlet:parseInt(switchObj["outlet"]) });
        });
      } else {
        className = 'HEATER';
        switch (switches) {
          case 'CONFORT':
          response.params.switches.push({switch:"off", outlet:0 });
          response.params.switches.push({switch:"off", outlet:1 });
          break;
          case 'ECO':
          response.params.switches.push({switch:"on", outlet:0 });
          response.params.switches.push({switch:"on", outlet:1 });
          break;
          case 'HORS_GEL':
          response.params.switches.push({switch:"off", outlet:0 });
          response.params.switches.push({switch:"on", outlet:1 });
          break;
          case 'OFF':
          response.params.switches.push({switch:"on", outlet:0 });
          response.params.switches.push({switch:"off", outlet:1 });
          break;
          default:

        }
        client.publish(`sonoff/${deviceid}/state`, switches)
      }
      response.params.from = "app";



      const m = JSON.stringify(response)
      console.log('executing order on switches, ',m);
      ws.send(m);
    }
  });

});







https.createServer({
  key: fs.readFileSync('ssl/key.pem'),
  cert: fs.readFileSync('ssl/cert.pem')
}, appWs).listen(PORT+1);
