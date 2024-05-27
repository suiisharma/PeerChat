import { useEffect, useState } from "react";
import "../styles/RoomJoin.css";
import { FiCopy, FiPhoneCall } from 'react-icons/fi';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import socket from "./Socket";
import { toast } from "react-hot-toast";

const RoomJoin = () => {
    let [roomId, setRoomId] = useState('');

    let [id, setId] = useState('');
    let navigate = useNavigate();

    useEffect(() => {
        
        let fetchData = async () => {
            let response = await axios.get("https://peerchatserver.onrender.com/create-room-id");
            let id = response.data.id;
            setId(id);
        }
        if (!id) fetchData();
    },[id]);

    let handleUpdateRoomId = (e) => {
        setRoomId(e.target.value);
    };

    let handleCopy = () => {
        toast.success("Room ID copied to clipboard");
        navigator.clipboard.writeText(id);
    }


    let handleCall = async () => {
        if (!roomId) {
            toast.error("Please enter the Room ID");
            return;
        }
        socket.emit("join-room", roomId);
        navigate(`/room/${roomId}`);
        setRoomId('');
    }

    return (
        <div className="container">
            <div className="card">
                <div className="copy-div">
                    <p>Room Id(random): {id}</p>
                    <FiCopy onClick={handleCopy}></FiCopy>
                </div>
                <div className="join-div">
                    <input placeholder="Enter the Room ID" value={roomId} onChange={handleUpdateRoomId} type="text" name="Room Id" id="roomId" />
                    <button onClick={handleCall}>
                        <FiPhoneCall></FiPhoneCall>
                    </button>
                </div>
            </div>

        </div>
    )
}

export default RoomJoin