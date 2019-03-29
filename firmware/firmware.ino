/**
 * User sample firmware for LINE Things development board
 * リポジトリの /liff-app/linethings-dev-user にある LIFF と組み合わせて利用
 */

#include <bluefruit.h>
#include <Bluefruit_FileIO.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <SparkFun_MMA8452Q.h>
#include <linethings_temp.h>

// BLE Service UUID
#define USER_SERVICE_UUID "981b0d79-2855-44f4-aa14-3c34012a3dd3"
#define USER_CHARACTERISTIC_NOTIFY_UUID "e10d036f-b248-4845-adff-d8f73a85321b"
#define USER_CHARACTERISTIC_READ_UUID "1737f2f4-c3d3-453b-a1a6-9efe69cc944f"
#define USER_CHARACTERISTIC_WRITE_UUID "5136e866-d081-47d3-aabc-a2c9518bacd4"
#define PSDI_SERVICE_UUID "e625601e-9e55-4597-a598-76018a0d293d"
#define PSDI_CHARACTERISTIC_UUID "26e2b12b-85f0-4f3f-9fdd-91d114270e6e"

#define BLE_DEV_NAME "LINE Things JS control"

#define SW1 29
#define SW2 28
#define LED_DS2 7
#define LED_DS3 11
#define LED_DS4 19
#define LED_DS5 17
#define GPIO2 2
#define GPIO3 3
#define GPIO4 4
#define GPIO5 5
#define GPIO12 12
#define GPIO13 13
#define GPIO14 14
#define GPIO15 15
#define GPIO16 16

/*********************************************************************************
* I2C Peripherals
*********************************************************************************/
// ディスプレイ (SSD1306) のインスタンスを生成
Adafruit_SSD1306 display(128, 64, &Wire, -1);
// 加速度センサ (MMA8452) のインスタンスを生成
MMA8452Q accel(0x1C);
// 温度センサ (AT30TS74) のインスタンスを生成
ThingsTemp temp = ThingsTemp();

/*********************************************************************************
* Buzzer
*********************************************************************************/
#define BUZZER_PIN 27
SoftwareTimer buzzer;

// ブザーを鳴らすために 1kHz の周期でイベントを生成
void buzzerEvent(TimerHandle_t xTimerID) {
  digitalWrite(BUZZER_PIN, !digitalRead(BUZZER_PIN));
}

void buzzerStart() {
  pinMode(BUZZER_PIN, OUTPUT);
  buzzer.begin(1, buzzerEvent);
  buzzer.start();
}

void buzzerStop() {
  buzzer.stop();
  digitalWrite(BUZZER_PIN, 0);
}

/*********************************************************************************
* BLE settings
*********************************************************************************/
// Advertising service UUID
uint8_t blesv_user_uuid[16];
BLEService blesv_user = BLEService(blesv_user_uuid);

// LINE Things PSDI service
uint8_t blesv_line_uuid[16];
uint8_t blesv_line_product_uuid[16];
BLEService blesv_line = BLEService(blesv_line_uuid);
BLECharacteristic blesv_line_product = BLECharacteristic(blesv_line_product_uuid);

// LINE Things development board service
uint8_t blesv_devboard_uuid[16];
uint8_t blesv_devboard_notify_uuid[16];
uint8_t blesv_devboard_write_uuid[16];
uint8_t blesv_devboard_read_uuid[16];
BLEService blesv_devboard = BLEService(blesv_devboard_uuid);
BLECharacteristic blesv_devboard_notify = BLECharacteristic(blesv_devboard_notify_uuid);
BLECharacteristic blesv_devboard_write = BLECharacteristic(blesv_devboard_write_uuid);
BLECharacteristic blesv_devboard_read = BLECharacteristic(blesv_devboard_read_uuid);

// UUID Converter
void strUUID2Bytes(String strUUID, uint8_t binUUID[]) {
  String hexString = String(strUUID);
  hexString.replace("-", "");

  for (int i = 16; i != 0; i--) {
    binUUID[i - 1] =
        hex2c(hexString[(16 - i) * 2], hexString[((16 - i) * 2) + 1]);
  }
}

