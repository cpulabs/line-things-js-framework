/**
 * Default firmware for LINE Things development board
 * このファームウェアは2種類の動作モードがあります。
 * - Default mode(通常・出荷時)
 *    このモードはLINE Things dev boardの機能を一通り確かめることができます。
 *    提供しているLIFFを用いて制御できます。
 *    リポジトリの /liff-app/linethings-dev-default にある LIFF と組み合わせて利用します。
 *
 * - JS Control mode
 *    このモードはLINE Things dev board上に搭載されたデバイスと、IOの全てを全てLIFF側から制御できます。
 *    ファームウェアを変更をせずに、JSを用いてデバイスの基本的な機能を全てコントロール可能です。
 *    リポジトリの /liff-app/linethings-dev-jscontrol にある LIFF と組み合わせて利用します。
 */

#include <bluefruit.h>
#include <Bluefruit_FileIO.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <SparkFun_MMA8452Q.h>
#include <linethings_temp.h>

// デバッグのEnable
#define USER_DEBUG        //Debugを無効にするにはコメントアウトを外す

// BLE Default Advertising UUID
//#define DEFAULT_ADVERTISE_UUID "f2b742dc-35e3-4e55-9def-0ce4a209c552"
#define DEFAULT_ADVERTISE_UUID "981b0d79-2855-44f4-aa14-3c34012a3dd3"

// BLE Service UUID
//#define USER_SERVICE_UUID "f2b742dc-35e3-4e55-9def-0ce4a209c552"
#define USER_SERVICE_UUID "981b0d79-2855-44f4-aa14-3c34012a3dd3"
#define USER_CHARACTERISTIC_READ_UUID "e90b4b4e-f18a-44f0-8691-b041c7fe57f2"
#define USER_CHARACTERISTIC_WRITE_UUID "4f2596d7-b3d6-4102-85a2-947b80ab4c6f"
#define USER_CHARACTERISTIC_IO_READ_UUID "1737f2f4-c3d3-453b-a1a6-9efe69cc944f"
#define USER_CHARACTERISTIC_IO_WRITE_UUID "5136e866-d081-47d3-aabc-a2c9518bacd4"
#define PSDI_SERVICE_UUID "e625601e-9e55-4597-a598-76018a0d293d"
#define PSDI_CHARACTERISTIC_UUID "26e2b12b-85f0-4f3f-9fdd-91d114270e6e"

#define BLE_DEV_NAME "LINE Things dev board"

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
* Internal config file
*********************************************************************************/
#define UUID_FILENAME "/uuidconfig.txt"
File file(InternalFS);

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
* Debug print
*********************************************************************************/
void debugPrint(String text){
#ifdef USER_DEBUG
  text = "[DBG]" + text;
  Serial.println(text);
#endif
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
uint8_t blesv_devboard_io_write_uuid[16];
uint8_t blesv_devboard_io_read_uuid[16];
BLEService blesv_devboard = BLEService(blesv_devboard_uuid);
BLECharacteristic blesv_devboard_notify = BLECharacteristic(blesv_devboard_notify_uuid);
BLECharacteristic blesv_devboard_write = BLECharacteristic(blesv_devboard_write_uuid);
BLECharacteristic blesv_devboard_io_write = BLECharacteristic(blesv_devboard_io_write_uuid);
BLECharacteristic blesv_devboard_io_read = BLECharacteristic(blesv_devboard_io_read_uuid);

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
  strUUID2Bytes(USER_CHARACTERISTIC_READ_UUID, blesv_devboard_notify_uuid);
  strUUID2Bytes(USER_CHARACTERISTIC_WRITE_UUID, blesv_devboard_write_uuid);
  strUUID2Bytes(USER_CHARACTERISTIC_IO_READ_UUID, blesv_devboard_io_read_uuid);
  strUUID2Bytes(USER_CHARACTERISTIC_IO_WRITE_UUID, blesv_devboard_io_write_uuid);
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
  // LINE app 側で発見するために User service UUID を必ずアドバタイズパケットに含める
  Bluefruit.Advertising.addUuid(BLEUuid(blesv_user_uuid));
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

  blesv_devboard_io_write.setProperties(CHR_PROPS_WRITE);
  blesv_devboard_io_write.setPermission(SECMODE_ENC_NO_MITM, SECMODE_ENC_NO_MITM);
  blesv_devboard_io_write.setWriteCallback(bleIoWriteEvent);
  blesv_devboard_io_write.setFixedLen(20);
  blesv_devboard_io_write.begin();

  blesv_devboard_io_read.setProperties(CHR_PROPS_READ);
	blesv_devboard_io_read.setPermission(SECMODE_ENC_NO_MITM, SECMODE_ENC_NO_MITM);
	blesv_devboard_io_read.setFixedLen(4);
	blesv_devboard_io_read.begin();
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
  debugPrint(central_name);
}

