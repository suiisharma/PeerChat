import { useEffect, useRef, useState } from "react";
import {
  FiVideo,
  FiVideoOff,
  FiMic,
  FiMicOff,
  FiSend,
  FiPaperclip,
  FiDownload,
} from "react-icons/fi";
import File from "../assets/file.svg";

import { LuScreenShare, LuScreenShareOff } from "react-icons/lu";
import { MdCallEnd } from "react-icons/md";
import "../styles/VideoRoom.css";
import { toast } from "react-hot-toast";
import socket from "./Socket";
import { useNavigate,useParams } from "react-router-dom";


const configuration = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};


let peerConnection;
let localStream = null;
let remoteVideo;
let localVideo;
let screenStream = null;
let roomJoinId = null;

socket.on("message", (message) => {
  if (!localStream) {
    return;
  }
  switch (message.type) {
    case "offer":
      handleOffer(message);
      break;
    case "answer":
      handleAnswer(message);
      break;
    case "candidate":
      handleCandidate(message);
      break;
    case "ready":
      if (peerConnection) {
        console.log("User is already in call");
        return;
      }
      makeCall();
      return;
    default:
      return;
  }
});

let makeCall = async () => {
  try {
    peerConnection = new RTCPeerConnection(configuration);
    peerConnection.onicecandidate = (e) => {
      let message = {
        type: "canidate",
        candidate: null,
      };
      if (e.candidate) {
        message.candidate = e.candidate.candidate;
        message.sdpMid = e.candidate.sdpMid;
        message.sdpMLineIndex = e.candidate.sdpMLineIndex;
      }
      socket.emit("message",roomJoinId, message);
    };
    peerConnection.ontrack = (e) => {
      remoteVideo.current.srcObject = e.streams[0];
    };
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });
    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("message",roomJoinId, {
      type: "offer",
      sdp: offer.sdp,
    });
  } catch (error) {
    console.log("Error occured while making the call");
  }
};

let handleCandidate = async (candidate) => {
  try {
    if (!peerConnection) {
      console.log("No peer connection");
      return;
    } else {
      if (candidate) {
        await peerConnection.addIceCandidate(candidate);
      }
    }
  } catch (error) {
    console.log(error);
  }
};

let handleHangup = () => {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
    socket.emit("hangup",roomJoinId);
  }
  if (remoteVideo) {
    remoteVideo.current.srcObject = null;
  }
  if (screenStream) {
    screenStream.getTracks().forEach((track) => track.stop());
    screenStream = null;
  }
  
};

let handleOffer = async (offer) => {
  if (peerConnection) {
    console.log("User is already in call");
    toast.error("User is already in call");
    return;
  }
  try {
    peerConnection = new RTCPeerConnection(configuration);

    peerConnection.onicecandidate = (e) => {
      let message = {
        type: "candidate",
        candidate: null,
      };
      if (e.candidate) {
        message.candidate = e.candidate.candidate;
        message.sdpMid = e.candidate.sdpMid;
        message.sdpMLineIndex = e.candidate.sdpMLineIndex;
      }
      socket.emit("message",roomJoinId, message);
    };
    peerConnection.ontrack = (e) => {
      remoteVideo.current.srcObject = e.streams[0];
    };
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });
    await peerConnection.setRemoteDescription({
      type: "offer",
      sdp: offer.sdp,
    });
    let answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("message",roomJoinId, { type: "answer", sdp: answer.sdp });
  } catch (error) {
    toast.error(error?.message || "Error occured while handling offer");
  }
};

let handleAnswer = async (answer) => {
  if (!peerConnection) {
    console.log("No peer connection");
    toast.error("No peer connection");
    return;
  }
  try {
    await peerConnection.setRemoteDescription(answer);
  } catch (error) {
    console.log(error);
  }
};

