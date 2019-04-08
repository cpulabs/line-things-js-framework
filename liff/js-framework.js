
class ThingsConn {
  constructor(svUuid, writeUuid, readUuid) {
    this.svUuid = svUuid;
    this.wrUuid = writeUuid;
    this.rdUuid = readUuid;
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
