import { io } from "socket.io-client";


let socket = io("https://peer-chat-server.vercel.app",{
    transports: ["websocket"],
});


export default socket;