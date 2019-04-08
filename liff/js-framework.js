
class ThingsConn {
  constructor(svUuid, writeUuid, readUuid) {
    this.svUuid = svUuid;
    this.wrUuid = writeUuid;
    this.rdUuid = readUuid;
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
          device, this.svUuid, this.wrUuid);
    await characteristic.writeValue(new Uint8Array(command)).catch(e => {
        onScreenLog(`Write text : Error writing ${characteristic.uuid}: ${e}`);
        throw e;
    });
  }


  async writeTextControl(device, addr_x, addr_y) {
    const command = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, addr_x, addr_y];

    const characteristic = await getCharacteristic(
      device, this.svUuid, this.wrUuid);
    await characteristic.writeValue(new Uint8Array(command)).catch(e => {
    //onScreenLog(`Write text control : Error writing ${characteristic.uuid}: ${e}`);
    throw e;
    });
  }

  async function writeFontSize(device, size) {
      const command = [15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, size];

      const characteristic = await getCharacteristic(
            device, this.svUuid, this.wrUuid);
      await characteristic.writeValue(new Uint8Array(command)).catch(e => {
          onScreenLog(`Display : Error write font size ${characteristic.uuid}: ${e}`);
          throw e;
      });
  }

  async function displayClear(device) {
      const command = [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

      const characteristic = await getCharacteristic(
            device, this.svUuid, this.wrUuid);
      await characteristic.writeValue(new Uint8Array(command)).catch(e => {
          onScreenLog(`Display clear : Error writing ${characteristic.uuid}: ${e}`);
          throw e;
      });
  }



  async function ledWrite(device, port, value) {
      const command = [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, port, value];

      const characteristic = await getCharacteristic(
            device, this.svUuid, this.wrUuid);
      await characteristic.writeValue(new Uint8Array(command)).catch(e => {
          onScreenLog(`Write LED : Error writing ${characteristic.uuid}: ${e}`);
          throw e;
      });
  }

  async function buzzerControl(device, value) {
      const command = [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, value];

      const characteristic = await getCharacteristic(
            device, this.svUuid, this.wrUuid);
      await characteristic.writeValue(new Uint8Array(command)).catch(e => {
          onScreenLog(`Buzzer : Error writing ${characteristic.uuid}: ${e}`);
          throw e;
      });
  }

  async function gpioPinMode(device, port, value) {
      const command = [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, port, value];

      const characteristic = await getCharacteristic(
            device, this.svUuid, this.wrUuid);
      await characteristic.writeValue(new Uint8Array(command)).catch(e => {
          onScreenLog(`Buzzer : Error writing ${characteristic.uuid}: ${e}`);
          throw e;
      });
  }

  async function gpioDigitalWrite(device, port, value) {
      const command = [6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, port, value];

      const characteristic = await getCharacteristic(
            device, this.svUuid, this.wrUuid);
      await characteristic.writeValue(new Uint8Array(command)).catch(e => {
          onScreenLog(`Buzzer : Error writing ${characteristic.uuid}: ${e}`);
          throw e;
      });
  }

  async function gpioAnalogWrite(device, port, value) {
      const command = [7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, port, value];

      const characteristic = await getCharacteristic(
            device, this.svUuid, this.wrUuid);
      await characteristic.writeValue(new Uint8Array(command)).catch(e => {
          onScreenLog(`Buzzer : Error writing ${characteristic.uuid}: ${e}`);
          throw e;
      });
  }

  async function i2cStartTransaction(device, address) {
      const command = [8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, address];

      const characteristic = await getCharacteristic(
            device, this.svUuid, this.wrUuid);
      await characteristic.writeValue(new Uint8Array(command)).catch(e => {
          onScreenLog(`I2C : Error start transaction ${characteristic.uuid}: ${e}`);
          throw e;
      });
  }
  async function i2cWrite(device, value) {
      const command = [9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, value];

      const characteristic = await getCharacteristic(
            device, this.svUuid, this.wrUuid);
      await characteristic.writeValue(new Uint8Array(command)).catch(e => {
          onScreenLog(`I2C : Error write data ${characteristic.uuid}: ${e}`);
          throw e;
      });
  }
  async function i2cStopTransaction(device, address) {
      const command = [10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, address];

      const characteristic = await getCharacteristic(
            device, this.svUuid, this.wrUuid);
      await characteristic.writeValue(new Uint8Array(command)).catch(e => {
          onScreenLog(`I2C : Error stop transaction ${characteristic.uuid}: ${e}`);
          throw e;
      });
  }
  async function i2cRequestFrom(device, address) {
      const command = [11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, address];

      const characteristic = await getCharacteristic(
            device, this.svUuid, this.wrUuid);
      await characteristic.writeValue(new Uint8Array(command)).catch(e => {
          onScreenLog(`I2C : Error request from ${characteristic.uuid}: ${e}`);
          throw e;
      });
  }
  async function i2cReadRequest(device) {
      const command = [12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

      const characteristic = await getCharacteristic(
            device, this.svUuid, this.wrUuid);
      await characteristic.writeValue(new Uint8Array(command)).catch(e => {
          onScreenLog(`I2C : Error read request ${characteristic.uuid}: ${e}`);
          throw e;
      });
  }
  async function gpioDigitalReadReq(device, port) {
      const command = [13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, port];

      const characteristic = await getCharacteristic(
            device, this.svUuid, this.wrUuid);
      await characteristic.writeValue(new Uint8Array(command)).catch(e => {
          onScreenLog(`GPIO : Error digital read request ${characteristic.uuid}: ${e}`);
          throw e;
      });
  }
  async function gpioAnalogReadReq(device, port) {
      const command = [14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, port];

      const characteristic = await getCharacteristic(
            device, this.svUuid, this.wrUuid);
      await characteristic.writeValue(new Uint8Array(command)).catch(e => {
          onScreenLog(`I2C : Error analog read request ${characteristic.uuid}: ${e}`);
          throw e;
      });
  }

  async function readReq(device, cmd) {
      const command = [32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, cmd];

      const characteristic = await getCharacteristic(
            device, this.svUuid, this.wrUuid);
      await characteristic.writeValue(new Uint8Array(command)).catch(e => {
          onScreenLog(`Buzzer : Error writing ${characteristic.uuid}: ${e}`);
          throw e;
      });
  }


}


/*

let ThingsConn = function(svUuid, writeUuid, readUuid) {
  if(!(this instanceof ThingsConn)) {
    return new ThingsConn(svUuid, writeUuid, readUuid);
  }

  this.svUuid = svUuid;
  this.wrUuid = writeUuid;
  this.rdUuid = readUuid;


  this.writeTextControl = async function(device, addr_x, addr_y) {
    const command = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, addr_x, addr_y];

    const characteristic = await getCharacteristic(
      device, this.svUuid, this.wrUuid);
    await characteristic.writeValue(new Uint8Array(command)).catch(e => {
    //onScreenLog(`Write text control : Error writing ${characteristic.uuid}: ${e}`);
    throw e;
    });
  }
};

*/
