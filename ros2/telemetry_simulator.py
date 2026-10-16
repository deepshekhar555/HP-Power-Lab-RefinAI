import rclpy
from rclpy.node import Node
from std_msgs.msg import String
import json
import random
import time

class RefinAiTelemetrySimulator(Node):
    def __init__(self):
        super().__init__('refinai_telemetry_simulator')
        self.publisher_ = self.create_publisher(String, '/refinery/telemetry', 10)
        self.timer = self.create_timer(1.0, self.publish_telemetry)
        self.get_logger().info('Starting RefinAI Multi-Asset Telemetry Simulator (1 Hz)...')

        # Baseline parameters for UCI CCPP model
        self.at = 25.0   # Ambient Temperature (°C)
        self.v = 60.0    # Exhaust Vacuum (cm Hg)
        self.ap = 1013.0 # Ambient Pressure (mbar)
        self.rh = 70.0   # Relative Humidity (%)

    def publish_telemetry(self):
        # Random walk fluctuations
        self.at += random.uniform(-0.2, 0.2)
        self.v += random.uniform(-0.3, 0.3)
        self.ap += random.uniform(-0.1, 0.1)
        self.rh += random.uniform(-0.5, 0.5)

        # Estimate net electrical yield (PE) based on physical correlations
        pe = 480.0 - (1.8 * self.at) - (0.3 * self.v) + (0.1 * (self.ap - 1000))

        payload = {
            "AT": round(self.at, 2),
            "V": round(self.v, 2),
            "AP": round(self.ap, 2),
            "RH": round(self.rh, 2),
            "PE": round(pe, 2),
            "timestamp": int(time.time() * 1000)
        }

        msg = String()
        msg.data = json.dumps(payload)
        self.publisher_.publish(msg)
        self.get_logger().info(f'Published: AT={payload["AT"]}°C, PE={payload["PE"]}MW')

def main(args=None):
    rclpy.init(args=args)
    node = RefinAiTelemetrySimulator()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()