// Event for disconnect BLE central
void bleDisconnectEvent(uint16_t conn_handle, uint8_t reason) {
  (void)reason;
  (void)conn_handle;
  debugPrint("BLE central disconnect");
}

volatile int g_flag_user_write = 0;
volatile int g_data_user_write_led0 = 0;
volatile int g_data_user_write_led1 = 0;
volatile int g_data_user_write_led2 = 0;
volatile int g_data_user_write_led3 = 0;
volatile int g_data_user_write_buzzer = 0;
volatile int g_data_user_write_io2 = 0;
volatile int g_data_user_write_io3 = 0;
volatile int g_data_user_write_io4 = 0;
volatile int g_data_user_write_io5 = 0;
volatile int g_data_user_write_io12 = 0;
volatile int g_data_user_write_io13 = 0;
volatile int g_data_user_write_io14 = 0;
volatile int g_data_user_write_io15 = 0;
volatile int g_data_user_write_io16 = 0;

volatile int g_flag_update_advertiseuuid = 0;
volatile int g_flag_error_advertiseuuid = 0;

volatile int g_js_control_mode_flag = 0;

/**
 * Format
 * <CMD(1Byte), don't care(2Byte), hash of payload/don'tcare(1Byte), Payload(16Byte)>
 * CMD0 : Write to peripheral device. LED, buzzer and GPIO
 *    CMD0(0:1Byte), don't care(0:17Byte), Peripheral(x:2Byte)
 * CMD1 : Write new service UUID : When update UUID, Should be self restart MPU:
 *    CMD1(1:1Byte), don't care(0,2Byte), hash of payload(x:1Byte),
 *    UUID(x:16Byte) UUID shoud be send binary.
 * CMD4 : Enter to JS Control mode : Firmware will be enter to JS Control mode.
 *    CMD4(4:1Byte), don't care(19Byte)
 */
void bleWriteEvent(BLECharacteristic& chr, uint8_t* data, uint16_t len, uint16_t offset) {
  byte cmd = data[0];
  byte index = data[1];
  byte length = data[2];
  byte hash = data[3];
  int i = 0;

  if (cmd == 0) {
    // Write peripheral device and GPIO
    g_data_user_write_led0 = (data[19] >> 7) & 1;
    g_data_user_write_led1 = (data[19] >> 6) & 1;
    g_data_user_write_led2 = (data[19] >> 5) & 1;
    g_data_user_write_led3 = (data[19] >> 4) & 1;
    g_data_user_write_buzzer = (data[19] >> 3) & 1;
    g_data_user_write_io2 = (data[19] >> 2) & 1;
    g_data_user_write_io3 = (data[19] >> 1) & 1;
    g_data_user_write_io4 = data[19] & 1;
    g_data_user_write_io5 = (data[18] >> 7) & 1;
    g_data_user_write_io12 = (data[18] >> 6) & 1;
    g_data_user_write_io13 = (data[18] >> 5) & 1;
    g_data_user_write_io14 = (data[18] >> 4) & 1;
    g_data_user_write_io15 = (data[18] >> 3) & 1;
    g_data_user_write_io16 = (data[18] >> 2) & 1;
    g_flag_user_write = 1;
  } else if (cmd == 1) {
    // Write New Advertising UUID
    byte generatedHash = 0;
    for (int i = 0; i < 16; i++) {
      blesv_user_uuid[15 - i] = data[4 + i];
      generatedHash += data[4 + i];
    }

    Serial.println("UUID Change!!!!!!!!!!!!!!!!!!!!!!!!!!!");

    g_flag_update_advertiseuuid = 1;

    if (generatedHash != hash) {
      g_flag_error_advertiseuuid = 1;
    }
  }else if (cmd == 4) {
    g_js_control_mode_flag = 1;
  }
}

