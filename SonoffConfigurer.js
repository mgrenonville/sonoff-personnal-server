var Wireless = require('wireless');
var request = require('request');
const Promise = require('promise');



function SonoffConfigurer() {
  if (!(this instanceof SonoffConfigurer))
  return new SonoffConfigurer();
}


SonoffConfigurer.prototype.init = function init(ip, port, config) {

  var self = this;
  return new Promise(function (resolve, reject){
    console.log('Starting configuration')

    self.wireless = new Wireless({
      iface: config.iface,
      updateFrequency: 100, // Optional, seconds to scan for networks
      connectionSpyFrequency: 10, // Optional, seconds to scan if connected
      vanishThreshold: 2 // Optional, how many scans before network considered gone
    });
    self.connected = false;

    console.log("[PROGRESS] Enabling wireless card...");

    self.wireless.enable(function(error) {
      if (error) {
        console.log("[ FAILURE] Unable to enable wireless card. Quitting...");
        reject(error);
        return;
      }

      console.log("[PROGRESS] Wireless card enabled.");
      console.log("[PROGRESS] Starting wireless scan...");

      self.wireless.start();
    });

    self.wireless.on('appear', function(network) {
      var ssid = network.ssid || '<HIDDEN>';
      if(ssid.startsWith(config.sonoffSSID)) {

        var quality = Math.floor(network.quality / 70 * 100);
        console.log('OK | Sonoff found in pairing mode.');

        var encryption_type = 'NONE';
        if (network.encryption_wep) {
          encryption_type = 'WEP';
        } else if (network.encryption_wpa && network.encryption_wpa2) {
          encryption_type = 'WPA&WPA2';
        } else if (network.encryption_wpa) {
          encryption_type = 'WPA';
        } else if (network.encryption_wpa2) {
          encryption_type = 'WPA2';
        }

        console.log("[  APPEAR] " + ssid + " [" + network.address + "] " + quality + "% " + network.strength + " dBm " + encryption_type);

        if (!self.connected) {
          self.connected = true;
          console.log('OK | try to connect to ', network);
          self.wireless.join(network, '12345678', function(err) {
            if (err) {
              console.log("[   ERROR] Unable to connect.");
              reject(err)
            }
          }
        );
      }
    } else {
      console.log('No Sonoff this time')
    }
  });
  self.wireless.on('join', function(network) {
    console.log("[    JOIN] " + network.ssid + " [" + network.address + "] ");
    request('http://10.10.7.1/device', function (error, response, body) {
      if(error) {
        reject(error);
        return;
      }
      console.log('error:', error); // Print the error if one occurred
      console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
      console.log('body:', body); // Print the HTML for the Google homepage.
      request({
        uri:'http://10.10.7.1/ap',
        method: 'POST',
        body: JSON.stringify({
          "version": 4,
          "ssid": config.ssid,
          "password": config.password,
          "serverName": ip,
          "port": port})
        }, function (error, response, body) {
          if(error) {
            reject(error);
            return;
          }
          console.log('error:', error); // Print the error if one occurred
          console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
          console.log('body:', body); // Print the HTML for the Google homepage.
          resolve(body);
        })
      });
    })
  }).then(function () {
    console.log("stopping wireless");
    self.wireless.stop();
  } );;


}







var exports = module.exports = SonoffConfigurer;