char hex2c(char c1, char c2) { return (nibble2c(c1) << 4) + nibble2c(c2); }

char nibble2c(char c) {
  if ((c >= '0') && (c <= '9')) return c - '0';
  if ((c >= 'A') && (c <= 'F')) return c + 10 - 'A';
  if ((c >= 'a') && (c <= 'f')) return c + 10 - 'a';
  return 0;
}

void bleConfigure(int power) {
  // UUID setup
  strUUID2Bytes(PSDI_SERVICE_UUID, blesv_line_uuid);
  strUUID2Bytes(PSDI_CHARACTERISTIC_UUID, blesv_line_product_uuid);
  strUUID2Bytes(USER_SERVICE_UUID, blesv_devboard_uuid);
  //strUUID2Bytes(DEFAULT_ADVERTISE_UUID, uuid128);
  strUUID2Bytes(USER_CHARACTERISTIC_NOTIFY_UUID, blesv_devboard_notify_uuid);
  strUUID2Bytes(USER_CHARACTERISTIC_READ_UUID, blesv_devboard_read_uuid);
  strUUID2Bytes(USER_CHARACTERISTIC_WRITE_UUID, blesv_devboard_write_uuid);
  // BLE start
  Bluefruit.begin();
  // Set max Tx power
  // Accepted values are: -40, -30, -20, -16, -12, -8, -4, 0, 4
  Bluefruit.setTxPower(power);

  // BLE devicename
  Bluefruit.setName(BLE_DEV_NAME);
  Bluefruit.setConnInterval(12, 1600);  // connection interval min=20ms, max=2s
  // Set the connect/disconnect callback handlers
  Bluefruit.setConnectCallback(bleConnectEvent);
  Bluefruit.setDisconnectCallback(bleDisconnectEvent);
}

void bleStartAdvertising(void) {
  Bluefruit.Advertising.addFlags(BLE_GAP_ADV_FLAGS_LE_ONLY_GENERAL_DISC_MODE);
  Bluefruit.Advertising.addTxPower();
  Bluefruit.Advertising.setFastTimeout(0);
  Bluefruit.Advertising.setInterval(32, 32);  // interval : 20ms
  Bluefruit.Advertising.restartOnDisconnect(true);
  Bluefruit.Advertising.addService(blesv_devboard);
  Bluefruit.ScanResponse.addName();
  Bluefruit.Advertising.start();
}

void bleSetupServicePsdi(void) {
  blesv_line.begin();
  blesv_line_product.setProperties(CHR_PROPS_READ);
  blesv_line_product.setPermission(SECMODE_ENC_NO_MITM, SECMODE_ENC_NO_MITM);
  blesv_line_product.setFixedLen(sizeof(uint32_t) * 2);
  blesv_line_product.begin();
  uint32_t deviceAddr[] = {NRF_FICR->DEVICEADDR[0], NRF_FICR->DEVICEADDR[1]};
  blesv_line_product.write(deviceAddr, sizeof(deviceAddr));
}

void bleSetupServiceDevice() {
  blesv_devboard.begin();

  blesv_devboard_notify.setProperties(CHR_PROPS_NOTIFY);
  blesv_devboard_notify.setPermission(SECMODE_ENC_NO_MITM, SECMODE_ENC_NO_MITM);
  blesv_devboard_notify.setFixedLen(16);
  blesv_devboard_notify.begin();

  blesv_devboard_write.setProperties(CHR_PROPS_WRITE);
  blesv_devboard_write.setPermission(SECMODE_ENC_NO_MITM, SECMODE_ENC_NO_MITM);
  blesv_devboard_write.setWriteCallback(bleWriteEvent);
  blesv_devboard_write.setFixedLen(20);
  blesv_devboard_write.begin();

  blesv_devboard_read.setProperties(CHR_PROPS_READ);
	blesv_devboard_read.setPermission(SECMODE_ENC_NO_MITM, SECMODE_ENC_NO_MITM);
	blesv_devboard_read.setFixedLen(4);
	blesv_devboard_read.begin();
}

