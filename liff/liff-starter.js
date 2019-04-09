const USER_SERVICE_UUID = "981b0d79-2855-44f4-aa14-3c34012a3dd3";
const USER_CHARACTERISTIC_NOTIFY_UUID = "e90b4b4e-f18a-44f0-8691-b041c7fe57f2";
const USER_CHARACTERISTIC_READ_UUID = "1737f2f4-c3d3-453b-a1a6-9efe69cc944f";
const USER_CHARACTERISTIC_WRITE_UUID = "5136e866-d081-47d3-aabc-a2c9518bacd4";

const deviceUUIDSet = new Set();
const connectedUUIDSet = new Set();
const connectingUUIDSet = new Set();
const notificationUUIDSet = new Set();

let logNumber = 1;

function onScreenLog(text) {
    const logbox = document.getElementById('logbox');
    logbox.value += '#' + logNumber + '> ';
    logbox.value += text;
    logbox.value += '\n';
    logbox.scrollTop = logbox.scrollHeight;
    logNumber++;
}

window.onload = () => {
    liff.init(async () => {
        onScreenLog('LIFF initialized');
        renderVersionField();

        await liff.initPlugins(['bluetooth']);
        onScreenLog('BLE plugin initialized');

        checkAvailablityAndDo(() => {
            onScreenLog('Finding devices...');
            findDevice();
        });
    }, e => {
        flashSDKError(e);
        onScreenLog(`ERROR on getAvailability: ${e}`);
    });
}

async function checkAvailablityAndDo(callbackIfAvailable) {
    const isAvailable = await liff.bluetooth.getAvailability().catch(e => {
        flashSDKError(e);
        onScreenLog(`ERROR on getAvailability: ${e}`);
        return false;
    });
    // onScreenLog("Check availablity: " + isAvailable);

    if (isAvailable) {
        document.getElementById('alert-liffble-notavailable').style.display = 'none';
        callbackIfAvailable();
    } else {
        document.getElementById('alert-liffble-notavailable').style.display = 'block';
        setTimeout(() => checkAvailablityAndDo(callbackIfAvailable), 1000);
    }
}

// Find LINE Things device using requestDevice()
async function findDevice() {
    const device = await liff.bluetooth.requestDevice().catch(e => {
        flashSDKError(e);
        onScreenLog(`ERROR on requestDevice: ${e}`);
        throw e;
    });
    // onScreenLog('detect: ' + device.id);

    try {
        if (!deviceUUIDSet.has(device.id)) {
            deviceUUIDSet.add(device.id);
            addDeviceToList(device);
        } else {
            // TODO: Maybe this is unofficial hack > device.rssi
            document.querySelector(`#${device.id} .rssi`).innerText = device.rssi;
        }

        checkAvailablityAndDo(() => setTimeout(findDevice, 100));
    } catch (e) {
        onScreenLog(`ERROR on findDevice: ${e}\n${e.stack}`);
    }
}

// Add device to found device list
function addDeviceToList(device) {
    onScreenLog('Device found: ' + device.name);

    const deviceList = document.getElementById('device-list');
    const deviceItem = document.getElementById('device-list-item').cloneNode(true);
    deviceItem.setAttribute('id', device.id);
    deviceItem.querySelector(".device-id").innerText = device.id;
    deviceItem.querySelector(".device-name").innerText = device.name;
    deviceItem.querySelector(".rssi").innerText = device.rssi;
    deviceItem.classList.add("d-flex");
    deviceItem.addEventListener('click', () => {
        deviceItem.classList.add("active");
        try {
            connectDevice(device);
        } catch (e) {
            onScreenLog('Initializing device failed. ' + e);
        }
    });
    deviceList.appendChild(deviceItem);
}

// Select target device and connect it
function connectDevice(device) {
    onScreenLog('Device selected: ' + device.name);

    if (!device) {
        onScreenLog('No devices found. You must request a device first.');
    } else if (connectingUUIDSet.has(device.id) || connectedUUIDSet.has(device.id)) {
        onScreenLog('Already connected to this device.');
    } else {
        connectingUUIDSet.add(device.id);
        initializeCardForDevice(device);

        // Wait until the requestDevice call finishes before setting up the disconnect listner
        const disconnectCallback = () => {
            updateConnectionStatus(device, 'disconnected');
            device.removeEventListener('gattserverdisconnected', disconnectCallback);
        };
        device.addEventListener('gattserverdisconnected', disconnectCallback);

        onScreenLog('Connecting ' + device.name);
        device.gatt.connect().then(() => {
            updateConnectionStatus(device, 'connected');
            connectingUUIDSet.delete(device.id);
        }).catch(e => {
            flashSDKError(e);
            onScreenLog(`ERROR on gatt.connect(${device.id}): ${e}`);
            updateConnectionStatus(device, 'error');
            connectingUUIDSet.delete(device.id);
        });
    }
}