typedef struct ble_io_action{
  byte changed = 0;
  int port = 0;
  int value = 0;
} bleIoAction;

typedef struct ble_display_action{
  byte changed = 0;
  int addr_x = 0;
  int addr_y = 0;
} bleDispAction;

typedef struct ble_display_text_action{
  byte changed = 0;
  char text[16];
  byte length = 0;
} bleDispTextAction;

typedef struct ble_i2c_action{
  byte changed = 0;
  byte data = 0;
} bleI2cAction;

typedef struct ble_read_action{
  byte changed = 0;
  byte cmd = 0;
} bleReadAction;

volatile bleIoAction g_led;
volatile bleIoAction g_buzzer;

volatile bleIoAction g_gpio_dir;
volatile bleIoAction g_gpio_w_value;
volatile bleIoAction g_gpio_aw_value;

volatile bleDispAction g_display;
volatile int g_display_clear = 0;
volatile bleDispTextAction g_display_text;
volatile int g_display_fontsize = 0;

volatile bleI2cAction g_i2c_start_transaction;
volatile bleI2cAction g_i2c_w_value;
volatile int g_i2c_stop_transaction;
volatile bleI2cAction g_i2c_request_from;
volatile int g_i2c_read_req;

volatile int g_gpio_r_port;
volatile int g_gpio_ar_port;

volatile bleReadAction g_read_action;

/**
 * Write to device format
 * <CMD(1Byte), Payload(17Byte)>
 *  CMD0 : Control display
 *    Payload : don't care(15Byte), address_x(1Byte), address_y(1Byte)
 *  CMD1 : Write Text
 *    Payload : text length(1Byte), String(16Byte)
 *  CMD2 : Clear display
 *    Payload : don't care(17Byte)
 *  CMD3 : Write LED
 *    Payload : don't care(15Byte), port(1Byte), value(1Byte)
 *  CMD4 : Write Buzzer
 *    Payload : don't care(16Byte), value(1Byte)
 *  CMD5 : Set GPIO digital direction
 *    Payload : don't care(15Byte), port(1Byte), direction(1Byte)
 *  CMD6 : Digital Write GPIO
 *    Payload : don't care(15Byte), port(1Byte), value(1Byte)
 *  CMD7 : Analog Write GPIO
 *    Payload : don't care(15Byte), port(1Byte), value(1Byte)
 *  CMD8 : I2C Start transaction
 *    Payload : don't care(16Byte), address(1Byte)
 *  CMD9 : I2C Write data
 *    Payload : don't care(16Byte), address(1Byte)
 *  CMD10 : I2C Stop transaction
 *    Payload : don't care(17Byte)
 *  CMD11 : I2C Request from
 *    Payload : don't care(16Byte), address(1Byte)
 *  CMD12 : I2C Read request
 *    Payload : don't care(17Byte)
 *  CMD13 : Set port for read digital value
 *    Payload : don't care(16Byte), port(1Byte)
 *  CMD14 : Set port for read analog value
 *    Payload : don't care(16Byte), port(1Byte)
 *  CMD15 : Display write font size
 *    Payload : don't care(16Byte), fontsize(1Byte)
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

void bleIoWriteEvent(BLECharacteristic& chr, uint8_t* data, uint16_t len, uint16_t offset) {
  byte cmd = data[0];
  switch(cmd){
    case 0 :
      g_display.changed = 1;
      g_display.addr_x = data[16];
      g_display.addr_y = data[17];
      break;
    case 1:
      g_display_text.changed = 1;
      g_display_text.length = data[1];
      for(int i = 0; i < 16; i++){
        g_display_text.text[i] = data[2 + i];
      }
      break;
    case 2:
      g_display_clear = 1;
      break;
    case 3 :
      g_led.changed = 1;
      g_led.port = data[16];
      g_led.value = data[17];
      break;
    case 4 :
      g_buzzer.changed = 1;
      g_buzzer.port = data[16];
      g_buzzer.value = data[17];
      break;
    case 5 :
      g_gpio_dir.changed = 1;
      g_gpio_dir.port = data[16];
      g_gpio_dir.value = data[17];
      break;
    case 6:
      g_gpio_w_value.changed = 1;
      g_gpio_w_value.port = data[16];
      g_gpio_w_value.value = data[17];
      break;
    case 7:
      g_gpio_aw_value.changed = 1;
      g_gpio_aw_value.port = data[16];
      g_gpio_aw_value.value = data[17];
      break;
    case 8:
      g_i2c_start_transaction.changed = 1;
      g_i2c_start_transaction.data = data[17];
      break;
    case 9:
      g_i2c_w_value.changed = 1;
      g_i2c_w_value.data = data[17];
      break;
    case 10:
      g_i2c_stop_transaction = 1;
      break;
    case 11:
      g_i2c_request_from.changed = 1;
      g_i2c_request_from.data = data[17];
      break;
    case 12:
      g_i2c_read_req = 1;
      break;
    case 13:
      g_gpio_r_port = data[17];
      break;
    case 14:
      g_gpio_ar_port = data[17];
      break;
    case 15:
      g_display_fontsize = data[17];
      break;
    case 32:
      g_read_action.changed = 1;
      g_read_action.cmd = data[17];
      break;
    default:
      break;
  }
  debugPrint("[BLE]Write event done");
}

/*********************************************************************************
* Timer
*********************************************************************************/
volatile int g_flag_display = 0;
SoftwareTimer timerDisplay;
void displayUpdateEvent(TimerHandle_t xTimerID) { g_flag_display = 1; }

