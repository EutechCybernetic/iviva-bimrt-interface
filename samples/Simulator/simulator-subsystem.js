const devicePoint = require('./simulator-device-point');
const HashMap = require('hashmap');
var pointList = new HashMap();

const BIMRTInterface = require('../../bimrt-interface');
//const BIMRTInterface = require('ivivacloud-bimrtinterface');

const config = require("./iviva-settings.json")

const interface = new BIMRTInterface(config.InterfaceID,
	config.host,
         config.apiKey,
		 config.whiteIPs,
		 config.webServer,
		 config.webServerPort
	     );
var logger = new BIMRTInterface.BIMRTInterfaceLogger();

var addressList = [];
const self = this;

interface.on('subscribe', (address, addressDetails, callback) => {
	let addressSplit = address.split(',');
	if ((addressSplit[2] === '') || (addressSplit[3] === '') || (addressSplit[4] === '') || (addressSplit[4].toUpperCase === 'Y'.toUpperCase() && addressSplit[5] === '')) {
		callback('Incorrect Point Address', null);
	} else {
		if (!pointList.has(address)) {
			let dp = new devicePoint.DevicePoint(address);
			dp.init();
			dp.on('DevicePoint.OnValueChange', function (p) {
				interface.updateValue(p._address, p.pointValue, (err, data) => {});
			});
			let item = new devicePoint.ItemInfo(dp, null);
			pointList.set(address, item);
			addressList.push(addressDetails);
		} else {
			let item = pointList.get(address);
			item._Value = "";
			pointList.set(address, item);
		}
		callback(null, '');
	}
});

interface.on('setdata', (address, newValue, callback) => {
	self.setValue(address, newValue);
	callback(null, 'success');
});

interface.on('demandpoll', (demandPoints) => {
	for (let i = 0, l = demandPoints.length; i < l; i++) {
		if (pointList.has(demandPoints[i])) {
			let itemX = pointList.get(demandPoints[i]);
			itemX._DevicePoint.fireCOV(itemX._Value);
		}
	}
});

this.setValue = (address, newValue) => {
	let itemX = pointList.get(address);
	itemX._DevicePoint.setData(newValue, Date.now);
}