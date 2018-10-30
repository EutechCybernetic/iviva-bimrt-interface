const EventEmitter = require('events');
const util = require('util');
const BIMRTInterface = require('ivivacloud-bimrtinterface');
var logger = new BIMRTInterface.BIMRTInterfaceLogger();

function DevicePoint(address) {
    this._address = address;
    EventEmitter.call(this);

    this.pointName = "";
    this.pointValue = "";
    var NextValueSendingTime = new Date();
    NextValueSendingTime.setDate(NextValueSendingTime.getDate() + (-1));

    var simEnabled = false;
    var simType = "";
    var simPer = 0;
    var simRoundOff = 0;
    var simInterval = 0; //simulate interval in seconds
    this.simStartValue = 0;
    //for energy meter values
    var typeFlag = "";
    var simInt = 0; //simulate interval in seconds
    var addValue = 0;
    var addDuration = 0;

    //selva
    var vMin = 0;
    var vMax = 0;

    this.simulateTimer = function () {
        if (typeFlag == "INCREMENT") {
            val = 0;
            v = 0;
            if (addDuration == simInt) {
                val = addValue + simPer;
                v = Math.round(val, simRoundOff);
                addDuration = 0;
            } else {
                val = addValue;
                v = Math.round(val, simRoundOff);
                addDuration += 1;
            }
            this.setValue(v.toString(), Date.now());
            addValue = val;
        } else if (typeFlag == "DECREMENT") {
            val = 0;
            v = 0;
            if (addDuration == simInt) {
                val = addValue - simPer;
                v = Math.round(val, simRoundOff);
                addDuration = 0;
            } else {
                val = addValue;
                v = Math.round(val, simRoundOff);
                addDuration += 1;
            }
            this.setValue(v.toString(), Date.now());
            addValue = val;
        } else if (typeFlag.toUpperCase() == "BINARY".toUpperCase()) {
            v = Math.random() * (1 - 0) + 0;
            this.setValue(v.toString(), Date.now());
        } else {
            v = Math.random() * (vMax - vMin) + vMin;
            v = v.toFixed(simRoundOff);

            rand = Math.random() * 2.0 - 1.0;
            val = simStartValue + (simStartValue * rand * simPer);
            v = Math.round(val, simRoundOff);

            this.setValue(v.toString(), Date.now());
        }
    }

    this.init = function () {
        this.parseAddress();
        if (simEnabled) this.startStopSimulation(true);
    }

    this.startStopSimulation = function (enable) {
        if (enable) setInterval(() => this.simulateTimer(), simInterval * 1000);
    }

    this.setData = function (newValue, lastUpdatedTime) {
        dX = new Date();
        dX = dX.setSeconds(dX.getSeconds() + 5);
        NextValueSendingTime = dX;
        this.setValue(newValue, lastUpdatedTime);
    }

    this.setValue = function (newValue, lastUpdatedTime) {
        this.pointValue = newValue;
        now = new Date();
        if (NextValueSendingTime > now) NextValueSendingTime = now;
        this.emit('DevicePoint.OnValueChange', this);
    }

    this.fireCOV = function (lastValue) {
        logger.info("FireCOV : " + this._address);
        if (simEnabled) {
            nowX = new Date();
            nowX = nowX.setMilliseconds(nowX.getMilliseconds() + (simInterval * 2));

            NextValueSendingTime = nowX;
        }
        //send 
        if (this.pointValue != lastValue || lastValue == "") {
            this.emit('DevicePoint.OnValueChange', this);
        }
    }

    this.stopCOV = function () {
        if (simEnabled) this.startStopSimulation(false);
    }

    this.parseAddress = function () {
        let param = this._address.split(',');
        if (param.length >= 5) {
            deviceType = param[0];
            // if (param[2] == "BV") pointType = "Binary Value";
            // if (param[2] == "AV") pointType = "Analog Value";
            // if (param[2] == "TV") pointType = "Text Value";
            this.pointValue = param[3];
            if (param.length >= 5 && param[4].toUpperCase() == "Y".toUpperCase()) {
                if (param[5] == "") return;
                //Simulation enabled
                simParams = param[5].split(':');
                if (simParams.length >= 3) {
                    simType = simParams[0];
                    if (simType == "%") {
                        simEnabled = true;
                        simPer = parseFloat(simParams[1]) / 100;
                        simRoundOff = parseInt(simParams[2]);
                        if (simRoundOff > 15) simRoundOff = 15;
                        simStartValue = parseFloat(this.pointValue);
                        if (simParams.length == 4) {
                            simInterval = parseInt(simParams[3]);
                        }
                    }
                }
            }
            if (param.length > 5 && param[4].toUpperCase() == "I".toUpperCase()) {
                if (param[5] == "") return;
                //Simulation enabled
                simParams = param[5].split(':');
                if (simParams.length >= 3) {
                    tmrSimulate.Interval = 1000;
                    simType = simParams[0];
                    if (simType == "+") {
                        simEnabled = true;
                        simPer = parseFloat(simParams[1]);
                        simInt = parseInt(simParams[2]);
                        simStartValue = parseFloat(this.pointValue);
                        addValue = simStartValue;
                        typeFlag = "INCREMENT";
                    }
                    if (simType == "-") {
                        simEnabled = true;
                        simPer = parseFloat(simParams[1]);
                        simInt = parseInt(simParams[2]);
                        simStartValue = parseFloat(this.pointValue);
                        addValue = simStartValue;
                        typeFlag = "DECREMENT";
                    }

                }
            }
            if (param.length > 5 && param[4].toUpperCase() == "B".toUpperCase()) {
                if (param[5] == "") return;
                //Simulation enabled
                tmrSimulate.Interval = 1000;
                simEnabled = true;
                simPer = 0;
                simInt = parseInt(param[5]);
                simStartValue = 0;
                addValue = simStartValue;
                typeFlag = "BINARY";
                tmrSimulate.Interval = 1000 * parseInt(simInt, 5);
            }
        } else logger.error(1, "Address format should be at least : AHU-01,Return Air Temp,AV,21.2 (for random values:AHU-01,Return Air Temp,AV,21.2,Y,%:30:5)");
    }
}

util.inherits(DevicePoint, EventEmitter)

function ItemInfo(dp, v) {
    this._DevicePoint = dp;
    this._Value = v;
}

module.exports.DevicePoint = DevicePoint;
module.exports.ItemInfo = ItemInfo;