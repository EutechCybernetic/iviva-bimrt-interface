const iviva = require('ivivacloud-node');
const BIMRTInterface = require('./../src/bimrt-interface');
const interface = new BIMRTInterface();
const HashMap = require('hashmap');
const mqtt = require('mqtt');
const bimrtutil = require('./mqtt-bimrtutil');
const config = require('config');

const _PointList = new HashMap();

const client  = mqtt.connect('http://192.168.1.135');

client.clientId = config.get("InterfaceID")

client.on('connect', function () {
  client.subscribe('#');
});

client.on('message', (topic, message)=>{
  let json_msg = JSON.parse(message);
  let pad  = topic.slice(0, -1)
  let pX = _PointList.get(pad);

  if(pX!=null){
    if(pX._LastValue!=json_msg.data){
      pX._LastValue = json_msg.data;
      _PointList.set(pad,pX);

      interface.updateValue(pX._Address ,pX._LastValue ,(err,data)=>{});
  }
}
});

interface.on('subscribe',(address,addressDetails,callback)=>{
    let result = true;
    if((address.split('/')[4]=='') || (address.split('/')[5]=='') || (address.split('/')[3]==''))
      {
        result = false;
        callback('Incorrect Point Address',null);
      }
    if(result){
      if(!_PointList.has(address)){
        let aX = new bimrtutil.AddressInfo(addressDetails.address_key,address);
        _PointList.set(address, aX);
      }
      callback(null,'');
    } 
    //console.log('mqqtt-driver , subcribe , address:'+address+' ,result:'+result);
  	
});

interface.on('setdata',(address ,newValue ,callback)=>{
  let data = {
    'deviceidentifier' : address.split('/')[4]
    ,'sensoridentifier' : address.split('/')[5]
    ,'data' : newValue
    ,'datatype' : ''
    ,'protocolid' : address.split('/')[3]
  }

  let msg = JSON.stringify(data)
  client.publish(address,msg) ;
  callback(null,'success');
});