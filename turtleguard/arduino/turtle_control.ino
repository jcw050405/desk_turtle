#include <Servo.h>

Servo turtleServo;
const int servoPin = 9;

void setup() {
  Serial.begin(9600);
  turtleServo.attach(servoPin);
  turtleServo.write(0); // Initial position (Good Posture)
}

void loop() {
  if (Serial.available() > 0) {
    char command = Serial.read();
    if (command == '1') {
      // Bad posture - Turtle sticks out
      turtleServo.write(90); 
    } else if (command == '0') {
      // Good posture - Turtle goes back
      turtleServo.write(0);
    }
  }
}
