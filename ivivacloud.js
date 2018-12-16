var http = require('http');
var url = require('url');
var querystring = require('querystring');
var signalR = require('signalr-client');

function Account(host, apiKey) {
    this.apiKey = apiKey;
    this.host = host;
}

Account.prototype.executeLucyAction = function executeLucyAction(service, parameters, callback) {
    try {
        service = service.replace(':', '/').replace('.', '/');
        var urlObj = url.parse(this.host);
        if (urlObj.path == '/') urlObj.path = '';

        var data = querystring.stringify(parameters);

        var options = {
            host: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.path + '/OI/' + service,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(data),
                'Authorization': this.apiKey
            },
        };
        var result = '';
        var req = http.request(options, function (res) {
            var status = res.statusCode;
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                result += chunk;
            });
            res.on('error', function (e) {
                callback(e, null);
            });
            res.on('end', function () {
                if (status >= 400) {
                    callback({
                        message: result,
                        status: status
                    }, null);
                } else {
                    callback(null, result);
                }
            });
        });
        req.on('error', function (e) {
            callback(e, null);
        });
        req.write(data);
        req.end();
    } catch (err) {
        callback(err, null);
    }

};

Account.prototype.executeService = function executeService(service, parameters, callback) {
    try {
        service = service.replace(':', '/').replace('.', '/');
        var urlObj = url.parse(this.host);
        if (urlObj.path == '/') urlObj.path = '';

        var data = querystring.stringify(parameters);

        var options = {
            host: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.path + '/api/' + service,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(data),
                'Authorization': this.apiKey
            },
        };
        var result = '';
        var req = http.request(options, function (res) {
            var status = res.statusCode;
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                result += chunk;
            });
            res.on('error', function (e) {
                callback(e, null);
            });
            res.on('end', function () {
                if (status >= 400) {
                    callback({
                        message: result,
                        status: status
                    }, null);
                } else {
                    callback(null, result);
                }
            });
        });
        req.on('error', function (e) {
            callback(e, null);
        });
        req.write(data);
        req.end();
    } catch (err) {
        callback(err, null);
    }
};

function MessageBus(account) {

    var client = null;

    var Hubs = ['GlobalHub'];

    var subscriptions = {};

    var host = url.parse(account.host);
    host.pathname = '/signalR';
    var signalRUrl = host.format();

    var apikey = account.apiKey;

    this.subscribe = function (channel, callback2) {
        subscriptions[channel] = callback2;
        client.invoke(Hubs[0], 'subscribe', apikey, channel);
    };

    this.broadcast = function (channel, message) {
        client.invoke(Hubs[0], 'broadcast', apikey, channel, message);
    };

    this.subscribeAll = function () {

        for (var channel in subscriptions) {
            console.log('Subscribing', channel);
            this.subscribe(channel, subscriptions[channel]);
        }
    }
    this.init = function (callback) {
        client = new signalR.client(signalRUrl, Hubs, 2, true);
        client.start();
        client.handlers.globalhub = {
            broadcast: function (channel, message) {
                if (subscriptions[channel] != null) {
                    subscriptions[channel](channel, message);
                } else {
                    console.log('err:' + channel);
                }
            }
        };

        client.serviceHandlers.connected = function (connection) {
            console.log('Connected');
            callback();
        };
        client.serviceHandlers.disconnected = function () {
            console.log('Disconnected', arguments);
        }
        client.serviceHandlers.onerror = function () {
            console.log('onerror', arguments);
        }
        client.serviceHandlers.reconnected = () => {
            console.log('reconnected. subscribing to all', arguments);
            this.subscribeAll();
        }
        client.serviceHandlers.reconnecting = function () {
            console.log('reconnecting', arguments);
        }

        client.serviceHandlers.connectionLost = function () {
            console.log('connection lost', arguments);
        }

        client.serviceHandlers.connectFailed = function () {
            console.log('connection failed', arguments);
        }

        client.serviceHandlers.bindingError = function () {
            console.log('binding error', arguments);
        }
    };
}

module.exports.Account = Account;
module.exports.MessageBus = MessageBus;