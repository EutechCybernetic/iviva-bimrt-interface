//const BIMRTInterface = require('../../bimrt-interface');
const BIMRTInterface = require('ivivacloud-bimrtinterface');

const _ = require('lodash'), fs = require('fs');

const config = require("./iviva-settings.json");

const interface = new BIMRTInterface(config.InterfaceID,
	config.host,
	config.apiKey,
	config.whiteIPs,
	config.webServer,
	config.webServerPort
);
var logger = new BIMRTInterface.BIMRTInterfaceLogger();

var address_list = [];
const self = this;

interface.on('subscribe', (address, addressDetails, callback) => {
	let addressSplit = address.split(',');
	if ((addressSplit[0] === '') || (addressSplit[1] === '')) {
		callback('Incorrect Point Address', null);
	} else {

		if (!_.some(address_list, {
				address: address
			})) {
			address_info = {
				address: address,
				equipment_id: address.split(',')[0],
				point_name: address.split(',')[1],
				file : address.split(',')[0]+'.json'
			};
			address_list.push(address_info);
		} else {
			logger.info('point already exits!!!');
		}
		callback(null, '');
	}
});

interface.on('setdata', (address, newValue, callback) => {
	//self.setValue(address, newValue);
	if (_.some(address_list, {
			address: address
		})) {
		let address_info = _.find(address_list, {
			address: address
		});

		var obj = JSON.parse(fs.readFileSync(address_info.file, 'utf8'));
		obj[address_info.point_name] = newValue;

		fs.writeFile(address_info.file, JSON.stringify(obj) , function(err) {
			if(err) {
				callback('file not found', null);
			}
			console.log("The file was saved!");
			callback(null, 'success');
		});
	}

	
	
});

interface.on('demandpoll', (demandPoints) => {
	for (let i = 0, l = demandPoints.length; i < l; i++) {
		if (_.some(address_list, {
				address: demandPoints[i]
			})) {
			let address_info = _.find(address_list, {
				address: demandPoints[i]
			});
			var obj = JSON.parse(fs.readFileSync(address_info.file, 'utf8'));
			console.log('obj', obj);
			interface.updateValue(address_info.address, obj[address_info.point_name]);
			
		}
	}
});