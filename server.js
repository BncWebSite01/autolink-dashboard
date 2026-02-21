const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(path.join(__dirname, 'public')));

// --- 🌐 MQTT Setup ---
const mqttClient = mqtt.connect('mqtt://broker.emqx.io');

mqttClient.on('connect', () => {
    console.log('✅ MQTT Connected to EMQX Broker');
    mqttClient.subscribe(['autolink/v1/sensor/telemetry', 'autolink/v1/device/status']);
});

mqttClient.on('message', (topic, message) => {
    const value = message.toString();
    if (topic === 'autolink/v1/sensor/telemetry') {
        io.emit('telemetry_stream', {
            deviceId: 'ESP32_PRO',
            value: value,
            timestamp: Date.now()
        });
        if (parseFloat(value) > 80) {
            io.emit('system_activity', { status: 'Critical', event: 'Heat Alert!', deviceId: 'ESP32_PRO' });
        }
    }
});

// --- 🎮 Socket.io Handling ---
io.on('connection', (socket) => {
    console.log('📱 A User Connected');

    socket.on('control_device', (data) => {
        console.log(`📡 Command Received: ${data.command} for ${data.deviceId}`);
        mqttClient.publish(`autolink/control/${data.deviceId}`, data.command);
        
        // ส่งสถานะกลับไปบอก Frontend ว่าคำสั่งถูกส่งแล้ว
        io.emit('system_activity', { status: 'Command', event: `Sent: ${data.command}`, deviceId: data.deviceId });
    });

    socket.on('set_threshold', (data) => {
        mqttClient.publish('autolink/config/threshold', data.value.toString());
    });
});

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const PORT = process.env.PORT || 3000;
// ใช้ 0.0.0.0 เพื่อให้ IP 172.20.10.3 เข้าถึงได้จากภายนอก
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is running on:`);
    console.log(`   - Local: http://localhost:${PORT}`);
    console.log(`   - Mobile: http://172.20.10.3:${PORT}`);
});