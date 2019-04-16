const BIMRTInterface = require('ivivacloud-bimrtinterface');
const mqtt = require('mqtt');
const config = require("./iviva-settings.json")
const _ = require('lodash');

const interface = new BIMRTInterface(config.InterfaceID,
	config.host,
         config.apiKey,
		 config.whiteIPs,
		 config.webServer,
		 config.webServerPort
	     );
var logger = new BIMRTInterface.BIMRTInterfaceLogger();

var point_list = [];

var client;

var updateInterface = (address) => {
	let point = _.find(point_list, {
		address: address
	});
	if (point !== undefined) {
		logger.info('last_value', point.last_value);
		interface.updateValue(point.address, point.last_value, (err, data) => {
			if (err) logger.error('err ', err);
		});
	}
};

var messageReceived = (topic, message) => {
	logger.info('message received ,topic:' + topic + ' ,message:' + message);
	let topicSplit = topic.split('/');
	if (topicSplit.length > 0 && topicSplit[0] === 'stat') {
		let address = topicSplit[1] + ';' + topicSplit[2];
		logger.info('message:', message);
		if (!_.some(point_list, {
				address: address
			})) {
			let _p = {
				address: address,
				topic: address.split(';')[0],
				command: address.split(';')[1],
				last_value: ''
			};
			point_list.push(_p);
		}

		_.chain(point_list).find({
			address: address.toString()
		}).set('last_value', message.toString()).value();

		updateInterface(address);
	}
};

interface.on('ready', (parameters) => {
	let broker;
	parameters.hasOwnProperty('broker_ip') ? broker = parameters.broker_ip : broker = 'http://127.0.0.1';
	logger.info('mqtt broker:' + broker);

	client = mqtt.connect(broker);
	logger.info('mqtt connected to broker:' + broker);

	client.clientId = config.InterfaceID;

	client.subscribe('#');
	logger.info('mqtt subscribed to # topics');

	client.on('message', (topic, message) => {
		logger.info('#### message from MQTT broker ####');
		messageReceived(topic, message);
	});
});

interface.on('subscribe', (address, addressDetails, callback) => {
	if ((address.split(';')[0] == '') || (address.split(';')[1] == '')) {
		callback('Incorrect Point Address', null);
	} else {
		if (!_.some(point_list, {
				address: address.toString()
			})) {
			let _p = {
				address: address.toString(),
				topic: 'cmnd/' + address.split(';')[0] + '/' + address.split(';')[1],
				last_value: ''
			};
			point_list.push(_p);
			client.publish(_p.topic, '');
			logger.info('point_list,', point_list);
		}
		callback(null, '');
	}
});

interface.on('demandpoll', (addresses) => {
	_.uniqBy(addresses).forEach((address) => {
		updateInterface(address);
	});
});

interface.on('setdata', (address, newValue, callback) => {
	let point = _.find(point_list, {
		address: address
	});
	client.publish(point.topic, newValue);
	callback(null, 'success');
});