// Setup device information card
function initializeCardForDevice(device) {
    const template = document.getElementById('device-template').cloneNode(true);
    const cardId = 'device-' + device.id;

    template.style.display = 'block';
    template.setAttribute('id', cardId);
    template.querySelector('.card > .card-header > .device-name').innerText = device.name;

    var things = new ThingsConn(USER_SERVICE_UUID, USER_CHARACTERISTIC_WRITE_UUID, USER_CHARACTERISTIC_READ_UUID);


    // Device disconnect button
    template.querySelector('.device-disconnect').addEventListener('click', () => {
        onScreenLog('Clicked disconnect button');
        device.gatt.disconnect();
    });

    template.querySelector('.setuuid').addEventListener('click', () => {
        writeAdvertuuid(device, template.querySelector('.uuid_text').value).catch(e => onScreenLog(`ERROR on writeAdvertuuid(): ${e}\n${e.stack}`));
    });

    template.querySelector('.device-read').addEventListener('click', () => {
        deviceRead(device).catch(e => `ERROR on deviceRead(): ${e}\n${e.stack}`);
    });

    template.querySelector('.textctrl-write').addEventListener('click', () => {
        /*
        writeTextControl(device,
          parseInt(template.querySelector('.displayaddress_x').value, 16),
          parseInt(template.querySelector('.displayaddress_y').value, 16)
        ).catch(e => `ERROR on writeTextControl(): ${e}\n${e.stack}`);
        */
        writetext.writeTextControl(device, parseInt(template.querySelector('.displayaddress_x').value, 16), parseInt(template.querySelector('.displayaddress_y').value, 16));


    });

    template.querySelector('.textsize-write').addEventListener('click', () => {
        writeFontSize(device,
            parseInt(template.querySelector('.textsize').value, 16)
        ).catch(e => `ERROR on writeTextControl(): ${e}\n${e.stack}`);
    });

    template.querySelector('.text-write').addEventListener('click', () => {
        writeText(device,
          template.querySelector('.display_text').value
        ).catch(e => `ERROR on writeText(): ${e}\n${e.stack}`);
    });
    

    template.querySelector('.text-clear').addEventListener('click', () => {
        displayClear(device).catch(e => `ERROR on writeText(): ${e}\n${e.stack}`);
    });

    template.querySelector('.led-write').addEventListener('click', () => {
        ledWrite(device,
          parseInt(template.querySelector('.led-port').value, 16),
          parseInt(template.querySelector('.led-value').value, 16)
        ).catch(e => `ERROR on writeLed(): ${e}\n${e.stack}`);
    });

    template.querySelector('.buzzer-write').addEventListener('click', () => {
        buzzerControl(device,
          parseInt(template.querySelector('.buzzer-control').value, 16)
        ).catch(e => `ERROR on buzzerControl(): ${e}\n${e.stack}`);
    });

    template.querySelector('.gpio-direction').addEventListener('click', () => {
        gpioPinMode(device,
          parseInt(template.querySelector('.gpio-direction-port').value, 16),
          parseInt(template.querySelector('.gpio-direction-dir').value, 16)
        ).catch(e => `ERROR on gpioPinMode(): ${e}\n${e.stack}`);
    });

    template.querySelector('.gpio-dwrite').addEventListener('click', () => {
        gpioDigitalWrite(device,
          parseInt(template.querySelector('.gpio-digitalwrite-port').value, 16),
          parseInt(template.querySelector('.gpio-digitalwrite-value').value, 16)
        ).catch(e => `ERROR on gpioDirigtalWrite(): ${e}\n${e.stack}`);
    });

    template.querySelector('.gpio-awrite').addEventListener('click', () => {
        gpioAnalogWrite(device,
          parseInt(template.querySelector('.gpio-awrite-port').value, 16),
          parseInt(template.querySelector('.gpio-awrite-value').value, 16)
        ).catch(e => `ERROR on gpioAnalogWrite(): ${e}\n${e.stack}`);
    });

    template.querySelector('.i2c-start').addEventListener('click', () => {
        i2cStartTransaction(device,
          parseInt(template.querySelector('.i2c-start-addr').value, 16),
        ).catch(e => `ERROR on i2cStartTransaction(): ${e}\n${e.stack}`);
    });

    template.querySelector('.i2c-write').addEventListener('click', () => {
        i2cWrite(device,
          parseInt(template.querySelector('.i2c-write-data').value, 16),
        ).catch(e => `ERROR on i2cWrite(): ${e}\n${e.stack}`);
    });

    template.querySelector('.i2c-stop').addEventListener('click', () => {
        i2cStopTransaction(device).catch(e => `ERROR on i2cStopTransaction(): ${e}\n${e.stack}`);
    });

    template.querySelector('.i2c-request').addEventListener('click', () => {
        i2cRequestFrom(device,
          parseInt(template.querySelector('.i2c-request-addr').value, 16),
        ).catch(e => `ERROR on i2cRequestFrom(): ${e}\n${e.stack}`);
    });

    template.querySelector('.i2c-readreq').addEventListener('click', () => {
        i2cReadRequest(device).catch(e => `ERROR on i2cReadRequest(): ${e}\n${e.stack}`);
    });

    template.querySelector('.gpio-dreadreq').addEventListener('click', () => {
        gpioDigitalReadReq(device,
          parseInt(template.querySelector('.gpio-dreadreq-port').value, 16),
        ).catch(e => `ERROR on gpioDigitalReadReq(): ${e}\n${e.stack}`);
    });

    template.querySelector('.gpio-areadreq').addEventListener('click', () => {
        gpioAnalogReadReq(device,
          parseInt(template.querySelector('.gpio-areadreq-port').value, 16),
        ).catch(e => `ERROR on gpioAnalogReadReq(): ${e}\n${e.stack}`);
    });

    template.querySelector('.read-buffer-write').addEventListener('click', () => {
        readReq(device,
          parseInt(template.querySelector('.read-buffer-source').value, 16),
        ).catch(e => `ERROR on readReq(): ${e}\n${e.stack}`);
    });

    // Tabs
    ['write', 'read', 'advert'].map(key => {
        const tab = template.querySelector(`#nav-${key}-tab`);
        const nav = template.querySelector(`#nav-${key}`);

        tab.id = `nav-${key}-tab-${device.id}`;
        nav.id = `nav-${key}-${device.id}`;

        tab.href = '#' + nav.id;
        tab['aria-controls'] = nav.id;
        nav['aria-labelledby'] = tab.id;
    })

    // Remove existing same id card
    const oldCardElement = getDeviceCard(device);
    if (oldCardElement && oldCardElement.parentNode) {
        oldCardElement.parentNode.removeChild(oldCardElement);
    }

    document.getElementById('device-cards').appendChild(template);
    onScreenLog('Device card initialized: ' + device.name);
}