volatile int g_flag_notify = 0;
SoftwareTimer timerNotify;
void bleNotifyEvent(TimerHandle_t xTimerID) { g_flag_notify = 1; }

/*********************************************************************************
* SW Event
*********************************************************************************/
volatile int g_flag_sw1 = 0;
void sw1ChangedEvent() { g_flag_sw1 = 1; }

volatile int g_flag_sw2 = 0;
void sw2ChangedEvent() { g_flag_sw2 = 1; }

/*********************************************************************************
* UUID Configure data
*********************************************************************************/
void configFileWrite(uint8_t binUuid[]) {
  int i = 0;

  if (file.open(UUID_FILENAME, FILE_WRITE)) {
    file.seek(0);

    for (i = 0; i < 16; i++) {
      file.write(binUuid[i]);
    }
    file.close();
  } else {
    debugPrint("Write UUID : Failed!");
  }
}

void configFileRead() {
  file.open(UUID_FILENAME, FILE_READ);
  file.read(blesv_user_uuid, sizeof(blesv_user_uuid));
  file.close();
}

// -1 : not found
int configFileExist() {
  file.open(UUID_FILENAME, FILE_READ);
  if (!file) {
    file.close();
    return -1;
  }
  file.close();
  return 0;
}

int compareUuid(uint8_t uuid1[], uint8_t uuid2[]){
  for (int i = 0; i < 16; i++) {
    if (uuid1[i] != uuid2[i]) {
      return -1;
    }
  }
  return 0;
}

/*********************************************************************************
* Control - On board devices
*********************************************************************************/
void displayClear(){
  debugPrint("[BLE]DISP : clear display");
  display.clearDisplay();  // ディスプレイのバッファを初期化
  display.display();       // ディスプレイのバッファを表示
}

void displaySetConfigure(int addr_x, int addr_y){
  debugPrint("[BLE]DISP : write configure");
  display.clearDisplay();       // ディスプレイのバッファを初期化
  display.setTextColor(WHITE);  // Color White
  display.setCursor(addr_x, addr_y);
}

void displayWrite(int fontsize, int length, char ch[16]){
  debugPrint("[BLE]DISP : write text");
  display.setTextSize(fontsize);
  for(int i = 0; i < length; i++){
    display.print(ch[i]);
  }
  display.display();            // ディスプレイを更新
}

unsigned int swGetValue(unsigned int sw){
  debugPrint("[BLE]SW : read switch value");
  unsigned int pin;
  if(sw == 1){
    pin = SW1;
  }else{
    pin = SW2;
  }
  return digitalRead(pin);
}

