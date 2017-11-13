
var mqtt = require('mqtt');

var SonoffDevice = class SonoffDevice {

  constructor(ws, options) {
    this.options = options || {};
    this.client  = mqtt.connect('mqtt://localhost');
    this.deviceid = '';
    this.className = '';
    this.ping = 0;
    this.ws = ws;
    const self = this;
    self.ws.on('message', function message (msg) {
      return self.onSonoffRequest(msg)
    });

    self.client.on('message', function (topic, message) {
      return self.onMQTTRequest(topic,message)
    });

    ws.on("ping", function() {
      self.ping = new Date().getTime();
      console.log("%s ping", self.deviceid);
    })

    ws.on("pong", function() {
      console.log("%s pong", self.deviceid);
    })

  }
  onMQTTRequest(topic, message) {
    var self = this;
    var response = {
      "error" : 0,
      "deviceid": self.deviceid,
      "lastPing":new Date().getTime() - self.ping,
      "apikey" : self.options.wsApiKey
    };

    if(/class$/.exec(topic)) {
      self.className = JSON.parse(message);
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
        self.className = 'HEATER';
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
          response.params.switches.push({switch:"on", outlet:0 });
          response.params.switches.push({switch:"off", outlet:1 });
          break;
          case 'OFF':
          response.params.switches.push({switch:"off", outlet:0 });
          response.params.switches.push({switch:"on", outlet:1 });
          break;
          default:

        }
        self.client.publish(`json/sonoff/${self.deviceid}`, JSON.stringify(response.params))
      }
      response.params.from = "app";



      const m = JSON.stringify(response)
      console.log('executing order on switches, ',m);
      self.ws.send(m);
    }
  }

  onSonoffRequest(msg) {
    var self = this;
    var data = JSON.parse(msg);
    console.log('REQ | WS | DEV | %s', JSON.stringify(data));
    var response = {
      "error" : 0,
      "apikey" : self.options.wsApiKey
    };
    if(data.action == 'register') {
      self.deviceid = data.deviceid;
      const topic =  `sonoff/${self.deviceid}/action/#`
      console.log('subscribe messages from ', topic)
      self.client.subscribe(topic, {qos: 2});
    }
    if(data.action == 'date') {
      response.date = new Date().toISOString();
    }
    if(data.action == 'query') {
      response.params = 0;
    }
    if(data.action == 'update') {
      if(data.params.switches && self.className == 'HEATER') {
        const state = JSON.stringify(data.params.switches.map(function (s) { return s["switch"] == "on" ? 1 : 0;}));
        console.log("state is : ", state);
        // JS lacks of pattern matching.
        data.params.state = "";
        switch (state) {
          case "[0,0,0,0]":
          self.client.publish(`sonoff/${data.deviceid}/state`, "CONFORT")
          data.params.state = "CONFORT";
          break;
          case "[0,1,0,0]":
          self.client.publish(`sonoff/${data.deviceid}/state`, "OFF")
          data.params.state = "OFF";
          break;
          case "[1,0,0,0]":
          self.client.publish(`sonoff/${data.deviceid}/state`, "HORS_GEL")
          data.params.state = "HORS_GEL";
          break;
          case "[1,1,0,0]":
          self.client.publish(`sonoff/${data.deviceid}/state`, "ECO")
          data.params.state = "ECO";
          break;
          default:

        }
      } else {
        Object.keys(data.params).forEach(function(sensor) {
          self.client.publish(`sonoff/${data.deviceid}/${sensor}`, JSON.stringify(data.params[sensor]));
        });
        self.client.publish(`sonoff/${data.deviceid}/state`, JSON.stringify(data.params));
      }
      self.client.publish(`json/sonoff/${data.deviceid}/state`, JSON.stringify(data.params));
    }

    response.deviceid = self.deviceid;

    const jsonResponse = JSON.stringify(response)
    console.log('RES | WS | ', jsonResponse)
    self.ws.send(jsonResponse);

  }

  close() {
    var self = this;
    self.client.unsubscribe(`sonoff/${self.deviceid}/action/#`)
    console.log("Bye ", self.deviceid)
  }
}



var exports = module.exports = SonoffDevice;