// Update Connection Status
function updateConnectionStatus(device, status) {
    if (status == 'connected') {
        onScreenLog('Connected to ' + device.name);
        connectedUUIDSet.add(device.id);

        const statusBtn = getDeviceStatusButton(device);
        statusBtn.setAttribute('class', 'device-status btn btn-outline-primary btn-sm disabled');
        statusBtn.innerText = "Connected";
        getDeviceDisconnectButton(device).style.display = 'inline-block';
        getDeviceCardBody(device).style.display = 'block';
    } else if (status == 'disconnected') {
        onScreenLog('Disconnected from ' + device.name);
        connectedUUIDSet.delete(device.id);

        const statusBtn = getDeviceStatusButton(device);
        statusBtn.setAttribute('class', 'device-status btn btn-outline-secondary btn-sm disabled');
        statusBtn.innerText = "Disconnected";
        getDeviceDisconnectButton(device).style.display = 'none';
        getDeviceCardBody(device).style.display = 'none';
        document.getElementById(device.id).classList.remove('active');
    } else {
        onScreenLog('Connection Status Unknown ' + status);
        connectedUUIDSet.delete(device.id);

        const statusBtn = getDeviceStatusButton(device);
        statusBtn.setAttribute('class', 'device-status btn btn-outline-danger btn-sm disabled');
        statusBtn.innerText = "Error";
        getDeviceDisconnectButton(device).style.display = 'none';
        getDeviceCardBody(device).style.display = 'none';
        document.getElementById(device.id).classList.remove('active');
    }
}

