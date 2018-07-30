const util = require("util"),
    EventEmitter = require('events'),
    config = require("config"),
    iviva = require('./ivivacloud');

function BIMRTInterfaceLogger() {
    /*{ error: 0, warn: 1, info: 2, verbose: 3, debug: 4, silly: 5 } */
    const winston = require('winston');
    const {
        createLogger,
        format,
        transports
    } = require('winston');
    const {
        combine,
        timestamp,
        label,
        printf
    } = format;

    const tsFormat = () => (new Date()).toLocaleTimeString();

    const myFormat = printf(info => {
        let tsFormatted = tsFormat();
        return `${tsFormatted} ` + ` ${info.level}: ${info.message}`;
    });

    const logger = winston.createLogger({
        level: 'debug',
        format: combine(
            timestamp(),
            winston.format.colorize(),
            myFormat
        ),
        transports: [
            new winston.transports.File({
                filename: 'bimrt-interface-error.log',
                level: 'error'
            }),
            new winston.transports.Console({
                level: 'debug'
            })
        ]
    });

    return logger;
}

function BIMRTInterface() {
    const self = this;
    EventEmitter.call(this);

    var logger = new BIMRTInterfaceLogger();

    const host = config.get("host"),
        apiKey = config.get("apiKey"),
        whiteIPs = config.get("whiteIPs"),
        interfaceID = config.get("InterfaceID");
    logger.info('Interface ' + interfaceID + ' started...');
    const account = new iviva.Account(host, apiKey);

    const mb = new iviva.MessageBus(account);

    var MESSAGE_BUS_CHECK_INTERVAL = 5; // in minutes

    const _ = require('lodash'),
        async = require('async');

    var addressList = [],
        dataRequestList = [],
        demandPointsX = [],
        responseDelay = 0;

    this.parameters = {};
    var messageBusStatusUpdatedTime = new Date();

    account.executeService('BIMRTConfig.InterfaceDriverSetting:AllEx', {
        'InterfaceID': interfaceID
    }, (err, data) => {
        if (data) {
            let interfaceSettings = JSON.parse(data);
            let res = _.find(interfaceSettings, {
                ParameterName: 'ResponseDelay'
            }) || {
                ParameterValue: 0
            };
            responseDelay = res.ParameterValue;
            if (interfaceSettings) {
                logger.info('InterfaceDriverSetting data: ' + data);
                interfaceSettings.forEach((val) => {
                    self.parameters[val.ParameterName] = val.ParameterValue;
                });

                self.emit('ready', self.parameters);
                messageBusInit();
            } else {
                logger.error('InterfaceDriverSetting NO data received ');
            }
        }
        if (err) {
            logger.error('account.executeService ,BIMRTConfig.InterfaceDriverSetting:AllEx ,err: ', err);
        }

    });

    const _sendMessageBusWatchDogRequest = setInterval(() => {
        account.executeService('BIMRTConfig.Interface:WatchDog', {
            'InterfaceID': interfaceID,
            'LifeExtend': 30000
        }, (err, data) => {
            if (data) {
                setTimeout(() => {
                    if (messageBusStatusUpdatedTime < Date.now()) {
                        logger.warn('Message Bus is down/not connected');
                        messageBusInit();
                    }
                }, 1000); // wait for one second
            }
            if (err) {
                logger.error('account.executeService ,BIMRTConfig.Interface:WatchDog ,err: ', err);
            }
        });
    }, 1000 * 60 * MESSAGE_BUS_CHECK_INTERVAL);

    const windowsServiceStatusUpdate = setInterval(() => {
        account.executeService('BIMRTConfig.Interface:UpdateWindowsServiceStatus', {
            'IsLive': '1',
            'InterfaceID': interfaceID
        }, (err, data) => {
            if (err) {
                logger.error('account.executeService ,BIMRTConfig.Interface:UpdateWindowsServiceStatus ,err : ' + err);
            }
            if (data) {
                logger.info('account.executeService ,BIMRTConfig.Interface:UpdateWindowsServiceStatus ,data : ' + data)
            }
        });
    }, 600000); // 10 min

    const processOnDemandPointList = setInterval(() => {
        let demandPointsX2 = demandPointsX;
        demandPointsX = [];
        let demandPointAddressesX = _.uniq(demandPointsX2.map((eKey) => {
            return _.find(addressList, {
                address_key: eKey
            }).address;
        }));

        if (demandPointAddressesX.length > 0)
            this.emit('demandpoll', demandPointAddressesX);
    }, 100);

    const dataRequestTimer = setInterval(() => {
        let dataRequestList2 = dataRequestList;
        dataRequestList = [];
        dataRequestList2.forEach((dataRequestX) => {
            let pointListResponseX = [];
            let pointKeyListX = dataRequestX.data_request_points;

            let dataRequestAddressList = _.filter(addressList, (address) => {
                return _.includes(pointKeyListX, parseInt(address.address_key));
            });

            if (_.filter(dataRequestAddressList, {
                    data_ready: false
                }).length > 0) {
                _.filter(dataRequestAddressList, {
                    data_ready: false
                }).forEach((v, k) => {
                    logger.info('data not ready ' + JSON.stringify(v));
                });
                dataRequestList.push(dataRequestX);
            } else {
                logger.info('dataRequestTimerElapsed ,ready=true');

                dataRequestAddressList.forEach((infoX, key) => {
                    pointListResponseX.push({
                        'PointAddress': infoX.address,
                        'EquipmentPointKey': infoX.address_key,
                        'PointName': infoX.point_name,
                        'EquipmentKey': infoX.equipment_key,
                        'EquipmentID': infoX.equipment_id,
                        'LastValue': infoX.last_value
                    });
                });

                let dataResponseX = {
                    EquipmentKey: dataRequestX.equipment_key.toString(),
                    EquipmentID: dataRequestX.equipment_id,
                    Cargo: dataRequestX.cargo,
                    Data: JSON.stringify(pointListResponseX),
                    ModelName: dataRequestX.model_name,
                    ModelAction: dataRequestX.model_action,
                    Result: 'DataReady'
                };

                logger.info('********dataRequestTimerElapsed ,dataResponseX******** \n' + JSON.stringify(dataResponseX));

                account.executeService('BIMRTConfig.Equipment:DataRequestResponse', dataResponseX, (err, data) => {
                    let _preLogMessage = 'account.executeService ,BIMRTConfig.Equipment:DataRequestResponse ,';
                    if (err) {
                        logger.error(_preLogMessage + 'err: ' + err);
                    }
                    if (data) {
                        let _data = JSON.parse(data)[0];
                        _data.Result === 'Success' ? logger.info(_preLogMessage + 'data: ' + data) : logger.error(_preLogMessage + 'data: ' + data);
                    }

                });
            }
        });
    }, 100);

    const messageBusInit = () => {
        mb.init(function () {
            logger.info('Interface connected to ' + host);
            mb.subscribe(interfaceID, (channel, message) => {
                logger.verbose('********message bus received message******** \n' + message);
                try {
                    let msg = JSON.parse(message);
                    let action = msg.Action.toUpperCase();
                    switch (action) {
                        case 'DataRequest'.toUpperCase():
                            handleDataRequest(msg.Data, msg.DataValidity, msg.EquipmentKey, msg.EquipmentID, msg.Cargo, msg.ModelName, msg.ModelAction, msg.EquipmentTemplateID);
                            break;
                        case 'SetData'.toUpperCase():
                            handleSetDataRequest(msg.EquipmentKey, msg.EquipmentID, msg.EquipmentPointKey, msg.PointAddress, msg.PointName, msg.ReadWriteState, msg.NewValue, msg.ModelName, msg.ModelAction, msg.Cargo, msg.ResponseRequired);
                            break;
                        case 'MessageBusHealthCheck'.toUpperCase():
                            handleMessageBusHealthCheck(msg.LifeExtend);
                            break;
                        default:
                            logger.error('Message bus action received not compatible : ' + action);
                            break;
                    }
                } catch (error) {
                    logger.error('message bus subscribe error : ' + error);
                }
            });
            messageBusStatusUpdatedTime = new Date();
        });
    };

    const handleDataRequest = async (requestPointsData, dataValidity, equipmentKey, equipmentID, cargo, modelName, modelAction, equipmentTemplateID) => {
        logger.verbose('********handleDataRequest******** \n' + JSON.stringify(requestPointsData));

        async.forEach(requestPointsData, async (requestPoint) => {
            let equipmentPointKeyX = requestPoint.EquipmentPointKey.toString();
            let pointAddressX = requestPoint.PointAddress;
            let pointNameX = requestPoint.PointName;
            let readWriteStateX = requestPoint.ReadWriteState;

            let infoX;

            if (_.some(addressList, {
                    address_key: equipmentPointKeyX
                })) {
                infoX = _.find(addressList, {
                    address_key: equipmentPointKeyX
                });

                if (infoX.read_write_state !== readWriteStateX) {
                    _.merge(infoX, {
                        read_write_state: readWriteStateX
                    })
                    readWriteStateX === 'Write-only' ? _.merge(infoX, {
                        data_ready: true
                    }) : _.merge(infoX, {
                        data_ready: false
                    });
                }

                if (infoX.address !== pointAddressX) {
                    infoX = await subscribe(equipmentKey, equipmentID, pointAddressX, equipmentPointKeyX, pointNameX, readWriteStateX, equipmentTemplateID);
                }
            } else {
                infoX = await subscribe(equipmentKey, equipmentID, pointAddressX, equipmentPointKeyX, pointNameX, readWriteStateX, equipmentTemplateID);
            }

            if (infoX.read_write_state !== 'Write-only' && infoX.invalid_point_address === false) {
                let nowX = new Date();
                nowX = nowX.setSeconds(nowX.getSeconds() - dataValidity);
                if (infoX.last_value_dateTime < nowX) {
                    _.find(addressList, {
                        address_key: equipmentPointKeyX
                    }).data_ready = false;
                    demandPointsX.push(equipmentPointKeyX);
                }

            }
        }, (err) => {
            if (err) {
                logger.error('', err);
            }
            let drX = {
                cargo: cargo,
                model_name: modelName,
                model_action: modelAction,
                equipment_key: equipmentKey,
                equipment_id: equipmentID,
                data_request_points: _.map(requestPointsData, 'EquipmentPointKey')
            }
            dataRequestList.push(drX);
        });
    }

    const updateValueBulk = (data, value, callback) => {
        logger.verbose('bimrt-interface ,updateValueBulk ,data: ' + JSON.stringify(data) + ' ,value: ' + value);
        data.forEach((d) => {
            _.chain(addressList).find({
                address_key: d.address_key
            }).set('data_ready', true).set('last_value', value).set('last_value_dateTime', Date.now()).value();
        });
        callback(null, 'success');
    }

    const handleSetDataRequest = async (equipmentKey, equipmentID, equipmentPointKey, pointAddress, pointName, readWriteState, argument, modelName, modelAction, cargo, responseRequired) => {
        logger.verbose('********handleSetDataRequest******** \n pointAddress: ' + pointAddress + ' ,argument: ' + argument);
        let infoX = {};
        if (!_.some(addressList, {
                address_key: equipmentPointKey.toString()
            })) {
            infoX = await subscribe(equipmentKey, equipmentID, pointAddress, equipmentPointKey.toString(), pointName, readWriteState);
        } else {
            infoX = _.find(addressList, {
                address_key: equipmentPointKey.toString()
            });
        }

        if (argument !== '' && infoX.invalid_point_address === false) {
            self.emit('setdata', infoX.address, argument, (err, data) => {
                if (err === null) {
                    updateValueBulk(_.filter(addressList, {
                        address: infoX.address
                    }), argument, (err, data) => {});
                }
            });
        }

        if (responseRequired === '1') {
            logger.info('handleSetData ,responseRequired: ' + responseRequired + ' ,responseDelay: ' + responseDelay);
            let pointListX = _.map(_.filter(addressList, {
                equipment_id: infoX.equipment_id
            }), (val) => {
                return {
                    EquipmentPointKey: parseInt(val.address_key),
                    PointName: val.point_name,
                    PointAddress: val.address,
                    ReadWriteState: val.read_write_state
                };
            });
            handleDataRequest2(pointListX, infoX.equipment_key, infoX.equipment_id, cargo, modelName, modelAction);
        }
    };

    const handleDataRequest2 = (data, assetKey, asset, cargo, modelName, modelAction) => {
        setTimeout(() => {
            handleDataRequest(data, '0', assetKey, asset, cargo, modelName, modelAction);
        }, responseDelay);
    };

    const subscribe = (equipmentKey, equipmentID, address, addressKey, pointName, readWriteState, equipmentTemplateID) => {
        return new Promise((resolve, reject) => {
            let re = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
            let found = address.match(re);
            let infoX = {};
            if (!_.some(addressList, {
                    address_key: addressKey
                })) {
                infoX = {
                    address_key: addressKey
                };
                addressList.push(infoX);
            } else {
                infoX = _.find(addressList, {
                    address_key: addressKey
                });
            }

            _.merge(infoX, {
                address: address,
                read_write_state: readWriteState,
                equipment_template_id: equipmentTemplateID,
                equipment_id: equipmentID,
                point_name: pointName,
                equipment_key: equipmentKey,
                data_ready: false,
                invalid_point_address: true,
                last_value: '',
                last_value_dateTime: null
            });

            if (_.difference(found, whiteIPs).length > 0) {
                _.merge(infoX, {
                    data_ready: true,
                    invalid_point_address: true
                });
                resolve(infoX);
            } else {
                this.emit('subscribe', address, {
                    address_key: addressKey,
                    address: address,
                    point_name: pointName,
                    equipment_key: equipmentKey,
                    equipment_id: equipmentID,
                    read_write_state: readWriteState,
                    equipment_template_id: equipmentTemplateID
                }, (err, data) => {
                    if (err !== null) {
                        logger.error('subscribe failed ,address: ' + address + ' ,res: ' + err);
                        _.merge(infoX, {
                            data_ready: true,
                            invalid_point_address: true
                        });
                    } else {
                        logger.info('subscribe successful ,address: ' + address + ' ,res: ' + data);
                        _.merge(infoX, {
                            invalid_point_address: false
                        }); //infoX over-write in case if the same point re-subscription. e.g :- address change
                        readWriteState === 'Write-only' ? _.merge(infoX, {
                            data_ready: true,
                            last_value: ''
                        }) : _.merge(infoX, {
                            data_ready: false,
                            last_value: ''
                        });
                    }
                    resolve(infoX);
                });
            }
        });
    }

    const handleMessageBusHealthCheck = (LifeExtend) => {
        return new Promise((resolve, reject) => {
            let _time = new Date();
            _time.setMinutes(_time.getMinutes() + MESSAGE_BUS_CHECK_INTERVAL);
            messageBusStatusUpdatedTime = _time;
            resolve(true);
        });
    };

    this.updateValue = (address, value, callback) => {
        logger.verbose('bimrt-interface ,updateValue ,address: ' + address + ' ,value: ' + value);
        let data = _.filter(addressList, (a) => {
            return a.address === address && a.read_write_state != 'Write-only';
        });
        updateValueBulk(data, value, callback);
    };

    this.updateEquipmentStatus = (equipmentKey, status, callback) => {
        logger.verbose('bimrt-interface ,updateEquipmentStatus ,equipmentKey: ' + equipmentKey + ' ,status: ' + status);
        account.executeService('BIMRTConfig.Equipment:UpdateStatus', {
            'EquipmentKey': equipmentKey,
            'Status': status
        }, (err, data) => {
            if (err) {
                logger.error('bimrt-interface ,updateEquipmentStatus ,err: ' + JSON.stringify(err));
            }
            if (data) {
                logger.info('bimrt-interface ,updateEquipmentStatus ,data:' + JSON.stringify(data));
                callback(null, data)
            }
        });
    };
}
util.inherits(BIMRTInterface, EventEmitter);
module.exports = BIMRTInterface;
module.exports.BIMRTInterfaceLogger = BIMRTInterfaceLogger;