void bleSetupServiceUser() {
  blesv_user.begin();
}


// Event for connect BLE central
void bleConnectEvent(uint16_t conn_handle) {
  char central_name[32] = {0};
  uint8_t central_addr[6];
  Bluefruit.Gap.getPeerAddr(conn_handle, central_addr);
  Bluefruit.Gap.getPeerName(conn_handle, central_name, sizeof(central_name));

  Serial.print("Connected from ");
  Serial.println(central_name);
}

// Event for disconnect BLE central
void bleDisconnectEvent(uint16_t conn_handle, uint8_t reason) {
  (void)reason;
  (void)conn_handle;
  Serial.println("BLE central disconnect");
}

typedef struct ble_io_action{
  byte changed = 0;
  int port = 0;
  int value = 0;
} bleIoAction;

volatile bleIoAction g_led;
volatile bleIoAction g_buzzer;

volatile bleIoAction g_gpio_dir;
volatile bleIoAction g_gpio_w_value;
volatile bleIoAction g_gpio_aw_value;

typedef struct ble_display_action{
  byte changed = 0;
  byte clear = 0;
  int addr_x = 0;
  int addr_y = 0;
} bleDispAction;

typedef struct ble_display_text_action{
  byte changed = 0;
  char text[16];
  byte length = 0;
} bleDispTextAction;

volatile bleDispAction g_display;
volatile bleDispTextAction g_display_text;

typedef struct ble_i2c_action{
  byte changed = 0;
  byte data = 0;
} bleI2cAction;


volatile bleI2cAction g_i2c_start_transaction;
volatile bleI2cAction g_i2c_w_value;
volatile int g_i2c_stop_transaction;
volatile bleI2cAction g_i2c_request_from;
volatile int g_i2c_read_req;

volatile int g_gpio_r_port;
volatile int g_gpio_ar_port;

typedef struct ble_read_action{
  byte changed = 0;
  byte cmd = 0;
} bleReadAction;

volatile bleReadAction g_read_action;

/**
 * Write to device format
 * <CMD(1Byte), Payload(17Byte)>
 *  CMD0 : Control display
 *    Payload : don't care(14Byte), clear flag(1Byte), address_x(1Byte), address_y(1Byte)
 *  CMD1 : Write Text
 *    Payload : text length(1Byte), String(16Byte)
 *  CMD2 : Write LED
 *    Payload : don't care(15Byte), port(1Byte), value(1Byte)
 *  CMD3 : Write Buzzer
 *    Payload : don't care(16Byte), value(1Byte)
 *  CMD4 : Set GPIO digital direction
 *    Payload : don't care(15Byte), port(1Byte), direction(1Byte)
 *  CMD5 : Digital Write GPIO
 *    Payload : don't care(15Byte), port(1Byte), value(1Byte)
 *  CMD6 : Analog Write GPIO
 *    Payload : don't care(15Byte), port(1Byte), value(1Byte)
 *  CMD7 : I2C Start transaction
 *    Payload : don't care(16Byte), address(1Byte)
 *  CMD8 : I2C Write data
 *    Payload : don't care(16Byte), address(1Byte)
 *  CMD9 : I2C Stop transaction
 *    Payload : don't care(17Byte)
 *  CMD10 : I2C Request from
 *    Payload : don't care(16Byte), address(1Byte)
 *  CMD11 : I2C Read request
 *    Payload : don't care(17Byte)
 *  CMD12 : Set port for read digital value
 *    Payload : don't care(16Byte), port(1Byte)
 *  CMD13 : Set port for read analog value
 *    Payload : don't care(16Byte), port(1Byte)
 *  CMD32 : Set BLE Read data
 *    Payload : don't care(16Byte), Read CMD(1Byte)
 *
 *
 * Read to device format(Read CMD)
 * <Payload(4Byte)>
 *  CMD0 : Switch status
 *    Payload : don't care(3Byte), switch value(1Byte)
 *  CMD1 : Accel value
 *    Payload : don't care(1Byte), X(1Byte), Y(1Byte), Z(1Byte)
 *  CMD2 : Temperature value
 *    Payload : don't care(2Byte), value(2Byte)
 *  CMD3 : Read Digital GPIO value (using by BLE write pointer CMD13)
 *    Payload : don't care(3Byte), value(1Byte)
 *  CMD4 : Read Analog GPIO value (using by BLE write pointer CMD14)
 *    Payload : don't care(3Byte), value(1Byte)
 *  CMD5 : I2C Read
 *    Payload : don't care(2Byte), flag(1Byte), value(1Byte)
 */

