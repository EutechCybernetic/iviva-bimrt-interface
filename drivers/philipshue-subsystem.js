const BIMRTInterface = require('./../src/bimrt-interface');
const interface = new BIMRTInterface;
var logger = new BIMRTInterface.BIMRTInterfaceLogger();
const hue = require("node-hue-api"),
  HueApi = hue.HueApi,
  lightState = hue.lightState;

var _PointList = [],
  api;

interface.on('ready', (parameters) => {
  let host, username;
  parameters.hasOwnProperty('host') ? host = parameters.host : logger.error('parameter host is not configured');
  parameters.hasOwnProperty('username') ? username = parameters.username : logger.error('parameter username is not configured');

  logger.info('philips hue host ' + host);
  logger.info('philips hue username ' + username);

  api = new HueApi(host, username);
  api.config(function (err, config) {
    if (err) logger.error('Not connected to philips hue bridge ,err ' + err);
    else logger.info('connected to philips hue bridge ,config ' + JSON.stringify(config));
  });
});

interface.on('subscribe', (address, addressDetails, callback) => {
  let addressList = address.split(';');
  if ((addressList[0] == '') || addressList[1] == '') {
    callback('Incorrect Point Address', null);
  } else {
    if (!_PointList.some(x => x.address === address)) {
      _PointList.push({
        address: address,
        last_value: ''
      });
    } else {
      _PointList.find(x => x.address === address).last_value = '';
    }
    callback(null, '');
  }
});

interface.on('setdata', (address, argument, callback) => {
  let addressSplit = address.split(';');
  let idX = addressSplit[0],
    commandX = addressSplit[1];

  if (commandX === 'on') {
    let stateX;
    argument === 'true' ? stateX = lightState.create().on() : stateX = lightState.create().off();
    api.setLightState(idX, stateX)
      .then((result) => {
        callback(null, result);
      })
      .done();
  } else if (commandX === 'bri') {
    let stateX = lightState.create().on().bri(argument);
    api.setLightState(idX, stateX)
      .then((result) => {
        callback(null, result);
      })
      .done();
  } else if (commandX === 'col') {
    let argumentSplit = argument.toString().split('/');
    let hueX = argumentSplit[0].split(';')[1],
      satX = argumentSplit[1].split(';')[1];
    let stateX = lightState.create().on().hue(hueX).sat(satX);

    api.setLightState(idX, stateX)
      .then((result) => {
        callback(null, result);
      })
      .done();
  }
  callback(null, 'success');
});

interface.on('demandpoll', (demandPoints) => {
  logger.verbose('---- philipshue-subsystem , demandpoll ----');
  let lightListX = [];
  for (let i = 0, l = demandPoints.length; i < l; i++) {
    if (_PointList.some(x => x.address === demandPoints[i])) {
      let lightIDX = demandPoints[i].split(';')[0];
      if (lightListX.indexOf(lightIDX) <= -1)
        lightListX.push(lightIDX);
    }
  }

  for (var i = 0, l = lightListX.length; i < l; i++) {
    this.updateLightValues(lightListX[i]);
  }
});

this.updateLightValues = function (id) {
  api.lightStatusWithRGB(id, function (err, result) {
    if (err) throw err;
    _PointList.forEach((point, key) => {
      let addressSplit = point.address.split(';');
      let lightID = addressSplit[0],
        command = addressSplit[1];
      if (lightID === id) {
        if (command === 'on') {
          point.last_value = result.state.on.toString();
          interface.updateValue(point.address, point.last_value, (err, data) => {});
        }
        if (command === 'bri') {
          point.last_value = result.state.bri.toString();
          interface.updateValue(point.address, point.last_value, (err, data) => {});
        }
        if (command === 'col') {
          point.last_value = "";
          interface.updateValue(point.address, point.last_value, (err, data) => {});
        }
      }
    });
  });
}