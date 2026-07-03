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

void setup() {
  Serial.begin(9600);

#if defined(ARDUINO_ARCH_ESP32)
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);

  turtleServo.setPeriodHertz(50);
  turtleServo.attach(servoPin, 500, 2400);
#else
  turtleServo.attach(servoPin);
#endif

  turtleServo.write(goodAngle);
}

void loop() {
  if (Serial.available() > 0) {
    char command = Serial.read();

    if (command == '1') {
      turtleServo.write(badAngle);
    } else if (command == '0') {
      turtleServo.write(goodAngle);
    }
  }
}
