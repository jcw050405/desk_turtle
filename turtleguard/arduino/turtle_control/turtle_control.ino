#if defined(ARDUINO_ARCH_ESP32)
#include <ESP32Servo.h>
const int servoPin = 2;
#else
#include <Servo.h>
const int servoPin = 9;
#endif

Servo turtleServo;
const int goodAngle = 0;
const int badAngle = 90;

void moveGood() {
  turtleServo.write(goodAngle);
  Serial.println("ACK:GOOD");
}

void moveBad() {
  turtleServo.write(badAngle);
  Serial.println("ACK:BAD");
}

void handleCommand(char command) {
  if (command == '1' || command == 'B' || command == 'b') {
    moveBad();
    return;
  }

  if (command == '0' || command == 'G' || command == 'g') {
    moveGood();
    return;
  }

  if (command == '\n' || command == '\r' || command == ' ') {
    return;
  }

  Serial.print("ERR:UNKNOWN:");
  Serial.println(command);
}

void setup() {
  Serial.begin(9600);
  delay(500);

#if defined(ARDUINO_ARCH_ESP32)
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);

  turtleServo.setPeriodHertz(50);
  turtleServo.attach(servoPin, 500, 2400);
#else
  turtleServo.attach(servoPin);
#endif

  turtleServo.write(goodAngle);
  Serial.println("READY:TURTLE");
}

void loop() {
  if (Serial.available() > 0) {
    char command = Serial.read();
    handleCommand(command);
  }
}
