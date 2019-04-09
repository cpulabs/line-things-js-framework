
class ThingsConn {
    constructor(device, svUuid, writeUuid, writeIoUuid, readIoUuid) {
        this.device = device;
        this.svUuid = svUuid;
        this.wrUuid = writeUuid;
        this.wrIoUuid = writeIoUuid;
        this.rdIoUuid = readIoUuid;
    }

    async enterBleioMode(){
        const command = [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
        this.writeCharacteristic(command, 'control');
    }

    async enterDemoMode(){
        const command = [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        this.writeCharacteristic(command, 'control');
    }

    async writeAdvertUuid(uuid) {
        const tx_uuid = uuid.replace(/-/g, '');
        let uuid_byte = [];
        let hash = 0;
        for(let i = 0; i < 16; i = i + 1) {
            uuid_byte[i] = parseInt(tx_uuid.substring(i * 2, i * 2 + 2), 16);
            hash = hash + uuid_byte[i];
        }
        const header = [1, 0, 0, hash];
        const command = header.concat(uuid_byte);
        this.writeCharacteristic(command, 'control');
    }

    async writeText(text) {
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
        this.writeCharacteristic(command, 'io');
    }

    async writeTextControl(addr_x, addr_y) {
        const command = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, addr_x, addr_y];
        this.writeCharacteristic(command, 'io');
    }

    async writeFontSize(size) {
        const command = [15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, size];
        this.writeCharacteristic(command, 'io');
    }

    async displayClear(device) {
        const command = [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        this.writeCharacteristic(command, 'io');
    }

    async ledWrite(port, value) {
        const command = [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, port, value];
        this.writeCharacteristic(command, 'io');
    }

    async ledWriteByte(value) {
        const command = [16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, value];
        this.writeCharacteristic(command, 'io');
    }

    async buzzerControl(value) {
        const command = [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, value];
        this.writeCharacteristic(command, 'io');
    }

    async gpioPinMode(port, value) {
        const command = [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, port, value];
        this.writeCharacteristic(command, 'io');
    }

    async gpioDigitalWrite(port, value) {
        const command = [6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, port, value];
        this.writeCharacteristic(command, 'io');
    }

    async gpioAnalogWrite(port, value) {
        const command = [7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, port, value];
        this.writeCharacteristic(command, 'io');
    }

    async i2cStartTransaction(address) {
        const command = [8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, address];
        this.writeCharacteristic(command, 'io');
    }
    async i2cWrite(value) {
        const command = [9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, value];
        this.writeCharacteristic(command, 'io');
    }
    async i2cStopTransaction() {
        const command = [10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        this.writeCharacteristic(command, 'io');
    }
    async i2cRequestFrom(address, length) {
        const command = [11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, length, address];
        this.writeCharacteristic(command, 'io');
    }
    async i2cReadRequest(device) {
        const command = [12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        this.writeCharacteristic(command, 'io');
    }
    async gpioDigitalReadReq(port) {
        const command = [13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, port];
        this.writeCharacteristic(command, 'io');
    }
    async gpioAnalogReadReq(port) {
        const command = [14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, port];
        this.writeCharacteristic(command, 'io');
    }

    async readReq(cmd) {
        const command = [32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, cmd];
        this.writeCharacteristic(command, io);
    }



    async deviceRead() {
        const readCmdCharacteristic = await this.getCharacteristic(
            this.device, this.svUuid, this.rdIoUuid);

        const valueBuffer = await readCharacteristic(readCmdCharacteristic).catch(e => {
            onScreenLog('Read Value  : ' + "error");
            return null;
        });

        onScreenLog('Read Value  : ' + valueBuffer);
        return valueBuffer;
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async readCharacteristic(characteristic) {
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

    async writeCharacteristic(data, mode){
        let uuid;
        if(mode == 'control'){
            uuid = this.wrUuid;
        }else if(mode == 'io'){
            uuid = this.wrIoUuid;
        }else{
            return;
        }

        const characteristic = await this.getCharacteristic(
              this.device, this.svUuid, uuid);
        await characteristic.writeValue(new Uint8Array(data)).catch(e => {
            onScreenLog(`Write value to device ${characteristic.uuid}: ${e}`);
            throw e;
        });

        await this.sleep(10);
    }

    async getCharacteristic(device, serviceId, characteristicId) {
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
}