const VideoRoom = () => {
  localVideo = useRef(null);
  remoteVideo = useRef(null);

  const navigate=useNavigate();


  const { roomId } = useParams();
  roomJoinId = roomId;
  let [isCameraOn, setIsCameraOn] = useState(true);
  let [isMicOn, setIsMicOn] = useState(true);
  let [isScreenSharing, setIsScreenSharing] = useState(false);
  let cameraBtn = useRef(null);
  let [message, setMessage] = useState("");
  let [messages, setMessages] = useState([]);

  let handleSendMessage = async () => {
    if (!peerConnection) {
      toast.error("No receiver found!");
      return;
    }
    if (!message.trim()) {
      toast.error("Message cannot be empty!");
      return;
    }
    socket.emit("chat-message",roomJoinId, message);
    setMessage("");
    setMessages((prev) => {
      return [...prev, { text: message, isOutgoing: true ,type:"text"}];
    });
  };

  useEffect(() => {
    let startStream = async () => {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        localVideo.current.srcObject = localStream;

        socket.emit("message",roomJoinId, { type: "ready" });
      } catch (error) {
        toast.error("Error occured while starting the call");
      }
    };
    startStream();

    socket.on("hangup", () => {
      handleHangup();
      navigate("/",{replace:true});
      window.location.reload();
    });
    socket.on("chat-message", (message) => {
      setMessages((prev) => {
        return [...prev, { text: message, isOutgoing: false,type:"text" }];
      });
    });
    socket.on("file", (data) => {
      const { fileName, fileDataUrl } = data;
      setMessages((prev) => {
        return [
          ...prev,
          {
            fileName,
            fileDataUrl,
            isOutgoing: false,
          },
        ];
      });
    });
    return () => {
      handleHangup();
      socket.off("chat-message");
      socket.off("file");
      socket.off("hangup");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let handleScrenShareStateChange = async () => {
    if (!isScreenSharing) {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      if (peerConnection) {
        localVideo.current.srcObject = screenStream;
        cameraBtn.current.disabled = true;
        let videoSender = await peerConnection
          .getSenders()
          .find((sender) => sender.track.kind === "video");
        await videoSender.replaceTrack(screenStream.getVideoTracks()[0]);
        cameraBtn.current.disabled = true;
        setIsScreenSharing((prev) => !prev);
        setIsCameraOn(false);
      }
    } else {
      localVideo.current.srcObject = localStream;
      if (peerConnection) {
        for (let track of screenStream.getTracks()) {
          track.stop();
        }
        screenStream = null;
        cameraBtn.current.disabled = false;
        let videoSender = await peerConnection
          .getSenders()
          .find((sender) => sender.track.kind === "video");
        await videoSender.replaceTrack(localStream.getVideoTracks()[0]);
        setIsScreenSharing((prev) => !prev);
        setIsCameraOn(true);
      }
    }
  };
  let handleCameraStateChange = async () => {
    if (isScreenSharing) {
      toast.error("Cannot turn off camera while screen sharing");
      return;
    }
    localStream.getVideoTracks()[0].enabled = !isCameraOn;
    setIsCameraOn((prev) => !prev);
  };
  let handleMicStateChange = () => {
    localStream.getAudioTracks()[0].enabled = !isMicOn;
    setIsMicOn((prev) => !prev);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const fileDataUrl = e.target.result;
      // it contains the file as data url
      socket.emit("file",{roomJoinId, fileDataUrl, fileName: file.name });
      setMessages((prev) => {
        return [
          ...prev,
          { fileName: file.name, fileDataUrl, isOutgoing: true,type:"file" },
        ];
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="container">
      <div className="bg-main">
        <video
          ref={localVideo}
          className="video-item"
          autoPlay
          playsInline
        ></video>
        <video
          ref={remoteVideo}
          className="video-item"
          autoPlay
          playsInline
        ></video>
      </div>
      <div className="chat-div">
        <div className="messages">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`message ${msg.isOutgoing ? "outgoing" : "incoming"}`}
            >
              {msg.type === "text" ? (
                msg.text
              ) : (
                <div className="file-display">
                {msg.fileDataUrl && msg.fileDataUrl.startsWith('data:image') ? (
                  <img src={msg.fileDataUrl} alt="File" className="img" />
                ) : (
                  <img src={File} alt="Document" className="document-icon" /> 
                )}
                <a href={msg.fileDataUrl} download={msg.fileName} className="download-link">
                  <FiDownload style={{ marginRight: '8px' }} />
                  {msg.fileName}
                </a>
              </div>
              
              )}
            </div>
          ))}
        </div>
        <div className="chat-input">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSendMessage();
              }
            }}
            placeholder="Type a message"
          />
          <input
            type="file"
            onChange={handleFileChange}
            style={{ display: "none" }}
            id="fileInput"
          />
          <div className="fileInput">
          <label  htmlFor="fileInput">
            <FiPaperclip />
          </label>
          </div>
          <button onClick={handleSendMessage}>
            <FiSend />
          </button>
        </div>
      </div>
      <div className="control-btn">
        <button
          className={`videoControl ${isScreenSharing ? "danger-btn" : ""} screenshare`}
          onClick={handleScrenShareStateChange}
        >
          {isScreenSharing ? (
            <LuScreenShare></LuScreenShare>
          ) : (
            <LuScreenShareOff></LuScreenShareOff>
          )}
        </button>
        <button
          className={`videoControl ${!isCameraOn ? "danger-btn" : ""}`}
          ref={cameraBtn}
          onClick={handleCameraStateChange}
        >
          {isCameraOn ? <FiVideo></FiVideo> : <FiVideoOff></FiVideoOff>}
        </button>
        <button
          className={`audioControl ${!isMicOn ? "danger-btn" : ""}`}
          onClick={handleMicStateChange}
        >
          {isMicOn ? <FiMic></FiMic> : <FiMicOff></FiMicOff>}
        </button>
        <button className="hangupControl danger-btn" onClick={()=>{
          handleHangup();
          navigate("/");
          window.location.reload();
        }}>
          <MdCallEnd></MdCallEnd>
        </button>
      </div>
    </div>
  );
};

export default VideoRoom;
