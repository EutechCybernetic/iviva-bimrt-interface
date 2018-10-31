const iviva = require('ivivacloud-node'),
	HashMap = require('hashmap');

//const BIMRTInterface = require('../../bimrt-interface');
const BIMRTInterface = require('ivivacloud-bimrtinterface');

var _PointList = new HashMap();

const config = require("./iviva-settings.json")

const interface = new BIMRTInterface(config.InterfaceID,
	config.host,
         config.apiKey,
         config.whiteIPs,
	     );

interface.on('ready', (parameters) => { // interface parameters 
	_AccountURL = parameters.AccountURL;
	_apiKey = parameters.apiKey;
	account = new iviva.Account(_AccountURL, _apiKey);
});

interface.on('subscribe', (address, addressDetails, callback) => {
	if (!_PointList.has(address)) {
		let _p = {
			address: address,
			last_value: '',
			equipment_id: addressDetails.equipment_id,
			point_name: addressDetails.point_name
		};
		_PointList.set(address, _p);
		callback(null, 'success');
	}
	callback(null, 'success');
});

interface.on('setdata', (address, argument, callback) => {
	var account = new iviva.Account(_AccountURL, _apiKey);
	if (_PointList.has(address)) {
		let x = address.split(',');
		account.executeService('IBMS.Orphans:ExternalSetPointValue', {
			'AssetID': x[0],
			'PointName': x[1],
			'NewPointValue': argument
		}, (err, data) => {
			if (data) {
				let json_data = JSON.parse(data);
				if (json_data[0].Success === '1') {
					let _p = _PointList.get(address);
					_p.last_value = argument;
					callback(null, 'success');
				}
			}
			if (err) {
				console.error('err ', err)
			}
		});
	} else {
		callback('point address is not in the list', null);
	}
});

interface.on('demandpoll', (demandPoints) => {
	var account = new iviva.Account(_AccountURL, _apiKey);
	for (let i = 0; i < demandPoints.length; i++) {
		if (_PointList.has(demandPoints[i])) {
			let _p = _PointList.get(demandPoints[i]);
			let _q = _p.equipment_id + ' ' + _p.point_name;

			account.executeLucyAction('IBMS.AllPoints', {
				'q': _q,
				'fields': 'ObjectID,PointLastValue'
			}, (err, data) => {
				if (data) {
					let json_data = JSON.parse(data);
					if (data !== '[]')
						_p.last_value = json_data[0].PointLastValue;
					else
						_p.last_value = '';
					_PointList.set(demandPoints[i], _p);
					interface.updateValue(_p.address, _p.last_value, (err, data) => {
						if (err) {
							console.error('err ,', err);
						}
						if (data) {
							console.log('data ,', data);
						}
					});
				}
				if (err) {
					console.error('err ,', err);
				}
			});
		}
	}
});