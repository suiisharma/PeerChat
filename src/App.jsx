import RoomJoin from "./components/RoomJoin"
import VideoRoom from "./components/VideoRoom"
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";


const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RoomJoin />} />
        <Route path="/room/:roomId" element={<VideoRoom />} />
      </Routes>
    </Router>
  )
}

export default App