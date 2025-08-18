import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io();

function App() {
  const [room, setRoom] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [message, setMessage] = useState('');
  const [gameState, setGameState] = useState(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [pokemonOptions, setPokemonOptions] = useState([]);
  const [auctionPokemon, setAuctionPokemon] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [inAuction, setInAuction] = useState(false);
  const [gameOver, setGameOver] = useState(null);
  const [animationStep, setAnimationStep] = useState('');
  const [auctionResult, setAuctionResult] = useState(null);


  useEffect(() => {
    socket.on('connect', () => console.log('Connected to server'));
    socket.on('roomCreated', (roomID) => {
      setRoom(roomID);
      setMessage(`Has creado la sala: ${roomID}`);
    });
    socket.on('roomJoined', (roomID) => {
      setRoom(roomID);
      setMessage(`Te has unido a la sala: ${roomID}`);
    });
    socket.on('playerJoined', () => setMessage('Otro jugador se ha unido.'));
    socket.on('roomFull', () => setMessage('La sala está llena.'));

    socket.on('gameStart', (initialGameState) => {
      setGameState(initialGameState);
      setMessage('¡El juego ha comenzado!');
    });

    socket.on('yourTurn', (options) => {
      setIsMyTurn(true);
      setPokemonOptions(options);
      setInAuction(false);
      setMessage('¡Es tu turno! Elige un Pokémon para subastar.');
    });

    socket.on('waitingForOpponent', () => {
        setIsMyTurn(false);
        setMessage('Esperando a que el oponente elija un Pokémon.');
    });

    socket.on('auctionStart', (pokemon) => {
        setAuctionPokemon(pokemon);
        setPokemonOptions([]);
        setIsMyTurn(false);
        setInAuction(true);
        setMessage(`¡Subasta! puja por ${pokemon.name}`);
    });

    socket.on('auctionResult', ({ winner, winningBid, pokemon, gameState: newGameState }) => {
        const winnerMsg = winner === socket.id ? '¡Ganaste la subasta!' : `El jugador ${winner} ganó la subasta.`;
        setMessage(`${winnerMsg} Se llevó a ${pokemon.name} por ${winningBid}.`);
        setGameState(newGameState);
        setInAuction(false);
        setAuctionPokemon(null);
    });

    socket.on('auctionReveal', (result) => {
        setAuctionResult(result);
        setAnimationStep('reveal'); // Start the animation sequence
        
        setTimeout(() => {
            setAnimationStep('move');
        }, 2000); // Show bids for 2s

        setTimeout(() => {
            setAnimationStep('done');
            socket.emit('animationComplete', room);
        }, 3000); // Animation takes 1s
    });

    socket.on('updateGameState', (newGameState) => {
        setGameState(newGameState);
        setAuctionResult(null);
        setAnimationStep('');
    });

    socket.on('gameOver', (finalGameState) => {
        setGameState(finalGameState);
        const endMessage = "¡El draft ha terminado! Este es tu equipo final.";
        setGameOver(endMessage);
        setMessage('¡Juego terminado!');
    });

    socket.on('playerLeft', () => setMessage('El otro jugador ha abandonado la sala.'));

    return () => {
      socket.off('connect');
      socket.off('roomCreated');
      socket.off('roomJoined');
      socket.off('playerJoined');
      socket.off('roomFull');
      socket.off('gameStart');
      socket.off('yourTurn');
      socket.off('waitingForOpponent');
      socket.off('auctionStart');
      socket.off('auctionResult');
      socket.off('auctionReveal');
      socket.off('updateGameState');
      socket.off('gameOver');
      socket.off('playerLeft');
    };
  }, []);

  const handleJoinRoom = () => {
    if (roomInput.trim() !== '') socket.emit('joinRoom', roomInput);
  };

  const handleSelectPokemon = (pokemon) => {
    socket.emit('pokemonSelected', { roomID: room, pokemon });
    setPokemonOptions([]);
    setIsMyTurn(false);
  };

  const handlePlaceBid = () => {
    const bid = parseInt(bidAmount, 10);
    if (!isNaN(bid) && bid > 0) {
      socket.emit('placeBid', { roomID: room, bid });
      setBidAmount('');
      setInAuction(false); // Disable bidding after placing one
      setMessage('Puja realizada. Esperando al oponente...');
    }
  };

  const renderLobby = () => (
    <div>
      <input
        type="text"
        placeholder="Introduce el ID de la sala"
        value={roomInput}
        onChange={(e) => setRoomInput(e.target.value)}
      />
      <button onClick={handleJoinRoom}>Unirse/Crear Sala</button>
    </div>
  );

  const renderGame = () => (
    <div>
        <h2>Sala: {room}</h2>
        <p>{message}</p>
        
        {isMyTurn && (
            <div>
                <h3>Elige un Pokémon para subastar:</h3>
                <div className="pokemon-options">
                    {pokemonOptions.map(p => (
                        <div key={p.id} className="pokemon-card" onClick={() => handleSelectPokemon(p)}>
                            <img src={p.sprite} alt={p.name} />
                            <p>{p.name}</p>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {inAuction && (
             <div>
                <h3>Subasta de {auctionPokemon?.name}</h3>
                <img src={auctionPokemon?.sprite} alt={auctionPokemon?.name} />
                <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder="Tu puja"
                />
                <button onClick={handlePlaceBid}>Pujar</button>
            </div>
        )}

        {animationStep && auctionResult && (
            <div className={`auction-reveal ${animationStep}`}>
                <div className="player-bid">
                    <h4>Tú ({Object.keys(auctionResult.bids).find(id => id === socket.id)})</h4>
                    <p>Puja: {auctionResult.bids[socket.id]}</p>
                </div>

                <div className={`pokemon-animation-container ${auctionResult.winner === socket.id ? 'move-to-player' : 'move-to-opponent'}`}>
                    <img src={auctionResult.pokemon.sprite} alt={auctionResult.pokemon.name} />
                </div>

                <div className="player-bid">
                     <h4>Oponente ({Object.keys(auctionResult.bids).find(id => id !== socket.id)})</h4>
                    <p>Puja: {auctionResult.bids[Object.keys(auctionResult.bids).find(id => id !== socket.id)]}</p>
                </div>
            </div>
        )}

        {gameOver && (
            <div className="game-over">
                <h2>{message}</h2>
                <p>{gameOver}</p>
            </div>
        )}

        {gameState && (
            <div className="game-state">
                {Object.entries(gameState.players).map(([id, data]) => (
                    <div key={id} className="player-info">
                        <h4>{id === socket.id ? 'Tú' : 'Oponente'} ({id})</h4>
                        <p>Dinero: {data.money}</p>
                        <div className="team">
                            {data.team.map((p, i) => (
                                <img key={i} src={p.sprite} alt={p.name} title={p.name} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
  );

  return (
    <div className="App">
      <h1>Pokémon Bet</h1>
      {!room || !gameState ? renderLobby() : renderGame()}
    </div>
  );
}

export default App;
