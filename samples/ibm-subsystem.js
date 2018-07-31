const config = require("config"),
    BIMRTInterface = require('./../src/bimrt-interface'),
    request = require('request'),
    _ = require('lodash');

var _PointList = [];
const interface = new BIMRTInterface();

var _username, _password, _url;

interface.on('ready', (parameters) => { // interface parameters 
    _username = parameters.username;
    _password = parameters.password;
    _url = parameters.url + '/thpoe_store/_find';
});

interface.on('subscribe', (address, addressDetails, callback) => { // add point details to internal list
    if (!_.some(_PointList, {
            'address': address
        })) {
        let _p = {
            address: address,
            last_value: '',
            equipment_id: addressDetails.equipment_id,
            point_name: addressDetails.point_name
        };
        _PointList.push(_p);
        callback(null, 'success');
    }
    callback(null, 'success');
});

interface.on('setdata', (address, argument, callback) => { // not yet implemented
    if (_.some(_PointList, {
            'address': address
        })) {
        // not yet implemented
        callback('setdata not implemented', null);
    } else {
        callback('point address is not in the list', null);
    }
});

interface.on('demandpoll', (demandPoints) => {
    _.uniqBy(demandPoints, (_pa) => { // get unique device id
        return _pa.split(',')[0];
    }).forEach((_pa) => { // get update from each device
        updateValues(_pa.split(',')[0]);
    });
});

const updateValues = (deviceId) => {
    let _body = {
        "selector": {
            "_id": {
                "$gt": "0"
            },
            "d.addonIds.deviceId": deviceId
        },
        "sort": [{
            "_id": "desc" // descending order
        }],
        "limit": 1 // limit by 1 , so the latest one will be in the result
    }

    let options = {
        url: _url,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        auth: {
            'user': _username,
            'pass': _password,
            'sendImmediately': false
        },
        body: JSON.stringify(_body)
    };
    console.log('going to request');
    request(options, function (err, res, body) {
        console.log('got it');
        let _states = JSON.parse(body).docs[0].d.states;

        _.keys(_states).forEach((_point) => {
            let _pa = deviceId + ',' + _point
            if (_.some(_PointList, {
                    'address': _pa
                })) { // if point address exists in subscription list
                let _value = _states[_point].value.toString()
                _.chain(_PointList).find({
                    'address': _pa
                }).set('last_value', _value).value();
                interface.updateValue(_pa, _value, (err, data) => {
                    if(err) console.log('err ' , err);
                }); // pass the latest value to interface
            }
        }); // point names in to list
    });
}