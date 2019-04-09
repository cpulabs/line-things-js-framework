
class ThingsConn {
    constructor(device, svUuid, writeUuid, writeIoUuid, readIoUuid) {
        this.device = device;
        this.svUuid = svUuid;
        this.wrUuid = writeUuid;
        this.wrIoUuid = writeIoUuid;
        this.rdIoUuid = readIoUuid;
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
        deviceWrite(command, 'control');
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
        deviceWrite(command, 'io');
    }

    async writeTextControl(addr_x, addr_y) {
        const command = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, addr_x, addr_y];
        deviceWrite(command, 'io');
    }

    async writeFontSize(size) {
        const command = [15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, size];
        deviceWrite(command, 'io');
    }

    async displayClear(device) {
        const command = [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        deviceWrite(command, 'io');
    }

    async ledWrite(port, value) {
        const command = [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, port, value];
        deviceWrite(command, 'io');
    }

    async buzzerControl(value) {
        const command = [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, value];
        deviceWrite(command, 'io');
    }

    async gpioPinMode(port, value) {
        const command = [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, port, value];
        deviceWrite(command, 'io');
    }

    async gpioDigitalWrite(port, value) {
        const command = [6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, port, value];
        deviceWrite(command, 'io');
    }

    async gpioAnalogWrite(port, value) {
        const command = [7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, port, value];
        deviceWrite(command, 'io');
    }

    async i2cStartTransaction(address) {
        const command = [8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, address];
        deviceWrite(command, 'io');
    }
    async i2cWrite(value) {
        const command = [9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, value];
        deviceWrite(command, 'io');
    }
    async i2cStopTransaction(address) {
        const command = [10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, address];
        deviceWrite(command, 'io');
    }
    async i2cRequestFrom(address) {
        const command = [11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, address];
        deviceWrite(command, 'io');
    }
    async i2cReadRequest(device) {
        const command = [12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        deviceWrite(command, 'io');
    }
    async gpioDigitalReadReq(port) {
        const command = [13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, port];
        deviceWrite(command, 'io');
    }
    async gpioAnalogReadReq(port) {
        const command = [14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, port];
        deviceWrite(command, 'io');
    }

    async readReq(cmd) {
        const command = [32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, cmd];
        deviceWrite(command, io);
    }

    async deviceWrite(data, mode){
        let writeUuid;
        if(mode == 'control'){
            writeUuid = this.wrUuid;
        }else if(mode == 'io'){
            writeUuid = this.wrIoUuid;
        }else{
          return;
        }

        const characteristic = await getCharacteristic(
              this.device, this.svUuid, writeUuid);
        await characteristic.writeValue(new Uint8Array(data)).catch(e => {
            onScreenLog(`Write value to device ${characteristic.uuid}: ${e}`);
            throw e;
        });
    }

    async deviceRead() {
        const readCmdCharacteristic = await getCharacteristic(
            this.device, this.svUuid, this.rdIoUuid);

        const valueBuffer = await readCharacteristic(readCmdCharacteristic).catch(e => {
            onScreenLog('Read Value  : ' + "error");
            return null;
        });

        onScreenLog('Read Value  : ' + valueBuffer);
        return valueBuffer;
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
}
