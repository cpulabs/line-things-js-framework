const USER_SERVICE_UUID = "981b0d79-2855-44f4-aa14-3c34012a3dd3";
const USER_CHARACTERISTIC_NOTIFY_UUID = "e90b4b4e-f18a-44f0-8691-b041c7fe57f2";
const USER_CHARACTERISTIC_WRITE_UUID = "4f2596d7-b3d6-4102-85a2-947b80ab4c6f";
const USER_CHARACTERISTIC_IO_WRITE_UUID = "5136e866-d081-47d3-aabc-a2c9518bacd4";
const USER_CHARACTERISTIC_IO_READ_UUID = "1737f2f4-c3d3-453b-a1a6-9efe69cc944f";

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

    const things = new ThingsConn(
        device,
        USER_SERVICE_UUID,
        USER_CHARACTERISTIC_WRITE_UUID,
        USER_CHARACTERISTIC_IO_WRITE_UUID,
        USER_CHARACTERISTIC_IO_READ_UUID
    );

    // Device disconnect button
    template.querySelector('.device-disconnect').addEventListener('click', () => {
        onScreenLog('Clicked disconnect button');
        device.gatt.disconnect();
    });

    template.querySelector('.mode-write').addEventListener('click', () => {
        if(template.querySelector('.mode-select').value == "0"){
            things.enterDemoMode().catch(e => onScreenLog(`ERROR enter to Demo mode: ${e}\n${e.stack}`));
        }else{
            things.enterBleioMode().catch(e => onScreenLog(`ERROR enter to BLE IO mode: ${e}\n${e.stack}`));
        }
    });

    template.querySelector('.device-read').addEventListener('click', () => {
        let valueBuffer = things.deviceRead().catch(e => `ERROR on deviceRead(): ${e}\n${e.stack}`);
        getDeviceReadData(device).innerText = String(things.valueRead());
    });

    template.querySelector('.textctrl-write').addEventListener('click', () => {
        things.displayControl(
            parseInt(template.querySelector('.displayaddress_x').value, 16),
            parseInt(template.querySelector('.displayaddress_y').value, 16)
        ).catch(e => `ERROR on displayControl(): ${e}\n${e.stack}`);
    });

    template.querySelector('.textsize-write').addEventListener('click', () => {
        things.displayFontSize(
            parseInt(template.querySelector('.textsize').value, 16)
        ).catch(e => `ERROR on displayFontSize(): ${e}\n${e.stack}`);
    });

    template.querySelector('.text-write').addEventListener('click', () => {
        things.displayWrite(
            template.querySelector('.display_text').value
        ).catch(e => `ERROR on displayWrite(): ${e}\n${e.stack}`);
    });

    template.querySelector('.text-clear').addEventListener('click', () => {
        things.displayClear().catch(e => `ERROR on displayClear(): ${e}\n${e.stack}`);
    });

    template.querySelector('.led-write').addEventListener('click', () => {
        things.ledWrite(
            parseInt(template.querySelector('.led-port').value, 16),
            parseInt(template.querySelector('.led-value').value, 16)
        ).catch(e => `ERROR on writeLed(): ${e}\n${e.stack}`);
    });

    template.querySelector('.buzzer-write').addEventListener('click', () => {
        things.buzzerControl(
            parseInt(template.querySelector('.buzzer-control').value, 16)
        ).catch(e => `ERROR on buzzerControl(): ${e}\n${e.stack}`);
    });

    template.querySelector('.gpio-direction').addEventListener('click', () => {
        things.gpioPinMode(
            parseInt(template.querySelector('.gpio-direction-port').value, 16),
            parseInt(template.querySelector('.gpio-direction-dir').value, 16)
        ).catch(e => `ERROR on gpioPinMode(): ${e}\n${e.stack}`);
    });

    template.querySelector('.gpio-dwrite').addEventListener('click', () => {
        things.gpioDigitalWrite(
            parseInt(template.querySelector('.gpio-digitalwrite-port').value, 16),
            parseInt(template.querySelector('.gpio-digitalwrite-value').value, 16)
        ).catch(e => `ERROR on gpioDirigtalWrite(): ${e}\n${e.stack}`);
    });

    template.querySelector('.gpio-awrite').addEventListener('click', () => {
        things.gpioAnalogWrite(
            parseInt(template.querySelector('.gpio-awrite-port').value, 16),
            parseInt(template.querySelector('.gpio-awrite-value').value, 16)
        ).catch(e => `ERROR on gpioAnalogWrite(): ${e}\n${e.stack}`);
    });

    template.querySelector('.i2c-start').addEventListener('click', () => {
        things.i2cStartTransaction(
            parseInt(template.querySelector('.i2c-start-addr').value, 16),
        ).catch(e => `ERROR on i2cStartTransaction(): ${e}\n${e.stack}`);
    });

    template.querySelector('.i2c-write').addEventListener('click', () => {
        things.i2cWrite(
            parseInt(template.querySelector('.i2c-write-data').value, 16),
        ).catch(e => `ERROR on i2cWrite(): ${e}\n${e.stack}`);
    });

    template.querySelector('.i2c-stop').addEventListener('click', () => {
        things.i2cStopTransaction().catch(e => `ERROR on i2cStopTransaction(): ${e}\n${e.stack}`);
    });

    template.querySelector('.i2c-request').addEventListener('click', () => {
        things.i2cRequestFrom(
            parseInt(template.querySelector('.i2c-request-addr').value, 16),
        ).catch(e => `ERROR on i2cRequestFrom(): ${e}\n${e.stack}`);
    });

    template.querySelector('.i2c-readreq').addEventListener('click', () => {
        things.i2cReadRequest().catch(e => `ERROR on i2cReadRequest(): ${e}\n${e.stack}`);
    });

    template.querySelector('.gpio-dreadreq').addEventListener('click', () => {
        things.gpioDigitalReadReq(
            parseInt(template.querySelector('.gpio-dreadreq-port').value, 16),
        ).catch(e => `ERROR on gpioDigitalReadReq(): ${e}\n${e.stack}`);
    });

    template.querySelector('.gpio-areadreq').addEventListener('click', () => {
        things.gpioAnalogReadReq(
            parseInt(template.querySelector('.gpio-areadreq-port').value, 16),
        ).catch(e => `ERROR on gpioAnalogReadReq(): ${e}\n${e.stack}`);
    });

    template.querySelector('.read-buffer-write').addEventListener('click', () => {
        things.readReq(
            parseInt(template.querySelector('.read-buffer-source').value, 16),
        ).catch(e => `ERROR on readReq(): ${e}\n${e.stack}`);
    });

    // Tabs
    ['write', 'read'].map(key => {
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

function getDeviceReadData(device) {
    return getDeviceCard(device).getElementsByClassName('result-data-view')[0];
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
