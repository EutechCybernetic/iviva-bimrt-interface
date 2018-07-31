const express = require('express'),
    bodyParser = require("body-parser"),
    path = require('path'),
    config = require("config"),
    pug = require('pug'),
    _ = require('lodash'),
    EventEmitter = require('events'),
    util = require('util'),
    fs = require('fs');

function BIMRTInterfaceWebHost() {
    EventEmitter.call(this);
    const self = this;
    const app = express();
    var addressList = [];

    app.use(express.static(path.join(__dirname, 'public')));
    app.set('views', path.join(__dirname, 'views'));
    app.use(bodyParser.urlencoded({
        extended: false
    }));
    app.use(bodyParser.json());
    app.set('view engine', 'pug');

    app.get('/', function (req, res) {
        self.emit('Get.AddressList', (err, data) => {
            addressList = data;
            res.render('index', {
                data: _.uniq(_.map(addressList, 'equipment_id'))
            });
        });

    });

    app.post('/setConfiguration', (req, res) => {
        fs.readFile('./config/default.json', function (err, data) {
            if (err) console.log('error during  reading the file : ' + err);
            if (data) {
                console.log('set configuration , file ' + data);
                let json_data = JSON.parse(data);
                json_data[req.body.id] = req.body.value;
                fs.writeFile("./config/default.json", JSON.stringify(json_data), function (err) {
                    if (err) {
                        return console.log(err);
                    }

                    console.log("The file was saved!");
                });
            }
        });
    });

    app.get('/configurations', function (req, res) {
        let data = {
            host: config.get("host"),
            apiKey: config.get("apiKey"),
            InterfaceID: config.get("InterfaceID")
        };
        res.render('configurations', data);
    });

    app.post('/setValue', (req, res) => {
        let a = _.find(addressList, {
            equipment_id: req.body.equipment_id,
            point_name: req.body.point_name
        });
        self.emit('Set.PointValue', a.address, req.body.new_value, (err, data) => {
            res.end(data);
        });
    });

    app.get('/getValue', (req, res) => {
        let infoX = _.find(addressList, {
            'equipment_id': req.query.equipment_id.toString(),
            'point_name': req.query.point_name.toString()
        })
        self.emit('Get.PointValue', infoX.address, (err, data) => {
            res.end(data);
        });
    });

    app.get('/equipment', (req, res) => {
        let points = _.filter(addressList, {
            'equipment_id': req.query.equipment_id.toString()
        }).map((v) => {
            return {
                point_name: v.point_name,
                point_value: v.last_value,
                equipment_template_id: v.equipment_template_id,
                read_write_state: v.read_write_state === 'Read' ? 1 : 0
            };
        });

        let params = {
            data: points,
            equipment_id: req.query.equipment_id,
            equipment_template_id: _.last(points).equipment_template_id
        };

        res.render(params.equipment_template_id, params, (err, html) => {
            if (err) {
                if (err.message.indexOf('Failed to lookup view') !== -1)
                    return res.render('equipment_layout', params);
                throw err;
            }
            res.send(html);
        });
    });

    this.updateValue = (address, newValue, callback) => {
        let a = _.find(addressList, {
            address: address
        });
        if (a !== undefined)
            self.emit('Update.UI', a.equipment_id, a.point_name, newValue);
        callback(null, 'success');
    }

    app.get('/update-stream', (req, res) => {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        res.write('\n');

        self.on('Update.UI', (equipmentID, pointName, pointValue) => {
            let data = {
                equipment_id: equipmentID,
                point_name: pointName,
                point_value: pointValue
            };
            res.write('data: ' + JSON.stringify(data) + '\n\n');
        });
    });

    app.listen(3000, () => console.log('Interface app listening on port 3000!'));
}
util.inherits(BIMRTInterfaceWebHost, EventEmitter);
module.exports = BIMRTInterfaceWebHost;