void ledWrite(unsigned int num, unsigned data){
  debugPrint("[BLE]LED : write led value");
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
  debugPrint("[BLE]BUZZER : write buzzer");
  if(data){
    buzzerStart();
  }else{
    buzzerStop();
  }
}

float tempRead(){
  debugPrint("[BLE]Temperature : read value");
  return temp.read();
}

void accelRead(float data[3]){
  debugPrint("[BLE]Accel : read value");
  accel.read();
  data[0] = accel.x;
  data[1] = accel.y;
  data[2] = accel.z;
}

void i2cBeginTransaction(byte address){
  debugPrint("[BLE]I2C : begin transaction");
  Wire.beginTransmission(address);
};

void i2cWrite(byte data){
  debugPrint("[BLE]I2C : write data");
  Wire.write(data);
};

void i2cEndTransaction(){
  debugPrint("[BLE]I2C : end transaction");
  Wire.endTransmission();
}

void i2cRequestFrom(byte address){
  debugPrint("[BLE]I2C : request from");
  Wire.requestFrom(address, 2);
}

byte i2cRead(){
  debugPrint("[BLE]I2C : read");
  return Wire.read();
}

/*********************************************************************************
* Control - IO
*********************************************************************************/
void ioDigitalDir(unsigned int pin, unsigned int dir){
  debugPrint("[BLE]GPIO : set digital dir");
  pinMode(pin, (dir && 1)? OUTPUT : INPUT);
}

void ioDigitalWrite(unsigned int pin, unsigned int data){
  debugPrint("[BLE]GPIO : write digital value");
  digitalWrite(pin, data);
}

unsigned int ioDigitalRead(unsigned pin){
  debugPrint("[BLE]GPIO : read digital value");
  return digitalRead(pin);
}

void ioAnalogWrite(int pin, int pwm){
  debugPrint("[BLE]GPIO : write analog value");
  analogWrite(pin, pwm);
}

int ioAnalogRead(int pin){
  int readValue = analogRead(pin);
  debugPrint("[BLE]GPIO : write analog value");
  return readValue;
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
  // IOを設定
  pinMode(GPIO2, OUTPUT);
  pinMode(GPIO3, OUTPUT);
  pinMode(GPIO4, OUTPUT);
  pinMode(GPIO5, OUTPUT);
  pinMode(GPIO12, OUTPUT);
  pinMode(GPIO13, OUTPUT);
  pinMode(GPIO14, OUTPUT);
  pinMode(GPIO15, OUTPUT);
  pinMode(GPIO16, OUTPUT);
  digitalWrite(GPIO2, 0);
  digitalWrite(GPIO3, 0);
  digitalWrite(GPIO4, 0);
  digitalWrite(GPIO5, 0);
  digitalWrite(GPIO12, 0);
  digitalWrite(GPIO13, 0);
  digitalWrite(GPIO14, 0);
  digitalWrite(GPIO15, 0);
  digitalWrite(GPIO16, 0);
  // ディスプレイの初期化
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);  // ディスプレイの表示に必要な電圧を生成, アドレスは 0x3C
  display.clearDisplay();  // ディスプレイのバッファを初期化
  display.display();       // ディスプレイのバッファを表示
  // 加速度センサの初期化
  accel.init(SCALE_2G);
  // 温度センサの初期化
  temp.init();
  // ADC initialize
  analogReference(AR_VDD4);		  //ADC reference = VDD
  analogReadResolution(10);			//ADC 10bit
  // Load advertising UUID config
  InternalFS.begin();
  // 起動時に SW1 を押しっぱなしか、設定ファイルが見つからない場合は
  // Advertise packet UUID をデフォルトに初期化する
  if (!digitalRead(SW1) || configFileExist() == -1) {
    uint8_t uuid128[16];
    strUUID2Bytes(DEFAULT_ADVERTISE_UUID, uuid128);
    configFileWrite(uuid128);
    String message = "Set advertising UUID to default.";
    debugPrint(message);
    display.clearDisplay();       // ディスプレイのバッファを初期化
    display.setTextSize(1);       // テキストサイズ 1
    display.setTextColor(WHITE);  // Color White
    display.setCursor(0, 10);     // X=0, Y=10
    display.println(message);
    display.display();            // ディスプレイを更新
    delay(5000);
  }

  // File.open(UUID_FILENAME, FILE_READ);
  configFileRead();
  // UUIDが初期状態のものであれば出力を最低にする
  uint8_t uuid128[16];
  strUUID2Bytes(DEFAULT_ADVERTISE_UUID, uuid128);
  int cmpUuid = compareUuid(uuid128, blesv_user_uuid);
  // BLE の設定
  if ( cmpUuid == 0 ){
    // Accepted values are: -40, -30, -20, -16, -12, -8, -4, 0, 4
    bleConfigure(-40);
    Serial.println("[default advertising service uuid]");
    Serial.println("BLE transmitter power : -40dBm");
  } else {
    bleConfigure(0);
    Serial.println("BLE transmitter power : 0dBm");
  }
  bleSetupServicePsdi();
  bleSetupServiceDevice();
  if (memcmp(blesv_devboard_uuid, blesv_user_uuid, sizeof(blesv_devboard_uuid))) {
    bleSetupServiceUser();
  }
  bleStartAdvertising();

  // ディスプレイ表示タイミングを作るタイマー
  timerDisplay.begin(500, displayUpdateEvent);
  timerDisplay.start();
  // BLE でセントラルにデータを送りつけるタイミングを作るタイマー
  timerNotify.begin(800, bleNotifyEvent);
  timerNotify.start();
  // SW 割り込みを設定
  attachInterrupt(SW1, sw1ChangedEvent, CHANGE);
  attachInterrupt(SW2, sw2ChangedEvent, CHANGE);
  // BJE JS mode で起動するか選択
  if(!digitalRead(SW2)){
    g_js_control_mode_flag = 1;
    return;
  }
}