void bleWriteEvent(BLECharacteristic& chr, uint8_t* data, uint16_t len, uint16_t offset) {
  byte cmd = data[0];

  switch(cmd){
    case 0 :
      g_display.changed = 1;
      g_display.clear = data[15];
      g_display.addr_x = data[16];
      g_display.addr_y = data[17];
      break;
    case 1:
      g_display_text.changed = 1;
      g_display_text.length = data[1];
      for(int i = 0; i = 16; i++){
        g_display_text.text[i] = data[1 + i];
      }
      break;
    case 2 :
      g_led.changed = 1;
      g_led.port = data[16];
      g_led.value = data[17];
      break;
    case 3 :
      g_buzzer.changed = 1;
      g_buzzer.port = data[16];
      g_buzzer.value = data[17];
      break;
    case 4 :
      g_gpio_dir.changed = 1;
      g_gpio_dir.port = data[16];
      g_gpio_dir.value = data[17];
      break;
    case 5:
      g_gpio_w_value.changed = 1;
      g_gpio_w_value.port = data[16];
      g_gpio_w_value.value = data[17];
      break;
    case 6:
      g_gpio_aw_value.changed = 1;
      g_gpio_aw_value.port = data[16];
      g_gpio_aw_value.value = data[17];
      break;
    case 7:
      g_i2c_start_transaction.changed = 1;
      g_i2c_start_transaction.data = data[17];
      break;
    case 8:
      g_i2c_w_value.changed = 1;
      g_i2c_w_value.data = data[17];
      break;
    case 9:
      g_i2c_stop_transaction = 1;
      break;
    case 10:
      g_i2c_request_from.changed = 1;
      g_i2c_request_from.data = data[17];
      break;
    case 11:
      g_i2c_read_req = 1;
      break;
    case 12:
      g_gpio_r_port = data[17];
      break;
    case 13:
      g_gpio_ar_port = data[17];
      break;
    case 14:
      g_read_action.changed = 1;
      g_read_action.cmd = data[17];
      break;
    default:
      break;
  }
  Serial.print("Get write event");
}


/*********************************************************************************
* SW Event
*********************************************************************************/
volatile int g_flag_sw1 = 0;
void sw1ChangedEvent() { g_flag_sw1 = 1; }

volatile int g_flag_sw2 = 0;
void sw2ChangedEvent() { g_flag_sw2 = 1; }

/*********************************************************************************
* Control - On board devices
*********************************************************************************/
void displayClear(){
  Serial.println("[BLE]DISP : clear display");
  display.clearDisplay();  // ディスプレイのバッファを初期化
  display.display();       // ディスプレイのバッファを表示
}

void displaySetConfigure(int font, int addr_x, int addr_y){
  Serial.println("[BLE]DISP : write configure");
  display.clearDisplay();       // ディスプレイのバッファを初期化
  display.setTextSize(font);
  display.setTextColor(WHITE);  // Color White
  display.setCursor(addr_x, addr_y);
}


void displayWrite(String text){
  display.print(text);
  display.display();            // ディスプレイを更新
}

