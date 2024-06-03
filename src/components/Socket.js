import { io } from "socket.io-client";


let socket = io("https://peerchatserver.onrender.com",{
    transports: ["websocket"],
});


export default socket;