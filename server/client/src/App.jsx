import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:3001');

function App() {
  const [room, setRoom] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server');
    });

    socket.on('roomCreated', (roomID) => {
      setRoom(roomID);
      setMessage(`Has creado la sala: ${roomID}`);
    });

    socket.on('roomJoined', (roomID) => {
      setRoom(roomID);
      setMessage(`Te has unido a la sala: ${roomID}`);
    });

    socket.on('playerJoined', (playerID) => {
      setMessage(`El jugador ${playerID} se ha unido a la sala.`);
    });
    
    socket.on('roomFull', () => {
      setMessage('La sala está llena.');
    });

    socket.on('gameStart', (players) => {
      setMessage(`¡El juego ha comenzado! Jugadores: ${players.join(', ')}`);
    });

    socket.on('playerLeft', (playerID) => {
      setMessage(`El jugador ${playerID} ha abandonado la sala.`);
    });


    return () => {
      socket.off('connect');
      socket.off('roomCreated');
      socket.off('roomJoined');
      socket.off('playerJoined');
      socket.off('roomFull');
      socket.off('gameStart');
      socket.off('playerLeft');
    };
  }, []);

  const handleJoinRoom = () => {
    if (roomInput.trim() !== '') {
      socket.emit('joinRoom', roomInput);
    }
  };

  return (
    <div className="App">
      <h1>Pokémon Bet</h1>
      {!room ? (
        <div>
          <input
            type="text"
            placeholder="Introduce el ID de la sala"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
          />
          <button onClick={handleJoinRoom}>Unirse/Crear Sala</button>
        </div>
      ) : (
        <div>
          <h2>Sala: {room}</h2>
        </div>
      )}
       <p>{message}</p>
    </div>
  );
}

export default App;