async function toggleNotification(device) {
    if (!connectedUUIDSet.has(device.id)) {
        window.alert('Please connect to a device first');
        onScreenLog('Please connect to a device first.');
        return;
    }

    const accelerometerCharacteristic = await getCharacteristic(
        device, USER_SERVICE_UUID, USER_CHARACTERISTIC_NOTIFY_UUID);

    if (notificationUUIDSet.has(device.id)) {
        // Stop notification
        await stopNotification(accelerometerCharacteristic, notificationCallback);
        notificationUUIDSet.delete(device.id);
        getDeviceNotificationButton(device).classList.remove('btn-success');
        getDeviceNotificationButton(device).classList.add('btn-secondary');
        getDeviceNotificationButton(device).getElementsByClassName('fas')[0].classList.remove('fa-toggle-on');
        getDeviceNotificationButton(device).getElementsByClassName('fas')[0].classList.add('fa-toggle-off');
    } else {
        // Start notification
        await enableNotification(accelerometerCharacteristic, notificationCallback);
        notificationUUIDSet.add(device.id);
        getDeviceNotificationButton(device).classList.remove('btn-secondary');
        getDeviceNotificationButton(device).classList.add('btn-success');
        getDeviceNotificationButton(device).getElementsByClassName('fas')[0].classList.remove('fa-toggle-off');
        getDeviceNotificationButton(device).getElementsByClassName('fas')[0].classList.add('fa-toggle-on');
    }
}

async function enableNotification(characteristic, callback) {
    const device = characteristic.service.device;
    characteristic.addEventListener('characteristicvaluechanged', callback);
    await characteristic.startNotifications();
    onScreenLog('Notifications STARTED ' + characteristic.uuid + ' ' + device.id);
}

async function stopNotification(characteristic, callback) {
    const device = characteristic.service.device;
    characteristic.removeEventListener('characteristicvaluechanged', callback);
    await characteristic.stopNotifications();
    onScreenLog('Notifications STOPPED　' + characteristic.uuid + ' ' + device.id);
}

function notificationCallback(e) {
    const accelerometerBuffer = new DataView(e.target.value.buffer);
    onScreenLog(`Notify ${e.target.uuid}: ${buf2hex(e.target.value.buffer)}`);
    updateSensorValue(e.target.service.device, accelerometerBuffer);
}

async function deviceRead(device) {
    const readCmdCharacteristic = await getCharacteristic(
        device, USER_SERVICE_UUID, USER_CHARACTERISTIC_READ_UUID);

    const valueBuffer = await readCharacteristic(readCmdCharacteristic).catch(e => {
        onScreenLog('Read Value  : ' + "error");
        return null;
    });

    /*
    if (accelerometerBuffer !== null) {
        updateSensorValue(device, accelerometerBuffer);
    }
    */
    onScreenLog('Read Value  : ' + valueBuffer);

}

function updateSensorValue(device, buffer) {

}

async function readCharacteristic(characteristic) {
    const response = await characteristic.readValue().catch(e => {
        onScreenLog(`Error reading ${characteristic.uuid}: ${e}`);
        throw e;
    });
    if (response) {
        onScreenLog(`Read ${characteristic.uuid}: ${buf2hex(response.buffer)}`);
        const values = new DataView(response.buffer);
        return values;
    } else {
        throw 'Read value is empty?';
    }
}

async function writeText(device, text) {
  let ch_array = text.split("");
  for(let i = 0; i < 16; i = i + 1){
    if(i >= text.length){
      ch_array[i] = 0;
    }else{
      ch_array[i] = (new TextEncoder('ascii')).encode(ch_array[i]);
    }
  }

  const cmd = [1, text.length];
  const command = cmd.concat(ch_array);

  const characteristic = await getCharacteristic(
        device, USER_SERVICE_UUID, USER_CHARACTERISTIC_WRITE_UUID);
  await characteristic.writeValue(new Uint8Array(command)).catch(e => {
      onScreenLog(`Write text : Error writing ${characteristic.uuid}: ${e}`);
      throw e;
  });

  onScreenLog(`Write text done`);
}