void enterJsControlMode(){
  // Software Timerをストップ
  timerDisplay.stop();
  timerNotify.stop();
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

  display.clearDisplay();       // ディスプレイのバッファを初期化
  display.setTextSize(1);       // テキストサイズ 1
  display.setTextColor(WHITE);  // Color White
  display.setCursor(0, 10);     // X=0, Y=10
  display.println("JS control mode");
  display.display();            // ディスプレイを更新
  debugPrint("Enter to JS control mode");
}


void writeAdvertisingPacket(){
  // BLEのAdvertising UUIDを変更した場合
  if (g_flag_error_advertiseuuid) {
    String errorMsg =
        "[ERROR] : Write new advertising UUID, Hash isn't match. "
        "Please retry it.";
    debugPrint(errorMsg);
    display.clearDisplay();       // ディスプレイのバッファを初期化
    display.setTextSize(1);       // テキストサイズ 1
    display.setTextColor(WHITE);  // Color White
    display.setCursor(0, 10);     // X=0, Y=10
    display.println(errorMsg);
    display.display();            // ディスプレイを更新
    delay(5000);
    g_flag_update_advertiseuuid = 0;
    g_flag_error_advertiseuuid = 0;
    break;
  }
  configFileWrite(blesv_user_uuid);
  configFileRead();
  debugPrint("BLE advertising uuid changed from LIFF.");
  debugPrint("Enable new uuid after restart MPU.");
  debugPrint("Please push reset button.");
  display.clearDisplay();       // ディスプレイのバッファを初期化
  display.setTextSize(1);       // テキストサイズ 1
  display.setTextColor(WHITE);  // Color White
  display.setCursor(0, 10);     // X=0, Y=10
  display.println("BLE advertising uuid changed from LIFF.");
  display.println("Enable new uuid after restart MPU.");
  display.println("Please push reset button.");
  display.display();            // ディスプレイを更新
  for (;;);
}

