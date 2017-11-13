const os = require('os');
const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
var ws = require("nodejs-websocket");

var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

var options = {
    key  : fs.readFileSync('ssl/key.pem'),
    ca   : fs.readFileSync('ssl/csr.pem'),
    cert : fs.readFileSync('ssl/cert.pem')
}
    var server = ws.createServer(options,function (conn) {
        console.log("WS | Server is up %s:%s to %s:%s",ip,port,conn.socket.remoteAddress,conn.socket.remotePort);
        conn.on("text", function (str) {
            var data = JSON.parse(str);
            console.log('REQ | WS | DEV | %s', JSON.stringify(data));
            var res = {
                "error" : 0,
                "deviceid" : data.deviceid,
                "apikey" : config.apiKey
            };
            if(data.action) {
            switch(data.action){
                case 'date':
                    res.date = new Date().toISOString();
                break;
                case 'query':
    //device wants information
    var device = self._knownDevices.find(d=>d.id == data.deviceid);
     if(!device) {
      console.log('ERR | WS | Unknown device ',data.deviceid);
     } else {
      /*if(data.params.includes('timers')){
       console.log('INFO | WS | Device %s asks for timers',device.id);
       if(device.timers){
        res.params = [{timers : device.timers}];
       }
      }*/
      res.params = {};
      data.params.forEach(p=>{
       res.params[p] = device[p];
      });
     }
                break;
                case 'update':
     //device wants to update its state
     var device = self._knownDevices.find(d=>d.id == data.deviceid);
     if(!device) {
      console.log('ERR | WS | Unknown device ',data.deviceid);
     } else {
      device.state = data.params.switch;
      self._updateKnownDevice(self,device);
     }
                break;
                case 'register':
     var device = {
      id : data.deviceid
     };
     var type = data.deviceid.substr(0, 2);
     if(type == '01') device.kind = 'switch';
     else if(type == '02') device.kind = 'light';
     else if(type == '03') device.kind = 'sensor'; //temperature and humidity. No timers here;
     device.version = data.romVersion;
     device.model = data.model;
     self._updateKnownDevice(self,device);
     console.log('INFO | WS | Device %s registered', device.id);
                break;
                default: console.log('TODO | Unknown action "%s"',data.action); break;
            }
   } else {
    console.log('TODO | WS | Not data action frame');
   }
   var r = JSON.stringify(res);
   console.log('RES | WS | DEV | ' + r);
            conn.sendText(r);
   var td = self._knownDevices.find(d=>d.id == res.deviceid);
   self.emit('msg',{device : td});
        });
        conn.on("close", function (code, reason) {
            console.log("Connection closed");
        });
    }).listen(443);