async function writeTextControl(device, addr_x, addr_y) {
    const command = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, addr_x, addr_y];

    const characteristic = await getCharacteristic(
          device, USER_SERVICE_UUID, USER_CHARACTERISTIC_WRITE_UUID);
    await characteristic.writeValue(new Uint8Array(command)).catch(e => {
        onScreenLog(`Write text control : Error writing ${characteristic.uuid}: ${e}`);
        throw e;
    });

    onScreenLog(`Write text control done`);
}

async function writeFontSize(device, size) {
    const command = [15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, size];

    const characteristic = await getCharacteristic(
          device, USER_SERVICE_UUID, USER_CHARACTERISTIC_WRITE_UUID);
    await characteristic.writeValue(new Uint8Array(command)).catch(e => {
        onScreenLog(`Display : Error write font size ${characteristic.uuid}: ${e}`);
        throw e;
    });
}

async function displayClear(device) {
    const command = [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    const characteristic = await getCharacteristic(
          device, USER_SERVICE_UUID, USER_CHARACTERISTIC_WRITE_UUID);
    await characteristic.writeValue(new Uint8Array(command)).catch(e => {
        onScreenLog(`Display clear : Error writing ${characteristic.uuid}: ${e}`);
        throw e;
    });
}



async function ledWrite(device, port, value) {
    const command = [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, port, value];

    const characteristic = await getCharacteristic(
          device, USER_SERVICE_UUID, USER_CHARACTERISTIC_WRITE_UUID);
    await characteristic.writeValue(new Uint8Array(command)).catch(e => {
        onScreenLog(`Write LED : Error writing ${characteristic.uuid}: ${e}`);
        throw e;
    });
}

async function buzzerControl(device, value) {
    const command = [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, value];

    const characteristic = await getCharacteristic(
          device, USER_SERVICE_UUID, USER_CHARACTERISTIC_WRITE_UUID);
    await characteristic.writeValue(new Uint8Array(command)).catch(e => {
        onScreenLog(`Buzzer : Error writing ${characteristic.uuid}: ${e}`);
        throw e;
    });
}

async function gpioPinMode(device, port, value) {
    const command = [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, port, value];

    const characteristic = await getCharacteristic(
          device, USER_SERVICE_UUID, USER_CHARACTERISTIC_WRITE_UUID);
    await characteristic.writeValue(new Uint8Array(command)).catch(e => {
        onScreenLog(`Buzzer : Error writing ${characteristic.uuid}: ${e}`);
        throw e;
    });
}

async function gpioDigitalWrite(device, port, value) {
    const command = [6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, port, value];

    const characteristic = await getCharacteristic(
          device, USER_SERVICE_UUID, USER_CHARACTERISTIC_WRITE_UUID);
    await characteristic.writeValue(new Uint8Array(command)).catch(e => {
        onScreenLog(`Buzzer : Error writing ${characteristic.uuid}: ${e}`);
        throw e;
    });
}

async function gpioAnalogWrite(device, port, value) {
    const command = [7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, port, value];

    const characteristic = await getCharacteristic(
          device, USER_SERVICE_UUID, USER_CHARACTERISTIC_WRITE_UUID);
    await characteristic.writeValue(new Uint8Array(command)).catch(e => {
        onScreenLog(`Buzzer : Error writing ${characteristic.uuid}: ${e}`);
        throw e;
    });
}

async function i2cStartTransaction(device, address) {
    const command = [8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, address];

    const characteristic = await getCharacteristic(
          device, USER_SERVICE_UUID, USER_CHARACTERISTIC_WRITE_UUID);
    await characteristic.writeValue(new Uint8Array(command)).catch(e => {
        onScreenLog(`I2C : Error start transaction ${characteristic.uuid}: ${e}`);
        throw e;
    });
}
async function i2cWrite(device, value) {
    const command = [9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, value];

    const characteristic = await getCharacteristic(
          device, USER_SERVICE_UUID, USER_CHARACTERISTIC_WRITE_UUID);
    await characteristic.writeValue(new Uint8Array(command)).catch(e => {
        onScreenLog(`I2C : Error write data ${characteristic.uuid}: ${e}`);
        throw e;
    });
}
async function i2cStopTransaction(device, address) {
    const command = [10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, address];

    const characteristic = await getCharacteristic(
          device, USER_SERVICE_UUID, USER_CHARACTERISTIC_WRITE_UUID);
    await characteristic.writeValue(new Uint8Array(command)).catch(e => {
        onScreenLog(`I2C : Error stop transaction ${characteristic.uuid}: ${e}`);
        throw e;
    });
}
async function i2cRequestFrom(device, address) {
    const command = [11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, address];

    const characteristic = await getCharacteristic(
          device, USER_SERVICE_UUID, USER_CHARACTERISTIC_WRITE_UUID);
    await characteristic.writeValue(new Uint8Array(command)).catch(e => {
        onScreenLog(`I2C : Error request from ${characteristic.uuid}: ${e}`);
        throw e;
    });
}
async function i2cReadRequest(device) {
    const command = [12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    const characteristic = await getCharacteristic(
          device, USER_SERVICE_UUID, USER_CHARACTERISTIC_WRITE_UUID);
    await characteristic.writeValue(new Uint8Array(command)).catch(e => {
        onScreenLog(`I2C : Error read request ${characteristic.uuid}: ${e}`);
        throw e;
    });
}
async function gpioDigitalReadReq(device, port) {
    const command = [13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, port];

    const characteristic = await getCharacteristic(
          device, USER_SERVICE_UUID, USER_CHARACTERISTIC_WRITE_UUID);
    await characteristic.writeValue(new Uint8Array(command)).catch(e => {
        onScreenLog(`GPIO : Error digital read request ${characteristic.uuid}: ${e}`);
        throw e;
    });
}
async function gpioAnalogReadReq(device, port) {
    const command = [14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, port];

    const characteristic = await getCharacteristic(
          device, USER_SERVICE_UUID, USER_CHARACTERISTIC_WRITE_UUID);
    await characteristic.writeValue(new Uint8Array(command)).catch(e => {
        onScreenLog(`I2C : Error analog read request ${characteristic.uuid}: ${e}`);
        throw e;
    });
}

async function readReq(device, cmd) {
    const command = [32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, cmd];

    const characteristic = await getCharacteristic(
          device, USER_SERVICE_UUID, USER_CHARACTERISTIC_WRITE_UUID);
    await characteristic.writeValue(new Uint8Array(command)).catch(e => {
        onScreenLog(`Buzzer : Error writing ${characteristic.uuid}: ${e}`);
        throw e;
    });
}

async function writeAdvertuuid(device, uuid) {
  const tx_uuid = uuid.replace(/-/g, '');
  let uuid_byte = [];
  let hash = 0;
  for(let i = 0; i < 16; i = i + 1) {
    uuid_byte[i] = parseInt(tx_uuid.substring(i * 2, i * 2 + 2), 16);
    hash = hash + uuid_byte[i];
  }

  const header = [1, 0, 0, hash];
  const command = header.concat(uuid_byte);

  onScreenLog('Write new advert UUID to device  : ' + new Uint8Array(command));

  const characteristic = await getCharacteristic(
        device, USER_SERVICE_UUID, USER_CHARACTERISTIC_WRITE_UUID);
  await characteristic.writeValue(new Uint8Array(command)).catch(e => {
      onScreenLog(`Error writing ${characteristic.uuid}: ${e}`);
      throw e;
  });
}


async function getCharacteristic(device, serviceId, characteristicId) {
    const service = await device.gatt.getPrimaryService(serviceId).catch(e => {
        flashSDKError(e);
        throw e;
    });
    const characteristic = await service.getCharacteristic(characteristicId).catch(e => {
        flashSDKError(e);
        throw e;
    });
    onScreenLog(`Got characteristic ${serviceId} ${characteristicId} ${device.id}`);
    return characteristic;
}

function getDeviceCard(device) {
    return document.getElementById('device-' + device.id);
}

function getDeviceCardBody(device) {
    return getDeviceCard(device).getElementsByClassName('card-body')[0];
}

function getDeviceStatusButton(device) {
    return getDeviceCard(device).getElementsByClassName('device-status')[0];
}

function getDeviceDisconnectButton(device) {
    return getDeviceCard(device).getElementsByClassName('device-disconnect')[0];
}


function getDeviceNotificationButton(device) {
    return getDeviceCard(device).getElementsByClassName('notification-enable')[0];
}

function renderVersionField() {
    const element = document.getElementById('sdkversionfield');
    const versionElement = document.createElement('p')
        .appendChild(document.createTextNode('SDK Ver: ' + liff._revision));
    element.appendChild(versionElement);
}

function flashSDKError(error){
    window.alert('SDK Error: ' + error.code);
    window.alert('Message: ' + error.message);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function buf2hex(buffer) { // buffer is an ArrayBuffer
    return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}
