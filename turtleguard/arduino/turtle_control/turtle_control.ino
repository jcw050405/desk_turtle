#if defined(ARDUINO_ARCH_ESP32)
#include <ESP32Servo.h>
const int servoPin = 2;
#else
#include <Servo.h>
const int servoPin = 9;
#endif

Servo turtleServo;
const int goodAngle = 10;
const int badAngle = 80;
const int stepDegrees = 2;
const int stepDelayMs = 12;
int currentAngle = goodAngle;

void moveServoTo(int targetAngle) {
  targetAngle = constrain(targetAngle, goodAngle, badAngle);

  if (targetAngle == currentAngle) {
    return;
  }

  const int direction = targetAngle > currentAngle ? 1 : -1;

  while (currentAngle != targetAngle) {
    currentAngle += direction * stepDegrees;

    if ((direction > 0 && currentAngle > targetAngle) ||
        (direction < 0 && currentAngle < targetAngle)) {
      currentAngle = targetAngle;
    }

    turtleServo.write(currentAngle);
    delay(stepDelayMs);
  }
}

void moveGood() {
  moveServoTo(goodAngle);
  Serial.print("ACK:GOOD:");
  Serial.println(currentAngle);
}

void moveBad() {
  moveServoTo(badAngle);
  Serial.print("ACK:BAD:");
  Serial.println(currentAngle);
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

  currentAngle = goodAngle;
  turtleServo.write(currentAngle);
  Serial.println("READY:TURTLE");
}

void loop() {
  if (Serial.available() > 0) {
    char command = Serial.read();
    handleCommand(command);
  }
}
