var express = require('express'),
https = require('https'),
fs = require('fs');
var rp = require('request-promise');
var WebSocket = require("ws");
var bodyParser = require('body-parser');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));


var PORT = process.env.PORT || 443;
var HOST = process.env.HOST || '';

const WS_PORT = 40079;


var options = {
  key  : fs.readFileSync('ssl/key.pem'),
  ca   : fs.readFileSync('ssl/csr.pem'),
  cert : fs.readFileSync('ssl/cert.pem')
}





const server = https.createServer(options);



const wss = new WebSocket.Server({ server });

var sonoffResponse = {};
var wsMitm = {};


server.listen(WS_PORT, function listening () {
  //
  // If the `rejectUnauthorized` option is not `false`, the server certificate
  // is verified against a list of well-known CAs. An 'error' event is emitted
  // if verification fails.
  //
  // The certificate used in this example is self-signed so `rejectUnauthorized`
  // is set to `false`.
  //


  var app = express();
  app.use(bodyParser.json());
  app.use(function (req, res, next) {
    console.log(req.path, req.method, req.body);
    next();
  });

  app.post('/dispatch/device', function(req, res) {
    console.log(req.body);
    rp({
      method: 'POST',
      rejectUnauthorized: false,
      uri:"https://eu-disp.coolkit.cc/dispatch/device",
      body: JSON.stringify( req.body)
    }).then(
      function(body) {
        sonoffResponse = JSON.parse(body);
        console.log("sonoff response:", sonoffResponse);
        var response = {
          "error":  0,
          "reason": "ok",
          "IP":     "192.168.254.17",
          "port":   server.address().port
        };
        wsMitm = new WebSocket(`wss://${sonoffResponse.IP}:${sonoffResponse.port}/api/ws`, {
         rejectUnauthorized: false
       });

       wsMitm.on('open', function open () {
         console.log("sonoff connection is open");
         console.log("reply", response);
         res.json(response);
       });

       wsMitm.on('error', function error(error) {
         console.error(error);
       });




      }
    )



  });


  https.createServer({
    key: fs.readFileSync('ssl/key.pem'),
    cert: fs.readFileSync('ssl/cert.pem')
  }, app).listen(PORT);








});

wss.on('connection', function connection (ws) {

      console.log(`connecting to sonoff ws wss://${sonoffResponse.IP}:${sonoffResponse.port}`)



      wsMitm.on('message', function message (msg) {
        console.log("sonoff replied: ", msg);
        ws.send(msg);
      });




  ws.on('message', function message (msg) {
    var data = JSON.parse(msg);
    console.log('REQ | WS | DEV | %s', JSON.stringify(data));
    wsMitm.send(msg);

  });
});