unsigned int swGetValue(unsigned int sw){
  Serial.println("[BLE]SW : read switch value");
  unsigned int pin;
  if(sw == 1){
    pin = SW1;
  }else{
    pin = SW2;
  }
  return digitalRead(pin);
}

void ledWrite(unsigned int num, unsigned data){
  Serial.println("[BLE]LED : write led value");
  unsigned int pin;
  switch(num){
    case 2 : pin = LED_DS2; break;
    case 3 : pin = LED_DS3; break;
    case 4 : pin = LED_DS4; break;
    case 5 : pin = LED_DS5; break;
    default : pin = LED_DS2; break;
  }
  digitalWrite(pin, data);
}

void buzzerWrite(unsigned int data){
  Serial.println("[BLE]BUZZER : write buzzer");
  if(data){
    buzzerStart();
  }else{
    buzzerStop();
  }
}

float tempRead(){
  Serial.println("[BLE]Temperature : read value");
  return temp.read();
}


void accelRead(float data[3]){
  Serial.println("[BLE]Accel : read value");
  accel.read();
  data[0] = accel.x;
  data[1] = accel.y;
  data[2] = accel.z;
}

void i2cBeginTransaction(byte address){
  Serial.println("[BLE]I2C : begin transaction");
  Wire.beginTransmission(address);
};

void i2cWrite(byte data){
  Serial.println("[BLE]I2C : write data");
  Wire.write(data);
};

void i2cEndTransaction(){
  Serial.println("[BLE]I2C : end transaction");
  Wire.endTransmission();
}

void i2cRequestFrom(byte address){
  Serial.println("[BLE]I2C : request from");
  Wire.requestFrom(address, 2);
}

byte i2cRead(){
  Serial.println("[BLE]I2C : read");
  return Wire.read();
}

/*********************************************************************************
* Control - IO
*********************************************************************************/
void ioDigitalDir(unsigned int pin, unsigned int dir){
  Serial.println("[BLE]GPIO : set digital dir");
  pinMode(pin, (dir && 1)? OUTPUT : INPUT);
}

void ioDigitalWrite(unsigned int pin, unsigned int data){
  Serial.println("[BLE]GPIO : write digital value");
  digitalWrite(pin, data);
}

unsigned int ioDigitalRead(unsigned pin){
  Serial.println("[BLE]GPIO : read digital value");
  return digitalRead(pin);
}

void ioAnalogWrite(int pin, int pwm){
  Serial.println("[BLE]GPIO : write analog value");
  //
}

unsigned int ioAnalogRead(int pin){
  Serial.println("[BLE]GPIO : write analog value");
  //
}

/*********************************************************************************
* Setup
*********************************************************************************/
void setup() {
  // Serial通信初期化
  Serial.begin(9600);

  //スイッチを入力に設定
  pinMode(SW1, INPUT_PULLUP);
  pinMode(SW2, INPUT_PULLUP);

  // LEDを出力に設定
  pinMode(LED_DS2, OUTPUT);
  pinMode(LED_DS3, OUTPUT);
  pinMode(LED_DS4, OUTPUT);
  pinMode(LED_DS5, OUTPUT);
  digitalWrite(LED_DS2, 0);
  digitalWrite(LED_DS3, 0);
  digitalWrite(LED_DS4, 0);
  digitalWrite(LED_DS5, 0);
  // IOの初期状態を入力に
  pinMode(GPIO2, INPUT_PULLUP);
  pinMode(GPIO3, INPUT_PULLUP);
  pinMode(GPIO4, INPUT_PULLUP);
  pinMode(GPIO5, INPUT_PULLUP);
  pinMode(GPIO12, INPUT_PULLUP);
  pinMode(GPIO13, INPUT_PULLUP);
  pinMode(GPIO14, INPUT_PULLUP);
  pinMode(GPIO15, INPUT_PULLUP);
  pinMode(GPIO16, INPUT_PULLUP);

  // ディスプレイの初期化
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);  // ディスプレイの表示に必要な電圧を生成, アドレスは 0x3C
  display.print("User JS sample");
  display.clearDisplay();  // ディスプレイのバッファを初期化
  display.display();       // ディスプレイのバッファを表示

  // 加速度センサの初期化
  accel.init(SCALE_2G);

  // 温度センサの初期化
  temp.init();

  bleConfigure(0);
  Serial.println("BLE transmitter power : 0dBm");
  bleSetupServicePsdi();
  bleSetupServiceDevice();
  bleSetupServiceUser();
  bleStartAdvertising();

  // SW 割り込みを設定
  attachInterrupt(SW1, sw1ChangedEvent, CHANGE);
  attachInterrupt(SW2, sw2ChangedEvent, CHANGE);
}

