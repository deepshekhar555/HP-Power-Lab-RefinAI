import rclpy
from rclpy.node import Node
from std_msgs.msg import String
import websocket
import json
import threading

class RefinAiTelemetryBridge(Node):
    def __init__(self, ws_url="ws://localhost:3000"):
        super().__init__('refinai_telemetry_bridge')
        self.get_logger().info('Starting RefinAI ROS 2 Telemetry Bridge...')
        self.ws_url = ws_url
        self.ws = None
        self.connect_websocket()

        self.subscription = self.create_subscription(
            String,
            '/refinery/telemetry',
            self.telemetry_callback,
            10
        )

    def connect_websocket(self):
        try:
            self.ws = websocket.WebSocketApp(
                self.ws_url,
                on_open=lambda ws: self.get_logger().info("Connected to RefinAI Server"),
                on_error=lambda ws, err: self.get_logger().error(f"WebSocket Error: {err}")
            )
            wst = threading.Thread(target=self.ws.run_forever)
            wst.daemon = True
            wst.start()
        except Exception as e:
            self.get_logger().error(f"Failed connection: {e}")

    def telemetry_callback(self, msg):
        if self.ws and self.ws.sock and self.ws.sock.connected:
            try:
                data = json.loads(msg.data)
                self.ws.send(json.dumps(data))
            except Exception as e:
                self.get_logger().error(f"Failed to publish: {e}")

def main(args=None):
    rclpy.init(args=args)
    node = RefinAiTelemetryBridge()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()
