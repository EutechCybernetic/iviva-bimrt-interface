# iviva-bimrt-interface-node
A node.js helper library for iViva BIMRT Interface

# Getting Started
You need to have access to an iVivaCloud installation and have a valid api key.

### Requirements
* Node.js version 4 and above.

### Installation
```sh
    npm install iviva-bimrt-interface-node
```

## Usage
	const BIMRTInterface = require('iviva-bimrt-interface-node');
    const interface = new BIMRTInterface();
    var logger = new BIMRTInterface.BIMRTInterfaceLogger(); 

	/* A sample method when subscribe  event received */
	interface.on('subscribe', (address, addressDetails, callback) => {

    });

    /* A sample method when setdata received */
	interface.on('setdata', (address:string, newValue:'', callback:function) => {
        
    });

    /* A sample method when demandpoll(getdata) event received  */
	interface.on('demandpoll', (demandPoints:[]) => {
        
    });

    /* A sample method when setdata to the interface */
    this.setValue = (address:string, newValue:string) => {

    });