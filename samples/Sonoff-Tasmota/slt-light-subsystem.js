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

	let msg = JSON.parse(message);

	_.chain(point_list).find({
		address_key: msg.pk
	}).set('last_value', msg.v).value();

	let _p = _.find(point_list,{
		address_key: msg.pk
	});

	updateInterface(_p.address);

	// let topicSplit = topic.split('/');
	// if (topicSplit.length > 0 && topicSplit[0] === 'stat') {
	// 	let address = topicSplit[1] + ';' + topicSplit[2];
	// 	logger.info('message:', message);
	// 	if (!_.some(point_list, {
	// 			address: address
	// 		})) {
	// 		let _p = {
	// 			address: address,
	// 			topic: address.split(';')[0],
	// 			command: address.split(';')[1],
	// 			last_value: ''
	// 		};
	// 		point_list.push(_p);
	// 	}

	// 	_.chain(point_list).find({
	// 		address: address.toString()
	// 	}).set('last_value', message.toString()).value();

	// 	updateInterface(address);
	// }
};

interface.on('ready', (parameters) => {
	let broker;
	parameters.hasOwnProperty('broker_ip') ? broker = parameters.broker_ip : broker = 'http://127.0.0.1';
	logger.info('mqtt broker:' + broker);

	client = mqtt.connect(broker);
	logger.info('mqtt connected to broker:' + broker);

	client.clientId = config.InterfaceID;

	client.subscribe(config.InterfaceID);
	logger.info(`mqtt subscribed to ${config.InterfaceID} topics`);

	client.on('message', (topic, message) => {
		logger.info('#### message from MQTT broker ####');
		let msg  = message.toString();
		messageReceived(topic, msg);
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
				topic: address.split(';')[0]+'/set',
				reply_topic  : address.split(';')[0],
				last_value: '',
				address_key : addressDetails.address_key ,
				point_name : address.split(';')[1],
			};
			point_list.push(_p);

			let msg = {
				"rt": config.InterfaceID,
				"a": "get",
				"pk": _p.address_key,
				"pn": _p.point_name
			   }
			client.publish(_p.topic, JSON.stringify(msg));

			//logger.info('point_list,', point_list);
		}
		callback(null, '');
	}
});

interface.on('demandpoll', (addresses) => {
	_.uniqBy(addresses).forEach((address) => {

		let point = _.find(point_list, {
			address: address
		});

		let msg = {
			"rt": config.InterfaceID,
			"a": "get",
			"pk": point.address_key,
			"pn": point.point_name
		   }

		client.publish(point.topic, JSON.stringify(msg));
		//updateInterface(address);
	});
});

interface.on('setdata', (address, newValue, callback) => {
	let point = _.find(point_list, {
		address: address
	});

	let msg = {
		"rt": config.InterfaceID,
		"a": "set",
		"pk": point.address_key,
		"pn": point.point_name,
		"nv" : newValue
	   }

	client.publish(point.topic, JSON.stringify(msg));
	callback(null, 'success');
});