void loop() {
  byte i2cReadData = 0;
  unsigned int temp = 0;
  float accelData[3] = {0, 0, 0};

  for(;;){
    //LED
    if(g_led.changed){
      ledWrite(g_led.port, g_led.value);
      g_led.changed = 0;
    }
    //Buzzer
    if(g_buzzer.changed){
      buzzerWrite(g_buzzer.value);
      g_buzzer.changed = 0;
    }
    //GPIO Direction
    if(g_gpio_dir.changed){
      ioDigitalDir(g_gpio_dir.port, g_gpio_dir.value);
      g_gpio_dir.changed = 0;
    }
    //GPIO Digital Write
    if(g_gpio_w_value.changed){
      ioDigitalWrite(g_gpio_w_value.port, g_gpio_w_value.value);
      g_gpio_w_value.changed = 0;
    }
    //GPIO Analog write
    if(g_gpio_aw_value.changed){
      ioAnalogWrite(g_gpio_aw_value.port, g_gpio_aw_value.value);
      g_gpio_aw_value.changed = 0;
    }
    //Display Control
    if(g_display.changed){
      if(g_display.clear){
        displayClear();
      }
      displaySetConfigure(2, g_display.addr_x, g_display.addr_y);
      g_display.changed = 0;
    }
    //Display Write text
    if(g_display_text.changed){
      displayWrite("test");
      g_display_text.changed = 0;
    }
    //I2C start transaction
    if(g_i2c_start_transaction.changed){
      i2cBeginTransaction(g_i2c_start_transaction.data);
      g_i2c_start_transaction.changed = 0;
    }
    //I2C write data
    if(g_i2c_w_value.changed){
      i2cWrite(g_i2c_w_value.data);
      g_i2c_w_value.changed = 0;
    }
    //I2C stop transaction
    if(g_i2c_stop_transaction){
      i2cEndTransaction();
      g_i2c_stop_transaction = 0;
    }
    //I2C request from
    if(g_i2c_request_from.changed){
      i2cRequestFrom(g_i2c_request_from.data);
      g_i2c_request_from.changed = 0;
    }
    //I2C Read
    if(g_i2c_read_req){
      g_i2c_read_req = 0;
      i2cReadData = i2cRead();
    }

    //BLE Read action
    if(g_read_action.changed){
      byte data[4] = {0, 0, 0, 0};
      switch(g_read_action.cmd){
        case 0:
          data[2] = swGetValue(2);
          data[3] = swGetValue(1);
          break;
        case 1:
          accelRead(accelData);
          data[1] = accelData[0];
          data[2] = accelData[1];
          data[3] = accelData[2];
          break;
        case 2:
          temp = tempRead() * 100;
          data[2] = temp >> 8;
          data[3] = temp & 0xff;
          break;
        case 3:
          data[3] = ioDigitalRead(g_gpio_r_port);
          break;
        case 4:
          data[3] = ioAnalogRead(g_gpio_ar_port);
          break;
        case 5:
          data[2] = 1;
          data[3] = i2cReadData;
          break;
        default:
          break;
      }

      //Set BLE Register
    	blesv_devboard_read.write(data, sizeof(data));
      g_read_action.changed = 0;
    }
  }
}