void bleJsLoop(){
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
      displaySetConfigure(g_display.addr_x, g_display.addr_y);
      g_display.changed = 0;
    }
    //Display Write text
    if(g_display_text.changed){
      char text[16];
      for(int i = 0; i < 16; i++){
        text[i] = g_display_text.text[i];
      }
      displayWrite(g_display_fontsize, g_display_text.length, text);
      g_display_text.changed = 0;
    }
    //Display Clear
    if(g_display_clear){
      displayClear();
      g_display_clear = 0;
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

    //Write UUID advertising packet
    if (g_flag_update_advertiseuuid) {
      writeAdvertisingPacket();
    }

    //BLE Read action
    if(g_read_action.changed){
      byte data[4] = {0, 0, 0, 0};
      debugPrint("[BLE]Set read pointer : " + String(g_read_action.cmd));
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
    	blesv_devboard_io_read.write(data, sizeof(data));
      g_read_action.changed = 0;
    }
  }
}

void loop() {
  int sw1_value = 0;
  int sw2_value = 0;
  for (;;) {
    // JS Control mode
    if(g_js_control_mode_flag){
      //Enter to JS control mode
      enterJsControlMode();
      bleJsLoop();
    }

    // 温度センサから値を取得
    float temperature = temp.read();

    // 加速度センサから値を取得
    if (accel.available()) {
      accel.read();
    }

    // ボタンの状態を読む
    if (g_flag_sw1) {
      sw1_value = !digitalRead(SW1);
      g_flag_sw1 = 0;
    }
    if (g_flag_sw2) {
      sw2_value = !digitalRead(SW2);
      g_flag_sw2 = 0;
    }

    //Write UUID advertising packet
    if (g_flag_update_advertiseuuid) {
      writeAdvertisingPacket();
    }

    // BLEからWriteがあったときのブザーとLEDの制御
    if (g_flag_user_write) {
      // ブザー
      if (g_data_user_write_buzzer) {
        buzzerStart();
      } else {
        buzzerStop();
      }
      // LED
      digitalWrite(LED_DS2, g_data_user_write_led0);
      digitalWrite(LED_DS3, g_data_user_write_led1);
      digitalWrite(LED_DS4, g_data_user_write_led2);
      digitalWrite(LED_DS5, g_data_user_write_led3);
      // GPIO
      digitalWrite(GPIO2, g_data_user_write_io2);
      digitalWrite(GPIO3, g_data_user_write_io3);
      digitalWrite(GPIO4, g_data_user_write_io4);
      digitalWrite(GPIO5, g_data_user_write_io5);
      digitalWrite(GPIO12, g_data_user_write_io12);
      digitalWrite(GPIO13, g_data_user_write_io13);
      digitalWrite(GPIO14, g_data_user_write_io14);
      digitalWrite(GPIO15, g_data_user_write_io15);
      digitalWrite(GPIO16, g_data_user_write_io16);
      g_flag_user_write = 0;
    }

    // ディスプレイに表示
    if (g_flag_display) {
      display.clearDisplay();       // ディスプレイのバッファを初期化
      display.setTextSize(1);       // テキストサイズ 1
      display.setTextColor(WHITE);  // Color White
      display.setCursor(0, 10);     // X=0, Y=10
      if (Bluefruit.connected()) {
        display.println("LINE Things [BLE]");
      } else {
        display.println("LINE Things");
      }
      display.print("X:");
      display.println(accel.cx);
      display.print("Y:");
      display.println(accel.cy);
      display.print("Z:");
      display.println(accel.cz);
      display.print("Temperature:");
      display.println(temperature);
      if (sw1_value) {
        display.print("SW1:ON / ");
      } else {
        display.print("SW1:OFF / ");
      }
      if (sw2_value) {
        display.println("SW2:ON");
      } else {
        display.println("SW2:OFF");
      }
      display.display();            // ディスプレイを更新
      g_flag_display = 0;
    }

    // Notify Timing
    if (g_flag_notify && Bluefruit.connected()) {
      int16_t sw1 = (sw1_value) ? 1 : 0;
      int16_t sw2 = (sw2_value) ? 1 : 0;
      int16_t tx_frame[6] = {
        (int16_t) temperature * 100,
        accel.cx * 1000,
        accel.cy * 1000,
        accel.cz * 1000,
        sw1,
        sw2
      };
      blesv_devboard_notify.notify((uint8_t*)tx_frame, sizeof(tx_frame));
      g_flag_notify = 0;
    }
    delay(100);
  }
}
